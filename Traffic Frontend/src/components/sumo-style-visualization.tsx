import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from './ui/card';

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

interface SUMOStyleVisualizationProps {
  vehicles: SUMOVehicle[];
  trafficLights: SUMOTrafficLight[];
  junctions: SUMOJunction[];
  edges: SUMOEdge[];
  width?: number;
  height?: number;
}

export function SUMOStyleVisualization({
  vehicles,
  trafficLights,
  junctions,
  edges,
  width = 1000,
  height = 700
}: SUMOStyleVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredVehicle, setHoveredVehicle] = useState<SUMOVehicle | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Calculate bounds for auto-scaling
  const bounds = junctions.reduce(
    (acc, j) => ({
      minX: Math.min(acc.minX, j.x),
      maxX: Math.max(acc.maxX, j.x),
      minY: Math.min(acc.minY, j.y),
      maxY: Math.max(acc.maxY, j.y)
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  );

  const padding = 50;
  const scale = Math.min(
    (width - 2 * padding) / (bounds.maxX - bounds.minX || 1),
    (height - 2 * padding) / (bounds.maxY - bounds.minY || 1)
  );

  const offset = {
    x: padding - bounds.minX * scale,
    y: padding - bounds.minY * scale
  };

  const transformX = (x: number) => x * scale + offset.x;
  const transformY = (y: number) => height - (y * scale + offset.y);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with SUMO-style background
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, width, height);

    // Draw grid (SUMO-style)
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Create junction map for edge rendering
    const junctionMap = new Map(junctions.map(j => [j.id, j]));

    // Draw edges (roads) with SUMO-style lanes
    edges.forEach(edge => {
      const fromJunction = junctionMap.get(edge.from);
      const toJunction = junctionMap.get(edge.to);
      
      if (fromJunction && toJunction) {
        const x1 = transformX(fromJunction.x);
        const y1 = transformY(fromJunction.y);
        const x2 = transformX(toJunction.x);
        const y2 = transformY(toJunction.y);

        // Draw road background (darker)
        ctx.strokeStyle = '#1a1a1a';
        ctx.lineWidth = 16;
        ctx.lineCap = 'butt';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw road surface (SUMO gray)
        ctx.strokeStyle = '#4a4a4a';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        // Draw lane markings (dashed white lines)
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw edge direction arrow
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const arrowSize = 6;
        
        ctx.fillStyle = '#666666';
        ctx.beginPath();
        ctx.moveTo(midX, midY);
        ctx.lineTo(
          midX - arrowSize * Math.cos(angle - Math.PI / 6),
          midY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          midX - arrowSize * Math.cos(angle + Math.PI / 6),
          midY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    });

    // Draw junctions (SUMO-style intersections)
    junctions.forEach(junction => {
      const x = transformX(junction.x);
      const y = transformY(junction.y);

      // Junction background
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      // Junction border
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();

      // Junction ID (small text)
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(junction.id.slice(-2), x, y);
    });

    // Draw traffic lights at junctions
    trafficLights.forEach(tl => {
      const junction = junctions.find(j => tl.id.includes(j.id));
      if (junction) {
        const x = transformX(junction.x);
        const y = transformY(junction.y);

        // Traffic light housing
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x - 18, y - 18, 8, 24);

        // Parse traffic light state (e.g., "GGrrGGrr")
        const hasGreen = tl.state.includes('G') || tl.state.includes('g');
        const hasYellow = tl.state.includes('y') || tl.state.includes('Y');
        const hasRed = tl.state.includes('r') || tl.state.includes('R');

        // Draw lights (SUMO-style vertical arrangement)
        const lightRadius = 3;
        const lightSpacing = 6;

        // Red light
        ctx.fillStyle = hasRed ? '#ff3333' : '#331111';
        ctx.beginPath();
        ctx.arc(x - 14, y - 12, lightRadius, 0, Math.PI * 2);
        ctx.fill();

        // Yellow light
        ctx.fillStyle = hasYellow ? '#ffff33' : '#333311';
        ctx.beginPath();
        ctx.arc(x - 14, y - 6, lightRadius, 0, Math.PI * 2);
        ctx.fill();

        // Green light
        ctx.fillStyle = hasGreen ? '#33ff33' : '#113311';
        ctx.beginPath();
        ctx.arc(x - 14, y, lightRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw vehicles (SUMO-style 3D-ish rendering)
    vehicles.forEach(vehicle => {
      const x = transformX(vehicle.position.x);
      const y = transformY(vehicle.position.y);
      const angle = -vehicle.angle; // Flip angle for canvas

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      // Vehicle dimensions (SUMO-style)
      let length = 4.5;
      let width = 2;
      let color = '#4a9eff'; // Default car color

      // Type-specific styling (SUMO colors)
      switch (vehicle.type.toLowerCase()) {
        case 'emergency':
        case 'ambulance':
        case 'fire':
        case 'police':
          color = '#ff4444';
          length = 5.5;
          width = 2.2;
          break;
        case 'truck':
          color = '#ff8844';
          length = 7;
          width = 2.5;
          break;
        case 'bus':
          color = '#8844ff';
          length = 12;
          width = 2.5;
          break;
        case 'bike':
        case 'bicycle':
          color = '#44ff88';
          length = 2;
          width = 0.8;
          break;
      }

      // Draw vehicle shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-length / 2 + 1, -width / 2 + 1, length, width);

      // Draw vehicle body (main color)
      ctx.fillStyle = color;
      ctx.fillRect(-length / 2, -width / 2, length, width);

      // Draw vehicle outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-length / 2, -width / 2, length, width);

      // Draw windshield (front)
      ctx.fillStyle = 'rgba(100, 150, 200, 0.6)';
      ctx.fillRect(length / 2 - 1.5, -width / 2 + 0.3, 1.2, width - 0.6);

      // Draw headlights
      ctx.fillStyle = vehicle.speed > 0.1 ? '#ffffaa' : '#666666';
      ctx.fillRect(length / 2 - 0.3, -width / 2 + 0.2, 0.3, 0.4);
      ctx.fillRect(length / 2 - 0.3, width / 2 - 0.6, 0.3, 0.4);

      // Highlight if waiting
      if (vehicle.waiting_time > 5) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(-length / 2 - 1, -width / 2 - 1, length + 2, width + 2);
      }

      // Highlight if hovered
      if (hoveredVehicle?.id === vehicle.id) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(-length / 2 - 2, -width / 2 - 2, length + 4, width + 4);
      }

      ctx.restore();
    });

    // Draw scale bar (SUMO-style)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(width - 120, height - 30, 100, 2);
    ctx.font = '10px monospace';
    ctx.fillText('100m', width - 120, height - 35);

  }, [vehicles, trafficLights, junctions, edges, width, height, hoveredVehicle, bounds, scale, offset]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setMousePos({ x: mouseX, y: mouseY });

    // Check if hovering over a vehicle
    const hovered = vehicles.find(vehicle => {
      const x = transformX(vehicle.position.x);
      const y = transformY(vehicle.position.y);
      const distance = Math.sqrt((mouseX - x) ** 2 + (mouseY - y) ** 2);
      return distance < 10;
    });

    setHoveredVehicle(hovered || null);
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        className="rounded-lg border border-gray-700"
        style={{ cursor: hoveredVehicle ? 'pointer' : 'default' }}
      />

      {/* Vehicle info tooltip */}
      {hoveredVehicle && (
        <div
          className="absolute bg-black/90 text-white text-xs p-2 rounded pointer-events-none border border-yellow-500"
          style={{
            left: mousePos.x + 10,
            top: mousePos.y + 10
          }}
        >
          <div className="font-mono space-y-1">
            <div className="font-bold text-yellow-400">{hoveredVehicle.id}</div>
            <div>Type: {hoveredVehicle.type}</div>
            <div>Speed: {hoveredVehicle.speed.toFixed(2)} m/s</div>
            <div>Waiting: {hoveredVehicle.waiting_time.toFixed(1)}s</div>
            <div>Pos: ({hoveredVehicle.position.x.toFixed(1)}, {hoveredVehicle.position.y.toFixed(1)})</div>
          </div>
        </div>
      )}
    </div>
  );
}

