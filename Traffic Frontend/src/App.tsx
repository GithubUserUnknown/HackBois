import { useState, useEffect } from 'react';
import { DashboardSidebar } from './components/dashboard-sidebar';
import { DashboardOverview } from './components/dashboard-overview';
import { TrafficMap } from './components/traffic-map';
import { AnalyticsDashboard } from './components/analytics-dashboard';
import { AlertsPanel } from './components/alerts-panel';
import { SimulationPanel } from './components/simulation-panel';
import { TrackVehiclesPanel } from './components/track-vehicles-panel';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Separator } from './components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar';
import { 
  Bell, 
  Settings, 
  Moon, 
  Sun, 
  User,
  LogOut,
  Shield
} from 'lucide-react';
import { 
  mockIntersections, 
  mockAlerts, 
  mockEmergencyVehicles, 
  mockPerformanceData,
  Intersection,
  Alert
} from './lib/mock-data';

export default function App() {
  const [activeView, setActiveView] = useState('overview');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [selectedIntersection, setSelectedIntersection] = useState<Intersection | null>(null);
  
  // Real-time updates simulation
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate real-time updates to intersection data
      // In a real application, this would come from WebSocket connections or API polling
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleAlertAcknowledge = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  };
  
  const handleIntersectionSelect = (intersection: Intersection) => {
    setSelectedIntersection(intersection);
  };
  
  const activeAlerts = alerts.filter(alert => !alert.acknowledged);
  
  const renderMainContent = () => {
    switch (activeView) {
      case 'overview':
        return (
          <DashboardOverview 
            intersections={mockIntersections}
            alerts={alerts}
            emergencyVehicles={mockEmergencyVehicles}
          />
        );
      case 'map':
        return (
          <TrafficMap 
            intersections={mockIntersections}
            emergencyVehicles={mockEmergencyVehicles}
            onIntersectionSelect={handleIntersectionSelect}
          />
        );
      case 'analytics':
        return (
          <AnalyticsDashboard 
            performanceData={mockPerformanceData}
          />
        );
      case 'signals':
        return (
          <Card>
            <CardHeader>
              <CardTitle>Signal Control Center</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Signal Control Interface</h3>
              <p className="text-muted-foreground mb-4">
                Advanced signal control interface with real-time override capabilities and AI recommendations.
              </p>
              <Button>Access Control Panel</Button>
            </CardContent>
          </Card>
        );
      case 'alerts':
        return (
          <AlertsPanel 
            alerts={alerts}
            onAlertAcknowledge={handleAlertAcknowledge}
          />
        );
      case 'simulation':
        return <SimulationPanel />;
      case 'users':
        return (
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">User Access Control</h3>
              <p className="text-muted-foreground mb-4">
                Manage user roles, permissions, and access levels for traffic control operations.
              </p>
              <Button>Manage Users</Button>
            </CardContent>
          </Card>
        );
      case 'settings':
        return (
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-8 text-center">
              <Settings className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">System Configuration</h3>
              <p className="text-muted-foreground mb-4">
                Configure system parameters, AI models, and integration settings.
              </p>
              <Button>Open Settings</Button>
            </CardContent>
          </Card>
        );
      case 'track-vehicles':
        return <TrackVehiclesPanel />;
      default:
        return <div>View not found</div>;
    }
  };

  return (
    <div className={`min-h-screen bg-background ${isDarkMode ? 'dark' : ''}`}>
      <div className="flex h-screen">
        {/* Sidebar */}
        <DashboardSidebar 
          activeView={activeView}
          onViewChange={setActiveView}
          alertCount={activeAlerts.length}
        />
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="bg-card border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold capitalize">
                  {activeView === 'overview' ? 'Dashboard Overview' :
                   activeView === 'map' ? 'Live Traffic Map' :
                   activeView === 'analytics' ? 'Traffic Analytics' :
                   activeView === 'signals' ? 'Signal Control' :
                   activeView === 'alerts' ? 'Alerts & Notifications' :
                   activeView === 'simulation' ? 'Traffic Simulation' :
                   activeView === 'users' ? 'User Management' :
                   activeView === 'settings' ? 'Settings' :
                   activeView === 'track-vehicles' ? 'Track Vehicles' : activeView}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activeView === 'overview' && 'Real-time traffic monitoring and system status'}
                  {activeView === 'map' && 'Interactive city intersection monitoring'}
                  {activeView === 'analytics' && 'Performance metrics and trend analysis'}
                  {activeView === 'signals' && 'Traffic signal control and overrides'}
                  {activeView === 'alerts' && 'System alerts and incident management'}
                  {activeView === 'simulation' && 'AI policy simulation and testing'}
                  {activeView === 'users' && 'User access and role management'}
                  {activeView === 'settings' && 'System configuration and preferences'}
                  {activeView === 'track-vehicles' && 'Monitor vehicle locations and tracking history'}
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {/* Notifications */}
                <Button variant="ghost" size="sm" className="relative">
                  <Bell className="w-4 h-4" />
                  {activeAlerts.length > 0 && (
                    <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {activeAlerts.length}
                    </Badge>
                  )}
                </Button>
                
                {/* Theme Toggle */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
                
                <Separator orientation="vertical" className="h-6" />
                
                {/* User Menu */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-sm font-medium">Rakesh</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Traffic Engineer
                    </div>
                  </div>
                  <Avatar>
                    <AvatarImage src="/api/placeholder/32/32" alt="User" />
                    <AvatarFallback>RK</AvatarFallback>
                  </Avatar>
                  <Button variant="ghost" size="sm">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </header>
          
          {/* Main Content Area */}
          <main className="flex-1 overflow-auto p-6">
            {renderMainContent()}
          </main>
        </div>
      </div>
    </div>
  );
}