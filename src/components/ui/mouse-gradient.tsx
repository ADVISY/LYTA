import { useRef, useEffect, useState, ReactNode } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

interface MouseGradientProps {
  children?: ReactNode;
  className?: string;
  gradientColor?: string;
  gradientSize?: number;
  intensity?: number;
}

export function MouseGradient({
  children,
  className = "",
  gradientColor = "hsl(var(--primary))",
  gradientSize = 600,
  intensity = 0.15,
}: MouseGradientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Spring physics for smooth movement
  const mouseX = useSpring(0, { stiffness: 150, damping: 20 });
  const mouseY = useSpring(0, { stiffness: 150, damping: 20 });

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
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated gradient overlay */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          opacity: isHovered ? intensity : 0,
          background: useTransform(
            [gradientX, gradientY],
            ([x, y]) =>
              `radial-gradient(${gradientSize}px circle at ${x} ${y}, ${gradientColor}, transparent 50%)`
          ),
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
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
