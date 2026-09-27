import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, basename, join, resolve, posix, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

export function validateDimFactor(value) {
  const factor = Number(value);
  if (!(factor > 0 && factor <= 1)) throw new RangeError('Dim factor must be > 0 and <= 1.');
  return factor;
}

export function derivedDimPath(inputPath, factor) {
  const safe = validateDimFactor(factor);
  const pct = Math.round(safe * 100);
  const pathApi = /^[A-Za-z]:[\\/]/.test(inputPath) || inputPath.includes('\\') ? win32 : posix;
  return pathApi.join(pathApi.dirname(inputPath), `dimmed-${pct}pct`, pathApi.basename(inputPath));
}

function parseArgs(argv) {
  const out = {};
  for (let i=0;i<argv.length;i+=1) if(argv[i].startsWith('--')){const key=argv[i].slice(2);const next=argv[i+1];if(next&&!next.startsWith('--')){out[key]=next;i+=1;}else out[key]=true;}
  return out;
}

function findMagick() {
  for (const candidate of [process.env.MAGICK_BIN, '/opt/imagemagick/bin/magick', 'magick'].filter(Boolean)) {
    if (candidate === 'magick' || existsSync(candidate)) return candidate;
  }
  throw new Error('ImageMagick not found. Set MAGICK_BIN.');
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('Usage: visual-qa:dim -- --input <manifest.json> --factor 0.65');
  const factor = validateDimFactor(args.factor ?? 0.65);
  const manifestPath = resolve(String(args.input));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const entries = [];
  for (const entry of manifest.entries) {
    if (!entry.screenshot || !existsSync(entry.screenshot)) { entries.push({ ...entry }); continue; }
    const output = derivedDimPath(entry.screenshot, factor);
    mkdirSync(dirname(output), { recursive: true });
    const result = spawnSync(findMagick(), [entry.screenshot, '-evaluate', 'multiply', String(factor), output], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || `ImageMagick failed for ${entry.screenshot}`);
    entries.push({ ...entry, screenshot: output });
  }
  const pct = Math.round(factor * 100);
  const outputManifest = resolve(String(args.output ?? join(dirname(manifestPath), `dimmed-${pct}pct`, 'manifest.json')));
  mkdirSync(dirname(outputManifest), { recursive: true });
  writeFileSync(outputManifest, JSON.stringify({ ...manifest, runId: `${manifest.runId}-dim${pct}`, derivedFrom: manifestPath, dimFactor: factor, entries }, null, 2));
  console.log(outputManifest);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try { runCli(); } catch (error) { console.error(error); process.exitCode = 1; }
}
