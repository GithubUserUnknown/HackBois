// Traffic Simulation Engine with Reinforcement Learning

export interface Vehicle {
  id: string;
  type: 'car' | 'truck' | 'bus' | 'motorcycle' | 'emergency';
  size: 'small' | 'medium' | 'large' | 'extra-large';
  position: { x: number; y: number };
  direction: 'north' | 'south' | 'east' | 'west';
  speed: number; // km/h
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  length: number; // meters
  width: number; // meters
  weight: number; // kg
  priority: number; // 1-10, higher = more priority
  waitTime: number; // seconds
  fuelConsumption: number; // L/100km
  emissions: number; // g CO2/km
  destination: string;
  route: string[];
  currentIntersection?: string;
  nextIntersection?: string;
  distanceToIntersection: number;
  isWaiting: boolean;
  color: string;
}

export interface TrafficLight {
  id: string;
  intersectionId: string;
  direction: 'north-south' | 'east-west';
  state: 'red' | 'yellow' | 'green';
  timeRemaining: number;
  cycleTime: number;
  greenTime: number;
  yellowTime: number;
  redTime: number;
  isAdaptive: boolean;
  queueLength: number;
  emergencyOverride: boolean;
}

export interface SimulationMetrics {
  totalVehicles: number;
  averageWaitTime: number;
  averageSpeed: number;
  throughput: number;
  fuelConsumption: number;
  emissions: number;
  congestionLevel: number;
  emergencyResponseTime: number;
  signalEfficiency: number;
}

export interface RLState {
  queueLengths: number[];
  waitTimes: number[];
  vehicleTypes: number[];
  emergencyVehicles: number;
  timeOfDay: number;
  weatherCondition: number;
  currentPhases: number[];
}

export interface RLAction {
  intersectionId: string;
  newPhase: 'north-south' | 'east-west' | 'left-turn' | 'pedestrian';
  duration: number;
}

export interface RLReward {
  waitTimeReduction: number;
  throughputIncrease: number;
  fuelSavings: number;
  emissionReduction: number;
  emergencyResponseBonus: number;
  total: number;
}

export class SimulationEngine {
  private vehicles: Map<string, Vehicle> = new Map();
  private trafficLights: Map<string, TrafficLight> = new Map();
  private intersections: string[] = [];
  private simulationTime: number = 0;
  private isRunning: boolean = false;
  private metrics: SimulationMetrics;
  private rlState: RLState;
  private rlRewards: RLReward[] = [];
  
  constructor() {
    this.metrics = this.initializeMetrics();
    this.rlState = this.initializeRLState();
    this.initializeIntersections();
  }

  private initializeMetrics(): SimulationMetrics {
    return {
      totalVehicles: 0,
      averageWaitTime: 0,
      averageSpeed: 0,
      throughput: 0,
      fuelConsumption: 0,
      emissions: 0,
      congestionLevel: 0,
      emergencyResponseTime: 0,
      signalEfficiency: 0
    };
  }

  private initializeRLState(): RLState {
    return {
      queueLengths: [0, 0, 0, 0],
      waitTimes: [0, 0, 0, 0],
      vehicleTypes: [0, 0, 0, 0, 0],
      emergencyVehicles: 0,
      timeOfDay: 0,
      weatherCondition: 0,
      currentPhases: [0, 0, 0, 0]
    };
  }

  private initializeIntersections(): void {
    this.intersections = ['int-001', 'int-002', 'int-003', 'int-004'];
    
    this.intersections.forEach(id => {
      // Initialize traffic lights for each direction
      this.trafficLights.set(`${id}-ns`, {
        id: `${id}-ns`,
        intersectionId: id,
        direction: 'north-south',
        state: 'red',
        timeRemaining: 30,
        cycleTime: 120,
        greenTime: 45,
        yellowTime: 5,
        redTime: 70,
        isAdaptive: true,
        queueLength: 0,
        emergencyOverride: false
      });

      this.trafficLights.set(`${id}-ew`, {
        id: `${id}-ew`,
        intersectionId: id,
        direction: 'east-west',
        state: 'green',
        timeRemaining: 45,
        cycleTime: 120,
        greenTime: 45,
        yellowTime: 5,
        redTime: 70,
        isAdaptive: true,
        queueLength: 0,
        emergencyOverride: false
      });
    });
  }

  public createVehicle(config: Partial<Vehicle>): Vehicle {
    const vehicleTypes = {
      car: { length: 4.5, width: 1.8, weight: 1500, maxSpeed: 60, fuelConsumption: 8 },
      truck: { length: 12, width: 2.5, weight: 8000, maxSpeed: 45, fuelConsumption: 25 },
      bus: { length: 12, width: 2.5, weight: 12000, maxSpeed: 50, fuelConsumption: 30 },
      motorcycle: { length: 2, width: 0.8, weight: 200, maxSpeed: 80, fuelConsumption: 4 },
      emergency: { length: 6, width: 2, weight: 3000, maxSpeed: 80, fuelConsumption: 15 }
    };

    const type = config.type || 'car';
    const specs = vehicleTypes[type];
    
    const vehicle: Vehicle = {
      id: config.id || `vehicle-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      size: config.size || this.getSizeFromType(type),
      position: config.position || this.getRandomRoadPosition(),
      direction: config.direction || this.getRandomDirection(),
      speed: 0,
      maxSpeed: specs.maxSpeed,
      acceleration: config.acceleration || 2.5,
      deceleration: config.deceleration || 4.5,
      length: specs.length,
      width: specs.width,
      weight: specs.weight,
      priority: config.priority || (type === 'emergency' ? 10 : Math.random() * 3 + 1),
      waitTime: 0,
      fuelConsumption: specs.fuelConsumption,
      emissions: specs.fuelConsumption * 2.3, // Rough CO2 calculation
      destination: config.destination || this.getRandomDestination(),
      route: config.route || [],
      distanceToIntersection: Math.random() * 100 + 50,
      isWaiting: false,
      color: config.color || this.getVehicleColor(type)
    };

    this.vehicles.set(vehicle.id, vehicle);
    return vehicle;
  }

  private getSizeFromType(type: string): 'small' | 'medium' | 'large' | 'extra-large' {
    switch (type) {
      case 'motorcycle': return 'small';
      case 'car': return 'medium';
      case 'emergency': return 'large';
      case 'truck':
      case 'bus': return 'extra-large';
      default: return 'medium';
    }
  }

  private getRandomDirection(): 'north' | 'south' | 'east' | 'west' {
    const directions = ['north', 'south', 'east', 'west'] as const;
    return directions[Math.floor(Math.random() * directions.length)];
  }

  private getRandomDestination(): string {
    return this.intersections[Math.floor(Math.random() * this.intersections.length)];
  }

  private getRandomRoadPosition(): { x: number; y: number } {
    // Define road positions that match the canvas street network
    const horizontalRoads = [
      { y: 160, xRange: [0, 800] as [number, number] }, // Main Street
      { y: 320, xRange: [0, 800] as [number, number] }, // Broadway
      { y: 240, xRange: [0, 800] as [number, number] }, // 42nd Street
      { y: 400, xRange: [0, 800] as [number, number] }, // 59th Street
      { y: 80, xRange: [0, 800] as [number, number] },  // Elm Street
      { y: 480, xRange: [0, 800] as [number, number] }, // Oak Street
    ];

    const verticalRoads = [
      { x: 160, yRange: [0, 600] as [number, number] }, // 5th Avenue
      { x: 480, yRange: [0, 600] as [number, number] }, // Park Avenue
      { x: 320, yRange: [0, 600] as [number, number] }, // 3rd Avenue
      { x: 80, yRange: [0, 600] as [number, number] },  // 1st Avenue
      { x: 240, yRange: [0, 600] as [number, number] }, // 7th Avenue
      { x: 400, yRange: [0, 600] as [number, number] }, // 9th Avenue
    ];

    const useHorizontal = Math.random() < 0.5;

    if (useHorizontal) {
      const road = horizontalRoads[Math.floor(Math.random() * horizontalRoads.length)];
      return {
        x: Math.random() * (road.xRange[1] - road.xRange[0]) + road.xRange[0],
        y: road.y + (Math.random() - 0.5) * 8 // Add some lane variation
      };
    } else {
      const road = verticalRoads[Math.floor(Math.random() * verticalRoads.length)];
      return {
        x: road.x + (Math.random() - 0.5) * 8, // Add some lane variation
        y: Math.random() * (road.yRange[1] - road.yRange[0]) + road.yRange[0]
      };
    }
  }

  private getVehicleColor(type: string): string {
    const colors = {
      car: '#3b82f6',
      truck: '#f59e0b',
      bus: '#10b981',
      motorcycle: '#8b5cf6',
      emergency: '#ef4444'
    };
    return colors[type as keyof typeof colors] || '#6b7280';
  }

  public updateSimulation(deltaTime: number): void {
    if (!this.isRunning) return;

    this.simulationTime += deltaTime;
    
    // Update traffic lights
    this.updateTrafficLights(deltaTime);
    
    // Update vehicles
    this.updateVehicles(deltaTime);
    
    // Update metrics
    this.updateMetrics();
    
    // Update RL state
    this.updateRLState();
    
    // Calculate RL rewards
    this.calculateRLRewards();
  }

  private updateTrafficLights(deltaTime: number): void {
    this.trafficLights.forEach(light => {
      light.timeRemaining -= deltaTime;
      
      if (light.timeRemaining <= 0) {
        this.switchTrafficLight(light);
      }
    });
  }

  private switchTrafficLight(light: TrafficLight): void {
    switch (light.state) {
      case 'green':
        light.state = 'yellow';
        light.timeRemaining = light.yellowTime;
        break;
      case 'yellow':
        light.state = 'red';
        light.timeRemaining = light.redTime;
        break;
      case 'red':
        light.state = 'green';
        light.timeRemaining = light.greenTime;
        break;
    }
  }

  private updateVehicles(deltaTime: number): void {
    this.vehicles.forEach(vehicle => {
      this.updateVehiclePosition(vehicle, deltaTime);
      this.updateVehicleSpeed(vehicle, deltaTime);
      this.checkIntersectionApproach(vehicle);
    });
  }

  private updateVehiclePosition(vehicle: Vehicle, deltaTime: number): void {
    const speedMs = (vehicle.speed * 1000) / 3600; // Convert km/h to m/s
    const distance = speedMs * deltaTime;
    
    switch (vehicle.direction) {
      case 'north':
        vehicle.position.y -= distance;
        break;
      case 'south':
        vehicle.position.y += distance;
        break;
      case 'east':
        vehicle.position.x += distance;
        break;
      case 'west':
        vehicle.position.x -= distance;
        break;
    }
  }

  private updateVehicleSpeed(vehicle: Vehicle, deltaTime: number): void {
    const targetSpeed = this.calculateTargetSpeed(vehicle);
    
    if (vehicle.speed < targetSpeed) {
      vehicle.speed = Math.min(vehicle.speed + vehicle.acceleration * deltaTime, targetSpeed);
    } else if (vehicle.speed > targetSpeed) {
      vehicle.speed = Math.max(vehicle.speed - vehicle.deceleration * deltaTime, targetSpeed);
    }
  }

  private calculateTargetSpeed(vehicle: Vehicle): number {
    // Check for traffic light ahead
    const lightAhead = this.getTrafficLightAhead(vehicle);
    if (lightAhead && lightAhead.state === 'red' && vehicle.distanceToIntersection < 50) {
      return 0;
    }
    
    // Check for vehicles ahead
    const vehicleAhead = this.getVehicleAhead(vehicle);
    if (vehicleAhead && this.getDistanceBetweenVehicles(vehicle, vehicleAhead) < 20) {
      return Math.min(vehicleAhead.speed, vehicle.maxSpeed * 0.8);
    }
    
    return vehicle.maxSpeed;
  }

  private getTrafficLightAhead(vehicle: Vehicle): TrafficLight | null {
    // Simplified logic - in real implementation, would use road network
    const intersection = this.findNearestIntersection(vehicle);
    if (!intersection) return null;
    
    const lightId = vehicle.direction === 'north' || vehicle.direction === 'south' 
      ? `${intersection}-ns` 
      : `${intersection}-ew`;
    
    return this.trafficLights.get(lightId) || null;
  }

  private getVehicleAhead(vehicle: Vehicle): Vehicle | null {
    // Simplified logic - find vehicle in same lane ahead
    for (const [, otherVehicle] of this.vehicles) {
      if (otherVehicle.id === vehicle.id) continue;
      if (otherVehicle.direction !== vehicle.direction) continue;
      
      const isAhead = this.isVehicleAhead(vehicle, otherVehicle);
      if (isAhead) return otherVehicle;
    }
    return null;
  }

  private isVehicleAhead(vehicle: Vehicle, other: Vehicle): boolean {
    switch (vehicle.direction) {
      case 'north': return other.position.y < vehicle.position.y;
      case 'south': return other.position.y > vehicle.position.y;
      case 'east': return other.position.x > vehicle.position.x;
      case 'west': return other.position.x < vehicle.position.x;
      default: return false;
    }
  }

  private getDistanceBetweenVehicles(vehicle1: Vehicle, vehicle2: Vehicle): number {
    const dx = vehicle1.position.x - vehicle2.position.x;
    const dy = vehicle1.position.y - vehicle2.position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private checkIntersectionApproach(vehicle: Vehicle): void {
    const intersection = this.findNearestIntersection(vehicle);
    if (intersection) {
      vehicle.currentIntersection = intersection;
      vehicle.distanceToIntersection = this.calculateDistanceToIntersection(vehicle, intersection);
    }
  }

  private findNearestIntersection(vehicle: Vehicle): string | null {
    // Simplified logic - in real implementation, would use road network
    return this.intersections[0]; // For demo purposes
  }

  private calculateDistanceToIntersection(vehicle: Vehicle, intersection: string): number {
    // Simplified calculation
    return Math.random() * 100 + 10;
  }

  private updateMetrics(): void {
    const vehicles = Array.from(this.vehicles.values());
    
    this.metrics.totalVehicles = vehicles.length;
    this.metrics.averageWaitTime = vehicles.reduce((sum, v) => sum + v.waitTime, 0) / vehicles.length || 0;
    this.metrics.averageSpeed = vehicles.reduce((sum, v) => sum + v.speed, 0) / vehicles.length || 0;
    this.metrics.fuelConsumption = vehicles.reduce((sum, v) => sum + v.fuelConsumption, 0);
    this.metrics.emissions = vehicles.reduce((sum, v) => sum + v.emissions, 0);
    this.metrics.emergencyResponseTime = this.calculateEmergencyResponseTime();
    this.metrics.congestionLevel = this.calculateCongestionLevel();
  }

  private calculateEmergencyResponseTime(): number {
    const emergencyVehicles = Array.from(this.vehicles.values()).filter(v => v.type === 'emergency');
    return emergencyVehicles.reduce((sum, v) => sum + v.waitTime, 0) / emergencyVehicles.length || 0;
  }

  private calculateCongestionLevel(): number {
    const waitingVehicles = Array.from(this.vehicles.values()).filter(v => v.isWaiting);
    return (waitingVehicles.length / this.vehicles.size) * 10;
  }

  private updateRLState(): void {
    const vehicles = Array.from(this.vehicles.values());
    
    // Update queue lengths per direction
    this.rlState.queueLengths = [
      vehicles.filter(v => v.direction === 'north' && v.isWaiting).length,
      vehicles.filter(v => v.direction === 'south' && v.isWaiting).length,
      vehicles.filter(v => v.direction === 'east' && v.isWaiting).length,
      vehicles.filter(v => v.direction === 'west' && v.isWaiting).length
    ];
    
    // Update wait times
    this.rlState.waitTimes = this.rlState.queueLengths.map((_, i) => {
      const direction = ['north', 'south', 'east', 'west'][i];
      const directionVehicles = vehicles.filter(v => v.direction === direction);
      return directionVehicles.reduce((sum, v) => sum + v.waitTime, 0) / directionVehicles.length || 0;
    });
    
    // Update vehicle type distribution
    this.rlState.vehicleTypes = [
      vehicles.filter(v => v.type === 'car').length,
      vehicles.filter(v => v.type === 'truck').length,
      vehicles.filter(v => v.type === 'bus').length,
      vehicles.filter(v => v.type === 'motorcycle').length,
      vehicles.filter(v => v.type === 'emergency').length
    ];
    
    this.rlState.emergencyVehicles = vehicles.filter(v => v.type === 'emergency').length;
  }

  private calculateRLRewards(): void {
    const reward: RLReward = {
      waitTimeReduction: -this.metrics.averageWaitTime * 0.1,
      throughputIncrease: this.metrics.throughput * 0.05,
      fuelSavings: -this.metrics.fuelConsumption * 0.01,
      emissionReduction: -this.metrics.emissions * 0.01,
      emergencyResponseBonus: this.rlState.emergencyVehicles > 0 ? -this.metrics.emergencyResponseTime * 0.5 : 0,
      total: 0
    };
    
    reward.total = reward.waitTimeReduction + reward.throughputIncrease + 
                   reward.fuelSavings + reward.emissionReduction + reward.emergencyResponseBonus;
    
    this.rlRewards.push(reward);
    
    // Keep only last 100 rewards for memory efficiency
    if (this.rlRewards.length > 100) {
      this.rlRewards.shift();
    }
  }

  // Public API methods
  public start(): void {
    this.isRunning = true;
  }

  public pause(): void {
    this.isRunning = false;
  }

  public stop(): void {
    this.isRunning = false;
    this.simulationTime = 0;
    this.vehicles.clear();
    this.metrics = this.initializeMetrics();
  }

  public reset(): void {
    this.stop();
    this.initializeIntersections();
  }

  public getVehicles(): Vehicle[] {
    return Array.from(this.vehicles.values());
  }

  public getTrafficLights(): TrafficLight[] {
    return Array.from(this.trafficLights.values());
  }

  public getMetrics(): SimulationMetrics {
    return { ...this.metrics };
  }

  public getRLState(): RLState {
    return { ...this.rlState };
  }

  public getRLRewards(): RLReward[] {
    return [...this.rlRewards];
  }

  public applyRLAction(action: RLAction): void {
    const lightId = action.newPhase === 'north-south' ? `${action.intersectionId}-ns` : `${action.intersectionId}-ew`;
    const light = this.trafficLights.get(lightId);
    
    if (light) {
      light.state = 'green';
      light.timeRemaining = action.duration;
      
      // Set opposite direction to red
      const oppositeId = action.newPhase === 'north-south' ? `${action.intersectionId}-ew` : `${action.intersectionId}-ns`;
      const oppositeLight = this.trafficLights.get(oppositeId);
      if (oppositeLight) {
        oppositeLight.state = 'red';
        oppositeLight.timeRemaining = action.duration;
      }
    }
  }

  public addRandomVehicles(count: number): void {
    for (let i = 0; i < count; i++) {
      const types = ['car', 'truck', 'bus', 'motorcycle', 'emergency'] as const;
      const type = types[Math.floor(Math.random() * types.length)];
      
      this.createVehicle({
        type,
        priority: type === 'emergency' ? 10 : Math.random() * 3 + 1
      });
    }
  }

  public removeVehicle(vehicleId: string): void {
    this.vehicles.delete(vehicleId);
  }

  public getSimulationTime(): number {
    return this.simulationTime;
  }

  public isSimulationRunning(): boolean {
    return this.isRunning;
  }
}
