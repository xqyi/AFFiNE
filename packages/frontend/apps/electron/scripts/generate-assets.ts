import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'fs-extra';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

const repoRootDir = path.join(__dirname, '..', '..', '..', '..', '..');
const electronRootDir = path.join(__dirname, '..');
const publicDistDir = path.join(electronRootDir, 'resources');
const cliRunnerPath = path.join(repoRootDir, 'tools', 'cli', 'bin', 'runner.js');
const webDir = path.join(
  repoRootDir,
  'packages',
  'frontend',
  'apps',
  'electron-renderer'
);
const affineWebOutDir = path.join(webDir, 'dist');
const publicAffineOutDir = path.join(publicDistDir, `web-static`);
const releaseVersionEnv = process.env.RELEASE_VERSION || '';

function runChecked(
  label: string,
  command: string,
  args: string[],
  cwd: string
) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    cwd,
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${label} failed with exit code ${result.status ?? 'unknown'}`
    );
  }
}

async function patchI18nChunk(lang: 'zh-Hans' | 'zh-Hant') {
  const jsDir = path.join(publicAffineOutDir, 'js');
  const files = await fs.readdir(jsDir);
  const chunkFile = files.find(
    file => file.startsWith(`i18n-langs.${lang}.`) && file.endsWith('.js')
  );

  if (!chunkFile) {
    throw new Error(`Could not find ${lang} i18n chunk in ${jsDir}`);
  }

  const sourcePath = path.join(
    repoRootDir,
    'packages',
    'frontend',
    'i18n',
    'src',
    'resources',
    `${lang}.json`
  );

  const resource = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  const serialized = JSON.stringify(resource)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  const filePath = path.join(jsDir, chunkFile);
  const text = await fs.readFile(filePath, 'utf8');
  const start = text.indexOf("JSON.parse('");
  const end = text.lastIndexOf("')");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Could not locate JSON.parse payload in ${filePath}`);
  }

  const prefix = text.slice(0, start + "JSON.parse('".length);
  const suffix = text.slice(end);

  await fs.writeFile(filePath, prefix + serialized + suffix);
}

async function verifyI18nChunk(
  lang: 'zh-Hans' | 'zh-Hant',
  expected: string
) {
  const jsDir = path.join(publicAffineOutDir, 'js');
  const files = await fs.readdir(jsDir);
  const chunkFile = files.find(
    file => file.startsWith(`i18n-langs.${lang}.`) && file.endsWith('.js')
  );

  if (!chunkFile) {
    throw new Error(`Could not find ${lang} i18n chunk in ${jsDir}`);
  }

  const text = await fs.readFile(path.join(jsDir, chunkFile), 'utf8');
  if (!text.includes(expected)) {
    throw new Error(`Patched ${lang} chunk is missing expected text: ${expected}`);
  }
}

console.log('build with following variables', {
  repoRootDir,
  electronRootDir,
  publicDistDir,
  affineSrcDir: webDir,
  affineSrcOutDir: affineWebOutDir,
  publicAffineOutDir,
  releaseVersionEnv,
});

// step 0: check version match
const electronPackageJson = require(`${electronRootDir}/package.json`);
if (releaseVersionEnv && electronPackageJson.version !== releaseVersionEnv) {
  throw new Error(
    `Version mismatch, expected ${releaseVersionEnv} but got ${electronPackageJson.version}`
  );
}
// copy web dist files to electron dist

const cwd = repoRootDir;

// step 1: build web dist
if (!process.env.SKIP_WEB_BUILD) {
  runChecked(
    'renderer build',
    process.execPath,
    [cliRunnerPath, 'affine.ts', '@affine/electron-renderer', 'build'],
    cwd
  );
  runChecked(
    'electron build',
    process.execPath,
    [cliRunnerPath, 'affine.ts', '@affine/electron', 'build'],
    cwd
  );

  await fs.remove(publicAffineOutDir);
  await fs.move(affineWebOutDir, publicAffineOutDir, { overwrite: true });
  await patchI18nChunk('zh-Hans');
  await patchI18nChunk('zh-Hant');
  await verifyI18nChunk('zh-Hans', '近期动态');
  await verifyI18nChunk('zh-Hant', '近期動態');
}

// step 2: update app-updater.yml content with build type in resources folder
if (process.env.BUILD_TYPE === 'internal') {
  const appUpdaterYml = path.join(publicDistDir, 'app-update.yml');
  const appUpdaterYmlContent = await fs.readFile(appUpdaterYml, 'utf-8');
  const newAppUpdaterYmlContent = appUpdaterYmlContent.replace(
    'AFFiNE',
    'AFFiNE-Releases'
  );
  await fs.writeFile(appUpdaterYml, newAppUpdaterYmlContent);
}
