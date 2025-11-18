import React, { useRef, useEffect, useState } from 'react';
import { Vehicle, TrafficLight } from '../lib/simulation-engine';

interface Street {
  id: string;
  name: string;
  type: 'major' | 'minor' | 'highway';
  coordinates: { start: { x: number; y: number }; end: { x: number; y: number } };
  hasTraffic: boolean;
  lanes: number;
}

interface TrafficSimulationCanvasProps {
  vehicles: Vehicle[];
  trafficLights: TrafficLight[];
  width?: number;
  height?: number;
  showTimings?: boolean;
  showVehicleInfo?: boolean;
}

export function TrafficSimulationCanvas({
  vehicles,
  trafficLights,
  width = 800,
  height = 600,
  showTimings = true,
  showVehicleInfo = true
}: TrafficSimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Street network matching the interactive map
  const streetNetwork: Street[] = [
    // Major streets with traffic (marked intersections)
    { id: 'main-st', name: 'Main Street', type: 'major', coordinates: { start: { x: 0, y: 160 }, end: { x: width, y: 160 } }, hasTraffic: true, lanes: 4 },
    { id: 'broadway', name: 'Broadway', type: 'major', coordinates: { start: { x: 0, y: 320 }, end: { x: width, y: 320 } }, hasTraffic: true, lanes: 4 },
    { id: '5th-ave', name: '5th Avenue', type: 'major', coordinates: { start: { x: 160, y: 0 }, end: { x: 160, y: height } }, hasTraffic: true, lanes: 4 },
    { id: 'park-ave', name: 'Park Avenue', type: 'major', coordinates: { start: { x: 480, y: 0 }, end: { x: 480, y: height } }, hasTraffic: true, lanes: 4 },

    // Minor streets with some traffic
    { id: '42nd-st', name: '42nd Street', type: 'minor', coordinates: { start: { x: 0, y: 240 }, end: { x: width, y: 240 } }, hasTraffic: true, lanes: 2 },
    { id: '59th-st', name: '59th Street', type: 'minor', coordinates: { start: { x: 0, y: 400 }, end: { x: width, y: 400 } }, hasTraffic: true, lanes: 2 },
    { id: '3rd-ave', name: '3rd Avenue', type: 'minor', coordinates: { start: { x: 320, y: 0 }, end: { x: 320, y: height } }, hasTraffic: true, lanes: 2 },

    // Empty streets (no traffic monitoring)
    { id: 'elm-st', name: 'Elm Street', type: 'minor', coordinates: { start: { x: 0, y: 80 }, end: { x: width, y: 80 } }, hasTraffic: false, lanes: 2 },
    { id: 'oak-st', name: 'Oak Street', type: 'minor', coordinates: { start: { x: 0, y: 480 }, end: { x: width, y: 480 } }, hasTraffic: false, lanes: 2 },
    { id: 'pine-st', name: 'Pine Street', type: 'minor', coordinates: { start: { x: 0, y: 560 }, end: { x: width, y: 560 } }, hasTraffic: false, lanes: 2 },
    { id: '1st-ave', name: '1st Avenue', type: 'minor', coordinates: { start: { x: 80, y: 0 }, end: { x: 80, y: height } }, hasTraffic: false, lanes: 2 },
    { id: '7th-ave', name: '7th Avenue', type: 'minor', coordinates: { start: { x: 240, y: 0 }, end: { x: 240, y: height } }, hasTraffic: false, lanes: 2 },
    { id: '9th-ave', name: '9th Avenue', type: 'minor', coordinates: { start: { x: 400, y: 0 }, end: { x: 400, y: height } }, hasTraffic: false, lanes: 2 },
    { id: 'lexington', name: 'Lexington Avenue', type: 'minor', coordinates: { start: { x: 560, y: 0 }, end: { x: 560, y: height } }, hasTraffic: false, lanes: 2 },
  ];

  // Intersection positions matching the street network
  const intersectionPositions = [
    { x: 160, y: 160, id: 'int-001' }, // Main St & 5th Ave
    { x: 480, y: 160, id: 'int-002' }, // Main St & Park Ave
    { x: 160, y: 320, id: 'int-003' }, // Broadway & 5th Ave
    { x: 480, y: 320, id: 'int-004' }, // Broadway & Park Ave
    { x: 320, y: 240, id: 'int-005' }, // 42nd St & 3rd Ave
    { x: 160, y: 240, id: 'int-006' }, // 42nd St & 5th Ave
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Draw road network
    drawRoadNetwork(ctx, width, height);

    // Draw intersections
    drawIntersections(ctx, width, height);

    // Draw traffic lights
    trafficLights.forEach(light => drawTrafficLight(ctx, light, showTimings));

    // Draw vehicles
    vehicles.forEach(vehicle => drawVehicle(ctx, vehicle, vehicle.id === selectedVehicle?.id));

    // Draw vehicle info if selected
    if (selectedVehicle && showVehicleInfo) {
      drawVehicleInfo(ctx, selectedVehicle, mousePos);
    }

  }, [vehicles, trafficLights, width, height, showTimings, showVehicleInfo, selectedVehicle, mousePos]);

  const drawRoadNetwork = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    // Draw streets
    streetNetwork.forEach((street) => {
      const isHorizontal = street.coordinates.start.y === street.coordinates.end.y;
      const streetWidth = street.type === 'highway' ? 16 : street.type === 'major' ? 12 : 8;

      // Street background
      ctx.fillStyle = street.hasTraffic
        ? street.type === 'major'
          ? '#6b7280'
          : '#9ca3af'
        : '#d1d5db';

      if (isHorizontal) {
        ctx.fillRect(
          street.coordinates.start.x,
          street.coordinates.start.y - streetWidth / 2,
          street.coordinates.end.x - street.coordinates.start.x,
          streetWidth
        );
      } else {
        ctx.fillRect(
          street.coordinates.start.x - streetWidth / 2,
          street.coordinates.start.y,
          streetWidth,
          street.coordinates.end.y - street.coordinates.start.y
        );
      }

      // Lane dividers for major streets
      if (street.hasTraffic && street.lanes > 2) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]);

        ctx.beginPath();
        if (isHorizontal) {
          ctx.moveTo(street.coordinates.start.x, street.coordinates.start.y);
          ctx.lineTo(street.coordinates.end.x, street.coordinates.end.y);
        } else {
          ctx.moveTo(street.coordinates.start.x, street.coordinates.start.y);
          ctx.lineTo(street.coordinates.end.x, street.coordinates.end.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Street borders
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);

      if (isHorizontal) {
        ctx.beginPath();
        ctx.moveTo(street.coordinates.start.x, street.coordinates.start.y - streetWidth / 2);
        ctx.lineTo(street.coordinates.end.x, street.coordinates.end.y - streetWidth / 2);
        ctx.moveTo(street.coordinates.start.x, street.coordinates.start.y + streetWidth / 2);
        ctx.lineTo(street.coordinates.end.x, street.coordinates.end.y + streetWidth / 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(street.coordinates.start.x - streetWidth / 2, street.coordinates.start.y);
        ctx.lineTo(street.coordinates.end.x - streetWidth / 2, street.coordinates.end.y);
        ctx.moveTo(street.coordinates.start.x + streetWidth / 2, street.coordinates.start.y);
        ctx.lineTo(street.coordinates.end.x + streetWidth / 2, street.coordinates.end.y);
        ctx.stroke();
      }

      // Street name labels
      if (street.hasTraffic) {
        ctx.fillStyle = '#1f2937';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';

        const midX = isHorizontal
          ? street.coordinates.start.x + (street.coordinates.end.x - street.coordinates.start.x) / 2
          : street.coordinates.start.x;
        const midY = isHorizontal
          ? street.coordinates.start.y
          : street.coordinates.start.y + (street.coordinates.end.y - street.coordinates.start.y) / 2;

        ctx.save();
        ctx.translate(midX, midY);
        if (!isHorizontal) {
          ctx.rotate(-Math.PI / 2);
        }
        ctx.fillText(street.name, 0, isHorizontal ? streetWidth / 2 + 15 : 15);
        ctx.restore();
      }
    });

    // Draw sidewalks
    ctx.fillStyle = '#e5e7eb';
    streetNetwork.forEach((street) => {
      const isHorizontal = street.coordinates.start.y === street.coordinates.end.y;
      const streetWidth = street.type === 'highway' ? 16 : street.type === 'major' ? 12 : 8;
      const sidewalkWidth = 4;

      if (isHorizontal) {
        // Top sidewalk
        ctx.fillRect(
          street.coordinates.start.x,
          street.coordinates.start.y - streetWidth / 2 - sidewalkWidth,
          street.coordinates.end.x - street.coordinates.start.x,
          sidewalkWidth
        );
        // Bottom sidewalk
        ctx.fillRect(
          street.coordinates.start.x,
          street.coordinates.start.y + streetWidth / 2,
          street.coordinates.end.x - street.coordinates.start.x,
          sidewalkWidth
        );
      } else {
        // Left sidewalk
        ctx.fillRect(
          street.coordinates.start.x - streetWidth / 2 - sidewalkWidth,
          street.coordinates.start.y,
          sidewalkWidth,
          street.coordinates.end.y - street.coordinates.start.y
        );
        // Right sidewalk
        ctx.fillRect(
          street.coordinates.start.x + streetWidth / 2,
          street.coordinates.start.y,
          sidewalkWidth,
          street.coordinates.end.y - street.coordinates.start.y
        );
      }
    });
  };

  const drawIntersections = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    intersectionPositions.forEach(intersection => {
      // Intersection background
      ctx.fillStyle = '#f9fafb';
      ctx.beginPath();
      ctx.arc(intersection.x, intersection.y, 30, 0, 2 * Math.PI);
      ctx.fill();

      // Intersection border
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(intersection.x, intersection.y, 30, 0, 2 * Math.PI);
      ctx.stroke();

      // Crosswalk markings
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);

      // Horizontal crosswalks
      for (let i = -24; i <= 24; i += 8) {
        ctx.beginPath();
        ctx.moveTo(intersection.x - 30, intersection.y + i);
        ctx.lineTo(intersection.x + 30, intersection.y + i);
        ctx.stroke();
      }

      // Vertical crosswalks
      for (let i = -24; i <= 24; i += 8) {
        ctx.beginPath();
        ctx.moveTo(intersection.x + i, intersection.y - 30);
        ctx.lineTo(intersection.x + i, intersection.y + 30);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      // Intersection ID label
      ctx.fillStyle = '#1f2937';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(intersection.id, intersection.x, intersection.y + 45);
    });
  };

  const drawTrafficLight = (ctx: CanvasRenderingContext2D, light: TrafficLight, showTiming: boolean) => {
    const intersection = intersectionPositions.find(pos => pos.id === light.intersectionId);
    if (!intersection) return;

    let lightX = intersection.x;
    let lightY = intersection.y;

    // Position lights based on direction
    if (light.direction === 'north-south') {
      lightX -= 50;
      lightY -= 20;
    } else {
      lightX -= 20;
      lightY -= 50;
    }

    // Draw traffic light box
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(lightX, lightY, 30, 60);

    // Draw light states
    const lightColors = {
      red: light.state === 'red' ? '#ef4444' : '#7f1d1d',
      yellow: light.state === 'yellow' ? '#f59e0b' : '#78350f',
      green: light.state === 'green' ? '#10b981' : '#064e3b'
    };

    // Red light
    ctx.fillStyle = lightColors.red;
    ctx.beginPath();
    ctx.arc(lightX + 15, lightY + 12, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Yellow light
    ctx.fillStyle = lightColors.yellow;
    ctx.beginPath();
    ctx.arc(lightX + 15, lightY + 30, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Green light
    ctx.fillStyle = lightColors.green;
    ctx.beginPath();
    ctx.arc(lightX + 15, lightY + 48, 8, 0, 2 * Math.PI);
    ctx.fill();

    // Show timing if enabled
    if (showTiming) {
      ctx.fillStyle = '#1f2937';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${Math.ceil(light.timeRemaining)}s`,
        lightX + 15,
        lightY + 75
      );
    }

    // Emergency override indicator
    if (light.emergencyOverride) {
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 10px Arial';
      ctx.fillText('EMERGENCY', lightX + 15, lightY - 5);
    }
  };

  const drawVehicle = (ctx: CanvasRenderingContext2D, vehicle: Vehicle, isSelected: boolean) => {
    const { x, y } = vehicle.position;

    // Vehicle dimensions based on type
    const dimensions = {
      car: { width: 16, height: 8 },
      truck: { width: 24, height: 12 },
      bus: { width: 24, height: 12 },
      motorcycle: { width: 8, height: 4 },
      emergency: { width: 20, height: 10 }
    };

    const dim = dimensions[vehicle.type];

    // Rotate context for vehicle direction
    ctx.save();
    ctx.translate(x, y);

    const rotation = {
      north: -Math.PI / 2,
      south: Math.PI / 2,
      east: 0,
      west: Math.PI
    };

    ctx.rotate(rotation[vehicle.direction]);

    // Draw vehicle shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(-dim.width / 2 + 1, -dim.height / 2 + 1, dim.width, dim.height);

    // Draw vehicle body with gradient effect
    const gradient = ctx.createLinearGradient(0, -dim.height / 2, 0, dim.height / 2);
    gradient.addColorStop(0, vehicle.color);
    gradient.addColorStop(1, adjustBrightness(vehicle.color, -30));

    ctx.fillStyle = gradient;
    ctx.fillRect(-dim.width / 2, -dim.height / 2, dim.width, dim.height);

    // Draw vehicle outline
    ctx.strokeStyle = isSelected ? '#fbbf24' : '#1f2937';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(-dim.width / 2, -dim.height / 2, dim.width, dim.height);

    // Draw windows
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(-dim.width / 2 + 1, -dim.height / 2 + 1, dim.width - 2, dim.height - 2);

    // Draw front bumper/direction indicator
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dim.width / 2 - 1, -dim.height / 4, 1, dim.height / 2);

    // Draw headlights
    ctx.fillStyle = '#fffacd';
    ctx.beginPath();
    ctx.arc(dim.width / 2, -dim.height / 3, 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dim.width / 2, dim.height / 3, 1, 0, 2 * Math.PI);
    ctx.fill();

    // Draw vehicle-specific details
    if (vehicle.type === 'emergency') {
      // Animated emergency lights
      const time = Date.now() / 300;
      const redIntensity = Math.sin(time) > 0 ? 1 : 0.3;
      const blueIntensity = Math.cos(time) > 0 ? 1 : 0.3;

      ctx.fillStyle = `rgba(239, 68, 68, ${redIntensity})`;
      ctx.beginPath();
      ctx.arc(-dim.width / 4, 0, 2, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = `rgba(59, 130, 246, ${blueIntensity})`;
      ctx.beginPath();
      ctx.arc(dim.width / 4, 0, 2, 0, 2 * Math.PI);
      ctx.fill();
    } else if (vehicle.type === 'truck') {
      // Truck cargo area
      ctx.fillStyle = adjustBrightness(vehicle.color, -40);
      ctx.fillRect(-dim.width / 2 + 6, -dim.height / 2, dim.width - 12, dim.height);
    } else if (vehicle.type === 'bus') {
      // Bus windows
      ctx.fillStyle = '#87ceeb';
      for (let i = -dim.width / 2 + 3; i < dim.width / 2 - 3; i += 4) {
        ctx.fillRect(i, -dim.height / 2 + 1, 2, dim.height - 2);
      }
    }

    // Draw priority indicator
    if (vehicle.priority > 7) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -dim.height / 2 - 4, 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.font = '6px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('!', 0, -dim.height / 2 - 2);
    }

    ctx.restore();

    // Draw vehicle info if selected
    if (isSelected) {
      ctx.fillStyle = '#1f2937';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${vehicle.type.toUpperCase()} ${vehicle.id.slice(-4)}`, x, y - 20);
      ctx.fillText(`${Math.round(vehicle.speed)} km/h`, x, y - 12);

      // Draw selection circle
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw waiting indicator
    if (vehicle.isWaiting) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('WAIT', x, y - 15);
    }

    // Draw speed indicator bar
    if (vehicle.speed > 0) {
      const speedBarWidth = 16;
      const speedBarHeight = 2;
      const speedRatio = Math.min(vehicle.speed / 60, 1); // Normalize to max 60 km/h

      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x - speedBarWidth / 2, y + 12, speedBarWidth, speedBarHeight);

      ctx.fillStyle = speedRatio > 0.7 ? '#ef4444' : speedRatio > 0.4 ? '#f59e0b' : '#10b981';
      ctx.fillRect(x - speedBarWidth / 2, y + 12, speedBarWidth * speedRatio, speedBarHeight);
    }
  };

  // Helper function to adjust color brightness
  const adjustBrightness = (color: string, amount: number): string => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const drawVehicleInfo = (ctx: CanvasRenderingContext2D, vehicle: Vehicle, mousePos: { x: number, y: number }) => {
    const infoX = mousePos.x + 10;
    const infoY = mousePos.y - 10;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(infoX, infoY - 80, 200, 80);

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';

    const lines = [
      `Type: ${vehicle.type}`,
      `Speed: ${vehicle.speed.toFixed(1)} km/h`,
      `Wait Time: ${vehicle.waitTime.toFixed(1)}s`,
      `Priority: ${vehicle.priority.toFixed(1)}`,
      `Weight: ${vehicle.weight}kg`,
      `Fuel: ${vehicle.fuelConsumption}L/100km`
    ];

    lines.forEach((line, index) => {
      ctx.fillText(line, infoX + 5, infoY - 65 + index * 12);
    });
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Find clicked vehicle
    const clickedVehicle = vehicles.find(vehicle => {
      const distance = Math.sqrt(
        Math.pow(clickX - vehicle.position.x, 2) + 
        Math.pow(clickY - vehicle.position.y, 2)
      );
      return distance < 20;
    });

    setSelectedVehicle(clickedVehicle || null);
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    setMousePos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border border-gray-300 rounded-lg cursor-pointer"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      />
      
      {/* Legend */}
      <div className="absolute top-2 right-2 bg-white bg-opacity-90 p-3 rounded-lg text-sm">
        <div className="font-semibold mb-2">Legend</div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-blue-500"></div>
            <span>Car</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-amber-500"></div>
            <span>Truck</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-green-500"></div>
            <span>Bus</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-purple-500"></div>
            <span>Motorcycle</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 bg-red-500"></div>
            <span>Emergency</span>
          </div>
        </div>
        
        <div className="mt-3 pt-2 border-t">
          <div className="font-semibold mb-1">Traffic Lights</div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 p-2 rounded text-xs">
        Click on vehicles to see details
      </div>
    </div>
  );
}
