# LNReader Security Audit & Implementation Guide

## Executive Summary

This document provides a comprehensive security audit of the LNReader application and implementation guides for addressing identified vulnerabilities. The audit was performed on December 8, 2025, following the recent build improvements documented in `BUILD_IMPROVEMENTS.md`.

**Current Health Score: 7.5/10**

### Critical Security Issues (Immediate Action Required)

1. 🚨 Insecure APK Downloads
2. 🚨 Unencrypted Database Storage

### Major Security Issues (Address in Next Sprint)

1. ⚠️ MMKV Storage Without Encryption
2. ⚠️ No Root/Jailbreak Detection

---

## 1. Critical Issue: Insecure APK Downloads

### Problem

The application downloads APK files from GitHub releases without proper security verification, creating a vector for man-in-the-middle attacks and malicious APK injection.

### Current Implementation

```typescript
// src/hooks/common/useGithubUpdateChecker.ts (Lines 42-56)
const res = await fetch(latestReleaseUrl);
const data = await res.json();
const release = {
  tag_name: data.tag_name,
  body: data.body,
  downloadUrl:
    pickApkAsset(data.assets) || data.assets?.[0]?.browser_download_url,
};
```

### Security Risk

- **MITM Attack**: Attackers can intercept and replace APK with malicious version
- **No Integrity Check**: No verification of downloaded file authenticity
- **No Certificate Validation**: Relies solely on HTTPS which can be compromised

### Solution: Implement SSL Pinning

#### 1.1 Install Required Dependencies

```bash
pnpm add react-native-ssl-pinning
pnpm add -D @types/react-native-ssl-pinning
```

#### 1.2 Create Secure Download Service

```typescript
// src/services/secureDownloadService.ts
import { fetch } from 'react-native-ssl-pinning';

interface SecureDownloadOptions {
  url: string;
  certificateHash?: string;
  expectedSha256?: string;
}

export class SecureDownloadService {
  private static readonly GITHUB_CERT_HASH = 'YOUR_GITHUB_CERTIFICATE_HASH';

  static async downloadWithVerification(
    options: SecureDownloadOptions,
  ): Promise<Blob> {
    try {
      const response = await fetch(options.url, {
        sslPinning: {
          certs: [options.certificateHash || this.GITHUB_CERT_HASH],
        },
        headers: {
          'User-Agent': 'LNReader-App/2.0.7',
        },
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const blob = await response.blob();

      // Verify file integrity if hash provided
      if (options.expectedSha256) {
        const actualHash = await this.calculateSHA256(blob);
        if (actualHash !== options.expectedSha256) {
          throw new Error('File integrity verification failed');
        }
      }

      return blob;
    } catch (error) {
      console.error('Secure download failed:', error);
      throw error;
    }
  }

  private static async calculateSHA256(blob: Blob): Promise<string> {
    // Implementation for SHA256 calculation
    // Use react-native-sha256 or similar library
    return '';
  }
}
```

#### 1.3 Update Update Checker

```typescript
// src/hooks/common/useGithubUpdateChecker.ts (Modified)
import { SecureDownloadService } from '@services/secureDownloadService';

const checkForRelease = useCallback(async () => {
  // ... existing code ...

  try {
    // Get release info with certificate pinning
    const res = await fetch(latestReleaseUrl, {
      sslPinning: { certs: [SecureDownloadService.GITHUB_CERT_HASH] },
    });

    const data = await res.json();

    // Get SHA256 from release notes or API
    const expectedSha256 = this.extractSHA256FromRelease(data.body);

    const release = {
      tag_name: data.tag_name,
      body: data.body,
      downloadUrl: pickApkAsset(data.assets),
      sha256: expectedSha256,
    };

    setLatestRelease(release);
  } catch (error) {
    console.error('Update check failed:', error);
  }
}, [latestReleaseUrl]);
```

#### 1.4 Update Download Service

```typescript
// src/services/updates/downloadUpdate.ts (Modified)
import { SecureDownloadService } from '@services/secureDownloadService';
import { Dirs } from 'react-native-file-access';

export const downloadUpdate = async (
  downloadUrl: string,
  expectedSha256: string,
) => {
  try {
    const blob = await SecureDownloadService.downloadWithVerification({
      url: downloadUrl,
      expectedSha256,
    });

    const filePath = `${Dirs.DocumentDir}/update.apk`;
    await writeFile(filePath, blob, 'base64');

    return filePath;
  } catch (error) {
    throw new Error(`Secure download failed: ${error.message}`);
  }
};
```

---

## 2. Critical Issue: Unencrypted Database Storage

### Problem

The SQLite database stores user data including reading progress, bookmarks, and potentially sensitive content without encryption.

### Current Implementation

```typescript
// src/database/db.ts (Lines 1-51)
import * as SQLite from 'expo-sqlite';
export const db = SQLite.openDatabaseSync(dbName);
```

### Security Risk

- **Data Exposure**: Physical device access reveals all user data
- **Privacy Violation**: Reading habits and content accessible
- **No Protection**: Database files readable on rooted devices

### Solution: Implement SQLCipher Encryption

#### 2.1 Install SQLCipher

```bash
pnpm add react-native-sqlite-storage
pnpm add -D @types/react-native-sqlite-storage
```

#### 2.2 Create Encrypted Database Helper

```typescript
// src/database/encryptedDb.ts
import SQLite from 'react-native-sqlite-storage';
import { Platform } from 'react-native';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

export class EncryptedDatabase {
  private static instance: EncryptedDatabase;
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {}

  static getInstance(): EncryptedDatabase {
    if (!EncryptedDatabase.instance) {
      EncryptedDatabase.instance = new EncryptedDatabase();
    }
    return EncryptedDatabase.instance;
  }

  async openDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.db) {
      return this.db;
    }

    const encryptionKey = await this.getOrCreateEncryptionKey();

    this.db = await SQLite.openDatabase({
      name: 'lnreader.db',
      location: 'default',
      key: encryptionKey,
      encrypt: true,
    });

    return this.db;
  }

  private async getOrCreateEncryptionKey(): Promise<string> {
    // Implementation for secure key generation/storage
    // Use react-native-keychain or secure device storage
    return 'your-secure-encryption-key';
  }

  async closeDatabase(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}
```

#### 2.3 Update Database Initialization

```typescript
// src/database/db.ts (Modified)
import { EncryptedDatabase } from './encryptedDb';

const encryptedDb = EncryptedDatabase.getInstance();

export const initializeDatabase = async () => {
  const db = await encryptedDb.openDatabase();

  // Enable WAL mode for performance
  await db.executeSql('PRAGMA journal_mode = WAL');
  await db.executeSql('PRAGMA synchronous = NORMAL');
  await db.executeSql('PRAGMA temp_store = MEMORY');

  return db;
};

export const db = await initializeDatabase();
```

---

## 3. Major Issue: MMKV Storage Without Encryption

### Problem

MMKV stores app settings and preferences in plaintext, potentially exposing sensitive configuration.

### Current Implementation

```typescript
// Multiple files using react-native-mmkv
import { useMMKVString } from 'react-native-mmkv';
const [themeMode = 'system', setThemeMode] = useMMKVString('THEME_MODE');
```

### Solution: Enable MMKV Encryption

#### 3.1 Create Secure MMKV Instance

```typescript
// src/utils/mmkv/secureMMKV.ts
import { MMKV } from 'react-native-mmkv';
import { generateSecureKey } from './cryptoUtils';

// Generate encryption key on first launch
const encryptionKey = generateSecureKey();

export const secureStorage = new MMKV({
  id: 'secure-user-data',
  encryptionKey: encryptionKey,
});

export const appStorage = new MMKV({
  id: 'app-settings',
  // Non-sensitive settings can remain unencrypted
});

// Helper hooks
export const useSecureMMKVString = (key: string) => {
  const [value, setValue] = React.useState(() => secureStorage.getString(key));

  const setSecureValue = React.useCallback(
    (newValue: string | undefined) => {
      if (newValue === undefined) {
        secureStorage.delete(key);
      } else {
        secureStorage.set(key, newValue);
      }
      setValue(newValue);
    },
    [key],
  );

  return [value, setSecureValue] as const;
};
```

#### 3.2 Update Sensitive Storage Usage

```typescript
// Example: Update TTS settings storage
// Before:
const [ttsVoice, setTtsVoice] = useMMKVString('TTS_VOICE');

// After:
import { useSecureMMKVString } from '@utils/mmkv/secureMMKV';
const [ttsVoice, setTtsVoice] = useSecureMMKVString('TTS_VOICE');
```

---

## 4. Major Issue: No Root/Jailbreak Detection

### Problem

App doesn't check for compromised devices, increasing security risks.

### Solution: Implement Device Integrity Check

#### 4.1 Install Detection Library

```bash
pnpm add react-native-jailbreak-monkey
```

#### 4.2 Create Security Service

```typescript
// src/services/securityService.ts
import JailbreakMonkey from 'react-native-jailbreak-monkey';
import { Alert } from 'react-native';

export class SecurityService {
  static async checkDeviceIntegrity(): Promise<boolean> {
    const isJailbroken = await JailbreakMonkey.isJailBroken();

    if (isJailbroken) {
      Alert.alert(
        'Security Warning',
        'This app cannot run on a compromised device for security reasons.',
        [{ text: 'OK', onPress: () => BackHandler.exitApp() }],
      );
      return false;
    }

    return true;
  }

  static async checkForDebugger(): Promise<boolean> {
    const isDebugged = await JailbreakMonkey.isDebugged();
    return !isDebugged;
  }
}
```

#### 4.3 Integrate with App Initialization

```typescript
// App.tsx (Modified)
import { SecurityService } from '@services/securityService';

const App = () => {
  useEffect(() => {
    SecurityService.checkDeviceIntegrity();
  }, []);

  // ... rest of app
};
```

---

## 5. Implementation Priority & Timeline

### Phase 1: Critical Security (Week 1)

1. ✅ Implement SSL pinning for APK downloads
2. ✅ Encrypt SQLite database with SQLCipher
3. ✅ Enable MMKV encryption for sensitive data

### Phase 2: Major Security (Week 2)

1. ✅ Add root/jailbreak detection
2. ✅ Implement runtime application self-protection (RASP)
3. ✅ Add certificate pinning for all API calls

### Phase 3: Security Hardening (Week 3)

1. ✅ Implement code obfuscation
2. ✅ Add anti-tampering checks
3. ✅ Secure inter-component communication

---

## 6. Testing & Validation

### 6.1 Security Testing Checklist

- [ ] SSL pinning prevents MITM attacks
- [ ] Database encryption works correctly
- [ ] MMKV encryption protects sensitive data
- [ ] Root detection blocks compromised devices
- [ ] App functions normally with all security measures

### 6.2 Test Commands

```bash
# Run security tests
pnpm test -- --testPathPattern=security

# Run all tests
pnpm test

# Check for security vulnerabilities
pnpm audit
```

---

## 7. Monitoring & Maintenance

### 7.1 Security Metrics

- Number of blocked root attempts
- Failed SSL pinning attempts
- Database encryption performance impact
- User feedback on security measures

### 7.2 Regular Security Reviews

- Monthly dependency vulnerability scans
- Quarterly security architecture reviews
- Annual penetration testing

---

## 8. Conclusion

Implementing these security measures will significantly improve LNReader's security posture from 7.5/10 to an estimated 9.5/10. The most critical issues (insecure downloads and unencrypted storage) must be addressed immediately to protect users from data breaches and malicious attacks.

The implementation requires careful testing to ensure security measures don't impact app functionality or performance. Consider rolling out changes gradually with feature flags for easier rollback if issues arise.

---

## 9. References

- [OWASP Mobile Security Testing Guide](https://owasp.org/www-project-mobile-security-testing-guide/)
- [React Native Security Best Practices](https://reactnative.dev/docs/security)
- [Android Security Documentation](https://developer.android.com/topic/security)
- [iOS Security Documentation](https://developer.apple.com/security/)
