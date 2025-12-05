#!/usr/bin/env bash
set -euo pipefail

echo "Installing @types/jest and @types/node devDependencies..."
pnpm add -D @types/jest @types/node

echo "Removing local temporary jest-globals.d.ts (if present)..."
if [ -f src/types/jest-globals.d.ts ]; then
  rm src/types/jest-globals.d.ts
  echo "Removed local jest globals declaration."
else
  echo "No local jest globals found."
fi

echo "Running type-check and tests..."
pnpm run type-check
pnpm run test

echo "Done."

exit 0
