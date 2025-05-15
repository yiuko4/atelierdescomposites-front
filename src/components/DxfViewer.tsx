import React, { useEffect, useRef, useState } from 'react';
// Importer correctement le module dxf-parser
const DxfParser = require('dxf-parser').DxfParser;

interface DxfViewerProps {
  dxfData: ArrayBuffer | null;
}

const DxfViewer: React.FC<DxfViewerProps> = ({ dxfData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [viewBox, setViewBox] = useState({ minX: 0, minY: 0, width: 1, height: 1 });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Parse DXF data when it changes
  useEffect(() => {
    if (!dxfData) return;

    try {
      // Créer une instance de la classe DxfParser du module
      const parser = new DxfParser();
      const text = new TextDecoder().decode(dxfData);
      const parsed = parser.parseSync(text);
      setParsedData(parsed);

      // Calculate bounding box for auto-fit
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      // Process entities to find bounding box
      if (parsed.entities && parsed.entities.length > 0) {
        parsed.entities.forEach((entity: any) => {
          if (entity.vertices) {
            entity.vertices.forEach((vertex: any) => {
              minX = Math.min(minX, vertex.x);
              minY = Math.min(minY, vertex.y);
              maxX = Math.max(maxX, vertex.x);
              maxY = Math.max(maxY, vertex.y);
            });
          } else if (entity.center) {
            const radius = entity.radius || 0;
            minX = Math.min(minX, entity.center.x - radius);
            minY = Math.min(minY, entity.center.y - radius);
            maxX = Math.max(maxX, entity.center.x + radius);
            maxY = Math.max(maxY, entity.center.y + radius);
          } else if (entity.position) {
            minX = Math.min(minX, entity.position.x);
            minY = Math.min(minY, entity.position.y);
            maxX = Math.max(maxX, entity.position.x);
            maxY = Math.max(maxY, entity.position.y);
          } else if (entity.startPoint && entity.endPoint) {
            minX = Math.min(minX, entity.startPoint.x, entity.endPoint.x);
            minY = Math.min(minY, entity.startPoint.y, entity.endPoint.y);
            maxX = Math.max(maxX, entity.startPoint.x, entity.endPoint.x);
            maxY = Math.max(maxY, entity.startPoint.y, entity.endPoint.y);
          }
        });

        // Add some padding
        const padding = Math.max(maxX - minX, maxY - minY) * 0.05;
        setViewBox({
          minX: minX - padding,
          minY: minY - padding,
          width: (maxX - minX) + padding * 2,
          height: (maxY - minY) + padding * 2
        });
      }
    } catch (error) {
      console.error('Error parsing DXF:', error);
    }
  }, [dxfData]);

  // Draw the DXF on the canvas
  useEffect(() => {
    if (!canvasRef.current || !parsedData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match its display size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    drawGrid(ctx, canvas.width, canvas.height);

    // Calculate scale to fit the drawing
    const canvasRatio = canvas.width / canvas.height;
    const drawingRatio = viewBox.width / viewBox.height;
    
    let newScale;
    if (drawingRatio > canvasRatio) {
      // Drawing is wider than canvas
      newScale = canvas.width / viewBox.width;
    } else {
      // Drawing is taller than canvas
      newScale = canvas.height / viewBox.height;
    }
    
    // Apply scale and pan
    const effectiveScale = newScale * scale;
    
    // Transform context
    ctx.save();
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(effectiveScale, -effectiveScale); // Flip Y axis to match DXF coordinate system
    ctx.translate(
      -(viewBox.minX + viewBox.width / 2),
      -(viewBox.minY + viewBox.height / 2)
    );

    // Draw entities
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1 / effectiveScale;
    
    if (parsedData.entities) {
      parsedData.entities.forEach((entity: any) => {
        drawEntity(ctx, entity);
      });
    }

    ctx.restore();
  }, [parsedData, viewBox, scale, pan]);

  // Draw grid on canvas
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const gridSize = 20;
    const majorGridSize = gridSize * 5;
    
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    
    // Draw minor grid lines
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
    
    // Draw major grid lines
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < width; x += majorGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    for (let y = 0; y < height; y += majorGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Draw a single DXF entity
  const drawEntity = (ctx: CanvasRenderingContext2D, entity: any) => {
    switch (entity.type) {
      case 'LINE':
        ctx.beginPath();
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        ctx.lineTo(entity.vertices[1].x, entity.vertices[1].y);
        ctx.stroke();
        break;
        
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices.length > 0) {
          ctx.beginPath();
          ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
          
          for (let i = 1; i < entity.vertices.length; i++) {
            ctx.lineTo(entity.vertices[i].x, entity.vertices[i].y);
          }
          
          if (entity.closed) {
            ctx.closePath();
          }
          
          ctx.stroke();
        }
        break;
        
      case 'CIRCLE':
        ctx.beginPath();
        ctx.arc(entity.center.x, entity.center.y, entity.radius, 0, Math.PI * 2);
        ctx.stroke();
        break;
        
      case 'ARC':
        ctx.beginPath();
        ctx.arc(
          entity.center.x, 
          entity.center.y, 
          entity.radius, 
          (entity.startAngle * Math.PI) / 180, 
          (entity.endAngle * Math.PI) / 180
        );
        ctx.stroke();
        break;
        
      case 'TEXT':
        ctx.save();
        ctx.scale(1, -1); // Flip text right-side up
        ctx.font = '12px sans-serif';
        ctx.fillText(entity.text, entity.position.x, -entity.position.y);
        ctx.restore();
        break;
    }
  };

  // Handle mouse wheel for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prevScale => prevScale * zoomFactor);
  };

  // Handle mouse down for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for panning
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setPan(prevPan => ({
      x: prevPan.x + dx,
      y: prevPan.y + dy
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse up to stop panning
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset view to fit the drawing
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="dxf-viewer-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width="800"
        height="600"
        style={{ 
          width: '100%', 
          height: '100%', 
          backgroundColor: '#f0f0f0',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {!dxfData && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#666',
          fontStyle: 'italic'
        }}>
          Importez un fichier DXF pour le visualiser ici
        </div>
      )}
      <div style={{
        position: 'absolute',
        bottom: '10px',
        right: '10px',
        display: 'flex',
        gap: '5px'
      }}>
        <button
          onClick={resetView}
          style={{
            padding: '5px 10px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default DxfViewer;
