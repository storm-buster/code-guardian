"use client";
import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 800;
const CONNECTION_DISTANCE = 8;
const MOUSE_INFLUENCE = 0.15;

function Particles() {
  const meshRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mousePos = useRef(new THREE.Vector2(0, 0));
  const { viewport } = useThree();

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 80;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    return arr;
  }, []);

  const velocities = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 0.015;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 0.015;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.008;
    }
    return arr;
  }, []);

  const colors = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    const cyan = new THREE.Color(0x00f5ff);
    const green = new THREE.Color(0x39ff14);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const c = Math.random() > 0.6 ? green : cyan;
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mousePos.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mousePos.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const linePositions = useMemo(() => new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 0.01 * 6), []);
  const lineColors = useMemo(() => new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 0.01 * 6), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    // Move particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] += velocities[i * 3];
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2];

      // Mouse parallax
      arr[i * 3] += mousePos.current.x * MOUSE_INFLUENCE * 0.02;
      arr[i * 3 + 1] += mousePos.current.y * MOUSE_INFLUENCE * 0.02;

      // Wrap around
      if (Math.abs(arr[i * 3]) > 42) velocities[i * 3] *= -1;
      if (Math.abs(arr[i * 3 + 1]) > 32) velocities[i * 3 + 1] *= -1;
      if (Math.abs(arr[i * 3 + 2]) > 16) velocities[i * 3 + 2] *= -1;
    }
    posAttr.needsUpdate = true;

    // Draw connection lines
    if (!linesRef.current) return;
    const lineGeo = linesRef.current.geometry;
    const lPosAttr = lineGeo.getAttribute("position") as THREE.BufferAttribute;
    const lColAttr = lineGeo.getAttribute("color") as THREE.BufferAttribute;
    const lPos = lPosAttr.array as Float32Array;
    const lCol = lColAttr.array as Float32Array;

    let lineIdx = 0;
    const maxLines = Math.floor(linePositions.length / 6);

    for (let i = 0; i < PARTICLE_COUNT && lineIdx < maxLines; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT && lineIdx < maxLines; j++) {
        const dx = arr[i * 3] - arr[j * 3];
        const dy = arr[i * 3 + 1] - arr[j * 3 + 1];
        const dz = arr[i * 3 + 2] - arr[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < CONNECTION_DISTANCE) {
          const alpha = 1 - dist / CONNECTION_DISTANCE;
          lPos[lineIdx * 6] = arr[i * 3];
          lPos[lineIdx * 6 + 1] = arr[i * 3 + 1];
          lPos[lineIdx * 6 + 2] = arr[i * 3 + 2];
          lPos[lineIdx * 6 + 3] = arr[j * 3];
          lPos[lineIdx * 6 + 4] = arr[j * 3 + 1];
          lPos[lineIdx * 6 + 5] = arr[j * 3 + 2];

          const brightness = alpha * 0.3;
          for (let k = 0; k < 6; k++) {
            lCol[lineIdx * 6 + k] = brightness;
          }
          lineIdx++;
        }
      }
    }

    // Zero out unused lines
    for (let i = lineIdx * 6; i < lPos.length; i++) {
      lPos[i] = 0;
      lCol[i] = 0;
    }

    lPosAttr.needsUpdate = true;
    lColAttr.needsUpdate = true;
    lineGeo.setDrawRange(0, lineIdx * 2);
  });

  const pointsGeoRef = useRef<THREE.BufferGeometry>(null);
  const linesGeoRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (pointsGeoRef.current) {
      pointsGeoRef.current.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      pointsGeoRef.current.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    }
    if (linesGeoRef.current) {
      linesGeoRef.current.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
      linesGeoRef.current.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    }
  }, [positions, colors, linePositions, lineColors]);

  return (
    <>
      <points ref={meshRef}>
        <bufferGeometry ref={pointsGeoRef} />
        <pointsMaterial size={0.18} vertexColors transparent opacity={0.25} sizeAttenuation depthWrite={false} />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry ref={linesGeoRef} />
        <lineBasicMaterial vertexColors transparent opacity={0.15} depthWrite={false} />
      </lineSegments>
    </>
  );
}

export default function ParticleBackground() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 50], fov: 60 }}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
        dpr={[1, 1.5]}
      >
        <Particles />
      </Canvas>
    </div>
  );
}
