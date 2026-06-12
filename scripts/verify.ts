import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type VerifyStep = {
  clean?: string[];
  cwd?: string;
  name: string;
  command: string[];
};

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const designSystemDir = path.join(rootDir, 'designSystem');
const bun = process.execPath;

const rootSteps: VerifyStep[] = [
  { name: 'root typecheck', command: ['bun', 'run', 'typecheck'] },
  { name: 'root lint', command: ['bun', 'run', 'lint'] },
  { name: 'root format', command: ['bun', 'run', 'format:check'] },
  { name: 'root test', command: ['bun', 'run', 'test', 'run'] },
  {
    name: 'root build',
    command: ['bun', 'run', 'build'],
    clean: ['dist', 'dist-api', 'designSystem/dist'],
  },
];

const designSystemSteps: VerifyStep[] = [
  {
    cwd: designSystemDir,
    name: 'designSystem typecheck',
    command: ['bun', 'run', 'type-check'],
  },
  { cwd: designSystemDir, name: 'designSystem lint', command: ['bun', 'run', 'lint'] },
  { cwd: designSystemDir, name: 'designSystem test', command: ['bun', 'run', 'test', 'run'] },
  {
    cwd: designSystemDir,
    name: 'designSystem build',
    command: ['bun', 'run', 'build'],
    clean: ['designSystem/dist'],
  },
];

const scopes = new Set(process.argv.slice(2));
const selectedSteps =
  scopes.has('--scope=designSystem') || scopes.has('--design-system')
    ? designSystemSteps
    : scopes.has('--scope=root') || scopes.has('--root')
      ? rootSteps
      : [...rootSteps, ...designSystemSteps];

for (const step of selectedSteps) {
  for (const target of step.clean ?? []) {
    fs.rmSync(path.join(rootDir, target), { force: true, recursive: true });
  }

  const [command, ...args] = step.command;
  const executable = command === 'bun' ? bun : command;
  const result = spawnSync(executable, args, {
    cwd: step.cwd ?? rootDir,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });

  if (result.status === 0) {
    console.log(`OK ${step.name}`);
    continue;
  }

  const renderedCommand = step.command.join(' ');
  const location = step.cwd ? ` (${path.relative(rootDir, step.cwd)})` : '';
  console.error(`FAIL ${step.name}${location}`);
  console.error(`$ ${renderedCommand}`);

  if (result.error) {
    console.error(result.error);
  }
  if (result.stdout) {
    process.stderr.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exit(result.status ?? 1);
}

console.log('OK verify complete');
