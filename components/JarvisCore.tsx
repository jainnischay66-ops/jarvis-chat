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
        <filter id="jglow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g filter="url(#jglow)" fill="none" stroke="var(--cyan)">
        <g className="spin-slow">
          {[[6,98],[108,172],[184,262],[274,352]].map(([a,b]) => <path key={a} d={arc(236,a,b)} strokeWidth="4" strokeLinecap="round" />)}
          <circle cx="250" cy="250" r="243" strokeWidth="1" opacity=".35" />
        </g>
        <g className="spin-rev" opacity=".9">{ticks(120, 212, 222)}</g>
        <g className="spin-med">
          <path d={arc(176,196,344)} strokeWidth="38" stroke="var(--cyan-band)" opacity=".38" />
          <path d={arc(176,14,70)} strokeWidth="38" stroke="var(--cyan-band)" opacity=".22" />
          <path d={arc(176,196,344)} strokeWidth="2" opacity=".9" transform="translate(0 0)" />
        </g>
        <g className="spin-rev-slow" opacity=".7">{ticks(180, 146, 152, 6)}</g>
        <g className="amber-track">
          <path d={arc(158,205,252)} strokeWidth="4" stroke="var(--amber)" strokeLinecap="round" />
          {[300,312,324,336,348].map((d) => { const [x,y]=pt(158,d); return <circle key={d} className="amber-dot" cx={x} cy={y} r="3.2" fill="var(--amber)" stroke="none" />; })}
        </g>
        <g className="spin-slow">
          <path d={arc(124,10,170)} strokeWidth="5" strokeLinecap="round" />
          <path d={arc(124,190,350)} strokeWidth="5" strokeLinecap="round" />
        </g>
        <g className="wave" opacity="0">
          {Array.from({ length: 56 }, (_, i) => (
            <g key={i} transform={`rotate(${(360 / 56) * i} 250 250)`}>
              <line className="bar" style={{ animationDelay: `${(i % 14) * -90}ms` }} x1="250" y1="142" x2="250" y2="126" strokeWidth="2.5" strokeLinecap="round" stroke="var(--cyan)" />
            </g>
          ))}
        </g>
        <circle cx="250" cy="250" r="106" fill="rgba(2,10,18,.78)" strokeWidth="1.5" opacity=".9" />
      </g>
      <text x="250" y="258" textAnchor="middle" className="jlabel">{label}</text>
    </svg>
  );
}
export default memo(JarvisCore);
