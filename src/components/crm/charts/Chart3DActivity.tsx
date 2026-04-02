import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, RoundedBox, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MetricData {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  values: number[]; // 12 months
}

interface YearData {
  year: number;
  metrics: MetricData[];
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface MetricBarProps {
  x: number;
  z: number;
  height: number;
  color: string;
  delay: number;
}

function MetricBar({ x, z, height, color, delay }: MetricBarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const targetHeight = Math.max(height, 0.05);

  useFrame((state) => {
    if (meshRef.current) {
      const currentScale = meshRef.current.scale.y;
      meshRef.current.scale.y = THREE.MathUtils.lerp(currentScale, 1, 0.05);
      meshRef.current.position.y = (targetHeight * meshRef.current.scale.y) / 2;
      
      // Subtle floating animation
      meshRef.current.position.y += Math.sin(state.clock.elapsedTime * 1.5 + delay) * 0.02;
    }
  });

  return (
    <RoundedBox
      ref={meshRef}
      args={[0.25, targetHeight, 0.25]}
      radius={0.03}
      smoothness={4}
      position={[x, 0, z]}
      scale={[1, 0.01, 1]}
    >
      <meshStandardMaterial
        color={color}
        metalness={0.4}
        roughness={0.2}
        emissive={color}
        emissiveIntensity={0.15}
      />
    </RoundedBox>
  );
}

interface SceneProps {
  data: YearData;
  selectedMetrics: string[];
  currentMonth: number;
  maxValue: number;
}

function Scene({ data, selectedMetrics, currentMonth, maxValue }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  const visibleMetrics = data.metrics.filter(m => selectedMetrics.includes(m.id));
  const metricCount = visibleMetrics.length;

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.12;
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.1) * 0.03 - 0.1;
    }
  });

  // Create line paths for each metric
  const linePaths = useMemo(() => {
    return visibleMetrics.map((metric, metricIndex) => {
      const zOffset = (metricIndex - (metricCount - 1) / 2) * 0.5;
      return metric.values.slice(0, currentMonth).map((val, monthIndex) => {
        const x = (monthIndex - 5.5) * 0.55;
        const y = (val / maxValue) * 3 + 0.1;
        return new THREE.Vector3(x, y, zOffset);
      });
    });
  }, [visibleMetrics, currentMonth, maxValue, metricCount]);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.7} castShadow />
      <pointLight position={[-8, 8, 8]} intensity={0.4} color="#3b82f6" />
      <pointLight position={[8, 5, -8]} intensity={0.3} color="#10b981" />
      
      <group ref={groupRef} position={[0, -1.2, 0]}>
        {/* Bars for each metric and month */}
        {visibleMetrics.map((metric, metricIndex) => {
          const zOffset = (metricIndex - (metricCount - 1) / 2) * 0.5;
          
          return metric.values.map((value, monthIndex) => {
            const x = (monthIndex - 5.5) * 0.55;
            const height = (value / maxValue) * 3;
            const isActive = monthIndex < currentMonth;
            
            return (
              <MetricBar
                key={`${metric.id}-${monthIndex}`}
                x={x}
                z={zOffset}
                height={isActive ? height : 0.05}
                color={isActive ? metric.color : '#cbd5e1'}
                delay={monthIndex + metricIndex * 2}
              />
            );
          });
        })}

        {/* Trend lines */}
        {linePaths.map((points, i) => (
          points.length > 1 && (
            <Line
              key={`line-${i}`}
              points={points}
              color={visibleMetrics[i].color}
              lineWidth={3}
              transparent
              opacity={0.7}
            />
          )
        ))}

        {/* Month labels */}
        {MONTHS.map((month, i) => (
          <Text
            key={month + i}
            position={[(i - 5.5) * 0.55, -0.3, metricCount * 0.3]}
            fontSize={0.15}
            color={i < currentMonth ? '#64748b' : '#cbd5e1'}
            anchorX="center"
            anchorY="middle"
          >
            {month}
          </Text>
        ))}

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
          <planeGeometry args={[8, 3]} />
          <meshStandardMaterial
            color="#f8fafc"
            transparent
            opacity={0.6}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>

        {/* Grid lines */}
        {[0.5, 1, 1.5, 2, 2.5, 3].map((y, i) => (
          <Line
            key={`grid-${i}`}
            points={[
              new THREE.Vector3(-3.5, y, -1),
              new THREE.Vector3(3.5, y, -1),
            ]}
            color="#e2e8f0"
            lineWidth={1}
            transparent
            opacity={0.4}
          />
        ))}
      </group>
    </>
  );
}

interface Chart3DActivityProps {
  yearlyData: YearData[];
  className?: string;
}

export function Chart3DActivity({ yearlyData, className = '' }: Chart3DActivityProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const availableYears = useMemo(() => 
    yearlyData.map(y => y.year).sort((a, b) => b - a),
    [yearlyData]
  );
  
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(() => {
    const firstYear = yearlyData.find(y => y.year === currentYear) || yearlyData[0];
    return firstYear?.metrics.map(m => m.id) || [];
  });

  const selectedData = useMemo(() => {
    return yearlyData.find(y => y.year === parseInt(selectedYear)) || yearlyData[0];
  }, [yearlyData, selectedYear]);

  const maxValue = useMemo(() => {
    if (!selectedData) return 1;
    const visibleMetrics = selectedData.metrics.filter(m => selectedMetrics.includes(m.id));
    const allValues = visibleMetrics.flatMap(m => m.values);
    return Math.max(...allValues, 1);
  }, [selectedData, selectedMetrics]);

  const isCurrentYear = parseInt(selectedYear) === currentYear;
  const displayMonth = isCurrentYear ? currentMonth : 12;

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  // Calculate totals for selected year
  const totals = useMemo(() => {
    if (!selectedData) return {};
    return selectedData.metrics.reduce((acc, m) => {
      const monthsToCount = isCurrentYear ? currentMonth : 12;
      acc[m.id] = m.values.slice(0, monthsToCount).reduce((sum, v) => sum + v, 0);
      return acc;
    }, {} as Record<string, number>);
  }, [selectedData, isCurrentYear, currentMonth]);

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toLocaleString('fr-CH');
  };

  if (!selectedData) return null;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Vue d'ensemble de l'activité</h2>
          <p className="text-muted-foreground">
            Performance {selectedYear} {isCurrentYear && `(${currentMonth} mois)`}
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>
                {year} {year === currentYear && '(actuel)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Metric toggles with totals */}
      <div className="flex flex-wrap gap-3">
        {selectedData.metrics.map(metric => {
          const isActive = selectedMetrics.includes(metric.id);
          return (
            <button
              key={metric.id}
              onClick={() => toggleMetric(metric.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-200",
                isActive 
                  ? "border-transparent shadow-lg" 
                  : "border-slate-200 bg-white/50 opacity-50 hover:opacity-75"
              )}
              style={{
                backgroundColor: isActive ? `${metric.color}15` : undefined,
                borderColor: isActive ? metric.color : undefined,
              }}
            >
              <div 
                className="w-4 h-4 rounded-full shadow-inner"
                style={{ backgroundColor: metric.color }}
              />
              <div className="text-left">
                <p className="text-sm font-medium">{metric.label}</p>
                <p className="text-lg font-bold" style={{ color: isActive ? metric.color : '#64748b' }}>
                  {formatValue(totals[metric.id] || 0)} CHF
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3D Chart */}
      <div className="w-full h-[450px] rounded-2xl bg-gradient-to-b from-slate-50 via-white to-slate-50 shadow-inner">
        <Canvas
          camera={{ position: [0, 4, 10], fov: 35 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene 
            data={selectedData}
            selectedMetrics={selectedMetrics}
            currentMonth={displayMonth}
            maxValue={maxValue}
          />
        </Canvas>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-8 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-1 rounded-full bg-gradient-to-r from-slate-300 to-slate-400" />
          <span className="text-muted-foreground">Mois complétés</span>
        </div>
        {isCurrentYear && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-1 rounded-full bg-slate-200" />
            <span className="text-muted-foreground">Mois à venir</span>
          </div>
        )}
      </div>
    </div>
  );
}
