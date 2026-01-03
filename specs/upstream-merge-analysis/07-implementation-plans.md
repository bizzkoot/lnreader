# Implementation Plans: Step-by-Step Merge Instructions

**Document Purpose:** Detailed step-by-step instructions for safely merging origin/dev features to origin/original  
**Estimated Total Time:** 2-3 weeks  
**Prerequisite:** Read documents 00-06 first

---

## Overview

This document provides **granular implementation plans** for each feature category, organized by priority and dependency chains.

---

## Pre-Merge Preparation

### Step 0: Backup and Branch Strategy

```bash
# 1. Ensure origin/original is up to date
git fetch origin
git checkout original
git pull origin original

# 2. Create clean working branch
git checkout -b merge-prep

# 3. Verify clean state
git status  # Should be clean

# 4. Create backup tag
git tag -a backup-before-merge -m "Backup before upstream merge prep"
git push origin backup-before-merge
```

### Step 1: Exclusion Cleanup (See 06-personal-customizations.md)

```bash
# Remove AI instruction files
rm -rf .agents/ memory-bank/ .serena/
rm -f AGENTS.md CLAUDE.md GEMINI.md
rm -f .github/*.chatmode.md

# Remove personal docs (keep upstream-merge-analysis)
mv specs/upstream-merge-analysis /tmp/
rm -rf specs/
mkdir specs
mv /tmp/upstream-merge-analysis specs/

# Remove personal scripts
rm -f scripts/extract-voice-data-final.js scripts/fix_atomic.js
rm -f scripts/test_tts_fix.cjs scripts/tts_wake_cycle_test.js

# Remove coverage
rm -rf coverage/

# Commit exclusions
git add -A
git commit -m "chore: remove personal customizations before merge prep"
```

---

## Phase 1: Foundation (Priority 1)

**Estimated Time:** 3-5 days  
**Risk Level:** LOW  
**Dependencies:** None (can start immediately)

---

### Feature 1.1: Gradle 9.2.0 + Build Modernization

**Files to Cherry-Pick:**

```bash
git log --oneline origin/dev --grep="Gradle\|build:" | head -10
# Identify relevant commits:
# - b5f4055fb build: upgrade Gradle to 9.2.0
# - 275ede1b5 fix(build): resolve Gradle 9.2.0 compatibility
```

**Cherry-Pick Strategy:**

```bash
# Cherry-pick Gradle upgrade commits
git cherry-pick b5f4055fb  # Gradle 9.2.0 upgrade
git cherry-pick 275ede1b5  # Fix compatibility issues

# Resolve conflicts if any
# Test build
cd android && ./gradlew clean assembleDebug
```

**Files Modified:**

- `android/build.gradle`
- `android/gradle/wrapper/gradle-wrapper.properties`
- `android/settings.gradle`
- `android/gradle.properties`
- `android/app/build.gradle`

**Testing:**

```bash
# Build Android
cd android
./gradlew clean
./gradlew assembleDebug

# Verify no errors
# Check build time (should be similar or faster)
```

**Success Criteria:**

- [ ] Build completes without errors
- [ ] No Gradle deprecation warnings
- [ ] Build time within 10% of previous

---

### Feature 1.2: React Native 0.82.1 Upgrade

**Files to Check:**

```bash
git diff origin/original..origin/dev package.json package-lock.yaml
```

**Implementation:**

```bash
# Option A: Cherry-pick if clean commit exists
git log --oneline origin/dev --grep="React Native 0.82"

# Option B: Manual merge if intertwined with other changes
# Review package.json diff and apply selectively
git show origin/dev:package.json > /tmp/package-dev.json
# Compare and merge RN 0.82 changes only
```

**Files Modified:**

- `package.json`
- `pnpm-lock.yaml`
- `babel.config.js`
- `metro.config.js`
- `tsconfig.json`

**Testing:**

```bash
# Install dependencies
pnpm install

# Build Android
cd android && ./gradlew assembleDebug

# Build iOS (if applicable)
cd ios && pod install && xcodebuild ...

# Run app
npx react-native run-android

# Verify no runtime errors
```

**Success Criteria:**

- [ ] App builds successfully
- [ ] App runs without crashes
- [ ] No peer dependency warnings
- [ ] Metro bundler works correctly

---

### Feature 1.3: Test Infrastructure

**Files to Merge:**

```
jest.config.cjs             # NEW
jest.setup.js               # NEW
__mocks__/                  # NEW directory (15+ files)
scripts/install-jest-types.sh  # NEW
```

**Implementation:**

```bash
# Cherry-pick test infrastructure commits
git log --oneline origin/dev --grep="test\|jest" | head -20

# Identify clean test setup commits
# Example: caf796eac test: Add comprehensive AutoStopService test coverage

# Manual merge approach:
# Copy test config files
git show origin/dev:jest.config.cjs > jest.config.cjs
git show origin/dev:jest.setup.js > jest.setup.js

# Copy mocks directory
git checkout origin/dev -- __mocks__/

# Copy test setup scripts
git checkout origin/dev -- scripts/install-jest-types.sh

# Install test dependencies
pnpm add -D jest @testing-library/react-native @testing-library/jest-native

git add jest.config.cjs jest.setup.js __mocks__/ scripts/install-jest-types.sh
git commit -m "feat: add comprehensive test infrastructure"
```

**Testing:**

```bash
# Run test suite
pnpm test

# Should see tests passing (may be 0 tests if no test files merged yet)
# Important: Verify jest config works, even if test count is low
```

**Success Criteria:**

- [ ] Jest runs without errors
- [ ] Mocks load correctly
- [ ] Test command works (`pnpm test`)

---

### Feature 1.4: Cookie Persistence System

**Files to Merge:**

```
src/services/network/CookieManager.ts       # NEW
src/plugins/helpers/fetch.ts                # MODIFIED (cookie injection)
src/screens/WebviewScreen/WebviewScreen.tsx # MODIFIED (cookie sync)
src/screens/settings/SettingsAdvancedScreen.tsx # MODIFIED (clear UI)
```

**Implementation Steps:**

1. **Merge CookieManager Service:**

```bash
# Check if file exists in dev
git show origin/dev:src/services/network/CookieManager.ts > /tmp/CookieManager.ts

# Review file
cat /tmp/CookieManager.ts

# Copy to repo
mkdir -p src/services/network
cp /tmp/CookieManager.ts src/services/network/CookieManager.ts

git add src/services/network/CookieManager.ts
git commit -m "feat(network): add CookieManager service for session management"
```

2. **Merge fetchApi Enhancements:**

```bash
# Get diff for fetch.ts
git diff origin/original..origin/dev src/plugins/helpers/fetch.ts > /tmp/fetch.diff

# Review diff carefully
cat /tmp/fetch.diff

# Apply changes manually or use patch
# Key additions:
# - Import CookieManager
# - Inject cookies before fetch
# - Save cookies from Set-Cookie headers

# After editing:
git add src/plugins/helpers/fetch.ts
git commit -m "feat(network): add automatic cookie injection and persistence to fetchApi"
```

3. **Merge WebView Cookie Sync:**

```bash
# Get diff for WebviewScreen
git diff origin/original..origin/dev src/screens/WebviewScreen/WebviewScreen.tsx > /tmp/webview.diff

# Review diff
# Look for:
# - JavaScript injection for document.cookie
# - onMessage handler for cookie sync
# - CookieManager.setCookies() calls

# Apply changes
git add src/screens/WebviewScreen/WebviewScreen.tsx
git commit -m "feat(network): add WebView cookie sync with CookieManager"
```

4. **Merge Settings UI:**

```bash
# Get diff for SettingsAdvancedScreen
git diff origin/original..origin/dev src/screens/settings/SettingsAdvancedScreen.tsx > /tmp/settings.diff

# Look for "Clear Cookies" button addition
# Apply changes

git add src/screens/settings/SettingsAdvancedScreen.tsx
git commit -m "feat(settings): add Clear Cookies option in Advanced settings"
```

5. **Add String Translations:**

```bash
# Check for new strings
git diff origin/original..origin/dev strings/languages/en/strings.json | grep -A2 -B2 "cookie"

# Add to strings.json:
# - clearCookies
# - clearCookiesDesc
# - cookiesCleared
# - etc.

git add strings/
git commit -m "feat(strings): add cookie management translations"
```

**Testing:**

```bash
# Unit tests
pnpm test -- CookieManager

# Integration test manually:
# 1. Build and run app
# 2. Visit a source that sets cookies
# 3. Close and reopen app
# 4. Verify cookies persist (check via fetchApi)
# 5. Test Clear Cookies button
# 6. Test WebView sync (login in WebView, use in HTTP)
```

**Success Criteria:**

- [ ] CookieManager tests pass
- [ ] Cookies persist across app restarts
- [ ] WebView sync works (document.cookie → CookieManager)
- [ ] Clear Cookies UI works
- [ ] fetchApi automatically injects cookies

---

### Feature 1.5: Backup System v2

**Files to Merge:**

```
src/services/backup/compatibility.ts        # NEW
src/services/backup/backupSchema.ts         # MODIFIED
src/hooks/persisted/useAutoBackup.ts        # NEW
database/migrations/003_add_tts_state.ts    # SKIP (TTS-specific)
```

**Implementation Steps:**

1. **Merge Compatibility Layer:**

```bash
git show origin/dev:src/services/backup/compatibility.ts > src/services/backup/compatibility.ts
git add src/services/backup/compatibility.ts
git commit -m "feat(backup): add legacy backup compatibility layer"
```

2. **Merge Versioned Schema:**

```bash
# Get diff
git diff origin/original..origin/dev src/services/backup/backupSchema.ts > /tmp/schema.diff

# Look for:
# - BackupManifest interface
# - BackupSections interface
# - Migration pipeline

# Apply changes
git add src/services/backup/backupSchema.ts
git commit -m "feat(backup): implement versioned backup schema (v2)"
```

3. **Merge Auto-Backup:**

```bash
git show origin/dev:src/hooks/persisted/useAutoBackup.ts > src/hooks/persisted/useAutoBackup.ts
git add src/hooks/persisted/useAutoBackup.ts
git commit -m "feat(backup): add automatic backup system with configurable frequency"
```

4. **Merge Backup Pruning:**

```bash
# Find commits related to pruning
git log --oneline origin/dev --grep="pruning\|prune\|backup" | head -10

# Example: 97c0013ac fix(backup): separate auto/manual backups, fix pruning logic
git cherry-pick 97c0013ac
```

5. **Add Settings UI:**

```bash
# Get backup settings diff
git diff origin/original..origin/dev src/screens/settings/SettingsBackupScreen.tsx > /tmp/backup-settings.diff

# Look for:
# - Auto-backup frequency picker
# - Max auto-backups setting
# - Legacy backup option

# Apply changes
git add src/screens/settings/SettingsBackupScreen.tsx
git commit -m "feat(backup): add auto-backup settings UI"
```

**Testing:**

```bash
# Run backup tests
pnpm test -- backup

# Manual tests:
# 1. Create manual backup
# 2. Verify manifest.json exists
# 3. Configure auto-backup (e.g., 6h)
# 4. Wait or mock time
# 5. Verify auto-backup created
# 6. Test pruning (create 15 backups, verify oldest deleted)
# 7. Test legacy backup (restore on upstream version)
```

**Success Criteria:**

- [ ] Backup tests pass
- [ ] Auto-backup triggers correctly
- [ ] Pruning works (separate pools for auto/manual)
- [ ] Legacy backup mode works
- [ ] Migration from v1 → v2 works

---

## Phase 2: Core Features (Priority 2)

**Estimated Time:** 4-6 days  
**Risk Level:** LOW-MEDIUM  
**Dependencies:** Phase 1 complete

---

### Feature 2.1: UI Scaling System

**Files to Merge:**

```
src/theme/scaling.ts                    # NEW
src/components/AppText.tsx              # NEW
src/theme/fonts.ts                      # MODIFIED
src/hooks/persisted/useAppSettings.ts   # MODIFIED (uiScale)
... (200+ files modified to use AppText)
```

**Implementation Steps:**

1. **Merge Scaling Utilities:**

```bash
mkdir -p src/theme
git show origin/dev:src/theme/scaling.ts > src/theme/scaling.ts
git add src/theme/scaling.ts
git commit -m "feat(theme): add UI scaling utilities"
```

2. **Merge AppText Component:**

```bash
git show origin/dev:src/components/AppText.tsx > src/components/AppText/AppText.tsx
git add src/components/AppText/
git commit -m "feat(components): add AppText component with automatic scaling"
```

3. **Update Fonts:**

```bash
# Get fonts diff
git diff origin/original..origin/dev src/theme/fonts.ts > /tmp/fonts.diff

# Look for:
# - Compact MD3 sizes
# - scaleDimension() usage
# - allowFontScaling={false}

# Apply changes
git add src/theme/fonts.ts
git commit -m "feat(theme): update font system for UI scaling"
```

4. **Add UI Scale Setting:**

```bash
# Update useAppSettings hook
git diff origin/original..origin/dev src/hooks/persisted/useAppSettings.ts > /tmp/settings.diff

# Add uiScale to AppSettings interface
# Add uiScale MMKV key

git add src/hooks/persisted/useAppSettings.ts
git commit -m "feat(settings): add uiScale setting"
```

5. **Replace Text with AppText (Gradual):**

**⚠️ IMPORTANT:** This is a massive change (200+ files). Do it gradually:

```bash
# Strategy A: Automated replacement (risky)
find src/screens -name "*.tsx" -exec sed -i '' 's/import { Text } from/import { AppText as Text } from/g' {} \;

# Strategy B: Manual per-screen (safer)
# 1. Start with one screen
# 2. Replace <Text> with <AppText>
# 3. Test screen
# 4. Repeat

# Strategy C: Incremental commits (recommended)
# Week 1: Core screens (Reader, Library, Browse)
# Week 2: Settings screens
# Week 3: Remaining screens
```

6. **Add Settings UI:**

```bash
# Add UI Scale slider to Appearance settings
git diff origin/original..origin/dev src/screens/settings/SettingsAppearanceScreen.tsx > /tmp/appearance.diff

# Look for:
# - UI Scale slider (80-130%)
# - +/- buttons
# - Real-time preview

git add src/screens/settings/SettingsAppearanceScreen.tsx
git commit -m "feat(settings): add UI scale slider in Appearance settings"
```

**Testing:**

```bash
# Test scaling at different values
# 1. Set UI scale to 0.8x
# 2. Verify all text/elements scale correctly
# 3. Test at 1.0x (default)
# 4. Test at 1.3x (maximum)
# 5. Verify no layout breaks
# 6. Test on small screen (SE) and large screen (Max)
```

**Success Criteria:**

- [ ] Scaling utilities work correctly
- [ ] AppText replaces Text in all screens
- [ ] UI scales smoothly from 0.8x to 1.3x
- [ ] No layout breaks at extremes
- [ ] Settings UI works
- [ ] Scaling persists across app restarts

---

### Feature 2.2: Cloudflare Bypass

**Files to Merge:**

```
src/services/network/CloudflareDetector.ts  # NEW
src/services/network/CloudflareBypass.ts    # NEW
src/components/CloudflareWebView.tsx        # NEW
src/plugins/helpers/fetch.ts                # MODIFIED (auto-retry)
```

**Implementation Steps:**

1. **Merge CloudflareDetector:**

```bash
git show origin/dev:src/services/network/CloudflareDetector.ts > src/services/network/CloudflareDetector.ts
git add src/services/network/CloudflareDetector.ts
git commit -m "feat(network): add Cloudflare challenge detector"
```

2. **Merge CloudflareBypass:**

```bash
git show origin/dev:src/services/network/CloudflareBypass.ts > src/services/network/CloudflareBypass.ts
git add src/services/network/CloudflareBypass.ts
git commit -m "feat(network): add Cloudflare bypass orchestrator"
```

3. **Merge CloudflareWebView:**

```bash
git show origin/dev:src/components/CloudflareWebView.tsx > src/components/CloudflareWebView/CloudflareWebView.tsx
git add src/components/CloudflareWebView/
git commit -m "feat(components): add CloudflareWebView solver component"
```

4. **Integrate with fetchApi:**

```bash
# Get fetchApi diff (only Cloudflare parts)
git diff origin/original..origin/dev src/plugins/helpers/fetch.ts > /tmp/fetch-cf.diff

# Look for:
# - CloudflareDetector.isChallenge() check
# - CloudflareBypass.solve() call
# - Automatic retry logic

# Apply changes
git add src/plugins/helpers/fetch.ts
git commit -m "feat(network): add automatic Cloudflare bypass to fetchApi"
```

5. **Add Tests:**

```bash
# Copy Cloudflare tests
git show origin/dev:src/services/network/__tests__/CloudflareDetector.test.ts > src/services/network/__tests__/CloudflareDetector.test.ts
# ... (other test files)

git add src/services/network/__tests__/
git commit -m "test(network): add Cloudflare bypass test coverage"
```

**Testing:**

```bash
# Unit tests
pnpm test -- Cloudflare

# Integration tests:
# 1. Find a Cloudflare-protected source
# 2. Trigger challenge
# 3. Verify automatic bypass (hidden mode)
# 4. Test modal mode (simulate interactive challenge)
# 5. Test timeout (30s)
# 6. Verify cookie persistence
```

**Success Criteria:**

- [ ] CloudflareDetector correctly identifies challenges
- [ ] CloudflareBypass solves JS challenges automatically
- [ ] Modal mode works for interactive challenges
- [ ] Timeout works (30s)
- [ ] Cookies persist after bypass
- [ ] fetchApi automatically retries after bypass

---

### Feature 2.3: WebView Security Enhancements

**Files to Merge:**

```
src/utils/webviewSecurity.ts                # NEW
src/screens/reader/components/WebViewReader.tsx  # MODIFIED
src/screens/WebviewScreen/WebviewScreen.tsx # MODIFIED
```

**Implementation Steps:**

1. **Merge Security Utilities:**

```bash
git show origin/dev:src/utils/webviewSecurity.ts > src/utils/webviewSecurity.ts
git add src/utils/webviewSecurity.ts
git commit -m "feat(security): add WebView security utilities"
```

2. **Apply to WebViewReader:**

```bash
# Get diff
git diff origin/original..origin/dev src/screens/reader/components/WebViewReader.tsx > /tmp/reader-security.diff

# Look for:
# - shouldAllowReaderWebViewRequest() usage
# - parseWebViewMessage() usage
# - createMessageRateLimiter() usage
# - createWebViewNonce() usage

# Apply security checks
git add src/screens/reader/components/WebViewReader.tsx
git commit -m "feat(reader): add WebView security checks to Reader"
```

3. **Apply to WebviewScreen:**

```bash
# Similar process for external WebView
git diff origin/original..origin/dev src/screens/WebviewScreen/WebviewScreen.tsx > /tmp/webview-security.diff

# Apply security checks
git add src/screens/WebviewScreen/WebviewScreen.tsx
git commit -m "feat(webview): add security checks to external WebView"
```

4. **Add Tests:**

```bash
# Copy security tests
git show origin/dev:src/utils/__tests__/webviewSecurity.test.ts > src/utils/__tests__/webviewSecurity.test.ts

git add src/utils/__tests__/webviewSecurity.test.ts
git commit -m "test(security): add WebView security test coverage"
```

**Testing:**

```bash
# Run security tests
pnpm test -- webviewSecurity

# Manual security tests:
# 1. Test origin whitelist (Reader should block http://)
# 2. Test message validation (send invalid message type)
# 3. Test rate limiting (send 100 messages/second)
# 4. Test nonce (replay old message)
```

**Success Criteria:**

- [ ] Security tests pass
- [ ] Reader blocks remote navigation
- [ ] External WebView enforces HTTPS
- [ ] Message validation works
- [ ] Rate limiting prevents DoS
- [ ] Nonce prevents replay attacks

---

### Feature 2.4: Continuous Scrolling

**Files to Merge:**

```
src/screens/reader/hooks/useContinuousScrolling.ts  # NEW
src/screens/reader/components/ReaderBottomSheet.tsx # MODIFIED
src/screens/settings/SettingsReaderScreen.tsx       # MODIFIED
... (continuous scrolling modals)
```

**Implementation Steps:**

1. **Merge Continuous Scrolling Hook:**

```bash
git show origin/dev:src/screens/reader/hooks/useContinuousScrolling.ts > src/screens/reader/hooks/useContinuousScrolling.ts
git add src/screens/reader/hooks/useContinuousScrolling.ts
git commit -m "feat(reader): add continuous scrolling hook"
```

2. **Merge Modals:**

```bash
# Copy all continuous scrolling modal components
git show origin/dev:src/components/ContinuousScrollingModal.tsx > src/components/ContinuousScrollingModal/ContinuousScrollingModal.tsx
# ... (other modals: ChapterBoundaryModal, TransitionThresholdModal, StitchThresholdModal)

git add src/components/ContinuousScrollingModal/
git commit -m "feat(reader): add continuous scrolling modal components"
```

3. **Integrate with Reader:**

```bash
# Get Reader integration diff
git diff origin/original..origin/dev src/screens/reader/ > /tmp/reader-continuous.diff

# Look for:
# - useContinuousScrolling() usage
# - Chapter stitching logic
# - Auto-mark short chapters
# - Boundary rendering

# Apply changes (may be complex, review carefully)
git add src/screens/reader/
git commit -m "feat(reader): integrate continuous scrolling into Reader"
```

4. **Add Settings UI:**

```bash
# Get settings diff
git diff origin/original..origin/dev src/screens/settings/SettingsReaderScreen.tsx > /tmp/reader-settings.diff

# Look for:
# - Continuous scrolling toggle
# - Stitch threshold slider
# - Transition threshold slider
# - Boundary style picker
# - Auto-mark short chapters toggle

git add src/screens/settings/SettingsReaderScreen.tsx
git commit -m "feat(settings): add continuous scrolling settings UI"
```

5. **Add String Translations:**

```bash
# Add continuous scrolling strings
# continuousScrolling, continuousScrollingDesc, stitchThreshold, etc.

git add strings/
git commit -m "feat(strings): add continuous scrolling translations"
```

**Testing:**

```bash
# Manual tests:
# 1. Enable continuous scrolling
# 2. Scroll to end of chapter
# 3. Verify next chapter loads automatically
# 4. Test "ask" mode (should prompt)
# 5. Test boundary styles (bordered vs stitched)
# 6. Test auto-mark short chapters
# 7. Test threshold adjustments
```

**Success Criteria:**

- [ ] Continuous scrolling works in "always" mode
- [ ] "Ask" mode prompts correctly
- [ ] Disabled mode works (traditional navigation)
- [ ] Boundary rendering works
- [ ] Auto-mark short chapters works
- [ ] Thresholds are adjustable and work correctly

---

## Phase 3: Conditional Features (Priority 3)

**Estimated Time:** 5-7 days  
**Risk Level:** MEDIUM  
**Dependencies:** Phase 1 & 2 complete

---

### Feature 3.1: DoH Support (with Modifications)

**⚠️ CRITICAL: Apply fixes from 01-network-features.md before merging**

**Implementation Steps:**

1. **Fix Native Module:**

```bash
# Copy DoHManagerModule.kt
git show origin/dev:android/app/src/main/java/.../DoHManagerModule.kt > /tmp/DoHManagerModule.kt

# Edit /tmp/DoHManagerModule.kt:
# 1. REMOVE exitApp() method entirely
# 2. REMOVE MMKV backup layer (keep only SharedPreferences)
# 3. ADD backup certificate pins

# Copy edited file
cp /tmp/DoHManagerModule.kt android/app/src/main/java/.../DoHManagerModule.kt

git add android/app/src/main/java/.../DoHManagerModule.kt
git commit -m "feat(network): add DoH support (Android-only, with fixes)"
```

2. **Copy DoHPackage:**

```bash
git show origin/dev:android/app/src/main/java/.../DoHPackage.kt > android/app/src/main/java/.../DoHPackage.kt
git add android/app/src/main/java/.../DoHPackage.kt
git commit -m "feat(network): add DoHPackage for React Native bridge"
```

3. **Update Gradle:**

```bash
# Get Gradle diff
git diff origin/original..origin/dev android/app/build.gradle > /tmp/gradle-doh.diff

# Look for:
# - OkHttp 4.12.0 dependencies
# - okhttp-dnsoverhttps dependency
# - Force resolution strategy

# Apply changes
git add android/app/build.gradle
git commit -m "build(android): upgrade OkHttp to 4.12.0 for DoH support"
```

4. **Update ProGuard:**

```bash
git diff origin/original..origin/dev android/app/proguard-rules.pro > /tmp/proguard-doh.diff

# Add DoH ProGuard rules
git add android/app/proguard-rules.pro
git commit -m "build(android): add ProGuard rules for DoH"
```

5. **Merge TypeScript Wrapper (with fixes):**

```bash
# Copy DoHManager.ts
git show origin/dev:src/services/network/DoHManager.ts > /tmp/DoHManager.ts

# Edit /tmp/DoHManager.ts:
# REMOVE exitApp() method

cp /tmp/DoHManager.ts src/services/network/DoHManager.ts

git add src/services/network/DoHManager.ts
git commit -m "feat(network): add DoHManager TypeScript wrapper"
```

6. **Add Settings UI (with fixes):**

```bash
# Get settings diff
git diff origin/original..origin/dev src/screens/settings/SettingsAdvancedScreen.tsx > /tmp/doh-settings.diff

# MODIFY restart flow:
# - REMOVE: DoHManager.exitApp() call
# - ADD: Dialog showing "Please restart app manually"

# Apply modified changes
git add src/screens/settings/SettingsAdvancedScreen.tsx
git commit -m "feat(settings): add DoH provider picker (with safe restart flow)"
```

**Testing:**

```bash
# Android tests:
# 1. Set DoH provider to Cloudflare
# 2. Verify dialog shows (NOT force exit)
# 3. Manually restart app
# 4. Verify DoH is active (check logs)
# 5. Test DNS resolution with DoH
# 6. Test fallback to system DNS on error
# 7. Switch to Google DoH
# 8. Repeat tests

# iOS tests:
# 1. Verify DoH option disabled (Android-only)
```

**Success Criteria:**

- [ ] Native module builds without errors
- [ ] DoH providers work (Cloudflare, Google, AdGuard)
- [ ] Certificate pinning works
- [ ] Persistence works (SharedPreferences only)
- [ ] Restart dialog shows (NO force exit)
- [ ] iOS gracefully disables feature
- [ ] Backup pins added (resilience)

---

### Feature 3.2: TTS Media Controls (Basic Version)

**⚠️ NOTE:** Only merge basic TTS media controls, NOT entire TTS system

**Files to Merge (Selective):**

```
android/app/src/main/java/.../TTSForegroundService.kt       # NEW
android/app/src/main/java/.../DebugMediaButtonReceiver.kt   # NEW
src/hooks/useTTSController.ts                               # MODIFIED (media controls only)
... (select specific TTS improvements, not all 45+ test files)
```

**Recommendation:** Discuss with upstream maintainers first. TTS system is extensive (45+ test files, 20+ components). Consider deferring to separate PR after main merge.

---

## Phase 4: Final Cleanup & Validation

**Estimated Time:** 2-3 days  
**Risk Level:** LOW

---

### Step 4.1: Remove All Personal Branding

```bash
# Revert README to upstream
git checkout origin/original -- README.md

# Add back ONLY merged features (write new content)
# ... edit README.md ...

git add README.md
git commit -m "docs: update README with merged features"

# Revert AboutScreen
git checkout origin/original -- src/screens/more/AboutScreen.tsx

# Review FeaturesScreen (remove or make generic)
rm src/screens/more/FeaturesScreen.tsx  # OR make it generic
git add src/screens/more/
git commit -m "refactor: remove fork-specific branding"
```

### Step 4.2: Final Test Suite

```bash
# Run ALL tests
pnpm test

# Expected: 1,072+ tests passing (or adjusted count based on merged features)

# Run lint
pnpm lint

# Run type check
pnpm tsc --noEmit

# Build Android
cd android && ./gradlew assembleRelease

# Build iOS (if applicable)
cd ios && xcodebuild ...
```

### Step 4.3: Final Validation Checklist

**Code Quality:**

- [ ] All tests passing
- [ ] No lint errors
- [ ] No TypeScript errors
- [ ] Build succeeds (Android release)
- [ ] Build succeeds (iOS release, if applicable)

**Personal Content Removed:**

- [ ] No `.agents/` directory
- [ ] No `memory-bank/` directory
- [ ] No `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`
- [ ] No `.github/*.chatmode.md`
- [ ] `specs/` only contains upstream-merge-analysis
- [ ] No `bizzkoot` references (except git history)
- [ ] No fork version numbers (v2.0.3-14) in UI
- [ ] README is upstream-focused
- [ ] AboutScreen has no fork links

**Features Working:**

- [ ] Cookie persistence works
- [ ] Cloudflare bypass works
- [ ] DoH works (with safe restart)
- [ ] UI scaling works
- [ ] Continuous scrolling works
- [ ] Backup v2 works
- [ ] Auto-backup works
- [ ] WebView security works

**Documentation:**

- [ ] README updated with merged features
- [ ] CONTRIBUTING unchanged (or improved)
- [ ] New features documented
- [ ] Migration guide added (if needed)

---

## Phase 5: Merge to origin/original

```bash
# Final review
git log --oneline merge-prep

# Ensure clean history (optional: squash commits)
git rebase -i origin/original

# Merge to origin/original
git checkout original
git merge merge-prep --no-ff -m "feat: merge upstream-ready features from dev branch

- Cookie persistence system
- Cloudflare bypass
- DoH support (Android-only, with safe restart)
- UI scaling system
- Continuous scrolling
- Backup system v2 with auto-backup
- WebView security enhancements
- Gradle 9.2 + React Native 0.82 upgrades
- Comprehensive test infrastructure

Total: 45,000+ lines of production code, 1,072+ tests passing
Breaking changes: None
See specs/upstream-merge-analysis/ for full documentation"

# Push to origin
git push origin original

# Create tag
git tag -a upstream-ready-v1.0 -m "Features ready for upstream PR"
git push origin upstream-ready-v1.0
```

---

## Phase 6: Prepare Upstream PR

```bash
# Create PR branch from origin/original
git checkout original
git checkout -b upstream-pr

# Push to your fork
git push origin upstream-pr

# Create PR on GitHub:
# FROM: your-fork/upstream-pr
# TO: upstream/master

# PR Title:
# "feat: Cookie persistence, Cloudflare bypass, UI scaling, and modern build system"

# PR Description:
# (Use 00-EXECUTIVE-SUMMARY.md as template)
```

---

## Rollback Plan

If issues arise:

```bash
# Rollback to backup tag
git checkout original
git reset --hard backup-before-merge
git push origin original --force

# Or rollback specific feature:
git revert <commit-hash>
```

---

## Estimated Timeline

| Phase                  | Duration | Cumulative |
| ---------------------- | -------- | ---------- |
| Phase 0: Preparation   | 1 day    | 1 day      |
| Phase 1: Foundation    | 3-5 days | 4-6 days   |
| Phase 2: Core Features | 4-6 days | 8-12 days  |
| Phase 3: Conditional   | 5-7 days | 13-19 days |
| Phase 4: Cleanup       | 2-3 days | 15-22 days |
| Phase 5: Merge         | 1 day    | 16-23 days |
| Phase 6: Upstream PR   | 1 day    | 17-24 days |

**Total: 2.5-3.5 weeks** (assuming full-time work)

If working part-time (2-3 hours/day): **6-8 weeks**

---

## Success Metrics

### Technical Metrics

- ✅ 1,072+ tests passing
- ✅ Build time < 10% increase
- ✅ App size < 10% increase
- ✅ No breaking changes to plugin API
- ✅ Zero regressions in existing features

### Code Quality Metrics

- ✅ No lint errors
- ✅ No TypeScript errors
- ✅ Test coverage > 70% (for new code)
- ✅ Security audit passed (WebView, network)

### User Impact Metrics

- ✅ Cookie persistence enables 20+ new sources
- ✅ Cloudflare bypass unblocks 30+ sources
- ✅ UI scaling improves accessibility
- ✅ Auto-backup prevents data loss

---

## Conclusion

This implementation plan provides a safe, incremental path to merge 227 commits worth of features into a clean, upstream-ready state. By following these steps carefully and testing at each stage, you can confidently create a high-value PR for upstream that:

1. **Adds significant features** (cookie persistence, Cloudflare bypass, UI scaling, etc.)
2. **Maintains stability** (zero breaking changes, comprehensive tests)
3. **Removes personal content** (no AI instructions, no fork branding)
4. **Follows best practices** (security hardening, modern build system)

**Next Steps:**

1. Review this plan with team/maintainers
2. Begin Phase 0 (backup and preparation)
3. Execute phases sequentially
4. Validate at each checkpoint
5. Submit upstream PR with confidence

Good luck! 🚀
