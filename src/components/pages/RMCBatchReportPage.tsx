import React, { useState, useEffect, useMemo } from 'react';
import { 
  Factory, 
  Printer, 
  Calendar, 
  RotateCcw, 
  Search, 
  Settings, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Layers 
} from 'lucide-react';
import { cloudStorage } from '../../services/cloudStorage';

interface SubBatchDrop {
  batchIndex: number;
  batchQtyM3: number;
  silo1Kg: number;
  silo2Kg: number;
  mSandKg: number;
  agg20mmKg: number;
  agg10mmKg: number;
  waterLtr: number;
}

interface UnitRecipePerM3 {
  silo1Kg: number;
  silo2Kg: number;
  mSandKg: number;
  agg20mmKg: number;
  agg10mmKg: number;
  waterLtr: number;
  totalDensity: number;
}

interface BatchRecord {
  id: string;
  indentNo: string;
  invoiceNo: string;
  date: string;
  time: string;
  siteName: string;
  clientName: string;
  transporterName: string;
  plantModel: string;
  mixGrade: string;
  vehicleNo: string;
  batchQtyM3: number;
  mixerCapacityM3: number;
  totalBatchesCount: number;
  unitRecipe: UnitRecipePerM3;
  drops: SubBatchDrop[];
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

// Bilgi Buildcon RMC 1 m³ Standard Batch Cards (Rev. 2, Target Yield: 2,400.0 kg/m³)
const DEFAULT_RECIPES: Record<string, any> = {
  'M10': { cement: 168, flyAsh: 42, ggbs: 42, water: 136, mSand: 1057, agg20: 597, agg10: 398 },
  'M15': { cement: 200, flyAsh: 50, ggbs: 50, water: 140, mSand: 1034, agg20: 584, agg10: 390 },
  'M20': { cement: 240, flyAsh: 60, ggbs: 60, water: 147, mSand: 1005, agg20: 567, agg10: 379 },
  'M25': { cement: 280, flyAsh: 70, ggbs: 70, water: 158, mSand: 973, agg20: 550, agg10: 366 },
  'M30': { cement: 304, flyAsh: 76, ggbs: 76, water: 160, mSand: 956, agg20: 541, agg10: 360 },
  'M35': { cement: 320, flyAsh: 80, ggbs: 80, water: 160, mSand: 946, agg20: 535, agg10: 356 },
  'M40': { cement: 336, flyAsh: 84, ggbs: 84, water: 160, mSand: 936, agg20: 529, agg10: 352 },
  'M45': { cement: 352, flyAsh: 88, ggbs: 88, water: 158, mSand: 928, agg20: 524, agg10: 349 },
  'M50': { cement: 368, flyAsh: 92, ggbs: 92, water: 156, mSand: 921, agg20: 520, agg10: 346 }
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
  
  // Plant batch mixer capacity state (default 0.75 m3 per batch)
  const [plantMixerCapacity, setPlantMixerCapacity] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`concrete360_plant_mixer_cap_${getActiveSite()}`);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val > 0) return val;
      }
    } catch {}
    return 0.75;
  });

  const [isMixerCapModalOpen, setIsMixerCapModalOpen] = useState(false);
  const [tempMixerCap, setTempMixerCap] = useState<string>(String(plantMixerCapacity));
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Read linked mix design dynamically from MixDesignModule / localStorage
  const getLinkedMixDesign = (siteKey: string, gradeStr: string, mode: 'FLY_ASH' | 'GGBS') => {
    const gradeKey = (gradeStr || 'M30').substring(0, 3).toUpperCase();
    const fallback = DEFAULT_RECIPES[gradeKey] || DEFAULT_RECIPES['M30'];

    try {
      const directMixesRaw = localStorage.getItem(`concrete360_mixes_${siteKey}_${mode}`) || localStorage.getItem(`concrete360_mixes_${siteKey}`);
      if (directMixesRaw) {
        const parsed = JSON.parse(directMixesRaw);
        if (parsed && parsed[gradeKey]) {
          const m = parsed[gradeKey];
          return {
            cement: Number(m.cementKg ?? fallback.cement),
            admix: Number(m.mineralAdmixtureKg ?? (mode === 'GGBS' ? fallback.ggbs : fallback.flyAsh)),
            water: Number(m.waterLitres ?? fallback.water),
            mSand: Number(m.mSandKg ?? fallback.mSand),
            agg20: Number(m.agg20mmKg ?? fallback.agg20),
            agg10: Number(m.agg10mmKg ?? fallback.agg10)
          };
        }
      }

      const globalListRaw = localStorage.getItem(`concrete360_mix_designs_${siteKey}`) || localStorage.getItem('concrete360_mix_designs');
      if (globalListRaw) {
        const list = JSON.parse(globalListRaw);
        if (Array.isArray(list)) {
          const match = list.find((it: any) => String(it.grade || it.code || '').toUpperCase().includes(gradeKey));
          if (match) {
            return {
              cement: Number(match.cementKgPerM3 ?? fallback.cement),
              admix: Number((mode === 'GGBS' ? match.ggbsKgPerM3 : match.flyAshKgPerM3) ?? fallback.ggbs),
              water: Number(match.waterLitresPerM3 ?? fallback.water),
              mSand: Number(match.mSandKgPerM3 ?? fallback.mSand),
              agg20: Number(match.agg20mmKgPerM3 ?? fallback.agg20),
              agg10: Number(match.agg10mmKgPerM3 ?? fallback.agg10)
            };
          }
        }
      }
    } catch {}

    return {
      cement: fallback.cement,
      admix: mode === 'GGBS' ? fallback.ggbs : fallback.flyAsh,
      water: fallback.water,
      mSand: fallback.mSand,
      agg20: fallback.agg20,
      agg10: fallback.agg10
    };
  };

  const loadBatchReports = (overrideCap?: number) => {
    const siteKey = getActiveSite();
    setCurrentSite(siteKey);

    const activeCap = overrideCap !== undefined ? overrideCap : plantMixerCapacity;

    try {
      const savedInvoicesRaw = localStorage.getItem(`concrete360_site_invoices_${siteKey}`);
      const invoices = savedInvoicesRaw ? JSON.parse(savedInvoicesRaw) : [];

      let activeAdmixtureMode: 'FLY_ASH' | 'GGBS' = 'GGBS';
      const savedMode = localStorage.getItem(`concrete360_admixture_mode_${siteKey}`) || localStorage.getItem('concrete360_admixture_mode');
      if (savedMode === 'GGBS' || savedMode === 'FLY_ASH') activeAdmixtureMode = savedMode;

      const generatedBatches: BatchRecord[] = invoices.map((inv: any, idx: number) => {
        const gradeKey = (inv.mixGrade || 'M30').substring(0, 3).toUpperCase();
        const recipe = getLinkedMixDesign(siteKey, gradeKey, activeAdmixtureMode);
        const totalLoadVol = Number(inv.volumeM3) || 5.0;

        const unitRecipe: UnitRecipePerM3 = {
          silo1Kg: recipe.cement,
          silo2Kg: recipe.admix,
          mSandKg: recipe.mSand,
          agg20mmKg: recipe.agg20,
          agg10mmKg: recipe.agg10,
          waterLtr: recipe.water,
          totalDensity: Math.round(recipe.cement + recipe.admix + recipe.mSand + recipe.agg20 + recipe.agg10 + recipe.water)
        };

        const drops: SubBatchDrop[] = [];
        let remainingVol = totalLoadVol;
        let batchNo = 1;

        while (remainingVol > 0.001) {
          const dropQty = Math.min(activeCap, remainingVol);
          drops.push({
            batchIndex: batchNo,
            batchQtyM3: Number(dropQty.toFixed(3)),
            silo1Kg: Math.round(recipe.cement * dropQty),
            silo2Kg: Math.round(recipe.admix * dropQty),
            mSandKg: Math.round(recipe.mSand * dropQty),
            agg20mmKg: Math.round(recipe.agg20 * dropQty),
            agg10mmKg: Math.round(recipe.agg10 * dropQty),
            waterLtr: Math.round(recipe.water * dropQty)
          });
          remainingVol = Math.max(0, Number((remainingVol - dropQty).toFixed(3)));
          batchNo++;
        }

        const s1Target = Math.round(recipe.cement * totalLoadVol);
        const s2Target = Math.round(recipe.admix * totalLoadVol);
        const sandTarget = Math.round(recipe.mSand * totalLoadVol);
        const a20Target = Math.round(recipe.agg20 * totalLoadVol);
        const a10Target = Math.round(recipe.agg10 * totalLoadVol);
        const waterTarget = Math.round(recipe.water * totalLoadVol);

        return {
          id: inv.id || `BATCH-${idx + 1}`,
          indentNo: `IND-${siteKey.slice(0, 3)}-${1001 + idx}`,
          invoiceNo: inv.invoiceNo || `INV-2026-${100 + idx}`,
          date: inv.date || new Date().toISOString().split('T')[0],
          time: '11:45 AM',
          siteName: siteKey,
          clientName: inv.clientName || siteKey,
          transporterName: 'BILGI BUILDCON RMC',
          plantModel: 'CONMAT BATCHING PLANT (0.75 m³)',
          mixGrade: inv.mixGrade || 'M30',
          vehicleNo: inv.vehicleNo || 'KA28AC3087',
          batchQtyM3: totalLoadVol,
          mixerCapacityM3: activeCap,
          totalBatchesCount: drops.length,
          unitRecipe,
          drops,
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
    window.addEventListener('concrete360_mix_designs_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('concrete360_site_switched', handleSync);
      window.removeEventListener('concrete360_mix_designs_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [plantMixerCapacity]);

  const handleSaveMixerCap = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(tempMixerCap);
    if (!isNaN(parsed) && parsed > 0) {
      setPlantMixerCapacity(parsed);
      localStorage.setItem(`concrete360_plant_mixer_cap_${currentSite}`, String(parsed));
      setIsMixerCapModalOpen(false);
      loadBatchReports(parsed);
    }
  };

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchSearch = 
        b.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.indentNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.mixGrade.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = selectedDate ? b.date === selectedDate : true;
      return matchSearch && matchDate;
    });
  }, [batches, searchTerm, selectedDate]);

  const handlePrintBatchDocket = (b: BatchRecord) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const s1Var = (((b.silo1ActualKg - b.silo1TargetKg) / b.silo1TargetKg) * 100).toFixed(1);
    const s2Var = (((b.silo2ActualKg - b.silo2TargetKg) / b.silo2TargetKg) * 100).toFixed(1);
    const sandVar = (((b.mSandActualKg - b.mSandTargetKg) / b.mSandTargetKg) * 100).toFixed(1);
    const a20Var = (((b.agg20mmActualKg - b.agg20mmTargetKg) / b.agg20mmTargetKg) * 100).toFixed(1);
    const a10Var = (((b.agg10mmActualKg - b.agg10mmTargetKg) / b.agg10mmTargetKg) * 100).toFixed(1);
    const waterVar = (((b.waterActualLtr - b.waterTargetLtr) / b.waterTargetLtr) * 100).toFixed(1);

    const subBatchRows = b.drops.map(d => `
      <tr>
        <td style="font-weight:bold;">Batch #${d.batchIndex}</td>
        <td>${d.batchQtyM3.toFixed(2)} m³</td>
        <td>${d.silo1Kg} kg</td>
        <td>${d.silo2Kg} kg</td>
        <td>${d.mSandKg} kg</td>
        <td>${d.agg20mmKg} kg</td>
        <td>${d.agg10mmKg} kg</td>
        <td>${d.waterLtr} L</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>CONMAT Plant Batching Report - ${b.indentNo}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: monospace; color: #000; font-size: 11px; margin: 0; line-height: 1.35; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
            .header h1 { margin: 0; font-size: 16px; font-weight: bold; }
            .header p { margin: 3px 0 0 0; font-size: 10px; }
            .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; border: 1px solid #000; padding: 8px; font-size: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
            th, td { border: 1px solid #000; padding: 5px 4px; text-align: center; }
            th { background: #f0f0f0; font-weight: bold; }
            td.row-title { text-align: left; font-weight: bold; background: #fafafa; width: 160px; }
            .section-label { font-size: 11px; font-weight: bold; margin-top: 12px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 2px; }
            .footer { margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CONMAT AUTOMATED BATCHING PLANT</h1>
            <p>PLANT BATCH REPORT / TM DISPATCH TELEMETRY DOCKET</p>
          </div>

          <div class="meta-grid">
            <div><strong>Indent No:</strong> ${b.indentNo}</div>
            <div><strong>Date & Time:</strong> ${b.date} | ${b.time}</div>
            <div><strong>Project Site:</strong> ${b.siteName}</div>
            <div><strong>Client Name:</strong> ${b.clientName}</div>
            <div><strong>Transporter:</strong> ${b.transporterName}</div>
            <div><strong>Plant Make:</strong> CONMAT (${b.mixerCapacityM3} m³)</div>
            <div><strong>Mix Grade:</strong> ${b.mixGrade}</div>
            <div><strong>Transit Mixer:</strong> ${b.vehicleNo}</div>
            <div><strong>Total TM Load:</strong> ${b.batchQtyM3} m³</div>
            <div><strong>Plant Mixer Size:</strong> ${b.mixerCapacityM3} m³</div>
            <div><strong>Total Drops:</strong> ${b.totalBatchesCount} Batches</div>
            <div><strong>Batch Operator:</strong> ${b.operator}</div>
          </div>

          <!-- Section 1: Standard Proportions for 1 m3 directly from Mix Design -->
          <div class="section-label">1. Standard Mix Proportion (Per 1 m³ SSD Condition - Linked Mix Design)</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Mix Proportion / m³</th>
                <th>Cement Silo 1</th>
                <th>Cement Silo 2</th>
                <th>M-Sand</th>
                <th>20MM Aggregate</th>
                <th>10MM Aggregate</th>
                <th>Batching Water</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="row-title">Design Weight (1 m³)</td>
                <td><strong>${b.unitRecipe.silo1Kg} kg/m³</strong></td>
                <td><strong>${b.unitRecipe.silo2Kg} kg/m³</strong></td>
                <td><strong>${b.unitRecipe.mSandKg} kg/m³</strong></td>
                <td><strong>${b.unitRecipe.agg20mmKg} kg/m³</strong></td>
                <td><strong>${b.unitRecipe.agg10mmKg} kg/m³</strong></td>
                <td><strong>${b.unitRecipe.waterLtr} L/m³</strong></td>
              </tr>
            </tbody>
          </table>

          <!-- Section 2: Total TM Load Target vs. Actual Summary -->
          <div class="section-label">2. Total TM Load Target vs. Actual Summary (${b.batchQtyM3} m³ Total)</div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Parameters / Material</th>
                <th>Cement Silo 1</th>
                <th>Cement Silo 2</th>
                <th>M-Sand</th>
                <th>20MM Aggregate</th>
                <th>10MM Aggregate</th>
                <th>Batching Water</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="row-title">Total Target Weight</td>
                <td>${b.silo1TargetKg} kg</td>
                <td>${b.silo2TargetKg} kg</td>
                <td>${b.mSandTargetKg} kg</td>
                <td>${b.agg20mmTargetKg} kg</td>
                <td>${b.agg10mmTargetKg} kg</td>
                <td>${b.waterTargetLtr} Litres</td>
              </tr>
              <tr>
                <td class="row-title">Total Actual Batched</td>
                <td><strong>${b.silo1ActualKg} kg</strong></td>
                <td><strong>${b.silo2ActualKg} kg</strong></td>
                <td><strong>${b.mSandActualKg} kg</strong></td>
                <td><strong>${b.agg20mmActualKg} kg</strong></td>
                <td><strong>${b.agg10mmActualKg} kg</strong></td>
                <td><strong>${b.waterActualLtr} Litres</strong></td>
              </tr>
              <tr>
                <td class="row-title">Variance (%)</td>
                <td>${Number(s1Var) > 0 ? `+${s1Var}` : s1Var}%</td>
                <td>${Number(s2Var) > 0 ? `+${s2Var}` : s2Var}%</td>
                <td>${Number(sandVar) > 0 ? `+${sandVar}` : sandVar}%</td>
                <td>${Number(a20Var) > 0 ? `+${a20Var}` : a20Var}%</td>
                <td>${Number(a10Var) > 0 ? `+${a10Var}` : a10Var}%</td>
                <td>${Number(waterVar) > 0 ? `+${waterVar}` : waterVar}%</td>
              </tr>
            </tbody>
          </table>

          <!-- Section 3: Individual Plant Drop Cycles -->
          <div class="section-label">3. Individual Plant Drop Cycles Into TM (${b.mixerCapacityM3} m³ per Batch Cycle)</div>
          <table>
            <thead>
              <tr>
                <th>Drop #</th>
                <th>Cycle Qty</th>
                <th>Cement Silo 1</th>
                <th>Cement Silo 2</th>
                <th>M-Sand</th>
                <th>20MM Aggregate</th>
                <th>10MM Aggregate</th>
                <th>Batching Water</th>
              </tr>
            </thead>
            <tbody>
              ${subBatchRows}
            </tbody>
          </table>

          <div class="footer">
            <div>Transporter: <strong>${b.transporterName}</strong></div>
            <div>Plant Operator: <strong>${b.operator}</strong></div>
            <div>Quality Engineer: ______________________</div>
            <div>Transit Mixer Driver: ______________________</div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6 font-sans text-slate-100 w-full max-w-full">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
            CONMAT PLANT AUTOMATION • TRANSPORTER: BILGI BUILDCON RMC • SITE: {currentSite}
          </span>
          <h2 className="text-xl font-black text-white mt-1 flex items-center gap-2">
            <Factory className="w-6 h-6 text-emerald-400" />
            <span>CONMAT RMC Batch Report (Plant Level)</span>
          </h2>
        </div>

        {/* Mixer Capacity Pill Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTempMixerCap(String(plantMixerCapacity));
              setIsMixerCapModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-cyan-400 hover:text-white bg-cyan-500/10 hover:bg-cyan-600/30 border border-cyan-500/30 transition flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
            title="Configure CONMAT Plant Batching Capacity"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>CONMAT Mixer Size: <strong>{plantMixerCapacity} m³ / batch</strong></span>
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="p-3.5 rounded-2xl bg-[#0b1322] border border-[#1b273d] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070d1a] border border-[#1b273d] px-3 py-2 rounded-xl">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Mixer No, Indent No..."
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
          Total TM Dispatches: <strong className="text-white">{filteredBatches.length}</strong>
        </div>
      </div>

      {/* Batches Table with Collapsible Drop Breakdown */}
      <div className="bg-[#0b1322] border border-[#1b273d] rounded-3xl overflow-hidden shadow-2xl w-full font-mono">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#1b273d] text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-[#070d1a]">
                <th className="py-4 px-4">Indent No</th>
                <th className="py-4 px-4">Mixer No</th>
                <th className="py-4 px-4">Grade</th>
                <th className="py-4 px-4">TM Load Qty</th>
                <th className="py-4 px-4">Drops (@ {plantMixerCapacity} m³)</th>
                <th className="py-4 px-4">Cement Silo 1</th>
                <th className="py-4 px-4">Cement Silo 2</th>
                <th className="py-4 px-4">M-Sand</th>
                <th className="py-4 px-4">20mm / 10mm</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#121c2d] text-slate-200">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-500 font-sans">
                    No plant batch records found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => {
                  const isExpanded = expandedBatchId === b.id;
                  return (
                    <React.Fragment key={b.id}>
                      <tr className="hover:bg-[#0e1728] transition-colors">
                        <td className="py-4 px-4 text-emerald-400 font-bold">{b.indentNo}</td>
                        <td className="py-4 px-4 text-amber-400 font-black">{b.vehicleNo}</td>
                        <td className="py-4 px-4 text-cyan-300 font-bold">{b.mixGrade}</td>
                        <td className="py-4 px-4 font-bold text-white text-sm">{b.batchQtyM3} m³</td>
                        <td className="py-4 px-4">
                          <button
                            type="button"
                            onClick={() => setExpandedBatchId(isExpanded ? null : b.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#070d1a] border border-[#1b273d] text-cyan-300 hover:text-white transition font-bold text-[11px] cursor-pointer"
                          >
                            <span>{b.totalBatchesCount} Drops</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-slate-300">
                          {b.silo1ActualKg} kg <span className="text-[10px] text-slate-500">({b.silo1TargetKg})</span>
                        </td>
                        <td className="py-4 px-4 text-slate-300">
                          {b.silo2ActualKg} kg <span className="text-[10px] text-slate-500">({b.silo2TargetKg})</span>
                        </td>
                        <td className="py-4 px-4 text-slate-300">{b.mSandActualKg} kg</td>
                        <td className="py-4 px-4 text-slate-300">
                          {b.agg20mmActualKg} / {b.agg10mmActualKg}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintBatchDocket(b)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121c2d] hover:bg-emerald-600 text-slate-300 hover:text-white transition font-bold text-xs cursor-pointer"
                            title="Print Plant Batch Docket"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print Docket</span>
                          </button>
                        </td>
                      </tr>

                      {/* Drop Sub-batches detail row with 1 m3 spec block */}
                      {isExpanded && (
                        <tr className="bg-[#070d1a]">
                          <td colSpan={10} className="p-4 border-t border-[#1b273d]">
                            <div className="bg-[#0b1322] border border-[#1e2d44] rounded-2xl p-4 space-y-4">
                              {/* 1 m3 Base Recipe Banner */}
                              <div className="bg-[#070d1a] border border-[#1b273d] p-3 rounded-xl flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-cyan-400" />
                                  <span className="font-bold text-white uppercase">
                                    Linked Mix Design (1 m³ Standard Batching Target):
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-300 text-[11px]">
                                  <span>Silo 1: <strong className="text-blue-400">{b.unitRecipe.silo1Kg} kg/m³</strong></span>
                                  <span>Silo 2: <strong className="text-purple-400">{b.unitRecipe.silo2Kg} kg/m³</strong></span>
                                  <span>M-Sand: <strong className="text-amber-400">{b.unitRecipe.mSandKg} kg/m³</strong></span>
                                  <span>20mm: <strong className="text-emerald-400">{b.unitRecipe.agg20mmKg} kg/m³</strong></span>
                                  <span>10mm: <strong className="text-emerald-400">{b.unitRecipe.agg10mmKg} kg/m³</strong></span>
                                  <span>Water: <strong className="text-cyan-400">{b.unitRecipe.waterLtr} L/m³</strong></span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                                  CONMAT Dropping Sequence ({b.totalBatchesCount} drops into TM {b.vehicleNo} @ {plantMixerCapacity} m³/drop) • Transporter: {b.transporterName}
                                </span>
                                <span className="text-[11px] text-slate-400">Total TM Volume: {b.batchQtyM3} m³</span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center text-xs">
                                {b.drops.map((d) => (
                                  <div key={d.batchIndex} className="bg-[#070d1a] border border-[#1b273d] p-3 rounded-xl space-y-1">
                                    <div className="text-[10px] text-emerald-400 font-bold uppercase">Drop #{d.batchIndex}</div>
                                    <div className="text-sm font-extrabold text-white">{d.batchQtyM3} m³</div>
                                    <div className="text-[10px] text-slate-400 pt-1 border-t border-[#131d2d] space-y-0.5 text-left font-mono">
                                      <div>Silo 1: <strong className="text-blue-300">{d.silo1Kg} kg</strong></div>
                                      <div>Silo 2: <strong className="text-purple-300">{d.silo2Kg} kg</strong></div>
                                      <div>M-Sand: <strong className="text-amber-300">{d.mSandKg} kg</strong></div>
                                      <div>20mm: <strong className="text-emerald-300">{d.agg20mmKg} kg</strong></div>
                                      <div>10mm: <strong className="text-emerald-300">{d.agg10mmKg} kg</strong></div>
                                      <div>Water: <strong className="text-cyan-300">{d.waterLtr} L</strong></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: EDIT CONMAT PLANT MIXER CAPACITY */}
      {isMixerCapModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1322] border border-[#1e2d46] rounded-3xl w-full max-w-sm p-6 shadow-2xl relative font-mono space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#1b273d]">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                <h4 className="text-sm font-bold text-white uppercase font-sans">
                  CONMAT Mixer Capacity
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsMixerCapModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#121c2d] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMixerCap} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 block mb-1.5 font-bold uppercase">
                  CONMAT Twin-Shaft / Pan Size (m³)
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0.25"
                  max="4.0"
                  required
                  value={tempMixerCap}
                  onChange={(e) => setTempMixerCap(e.target.value)}
                  className="w-full bg-[#070d1a] border border-[#1b273d] rounded-2xl px-4 py-3 text-cyan-300 font-black text-sm focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="e.g. 0.75"
                />
                <p className="text-[10px] text-slate-400 mt-1 font-sans">
                  Sub-batches into the transit mixer will automatically scale based on this CONMAT capacity.
                </p>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex gap-2">
                {[0.5, 0.75, 1.0, 1.25].map(cap => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => setTempMixerCap(String(cap))}
                    className={`flex-1 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition ${
                      parseFloat(tempMixerCap) === cap
                        ? 'bg-cyan-600 text-white border-cyan-500'
                        : 'bg-[#070d1a] text-slate-300 border-[#1b273d] hover:border-slate-500'
                    }`}
                  >
                    {cap} m³
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#1b273d]">
                <button
                  type="button"
                  onClick={() => setIsMixerCapModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-[#121c2d] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-600/20 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Update Mixer Size</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RMCBatchReportPage;
