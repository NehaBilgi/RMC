import { StructuralMeasurementItem, StockpileMeasurement, MixGrade } from '../types/rmc';

export const STANDARD_MIX_PRICES: Record<MixGrade, { baseRatePerM3: number; standardSlump: number; description: string }> = {
  'M15': { baseRatePerM3: 3400, standardSlump: 100, description: 'Lean concrete, bedding, kerb backing, sub-base' },
  'M20': { baseRatePerM3: 3750, standardSlump: 120, description: 'PCC, foundations, low-load mass concrete' },
  'M25': { baseRatePerM3: 4100, standardSlump: 140, description: 'Standard RCC, residential slabs, beams, columns' },
  'M30': { baseRatePerM3: 4450, standardSlump: 150, description: 'Commercial structures, commercial slabs, heavy footings' },
  'M35': { baseRatePerM3: 4850, standardSlump: 160, description: 'Heavy columns, retaining walls, post-tensioned slabs' },
  'M40': { baseRatePerM3: 5300, standardSlump: 160, description: 'High-rise transfer girders, shear walls, industrial floors' },
  'M50': { baseRatePerM3: 5950, standardSlump: 175, description: 'Bridges, metro viaducts, heavy industrial pre-stress' },
  'SCC (Self-Compacting)': { baseRatePerM3: 5600, standardSlump: 220, description: 'Congested rebar, architectural finish, vibration-free' },
  'Fiber-Reinforced M30': { baseRatePerM3: 5100, standardSlump: 140, description: 'Pavements, warehouse floor slabs, crack resistance' },
  'Pervious Concrete': { baseRatePerM3: 4900, standardSlump: 50, description: 'Permeable pavements, parking lots, stormwater drainage' },
  'Waterproof M35': { baseRatePerM3: 5350, standardSlump: 160, description: 'Basements, water tanks, swimming pools, podiums' }
};

export const PUMP_RATES: Record<string, { baseCharge: number; ratePerM3: number; pumpingSpeedM3Hr: number }> = {
  'Boom Pump (36m)': { baseCharge: 5500, ratePerM3: 150, pumpingSpeedM3Hr: 45 },
  'Boom Pump (42m)': { baseCharge: 7500, ratePerM3: 180, pumpingSpeedM3Hr: 50 },
  'Static Line Pump': { baseCharge: 4500, ratePerM3: 120, pumpingSpeedM3Hr: 30 },
  'Direct Chute': { baseCharge: 0, ratePerM3: 0, pumpingSpeedM3Hr: 25 },
  'Crane Bucket': { baseCharge: 0, ratePerM3: 0, pumpingSpeedM3Hr: 15 }
};

/**
 * Calculates net concrete volume for an individual structural element
 */
export function calculateElementVolume(item: Omit<StructuralMeasurementItem, 'calculatedNetVolumeM3'>): number {
  let rawVolume = 0;
  const qty = Math.max(1, item.quantity || 1);

  switch (item.type) {
    case 'slab':
    case 'footing':
    case 'rectangular_column':
    case 'beam':
    case 'retaining_wall':
      rawVolume = (item.lengthM || 0) * (item.widthM || 0) * (item.depthM || 0) * qty;
      break;

    case 'circular_column': {
      const diameter = item.diameterM || item.widthM || 0;
      const radius = diameter / 2;
      const height = item.depthM || item.lengthM || 0;
      rawVolume = Math.PI * radius * radius * height * qty;
      break;
    }

    case 'staircase': {
      // item.lengthM = total flight span, item.widthM = stair width, item.depthM = waist slab thickness
      // Approximate volume including triangular steps and waist slab
      const flightLength = item.lengthM || 3;
      const width = item.widthM || 1.2;
      const waist = item.depthM || 0.15;
      const waistVolume = flightLength * width * waist;
      // Steps: average 10 steps of 0.15m riser, 0.3m tread -> 0.5 * 0.15 * 0.3 * 10 * width
      const stepsVolume = 0.5 * 0.15 * 0.3 * 10 * width;
      rawVolume = (waistVolume + stepsVolume) * qty;
      break;
    }

    default:
      rawVolume = (item.lengthM || 0) * (item.widthM || 0) * (item.depthM || 0) * qty;
  }

  // Steel deduction (usually 1-3%)
  const steelDeduction = (item.rebarDeductionPercent || 0) / 100;
  const netVolume = rawVolume * (1 - steelDeduction);
  return Number(Math.max(0, netVolume).toFixed(3));
}

/**
 * Calculates stockpile volume and metric tonnage based on geometry and bulk density
 */
export function calculateStockpileVolumeAndWeight(pile: Omit<StockpileMeasurement, 'calculatedVolumeM3' | 'calculatedWeightTons'>): {
  volumeM3: number;
  weightTons: number;
} {
  let volumeM3 = 0;
  const L = pile.baseLengthM || 0;
  const W = pile.baseWidthM || 0;
  const H = pile.heightM || 0;

  if (pile.shape === 'cone') {
    // Conical stockpile: (1/3) * π * r^2 * h where radius is average of (L/2 and W/2)
    const radius = (L + W) / 4;
    volumeM3 = (1 / 3) * Math.PI * (radius * radius) * H;
  } else if (pile.shape === 'trapezoidal_pile') {
    // Sloped embankment stockpile: average top and bottom cross-section
    const topFactor = 0.5; // typical natural angle of repose
    const topArea = (L * topFactor) * (W * topFactor);
    const bottomArea = L * W;
    volumeM3 = (H / 3) * (bottomArea + topArea + Math.sqrt(bottomArea * topArea));
  } else {
    // Box bunker / retaining bin
    volumeM3 = L * W * H;
  }

  const roundedVol = Number(Math.max(0, volumeM3).toFixed(2));
  const density = pile.bulkDensityTonsPerM3 || 1.6;
  const weightTons = Number((roundedVol * density).toFixed(2));

  return {
    volumeM3: roundedVol,
    weightTons
  };
}

/**
 * Calculates mixer truck loads, batching intervals, and pour duration
 */
export function calculatePourLogistics(params: {
  totalGrossM3: number;
  truckCapacityM3?: number;
  pourType: string;
  transitDistanceKm?: number;
}) {
  const capacity = params.truckCapacityM3 || 7;
  const totalM3 = params.totalGrossM3;
  const totalTrucks = Math.ceil(totalM3 / capacity);

  const pumpInfo = PUMP_RATES[params.pourType] || PUMP_RATES['Boom Pump (36m)'];
  const pourSpeed = pumpInfo.pumpingSpeedM3Hr;
  const estimatedPourHours = totalM3 > 0 ? Number((totalM3 / pourSpeed).toFixed(1)) : 0;
  const pourMinutes = Math.round(estimatedPourHours * 60);

  // Recommended dispatch frequency in minutes between trucks
  // E.g. If pour speed is 45 m3/hr, 7 m3 takes ~9.3 mins to discharge + 10 mins wash/setup = ~20 mins interval
  const dischargeTimePerTruckMins = Math.round((capacity / pourSpeed) * 60) + 8;
  const recommendedIntervalMins = Math.max(15, dischargeTimePerTruckMins);

  return {
    truckCapacityM3: capacity,
    totalTrucks,
    fullTrucks: Math.floor(totalM3 / capacity),
    remainderM3: Number((totalM3 % capacity).toFixed(2)),
    estimatedPourHours,
    pourMinutes,
    recommendedIntervalMins,
    pumpBaseFee: pumpInfo.baseCharge,
    pumpPumpingFee: Math.round(totalM3 * pumpInfo.ratePerM3)
  };
}

/**
 * Estimates hydration slump loss and danger level
 * Fresh concrete loses slump as hydration progresses (critical after 90 mins)
 */
export function evaluateHydrationStatus(elapsedMinutes: number, ambientTempC = 32): {
  status: 'Fresh & Fluid' | 'Pouring Window Optimal' | 'Slump Loss Warning' | 'Critical Hydration / Cold Joint Risk';
  color: string;
  lossPercent: number;
  recommendedAction: string;
} {
  // Accelerated in high ambient temperatures
  const tempMultiplier = ambientTempC > 30 ? 1.25 : 1.0;
  const adjustedMins = elapsedMinutes * tempMultiplier;

  if (adjustedMins <= 30) {
    return {
      status: 'Fresh & Fluid',
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
      lossPercent: 5,
      recommendedAction: 'Full workability. Direct chute or pump immediately.'
    };
  } else if (adjustedMins <= 60) {
    return {
      status: 'Pouring Window Optimal',
      color: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30',
      lossPercent: 15,
      recommendedAction: 'Normal discharge rate. Slump within specified tolerance.'
    };
  } else if (adjustedMins <= 90) {
    return {
      status: 'Slump Loss Warning',
      color: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
      lossPercent: 35,
      recommendedAction: 'Rapid discharge required. Check slump; dosed retarder active.'
    };
  } else {
    return {
      status: 'Critical Hydration / Cold Joint Risk',
      color: 'text-rose-400 bg-rose-950/60 border-rose-500/30',
      lossPercent: 65,
      recommendedAction: 'CRITICAL: Slump severely depleted. Do NOT add uncontrolled water. Site engineer approval required.'
    };
  }
}
