import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Info, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface SUMOGUIEmbedProps {
  isRunning: boolean;
  guiMode: boolean;
}

export function SUMOGUIEmbed({ isRunning, guiMode }: SUMOGUIEmbedProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  if (!guiMode) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            SUMO GUI Mode Not Enabled
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="default" className="border-blue-500 bg-blue-50">
            <Info className="w-4 h-4 text-blue-600" />
            <AlertDescription>
              <div className="space-y-3">
                <p className="font-medium text-blue-900">
                  💡 Tip: For browser-based visualization, try "SUMO-Style Canvas" mode instead!
                </p>
                <p className="text-sm text-blue-800">
                  The SUMO-Style Canvas gives you the authentic SUMO look and feel right in your browser - no external window needed!
                </p>
                <div className="mt-4 p-3 bg-white rounded border border-blue-200">
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    If you really want the external SUMO GUI window:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 ml-2 text-sm text-gray-700">
                    <li>Scroll down to the "Simulation Controls" section</li>
                    <li>Find the "GUI Mode" toggle</li>
                    <li>Enable it (switch to "SUMO GUI")</li>
                    <li>Start a new simulation</li>
                  </ol>
                  <p className="mt-3 text-xs text-gray-600">
                    Note: The SUMO GUI window will open separately on your desktop.
                  </p>
                </div>
                <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-xs text-yellow-800">
                    ⚠️ Most users prefer SUMO-Style Canvas - it's easier and looks great!
                  </p>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isRunning) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            SUMO GUI Ready
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="w-4 h-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>GUI mode is enabled. When you start the simulation:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>A SUMO GUI window will open on your desktop</li>
                  <li>You'll see the full 3×3 grid network visualization</li>
                  <li>Vehicles will be rendered with SUMO's native graphics</li>
                  <li>You can zoom, pan, and interact with the simulation</li>
                  <li>Traffic lights will show their actual states</li>
                </ul>
                <p className="mt-3 font-medium">Click "Start Simulation" to launch SUMO GUI</p>
              </div>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card ref={containerRef}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            SUMO GUI Window
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="default">Running</Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 mr-2" />
                  Exit Fullscreen
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 mr-2" />
                  Fullscreen
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <Info className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">SUMO GUI is running in a separate window</p>
              <p className="text-sm">
                Look for the SUMO GUI window on your desktop. It shows the full simulation with:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                <li>High-quality 3D vehicle models</li>
                <li>Detailed road network with lanes</li>
                <li>Traffic light phases and timings</li>
                <li>Vehicle speeds and routes</li>
                <li>Interactive zoom and pan controls</li>
              </ul>
              <div className="mt-3 p-3 bg-muted rounded-md">
                <p className="text-sm font-medium mb-2">SUMO GUI Controls:</p>
                <ul className="text-xs space-y-1">
                  <li><kbd className="px-1 py-0.5 bg-background rounded">Space</kbd> - Play/Pause</li>
                  <li><kbd className="px-1 py-0.5 bg-background rounded">Mouse Wheel</kbd> - Zoom in/out</li>
                  <li><kbd className="px-1 py-0.5 bg-background rounded">Right Click + Drag</kbd> - Pan view</li>
                  <li><kbd className="px-1 py-0.5 bg-background rounded">Left Click</kbd> - Select vehicle/junction</li>
                  <li><kbd className="px-1 py-0.5 bg-background rounded">Ctrl + I</kbd> - Show vehicle info</li>
                </ul>
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Placeholder showing what SUMO GUI looks like */}
        <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height: '600px' }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400 space-y-4">
              <ExternalLink className="w-16 h-16 mx-auto opacity-50" />
              <div>
                <p className="text-lg font-medium">SUMO GUI Running Externally</p>
                <p className="text-sm mt-2">Check your desktop for the SUMO window</p>
              </div>
              <div className="mt-6 p-4 bg-gray-800 rounded-lg max-w-md mx-auto text-left">
                <p className="text-xs text-gray-500 mb-2">Can't find the SUMO window?</p>
                <ul className="text-xs space-y-1 text-gray-400">
                  <li>• Check your taskbar for "sumo-gui"</li>
                  <li>• It may be behind other windows</li>
                  <li>• Try Alt+Tab (Windows) or Cmd+Tab (Mac)</li>
                  <li>• Look for a window titled "SUMO Grid3x3"</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Simulated SUMO GUI preview (static image placeholder) */}
          <div className="absolute bottom-4 right-4 bg-gray-800 p-3 rounded-lg border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">Expected SUMO GUI appearance:</p>
            <div className="w-48 h-32 bg-gray-700 rounded flex items-center justify-center">
              <div className="text-center">
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {[...Array(9)].map((_, i) => (
                    <div key={i} className="w-4 h-4 bg-yellow-600 rounded-sm"></div>
                  ))}
                </div>
                <p className="text-[8px] text-gray-500">3×3 Grid Network</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

