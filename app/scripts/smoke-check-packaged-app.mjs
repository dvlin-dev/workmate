#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { listPackage } from '@electron/asar';

const FAILURE_PATTERNS = [
  'ERR_MODULE_NOT_FOUND',
  'Uncaught Exception',
  'A JavaScript error occurred in the main process',
];

const HELP_TEXT = `Usage: node scripts/smoke-check-packaged-app.mjs (--app <Workmate.app> | --app-dir <release-dir>) --require-package <name>

Verifies that a packaged macOS app contains required runtime packages and that the
main process stays alive for the configured smoke window.

Options:
  --app <path>                Path to the packaged .app bundle
  --app-dir <path>            Directory that contains exactly one packaged .app bundle
  --require-package <name>    Runtime package that must exist inside app.asar (repeatable)
  --timeout-ms <number>       Smoke window in milliseconds (default: 12000)`;

const fail = (message) => {
  throw new Error(message);
};

const isFlag = (value) => value.startsWith('--');

const parseArgs = (argv) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  let appPath;
  let appDir;
  let timeoutMs = 12_000;
  const requiredPackages = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!isFlag(current)) continue;
    const value = argv[index + 1];
    if (!value || isFlag(value)) {
      fail(`Missing value for ${current}`);
    }

    switch (current) {
      case '--app':
        appPath = value;
        break;
      case '--app-dir':
        appDir = value;
        break;
      case '--require-package':
        requiredPackages.push(value);
        break;
      case '--timeout-ms':
        timeoutMs = Number.parseInt(value, 10);
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
          fail(`Invalid --timeout-ms: ${value}`);
        }
        break;
      default:
        fail(`Unknown flag: ${current}`);
    }

    index += 1;
  }

  if (appPath && appDir) fail('Use either --app or --app-dir, not both');
  if (!appPath && !appDir) fail('Missing --app or --app-dir');
  if (requiredPackages.length === 0) fail('At least one --require-package is required');

  return {
    appPath: appPath ? path.resolve(appPath) : undefined,
    appDir: appDir ? path.resolve(appDir) : undefined,
    requiredPackages,
    timeoutMs,
  };
};

const findAppBundles = async (searchDir) => {
  const entries = await fs.readdir(searchDir, { withFileTypes: true });
  const bundles = [];

  for (const entry of entries) {
    const entryPath = path.join(searchDir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.endsWith('.app')) {
      bundles.push(entryPath);
      continue;
    }
    bundles.push(...(await findAppBundles(entryPath)));
  }

  return bundles;
};

const resolveAppPath = async ({ appPath, appDir }) => {
  if (appPath) return appPath;
  const bundles = await findAppBundles(appDir);
  if (bundles.length === 0) {
    fail(`Could not find a packaged .app bundle under ${appDir}`);
  }
  if (bundles.length > 1) {
    fail(`Expected exactly one packaged .app bundle under ${appDir}, found: ${bundles.join(', ')}`);
  }
  return bundles[0];
};

const appNameFromBundle = (appPath) => {
  const basename = path.basename(appPath);
  if (!basename.endsWith('.app')) {
    fail(`--app must point to a .app bundle: ${appPath}`);
  }
  return basename.slice(0, -'.app'.length);
};

const ensurePackageExists = (asarPath, packageName) => {
  const packagePrefix = `/node_modules/${packageName}`;
  const entries = listPackage(asarPath);
  const found = entries.some(
    (entry) => entry === packagePrefix || entry.startsWith(`${packagePrefix}/`)
  );

  if (!found) {
    fail(`Missing required package in app.asar: ${packageName}`);
  }
};

const containsFailureSignature = (buffer) =>
  FAILURE_PATTERNS.find((pattern) => buffer.includes(pattern));

const killProcess = async (child) => {
  if (child.exitCode !== null) return;

  child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (child.exitCode === null) {
    child.kill('SIGKILL');
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
};

const smokeLaunch = async (binaryPath, timeoutMs) => {
  const stdoutChunks = [];
  const stderrChunks = [];
  const smokeUserDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workmate-smoke-'));

  const child = spawn(binaryPath, [`--user-data-dir=${smokeUserDataDir}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      CI: process.env.CI ?? '1',
      WORKMATE_RELEASE_SMOKE: '1',
    },
  });

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => stdoutChunks.push(chunk));
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

  const result = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (child.exitCode !== null) {
        resolve({ status: 'exited', code: child.exitCode, signal: child.signalCode ?? null });
        return;
      }
      resolve({ status: 'alive', code: null, signal: null });
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ status: 'exited', code, signal });
    });
  });

  const stdout = stdoutChunks.join('');
  const stderr = stderrChunks.join('');
  const failureSignature = containsFailureSignature(`${stdout}\n${stderr}`);

  if (result.status === 'exited') {
    await fs.rm(smokeUserDataDir, { recursive: true, force: true });
    fail(
      `Packaged app exited before smoke timeout (code=${String(result.code)} signal=${String(
        result.signal
      )}).\n${stderr || stdout}`
    );
  }

  if (failureSignature) {
    await killProcess(child);
    await fs.rm(smokeUserDataDir, { recursive: true, force: true });
    fail(`Packaged app emitted failure signature "${failureSignature}".\n${stderr || stdout}`);
  }

  await killProcess(child);
  await fs.rm(smokeUserDataDir, { recursive: true, force: true });

  return {
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: Buffer.byteLength(stderr),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const appPath = await resolveAppPath(args);
  const appName = appNameFromBundle(appPath);
  const asarPath = path.join(appPath, 'Contents', 'Resources', 'app.asar');
  const binaryPath = path.join(appPath, 'Contents', 'MacOS', appName);

  await fs.access(asarPath);
  await fs.access(binaryPath);

  for (const packageName of args.requiredPackages) {
    ensurePackageExists(asarPath, packageName);
  }

  const launch = await smokeLaunch(binaryPath, args.timeoutMs);

  console.log(
    JSON.stringify(
      {
        app: appPath,
        checkedPackages: args.requiredPackages,
        timeoutMs: args.timeoutMs,
        ...launch,
        status: 'ok',
      },
      null,
      2
    )
  );
};

await main();
