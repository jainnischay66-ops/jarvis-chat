"use client";
import { memo } from "react";

export type CoreState = "idle" | "listening" | "thinking" | "speaking";
type Props = { size?: number; state?: CoreState; level?: number; label?: string; onClick?: () => void };

const C = 250;
const pt = (r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};
const arc = (r: number, a0: number, a1: number) => {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  return `M${x0} ${y0} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
const ticks = (n: number, r0: number, r1: number, major = 5) =>
  Array.from({ length: n }, (_, i) => {
    const deg = (360 / n) * i;
    const long = i % major === 0;
    const [x0, y0] = pt(r0, deg);
    const [x1, y1] = pt(long ? r1 + 6 : r1, deg);
    return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth={long ? 2 : 1} />;
  });

function JarvisCore({ size = 420, state = "idle", level = 0, label = "J.A.R.V.I.S.", onClick }: Props) {
  return (
    <svg
      className="jcore" data-state={state} viewBox="0 0 500 500" width={size} height={size}
      style={{ ["--lvl" as string]: level }} role="img" aria-label={`${label}, ${state}`}
      onClick={onClick}
    >
      <defs>
        <filter id="jglow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="glow1" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="glow2" />
          <feMerge>
            <feMergeNode in="glow2" />
            <feMergeNode in="glow1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#jglow)" fill="none" stroke="var(--cyan)">
        {/* Outermost mechanical bracket ring */}
        <g className="spin-slow">
          {[[310,356],[12,85],[105,175],[195,295]].map(([a,b]) => (
            <path key={a} d={arc(236,a,b)} strokeWidth="4.5" strokeLinecap="round" />
          ))}
          <circle cx="250" cy="250" r="243" strokeWidth="1" opacity=".35" />
          {/* Outer right-side gauge ticks (from ~65° to ~115°) */}
          {Array.from({ length: 18 }, (_, i) => {
            const deg = 66 + i * 2.8;
            const [x0, y0] = pt(238, deg);
            const [x1, y1] = pt(246, deg);
            return <line key={`rg-${i}`} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth="1.2" opacity=".85" />;
          })}
        </g>

        {/* Medium radial tick track */}
        <g className="spin-rev" opacity=".9">{ticks(120, 212, 222)}</g>

        {/* Wide glowing cyan arc band — predominantly top-to-right (315° to 135°) */}
        <g className="spin-med">
          <path d={arc(176, 315, 135)} strokeWidth="36" stroke="var(--cyan-band)" opacity=".42" />
          <path d={arc(176, 185, 275)} strokeWidth="16" stroke="var(--cyan-band)" opacity=".25" />
          <path d={arc(176, 315, 135)} strokeWidth="2" opacity=".95" />
          {/* Radial segment division markers on the wide band */}
          {[345, 15, 45, 75, 105].map(deg => {
            const [x0, y0] = pt(158, deg);
            const [x1, y1] = pt(194, deg);
            return <line key={`div-${deg}`} x1={x0} y1={y0} x2={x1} y2={y1} strokeWidth="1.5" opacity=".7" stroke="var(--cyan)" />;
          })}
        </g>

        {/* Fine inner tick track */}
        <g className="spin-rev-slow" opacity=".75">{ticks(180, 146, 152, 6)}</g>

        {/* Amber track: Amber arc bracket on left (220° to 285°) + 5 amber dots centered across the top */}
        <g className="amber-track">
          <path d={arc(158, 220, 285)} strokeWidth="4.5" stroke="var(--amber)" strokeLinecap="round" />
          <path d={arc(158, 290, 310)} strokeWidth="2" stroke="var(--amber)" opacity=".6" />
          {[336, 348, 0, 12, 24].map((d) => {
            const [x, y] = pt(158, d);
            return <circle key={d} className="amber-dot" cx={x} cy={y} r="3.2" fill="var(--amber)" stroke="none" />;
          })}
        </g>

        {/* Inner concentric ring arcs */}
        <g className="spin-slow">
          <path d={arc(124, 340, 160)} strokeWidth="5" strokeLinecap="round" />
          <path d={arc(124, 180, 320)} strokeWidth="5" strokeLinecap="round" />
          <circle cx="250" cy="250" r="116" strokeWidth="1" opacity=".5" />
        </g>

        {/* Radial voice waveform (active during listening / speaking) */}
        <g className="wave" opacity="0">
          {Array.from({ length: 56 }, (_, i) => {
            const deg = (360 / 56) * i;
            const [x0, y0] = pt(126, deg);
            const [x1, y1] = pt(142, deg);
            return (
              <line
                key={i}
                className="bar"
                style={{ animationDelay: `${(i % 14) * -90}ms` }}
                x1={x0}
                y1={y0}
                x2={x1}
                y2={y1}
                strokeWidth="2.5"
                strokeLinecap="round"
                stroke="var(--cyan)"
              />
            );
          })}
        </g>

        {/* Central core hub */}
        <circle cx="250" cy="250" r="106" fill="rgba(2,10,18,.82)" strokeWidth="1.8" opacity=".95" />
        <circle cx="250" cy="250" r="100" strokeWidth="0.8" opacity=".45" />
      </g>
      <text x="250" y="258" textAnchor="middle" className="jlabel">{label}</text>
    </svg>
  );
}
export default memo(JarvisCore);
