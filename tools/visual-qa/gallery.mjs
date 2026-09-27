import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderGalleryHtml(manifest) {
  const cards = manifest.entries.map((entry) => {
    const failed = entry.status !== 'ok' || entry.pageErrors?.length || entry.runtimeErrors?.length;
    const problems = [...(entry.pageErrors ?? []), ...(entry.runtimeErrors ?? [])];
    const image = entry.screenshot ? `<img src="${escapeHtml(entry.screenshot)}" alt="${escapeHtml(entry.scenarioId)}">` : '<div class="missing">No screenshot</div>';
    const errors = problems.length ? `<pre>${escapeHtml(problems.join('\n'))}</pre>` : '';
    return `<article class="card${failed ? ' failed' : ''}"><h2>${escapeHtml(entry.scenarioId)}</h2><p>${escapeHtml(entry.viewportId)} · ${escapeHtml(entry.status)}</p>${image}${errors}</article>`;
  }).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Trifold Visual QA ${escapeHtml(manifest.runId)}</title><style>body{font-family:system-ui;background:#111;color:#eee;margin:20px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}.card{background:#1d1d1d;padding:12px;border:1px solid #444}.card.failed{border:2px solid #d44}.card img{display:block;width:100%;height:auto;background:#000}.missing{padding:40px;background:#333}pre{white-space:pre-wrap;color:#ff9b9b}</style></head><body><h1>Trifold Visual QA</h1><p>Run: ${escapeHtml(manifest.runId)}</p><main class="grid">${cards}</main></body></html>`;
}

function parseArgs(argv) {
  const out = {};
  for (let i=0;i<argv.length;i+=1) if (argv[i].startsWith('--')) { const key=argv[i].slice(2); const next=argv[i+1]; if(next&&!next.startsWith('--')){out[key]=next;i+=1;} else out[key]=true; }
  return out;
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('Usage: visual-qa:gallery -- --input <manifest.json>');
  const manifestPath = resolve(String(args.input));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const root = dirname(manifestPath);
  const portable = { ...manifest, entries: manifest.entries.map((entry) => ({ ...entry, screenshot: entry.screenshot ? relative(root, entry.screenshot).replaceAll('\\','/') : undefined })) };
  const output = resolve(String(args.output ?? `${root}/gallery.html`));
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, renderGalleryHtml(portable));
  console.log(output);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { runCli(); } catch (error) { console.error(error); process.exitCode = 1; }
}
