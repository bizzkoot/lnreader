# Cross-Device Sync

## Goal

Implement opt-in sync layer using Google Drive AppData to synchronize reading progress, library state, and categories across devices. Uses existing backup infrastructure as foundation.

---

## User Review Required

> [!IMPORTANT]
> **Scope Decision**: Start with progress + library + categories. Settings sync is Phase 2.

> [!WARNING]
> **Breaking Change Risk**: If user has different novel IDs across devices (from separate installs), sync may not match correctly. We use source URL + novel URL as the canonical identifier.

---

## Proposed Changes

### Sync Domain Schema

#### [NEW] [types.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/sync/types.ts)

```typescript
/**
 * Sync Schema v1
 * 
 * Entities synchronized across devices with LWW (Last-Writer-Wins) conflict resolution.
 */

export const SYNC_SCHEMA_VERSION = 1;

/** Canonical novel identifier (stable across devices) */
export interface NovelKey {
  sourceId: number;
  novelUrl: string;  // URL path uniquely identifies novel in source
}

/** Chapter progress entity */
export interface SyncProgress {
  novelKey: NovelKey;
  chapterUrl: string;  // Identifies chapter within novel
  progress: number;    // 0-100 scroll percentage
  paragraphIndex: number;  // For TTS resume
  isRead: boolean;
  updatedAt: number;   // Unix timestamp for LWW
}

/** Library membership entity */
export interface SyncLibraryEntry {
  novelKey: NovelKey;
  inLibrary: boolean;
  categoryIds: string[];  // Category UUIDs
  updatedAt: number;
}

/** Category entity */
export interface SyncCategory {
  id: string;  // UUID, stable across devices
  name: string;
  sortOrder: number;
  updatedAt: number;
}

/** Complete sync payload */
export interface SyncPayload {
  schemaVersion: number;
  deviceId: string;
  exportedAt: number;
  progress: SyncProgress[];
  library: SyncLibraryEntry[];
  categories: SyncCategory[];
}

/** Sync conflict */
export interface SyncConflict {
  entityType: 'progress' | 'library' | 'category';
  localValue: unknown;
  remoteValue: unknown;
  resolution: 'local' | 'remote';
  resolvedAt: number;
}

/** Sync settings */
export interface SyncSettings {
  enabled: boolean;
  lastSyncAt: number | null;
  lastSyncError: string | null;
  autoSyncIntervalMs: number;  // e.g., 15 * 60 * 1000
  conflictPolicy: 'lww' | 'local-priority' | 'remote-priority';
}
```

---

#### [NEW] [schema.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/sync/schema.ts)

```typescript
/**
 * Sync payload serialization + schema migrations
 */

import { SyncPayload, SYNC_SCHEMA_VERSION } from './types';

export function serializeSyncPayload(payload: SyncPayload): string {
  return JSON.stringify(payload);
}

export function deserializeSyncPayload(data: string): SyncPayload {
  const parsed = JSON.parse(data);
  return migrateSyncPayload(parsed);
}

export function migrateSyncPayload(payload: unknown): SyncPayload {
  const version = (payload as { schemaVersion?: number }).schemaVersion ?? 1;
  
  if (version === SYNC_SCHEMA_VERSION) {
    return payload as SyncPayload;
  }
  
  // Future: Add migration from v1 → v2, etc.
  throw new Error(`Unknown sync schema version: ${version}`);
}
```

---

### Sync Engine

#### [NEW] [SyncEngine.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/sync/SyncEngine.ts)

```typescript
/**
 * SyncEngine
 * 
 * Orchestrates sync operations:
 * 1. Export local state → SyncPayload
 * 2. Upload to provider
 * 3. Download remote payload
 * 4. Merge with LWW
 * 5. Apply merged result locally
 */

import { SyncPayload, SyncSettings, SyncConflict } from './types';
import { exportLocalState } from './local/export';
import { importMergedState } from './local/import';
import { DriveAppDataProvider } from './providers/DriveAppDataProvider';

export class SyncEngine {
  private provider: DriveAppDataProvider;
  private isSyncing: boolean = false;
  private lastError: string | null = null;
  
  constructor() {
    this.provider = new DriveAppDataProvider();
  }
  
  async sync(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    try {
      // 1. Export local
      const localPayload = await exportLocalState();
      
      // 2. Fetch remote (if exists)
      const remotePayload = await this.provider.download();
      
      if (!remotePayload) {
        // First sync - just upload
        await this.provider.upload(localPayload);
        return;
      }
      
      // 3. Merge using LWW
      const { merged, conflicts } = this.merge(localPayload, remotePayload);
      
      // 4. Apply merged locally
      await importMergedState(merged);
      
      // 5. Upload merged (becomes new truth)
      await this.provider.upload(merged);
      
      // 6. Log conflicts for debugging
      if (conflicts.length > 0) {
        console.log(`[Sync] Resolved ${conflicts.length} conflicts`);
      }
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      this.isSyncing = false;
    }
  }
  
  private merge(
    local: SyncPayload, 
    remote: SyncPayload
  ): { merged: SyncPayload; conflicts: SyncConflict[] } {
    // LWW merge: for each entity, pick the one with newer updatedAt
    // ... detailed merge logic
  }
}

export const syncEngine = new SyncEngine();
```

---

### Provider Adapter

#### [NEW] [DriveAppDataProvider.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/sync/providers/DriveAppDataProvider.ts)

```typescript
/**
 * Google Drive AppData Provider
 * 
 * Uses hidden app folder (appDataFolder) for sync storage.
 * Only accessible by this app, not visible in user's Drive.
 */

import { SyncPayload, serializeSyncPayload, deserializeSyncPayload } from '../types';
import { download, uploadMedia, exists } from '@api/drive/request';

const SYNC_FILE_NAME = 'lnreader-sync.json';

export class DriveAppDataProvider {
  async upload(payload: SyncPayload): Promise<void> {
    const data = serializeSyncPayload(payload);
    // Use Drive API with appDataFolder scope
    await uploadMedia(data, {
      name: SYNC_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    });
  }
  
  async download(): Promise<SyncPayload | null> {
    const file = await exists(SYNC_FILE_NAME, false, 'appDataFolder');
    if (!file) return null;
    
    const content = await download(file);
    return deserializeSyncPayload(content);
  }
}
```

> [!NOTE]
> AppData folder requires `https://www.googleapis.com/auth/drive.appdata` scope.
> Need to check if existing Drive auth already has this scope.

---

### Local Data Export/Import

#### [NEW] [export.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/sync/local/export.ts)

```typescript
/**
 * Export local DB/MMKV state to SyncPayload
 */

import { SyncPayload, SyncProgress, SyncLibraryEntry, SyncCategory } from '../types';
import { getLibraryNovels } from '@database/queries/LibraryQueries';
import { getCategories } from '@database/queries/CategoryQueries';
import { getChapterProgress } from '@database/queries/ChapterQueries';

export async function exportLocalState(): Promise<SyncPayload> {
  const novels = await getLibraryNovels();
  const categories = await getCategories();
  
  const progress: SyncProgress[] = [];
  const library: SyncLibraryEntry[] = [];
  
  for (const novel of novels) {
    // Export library entry
    library.push({
      novelKey: { sourceId: novel.sourceId, novelUrl: novel.url },
      inLibrary: true,
      categoryIds: novel.categoryIds ?? [],
      updatedAt: novel.updatedAt ?? Date.now(),
    });
    
    // Export chapter progress
    const chapters = await getChapterProgress(novel.id);
    for (const ch of chapters) {
      progress.push({
        novelKey: { sourceId: novel.sourceId, novelUrl: novel.url },
        chapterUrl: ch.url,
        progress: ch.progress,
        paragraphIndex: ch.paragraphIndex ?? 0,
        isRead: ch.isRead ?? ch.progress >= 95,
        updatedAt: ch.updatedAt ?? Date.now(),
      });
    }
  }
  
  return {
    schemaVersion: 1,
    deviceId: getDeviceId(),
    exportedAt: Date.now(),
    progress,
    library,
    categories: categories.map(c => ({
      id: c.uuid ?? generateUUID(),
      name: c.name,
      sortOrder: c.sortOrder ?? 0,
      updatedAt: c.updatedAt ?? Date.now(),
    })),
  };
}
```

---

#### [NEW] [import.ts](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/services/sync/local/import.ts)

```typescript
/**
 * Import merged SyncPayload into local DB/MMKV
 */

import { SyncPayload } from '../types';
import { updateChapterProgress } from '@database/queries/ChapterQueries';
import { addNovelToLibrary, removeNovelFromLibrary } from '@database/queries/LibraryQueries';
import { createCategory, updateCategory } from '@database/queries/CategoryQueries';

export async function importMergedState(payload: SyncPayload): Promise<void> {
  // 1. Sync categories first (library entries reference them)
  for (const cat of payload.categories) {
    await upsertCategory(cat);
  }
  
  // 2. Sync library entries
  for (const entry of payload.library) {
    await syncLibraryEntry(entry);
  }
  
  // 3. Sync progress
  for (const prog of payload.progress) {
    await syncProgress(prog);
  }
}

async function syncLibraryEntry(entry: SyncLibraryEntry): Promise<void> {
  // Find local novel by sourceId + novelUrl
  const novel = await findNovelByKey(entry.novelKey);
  if (!novel) {
    // Novel doesn't exist locally - can't sync (user hasn't browsed this source)
    return;
  }
  
  if (entry.inLibrary && !novel.inLibrary) {
    await addNovelToLibrary(novel.id, entry.categoryIds);
  } else if (!entry.inLibrary && novel.inLibrary) {
    await removeNovelFromLibrary(novel.id);
  }
}
```

---

### UI Integration

#### [MODIFY] [index.tsx](file:///Users/muhammadfaiz/Custom%20APP/LNreader/src/screens/settings/SettingsBackupScreen/index.tsx)

Add new "Sync" section above or below existing backup UI:

```tsx
{/* Sync Section */}
<List.Section>
  <List.SubHeader>{getString('backupScreen.sync')}</List.SubHeader>
  
  <List.Item
    title={getString('backupScreen.syncEnabled')}
    description={syncSettings.enabled 
      ? getString('backupScreen.syncEnabledDesc') 
      : getString('backupScreen.syncDisabledDesc')}
    right={() => (
      <Switch 
        value={syncSettings.enabled} 
        onValueChange={toggleSync} 
      />
    )}
  />
  
  {syncSettings.enabled && (
    <>
      <List.Item
        title={getString('backupScreen.syncNow')}
        description={
          syncSettings.lastSyncAt 
            ? `Last: ${formatRelativeTime(syncSettings.lastSyncAt)}`
            : getString('backupScreen.neverSynced')
        }
        onPress={handleSyncNow}
        right={() => isSyncing && <ActivityIndicator />}
      />
      
      <List.Item
        title={getString('backupScreen.syncAccount')}
        description={accountEmail ?? getString('backupScreen.notSignedIn')}
        onPress={showAccountModal}
      />
      
      {syncSettings.lastSyncError && (
        <List.Item
          title={getString('backupScreen.syncError')}
          description={syncSettings.lastSyncError}
          titleStyle={{ color: theme.error }}
        />
      )}
    </>
  )}
</List.Section>
```

---

## Verification Plan

### Automated Tests

#### Unit Tests for Merge Logic

Create `src/services/sync/__tests__/SyncEngine.test.ts`:

```typescript
describe('SyncEngine merge', () => {
  it('picks remote when remote.updatedAt > local.updatedAt', () => {});
  it('picks local when local.updatedAt > remote.updatedAt', () => {});
  it('handles missing entities on either side', () => {});
  it('correctly merges categories, library, progress', () => {});
});
```

**Run**: `pnpm test -- SyncEngine.test.ts`

#### Schema Migration Tests

Create `src/services/sync/__tests__/schema.test.ts`:

```typescript
describe('Sync Schema', () => {
  it('serializes and deserializes correctly', () => {});
  it('rejects unknown schema versions', () => {});
});
```

**Run**: `pnpm test -- schema.test.ts`

### Manual Verification

> [!NOTE]
> Manual testing requires two Android devices or emulators with same Google account.

1. **First Device Setup**
   - Install app → Add novel to library → Read to Chapter 5
   - Settings → Backup → Enable Sync → "Sync Now"
   - ✅ Should show "Sync complete"

2. **Second Device Sync**
   - Fresh install → Sign in with same Google account
   - Settings → Backup → Enable Sync → "Sync Now"
   - ✅ Library should show same novel
   - ✅ Novel should show progress at Chapter 5

3. **Conflict Resolution**
   - Device A: Read to Chapter 10 → Sync
   - Device B (offline): Read to Chapter 7
   - Device B: Go online → Sync
   - ✅ Chapter 10 should win (newer timestamp)

4. **Offline Queue** (Phase 2)
   - Read while offline → Queue changes
   - Go online → Auto-sync
   - ✅ Changes should sync

---

## Phase 2 (Future)

- [ ] Settings sync (appearance, reader settings)
- [ ] WebDAV / self-hosted endpoint support
- [ ] Offline change queue with auto-retry
- [ ] Per-novel sync preference ("prefer local" vs "prefer remote")
