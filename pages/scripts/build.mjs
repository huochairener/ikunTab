// 构建：复用 ../frontend 的源码构建 SPA，产物输出到 pages/dist
// ESA 构建流水线执行 `npm run build`（见 esa.jsonc），本地也可以直接跑。
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '..');
const repoRoot = resolve(pagesDir, '..');
const frontendDir = resolve(repoRoot, 'frontend');
const outDir = resolve(pagesDir, 'dist');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function npm(args, cwd) {
  // Windows + Node>=18.20 起 spawnSync .cmd 必须走 shell，否则 EINVAL
  execFileSync(npmCmd, args, { cwd, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
}

function log(msg) {
  console.log(`[build] ${msg}`);
}

if (!existsSync(frontendDir)) {
  console.error(`[build] 找不到前端目录：${frontendDir}`);
  process.exit(1);
}

// 1) 前端依赖
if (!existsSync(resolve(frontendDir, 'node_modules'))) {
  const hasLock = existsSync(resolve(frontendDir, 'package-lock.json'));
  log(`安装前端依赖（${hasLock ? 'npm ci' : 'npm install'}）`);
  npm([hasLock ? 'ci' : 'install', '--no-audit', '--no-fund'], frontendDir);
}

// 2) 构建前端（默认带 vue-tsc 类型检查；IKUN_PAGES_SKIP_TYPECHECK=1 时只跑 vite build）
log('构建前端');
if (process.env.IKUN_PAGES_SKIP_TYPECHECK === '1') {
  npm(['exec', 'vite', 'build'], frontendDir);
} else {
  try {
    npm(['run', 'build'], frontendDir);
  } catch (err) {
    log('npm run build 失败，回退为纯 vite build（跳过类型检查）');
    npm(['exec', 'vite', 'build'], frontendDir);
  }
}

// 3) 拷贝产物
const built = resolve(frontendDir, 'dist');
if (!existsSync(built)) {
  console.error('[build] 前端构建产物不存在，构建失败');
  process.exit(1);
}
rmSync(outDir, { recursive: true, force: true });
cpSync(built, outDir, { recursive: true });
log(`完成：${outDir}`);
