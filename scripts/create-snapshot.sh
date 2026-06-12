#!/usr/bin/env bash
set -euo pipefail

# Ensure script is run from the project root
cd "$(dirname "$0")/.."

# Check arguments
if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <variant> <version>"
  echo "Example: $0 sqlite 1.0.0"
  echo "Variants: baseline, postgres, sqlite, turso, cloudflare, pgvector, rag, overlay-ssr, overlay-ssg"
  exit 1
fi

VARIANT="$1"
VERSION="$2"
TAG_NAME="${VARIANT}-v${VERSION}"
ARCHIVE_NAME="hono-standard-${VARIANT}-v${VERSION}.tar.gz"

# Determine branch name
if [ "$VARIANT" = "baseline" ]; then
  BRANCH="main"
elif [ "$VARIANT" = "postgres" ]; then
  BRANCH="variant/postgres"
elif [ "$VARIANT" = "sqlite" ]; then
  BRANCH="variant/sqlite"
elif [ "$VARIANT" = "turso" ]; then
  BRANCH="variant/turso"
elif [ "$VARIANT" = "cloudflare" ]; then
  BRANCH="variant/cloudflare"
elif [ "$VARIANT" = "pgvector" ]; then
  BRANCH="variant/pgvector"
elif [ "$VARIANT" = "rag" ]; then
  BRANCH="variant/rag"
elif [ "$VARIANT" = "overlay-ssr" ]; then
  BRANCH="overlay/ssr"
elif [ "$VARIANT" = "overlay-ssg" ]; then
  BRANCH="overlay/ssg"
else
  echo "Error: Unknown variant '$VARIANT'. Supported: baseline, postgres, sqlite, turso, cloudflare, pgvector, rag, overlay-ssr, overlay-ssg"
  exit 1
fi

echo "=== Packaging Variant: $VARIANT from Branch: $BRANCH with Version: $VERSION ==="

# Check git status
if [ -n "$(git status --short)" ]; then
  echo "Warning: You have uncommitted changes. Please commit or stash them first."
  git status --short
  exit 1
fi

# Switch branch
echo "Switching to branch $BRANCH..."
git checkout "$BRANCH"

# Install and verify
echo "Running verification..."
bun install --frozen-lockfile
bun run verify

# Create release directory
mkdir -p dist/snapshots

# Create git tag
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag $TAG_NAME already exists. Skipping tag creation."
else
  echo "Creating Git tag $TAG_NAME..."
  git tag -a "$TAG_NAME" -m "${VARIANT} template v${VERSION}"
  echo "Tag created. Remember to run 'git push origin $TAG_NAME' later."
fi

# Create archive
echo "Creating archive dist/snapshots/$ARCHIVE_NAME..."
git archive --format=tar.gz --prefix="hono-standard-${VARIANT}-v${VERSION}/" \
  -o "dist/snapshots/$ARCHIVE_NAME" "$TAG_NAME"

# Verify archive contents
echo "Verifying archive contents..."
# Check for forbidden files
FORBIDDEN=$(tar -tzf "dist/snapshots/$ARCHIVE_NAME" | grep -E 'node_modules/|\.env$|sqlite\.db|test-results/|playwright-report/|dist/' || true)

if [ -n "$FORBIDDEN" ]; then
  echo "ERROR: Archive contains forbidden files/folders:"
  echo "$FORBIDDEN"
  exit 1
else
  echo "SUCCESS: Archive verification passed. No forbidden files found."
fi

echo "Snapshot successfully created at: dist/snapshots/$ARCHIVE_NAME"
