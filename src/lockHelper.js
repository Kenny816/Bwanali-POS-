// Safe wrapper for navigator.locks.request that retries on AbortError
export async function safeLock(name, callback) {
  try {
    return await navigator.locks.request(name, callback);
  } catch (e) {
    if (e.name === 'AbortError') {
      // Retry once after a tiny delay
      await new Promise(r => setTimeout(r, 50));
      return navigator.locks.request(name, callback);
    }
    throw e;
  }
}
