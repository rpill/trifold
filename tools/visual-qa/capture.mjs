import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

export function buildCaptureUrl(baseUrl, scenarioId, viewportId) {
  const url = new URL(baseUrl);
  url.searchParams.set('visualQa', scenarioId);
  if (viewportId) url.searchParams.set('viewport', viewportId);
  return url.toString();
}

export function createManifestEntry(scenarioId, viewportId) {
  return { scenarioId, viewportId, status: 'ok', pageErrors: [], runtimeErrors: [] };
}

export function captureHasErrors(entries) {
  return entries.some((entry) => entry.status !== 'ok' || entry.pageErrors.length > 0 || entry.runtimeErrors.length > 0);
}

export function writeCaptureManifest(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ version: 1, ...data }, null, 2));
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) { out[key] = next; index += 1; }
    else out[key] = true;
  }
  return out;
}

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolvePort(port));
    });
  });
}

function sleep(ms) { return new Promise((resolveSleep) => setTimeout(resolveSleep, ms)); }

async function waitForHttp(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return;
    } catch (error) { lastError = error; }
    await sleep(150);
  }
  throw new Error(`Visual QA dev server did not become ready: ${lastError?.message ?? url}`);
}


export async function cleanupBrowserProcess(child, profileDir) {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
    const exited = await Promise.race([
      new Promise((resolveExit) => child.once('exit', () => resolveExit(true))),
      sleep(1500).then(() => false),
    ]);
    if (!exited && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await Promise.race([
        new Promise((resolveExit) => child.once('exit', () => resolveExit(true))),
        sleep(1000).then(() => false),
      ]);
    }
  }
  if (!profileDir) return;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      rmSync(profileDir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await sleep(60 * (attempt + 1));
    }
  }
}

function findChromium() {
  const candidates = [process.env.CHROME_BIN, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  throw new Error('No Chromium executable found. Set CHROME_BIN to a Chromium/Chrome binary.');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.wsUrl);
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result ?? {});
        return;
      }
      const callbacks = this.listeners.get(message.method);
      callbacks?.forEach((callback) => callback(message.params ?? {}));
    });
  }

  on(method, callback) {
    const callbacks = this.listeners.get(method) ?? [];
    callbacks.push(callback);
    this.listeners.set(method, callbacks);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveSend, reject) => {
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() { this.socket?.close(); }
}

async function openPage(debugPort, url) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  if (!response.ok) throw new Error(`Could not create Chromium target: ${response.status}`);
  const target = await response.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  return client;
}

function exceptionText(params) {
  const details = params.exceptionDetails ?? params;
  return details.exception?.description ?? details.text ?? 'Runtime exception';
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(exceptionText(result));
  return result.result?.value;
}

async function waitForQaReady(client, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await evaluate(client, `(() => {
      const qa = globalThis.__TRIFOLD_VISUAL_QA__;
      return qa ? {ready: qa.ready === true, scene: qa.scene ?? null, marker: qa.marker ?? null} : null;
    })()`);
    if (state?.ready) return state;
    await sleep(75);
  }
  throw new Error('Timed out waiting for Visual QA ready marker.');
}

async function screenshotBytes(client) {
  const result = await client.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  return Buffer.from(result.data, 'base64');
}

async function waitForStableCanvas(client, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  let previousHash = null;
  let stableCount = 0;
  let latest = null;
  while (Date.now() < deadline) {
    latest = await screenshotBytes(client);
    const hash = createHash('sha256').update(latest).digest('hex');
    if (hash === previousHash) stableCount += 1;
    else stableCount = 0;
    if (stableCount >= 2) return latest;
    previousHash = hash;
    await sleep(120);
  }
  return latest ?? await screenshotBytes(client);
}

async function performInteraction(client, interaction) {
  if (interaction.type === 'wait-ready') {
    const marker = JSON.stringify(interaction.marker);
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const ready = await evaluate(client, `Boolean(globalThis.__TRIFOLD_VISUAL_QA__?.markers?.[${marker}])`);
      if (ready) return;
      await sleep(75);
    }
    throw new Error(`Timed out waiting for Visual QA marker: ${interaction.marker}`);
  }
  if (interaction.type === 'swipe') {
    const viewport = await evaluate(client, `({width: innerWidth, height: innerHeight})`);
    const cx = viewport.width / 2; const cy = viewport.height / 2;
    const dx = interaction.direction === 'left' ? -viewport.width * 0.28 : interaction.direction === 'right' ? viewport.width * 0.28 : 0;
    const dy = interaction.direction === 'up' ? -viewport.height * 0.28 : interaction.direction === 'down' ? viewport.height * 0.28 : 0;
    await dragPointer(client, { x: cx, y: cy }, { x: cx + dx, y: cy + dy }, true);
    return;
  }
  const resolveTarget = async (id) => {
    const point = await evaluate(client, `globalThis.__TRIFOLD_VISUAL_QA__?.resolveTarget?.(${JSON.stringify(id)}) ?? null`);
    if (!point) throw new Error(`Visual QA target is not registered: ${id}`);
    return point;
  };
  if (interaction.type === 'click') {
    const point = await resolveTarget(interaction.target);
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    return;
  }
  if (interaction.type === 'drag') {
    await dragPointer(client, await resolveTarget(interaction.from), await resolveTarget(interaction.to), false);
  }
}

async function dragPointer(client, from, to, touch) {
  const steps = 8;
  if (touch) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return;
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x, y: from.y, button: 'left' });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: from.x, y: from.y, button: 'left', clickCount: 1 });
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, button: 'left', buttons: 1 });
  }
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: to.x, y: to.y, button: 'left', clickCount: 1 });
}

async function captureOne({ debugPort, baseUrl, scenario, viewport, outputDir }) {
  const entry = createManifestEntry(scenario.id, viewport.id);
  const pageErrors = entry.pageErrors;
  const runtimeErrors = entry.runtimeErrors;
  const url = buildCaptureUrl(baseUrl, scenario.id, viewport.id);
  let client = null;
  try {
    client = await openPage(debugPort, 'about:blank');
    client.on('Runtime.exceptionThrown', (params) => runtimeErrors.push(exceptionText(params)));
    client.on('Runtime.consoleAPICalled', (params) => {
      if (params.type !== 'error') return;
      const text = params.args?.map((arg) => arg.value ?? arg.description ?? '').join(' ') || 'console.error';
      runtimeErrors.push(text);
    });
    client.on('Log.entryAdded', ({ entry: logEntry }) => {
      if (logEntry?.level === 'error') pageErrors.push(logEntry.text ?? 'page error');
    });
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Log.enable');
    await client.send('Emulation.setDeviceMetricsOverride', { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.touchPrimary });
    await client.send('Emulation.setTouchEmulationEnabled', { enabled: viewport.touchPrimary, maxTouchPoints: viewport.touchPrimary ? 5 : 1 });
    await client.send('Page.navigate', { url });
    await waitForQaReady(client);
    for (const interaction of scenario.interactions ?? []) await performInteraction(client, interaction);
    const bytes = await waitForStableCanvas(client);
    const viewportDir = join(outputDir, viewport.id);
    mkdirSync(viewportDir, { recursive: true });
    const screenshot = join(viewportDir, `${scenario.id}.png`);
    writeFileSync(screenshot, bytes);
    entry.screenshot = screenshot;
    if (pageErrors.length || runtimeErrors.length) entry.status = 'failed';
  } catch (error) {
    entry.status = 'failed';
    runtimeErrors.push(error instanceof Error ? error.message : String(error));
  } finally {
    client?.close();
  }
  return entry;
}

async function importVisualQaDefinitions() {
  const [{ VISUAL_QA_SCENARIOS }, { VISUAL_QA_VIEWPORT_PRESETS }] = await Promise.all([
    import('../../src/dev/visual-qa/VisualQaCatalog.ts'),
    import('../../src/dev/visual-qa/viewportPresets.ts'),
  ]);
  return { scenarios: VISUAL_QA_SCENARIOS, viewports: VISUAL_QA_VIEWPORT_PRESETS };
}

async function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const { scenarios, viewports } = await importVisualQaDefinitions();
  const selectedScenarios = args.scenario ? scenarios.filter((scenario) => scenario.id === args.scenario) : scenarios;
  if (selectedScenarios.length === 0) throw new Error(`Unknown Visual QA scenario: ${args.scenario}`);
  const requestedViewport = args.viewport ? String(args.viewport) : null;
  if (requestedViewport && !viewports[requestedViewport]) throw new Error(`Unknown Visual QA viewport: ${requestedViewport}`);

  const runId = String(args['run-id'] ?? new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-'));
  const outputDir = resolve(String(args.output ?? join('visual-qa', 'current', runId)));
  mkdirSync(outputDir, { recursive: true });

  let devServer = null;
  let baseUrl = args['base-url'] ? String(args['base-url']) : null;
  if (!baseUrl) {
    const vitePort = await freePort();
    baseUrl = `http://127.0.0.1:${vitePort}/`;
    devServer = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['dev', '--', '--port', String(vitePort), '--strictPort'], {
      cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: process.env,
    });
    await waitForHttp(baseUrl);
  }

  const debugPort = await freePort();
  const userDataDir = mkdtempSync(join(tmpdir(), 'trifold-vqa-chrome-'));
  const chromium = spawn(findChromium(), [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--disable-dev-shm-usage',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  try {
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`);
    const entries = [];
    for (const scenario of selectedScenarios) {
      const viewportIds = requestedViewport
        ? [requestedViewport]
        : scenario.viewports === 'all' ? Object.keys(viewports) : scenario.viewports;
      for (const viewportId of viewportIds) {
        entries.push(await captureOne({ debugPort, baseUrl, scenario, viewport: { id: viewportId, ...viewports[viewportId] }, outputDir }));
      }
    }
    const manifestPath = join(outputDir, 'manifest.json');
    writeCaptureManifest(manifestPath, { runId, baseUrl, entries });
    console.log(manifestPath);
    if (captureHasErrors(entries)) process.exitCode = 1;
  } finally {
    await cleanupBrowserProcess(chromium, userDataDir);
    if (devServer && devServer.exitCode === null && devServer.signalCode === null) devServer.kill('SIGTERM');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  runCli().catch((error) => { console.error(error); process.exitCode = 1; });
}
