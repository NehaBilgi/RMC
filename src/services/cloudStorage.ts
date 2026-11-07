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

  public async setCompanyId(_companyId: string) {
    // Shared global database across all company devices
    await this.pullFromCloud();
  }

  public async init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    this.installInterceptor();

    const client = supabase;
    if (!client || !isSupabaseConfigured) {
      this.setStatus('offline', 'Supabase credentials not configured');
      return;
    }

    await this.pullFromCloud();
    this.subscribeRealtime();
  }

  /**
   * Pulls all records from both dedicated relational tables and app_data_store
   */
  public async pullFromCloud() {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

    this.setStatus('syncing', 'Syncing cloud tables...');
    try {
      this.isApplyingRemoteUpdate = true;

      // 1. Pull Dedicated Sites Table
      const { data: sitesData } = await (client as any)
        .from('sites')
        .select('*')
        .order('name');

      if (sitesData && Array.isArray(sitesData) && sitesData.length > 0) {
        const formattedSites = sitesData.map((s: any) => ({
          id: s.id,
          siteId: s.site_id || 'S-01',
          name: s.name,
          siteName: s.site_name || s.name,
          category: s.category || 'Building',
          location: s.location || '',
          supervisor: s.supervisor || 'adminbilgi',
          clientName: s.client_name || s.name,
          gstin: s.gstin || '29UNREGISTERED',
          detail: s.scope || 'G + 3 Floors',
          structureScope: s.scope || 'G + 3 Floors',
          assignedFleet: s.assigned_fleet || 4,
          status: s.status || 'active'
        }));

        window.localStorage.setItem('concrete360_sites', JSON.stringify(formattedSites));
        window.localStorage.setItem('concrete360_ongoing_sites', JSON.stringify(formattedSites));
      }

      // 2. Pull Unified App Data Store (Invoices, Tests, Trips, Mixers, Users)
      const { data: storeData } = await (client as any)
        .from('app_data_store')
        .select('storage_key, data');

      if (storeData && Array.isArray(storeData)) {
        storeData.forEach((row: any) => {
          if (row.storage_key) {
            const serialized = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
            window.localStorage.setItem(row.storage_key, serialized);
          }
        });
      }

      // 3. Pull Company Profile Table
      const { data: companyData } = await (client as any)
        .from('company_profile')
        .select('*')
        .maybeSingle();

      if (companyData) {
        window.localStorage.setItem(
          'concrete360_company_profile',
          JSON.stringify({
            name: companyData.name,
            gstin: companyData.gstin,
            address: companyData.address,
            division: companyData.division,
            bankName: companyData.bank_name,
            accountName: companyData.account_name,
            accountNo: companyData.account_no,
            ifscSwift: companyData.ifsc_swift,
            branch: companyData.branch
          })
        );
      }

      this.isApplyingRemoteUpdate = false;

      // Notify UI of synchronized state
      window.dispatchEvent(new CustomEvent('concrete360_cloud_synced'));
      const activeSite =
        sessionStorage.getItem('concrete360_selected_site') ||
        localStorage.getItem('concrete360_selected_site');
      if (activeSite) {
        window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: activeSite }));
      }
      window.dispatchEvent(new Event('concrete360_user_updated'));

      this.setStatus('synced', 'All systems synchronized with Supabase');
    } catch (err: any) {
      this.isApplyingRemoteUpdate = false;
      console.error('[CloudStorage] Pull error:', err);
      this.setStatus('error', err?.message || 'Sync failed');
    }
  }

  /**
   * Pushes all local storage collections to dedicated Supabase tables
   */
  public async pushAllLocalToCloud() {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

    this.setStatus('syncing', 'Pushing to cloud tables...');
    try {
      const storePayload: { storage_key: string; data: any; updated_at: string }[] = [];

      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith('concrete360_') && !key.includes('theme') && !key.includes('selected_site')) {
          try {
            const rawVal = window.localStorage.getItem(key);
            if (rawVal) {
              const parsedVal = JSON.parse(rawVal);
              storePayload.push({
                storage_key: key,
                data: parsedVal,
                updated_at: new Date().toISOString()
              });

              // Write to dedicated relational tables
              await this.syncToRelationalTable(key, parsedVal);
            }
          } catch {}
        }
      }

      if (storePayload.length > 0) {
        await (client as any)
          .from('app_data_store')
          .upsert(storePayload, { onConflict: 'storage_key' });
      }

      this.setStatus('synced', 'All records pushed to Supabase tables');
    } catch (err: any) {
      console.error('[CloudStorage] Push error:', err);
      this.setStatus('error', err?.message || 'Upload failed');
    }
  }

  public queueCloudSave(key: string, value: any) {
    if (this.isApplyingRemoteUpdate) return;
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

    this.pendingUploads.set(key, value);
    this.setStatus('syncing', 'Saving changes to cloud...');

    // Immediately sync critical data (sites, invoices, trips, users)
    const isCritical =
      key.includes('site') ||
      key.includes('invoice') ||
      key.includes('trip') ||
      key.includes('test') ||
      key.includes('user');

    if (isCritical) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      void this.flushPendingUploads();
      return;
    }

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.flushPendingUploads();
    }, 400);
  }

  private async flushPendingUploads() {
    const client = supabase;
    if (this.pendingUploads.size === 0 || !client) return;

    const items = Array.from(this.pendingUploads.entries());
    this.pendingUploads.clear();

    const storePayload = items.map(([key, val]) => ({
      storage_key: key,
      data: val,
      updated_at: new Date().toISOString()
    }));

    try {
      // 1. Save to app_data_store
      await (client as any)
        .from('app_data_store')
        .upsert(storePayload, { onConflict: 'storage_key' });

      // 2. Save directly to dedicated relational tables
      for (const [key, val] of items) {
        await this.syncToRelationalTable(key, val);
      }

      this.setStatus('synced', 'Saved to Supabase database');
    } catch (err: any) {
      console.error('[CloudStorage] Save error:', err);
      this.setStatus('error', err?.message || 'Save error');
    }
  }

  /**
   * Translates application keys into clean SQL rows in dedicated tables
   */
  private async syncToRelationalTable(key: string, data: any) {
    const client = supabase;
    if (!client) return;

    try {
      // SITES TABLE
      if (key === 'concrete360_sites' || key === 'concrete360_ongoing_sites') {
        if (Array.isArray(data)) {
          const siteRows = data.map((s: any) => ({
            id: s.name || s.siteName || s.id,
            site_id: s.siteId || 'S-01',
            name: s.name || s.siteName,
            site_name: s.siteName || s.name,
            category: s.category || 'Building',
            location: s.location || '',
            supervisor: s.supervisor || 'adminbilgi',
            client_name: s.clientName || '',
            gstin: s.gstin || '29UNREGISTERED',
            scope: s.detail || s.structureScope || 'G + 3 Floors',
            assigned_fleet: Number(s.assignedFleet || 4),
            status: s.status || 'active',
            updated_at: new Date().toISOString()
          }));

          if (siteRows.length > 0) {
            await (client as any)
              .from('sites')
              .upsert(siteRows, { onConflict: 'id' });
          }
        }
      }

      // INVOICES TABLE
      else if (key.startsWith('concrete360_site_invoices_')) {
        const siteName = key.replace('concrete360_site_invoices_', '');
        if (Array.isArray(data)) {
          const invoiceRows = data.map((inv: any) => ({
            id: String(inv.id || `${siteName}-${inv.invoiceNo || Date.now()}`),
            site_name: siteName,
            invoice_no: String(inv.invoiceNo || inv.id || 'INV-001'),
            date: inv.date || new Date().toISOString().split('T')[0],
            customer_name: inv.customerName || siteName,
            customer_gst: inv.customerGst || '',
            mix_grade: inv.mixGrade || 'M25',
            volume_m3: Number(inv.volumeM3 || 0),
            rate_per_m3: Number(inv.ratePerM3 || 0),
            basic_amount: Number(inv.basicAmount || 0),
            cgst_amount: Number(inv.cgstAmount || 0),
            sgst_amount: Number(inv.sgstAmount || 0),
            total_tax: Number(inv.totalTax || 0),
            total_amount: Number(inv.totalAmount || 0),
            vehicle_no: inv.vehicleNo || '',
            payment_mode: inv.paymentMode || 'PENDING',
            payment_status: inv.paymentStatus || 'UNPAID',
            raw_data: inv,
            updated_at: new Date().toISOString()
          }));

          if (invoiceRows.length > 0) {
            await (client as any)
              .from('invoices')
              .upsert(invoiceRows, { onConflict: 'id' });
          }
        }
      }

      // HAULAGE TRIPS TABLE
      else if (key.startsWith('concrete360_site_haulage_trips_') || key.startsWith('concrete360_haul_trips_')) {
        const siteName = key.replace('concrete360_site_haulage_trips_', '').replace('concrete360_haul_trips_', '');
        if (Array.isArray(data)) {
          const tripRows = data.map((t: any) => ({
            id: String(t.id || `trip-${Date.now()}`),
            site_name: siteName,
            trip_date: t.tripDate || new Date().toISOString().split('T')[0],
            vehicle_number: t.vehicleNumber || '',
            material_name: t.materialName || 'Aggregate',
            purchased_from: t.purchasedFrom || '',
            day_trips: Number(t.dayTrips || 1),
            brass_per_trip: Number(t.brassPerTrip || 0),
            rate_per_brass: Number(t.ratePerBrass || 0),
            total_amount: Number(t.totalAmount || 0),
            updated_at: new Date().toISOString()
          }));

          if (tripRows.length > 0) {
            await (client as any)
              .from('haulage_trips')
              .upsert(tripRows, { onConflict: 'id' });
          }
        }
      }

      // SITE TESTS TABLE
      else if (key.startsWith('concrete360_site_tests_')) {
        const siteName = key.replace('concrete360_site_tests_', '');
        if (Array.isArray(data)) {
          const testRows = data.map((st: any) => ({
            id: String(st.id || `test-${Date.now()}`),
            site_name: siteName,
            test_date: st.testDate || new Date().toISOString().split('T')[0],
            mix_grade: st.mixGrade || 'M25',
            batch_vehicle_no: st.batchVehicleNo || '',
            slump_mm: Number(st.slumpMm || 0),
            concrete_temp_c: Number(st.concreteTempC || 0),
            cube_7day_mpa: st.cube7DayMpa ? Number(st.cube7DayMpa) : null,
            cube_28day_mpa: st.cube28DayMpa ? Number(st.cube28DayMpa) : null,
            test_status: st.testStatus || 'PASSED',
            tested_by: st.testedBy || 'adminbilgi',
            remarks: st.remarks || '',
            updated_at: new Date().toISOString()
          }));

          if (testRows.length > 0) {
            await (client as any)
              .from('site_tests')
              .upsert(testRows, { onConflict: 'id' });
          }
        }
      }

      // TRANSIT MIXER FLEET
      else if (key === 'concrete360_transit_mixers' || key.startsWith('concrete360_transit_mixers_')) {
        if (Array.isArray(data)) {
          const mixerRows = data.map((tm: any) => ({
            id: String(tm.id || tm.vehicleNo),
            vehicle_no: tm.vehicleNo || tm.truckNumber || 'KA-01',
            equipment_type: tm.equipmentType || 'Transit Mixer (TM)',
            capacity_m3: Number(tm.capacityM3 || 6),
            driver_name: tm.driverName || '',
            driver_phone: tm.driverPhone || '',
            status: tm.status || 'Active on Site',
            ownership: tm.ownership || 'Company',
            is_active: tm.isActive !== false,
            site_key: tm.siteKey || '',
            notes: tm.notes || '',
            updated_at: new Date().toISOString()
          }));

          if (mixerRows.length > 0) {
            await (client as any)
              .from('transit_mixers')
              .upsert(mixerRows, { onConflict: 'id' });
          }
        }
      }

      // COMPANY PROFILE
      else if (key === 'concrete360_company_profile') {
        await (client as any)
          .from('company_profile')
          .upsert({
            id: 'primary_company',
            name: data.name || 'BILGI RMC',
            gstin: data.gstin || '29AKMKMJNJN1',
            address: data.address || '',
            division: data.division || '',
            bank_name: data.bankName || '',
            account_name: data.accountName || '',
            account_no: data.accountNo || '',
            ifsc_swift: data.ifscSwift || '',
            branch: data.branch || '',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('[CloudStorage] Relational sync warning:', e);
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
          .eq('storage_key', key);
      }
    };
  }

  /**
   * Realtime subscription for cross-device live sync
   */
  private subscribeRealtime() {
    const client = supabase;
    if (!client) return;

    try {
      client
        .channel('schema_sync_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sites' },
          () => void this.pullFromCloud()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoices' },
          () => void this.pullFromCloud()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'haulage_trips' },
          () => void this.pullFromCloud()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'site_tests' },
          () => void this.pullFromCloud()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transit_mixers' },
          () => void this.pullFromCloud()
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'app_data_store' },
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
                  const currentActive =
                    sessionStorage.getItem('concrete360_selected_site') ||
                    localStorage.getItem('concrete360_selected_site');
                  if (currentActive) {
                    window.dispatchEvent(
                      new CustomEvent('concrete360_site_switched', { detail: currentActive })
                    );
                  }
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
      console.warn('[CloudStorage] Realtime subscription warning:', e);
    }
  }
}

export const cloudStorage = new CloudStorageService();
