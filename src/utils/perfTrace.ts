const DEBUG_STORAGE_KEY = "motor-sound-editor:perf-trace";

function isPerfTraceEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1"
  );
}

function logPerfTrace(label: string, durationMs: number) {
  if (!isPerfTraceEnabled()) return;

  console.info(`[perf] ${label}: ${durationMs.toFixed(1)} ms`);
}

export async function measureAsync<T>(
  label: string,
  task: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await task();
  } finally {
    logPerfTrace(label, performance.now() - start);
  }
}

export function measureSync<T>(label: string, task: () => T): T {
  const start = performance.now();
  try {
    return task();
  } finally {
    logPerfTrace(label, performance.now() - start);
  }
}
