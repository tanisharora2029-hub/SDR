import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export type VoiceOrbState = "idle" | "listening" | "thinking" | "speaking";

interface VoiceOrbProps {
  state?: VoiceOrbState;
  audioLevel?: number; // 0 to 1
  size?: number;
  className?: string;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state = "idle",
  audioLevel = 0,
  size = 320,
  className = ""
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const audioLevelRef = useRef(audioLevel);

  useEffect(() => {
    stateRef.current = state;
    audioLevelRef.current = audioLevel;
  }, [state, audioLevel]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (e) {
      console.warn("WebGL not supported for VoiceOrb", e);
      return;
    }

    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 5;

    // Organic Sphere with Icosahedron
    const geometry = new THREE.IcosahedronGeometry(1.6, 32);
    const posAttribute = geometry.getAttribute("position");
    const originalPositions = posAttribute.array.slice() as Float32Array;

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#7c3aed"),
      emissive: new THREE.Color("#581c87"),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.1,
      transmission: 0.5,
      ior: 1.4,
      transparent: true,
      opacity: 0.88,
      wireframe: false
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Inner Core Wireframe
    const innerGeo = new THREE.IcosahedronGeometry(1.1, 3);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#38bdf8"),
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerSphere);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x9333ea, 3.5, 10);
    pointLight1.position.set(3, 3, 3);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x38bdf8, 3.0, 10);
    pointLight2.position.set(-3, -3, 3);
    scene.add(pointLight2);

    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const currentState = stateRef.current;
      const currentLevel = audioLevelRef.current;

      let speed = 0.5;
      let amp = 0.08;

      if (currentState === "thinking") {
        speed = 2.5;
        amp = 0.2;
        material.color.set("#a855f7");
        material.emissive.set("#7e22ce");
      } else if (currentState === "listening") {
        speed = 0.8;
        amp = 0.12 + currentLevel * 0.35;
        material.color.set("#38bdf8");
        material.emissive.set("#0284c7");
      } else if (currentState === "speaking") {
        speed = 1.8;
        amp = 0.18 + currentLevel * 0.45;
        material.color.set("#ec4899");
        material.emissive.set("#be185d");
      } else {
        // Idle
        speed = 0.4;
        amp = 0.06;
        material.color.set("#7c3aed");
        material.emissive.set("#4c1d95");
      }

      sphere.rotation.y = elapsedTime * speed * 0.3;
      sphere.rotation.x = elapsedTime * speed * 0.2;
      innerSphere.rotation.y = -elapsedTime * speed * 0.5;

      // Deform sphere surface based on state & audio level
      const positions = posAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const u = originalPositions[i];
        const v = originalPositions[i + 1];
        const w = originalPositions[i + 2];

        const dist = Math.sqrt(u * u + v * v + w * w);
        const wave =
          Math.sin(u * 3 + elapsedTime * speed * 3) *
          Math.cos(v * 3 + elapsedTime * speed * 2) *
          amp;

        const factor = 1 + wave;
        positions[i] = u * factor;
        positions[i + 1] = v * factor;
        positions[i + 2] = w * factor;
      }
      posAttribute.needsUpdate = true;
      geometry.computeVertexNormals();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      renderer.dispose();
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-full bg-violet-600/20 blur-3xl -z-10 animate-pulse-subtle" />
    </div>
  );
};
