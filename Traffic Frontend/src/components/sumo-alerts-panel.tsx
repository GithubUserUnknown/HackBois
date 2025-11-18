import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { AlertTriangle, Ambulance, AlertCircle, Info } from 'lucide-react';
import type { Alert } from '../hooks/useSumoSimulation';

interface SUMOAlertsPanelProps {
  alerts: Alert[];
}

export function SUMOAlertsPanel({ alerts }: SUMOAlertsPanelProps) {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'emergency_vehicle':
        return <Ambulance className="w-4 h-4" />;
      case 'congestion':
        return <AlertTriangle className="w-4 h-4" />;
      case 'accident':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getSeverityBgColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 border-red-200';
      case 'high':
        return 'bg-orange-50 border-orange-200';
      case 'medium':
        return 'bg-yellow-50 border-yellow-200';
      case 'low':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Group alerts by type
  const alertsByType = alerts.reduce((acc, alert) => {
    if (!acc[alert.type]) {
      acc[alert.type] = [];
    }
    acc[alert.type].push(alert);
    return acc;
  }, {} as Record<string, Alert[]>);

  const emergencyAlerts = alertsByType['emergency_vehicle'] || [];
  const congestionAlerts = alertsByType['congestion'] || [];
  const otherAlerts = Object.entries(alertsByType)
    .filter(([type]) => type !== 'emergency_vehicle' && type !== 'congestion')
    .flatMap(([, alerts]) => alerts);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Live Alerts
          </span>
          <Badge variant="outline">{alerts.length} active</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No active alerts</p>
            <p className="text-sm">System is running normally</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {/* Emergency Vehicle Alerts */}
              {emergencyAlerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Ambulance className="w-4 h-4 text-red-600" />
                    Emergency Vehicles ({emergencyAlerts.length})
                  </h4>
                  <div className="space-y-2">
                    {emergencyAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${getSeverityBgColor(alert.severity)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            {getAlertIcon(alert.type)}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{alert.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Location: {alert.location}
                              </p>
                              {alert.data && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {alert.data.speed !== undefined && (
                                    <span>Speed: {alert.data.speed} m/s</span>
                                  )}
                                  {alert.data.waiting_time !== undefined && (
                                    <span className="ml-2">Waiting: {alert.data.waiting_time}s</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={getSeverityColor(alert.severity) as any} className="text-xs">
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Congestion Alerts */}
              {congestionAlerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    Traffic Congestion ({congestionAlerts.length})
                  </h4>
                  <div className="space-y-2">
                    {congestionAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${getSeverityBgColor(alert.severity)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            {getAlertIcon(alert.type)}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{alert.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Location: {alert.location}
                              </p>
                              {alert.data && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  <span>Vehicles: {alert.data.vehicle_count}</span>
                                  <span className="ml-2">Avg Speed: {alert.data.avg_speed} m/s</span>
                                  <span className="ml-2">Avg Wait: {alert.data.avg_waiting_time}s</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={getSeverityColor(alert.severity) as any} className="text-xs">
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Alerts */}
              {otherAlerts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Other Alerts ({otherAlerts.length})
                  </h4>
                  <div className="space-y-2">
                    {otherAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border ${getSeverityBgColor(alert.severity)}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1">
                            {getAlertIcon(alert.type)}
                            <div className="flex-1">
                              <p className="text-sm font-medium">{alert.description}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Location: {alert.location}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={getSeverityColor(alert.severity) as any} className="text-xs">
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(alert.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

