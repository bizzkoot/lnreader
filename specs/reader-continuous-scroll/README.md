# Documentation Index: Continuous Scrolling Feature

**Last Updated**: December 20, 2024 23:55 GMT+8  
**Status**: Phase 4 - Bug Fixes In Progress

---

## Quick Start - For Next Session

**START HERE**: Read [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) first!

This gives you immediate context about what's broken, what I did this session, and what to do next.

---

## Document Guide

### 1. SESSION_HANDOFF.md ⭐ **READ THIS FIRST**

**Purpose**: Quick session resumption guide  
**Use when**: Starting a new session, need immediate context  

**Contains**:
- What's broken RIGHT NOW (boundary mismatch bug)
- Critical dev build caching issue
- What I did this session (debug logs added)
- What user needs to do next (clean rebuild + test)
- 3 hypotheses for root cause
- Expected log patterns (correct vs wrong)
- Quick reference - boundary structure
- Critical lessons learned

**Best for**: Getting up to speed in 5 minutes

---

### 2. DEBUG_CHECKLIST.md 🔍 **USE DURING TESTING**

**Purpose**: Step-by-step log analysis guide  
**Use when**: User provides test logs, need to diagnose bug  

**Contains**:
- Step 1: Check boundary calculation (during append)
- Step 2: Check all boundaries (during scroll)
- Step 3: Check boundary matching (paragraph 222)
- Step 4: Check trim trigger (paragraph 250)
- Decision tree flowchart
- Expected vs wrong log patterns
- Exact values to look for

**Best for**: Quickly identifying which fix is needed based on logs

---

### 3. IMPLEMENTATION_PLAN.md 📚 **COMPREHENSIVE REFERENCE**

**Purpose**: Full feature documentation with architecture and history  
**Use when**: Need deep understanding, reviewing wrong approaches, checking implementation details  

**Contains**:
- Executive summary (status, working features, in-progress)
- Architecture overview (how stitching works)
- ❌ **WRONG APPROACHES** section (4 major mistakes documented)
- Implementation details (5 sections):
  1. DOM Stitching ✅
  2. MMKV Unread Bug Fix ✅
  3. TTS Stitched Chapter Clearing 🔧
  4. DOM Auto-Trim 🔧
  5. Boundary Tracking
- Files modified table
- Next steps (priority order)
- Testing checklist
- Lessons learned
- **UPDATE 1**: DOM trim calculation fix (Dec 20, 22:30)
- **UPDATE 2**: Boundary mismatch root cause discovery (Dec 20, 23:45)

**Best for**: Understanding full context, learning from mistakes, checking implementation

---

### 4. READER_ENHANCEMENTS.md 📖 **FEATURE OVERVIEW**

**Purpose**: High-level feature design and requirements  
**Use when**: Need to understand feature goals, user experience, settings  

**Contains**:
- Feature goals
- User experience flow
- Settings (boundary modes, threshold)
- Technical requirements
- Edge cases to handle

**Best for**: Understanding WHAT we're building and WHY

---

### 5. TASKS.md ✅ **TASK TRACKING**

**Purpose**: Track implementation progress  
**Use when**: Need to see what's done, what's next  

**Contains**:
- Phase breakdown (1-6)
- Task status (✅ complete, 🔧 in progress, ⏸️ blocked)
- Current blockers
- Testing requirements

**Best for**: Quick status overview

---

## Recommended Reading Order

### 🚀 Quick Resume (5 min):
1. Read [SESSION_HANDOFF.md](./SESSION_HANDOFF.md)
2. Wait for user logs
3. Use [DEBUG_CHECKLIST.md](./DEBUG_CHECKLIST.md) to analyze

### 📚 Deep Dive (30 min):
1. Read [SESSION_HANDOFF.md](./SESSION_HANDOFF.md)
2. Skim [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) "WRONG APPROACHES" section
3. Read [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) "UPDATE 2" section
4. Check [DEBUG_CHECKLIST.md](./DEBUG_CHECKLIST.md) for log patterns
5. Reference [TASKS.md](./TASKS.md) for task status

### 🎯 First Time Reading (1 hour):
1. Read [READER_ENHANCEMENTS.md](./READER_ENHANCEMENTS.md) - Understand goals
2. Read [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Architecture + history
3. Read [SESSION_HANDOFF.md](./SESSION_HANDOFF.md) - Current state
4. Bookmark [DEBUG_CHECKLIST.md](./DEBUG_CHECKLIST.md) - Use during testing
5. Reference [TASKS.md](./TASKS.md) - Track progress

---

## File Locations

All documentation in: `specs/reader-continuous-scroll/`

```
specs/reader-continuous-scroll/
├── SESSION_HANDOFF.md       ← ⭐ START HERE
├── DEBUG_CHECKLIST.md        ← 🔍 USE DURING TESTING
├── IMPLEMENTATION_PLAN.md    ← 📚 COMPREHENSIVE REFERENCE
├── READER_ENHANCEMENTS.md    ← 📖 FEATURE OVERVIEW
└── TASKS.md                  ← ✅ TASK TRACKING
```

---

## Key Code Locations

### Primary File:
**`android/app/src/main/assets/js/core.js`** (3200 lines)
- Lines 236-318: `receiveChapterContent()` - Append chapter, calculate boundaries
- Lines 290-305: **NEW DEBUG LOGS** - Boundary calculation
- Lines 359-457: `clearStitchedChapters()` - TTS clearing logic
- Lines 459-510: `trimPreviousChapter()` - Remove first chapter
- Lines 515-630: `manageStitchedChapters()` - Auto-trim controller
- Lines 589-595: **NEW DEBUG LOGS** - All boundaries display

### Supporting Files:
- `src/screens/reader/components/WebViewReader.tsx`: React Native side
  - Lines 143-150: Refs fix (WebView persistence)
  - Lines 663-694: `fetch-chapter-content` handler
  - Lines 787-855: `stitched-chapters-cleared` handler
- `src/database/queries/ChapterQueries.ts`: MMKV unread fix
  - Lines 84-89, 91-98, 103-117, 203-221: 4 functions with `MMKVStorage.delete()`

---

## Current Status Summary

**Phase**: 4 - Bug Fixes  
**Status**: 🔴 BLOCKED - Awaiting user testing

**Working** ✅:
- DOM stitching (chapters append)
- WebView persistence (same reader ID)
- MMKV unread bug fixed
- Boundary display correct
- TTS clearing rewritten (not tested)
- Trim calculation logic correct

**Broken** 🔴:
- DOM trim not triggering (paragraphs 214+ not matching boundary 1)
- Root cause: Boundary calculation or matching logic bug
- Debug logs added, awaiting user test results

**Next**: User clean rebuild → Test → Provide logs → Analyze → Fix → Test → Verify

---

## Memory Bank Status

**Updated**: December 20, 2024 23:50 GMT+8

**Active Context**: Investigating boundary mismatch bug - paragraphs 214+ not matching boundary 1, causing trim check to never run.

**Progress**:
- Done: 7 items (WebView fix, boundary display, MMKV fix, TTS rewrite, trim calculation, docs, debug logs)
- Doing: 2 items (boundary investigation, awaiting user testing)
- Next: 6 items (analyze logs, fix bug, test TTS, test trim, settings UI, git commit)

**Decision Logged**: Added comprehensive debug logs instead of guessing at fixes, because user tested twice and both failed - logs reveal runtime behavior code review misses.

---

**Use this index** to navigate documentation efficiently based on your needs!
