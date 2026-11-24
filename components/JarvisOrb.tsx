"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import JarvisCore, { type CoreState } from "./JarvisCore";

const COUNT = typeof window !== "undefined" && window.innerWidth < 768 ? 3500 : 8000;
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

function isWebGLAvailable() {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function build(n: number) {
  const positions = new Float32Array(n * 3), scatter = new Float32Array(n * 3), seeds = new Float32Array(n);
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    positions.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
    scatter.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 14], i * 3);
    seeds[i] = Math.random();
  }
  return { positions, scatter, seeds };
}

const vert = /* glsl */ `
uniform float uTime, uLevel, uThink, uAssemble, uPulse;
attribute float aSeed; attribute vec3 aScatter;
varying float vGlow, vSeed;
float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
  vec3 dir = normalize(position);
  float n = noise(dir*2.2 + uTime*.25);
  float r = 1.6*(1.+.03*sin(uTime*1.2)) + n*(.22+uThink*.9)
          + uLevel*(.25+.2*sin(uTime*9.+aSeed*6.28))
          + uPulse*.4*(.5+.5*sin(dir.y*6.-uTime*8.));
  float a = uThink*uTime*1.5*(.3+aSeed);
  vec3 p = dir*r;
  p.xz = mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
  p = mix(aScatter, p, uAssemble);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = (2.2+aSeed*2.+uLevel*2.)*(180./-mv.z);
  vGlow = .5+n*.9; vSeed = aSeed;
}`;
const frag = /* glsl */ `
precision mediump float;
uniform float uThink; varying float vGlow, vSeed;
void main(){
  float d = length(gl_PointCoord-.5); if(d>.5) discard;
  vec3 cyan=vec3(.36,.85,1.), gold=vec3(1.,.74,.25), red=vec3(1.,.2,.2);
  vec3 col = vSeed>.92 ? gold : (vSeed>.87 ? red : cyan);
  col = mix(col, gold, uThink*.5*step(.5,vSeed));
  gl_FragColor = vec4(col*vGlow, smoothstep(.5,0.,d)*.9);
}`;

const RINGS = [
  { r: 2.35, w: 0.012, c: "#5CCBF5" },
  { r: 2.7, w: 0.016, c: "#F2B84B" },
  { r: 3.05, w: 0.009, c: "#5CCBF5" },
];

function Scene({
  state,
  level,
  onActivate,
  onPerformanceFail,
}: {
  state: CoreState;
  level: number;
  onActivate?: () => void;
  onPerformanceFail?: () => void;
}) {
  const rings = useRef<THREE.Group>(null!);
  const grid = useRef<THREE.GridHelper>(null!);
  const live = useRef({ think: 0, assemble: 0, pulse: 0, level: 0 });
  const frameTimes = useRef<number[]>([]);
  const { positions, scatter, seeds } = useMemo(() => build(COUNT), []);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uThink: { value: 0 },
      uAssemble: { value: 0 },
      uPulse: { value: 0 },
    }),
    []
  );
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const el = gl.domElement;
    const f = () => {
      live.current.pulse = 1;
      onActivate?.();
    };
    el.addEventListener("pointerdown", f);
    return () => el.removeEventListener("pointerdown", f);
  }, [gl, onActivate]);

  useFrame((s, dt) => {
    // Measure first 30 frames to check for low-end device performance
    if (frameTimes.current.length < 30) {
      frameTimes.current.push(dt * 1000);
      if (frameTimes.current.length === 30) {
        const avg = frameTimes.current.reduce((a, b) => a + b, 0) / 30;
        if (avg > 28) {
          onPerformanceFail?.();
          return;
        }
      }
    }

    const t = s.clock.elapsedTime,
      L = live.current;
    L.assemble = Math.min(1, L.assemble + dt / 2.2);
    L.think += ((state === "thinking" ? 1 : 0) - L.think) * Math.min(1, dt * 3);
    const target = state === "speaking" || state === "listening" ? level : 0;
    L.level += (target - L.level) * Math.min(1, dt * 10);
    L.pulse = Math.max(0, L.pulse - dt * 1.6);
    uniforms.uTime.value = t;
    uniforms.uLevel.value = L.level;
    uniforms.uThink.value = L.think;
    uniforms.uAssemble.value = ease(L.assemble);
    uniforms.uPulse.value = L.pulse;
    if (rings.current) {
      rings.current.rotation.y = t * 0.15 * (1 + L.think * 3);
      rings.current.rotation.x = Math.sin(t * 0.3) * 0.25;
    }
    if (grid.current) {
      grid.current.position.z = (t * 0.6) % 1;
    }
    s.camera.position.x += (s.pointer.x * 0.7 - s.camera.position.x) * 0.05;
    s.camera.position.y += (0.4 + s.pointer.y * 0.3 - s.camera.position.y) * 0.05;
    s.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <fog attach="fog" args={["#04060B", 8, 26]} />
      <gridHelper ref={grid} args={[60, 60, "#F2B84B", "#1B4A63"]} position={[0, -2.4, 0]} />
      <group ref={rings}>
        {RINGS.map((ring, i) => (
          <group key={i} rotation={[Math.PI / 2 + i * 0.18, 0, i * 0.9]}>
            {[0, 1, 2, 3].map((k) => (
              <mesh key={k} rotation={[0, 0, k * (Math.PI / 2) + i]}>
                <torusGeometry args={[ring.r, ring.w, 8, 128, Math.PI * 0.42]} />
                <meshBasicMaterial color={ring.c} toneMapped={false} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aScatter" args={[scatter, 3]} />
          <bufferAttribute attach="attributes-aSeed" args={[seeds, 1]} />
        </bufferGeometry>
        <shaderMaterial
          vertexShader={vert}
          fragmentShader={frag}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.1} luminanceThreshold={0.15} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export default function JarvisOrb({
  state = "idle",
  level = 0,
  className,
  onActivate,
}: {
  state?: CoreState;
  level?: number;
  className?: string;
  onActivate?: () => void;
}) {
  const [fallback, setFallback] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    // 1. WebGL availability check
    if (!isWebGLAvailable()) {
      setFallback(true);
      return;
    }

    // 2. Reduced motion preference
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setFallback(true);
      return;
    }

    // 3. Tab visibility pause listener
    const handleVisibility = () => {
      setTabHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  if (fallback) {
    return (
      <div
        className={className}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <JarvisCore size={460} state={state} level={level} onClick={onActivate} />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", height: "100%" }}
      aria-label={`J.A.R.V.I.S., ${state}`}
    >
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.4, 6], fov: 50 }}
        frameloop={tabHidden ? "never" : "always"}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
      >
        <Scene
          state={state}
          level={level}
          onActivate={onActivate}
          onPerformanceFail={() => setFallback(true)}
        />
      </Canvas>
    </div>
  );
}
