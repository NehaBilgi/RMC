import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

type StatusListener = (status: SyncStatus, message?: string) => void;

// Dedicated tables manage these keys — app_data_store MUST NOT overwrite them
const DEDICATED_STORAGE_KEYS = new Set([
  'concrete360_sites',
  'concrete360_ongoing_sites',
  'concrete360_company_profile',
  'concrete360_transit_mixers',
  'concrete360_theme',
  'concrete360_selected_site',
  'concrete360_active_site'
]);

class CloudStorageService {
  private status: SyncStatus = 'offline';
  private listeners: Set<StatusListener> = new Set();
  private pendingUploads: Map<string, any> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private isApplyingRemoteUpdate = false;
  private isPulling = false;

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

    // Purge any colliding cache keys from app_data_store once on startup
    try {
      void (client as any)
        .from('app_data_store')
        .delete()
        .in('storage_key', ['concrete360_sites', 'concrete360_ongoing_sites', 'concrete360_selected_site']);
    } catch {}

    await this.pullFromCloud();
    this.subscribeRealtime();
    this.startActivePolling();
  }

  /**
   * Active polling and focus triggers guarantee cross-device sync
   * even when WebSockets sleep on mobile phones or background tabs.
   */
  private startActivePolling() {
    if (typeof window === 'undefined') return;

    // Background poll every 4 seconds
    setInterval(() => {
      void this.pullFromCloud();
    }, 4000);

    // Immediate sync when tab/window receives focus
    window.addEventListener('focus', () => {
      void this.pullFromCloud();
    });

    // Handle mobile screen wake / tab switching
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void this.pullFromCloud();
      }
    });

    window.addEventListener('online', () => {
      void this.pullFromCloud();
    });
  }

  /**
   * Pulls all records from dedicated relational tables first (Sole Source of Truth)
   */
  public async pullFromCloud() {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;
    if (this.isPulling) return;

    this.isPulling = true;
    try {
      this.isApplyingRemoteUpdate = true;

      // 1. PULL DEDICATED SITES TABLE (Sole Authority for Sites)
      const { data: sitesData, error: sitesErr } = await (client as any)
        .from('sites')
        .select('*')
        .order('name');

      if (!sitesErr && Array.isArray(sitesData)) {
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

        // Write directly to both storage keys
        window.localStorage.setItem('concrete360_sites', JSON.stringify(formattedSites));
        window.localStorage.setItem('concrete360_ongoing_sites', JSON.stringify(formattedSites));
      }

      // 2. PULL DEDICATED INVOICES TABLE
      const { data: invoicesData } = await (client as any)
        .from('invoices')
        .select('*');

      if (invoicesData && Array.isArray(invoicesData)) {
        const invoicesBySite: Record<string, any[]> = {};
        invoicesData.forEach((inv: any) => {
          const sName = inv.site_name;
          if (!sName) return;
          if (!invoicesBySite[sName]) invoicesBySite[sName] = [];
          invoicesBySite[sName].push(inv.raw_data || {
            id: inv.id,
            invoiceNo: inv.invoice_no,
            date: inv.date,
            customerName: inv.customer_name,
            customerGst: inv.customer_gst,
            mixGrade: inv.mix_grade,
            volumeM3: Number(inv.volume_m3 || 0),
            ratePerM3: Number(inv.rate_per_m3 || 0),
            basicAmount: Number(inv.basic_amount || 0),
            cgstAmount: Number(inv.cgst_amount || 0),
            sgstAmount: Number(inv.sgst_amount || 0),
            totalTax: Number(inv.total_tax || 0),
            totalAmount: Number(inv.total_amount || 0),
            vehicleNo: inv.vehicle_no || '',
            paymentMode: inv.payment_mode || 'PENDING',
            paymentStatus: inv.payment_status || 'UNPAID'
          });
        });
        Object.entries(invoicesBySite).forEach(([sName, list]) => {
          window.localStorage.setItem(`concrete360_site_invoices_${sName}`, JSON.stringify(list));
        });
      }

      // 3. PULL DEDICATED HAULAGE TRIPS TABLE
      const { data: tripsData } = await (client as any)
        .from('haulage_trips')
        .select('*');

      if (tripsData && Array.isArray(tripsData)) {
        const tripsBySite: Record<string, any[]> = {};
        tripsData.forEach((t: any) => {
          const sName = t.site_name;
          if (!sName) return;
          if (!tripsBySite[sName]) tripsBySite[sName] = [];
          tripsBySite[sName].push({
            id: t.id,
            siteName: t.site_name,
            tripDate: t.trip_date,
            vehicleNumber: t.vehicle_number,
            materialName: t.material_name,
            purchasedFrom: t.purchased_from,
            dayTrips: Number(t.day_trips || 1),
            brassPerTrip: Number(t.brass_per_trip || 0),
            ratePerBrass: Number(t.rate_per_brass || 0),
            totalAmount: Number(t.total_amount || 0)
          });
        });
        Object.entries(tripsBySite).forEach(([sName, list]) => {
          window.localStorage.setItem(`concrete360_site_haulage_trips_${sName}`, JSON.stringify(list));
        });
      }

      // 4. PULL DEDICATED SITE TESTS TABLE
      const { data: testsData } = await (client as any)
        .from('site_tests')
        .select('*');

      if (testsData && Array.isArray(testsData)) {
        const testsBySite: Record<string, any[]> = {};
        testsData.forEach((st: any) => {
          const sName = st.site_name;
          if (!sName) return;
          if (!testsBySite[sName]) testsBySite[sName] = [];
          testsBySite[sName].push({
            id: st.id,
            siteName: st.site_name,
            testDate: st.test_date,
            mixGrade: st.mix_grade,
            batchVehicleNo: st.batch_vehicle_no,
            slumpMm: Number(st.slump_mm || 0),
            concreteTempC: Number(st.concrete_temp_c || 0),
            cube7DayMpa: st.cube_7day_mpa ? Number(st.cube_7day_mpa) : null,
            cube28DayMpa: st.cube_28day_mpa ? Number(st.cube_28day_mpa) : null,
            testStatus: st.test_status,
            testedBy: st.tested_by,
            remarks: st.remarks
          });
        });
        Object.entries(testsBySite).forEach(([sName, list]) => {
          window.localStorage.setItem(`concrete360_site_tests_${sName}`, JSON.stringify(list));
        });
      }

      // 5. PULL DEDICATED TRANSIT MIXERS TABLE
      const { data: mixersData } = await (client as any)
        .from('transit_mixers')
        .select('*');

      if (mixersData && Array.isArray(mixersData) && mixersData.length > 0) {
        const formattedMixers = mixersData.map((tm: any) => ({
          id: tm.id,
          vehicleNo: tm.vehicle_no,
          truckNumber: tm.vehicle_no,
          equipmentType: tm.equipment_type || 'Transit Mixer (TM)',
          capacityM3: Number(tm.capacity_m3 || 6),
          driverName: tm.driver_name || '',
          driverPhone: tm.driver_phone || '',
          status: tm.status || 'Active on Site',
          ownership: tm.ownership || 'Company',
          isActive: tm.is_active !== false,
          siteKey: tm.site_key || '',
          notes: tm.notes || ''
        }));
        window.localStorage.setItem('concrete360_transit_mixers', JSON.stringify(formattedMixers));
      }

      // 6. PULL DEDICATED COMPANY PROFILE TABLE
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

      // 7. PULL DEDICATED SITE MEASUREMENTS TABLE
      const { data: measurementsData } = await (client as any)
        .from('site_measurements')
        .select('*');

      if (measurementsData && Array.isArray(measurementsData)) {
        const measurementsBySite: Record<string, any[]> = {};
        measurementsData.forEach((m: any) => {
          const sName = m.site_name;
          if (!sName) return;
          if (!measurementsBySite[sName]) measurementsBySite[sName] = [];
          measurementsBySite[sName].push({
            id: m.id,
            elementName: m.element_name,
            mixGrade: m.mix_grade,
            lengthM: Number(m.length_m || 0),
            widthM: Number(m.width_m || 0),
            depthM: Number(m.depth_m || 0),
            quantity: Number(m.quantity || 1),
            volumeM3: Number(m.volume_m3 || 0),
            remarks: m.remarks || '',
            date: m.date || new Date().toISOString().split('T')[0]
          });
        });
        Object.entries(measurementsBySite).forEach(([sName, list]) => {
          window.localStorage.setItem(`concrete360_advanced_measurements_${sName}`, JSON.stringify(list));
        });
      }

      // 8. PULL APP DATA STORE (Auxiliary Keys ONLY, NEVER overwrite dedicated table keys)
      const { data: storeData } = await (client as any)
        .from('app_data_store')
        .select('storage_key, data');

      if (storeData && Array.isArray(storeData)) {
        storeData.forEach((row: any) => {
          const k = row.storage_key;
          if (
            k &&
            !DEDICATED_STORAGE_KEYS.has(k) &&
            !k.startsWith('concrete360_site_invoices_') &&
            !k.startsWith('concrete360_site_haulage_trips_') &&
            !k.startsWith('concrete360_site_tests_') &&
            !k.startsWith('concrete360_advanced_measurements_')
          ) {
            const serialized = typeof row.data === 'string' ? row.data : JSON.stringify(row.data);
            window.localStorage.setItem(k, serialized);
          }
        });
      }

      this.isApplyingRemoteUpdate = false;

      // Broadcast synchronized state to all listening components
      window.dispatchEvent(new CustomEvent('concrete360_cloud_synced'));
      const activeSite =
        sessionStorage.getItem('concrete360_selected_site') ||
        localStorage.getItem('concrete360_selected_site');
      if (activeSite) {
        window.dispatchEvent(new CustomEvent('concrete360_site_switched', { detail: activeSite }));
      }
      window.dispatchEvent(new Event('concrete360_user_updated'));

      this.setStatus('synced', 'Live synced with Supabase');
    } catch (err: any) {
      this.isApplyingRemoteUpdate = false;
      console.error('[CloudStorage] Pull error:', err);
      this.setStatus('error', err?.message || 'Sync failed');
    } finally {
      this.isPulling = false;
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
        if (
          key &&
          key.startsWith('concrete360_') &&
          !key.includes('theme') &&
          !key.includes('selected_site') &&
          !key.includes('active_site')
        ) {
          try {
            const rawVal = window.localStorage.getItem(key);
            if (rawVal) {
              const parsedVal = JSON.parse(rawVal);

              // Auxiliary keys to app_data_store
              if (
                !DEDICATED_STORAGE_KEYS.has(key) &&
                !key.startsWith('concrete360_site_invoices_') &&
                !key.startsWith('concrete360_site_haulage_trips_') &&
                !key.startsWith('concrete360_site_tests_')
              ) {
                storePayload.push({
                  storage_key: key,
                  data: parsedVal,
                  updated_at: new Date().toISOString()
                });
              }

              // Dedicated relational tables
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

    const isCritical =
      key.includes('site') ||
      key.includes('invoice') ||
      key.includes('trip') ||
      key.includes('test') ||
      key.includes('user') ||
      key.includes('mixer');

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

    const storePayload = items
      .filter(
        ([key]) =>
          !DEDICATED_STORAGE_KEYS.has(key) &&
          !key.startsWith('concrete360_site_invoices_') &&
          !key.startsWith('concrete360_site_haulage_trips_') &&
          !key.startsWith('concrete360_site_tests_')
      )
      .map(([key, val]) => ({
        storage_key: key,
        data: val,
        updated_at: new Date().toISOString()
      }));

    try {
      if (storePayload.length > 0) {
        await (client as any)
          .from('app_data_store')
          .upsert(storePayload, { onConflict: 'storage_key' });
      }

      // Sync dedicated relational tables
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

      // SITE MEASUREMENTS
      else if (key.startsWith('concrete360_advanced_measurements_')) {
        const siteName = key.replace('concrete360_advanced_measurements_', '');
        if (Array.isArray(data)) {
          const measurementRows = data.map((m: any) => ({
            id: String(m.id || `MEAS-${Date.now()}`),
            site_name: siteName,
            element_name: m.elementName || m.name || 'Structural Element',
            mix_grade: m.mixGrade || 'M25',
            length_m: Number(m.lengthM || 0),
            width_m: Number(m.widthM || 0),
            depth_m: Number(m.depthM || 0),
            quantity: Number(m.quantity || 1),
            volume_m3: Number(m.volumeM3 || 0),
            remarks: m.remarks || '',
            date: m.date || new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }));

          if (measurementRows.length > 0) {
            await (client as any)
              .from('site_measurements')
              .upsert(measurementRows, { onConflict: 'id' });
          }
        }
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'haulage_trips' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_tests' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transit_mixers' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'site_measurements' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_profile' }, () => void this.pullFromCloud())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_data_store' }, () => void this.pullFromCloud())
        .subscribe();
    } catch (e) {
      console.warn('[CloudStorage] Realtime subscription warning:', e);
    }
  }
}

export const cloudStorage = new CloudStorageService();
