import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  RotateCcw, 
  Printer, 
  Plus, 
  X, 
  Trash2, 
  Edit3, 
  Eye, 
  FlaskConical
} from 'lucide-react';

interface LedgerItem {
  id: string;
  type: 'INVOICE' | 'HAULAGE';
  vehicleNo: string;
  invoiceNo: string;
  date: string;
  clientName: string;
  mixGrade: string;
  volumeM3: number;
  grandTotal: number;
  originalData?: any;
}

interface VehicleItem {
  id?: string;
  vehicleNo: string;
  equipmentType: string;
  rent?: number;
  tariff?: number;
}

export interface ConcreteSiteTest {
  id: string;
  testDate: string;
  siteKey: string;
  mixGrade: string;
  batchVehicleNo: string;
  slumpMm: number;
  concreteTempC: number;
  cube7DayMpa?: number;
  cube28DayMpa?: number;
  testStatus: 'PASSED' | 'PENDING' | 'FAILED';
  testedBy: string;
  remarks?: string;
}

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'MBBILGI';
  let clean = String(name).trim();
  if (clean.includes('(')) {
    clean = clean.split('(')[0].trim();
  }
  return clean.toUpperCase();
};

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
};

const getCurrentMonthBounds = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { start: format(firstDay), end: format(lastDay) };
};

export const TotalBillPage: React.FC = () => {
  const getUserRole = (): 'ADMIN' | 'EMPLOYEE' | 'READ_ONLY' => {
    try {
      const userRaw = sessionStorage.getItem('concrete360_user');
      if (userRaw) {
        const parsed = JSON.parse(userRaw);
        const r = String(parsed.role || '').toUpperCase();
        if (r === 'SUPER_ADMIN' || r === 'ADMIN') return 'ADMIN';
        if (r === 'READ_ONLY' || r === 'AUDITOR') return 'READ_ONLY';
        return 'EMPLOYEE';
      }
    } catch {}
    return 'ADMIN';
  };

  const userRole = getUserRole();
  const canCreate = userRole === 'ADMIN' || userRole === 'EMPLOYEE';
  const canEditOrDelete = userRole === 'ADMIN';
  const canPrint = userRole === 'ADMIN' || userRole === 'EMPLOYEE';

  const getActiveSiteKey = () => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        try {
          const parsed = JSON.parse(activeRaw);
          return extractCleanSiteName(parsed.name || parsed.siteName || parsed.id);
        } catch {
          return extractCleanSiteName(activeRaw);
        }
      }
      const selected = sessionStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);
    } catch {}
    return 'MBBILGI';
  };

  const [currentSiteKey, setCurrentSiteKey] = useState<string>(getActiveSiteKey());
  const [ledgerItems, setLedgerItems] = useState<LedgerItem[]>([]);
  const [siteTests, setSiteTests] = useState<ConcreteSiteTest[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleItem[]>([]);

  const monthBounds = getCurrentMonthBounds();
  const [fromDate, setFromDate] = useState<string>(monthBounds.start);
  const [toDate, setToDate] = useState<string>(monthBounds.end);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [tripData, setTripData] = useState({
    trip_date: new Date().toISOString().split('T')[0],
    vehicle_number: '',
    pump_type: 'Boom Pump',
    rent: 5000
  });

  const loadData = () => {
    const siteKey = getActiveSiteKey();
    setCurrentSiteKey(siteKey);
    try {
      // 1. Invoices
      const savedInvoices = localStorage.getItem(`concrete360_site_invoices_${siteKey}`);
      const parsedInvoices = savedInvoices ? JSON.parse(savedInvoices) : [];
      const invoiceLedger: LedgerItem[] = Array.isArray(parsedInvoices)
        ? parsedInvoices.map((inv: any) => ({
            id: inv.id,
            type: 'INVOICE',
            vehicleNo: inv.vehicleNo || 'N/A',
            invoiceNo: inv.invoiceNo || inv.id,
            date: inv.date,
            clientName: inv.clientName || siteKey,
            mixGrade: inv.mixGrade || 'M25',
            volumeM3: Number(inv.volumeM3) || 0,
            grandTotal: Number(inv.grandTotal) || 0
          }))
        : [];

      // 2. Haulage / Rental Trips
      const savedTrips = localStorage.getItem(`concrete360_site_haulage_trips_${siteKey}`);
      const parsedTrips = savedTrips ? JSON.parse(savedTrips) : [];
      const haulageLedger: LedgerItem[] = Array.isArray(parsedTrips)
        ? parsedTrips.map((trip: any) => ({
            id: trip.id,
            type: 'HAULAGE',
            vehicleNo: trip.vehicle || trip.vehicle_number || trip.vehicleNumber || 'PUMP',
            invoiceNo: `RENT-${trip.vehicle || trip.vehicle_number || trip.vehicleNumber || 'PUMP'}`,
            date: trip.date || trip.tripDate,
            clientName: `${trip.pumpType || trip.rawMaterial || 'Pump'}`,
            mixGrade: 'Vehicle Rental & Haulage',
            volumeM3: 0,
            grandTotal: Number(trip.totalAmount || trip.rentAmount || trip.rent) || 0,
            originalData: trip
          }))
        : [];

      setLedgerItems([...invoiceLedger, ...haulageLedger]);

      // 3. QA / QC Concrete Tests
      const savedTests = localStorage.getItem(`concrete360_site_tests_${siteKey}`);
      if (savedTests) {
        const parsedT = JSON.parse(savedTests);
        if (Array.isArray(parsedT)) setSiteTests(parsedT);
      } else {
        setSiteTests([
          {
            id: 'TEST-101',
            testDate: new Date().toISOString().split('T')[0],
            siteKey,
            mixGrade: 'M25',
            batchVehicleNo: '7196',
            slumpMm: 120,
            concreteTempC: 28,
            cube7DayMpa: 19.5,
            cube28DayMpa: 28.2,
            testStatus: 'PASSED',
            testedBy: 'QC Engineer',
            remarks: 'Workability & target slump compliant as per IS 1199'
          }
        ]);
      }

      // 4. Vehicles
      const savedVehicles = localStorage.getItem(`concrete360_transit_mixers_${siteKey}`) || localStorage.getItem('concrete360_transit_mixers');
      if (savedVehicles) {
        const parsedV = JSON.parse(savedVehicles);
        if (Array.isArray(parsedV)) setVehicleOptions(parsedV);
      }
    } catch {
      setLedgerItems([]);
      setSiteTests([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('concrete360_transit_mixer_updated', handleSync);
    window.addEventListener('concrete360_site_tests_updated', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('concrete360_transit_mixer_updated', handleSync);
      window.removeEventListener('concrete360_site_tests_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const handleVehicleChange = (selectedVehicleNo: string) => {
    const found = vehicleOptions.find(v => v.vehicleNo === selectedVehicleNo);
    if (found) {
      setTripData(prev => ({
        ...prev,
        vehicle_number: found.vehicleNo,
        pump_type: found.equipmentType || prev.pump_type,
        rent: Number(found.rent || found.tariff || prev.rent || 0)
      }));
    } else {
      setTripData(prev => ({ ...prev, vehicle_number: selectedVehicleNo }));
    }
  };

  const handleOpenAddModal = () => {
    if (!canCreate) {
      alert('Permission Denied: Read-Only accounts cannot log trips.');
      return;
    }
    setEditingTripId(null);
    setTripData({
      trip_date: new Date().toISOString().split('T')[0],
      vehicle_number: '',
      pump_type: 'Boom Pump',
      rent: 5000
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: LedgerItem) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can edit records.');
      return;
    }
    if (item.type !== 'HAULAGE' || !item.originalData) return;
    const trip = item.originalData;
    setEditingTripId(trip.id);
    setTripData({
      trip_date: trip.date || trip.tripDate || new Date().toISOString().split('T')[0],
      vehicle_number: trip.vehicle || trip.vehicle_number || trip.vehicleNumber || '',
      pump_type: trip.pumpType || 'Boom Pump',
      rent: Number(trip.totalAmount || trip.rentAmount || trip.rent || 5000)
    });
    setIsModalOpen(true);
  };

  const handleDeleteHaulageTrip = (item: LedgerItem) => {
    if (!canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can delete records.');
      return;
    }
    if (item.type !== 'HAULAGE') return;
    if (!window.confirm(`Are you sure you want to delete rental record for vehicle ${item.vehicleNo}?`)) return;

    try {
      const savedTrips = JSON.parse(localStorage.getItem(`concrete360_site_haulage_trips_${currentSiteKey}`) || '[]');
      const updatedTrips = savedTrips.filter((t: any) => t.id !== item.id && t.id !== item.originalData?.id);
      localStorage.setItem(`concrete360_site_haulage_trips_${currentSiteKey}`, JSON.stringify(updatedTrips));
      loadData();
    } catch {}
  };

  const handleSaveTripRecord = () => {
    if (!canCreate) return;
    if (editingTripId && !canEditOrDelete) {
      alert('Permission Denied: Only ADMIN accounts can modify records.');
      return;
    }

    const totalAmount = tripData.rent;
    const selectedVehicleNo = tripData.vehicle_number || 'KA-28-EX-0000';
    const savedTrips = JSON.parse(localStorage.getItem(`concrete360_site_haulage_trips_${currentSiteKey}`) || '[]');

    let updatedTrips;
    if (editingTripId) {
      updatedTrips = savedTrips.map((t: any) => {
        if (t.id === editingTripId) {
          return {
            ...t,
            date: tripData.trip_date,
            vehicle: selectedVehicleNo,
            pumpType: tripData.pump_type,
            rentAmount: tripData.rent,
            totalAmount: totalAmount
          };
        }
        return t;
      });
    } else {
      const newTrip = {
        id: 'TRIP-' + Date.now(),
        date: tripData.trip_date,
        vehicle: selectedVehicleNo,
        rawMaterial: 'Pump Rental',
        pumpType: tripData.pump_type,
        rentAmount: tripData.rent,
        totalAmount: totalAmount
      };
      updatedTrips = [newTrip, ...savedTrips];
    }

    localStorage.setItem(`concrete360_site_haulage_trips_${currentSiteKey}`, JSON.stringify(updatedTrips));
    loadData();
    setIsModalOpen(false);
  };

  // Filtered Ledger Items
  const filteredItems = ledgerItems.filter(item => {
    if (!item.date) return true;
    if (fromDate && item.date < fromDate) return false;
    if (toDate && item.date > toDate) return false;
    return true;
  });

  // Filtered Quality Tests
  const filteredTests = siteTests.filter(t => {
    if (!t.testDate) return true;
    if (fromDate && t.testDate < fromDate) return false;
    if (toDate && t.testDate > toDate) return false;
    return true;
  });

  const totalBillSum = filteredItems.reduce((sum, item) => sum + (Number(item.grandTotal) || 0), 0);
  const totalVolDelivered = filteredItems.reduce((sum, item) => sum + (Number(item.volumeM3) || 0), 0);

  const handlePrintSummary = () => {
    if (!canPrint) {
      alert('Permission Denied: Read-Only accounts cannot print records.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let compProfile = {
      name: 'BILGI RMC',
      gstin: '29AKMKMJNJN1',
      address: 'AINAPUR',
      division: 'Commercial Ready-Mix Concrete Batching & Supply Division',
      bankName: 'KOTAK MAHINDRA BANK',
      accountName: 'M/s MOHAMMED JAFAR BASHEER AHMED BILGI',
      accountNumber: '9449817122',
      ifsc: 'KKBK0008324',
      branch: 'JALANAGAR, HUDCO'
    };

    try {
      const savedProf = localStorage.getItem('concrete360_company_profile');
      if (savedProf) {
        const parsedP = JSON.parse(savedProf);
        compProfile = { ...compProfile, ...parsedP };
      }
    } catch {}

    printWindow.document.write(`
      <html>
        <head>
          <title>TOTAL BILL & SITE SUMMARY - ${currentSiteKey}</title>
          <style>
            @page {
              size: auto;
              margin: 5mm;
            }
            body { font-family: Helvetica, Arial, sans-serif; padding: 15px; color: #111; font-size: 11px; line-height: 1.4; margin: 0; }
            .top-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; }
            .brand h1 { font-size: 20px; font-weight: 900; color: #0f172a; margin: 0; }
            .brand p { font-size: 9px; color: #475569; margin: 3px 0 0 0; }
            .orange-bar { border-bottom: 2px solid #f97316; margin-top: 10px; margin-bottom: 15px; }
            .parties { display: flex; justify-content: space-between; border: 1px solid #cbd5e1; margin-bottom: 15px; background: #f8fafc; }
            .party-box { width: 50%; padding: 10px; }
            .party-box:first-child { border-right: 1px solid #cbd5e1; }
            .party-title { font-weight: bold; font-size: 10px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { background: #0f172a; color: #ffffff; font-size: 9px; font-weight: bold; text-transform: uppercase; padding: 6px 8px; text-align: left; border: 1px solid #0f172a; }
            td { padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .bottom-section { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 15px; }
            .bank-box { width: 55%; border: 1px solid #cbd5e1; padding: 10px; background: #f8fafc; font-size: 10px; }
            .totals-box { width: 42%; border: 1px solid #cbd5e1; }
            .totals-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #cbd5e1; font-size: 10px; }
            .totals-row:last-child { border-bottom: none; font-weight: bold; background: #f1f5f9; font-size: 11px; color: #0f172a; }
            .section-header { background: #e2e8f0; font-weight: bold; font-size: 10px; padding: 6px 8px; text-transform: uppercase; border: 1px solid #cbd5e1; margin-top: 15px; border-bottom: none; }
            .badge { display: inline-block; padding: 2px 6px; font-size: 9px; font-weight: bold; border-radius: 4px; }
            .badge-passed { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
            .badge-pending { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          </style>
        </head>
        <body>
          <div class="top-header">
            <div class="brand">
              <h1>${compProfile.name}</h1>
              <p>${compProfile.division}<br/>Corporate Office: ${compProfile.address}<br/>Company GSTIN: <strong>${compProfile.gstin}</strong></p>
            </div>
            <div style="text-align: right; font-size: 10px;">
              Date: <strong>${formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</strong>
            </div>
          </div>
          <div class="orange-bar"></div>

          <div class="parties">
            <div class="party-box">
              <div class="party-title">BILLED TO (BUYER DETAILS):</div>
              <div><strong>${currentSiteKey}</strong></div>
              <div>Site Location: AINAPUR</div>
              <div>Payment Terms: Advance</div>
            </div>
            <div class="party-box">
              <div class="party-title">DISPATCH DESTINATION:</div>
              <div><strong>Project Site:</strong> ${currentSiteKey}</div>
              <div><strong>Total Ledger Entries:</strong> ${filteredItems.length} records</div>
            </div>
          </div>

          <!-- PRIMARY FINANCIAL LEDGER TABLE -->
          <table>
            <thead>
              <tr>
                <th style="width: 5%;">#</th>
                <th style="width: 15%;">Date</th>
                <th style="width: 20%;">Vehicle No</th>
                <th style="width: 30%;">Client / Equipment</th>
                <th style="width: 15%;">Volume / Category</th>
                <th style="width: 15%;" class="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredItems.length === 0 ? `
                <tr><td colspan="6" style="text-align: center; padding: 15px;">No records found for this range.</td></tr>
              ` : filteredItems.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${formatDateDDMMYYYY(item.date)}</td>
                  <td><strong>${item.vehicleNo}</strong></td>
                  <td>${item.clientName}</td>
                  <td>${item.type === 'INVOICE' ? `${item.volumeM3} m³` : 'Rental'}</td>
                  <td class="text-right">₹${item.grandTotal.toLocaleString('en-IN')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="bottom-section">
            <div class="bank-box">
              <div style="font-weight: bold; font-size: 10px; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin-bottom: 5px;">COMPANY REMITTANCE BANK ACCOUNT:</div>
              <div>Bank Name: <strong>${compProfile.bankName}</strong></div>
              <div>Account Name: <strong>${compProfile.accountName}</strong></div>
              <div>Account Number: <strong>${compProfile.accountNumber}</strong></div>
              <div>IFSC / Swift: <strong>${compProfile.ifsc}</strong> | Branch: ${compProfile.branch}</div>
            </div>

            <div class="totals-box">
              <div class="totals-row"><span>Total Concrete Volume:</span><span>${totalVolDelivered.toFixed(2)} m³</span></div>
              <div class="totals-row" style="font-weight: bold; background: #f1f5f9; color: #0f172a; font-size: 11px;"><span>TOTAL SITE FINANCIAL LEDGER:</span><span>₹${totalBillSum.toLocaleString('en-IN')}</span></div>
            </div>
          </div>

          <!-- AT-SITE QUALITY ASSURANCE & CONCRETE TESTS REPORT -->
          <div class="section-header">At-Site Concrete Sampling & Slump Test Verification (IS 456 / IS 1199 Standard)</div>
          <table>
            <thead>
              <tr>
                <th style="width: 12%;">Test ID</th>
                <th style="width: 12%;">Date</th>
                <th style="width: 14%;">TM Truck #</th>
                <th style="width: 10%;">Grade</th>
                <th style="width: 14%;">Slump (mm)</th>
                <th style="width: 10%;">Temp (°C)</th>
                <th style="width: 14%;">7d Strength</th>
                <th style="width: 14%;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTests.length === 0 ? `
                <tr><td colspan="8" style="text-align: center; padding: 12px;">No concrete quality test logs found for this site.</td></tr>
              ` : filteredTests.map(test => `
                <tr>
                  <td><strong>${test.id}</strong></td>
                  <td>${formatDateDDMMYYYY(test.testDate)}</td>
                  <td>${test.batchVehicleNo}</td>
                  <td><strong>${test.mixGrade}</strong></td>
                  <td>${test.slumpMm} mm</td>
                  <td>${test.concreteTempC} °C</td>
                  <td>${test.cube7DayMpa ? `${test.cube7DayMpa} MPa` : '—'}</td>
                  <td class="text-center">
                    <span class="badge ${test.testStatus === 'PASSED' ? 'badge-passed' : 'badge-pending'}">
                      ${test.testStatus}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 25px; display: flex; justify-content: space-between; font-size: 10px; color: #334155;">
            <div>
              QC Remarks: At-site concrete sampled strictly in compliance with IS 456 sampling specifications.
            </div>
            <div style="text-align: center; border-top: 1px solid #475569; width: 180px; padding-top: 4px;">
              Authorized QC Signatory
            </div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            SITE FINANCIAL LEDGER ({currentSiteKey})
          </span>
          <h2 className="text-xl font-black text-white mt-1">Total Bill & Site QA Summary</h2>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer rounded-xl shadow-lg shadow-blue-600/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Log Haulage Trips</span>
            </button>
          )}

          {canPrint && (
            <button
              onClick={handlePrintSummary}
              className="px-4 py-2 bg-[#121d2f] hover:bg-[#1a2847] border border-[#1E293B] text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer rounded-xl transition"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Print QA Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Card Banner */}
      <div className="bg-[#0b1322] border border-[#1b273d] p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 font-mono">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
              Total Financial Ledger ({currentSiteKey})
            </span>
            <div className="text-3xl font-black text-emerald-400 mt-0.5">
              ₹{totalBillSum.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div className="border-t sm:border-t-0 sm:border-l border-[#17253d] pt-4 sm:pt-0 sm:pl-6 text-right w-full sm:w-auto">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
            Total Billed Concrete Volume
          </span>
          <div className="text-xl font-black text-cyan-400 mt-0.5">
            {totalVolDelivered.toFixed(2)} <span className="text-xs text-slate-400 font-sans">m³</span>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <span className="text-slate-400 text-[10px] font-bold uppercase">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <span className="text-slate-400 text-[10px] font-bold uppercase">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            />
          </div>

          {(fromDate || toDate) && (
            <button
              onClick={() => {
                const b = getCurrentMonthBounds();
                setFromDate(b.start);
                setToDate(b.end);
              }}
              className="px-3 py-2 bg-[#070d1a] hover:bg-[#121c2d] border border-[#1b273d] text-slate-300 hover:text-white rounded-xl transition cursor-pointer flex items-center gap-1.5"
              title="Reset to Current Month"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset Month</span>
            </button>
          )}
        </div>

        <div className="text-slate-400 text-right">
          Showing <strong className="text-white">{filteredItems.length}</strong> ledger records
        </div>
      </div>

      {/* Primary Financial Ledger Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="px-6 py-4 border-b border-[#1b273d] bg-[#070d1a] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Delivery & Equipment Invoices
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            {filteredItems.length} Entries
          </span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]/50">
                <th className="py-4 px-6">Date</th>
                <th className="py-4 px-6">Vehicle No</th>
                <th className="py-4 px-6">Client / Equipment</th>
                <th className="py-4 px-6">Grade / Category</th>
                <th className="py-4 px-6">Volume</th>
                <th className="py-4 px-6">Amount</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500 font-sans">
                    No records found for this site in the selected date range.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#0e1728] transition-colors group">
                    <td className="py-4 px-6 text-slate-300 font-bold">
                      {formatDateDDMMYYYY(item.date)}
                    </td>
                    <td className="py-4 px-6 text-amber-400 font-black text-sm">
                      {item.vehicleNo}
                    </td>
                    <td className="py-4 px-6 font-sans font-bold text-cyan-300">{item.clientName}</td>
                    <td className="py-4 px-6 text-cyan-400">{item.mixGrade}</td>
                    <td className="py-4 px-6 font-bold">{item.type === 'INVOICE' ? `${item.volumeM3} m³` : '-'}</td>
                    <td className="py-4 px-6 text-emerald-400 font-extrabold">₹{item.grandTotal.toLocaleString('en-IN')}</td>
                    <td className="py-4 px-6 text-right">
                      {item.type === 'HAULAGE' ? (
                        canEditOrDelete ? (
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit Rental Record"
                              className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-blue-600/20 text-blue-400 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHaulageTrip(item)}
                              title="Delete Rental Record"
                              className="p-1.5 rounded-lg bg-[#121d2f] hover:bg-rose-600/20 text-rose-400 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[10px] inline-flex items-center gap-1 font-mono">
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Only</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-600 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AT-SITE QUALITY ASSURANCE & CONCRETE TESTS REPORT IN DETAIL */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="px-6 py-4 border-b border-[#1b273d] bg-[#070d1a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Detailed At-Site Concrete Quality Testing Report
              </h3>
              <p className="text-[10px] text-slate-400 font-sans">
                Field slump & cube compressive verification as per IS 456 / IS 1199 specifications
              </p>
            </div>
          </div>
          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-1 rounded-full font-bold uppercase">
            Quality Telemetry
          </span>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]/50">
                <th className="py-4 px-6">Test ID</th>
                <th className="py-4 px-6">Test Date</th>
                <th className="py-4 px-6">TM Truck #</th>
                <th className="py-4 px-6">Mix Grade</th>
                <th className="py-4 px-6">Slump (mm)</th>
                <th className="py-4 px-6">Temp (°C)</th>
                <th className="py-4 px-6">7d Strength</th>
                <th className="py-4 px-6">28d Strength</th>
                <th className="py-4 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                    No concrete quality test logs recorded for this site.
                  </td>
                </tr>
              ) : (
                filteredTests.map((test) => (
                  <tr key={test.id} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-6 font-bold text-white whitespace-nowrap">
                      {test.id}
                    </td>
                    <td className="py-4 px-6 text-slate-300">
                      {formatDateDDMMYYYY(test.testDate)}
                    </td>
                    <td className="py-4 px-6 text-amber-400 font-black">
                      {test.batchVehicleNo}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        {test.mixGrade}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-bold text-cyan-300">
                      {test.slumpMm} mm
                    </td>
                    <td className="py-4 px-6 text-slate-300">
                      {test.concreteTempC}°C
                    </td>
                    <td className="py-4 px-6 text-emerald-400 font-bold">
                      {test.cube7DayMpa ? `${test.cube7DayMpa} MPa` : '—'}
                    </td>
                    <td className="py-4 px-6 text-emerald-400 font-bold">
                      {test.cube28DayMpa ? `${test.cube28DayMpa} MPa` : 'Pending'}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        test.testStatus === 'PASSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : test.testStatus === 'PENDING'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        {test.testStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log / Edit Haulage Trips Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans animate-in fade-in">
          <div className="bg-[#121824] border border-[#1e293b] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
              <div className="flex items-center gap-3">
                <div className="bg-cyan-500/10 p-2 rounded-xl text-cyan-400">
                  <Plus className="w-5 h-5" />
                </div>
                <h3 className="text-white font-semibold text-lg">
                  {editingTripId ? 'Edit Boom Pump / Rental Record' : 'Log Total Day Haulage Trips'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Trip Date *</label>
                <input 
                  type="date"
                  value={tripData.trip_date}
                  onChange={(e) => setTripData({...tripData, trip_date: e.target.value})}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Pump Type *</label>
                <select 
                  value={tripData.pump_type}
                  onChange={(e) => setTripData({...tripData, pump_type: e.target.value})}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-amber-400 font-medium text-sm outline-none focus:border-cyan-500"
                >
                  <option value="Boom Pump">Boom Pump</option>
                  <option value="Stationary Pump">Stationary Pump</option>
                  <option value="Transit Mixer">Transit Mixer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Vehicle Details *</label>
                <select 
                  value={tripData.vehicle_number}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500"
                >
                  <option value="">Select Concrete Pump / Vehicle No</option>
                  {vehicleOptions.map((v, idx) => (
                    <option key={idx} value={v.vehicleNo}>
                      {v.vehicleNo} ({v.equipmentType || 'Pump/Mixer'} {v.rent !== undefined ? `- ₹${v.rent}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Rent (₹) *</label>
                <input 
                  type="number"
                  value={tripData.rent}
                  onChange={(e) => setTripData({...tripData, rent: Number(e.target.value)})}
                  className="w-full bg-[#0b0f17] border border-[#2a374a] rounded-xl px-4 py-2.5 text-cyan-400 font-medium text-sm outline-none focus:border-cyan-500"
                />
              </div>

              <div className="bg-[#0b1322] border border-[#1e293b] rounded-xl p-4 flex items-center justify-between font-mono">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Total Day Amount:</span>
                  <span className="text-xs text-slate-500">(Auto-linked from selected vehicle record)</span>
                </div>
                <div className="text-amber-400 font-bold text-lg">
                  ₹{tripData.rent.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1e293b] bg-[#0b0f17]/50">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-xl text-sm text-slate-300 hover:text-white transition cursor-pointer">
                Cancel
              </button>
              <button onClick={handleSaveTripRecord} className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-5 py-2 rounded-xl text-sm shadow-lg shadow-blue-600/30 transition cursor-pointer">
                {editingTripId ? 'Update Record' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TotalBillPage;
