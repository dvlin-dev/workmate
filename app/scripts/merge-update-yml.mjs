#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

const fail = (message) => {
  throw new Error(message);
};

const assertFeed = (name, feed) => {
  if (!feed || typeof feed !== 'object') fail(`${name} feed is not an object`);
  if (!Array.isArray(feed.files)) fail(`${name} feed is missing files array`);
};

export const mergeUpdateFeeds = ({ arm64Feed, x64Feed }) => {
  assertFeed('arm64', arm64Feed);
  assertFeed('x64', x64Feed);

  return {
    version: arm64Feed.version,
    files: [...arm64Feed.files, ...x64Feed.files],
    path: arm64Feed.path,
    sha512: arm64Feed.sha512,
    releaseDate: arm64Feed.releaseDate,
  };
};

const readFeed = async (filePath) => yaml.load(await fs.readFile(filePath, 'utf8'));

const parseArgs = (argv) => {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(`Usage: node scripts/merge-update-yml.mjs --arm64-dir <dir> --x64-dir <dir> --output-dir <dir>

Merges architecture-specific latest-mac.yml files into one GitHub Release update feed.`);
    process.exit(0);
  }

  const values = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      fail(`Missing value for ${current}`);
    }
    values.set(current, value);
    index += 1;
  }

  const arm64Dir = values.get('--arm64-dir');
  const x64Dir = values.get('--x64-dir');
  const outputDir = values.get('--output-dir');

  if (!arm64Dir) fail('Missing --arm64-dir');
  if (!x64Dir) fail('Missing --x64-dir');
  if (!outputDir) fail('Missing --output-dir');

  return {
    arm64Dir: path.resolve(arm64Dir),
    x64Dir: path.resolve(x64Dir),
    outputDir: path.resolve(outputDir),
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const arm64Feed = await readFeed(path.join(args.arm64Dir, 'latest-mac.yml'));
  const x64Feed = await readFeed(path.join(args.x64Dir, 'latest-mac.yml'));
  const merged = mergeUpdateFeeds({ arm64Feed, x64Feed });

  await fs.mkdir(args.outputDir, { recursive: true });

  const outputPath = path.join(args.outputDir, 'latest-mac.yml');
  await fs.writeFile(outputPath, yaml.dump(merged, { lineWidth: 120, noRefs: true }));

  console.log(
    JSON.stringify(
      {
        version: merged.version,
        files: merged.files.length,
        outputPath,
      },
      null,
      2
    )
  );
};

if (process.argv[1]?.endsWith('merge-update-yml.mjs')) {
  await main();
}
