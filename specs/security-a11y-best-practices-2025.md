# LNReader Security & Accessibility Best Practices (2024–2025)

Goal: A concise, repo-mappable checklist for hardening LNReader’s WebView reader + JS bridge, secrets/config handling under Expo/EAS, and baseline mobile accessibility. This is written as **do/don’t** items that you can turn into issues.

Scope touchpoints (examples in this repo):
- WebView reader + postMessage bridge: `src/**/WebView*`, reader screens, TTS bridge/injection helpers
- Secrets/config: `.env*`, `scripts/generate-env-file.cjs`, `app.json`, `android/**`, CI that writes env files
- Mobile security & testing: OWASP MASVS/MASTG mapping
- Accessibility: `src/screens/settings/SettingsReaderScreen/tabs/AccessibilityTab.tsx`, RN components, WebView content

---

## 1) WebView Security (react-native-webview)

### 1.1 Origin & navigation controls

**DO**
- **Allowlist** loaded origins using `originWhitelist` (and prefer the smallest set possible). If you’re loading local HTML, use a tight allowlist (e.g., `about:blank` + internal schemes you control) rather than `['*']`.
- Restrict navigation with `onShouldStartLoadWithRequest` to prevent untrusted external loads (block `http:` entirely; allow `https:` only for explicitly known hosts).
- Treat **any** URL or HTML coming from book content as untrusted input; keep the WebView sandboxed from app secrets.

**DON’T**
- Don’t allow arbitrary navigation by leaving `originWhitelist={['*']}` (or effectively equivalent) on screens that render untrusted book content.
- Don’t rely on in-WebView checks alone; enforce host/scheme rules on the native side (React Native side).

Repo mapping
- Reader WebView components/screens: search for `originWhitelist`, `onShouldStartLoadWithRequest`, `source={{ html }}`.

Sources
- React Native WebView docs (Guide): https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md

### 1.2 JS injection: `injectedJavaScript` / `injectJavaScript`

**DO**
- Keep injected JS minimal and deterministic; treat it like executing code in a hostile environment.
- Ensure injected scripts return `true` (some WebView injection paths rely on this to avoid silent failures).
- When possible, prefer **prebuilt** scripts you fully control (no string concatenation with untrusted values).

**DON’T**
- Don’t inject strings built from book content (HTML, chapter titles, etc.) without robust escaping/serialization.

Repo mapping
- Injection helpers (e.g., `safeInjectJS`) and any places calling `injectJavaScript`.

Sources
- React Native WebView docs (Guide): https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md

### 1.3 postMessage bridge hardening (`window.ReactNativeWebView.postMessage` / `onMessage`)

**DO**
- Treat `onMessage` payloads as untrusted. Parse with strict schema validation.
- Require a **message type** field and validate allowed types (drop everything else).
- Include a per-session **nonce/token** or per-load random ID in messages to reduce cross-frame/cross-page spoofing.
- Rate-limit or ignore bursts (prevents DoS-style message floods).

**DON’T**
- Don’t accept arbitrary JSON and dispatch on loose keys (e.g., `if (data.action) doStuff`).
- Don’t expose high-privilege native actions (file access, navigation, auth actions) directly to the WebView bridge without explicit user intent checks.

Repo mapping
- Any `onMessage` handlers on WebViews (reader/TTS highlight bridge).

Sources
- React Native WebView docs (Guide): https://github.com/react-native-webview/react-native-webview/blob/master/docs/Guide.md
- OWASP MASVS/MASTG (WebView/JS bridge risks are covered in the mobile testing/weakness ecosystem): https://mas.owasp.org/

---

## 2) Secrets & Configuration (Expo + EAS)

### 2.1 Client-exposed env vars (Expo)

**DO**
- Use `EXPO_PUBLIC_` only for values that are safe to be public (feature flags, public endpoints).
- Reference env vars **statically** as `process.env.EXPO_PUBLIC_FOO`.
- Keep `.env.local` and developer-specific `.env.*` files out of git.

**DON’T**
- Don’t put API keys, service account credentials, signing keys, or tokens in `EXPO_PUBLIC_` variables—these end up in the client bundle.
- Don’t assume EAS “secret” classification makes a value safe if you embed it into the app at build time.

Repo mapping
- `.env*`, `scripts/generate-env-file.cjs`, any `process.env.EXPO_PUBLIC_` usage.

Sources
- Expo Environment Variables (updated 2025-07-10): https://docs.expo.dev/guides/environment-variables/

### 2.2 EAS environment variables & secrets

**DO**
- Use EAS environment variables with the correct visibility for build-time configuration.
- For sensitive files (like `google-services.json`), prefer EAS “file” environment variables and load them via config (`app.config.*`) so the file is present at build time without committing it.
- Align environments (development/preview/production) consistently across builds and updates.

**DON’T**
- Don’t assume “secret” values can’t be extracted from the final app; anything shipped to the client can be recovered.

Repo mapping
- `app.json` / `app.config.*`, Android Firebase integration (`android/app/google-services.json`), CI steps that provision config.

Sources
- EAS Environment variables (updated 2025-07-10): https://docs.expo.dev/build-reference/variables/

---

## 3) Android signing & Firebase config

### 3.1 App signing keys

**DO**
- Prefer Play App Signing (and keep your upload key safe).
- Keep keystore materials out of the repo; load signing configs via properties files or CI secrets.

**DON’T**
- Don’t hardcode keystore passwords/paths directly in Gradle files.

Repo mapping
- `android/app/build.gradle`, any referenced `keystore.properties` patterns, CI signing workflows.

Sources
- Android Developers: Sign your app (updated 2025-01-24): https://developer.android.com/studio/publish/app-signing

### 3.2 Firebase `google-services.json`

**DO**
- Place `google-services.json` in the Android app module per Firebase setup guidance.
- Keep it out of git if your process treats it as sensitive/configurable; provision via CI/EAS file env when needed.

**DON’T**
- Don’t commit configuration files containing project identifiers if your org policy forbids it; manage through your build pipeline instead.

Repo mapping
- `android/app/google-services.json` and Gradle plugin usage.

Sources
- Firebase Android setup (updated 2025-12-08): https://firebase.google.com/docs/android/setup

---

## 4) OWASP Mobile Top 10 (2024) + MASVS mapping (practical)

Use this section to turn security work into concrete issues. Categories below are from OWASP Mobile Top 10 2024.

**M4 Insufficient Input/Output Validation (highly relevant to WebView + bridge)**
- DO validate incoming WebView messages and any HTML/content-derived values before using them in native logic.
- DO sanitize/escape any values that get injected into HTML/JS.

**M1 Improper Credential Usage / Hardcoded secrets risk**
- DO ensure no secrets ship via `EXPO_PUBLIC_` or committed files.

**M5 Insecure Communication**
- DO enforce HTTPS for any remote content; forbid cleartext traffic.

**M8 Security Misconfiguration**
- DO keep production builds locked down (no debug WebView settings, no overly broad origin allowlists).

Sources
- OWASP Mobile Top 10 2024 (Final Release): https://owasp.org/www-project-mobile-top-10/
- OWASP MAS (MASVS/MASTG ecosystem): https://mas.owasp.org/

---

## 5) Accessibility baseline (WCAG 2.2 + React Native)

### 5.1 React Native accessibility props

**DO**
- Provide `accessibilityLabel`, `accessibilityRole`, and `accessibilityHint` for interactive controls.
- Ensure focus order makes sense (TalkBack/VoiceOver); avoid trapping focus.
- Test with VoiceOver (iOS) and TalkBack (Android) on key flows (reader controls, TTS controls, settings).

**DON’T**
- Don’t rely on visual-only indicators for state (e.g., highlight without announcing mode/state changes).

Repo mapping
- Settings accessibility tab and reader/TTS UI components.

Sources
- React Native Accessibility docs (updated 2025-10-08): https://reactnative.dev/docs/accessibility

### 5.2 WCAG alignment (mobile)

**DO**
- Treat WCAG 2.2 as baseline guidance for perceivable/operable/understandable/robust UI.
- Use the WCAG Quick Reference to convert requirements into testable checks (labels, contrast, target sizes, motion, etc.).

Sources
- W3C WCAG Overview (updated 2025-10-20): https://www.w3.org/WAI/standards-guidelines/wcag/

---

## 6) Quick “Actionable Issues” list (copy/paste)

- WebView: tighten `originWhitelist` and block unknown navigation via `onShouldStartLoadWithRequest`.
- WebView: enforce strict schema validation + nonce for all `onMessage` payloads.
- Injection: stop any string-built JS injection that includes untrusted values; require safe serialization.
- Secrets: audit all `EXPO_PUBLIC_` usage to ensure no secrets; move sensitive values to server or EAS build-time config.
- Android: ensure signing credentials and keystore materials are never committed; load via CI secrets/properties.
- Firebase: decide policy for `google-services.json` (committed vs provisioned) and implement consistently.
- A11y: add/verify labels/roles/hints for reader + TTS controls; test with VoiceOver/TalkBack.
