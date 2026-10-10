export type MixGrade = 
  | 'M15' 
  | 'M20' 
  | 'M25' 
  | 'M30' 
  | 'M35' 
  | 'M40' 
  | 'M50' 
  | 'SCC (Self-Compacting)' 
  | 'Fiber-Reinforced M30' 
  | 'Pervious Concrete' 
  | 'Waterproof M35';

export type PourType = 
  | 'Boom Pump (36m)' 
  | 'Boom Pump (42m)' 
  | 'Static Line Pump' 
  | 'Direct Chute' 
  | 'Crane Bucket';

export type OrderStatus = 
  | 'quote_draft' 
  | 'confirmed' 
  | 'batching' 
  | 'in_transit' 
  | 'pouring' 
  | 'completed' 
  | 'cancelled';

export interface Admixture {
  id: string;
  name: string;
  type: 'retarder' | 'plasticizer' | 'waterproofing' | 'accelerator' | 'silica_fume';
  dosagePerM3Kg: number;
  pricePerM3: number;
}

export interface TransitMixerTruck {
  id: string;
  truckNumber: string;
  driverName: string;
  driverPhone: string;
  capacityM3: number;
  currentLoadM3: number;
  orderId?: string;
  status: 'at_plant' | 'loading' | 'en_route' | 'on_site' | 'discharging' | 'returning' | 'maintenance';
  batchTime?: string; // ISO string or time string
  departureTime?: string;
  etaToSiteMinutes?: number;
  slumpAtBatchingMm?: number;
  elapsedHydrationMinutes: number; // Max safe is 90-120 mins before initial set
  currentSpeedKmH?: number;
  gpsLocation: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface BatchPlant {
  id: string;
  name: string;
  code: string;
  location: string;
  capacityM3PerHour: number;
  currentUtilizationPercent: number;
  distanceKm: number;
  transitTimeMinutes: number;
  activeMixersCount: number;
}

export interface OrderItem {
  mixGrade: MixGrade;
  quantityM3: number;
  slumpTargetMm: number; // e.g. 120, 150, 180
  aggregateSizeMm: 10 | 20;
  admixtures: string[]; // names or IDs
  unitRatePerM3: number;
  totalMixPrice: number;
}

export interface DeliveryChallan {
  id: string;
  challanNumber: string;
  orderId: string;
  mixerTruckNumber: string;
  driverName: string;
  driverPhone: string;
  batchTimestamp: string;
  siteDepartureTime: string;
  siteArrivalTime?: string;
  pourCompleteTime?: string;
  grossWeightKg?: number;
  tareWeightKg?: number;
  netWeightKg?: number;
  batchVolumeM3: number;
  waterCementRatio: number;
  waterAddedAtPlantLiters: number;
  siteWaterAdditionLiters: number;
  slumpAtPlantMm: number;
  slumpAtSiteMm?: number;
  cubeSampleTaken: boolean;
  cubeSampleCount: number;
  receiverName?: string;
  receiverSignature?: boolean;
}

export type InvoicePaymentStatus = 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'disputed';

export interface RMCInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  billingAddress: string;
  taxId: string; // GSTIN / TIN / VAT ID
  projectName: string;
  siteAddress: string;
  batchPlantName: string;
  hsnSacCode: string; // e.g. 38245010 for Ready-Mix Concrete
  
  // Volume & rates
  billedVolumeM3: number;
  mixGrade: MixGrade;
  baseRatePerM3: number;
  concreteAmount: number;
  
  // Surcharges & Billable Add-ons
  pumpingFee: number;
  freightHaulageFee: number;
  admixtureSurcharge: number;
  demurrageCharges: number; // Waiting time fee for delayed truck turnaround on site
  transitMixerCount: number;
  deliveryChallanNumbers: string[];
  
  // Taxation
  subtotal: number;
  cgstRatePercent: number; // Central GST 9%
  sgstRatePercent: number; // State GST 9% or IGST 18%
  cgstAmount: number;
  sgstAmount: number;
  totalTax: number;
  roundOff: number;
  grandTotal: number;
  
  // Payment reconciliation
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: InvoicePaymentStatus;
  paymentTerms: 'Advance' | '30 Days Net' | 'PDC' | 'LC';
  paymentReference?: string;
  paidDate?: string;
  notes?: string;
}

export interface RMCOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  contactPerson: string;
  phone: string;
  projectName: string;
  siteAddress: string;
  billingAddress?: string;
  customerTaxId?: string;
  pourLocationInStructure: string; // e.g. "Level 4 Post-Tensioned Slab", "Retaining Wall Grid B-4"
  status: OrderStatus;
  orderDate: string;
  scheduledPourDate: string;
  scheduledPourTime: string;
  batchPlantId: string;
  batchPlantName: string;
  items: OrderItem[];
  totalVolumeM3: number;
  deliveredVolumeM3: number;
  pourType: PourType;
  pumpCharges: number;
  freightSurcharge: number;
  admixtureCharges: number;
  demurrageCharges?: number;
  subtotal: number;
  tax: number;
  totalAmount: number;
  paymentTerms: 'Advance' | '30 Days Net' | 'PDC' | 'LC';
  creditApproved: boolean;
  assignedMixerIds: string[];
  salesRepId: string;
  salesRepName: string;
  notes?: string;
  cubeStrengthTargetMPa: number;
  tested7DayMPa?: number;
  tested28DayMPa?: number;
  invoiceId?: string;
  challans?: DeliveryChallan[];
}

export type StructuralElementType = 
  | 'slab' 
  | 'footing' 
  | 'rectangular_column' 
  | 'circular_column' 
  | 'beam' 
  | 'retaining_wall' 
  | 'staircase';

export interface StructuralMeasurementItem {
  id: string;
  name: string;
  type: StructuralElementType;
  // Dimensions in meters
  lengthM: number;
  widthM: number;
  depthM: number; // or thickness / height
  diameterM?: number; // for circular columns
  quantity: number;
  rebarDeductionPercent: number; // typically 1-3% volume occupied by steel
  calculatedNetVolumeM3: number;
  color?: string;
}

export interface StockpileMeasurement {
  id: string;
  materialName: '10mm Aggregate' | '20mm Aggregate' | 'River Sand' | 'Manufactured Sand (M-Sand)' | 'Cement Silo / Bags';
  shape: 'cone' | 'trapezoidal_pile' | 'box_bunker';
  // dimensions in meters
  baseLengthM: number;
  baseWidthM: number;
  heightM: number;
  bulkDensityTonsPerM3: number; // e.g. 1.6 for coarse aggregate, 1.45 for sand
  calculatedVolumeM3: number;
  calculatedWeightTons: number;
  reorderThresholdTons: number;
  lastMeasuredDate: string;
}

export interface SiteMeasurementSession {
  id: string;
  projectName: string;
  contractor: string;
  siteLocation: string;
  salesRepName: string;
  date: string;
  structures: StructuralMeasurementItem[];
  stockpiles: StockpileMeasurement[];
  safetyWastagePercent: number; // 3% to 15%
  recommendedMixGrade: MixGrade;
  recommendedPourType: PourType;
  totalNetM3: number;
  totalGrossM3: number; // with wastage
  transitTruckCapacityM3: number; // e.g. 7 or 8 m3
  requiredTruckLoads: number;
  notes: string;
}

export interface SiteVisitRecord {
  id: string;
  date: string;
  time: string;
  clientName: string;
  projectName: string;
  location: string;
  purpose: 'Pour Inspection' | 'Rate Negotiation' | 'Slump Sampling' | 'Site Measurement' | 'Payment Collection';
  outcome: 'Quote Requested' | 'Order Booked' | 'Follow-up Needed' | 'Quality Clearance Signed';
  nextActionDate: string;
  notes: string;
  slumpCheckedMm?: number;
  salesRepName: string;
}
