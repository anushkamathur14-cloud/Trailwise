"use client";

import { useEffect, useRef } from "react";

export type HeatCoord = { x: number; y: number };

/**
 * Classic website heatmap overlay: density blobs colored blue → cyan → green → yellow → red,
 * semi-transparent so the page remains readable underneath.
 */
export function HeatmapOverlay({
  points,
  enabled,
  radius = 72,
  opacity = 0.62,
}: {
  points: HeatCoord[];
  enabled: boolean;
  radius?: number;
  opacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      const width = Math.max(1, Math.floor(container.clientWidth));
      const height = Math.max(1, Math.floor(container.clientHeight));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      if (points.length === 0) return;

      // Intensity layer (grayscale alpha accumulation)
      const intensity = document.createElement("canvas");
      intensity.width = width;
      intensity.height = height;
      const ictx = intensity.getContext("2d");
      if (!ictx) return;

      for (const point of points) {
        const px = point.x * width;
        const py = point.y * height;
        const gradient = ictx.createRadialGradient(px, py, 0, px, py, radius);
        gradient.addColorStop(0, "rgba(0,0,0,0.55)");
        gradient.addColorStop(0.35, "rgba(0,0,0,0.28)");
        gradient.addColorStop(0.7, "rgba(0,0,0,0.1)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ictx.fillStyle = gradient;
        ictx.beginPath();
        ictx.arc(px, py, radius, 0, Math.PI * 2);
        ictx.fill();
      }

      const image = ictx.getImageData(0, 0, width, height);
      const data = image.data;
      let max = 1;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > max) max = data[i];
      }

      const colored = ctx.createImageData(width, height);
      for (let i = 0; i < data.length; i += 4) {
        const t = data[i + 3] / max;
        if (t < 0.04) continue;
        const [r, g, b, a] = heatColor(t);
        colored.data[i] = r;
        colored.data[i + 1] = g;
        colored.data[i + 2] = b;
        colored.data[i + 3] = Math.round(a * opacity * 255);
      }
      ctx.putImageData(colored, 0, 0);
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(container);
    return () => observer.disconnect();
  }, [points, enabled, radius, opacity]);

  if (!enabled) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-40">
      <canvas ref={canvasRef} className="size-full" />
      {points.length === 0 && (
        <div className="absolute inset-x-0 top-12 flex justify-center">
          <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur">
            Heatmap on — click the page to build a density map
          </span>
        </div>
      )}
      {points.length > 0 && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 rounded-md bg-white/90 px-2 py-1 text-[10px] text-slate-600 shadow">
          <span>Low</span>
          <span
            className="h-2 w-20 rounded-full"
            style={{
              background: "linear-gradient(90deg, #3b82f6, #22d3ee, #22c55e, #eab308, #ef4444)",
            }}
          />
          <span>High</span>
        </div>
      )}
    </div>
  );
}

/** Classic thermal LUT: cool blue → hot red */
function heatColor(t: number): [number, number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.25) {
    const u = x / 0.25;
    return [lerp(30, 34, u), lerp(80, 211, u), lerp(246, 238, u), 0.35 + u * 0.25];
  }
  if (x < 0.45) {
    const u = (x - 0.25) / 0.2;
    return [lerp(34, 34, u), lerp(211, 197, u), lerp(238, 94, u), 0.55];
  }
  if (x < 0.65) {
    const u = (x - 0.45) / 0.2;
    return [lerp(34, 234, u), lerp(197, 179, u), lerp(94, 8, u), 0.65];
  }
  if (x < 0.85) {
    const u = (x - 0.65) / 0.2;
    return [lerp(234, 239, u), lerp(179, 68, u), lerp(8, 68, u), 0.75];
  }
  const u = (x - 0.85) / 0.15;
  return [lerp(239, 220, u), lerp(68, 20, u), lerp(68, 20, u), 0.85];
}

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}
