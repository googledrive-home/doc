/* PlaySpace cloud-save bridge for same-origin standalone games.
   It only synchronises localStorage entries with game-save-like key names. */
(() => {
  "use strict";
  const script = document.currentScript;
  const gameId = String(script?.dataset?.gameId || "");
  const KEY_ALLOW = /(save|progress|career|high.?score|best.?score|bestscore|record|unlock|inventory|level|stats)/i;
  const KEY_DENY = /(token|password|auth|session|user(name)?|profile|account|music|volume|setting|theme|cookie|presence|upload)/i;
  const stampKey = "__playspace_cloud_stamp_" + gameId;
  let applyingCloud = false;
  let syncTimer = null;
  let syncing = false;

  function getApi() {
    try {
      if (window.parent === window) return window.PlaySpaceAccount || null;
      if (window.parent.location.origin !== window.location.origin) return null;
      return window.parent.PlaySpaceAccount || null;
    } catch (_) {
      return null;
    }
  }

  function isSaveKey(key) {
    const name = String(key || "");
    return name.length > 0 && name.length <= 120 && KEY_ALLOW.test(name) && !KEY_DENY.test(name);
  }

  function snapshot() {
    const items = {};
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!isSaveKey(key)) continue;
      const value = localStorage.getItem(key);
      if (value == null) continue;
      const add = key.length * 2 + value.length * 2;
      if (size + add > 42000) continue;
      items[key] = value;
      size += add;
    }
    return { version: 1, gameId, items };
  }

  async function sync() {
    const api = getApi();
    if (!api || !api.isSignedIn?.() || !gameId || syncing) return false;
    syncing = true;
    try {
      await api.save(gameId, snapshot());
      applyingCloud = true;
      localStorage.setItem(stampKey, String(Date.now()));
      applyingCloud = false;
      return true;
    } finally {
      applyingCloud = false;
      syncing = false;
    }
  }

  async function hydrate() {
    const api = getApi();
    if (!api || !api.isSignedIn?.() || !gameId) return false;
    try {
      const cloud = await api.load(gameId);
      const stamp = Number(localStorage.getItem(stampKey) || 0);
      if (cloud?.save?.items && Number(cloud.updatedAt || 0) > stamp) {
        applyingCloud = true;
        for (const [key, value] of Object.entries(cloud.save.items)) {
          if (isSaveKey(key) && typeof value === "string") localStorage.setItem(key, value);
        }
        localStorage.setItem(stampKey, String(cloud.updatedAt));
        applyingCloud = false;
        return true;
      }
      return sync();
    } catch (error) {
      console.warn("PlaySpace cloud save is not available for", gameId, error?.message || error);
      return false;
    }
  }

  function scheduleSync() {
    if (applyingCloud || !getApi()?.isSignedIn?.()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => sync().catch(error => console.warn("PlaySpace sync failed:", error)), 1200);
  }

  try {
    const nativeSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      const result = nativeSet.call(this, key, value);
      if (this === window.localStorage && isSaveKey(key)) scheduleSync();
      return result;
    };
    const nativeRemove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      const result = nativeRemove.call(this, key);
      if (this === window.localStorage && isSaveKey(key)) scheduleSync();
      return result;
    };
  } catch (error) {
    console.warn("PlaySpace could not watch local saves:", error);
  }

  window.PlaySpaceGameBridge = { gameId, sync, hydrate };
  hydrate();
  window.addEventListener("pagehide", () => { sync().catch(() => {}); });
})();