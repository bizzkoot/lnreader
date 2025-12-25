/**
 * Error handling utilities for LNReader.
 *
 * Provides standardized error handling patterns including:
 * - Error type detection and message extraction
 * - Safe async operation wrappers
 * - Error severity levels
 * - Operation-specific error handlers
 */

/**
 * Error severity levels for categorizing and handling errors appropriately.
 */
export enum ErrorSeverity {
  /** Informational - doesn't affect functionality */
  Info = 'info',
  /** Warning - may indicate a problem but operation succeeded */
  Warning = 'warning',
  /** Error - operation failed but app can continue */
  Error = 'error',
  /** Critical - operation failed and app state may be compromised */
  Critical = 'critical',
}

/**
 * Error categories for grouping similar errors.
 */
export enum ErrorCategory {
  /** Network-related errors (fetch, API calls) */
  Network = 'network',
  /** Storage-related errors (database, MMKV, file system) */
  Storage = 'storage',
  /** TTS-related errors (playback, voice loading) */
  TTS = 'tts',
  /** Validation errors (invalid input, type checking) */
  Validation = 'validation',
  /** Unknown/uncategorized errors */
  Unknown = 'unknown',
}

/**
 * Custom error class with additional context for better error handling.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly category: ErrorCategory = ErrorCategory.Unknown,
    public readonly severity: ErrorSeverity = ErrorSeverity.Error,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Network-related error.
 */
export class NetworkError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, ErrorCategory.Network, ErrorSeverity.Error, originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Storage-related error (database, MMKV, file system).
 */
export class StorageError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, ErrorCategory.Storage, ErrorSeverity.Error, originalError);
    this.name = 'StorageError';
  }
}

/**
 * TTS-related error.
 */
export class TTS_ERROR extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(message, ErrorCategory.TTS, ErrorSeverity.Warning, originalError);
    this.name = 'TTS_ERROR';
  }
}

/**
 * Extracts a user-friendly error message from an unknown error value.
 *
 * @param error - The error value to extract a message from
 * @returns A string error message suitable for display/logging
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const message = getErrorMessage(error);
 *   logger.error('operation-failed', message);
 *   showToast(message);
 * }
 * ```
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error === null || error === undefined) {
    return 'Unknown error';
  }
  return String(error);
}

/**
 * Result type for safe async operations.
 */
export interface ErrorHandlingResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The returned data if successful */
  data?: T;
  /** The error if failed */
  error?: Error;
}

/**
 * Safely executes an async operation and returns a standardized result.
 *
 * This wrapper catches all errors and returns a consistent result type,
 * making error handling more predictable and reducing try-catch boilerplate.
 *
 * @param operation - The async operation to execute
 * @param context - A descriptive name for the operation (for logging)
 * @returns A result object with success status, data, or error
 *
 * @example
 * ```typescript
 * const result = await safeAsync(
 *   () => fetchChapter(pluginId, path),
 *   'fetchChapter'
 * );
 *
 * if (!result.success) {
 *   showToast('Failed to load chapter');
 *   logger.error('fetchChapter-failed', result.error);
 *   return;
 * }
 *
 * const chapter = result.data;
 * ```
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<ErrorHandlingResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(getErrorMessage(error));
    return {
      success: false,
      error: normalizedError,
    };
  }
}

/**
 * Options for error handling behavior.
 */
export interface ErrorHandlerOptions {
  /** Severity level for the error */
  severity?: ErrorSeverity;
  /** Whether to show a toast message to the user */
  showToast?: boolean;
  /** Custom toast message (auto-generated if not provided) */
  toastMessage?: string;
  /** Whether to include full error details in logs */
  verbose?: boolean;
}

/**
 * Handles an error with consistent logging and optional user notification.
 *
 * This is a convenience function for the common pattern of logging errors
 * and optionally showing a toast message to the user.
 *
 * @param operation - Name of the operation that failed
 * @param error - The error value
 * @param logger - Rate-limited logger instance
 * @param showToastFn - Toast function (optional)
 * @param options - Additional options for error handling
 *
 * @example
 * ```typescript
 * import { createRateLimitedLogger } from '@utils/rateLimitedLogger';
 * import { handleOperationError } from '@utils/error';
 *
 * const log = createRateLimitedLogger('MyComponent', { windowMs: 1500 });
 *
 * try {
 *   await deleteChapter(chapterId);
 * } catch (error) {
 *   handleOperationError(
 *     'deleteChapter',
 *     error,
 *     log,
 *     showToast,
 *     { severity: ErrorSeverity.Warning }
 *   );
 * }
 * ```
 */
export function handleOperationError(
  operation: string,
  error: unknown,
  logger: {
    error: (event: string, message: string, ...args: unknown[]) => void;
    warn?: (event: string, message: string, ...args: unknown[]) => void;
    info?: (event: string, message: string, ...args: unknown[]) => void;
  },
  showToastFn?: (message: string) => void,
  options: ErrorHandlerOptions = {},
): void {
  const {
    severity = ErrorSeverity.Error,
    showToast = false,
    toastMessage,
    verbose = false,
  } = options;

  const errorMessage = getErrorMessage(error);
  const logMessage = `${operation} failed: ${errorMessage}`;

  // Log based on severity
  switch (severity) {
    case ErrorSeverity.Info:
      logger.info?.(`${operation}-info`, logMessage);
      break;
    case ErrorSeverity.Warning:
      logger.warn?.(`${operation}-warning`, logMessage);
      break;
    case ErrorSeverity.Error:
    case ErrorSeverity.Critical:
    default:
      if (verbose && error instanceof Error) {
        logger.error(`${operation}-failed`, logMessage, error.stack);
      } else {
        logger.error(`${operation}-failed`, logMessage);
      }
      break;
  }

  // Show toast if requested
  if (showToast && showToastFn) {
    const message =
      toastMessage || `Failed to ${formatOperationName(operation)}`;
    showToastFn(message);
  }
}

/**
 * Formats an operation name for user-facing messages.
 *
 * @param operation - The operation name (e.g., 'deleteChapter', 'fetchNovel')
 * @returns A user-friendly string (e.g., 'delete chapter', 'fetch novel')
 */
function formatOperationName(operation: string): string {
  // Insert spaces before capital letters and convert to lowercase
  return operation
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim();
}

/**
 * Type guard to check if a value is an Error instance.
 *
 * @param error - Value to check
 * @returns True if the value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if a value is an AppError instance.
 *
 * @param error - Value to check
 * @returns True if the value is an AppError instance
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Creates an error guard function for custom error types.
 *
 * @param errorClass - The error class to check against
 * @returns A type guard function for the specified error class
 *
 * @example
 * ```typescript
 * const isNetworkError = createErrorGuard(NetworkError);
 *
 * if (isNetworkError(error)) {
 *   // TypeScript knows error is NetworkError here
 *   console.log(error.category); // ErrorCategory.Network
 * }
 * ```
 */
export function createErrorGuard<T extends Error>(
  errorClass: new (...args: unknown[]) => T,
): (error: unknown) => error is T {
  return (error: unknown): error is T => error instanceof errorClass;
}

/**
 * Silently ignores an error (for non-critical operations).
 *
 * Use this function instead of empty catch blocks to make intent explicit.
 *
 * @param error - The error to ignore
 * @param context - Optional context for future debugging (no-op in production)
 *
 * @example
 * ```typescript
 * try {
 *   await markChapterRead(chapterId);
 * } catch (error) {
 *   ignoreError(error, 'markChapterRead'); // Intentionally ignored
 * }
 * ```
 */
export function ignoreError(error: unknown, context?: string): void {
  // Intentionally empty: Error is being ignored as documented.
  // The context parameter provides documentation for future debugging.
  // If needed in __DEV__, attach a debugger here with the context.
  void error; // Mark as intentionally unused
  void context; // Mark as intentionally unused
}
