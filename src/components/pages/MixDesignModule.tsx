import React, { useState, useEffect } from 'react';
import { Layers, Edit2, Save, X, Check, RotateCcw, Lock, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cloudStorage } from '../../services/cloudStorage';

export type AdmixtureMode = 'GGBS' | 'FLY_ASH';

export interface MixRecipe {
  grade: string;
  targetMpa: number;
  wcr: number;
  cementKg: number;
  mineralAdmixtureKg: number;
  waterLitres: number;
  mSandKg: number;
  agg20mmKg: number;
  agg10mmKg: number;
  admixtureKg: number;
  totalDensity: number;
}

// Bilgi Buildcon RMC 1 m³ Quality Assurance Standards (Rev. 2, Yield: 2,400.0 kg/m³)
export const BILGI_QA_REV2_GGBS: Record<string, MixRecipe> = {
  'M10': { grade: 'M10', targetMpa: 15.0, wcr: 0.65, cementKg: 168, mineralAdmixtureKg: 42, waterLitres: 136, mSandKg: 1057, agg20mmKg: 597, agg10mmKg: 398, admixtureKg: 1.68, totalDensity: 2400 },
  'M15': { grade: 'M15', targetMpa: 20.8, wcr: 0.56, cementKg: 200, mineralAdmixtureKg: 50, waterLitres: 140, mSandKg: 1034, agg20mmKg: 584, agg10mmKg: 390, admixtureKg: 2.00, totalDensity: 2400 },
  'M20': { grade: 'M20', targetMpa: 26.6, wcr: 0.49, cementKg: 240, mineralAdmixtureKg: 60, waterLitres: 147, mSandKg: 1005, agg20mmKg: 567, agg10mmKg: 379, admixtureKg: 2.40, totalDensity: 2400 },
  'M25': { grade: 'M25', targetMpa: 31.6, wcr: 0.45, cementKg: 280, mineralAdmixtureKg: 70, waterLitres: 158, mSandKg: 973, agg20mmKg: 550, agg10mmKg: 366, admixtureKg: 2.80, totalDensity: 2400 },
  'M30': { grade: 'M30', targetMpa: 38.3, wcr: 0.42, cementKg: 304, mineralAdmixtureKg: 76, waterLitres: 160, mSandKg: 956, agg20mmKg: 541, agg10mmKg: 360, admixtureKg: 3.04, totalDensity: 2400 },
  'M35': { grade: 'M35', targetMpa: 43.3, wcr: 0.40, cementKg: 320, mineralAdmixtureKg: 80, waterLitres: 160, mSandKg: 946, agg20mmKg: 535, agg10mmKg: 356, admixtureKg: 3.20, totalDensity: 2400 },
  'M40': { grade: 'M40', targetMpa: 48.3, wcr: 0.38, cementKg: 336, mineralAdmixtureKg: 84, waterLitres: 160, mSandKg: 936, agg20mmKg: 529, agg10mmKg: 352, admixtureKg: 3.36, totalDensity: 2400 },
  'M45': { grade: 'M45', targetMpa: 53.3, wcr: 0.36, cementKg: 352, mineralAdmixtureKg: 88, waterLitres: 158, mSandKg: 928, agg20mmKg: 524, agg10mmKg: 349, admixtureKg: 3.52, totalDensity: 2400 },
  'M50': { grade: 'M50', targetMpa: 58.3, wcr: 0.34, cementKg: 368, mineralAdmixtureKg: 92, waterLitres: 156, mSandKg: 921, agg20mmKg: 520, agg10mmKg: 346, admixtureKg: 3.68, totalDensity: 2400 }
};

// Exported alias so RMCBatchReportPage.tsx and other modules compile without errors
export const BILGI_QA_REV2_FLY_ASH: Record<string, MixRecipe> = BILGI_QA_REV2_GGBS;

const extractCleanSiteName = (name: string): string => {
  if (!name) return 'BASVARAJ';
  let clean = String(name).trim();
  if (clean.includes('(')) clean = clean.split('(')[0].trim();
  return clean.toUpperCase();
};

export const
