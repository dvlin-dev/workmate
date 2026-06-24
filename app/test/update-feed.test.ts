import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

const scriptPath = path.resolve('scripts/merge-update-yml.mjs');

async function makeFeedDirs() {
  const root = await mkdtemp(path.join(tmpdir(), 'workmate-update-feed-'));
  const arm64Dir = path.join(root, 'darwin-arm64');
  const x64Dir = path.join(root, 'darwin-x64');

  await mkdir(arm64Dir, { recursive: true });
  await mkdir(x64Dir, { recursive: true });

  return { root, arm64Dir, x64Dir, outputDir: path.join(root, 'out') };
}

function feedYaml(arch: 'arm64' | 'x64') {
  return [
    'version: 0.2.0',
    'files:',
    `  - url: Workmate-0.2.0-${arch}.zip`,
    `    sha512: ${arch}-zip`,
    '    size: 100',
    `  - url: Workmate-0.2.0-${arch}.dmg`,
    `    sha512: ${arch}-dmg`,
    '    size: 200',
    `path: Workmate-0.2.0-${arch}.zip`,
    `sha512: ${arch}-zip`,
    `releaseDate: ${new Date(0).toISOString()}`,
    '',
  ].join('\n');
}

describe('merge-update-yml script', () => {
  it('merges arm64 and x64 files into one latest-mac feed', async () => {
    const dirs = await makeFeedDirs();
    await writeFile(path.join(dirs.arm64Dir, 'latest-mac.yml'), feedYaml('arm64'));
    await writeFile(path.join(dirs.x64Dir, 'latest-mac.yml'), feedYaml('x64'));

    await execFileAsync('node', [
      scriptPath,
      '--arm64-dir',
      dirs.arm64Dir,
      '--x64-dir',
      dirs.x64Dir,
      '--output-dir',
      dirs.outputDir,
    ]);

    const output = await readFile(path.join(dirs.outputDir, 'latest-mac.yml'), 'utf8');
    expect(output).toContain('Workmate-0.2.0-arm64.zip');
    expect(output).toContain('Workmate-0.2.0-arm64.dmg');
    expect(output).toContain('Workmate-0.2.0-x64.zip');
    expect(output).toContain('Workmate-0.2.0-x64.dmg');
    expect(output).toContain('path: Workmate-0.2.0-arm64.zip');
  });

  it('rejects invalid feeds', async () => {
    const dirs = await makeFeedDirs();
    await writeFile(path.join(dirs.arm64Dir, 'latest-mac.yml'), 'version: 0.2.0\n');
    await writeFile(path.join(dirs.x64Dir, 'latest-mac.yml'), feedYaml('x64'));

    await expect(
      execFileAsync('node', [
        scriptPath,
        '--arm64-dir',
        dirs.arm64Dir,
        '--x64-dir',
        dirs.x64Dir,
        '--output-dir',
        dirs.outputDir,
      ])
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('arm64 feed is missing files array'),
    });
  });
});
