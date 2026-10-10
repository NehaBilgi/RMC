import { 
  BatchPlant, 
  TransitMixerTruck, 
  RMCOrder, 
  SiteMeasurementSession, 
  SiteVisitRecord,
  Admixture
} from '../types/rmc';

export const BATCH_PLANTS: BatchPlant[] = [
  {
    id: 'plant-metro-1',
    name: 'Metropolis Central Batching Hub',
    code: 'MCB-01',
    location: 'Sector 62 Industrial Area, Metro Expressway',
    capacityM3PerHour: 120,
    currentUtilizationPercent: 78,
    distanceKm: 14.5,
    transitTimeMinutes: 32,
    activeMixersCount: 9
  },
  {
    id: 'plant-west-2',
    name: 'Westside High-Capacity Batch Plant',
    code: 'WHC-02',
    location: 'Ring Road Interchange, West Corridor',
    capacityM3PerHour: 90,
    currentUtilizationPercent: 62,
    distanceKm: 22.0,
    transitTimeMinutes: 45,
    activeMixersCount: 6
  },
  {
    id: 'plant-south-3',
    name: 'Harbor & Airport Extension Plant',
    code: 'HAE-03',
    location: 'Airport Expressway km 18',
    capacityM3PerHour: 150,
    currentUtilizationPercent: 88,
    distanceKm: 9.8,
    transitTimeMinutes: 20,
    activeMixersCount: 12
  }
];

export const AVAILABLE_ADMIXTURES: Admixture[] = [
  { id: 'adm-retarder', name: 'MasterSet Retarder-300 (Long Haul)', type: 'retarder', dosagePerM3Kg: 1.8, pricePerM3: 180 },
  { id: 'adm-polycarb', name: 'Polycarboxylate High-Range Superplasticizer (Flow 160mm+)', type: 'plasticizer', dosagePerM3Kg: 3.2, pricePerM3: 290 },
  { id: 'adm-waterproof', name: 'Crystalline Integral Waterproofing (Pore Blocker)', type: 'waterproofing', dosagePerM3Kg: 2.5, pricePerM3: 350 },
  { id: 'adm-accelerator', name: 'Rapid Set Accelerator (Early Strength)', type: 'accelerator', dosagePerM3Kg: 2.0, pricePerM3: 240 },
  { id: 'adm-microsilica', name: 'Densified Micro-Silica (M50+ Durability)', type: 'silica_fume', dosagePerM3Kg: 15.0, pricePerM3: 480 }
];

export const INITIAL_TRANSIT_MIXERS: TransitMixerTruck[] = [
  {
    id: 'tm-101',
    truckNumber: 'TM-101 (Schwing 8m³)',
    driverName: 'Vikram Singh',
    driverPhone: '+1 (555) 349-8801',
    capacityM3: 8,
    currentLoadM3: 8,
    orderId: 'ord-1001',
    status: 'discharging',
    batchTime: '10:45 AM',
    departureTime: '10:55 AM',
    etaToSiteMinutes: 0,
    slumpAtBatchingMm: 160,
    elapsedHydrationMinutes: 48,
    currentSpeedKmH: 0,
    gpsLocation: {
      lat: 28.5355,
      lng: 77.3910,
      address: 'Tower A, Grand Horizon Project, Site Gate 2'
    }
  },
  {
    id: 'tm-104',
    truckNumber: 'TM-104 (Putzmeister 7m³)',
    driverName: 'Rajesh Kumar',
    driverPhone: '+1 (555) 438-9922',
    capacityM3: 7,
    currentLoadM3: 7,
    orderId: 'ord-1001',
    status: 'en_route',
    batchTime: '11:15 AM',
    departureTime: '11:22 AM',
    etaToSiteMinutes: 12,
    slumpAtBatchingMm: 165,
    elapsedHydrationMinutes: 28,
    currentSpeedKmH: 42,
    gpsLocation: {
      lat: 28.5200,
      lng: 77.3600,
      address: 'Sector 71 Flyover approach'
    }
  },
  {
    id: 'tm-109',
    truckNumber: 'TM-109 (Liebherr 9m³)',
    driverName: 'Amit Verma',
    driverPhone: '+1 (555) 672-1133',
    capacityM3: 9,
    currentLoadM3: 9,
    orderId: 'ord-1002',
    status: 'en_route',
    batchTime: '10:20 AM',
    departureTime: '10:35 AM',
    etaToSiteMinutes: 18,
    slumpAtBatchingMm: 150,
    elapsedHydrationMinutes: 75,
    currentSpeedKmH: 38,
    gpsLocation: {
      lat: 28.4890,
      lng: 77.4120,
      address: 'Expressway Toll Gate 4 (Approaching Site)'
    }
  },
  {
    id: 'tm-112',
    truckNumber: 'TM-112 (Schwing 8m³)',
    driverName: 'Farhan Sheikh',
    driverPhone: '+1 (555) 773-4488',
    capacityM3: 8,
    currentLoadM3: 8,
    orderId: 'ord-1003',
    status: 'loading',
    batchTime: '11:35 AM',
    departureTime: undefined,
    etaToSiteMinutes: 35,
    slumpAtBatchingMm: 180,
    elapsedHydrationMinutes: 10,
    currentSpeedKmH: 0,
    gpsLocation: {
      lat: 28.5900,
      lng: 77.3100,
      address: 'Central Batching Hub, Silo 3'
    }
  },
  {
    id: 'tm-115',
    truckNumber: 'TM-115 (Volvo FMX 8m³)',
    driverName: 'Sanjay Rawat',
    driverPhone: '+1 (555) 902-3344',
    capacityM3: 8,
    currentLoadM3: 0,
    status: 'returning',
    elapsedHydrationMinutes: 0,
    currentSpeedKmH: 50,
    gpsLocation: {
      lat: 28.5100,
      lng: 77.3400,
      address: 'Sector 50 Ring Road heading to Plant'
    }
  },
  {
    id: 'tm-118',
    truckNumber: 'TM-118 (Tata Prima 7m³)',
    driverName: 'Gurmukh Singh',
    driverPhone: '+1 (555) 124-7766',
    capacityM3: 7,
    currentLoadM3: 0,
    status: 'at_plant',
    elapsedHydrationMinutes: 0,
    currentSpeedKmH: 0,
    gpsLocation: {
      lat: 28.5900,
      lng: 77.3100,
      address: 'Central Batching Hub Yard (Ready)'
    }
  }
];

export const INITIAL_ORDERS: RMCOrder[] = [
  {
    id: 'ord-1001',
    orderNumber: 'RMC-2026-0842',
    customerName: 'Apex Infra & Skyline Towers',
    contactPerson: 'Er. Sandeep Mittal (Project Director)',
    phone: '+1 (555) 782-9011',
    projectName: 'Grand Horizon Luxury Residency - Phase 2',
    siteAddress: 'Plot 12-A, Golf Course Extension Road, Sector 65',
    pourLocationInStructure: 'Tower A - 14th Floor Post-Tensioned PT Slab & Drop Panels',
    status: 'pouring',
    orderDate: '2026-09-22',
    scheduledPourDate: '2026-09-24',
    scheduledPourTime: '09:30 AM',
    batchPlantId: 'plant-metro-1',
    batchPlantName: 'Metropolis Central Batching Hub',
    items: [
      {
        mixGrade: 'M35',
        quantityM3: 85,
        slumpTargetMm: 160,
        aggregateSizeMm: 20,
        admixtures: ['MasterSet Retarder-300', 'Polycarboxylate Superplasticizer'],
        unitRatePerM3: 4850,
        totalMixPrice: 412250
      }
    ],
    totalVolumeM3: 85,
    deliveredVolumeM3: 52,
    pourType: 'Boom Pump (42m)',
    pumpCharges: 22800,
    freightSurcharge: 10200,
    admixtureCharges: 39950,
    subtotal: 485200,
    tax: 87336,
    totalAmount: 572536,
    paymentTerms: '30 Days Net',
    creditApproved: true,
    assignedMixerIds: ['tm-101', 'tm-104'],
    salesRepId: 'rep-habib',
    salesRepName: 'Habib U. (Senior RMC Sales Lead)',
    notes: 'Continuous pour without cold joint. Maintain minimum 150mm slump at boom pump hopper. 3 sample cubes taken per 30m³.',
    cubeStrengthTargetMPa: 35,
    tested7DayMPa: 26.4
  },
  {
    id: 'ord-1002',
    orderNumber: 'RMC-2026-0843',
    customerName: 'Metro Rail Corporation EPC',
    contactPerson: 'Chief Engineer K. Raghavan',
    phone: '+1 (555) 441-2900',
    projectName: 'Metro Viaduct Elevated Corridor Pier 142-146',
    siteAddress: 'NH-48 Bypass km 24, Construction Yard South',
    pourLocationInStructure: 'Pier Cap & Heavy Friction Piles M50 Grade',
    status: 'in_transit',
    orderDate: '2026-09-23',
    scheduledPourDate: '2026-09-24',
    scheduledPourTime: '11:00 AM',
    batchPlantId: 'plant-south-3',
    batchPlantName: 'Harbor & Airport Extension Plant',
    items: [
      {
        mixGrade: 'M50',
        quantityM3: 65,
        slumpTargetMm: 175,
        aggregateSizeMm: 20,
        admixtures: ['Micro-Silica Durability', 'Polycarboxylate Superplasticizer'],
        unitRatePerM3: 5950,
        totalMixPrice: 386750
      }
    ],
    totalVolumeM3: 65,
    deliveredVolumeM3: 18,
    pourType: 'Static Line Pump',
    pumpCharges: 12300,
    freightSurcharge: 8500,
    admixtureCharges: 50050,
    subtotal: 457600,
    tax: 82368,
    totalAmount: 539968,
    paymentTerms: 'LC',
    creditApproved: true,
    assignedMixerIds: ['tm-109'],
    salesRepId: 'rep-habib',
    salesRepName: 'Habib U. (Senior RMC Sales Lead)',
    notes: 'Government infrastructure audit. Cube sampling mandatory for every transit mixer. Target 28-day 50 MPa.',
    cubeStrengthTargetMPa: 50
  },
  {
    id: 'ord-1003',
    orderNumber: 'RMC-2026-0844',
    customerName: 'Silverline Commercial Parks',
    contactPerson: 'Aman Deep (Site PM)',
    phone: '+1 (555) 881-3004',
    projectName: 'Cyber City Tower C Basement Podium',
    siteAddress: 'Tech Boulevard Plot 45, Sector 132',
    pourLocationInStructure: 'Lower Basement Raft Foundation & Water Tank Wall',
    status: 'batching',
    orderDate: '2026-09-23',
    scheduledPourDate: '2026-09-24',
    scheduledPourTime: '01:00 PM',
    batchPlantId: 'plant-metro-1',
    batchPlantName: 'Metropolis Central Batching Hub',
    items: [
      {
        mixGrade: 'Waterproof M35',
        quantityM3: 110,
        slumpTargetMm: 160,
        aggregateSizeMm: 20,
        admixtures: ['Crystalline Integral Waterproofing', 'MasterSet Retarder-300'],
        unitRatePerM3: 5350,
        totalMixPrice: 588500
      }
    ],
    totalVolumeM3: 110,
    deliveredVolumeM3: 0,
    pourType: 'Boom Pump (36m)',
    pumpCharges: 22000,
    freightSurcharge: 13200,
    admixtureCharges: 58300,
    subtotal: 682000,
    tax: 122760,
    totalAmount: 804760,
    paymentTerms: 'Advance',
    creditApproved: true,
    assignedMixerIds: ['tm-112'],
    salesRepId: 'rep-habib',
    salesRepName: 'Habib U. (Senior RMC Sales Lead)',
    notes: 'Integral waterproofing warranty certificate required along with batch tickets. Truck turnaround under 30 mins requested.',
    cubeStrengthTargetMPa: 35
  },
  {
    id: 'ord-1004',
    orderNumber: 'RMC-2026-0845',
    customerName: 'Vanguard Logistics & Warehousing',
    contactPerson: 'David Miller',
    phone: '+1 (555) 234-9090',
    projectName: 'Mega Distribution Hub - Bay 4',
    siteAddress: 'Express Logistics Corridor, Ring Road Gate 3',
    pourLocationInStructure: 'Heavy-Duty Laser Screed Industrial Floor Slab',
    status: 'confirmed',
    orderDate: '2026-09-24',
    scheduledPourDate: '2026-09-25',
    scheduledPourTime: '06:00 AM',
    batchPlantId: 'plant-west-2',
    batchPlantName: 'Westside High-Capacity Batch Plant',
    items: [
      {
        mixGrade: 'Fiber-Reinforced M30',
        quantityM3: 140,
        slumpTargetMm: 140,
        aggregateSizeMm: 20,
        admixtures: ['Polycarboxylate Superplasticizer'],
        unitRatePerM3: 5100,
        totalMixPrice: 714000
      }
    ],
    totalVolumeM3: 140,
    deliveredVolumeM3: 0,
    pourType: 'Direct Chute',
    pumpCharges: 0,
    freightSurcharge: 16800,
    admixtureCharges: 40600,
    subtotal: 771400,
    tax: 138852,
    totalAmount: 910252,
    paymentTerms: '30 Days Net',
    creditApproved: true,
    assignedMixerIds: [],
    salesRepId: 'rep-habib',
    salesRepName: 'Habib U. (Senior RMC Sales Lead)',
    notes: 'Early morning pour for temperature control. Steel fiber pre-mixed in batch plant pan mixer. No water addition on site.',
    cubeStrengthTargetMPa: 30
  },
  {
    id: 'ord-1005',
    orderNumber: 'RMC-2026-0839',
    customerName: 'Greenfield Villas & Estates',
    contactPerson: 'Siddharth Rao',
    phone: '+1 (555) 993-2114',
    projectName: 'Royal Palms Residential Villa 28 & 29',
    siteAddress: 'Green Valley Enclave, Lane 4',
    pourLocationInStructure: 'First Floor Roof Slab & Portico Columns',
    status: 'completed',
    orderDate: '2026-09-21',
    scheduledPourDate: '2026-09-23',
    scheduledPourTime: '08:00 AM',
    batchPlantId: 'plant-metro-1',
    batchPlantName: 'Metropolis Central Batching Hub',
    items: [
      {
        mixGrade: 'M25',
        quantityM3: 42,
        slumpTargetMm: 140,
        aggregateSizeMm: 20,
        admixtures: ['Polycarboxylate Superplasticizer'],
        unitRatePerM3: 4100,
        totalMixPrice: 172200
      }
    ],
    totalVolumeM3: 42,
    deliveredVolumeM3: 42,
    pourType: 'Boom Pump (36m)',
    pumpCharges: 11800,
    freightSurcharge: 4200,
    admixtureCharges: 12180,
    subtotal: 200380,
    tax: 36068,
    totalAmount: 236448,
    paymentTerms: 'Advance',
    creditApproved: true,
    assignedMixerIds: [],
    salesRepId: 'rep-habib',
    salesRepName: 'Habib U. (Senior RMC Sales Lead)',
    notes: 'Pour completed smoothly in 2 hours 15 mins. Client signed delivery dockets. 7-day cube tested at 19.8 MPa.',
    cubeStrengthTargetMPa: 25,
    tested7DayMPa: 19.8,
    tested28DayMPa: 27.2
  }
];

export const INITIAL_MEASUREMENT_SESSION: SiteMeasurementSession = {
  id: 'meas-session-01',
  projectName: 'Skyline Pinnacle Commercial Center',
  contractor: 'BuildWell Constructions Ltd.',
  siteLocation: 'Plot 88, Financial District, Sector 48',
  salesRepName: 'Habib U.',
  date: '2026-09-24',
  structures: [
    {
      id: 'str-1',
      name: 'Main Podium Slab B2',
      type: 'slab',
      lengthM: 32.0,
      widthM: 18.5,
      depthM: 0.22,
      quantity: 1,
      rebarDeductionPercent: 2.0,
      calculatedNetVolumeM3: 127.7,
      color: '#3b82f6'
    },
    {
      id: 'str-2',
      name: 'Heavy Columns Grid C1-C8',
      type: 'rectangular_column',
      lengthM: 0.75,
      widthM: 0.60,
      depthM: 3.8,
      quantity: 16,
      rebarDeductionPercent: 3.5,
      calculatedNetVolumeM3: 26.4,
      color: '#10b981'
    },
    {
      id: 'str-3',
      name: 'Circular Aesthetic Columns (Atrium)',
      type: 'circular_column',
      lengthM: 4.2, // height
      widthM: 0.8, // diameter
      depthM: 4.2, // height
      diameterM: 0.8,
      quantity: 6,
      rebarDeductionPercent: 3.0,
      calculatedNetVolumeM3: 12.3,
      color: '#8b5cf6'
    },
    {
      id: 'str-4',
      name: 'Peripheral Perimeter Beams',
      type: 'beam',
      lengthM: 101.0,
      widthM: 0.40,
      depthM: 0.65,
      quantity: 1,
      rebarDeductionPercent: 2.5,
      calculatedNetVolumeM3: 25.6,
      color: '#f59e0b'
    }
  ],
  stockpiles: [
    {
      id: 'stk-1',
      materialName: '20mm Aggregate',
      shape: 'trapezoidal_pile',
      baseLengthM: 16.0,
      baseWidthM: 9.0,
      heightM: 3.2,
      bulkDensityTonsPerM3: 1.60,
      calculatedVolumeM3: 254.2,
      calculatedWeightTons: 406.7,
      reorderThresholdTons: 150,
      lastMeasuredDate: '2026-09-24'
    },
    {
      id: 'stk-2',
      materialName: 'Manufactured Sand (M-Sand)',
      shape: 'cone',
      baseLengthM: 12.0,
      baseWidthM: 12.0,
      heightM: 3.8,
      bulkDensityTonsPerM3: 1.52,
      calculatedVolumeM3: 143.3,
      calculatedWeightTons: 217.8,
      reorderThresholdTons: 100,
      lastMeasuredDate: '2026-09-24'
    },
    {
      id: 'stk-3',
      materialName: '10mm Aggregate',
      shape: 'trapezoidal_pile',
      baseLengthM: 11.0,
      baseWidthM: 7.5,
      heightM: 2.8,
      bulkDensityTonsPerM3: 1.58,
      calculatedVolumeM3: 132.5,
      calculatedWeightTons: 209.3,
      reorderThresholdTons: 80,
      lastMeasuredDate: '2026-09-24'
    }
  ],
  safetyWastagePercent: 5.0,
  recommendedMixGrade: 'M35',
  recommendedPourType: 'Boom Pump (42m)',
  totalNetM3: 192.0,
  totalGrossM3: 201.6,
  transitTruckCapacityM3: 8,
  requiredTruckLoads: 26,
  notes: 'Slab reinforcement is dense. High slump SCC or M35 with superplasticizer recommended. 42m boom required to clear facade scaffolding.'
};

export const INITIAL_SITE_VISITS: SiteVisitRecord[] = [
  {
    id: 'vis-1',
    date: '2026-09-24',
    time: '09:15 AM',
    clientName: 'Apex Infra & Skyline Towers',
    projectName: 'Grand Horizon Residency',
    location: 'Sector 65 Extension',
    purpose: 'Pour Inspection',
    outcome: 'Quality Clearance Signed',
    nextActionDate: '2026-09-27',
    notes: 'Inspected 14th floor slab pour. Slump verified at 160mm at boom hopper. Cube samples labeled for 7/28 day curing tank.',
    slumpCheckedMm: 160,
    salesRepName: 'Habib U.'
  },
  {
    id: 'vis-2',
    date: '2026-09-24',
    time: '11:45 AM',
    clientName: 'BuildWell Constructions Ltd.',
    projectName: 'Skyline Pinnacle Commercial',
    location: 'Sector 48 Financial District',
    purpose: 'Site Measurement',
    outcome: 'Quote Requested',
    nextActionDate: '2026-09-25',
    notes: 'Measured Podium slab B2, columns and perimeter beams. Total net 192 m3 (+5% wastage). Contractor requested M35 pumpable quote.',
    salesRepName: 'Habib U.'
  },
  {
    id: 'vis-3',
    date: '2026-09-23',
    time: '03:30 PM',
    clientName: 'Vanguard Logistics',
    projectName: 'Mega Distribution Hub',
    location: 'Ring Road Gate 3',
    purpose: 'Rate Negotiation',
    outcome: 'Order Booked',
    nextActionDate: '2026-09-25',
    notes: 'Agreed on $5,100/m³ for 140 m³ M30 Fiber-Reinforced concrete. Scheduled for early morning casting.',
    salesRepName: 'Habib U.'
  }
];
