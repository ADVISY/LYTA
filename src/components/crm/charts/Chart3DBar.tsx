import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { RoundedBox, Text, Float, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface BarData {
  label: string;
  value: number;
  color: string;
}

interface Bar3DProps {
  data: BarData;
  index: number;
  maxValue: number;
  total: number;
}

function Bar3D({ data, index, maxValue, total }: Bar3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const height = (data.value / maxValue) * 3;
  const spacing = 1.8;
  const xPos = (index - (total - 1) / 2) * spacing;

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = height / 2 + Math.sin(state.clock.elapsedTime * 2 + index) * 0.05;
    }
  });

  return (
    <group position={[xPos, 0, 0]}>
      <Float speed={2} rotationIntensity={0.1} floatIntensity={0.3}>
        <RoundedBox
          ref={meshRef}
          args={[0.8, height, 0.8]}
          radius={0.1}
          smoothness={4}
          position={[0, height / 2, 0]}
        >
          <meshStandardMaterial
            color={data.color}
            metalness={0.3}
            roughness={0.2}
            emissive={data.color}
            emissiveIntensity={0.1}
          />
        </RoundedBox>
      </Float>
      
      {/* Value label on top */}
      <Text
        position={[0, height + 0.5, 0]}
        fontSize={0.3}
        color="#333"
        anchorX="center"
        anchorY="middle"
        font="/fonts/inter-bold.woff"
      >
        {data.value.toLocaleString('fr-CH')}
      </Text>
      
      {/* Label at bottom */}
      <Text
        position={[0, -0.4, 0]}
        fontSize={0.22}
        color="#666"
        anchorX="center"
        anchorY="middle"
        maxWidth={1.5}
      >
        {data.label}
      </Text>
    </group>
  );
}

function Scene({ data }: { data: BarData[] }) {
  const maxValue = useMemo(() => Math.max(...data.map(d => d.value)), [data]);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#8b5cf6" />
      
      <group ref={groupRef} position={[0, -0.5, 0]}>
        {data.map((item, index) => (
          <Bar3D
            key={item.label}
            data={item}
            index={index}
            maxValue={maxValue}
            total={data.length}
          />
        ))}
        
        {/* Glass floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
          <planeGeometry args={[12, 6]} />
          <meshStandardMaterial
            color="#f0f0f0"
            transparent
            opacity={0.3}
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>
      </group>
    </>
  );
}

interface Chart3DBarProps {
  data: BarData[];
  className?: string;
}

export function Chart3DBar({ data, className = '' }: Chart3DBarProps) {
  return (
    <div className={`w-full h-[300px] ${className}`}>
      <Canvas
        camera={{ position: [0, 3, 8], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene data={data} />
      </Canvas>
    </div>
  );
}
