import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Plus,
  Trash2,
  Printer,
  IndianRupee,
  AlertTriangle,
  CheckCircle2,
  X,
  TrendingDown,
  PackagePlus,
  Calendar,
} from 'lucide-react';
import { cloudStorage } from '../../services/cloudStorage';
import { supabase } from '../../lib/supabase';
import { BILGI_QA_REV2_GGBS } from './MixDesignModule';

export interface SiloInwardEntry {
  id: string;
  date: string;
  silo: 'SILO_1_CEMENT' | 'SILO_2_GGBS';
  supplierName: string;
  vehicleOrChallanNo: string;
  quantityKg: number;
  ratePerKg: number;
  totalAmount: number;
  remarks?: string;
}

const SILO_ENTRIES_STORAGE_KEY = 'concrete360_silo_inward_entries';

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
};

export const SiloInventoryPage: React.FC = () => {
  const [inwardEntries, setInwardEntries] = useState<SiloInwardEntry[]>(() => {
    try {
      const saved = localStorage.getItem(SILO_ENTRIES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [filterSilo, setFilterSilo] = useState<'ALL' | 'SILO_1_CEMENT' | 'SILO_2_GGBS'>('ALL');
  const [refreshTick, setRefreshTick] = useState(0);

  // Modal form state
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [silo, setSilo] = useState<'SILO_1_CEMENT' | 'SILO_2_GGBS'>('SILO_1_CEMENT');
  const [supplierName, setSupplierName] = useState<string>('');
  const [vehicleOrChallanNo, setVehicleOrChallanNo] = useState<string>('');
  const [quantityMT, setQuantityMT] = useState<string | number>(30);
  const [ratePerTon, setRatePerTon] = useState<string | number>(6800);
  const [remarks, setRemarks] = useState<string>('');

  // Silo capacities (default 60 MT each for CONMAT plant silos)
  const [silo1CapacityKg] = useState<number>(60000);
  const [silo2CapacityKg] = useState<number>(60000);

  useEffect(() => {
    void cloudStorage.pullFromCloud();
    const handleSync = () => setRefreshTick((t) => t + 1);
    window.addEventListener('concrete360_invoices_updated', handleSync);
    window.addEventListener('concrete360_mix_designs_updated', handleSync);
    window.addEventListener('concrete360_cloud_synced', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('concrete360_invoices_updated', handleSync);
      window.removeEventListener('concrete360_mix_designs_updated', handleSync);
      window.removeEventListener('concrete360_cloud_synced', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const handleSiloTypeChange = (selected: 'SILO_1_CEMENT' | 'SILO_2_GGBS') => {
    setSilo(selected);
    if (selected === 'SILO_1_CEMENT') {
      setQuantityMT(30);
      setRatePerTon(6800); // ₹340 per 50kg bag = ₹6,800/MT
    } else {
      setQuantityMT(30);
      setRatePerTon(3800); // ₹3,800/MT for GGBS
    }
  };

  // Calculate total inward stock & purchase expense from logged bulker/bag entries
  const inwardSummary = useMemo(() => {
    let silo1InwardKg = 0;
    let silo1PurchaseExpense = 0;
    let silo2InwardKg = 0;
    let silo2PurchaseExpense = 0;

    inwardEntries.forEach((entry) => {
      if (entry.silo === 'SILO_1_CEMENT') {
        silo1InwardKg += Number(entry.quantityKg) || 0;
        silo1PurchaseExpense += Number(entry.totalAmount) || 0;
      } else {
        silo2InwardKg += Number(entry.quantityKg) || 0;
        silo2PurchaseExpense += Number(entry.totalAmount) || 0;
      }
    });

    const avgSilo1RatePerKg = silo1InwardKg > 0 ? silo1PurchaseExpense / silo1InwardKg : 6.8;
    const avgSilo2RatePerKg = silo2InwardKg > 0 ? silo2PurchaseExpense / silo2InwardKg : 3.8;

    return {
      silo1InwardKg,
      silo1PurchaseExpense: Math.round(silo1PurchaseExpense),
      avgSilo1RatePerKg,
      silo2InwardKg,
      silo2PurchaseExpense: Math.round(silo2PurchaseExpense),
      avgSilo2RatePerKg,
      totalPurchaseExpense: Math.round(silo1PurchaseExpense + silo2PurchaseExpense),
    };
  }, [inwardEntries]);

  // Calculate total Cement & GGBS consumed across ALL sites from billed invoices
  const consumptionSummary = useMemo(() => {
    let totalCementUsedKg = 0;
    let totalGgbsUsedKg = 0;
    let totalBatchedVolumeM3 = 0;
    const siteBreakdown: Record<string, { volumeM3: number; cementKg: number; ggbsKg: number }> = {};

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('concrete360_site_invoices_')) {
          const siteKey = key.replace('concrete360_site_invoices_', '');
          const invoices = JSON.parse(localStorage.getItem(key) || '[]');
          const customMixes = JSON.parse(localStorage.getItem(`concrete360_mixes_${siteKey}_GGBS`) || '{}');

          if (Array.isArray(invoices)) {
            invoices.forEach((inv: any) => {
              const vol = Number(inv.volumeM3) || 0;
              const gradeKey = String(inv.mixGrade || 'M25').substring(0, 3).toUpperCase();
              const qaFallback = BILGI_QA_REV2_GGBS[gradeKey] || BILGI_QA_REV2_GGBS['M25'];
              const customMix = customMixes[gradeKey];

              const cementPerM3 = customMix ? Number(customMix.cementKg) : qaFallback.cementKg;
              const ggbsPerM3 = customMix ? Number(customMix.mineralAdmixtureKg) : qaFallback.mineralAdmixtureKg;

              const usedC = vol * cementPerM3;
              const usedG = vol * ggbsPerM3;

              totalBatchedVolumeM3 += vol;
              totalCementUsedKg += usedC;
              totalGgbsUsedKg += usedG;

              if (!siteBreakdown[siteKey]) {
                siteBreakdown[siteKey] = { volumeM3: 0, cementKg: 0, ggbsKg: 0 };
              }
              siteBreakdown[siteKey].volumeM3 += vol;
              siteBreakdown[siteKey].cementKg += usedC;
              siteBreakdown[siteKey].ggbsKg += usedG;
            });
          }
        }
      }
    } catch {}

    const silo1LeftKg = inwardSummary.silo1InwardKg - totalCementUsedKg;
    const silo2LeftKg = inwardSummary.silo2InwardKg - totalGgbsUsedKg;

    const cementConsumedCost = Math.round(totalCementUsedKg * inwardSummary.avgSilo1RatePerKg);
    const ggbsConsumedCost = Math.round(totalGgbsUsedKg * inwardSummary.avgSilo2RatePerKg);

    return {
      totalBatchedVolumeM3: Number(totalBatchedVolumeM3.toFixed(2)),
      cementUsedKg: Math.round(totalCementUsedKg),
      ggbsUsedKg: Math.round(totalGgbsUsedKg),
      silo1LeftKg: Math.round(silo1LeftKg),
      silo2LeftKg: Math.round(silo2LeftKg),
      cementConsumedCost,
      ggbsConsumedCost,
      totalConsumedCost: cementConsumedCost + ggbsConsumedCost,
      siteBreakdown,
    };
  }, [inwardSummary, refreshTick]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const qtyKg = Math.round((Number(quantityMT) || 0) * 1000);
    const rateKg = (Number(ratePerTon) || 0) / 1000;
    const totalAmt = Math.round(qtyKg * rateKg);

    if (qtyKg <= 0) return;

    const newEntry: SiloInwardEntry = {
      id: `SILO-${Date.now()}`,
      date,
      silo,
      supplierName: supplierName.trim() || (silo === 'SILO_1_CEMENT' ? 'OPC 53 Bulker Supply' : 'JSW / Local GGBS Supply'),
      vehicleOrChallanNo: vehicleOrChallanNo.trim().toUpperCase() || 'N/A',
      quantityKg: qtyKg,
      ratePerKg: Number(rateKg.toFixed(2)),
      totalAmount: totalAmt,
      remarks: remarks.trim(),
    };

    const updated = [newEntry, ...inwardEntries];
    setInwardEntries(updated);
    localStorage.setItem(SILO_ENTRIES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('concrete360_silo_updated'));

    if (supabase) {
      void (supabase as any).from('silo_inward_entries').upsert({
        id: newEntry.id,
        date: newEntry.date,
        silo: newEntry.silo,
        supplier_name: newEntry.supplierName,
        vehicle_or_challan_no: newEntry.vehicleOrChallanNo,
        quantity_kg: newEntry.quantityKg,
        rate_per_kg: newEntry.ratePerKg,
        total_amount: newEntry.totalAmount,
        remarks: newEntry.remarks || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    setIsModalOpen(false);
    setSupplierName('');
    setVehicleOrChallanNo('');
    setRemarks('');
    setToastMsg(`Added ${(qtyKg / 1000).toFixed(2)} MT to ${silo === 'SILO_1_CEMENT' ? 'Silo 1 (OPC 53 Cement)' : 'Silo 2 (GGBS)'}`);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleDeleteEntry = (id: string) => {
    const updated = inwardEntries.filter((item) => item.id !== id);
    setInwardEntries(updated);
    localStorage.setItem(SILO_ENTRIES_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('concrete360_silo_updated'));

    if (supabase) {
      void (supabase as any).from('silo_inward_entries').delete().eq('id', id);
    }
  };

  const filteredEntries = useMemo(() => {
    if (filterSilo === 'ALL') return inwardEntries;
    return inwardEntries.filter((e) => e.silo === filterSilo);
  }, [inwardEntries, filterSilo]);

  const handlePrintSiloReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const siteRows = Object.entries(consumptionSummary.siteBreakdown)
      .map(
        ([site, data]) => `
        <tr>
          <td><strong>${site}</strong></td>
          <td class="right">${data.volumeM3.toFixed(2)} m³</td>
          <td class="right">${Math.round(data.cementKg).toLocaleString('en-IN')} kg</td>
          <td class="right">${Math.round(data.ggbsKg).toLocaleString('en-IN')} kg</td>
        </tr>
      `
      )
      .join('');

    const ledgerRows = filteredEntries
      .map(
        (entry, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDateDDMMYYYY(entry.date)}</td>
          <td><strong>${entry.silo === 'SILO_1_CEMENT' ? 'Silo 1 (OPC 53 Cement)' : 'Silo 2 (GGBS)'}</strong></td>
          <td>${entry.supplierName}</td>
          <td>${entry.vehicleOrChallanNo}</td>
          <td class="right">${(entry.quantityKg / 1000).toFixed(2)} MT (${entry.quantityKg.toLocaleString('en-IN')} kg)</td>
          <td class="right">₹${(entry.ratePerKg * 1000).toLocaleString('en-IN')} / MT</td>
          <td class="right"><strong>₹${entry.totalAmount.toLocaleString('en-IN')}</strong></td>
        </tr>
      `
      )
      .join('');

    win.document.write(`
      <html>
        <head>
          <title>Silo 1 & Silo 2 Stock & Expense Statement - BILGI BUILDCON RMC</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; }
            .header h1 { margin: 0; font-size: 18px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
            th { background: #0f172a; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
            td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; }
            .right { text-align: right; }
            .section-title { font-size: 11px; font-weight: bold; text-transform: uppercase; margin: 14px 0 6px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>BILGI BUILDCON RMC</h1>
              <div style="font-size:10px;color:#475569;">CONMAT Batching Plant • Silo 1 (OPC 53) & Silo 2 (GGBS) Stock & Expense Report</div>
            </div>
            <div style="text-align:right;font-size:10px;">
              Generated: <strong>${formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</strong>
            </div>
          </div>

          <div class="section-title">1. Live Silo Balance & Expense Summary</div>
          <table>
            <thead>
              <tr>
                <th>Storage Silo</th>
                <th class="right">Total Inward Stock</th>
                <th class="right">Total Consumed</th>
                <th class="right">Balance Left in Silo</th>
                <th class="right">Total Inward Expense</th>
                <th class="right">Consumed Material Cost</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Silo 1 — OPC 53 Cement</strong></td>
                <td class="right">${(inwardSummary.silo1InwardKg / 1000).toFixed(2)} MT</td>
                <td class="right">${(consumptionSummary.cementUsedKg / 1000).toFixed(2)} MT (${consumptionSummary.cementUsedKg.toLocaleString('en-IN')} kg)</td>
                <td class="right"><strong>${(consumptionSummary.silo1LeftKg / 1000).toFixed(2)} MT (${consumptionSummary.silo1LeftKg.toLocaleString('en-IN')} kg)</strong></td>
                <td class="right">₹${inwardSummary.silo1PurchaseExpense.toLocaleString('en-IN')}</td>
                <td class="right">₹${consumptionSummary.cementConsumedCost.toLocaleString('en-IN')}</td>
              </tr>
              <tr>
                <td><strong>Silo 2 — GGBS (IS 16714)</strong></td>
                <td class="right">${(inwardSummary.silo2InwardKg / 1000).toFixed(2)} MT</td>
                <td class="right">${(consumptionSummary.ggbsUsedKg / 1000).toFixed(2)} MT (${consumptionSummary.ggbsUsedKg.toLocaleString('en-IN')} kg)</td>
                <td class="right"><strong>${(consumptionSummary.silo2LeftKg / 1000).toFixed(2)} MT (${consumptionSummary.silo2LeftKg.toLocaleString('en-IN')} kg)</strong></td>
                <td class="right">₹${inwardSummary.silo2PurchaseExpense.toLocaleString('en-IN')}</td>
                <td class="right">₹${consumptionSummary.ggbsConsumedCost.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          ${
            siteRows
              ? `<div class="section-title">2. Site-Wise Binder Consumption Breakdown</div>
                 <table>
                   <thead>
                     <tr>
                       <th>Site Name</th>
                       <th class="right">Billed Concrete Vol</th>
                       <th class="right">OPC 53 Cement Used</th>
                       <th class="right">GGBS Used</th>
                     </tr>
                   </thead>
                   <tbody>${siteRows}</tbody>
                 </table>`
              : ''
          }

          <div class="section-title">3. Silo Inward Purchase & Unload Ledger</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Silo</th>
                <th>Supplier</th>
                <th>Vehicle / Challan</th>
                <th class="right">Quantity</th>
                <th class="right">Rate</th>
                <th class="right">Expense (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerRows || '<tr><td colspan="8" style="text-align:center;">No inward entries recorded.</td></tr>'}
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const silo1FillPct = Math.max(0, Math.min(100, Math.round((consumptionSummary.silo1LeftKg / silo1CapacityKg) * 100)));
  const silo2FillPct = Math.max(0, Math.min(100, Math.round((consumptionSummary.silo2LeftKg / silo2CapacityKg) * 100)));

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
            CONMAT BATCHING PLANT • SILO 1 & SILO 2 INVENTORY & EXPENSE
          </span>
          <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <Database className="w-6 h-6 text-cyan-400" />
            <span>Silo 1 (OPC 53 Cement) & Silo 2 (GGBS) Stock Ledger</span>
          </h2>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrintSiloReport}
            className="px-4 py-2.5 bg-[#0b1322] hover:bg-[#121c2d] border border-[#1b273d] text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleSiloTypeChange('SILO_1_CEMENT');
              setIsModalOpen(true);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Add Silo Stock / Expense</span>
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Silo 1 & Silo 2 Balance + Expense Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 font-mono">
        {/* SILO 1: OPC 53 CEMENT */}
        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">SILO 1 • OPC 53 GRADE CEMENT</span>
              <h3 className="text-2xl font-black text-white mt-1">
                {(consumptionSummary.silo1LeftKg / 1000).toFixed(2)} MT
                <span className="text-xs font-normal text-slate-400 ml-2">
                  ({consumptionSummary.silo1LeftKg.toLocaleString('en-IN')} kg left)
                </span>
              </h3>
            </div>
            {consumptionSummary.silo1LeftKg < 5000 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
              </span>
            )}
          </div>

          {/* Visual Silo Bar */}
          <div className="w-full bg-[#070d1a] h-2.5 rounded-full overflow-hidden border border-[#1b273d]">
            <div
              className={`h-full transition-all ${consumptionSummary.silo1LeftKg < 5000 ? 'bg-rose-500' : 'bg-blue-500'}`}
              style={{ width: `${silo1FillPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1b273d] text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">TOTAL INWARD / USED</span>
              <span className="text-slate-200 font-bold">
                {(inwardSummary.silo1InwardKg / 1000).toFixed(2)} MT
              </span>{' '}
              / <span className="text-amber-400 font-bold">{(consumptionSummary.cementUsedKg / 1000).toFixed(2)} MT</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] block">EXPENSE (INWARD / USED)</span>
              <span className="text-emerald-400 font-bold">₹{inwardSummary.silo1PurchaseExpense.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block">
                Used Cost: ₹{consumptionSummary.cementConsumedCost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* SILO 2: GGBS */}
        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">SILO 2 • GGBS (IS 16714)</span>
              <h3 className="text-2xl font-black text-white mt-1">
                {(consumptionSummary.silo2LeftKg / 1000).toFixed(2)} MT
                <span className="text-xs font-normal text-slate-400 ml-2">
                  ({consumptionSummary.silo2LeftKg.toLocaleString('en-IN')} kg left)
                </span>
              </h3>
            </div>
            {consumptionSummary.silo2LeftKg < 3000 && (
              <span className="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
              </span>
            )}
          </div>

          {/* Visual Silo Bar */}
          <div className="w-full bg-[#070d1a] h-2.5 rounded-full overflow-hidden border border-[#1b273d]">
            <div
              className={`h-full transition-all ${consumptionSummary.silo2LeftKg < 3000 ? 'bg-rose-500' : 'bg-purple-500'}`}
              style={{ width: `${silo2FillPct}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1b273d] text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block">TOTAL INWARD / USED</span>
              <span className="text-slate-200 font-bold">
                {(inwardSummary.silo2InwardKg / 1000).toFixed(2)} MT
              </span>{' '}
              / <span className="text-amber-400 font-bold">{(consumptionSummary.ggbsUsedKg / 1000).toFixed(2)} MT</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 text-[10px] block">EXPENSE (INWARD / USED)</span>
              <span className="text-emerald-400 font-bold">₹{inwardSummary.silo2PurchaseExpense.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-slate-400 block">
                Used Cost: ₹{consumptionSummary.ggbsConsumedCost.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* TOTAL BINDER EXPENSE & BATCH SUMMARY */}
        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <IndianRupee className="w-3.5 h-3.5" />
              <span>TOTAL SILO PURCHASE EXPENSE</span>
            </span>
            <h3 className="text-2xl font-black text-emerald-400 mt-1">
              ₹{inwardSummary.totalPurchaseExpense.toLocaleString('en-IN')}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Consumed Binder Value: <strong className="text-white">₹{consumptionSummary.totalConsumedCost.toLocaleString('en-IN')}</strong> across{' '}
              <strong className="text-cyan-300">{consumptionSummary.totalBatchedVolumeM3} m³</strong> billed RMC
            </p>
          </div>

          <div className="bg-[#070d1a] border border-[#1b273d] rounded-2xl p-3 text-[11px] space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Remaining Stock Value:</span>
              <strong className="text-cyan-300">
                ₹{Math.max(0, inwardSummary.totalPurchaseExpense - consumptionSummary.totalConsumedCost).toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Cement Bags Equiv. Left:</span>
              <strong className="text-white">{Math.max(0, Math.round(consumptionSummary.silo1LeftKg / 50))} Bags</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Site-wise Consumption Breakdown */}
      {Object.keys(consumptionSummary.siteBreakdown).length > 0 && (
        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-5 shadow-xl font-mono">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400 mb-3">
            <TrendingDown className="w-4 h-4" />
            <span>Auto-Deducted Silo Consumption by Site (From Billed Invoices)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(consumptionSummary.siteBreakdown).map(([site, stats]) => (
              <div key={site} className="bg-[#070d1a] border border-[#1b273d] rounded-2xl p-3.5 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-white">{site}</strong>
                  <span className="text-cyan-400 font-bold">{stats.volumeM3.toFixed(2)} m³</span>
                </div>
                <div className="text-[11px] text-slate-400 flex justify-between pt-1 border-t border-[#142033]">
                  <span>Silo 1: <strong className="text-blue-300">{Math.round(stats.cementKg).toLocaleString('en-IN')} kg</strong></span>
                  <span>Silo 2: <strong className="text-purple-300">{Math.round(stats.ggbsKg).toLocaleString('en-IN')} kg</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs & Inward Ledger Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl font-mono">
        <div className="p-4 border-b border-[#1b273d] flex flex-wrap items-center justify-between gap-3 bg-[#070d1a]">
          <div className="flex items-center gap-2">
            {(['ALL', 'SILO_1_CEMENT', 'SILO_2_GGBS'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterSilo(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition ${
                  filterSilo === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#0b1322] text-slate-400 hover:text-white border border-[#1b273d]'
                }`}
              >
                {tab === 'ALL' ? 'All Silo Purchases' : tab === 'SILO_1_CEMENT' ? 'Silo 1 (OPC 53)' : 'Silo 2 (GGBS)'}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-400">
            Showing <strong className="text-white">{filteredEntries.length}</strong> inward stock entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-5">Date</th>
                <th className="py-4 px-5">Silo / Material</th>
                <th className="py-4 px-5">Supplier & Challan</th>
                <th className="py-4 px-5">Inward Qty</th>
                <th className="py-4 px-5">Rate / MT</th>
                <th className="py-4 px-5">Total Expense</th>
                <th className="py-4 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-500 font-sans">
                    No silo inward stock entries recorded yet. Click "+ Add Silo Stock / Expense" to log cement or GGBS deliveries.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-5 font-bold text-slate-300">{formatDateDDMMYYYY(entry.date)}</td>
                    <td className="py-4 px-5">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                          entry.silo === 'SILO_1_CEMENT'
                            ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        }`}
                      >
                        {entry.silo === 'SILO_1_CEMENT' ? 'SILO 1 • OPC 53 CEMENT' : 'SILO 2 • GGBS'}
                      </span>
                    </td>
                    <td className="py-4 px-5 font-sans">
                      <div className="font-bold text-white">{entry.supplierName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Challan / Bulker: {entry.vehicleOrChallanNo}
                        {entry.remarks ? ` • ${entry.remarks}` : ''}
                      </div>
                    </td>
                    <td className="py-4 px-5 font-bold text-cyan-300">
                      {(entry.quantityKg / 1000).toFixed(2)} MT{' '}
                      <span className="text-[10px] text-slate-400">({entry.quantityKg.toLocaleString('en-IN')} kg)</span>
                    </td>
                    <td className="py-4 px-5">₹{(entry.ratePerKg * 1000).toLocaleString('en-IN')}</td>
                    <td className="py-4 px-5 font-extrabold text-emerald-400">
                      ₹{entry.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-slate-400 hover:text-rose-400 p-1.5 transition cursor-pointer"
                        title="Delete Inward Entry"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Silo Inward Stock / Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-5 font-mono">
            <div className="flex items-center justify-between border-b border-[#1b273d] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-white uppercase font-sans">Log Silo Stock & Expense</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEntry} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1.5">Select Target Silo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSiloTypeChange('SILO_1_CEMENT')}
                    className={`py-2.5 px-3 rounded-xl border font-bold cursor-pointer transition ${
                      silo === 'SILO_1_CEMENT'
                        ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                        : 'bg-[#070d1a] border-[#1b273d] text-slate-400'
                    }`}
                  >
                    Silo 1 (OPC 53 Cement)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSiloTypeChange('SILO_2_GGBS')}
                    className={`py-2.5 px-3 rounded-xl border font-bold cursor-pointer transition ${
                      silo === 'SILO_2_GGBS'
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                        : 'bg-[#070d1a] border-[#1b273d] text-slate-400'
                    }`}
                  >
                    Silo 2 (GGBS)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] flex items-center gap-1 mb-1">
                    <Calendar className="w-3 h-3 text-cyan-400" />
                    <span>Unload Date</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Bulker / Challan No</label>
                  <input
                    type="text"
                    placeholder="e.g. KA28B1234"
                    value={vehicleOrChallanNo}
                    onChange={(e) => setVehicleOrChallanNo(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-amber-400 font-bold outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Supplier / Brand Name</label>
                <input
                  type="text"
                  placeholder={silo === 'SILO_1_CEMENT' ? 'e.g. UltraTech / Dalmia OPC 53' : 'e.g. JSW GGBS'}
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Quantity (MT / Tons)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    value={quantityMT}
                    onChange={(e) => setQuantityMT(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-cyan-300 font-bold outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    = {Math.round((Number(quantityMT) || 0) * 1000).toLocaleString('en-IN')} kg
                  </span>
                </div>
                <div>
                  <label className="text-slate-300 font-bold uppercase text-[10px] block mb-1">Rate (₹ / MT)</label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={ratePerTon}
                    onChange={(e) => setRatePerTon(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2.5 bg-[#070d1a] border border-[#1b273d] rounded-xl text-white font-bold outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    = ₹{((Number(ratePerTon) || 0) / 1000).toFixed(2)} / kg
                  </span>
                </div>
              </div>

              <div className="bg-[#070d1a] border border-[#1b273d] p-3.5 rounded-2xl flex items-center justify-between">
                <span className="text-slate-400 font-bold">Total Purchase Expense:</span>
                <span className="text-base font-black text-emerald-400">
                  ₹{Math.round((Number(quantityMT) || 0) * (Number(ratePerTon) || 0)).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1b273d]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-[#070d1a] text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  Save Silo Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SiloInventoryPage;
