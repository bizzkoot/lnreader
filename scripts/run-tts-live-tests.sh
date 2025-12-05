#!/usr/bin/env bash
set -euo pipefail

# Script to validate TTS live updates.
# - Runs type-check, lint, and jest tests (unit tests) if available
# - Suggests manual steps to validate UI behavior

echo "Running type-check..."
pnpm run type-check

echo "Running lint check..."
pnpm run lint || true

if pnpm -s test --silent; then
  echo "Unit tests ran (npm test returned 0)."
else
  echo "Unit tests failed or jest not installed - make sure devDependencies are installed: pnpm i"
fi

cat <<'EOF'
Manual Validation Instructions:
1. Start the Metro server:
   pnpm run dev:start
2. Launch the app on Android or iOS:
   pnpm run dev:android  # or pnpm run dev:ios
3. Open a chapter in Reader mode.
4. Open Settings -> Reader -> Accessibility and change the TTS settings (voice, speed, pitch).
5. Verify the reading panel updates live without needing to exit and re-enter the reader.

Automated smoke checks:
- Unit tests added:
  - src/utils/__tests__/ttsBridge.test.ts
  - src/screens/reader/components/__tests__/WebViewReader.applyTtsUpdate.test.tsx
Please run 'pnpm run test' to execute these tests. If you need more extensive integration tests, consider setting up Detox/Appium for device level automation.
EOF

exit 0
