import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Search,
  Filter,
  Bell,
  Camera,
  Wifi,
  Car,
  Ambulance
} from 'lucide-react';
import { Alert, getAlertColor, formatTimeAgo } from '../lib/mock-data';

interface AlertsPanelProps {
  alerts: Alert[];
  onAlertAcknowledge: (alertId: string) => void;
}

export function AlertsPanel({ alerts, onAlertAcknowledge }: AlertsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterType, setFilterType] = useState('all');
  
  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = alerts.filter(alert => alert.acknowledged);
  
  const filteredActiveAlerts = activeAlerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    const matchesType = filterType === 'all' || alert.type === filterType;
    
    return matchesSearch && matchesSeverity && matchesType;
  });
  
  const filteredAcknowledgedAlerts = acknowledgedAlerts.filter(alert => {
    const matchesSearch = alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    const matchesType = filterType === 'all' || alert.type === filterType;
    
    return matchesSearch && matchesSeverity && matchesType;
  });
  
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'emergency': return <Ambulance className="w-4 h-4" />;
      case 'congestion': return <Car className="w-4 h-4" />;
      case 'camera-failure': return <Camera className="w-4 h-4" />;
      case 'sensor-failure': return <Wifi className="w-4 h-4" />;
      case 'signal-override': return <AlertTriangle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };
  
  const getAlertTitle = (type: Alert['type']) => {
    switch (type) {
      case 'emergency': return 'Emergency Vehicle';
      case 'congestion': return 'Traffic Congestion';
      case 'camera-failure': return 'Camera Failure';
      case 'sensor-failure': return 'Sensor Failure';
      case 'signal-override': return 'Signal Override';
      default: return 'Alert';
    }
  };
  
  const severityStats = {
    critical: activeAlerts.filter(a => a.severity === 'critical').length,
    high: activeAlerts.filter(a => a.severity === 'high').length,
    medium: activeAlerts.filter(a => a.severity === 'medium').length,
    low: activeAlerts.filter(a => a.severity === 'low').length
  };

  return (
    <div className="space-y-6">
      {/* Alert Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{severityStats.critical}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{severityStats.high}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Medium</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{severityStats.medium}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low</CardTitle>
            <Bell className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{severityStats.low}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search alerts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="congestion">Congestion</SelectItem>
                <SelectItem value="camera-failure">Camera Failure</SelectItem>
                <SelectItem value="sensor-failure">Sensor Failure</SelectItem>
                <SelectItem value="signal-override">Signal Override</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Alerts List */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            Active Alerts
            {activeAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {activeAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="acknowledged" className="gap-2">
            Acknowledged
            <Badge variant="secondary" className="text-xs">
              {acknowledgedAlerts.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {filteredActiveAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Active Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  All systems are running normally.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredActiveAlerts
                .sort((a, b) => {
                  const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                  return severityOrder[b.severity] - severityOrder[a.severity];
                })
                .map((alert) => (
                  <Card key={alert.id} className={`border-l-4 ${
                    alert.severity === 'critical' ? 'border-l-red-500' :
                    alert.severity === 'high' ? 'border-l-orange-500' :
                    alert.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getAlertIcon(alert.type)}
                            <Badge className={getAlertColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="text-sm font-medium">
                              {getAlertTitle(alert.type)}
                            </span>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(alert.timestamp)}
                            </div>
                          </div>
                          <p className="text-sm mb-2">{alert.message}</p>
                          {alert.intersectionId && (
                            <Badge variant="outline" className="text-xs">
                              Intersection: {alert.intersectionId}
                            </Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onAlertAcknowledge(alert.id)}
                          className="ml-4"
                        >
                          Acknowledge
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="acknowledged" className="space-y-4">
          {filteredAcknowledgedAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium mb-2">No Acknowledged Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Acknowledged alerts will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredAcknowledgedAlerts
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .map((alert) => (
                  <Card key={alert.id} className="opacity-75">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getAlertIcon(alert.type)}
                            <Badge className={getAlertColor(alert.severity)}>
                              {alert.severity}
                            </Badge>
                            <span className="text-sm font-medium">
                              {getAlertTitle(alert.type)}
                            </span>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(alert.timestamp)}
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Acknowledged
                            </Badge>
                          </div>
                          <p className="text-sm mb-2">{alert.message}</p>
                          {alert.intersectionId && (
                            <Badge variant="outline" className="text-xs">
                              Intersection: {alert.intersectionId}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}