# SSL Pinning Implementation Guide

## Quick Start for APK Download Security

### 1. Install Dependencies

```bash
pnpm add react-native-ssl-pinning
pnpm add react-native-sha256
pnpm add -D @types/react-native-ssl-pinning
```

### 2. Get GitHub Certificate Hash

```bash
# Run this command to get GitHub's certificate hash
openssl s_client -connect github.com:443 < /dev/null 2>/dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64
```

### 3. Create Secure Download Service

```typescript
// src/services/secureDownloadService.ts
import { fetch } from 'react-native-ssl-pinning';
import sha256 from 'react-native-sha256';

const GITHUB_CERT_HASH = 'YOUR_GITHUB_CERTIFICATE_HASH_HERE';

export const secureDownload = async (url: string, expectedSha256?: string) => {
  try {
    const response = await fetch(url, {
      sslPinning: {
        certs: [GITHUB_CERT_HASH],
      },
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const blob = await response.blob();

    // Verify file integrity if SHA256 provided
    if (expectedSha256) {
      const reader = new FileReader();
      reader.onload = async () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const hash = await sha256(ArrayBufferToString(arrayBuffer));
        if (hash !== expectedSha256) {
          throw new Error('File integrity check failed');
        }
      };
      reader.readAsArrayBuffer(blob);
    }

    return blob;
  } catch (error) {
    console.error('Secure download failed:', error);
    throw error;
  }
};
```

### 4. Update Download Service

```typescript
// src/services/updates/downloadUpdate.ts (Modified)
import { secureDownload } from '@services/secureDownloadService';

export const downloadUpdate = async (
  downloadUrl: string,
  expectedSha256?: string,
) => {
  try {
    const blob = await secureDownload(downloadUrl, expectedSha256);
    const filePath = `${Dirs.DocumentDir}/update.apk`;
    await writeFile(filePath, blob, 'base64');
    return filePath;
  } catch (error) {
    throw new Error(`Secure download failed: ${error.message}`);
  }
};
```

### 5. Test the Implementation

```typescript
// Test in development
const testSecureDownload = async () => {
  try {
    const result = await secureDownload(
      'https://github.com/bizzkoot/lnreader/releases/latest',
    );
    console.log('Secure download successful:', result);
  } catch (error) {
    console.error('Secure download failed:', error);
  }
};
```

## Important Notes

1. **Certificate Hash**: Replace `YOUR_GITHUB_CERTIFICATE_HASH_HERE` with the actual hash from step 2
2. **SHA256 Verification**: Include SHA256 in your release notes for integrity checking
3. **Error Handling**: Always handle SSL pinning failures gracefully
4. **Testing**: Test both successful and failed scenarios thoroughly

## Next Steps

1. Implement the certificate hash extraction
2. Update your release process to include SHA256 hashes
3. Add error handling for SSL pinning failures
4. Test on both development and production builds
