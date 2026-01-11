# Further Research: Network & Cookie Handling

**Date**: January 1, 2026
**Purpose**: Areas requiring additional investigation for LNReader implementation

---

## Overview

This document identifies gaps in current research and suggests areas for further investigation before implementing yokai-style network and cookie handling in LNReader (React Native).

---

## High-Priority Research Areas

### 1. React Native Cookie Persistence Solutions

**Current Knowledge Gap**:

- No comprehensive survey of existing React Native cookie management libraries
- Unknown which approach (native module vs pure JS) is best for LNReader

**Research Questions**:

1. What React Native cookie management libraries exist?
   - `react-native-cookies` (deprecated)
   - `@react-native-cookies/cookies` (maintenance status?)
   - Custom native modules?

2. What are the pros/cons of each approach?
   - Pure JavaScript (AsyncStorage, MMKV)
   - Native module (Android CookieManager, iOS HTTPCookieStorage)
   - WebView-based cookies only

3. Which libraries are actively maintained?
   - GitHub stars, recent commits
   - Community support
   - Bug reports and fixes

4. What is the security model for each approach?
   - Encryption support
   - Secure/HttpOnly flag handling
   - Cookie persistence across app updates

**Recommended Actions**:

```bash
# Research existing libraries
- Search npm: "react-native cookies"
- Search GitHub: "react-native-cookie-manager"
- Check React Native documentation for cookie handling

# Evaluate top 3-5 libraries
- Review documentation
- Check issue trackers
- Test cookie persistence flow
- Test WebView integration

# Create comparison matrix
- Features (persistence, WebView sync, encryption)
- Maintenance (stars, commits, issues)
- Performance (read/write speed)
- Security (encryption, flags)
```

**Deliverables**:

- Comparison matrix of cookie management libraries
- Recommendation for LNReader (with justification)
- Proof-of-concept code for top 2-3 libraries

---

### 2. WebView Cookie Integration

**Current Knowledge Gap**:

- Unknown how to sync cookies between React Native WebView and HTTP requests
- Unknown React Native WebView capabilities for cookie management

**Research Questions**:

1. How does React Native WebView handle cookies?
   - `react-native-webview` cookie management API
   - `document.cookie` access from JavaScript
   - Cookie persistence across WebView sessions

2. How to extract cookies from React Native WebView?
   - `postMessage` communication
   - `injectedJavaScript` callback
   - Cookie API exposed by WebView component

3. How to set cookies in React Native WebView?
   - `source` prop with headers
   - `injectedJavaScript` to set `document.cookie`
   - WebView cookie management API

4. What are the security implications?
   - Cross-origin cookie access
   - XSS vulnerabilities
   - Cookie theft prevention

**Recommended Actions**:

```typescript
// Test React Native WebView cookie handling
import { WebView } from 'react-native-webview';

// Test 1: Extract cookies from WebView
<WebView
  source={{ uri: 'https://example.com' }}
  onNavigationStateChange={(navState) => {
    // Can we extract cookies here?
  }}
  injectedJavaScript={`
    (function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'cookies',
        data: document.cookie
      }));
    })();
  `}
  onMessage={(event) => {
    const { type, data } = JSON.parse(event.nativeEvent.data);
    if (type === 'cookies') {
      console.log('Cookies from WebView:', data);
      // Save to cookie manager
    }
  }}
/>

// Test 2: Set cookies in WebView
<WebView
  source={{
    uri: 'https://example.com',
    headers: {
      'Cookie': 'session=abc123'  // Does this work?
    }
  }}
  injectedJavaScript={`
    document.cookie = 'session=abc123; path=/';
  `}
/>
```

**Deliverables**:

- Proof-of-concept for cookie extraction from WebView
- Proof-of-concept for cookie injection to WebView
- Security assessment of cookie sync approach
- Documentation of React Native WebView limitations

---

### 3. Cloudflare Bypass in React Native

**Current Knowledge Gap**:

- Unknown how to implement background WebView for Cloudflare bypass in React Native
- Unknown performance implications of WebView-based approach

**Research Questions**:

1. Can React Native WebView be used without UI (hidden/background)?
   - `opacity: 0` approach
   - `display: none` approach
   - Headless WebView (if supported)

2. How to detect Cloudflare challenges in React Native?
   - Response code (403, 503)
   - Response headers (Server: cloudflare-nginx)
   - Response body content (challenge page HTML)

3. How to wait for Cloudflare challenge completion?
   - `onNavigationStateChange` event
   - `onLoad` event
   - Cookie polling from WebView

4. What are the performance implications?
   - WebView initialization time
   - Memory usage
   - Impact on app responsiveness

**Recommended Actions**:

```typescript
// Test Cloudflare bypass with React Native WebView
import { WebView } from 'react-native-webview';

class CloudflareBypass {
  private webViewRef: React.RefObject<WebView> | null = null;
  private resolvePromise: ((success: boolean) => void) | null = null;

  async bypass(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;

      // Detect if response is Cloudflare challenge
      const response = await fetch(url);
      if ([403, 503].includes(response.status)) {
        // Show WebView for bypass
        this.showWebView(url);
      } else {
        resolve(true);  // No bypass needed
      }
    });
  }

  showWebView(url: string) {
    return (
      <WebView
        ref={this.webViewRef}
        source={{ uri: url }}
        style={{ height: 0 }}  // Hidden WebView
        onNavigationStateChange={(navState) => {
          // Check if Cloudflare challenge solved
          // Look for cf_clearance cookie
          this.checkCloudflareSolved(navState.url);
        }}
        onError={(error) => {
          // Handle WebView errors
          this.resolvePromise?.(false);
        }}
      />
    );
  }

  async checkCloudflareSolved(url: string) {
    // Check if cf_clearance cookie exists
    const cookies = await this.getCookiesFromWebView(url);
    const cfClearance = cookies.find(c => c.name === 'cf_clearance');

    if (cfClearance && cfClearance.value) {
      this.resolvePromise?.(true);
      // Retry original request
    }
  }

  async getCookiesFromWebView(url: string): Promise<Cookie[]> {
    // Extract cookies from WebView
    // Implementation depends on WebView API
    return [];
  }
}
```

**Deliverables**:

- Proof-of-concept for Cloudflare bypass in React Native
- Performance benchmarks (WebView initialization, memory usage)
- User experience assessment (hidden vs visible WebView)
- Comparison with yokai's native approach

---

### 4. DNS over HTTPS in React Native

**Current Knowledge Gap**:

- Unknown how to implement DoH in React Native
- Unknown native module requirements for DoH support

**Research Questions**:

1. Do any React Native DoH libraries exist?
   - Search npm: "react-native doh", "react-native dns"
   - Search GitHub: "react-native-dns", "react-native-doh"

2. What are the native module requirements?
   - **Android**: OkHttp DNS module, custom DNS resolver
   - **iOS**: NWConnection, native DNS APIs
   - Cross-platform complexity

3. What is the performance impact?
   - Latency of DoH vs system DNS
   - Battery usage
   - Network overhead

4. Which DoH providers are reliable?
   - Cloudflare, Google, AdGuard
   - Response times, uptime
   - Blocking in restricted regions

**Recommended Actions**:

```typescript
// Research existing DoH solutions
// Option 1: React Native library (if exists)
import { DNSOverHTTPS } from 'react-native-doh';

const doh = new DNSOverHTTPS({
  provider: 'cloudflare',
  fallbackDns: ['1.1.1.1', '8.8.8.8'],
});

const ip = await doh.resolve('example.com');

// Option 2: Native module (recommended)
// Create custom native module
import { NativeModules } from 'react-native';

const { DNSModule } = NativeModules;

const ip = await DNSModule.resolve('example.com', {
  provider: 'cloudflare',
  timeout: 5000,
});

// Option 3: WebView-based DoH (fallback)
const dohResponse = await fetch(
  'https://cloudflare-dns.com/dns-query?name=example.com&type=A',
  {
    headers: { 'Accept': 'application/dns-json' },
  },
);
const dnsData = await dohResponse.json();
const ip = dnsData.Answer[0].data;
```

**Deliverables**:

- Survey of existing React Native DoH libraries
- Native module design document (Android + iOS)
- Proof-of-concept for DoH resolution
- Performance benchmarks (latency, battery)

---

### 5. Interceptor Pattern in React Native

**Current Knowledge Gap**:

- Unknown how to implement yokai-style interceptor chain in React Native
- Unknown performance implications of JavaScript-based interceptors

**Research Questions**:

1. How to implement request/response interceptors in React Native?
   - Custom wrapper around fetch()
   - Native module with OkHttp-like interceptors
   - Axios (has built-in interceptors)?

2. What are the performance implications?
   - JavaScript bridge overhead
   - Memory usage
   - Impact on request latency

3. Which libraries provide interceptor support?
   - Axios (built-in interceptors)
   - Ky (lightweight, modern)
   - Custom fetch wrapper

4. How to support both sync and async interceptors?
   - Async/await support
   - Promise-based API
   - Error handling

**Recommended Actions**:

```typescript
// Test different interceptor implementations

// Option 1: Axios (built-in interceptors)
import axios from 'axios';

const client = axios.create();

// Request interceptor
client.interceptors.request.use(
  config => {
    // Add headers, modify request
    config.headers['User-Agent'] = 'MyApp/1.0';
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor
client.interceptors.response.use(
  response => {
    // Modify response
    return response;
  },
  error => {
    // Handle errors
    if (error.response?.status === 403) {
      // Cloudflare bypass
    }
    return Promise.reject(error);
  },
);

// Option 2: Custom fetch wrapper
class HttpClient {
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  addRequestInterceptor(interceptor: RequestInterceptor) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: ResponseInterceptor) {
    this.responseInterceptors.push(interceptor);
  }

  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      const result = await interceptor(url, options);
      url = result.url ?? url;
      options = result.options ?? options;
    }

    // Make request
    let response = await fetch(url, options);

    // Apply response interceptors
    for (const interceptor of this.responseInterceptors) {
      response = await interceptor(response);
    }

    return response;
  }
}

// Option 3: Ky (modern, lightweight)
import ky from 'ky';

const client = ky.create({
  hooks: {
    beforeRequest: [
      request => {
        request.headers.set('User-Agent', 'MyApp/1.0');
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (response.status === 403) {
          // Cloudflare bypass
        }
        return new Response(response.body, response);
      },
    ],
  },
});
```

**Deliverables**:

- Comparison of interceptor libraries (Axios, Ky, custom)
- Performance benchmarks (request latency, memory)
- Recommendation for LNReader (with justification)
- Proof-of-concept implementation

---

## Medium-Priority Research Areas

### 6. Cookie Security & Encryption

**Research Questions**:

1. How does yokai handle secure cookies?
   - Secure flag (HTTPS only)
   - HttpOnly flag (not accessible via JavaScript)
   - SameSite attribute (CSRF protection)

2. What encryption options are available in React Native?
   - AsyncStorage (unencrypted)
   - Encrypted AsyncStorage
   - SecureStore (iOS)
   - EncryptedSharedPreferences (Android)

3. What are the security best practices?
   - Encrypt sensitive cookies (session tokens)
   - Use secure keychain/keystore
   - Clear cookies on logout
   - Handle cookie expiry

**Recommended Actions**:

- Research encryption libraries (react-native-encrypted-storage, expo-secure-store)
- Test cookie encryption flow
- Document security implications of different approaches

---

### 7. Performance Optimization

**Research Questions**:

1. What is the performance impact of cookie persistence?
   - Read/write speed (AsyncStorage vs native module)
   - Impact on request latency
   - Memory usage

2. How to optimize cookie storage?
   - In-memory cache for frequent reads
   - Lazy loading
   - Cookie compression

3. How to optimize WebView usage?
   - WebView pooling
   - Preload WebView on app startup
   - Hide vs destroy after use

**Recommended Actions**:

- Benchmark cookie read/write performance
- Test WebView initialization time
- Profile memory usage
- Document optimization strategies

---

### 8. Cross-Platform Considerations

**Research Questions**:

1. How do cookie APIs differ between Android and iOS?
   - Android: CookieManager
   - iOS: HTTPCookieStorage
   - API compatibility

2. What are the platform-specific limitations?
   - iOS cookie sharing between apps (Safari)
   - Android cookie isolation per app
   - WebView differences

3. How to handle cross-platform features?
   - Conditional code per platform
   - Abstract API differences
   - Feature detection

**Recommended Actions**:

- Document Android vs iOS cookie API differences
- Test cross-platform cookie persistence
- Document platform-specific limitations

---

## Low-Priority Research Areas

### 9. Alternative HTTP Libraries

**Research Questions**:

1. What alternatives to fetch() exist in React Native?
   - Axios
   - Ky
   - Superagent
   - got

2. Which libraries provide yokai-like features?
   - Interceptors
   - Progress tracking
   - Retry logic
   - Cookie handling

3. What are the tradeoffs?
   - Bundle size
   - Performance
   - Maintenance status

**Recommended Actions**:

- Survey HTTP libraries
- Compare feature sets
- Benchmark performance
- Evaluate bundle size impact

---

### 10. Testing Strategies

**Research Questions**:

1. How to test cookie persistence?
   - Unit tests (mock CookieManager)
   - Integration tests (real app)
   - E2E tests (automation)

2. How to test Cloudflare bypass?
   - Mock Cloudflare challenges
   - Test with real Cloudflare-protected sites
   - Performance testing

3. How to test DoH resolution?
   - Mock DNS responses
   - Test with real DoH providers
   - Latency testing

**Recommended Actions**:

- Design test strategy for cookie management
- Design test strategy for Cloudflare bypass
- Design test strategy for DoH resolution
- Create test harness/mocks

---

## Research Timeline

### Week 1: High-Priority Research

- Day 1-2: Cookie persistence libraries survey
- Day 3-4: WebView cookie integration testing
- Day 5: Cloudflare bypass proof-of-concept

### Week 2: Medium-Priority Research

- Day 1-2: Cookie security & encryption
- Day 3-4: Performance optimization
- Day 5: Cross-platform considerations

### Week 3: Low-Priority & Testing

- Day 1-2: Alternative HTTP libraries
- Day 3-5: Testing strategies & test harness

---

## Deliverables

### Phase 1: Research Reports

- [ ] Cookie management libraries comparison matrix
- [ ] WebView cookie integration proof-of-concept
- [ ] Cloudflare bypass proof-of-concept
- [ ] DoH libraries survey
- [ ] Interceptor library comparison

### Phase 2: Recommendations

- [ ] Cookie persistence recommendation for LNReader
- [ ] Cloudflare bypass implementation plan
- [ ] DoH implementation plan
- [ ] Interceptor pattern recommendation

### Phase 3: Testing Strategy

- [ ] Test design for cookie management
- [ ] Test design for Cloudflare bypass
- [ ] Test design for DoH resolution
- [ ] Mock infrastructure for testing

---

## Decision Points

After completing further research, these decisions need to be made:

1. **Cookie Persistence Approach**
   - Use existing library or build custom native module?
   - Which library (if using existing)?
   - Encryption strategy?

2. **Cloudflare Bypass Approach**
   - Background WebView (hidden) or visible WebView (modal)?
   - Automatic detection or manual trigger?
   - Timeout and retry strategy?

3. **DoH Approach**
   - Implement DoH or defer to Phase 3?
   - Which providers to support (minimum vs comprehensive)?
   - Native module or WebView-based fallback?

4. **Interceptor Library**
   - Use Axios, Ky, or custom fetch wrapper?
   - Native module or JavaScript-only?
   - Feature set (minimum vs comprehensive)?

---

## Conclusion

This research document identifies **10 areas requiring further investigation** before implementing yokai-style network and cookie handling in LNReader.

**Highest Priority** (should be completed before implementation):

1. Cookie persistence library survey
2. WebView cookie integration testing
3. Cloudflare bypass proof-of-concept

**Medium Priority** (important but can be investigated during implementation): 4. DoH libraries survey 5. Interceptor pattern testing 6. Cookie security & encryption

**Low Priority** (nice-to-have): 7. Performance optimization 8. Cross-platform considerations 9. Alternative HTTP libraries 10. Testing strategies

**Estimated Research Time**: 3 weeks (full-time)

**Next Step**: Begin Phase 1 (High-Priority Research) with cookie persistence libraries survey.

---

## References

- [Yokai Repository](https://github.com/null2264/yokai)
- [React Native Documentation](https://reactnative.dev/docs/network)
- [React Native WebView](https://github.com/react-native-webview/react-native-webview)
- [OkHttp Documentation](https://square.github.io/okhttp/)
- [Cookie Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [DNS over HTTPS RFC](https://datatracker.ietf.org/doc/html/rfc8484)
