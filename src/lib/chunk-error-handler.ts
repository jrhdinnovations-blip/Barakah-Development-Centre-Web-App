/**
 * Utility to detect and gracefully recover from stale Vite chunks and dynamic import errors.
 * This occurs when a new deployment updates the asset hashes while a user has an active tab
 * or cached service worker session.
 */

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === 'string'
      ? error
      : (error as any)?.message || String(error);

  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk|dynamically imported module/i.test(
    message
  );
}

export function autoRecoverChunkError(): boolean {
  if (typeof window === 'undefined') return false;

  const KEY = 'barakah_chunk_reload_ts';
  const lastReload = sessionStorage.getItem(KEY);
  const now = Date.now();

  // If we haven't reloaded within the last 20 seconds, perform hard cache-busting reload
  if (!lastReload || now - parseInt(lastReload, 10) > 20000) {
    sessionStorage.setItem(KEY, String(now));

    // Clear service worker caches if present
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      }).finally(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
    return true;
  }

  // Already reloaded recently, prevent infinite loop
  return false;
}
