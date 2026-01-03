# Personal Customizations to Exclude

**Document Purpose:** Identify all fork-specific customizations that should NOT be merged to upstream  
**Total Files to Exclude:** ~350 files  
**Total Lines to Exclude:** ~85,000 lines

---

## Category 1: AI Instruction Files (❌ EXCLUDE ALL)

### Directory: `.agents/`

**Purpose:** Personal AI agent memory and context  
**Files:** 50+ markdown files  
**Total Lines:** ~5,000

**Example Files:**

```
.agents/action-tracker/
.agents/auto-backup/
.agents/bluetooth-tts-controls/
.agents/feature-screen/
.agents/ui-scaling/
... (50+ more)
```

**Reason to Exclude:** These are personal development notes for AI assistants specific to your workflow.

---

### Directory: `memory-bank/`

**Purpose:** Persistent AI context across sessions  
**Files:** 20+ text files  
**Total Lines:** ~2,000

**Example Files:**

```
memory-bank/context.txt
memory-bank/recent-fixes.txt
memory-bank/tts-implementation.txt
... (20+ more)
```

**Reason to Exclude:** Personal AI memory system, not relevant to upstream.

---

### Root AI Files

**Files:**

- `AGENTS.md` - AI agent instructions
- `CLAUDE.md` - Claude-specific instructions
- `GEMINI.md` - Gemini-specific instructions
- `.serena/` - Personal AI config directory

**Total Lines:** ~1,500

**Reason to Exclude:** Fork-specific AI tooling instructions.

---

### GitHub Chat Modes

**Files:**

```
.github/architect.chatmode.md
.github/ask.chatmode.md
.github/code.chatmode.md
.github/debug.chatmode.md
```

**Total Lines:** ~800

**Reason to Exclude:** Personal GitHub Copilot chat mode configurations.

---

## Category 2: Extensive Specs Documentation (❌ EXCLUDE ALL)

### Directory: `specs/`

**Purpose:** Personal implementation tracking and planning docs  
**Files:** 150+ markdown files  
**Total Lines:** ~60,000

**Subdirectories to Exclude:**

```
specs/code-quality/                      # Personal audits
specs/custom-tts-settings/               # Personal TTS planning
specs/feature-requests/                  # Personal feature ideas
specs/network-cookie-handling/           # Already documented elsewhere
specs/reader-continuous-scroll/          # Personal implementation notes
specs/tts-*/                            # Multiple TTS planning docs
specs/UI-Scale/                         # Personal UI scaling docs
... (20+ subdirectories)
```

**Sample Files:**

```
specs/network-cookie-handling/
├── 01-INITIAL_REQUEST.md
├── 02-RESEARCH_FINDINGS.md
├── 03-COMPARISON_ANALYSIS.md
├── 04-CODE_SNIPPETS.md
├── 05-ARCHITECTURE.md
├── 06-SUMMARY.md
├── 07-FURTHER_RESEARCH.md
├── 08-PRD.md
├── 09-IMPLEMENTATION-PLAN.md
├── 10-CLOUDFLARE-BYPASS-RESEARCH.md
├── 10-DOH-RESEARCH.md
├── 11-DOH-OKHTTP-ANALYSIS.md
├── PHASE2-COMPLETE.md
├── PHASE3-COMPLETE.md
├── PHASE3-DOH-PLAN.md
├── PHASE3-PROGRESS.md
├── SESSION5-TEST-PLAN.md
└── README.md
```

**Reason to Exclude:** These are personal development journals and planning documents. Upstream doesn't need your entire thought process—only the final implementation and user-facing documentation.

---

## Category 3: Fork-Specific Branding (❌ EXCLUDE)

### README.md Changes

**Lines to Remove:** ~400 lines of fork-specific content

**Changes to Exclude:**

1. **GitHub URLs:**

   ```diff
   - [GitHub](https://github.com/LNReader/lnreader)
   + [GitHub](https://github.com/bizzkoot/lnreader)
   ```

2. **Fork-Specific Feature Showcase:**
   - Extensive TTS feature descriptions (200+ lines)
   - UI scaling demonstrations
   - Personal screenshots/GIFs in `.github/readme-images/`
   - Fork-specific feature list

3. **Discord/Community Links:**
   - Links removed/changed to fork-specific channels

**What to Keep:**

- Generic feature descriptions (if applicable to upstream)
- Installation instructions (if not fork-specific)
- Contributing guidelines (if generic)

**Recommendation:** Revert `README.md` to upstream version, then add ONLY new features that were actually merged (not all fork features).

---

### Release Notes

**File:** `RELEASE_NOTES.md`

**Lines to Remove:** All fork-specific version history

**Reason to Exclude:** Upstream has its own release notes. Your fork's version history (v2.0.2 → v2.0.14) is irrelevant to upstream.

---

### FeaturesScreen Component

**File:** `src/screens/more/FeaturesScreen.tsx` (788 lines)

**Content:**

- Detailed TTS tutorial
- UI scaling guide
- Continuous scrolling guide
- Fork-specific feature showcase

**Merge Status:** 🔶 **CONDITIONAL**

**Options:**

1. ❌ **Exclude entirely** - Safest option
2. ✅ **Strip fork-specific content** - Keep generic "Feature Discovery" screen
3. 🔶 **Make it generic** - Show only features that exist in upstream after merge

**Recommendation:** If you merge Features screen, make it generate dynamically based on available features, not hardcoded fork features.

---

## Category 4: Personal Development Tools (❌ EXCLUDE)

### Scripts

**Files:**

```
scripts/extract-voice-data-final.js      # Personal TTS voice extraction
scripts/fix_atomic.js                    # Personal database fix
scripts/test_tts_fix.cjs                 # Personal TTS testing
scripts/tts_wake_cycle_test.js           # Personal TTS testing
```

**Reason to Exclude:** Personal development/debugging scripts, not production tooling.

**What to Keep:**

```
scripts/generate-env-file.cjs            # ✅ Generic build script
scripts/generate-string-types.cjs        # ✅ Generic type generation
scripts/run-tts-live-tests.sh            # 🔶 If TTS is merged
scripts/install-jest-types.sh            # ✅ Generic test setup
```

---

### Test Coverage Reports

**Files:**

```
coverage/coverage-summary.json
coverage/lcov-report/
```

**Reason to Exclude:** Generated files, not source code. CI/CD generates these fresh.

---

## Category 5: Personal Preference Features (❌ EXCLUDE from Initial Merge)

### Per-Novel TTS Settings

**Files:**

- `src/screens/reader/components/ReaderTTSTab.tsx` (788 lines)
- `src/hooks/useTTSController.ts` (modified for per-novel settings)
- Database migration: `003_add_tts_state.ts`

**Why Personal Preference:**

- Adds significant complexity (per-novel state management)
- Most users won't use (TTS is already niche)
- Opinionated feature design
- Requires database migration

**Recommendation:** Keep in fork, discuss with upstream maintainers before merging. They may prefer simpler global TTS settings.

---

### Extensive TTS Test Suite

**Files:** 45+ test files in `__tests__/` (13,000+ lines)

**Tests Include:**

- AutoStopService (3 test files, 800 lines)
- TTSAudioManager (5 test files, 1,200 lines)
- useTTSController (10 test files, 3,000 lines)
- TTS dialogs (6 test files, 1,500 lines)
- ... (25+ more test files)

**Why Exclude:**

- Overkill for upstream (45+ files is excessive)
- Most upstream users won't use TTS
- High maintenance burden
- Fork-specific TTS features won't be in upstream

**Recommendation:** If TTS media controls are merged, include basic tests only (~200 lines). Exclude 95% of test suite.

---

### TTS Auto-Stop Modes

**Files:**

- `src/services/tts/AutoStopService.ts` (300+ lines)
- Multiple test files (800+ lines)
- 6 different auto-stop modes

**Why Personal Preference:**

- Overly complex for most users
- Many configuration options (choice paralysis)
- Opinionated feature design

**Recommendation:** Exclude from initial merge. Discuss with upstream if they want basic auto-stop (e.g., "pause on screen off" only).

---

## Category 6: Documentation Consolidation (⚠️ NEEDS CLEANUP)

### Root Directory Files

**Current State:**

```
/ (root)
├── AGENTS.md                    # ❌ EXCLUDE
├── CLAUDE.md                    # ❌ EXCLUDE
├── GEMINI.md                    # ❌ EXCLUDE
├── RELEASE_NOTES.md             # ❌ EXCLUDE (fork versions)
├── CONTRIBUTING.md              # ✅ KEEP (generic improvements)
├── CONTRIBUTING-NIX.md          # ✅ KEEP
├── CODE_OF_CONDUCT.md           # ✅ KEEP
├── README.md                    # 🔶 REVERT TO UPSTREAM, then add merged features only
└── LICENSE                      # ✅ KEEP (unchanged)
```

---

### Docs Directory

**Current State:**

```
docs/
├── analysis/                    # ❌ EXCLUDE (personal refactoring plans)
├── integration/                 # ❌ EXCLUDE (personal integration notes)
├── TTS/                        # ❌ EXCLUDE (personal TTS design docs)
├── TEST_UPDATES_SUMMARY.md     # ✅ KEEP if generic
└── upstream-merge-analysis/    # ✅ KEEP (this analysis)
```

**Recommendation:** Delete `docs/analysis/`, `docs/integration/`, `docs/TTS/`. Keep only generic documentation.

---

## Category 7: Personal About/Settings Content (❌ EXCLUDE)

### About Screen Changes

**File:** `src/screens/more/AboutScreen.tsx`

**Changes to Exclude:**

- Fork-specific version numbers
- Links to fork GitHub (bizzkoot/lnreader)
- Links to fork Discord/community
- Fork-specific contributors

**Recommendation:** Revert to upstream version. Upstream will update this with their own info.

---

### Settings Screen Customizations

**Files:** Various settings screens

**Changes to Review:**

- Fork-specific default values (check each setting)
- Fork-specific setting descriptions
- Links to fork documentation

**Recommendation:** Ensure all settings use upstream defaults, not fork-specific preferences.

---

## Summary: Files to Exclude

### High-Level Exclusion List

```
# AI Instructions (❌ Exclude ALL)
.agents/                        # 50+ files
memory-bank/                    # 20+ files
.serena/                        # Personal AI config
AGENTS.md
CLAUDE.md
GEMINI.md
.github/*.chatmode.md           # 4 files

# Documentation (❌ Exclude ALL)
specs/                          # 150+ files, ~60k lines
docs/analysis/                  # Personal refactoring docs
docs/integration/               # Personal integration notes
docs/TTS/                       # Personal TTS design

# Branding (❌ Exclude or Modify)
README.md                       # 🔶 Revert to upstream + add only merged features
RELEASE_NOTES.md                # ❌ Exclude fork versions
src/screens/more/FeaturesScreen.tsx  # 🔶 Conditional (make generic or exclude)
src/screens/more/AboutScreen.tsx     # 🔶 Revert fork-specific links

# Personal Scripts (❌ Exclude)
scripts/extract-voice-data-final.js
scripts/fix_atomic.js
scripts/test_tts_fix.cjs
scripts/tts_wake_cycle_test.js

# Test Coverage (❌ Exclude - generated files)
coverage/

# Personal TTS Features (❌ Exclude from initial merge)
# (discuss separately with upstream)
- Per-novel TTS settings
- 45+ TTS test files (13k lines)
- TTS auto-stop modes (6 variants)
- Extensive TTS dialogs

# Personal Customizations (❌ Exclude)
- Force app exit on DoH change
- MMKV backup layer for DoH
- Fork-specific default settings
```

---

## Exclusion Implementation Plan

### Step 1: Create Clean Branch

```bash
# Create new branch from origin/original
git checkout origin/original
git checkout -b merge-to-upstream

# Cherry-pick only approved features (see 07-implementation-plans.md)
```

### Step 2: Automated Exclusion

```bash
# Delete AI instruction directories
rm -rf .agents/ memory-bank/ .serena/
rm -f AGENTS.md CLAUDE.md GEMINI.md
rm -f .github/*.chatmode.md

# Delete specs/ directory
rm -rf specs/

# Delete personal docs
rm -rf docs/analysis/ docs/integration/ docs/TTS/

# Delete personal scripts
rm -f scripts/extract-voice-data-final.js
rm -f scripts/fix_atomic.js
rm -f scripts/test_tts_fix.cjs
rm -f scripts/tts_wake_cycle_test.js

# Delete coverage reports
rm -rf coverage/
```

### Step 3: Manual Review

```bash
# Review and revert README.md
git checkout origin/original -- README.md
# Then manually add ONLY merged feature descriptions

# Review and revert AboutScreen
git checkout origin/original -- src/screens/more/AboutScreen.tsx

# Review FeaturesScreen (make generic or exclude)
# ... manual decision needed
```

### Step 4: Validate Exclusions

```bash
# Ensure no fork-specific references remain
rg -i "bizzkoot" --no-ignore     # Should find nothing
rg -i "v2\.0\.(3|4|5|6|7|8|9|10|11|12|13|14)" # Should find nothing (fork versions)
rg -i "specs/" src/              # Should find no spec references in code

# Ensure AI files are gone
ls .agents/                       # Should not exist
ls memory-bank/                   # Should not exist
```

---

## Rationale Summary

### Why Exclude AI Instruction Files?

- Personal workflow tools
- Not relevant to upstream users
- No value to other contributors
- Would clutter repository

### Why Exclude 150+ Spec Files?

- Personal development journals
- Already summarized in this analysis
- Upstream doesn't need your thought process
- Massive line count (+60k lines) for no benefit

### Why Exclude Fork Branding?

- Confuses upstream users
- Points to wrong GitHub repo
- Fork-specific version history irrelevant
- Upstream maintains own README/release notes

### Why Exclude Personal TTS Features?

- Overly opinionated design
- High complexity vs benefit
- 13k+ lines of tests for niche feature
- Should be discussed separately with upstream

### Why Exclude Personal Scripts?

- Development/debugging tools
- Not production tooling
- Upstream has own debugging workflows

---

## Post-Exclusion Checklist

Before merging to origin/original:

- [ ] No `.agents/` directory exists
- [ ] No `memory-bank/` directory exists
- [ ] No `AGENTS.md`, `CLAUDE.md`, `GEMINI.md` files
- [ ] No `.github/*.chatmode.md` files
- [ ] `specs/` directory removed or only contains upstream-merge-analysis
- [ ] `README.md` reverted to upstream + only merged features added
- [ ] `AboutScreen` has no fork links
- [ ] `FeaturesScreen` made generic or removed
- [ ] No `bizzkoot` references in code (except git history)
- [ ] No fork version numbers (v2.0.3-14) in user-facing text
- [ ] Personal scripts deleted
- [ ] Coverage reports deleted

---

## Estimated Line Reduction

| Category            | Lines Removed | Files Removed |
| ------------------- | ------------- | ------------- |
| AI Instructions     | ~10,000       | 80+           |
| Specs Documentation | ~60,000       | 150+          |
| Fork Branding       | ~5,000        | 5 (modified)  |
| Personal TTS Tests  | ~13,000       | 45+           |
| Personal Scripts    | ~2,000        | 10+           |
| **Total**           | **~90,000**   | **~290**      |

**Result:** Clean merge with ~45,000 lines of valuable features instead of 135,000 lines mixed with personal content.

---

**Next Document:** [07-implementation-plans.md](./07-implementation-plans.md) - Step-by-step merge instructions
