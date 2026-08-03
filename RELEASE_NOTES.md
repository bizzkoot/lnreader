## What's New

This release introduces the **TTS Text Cleanup Pipeline** — a declarative, length-preserving text transformation system that refines every paragraph before it reaches the native TTS engine across all playback paths. Readers can now define ordered find/replace and regex strip rules, build a phonetic pronunciation dictionary with whole-word or substring matching, apply optional Unicode normalization, and configure per-novel overrides — all surfaced through a brand-new cleanup editor with built-in presets and JSON import/export.

### ✨ Features

- **Declarative Text Cleanup Pipeline:** Ordered find/replace + regex strip rules, phonetic pronunciation dictionary (whole-word/substring match), optional Unicode normalization (NFD + strip combining marks) — applied across ALL playback paths (initial queue, WebView tts-queue refills, fallback single-speak)
- **Per-Novel Overrides:** Novels can define their own cleanup rules that take precedence over global settings when per-novel TTS is enabled, with effective settings resolved automatically via `resolveEffectiveTtsCleanup()`
- **Cleanup Editor Enhancements:** Rule reordering, substring match mode, built-in presets, and JSON import/export for easy rule sharing and backup
- **New TTS Text Cleanup Modal:** Full management UI in Reader Bottom Sheet → TTS Tab ("Text Cleanup" section) and global Settings → Reader → Accessibility Tab

### 🛡️ Robustness & Safety

- **Regex Safety Hardening:** 200-char length cap, catastrophic-backtracking shape detection, compile-time try/catch, literal replacement semantics (`$&` stays literal), sticky `y` flag dropped
- **Length-Preserving Design:** Cleanup never alters paragraph counts, keeping the RN ↔ WebView paragraph index contract fully intact
- **Stable Sync Wiring:** MMKV listener deps include a stable sync callback; cleanup wiring verified via controller integration tests

### 📜 Commits

- **Core Updates**: Implemented the declarative, length-preserving TTS text cleanup pipeline in `htmlParagraphExtractor.ts` (+350 lines), applied uniformly across initial queue, WebView tts-queue refills, and fallback single-speak paths
- **Rule Engine**: Added ordered find/replace + regex strip rules with literal or regex matching, phonetic pronunciation dictionary (whole-word/substring), optional Unicode normalization, and regex safety hardening (length caps, backtracking detection, literal replacement semantics)
- **Per-Novel Overrides**: Added per-novel text cleanup overrides with automatic effective-settings resolution, keeping the global ↔ per-novel hierarchy predictable
- **Editor & Presets**: Built the TtsTextCleanupModal (+851 lines) with rule reordering, substring mode, built-in presets (+312 lines), and JSON import/export
- **Testing & Quality**: Added wiring assertions in controller integration tests (+29 lines), cleanup preset tests (+322 lines), and text cleanup unit tests (+344 lines); resolved remaining exhaustive-deps warnings and addressed audit findings

**Full Changelog**: https://github.com/bizzkoot/lnreader/compare/v2.1.2...v2.1.3
