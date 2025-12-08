import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text, Float, Sphere, Ring } from '@react-three/drei';
import * as THREE from 'three';

interface MetricRingProps {
  value: number;
  maxValue: number;
  color: string;
  radius: number;
  index: number;
}

function MetricRing({ value, maxValue, color, radius, index }: MetricRingProps) {
  const ringRef = useRef<THREE.Mesh>(null);
  const progress = Math.min(value / maxValue, 1);
  
  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.3 + index;
    }
  });

  return (
    <group>
      {/* Background ring */}
      <Ring args={[radius - 0.1, radius, 64]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#e5e7eb" transparent opacity={0.3} side={THREE.DoubleSide} />
      </Ring>
      
      {/* Progress ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[radius - 0.1, radius, 64, 1, 0, Math.PI * 2 * progress]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

interface GlowingSphereProps {
  position: [number, number, number];
  color: string;
  size: number;
}

function GlowingSphere({ position, color, size }: GlowingSphereProps) {
  const sphereRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (sphereRef.current) {
      sphereRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2) * 0.1);
    }
  });

  return (
    <Float speed={3} rotationIntensity={0.5} floatIntensity={1}>
      <Sphere ref={sphereRef} args={[size, 32, 32]} position={position}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.8}
          roughness={0.1}
        />
      </Sphere>
    </Float>
  );
}

interface SceneProps {
  value: string;
  label: string;
  progress: number;
  color: string;
}

function Scene({ value, label, progress, color }: SceneProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} />
      <pointLight position={[-3, 3, 3]} intensity={0.5} color={color} />
      
      <group ref={groupRef}>
        {/* Outer decorative ring */}
        <MetricRing value={100} maxValue={100} color="#e5e7eb" radius={2.2} index={0} />
        
        {/* Main progress ring */}
        <MetricRing value={progress} maxValue={100} color={color} radius={1.8} index={1} />
        
        {/* Inner ring */}
        <MetricRing value={progress * 0.8} maxValue={100} color={color} radius={1.4} index={2} />
        
        {/* Center content */}
        <Text
          position={[0, 0.2, 0.1]}
          fontSize={0.45}
          color="#1a1a2e"
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-bold.woff"
        >
          {value}
        </Text>
        <Text
          position={[0, -0.3, 0.1]}
          fontSize={0.18}
          color="#666"
          anchorX="center"
          anchorY="middle"
          maxWidth={2}
        >
          {label}
        </Text>
        
        {/* Decorative spheres */}
        <GlowingSphere position={[2.5, 1.5, -1]} color={color} size={0.15} />
        <GlowingSphere position={[-2.3, -1.2, -0.5]} color={color} size={0.1} />
        <GlowingSphere position={[1.8, -1.8, -1]} color={color} size={0.12} />
      </group>
    </>
  );
}

interface Chart3DMetricProps {
  value: string;
  label: string;
  progress: number;
  color: string;
  className?: string;
}

export function Chart3DMetric({ value, label, progress, color, className = '' }: Chart3DMetricProps) {
  return (
    <div className={`w-full h-[200px] ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <Scene value={value} label={label} progress={progress} color={color} />
      </Canvas>
    </div>
  );
}
