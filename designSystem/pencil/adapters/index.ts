
import { V29Adapter } from './v29.js';
import { PenFileAdapter } from './types.js';

const adapters: PenFileAdapter[] = [
  new V29Adapter()
];

export function getAdapterForVersion(version: string): PenFileAdapter {
  const adapter = adapters.find(a => a.supportedVersion === version);
  if (!adapter) {
    throw new Error(`Unsupported Pencil version: ${version}`);
  }
  return adapter;
}

export * from './types.js';
