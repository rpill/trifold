import { existsSync as fsExistsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WINDOWS_MSYS2_GPP = 'D:\\msys64\\ucrt64\\bin\\g++.exe';

export function resolveCompiler(env, platform, available) {
  const explicit = typeof env?.CXX === 'string' ? env.CXX.trim() : '';
  if (explicit) return { command: explicit, argsPrefix: [] };
  if (platform === 'win32' && fsExistsSync(WINDOWS_MSYS2_GPP)) return { command: WINDOWS_MSYS2_GPP, argsPrefix: [] };
  if (available('g++')) return { command: 'g++', argsPrefix: [] };
  if (available('clang++')) return { command: 'clang++', argsPrefix: [] };
  throw new Error('No C++ compiler found. Set CXX or install g++/clang++.');
}

export function solverOutputPath(platform = process.platform) {
  return path.join(ROOT, 'tools', platform === 'win32' ? 'trifold_solver.exe' : 'trifold_solver');
}

function commandAvailable(candidate) {
  if (path.isAbsolute(candidate) || candidate.includes('/') || candidate.includes('\\')) return fsExistsSync(candidate);
  const result = spawnSync(candidate, ['--version'], { stdio: 'ignore', windowsHide: true });
  return !result.error && result.status === 0;
}

export function buildSolver({ env = process.env, platform = process.platform } = {}) {
  const compiler = resolveCompiler(env, platform, commandAvailable);
  const output = solverOutputPath(platform);
  const source = path.join(ROOT, 'tools', 'trifold_solver.cpp');
  const args = ['-std=c++20', '-O3', '-pthread', source, '-o', output];
  const result = spawnSync(compiler.command, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Solver build failed with exit code ${result.status ?? 'unknown'}`);
  return output;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { buildSolver(); }
  catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
