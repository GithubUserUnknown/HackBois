import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Car, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Zap,
  Camera,
  Wifi,
  Users
} from 'lucide-react';
import { Intersection, Alert, EmergencyVehicle } from '../lib/mock-data';

interface DashboardOverviewProps {
  intersections: Intersection[];
  alerts: Alert[];
  emergencyVehicles: EmergencyVehicle[];
}

export function DashboardOverview({ intersections, alerts, emergencyVehicles }: DashboardOverviewProps) {
  // Calculate aggregate metrics
  const totalVehicles = intersections.reduce((sum, int) => sum + int.vehicleCount, 0);
  const avgWaitTime = intersections.reduce((sum, int) => sum + int.avgWaitTime, 0) / intersections.length;
  const avgThroughput = intersections.reduce((sum, int) => sum + int.throughput, 0) / intersections.length;
  const avgCongestion = intersections.reduce((sum, int) => sum + int.congestionScore, 0) / intersections.length;
  
  const optimalCount = intersections.filter(i => i.status === 'optimal').length;
  const congestedCount = intersections.filter(i => i.status === 'congested').length;
  const criticalCount = intersections.filter(i => i.status === 'critical').length;
  const emergencyCount = intersections.filter(i => i.status === 'emergency').length;
  
  const activeAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
  
  const activeCameras = intersections.reduce((sum, int) => 
    sum + int.cameras.filter(cam => cam.status === 'active').length, 0
  );
  const totalCameras = intersections.reduce((sum, int) => sum + int.cameras.length, 0);
  
  const overrideCount = intersections.filter(i => i.signalOverride).length;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Vehicles</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVehicles}</div>
            <p className="text-xs text-muted-foreground">
              Across all intersections
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgWaitTime)}s</div>
            <p className="text-xs text-muted-foreground">
              {avgWaitTime < 30 ? '↓ 12% from yesterday' : '↑ 8% from yesterday'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgThroughput)}</div>
            <p className="text-xs text-muted-foreground">
              vehicles/hour per intersection
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emergency Vehicles</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{emergencyVehicles.length}</div>
            <p className="text-xs text-muted-foreground">
              Currently active
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Intersection Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Optimal</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{optimalCount}</span>
                <Badge variant="secondary">{Math.round((optimalCount / intersections.length) * 100)}%</Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span>Congested</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{congestedCount}</span>
                <Badge variant="secondary">{Math.round((congestedCount / intersections.length) * 100)}%</Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Critical</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{criticalCount}</span>
                <Badge variant="secondary">{Math.round((criticalCount / intersections.length) * 100)}%</Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span>Emergency</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{emergencyCount}</span>
                <Badge variant="secondary">{Math.round((emergencyCount / intersections.length) * 100)}%</Badge>
              </div>
            </div>
            
            <div className="pt-2">
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Traffic Health</span>
                <span>{Math.round(100 - (avgCongestion * 10))}%</span>
              </div>
              <Progress value={100 - (avgCongestion * 10)} className="h-2" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                <span>Camera Network</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{activeCameras}/{totalCameras}</span>
                <Badge variant={activeCameras === totalCameras ? "default" : "destructive"}>
                  {Math.round((activeCameras / totalCameras) * 100)}%
                </Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4" />
                <span>Sensor Network</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">98%</span>
                <Badge variant="default">Online</Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Signal Overrides</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{overrideCount}</span>
                <Badge variant={overrideCount > 0 ? "secondary" : "outline"}>Active</Badge>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>Active Users</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">7</span>
                <Badge variant="default">Online</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Recent Alerts
            {criticalAlerts.length > 0 && (
              <Badge variant="destructive">
                {criticalAlerts.length} Critical
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeAlerts.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No active alerts</p>
          ) : (
            <div className="space-y-3">
              {activeAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-3 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      <Badge variant={
                        alert.severity === 'critical' ? 'destructive' : 
                        alert.severity === 'high' ? 'secondary' : 'outline'
                      }>
                        {alert.severity}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {alert.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}