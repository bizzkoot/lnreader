## Known Issue (Unresolved): toggle still cannot be enabled (default + local EPUB)

### Status
- **Observed**: The toggle **“Use settings for this novel”** still cannot be enabled in reader mode.
- **Applies to**:
  - Default novel reader (library/normal novels)
  - Local novel reader (EPUB)
- **Expected**: tapping the switch flips it to ON and persists per-novel settings.
- **Actual**: the switch does not stay ON (remains OFF / returns to OFF).

### Reproduction steps
Default reader:
1. Open any novel in the reader.
2. Open the bottom sheet.
3. Open the TTS tab.
4. Tap **“Use settings for this novel”**.

Local EPUB reader:
1. Open any local EPUB.
2. Open the bottom sheet.
3. Open the TTS tab.
4. Tap **“Use settings for this novel”**.

### Notes
- This suggests the earlier `novelId` guard fix was not sufficient.
- Per-novel settings currently require a stable numeric `novelId` (MMKV key: `NOVEL_TTS_SETTINGS_${novelId}`).

### Confirmed evidence (device logs)
Dev-only logs added in `ReaderTTSTab` confirm the toggle is being blocked because `novelId` is not available in this screen/runtime context:
- `[ReaderTTSTab][NovelTTS] novelId changed {novelId: undefined, type: 'undefined'}`
- `[ReaderTTSTab][NovelTTS] toggle blocked: invalid novelId {novelId: undefined, type: 'undefined'}`

This means the per-novel settings UI is currently rendered in scenarios where the reader context does not provide a novel identifier.

### Hypotheses to validate
1. `novelId` is missing/invalid in these reader contexts.
2. Local EPUB uses a different identifier type (URI/hash/local id).
3. Another state sync overwrites the toggle after user interaction.
4. Tap handler isn’t firing due to touch interception.

With the logs above, (1) is effectively confirmed for at least some reader sessions.

### Ideas to resolve (design/implementation options)
Because the current storage key is `NOVEL_TTS_SETTINGS_${novelId}`, the feature cannot work unless we can map “what’s being read” to a stable id.

Option A — **Disable/hide the toggle when `novelId` is unavailable**
- Behavior: show the toggle only when `typeof novelId === 'number'`.
- Pros: simple, avoids misleading UX.
- Cons: users cannot get per-item settings for local EPUB (or any reader mode lacking `novelId`).

Option B — **Support per-item settings for local EPUB via a dedicated id + key space**
- Introduce a stable `localBookId` / file-hash-based identifier for EPUB reader.
- Store under a separate key, e.g. `LOCAL_TTS_SETTINGS_${localBookId}`.
- Update runtime application to use the appropriate key depending on reader mode.

Option C — **Fix the reader context plumbing so `ReaderTTSTab` always has `novelId` for library novels**
- If this is a library novel path, then `novelId` being undefined indicates a context/prop wiring issue.
- Find the source of `novel` in `useChapter` / `ChapterContextProvider` and ensure it’s set before the bottom sheet renders the TTS tab, or pass `novelId` explicitly.

### Next investigation checklist (for later)
- Verify whether the toggle’s `onValueChange` fires on tap.
- Verify what identifier is available in `ReaderTTSTab` for default vs EPUB.
- Verify whether the MMKV write path is reached on tap.
- Decide UX/architecture: disable toggle when no id vs support alternate key for EPUB.

### Immediate next step (recommended)
- Trace why `novel`/`novelId` is `undefined` in `ReaderTTSTab` during default reader sessions, and wire a reliable id into the bottom sheet context.
# Custom TTS Settings (Per Novel)

## Objective
Allow readers to override Text-to-Speech (TTS) settings **per novel**.

- When **disabled**, the reader uses the global reader TTS settings.
- When **enabled** for a specific novel, the reader uses a novel-specific TTS profile (voice/rate/pitch) and persists it.

This spec documents the current implementation, the on-device bug where the toggle could not be enabled, and the minimal fix.

## Current implementation

### Storage model
- Per-novel settings are stored in MMKV as a JSON object.
- Key format:
  - `NOVEL_TTS_SETTINGS_${novelId}`
- Schema:
  - `enabled: boolean`
  - `tts: { voice?: Voice; rate?: number; pitch?: number }`

Source:
- [src/services/tts/novelTtsSettings.ts](src/services/tts/novelTtsSettings.ts)

### Where settings are edited (UI)
The toggle and controls live in the reader bottom sheet TTS tab:
- [src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx](src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx)

Key state:
- `useNovelTtsSettings` (local React state) controls the toggle UI.
- When toggled on/off, it writes to MMKV via `setNovelTtsSettings`.

### Where settings are applied (runtime)
Per-novel overrides are applied during reader load and novel/chapter changes:
- [src/screens/reader/components/WebViewReader.tsx](src/screens/reader/components/WebViewReader.tsx)

Logic summary:
- Read `getNovelTtsSettings(novel.id)`.
- If `stored.enabled && stored.tts`, merge into the active reader settings and apply to WebView.

## Bug: Toggle “Use settings for this novel” can’t be enabled on-device

### Symptom
On-device, tapping the toggle **does not stick**—it immediately flips back off (or appears impossible to turn on).

### Root cause
In [ReaderTTSTab.tsx](src/screens/reader/components/ReaderBottomSheet/ReaderTTSTab.tsx), a `useEffect` synchronizes local UI state from storage based on `novelId`:

- If `novelId` is falsy, the effect runs:
  - `setUseNovelTtsSettings(false)`

On-device, `novelId` can be **transiently falsy** during context initialization/remount timing, which causes the effect to **force-reset** the toggle back to `false` even after a user taps it.

Important: the custom `Switch` component is not the cause (it simply calls `onPress` → `onValueChange`). The reset is coming from state synchronization.

### Minimal fix
Do **not** force-reset the toggle to false when `novelId` is missing transiently.

Instead, only synchronize from storage when `novelId` is a valid number.

Implementation change:
- Replace:
  - `if (!novelId) { setUseNovelTtsSettings(false); return; }`
- With:
  - `if (typeof novelId !== 'number') return;`

This preserves the last UI state during transient `novelId` gaps and prevents the “can’t enable” behavior.

## Current limitations
1. **Non-reactive MMKV reads for this feature**
   - `ReaderTTSTab.tsx` uses `getNovelTtsSettings()` inside an effect.
   - This does not subscribe to MMKV key changes. It only refreshes on mount and on `novelId` changes.

2. **Cross-surface sync is best-effort**
   - If novel TTS settings are edited elsewhere in the future, the UI won’t automatically reflect changes unless it remounts or the novelId changes.

3. **Stale per-novel keys can exist until cleanup**
  - If a novel is removed from the library but not purged from the database, the novel-scoped key can remain.
  - This is safe (no crash) because the reader only reads the key when a valid `novelId` exists.
  - For cleanliness, we delete `NOVEL_TTS_SETTINGS_${novelId}` when the novel is purged (cached novel deletion / migration).

## How to achieve the objective (end-to-end)
1. User enables "Use settings for this novel".
2. App writes `enabled: true` and a baseline `tts` object to `NOVEL_TTS_SETTINGS_${novelId}`.
3. When the reader loads/changes chapters, `WebViewReader` checks the key.
4. If enabled, overrides are merged into active reader settings and pushed into the WebView.

## Next iteration (recommended)
1. Make the toggle and novel-specific UI fully reactive to MMKV updates:
   - Subscribe to `NOVEL_TTS_SETTINGS_${novelId}` using `useMMKVString` (or a dedicated persisted hook).
   - Derive `useNovelTtsSettings` from storage rather than duplicating it in local state.

2. Add manual regression checklist:
   - Enable per-novel toggle → close/reopen bottom sheet → verify still enabled.
   - Change chapter within same novel → verify kept.
   - Switch to another novel → verify different stored enabled state.

3. Optional: Add unit tests around `novelTtsSettings` helpers and integration test for the effect guard.

## Backup / restore behavior
- Per-novel TTS settings are stored in MMKV, so they are included as part of “Settings” backups unless the user disables settings in backup include options.
- If a backup is restored on a device missing some novels, the stale per-novel TTS keys are harmless and will be ignored until a matching novelId exists.
