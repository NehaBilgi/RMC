import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

type StatusListener = (status: SyncStatus, message?: string) => void;

class CloudStorageService {
  private status: SyncStatus = 'offline';
  private listeners: Set<StatusListener> = new Set();
  private pendingUploads: Map<string, any> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private isApplyingRemoteUpdate = false;
  private currentCompanyId = '00000000-0000-0000-0000-000000000001';

  constructor() {
    if (typeof window !== 'undefined') {
      this.status = isSupabaseConfigured ? 'synced' : 'offline';
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private setStatus(status: SyncStatus, message?: string) {
    this.status = status;
    this.listeners.forEach((fn) => fn(status, message));
  }

  public async setCompanyId(companyId: string) {
    if (companyId && companyId !== this.currentCompanyId) {
      this.currentCompanyId = companyId;
      await this.pullFromCloud();
    }
  }

  /**
   * Initializes cloud synchronization:
   * 1. Intercepts localStorage writes to auto-persist to Supabase
   * 2. Pulls remote state into localStorage
   * 3. Sets up realtime listener for collaborative cross-device updates
   */
  public async init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // 1. Install storage interceptor for concrete360_* keys
    this.installInterceptor();

    if (!supabase || !isSupabaseConfigured) {
      this.setStatus('offline', 'Supabase credentials not configured in environment variables');
      return;
    }

    // 2. Fetch active company if signed in
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', authData.user.id)
          .single();
        if (profile?.company_id) {
          this.currentCompanyId = profile.company_id;
        }
      }
    } catch (e) {
      console.warn('[CloudStorage] Profile company lookup skipped, using default company');
    }

    // 3. Pull latest data from Supabase
    await this.pullFromCloud();

    // 4. Listen for realtime cloud updates
    this.subscribeRealtime();
  }

  /**
   * Reads all data keys from Supabase app_data_store and synchronizes into localStorage
   */
  public async pullFromCloud() {
    if (!supabase || !isSupabaseConfigured) return;

    this.setStatus('syncing', 'Pulling cloud data...');
    try {
      const { data, error } = await supabase
        .from('app_data_store')
        .select('storage_key, data')
        .eq('company_id', this.currentCompanyId);

      if (error) {
        console.error('[CloudStorage] Error pulling records:', error.message);
        this.setStatus('error', error.message);
        return;
      }

      if (data && data.length > 0) {
        this.isApplyingRemoteUpdate = true;
        try {
          data.forEach((row) => {
            if (row.storage_key) {
              const serialized = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
              window.localStorage.setItem(row.storage_key, serialized);
            }
          });
        } finally {
          this.isApplyingRemoteUpdate = false;
        }

        // Notify UI to re-render with new cloud data
        window.dispatchEvent(new CustomEvent('concrete360_cloud_synced', { detail: { count: data.length } }));
        window.dispatchEvent(new CustomEvent('concrete360_site_switched'));
        window.dispatchEvent(new Event('concrete360_user_updated'));
      }

      this.setStatus('synced', 'All systems synchronized with Supabase');
    } catch (err: any) {
      console.error('[CloudStorage] Failed to pull from cloud:', err);
      this.setStatus('error', err?.message || 'Sync failed');
    }
  }

  /**
   * Pushes all local concrete360 keys to Supabase (useful for initial migration or offline recovery)
   */
  public async pushAllLocalToCloud() {
    if (!supabase || !isSupabaseConfigured) return;

    this.setStatus('syncing', 'Uploading local data to Supabase...');
    try {
      const payload: { company_id: string; storage_key: string; data: any; updated_at: string }[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('concrete360_') && !key.includes('theme') && !key.includes('selected_site')) {
          try {
            const rawVal = window.localStorage.getItem(key);
            if (rawVal) {
              const parsedVal = JSON.parse(rawVal);
              payload.push({
                company_id: this.currentCompanyId,
                storage_key: key,
                data: parsedVal,
                updated_at: new Date().toISOString()
              });
            }
          } catch {}
        }
      }

      if (payload.length > 0) {
        const { error } = await supabase
          .from('app_data_store')
          .upsert(payload, { onConflict: 'company_id, storage_key' });

        if (error) throw error;
      }

      this.setStatus('synced', 'Local data fully uploaded to Supabase');
    } catch (err: any) {
      console.error('[CloudStorage] Error pushing local data:', err);
      this.setStatus('error', err?.message || 'Upload failed');
    }
  }

  /**
   * Schedules a debounced batch upload to Supabase
   */
  public queueCloudSave(key: string, value: any) {
    if (this.isApplyingRemoteUpdate) return;
    if (!supabase || !isSupabaseConfigured) return;

    this.pendingUploads.set(key, value);
    this.setStatus('syncing', 'Saving changes to cloud...');

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingUploads();
    }, 600); // 600ms debounce
  }

  private async flushPendingUploads() {
    if (this.pendingUploads.size === 0 || !supabase) return;

    const itemsToSave = Array.from(this.pendingUploads.entries()).map(([key, val]) => ({
      company_id: this.currentCompanyId,
      storage_key: key,
      data: val,
      updated_at: new Date().toISOString()
    }));

    this.pendingUploads.clear();

    try {
      const { error } = await supabase
        .from('app_data_store')
        .upsert(itemsToSave, { onConflict: 'company_id, storage_key' });

      if (error) {
        console.error('[CloudStorage] Upsert error:', error.message);
        this.setStatus('error', `Save failed: ${error.message}`);
      } else {
        this.setStatus('synced', 'All changes saved to Supabase');
      }
    } catch (err: any) {
      console.error('[CloudStorage] Network save error:', err);
      this.setStatus('error', err?.message || 'Network error');
    }
  }

  /**
   * Intercepts window.localStorage.setItem and removeItem so ANY component
   * automatically uploads to Supabase without requiring code rewrite!
   */
  private installInterceptor() {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

    window.localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);

      // Only sync application data keys, skip themes and ephemeral UI state
      if (
        key.startsWith('concrete360_') &&
        !key.includes('theme') &&
        !key.includes('selected_site') &&
        !this.isApplyingRemoteUpdate
      ) {
        try {
          const parsed = JSON.parse(value);
          this.queueCloudSave(key, parsed);
        } catch {
          this.queueCloudSave(key, value);
        }
      }
    };

    window.localStorage.removeItem = (key: string) => {
      originalRemoveItem(key);

      if (
        key.startsWith('concrete360_') &&
        !key.includes('theme') &&
        !key.includes('selected_site') &&
        !this.isApplyingRemoteUpdate &&
        supabase
      ) {
        void supabase
          .from('app_data_store')
          .delete()
          .eq('company_id', this.currentCompanyId)
          .eq('storage_key', key);
      }
    };
  }

  /**
   * Realtime subscription for cross-device live collaboration
   */
  private subscribeRealtime() {
    if (!supabase) return;

    try {
      supabase
        .channel('app_data_store_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_data_store',
            filter: `company_id=eq.${this.currentCompanyId}`
          },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newRow = payload.new as { storage_key?: string; data?: any };
              if (newRow?.storage_key) {
                this.isApplyingRemoteUpdate = true;
                try {
                  const serialized =
                    typeof newRow.data === 'string' ? newRow.data : JSON.stringify(newRow.data);
                  window.localStorage.setItem(newRow.storage_key, serialized);
                } finally {
                  this.isApplyingRemoteUpdate = false;
                }

                window.dispatchEvent(
                  new CustomEvent('concrete360_remote_update', { detail: { key: newRow.storage_key } })
                );

                if (newRow.storage_key.includes('site')) {
                  window.dispatchEvent(new CustomEvent('concrete360_site_switched'));
                }
                if (newRow.storage_key.includes('user')) {
                  window.dispatchEvent(new Event('concrete360_user_updated'));
                }
              }
            } else if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { storage_key?: string };
              if (oldRow?.storage_key) {
                this.isApplyingRemoteUpdate = true;
                try {
                  window.localStorage.removeItem(oldRow.storage_key);
                } finally {
                  this.isApplyingRemoteUpdate = false;
                }
              }
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('[CloudStorage] Realtime subscription not enabled:', e);
    }
  }
}

export const cloudStorage = new CloudStorageService();
