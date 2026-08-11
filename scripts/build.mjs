import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { delimiter, join } from 'node:path';

const version = '0.162.0';
const root = process.cwd();
const binDir = join(root, '.hugo-bin');
const binary = join(binDir, process.platform === 'win32' ? 'hugo.exe' : 'hugo');
const buildEnv = {
  ...process.env,
  PATH: [join(root, '.go', 'go', 'bin'), process.env.PATH].filter(Boolean).join(delimiter),
};

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: root, stdio: 'inherit', ...options });
}

function findSystemHugo() {
  try {
    run(process.platform === 'win32' ? 'where' : 'which', ['hugo'], { stdio: 'ignore' });
    return 'hugo';
  } catch {
    return null;
  }
}

async function ensureHugo() {
  const systemHugo = findSystemHugo();
  if (systemHugo) return systemHugo;
  if (existsSync(binary)) return binary;

  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error('Hugo is not installed. Install Hugo locally or set HUGO_BIN to its executable path.');
  }

  mkdirSync(binDir, { recursive: true });
  const archive = join(binDir, `hugo_extended_${version}_Linux-64bit.tar.gz`);
  const url = `https://github.com/gohugoio/hugo/releases/download/v${version}/hugo_extended_${version}_Linux-64bit.tar.gz`;
  console.log(`Downloading Hugo ${version}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hugo download failed: ${response.status}`);
  writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
  run('tar', ['-xzf', archive, '-C', binDir, 'hugo']);
  return binary;
}

const hugo = process.env.HUGO_BIN || await ensureHugo();
run(hugo, ['--minify'], { env: buildEnv });
run(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['run', 'pagefind']);
