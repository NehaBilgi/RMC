// Shared company storage.
// The pages in this app save data with localStorage (only on one laptop).
// This file mirrors every "concrete360_*" key to the Supabase table
// "shared_storage", so every user of the same company sees the same data.
import { supabase } from './supabase';

// Keys that should stay on each device (per-person settings / session state).
const LOCAL_ONLY_KEYS = new Set([
  'concrete360_theme',
  'concrete360_active_site',
  'concrete360_selected_site',
  'concrete360_user',
  'concrete360_users', // old local user list (held passwords) - never upload
  'concrete360_measurement'
]);

const COMPANY_KEY = 'concrete360_company_id';
let companyId: string | null = null;
let installed = false;
let applyingRemote = false;

const isShared = (key: string) =>
  key.startsWith('concrete360_') && !LOCAL_ONLY_KEYS.has(key) && key !== COMPANY_KEY;

function push(key: string, value: string | null) {
  if (!supabase || !companyId || applyingRemote) return;
  const req =
    value === null
      ? supabase.from('shared_storage').delete().eq('company_id', companyId).eq('key', key)
      : supabase
          .from('shared_storage')
          .upsert({ company_id: companyId, key, value, updated_at: new Date().toISOString() });
  void req.then(({ error }) => {
    if (error) console.error(`Could not save "${key}" to the cloud:`, error.message);
  });
}

/** Call once at app start (main.tsx), before rendering. */
export function installCloudStorage() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  companyId = sessionStorage.getItem(COMPANY_KEY);
  // Storage instances have exotic setters: assigning store.setItem may store
  // a string key rather than override the method. Intercept the prototype.
  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    const before = this.getItem(key);
    origSet.call(this, key, value);
    if (this === window.localStorage && isShared(key) && before !== value) push(key, value);
  };
  Storage.prototype.removeItem = function (key: string) {
    origRemove.call(this, key);
    if (this === window.localStorage && isShared(key)) push(key, null);
  };
}

/** Download all company data from Supabase into this browser. */
export async function pullSharedData(forCompanyId?: string) {
  if (!supabase) return;
  if (forCompanyId) {
    companyId = forCompanyId;
    sessionStorage.setItem(COMPANY_KEY, forCompanyId);
  }
  if (!companyId) return;
  const { data, error } = await supabase
    .from('shared_storage')
    .select('key, value')
    .eq('company_id', companyId);
  if (error) throw error;

  applyingRemote = true;
  try {
    // Remove old shared data from a previous user / company on this laptop.
    const remoteKeys = new Set((data ?? []).map((r) => r.key));
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && isShared(k) && !remoteKeys.has(k)) localStorage.removeItem(k);
    }
    for (const row of data ?? []) localStorage.setItem(row.key, row.value);
  } finally {
    applyingRemote = false;
  }
}

/** Optional one-time upload: send data that exists only on THIS laptop to the cloud. */
export async function uploadLocalDataOnce() {
  if (!supabase || !companyId) return;
  const rows: { company_id: string; key: string; value: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isShared(k)) rows.push({ company_id: companyId, key: k, value: localStorage.getItem(k) ?? '' });
  }
  if (!rows.length) return;
  const { error } = await supabase.from('shared_storage').upsert(rows);
  if (error) throw error;
}

/** Call on logout. */
export function clearCloudSession() {
  applyingRemote = true;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && isShared(k)) localStorage.removeItem(k);
    }
  } finally {
    applyingRemote = false;
  }
  companyId = null;
  sessionStorage.removeItem(COMPANY_KEY);
}
