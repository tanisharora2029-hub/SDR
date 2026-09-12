import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface HolographicEnergyMeshProps {
  className?: string;
  intensity?: number;
}

export const HolographicEnergyMesh: React.FC<HolographicEnergyMeshProps> = ({
  className = "",
  intensity = 1.0
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance"
      });
    } catch (e) {
      console.warn("WebGL not supported, falling back to CSS glow", e);
      return;
    }

    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    // Group for mouse parallax
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // 1. Organic Fluid Energy Mesh (Torus Knot with deformation)
    const geometry = new THREE.TorusKnotGeometry(2.0, 0.65, 160, 32, 2, 3);
    const posAttribute = geometry.getAttribute("position");
    const originalPositions = posAttribute.array.slice() as Float32Array;

    const material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#7c3aed"),
      emissive: new THREE.Color("#4c1d95"),
      emissiveIntensity: 0.35 * intensity,
      roughness: 0.18,
      metalness: 0.3,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.35,
      ior: 1.6,
      transparent: true,
      opacity: 0.92,
      wireframe: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    mainGroup.add(mesh);

    // 2. Translucent Inner Core Glow (Icosahedron)
    const coreGeo = new THREE.IcosahedronGeometry(1.4, 3);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#a855f7"),
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    mainGroup.add(coreMesh);

    // 3. Floating Holographic Particles
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleScales = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const radius = 3.0 + Math.random() * 2.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
      particleScales[i] = Math.random() * 0.08 + 0.02;
    }

    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color("#c084fc"),
      size: 0.07,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    mainGroup.add(particles);

    // Lighting Setup matching reference cinematic violet/magenta/cyan
    const ambientLight = new THREE.AmbientLight(new THREE.Color("#1e1b4b"), 1.2);
    scene.add(ambientLight);

    const violetLight = new THREE.PointLight(new THREE.Color("#9333ea"), 3.5, 20);
    violetLight.position.set(4, 4, 4);
    scene.add(violetLight);

    const blueLight = new THREE.PointLight(new THREE.Color("#38bdf8"), 3.0, 20);
    blueLight.position.set(-4, -3, 3);
    scene.add(blueLight);

    const magentaLight = new THREE.PointLight(new THREE.Color("#ec4899"), 2.2, 20);
    magentaLight.position.set(0, 5, -4);
    scene.add(magentaLight);

    // Mouse / Touch Parallax Target
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.4;
      targetY = y * 0.4;
    };

    window.addEventListener("pointermove", handlePointerMove);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerp
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;
      mainGroup.rotation.y = elapsedTime * 0.18 + currentX;
      mainGroup.rotation.x = Math.sin(elapsedTime * 0.15) * 0.12 + currentY;
      mainGroup.rotation.z = Math.cos(elapsedTime * 0.12) * 0.08;

      // Inner core counter rotation
      coreMesh.rotation.y = -elapsedTime * 0.3;
      coreMesh.rotation.x = elapsedTime * 0.2;

      // Orbiting particles
      particles.rotation.y = elapsedTime * 0.08;
      particles.rotation.z = -elapsedTime * 0.05;

      // Procedural surface wave displacement
      const positions = posAttribute.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        const ox = originalPositions[i];
        const oy = originalPositions[i + 1];
        const oz = originalPositions[i + 2];

        const wave =
          Math.sin(ox * 2 + elapsedTime * 1.5) *
          Math.cos(oy * 2 + elapsedTime * 1.2) *
          0.12;

        positions[i] = ox + (ox / 2) * wave;
        positions[i + 1] = oy + (oy / 2) * wave;
        positions[i + 2] = oz + (oz / 2) * wave;
      }
      posAttribute.needsUpdate = true;
      geometry.computeVertexNormals();

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(container);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("pointermove", handlePointerMove);
      resizeObserver.disconnect();

      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }

      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
  }, [intensity]);

  return (
    <div
      ref={mountRef}
      className={`relative w-full h-full min-h-[360px] flex items-center justify-center overflow-hidden select-none ${className}`}
      style={{ touchAction: "none" }}
    >
      {/* Background ambient radial glow matching reference */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(147,51,234,0.3)_0%,rgba(99,102,241,0.15)_40%,transparent_70%)] blur-2xl -z-10" />
    </div>
  );
};
