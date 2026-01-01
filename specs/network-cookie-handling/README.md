# Yokai Network & Cookie Handling Research

**Repository**: null2264/yokai (Tachiyomi fork)
**Research Date**: January 1, 2026
**Purpose**: Understand native Android network architecture for React Native comparison

---

## 📚 Documentation Overview

This folder contains comprehensive research on yokai's network and cookie handling implementation, analyzed for potential application to LNReader (React Native).

### Document Structure

| File                        | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `01-INITIAL_REQUEST.md`     | Original research request and objectives                  |
| `02-RESEARCH_FINDINGS.md`   | Detailed technical findings from codebase analysis        |
| `03-COMPARISON_ANALYSIS.md` | Yokai (OkHttp) vs React Native fetch() comparison         |
| `04-CODE_SNIPPETS.md`       | Key code snippets and implementation examples             |
| `05-ARCHITECTURE.md`        | System architecture and data flow diagrams                |
| `06-SUMMARY.md`             | Executive summary and key takeaways                       |
| `07-FURTHER_RESEARCH.md`    | Suggested areas for additional investigation              |
| `08-PRD.md`                 | Product Requirements Document for LNReader implementation |

---

## 🎯 Research Objectives

1. **HTTP Requests & Network Layer**: Understand how yokai handles HTTP requests, caching, and network configuration
2. **Cookie Handling**: Analyze cookie persistence and synchronization mechanisms
3. **WebView Integration**: Determine how WebView is used for cookie persistence and authentication challenges
4. **Authentication**: Examine how source extensions handle authentication
5. **DNS Configuration**: Review DNS over HTTPS (DoH) implementation and provider support

---

## 📖 Key Findings Summary

### Network Architecture

- **Primary Library**: OkHttp 5.0.0-alpha.16 with interceptor-based architecture
- **Cookie Management**: AndroidCookieJar bridges OkHttp ↔ WebView via Android's CookieManager
- **WebView Integration**: Native interceptor architecture for Cloudflare bypass and authentication
- **DNS Support**: 12 DoH providers for privacy and censorship bypass

### Critical Differences vs React Native

| Aspect             | Yokai (Native Android)         | React Native                   |
| ------------------ | ------------------------------ | ------------------------------ |
| Cookie Persistence | Automatic via AndroidCookieJar | Manual implementation required |
| WebView Sync       | Native API integration         | Requires custom bridge         |
| DNS Configuration  | Built-in DoH with 12 providers | System DNS only                |
| Interceptors       | Modular chain architecture     | No built-in support            |

---

## 🔗 Quick Links

- [Research Findings](./02-RESEARCH_FINDINGS.md)
- [Comparison Analysis](./03-COMPARISON_ANALYSIS.md)
- [Code Snippets](./04-CODE_SNIPPETS.md)
- [Architecture Diagram](./05-ARCHITECTURE.md)
- [Summary](./06-SUMMARY.md)
- [Further Research](./07-FURTHER_RESEARCH.md)
- [PRD](./08-PRD.md)

---

## ⚠️ Important Notes

1. **Technology Stack**: Yokai is a Kotlin-based native Android app, not React Native
2. **Architecture**: Leverages native Android APIs (CookieManager, WebView) for seamless integration
3. **Extension System**: Source extensions share a single OkHttpClient instance via dependency injection
4. **Cloudflare Bypass**: WebView-based solution with automatic cookie synchronization

---

## 📊 Metrics

- **Total DoH Providers**: 12 (Cloudflare, Google, AdGuard, Quad9, AliDNS, DNSPod, 360, Quad101, Mullvad, Control D, Njalla, Shecan)
- **Cache Size**: 5 MiB disk cache with 10-minute default TTL
- **Timeout Configuration**: 30s connect/read, 2m call timeout
- **Supported Compression**: Gzip, Brotli

---

## 🔄 Next Steps

For implementation in LNReader (React Native), see:

1. [PRD](./08-PRD.md) for detailed requirements
2. [Further Research](./07-FURTHER_RESEARCH.md) for areas requiring additional investigation
3. [Comparison Analysis](./03-COMPARISON_ANALYSIS.md) for feature gap analysis
