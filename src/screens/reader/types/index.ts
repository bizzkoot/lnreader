/**
 * Reader Types Index
 *
 * Re-exports all type definitions used by the reader components.
 */

export * from './tts';

// ============================================================================
// In-Chapter Search Types
// ============================================================================

export type ReaderSearchResult = {
  query: string;
  current: number;
  total: number;
  renderedTotal: number;
  isTruncated: boolean;
};

export const EMPTY_READER_SEARCH_RESULT: ReaderSearchResult = {
  query: '',
  current: 0,
  total: 0,
  renderedTotal: 0,
  isTruncated: false,
};
