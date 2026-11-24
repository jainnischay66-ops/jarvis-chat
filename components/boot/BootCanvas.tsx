'use client'

import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, ChromaticAberration, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { interpolate, clamp } from '@/lib/boot/timeline'

const CYAN = new THREE.Color('#5CCBF5')
const GOLD = new THREE.Color('#F2B84B')
const EMBER = new THREE.Color('#E05A2B')

// Generate 9,000 converging particles
function buildConvergingParticles(count: number) {
  const targetPos = new Float32Array(count * 3)
  const originPos = new Float32Array(count * 3)
  const seeds = new Float32Array(count)

  const goldenRatio = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    // Target: sphere radius 1.2
    const y = 1 - (i / (count - 1)) * 2
    const r = Math.sqrt(1 - y * y) * 1.2
    const theta = goldenRatio * i
    targetPos[i * 3] = Math.cos(theta) * r
    targetPos[i * 3 + 1] = y * 1.2
    targetPos[i * 3 + 2] = Math.sin(theta) * r

    // Origin: wide outer dispersion (fly in from screen edges/depth)
    const angle = Math.random() * Math.PI * 2
    const dist = 12 + Math.random() * 24
    const zDist = (Math.random() - 0.5) * 18
    originPos[i * 3] = Math.cos(angle) * dist
    originPos[i * 3 + 1] = (Math.sin(angle) * dist) * 0.75
    originPos[i * 3 + 2] = zDist
    seeds[i] = Math.random()
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(targetPos, 3))
  geo.setAttribute('aOrigin', new THREE.BufferAttribute(originPos, 3))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return geo
}

// Generate speed lines for tunnel flight
function buildSpeedLines(count: number) {
  const pos = new Float32Array(count * 6)
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = 2.5 + Math.random() * 8
    const x = Math.cos(angle) * r
    const y = Math.sin(angle) * r
    const z1 = -15 + Math.random() * 25
    const z2 = z1 + 4 + Math.random() * 6

    pos[i * 6] = x
    pos[i * 6 + 1] = y
    pos[i * 6 + 2] = z1
    pos[i * 6 + 3] = x * 1.05
    pos[i * 6 + 4] = y * 1.05
    pos[i * 6 + 5] = z2
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return geo
}

const particleVert = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uBoot; // 0..1 convergence
uniform float uPx;
uniform float uBrightness;
attribute vec3 aOrigin;
attribute float aSeed;
varying float vAlpha;
varying vec3 vColor;
uniform vec3 uCyan;
uniform vec3 uGold;
uniform vec3 uEmber;

void main() {
  // Staggered convergence curve
  float localBoot = clamp((uBoot - aSeed * 0.25) / 0.75, 0.0, 1.0);
  float easeIn = pow(localBoot, 3.2);

  // Spiral swirl path while flying in
  float swirl = (1.0 - easeIn) * (3.0 + aSeed * 4.0);
  mat2 rot = mat2(cos(swirl), -sin(swirl), sin(swirl), cos(swirl));
  vec3 pOrig = aOrigin;
  pOrig.xy = rot * pOrig.xy;

  vec3 pos = mix(pOrig, position, easeIn);

  // Subtle breathing after impact (uBoot >= 1.0)
  if (uBoot >= 0.99) {
    float breath = sin(uTime * 3.0 + aSeed * 6.28) * 0.05;
    pos *= (1.0 + breath);
  }

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = (3.0 + aSeed * 3.5) * uPx * (9.0 / max(0.5, -mv.z));
  gl_PointSize = clamp(size, 1.0, 48.0);

  // Color gradient: Ember on entry -> Gold on impact -> Cyan filaments
  vec3 col = mix(uEmber, uGold, smoothstep(0.4, 0.85, easeIn));
  if (aSeed > 0.65) {
    col = mix(col, uCyan, smoothstep(0.7, 1.0, easeIn));
  }
  vColor = col;
  vAlpha = smoothstep(0.05, 0.3, uBoot) * (0.6 + 0.4 * aSeed) * uBrightness;
}
`

const particleFrag = /* glsl */ `
precision highp float;
uniform float uBrightness;
varying float vAlpha;
varying vec3 vColor;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * 1.6 * uBrightness, soft * soft * vAlpha);
}
`

// Smooth Glowing Emissive Core with natural radial bloom falloff (no hard disc edge)
const coreVert = /* glsl */ `
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

const coreFrag = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uBrightness;
uniform float uOpacity;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDir = normalize(vViewPosition);
  float NdotV = max(dot(viewDir, normal), 0.0);

  // Quadratic falloff from bright white-gold center smoothly fading to zero at edge
  float falloff = pow(NdotV, 2.2);
  vec3 coreColor = mix(uColor, vec3(1.0, 0.98, 0.92), falloff * 0.85);

  // Edges drop to 0.0 opacity smoothly so there is never an opaque hard circle
  float alpha = smoothstep(0.0, 0.6, NdotV) * falloff * uOpacity * uBrightness;
  gl_FragColor = vec4(coreColor * uBrightness * 1.6, alpha);
}
`

function TunnelRingMesh({ zPos, radius, color }: { zPos: number; radius: number; color: string }) {
  const meshRef = useRef<THREE.LineSegments>(null)

  const geo = useMemo(() => {
    const segments = 120
    const pos = new Float32Array(segments * 6)
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2
      const a2 = ((i + 0.7) / segments) * Math.PI * 2
      pos[i * 6] = Math.cos(a1) * radius
      pos[i * 6 + 1] = Math.sin(a1) * radius
      pos[i * 6 + 2] = 0
      pos[i * 6 + 3] = Math.cos(a2) * radius
      pos[i * 6 + 4] = Math.sin(a2) * radius
      pos[i * 6 + 5] = 0
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return g
  }, [radius])

  return (
    <lineSegments ref={meshRef} geometry={geo} position={[0, 0, zPos]}>
      <lineBasicMaterial color={color} transparent opacity={0.65} linewidth={1.5} />
    </lineSegments>
  )
}

// Spring function for smooth receding with subtle overshoot settling in <400ms
function springRecede(p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return 1
  return 1 - Math.pow(2, -8 * p) * Math.cos(p * Math.PI * 1.5)
}

function BootScene({
  timeRef,
  isQuick,
  dpr,
}: {
  timeRef: React.MutableRefObject<number>
  isQuick: boolean
  dpr: number
}) {
  const { camera } = useThree()
  const orbGroupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<THREE.Points>(null)
  const speedLinesRef = useRef<THREE.LineSegments>(null)
  const coreMeshRef = useRef<THREE.Mesh>(null)
  const tunnelGroupRef = useRef<THREE.Group>(null)

  const particleGeo = useMemo(() => buildConvergingParticles(9000), [])
  const speedLinesGeo = useMemo(() => buildSpeedLines(160), [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBoot: { value: 0 },
      uPx: { value: Math.min(dpr, 1.5) },
      uBrightness: { value: 1.0 },
      uCyan: { value: CYAN },
      uGold: { value: GOLD },
      uEmber: { value: EMBER },
    }),
    [dpr]
  )

  const coreUniforms = useMemo(
    () => ({
      uColor: { value: GOLD },
      uBrightness: { value: 1.0 },
      uOpacity: { value: 0.0 },
    }),
    []
  )

  useFrame((_, delta) => {
    const t = timeRef.current
    uniforms.uTime.value += delta
    const impactTime = isQuick ? 1.20 : 19.00
    const recedeStartTime = isQuick ? 1.60 : 21.00

    // 1. Particle convergence
    let bootProgress = 0
    if (isQuick) {
      bootProgress = interpolate(t, 0.2, 1.2, 0.0, 1.0)
    } else {
      if (t < 2.4) {
        bootProgress = 0.0
      } else if (t < 8.5) {
        bootProgress = interpolate(t, 2.4, 8.5, 0.0, 0.35)
      } else if (t < 9.7) {
        bootProgress = 0.35 + Math.sin((t - 8.5) * Math.PI) * 0.02
      } else if (t < 19.0) {
        bootProgress = interpolate(t, 9.9, 19.0, 0.35, 1.0)
      } else {
        bootProgress = 1.0
      }
    }
    uniforms.uBoot.value = bootProgress

    // 2. Camera Dolly & Tunnel Drive
    if (t < impactTime) {
      const camZ = isQuick
        ? interpolate(t, 0.0, 1.2, 12, 5.2)
        : interpolate(t, 0.0, 19.0, 14, 5.2)
      camera.position.set(0, 0, camZ)
      camera.lookAt(0, 0, 0)

      // Speed lines during flight
      if (speedLinesRef.current) {
        speedLinesRef.current.visible = true
        const isBreath = !isQuick && t >= 8.5 && t <= 9.7
        const speedMultiplier = isBreath ? 0.3 : (!isQuick && t >= 9.9 ? interpolate(t, 9.9, 18.8, 1.0, 3.5) : 1.0)
        speedLinesRef.current.position.z = (t * 22 * speedMultiplier) % 15
        const mat = speedLinesRef.current.material as THREE.LineBasicMaterial
        mat.opacity = isBreath ? 0.15 : interpolate(t, 2.4, 18.8, 0.1, 0.85)
      }

      if (tunnelGroupRef.current) {
        tunnelGroupRef.current.visible = true
        tunnelGroupRef.current.rotation.z = t * 0.35
      }
    } else {
      // ── Rule 6: Speed lines & tunnel rings fade out completely within 600ms after impact ──
      const fadeTime = t - impactTime
      if (speedLinesRef.current) {
        if (fadeTime < 0.60) {
          const fadeOpacity = interpolate(fadeTime, 0.0, 0.60, 0.85, 0.0)
          const mat = speedLinesRef.current.material as THREE.LineBasicMaterial
          mat.opacity = fadeOpacity
          speedLinesRef.current.position.z += delta * 6.0
        } else {
          speedLinesRef.current.visible = false
        }
      }

      if (tunnelGroupRef.current) {
        if (fadeTime < 0.60) {
          const ringFade = 1.0 - fadeTime / 0.60
          tunnelGroupRef.current.children.forEach(child => {
            const line = child as THREE.LineSegments
            if (line.material) {
              ;(line.material as THREE.LineBasicMaterial).opacity = 0.65 * ringFade
            }
          })
          tunnelGroupRef.current.rotation.z += delta * 0.2
        } else {
          tunnelGroupRef.current.visible = false
        }
      }

      // Micro-shake on impact
      let shakeX = 0
      let shakeY = 0
      if (t >= impactTime && t <= impactTime + 0.30) {
        const shakeDecay = 1.0 - (t - impactTime) / 0.30
        shakeX = Math.sin(t * 80) * 0.08 * shakeDecay
        shakeY = Math.cos(t * 95) * 0.08 * shakeDecay
      }

      // Docking & letterbox retract
      const dockT = isQuick
        ? interpolate(t, 1.8, 2.4, 0, 1)
        : interpolate(t, 22.5, 23.5, 0, 1)
      const targetCamZ = THREE.MathUtils.lerp(5.2, 7.8, dockT)

      camera.position.set(shakeX, shakeY, targetCamZ)
      camera.lookAt(0, 0, 0)
    }

    // ── Rule 1: Orb recedes at title-card cue (scales to 45%, dims to 55%, center moves to 34% viewport height) ──
    if (orbGroupRef.current) {
      if (t >= recedeStartTime) {
        const rawProgress = clamp((t - recedeStartTime) / 0.60, 0, 1)
        const springT = springRecede(rawProgress)

        // Scale: 1.0 -> 0.45
        const targetScale = THREE.MathUtils.lerp(1.0, 0.45, Math.min(1.0, springT))
        orbGroupRef.current.scale.setScalar(targetScale)

        // Center moves up to ~34% of viewport height: y = +1.02 in world space
        const targetY = THREE.MathUtils.lerp(0.0, 1.02, springT)
        orbGroupRef.current.position.y = targetY

        // Dim brightness: 1.0 -> 0.55
        const targetBrightness = THREE.MathUtils.lerp(1.0, 0.55, Math.min(1.0, springT))
        uniforms.uBrightness.value = targetBrightness
        coreUniforms.uBrightness.value = targetBrightness
      } else {
        orbGroupRef.current.scale.setScalar(1.0)
        orbGroupRef.current.position.y = 0.0
        uniforms.uBrightness.value = 1.0
        coreUniforms.uBrightness.value = 1.0
      }

      // Gentle rotation of the whole particle assembly
      orbGroupRef.current.rotation.y += delta * 0.35
    }

    // ── Rule 5: Emissive soft core (smooth bloom falloff, NO hard disc) ──
    if (coreMeshRef.current) {
      if (t >= impactTime) {
        const appearProgress = clamp((t - impactTime) / 0.15, 0, 1)
        coreMeshRef.current.scale.setScalar(0.85 * appearProgress)
        coreUniforms.uOpacity.value = 0.75 * appearProgress
        coreMeshRef.current.rotation.y -= delta * 0.8
      } else {
        coreMeshRef.current.scale.setScalar(0.001)
        coreUniforms.uOpacity.value = 0.0
      }
    }
  })

  return (
    <>
      <ambientLight intensity={0.25} />

      {/* Speed lines in tunnel */}
      <lineSegments ref={speedLinesRef} geometry={speedLinesGeo}>
        <lineBasicMaterial color="#5CCBF5" transparent opacity={0} linewidth={1} />
      </lineSegments>

      {/* Concentric Tunnel Rings flying past */}
      <group ref={tunnelGroupRef}>
        <TunnelRingMesh zPos={8} radius={4.2} color="#5CCBF5" />
        <TunnelRingMesh zPos={4} radius={3.6} color="#F2B84B" />
        <TunnelRingMesh zPos={0} radius={2.8} color="#5CCBF5" />
        <TunnelRingMesh zPos={-4} radius={2.2} color="#F2B84B" />
        <TunnelRingMesh zPos={-8} radius={1.8} color="#5CCBF5" />
      </group>

      {/* Unified Orb Group (Particles + Radiant Core) for smooth shared-layout transition */}
      <group ref={orbGroupRef}>
        {/* 9,000 Converging Particles with Cyan Filaments */}
        <points ref={particlesRef} geometry={particleGeo}>
          <shaderMaterial
            vertexShader={particleVert}
            fragmentShader={particleFrag}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* Emissive Soft Core with natural radial falloff and bloom (no hard disc) */}
        <mesh ref={coreMeshRef} scale={0.001}>
          <sphereGeometry args={[1.0, 32, 32]} />
          <shaderMaterial
            vertexShader={coreVert}
            fragmentShader={coreFrag}
            uniforms={coreUniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>
    </>
  )
}

function PostprocessingEffects({ timeRef, isQuick }: { timeRef: React.MutableRefObject<number>; isQuick: boolean }) {
  const bloomRef = useRef<any>(null)
  const chromRef = useRef<any>(null)

  useFrame(() => {
    const t = timeRef.current
    const impactTime = isQuick ? 1.20 : 19.00

    let bloomIntensity = 1.2
    let chromOffset = 0.0012

    if (t >= impactTime && t <= impactTime + 0.20) {
      const spike = 1.0 - (t - impactTime) / 0.20
      bloomIntensity = 1.2 + spike * 4.2
      chromOffset = 0.0012 + spike * 0.0095
    }

    if (bloomRef.current) {
      bloomRef.current.intensity = bloomIntensity
    }
    if (chromRef.current) {
      chromRef.current.offset = new THREE.Vector2(chromOffset, chromOffset)
    }
  })

  return (
    <EffectComposer multisampling={0}>
      <Bloom ref={bloomRef} luminanceThreshold={0.2} luminanceSmoothing={0.8} intensity={1.2} />
      <ChromaticAberration
        ref={chromRef}
        offset={new THREE.Vector2(0.0012, 0.0012)}
        radialModulation={true}
        modulationOffset={0.5}
      />
      <Noise opacity={0.04} />
    </EffectComposer>
  )
}

export function BootCanvas({
  timeRef,
  isQuick = false,
}: {
  timeRef: React.MutableRefObject<number>
  isQuick?: boolean
}) {
  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden">
      <Canvas
        camera={{ position: [0, 0, 14], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance', alpha: true }}
      >
        <BootScene timeRef={timeRef} isQuick={isQuick} dpr={1.5} />
        <PostprocessingEffects timeRef={timeRef} isQuick={isQuick} />
      </Canvas>
    </div>
  )
}
