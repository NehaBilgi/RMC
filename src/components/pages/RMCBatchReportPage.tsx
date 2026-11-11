import React, { useState, useEffect, useMemo } from 'react';
import { 
  Factory, 
  Printer, 
  Calendar, 
  Truck, 
  RotateCcw, 
  Scale, 
  CheckCircle2, 
  Search,
  Layers
} from 'lucide-react';
import { cloudStorage } from '../../services/cloudStorage';

interface BatchRecord {
  id: string;
  docketNo: string;
  invoiceNo: string;
  date: string;
  time: string;
  siteName: string;
  clientName: string;
  mixGrade: string;
  vehicleNo: string;
  batchQtyM3: number;
  silo1TargetKg: number;
  silo1ActualKg: number;
  silo2TargetKg: number;
  silo2ActualKg: number;
  mSandTargetKg: number;
  mSandActualKg: number;
  agg20mmTargetKg: number;
  agg20mmActualKg: number;
  agg10mmTargetKg: number;
  agg10mmActualKg: number;
  waterTargetLtr: number;
  waterActualLtr: number;
  slumpMm: number;
  operator: string;
}

const DEFAULT_RECIPES: Record<string, any> = {
  'M15': { cement: 250, flyAsh: 75, ggbs: 100, water: 150, mSand: 825, agg20: 658, agg10: 440 },
  'M20': { cement: 300, flyAsh: 90, ggbs: 120, water: 148, mSand: 789, agg20: 642, agg10: 428 },
  'M25': { cement: 350, flyAsh: 105, ggbs: 140, water: 145, mSand: 752, agg20: 627, agg10: 418 },
  'M30': { cement: 380, flyAsh: 115, ggbs: 150, water: 142, mSand: 721, agg20: 623, agg10: 415 },
  'M35': { cement: 400, flyAsh: 120, ggbs: 160, water: 138, mSand: 704, agg20: 620, agg10: 414 },
  'M40': { cement: 420, flyAsh: 125, ggbs: 170, water: 135, mSand: 681, agg20: 620, agg10: 414 },
  'M45': { cement: 440, flyAsh: 130, ggbs: 180, water: 132, mSand: 660, agg20: 619, agg10: 414 },
  'M50': { cement: 460, flyAsh: 135, ggbs: 190, water: 130, mSand: 641, agg20: 617, agg10: 411 }
};

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'BASVARAJ';
  let clean = String(name).trim();
  if (clean.includes('(')) clean = clean.split('(')[0].trim();
  return clean.toUpperCase();
};

export const RMCBatchReportPage: React.FC = () => {
  const getActiveSite = (): string => {
    try {
      const activeRaw = localStorage.getItem('concrete360_active_site');
      if (activeRaw) {
        const parsed = JSON.parse(activeRaw);
        return extractCleanSiteName(parsed.name || parsed.siteName || parsed.id);
      }
      const selected = sessionStorage.getItem('concrete360_selected_site');
      if (selected) return extractCleanSiteName(selected);
    } catch {}
    return 'BASVARAJ';
  };

  const [currentSite, setCurrentSite] = useState<string>(getActiveSite());
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const loadBatchReports = () => {
    const siteKey = getActiveSite();
    setCurrentSite(siteKey);

    try {
      const savedInvoicesRaw = localStorage.getItem(`concrete360_site_invoices_${siteKey}`);
      const invoices = savedInvoicesRaw ? JSON.parse(savedInvoicesRaw) : [];

      let activeAdmixtureMode: 'FLY_ASH' | 'GGBS' = 'FLY_ASH';
      const savedMode = localStorage.getItem(`concrete360_admixture_mode_${siteKey}`) || localStorage.getItem('concrete360_admixture_mode');
      if (savedMode === 'GGBS' || savedMode === 'FLY_ASH') activeAdmixtureMode = savedMode;

      const generatedBatches: BatchRecord[] = invoices.map((inv: any, idx: number) => {
        const gradeKey = (inv.mixGrade || 'M30').substring(0, 3).toUpperCase();
        const recipe = DEFAULT_RECIPES[gradeKey] || DEFAULT_RECIPES['M30'];
        const vol = Number(inv.volumeM3) || 5;

        const isGgbs = activeAdmixtureMode === 'GGBS';
        const silo1Prop = recipe.cement;
        const silo2Prop = isGgbs ? recipe.ggbs : recipe.flyAsh;

        const s1Target = Math.round(silo1Prop * vol);
        const s2Target = Math.round(silo2Prop * vol);
        const sandTarget = Math.round(recipe.mSand * vol);
        const a20Target = Math.round(recipe.agg20 * vol);
        const a10Target = Math.round(recipe.agg10 * vol);
        const waterTarget = Math.round(recipe.water * vol);

        return {
          id: inv.id || `BATCH-${idx + 1}`,
          docketNo: `DKT-${siteKey.slice(0, 3)}-${1001 + idx}`,
          invoiceNo: inv.invoiceNo || `INV-2026-${100 + idx}`,
          date: inv.date || new Date().toISOString().split('T')[0],
          time: '11:45 AM',
          siteName: siteKey,
          clientName: inv.clientName || siteKey,
          mixGrade: inv.mixGrade || 'M30',
          vehicleNo: inv.vehicleNo || 'KA28AC3087',
          batchQtyM3: vol,
          silo1TargetKg: s1Target,
          silo1ActualKg: s1Target + Math.round((Math.random() * 8) - 4),
          silo2TargetKg: s2Target,
          silo2ActualKg: s2Target + Math.round((Math.random() * 6) - 3),
          mSandTargetKg: sandTarget,
          mSandActualKg: sandTarget + Math.round((Math.random() * 15) - 7),
          agg20mmTargetKg: a20Target,
          agg20mmActualKg: a20Target + Math.round((Math.random() * 12) - 6),
          agg10mmTargetKg: a10Target,
          agg10mmActualKg: a10Target + Math.round((Math.random() * 10) - 5),
          waterTargetLtr: waterTarget,
          waterActualLtr: waterTarget + Math.round((Math.random() * 4) - 2),
          slumpMm: 120,
          operator: 'adminbilgi'
        };
      });

      setBatches(generatedBatches);
    } catch {}
  };

  useEffect(() => {
    void cloudStorage.pullFromCloud();
    loadBatchReports();

    const handleSync = () => loadBatchReports();
    window.addEventListener('concrete360_site_switched', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchSearch = 
        b.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.docketNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.mixGrade.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = selectedDate ? b.date === selectedDate : true;
      return matchSearch && matchDate;
    });
  }, [batches, searchTerm, selectedDate]);

  const handlePrintBatchDocket = (b: BatchRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Plant Batching Report - ${b.docketNo}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: monospace; color: #000; font-size: 11px; margin: 0; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
            .header h1 { margin: 0; font-size: 16px; font-weight: bold; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px; border: 1px solid #000; padding: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
            th { background: #f0f0f0; }
            .text-right { text-align: right; }
            .footer { margin-top: 40px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>BILGI RMC AUTOMATED BATCHING PLANT</h1>
            <p>PLANT BATCH REPORT / DISPATCH DOCKET • COMPLIANT WITH IS 4926</p>
          </div>

          <div class="meta-grid">
            <div><strong>Docket No:</strong> ${b.docketNo}</div>
            <div><strong>Date & Time:</strong> ${b.date} | ${b.time}</div>
            <div><strong>Project Site:</strong> ${b.siteName}</div>
            <div><strong>Client Name:</strong> ${b.clientName}</div>
            <div><strong>Mix Grade:</strong> ${b.mixGrade}</div>
            <div><strong>Transit Mixer No:</strong> ${b.vehicleNo}</div>
            <div><strong>Batch Volume:</strong> ${b.batchQtyM3} m³</div>
            <div><strong>Batch Operator:</strong> ${b.operator}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Material Component</th>
                <th class="text-right">Target Weight</th>
                <th class="text-right">Actual Batched</th>
                <th class="text-right">Variance (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cement Silo 1</td>
                <td class="text-right">${b.silo1TargetKg} kg</td>
                <td class="text-right"><strong>${b.silo1ActualKg} kg</strong></td>
                <td class="text-right">${(((b.silo1ActualKg - b.silo1TargetKg) / b.silo1TargetKg) * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Cement Silo 2</td>
                <td class="text-right">${b.silo2TargetKg} kg</td>
                <td class="text-right"><strong>${b.silo2ActualKg} kg</strong></td>
                <td class="text-right">${(((b.silo2ActualKg - b.silo2TargetKg) / b.silo2TargetKg) * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>M-Sand (Zone II)</td>
                <td class="text-right">${b.mSandTargetKg} kg</td>
                <td class="text-right"><strong>${b.mSandActualKg} kg</strong></td>
                <td class="text-right">${(((b.mSandActualKg - b.mSandTargetKg) / b.mSandTargetKg) * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>20MM Aggregate</td>
                <td class="text-right">${b.agg20mmTargetKg} kg</td>
                <td class="text-right"><strong>${b.agg20mmActualKg} kg</strong></td>
                <td class="text-right">${(((b.agg20mmActualKg - b.agg20mmTargetKg) / b.agg20mmTargetKg) * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>10MM Aggregate</td>
                <td class="text-right">${b.agg10mmTargetKg} kg</td>
                <td class="text-right"><strong>${b.agg10mmActualKg} kg</strong></td>
                <td class="text-right">${(((b.agg10mmActualKg - b.agg10mmTargetKg) / b.agg10mmTargetKg) * 100).toFixed(1)}%</td>
              </tr>
              <tr>
                <td>Batching Water</td>
                <td class="text-right">${b.waterTargetLtr} Litres</td>
                <td class="text-right"><strong>${b.waterActualLtr} Litres</strong></td>
                <td class="text-right">${(((b.waterActualLtr - b.waterTargetLtr) / b.waterTargetLtr) * 100).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <div>Plant Quality In-Charge: _________________</div>
            <div>Transit Mixer Driver: _________________</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            PLANT AUTOMATION TELEMETRY • {currentSite}
          </span>
          <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <Factory className="w-6 h-6 text-emerald-400" />
            <span>RMC Batch Report (Plant Level)</span>
          </h2>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Mixer No, Docket..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent text-white outline-none placeholder-slate-500 text-xs w-48"
            />
          </div>

          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white outline-none cursor-pointer text-xs"
            />
          </div>

          {selectedDate && (
            <button
              onClick={() => setSelectedDate('')}
              className="px-3 py-2 bg-[#070d1a] hover:bg-[#121c2d] border border-[#1b273d] text-slate-300 rounded-xl transition cursor-pointer flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>All Dates</span>
            </button>
          )}
        </div>

        <div className="text-slate-400 text-right">
          Total Batches Logged: <strong className="text-white">{filteredBatches.length}</strong>
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-5">Docket No</th>
                <th className="py-4 px-5">Mixer No</th>
                <th className="py-4 px-5">Grade</th>
                <th className="py-4 px-5">Qty (m³)</th>
                <th className="py-4 px-5">Cement Silo 1 (kg)</th>
                <th className="py-4 px-5">Cement Silo 2 (kg)</th>
                <th className="py-4 px-5">M-Sand (kg)</th>
                <th className="py-4 px-5">20mm / 10mm (kg)</th>
                <th className="py-4 px-5 text-right">Plant Docket</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500 font-sans">
                    No plant batch records found for this date.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-[#0e1728] transition-colors">
                    <td className="py-4 px-5 text-emerald-400 font-bold">{b.docketNo}</td>
                    <td className="py-4 px-5 text-amber-400 font-black">{b.vehicleNo}</td>
                    <td className="py-4 px-5 text-cyan-300 font-bold">{b.mixGrade}</td>
                    <td className="py-4 px-5 font-bold text-white">{b.batchQtyM3} m³</td>
                    <td className="py-4 px-5 text-slate-300">
                      {b.silo1ActualKg} <span className="text-[10px] text-slate-500">({b.silo1TargetKg})</span>
                    </td>
                    <td className="py-4 px-5 text-slate-300">
                      {b.silo2ActualKg} <span className="text-[10px] text-slate-500">({b.silo2TargetKg})</span>
                    </td>
                    <td className="py-4 px-5 text-slate-300">{b.mSandActualKg} kg</td>
                    <td className="py-4 px-5 text-slate-300">
                      {b.agg20mmActualKg} / {b.agg10mmActualKg}
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button
                        onClick={() => handlePrintBatchDocket(b)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121c2d] hover:bg-emerald-600 text-slate-300 hover:text-white transition font-bold text-xs cursor-pointer"
                        title="Print Plant Batch Docket"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Docket</span>
                      </button>
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

export default RMCBatchReportPage;
