// Captures the last unhandled error in the SSR runtime so server.ts can
// surface it when h3 swallows an in-handler throw into a generic 500.
let lastCapturedError: unknown = null;

function capture(err: unknown) {
  lastCapturedError = err;
}

// Side-effect: install global listeners on the Worker runtime.
try {
  // @ts-expect-error – globalThis listener API exists in workerd
  globalThis.addEventListener?.("error", (e: ErrorEvent) => capture(e.error ?? e.message));
  // @ts-expect-error – globalThis listener API exists in workerd
  globalThis.addEventListener?.("unhandledrejection", (e: PromiseRejectionEvent) =>
    capture(e.reason),
  );
} catch {
  /* ignore – not all runtimes expose these APIs */
}

export function consumeLastCapturedError(): unknown {
  const e = lastCapturedError;
  lastCapturedError = null;
  return e;
}
