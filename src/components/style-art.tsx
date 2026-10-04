// A picture for a style when the salon hasn't added a photo yet: a drawn
// pattern for its kind (braids, cornrows, twists…) in the salon's colours.
// No stock photos of real people.
import type { StyleCategory } from "@/lib/domain/types";

function Braid({ x, h }: { x: number; h: number }) {
  // A plait: alternating ovals down a line.
  const n = Math.floor(h / 9);
  return <g>{Array.from({ length: n }, (_, i) => <ellipse key={i} cx={x + (i % 2 ? 2.2 : -2.2)} cy={10 + i * 9} rx="4.2" ry="5.6" />)}</g>;
}

export function StyleArt({ category, className = "" }: { category: StyleCategory; className?: string }) {
  const W = 160, H = 110;
  let body: React.ReactNode;
  if (category === "cornrows") {
    body = [0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={`M${20 + i * 30} ${H} C ${10 + i * 30} 70, ${40 + i * 25} 35, ${80} 6`} fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray="5 3" strokeLinecap="round" />
    ));
  } else if (category === "twists" || category === "locs") {
    body = [0, 1, 2, 3, 4, 5].map((i) => (
      <path key={i} d={`M${16 + i * 26} 4 ${Array(6).fill("q 8 9 0 18").join(" ")}`} fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity={i % 2 ? 0.75 : 1} />
    ));
  } else if (category === "other") {
    body = [0, 1, 2].map((i) => <circle key={i} cx={50 + i * 30} cy={55 + (i % 2 ? -14 : 10)} r={12 - i * 2} fill="none" stroke="currentColor" strokeWidth="4" opacity={0.9 - i * 0.2} />);
  } else {
    const n = category === "kids" ? 4 : 7;
    body = <g fill="currentColor">{Array.from({ length: n }, (_, i) => <Braid key={i} x={18 + i * ((W - 36) / (n - 1))} h={H - 6} />)}</g>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`text-brand ${className}`} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width={W} height={H} fill="var(--brand-soft)" />
      <g opacity=".85">{body}</g>
    </svg>
  );
}
