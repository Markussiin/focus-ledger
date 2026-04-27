import { normalizeState } from "./core.js";

const KEY = "focus-ledger:v1";

export function loadState(storage = localStorage) {
  const raw = storage.getItem(KEY);

  if (!raw) {
    return normalizeState();
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState();
  }
}

export function saveState(state, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify(normalizeState(state)));
}

export function clearState(storage = localStorage) {
  storage.removeItem(KEY);
}

export function exportState(state) {
  return JSON.stringify(normalizeState(state), null, 2);
}

export function importState(text) {
  return normalizeState(JSON.parse(text));
}

