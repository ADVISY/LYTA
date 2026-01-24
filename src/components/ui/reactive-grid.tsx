import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

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
  gridColor = "hsl(var(--primary))",
  gridSize = 60,
  lineOpacity = 0.08,
  glowIntensity = 0.3,
  glowRadius = 300,
}: ReactiveGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Spring physics for smooth movement
  const mouseX = useSpring(0, { stiffness: 100, damping: 25 });
  const mouseY = useSpring(0, { stiffness: 100, damping: 25 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      setDimensions({
        width: container.offsetWidth,
        height: container.offsetHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    };

    container.addEventListener("mousemove", handleMouseMove);
    
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", updateDimensions);
    };
  }, [mouseX, mouseY]);

  // Generate grid lines
  const verticalLines = Math.ceil(dimensions.width / gridSize) + 1;
  const horizontalLines = Math.ceil(dimensions.height / gridSize) + 1;

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
            id="grid-pattern"
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
          <motion.radialGradient
            id="glow-gradient"
            cx={useTransform(mouseX, (x) => x / dimensions.width)}
            cy={useTransform(mouseY, (y) => y / dimensions.height)}
            r={glowRadius / Math.max(dimensions.width, dimensions.height)}
          >
            <stop offset="0%" stopColor={gridColor} stopOpacity={glowIntensity} />
            <stop offset="50%" stopColor={gridColor} stopOpacity={glowIntensity * 0.3} />
            <stop offset="100%" stopColor={gridColor} stopOpacity="0" />
          </motion.radialGradient>

          {/* Mask for grid glow effect */}
          <mask id="glow-mask">
            <rect width="100%" height="100%" fill="url(#glow-gradient)" />
          </mask>
        </defs>

        {/* Base grid */}
        <rect
          width="100%"
          height="100%"
          fill="url(#grid-pattern)"
          className="text-foreground"
        />

        {/* Glowing grid overlay */}
        <rect
          width="100%"
          height="100%"
          fill="url(#grid-pattern)"
          mask="url(#glow-mask)"
          style={{ color: gridColor }}
        />

        {/* Intersection dots that glow near cursor */}
        <g>
          {Array.from({ length: verticalLines }).map((_, i) => (
            Array.from({ length: horizontalLines }).map((_, j) => (
              <motion.circle
                key={`${i}-${j}`}
                cx={i * gridSize}
                cy={j * gridSize}
                r="1.5"
                fill={gridColor}
                style={{
                  opacity: useTransform(
                    [mouseX, mouseY],
                    ([mx, my]) => {
                      const dx = (i * gridSize) - (mx as number);
                      const dy = (j * gridSize) - (my as number);
                      const distance = Math.sqrt(dx * dx + dy * dy);
                      return Math.max(0, 1 - distance / glowRadius) * glowIntensity;
                    }
                  ),
                }}
              />
            ))
          )).flat()}
        </g>
      </svg>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
