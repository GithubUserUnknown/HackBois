import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Car,
  AlertTriangle,
  Download
} from 'lucide-react';
import { PerformanceMetric, mockIntersections, mockPerformanceData } from '../lib/mock-data';

interface AnalyticsDashboardProps {
  performanceData: PerformanceMetric[];
}

export function AnalyticsDashboard({ performanceData }: AnalyticsDashboardProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedIntersection, setSelectedIntersection] = useState('all');
  
  // Filter data based on selections
  const filteredData = performanceData.filter(d => {
    const now = new Date();
    const hours = selectedTimeRange === '24h' ? 24 : selectedTimeRange === '7d' ? 168 : 720;
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
    
    const timeMatch = d.timestamp >= cutoff;
    const intersectionMatch = selectedIntersection === 'all' || d.intersectionId === selectedIntersection;
    
    return timeMatch && intersectionMatch;
  });
  
  // Aggregate data for charts
  const hourlyData = filteredData.reduce((acc, item) => {
    const hour = item.timestamp.getHours();
    const existing = acc.find(d => d.hour === hour);
    
    if (existing) {
      existing.avgWaitTime = (existing.avgWaitTime + item.avgWaitTime) / 2;
      existing.throughput = (existing.throughput + item.throughput) / 2;
      existing.congestionScore = (existing.congestionScore + item.congestionScore) / 2;
      existing.count++;
    } else {
      acc.push({
        hour,
        avgWaitTime: item.avgWaitTime,
        throughput: item.throughput,
        congestionScore: item.congestionScore,
        emergencyDelay: item.emergencyDelay,
        count: 1
      });
    }
    
    return acc;
  }, [] as any[]).sort((a, b) => a.hour - b.hour);
  
  // Status distribution for pie chart
  const statusData = [
    { name: 'Optimal', value: mockIntersections.filter(i => i.status === 'optimal').length, color: '#10b981' },
    { name: 'Congested', value: mockIntersections.filter(i => i.status === 'congested').length, color: '#f59e0b' },
    { name: 'Critical', value: mockIntersections.filter(i => i.status === 'critical').length, color: '#ef4444' },
    { name: 'Emergency', value: mockIntersections.filter(i => i.status === 'emergency').length, color: '#8b5cf6' }
  ];
  
  // Calculate trends
  const currentAvgWait = hourlyData.slice(-6).reduce((sum, d) => sum + d.avgWaitTime, 0) / 6;
  const previousAvgWait = hourlyData.slice(-12, -6).reduce((sum, d) => sum + d.avgWaitTime, 0) / 6;
  const waitTrend = ((currentAvgWait - previousAvgWait) / previousAvgWait) * 100;
  
  const currentThroughput = hourlyData.slice(-6).reduce((sum, d) => sum + d.throughput, 0) / 6;
  const previousThroughput = hourlyData.slice(-12, -6).reduce((sum, d) => sum + d.throughput, 0) / 6;
  const throughputTrend = ((currentThroughput - previousThroughput) / previousThroughput) * 100;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-4">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedIntersection} onValueChange={setSelectedIntersection}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Intersections</SelectItem>
              {mockIntersections.map(intersection => (
                <SelectItem key={intersection.id} value={intersection.id}>
                  {intersection.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </Button>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(currentAvgWait)}s</div>
            <div className="flex items-center gap-1 text-xs">
              {waitTrend > 0 ? (
                <TrendingUp className="w-3 h-3 text-red-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-green-500" />
              )}
              <span className={waitTrend > 0 ? 'text-red-500' : 'text-green-500'}>
                {Math.abs(waitTrend).toFixed(1)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Throughput</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(currentThroughput)}</div>
            <div className="flex items-center gap-1 text-xs">
              {throughputTrend > 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              <span className={throughputTrend > 0 ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(throughputTrend).toFixed(1)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emergency Delays</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(filteredData.reduce((sum, d) => sum + d.emergencyDelay, 0) / filteredData.length)}s
            </div>
            <div className="text-xs text-muted-foreground">
              Average emergency vehicle delay
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts */}
      <Tabs defaultValue="traffic-flow" className="space-y-4">
        <TabsList>
          <TabsTrigger value="traffic-flow">Traffic Flow</TabsTrigger>
          <TabsTrigger value="wait-times">Wait Times</TabsTrigger>
          <TabsTrigger value="congestion">Congestion</TabsTrigger>
          <TabsTrigger value="status">Status Overview</TabsTrigger>
        </TabsList>
        
        <TabsContent value="traffic-flow" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Throughput by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => `${hour}:00`}
                    formatter={(value, name) => [Math.round(value as number), 'Vehicles/hour']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="throughput" 
                    stroke="#3b82f6" 
                    fill="#3b82f6" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="wait-times" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Average Wait Times by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => `${hour}:00`}
                    formatter={(value, name) => [Math.round(value as number), 'Seconds']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgWaitTime" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="congestion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Congestion Scores by Hour</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                  <YAxis domain={[0, 10]} />
                  <Tooltip 
                    labelFormatter={(hour) => `${hour}:00`}
                    formatter={(value, name) => [Math.round((value as number) * 10) / 10, 'Congestion Score']}
                  />
                  <Bar 
                    dataKey="congestionScore" 
                    fill="#f59e0b"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="status" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Intersection Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Intersections</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockIntersections
                    .sort((a, b) => a.congestionScore - b.congestionScore)
                    .slice(0, 5)
                    .map((intersection, index) => (
                      <div key={intersection.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <div>
                            <div className="font-medium">{intersection.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {intersection.throughput} vehicles/hour
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary">
                          {intersection.congestionScore.toFixed(1)}/10
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}