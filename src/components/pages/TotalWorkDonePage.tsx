import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  Printer,
  Calendar,
  RotateCcw,
  Building2,
  Truck,
  IndianRupee,
  Layers,
} from 'lucide-react';
import { cloudStorage } from '../../services/cloudStorage';

interface SiteWorkSummary {
  siteName: string;
  clientName: string;
  totalLoads: number;
  totalVolumeM3: number;
  totalBilledAmount: number;
  gradesUsed: string[];
  lastDispatchDate: string;
}

const formatDateDDMMYYYY = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
};

export const TotalWorkDonePage: React.FC = () => {
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    void cloudStorage.pullFromCloud();
    const handleSync = () => setRefreshTick((t) => t + 1);
    window.addEventListener('concrete360_invoices_updated', handleSync);
    window.addEventListener('concrete360_cloud_synced', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('concrete360_invoices_updated', handleSync);
      window.removeEventListener('concrete360_cloud_synced', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const workSummary = useMemo(() => {
    const siteMap: Record<string, SiteWorkSummary> = {};
    let grandTotalVolumeM3 = 0;
    let grandTotalLoads = 0;
    let grandTotalAmount = 0;
    const allDispatches: any[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('concrete360_site_invoices_')) {
          const siteKey = key.replace('concrete360_site_invoices_', '');
          const invoices = JSON.parse(localStorage.getItem(key) || '[]');

          if (Array.isArray(invoices)) {
            invoices.forEach((inv: any) => {
              if (fromDate && inv.date && inv.date < fromDate) return;
              if (toDate && inv.date && inv.date > toDate) return;

              const vol = Number(inv.volumeM3) || 0;
              const amt = Number(inv.grandTotal) || 0;
              const grade = String(inv.mixGrade || 'M25').toUpperCase();

              grandTotalVolumeM3 += vol;
              grandTotalLoads += 1;
              grandTotalAmount += amt;

              allDispatches.push({
                ...inv,
                siteKey,
              });

              if (!siteMap[siteKey]) {
                siteMap[siteKey] = {
                  siteName: siteKey,
                  clientName: inv.clientName || siteKey,
                  totalLoads: 0,
                  totalVolumeM3: 0,
                  totalBilledAmount: 0,
                  gradesUsed: [],
                  lastDispatchDate: inv.date || '',
                };
              }

              siteMap[siteKey].totalLoads += 1;
              siteMap[siteKey].totalVolumeM3 += vol;
              siteMap[siteKey].totalBilledAmount += amt;
              if (!siteMap[siteKey].gradesUsed.includes(grade)) {
                siteMap[siteKey].gradesUsed.push(grade);
              }
              if (inv.date && inv.date > siteMap[siteKey].lastDispatchDate) {
                siteMap[siteKey].lastDispatchDate = inv.date;
              }
            });
          }
        }
      }
    } catch {}

    const siteList = Object.values(siteMap).sort((a, b) => b.totalVolumeM3 - a.totalVolumeM3);
    allDispatches.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

    return {
      siteList,
      allDispatches,
      grandTotalVolumeM3: Number(grandTotalVolumeM3.toFixed(2)),
      grandTotalLoads,
      grandTotalAmount: Math.round(grandTotalAmount),
    };
  }, [fromDate, toDate, refreshTick]);

  const handlePrintReport = () => {
    const win = window.open('', '_blank');
    if (!win) return;

    const rowsHtml = workSummary.siteList
      .map(
        (s, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${s.siteName}</strong></td>
          <td>${s.clientName}</td>
          <td>${s.gradesUsed.join(', ')}</td>
          <td class="right">${s.totalLoads}</td>
          <td class="right"><strong>${s.totalVolumeM3.toFixed(2)} m³</strong></td>
          <td class="right"><strong>₹${Math.round(s.totalBilledAmount).toLocaleString('en-IN')}</strong></td>
        </tr>
      `
      )
      .join('');

    win.document.write(`
      <html>
        <head>
          <title>Total Work Done Statement - BILGI BUILDCON RMC</title>
          <style>
            @page { size: A4; margin: 14mm; }
            body { font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; display: flex; justify-content: space-between; }
            .header h1 { margin: 0; font-size: 18px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #0f172a; color: #fff; padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; }
            td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10px; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>BILGI BUILDCON RMC</h1>
              <div style="font-size:10px;color:#475569;">Consolidated Total Work Done & Concrete Supply Statement</div>
            </div>
            <div style="text-align:right;font-size:10px;">
              Printed: <strong>${formatDateDDMMYYYY(new Date().toISOString().split('T')[0])}</strong>
              ${fromDate || toDate ? `<br/>Period: ${fromDate ? formatDateDDMMYYYY(fromDate) : 'Start'} to ${toDate ? formatDateDDMMYYYY(toDate) : 'Present'}` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Project Site</th>
                <th>Client Name</th>
                <th>Grades</th>
                <th class="right">TM Loads</th>
                <th class="right">Total Concrete (m³)</th>
                <th class="right">Total Billed (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="7" style="text-align:center;">No completed work records found.</td></tr>'}
              <tr style="background:#f1f5f9;font-weight:bold;">
                <td colspan="4" class="right">GRAND TOTAL WORK DONE:</td>
                <td class="right">${workSummary.grandTotalLoads}</td>
                <td class="right">${workSummary.grandTotalVolumeM3.toFixed(2)} m³</td>
                <td class="right">₹${workSummary.grandTotalAmount.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            BILGI BUILDCON RMC • CONSOLIDATED PRODUCTION & DISPATCH
          </span>
          <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-emerald-400" />
            <span>Total Work Done (All Sites)</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={handlePrintReport}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer transition shrink-0"
        >
          <Printer className="w-4 h-4" />
          <span>Print Work Summary</span>
        </button>
      </div>

      {/* Date Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
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
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
              className="px-3 py-2 bg-[#070d1a] hover:bg-[#121c2d] border border-[#1b273d] text-slate-300 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>All Time</span>
            </button>
          )}
        </div>

        <div className="text-slate-400">
          Active Sites Covered: <strong className="text-white">{workSummary.siteList.length}</strong>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-6 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>TOTAL CONCRETE SUPPLIED</span>
          </span>
          <div className="text-3xl font-black text-white mt-2">
            {workSummary.grandTotalVolumeM3.toFixed(2)} <span className="text-sm font-bold text-cyan-400">m³</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Across {workSummary.siteList.length} project site(s)</p>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-6 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" />
            <span>TOTAL TRANSIT MIXER TRIPS</span>
          </span>
          <div className="text-3xl font-black text-amber-400 mt-2">
            {workSummary.grandTotalLoads} <span className="text-sm font-bold text-slate-300">Loads</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Completed RMC deliveries</p>
        </div>

        <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl p-6 shadow-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <IndianRupee className="w-3.5 h-3.5" />
            <span>TOTAL BILLED WORK VALUE</span>
          </span>
          <div className="text-3xl font-black text-emerald-400 mt-2">
            ₹{workSummary.grandTotalAmount.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Gross tax invoice turnover</p>
        </div>
      </div>

      {/* Site-Wise Work Done Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl font-mono">
        <div className="px-6 py-4 border-b border-[#1b273d] bg-[#070d1a] flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">Site-Wise Work Done Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-6">Site Name</th>
                <th className="py-4 px-6">Client</th>
                <th className="py-4 px-6">Mix Grades</th>
                <th className="py-4 px-6">Last Dispatch</th>
                <th className="py-4 px-6">TM Loads</th>
                <th className="py-4 px-6">Concrete Volume</th>
                <th className="py-4 px-6 text-right">Total Billed (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {workSummary.siteList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-500 font-sans">
                    No completed work records found for the selected period.
                  </td>
                </tr>
              ) : (
                workSummary.siteList.map((site) => (
                  <tr key={site.siteName} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-6 font-bold text-white">{site.siteName}</td>
                    <td className="py-4 px-6 font-sans text-cyan-300 font-bold">{site.clientName}</td>
                    <td className="py-4 px-6 text-slate-300">{site.gradesUsed.join(', ')}</td>
                    <td className="py-4 px-6 text-slate-400">{formatDateDDMMYYYY(site.lastDispatchDate)}</td>
                    <td className="py-4 px-6 font-bold text-amber-400">{site.totalLoads}</td>
                    <td className="py-4 px-6 font-extrabold text-cyan-300">{site.totalVolumeM3.toFixed(2)} m³</td>
                    <td className="py-4 px-6 text-right font-extrabold text-emerald-400">
                      ₹{Math.round(site.totalBilledAmount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TotalWorkDonePage;
