import { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Line } from '@react-three/drei';
import * as THREE from 'three';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MonthlyData {
  month: number;
  value: number;
}

interface YearlyChartData {
  year: number;
  data: MonthlyData[];
  total: number;
}

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

interface DataPointProps {
  position: [number, number, number];
  value: number;
  month: string;
  color: string;
  index: number;
  maxValue: number;
}

function DataPoint({ position, value, month, color, index, maxValue }: DataPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const height = Math.max((value / maxValue) * 2.5, 0.1);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.y = THREE.MathUtils.lerp(
        meshRef.current.scale.y,
        1,
        0.1
      );
      meshRef.current.position.y = height / 2 + Math.sin(state.clock.elapsedTime * 2 + index * 0.5) * 0.03;
    }
  });

  return (
    <group position={position}>
      {/* Bar */}
      <mesh ref={meshRef} position={[0, height / 2, 0]} scale={[1, 0, 1]}>
        <boxGeometry args={[0.4, height, 0.4]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
      
      {/* Glow sphere on top */}
      <Float speed={3} rotationIntensity={0} floatIntensity={0.5}>
        <mesh position={[0, height + 0.2, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>

      {/* Value label */}
      <Text
        position={[0, height + 0.6, 0]}
        fontSize={0.2}
        color="#333"
        anchorX="center"
        anchorY="middle"
      >
        {value > 0 ? (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString('fr-CH')) : '-'}
      </Text>

      {/* Month label */}
      <Text
        position={[0, -0.3, 0]}
        fontSize={0.18}
        color="#666"
        anchorX="center"
        anchorY="middle"
      >
        {month}
      </Text>
    </group>
  );
}

interface SceneProps {
  data: MonthlyData[];
  color: string;
  currentMonth: number;
}

function Scene({ data, color, currentMonth }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 1), [data]);
  
  // Create line points for trend
  const linePoints = useMemo(() => {
    return data.map((d, i) => {
      const x = (i - 5.5) * 0.85;
      const y = Math.max((d.value / maxValue) * 2.5, 0.1) + 0.3;
      return new THREE.Vector3(x, y, 0.3);
    });
  }, [data, maxValue]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.08;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <pointLight position={[-5, 5, 5]} intensity={0.4} color={color} />
      
      <group ref={groupRef} position={[0, -0.8, 0]}>
        {/* Data points */}
        {data.map((d, i) => (
          <DataPoint
            key={i}
            position={[(i - 5.5) * 0.85, 0, 0]}
            value={d.value}
            month={MONTHS[i]}
            color={i < currentMonth ? color : '#94a3b8'}
            index={i}
            maxValue={maxValue}
          />
        ))}

        {/* Trend line */}
        {linePoints.length > 1 && (
          <Line
            points={linePoints}
            color={color}
            lineWidth={2}
            transparent
            opacity={0.6}
          />
        )}

        {/* Floor grid */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
          <planeGeometry args={[12, 4]} />
          <meshStandardMaterial
            color="#f8fafc"
            transparent
            opacity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Current month indicator */}
        {currentMonth > 0 && currentMonth <= 12 && (
          <mesh position={[(currentMonth - 1 - 5.5) * 0.85, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.4, 32]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.5}
              transparent
              opacity={0.8}
            />
          </mesh>
        )}
      </group>
    </>
  );
}

interface Chart3DYearlyProps {
  yearlyData: YearlyChartData[];
  color?: string;
  title?: string;
  valueLabel?: string;
  className?: string;
}

export function Chart3DYearly({ 
  yearlyData, 
  color = '#3b82f6',
  title = 'Performance annuelle',
  valueLabel = 'CHF',
  className = '' 
}: Chart3DYearlyProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const availableYears = useMemo(() => 
    yearlyData.map(y => y.year).sort((a, b) => b - a),
    [yearlyData]
  );
  
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  
  const selectedData = useMemo(() => {
    const yearData = yearlyData.find(y => y.year === parseInt(selectedYear));
    if (!yearData) {
      return Array(12).fill(null).map((_, i) => ({ month: i + 1, value: 0 }));
    }
    // Fill missing months with 0
    return Array(12).fill(null).map((_, i) => {
      const monthData = yearData.data.find(d => d.month === i + 1);
      return { month: i + 1, value: monthData?.value || 0 };
    });
  }, [yearlyData, selectedYear]);
  
  const yearTotal = useMemo(() => {
    const yearData = yearlyData.find(y => y.year === parseInt(selectedYear));
    return yearData?.total || selectedData.reduce((sum, d) => sum + d.value, 0);
  }, [yearlyData, selectedYear, selectedData]);

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}k`;
    return val.toLocaleString('fr-CH');
  };

  const isCurrentYear = parseInt(selectedYear) === currentYear;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with year selector */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            Total {selectedYear}: <span className="font-bold text-foreground">{formatValue(yearTotal)} {valueLabel}</span>
          </p>
        </div>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
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

      {/* 3D Chart */}
      <div className="w-full h-[320px] rounded-xl bg-gradient-to-b from-slate-50 to-white">
        <Canvas
          camera={{ position: [0, 3, 8], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <Scene 
            data={selectedData} 
            color={color}
            currentMonth={isCurrentYear ? currentMonth : 13}
          />
        </Canvas>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-muted-foreground">Mois complétés</span>
        </div>
        {isCurrentYear && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400" />
            <span className="text-muted-foreground">Mois à venir</span>
          </div>
        )}
      </div>
    </div>
  );
}
