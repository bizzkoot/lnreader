# Initial Research Request

**Date**: January 1, 2026
**Research Subject**: yokai (null2264/yokai) codebase - Network & Cookie Handling
**Target Application**: LNReader (React Native)

---

## Research Request

Research the yokai (null2264/yokai) codebase to understand their network/cookie handling implementation. Focus on:

1. How do they handle HTTP requests and cookies?
2. Do they use WebView for cookie persistence?
3. What network libraries do they use (OkHttp, etc.)?
4. How do they handle authentication for source extensions?
5. Look for any DNS-related configurations or implementations

---

## Search Areas

### Primary Directories to Investigate

- `data/` - Network layer and data handling
- `source/api` - Extension API and source interface
- Any files related to HTTP, networking, or cookies

### Key File Locations Identified

- `core/main/src/androidMain/kotlin/eu/kanade/tachiyomi/network/` - Network implementation
  - `NetworkHelper.kt` - Main network manager
  - `AndroidCookieJar.kt` - Cookie persistence layer
  - `DohProviders.kt` - DNS over HTTPS configuration
  - `Requests.kt` - Request helper functions
  - `interceptor/` - Network interceptors
    - `CloudflareInterceptor.kt`
    - `WebViewInterceptor.kt`
    - `UserAgentInterceptor.kt`
- `source/api/src/commonMain/kotlin/eu/kanade/tachiyomi/source/online/HttpSource.kt` - Extension API

---

## Research Deliverables

### 1. Technical Analysis

- Comprehensive understanding of yokai's network architecture
- Cookie handling mechanisms and WebView integration
- Authentication strategies for source extensions
- DNS configuration and DoH provider support

### 2. Code Documentation

- Key code snippets demonstrating implementation patterns
- Architecture diagrams showing data flow
- Configuration examples

### 3. Comparison Framework

- Yokai (OkHttp) vs React Native fetch() feature comparison
- Gap analysis for LNReader implementation
- Recommendations for adaptation strategies

### 4. Implementation Guidance

- Suggestions for React Native native module development
- Feasibility assessment of porting patterns
- Potential challenges and mitigations

---

## Expected Output Format

### Summary Report Structure

1. **Executive Summary** - High-level overview and key findings
2. **Detailed Findings** - Technical analysis with code examples
3. **Comparison Table** - Feature-by-feature comparison
4. **Code Snippets** - Annotated implementation examples
5. **Architecture Diagrams** - Visual representation of system design
6. **Key Takeaways** - Actionable insights for LNReader
7. **Further Research** - Areas requiring additional investigation
8. **PRD** - Product Requirements Document for implementation

---

## Context for LNReader

### Current LNReader Architecture

- **Platform**: React Native 0.82.1
- **HTTP Client**: fetch() API (JavaScript layer)
- **Plugin System**: Dynamic JavaScript plugins loaded at runtime
- **Cookie Management**: No persistent cookie jar (manual implementation required)
- **WebView Integration**: WebViewReader component for reading interface
- **Native Layer**: Kotlin/Java for TTS, EPUB, and other platform features

### Research Motivation

LNReader faces challenges with:

1. **Cookie Persistence**: No automatic cookie synchronization between fetch() and WebView
2. **Cloudflare Bypass**: Limited ability to solve JavaScript challenges
3. **Authentication**: Manual cookie management required for plugin authentication
4. **DNS Configuration**: System DNS only (no DoH support for privacy/censorship bypass)

### Expected Benefits

- Improved plugin authentication reliability
- Better Cloudflare bypass capabilities
- Enhanced privacy through DoH
- Consistent cookie management across app and WebView

---

## Research Methodology

1. **Codebase Exploration**
   - Clone yokai repository
   - Identify relevant directories and files
   - Analyze key implementation files

2. **Architecture Analysis**
   - Document network layer design
   - Map cookie persistence flow
   - Trace authentication mechanisms

3. **Feature Extraction**
   - Extract code patterns and best practices
   - Identify reusable components
   - Document configuration options

4. **Gap Analysis**
   - Compare with React Native fetch() capabilities
   - Identify missing features in LNReader
   - Assess implementation feasibility

---

## Success Criteria

✅ Clear understanding of yokai's network architecture
✅ Documented cookie handling mechanisms
✅ Identified WebView integration patterns
✅ Mapped authentication strategies for extensions
✅ Documented DNS configuration and DoH providers
✅ Created comparison framework for React Native
✅ Provided actionable recommendations for LNReader

---

## Notes

- yokai is a Kotlin-based native Android app (not React Native)
- Focus on patterns that can be adapted to React Native
- Consider native module development for missing features
- Maintain LNReader's existing plugin system architecture
