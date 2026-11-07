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

  public async init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.installInterceptor();

    const client = supabase;
    if (!client || !isSupabaseConfigured) {
      this.setStatus('offline', 'Supabase credentials not configured in environment variables');
      return;
    }

    try {
      const { data: authData } = await client.auth.getUser();
      if (authData?.user) {
        const { data: profile } = await (client as any)
          .from('profiles')
          .select('company_id')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profile?.company_id) {
          this.currentCompanyId = profile.company_id;
        }
      }
    } catch {
      console.warn('[CloudStorage] Profile company lookup skipped, using default company');
    }

    await this.pullFromCloud();
    this.subscribeRealtime();
  }

  public async pullFromCloud() {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

    this.setStatus('syncing', 'Pulling cloud data...');
    try {
      const { data, error } = await (client as any)
        .from('app_data_store')
        .select('storage_key, data')
        .eq('company_id', this.currentCompanyId);

      if (error) {
        console.error('[CloudStorage] Error pulling records:', error.message);
        this.setStatus('error', error.message);
        return;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        this.isApplyingRemoteUpdate = true;
        try {
          data.forEach((row: any) => {
            if (row.storage_key) {
              const serialized = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
              window.localStorage.setItem(row.storage_key, serialized);
            }
          });
        } finally {
          this.isApplyingRemoteUpdate = false;
        }

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

  public async pushAllLocalToCloud() {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

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
        const { error } = await (client as any)
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

  public queueCloudSave(key: string, value: any) {
    if (this.isApplyingRemoteUpdate) return;
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

    this.pendingUploads.set(key, value);
    this.setStatus('syncing', 'Saving changes to cloud...');

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushPendingUploads();
    }, 600);
  }

  private async flushPendingUploads() {
    const client = supabase;
    if (this.pendingUploads.size === 0 || !client) return;

    const itemsToSave = Array.from(this.pendingUploads.entries()).map(([key, val]) => ({
      company_id: this.currentCompanyId,
      storage_key: key,
      data: val,
      updated_at: new Date().toISOString()
    }));

    this.pendingUploads.clear();

    try {
      const { error } = await (client as any)
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

  private installInterceptor() {
    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);

    window.localStorage.setItem = (key: string, value: string) => {
      originalSetItem(key, value);

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

      const client = supabase;
      if (
        key.startsWith('concrete360_') &&
        !key.includes('theme') &&
        !key.includes('selected_site') &&
        !this.isApplyingRemoteUpdate &&
        client
      ) {
        void (client as any)
          .from('app_data_store')
          .delete()
          .eq('company_id', this.currentCompanyId)
          .eq('storage_key', key);
      }
    };
  }

  private subscribeRealtime() {
    const client = supabase;
    if (!client) return;

    try {
      client
        .channel('app_data_store_realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_data_store',
            filter: `company_id=eq.${this.currentCompanyId}`
          },
          (payload: any) => {
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
