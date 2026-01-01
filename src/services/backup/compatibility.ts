/**
 * Backup Compatibility Layer
 *
 * Handles bidirectional backup compatibility between:
 * - Fork: Enhanced features like TTS state, repositories, v2 format
 * - Upstream: Original LNReader without fork-specific features
 *
 * This module ensures:
 * 1. Fork backups can be restored on upstream builds (Legacy mode)
 * 2. Upstream backups can be restored on fork with safe defaults
 */

import { ChapterInfo, NovelInfo } from '@database/types';
import { createRateLimitedLogger } from '@utils/rateLimitedLogger';

const compatLog = createRateLimitedLogger('BackupCompat', { windowMs: 1500 });

// ============================================================================
// Fork-Specific Fields (not present in upstream)
// ============================================================================

/**
 * Chapter fields that exist ONLY in fork
 * These must be stripped for upstream-compatible (legacy) backups
 */
export const FORK_ONLY_CHAPTER_FIELDS = ['ttsState'] as const;
export type ForkOnlyChapterField = (typeof FORK_ONLY_CHAPTER_FIELDS)[number];

/**
 * Novel fields that exist ONLY in fork (if any future additions)
 */
export const FORK_ONLY_NOVEL_FIELDS: readonly string[] = [];

/**
 * Backup files that exist ONLY in fork
 * Upstream backups won't have these - skip silently during restore
 */
export const FORK_ONLY_BACKUP_FILES = [
  'Repository.json',
  'manifest.json',
  'sections.json',
] as const;

// ============================================================================
// Safe Default Values
// ============================================================================

/**
 * Default values for fork-specific fields when restoring from upstream backup
 * These ensure the app functions correctly with missing data
 */
export const SAFE_DEFAULTS: Record<ForkOnlyChapterField, unknown> = {
  ttsState: null, // No TTS state = fresh start
};

/**
 * Gets the safe default value for a fork-specific chapter field
 */
export const getSafeDefault = (field: ForkOnlyChapterField): unknown => {
  return SAFE_DEFAULTS[field] ?? null;
};

// ============================================================================
// Field Stripping for Legacy Backup
// ============================================================================

/**
 * Strips fork-specific fields from a chapter for legacy/upstream backup
 * @param chapter - Chapter with potential fork-specific fields
 * @returns Chapter without fork-specific fields
 */
export const stripForkChapterFields = (
  chapter: ChapterInfo,
): Omit<ChapterInfo, ForkOnlyChapterField> => {
  const { ttsState: _ttsState, ...rest } = chapter;
  return rest;
};

/**
 * Strips fork-specific fields from a novel for legacy/upstream backup
 * Currently no fork-specific novel fields, but keeping for future use
 */
export const stripForkNovelFields = (novel: NovelInfo): NovelInfo => {
  // No fork-specific novel fields yet
  return novel;
};

// ============================================================================
// Field Restoration for Upstream Backups
// ============================================================================

/**
 * Ensures chapter has all required fork fields with safe defaults
 * Call this when restoring from upstream backup
 * @param chapter - Chapter from backup (may be missing fork fields)
 * @returns Chapter with all fork fields filled with safe defaults
 */
export const ensureForkChapterFields = (
  chapter: Partial<ChapterInfo>,
): ChapterInfo => {
  const ensured = { ...chapter } as ChapterInfo;

  for (const field of FORK_ONLY_CHAPTER_FIELDS) {
    if (!(field in ensured) || ensured[field] === undefined) {
      // Use type assertion to handle index assignment
      (ensured as unknown as Record<string, unknown>)[field] =
        getSafeDefault(field);
      compatLog.info(
        'apply-default',
        `Applied safe default for missing field: ${field}`,
      );
    }
  }

  return ensured;
};

// ============================================================================
// Backup Version Detection
// ============================================================================

/**
 * Backup types for compatibility handling
 */
export type BackupSourceType = 'fork-v2' | 'fork-v1' | 'upstream' | 'unknown';

/**
 * Detects the source type of a backup based on its structure
 * @param hasForkFiles - Whether fork-specific files exist
 * @param hasManifest - Whether manifest.json exists
 * @returns Detected backup source type
 */
export const detectBackupSource = (
  hasForkFiles: boolean,
  hasManifest: boolean,
): BackupSourceType => {
  if (hasManifest && hasForkFiles) {
    return 'fork-v2';
  }
  if (hasForkFiles) {
    return 'fork-v1';
  }
  // No fork-specific files = upstream or very old fork backup
  return 'upstream';
};

// ============================================================================
// Skipped Items Tracking
// ============================================================================

export interface SkippedItem {
  type: 'file' | 'field';
  name: string;
  reason: string;
}

/**
 * Tracks items skipped during restore for user notification
 */
export class RestoreTracker {
  private skippedItems: SkippedItem[] = [];
  private appliedDefaults: string[] = [];

  skipItem(type: SkippedItem['type'], name: string, reason: string): void {
    this.skippedItems.push({ type, name, reason });
  }

  applyDefault(fieldName: string): void {
    if (!this.appliedDefaults.includes(fieldName)) {
      this.appliedDefaults.push(fieldName);
    }
  }

  getSkippedCount(): number {
    return this.skippedItems.length;
  }

  getAppliedDefaultsCount(): number {
    return this.appliedDefaults.length;
  }

  /**
   * Generates a summary message for user notification
   */
  getSummaryMessage(): string | null {
    const parts: string[] = [];

    if (this.skippedItems.length > 0) {
      const fileCount = this.skippedItems.filter(i => i.type === 'file').length;
      const fieldCount = this.skippedItems.filter(
        i => i.type === 'field',
      ).length;

      if (fileCount > 0) {
        parts.push(`${fileCount} legacy file(s) skipped`);
      }
      if (fieldCount > 0) {
        parts.push(`${fieldCount} field(s) skipped`);
      }
    }

    if (this.appliedDefaults.length > 0) {
      parts.push(`${this.appliedDefaults.length} default(s) applied`);
    }

    return parts.length > 0 ? parts.join(', ') : null;
  }

  reset(): void {
    this.skippedItems = [];
    this.appliedDefaults = [];
  }
}

// Global tracker instance for current restore operation
export const restoreTracker = new RestoreTracker();
