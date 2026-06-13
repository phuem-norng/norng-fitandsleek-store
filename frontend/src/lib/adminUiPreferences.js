import { useCallback, useEffect, useState } from "react";
import api from "./api";

const LS_PREFIX = "fitandsleek_admin_ui_pref:";
let remoteCache = null;
let remoteLoadingPromise = null;
let saveTimer = null;
const preferenceSubscribers = new Map();

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function deepGet(obj, path, fallback) {
  const parts = String(path || "").split(".").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (!isObject(current) || !(part in current)) return fallback;
    current = current[part];
  }
  return current;
}

function deepSet(obj, path, value) {
  const parts = String(path || "").split(".").filter(Boolean);
  if (!parts.length) return obj;
  const root = isObject(obj) ? { ...obj } : {};
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    cursor[key] = isObject(cursor[key]) ? { ...cursor[key] } : {};
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return root;
}

function readLocal(path, fallback) {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${path}`);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLocal(path, value) {
  try {
    localStorage.setItem(`${LS_PREFIX}${path}`, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

async function ensureRemoteLoaded() {
  if (remoteCache) return remoteCache;
  if (remoteLoadingPromise) return remoteLoadingPromise;
  remoteLoadingPromise = api
    .get("/admin/ui-preferences")
    .then((res) => {
      remoteCache = isObject(res?.data?.data) ? res.data.data : {};
      return remoteCache;
    })
    .catch(() => {
      remoteCache = {};
      return remoteCache;
    })
    .finally(() => {
      remoteLoadingPromise = null;
    });
  return remoteLoadingPromise;
}

function scheduleRemoteSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!remoteCache) return;
    try {
      await api.put("/admin/ui-preferences", { data: remoteCache });
    } catch {
      // keep local cache; retry on next change
    }
  }, 350);
}

function notifySubscribers(path, value) {
  const subs = preferenceSubscribers.get(path);
  if (!subs || !subs.size) return;
  subs.forEach((setValue) => {
    setValue(value);
  });
}

export function useAdminUiPreference(path, fallbackValue) {
  const [value, setValue] = useState(() => readLocal(path, fallbackValue));

  useEffect(() => {
    let subs = preferenceSubscribers.get(path);
    if (!subs) {
      subs = new Set();
      preferenceSubscribers.set(path, subs);
    }
    subs.add(setValue);
    return () => {
      const existing = preferenceSubscribers.get(path);
      if (!existing) return;
      existing.delete(setValue);
      if (!existing.size) {
        preferenceSubscribers.delete(path);
      }
    };
  }, [path]);

  useEffect(() => {
    let mounted = true;
    ensureRemoteLoaded().then((remote) => {
      if (!mounted) return;
      const remoteValue = deepGet(remote, path, undefined);
      if (remoteValue !== undefined) {
        setValue(remoteValue);
        writeLocal(path, remoteValue);
      }
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  const update = useCallback(
    (nextValue) => {
      setValue((prev) => {
        const resolved = typeof nextValue === "function" ? nextValue(prev) : nextValue;
        writeLocal(path, resolved);
        remoteCache = deepSet(remoteCache || {}, path, resolved);
        notifySubscribers(path, resolved);
        scheduleRemoteSave();
        return resolved;
      });
    },
    [path]
  );

  return [value, update];
}

