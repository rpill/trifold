import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildCaptureUrl,
  captureHasErrors,
  createManifestEntry,
  writeCaptureManifest,
  cleanupBrowserProcess,
} from '../tools/visual-qa/capture.mjs';
import { renderGalleryHtml } from '../tools/visual-qa/gallery.mjs';
import { derivedDimPath, validateDimFactor } from '../tools/visual-qa/dim-pass.mjs';

const pkg = JSON.parse(readFileSync('package.json','utf8'));

test('package exposes visual QA capture, gallery and dim scripts', () => {
  assert.match(pkg.scripts['visual-qa:capture'] ?? '', /tools\/visual-qa\/capture\.mjs/);
  assert.match(pkg.scripts['visual-qa:gallery'] ?? '', /tools\/visual-qa\/gallery\.mjs/);
  assert.match(pkg.scripts['visual-qa:dim'] ?? '', /tools\/visual-qa\/dim-pass\.mjs/);
});

test('capture URL carries explicit dev scenario and viewport query', () => {
  const url = new URL(buildCaptureUrl('http://127.0.0.1:5173/', 'home-fresh', '844x390-touch'));
  assert.equal(url.searchParams.get('visualQa'),'home-fresh');
  assert.equal(url.searchParams.get('viewport'),'844x390-touch');
});

test('manifest entries keep page/runtime errors and errors fail the run', () => {
  const ok = createManifestEntry('home-fresh','1920x1080');
  assert.deepEqual(ok, {scenarioId:'home-fresh',viewportId:'1920x1080',status:'ok',pageErrors:[],runtimeErrors:[]});
  const failed = {...ok,status:'failed',pageErrors:['asset 404'],runtimeErrors:['boom']};
  assert.equal(captureHasErrors([ok]),false);
  assert.equal(captureHasErrors([failed]),true);
});

test('manifest writer persists stable versioned schema', () => {
  const dir=mkdtempSync(join(tmpdir(),'trifold-vqa-'));
  const path=join(dir,'manifest.json');
  writeCaptureManifest(path,{runId:'test',baseUrl:'http://x/',entries:[createManifestEntry('home-fresh','1920x1080')]});
  const manifest=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(manifest.version,1);
  assert.equal(manifest.runId,'test');
  assert.equal(manifest.entries[0].scenarioId,'home-fresh');
});

test('gallery visibly renders partial failed runs', () => {
  const html=renderGalleryHtml({version:1,runId:'x',baseUrl:'http://x/',entries:[
    {...createManifestEntry('home-fresh','1920x1080'),screenshot:'home.png'},
    {...createManifestEntry('game-win','844x390-touch'),status:'failed',pageErrors:['page exploded']},
  ]});
  assert.match(html,/class="card failed"/);
  assert.match(html,/page exploded/);
  assert.match(html,/home\.png/);
});

test('dim pass validates factor and always derives a different output path', () => {
  assert.equal(validateDimFactor(0.65),0.65);
  assert.throws(()=>validateDimFactor(0),/factor/i);
  assert.throws(()=>validateDimFactor(1.1),/factor/i);
  assert.equal(derivedDimPath('/qa/home.png',0.65),'/qa/dimmed-65pct/home.png');
  assert.notEqual(derivedDimPath('/qa/home.png',0.65),'/qa/home.png');
});

test('application bootstrap has an explicit DEV visual-QA path and Boot honors its scene override', () => {
  const main=readFileSync('src/main.ts','utf8');
  const boot=readFileSync('src/ui/scenes/BootScene.ts','utf8');
  assert.match(main,/parseVisualQaRequest/);
  assert.match(main,/createVisualQaRuntime/);
  assert.match(main,/import\.meta\.env\.DEV/);
  assert.match(boot,/getVisualQaLaunch/);
});


test('browser cleanup waits for child exit before removing its profile directory', async () => {
  const { spawn } = await import('node:child_process');
  const { mkdirSync } = await import('node:fs');
  const dir=mkdtempSync(join(tmpdir(),'trifold-vqa-profile-'));
  mkdirSync(join(dir,'Default'));
  writeFileSync(join(dir,'Default','lock'),'x');
  const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  await cleanupBrowserProcess(child,dir);
  assert.equal(existsSync(dir),false);
});
