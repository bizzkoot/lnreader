/**
 * Export options payload carried from ExportEpubModal to the exporter on
 * every submit. Kept in a dedicated module so the payload construction is
 * unit-testable without mounting the modal (render tests are brittle under
 * this codebase's React Compiler setup).
 *
 * The modal passes the LIVE toggle values through this payload; the exporter
 * consumes options.* at export time instead of reading stale
 * useChapterReaderSettings() values from a previous render. This closes the
 * "first submit is one toggle behind" bug for all four toggles.
 */
export interface EpubExportOptions {
  epubUseAppTheme: boolean;
  epubUseCustomCSS: boolean;
  epubUseCustomJS: boolean;
  epubIncludeChapterNumber: boolean;
}

interface EpubExportToggleValues {
  useAppTheme: boolean;
  useCustomCSS: boolean;
  useCustomJS: boolean;
  includeChapterNumber: boolean;
}

/**
 * Build the export options payload from the modal's live toggle values.
 * Pure helper — intentionally free of hooks/state so it can be tested
 * directly.
 */
export const buildEpubExportOptions = (
  toggles: EpubExportToggleValues,
): EpubExportOptions => ({
  epubUseAppTheme: toggles.useAppTheme,
  epubUseCustomCSS: toggles.useCustomCSS,
  epubUseCustomJS: toggles.useCustomJS,
  epubIncludeChapterNumber: toggles.includeChapterNumber,
});
