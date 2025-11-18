// Mock data for traffic dashboard

export interface Intersection {
  id: string;
  name: string;
  coordinates: [number, number];
  status: 'optimal' | 'congested' | 'critical' | 'emergency';
  vehicleCount: number;
  queueLength: number;
  avgWaitTime: number;
  throughput: number;
  congestionScore: number;
  currentPhase: 'north-south' | 'east-west' | 'left-turn' | 'pedestrian';
  phaseTimeRemaining: number;
  emergencyVehicles: number;
  signalOverride: boolean;
  sensorStatus: 'active' | 'degraded' | 'offline';
  cameras: Array<{
    id: string;
    status: 'active' | 'offline';
    view: string;
  }>;
}

export interface EmergencyVehicle {
  id: string;
  type: 'ambulance' | 'fire' | 'police';
  priority: 'high' | 'medium' | 'low';
  estimatedArrival: number; // seconds
  intersectionId: string;
  direction: 'north' | 'south' | 'east' | 'west';
}

export interface Alert {
  id: string;
  type: 'congestion' | 'emergency' | 'sensor-failure' | 'camera-failure' | 'signal-override';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  intersectionId?: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface PerformanceMetric {
  timestamp: Date;
  intersectionId: string;
  avgWaitTime: number;
  throughput: number;
  congestionScore: number;
  emergencyDelay: number;
}

// Generate mock intersections
export const mockIntersections: Intersection[] = [
  {
    id: 'int-001',
    name: 'Phool Chowk',
    coordinates: [-74.006, 40.7128],
    status: 'congested',
    vehicleCount: 47,
    queueLength: 12,
    avgWaitTime: 45,
    throughput: 142,
    congestionScore: 7.2,
    currentPhase: 'north-south',
    phaseTimeRemaining: 23,
    emergencyVehicles: 1,
    signalOverride: false,
    sensorStatus: 'active',
    cameras: [
      { id: 'cam-001-a', status: 'active', view: 'North approach' },
      { id: 'cam-001-b', status: 'active', view: 'South approach' }
    ]
  },
  {
    id: 'int-002',
    name: 'Tatibandh',
    coordinates: [-73.9857, 40.7505],
    status: 'critical',
    vehicleCount: 78,
    queueLength: 28,
    avgWaitTime: 89,
    throughput: 98,
    congestionScore: 9.1,
    currentPhase: 'east-west',
    phaseTimeRemaining: 18,
    emergencyVehicles: 2,
    signalOverride: true,
    sensorStatus: 'active',
    cameras: [
      { id: 'cam-002-a', status: 'active', view: 'East approach' },
      { id: 'cam-002-b', status: 'offline', view: 'West approach' }
    ]
  },
  {
    id: 'int-003',
    name: 'Amapara Chowk',
    coordinates: [-73.9733, 40.7614],
    status: 'optimal',
    vehicleCount: 23,
    queueLength: 4,
    avgWaitTime: 18,
    throughput: 187,
    congestionScore: 2.8,
    currentPhase: 'left-turn',
    phaseTimeRemaining: 12,
    emergencyVehicles: 0,
    signalOverride: false,
    sensorStatus: 'active',
    cameras: [
      { id: 'cam-003-a', status: 'active', view: 'North approach' },
      { id: 'cam-003-b', status: 'active', view: 'South approach' }
    ]
  },
  {
    id: 'int-004',
    name: 'Jaistambh Chowk',
    coordinates: [-74.0021, 40.7259],
    status: 'emergency',
    vehicleCount: 52,
    queueLength: 15,
    avgWaitTime: 67,
    throughput: 125,
    congestionScore: 8.5,
    currentPhase: 'pedestrian',
    phaseTimeRemaining: 8,
    emergencyVehicles: 3,
    signalOverride: true,
    sensorStatus: 'degraded',
    cameras: [
      { id: 'cam-004-a', status: 'active', view: 'East approach' },
      { id: 'cam-004-b', status: 'active', view: 'West approach' }
    ]
  },
  {
    id: 'int-005',
    name: 'Sharda Chowk',
    coordinates: [-73.9553, 40.7794],
    status: 'optimal',
    vehicleCount: 31,
    queueLength: 7,
    avgWaitTime: 24,
    throughput: 165,
    congestionScore: 3.5,
    currentPhase: 'north-south',
    phaseTimeRemaining: 31,
    emergencyVehicles: 0,
    signalOverride: false,
    sensorStatus: 'active',
    cameras: [
      { id: 'cam-005-a', status: 'active', view: 'North approach' },
      { id: 'cam-005-b', status: 'active', view: 'South approach' }
    ]
  }
];

export const mockEmergencyVehicles: EmergencyVehicle[] = [
  {
    id: 'emg-001',
    type: 'ambulance',
    priority: 'high',
    estimatedArrival: 45,
    intersectionId: 'int-001',
    direction: 'north'
  },
  {
    id: 'emg-002',
    type: 'fire',
    priority: 'high',
    estimatedArrival: 32,
    intersectionId: 'int-002',
    direction: 'east'
  },
  {
    id: 'emg-003',
    type: 'police',
    priority: 'medium',
    estimatedArrival: 78,
    intersectionId: 'int-004',
    direction: 'west'
  }
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    type: 'emergency',
    severity: 'critical',
    message: 'Multiple emergency vehicles approaching Jaistambh Chowk',
    intersectionId: 'int-004',
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
    acknowledged: false
  },
  {
    id: 'alert-002',
    type: 'congestion',
    severity: 'high',
    message: 'Severe congestion detected at Sharda Chowk & Fafadih Chowk',
    intersectionId: 'int-002',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    acknowledged: false
  },
  {
    id: 'alert-003',
    type: 'camera-failure',
    severity: 'medium',
    message: 'Camera offline at Sharda Chowk & Fafadih Chowk',
    intersectionId: 'int-002',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    acknowledged: true
  },
  {
    id: 'alert-004',
    type: 'sensor-failure',
    severity: 'medium',
    message: 'Sensor degraded performance at Jaistambh Chowk',
    intersectionId: 'int-004',
    timestamp: new Date(Date.now() - 18 * 60 * 1000),
    acknowledged: false
  }
];

// Generate historical performance data
export const generateMockPerformanceData = (days: number = 7): PerformanceMetric[] => {
  const data: PerformanceMetric[] = [];
  const now = new Date();
  
  for (let d = 0; d < days; d++) {
    for (let h = 0; h < 24; h++) {
      for (const intersection of mockIntersections) {
        const timestamp = new Date(now.getTime() - (d * 24 + h) * 60 * 60 * 1000);
        
        // Simulate peak hours and realistic patterns
        const isPeakHour = (h >= 7 && h <= 9) || (h >= 17 && h <= 19);
        const baseWaitTime = isPeakHour ? 45 : 25;
        const baseThroughput = isPeakHour ? 120 : 180;
        const baseCongestion = isPeakHour ? 6.5 : 3.2;
        
        data.push({
          timestamp,
          intersectionId: intersection.id,
          avgWaitTime: baseWaitTime + Math.random() * 20 - 10,
          throughput: baseThroughput + Math.random() * 40 - 20,
          congestionScore: Math.max(1, baseCongestion + Math.random() * 3 - 1.5),
          emergencyDelay: Math.random() * 15
        });
      }
    }
  }
  
  return data.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

export const mockPerformanceData = generateMockPerformanceData();

// Utility functions
export const getStatusColor = (status: Intersection['status']) => {
  switch (status) {
    case 'optimal': return 'text-green-600 bg-green-50';
    case 'congested': return 'text-yellow-600 bg-yellow-50';
    case 'critical': return 'text-red-600 bg-red-50';
    case 'emergency': return 'text-purple-600 bg-purple-50';
    default: return 'text-gray-600 bg-gray-50';
  }
};

export const getAlertColor = (severity: Alert['severity']) => {
  switch (severity) {
    case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
};

export const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
};