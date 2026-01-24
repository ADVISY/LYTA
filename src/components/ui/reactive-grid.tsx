import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useMotionValue } from "framer-motion";

interface ReactiveGridProps {
  children?: ReactNode;
  className?: string;
  gridColor?: string;
  gridSize?: number;
  lineOpacity?: number;
  glowIntensity?: number;
  glowRadius?: number;
}

export function ReactiveGrid({
  children,
  className = "",
  gridColor = "#D4A418",
  gridSize = 60,
  lineOpacity = 0.08,
  glowIntensity = 0.4,
  glowRadius = 300,
}: ReactiveGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setDimensions({
        width: container.offsetWidth || 1,
        height: container.offsetHeight || 1,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    container.addEventListener("mousemove", handleMouseMove);
    
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  // Calculate gradient position as percentages
  const gradientCx = (mousePos.x / dimensions.width) || 0.5;
  const gradientCy = (mousePos.y / dimensions.height) || 0.5;
  const gradientR = glowRadius / Math.max(dimensions.width, dimensions.height, 1);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {/* Grid SVG */}
      <svg
        className="pointer-events-none absolute inset-0 z-0"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Grid pattern */}
          <pattern
            id="reactive-grid-pattern"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
              opacity={lineOpacity}
            />
          </pattern>

          {/* Radial gradient for glow effect */}
          <radialGradient
            id="reactive-glow-gradient"
            cx={gradientCx}
            cy={gradientCy}
            r={gradientR}
          >
            <stop offset="0%" stopColor={gridColor} stopOpacity={glowIntensity} />
            <stop offset="50%" stopColor={gridColor} stopOpacity={glowIntensity * 0.3} />
            <stop offset="100%" stopColor={gridColor} stopOpacity="0" />
          </radialGradient>

          {/* Mask for grid glow effect */}
          <mask id="reactive-glow-mask">
            <rect width="100%" height="100%" fill="url(#reactive-glow-gradient)" />
          </mask>
        </defs>

        {/* Base grid */}
        <rect
          width="100%"
          height="100%"
          fill="url(#reactive-grid-pattern)"
          className="text-foreground"
        />

        {/* Glowing grid overlay */}
        <rect
          width="100%"
          height="100%"
          fill="url(#reactive-grid-pattern)"
          mask="url(#reactive-glow-mask)"
          style={{ color: gridColor }}
        />

        {/* Glow circle at mouse position */}
        <circle
          cx={mousePos.x}
          cy={mousePos.y}
          r={glowRadius * 0.15}
          fill={gridColor}
          opacity={glowIntensity * 0.15}
          style={{ transition: "cx 0.1s ease-out, cy 0.1s ease-out" }}
        />
      </svg>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
