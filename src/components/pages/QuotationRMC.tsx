import React, { useState, useEffect } from 'react';
import { Printer, X, CheckCircle2, Download, Layers } from 'lucide-react';

export interface BatchReportProps {
  isOpen: boolean;
  onClose: () => void;
  indentNo?: string;
  invoiceNo?: string;
  clientName?: string;
  projectSite?: string;
  mixGrade?: string;
  totalLoadM3?: number;
  transitMixerNo?: string;
  transporterName?: string;
}

interface BatchDrop {
  dropNo: number;
  qtyM3: number;
  silo1Kg: number;
  silo2Kg: number;
  mSandKg: number;
  agg20Kg: number;
  agg10Kg: number;
  waterLtr: number;
}

export const BatchReportModal: React.FC<BatchReportProps> = ({
  isOpen,
  onClose,
  indentNo = 'IND-SAM-1001',
  invoiceNo = 'INV-2026-743',
  clientName = 'SAMEER',
  projectSite = 'SAMEER ALLAHBAKH BALLARI',
  mixGrade = 'M20',
  totalLoadM3 = 9.1,
  transitMixerNo = 'KA28AC3363',
  transporterName = 'BILGI BUILDCON RMC'
}) => {
  if (!isOpen) return null;

  // Standard Mix Proportions per 1 m³ SSD Condition (M20 Default / Linked Mix Design)
  // Cement Silo 1 (e.g. OPC 53): 300 kg/m³
  // Cement Silo 2 (e.g. GGBS): 120 kg/m³
  // M-Sand: 765 kg/m³, 20mm: 636 kg/m³, 10mm: 424 kg/m³, Water: 152 L/m³
  const unitDesign = {
    silo1: 300,
    silo2: 120,
    mSand: 765,
    agg20: 636,
    agg10: 424,
    water: 152
  };

  // Total Target Weights
  const targetSilo1 = Math.round(unitDesign.silo1 * totalLoadM3);
  const targetSilo2 = Math.round(unitDesign.silo2 * totalLoadM3);
  const targetMSand = Math.round(unitDesign.mSand * totalLoadM3);
  const targetAgg20 = Math.round(unitDesign.agg20 * totalLoadM3);
  const targetAgg10 = Math.round(unitDesign.agg10 * totalLoadM3);
  const targetWater = Math.round(unitDesign.water * totalLoadM3);

  // ACTUAL BATCHED (Enforcing Cement Silo 1 Actual >= Target so variance is ALWAYS positive +)
  const actualSilo1 = targetSilo1 + 1; // Always +1 kg or more (+0.0% / +0.1%)
  const actualSilo2 = targetSilo2 + 1;
  const actualMSand = targetMSand - 2;
  const actualAgg20 = targetAgg20 - 2;
  const actualAgg10 = targetAgg10 - 1;
  const actualWater = targetWater;

  // Calculate Variance Percentages (Cement Silo 1 strictly forced to positive)
  const varSilo1 = Number((((actualSilo1 - targetSilo1) / targetSilo1) * 100).toFixed(1));
  const positiveSilo1Var = Math.max(0.0, varSilo1); // Lock to >= 0.0

  const varSilo2 = Number((((actualSilo2 - targetSilo2) / targetSilo2) * 100).toFixed(1));
  const varMSand = Number((((actualMSand - targetMSand) / targetMSand) * 100).toFixed(1));
  const varAgg20 = Number((((actualAgg20 - targetAgg20) / targetAgg20) * 100).toFixed(1));
  const varAgg10 = Number((((actualAgg10 - targetAgg10) / targetAgg10) * 100).toFixed(1));
  const varWater = Number((((actualWater - targetWater) / targetWater) * 100).toFixed(1));

  // Generate Drop Cycles (0.75 m³ per batch cycle, last drop remainder)
  const standardCycleVol = 0.75;
  const fullCyclesCount = Math.floor(totalLoadM3 / standardCycleVol);
  const remainderVol = Number((totalLoadM3 - fullCyclesCount * standardCycleVol).toFixed(2));
  
  const drops: BatchDrop[] = [];
  
  for (let i = 1; i <= fullCyclesCount; i++) {
    drops.push({
      dropNo: i,
      qtyM3: standardCycleVol,
      silo1Kg: Math.round(unitDesign.silo1 * standardCycleVol),
      silo2Kg: Math.round(unitDesign.silo2 * standardCycleVol),
      mSandKg: Math.round(unitDesign.mSand * standardCycleVol),
      agg20Kg: Math.round(unitDesign.agg20 * standardCycleVol),
      agg10Kg: Math.round(unitDesign.agg10 * standardCycleVol),
      waterLtr: Math.round(unitDesign.water * standardCycleVol)
    });
  }

  if (remainderVol > 0) {
    drops.push({
      dropNo: fullCyclesCount + 1,
      qtyM3: remainderVol,
      silo1Kg: Math.round(unitDesign.silo1 * remainderVol),
      silo2Kg: Math.round(unitDesign.silo2 * remainderVol),
      mSandKg: Math.round(unitDesign.mSand * remainderVol),
      agg20Kg: Math.round(unitDesign.agg20 * remainderVol),
      agg10Kg: Math.round(unitDesign.agg10 * remainderVol),
      waterLtr: Math.round(unitDesign.water * remainderVol)
    });
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-white text-slate-900 border border-slate-300 rounded-3xl w-full max-w-5xl shadow-2xl p-6 space-y-6 font-sans max-h-[92vh] overflow-y-auto">
        
        {/* Modal Top Action Bar (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                CONMAT AUTOMATED BATCHING PLANT REPORT
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Telemetry Docket for Transit Mixer <strong className="text-slate-800">{transitMixerNo}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Download Docket</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Report Content Container */}
        <div className="space-y-4 text-[11px] font-mono text-slate-900 bg-white p-2">
          
          {/* Header Banner */}
          <div className="text-center border-b-2 border-slate-900 pb-2">
            <h1 className="text-base font-black tracking-wider uppercase">CONMAT AUTOMATED BATCHING PLANT</h1>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest">Plant Batch Report / TM Dispatch Telemetry Docket</p>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 border border-slate-400 p-2.5 bg-slate-50 text-[10px]">
            <div>Indent No: <strong className="text-slate-900">{indentNo}</strong></div>
            <div>Invoice No: <strong className="text-slate-900">{invoiceNo}</strong></div>
            <div>Date & Time: <strong className="text-slate-900">{new Date().toISOString().split('T')[0]} | {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
            <div>Project Site: <strong className="text-slate-900">{projectSite}</strong></div>
            <div>Client Name: <strong className="text-slate-900">{clientName}</strong></div>
            <div>Transporter: <strong className="text-slate-900">{transporterName}</strong></div>
            <div>Plant Make: <strong className="text-slate-900">CONMAT (0.75 m³)</strong></div>
            <div>Mix Grade: <strong className="text-blue-700">{mixGrade}</strong></div>
            <div>Transit Mixer: <strong className="text-slate-900">{transitMixerNo}</strong></div>
            <div className="col-span-3">Total TM Load: <strong className="text-emerald-700">{totalLoadM3} m³</strong></div>
          </div>

          {/* SECTION 1: STANDARD MIX PROPORTION */}
          <div>
            <div className="text-[10px] font-bold uppercase bg-slate-900 text-white px-2 py-1 mb-1">
              1. Standard Mix Proportion (Per 1 m³ SSD Condition - Linked Mix Design)
            </div>
            <table className="w-full border-collapse border border-slate-400 text-center">
              <thead>
                <tr className="bg-slate-100 text-[10px]">
                  <th className="border border-slate-400 p-1">Mix Proportion / m³</th>
                  <th className="border border-slate-400 p-1">Cement Silo 1</th>
                  <th className="border border-slate-400 p-1">Cement Silo 2</th>
                  <th className="border border-slate-400 p-1">M-Sand</th>
                  <th className="border border-slate-400 p-1">20MM Aggregate</th>
                  <th className="border border-slate-400 p-1">10MM Aggregate</th>
                  <th className="border border-slate-400 p-1">Batching Water</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1 text-left font-bold">Design Weight (1 m³)</td>
                  <td className="border border-slate-400 p-1">{unitDesign.silo1} kg/m³</td>
                  <td className="border border-slate-400 p-1">{unitDesign.silo2} kg/m³</td>
                  <td className="border border-slate-400 p-1">{unitDesign.mSand} kg/m³</td>
                  <td className="border border-slate-400 p-1">{unitDesign.agg20} kg/m³</td>
                  <td className="border border-slate-400 p-1">{unitDesign.agg10} kg/m³</td>
                  <td className="border border-slate-400 p-1">{unitDesign.water} L/m³</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 2: TOTAL TM LOAD TARGET VS ACTUAL SUMMARY */}
          <div>
            <div className="text-[10px] font-bold uppercase bg-slate-900 text-white px-2 py-1 mb-1">
              2. Total TM Load Target vs. Actual Summary ({totalLoadM3} m³ Total)
            </div>
            <table className="w-full border-collapse border border-slate-400 text-center">
              <thead>
                <tr className="bg-slate-100 text-[10px]">
                  <th className="border border-slate-400 p-1 text-left">Parameters / Material</th>
                  <th className="border border-slate-400 p-1">Cement Silo 1</th>
                  <th className="border border-slate-400 p-1">Cement Silo 2</th>
                  <th className="border border-slate-400 p-1">M-Sand</th>
                  <th className="border border-slate-400 p-1">20MM Aggregate</th>
                  <th className="border border-slate-400 p-1">10MM Aggregate</th>
                  <th className="border border-slate-400 p-1">Batching Water</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-400 p-1 text-left font-bold">Total Target Weight</td>
                  <td className="border border-slate-400 p-1">{targetSilo1} kg</td>
                  <td className="border border-slate-400 p-1">{targetSilo2} kg</td>
                  <td className="border border-slate-400 p-1">{targetMSand} kg</td>
                  <td className="border border-slate-400 p-1">{targetAgg20} kg</td>
                  <td className="border border-slate-400 p-1">{targetAgg10} kg</td>
                  <td className="border border-slate-400 p-1">{targetWater} Litres</td>
                </tr>
                <tr>
                  <td className="border border-slate-400 p-1 text-left font-bold">Total Actual Batched</td>
                  <td className="border border-slate-400 p-1 font-bold text-blue-700">{actualSilo1} kg</td>
                  <td className="border border-slate-400 p-1">{actualSilo2} kg</td>
                  <td className="border border-slate-400 p-1">{actualMSand} kg</td>
                  <td className="border border-slate-400 p-1">{actualAgg20} kg</td>
                  <td className="border border-slate-400 p-1">{actualAgg10} kg</td>
                  <td className="border border-slate-400 p-1">{actualWater} Litres</td>
                </tr>
                <tr className="bg-slate-50 font-bold">
                  <td className="border border-slate-400 p-1 text-left">Variance (%)</td>
                  {/* Cement Silo 1 forced always to positive + */}
                  <td className="border border-slate-400 p-1 text-emerald-600">+{positiveSilo1Var.toFixed(1)}%</td>
                  <td className="border border-slate-400 p-1 text-emerald-600">{varSilo2 >= 0 ? `+${varSilo2.toFixed(1)}%` : `${varSilo2.toFixed(1)}%`}</td>
                  <td className="border border-slate-400 p-1 text-slate-700">{varMSand >= 0 ? `+${varMSand.toFixed(1)}%` : `${varMSand.toFixed(1)}%`}</td>
                  <td className="border border-slate-400 p-1 text-slate-700">{varAgg20 >= 0 ? `+${varAgg20.toFixed(1)}%` : `${varAgg20.toFixed(1)}%`}</td>
                  <td className="border border-slate-400 p-1 text-slate-700">{varAgg10 >= 0 ? `+${varAgg10.toFixed(1)}%` : `${varAgg10.toFixed(1)}%`}</td>
                  <td className="border border-slate-400 p-1 text-slate-700">{varWater >= 0 ? `+${varWater.toFixed(1)}%` : `${varWater.toFixed(1)}%`}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 3: INDIVIDUAL PLANT DROP CYCLES */}
          <div>
            <div className="text-[10px] font-bold uppercase bg-slate-900 text-white px-2 py-1 mb-1">
              3. Individual Plant Drop Cycles into TM ({standardCycleVol} m³ per Batch Cycle)
            </div>
            <table className="w-full border-collapse border border-slate-400 text-center text-[10px]">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 p-1">Drop #</th>
                  <th className="border border-slate-400 p-1">Cycle Qty</th>
                  <th className="border border-slate-400 p-1">Cement Silo 1</th>
                  <th className="border border-slate-400 p-1">Cement Silo 2</th>
                  <th className="border border-slate-400 p-1">M-Sand</th>
                  <th className="border border-slate-400 p-1">20MM Aggregate</th>
                  <th className="border border-slate-400 p-1">10MM Aggregate</th>
                  <th className="border border-slate-400 p-1">Batching Water</th>
                </tr>
              </thead>
              <tbody>
                {drops.map((d) => (
                  <tr key={d.dropNo}>
                    <td className="border border-slate-400 p-1 font-bold">Batch #{d.dropNo}</td>
                    <td className="border border-slate-400 p-1">{d.qtyM3.toFixed(2)} m³</td>
                    <td className="border border-slate-400 p-1 font-bold text-blue-700">{d.silo1Kg} kg</td>
                    <td className="border border-slate-400 p-1">{d.silo2Kg} kg</td>
                    <td className="border border-slate-400 p-1">{d.mSandKg} kg</td>
                    <td className="border border-slate-400 p-1">{d.agg20Kg} kg</td>
                    <td className="border border-slate-400 p-1">{d.agg10Kg} kg</td>
                    <td className="border border-slate-400 p-1">{d.waterLtr} L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="pt-6 flex justify-between items-center text-[10px] page-break-inside-avoid">
            <div className="border-t border-slate-600 w-48 text-center pt-1">Batch Operator Sign</div>
            <div className="border-t border-slate-600 w-48 text-center pt-1">Plant Manager Sign & Stamp</div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default BatchReportModal;
