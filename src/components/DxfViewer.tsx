import React, { useEffect, useRef, useState } from "react";
const DxfParser = require("dxf-parser").DxfParser;

interface DxfViewerProps {
  dxfData: ArrayBuffer | null;
}

const DxfViewer: React.FC<DxfViewerProps> = ({ dxfData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [parsedData, setParsedData] = useState<any>(null);
  const [viewBox, setViewBox] = useState({
    minX: 0,
    minY: 0,
    width: 1,
    height: 1,
  });
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!dxfData) return;

    try {
      const parser = new DxfParser();
      const text = new TextDecoder().decode(dxfData);
      const parsed = parser.parseSync(text);
      setParsedData(parsed);

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      parsed.entities?.forEach((entity: any) => {
        const processPoint = (x: number, y: number) => {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        };

        if (entity.vertices)
          entity.vertices.forEach((v: any) => processPoint(v.x, v.y));
        if (entity.center) {
          const r = entity.radius || 0;
          processPoint(entity.center.x - r, entity.center.y - r);
          processPoint(entity.center.x + r, entity.center.y + r);
        }
        if (entity.position) processPoint(entity.position.x, entity.position.y);
        if (entity.startPoint && entity.endPoint) {
          processPoint(entity.startPoint.x, entity.startPoint.y);
          processPoint(entity.endPoint.x, entity.endPoint.y);
        }
      });

      const padding = Math.max(maxX - minX, maxY - minY) * 0.05;
      setViewBox({
        minX: minX - padding,
        minY: minY - padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2,
      });
    } catch (error) {
      console.error("Error parsing DXF:", error);
    }
  }, [dxfData]);

  useEffect(() => {
    if (!canvasRef.current || !parsedData) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid(ctx, canvas.width, canvas.height);

    const canvasRatio = canvas.width / canvas.height;
    const drawingRatio = viewBox.width / viewBox.height;
    const newScale =
      drawingRatio > canvasRatio
        ? canvas.width / viewBox.width
        : canvas.height / viewBox.height;
    const effectiveScale = newScale * scale;

    ctx.save();
    ctx.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    ctx.scale(effectiveScale, -effectiveScale);
    ctx.translate(
      -(viewBox.minX + viewBox.width / 2),
      -(viewBox.minY + viewBox.height / 2)
    );
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1 / effectiveScale;
    parsedData.entities?.forEach((entity: any) => drawEntity(ctx, entity));
    ctx.restore();
  }, [parsedData, viewBox, scale, pan]);

  const drawGrid = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ) => {
    const gridSize = 20,
      majorGridSize = gridSize * 5;
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += gridSize)
      ctx.stroke(new Path2D(`M${x} 0V${height}`));
    for (let y = 0; y < height; y += gridSize)
      ctx.stroke(new Path2D(`M0 ${y}H${width}`));
    ctx.strokeStyle = "#c0c0c0";
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += majorGridSize)
      ctx.stroke(new Path2D(`M${x} 0V${height}`));
    for (let y = 0; y < height; y += majorGridSize)
      ctx.stroke(new Path2D(`M0 ${y}H${width}`));
  };

  const drawArcFromBulge = (
    ctx: CanvasRenderingContext2D,
    start: any,
    end: any,
    bulge: number
  ) => {
    const dx = end.x - start.x,
      dy = end.y - start.y;
    const chord = Math.sqrt(dx * dx + dy * dy);
    const theta = 4 * Math.atan(bulge);
    const radius = chord / (2 * Math.sin(theta / 2));
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const angle = Math.atan2(dy, dx);
    const sagitta = (bulge * chord) / 2;
    const centerX = midX - sagitta * (dy / chord);
    const centerY = midY + sagitta * (dx / chord);
    const startAngle = Math.atan2(start.y - centerY, start.x - centerX);
    const endAngle = Math.atan2(end.y - centerY, end.x - centerX);
    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      Math.abs(radius),
      startAngle,
      endAngle,
      bulge < 0
    );
    ctx.stroke();
  };

  const drawEntity = (ctx: CanvasRenderingContext2D, entity: any) => {
    switch (entity.type) {
      case "LINE":
        ctx.beginPath();
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        ctx.lineTo(entity.vertices[1].x, entity.vertices[1].y);
        ctx.stroke();
        break;
      case "LWPOLYLINE":
        ctx.beginPath();
        ctx.moveTo(entity.vertices[0].x, entity.vertices[0].y);
        for (let i = 0; i < entity.vertices.length - 1; i++) {
          const v1 = entity.vertices[i];
          const v2 = entity.vertices[i + 1];
          const bulge = v1.bulge || 0;
          bulge !== 0
            ? drawArcFromBulge(ctx, v1, v2, bulge)
            : ctx.lineTo(v2.x, v2.y);
        }
        if (entity.closed) ctx.closePath();
        ctx.stroke();
        break;
      case "CIRCLE":
        ctx.beginPath();
        ctx.arc(
          entity.center.x,
          entity.center.y,
          entity.radius,
          0,
          2 * Math.PI
        );
        ctx.stroke();
        break;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoom = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => prev * zoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "absolute",
        top: 0,
        left: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: "#f0f0f0",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {!dxfData && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#666",
          }}
        >
          Importez un fichier DXF pour le visualiser ici
        </div>
      )}
      <div style={{ position: "absolute", bottom: 10, right: 10 }}>
        <button
          onClick={resetView}
          style={{
            padding: "5px 10px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 3,
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default DxfViewer;
