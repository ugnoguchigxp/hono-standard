import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pencilDir = path.resolve(scriptDir, '..');
const penPath = path.join(pencilDir, 'designSystem.pen');
const outPath = path.join(pencilDir, 'generatedVariants.ts');

const pen = JSON.parse(fs.readFileSync(penPath, 'utf8'));

/** @type {Set<string>} */
const names = new Set();

function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child);
    return;
  }

  if (typeof node.name === 'string' && node.name.trim()) {
    names.add(node.name.trim());
  }

  for (const value of Object.values(node)) {
    walk(value);
  }
}

walk(pen);

/** @type {Map<string, Set<string>>} */
const grouped = new Map();

for (const name of names) {
  const slashIndex = name.indexOf('/');
  if (slashIndex <= 0 || slashIndex === name.length - 1) continue;

  const component = name.slice(0, slashIndex).trim();
  const variant = name.slice(slashIndex + 1).trim();
  if (!component || !variant) continue;
  if (component[0] !== component[0].toUpperCase()) continue;

  if (!grouped.has(component)) {
    grouped.set(component, new Set());
  }
  grouped.get(component).add(variant);
}

const index = Object.fromEntries(
  [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([component, variants]) => [component, [...variants].sort((a, b) => a.localeCompare(b))])
);

const totalVariants = Object.values(index).reduce((sum, variants) => sum + variants.length, 0);
const generatedAt = new Date().toISOString();

const file = `/* eslint-disable */\n/**\n * AUTO-GENERATED FILE.\n * Source: ./designSystem.pen\n * Run: pnpm -C designSystem pencil:variants\n */\n\nexport type PenVariantIndex = Record<string, string[]>;\n\nexport const penVariantIndex: PenVariantIndex = ${JSON.stringify(index, null, 2)};\n\nexport const penVariantMeta = {\n  generatedAt: ${JSON.stringify(generatedAt)},\n  sourceVersion: ${JSON.stringify(String(pen.version ?? 'unknown'))},\n  totalComponents: ${Object.keys(index).length},\n  totalVariants: ${totalVariants}\n} as const;\n`;

fs.writeFileSync(outPath, file, 'utf8');
console.log(`Generated: ${path.relative(process.cwd(), outPath)}`);
console.log(`Components: ${Object.keys(index).length}, Variants: ${totalVariants}`);
