interface ProcessEnv {
  [key: string]: string | undefined;
}

interface GlobalProcess {
  env?: ProcessEnv;
}

// Extend the global process with additional properties
declare global {
  var process: NodeJS.Process;
  var processExt: GlobalProcess | undefined;
}

function readBooleanEnv(key: string): boolean {
  // RN uses global.process?.env in Metro, web/Jest use process.env.
  const globalProcess = globalThis.process;
  const nodeProcess = (globalThis as { processExt?: GlobalProcess }).processExt;

  const value = globalProcess?.env?.[key] ?? nodeProcess?.env?.[key];

  if (typeof value !== 'string') {
    return false;
  }
  return value === '1' || value.toLowerCase() === 'true';
}

export function isJestEnv(): boolean {
  // In Jest, JEST_WORKER_ID is set.

  const nodeProcess = globalThis.process;
  const jestWorkerId = nodeProcess?.env?.JEST_WORKER_ID;
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
