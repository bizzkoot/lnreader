# Technology Stack

**Analysis Date:** 2026-01-06

## Languages

**Primary:**
- TypeScript 5.9.3 - All application code (`src/`)
- Kotlin - Android native modules (`android/app/src/main/`)

**Secondary:**
- JavaScript - WebView bridge logic (`android/app/src/main/assets/js/core.js`)

## Runtime

**Environment:**
- Node.js >=20 - `package.json` engines field
- React Native 0.82.1 - Mobile app runtime
- NixOS - Reproducible builds via `flake.nix` (optional)

**Package Manager:**
- pnpm 10.26.0 - `package.json` packageManager
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

**Core:**
- React Native 0.82.1 - Mobile app framework
- React 19.1.1 - UI library
- Expo 54.0.25 - Expo modules and SDK
- React Navigation 7.x - Screen navigation

**Testing:**
- Jest 29.x - Test runner (`jest.config.cjs`)
- @testing-library/react-hooks - Hook testing
- @testing-library/react-native - Component testing

**Build/Dev:**
- Metro bundler - React Native bundler
- Gradle - Android build system
- Babel 7.28.5 - Transpilation
- TypeScript compiler - Type checking
- React Compiler (RC.3) - Performance optimization

## Key Dependencies

**Critical:**
- MMKV 3.3.3 - High-performance key-value storage
- expo-sqlite - SQLite database for local data
- react-native-webview 13.15.0 - WebView for chapter content
- react-native-reanimated 4.2.0 - Smooth animations
- @legendapp/list (Flash List) 2.0.2 - Performant lists

**Infrastructure:**
- react-native-paper 5.14.5 - Material Design UI components
- expo-file-system - File operations
- expo-speech - Text-to-Speech
- expo-notifications - Push notifications
- @react-native-cookies/cookies - Cookie management
- react-native-sha256 - SHA256 hashing

## Configuration

**Environment:**
- react-native-dotenv - Environment variable loading
- No .env.example present (should be added)
- Configuration via `babel.config.js` and `tsconfig.json`

**Build:**
- `babel.config.js` - Babel configuration with React Compiler
- `tsconfig.json` - TypeScript compiler options
- `metro.config.cjs` - Metro bundler configuration
- `.prettierrc.cjs` - Code formatting rules

## Platform Requirements

**Development:**
- Node.js 20+
- pnpm 10.26.0+
- Java 17+ (for Android builds)
- Android SDK API 24+ minimum

**Production:**
- Android API 24+ (Android 7.0+)
- APK distribution via GitHub releases
- No iOS support (Android-only currently)

---

*Stack analysis: 2026-01-06*
*Update after major dependency changes*
