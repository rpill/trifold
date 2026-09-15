import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const VITE_HOST = '127.0.0.1';
const VITE_PORT = 5173;
const VITE_URL = 'http://127.0.0.1:5173';
const PROXY_PORT = 8080;
const PROXY_PACKAGE = '@yandex-games/sdk-dev-proxy@0.0.2';

function pnpmInvocation() {
  const execPath = process.env.npm_execpath;
  if (execPath && /(?:^|[\\/])pnpm(?:\.c?js|\.mjs)?$/i.test(execPath)) {
    return { command: process.execPath, prefix: [execPath] };
  }
  return {
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    prefix: [],
  };
}

async function main() {
  process.env.VITE_YANDEX_DEV = 'true';

  const vite = await createServer({
    server: {
      host: VITE_HOST,
      port: VITE_PORT,
      strictPort: true,
    },
  });
  await vite.listen();

  const upstream = VITE_URL;
  const { command, prefix } = pnpmInvocation();
  const proxy = spawn(command, [
    ...prefix,
    'dlx',
    PROXY_PACKAGE,
    '-h',
    upstream,
    `--port=${PROXY_PORT}`,
    '--dev-mode=true',
  ], {
    stdio: 'inherit',
    env: process.env,
  });

  console.log(`[Trifold] Vite: ${upstream}`);
  console.log(`[Trifold] Yandex SDK dev proxy: https://localhost:${PROXY_PORT}`);
  console.log('[Trifold] Use the proxy URL above for SDK mocks; Ctrl+C stops both servers.');

  let shuttingDown = false;
  const shutdown = async (exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    if (!proxy.killed) proxy.kill();
    await vite.close();
    process.exitCode = exitCode;
  };

  process.once('SIGINT', () => { void shutdown(0); });
  process.once('SIGTERM', () => { void shutdown(0); });
  proxy.once('error', async (error) => {
    console.error('[Trifold] Failed to start Yandex SDK dev proxy.', error);
    await shutdown(1);
  });
  proxy.once('exit', async (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      console.error(`[Trifold] Yandex SDK dev proxy stopped by ${signal}.`);
      await shutdown(1);
      return;
    }
    await shutdown(code ?? 1);
  });
}

main().catch((error) => {
  console.error('[Trifold] Yandex dev launch failed.', error);
  process.exitCode = 1;
});
