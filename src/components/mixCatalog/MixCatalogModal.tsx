import React from 'react';
import { STANDARD_MIX_PRICES, PUMP_RATES } from '../../utils/concreteCalculations';
import { AVAILABLE_ADMIXTURES } from '../../data/mockData';
import { MixGrade } from '../../types/rmc';
import { 
  BookOpen, 
  Check, 
  ShieldCheck, 
  Droplets, 
  Layers, 
  HelpCircle,
  Truck,
  Sparkles
} from 'lucide-react';

interface Props {
  onSelectMixToOrder: (grade: MixGrade) => void;
}

export const MixCatalogModal: React.FC<Props> = ({ onSelectMixToOrder }) => {
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">RMC Mix Design Catalog & Technical Rate Book</h2>
            <p className="text-xs text-slate-400">Standard & high-performance concrete mix grades, slump ranges, and pricing</p>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 hidden sm:block">
          ASTM C94 / EN 206 / IS 456 Compliant
        </div>
      </div>

      {/* Concrete Mix Grade Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(STANDARD_MIX_PRICES).map(([grade, data]) => {
          const mpa = parseInt(grade.replace(/\D/g, '')) || (grade.includes('SCC') ? 40 : 35);

          return (
            <div
              key={grade}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between hover:border-amber-500/50 transition-all shadow-md group"
            >
              <div>
                <div className="flex items-start justify-between pb-2 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-mono text-amber-400 font-bold block">{mpa} MPa Strength</span>
                    <h3 className="text-base font-black text-white group-hover:text-amber-400 transition">{grade}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-amber-400">
                      ${data.baseRatePerM3}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">per m³ net</span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                  {data.description}
                </p>

                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-mono">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">STANDARD SLUMP</span>
                    <span className="text-cyan-400 font-bold">{data.standardSlump} mm</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">CEMENT TYPE</span>
                    <span className="text-white font-bold">OPC 53 / Flyash</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onSelectMixToOrder(grade as MixGrade)}
                className="w-full py-2 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-bold rounded-lg text-xs transition border border-slate-700 hover:border-amber-400 flex items-center justify-center gap-1.5"
              >
                <span>Book This Grade</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Admixtures & Chemical Additives Price Reference */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
          <Droplets className="w-4 h-4 text-cyan-400" />
          Special Chemical Admixtures & Surcharges
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {AVAILABLE_ADMIXTURES.map(adm => (
            <div key={adm.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">{adm.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">Dosage: ~{adm.dosagePerM3Kg} kg/m³</span>
              </div>
              <span className="text-xs font-mono font-bold text-amber-400">
                +${adm.pricePerM3}/m³
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pumping & Placement Tariff */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
          <Truck className="w-4 h-4 text-amber-400" />
          Concrete Pumping Equipment Tariff
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(PUMP_RATES).map(([name, rate]) => (
            <div key={name} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{name}</span>
                <span className="text-[10px] text-cyan-400 font-mono">{rate.pumpingSpeedM3Hr} m³/hr</span>
              </div>
              <div className="text-xs font-mono text-amber-400 flex items-center justify-between pt-1">
                <span>Base: ${rate.baseCharge}</span>
                <span>Pumping: +${rate.ratePerM3}/m³</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
