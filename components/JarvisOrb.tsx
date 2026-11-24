"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { CoreState } from "./JarvisCore";

type Live = { think: number; assemble: number; pulse: number; level: number; spin: number; warm: number };
type V3 = [number, number, number];

const BG = "#02040A";
const CYAN = new THREE.Color("#5CCBF5");
const GOLD = new THREE.Color("#F2B84B");
const ease = (x: number) => 1 - Math.pow(1 - x, 3);

const TICK_RINGS: { radius: number; count: number; color: string; rot: V3; speed: number; gaps: [number, number][] }[] = [
  { radius: 2.0, count: 150, color: "#5CCBF5", rot: [1.15, 0.25, 0], speed: 0.14, gaps: [[0.4, 1.0], [3.6, 4.1]] },
  { radius: 2.5, count: 96, color: "#F2B84B", rot: [0.45, -0.8, 0], speed: -0.2, gaps: [[2.0, 2.8]] },
  { radius: 3.0, count: 200, color: "#5CCBF5", rot: [-0.8, 0.4, 0], speed: 0.07, gaps: [[5.0, 5.7]] },
];
const ARCS: { radius: number; thick: number; color: string; rot: V3; speed: number; segs: [number, number][] }[] = [
  { radius: 1.65, thick: 0.018, color: "#5CCBF5", rot: [0.3, 0.7, 0], speed: 0.4, segs: [[0, 1.6], [2.5, 1.0], [4.4, 1.4]] },
  { radius: 2.25, thick: 0.012, color: "#F2B84B", rot: [1.35, -0.2, 0], speed: -0.3, segs: [[0.5, 1.2], [3.3, 0.9]] },
  { radius: 3.1, thick: 0.01, color: "#5CCBF5", rot: [0.1, -0.5, 0], speed: 0.15, segs: [[1.0, 2.2], [4.2, 1.4]] },
];

function buildShell(n: number) {
  const pos = new Float32Array(n * 3), sc = new Float32Array(n * 3), seed = new Float32Array(n);
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    pos.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
    sc.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 16], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aScatter", new THREE.BufferAttribute(sc, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  return geo;
}

function buildDust(n: number) {
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 4 + Math.random() * 7, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.6, r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return geo;
}

const shellVert = /* glsl */ `
precision highp float;
uniform float uTime, uLevel, uThink, uAssemble, uPulse, uSpin, uPx;
attribute float aSeed; attribute vec3 aScatter;
varying float vGlow, vSeed;
float n3(vec3 p){ return sin(p.x*1.7+uTime*.6)*sin(p.y*1.9-uTime*.5)*sin(p.z*1.6+uTime*.4); }
void main(){
  vec3 dir = normalize(position);
  float n = n3(dir*2.0) + .5*n3(dir*4.1+3.);
  float r = 1.15*(1.+.025*sin(uTime*1.3));
  r += n*(.07+uThink*.22);
  r += uLevel*(.10+.08*sin(uTime*10.+aSeed*6.283+dir.y*5.));
  r += uPulse*.18*(.5+.5*sin(dir.y*7.-uTime*9.));
  float a = uSpin*(.3+aSeed);
  vec3 p = dir*r;
  p.xz = mat2(cos(a),-sin(a),sin(a),cos(a))*p.xz;
  p = mix(aScatter, p, uAssemble);
  vec4 mv = modelViewMatrix*vec4(p,1.);
  gl_Position = projectionMatrix*mv;
  gl_PointSize = (2.5+aSeed*3.5+uLevel*2.5)*uPx*(8.2/-mv.z);
  vGlow = clamp(.6+.4*n+uLevel*.6, .2, 1.5);
  vSeed = aSeed;
}`;
const shellFrag = /* glsl */ `
precision highp float;
uniform float uWarm; uniform vec3 uCyan, uGold;
varying float vGlow, vSeed;
void main(){
  float d = length(gl_PointCoord-.5); if(d>.5) discard;
  float soft = smoothstep(.5,.0,d);
  vec3 col = mix(uCyan, uGold, clamp(uWarm + step(.93,vSeed)*.5, 0., 1.));
  gl_FragColor = vec4(col*vGlow*1.5, soft*soft);
}`;
const glowVert = /* glsl */ `
precision highp float;
varying vec3 vN, vV;
void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
const glowFrag = /* glsl */ `
precision highp float;
uniform float uInt, uThink; uniform vec3 uCyan, uGold; varying vec3 vN, vV;
void main(){
  float f = pow(1.-abs(dot(normalize(vN),normalize(vV))), 2.);
  vec3 base = mix(uCyan, uGold, uThink*.7);
  gl_FragColor = vec4(mix(base, vec3(1.), .2)*(.3+f*1.2)*uInt, .5);
}`;

function TickRing({ radius, count, color, rot, speed, gaps, live }:
  { radius: number; count: number; color: string; rot: V3; speed: number; gaps: [number, number][]; live: React.MutableRefObject<Live> }) {
  const spin = useRef<THREE.Group>(null!);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const col = useMemo(() => new THREE.Color(color).multiplyScalar(1.8), [color]);
  useLayoutEffect(() => {
    const m = mesh.current, o = new THREE.Object3D();
    let k = 0;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      if (gaps.some(([s, e]) => a >= s && a <= e)) continue;
      const major = i % 5 === 0;
      o.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
      o.rotation.set(0, 0, a - Math.PI / 2);
      o.scale.set(major ? 1.6 : 1, major ? 2.2 : 1, 1);
      o.updateMatrix();
      m.setMatrixAt(k++, o.matrix);
    }
    m.count = k;
    m.instanceMatrix.needsUpdate = true;
  }, [count, radius, gaps]);
  useFrame((_, dt) => { spin.current.rotation.z += Math.min(dt, 0.05) * speed * (1 + live.current.think * 4); });
  return (
    <group rotation={rot}>
      <group ref={spin}>
        <instancedMesh ref={mesh} args={[undefined, undefined, count]} frustumCulled={false}>
          <boxGeometry args={[0.014, 0.07, 0.004]} />
          <meshBasicMaterial color={col} toneMapped={false} />
        </instancedMesh>
      </group>
    </group>
  );
}

function Arcs({ radius, thick, color, rot, speed, segs, live }:
  { radius: number; thick: number; color: string; rot: V3; speed: number; segs: [number, number][]; live: React.MutableRefObject<Live> }) {
  const spin = useRef<THREE.Group>(null!);
  const col = useMemo(() => new THREE.Color(color).multiplyScalar(1.8), [color]);
  useFrame((_, dt) => { spin.current.rotation.z += Math.min(dt, 0.05) * speed * (1 + live.current.think * 4); });
  return (
    <group rotation={rot}>
      <group ref={spin}>
        {segs.map(([start, len], i) => (
          <mesh key={i} rotation={[0, 0, start]}>
            <torusGeometry args={[radius, thick, 6, 96, len]} />
            <meshBasicMaterial color={col} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Scene({ state, level, onActivate }: { state: CoreState; level: number; onActivate?: () => void }) {
  const root = useRef<THREE.Group>(null!);
  const rings = useRef<THREE.Group>(null!);
  const grid = useRef<THREE.GridHelper>(null!);
  const glow = useRef<THREE.Mesh>(null!);
  const live = useRef<Live>({ think: 0, assemble: 0, pulse: 0, level: 0, spin: 0, warm: 1 });
  const mobile = typeof window !== "undefined" && window.innerWidth < 768;
  const shell = useMemo(() => buildShell(mobile ? 3500 : 9000), [mobile]);
  const dust = useMemo(() => buildDust(mobile ? 300 : 700), [mobile]);
  const wire = useMemo(() => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.2, 2)), []);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 }, uLevel: { value: 0 }, uThink: { value: 0 }, uAssemble: { value: 0 },
    uPulse: { value: 0 }, uSpin: { value: 0 }, uPx: { value: 1 }, uWarm: { value: 1 },
    uCyan: { value: CYAN }, uGold: { value: GOLD },
  }), []);
  const glowU = useMemo(() => ({ uInt: { value: 1 }, uThink: { value: 0 }, uCyan: { value: CYAN }, uGold: { value: GOLD } }), []);
  const gl = useThree((s) => s.gl);

  useEffect(() => () => { shell.dispose(); dust.dispose(); wire.dispose(); }, [shell, dust, wire]);
  useEffect(() => {
    const g = grid.current;
    const m = g.material as THREE.LineBasicMaterial;
    m.transparent = true; m.opacity = 0.35;
  }, []);
  useEffect(() => {
    const el = gl.domElement;
    const f = () => { live.current.pulse = 1; onActivate?.(); };
    el.addEventListener("pointerdown", f);
    return () => el.removeEventListener("pointerdown", f);
  }, [gl, onActivate]);

  useFrame((s, rawDt) => {
    const dt = Math.min(rawDt, 0.05), t = s.clock.elapsedTime, L = live.current;
    L.assemble = Math.min(1, L.assemble + dt / 2.4);
    L.think += ((state === "thinking" ? 1 : 0) - L.think) * Math.min(1, dt * 3);
    const target = state === "speaking" || state === "listening" ? level : 0;
    L.level += (target - L.level) * Math.min(1, dt * 10);
    L.pulse = Math.max(0, L.pulse - dt * 1.4);
    L.spin += dt * L.think * 1.4;
    L.warm += ((state === "listening" ? 0 : 1) - L.warm) * Math.min(1, dt * 3);

    uniforms.uTime.value = t; uniforms.uLevel.value = L.level; uniforms.uThink.value = L.think;
    uniforms.uAssemble.value = ease(L.assemble); uniforms.uPulse.value = L.pulse;
    uniforms.uSpin.value = L.spin; uniforms.uPx.value = s.viewport.dpr;
    uniforms.uWarm.value = L.warm;
    glowU.uThink.value = L.think;
    glowU.uInt.value = 0.8 + L.level * 1.2 + L.pulse * 0.8 + Math.sin(t * 1.4) * 0.1;

    root.current.rotation.y += dt * (0.08 + L.think * 0.5);
    rings.current.scale.setScalar(1 + L.level * 0.06 + L.pulse * 0.04);
    glow.current.scale.setScalar(1 + L.level * 0.5 + L.pulse * 0.3);
    grid.current.position.z = (t * 0.5) % 1;

    s.camera.position.x += (s.pointer.x * 0.9 - s.camera.position.x) * 0.04;
    s.camera.position.y += (0.6 + s.pointer.y * 0.4 - s.camera.position.y) * 0.04;
    s.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <fog attach="fog" args={[BG, 9, 24]} />
      <gridHelper ref={grid} args={[40, 40, "#1B4A63", "#1B4A63"]} position={[0, -2.9, 0]} />
      <points geometry={dust} frustumCulled={false}>
        <pointsMaterial size={0.03} sizeAttenuation transparent opacity={0.55} depthWrite={false}
          blending={THREE.AdditiveBlending} color="#7FD8FF" />
      </points>
      <group ref={rings}>
        {TICK_RINGS.map((r, i) => <TickRing key={`t${i}`} {...r} live={live} />)}
        {ARCS.map((a, i) => <Arcs key={`a${i}`} {...a} live={live} />)}
      </group>
      <group ref={root}>
        <lineSegments geometry={wire}>
          <lineBasicMaterial color="#F2B84B" transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineSegments>
        <points geometry={shell} frustumCulled={false}>
          <shaderMaterial vertexShader={shellVert} fragmentShader={shellFrag} uniforms={uniforms}
            transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      </group>
      <mesh ref={glow}>
        <sphereGeometry args={[0.22, 32, 32]} />
        <shaderMaterial vertexShader={glowVert} fragmentShader={glowFrag} uniforms={glowU}
          transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <EffectComposer multisampling={0}>
        <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export default function JarvisOrb({ state = "idle", level = 0, className, onActivate }:
  { state?: CoreState; level?: number; className?: string; onActivate?: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const f = () => setVisible(!document.hidden);
    f();
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);

  return (
    <div className={className} aria-label={`J.A.R.V.I.S., ${state}`}
      style={{ position: "relative", width: "100%", height: "100%", background: "transparent", overflow: "hidden" }}>
      <Canvas frameloop={visible ? "always" : "never"} dpr={[1, 1.5]}
        camera={{ position: [0, 0.6, 8.2], fov: 45 }}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}>
        <Scene state={state} level={level} onActivate={onActivate} />
      </Canvas>
    </div>
  );
}
