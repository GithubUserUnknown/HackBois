import React, { useRef, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface SUMOVehicle {
  id: string;
  position: { x: number; y: number };
  speed: number;
  type: string;
  angle: number;
  waiting_time: number;
}

interface SUMOTrafficLight {
  id: string;
  state: string;
  phase: number;
  next_switch: number;
  controlled_lanes: string[];
}

interface SUMOJunction {
  id: string;
  x: number;
  y: number;
  type: string;
}

interface SUMOEdge {
  id: string;
  from: string;
  to: string;
}

interface SUMOVisualizationProps {
  vehicles: SUMOVehicle[];
  trafficLights: SUMOTrafficLight[];
  junctions: SUMOJunction[];
  edges: SUMOEdge[];
  width?: number;
  height?: number;
  showVehicleInfo?: boolean;
}

export function SUMOVisualization({
  vehicles,
  trafficLights,
  junctions,
  edges,
  width = 800,
  height = 600,
  showVehicleInfo = true
}: SUMOVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<SUMOVehicle | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Calculate bounds and scale
  useEffect(() => {
    if (junctions.length === 0) return;

    const xCoords = junctions.map(j => j.x);
    const yCoords = junctions.map(j => j.y);
    
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);
    
    const networkWidth = maxX - minX;
    const networkHeight = maxY - minY;
    
    // Calculate scale to fit network in canvas with padding
    const padding = 50;
    const scaleX = (width - 2 * padding) / networkWidth;
    const scaleY = (height - 2 * padding) / networkHeight;
    const newScale = Math.min(scaleX, scaleY);
    
    setScale(newScale);
    setOffset({
      x: padding - minX * newScale,
      y: padding - minY * newScale
    });
  }, [junctions, width, height]);

  // Transform SUMO coordinates to canvas coordinates
  const transformX = (x: number) => x * scale + offset.x;
  const transformY = (y: number) => height - (y * scale + offset.y); // Flip Y axis

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw edges (roads)
    edges.forEach(edge => {
      const fromJunction = junctions.find(j => j.id === edge.from);
      const toJunction = junctions.find(j => j.id === edge.to);
      
      if (fromJunction && toJunction) {
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(transformX(fromJunction.x), transformY(fromJunction.y));
        ctx.lineTo(transformX(toJunction.x), transformY(toJunction.y));
        ctx.stroke();
        
        // Draw lane markings
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(transformX(fromJunction.x), transformY(fromJunction.y));
        ctx.lineTo(transformX(toJunction.x), transformY(toJunction.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Draw junctions
    junctions.forEach(junction => {
      const x = transformX(junction.x);
      const y = transformY(junction.y);
      
      // Junction circle
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.arc(x, y, 15, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Junction label
      ctx.fillStyle = '#aaa';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(junction.id, x, y + 25);
    });

    // Draw traffic lights
    trafficLights.forEach(tl => {
      const junction = junctions.find(j => j.id === tl.id);
      if (!junction) return;
      
      const x = transformX(junction.x);
      const y = transformY(junction.y);
      
      // Determine light color from state
      let color = '#666';
      if (tl.state.includes('G')) color = '#10b981'; // Green
      else if (tl.state.includes('y')) color = '#f59e0b'; // Yellow
      else if (tl.state.includes('r')) color = '#ef4444'; // Red
      
      // Draw traffic light indicator
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // Draw vehicles
    vehicles.forEach(vehicle => {
      const x = transformX(vehicle.position.x);
      const y = transformY(vehicle.position.y);
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((-vehicle.angle * Math.PI) / 180); // Convert to radians and flip
      
      // Vehicle color based on type
      let color = '#3b82f6'; // Default blue
      if (vehicle.type.includes('ambulance') || vehicle.type.includes('emergency')) {
        color = '#ef4444'; // Red for emergency
      } else if (vehicle.type.includes('truck')) {
        color = '#f59e0b'; // Orange for trucks
      } else if (vehicle.type.includes('bus')) {
        color = '#8b5cf6'; // Purple for buses
      } else if (vehicle.type.includes('bike')) {
        color = '#10b981'; // Green for bikes
      }
      
      // Draw vehicle rectangle
      const vWidth = vehicle.type.includes('truck') || vehicle.type.includes('bus') ? 12 : 8;
      const vHeight = vehicle.type.includes('bike') ? 3 : 5;
      
      ctx.fillStyle = color;
      ctx.fillRect(-vWidth / 2, -vHeight / 2, vWidth, vHeight);
      
      // Highlight if selected
      if (selectedVehicle?.id === vehicle.id) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.strokeRect(-vWidth / 2, -vHeight / 2, vWidth, vHeight);
      }
      
      // Draw waiting indicator
      if (vehicle.waiting_time > 5) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, -8, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Draw vehicle info if selected
    if (selectedVehicle && showVehicleInfo) {
      const infoX = mousePos.x + 10;
      const infoY = mousePos.y - 10;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
      ctx.fillRect(infoX, infoY - 80, 200, 80);
      
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      
      const lines = [
        `ID: ${selectedVehicle.id}`,
        `Type: ${selectedVehicle.type}`,
        `Speed: ${selectedVehicle.speed.toFixed(1)} m/s`,
        `Waiting: ${selectedVehicle.waiting_time.toFixed(1)}s`,
        `Angle: ${selectedVehicle.angle.toFixed(0)}°`
      ];
      
      lines.forEach((line, index) => {
        ctx.fillText(line, infoX + 5, infoY - 65 + index * 15);
      });
    }
  }, [vehicles, trafficLights, junctions, edges, scale, offset, selectedVehicle, mousePos, width, height, showVehicleInfo]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setMousePos({ x, y });
    
    // Check if mouse is over a vehicle
    let foundVehicle: SUMOVehicle | null = null;
    for (const vehicle of vehicles) {
      const vx = transformX(vehicle.position.x);
      const vy = transformY(vehicle.position.y);
      
      const distance = Math.sqrt((x - vx) ** 2 + (y - vy) ** 2);
      if (distance < 10) {
        foundVehicle = vehicle;
        break;
      }
    }
    
    setSelectedVehicle(foundVehicle);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        className="border border-gray-700 rounded-lg cursor-crosshair"
        style={{ backgroundColor: '#1a1a1a' }}
      />
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-black/80 p-3 rounded-lg text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded"></div>
          <span className="text-white">Car</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-white">Emergency</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span className="text-white">Truck</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-purple-500 rounded"></div>
          <span className="text-white">Bus</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-white">Bike</span>
        </div>
      </div>
      
      {/* Stats */}
      <div className="absolute bottom-4 left-4 bg-black/80 p-3 rounded-lg text-xs space-y-1">
        <div className="text-white">
          <span className="font-semibold">Vehicles:</span> {vehicles.length}
        </div>
        <div className="text-white">
          <span className="font-semibold">Traffic Lights:</span> {trafficLights.length}
        </div>
        <div className="text-white">
          <span className="font-semibold">Avg Speed:</span>{' '}
          {vehicles.length > 0
            ? (vehicles.reduce((sum, v) => sum + v.speed, 0) / vehicles.length).toFixed(1)
            : '0.0'}{' '}
          m/s
        </div>
      </div>
    </div>
  );
}

