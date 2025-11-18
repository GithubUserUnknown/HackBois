import { useState, useRef, useEffect, useCallback } from 'react';
import { Intersection, EmergencyVehicle, getStatusColor } from '../lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Ambulance,
  Car,
  Camera,
  MapPin,
  Zap,
  Timer,
  TrendingUp,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Navigation,
  Keyboard
} from 'lucide-react';

interface TrafficMapProps {
  intersections: Intersection[];
  emergencyVehicles: EmergencyVehicle[];
  onIntersectionSelect: (intersection: Intersection) => void;
}

interface MapViewport {
  x: number;
  y: number;
  zoom: number;
}

interface Street {
  id: string;
  name: string;
  type: 'major' | 'minor' | 'highway';
  coordinates: { start: { x: number; y: number }; end: { x: number; y: number } };
  hasTraffic: boolean;
  lanes: number;
}

export function TrafficMap({ intersections, emergencyVehicles, onIntersectionSelect }: TrafficMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [selectedIntersection, setSelectedIntersection] = useState<Intersection | null>(null);
  const [viewport, setViewport] = useState<MapViewport>({ x: 0, y: 0, zoom: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });

  // Extended street network - including empty streets
  const streetNetwork: Street[] = [
    // Major streets with traffic (marked intersections)
    { id: 'main-st', name: 'Main Street', type: 'major', coordinates: { start: { x: 0, y: 200 }, end: { x: 1200, y: 200 } }, hasTraffic: true, lanes: 4 },
    { id: 'broadway', name: 'Broadway', type: 'major', coordinates: { start: { x: 0, y: 400 }, end: { x: 1200, y: 400 } }, hasTraffic: true, lanes: 4 },
    { id: '5th-ave', name: '5th Avenue', type: 'major', coordinates: { start: { x: 200, y: 0 }, end: { x: 200, y: 800 } }, hasTraffic: true, lanes: 4 },
    { id: 'park-ave', name: 'Park Avenue', type: 'major', coordinates: { start: { x: 600, y: 0 }, end: { x: 600, y: 800 } }, hasTraffic: true, lanes: 4 },

    // Minor streets with some traffic
    { id: '42nd-st', name: '42nd Street', type: 'minor', coordinates: { start: { x: 0, y: 300 }, end: { x: 1200, y: 300 } }, hasTraffic: true, lanes: 2 },
    { id: '59th-st', name: '59th Street', type: 'minor', coordinates: { start: { x: 0, y: 500 }, end: { x: 1200, y: 500 } }, hasTraffic: true, lanes: 2 },
    { id: '3rd-ave', name: '3rd Avenue', type: 'minor', coordinates: { start: { x: 400, y: 0 }, end: { x: 400, y: 800 } }, hasTraffic: true, lanes: 2 },

    // Empty streets (no traffic monitoring)
    { id: 'elm-st', name: 'Elm Street', type: 'minor', coordinates: { start: { x: 0, y: 100 }, end: { x: 1200, y: 100 } }, hasTraffic: false, lanes: 2 },
    { id: 'oak-st', name: 'Oak Street', type: 'minor', coordinates: { start: { x: 0, y: 600 }, end: { x: 1200, y: 600 } }, hasTraffic: false, lanes: 2 },
    { id: 'pine-st', name: 'Pine Street', type: 'minor', coordinates: { start: { x: 0, y: 700 }, end: { x: 1200, y: 700 } }, hasTraffic: false, lanes: 2 },
    { id: '1st-ave', name: '1st Avenue', type: 'minor', coordinates: { start: { x: 100, y: 0 }, end: { x: 100, y: 800 } }, hasTraffic: false, lanes: 2 },
    { id: '7th-ave', name: '7th Avenue', type: 'minor', coordinates: { start: { x: 300, y: 0 }, end: { x: 300, y: 800 } }, hasTraffic: false, lanes: 2 },
    { id: '9th-ave', name: '9th Avenue', type: 'minor', coordinates: { start: { x: 500, y: 0 }, end: { x: 500, y: 800 } }, hasTraffic: false, lanes: 2 },
    { id: 'lexington', name: 'Lexington Avenue', type: 'minor', coordinates: { start: { x: 700, y: 0 }, end: { x: 700, y: 800 } }, hasTraffic: false, lanes: 2 },

    // Highway (empty, no monitoring)
    { id: 'highway-1', name: 'Highway 1', type: 'highway', coordinates: { start: { x: 0, y: 50 }, end: { x: 1200, y: 50 } }, hasTraffic: false, lanes: 6 },
  ];
  
  // Map interaction handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPanPoint({ x: viewport.x, y: viewport.y });
      e.preventDefault();
    }
  }, [viewport.x, viewport.y]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setViewport({
        ...viewport,
        x: lastPanPoint.x + deltaX,
        y: lastPanPoint.y + deltaY
      });
    }
  }, [isDragging, dragStart, lastPanPoint, viewport]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(3, viewport.zoom * zoomFactor));
    setViewport(prev => ({ ...prev, zoom: newZoom }));
  }, [viewport.zoom]);

  const handleZoomIn = () => {
    setViewport(prev => ({ ...prev, zoom: Math.min(3, prev.zoom * 1.2) }));
  };

  const handleZoomOut = () => {
    setViewport(prev => ({ ...prev, zoom: Math.max(0.5, prev.zoom / 1.2) }));
  };

  const handleResetView = () => {
    setViewport({ x: 0, y: 0, zoom: 1 });
  };

  const handleIntersectionClick = (intersection: Intersection, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent map panning
    setSelectedIntersection(intersection);
    onIntersectionSelect(intersection);
  };

  const getEmergencyVehicleIcon = (type: EmergencyVehicle['type']) => {
    switch (type) {
      case 'ambulance': return '🚑';
      case 'fire': return '🚒';
      case 'police': return '🚔';
      default: return '🚨';
    }
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        setViewport(prev => ({
          ...prev,
          x: lastPanPoint.x + deltaX,
          y: lastPanPoint.y + deltaY
        }));
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragStart, lastPanPoint]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target !== document.body) return; // Only when not in input fields

      const panSpeed = 20;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          setViewport(prev => ({ ...prev, y: prev.y + panSpeed }));
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          setViewport(prev => ({ ...prev, y: prev.y - panSpeed }));
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          setViewport(prev => ({ ...prev, x: prev.x + panSpeed }));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          setViewport(prev => ({ ...prev, x: prev.x - panSpeed }));
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetView();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Map Area */}
      <div className="lg:col-span-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Live Traffic Map
                <Badge variant="secondary">
                  {intersections.length} Intersections
                </Badge>
              </div>

              {/* Map Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Move className="w-3 h-3" />
                  Drag to pan
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Keyboard className="w-3 h-3" />
                  WASD/Arrows
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={handleZoomIn}>
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomOut}>
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleResetView}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
                <Badge variant="outline" className="text-xs">
                  Zoom: {(viewport.zoom * 100).toFixed(0)}%
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              ref={mapRef}
              className="relative bg-gradient-to-br from-green-50 to-blue-50 h-[600px] overflow-hidden cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onWheel={handleWheel}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {/* Map content with transform */}
              <div
                className="absolute inset-0 transition-transform duration-100"
                style={{
                  transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
                  transformOrigin: 'center center'
                }}
              >
                {/* Map background grid */}
                <div className="absolute inset-0 opacity-10">
                  <svg width="1200" height="800">
                    <defs>
                      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#94a3b8" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>

                {/* Street Network */}
                <div className="absolute inset-0">
                  {streetNetwork.map((street) => {
                    const isHorizontal = street.coordinates.start.y === street.coordinates.end.y;
                    const streetWidth = street.type === 'highway' ? 12 : street.type === 'major' ? 8 : 4;

                    return (
                      <div key={street.id} className="relative">
                        {/* Street */}
                        <div
                          className={`absolute ${
                            street.hasTraffic
                              ? street.type === 'major'
                                ? 'bg-gray-400'
                                : 'bg-gray-300'
                              : 'bg-gray-200'
                          } ${street.type === 'highway' ? 'border-2 border-blue-300' : ''}`}
                          style={{
                            left: isHorizontal ? street.coordinates.start.x : street.coordinates.start.x - streetWidth / 2,
                            top: isHorizontal ? street.coordinates.start.y - streetWidth / 2 : street.coordinates.start.y,
                            width: isHorizontal ? street.coordinates.end.x - street.coordinates.start.x : streetWidth,
                            height: isHorizontal ? streetWidth : street.coordinates.end.y - street.coordinates.start.y,
                          }}
                        />

                        {/* Lane dividers for major streets */}
                        {street.hasTraffic && street.lanes > 2 && (
                          <div
                            className="absolute border-dashed border-white opacity-60"
                            style={{
                              left: isHorizontal ? street.coordinates.start.x : street.coordinates.start.x - 1,
                              top: isHorizontal ? street.coordinates.start.y - 1 : street.coordinates.start.y,
                              width: isHorizontal ? street.coordinates.end.x - street.coordinates.start.x : 2,
                              height: isHorizontal ? 2 : street.coordinates.end.y - street.coordinates.start.y,
                              borderWidth: isHorizontal ? '0 0 1px 0' : '0 0 0 1px',
                            }}
                          />
                        )}

                        {/* Street name labels */}
                        <div
                          className="absolute text-xs font-medium text-gray-600 pointer-events-none select-none"
                          style={{
                            left: isHorizontal
                              ? street.coordinates.start.x + (street.coordinates.end.x - street.coordinates.start.x) / 2 - 40
                              : street.coordinates.start.x + streetWidth + 5,
                            top: isHorizontal
                              ? street.coordinates.start.y + streetWidth + 5
                              : street.coordinates.start.y + (street.coordinates.end.y - street.coordinates.start.y) / 2,
                            transform: isHorizontal ? 'none' : 'rotate(-90deg)',
                            transformOrigin: 'left center',
                            opacity: viewport.zoom > 0.8 ? 1 : 0,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          {street.name}
                          {!street.hasTraffic && (
                            <span className="ml-1 text-red-500 text-xs">(No monitoring)</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Traffic indicators for empty streets */}
                <div className="absolute inset-0">
                  {streetNetwork.filter(s => !s.hasTraffic).map((street) => {
                    const isHorizontal = street.coordinates.start.y === street.coordinates.end.y;
                    const midX = isHorizontal
                      ? street.coordinates.start.x + (street.coordinates.end.x - street.coordinates.start.x) / 2
                      : street.coordinates.start.x;
                    const midY = isHorizontal
                      ? street.coordinates.start.y
                      : street.coordinates.start.y + (street.coordinates.end.y - street.coordinates.start.y) / 2;

                    return (
                      <div
                        key={`empty-${street.id}`}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                        style={{
                          left: midX,
                          top: midY,
                          opacity: viewport.zoom > 1.2 ? 1 : 0,
                          transition: 'opacity 0.2s'
                        }}
                      >
                        <div className="bg-red-100 border border-red-300 rounded px-2 py-1 text-xs text-red-700">
                          No Traffic Data
                        </div>
                      </div>
                    );
                  })}
                </div>
              
                {/* Intersections */}
                <div className="absolute inset-0">
                  {intersections.map((intersection, index) => {
                    // Position intersections at street intersections
                    const positions = [
                      { x: 200, y: 200 }, // Main St & 5th Ave
                      { x: 600, y: 200 }, // Main St & Park Ave
                      { x: 200, y: 400 }, // Broadway & 5th Ave
                      { x: 600, y: 400 }, // Broadway & Park Ave
                      { x: 400, y: 300 }, // 42nd St & 3rd Ave
                      { x: 200, y: 300 }, // 42nd St & 5th Ave
                    ];

                    const position = positions[index] || { x: 100 + (index % 4) * 150, y: 100 + Math.floor(index / 4) * 150 };

                    return (
                      <div
                        key={intersection.id}
                        className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:z-10"
                        style={{ left: position.x + 'px', top: position.y + 'px' }}
                        onClick={(e) => handleIntersectionClick(intersection, e)}
                      >
                        {/* Intersection marker */}
                        <div className={`
                          w-16 h-16 rounded-full border-4 border-white shadow-lg flex items-center justify-center
                          ${intersection.status === 'optimal' ? 'bg-green-500' :
                            intersection.status === 'congested' ? 'bg-yellow-500' :
                            intersection.status === 'critical' ? 'bg-red-500' : 'bg-purple-500'}
                          ${selectedIntersection?.id === intersection.id ? 'ring-4 ring-blue-400' : ''}
                          hover:scale-110 transition-transform
                        `}>
                          <Car className="w-6 h-6 text-white" />
                        </div>

                        {/* Emergency vehicles */}
                        {emergencyVehicles
                          .filter(ev => ev.intersectionId === intersection.id)
                          .map((vehicle, vehicleIndex) => (
                            <div
                              key={vehicle.id}
                              className="absolute -top-8 -right-8 text-lg animate-bounce"
                              style={{
                                animationDelay: `${vehicleIndex * 0.2}s`,
                                transform: `rotate(${vehicleIndex * 45}deg)`
                              }}
                            >
                              {getEmergencyVehicleIcon(vehicle.type)}
                            </div>
                          ))}

                        {/* Intersection name */}
                        <div
                          className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
                          style={{
                            opacity: viewport.zoom > 0.7 ? 1 : 0,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          <div className="bg-white px-2 py-1 rounded shadow text-xs font-medium">
                            {intersection.name}
                          </div>
                        </div>

                        {/* Signal override indicator */}
                        {intersection.signalOverride && (
                          <div className="absolute -top-2 -left-2">
                            <Zap className="w-4 h-4 text-orange-500" />
                          </div>
                        )}

                        {/* Traffic metrics overlay */}
                        <div
                          className="absolute -bottom-16 left-1/2 transform -translate-x-1/2"
                          style={{
                            opacity: viewport.zoom > 1.5 ? 1 : 0,
                            transition: 'opacity 0.2s'
                          }}
                        >
                          <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                            <div>Wait: {intersection.avgWaitTime}s</div>
                            <div>Queue: {intersection.queueLength}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mini-map */}
            <div className="absolute bottom-4 right-4 w-32 h-24 bg-white bg-opacity-90 border border-gray-300 rounded-lg p-2">
              <div className="text-xs font-medium mb-1">Overview</div>
              <div className="relative w-full h-full bg-gray-100 rounded">
                {/* Mini street network */}
                {streetNetwork.slice(0, 6).map((street) => {
                  const isHorizontal = street.coordinates.start.y === street.coordinates.end.y;
                  const scale = 0.1;
                  return (
                    <div
                      key={`mini-${street.id}`}
                      className={`absolute ${street.hasTraffic ? 'bg-gray-400' : 'bg-gray-300'}`}
                      style={{
                        left: isHorizontal ? street.coordinates.start.x * scale : street.coordinates.start.x * scale - 1,
                        top: isHorizontal ? street.coordinates.start.y * scale - 1 : street.coordinates.start.y * scale,
                        width: isHorizontal ? (street.coordinates.end.x - street.coordinates.start.x) * scale : 2,
                        height: isHorizontal ? 2 : (street.coordinates.end.y - street.coordinates.start.y) * scale,
                      }}
                    />
                  );
                })}

                {/* Mini intersections */}
                {intersections.slice(0, 4).map((intersection, index) => {
                  const positions = [
                    { x: 200, y: 200 }, { x: 600, y: 200 }, { x: 200, y: 400 }, { x: 600, y: 400 }
                  ];
                  const position = positions[index] || { x: 100, y: 100 };
                  return (
                    <div
                      key={`mini-int-${intersection.id}`}
                      className={`absolute w-2 h-2 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                        intersection.status === 'optimal' ? 'bg-green-500' :
                        intersection.status === 'congested' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{
                        left: position.x * 0.1,
                        top: position.y * 0.1,
                      }}
                    />
                  );
                })}

                {/* Viewport indicator */}
                <div
                  className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30"
                  style={{
                    left: Math.max(0, Math.min(100, 50 - viewport.x * 0.05)),
                    top: Math.max(0, Math.min(60, 30 - viewport.y * 0.05)),
                    width: Math.min(100, 60 / viewport.zoom),
                    height: Math.min(60, 40 / viewport.zoom),
                  }}
                />
              </div>
            </div>

            {/* Navigation compass */}
            <div className="absolute top-4 right-4 w-16 h-16 bg-white bg-opacity-90 border border-gray-300 rounded-full flex items-center justify-center">
              <Navigation className="w-8 h-8 text-gray-600" />
              <div className="absolute -top-6 text-xs font-bold text-gray-600">N</div>
            </div>

            {/* Legend and Controls */}
            <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 border border-gray-300 rounded-lg p-3 text-xs max-w-xs">
              <div className="font-medium mb-2">Legend & Controls</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="font-medium text-gray-700">Status</div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Optimal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Congested</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Critical</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-gray-400"></div>
                    <span>Monitored</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-1 bg-gray-200"></div>
                    <span>Unmonitored</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium text-gray-700">Controls</div>
                  <div>WASD/Arrows: Pan</div>
                  <div>+/-: Zoom</div>
                  <div>0: Reset view</div>
                  <div>Mouse: Drag/Wheel</div>
                  <div>Click: Select intersection</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Intersection Details */}
      <div className="space-y-4">
        {selectedIntersection ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {selectedIntersection.name}
                  <Badge className={getStatusColor(selectedIntersection.status)}>
                    {selectedIntersection.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{selectedIntersection.vehicleCount}</div>
                    <div className="text-sm text-muted-foreground">Vehicles</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{selectedIntersection.queueLength}</div>
                    <div className="text-sm text-muted-foreground">Queue Length</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{selectedIntersection.avgWaitTime}s</div>
                    <div className="text-sm text-muted-foreground">Avg Wait</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{selectedIntersection.throughput}</div>
                    <div className="text-sm text-muted-foreground">Throughput</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Current Phase:</span>
                    <Badge variant="outline">{selectedIntersection.currentPhase}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Time Remaining:</span>
                    <div className="flex items-center gap-1">
                      <Timer className="w-4 h-4" />
                      <span className="font-mono">{selectedIntersection.phaseTimeRemaining}s</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Congestion Score:</span>
                    <span className="font-bold">{selectedIntersection.congestionScore}/10</span>
                  </div>
                </div>
                
                {selectedIntersection.emergencyVehicles > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <Ambulance className="w-4 h-4" />
                      <span className="font-medium">
                        {selectedIntersection.emergencyVehicles} Emergency Vehicle(s) Approaching
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <h4 className="font-medium">Camera Status</h4>
                  {selectedIntersection.cameras.map((camera) => (
                    <div key={camera.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4" />
                        {camera.view}
                      </div>
                      <Badge variant={camera.status === 'active' ? 'default' : 'destructive'}>
                        {camera.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <Button 
                  className="w-full" 
                  variant={selectedIntersection.signalOverride ? "destructive" : "default"}
                >
                  {selectedIntersection.signalOverride ? 'Disable Override' : 'Override Signals'}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                    <p className="font-medium text-blue-800">Optimize Phase Timing</p>
                    <p className="text-blue-600">Increase north-south phase by 15 seconds</p>
                  </div>
                  <div className="p-2 bg-green-50 border border-green-200 rounded">
                    <p className="font-medium text-green-800">Emergency Priority</p>
                    <p className="text-green-600">Grant immediate clearance for approaching ambulance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">Select an Intersection</h3>
              <p className="text-sm text-muted-foreground">
                Click on any intersection marker to view detailed traffic information and controls.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}