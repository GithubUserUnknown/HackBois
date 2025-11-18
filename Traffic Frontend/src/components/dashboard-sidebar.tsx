import {
  Map,
  BarChart3,
  Navigation,
  AlertTriangle,
  Settings,
  Play,
  Users,
  Eye,
  Car
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

interface DashboardSidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  alertCount: number;
}

const navigationItems = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'map', label: 'Live Map', icon: Map },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'signals', label: 'Signal Control', icon: Navigation },
  { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: true },
  { id: 'simulation', label: 'Simulation', icon: Play },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'track-vehicles', label: 'Track Vehicles', icon: Car }
];

export function DashboardSidebar({ activeView, onViewChange, alertCount }: DashboardSidebarProps) {
  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Navigation className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">TrafficAI</h1>
            <p className="text-sm text-muted-foreground">Control Center</p>
          </div>
        </div>
      </div>
      
      <Separator />
      
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          
          return (
            <Button
              key={item.id}
              variant={isActive ? 'default' : 'ghost'}
              className="w-full justify-start gap-3"
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
              {item.badge && alertCount > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {alertCount}
                </Badge>
              )}
            </Button>
          );
        })}
      </nav>
      
      <Separator />
      
      <div className="p-4">
        <div className="bg-muted rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium">System Status</span>
          </div>
          <p className="text-xs text-muted-foreground">
            All traffic systems operational
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Uptime:</span>
              <div className="font-mono">99.9%</div>
            </div>
            <div>
              <span className="text-muted-foreground">Response:</span>
              <div className="font-mono">12ms</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}