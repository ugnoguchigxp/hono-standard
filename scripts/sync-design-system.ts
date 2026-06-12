import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { fileURLToPath } from 'node:url';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const DEFAULT_REPO = 'https://github.com/ugnoguchigxp/design-system-standard.git';
const DEFAULT_REF = 'main';
const TARGET_DIR = path.resolve(__dirname, '../designSystem');
const METADATA_FILE = path.join(TARGET_DIR, 'metadata.json');

// Get arguments or fallback to defaults
const repoUrl = process.argv[2] || process.env.DESIGN_SYSTEM_REPO || DEFAULT_REPO;
const ref = process.argv[3] || process.env.DESIGN_SYSTEM_REF || DEFAULT_REF;

function sync() {
  console.log('==================================================');
  console.log('Design System Synchronization');
  console.log('==================================================');
  console.log(`Source Repository : ${repoUrl}`);
  console.log(`Reference (Ref)   : ${ref}`);
  console.log(`Target Directory  : ${TARGET_DIR}`);
  console.log('--------------------------------------------------');

  // Create target directory if it doesn't exist
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  // 1. Create temporary directory for cloning
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-system-sync-'));
  console.log(`Created temporary directory: ${tempDir}`);

  try {
    // 2. Clone the repository
    console.log(`Fetching ${ref} from ${repoUrl}...`);
    // Try depth-1 clone first (fastest, but only works for branches/tags, not arbitrary commits)
    try {
      execSync(`git clone --depth 1 --branch ${ref} ${repoUrl} "${tempDir}"`, { stdio: 'inherit' });
    } catch (error) {
      console.log('Failed to shallow clone. Attempting full clone and checkout...');
      // Fallback to full clone and checkout (needed if ref is a commit hash)
      execSync(`git clone ${repoUrl} "${tempDir}"`, { stdio: 'inherit' });
      execSync(`git -C "${tempDir}" checkout ${ref}`, { stdio: 'inherit' });
    }

    // Retrieve the exact commit hash
    const commitHash = execSync(`git -C "${tempDir}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
    console.log(`Verified commit hash: ${commitHash}`);

    // 3. Clean up existing files in TARGET_DIR, preserving caches & outputs
    console.log('Cleaning up target directory...');
    const preservedItems = [
      'node_modules',
      'dist',
      'storybook-static',
      'coverage',
      '.tsbuildinfo',
      'tsconfig.build.tsbuildinfo',
      'tsconfig.tsbuildinfo'
    ];

    const currentItems = fs.readdirSync(TARGET_DIR);
    for (const item of currentItems) {
      if (preservedItems.includes(item)) {
        console.log(`  [Preserved] ${item}`);
        continue;
      }
      const itemPath = path.join(TARGET_DIR, item);
      fs.rmSync(itemPath, { recursive: true, force: true });
    }

    // 4. Copy files from tempDir to TARGET_DIR (excluding .git)
    console.log('Copying files from clone...');
    const sourceItems = fs.readdirSync(tempDir);
    for (const item of sourceItems) {
      if (item === '.git') continue;
      const srcPath = path.join(tempDir, item);
      const destPath = path.join(TARGET_DIR, item);
      fs.cpSync(srcPath, destPath, { recursive: true });
    }

    // 5. Generate and write metadata
    const metadata = {
      repository: repoUrl,
      reference: ref,
      commit: commitHash,
      syncedAt: new Date().toISOString(),
    };

    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`Generated metadata file at ${METADATA_FILE}`);
    console.log('--------------------------------------------------');
    console.log('Design System synced successfully!');
    console.log('Note: If package.json has changed, please run `pnpm install`.');
    console.log('==================================================');

  } catch (error) {
    console.error('Error occurred during design system sync:', error);
    process.exit(1);
  } finally {
    // 6. Clean up temporary directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log(`Removed temporary directory: ${tempDir}`);
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up temporary directory:', cleanupError);
    }
  }
}

sync();
