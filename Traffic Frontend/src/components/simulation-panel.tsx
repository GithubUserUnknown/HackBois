import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import {
  Play,
  Pause,
  Square,
  Settings,
  TrendingUp,
  TrendingDown,
  Clock,
  Car,
  RotateCcw,
  Save,
  ArrowLeftRight,
  Plus,
  Minus,
  Brain,
  Zap,
  Target,
  Activity
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { SimulationEngine, Vehicle, TrafficLight } from '../lib/simulation-engine';
import { TrafficSimulationCanvas } from './traffic-simulation-canvas';
import { RLTrainingPanel } from './rl-training-panel';
import { SUMOSimulationPanel } from './sumo-simulation-panel';

interface SimulationState {
  isRunning: boolean;
  currentTime: number;
  duration: number;
  progress: number;
}

interface SimulationConfig {
  policy: string;
  trafficVolume: number;
  emergencyFrequency: number;
  weatherConditions: string;
  timeOfDay: string;
  enableAdaptive: boolean;
  enablePriority: boolean;
  enableRL: boolean;
  vehicleSpawnRate: number;
  maxVehicles: number;
}

interface VehicleConfig {
  type: 'car' | 'truck' | 'bus' | 'motorcycle' | 'emergency';
  count: number;
  weight: number;
  priority: number;
}

export function SimulationPanel() {
  const simulationEngineRef = useRef<SimulationEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    currentTime: 0,
    duration: 3600, // 1 hour in seconds
    progress: 0
  });

  const [config, setConfig] = useState<SimulationConfig>({
    policy: 'current',
    trafficVolume: 75,
    emergencyFrequency: 10,
    weatherConditions: 'clear',
    timeOfDay: 'peak',
    enableAdaptive: true,
    enablePriority: true,
    enableRL: false,
    vehicleSpawnRate: 5, // vehicles per minute
    maxVehicles: 100
  });

  const [vehicleConfigs, setVehicleConfigs] = useState<VehicleConfig[]>([
    { type: 'car', count: 60, weight: 1.0, priority: 1 },
    { type: 'truck', count: 15, weight: 2.5, priority: 2 },
    { type: 'bus', count: 10, weight: 3.0, priority: 3 },
    { type: 'motorcycle', count: 10, weight: 0.5, priority: 1 },
    { type: 'emergency', count: 5, weight: 2.0, priority: 10 }
  ]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trafficLights, setTrafficLights] = useState<TrafficLight[]>([]);
  const [simulationMetrics, setSimulationMetrics] = useState<any>(null);
  const [isRLTraining, setIsRLTraining] = useState(false);
  const [showCanvas, setShowCanvas] = useState(true);
  
  const [savedScenarios] = useState([
    { id: '1', name: 'Rush Hour - Current Policy', policy: 'current' },
    { id: '2', name: 'Night Traffic - Optimized', policy: 'optimized' },
    { id: '3', name: 'Emergency Response Test', policy: 'emergency' },
    { id: '4', name: 'Weather Impact Analysis', policy: 'adaptive' }
  ]);

  // Initialize simulation engine
  useEffect(() => {
    simulationEngineRef.current = new SimulationEngine();
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Animation loop
  useEffect(() => {
    if (simulation.isRunning && simulationEngineRef.current) {
      const animate = (currentTime: number) => {
        const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
        lastTimeRef.current = currentTime;

        if (deltaTime > 0 && deltaTime < 0.1) { // Prevent large time jumps
          simulationEngineRef.current!.updateSimulation(deltaTime);

          // Update state
          setVehicles(simulationEngineRef.current!.getVehicles());
          setTrafficLights(simulationEngineRef.current!.getTrafficLights());
          setSimulationMetrics(simulationEngineRef.current!.getMetrics());

          // Update simulation progress
          const newTime = simulationEngineRef.current!.getSimulationTime();
          setSimulation(prev => ({
            ...prev,
            currentTime: newTime,
            progress: (newTime / prev.duration) * 100
          }));
        }

        if (simulation.isRunning) {
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };

      lastTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simulation.isRunning, simulation.duration]);

  // Spawn vehicles periodically
  useEffect(() => {
    if (!simulation.isRunning || !simulationEngineRef.current) return;

    const spawnInterval = setInterval(() => {
      const engine = simulationEngineRef.current!;
      const currentVehicleCount = engine.getVehicles().length;

      if (currentVehicleCount < config.maxVehicles) {
        const vehiclesToSpawn = Math.min(
          Math.floor(config.vehicleSpawnRate / 60), // Convert per minute to per second
          config.maxVehicles - currentVehicleCount
        );

        for (let i = 0; i < vehiclesToSpawn; i++) {
          // Select vehicle type based on configuration weights
          const totalWeight = vehicleConfigs.reduce((sum, vc) => sum + vc.weight, 0);
          let random = Math.random() * totalWeight;

          let selectedType = 'car';
          for (const vc of vehicleConfigs) {
            random -= vc.weight;
            if (random <= 0) {
              selectedType = vc.type;
              break;
            }
          }

          const vehicleConfig = vehicleConfigs.find(vc => vc.type === selectedType);
          engine.createVehicle({
            type: selectedType as any,
            priority: vehicleConfig?.priority || 1
          });
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(spawnInterval);
  }, [simulation.isRunning, config.vehicleSpawnRate, config.maxVehicles, vehicleConfigs]);
  
  // Mock simulation results
  const simulationResults = [
    { time: 0, currentPolicy: 45, optimizedPolicy: 42, emergencyPolicy: 48 },
    { time: 10, currentPolicy: 47, optimizedPolicy: 41, emergencyPolicy: 46 },
    { time: 20, currentPolicy: 52, optimizedPolicy: 44, emergencyPolicy: 49 },
    { time: 30, currentPolicy: 48, optimizedPolicy: 43, emergencyPolicy: 47 },
    { time: 40, currentPolicy: 51, optimizedPolicy: 45, emergencyPolicy: 50 },
    { time: 50, currentPolicy: 49, optimizedPolicy: 42, emergencyPolicy: 48 },
    { time: 60, currentPolicy: 46, optimizedPolicy: 41, emergencyPolicy: 45 }
  ];
  
  const comparisonData = [
    { metric: 'Avg Wait Time', current: 45, optimized: 38, improvement: -15.6 },
    { metric: 'Throughput', current: 152, optimized: 164, improvement: 7.9 },
    { metric: 'Emergency Delay', current: 12, optimized: 8, improvement: -33.3 },
    { metric: 'Fuel Consumption', current: 100, optimized: 87, improvement: -13.0 },
    { metric: 'CO2 Emissions', current: 100, optimized: 85, improvement: -15.0 }
  ];
  
  const handlePlayPause = () => {
    if (!simulationEngineRef.current) return;

    if (simulation.isRunning) {
      simulationEngineRef.current.pause();
    } else {
      simulationEngineRef.current.start();

      // Add initial vehicles if none exist
      if (simulationEngineRef.current.getVehicles().length === 0) {
        simulationEngineRef.current.addRandomVehicles(20);
      }
    }

    setSimulation(prev => ({
      ...prev,
      isRunning: !prev.isRunning
    }));
  };

  const handleStop = () => {
    if (!simulationEngineRef.current) return;

    simulationEngineRef.current.stop();
    setSimulation(prev => ({
      ...prev,
      isRunning: false,
      progress: 0,
      currentTime: 0
    }));
    setVehicles([]);
    setTrafficLights([]);
  };

  const handleReset = () => {
    if (!simulationEngineRef.current) return;

    simulationEngineRef.current.reset();
    setSimulation(prev => ({
      ...prev,
      isRunning: false,
      progress: 0,
      currentTime: 0
    }));
    setVehicles([]);
    setTrafficLights([]);
  };

  const handleAddVehicles = (count: number) => {
    if (!simulationEngineRef.current) return;
    simulationEngineRef.current.addRandomVehicles(count);
  };

  const handleRemoveVehicle = (vehicleId: string) => {
    if (!simulationEngineRef.current) return;
    simulationEngineRef.current.removeVehicle(vehicleId);
  };

  const updateVehicleConfig = (index: number, updates: Partial<VehicleConfig>) => {
    setVehicleConfigs(prev =>
      prev.map((config, i) => i === index ? { ...config, ...updates } : config)
    );
  };

  const handleRLConfigChange = (rlConfig: any) => {
    // Handle RL configuration changes
    console.log('RL Config updated:', rlConfig);
  };

  const handleStartRLTraining = () => {
    setIsRLTraining(true);
    // Start RL training logic here
  };

  const handleStopRLTraining = () => {
    setIsRLTraining(false);
    // Stop RL training logic here
  };

  return (
    <div className="space-y-6">
      {/* Simulation Type Selector */}
      <Tabs defaultValue="sumo" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sumo">
            <Zap className="w-4 h-4 mr-2" />
            SUMO Simulation (RL-Based)
          </TabsTrigger>
          <TabsTrigger value="canvas">
            <Activity className="w-4 h-4 mr-2" />
            Canvas Simulation (Legacy)
          </TabsTrigger>
        </TabsList>

        {/* SUMO Simulation Tab */}
        <TabsContent value="sumo" className="space-y-4">
          <SUMOSimulationPanel />
        </TabsContent>

        {/* Canvas Simulation Tab */}
        <TabsContent value="canvas" className="space-y-4">
          {/* Live Simulation Canvas */}
          {showCanvas && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Live Traffic Simulation
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant={simulation.isRunning ? "default" : "secondary"}>
                      {simulation.isRunning ? 'Running' : 'Stopped'}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCanvas(!showCanvas)}
                    >
                      Hide Canvas
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TrafficSimulationCanvas
                  vehicles={vehicles}
                  trafficLights={trafficLights}
                  width={800}
                  height={600}
                  showTimings={true}
                  showVehicleInfo={true}
                />

            {/* Real-time metrics */}
            {simulationMetrics && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold">{simulationMetrics.totalVehicles}</div>
                  <div className="text-sm text-muted-foreground">Total Vehicles</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{simulationMetrics.averageWaitTime.toFixed(1)}s</div>
                  <div className="text-sm text-muted-foreground">Avg Wait Time</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{simulationMetrics.averageSpeed.toFixed(1)} km/h</div>
                  <div className="text-sm text-muted-foreground">Avg Speed</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold">{simulationMetrics.congestionLevel.toFixed(1)}</div>
                  <div className="text-sm text-muted-foreground">Congestion Level</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Simulation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Simulation Configuration
            </span>
            {!showCanvas && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCanvas(!showCanvas)}
              >
                Show Canvas
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Traffic Policy</Label>
              <Select value={config.policy} onValueChange={(value) => setConfig(prev => ({ ...prev, policy: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current Policy</SelectItem>
                  <SelectItem value="optimized">AI-Optimized Policy</SelectItem>
                  <SelectItem value="emergency">Emergency Response Policy</SelectItem>
                  <SelectItem value="adaptive">Adaptive Policy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Weather Conditions</Label>
              <Select value={config.weatherConditions} onValueChange={(value) => setConfig(prev => ({ ...prev, weatherConditions: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clear">Clear</SelectItem>
                  <SelectItem value="rain">Rain</SelectItem>
                  <SelectItem value="snow">Snow</SelectItem>
                  <SelectItem value="fog">Fog</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Time of Day</Label>
              <Select value={config.timeOfDay} onValueChange={(value) => setConfig(prev => ({ ...prev, timeOfDay: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peak">Peak Hours</SelectItem>
                  <SelectItem value="off-peak">Off-Peak</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Traffic Volume: {config.trafficVolume}%</Label>
                <Slider
                  value={[config.trafficVolume]}
                  onValueChange={(values) => setConfig(prev => ({ ...prev, trafficVolume: values[0] }))}
                  max={150}
                  min={25}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Vehicle Spawn Rate: {config.vehicleSpawnRate}/min</Label>
                <Slider
                  value={[config.vehicleSpawnRate]}
                  onValueChange={(values) => setConfig(prev => ({ ...prev, vehicleSpawnRate: values[0] }))}
                  max={20}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Max Vehicles: {config.maxVehicles}</Label>
                <Slider
                  value={[config.maxVehicles]}
                  onValueChange={(values) => setConfig(prev => ({ ...prev, maxVehicles: values[0] }))}
                  max={200}
                  min={20}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Emergency Vehicle Frequency: {config.emergencyFrequency}/hour</Label>
                <Slider
                  value={[config.emergencyFrequency]}
                  onValueChange={(values) => setConfig(prev => ({ ...prev, emergencyFrequency: values[0] }))}
                  max={30}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="adaptive">Enable Adaptive Timing</Label>
                <Switch
                  id="adaptive"
                  checked={config.enableAdaptive}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableAdaptive: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="priority">Emergency Priority System</Label>
                <Switch
                  id="priority"
                  checked={config.enablePriority}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enablePriority: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="rl">Enable Reinforcement Learning</Label>
                <Switch
                  id="rl"
                  checked={config.enableRL}
                  onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableRL: checked }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Vehicle Controls</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddVehicles(5)}
                    disabled={!simulationEngineRef.current}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add 5
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddVehicles(10)}
                    disabled={!simulationEngineRef.current}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add 10
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Vehicle Type Configuration */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Vehicle Type Configuration & RL Weights</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {vehicleConfigs.map((vehicleConfig, index) => (
                <Card key={vehicleConfig.type} className="p-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4" />
                      <span className="font-medium capitalize">{vehicleConfig.type}</span>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Count: {vehicleConfig.count}%</Label>
                      <Slider
                        value={[vehicleConfig.count]}
                        onValueChange={(values) => updateVehicleConfig(index, { count: values[0] })}
                        max={100}
                        min={0}
                        step={5}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Weight: {vehicleConfig.weight.toFixed(1)}</Label>
                      <Slider
                        value={[vehicleConfig.weight]}
                        onValueChange={(values) => updateVehicleConfig(index, { weight: values[0] })}
                        max={5.0}
                        min={0.1}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Priority: {vehicleConfig.priority}</Label>
                      <Slider
                        value={[vehicleConfig.priority]}
                        onValueChange={(values) => updateVehicleConfig(index, { priority: values[0] })}
                        max={10}
                        min={1}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Simulation Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Simulation Status</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={simulation.isRunning}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                disabled={!simulation.isRunning && simulation.progress === 0}
              >
                <Square className="w-4 h-4" />
              </Button>
              <Button onClick={handlePlayPause}>
                {simulation.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {simulation.isRunning ? 'Pause' : 'Start'} Simulation
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.round(simulation.currentTime / 60)}m</div>
              <div className="text-sm text-muted-foreground">Elapsed Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.round(simulation.progress)}%</div>
              <div className="text-sm text-muted-foreground">Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{Math.round((simulation.duration - simulation.currentTime) / 60)}m</div>
              <div className="text-sm text-muted-foreground">Remaining</div>
            </div>
          </div>
          
          <Progress value={simulation.progress} className="w-full" />
          
          <div className="flex justify-center">
            <Badge variant={simulation.isRunning ? "default" : "secondary"}>
              {simulation.isRunning ? 'Running' : simulation.progress > 0 ? 'Paused' : 'Ready'}
            </Badge>
          </div>
        </CardContent>
      </Card>
      
      {/* Results and RL Training */}
      <Tabs defaultValue="real-time" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="real-time">Real-time Results</TabsTrigger>
          <TabsTrigger value="comparison">Policy Comparison</TabsTrigger>
          <TabsTrigger value="scenarios">Saved Scenarios</TabsTrigger>
          <TabsTrigger value="rl-training">
            <Brain className="w-4 h-4 mr-2" />
            RL Training
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="real-time" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Average Wait Times Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={simulationResults}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickFormatter={(time) => `${time}m`} />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(time) => `Time: ${time} minutes`}
                    formatter={(value, name) => [Math.round(value as number), 'seconds']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="currentPolicy" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Current Policy"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="optimizedPolicy" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Optimized Policy"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5" />
                Policy Performance Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {comparisonData.map((item) => (
                  <div key={item.metric} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.metric}</div>
                      <div className="text-sm text-muted-foreground">
                        Current: {item.current} → Optimized: {item.optimized}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.improvement > 0 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-green-500" />
                      )}
                      <Badge variant={item.improvement < 0 ? "default" : "secondary"}>
                        {Math.abs(item.improvement).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="current" fill="#94a3b8" name="Current" />
                  <Bar dataKey="optimized" fill="#10b981" name="Optimized" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="scenarios" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Saved Scenarios
                <Button variant="outline" size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save Current
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {savedScenarios.map((scenario) => (
                  <div key={scenario.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{scenario.name}</div>
                      <Badge variant="outline" className="mt-1">
                        {scenario.policy}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Load
                      </Button>
                      <Button variant="outline" size="sm">
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rl-training">
          <RLTrainingPanel
            onConfigChange={handleRLConfigChange}
            onStartTraining={handleStartRLTraining}
            onStopTraining={handleStopRLTraining}
            isTraining={isRLTraining}
            trainingMetrics={[]}
          />
        </TabsContent>
      </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}