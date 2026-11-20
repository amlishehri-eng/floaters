"use client";

import { useSyncExternalStore } from "react";

const key = "founders-first:demo-workflow:v1";
const changed = "founders-first:demo-changed";
const empty = { reviewedIds: null, savedIds: [] };
let fallback = null;

function snapshot() {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return fallback;
  }
}

function read(value) {
  try {
    const state = JSON.parse(value);
    if (Array.isArray(state?.reviewedIds) && Array.isArray(state?.savedIds)) {
      return state;
    }
  } catch {
    // A stale or invalid snapshot can be replaced by the next demo run.
  }
  return empty;
}

function subscribe(notify) {
  window.addEventListener("storage", notify);
  window.addEventListener(changed, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(changed, notify);
  };
}

function update(change) {
  fallback = JSON.stringify(change(read(snapshot())));
  try {
    window.localStorage.setItem(key, fallback);
  } catch {
    // Keep the current workflow usable during client-side navigation.
  }
  window.dispatchEvent(new Event(changed));
}

function serverSnapshot() {
  return null;
}

export function useDemoWorkflow() {
  return read(useSyncExternalStore(subscribe, snapshot, serverSnapshot));
}

export function publishDemoRun(reviewedIds) {
  update((state) => ({ ...state, reviewedIds }));
}

export function toggleDemoCandidate(id) {
  update((state) => ({
    ...state,
    savedIds: state.savedIds.includes(id)
      ? state.savedIds.filter((saved) => saved !== id)
      : [...state.savedIds, id],
  }));
}
