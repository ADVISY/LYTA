import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

/**
 * Converts hex color to HSL string
 */
function hexToHsl(hex: string): string {
  hex = hex.replace(/^#/, '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Normalizes a color value to HSL format
 * Accepts: hex (#RRGGBB), hsl(...), or raw HSL values
 */
function normalizeToHsl(color: string): string {
  if (color.startsWith('#')) {
    return `hsl(${hexToHsl(color)})`;
  }
  if (color.startsWith('hsl')) {
    return color;
  }
  // Assume raw HSL values like "45 93% 47%"
  return `hsl(${color})`;
}

interface MouseGradientProps {
  children?: ReactNode;
  className?: string;
  gradientColor?: string;
  gradientSize?: number;
  intensity?: number;
  alwaysVisible?: boolean;
}

export function MouseGradient({
  children,
  className = "",
  gradientColor = "#D4A418", // LYTA gold default
  gradientSize = 600,
  intensity = 0.15,
  alwaysVisible = true,
}: MouseGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Normalize the color to HSL format
  const normalizedColor = normalizeToHsl(gradientColor);

  // Spring physics for smooth movement
  const mouseX = useSpring(50, { stiffness: 150, damping: 20 });
  const mouseY = useSpring(50, { stiffness: 150, damping: 20 });

  // Transform to percentage for CSS
  const gradientX = useTransform(mouseX, (v) => `${v}%`);
  const gradientY = useTransform(mouseY, (v) => `${v}%`);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      mouseX.set(x);
      mouseY.set(y);
      if (!hasInteracted) setHasInteracted(true);
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY, hasInteracted]);

  // Calculate opacity: visible if alwaysVisible, more intense on hover
  const baseOpacity = alwaysVisible ? intensity * 0.6 : 0;
  const hoverOpacity = intensity;
  const currentOpacity = isHovered ? hoverOpacity : baseOpacity;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated gradient overlay - above background, below content */}
      <motion.div
        className="pointer-events-none fixed inset-0 transition-opacity duration-500"
        style={{
          opacity: currentOpacity,
          zIndex: 1,
          background: useTransform(
            [gradientX, gradientY],
            ([x, y]) =>
              `radial-gradient(${gradientSize}px circle at ${x} ${y}, ${normalizedColor}, transparent 50%)`
          ),
        }}
      />

      {/* Content - above gradient */}
      <div className="relative" style={{ zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}

// Variant for cards with border glow effect
interface MouseGradientCardProps {
  children?: ReactNode;
  className?: string;
  gradientColor?: string;
}

export function MouseGradientCard({
  children,
  className = "",
  gradientColor = "hsl(var(--primary))",
}: MouseGradientCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty("--mouse-x", `${x}px`);
      card.style.setProperty("--mouse-y", `${y}px`);
    };

    card.addEventListener("mousemove", handleMouseMove);
    return () => card.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative rounded-xl bg-card border border-border overflow-hidden ${className}`}
      style={
        {
          "--gradient-color": gradientColor,
        } as React.CSSProperties
      }
    >
      {/* Border glow effect */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), var(--gradient-color), transparent 40%)`,
          opacity: 0.08,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
