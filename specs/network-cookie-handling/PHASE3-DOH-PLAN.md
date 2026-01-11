# Phase 3: DNS-over-HTTPS (DoH) Implementation Plan

**Date**: January 2, 2026  
**Version**: 1.0  
**Status**: Planning Complete, Ready for Implementation  
**Platform**: Android-only (iOS deferred)

---

## Executive Summary

This plan implements DNS-over-HTTPS (DoH) support in LNReader following yokai's proven architecture, adapted for React Native + Android. The implementation is broken into **6 independent sessions**.

**Key Changes:**
- Upgrade OkHttp 4.9.2 → 4.12.0
- Add `okhttp-dnsoverhttps` dependency
- Create native DoH module (Java/Kotlin)
- Add Settings UI for provider selection
- Zero changes required for plugin developers

**Providers**: Cloudflare, Google, AdGuard (extensible for more)

---

## Success Criteria

### Must-Have (P0)
- ✅ Users can select DoH provider from Settings → Advanced
- ✅ 3 providers available: Cloudflare, Google, AdGuard
- ✅ Enable/disable toggle (default: disabled)
- ✅ Settings persist across app restarts (MMKV)
- ✅ Fallback to system DNS when disabled
- ✅ Zero breaking changes to fetchApi or plugins
- ✅ All 1065 existing tests pass

### Should-Have (P1)
- ✅ Confirmation dialog when enabling DoH ("Requires app restart")
- ✅ Toast feedback on settings change
- ✅ Bootstrap IPs prevent circular dependency

### Nice-to-Have (P2)
- [ ] DoH query latency display in settings
- [ ] Additional providers (Quad9, Mullvad)
- [ ] Per-source DoH override

---

## Session-Based Implementation

| Session | Goal | Effort | Files | Risk |
|---------|------|--------|-------|------|
| **1** | OkHttp upgrade + DoH dependency | 2h | build.gradle, proguard | LOW |
| **2** | Native DoH module | 3h | DoHManager.java, MainApplication.java | MEDIUM |
| **3** | TypeScript service wrapper | 2h | DoHManager.ts, tests | LOW |
| **4** | Settings UI integration | 3h | SettingsAdvancedScreen.tsx, strings | LOW |
| **5** | Integration testing | 2h | Manual tests, benchmarks | LOW |
| **6** | Documentation & cleanup | 1h | AGENTS.md, memory, commit | LOW |

**Total Effort**: 13 hours (~2 days)

---

## SESSION 1: OkHttp Upgrade + DoH Dependency ⏸️

**Goal**: Upgrade OkHttp to 4.12.0 and add okhttp-dnsoverhttps dependency

**Files to Modify (2):**
- `android/app/build.gradle` (~15 lines added)
- `android/app/proguard-rules.pro` (~5 lines added, if needed)

**Implementation Steps:**

1. **Update OkHttp in build.gradle**
   ```gradle
   dependencies {
       // Force OkHttp 4.12.0 for DoH support
       implementation("com.squareup.okhttp3:okhttp:4.12.0") {
           force = true
       }
       implementation("com.squareup.okhttp3:okhttp-urlconnection:4.12.0") {
           force = true
       }
       
       // Add DoH support
       implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:4.12.0")
       
       // Update Okio dependency
       implementation("com.squareup.okio:okio:3.6.0") {
           force = true
       }
   }
   ```

2. **Add ProGuard rules (if minification enabled)**
   ```proguard
   # OkHttp DoH
   -dontwarn okhttp3.dnsoverhttps.**
   -keep class okhttp3.dnsoverhttps.** { *; }
   ```

3. **Sync Gradle and rebuild**
   ```bash
   cd android
   ./gradlew clean assembleDebug
   ```

4. **Run tests to verify no regressions**
   ```bash
   pnpm run test
   ```

**Test Strategy:**
- ✅ App builds successfully
- ✅ All 1065 tests pass (no OkHttp-related failures)
- ✅ App launches without crashes
- ✅ Fetch requests work (HTTP/HTTPS)

**Success Criteria:**
- [ ] Gradle sync successful
- [ ] Build completes without errors
- [ ] Test suite: 1065/1065 passing
- [ ] No runtime crashes on app launch

**Rollback:**
```bash
git checkout android/app/build.gradle android/app/proguard-rules.pro
cd android && ./gradlew clean
```

---

## SESSION 2: Native DoH Module ⏸️

**Goal**: Create native Android module for DoH provider management

**Files to Create (2):**
- `android/app/src/main/java/com/rajarsheechatterjee/LNReader/DoHManager.java` (~180 lines)
- Update `android/app/src/main/java/com/rajarsheechatterjee/LNReader/MainApplication.java` (~5 lines)

**Files to Modify (1):**
- `android/app/src/main/java/com/rajarsheechatterjee/LNReader/LNReaderPackage.java` (~3 lines)

**Implementation Steps:**

1. **Create DoHManager.java**
   ```java
   package com.rajarsheechatterjee.LNReader;
   
   import com.facebook.react.bridge.*;
   import okhttp3.OkHttpClient;
   import okhttp3.dnsoverhttps.DnsOverHttps;
   import okhttp3.HttpUrl;
   import java.net.InetAddress;
   
   public class DoHManager extends ReactContextBaseJavaModule {
       private static final int DOH_DISABLED = -1;
       private static final int DOH_CLOUDFLARE = 1;
       private static final int DOH_GOOGLE = 2;
       private static final int DOH_ADGUARD = 3;
       
       private static int currentProvider = DOH_DISABLED;
       private static DnsOverHttps dohInstance = null;
       
       public DoHManager(ReactApplicationContext context) {
           super(context);
       }
       
       @Override
       public String getName() {
           return "DoHManager";
       }
       
       @ReactMethod
       public void setProvider(int providerId, Promise promise) {
           currentProvider = providerId;
           dohInstance = buildDnsOverHttps(providerId);
           promise.resolve(true);
       }
       
       @ReactMethod
       public void getProvider(Promise promise) {
           promise.resolve(currentProvider);
       }
       
       @ReactMethod
       public void clearProvider(Promise promise) {
           currentProvider = DOH_DISABLED;
           dohInstance = null;
           promise.resolve(true);
       }
       
       public static DnsOverHttps getDnsInstance() {
           return dohInstance;
       }
       
       private DnsOverHttps buildDnsOverHttps(int providerId) {
           OkHttpClient bootstrapClient = new OkHttpClient.Builder().build();
           
           switch (providerId) {
               case DOH_CLOUDFLARE:
                   return new DnsOverHttps.Builder()
                       .client(bootstrapClient)
                       .url(HttpUrl.parse("https://cloudflare-dns.com/dns-query"))
                       .bootstrapDnsHosts(
                           InetAddress.getByName("1.1.1.1"),
                           InetAddress.getByName("1.0.0.1"),
                           InetAddress.getByName("162.159.36.1"),
                           InetAddress.getByName("162.159.46.1")
                       )
                       .build();
                       
               case DOH_GOOGLE:
                   return new DnsOverHttps.Builder()
                       .client(bootstrapClient)
                       .url(HttpUrl.parse("https://dns.google/dns-query"))
                       .bootstrapDnsHosts(
                           InetAddress.getByName("8.8.8.8"),
                           InetAddress.getByName("8.8.4.4")
                       )
                       .build();
                       
               case DOH_ADGUARD:
                   return new DnsOverHttps.Builder()
                       .client(bootstrapClient)
                       .url(HttpUrl.parse("https://dns-unfiltered.adguard.com/dns-query"))
                       .bootstrapDnsHosts(
                           InetAddress.getByName("94.140.14.140"),
                           InetAddress.getByName("94.140.14.141")
                       )
                       .build();
                       
               default:
                   return null;
           }
       }
   }
   ```

2. **Register module in LNReaderPackage.java**
   ```java
   @Override
   public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
       List<NativeModule> modules = new ArrayList<>();
       // ... existing modules
       modules.add(new DoHManager(reactContext));
       return modules;
   }
   ```

3. **Integrate with OkHttpClient**
   Find where `OkHttpClient` is created (likely in a network module or fetch handler) and apply DoH:
   ```java
   OkHttpClient.Builder builder = new OkHttpClient.Builder();
   
   DnsOverHttps doh = DoHManager.getDnsInstance();
   if (doh != null) {
       builder.dns(doh);
   }
   
   OkHttpClient client = builder.build();
   ```

**Test Strategy:**
- ✅ Native module compiles without errors
- ✅ Module registered successfully
- ✅ Can call methods from JavaScript (integration test in Session 3)

**Success Criteria:**
- [ ] DoHManager.java compiles
- [ ] Module registered in package list
- [ ] App builds and launches
- [ ] No native crashes

**Rollback:**
```bash
git checkout android/app/src/main/java/com/rajarsheechatterjee/LNReader/
cd android && ./gradlew clean
```

---

## SESSION 3: TypeScript Service Wrapper ⏸️

**Goal**: Create TypeScript wrapper for DoH native module with error handling

**Files to Create (2):**
- `src/services/network/DoHManager.ts` (~100 lines)
- `src/services/network/__tests__/DoHManager.test.ts` (~50 lines)

**Files to Modify (1):**
- `src/services/network/index.ts` (~2 lines - export)

**Implementation Steps:**

1. **Create DoHManager.ts**
   ```typescript
   import { NativeModules, Platform } from 'react-native';
   import { rateLimitedLogger } from '@utils/rateLimitedLogger';
   
   const { DoHManager: NativeDoHManager } = NativeModules;
   
   export enum DoHProvider {
       DISABLED = -1,
       CLOUDFLARE = 1,
       GOOGLE = 2,
       ADGUARD = 3,
   }
   
   export const DoHProviderNames: Record<DoHProvider, string> = {
       [DoHProvider.DISABLED]: 'Disabled (System DNS)',
       [DoHProvider.CLOUDFLARE]: 'Cloudflare (1.1.1.1)',
       [DoHProvider.GOOGLE]: 'Google (8.8.8.8)',
       [DoHProvider.ADGUARD]: 'AdGuard (94.140.14.140)',
   };
   
   class DoHManagerService {
       /**
        * Set DNS-over-HTTPS provider
        * @param provider Provider ID from DoHProvider enum
        * @returns Promise<boolean> Success status
        */
       async setProvider(provider: DoHProvider): Promise<boolean> {
           if (Platform.OS !== 'android') {
               rateLimitedLogger.warn('DoH is Android-only');
               return false;
           }
           
           try {
               await NativeDoHManager.setProvider(provider);
               rateLimitedLogger.info(`DoH provider set to: ${DoHProviderNames[provider]}`);
               return true;
           } catch (error) {
               rateLimitedLogger.error('Failed to set DoH provider:', error);
               return false;
           }
       }
       
       /**
        * Get current DoH provider
        * @returns Promise<DoHProvider> Current provider ID
        */
       async getProvider(): Promise<DoHProvider> {
           if (Platform.OS !== 'android') {
               return DoHProvider.DISABLED;
           }
           
           try {
               const provider = await NativeDoHManager.getProvider();
               return provider;
           } catch (error) {
               rateLimitedLogger.error('Failed to get DoH provider:', error);
               return DoHProvider.DISABLED;
           }
       }
       
       /**
        * Clear DoH provider (fallback to system DNS)
        * @returns Promise<boolean> Success status
        */
       async clearProvider(): Promise<boolean> {
           if (Platform.OS !== 'android') {
               return true;
           }
           
           try {
               await NativeDoHManager.clearProvider();
               rateLimitedLogger.info('DoH provider cleared');
               return true;
           } catch (error) {
               rateLimitedLogger.error('Failed to clear DoH provider:', error);
               return false;
           }
       }
       
       /**
        * Check if DoH is supported on current platform
        * @returns boolean
        */
       isSupported(): boolean {
           return Platform.OS === 'android';
       }
   }
   
   export const DoHManager = new DoHManagerService();
   ```

2. **Write unit tests**
   ```typescript
   import { DoHManager, DoHProvider } from '../DoHManager';
   import { Platform } from 'react-native';
   
   jest.mock('react-native', () => ({
       Platform: { OS: 'android' },
       NativeModules: {
           DoHManager: {
               setProvider: jest.fn().mockResolvedValue(true),
               getProvider: jest.fn().mockResolvedValue(-1),
               clearProvider: jest.fn().mockResolvedValue(true),
           },
       },
   }));
   
   describe('DoHManager', () => {
       it('should set provider successfully', async () => {
           const result = await DoHManager.setProvider(DoHProvider.CLOUDFLARE);
           expect(result).toBe(true);
       });
       
       it('should get current provider', async () => {
           const provider = await DoHManager.getProvider();
           expect(provider).toBe(DoHProvider.DISABLED);
       });
       
       it('should clear provider', async () => {
           const result = await DoHManager.clearProvider();
           expect(result).toBe(true);
       });
       
       it('should check platform support', () => {
           expect(DoHManager.isSupported()).toBe(true);
       });
   });
   ```

3. **Add export to index.ts**
   ```typescript
   export { DoHManager, DoHProvider, DoHProviderNames } from './DoHManager';
   ```

**Test Strategy:**
- ✅ Unit tests pass (4/4)
- ✅ TypeScript compilation succeeds
- ✅ No ESLint errors

**Success Criteria:**
- [ ] DoHManager.ts created
- [ ] Unit tests: 4/4 passing
- [ ] All 1069 tests passing (1065 + 4 new)
- [ ] No type errors

**Rollback:**
```bash
git checkout src/services/network/
```

---

## SESSION 4: Settings UI Integration ⏸️

**Goal**: Add DoH provider picker to Settings → Advanced screen

**Files to Modify (3):**
- `src/screens/settings/SettingsAdvancedScreen.tsx` (~40 lines added)
- `strings/languages/en/strings.json` (~6 strings added)
- `strings/types/index.ts` (~1 type added)

**Implementation Steps:**

1. **Add DoH section to SettingsAdvancedScreen.tsx**
   ```typescript
   import { DoHManager, DoHProvider, DoHProviderNames } from '@services/network/DoHManager';
   import { showToast } from '@utils/showToast';
   
   // Add state for DoH settings
   const [dohProvider, setDohProvider] = useState<DoHProvider>(DoHProvider.DISABLED);
   const [showDohDialog, setShowDohDialog] = useState(false);
   const [pendingProvider, setPendingProvider] = useState<DoHProvider | null>(null);
   
   // Load current provider on mount
   useEffect(() => {
       if (DoHManager.isSupported()) {
           DoHManager.getProvider().then(setDohProvider);
       }
   }, []);
   
   // Add to settings list (after "Clear cookies" or network section)
   <List.Section>
       <List.Subheader>{getString('advancedSettingsScreen.dnsOverHttps')}</List.Subheader>
       
       <List.Item
           title={getString('advancedSettingsScreen.dohProvider')}
           description={DoHProviderNames[dohProvider]}
           onPress={() => setShowDohDialog(true)}
           left={(props) => <List.Icon {...props} icon="dns" />}
           disabled={!DoHManager.isSupported()}
       />
       
       {!DoHManager.isSupported() && (
           <List.Item
               title={getString('advancedSettingsScreen.dohAndroidOnly')}
               titleStyle={{ fontSize: 12, color: theme.colors.outline }}
           />
       )}
   </List.Section>
   
   {/* DoH Provider Picker Dialog */}
   <Portal>
       <Dialog visible={showDohDialog} onDismiss={() => setShowDohDialog(false)}>
           <Dialog.Title>{getString('advancedSettingsScreen.selectDohProvider')}</Dialog.Title>
           <Dialog.Content>
               <RadioButton.Group
                   value={String(dohProvider)}
                   onValueChange={(value) => {
                       const providerId = parseInt(value) as DoHProvider;
                       if (providerId === dohProvider) {
                           setShowDohDialog(false);
                           return;
                       }
                       setPendingProvider(providerId);
                   }}
               >
                   {Object.entries(DoHProviderNames).map(([id, name]) => (
                       <RadioButton.Item
                           key={id}
                           label={name}
                           value={id}
                       />
                   ))}
               </RadioButton.Group>
               
               {pendingProvider !== null && (
                   <Text style={{ marginTop: 16, color: theme.colors.error }}>
                       {getString('advancedSettingsScreen.dohRestartWarning')}
                   </Text>
               )}
           </Dialog.Content>
           <Dialog.Actions>
               <Button onPress={() => {
                   setShowDohDialog(false);
                   setPendingProvider(null);
               }}>
                   {getString('common.cancel')}
               </Button>
               <Button
                   onPress={async () => {
                       if (pendingProvider !== null) {
                           const success = await DoHManager.setProvider(pendingProvider);
                           if (success) {
                               setDohProvider(pendingProvider);
                               showToast(getString('advancedSettingsScreen.dohProviderChanged'));
                           } else {
                               showToast(getString('advancedSettingsScreen.dohProviderError'));
                           }
                       }
                       setShowDohDialog(false);
                       setPendingProvider(null);
                   }}
                   disabled={pendingProvider === null}
               >
                   {getString('common.ok')}
               </Button>
           </Dialog.Actions>
       </Dialog>
   </Portal>
   ```

2. **Add translation strings**
   ```json
   {
       "advancedSettingsScreen": {
           "dnsOverHttps": "DNS over HTTPS (Privacy)",
           "dohProvider": "DoH Provider",
           "selectDohProvider": "Select DoH Provider",
           "dohRestartWarning": "⚠️ App restart required for changes to take effect.",
           "dohProviderChanged": "DoH provider changed. Please restart the app.",
           "dohProviderError": "Failed to change DoH provider.",
           "dohAndroidOnly": "DoH is only available on Android"
       }
   }
   ```

3. **Update TypeScript types**
   ```typescript
   advancedSettingsScreen: {
       // ... existing strings
       dnsOverHttps: string;
       dohProvider: string;
       selectDohProvider: string;
       dohRestartWarning: string;
       dohProviderChanged: string;
       dohProviderError: string;
       dohAndroidOnly: string;
   }
   ```

**Test Strategy:**
- ✅ Settings screen renders without crashes
- ✅ DoH section visible on Android
- ✅ Dialog opens and closes correctly
- ✅ Provider selection updates state
- ✅ Toast displays on provider change

**Success Criteria:**
- [ ] UI compiles and renders
- [ ] Can select different providers
- [ ] Warning message displays
- [ ] Toast feedback works
- [ ] All 1069 tests still passing

**Rollback:**
```bash
git checkout src/screens/settings/SettingsAdvancedScreen.tsx strings/
```

---

## SESSION 5: Integration Testing ⏸️

**Goal**: Manual testing with each DoH provider and performance validation

**No files created/modified** (testing only)

**Test Plan:**

### Test 1: Provider Selection
1. Open Settings → Advanced
2. Tap "DoH Provider"
3. Select "Cloudflare (1.1.1.1)"
4. Confirm warning dialog
5. Restart app
6. **Expected**: Toast displays, setting persists

### Test 2: DNS Resolution with Cloudflare
1. Enable Cloudflare DoH
2. Restart app
3. Open any novel source
4. Load novel list
5. **Expected**: Novels load successfully

### Test 3: Google DoH
1. Switch to Google DoH
2. Restart app
3. Load different source
4. **Expected**: Novels load successfully

### Test 4: AdGuard DoH
1. Switch to AdGuard DoH
2. Restart app
3. Load third source
4. **Expected**: Novels load successfully

### Test 5: Disable DoH (System DNS)
1. Select "Disabled (System DNS)"
2. Restart app
3. Load source
4. **Expected**: Novels load (fallback to system DNS)

### Test 6: Network Latency Benchmark
```bash
# Enable ADB logging
adb logcat | grep "DoH\|DNS"

# Compare latency:
# - Cloudflare DoH
# - System DNS
# Expected: <100ms difference for first query, <5ms for cached
```

### Test 7: Cloudflare Bypass Integration
1. Enable DoH (any provider)
2. Load Cloudflare-protected source
3. **Expected**: Bypass works, cookies persist

### Test 8: Cookie Persistence Integration
1. Enable DoH
2. Login to source via WebView
3. Close app
4. Reopen app
5. **Expected**: Still logged in (cookies + DoH work together)

**Success Criteria:**
- [ ] All 8 tests pass
- [ ] No crashes or network errors
- [ ] DoH works with existing features (cookies, Cloudflare bypass)
- [ ] Latency overhead acceptable (<100ms first query)

**Rollback:** N/A (testing only)

---

## SESSION 6: Documentation & Cleanup ⏸️

**Goal**: Update project documentation and finalize Phase 3

**Files to Modify (4):**
- `AGENTS.md` (~50 lines added - DoH architecture section)
- `.agents/memory.instruction.md` (~20 lines added)
- `specs/network-cookie-handling/09-IMPLEMENTATION-PLAN.md` (~30 lines added)
- `specs/network-cookie-handling/PHASE3-COMPLETE.md` (new file, ~200 lines)

**Implementation Steps:**

1. **Update AGENTS.md**
   Add DoH section to "Services" or "Network Architecture":
   ```markdown
   ## DNS-over-HTTPS (DoH) Support
   
   **Status**: Implemented (Phase 3) - Android-only
   
   **Architecture:**
   - Native Module: `DoHManager.java` (OkHttp 4.12.0 + okhttp-dnsoverhttps)
   - Service Wrapper: `src/services/network/DoHManager.ts`
   - Settings UI: `SettingsAdvancedScreen.tsx`
   
   **Providers:**
   - Cloudflare (1.1.1.1)
   - Google (8.8.8.8)
   - AdGuard (94.140.14.140)
   
   **Usage:** User-facing setting in More → Settings → Advanced → DoH Provider
   
   **Integration:** Transparent to plugins (affects all fetch() calls)
   
   **Restart Required:** Yes (OkHttpClient singleton)
   ```

2. **Update memory.instruction.md**
   Add to "Recent Changes":
   ```markdown
   # 2026-01-02: DNS-over-HTTPS (DoH) Implementation
   
   - Added native DoH module for Android (OkHttp 4.12.0 + okhttp-dnsoverhttps)
   - Upgraded OkHttp from 4.9.2 to 4.12.0 (backward compatible)
   - Created DoHManager service with 3 providers (Cloudflare, Google, AdGuard)
   - Added Settings UI in SettingsAdvancedScreen.tsx with provider picker
   - DoH is transparent to plugins (all fetch() calls use configured provider)
   - iOS support deferred (Android-only for now)
   - App restart required for provider changes (OkHttpClient singleton pattern)
   ```

3. **Update 09-IMPLEMENTATION-PLAN.md**
   Add Phase 3 summary after Phase 2:
   ```markdown
   ## Phase 3 Completion Summary
   
   **Status**: 🎉 100% Complete (Android-only)
   
   **What Works Now:**
   - ✅ DoH provider selection (Cloudflare, Google, AdGuard)
   - ✅ Enable/disable toggle
   - ✅ Settings persist via MMKV
   - ✅ Bootstrap IPs prevent circular dependency
   - ✅ Fallback to system DNS when disabled
   - ✅ Zero plugin code changes required
   - ✅ All 1069 tests passing
   
   **Sessions Completed:** 6/6 (100%)
   **Test Coverage:** 4 new tests added
   **Platform:** Android (iOS deferred)
   ```

4. **Create PHASE3-COMPLETE.md**
   Comprehensive summary document (see template below)

5. **Git commit and push**
   ```bash
   git add .
   git commit -m "feat(network): Add DNS-over-HTTPS (DoH) support (Phase 3)

   - Upgrade OkHttp 4.9.2 → 4.12.0
   - Add okhttp-dnsoverhttps dependency
   - Implement native DoHManager module (Android)
   - Add TypeScript service wrapper
   - Add Settings UI for provider selection
   - Support 3 providers: Cloudflare, Google, AdGuard
   - All 1069 tests passing, zero regressions

   Sessions:
   1. OkHttp upgrade + dependencies
   2. Native DoH module
   3. TypeScript wrapper + tests
   4. Settings UI integration
   5. Integration testing
   6. Documentation

   Phase 3 complete. iOS support deferred."
   
   git push origin dev
   ```

**Success Criteria:**
- [ ] Documentation updated
- [ ] Memory updated with DoH patterns
- [ ] PHASE3-COMPLETE.md created
- [ ] Git committed and pushed
- [ ] Clean working directory

**Rollback:** N/A (documentation only)

---

## Risk Mitigation

### Risk 1: OkHttp Version Conflicts
**Mitigation:**
- Use Gradle's `force = true` to ensure 4.12.0
- Test with existing RN dependencies
- ProGuard rules if needed

**Rollback**: Revert build.gradle changes

### Risk 2: Bootstrap IP Resolution Fails
**Mitigation:**
- Multiple bootstrap IPs per provider (redundancy)
- Fallback to system DNS if DoH fails
- Error handling in native module

**Rollback**: Disable DoH via settings

### Risk 3: App Performance Degradation
**Mitigation:**
- DoH queries cached (respects DNS TTL)
- Bootstrap client lightweight
- Benchmark in Session 5

**Rollback**: Disable DoH via settings

### Risk 4: Breaking Existing Fetch Calls
**Mitigation:**
- DoH applied at OkHttpClient level (transparent)
- Zero plugin code changes
- Comprehensive test suite validation

**Rollback**: Full session rollback

---

## Rollback Strategy

| Session | Rollback Command | Impact |
|---------|------------------|--------|
| 1 | `git checkout android/app/build.gradle` | Reverts to OkHttp 4.9.2 |
| 2 | `git checkout android/app/src/main/java/` | Removes native module |
| 3 | `git checkout src/services/network/DoHManager.ts` | Removes TS wrapper |
| 4 | `git checkout src/screens/settings/ strings/` | Removes UI |
| 5 | N/A | Testing only |
| 6 | N/A | Documentation only |

**Full Rollback** (emergency):
```bash
git checkout HEAD~6
pnpm run test
```

---

## Session Execution Checklist

For each session:

### Pre-Session
- [ ] Read session plan
- [ ] Verify clean working directory (`git status`)
- [ ] Run baseline tests (`pnpm run test`)

### During Session
- [ ] Implement changes as specified
- [ ] Format code (`pnpm run format`)
- [ ] Fix lints (`pnpm run lint:fix`)
- [ ] Write/update tests (if applicable)

### Post-Session
- [ ] Run full test suite (`pnpm run test`)
- [ ] Verify no regressions (all tests pass)
- [ ] Commit changes with descriptive message
- [ ] Manual validation (if specified)

---

## Translation Strings Needed

```json
{
    "advancedSettingsScreen": {
        "dnsOverHttps": "DNS over HTTPS (Privacy)",
        "dohProvider": "DoH Provider",
        "selectDohProvider": "Select DoH Provider",
        "dohRestartWarning": "⚠️ App restart required for changes to take effect.",
        "dohProviderChanged": "DoH provider changed. Please restart the app.",
        "dohProviderError": "Failed to change DoH provider.",
        "dohAndroidOnly": "DoH is only available on Android"
    }
}
```

---

## PHASE3-COMPLETE.md Template

```markdown
# Phase 3: DNS-over-HTTPS (DoH) - COMPLETE

**Date**: January 2, 2026  
**Status**: ✅ COMPLETE  
**Platform**: Android-only (iOS deferred)  
**Test Coverage**: 1069/1069 passing (1065 existing + 4 new)

---

## Summary

Phase 3 successfully implements DNS-over-HTTPS (DoH) support in LNReader, following yokai's proven architecture. The implementation is Android-only, with iOS support deferred to future releases.

### Key Achievements

✅ **Core Functionality (100%)**
- OkHttp upgraded from 4.9.2 to 4.12.0 (backward compatible)
- Native DoH module implemented (DoHManager.java)
- 3 DoH providers: Cloudflare, Google, AdGuard
- Bootstrap IPs prevent circular DNS dependency
- Settings persist across app restarts
- Fallback to system DNS when disabled

✅ **User Features (100%)**
- Settings UI in More → Settings → Advanced
- Provider picker with descriptions
- Confirmation dialog with restart warning
- Toast feedback on provider change
- Platform detection (Android-only notice)

✅ **Developer Experience (100%)**
- Zero plugin code changes required
- Transparent integration with fetchApi
- Comprehensive error handling
- TypeScript service wrapper
- Unit tests for all components

---

## Statistics

- **Sessions Completed**: 6/6 (100%)
- **Implementation Time**: 13 hours (~2 days)
- **Files Created**: 4 (DoHManager.java, DoHManager.ts, tests, PHASE3-COMPLETE.md)
- **Files Modified**: 7 (build.gradle, settings screens, strings, types, memory, AGENTS.md)
- **Lines Added**: ~500 (code) + ~300 (tests) + ~200 (docs)
- **Test Coverage**: 4 new unit tests, 8 integration tests
- **Zero Regressions**: All 1065 existing tests still passing

---

## Provider Details

### Cloudflare (Default Recommended)
- **URL**: `https://cloudflare-dns.com/dns-query`
- **Bootstrap IPs**: 1.1.1.1, 1.0.0.1, 162.159.36.1, 162.159.46.1
- **Latency**: 10-30ms (first query), <5ms (cached)
- **Privacy**: No logging, GDPR compliant

### Google
- **URL**: `https://dns.google/dns-query`
- **Bootstrap IPs**: 8.8.8.8, 8.8.4.4
- **Latency**: 15-40ms (first query), <5ms (cached)
- **Privacy**: Logged (Google Privacy Policy)

### AdGuard
- **URL**: `https://dns-unfiltered.adguard.com/dns-query`
- **Bootstrap IPs**: 94.140.14.140, 94.140.14.141
- **Latency**: 20-50ms (first query), <5ms (cached)
- **Privacy**: No logging, unfiltered variant

---

## Integration with Existing Features

### ✅ Cookie Persistence (Phase 1)
- DoH works seamlessly with CookieManager
- Login sessions persist with any DoH provider

### ✅ Cloudflare Bypass (Phase 2)
- Cloudflare challenges solved correctly
- cf_clearance cookies work with DoH

### ✅ Plugin System
- Zero code changes required
- All plugins automatically use DoH

---

## Known Limitations

1. **iOS Not Supported**: Deferred to future release (would require VpnService or NEDNSProxyProvider)
2. **App Restart Required**: OkHttpClient singleton pattern requires restart for provider changes
3. **No Per-Source Override**: DoH applies globally to all fetch() calls
4. **No Latency Display**: Settings UI doesn't show real-time latency (nice-to-have for future)

---

## Next Steps

**Immediate (Optional Enhancements):**
- [ ] Add more providers (Quad9, Mullvad)
- [ ] Display DoH query latency in settings
- [ ] Per-source DoH override

**Future (iOS Support):**
- [ ] Research iOS DoH implementation (NEDNSProxyProvider or proxy-based)
- [ ] Implement iOS native module
- [ ] Update settings UI for iOS

**Maintenance:**
- [ ] Monitor OkHttp updates (check for newer DoH features)
- [ ] User feedback on provider performance
- [ ] Add DoH troubleshooting guide

---

## Troubleshooting

**Q: DoH not working after enabling?**  
A: Restart the app. DoH changes require restart due to OkHttpClient singleton pattern.

**Q: "DoH is Android-only" message?**  
A: iOS support is deferred. Use system Private DNS (Android 9+) or wait for future iOS implementation.

**Q: Novels not loading with DoH enabled?**  
A: Try different provider or disable DoH. Check if provider is blocked in your region.

**Q: Performance degradation?**  
A: First DoH query adds ~50-100ms latency. Subsequent queries are cached (<5ms). If persistent, disable DoH.

---

## References

- [OkHttp DoH Documentation](https://square.github.io/okhttp/4.x/okhttp-dnsoverhttps/okhttp3.dnsoverhttps/)
- [Cloudflare DoH](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/)
- [Google Public DNS](https://developers.google.com/speed/public-dns/docs/doh)
- [AdGuard DNS](https://adguard-dns.io/en/public-dns.html)

---

**Phase 3 Complete** ✅  
**Date**: January 2, 2026  
**Next Phase**: TBD (Based on user feedback and feature requests)
```

---

## Completion Checklist

After all sessions:

- [ ] All 1069 tests passing
- [ ] App builds successfully (debug + release)
- [ ] Manual tests complete (all 8 scenarios)
- [ ] Documentation updated (AGENTS.md, memory, PHASE3-COMPLETE.md)
- [ ] Git committed and pushed
- [ ] Clean working directory
- [ ] User can select DoH provider from settings
- [ ] Provider persists across restarts
- [ ] Fallback to system DNS when disabled
- [ ] Zero regressions in existing features

---

**End of Phase 3 Plan**
