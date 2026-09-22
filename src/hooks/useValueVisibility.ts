"use client";

import { useSyncExternalStore } from "react";
import type { SetStateAction } from "react";

const storageKey = "finance-show-values";
const changeEvent = "finance-value-visibility";
let visible = false;

function getSnapshot() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved !== null) visible = saved === "true";
  } catch { /* Keep the in-memory preference when storage is unavailable. */ }
  return visible;
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) notify();
  };
  window.addEventListener(changeEvent, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changeEvent, notify);
    window.removeEventListener("storage", onStorage);
  };
}

function setShowValues(next: SetStateAction<boolean>) {
  visible = typeof next === "function" ? next(getSnapshot()) : next;
  try {
    window.localStorage.setItem(storageKey, String(visible));
  } catch { /* The preference still works for this session. */ }
  window.dispatchEvent(new Event(changeEvent));
}

export function useValueVisibility() {
  const showValues = useSyncExternalStore(subscribe, getSnapshot, () => false);
  return [showValues, setShowValues] as const;
}
