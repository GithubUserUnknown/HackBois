import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import {
  Play,
  Pause,
  Square,
  Settings,
  Clock,
  Car,
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { SUMOVisualization } from './sumo-visualization';
import { SUMOStyleVisualization } from './sumo-style-visualization';
import { SUMOGUIEmbed } from './sumo-gui-embed';
import { SUMOAlertsPanel } from './sumo-alerts-panel';
import { useSumoSimulation } from '../hooks/useSumoSimulation';

const API_BASE_URL = 'http://localhost:8000';

export function SUMOSimulationPanel() {
  const {
    isConnected,
    isRunning,
    isPaused,
    state,
    networkInfo,
    error,
    startSimulation,
    pauseSimulation,
    resumeSimulation,
    stopSimulation,
    stepSimulation,
    setSimulationSpeed
  } = useSumoSimulation();

  const [config, setConfig] = useState({
    gui_mode: false,
    step_length: 1.0,
    traffic_volume: 75,
    enable_rl: false,
    rl_algorithm: 'ppo',
    rl_model: null,
    emergency_frequency: 10,
    max_steps: 3600,
    simulation_speed: 1.0  // 1x speed = normal speed
  });

  const [autoStep, setAutoStep] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<'sumo-style' | 'simple' | 'gui'>('sumo-style');
  const [simulationSpeed, setSimulationSpeedState] = useState(10.0);
  const [rlAlgorithms, setRlAlgorithms] = useState<any[]>([]);
  const [rlModels, setRlModels] = useState<any[]>([]);

  // Fetch available RL models on mount
  useEffect(() => {
    const fetchRlModels = async () => {
      try {
        console.log('Fetching RL models from:', `${API_BASE_URL}/rl/models`);
        const response = await fetch(`${API_BASE_URL}/rl/models`);
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('RL models data:', data);
        setRlAlgorithms(data.algorithms || []);
        setRlModels(data.trained_models || []);
        console.log('Set algorithms:', data.algorithms);
      } catch (error) {
        console.error('Failed to fetch RL models:', error);
      }
    };
    fetchRlModels();
  }, []);

  // Auto-enable GUI mode when selecting GUI visualization
  const handleVisualizationModeChange = (mode: 'sumo-style' | 'simple' | 'gui') => {
    setVisualizationMode(mode);
    if (mode === 'gui' && !config.gui_mode && !isRunning) {
      setConfig({ ...config, gui_mode: true });
    }
  };

  // Auto-step simulation
  useEffect(() => {
    if (autoStep && isRunning && !isPaused) {
      const interval = setInterval(() => {
        stepSimulation();
      }, config.step_length * 1000);
      
      return () => clearInterval(interval);
    }
  }, [autoStep, isRunning, isPaused, config.step_length, stepSimulation]);

  const handleStart = async () => {
    const success = await startSimulation(config);
    if (success) {
      setAutoStep(true);
    }
  };

  const handlePause = async () => {
    await pauseSimulation();
    setAutoStep(false);
  };

  const handleResume = async () => {
    await resumeSimulation();
    setAutoStep(true);
  };

  const handleStop = async () => {
    await stopSimulation();
    setAutoStep(false);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Alert variant={isConnected ? "default" : "destructive"}>
        <AlertDescription className="flex items-center gap-2">
          {isConnected ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Connected to SUMO Simulation Server
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" />
              Not connected to SUMO server. Make sure the backend is running on port 8000.
            </>
          )}
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* SUMO Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              SUMO Traffic Simulation
            </span>
            <div className="flex items-center gap-2">
              <Select value={visualizationMode} onValueChange={(value: any) => handleVisualizationModeChange(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sumo-style">🎨 SUMO-Style Canvas</SelectItem>
                  <SelectItem value="simple">⚡ Simple Canvas</SelectItem>
                  <SelectItem value="gui">🖥️ SUMO GUI Window</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant={isRunning ? (isPaused ? "secondary" : "default") : "outline"}>
                {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {visualizationMode === 'gui' ? (
            <SUMOGUIEmbed isRunning={isRunning} guiMode={config.gui_mode} />
          ) : networkInfo && state ? (
            visualizationMode === 'sumo-style' ? (
              <SUMOStyleVisualization
                vehicles={state.vehicles}
                trafficLights={state.traffic_lights}
                junctions={networkInfo.junctions}
                edges={networkInfo.edges}
                width={1000}
                height={700}
              />
            ) : (
              <SUMOVisualization
                vehicles={state.vehicles}
                trafficLights={state.traffic_lights}
                junctions={networkInfo.junctions}
                edges={networkInfo.edges}
                width={800}
                height={600}
              />
            )
          ) : (
            <div className="flex items-center justify-center h-[600px] bg-gray-900 rounded-lg">
              <div className="text-center text-gray-400">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Start simulation to view SUMO traffic network</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Simulation Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button onClick={handleStart} disabled={!isConnected}>
                <Play className="w-4 h-4 mr-2" />
                Start Simulation
              </Button>
            ) : (
              <>
                {isPaused ? (
                  <Button onClick={handleResume}>
                    <Play className="w-4 h-4 mr-2" />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={handlePause}>
                    <Pause className="w-4 h-4 mr-2" />
                    Pause
                  </Button>
                )}
                <Button onClick={handleStop} variant="destructive">
                  <Square className="w-4 h-4 mr-2" />
                  Stop
                </Button>
                <Button onClick={stepSimulation} variant="outline" disabled={!isPaused}>
                  Step
                </Button>
              </>
            )}
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                GUI Mode
                {visualizationMode === 'gui' && !config.gui_mode && (
                  <Badge variant="outline" className="text-xs">Required for GUI Window mode</Badge>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.gui_mode}
                  onCheckedChange={(checked) => setConfig({ ...config, gui_mode: checked })}
                  disabled={isRunning}
                />
                <span className="text-sm text-gray-600">
                  {config.gui_mode ? 'SUMO GUI (External Window)' : 'Headless (Browser Only)'}
                </span>
              </div>
              {config.gui_mode && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ A SUMO GUI window will open on your desktop when you start the simulation
                </p>
              )}
            </div>

            <div className="space-y-3 p-3 border rounded-lg bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 font-semibold">
                  🤖 AI Traffic Control
                </Label>
                <Switch
                  checked={config.enable_rl}
                  onCheckedChange={(checked) => setConfig({ ...config, enable_rl: checked })}
                  disabled={isRunning}
                />
              </div>

              {config.enable_rl && (
                <div className="space-y-3 pl-2 border-l-2 border-purple-300">
                  <div className="space-y-2">
                    <Label className="text-sm">Control Algorithm</Label>
                    <Select
                      value={config.rl_algorithm}
                      onValueChange={(value) => setConfig({ ...config, rl_algorithm: value })}
                      disabled={isRunning}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Select algorithm" />
                      </SelectTrigger>
                      <SelectContent>
                        {rlAlgorithms.map((algo) => (
                          <SelectItem key={algo.id} value={algo.id}>
                            <div className="flex flex-col">
                              <span className="font-medium">{algo.name}</span>
                              <span className="text-xs text-gray-500">{algo.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(config.rl_algorithm === 'ppo' || config.rl_algorithm === 'dqn' || config.rl_algorithm === 'a3c') && rlModels.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Trained Model (Optional)</Label>
                      <Select
                        value={config.rl_model || 'none'}
                        onValueChange={(value) => setConfig({ ...config, rl_model: value === 'none' ? null : value })}
                        disabled={isRunning}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Use untrained model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-gray-500">No model (random actions)</span>
                          </SelectItem>
                          {rlModels
                            .filter((model) => model.algorithm === config.rl_algorithm)
                            .map((model) => (
                              <SelectItem key={model.name} value={model.path}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{model.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {model.timestamp}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="text-xs text-gray-600 bg-white p-2 rounded">
                    <strong>ℹ️ Info:</strong>{' '}
                    {config.rl_algorithm === 'ppo' && 'PPO uses neural networks to learn optimal traffic light timing'}
                    {config.rl_algorithm === 'dqn' && 'DQN learns Q-values to make traffic control decisions'}
                    {config.rl_algorithm === 'a3c' && 'A3C uses asynchronous actor-critic learning for traffic optimization'}
                    {config.rl_algorithm === 'fixed' && 'Fixed-time control switches phases every 30 seconds'}
                    {config.rl_algorithm === 'actuated' && 'Actuated control responds to real-time traffic conditions'}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Traffic Volume: {config.traffic_volume}%</Label>
              <Slider
                value={[config.traffic_volume]}
                onValueChange={([value]) => setConfig({ ...config, traffic_volume: value })}
                min={0}
                max={100}
                step={5}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label>Emergency Frequency: {config.emergency_frequency}%</Label>
              <Slider
                value={[config.emergency_frequency]}
                onValueChange={([value]) => setConfig({ ...config, emergency_frequency: value })}
                min={0}
                max={50}
                step={5}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label>Step Length: {config.step_length}s</Label>
              <Slider
                value={[config.step_length]}
                onValueChange={([value]) => setConfig({ ...config, step_length: value })}
                min={0.1}
                max={2.0}
                step={0.1}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Steps: {config.max_steps}</Label>
              <Slider
                value={[config.max_steps]}
                onValueChange={([value]) => setConfig({ ...config, max_steps: value })}
                min={1000}
                max={10000}
                step={500}
                disabled={isRunning}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Simulation Speed: {simulationSpeed.toFixed(1)}x
              </Label>
              <Slider
                value={[simulationSpeed]}
                onValueChange={([value]) => {
                  setSimulationSpeedState(value);
                  if (isRunning) {
                    setSimulationSpeed(value);
                  } else {
                    setConfig({ ...config, simulation_speed: value });
                  }
                }}
                min={0.1}
                max={50}
                step={0.5}
              />
              <p className="text-xs text-muted-foreground">
                {simulationSpeed < 1 ? 'Slow motion' : simulationSpeed === 1 ? 'Real-time' : `${simulationSpeed.toFixed(1)}x faster than real-time`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Panel */}
      {state?.alerts && state.alerts.length > 0 && (
        <SUMOAlertsPanel alerts={state.alerts} />
      )}

      {/* Metrics */}
      {state && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Real-time Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4" />
                  Simulation Time
                </div>
                <div className="text-2xl font-bold">
                  {Math.floor(state.metrics.current_time / 60)}:{String(Math.floor(state.metrics.current_time % 60)).padStart(2, '0')}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Car className="w-4 h-4" />
                  Active Vehicles
                </div>
                <div className="text-2xl font-bold">{state.metrics.vehicle_count}</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Zap className="w-4 h-4" />
                  Avg Speed
                </div>
                <div className="text-2xl font-bold">{state.metrics.avg_speed.toFixed(1)} m/s</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-gray-600">Arrived Vehicles</div>
                <div className="text-2xl font-bold text-green-600">{state.metrics.arrived_vehicles}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-gray-600">Departed Vehicles</div>
                <div className="text-2xl font-bold text-blue-600">{state.metrics.departed_vehicles}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-gray-600">Total Waiting Time</div>
                <div className="text-2xl font-bold text-orange-600">{state.metrics.waiting_time.toFixed(0)}s</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{state.step} / {config.max_steps} steps</span>
              </div>
              <Progress value={(state.step / config.max_steps) * 100} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

