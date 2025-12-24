function readBooleanEnv(key: string): boolean {
  // RN uses global.process?.env in Metro, web/Jest use process.env.
  const value =
    (globalThis as any)?.process?.env?.[key] ?? (process as any)?.env?.[key];

  if (typeof value !== 'string') {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true';
}

export function isJestEnv(): boolean {
  // In Jest, JEST_WORKER_ID is set.

  const jestWorkerId = (process as any)?.env?.JEST_WORKER_ID;
  return typeof jestWorkerId === 'string' && jestWorkerId.length > 0;
}

export function isDevLoggingEnabled(scope: string): boolean {
  if (!__DEV__) {
    return false;
  }
  if (isJestEnv()) {
    return false;
  }

  // Global enable: LNREADER_DEV_LOGS=1
  if (readBooleanEnv('LNREADER_DEV_LOGS')) {
    return true;
  }

  // Scoped enable: LNREADER_DEV_LOGS_TTS=1, LNREADER_DEV_LOGS_WEBVIEW=1, ...
  const scopedKey = `LNREADER_DEV_LOGS_${scope.toUpperCase()}`;
  return readBooleanEnv(scopedKey);
}
