import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float } from '@react-three/drei';
import * as THREE from 'three';

interface DonutData {
  label: string;
  value: number;
  color: string;
}

interface DonutSegmentProps {
  startAngle: number;
  endAngle: number;
  color: string;
  innerRadius: number;
  outerRadius: number;
  depth: number;
  index: number;
}

function DonutSegment({ startAngle, endAngle, color, innerRadius, outerRadius, depth, index }: DonutSegmentProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const segments = 32;
    
    // Outer arc
    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      const x = Math.cos(angle) * outerRadius;
      const y = Math.sin(angle) * outerRadius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    
    // Inner arc (reversed)
    for (let i = segments; i >= 0; i--) {
      const angle = startAngle + (endAngle - startAngle) * (i / segments);
      const x = Math.cos(angle) * innerRadius;
      const y = Math.sin(angle) * innerRadius;
      shape.lineTo(x, y);
    }
    
    shape.closePath();
    
    const extrudeSettings = {
      steps: 1,
      depth: depth,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 3
    };
    
    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, [startAngle, endAngle, innerRadius, outerRadius, depth]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.z = -depth / 2 + Math.sin(state.clock.elapsedTime * 1.5 + index) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color={color}
        metalness={0.4}
        roughness={0.2}
        emissive={color}
        emissiveIntensity={0.15}
      />
    </mesh>
  );
}

interface SceneProps {
  data: DonutData[];
  centerValue: string;
  centerLabel: string;
}

function Scene({ data, centerValue, centerLabel }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);
  
  const segments = useMemo(() => {
    let currentAngle = -Math.PI / 2;
    return data.map((item, index) => {
      const angle = (item.value / total) * Math.PI * 2;
      const segment = {
        ...item,
        startAngle: currentAngle,
        endAngle: currentAngle + angle - 0.02, // Small gap
        index,
      };
      currentAngle += angle;
      return segment;
    });
  }, [data, total]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.2;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 5]} intensity={0.5} color="#3b82f6" />
      
      <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
        <group ref={groupRef}>
          {segments.map((segment, i) => (
            <DonutSegment
              key={segment.label}
              startAngle={segment.startAngle}
              endAngle={segment.endAngle}
              color={segment.color}
              innerRadius={1.2}
              outerRadius={2}
              depth={0.5}
              index={i}
            />
          ))}
          
          {/* Center text */}
          <Text
            position={[0, 0.15, 0.3]}
            fontSize={0.5}
            color="#1a1a2e"
            anchorX="center"
            anchorY="middle"
            font="/fonts/inter-bold.woff"
          >
            {centerValue}
          </Text>
          <Text
            position={[0, -0.25, 0.3]}
            fontSize={0.18}
            color="#666"
            anchorX="center"
            anchorY="middle"
          >
            {centerLabel}
          </Text>
        </group>
      </Float>
    </>
  );
}

interface Chart3DDonutProps {
  data: DonutData[];
  centerValue: string;
  centerLabel: string;
  className?: string;
}

export function Chart3DDonut({ data, centerValue, centerLabel, className = '' }: Chart3DDonutProps) {
  return (
    <div className={`w-full h-[280px] ${className}`}>
      <Canvas
        camera={{ position: [0, 2, 5], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene data={data} centerValue={centerValue} centerLabel={centerLabel} />
      </Canvas>
    </div>
  );
}
