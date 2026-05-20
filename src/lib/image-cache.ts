// Client-side cache + concurrency throttle for external images
// (country flags from flagcdn.com, referrer favicons from Google s2).
//
// Goals:
//   1. Never request the same URL twice in a session (de-dupe).
//   2. Remember failures across reloads so we don't re-hit broken hosts
//      every time the dashboard mounts (sessionStorage).
//   3. Cap concurrent external image requests so a 200-row table doesn't
//      open 200 sockets at once and stall the dashboard.

type Status = "idle" | "loading" | "loaded" | "failed";

const STATUS = new Map<string, Status>();
const WAITERS = new Map<string, Array<(ok: boolean) => void>>();
const MAX_CONCURRENT = 6;
let inflight = 0;
const queue: Array<() => void> = [];

const FAIL_KEY = "img-cache:failed:v1";
const failedSet: Set<string> = (() => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(FAIL_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
})();

function persistFailed() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FAIL_KEY, JSON.stringify([...failedSet]));
  } catch {
    /* quota — ignore */
  }
}

function next() {
  while (inflight < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    inflight++;
    job();
  }
}

function resolveWaiters(url: string, ok: boolean) {
  const list = WAITERS.get(url);
  WAITERS.delete(url);
  if (list) for (const fn of list) fn(ok);
}

/**
 * Returns a promise that resolves to true if the image is (or becomes)
 * cached & loadable, false if it failed. Concurrency-limited and
 * de-duplicated per URL.
 */
export function loadImage(url: string): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  if (failedSet.has(url)) return Promise.resolve(false);

  const status = STATUS.get(url);
  if (status === "loaded") return Promise.resolve(true);
  if (status === "failed") return Promise.resolve(false);

  return new Promise<boolean>((resolve) => {
    const waiters = WAITERS.get(url) ?? [];
    waiters.push(resolve);
    WAITERS.set(url, waiters);

    if (status === "loading") return; // already enqueued

    STATUS.set(url, "loading");
    queue.push(() => {
      const img = new Image();
      const done = (ok: boolean) => {
        inflight--;
        STATUS.set(url, ok ? "loaded" : "failed");
        if (!ok) {
          failedSet.add(url);
          persistFailed();
        }
        resolveWaiters(url, ok);
        next();
      };
      img.onload = () => done(true);
      img.onerror = () => done(false);
      // The browser HTTP cache will service repeat hits cheaply; this just
      // gates *first* fetch concurrency.
      img.src = url;
    });
    next();
  });
}

export function isKnownFailed(url: string): boolean {
  return failedSet.has(url) || STATUS.get(url) === "failed";
}

export function isKnownLoaded(url: string): boolean {
  return STATUS.get(url) === "loaded";
}
