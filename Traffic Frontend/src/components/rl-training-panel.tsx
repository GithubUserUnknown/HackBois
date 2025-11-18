import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Progress } from './ui/progress';
import { 
  Brain, 
  Play, 
  Pause, 
  Square, 
  Settings, 
  TrendingUp,
  Award,
  Target,
  Zap,
  BarChart3,
  Save,
  Download,
  Upload
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
  Bar,
  Area,
  AreaChart
} from 'recharts';

interface RLConfig {
  algorithm: 'DQN' | 'PPO' | 'A3C' | 'SAC';
  learningRate: number;
  batchSize: number;
  memorySize: number;
  explorationRate: number;
  explorationDecay: number;
  targetUpdateFreq: number;
  rewardWeights: {
    waitTime: number;
    throughput: number;
    fuelEfficiency: number;
    emissions: number;
    emergencyResponse: number;
    safety: number;
  };
  stateFeatures: {
    queueLengths: boolean;
    waitTimes: boolean;
    vehicleTypes: boolean;
    emergencyVehicles: boolean;
    timeOfDay: boolean;
    weatherConditions: boolean;
    historicalData: boolean;
  };
  actionSpace: {
    phaseSelection: boolean;
    phaseDuration: boolean;
    emergencyOverride: boolean;
    adaptiveTiming: boolean;
  };
}

interface TrainingMetrics {
  episode: number;
  totalReward: number;
  averageReward: number;
  explorationRate: number;
  loss: number;
  qValue: number;
  convergence: number;
}

interface RLTrainingPanelProps {
  onConfigChange: (config: RLConfig) => void;
  onStartTraining: () => void;
  onStopTraining: () => void;
  isTraining: boolean;
  trainingMetrics: TrainingMetrics[];
}

export function RLTrainingPanel({
  onConfigChange,
  onStartTraining,
  onStopTraining,
  isTraining,
  trainingMetrics
}: RLTrainingPanelProps) {
  const [config, setConfig] = useState<RLConfig>({
    algorithm: 'DQN',
    learningRate: 0.001,
    batchSize: 32,
    memorySize: 10000,
    explorationRate: 1.0,
    explorationDecay: 0.995,
    targetUpdateFreq: 100,
    rewardWeights: {
      waitTime: 0.3,
      throughput: 0.25,
      fuelEfficiency: 0.15,
      emissions: 0.1,
      emergencyResponse: 0.15,
      safety: 0.05
    },
    stateFeatures: {
      queueLengths: true,
      waitTimes: true,
      vehicleTypes: true,
      emergencyVehicles: true,
      timeOfDay: true,
      weatherConditions: false,
      historicalData: false
    },
    actionSpace: {
      phaseSelection: true,
      phaseDuration: true,
      emergencyOverride: true,
      adaptiveTiming: false
    }
  });

  const [trainingProgress, setTrainingProgress] = useState({
    currentEpisode: 0,
    totalEpisodes: 1000,
    progress: 0
  });

  const updateConfig = (updates: Partial<RLConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onConfigChange(newConfig);
  };

  const updateRewardWeight = (key: keyof RLConfig['rewardWeights'], value: number) => {
    const newWeights = { ...config.rewardWeights, [key]: value };
    updateConfig({ rewardWeights: newWeights });
  };

  const updateStateFeature = (key: keyof RLConfig['stateFeatures'], value: boolean) => {
    const newFeatures = { ...config.stateFeatures, [key]: value };
    updateConfig({ stateFeatures: newFeatures });
  };

  const updateActionSpace = (key: keyof RLConfig['actionSpace'], value: boolean) => {
    const newActionSpace = { ...config.actionSpace, [key]: value };
    updateConfig({ actionSpace: newActionSpace });
  };

  // Mock training data for demonstration
  const mockTrainingData = trainingMetrics.length > 0 ? trainingMetrics : [
    { episode: 0, totalReward: -150, averageReward: -150, explorationRate: 1.0, loss: 0.5, qValue: -2.3, convergence: 0 },
    { episode: 100, totalReward: -120, averageReward: -135, explorationRate: 0.9, loss: 0.4, qValue: -1.8, convergence: 15 },
    { episode: 200, totalReward: -80, averageReward: -117, explorationRate: 0.8, loss: 0.3, qValue: -1.2, convergence: 35 },
    { episode: 300, totalReward: -50, averageReward: -100, explorationRate: 0.7, loss: 0.25, qValue: -0.8, convergence: 55 },
    { episode: 400, totalReward: -20, averageReward: -84, explorationRate: 0.6, loss: 0.2, qValue: -0.4, convergence: 70 },
    { episode: 500, totalReward: 10, averageReward: -68, explorationRate: 0.5, loss: 0.15, qValue: 0.1, convergence: 80 },
    { episode: 600, totalReward: 35, averageReward: -52, explorationRate: 0.4, loss: 0.12, qValue: 0.5, convergence: 88 },
    { episode: 700, totalReward: 55, averageReward: -36, explorationRate: 0.3, loss: 0.1, qValue: 0.8, convergence: 92 },
    { episode: 800, totalReward: 70, averageReward: -20, explorationRate: 0.2, loss: 0.08, qValue: 1.1, convergence: 95 },
    { episode: 900, totalReward: 85, averageReward: -5, explorationRate: 0.1, loss: 0.06, qValue: 1.4, convergence: 97 },
    { episode: 1000, totalReward: 95, averageReward: 10, explorationRate: 0.05, loss: 0.05, qValue: 1.6, convergence: 98 }
  ];

  return (
    <div className="space-y-6">
      {/* RL Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Reinforcement Learning Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="algorithm" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="algorithm">Algorithm</TabsTrigger>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
            </TabsList>

            <TabsContent value="algorithm" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Algorithm</Label>
                  <Select value={config.algorithm} onValueChange={(value: any) => updateConfig({ algorithm: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DQN">Deep Q-Network (DQN)</SelectItem>
                      <SelectItem value="PPO">Proximal Policy Optimization (PPO)</SelectItem>
                      <SelectItem value="A3C">Asynchronous Actor-Critic (A3C)</SelectItem>
                      <SelectItem value="SAC">Soft Actor-Critic (SAC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Learning Rate: {config.learningRate}</Label>
                  <Slider
                    value={[config.learningRate]}
                    onValueChange={(values) => updateConfig({ learningRate: values[0] })}
                    max={0.01}
                    min={0.0001}
                    step={0.0001}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={config.batchSize}
                    onChange={(e) => updateConfig({ batchSize: parseInt(e.target.value) })}
                    min={16}
                    max={128}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Memory Size</Label>
                  <Input
                    type="number"
                    value={config.memorySize}
                    onChange={(e) => updateConfig({ memorySize: parseInt(e.target.value) })}
                    min={1000}
                    max={100000}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Exploration Rate: {config.explorationRate.toFixed(3)}</Label>
                  <Slider
                    value={[config.explorationRate]}
                    onValueChange={(values) => updateConfig({ explorationRate: values[0] })}
                    max={1.0}
                    min={0.01}
                    step={0.01}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Exploration Decay: {config.explorationDecay.toFixed(3)}</Label>
                  <Slider
                    value={[config.explorationDecay]}
                    onValueChange={(values) => updateConfig({ explorationDecay: values[0] })}
                    max={0.999}
                    min={0.990}
                    step={0.001}
                    className="w-full"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rewards" className="space-y-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Configure reward weights for different optimization objectives:
                </div>
                
                {Object.entries(config.rewardWeights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <Label className="capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}: {value.toFixed(2)}
                    </Label>
                    <Slider
                      value={[value]}
                      onValueChange={(values) => updateRewardWeight(key as keyof RLConfig['rewardWeights'], values[0])}
                      max={1.0}
                      min={0.0}
                      step={0.05}
                      className="w-full"
                    />
                  </div>
                ))}

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="text-sm font-medium">Total Weight: {Object.values(config.rewardWeights).reduce((sum, w) => sum + w, 0).toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">Weights should ideally sum to 1.0</div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Select state features to include in the RL model:
                </div>
                
                {Object.entries(config.stateFeatures).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) => updateStateFeature(key as keyof RLConfig['stateFeatures'], checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="actions" className="space-y-4">
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Configure available actions for the RL agent:
                </div>
                
                {Object.entries(config.actionSpace).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <Switch
                      checked={value}
                      onCheckedChange={(checked) => updateActionSpace(key as keyof RLConfig['actionSpace'], checked)}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Training Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Training Control
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Save className="w-4 h-4 mr-2" />
                Save Model
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                onClick={isTraining ? onStopTraining : onStartTraining}
                variant={isTraining ? "destructive" : "default"}
              >
                {isTraining ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {isTraining ? 'Stop Training' : 'Start Training'}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{trainingProgress.currentEpisode}</div>
              <div className="text-sm text-muted-foreground">Current Episode</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{trainingProgress.totalEpisodes}</div>
              <div className="text-sm text-muted-foreground">Total Episodes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{trainingProgress.progress}%</div>
              <div className="text-sm text-muted-foreground">Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {mockTrainingData[mockTrainingData.length - 1]?.convergence || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Convergence</div>
            </div>
          </div>
          
          <Progress value={trainingProgress.progress} className="w-full" />
          
          <div className="flex justify-center">
            <Badge variant={isTraining ? "default" : "secondary"}>
              {isTraining ? 'Training Active' : 'Training Stopped'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Training Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Training Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="rewards" className="space-y-4">
            <TabsList>
              <TabsTrigger value="rewards">Rewards</TabsTrigger>
              <TabsTrigger value="learning">Learning Curve</TabsTrigger>
              <TabsTrigger value="exploration">Exploration</TabsTrigger>
            </TabsList>

            <TabsContent value="rewards">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mockTrainingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="episode" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="totalReward" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.3}
                    name="Total Reward"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="averageReward" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                    name="Average Reward"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="learning">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockTrainingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="episode" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="loss" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    name="Loss"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="qValue" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    name="Q-Value"
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="exploration">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockTrainingData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="episode" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="explorationRate" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                    name="Exploration Rate"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="convergence" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    name="Convergence %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
