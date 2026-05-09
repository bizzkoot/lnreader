// scripts/clean-android.js
const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '..', 'android');
const appDir = path.join(androidDir, 'app');

console.log('🧹 Cleaning Android build artifacts...');

// Remove CMake cache (the problematic .cxx folder)
const cxxPath = path.join(appDir, '.cxx');
if (fs.existsSync(cxxPath)) {
  fs.rmSync(cxxPath, { recursive: true, force: true });
  console.log('✓ Removed .cxx cache');
}

// Remove build outputs
const buildPath = path.join(appDir, 'build');
if (fs.existsSync(buildPath)) {
  fs.rmSync(buildPath, { recursive: true, force: true });
  console.log('✓ Removed app/build');
}

// Clean gradle cache
const gradleCache = path.join(androidDir, '.gradle');
if (fs.existsSync(gradleCache)) {
  fs.rmSync(gradleCache, { recursive: true, force: true });
  console.log('✓ Removed .gradle cache');
}

// Clean root build directory
const rootBuildPath = path.join(androidDir, 'build');
if (fs.existsSync(rootBuildPath)) {
  fs.rmSync(rootBuildPath, { recursive: true, force: true });
  console.log('✓ Removed android/build');
}

console.log('✅ Clean complete');
