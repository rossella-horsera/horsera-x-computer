import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronDown, CheckCircle2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroRider from "@/assets/hero-rider.jpg";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeviationData {
  axis: "left-right" | "forward-back";
  value: number; // negative = left/back, positive = right/forward
  idealRange: number; // ± degrees
}

interface PositionComponent {
  name: string;
  shortName: string;
  value: number;
  improvement: number;
  bodyArea: "head" | "upper" | "hip" | "leg" | "hand";
  deviation: DeviationData;
  breakdown: { ideal: number; acceptable: number; outOfRange: number; streak: number; variance: number };
  microInsight: string;
  onSaddle: { title: string; desc: string }[];
  offSaddle: { title: string; desc: string }[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const overallScore = 81;
const overallImprovement = 13;
const aiSummary = "Left hip bias and slight forward shoulder lean detected.";

const trendData = [
  { month: "Jan", value: 58 },
  { month: "Feb", value: 64 },
  { month: "Mar", value: 73 },
  { month: "Apr", value: 81 },
];

const positionComponents: PositionComponent[] = [
  {
    name: "Head Alignment", shortName: "Head", value: 74, improvement: 16, bodyArea: "head",
    deviation: { axis: "forward-back", value: 4, idealRange: 2 },
    breakdown: { ideal: 74, acceptable: 18, outOfRange: 8, streak: 22.1, variance: 3.8 },
    microInsight: "Improved head stability correlates with better rein contact consistency in 78% of analyzed sessions.",
    onSaddle: [
      { title: "Focus Point Drill (3 × 1 min)", desc: "Fix gaze on a distant point through transitions." },
      { title: "Head Turn Exercise", desc: "Slowly turn head left and right at walk without losing balance." },
      { title: "Chin Tuck at Trot", desc: "Maintain neutral head position through sitting trot." },
    ],
    offSaddle: [
      { title: "Neck Stability Holds (3 × 20 sec)", desc: "Isometric neck strengthening in all directions." },
      { title: "Balance Board Head Tracking", desc: "Track objects while maintaining balance." },
      { title: "Wall Angel Exercise (3 × 10)", desc: "Improve upper back and neck posture." },
    ],
  },
  {
    name: "Upper Body", shortName: "Upper", value: 84, improvement: 11, bodyArea: "upper",
    deviation: { axis: "forward-back", value: 3, idealRange: 3 },
    breakdown: { ideal: 84, acceptable: 12, outOfRange: 4, streak: 31.2, variance: 2.1 },
    microInsight: "Your upper body control has been within the top 20% for 3 consecutive rides.",
    onSaddle: [
      { title: "Arms-Only Posting (2 min)", desc: "Post while keeping arms still and independent." },
      { title: "Shoulder Roll Reset", desc: "Roll shoulders back every 2 minutes to reset posture." },
      { title: "One-Handed Riding (1 min each)", desc: "Ride with one hand on thigh to test core independence." },
    ],
    offSaddle: [
      { title: "Thoracic Rotation (3 × 8 each)", desc: "Improve rotational mobility of upper spine." },
      { title: "Resistance Band Rows (3 × 12)", desc: "Strengthen mid-back for upright posture." },
      { title: "Dead Bug (3 × 10)", desc: "Core stability with arm-leg coordination." },
    ],
  },
  {
    name: "Hip Stability", shortName: "Hips", value: 76, improvement: 9, bodyArea: "hip",
    deviation: { axis: "left-right", value: -6, idealRange: 2 },
    breakdown: { ideal: 62, acceptable: 28, outOfRange: 10, streak: 18.4, variance: 4.2 },
    microInsight: "Consistent hip symmetry training typically improves overall stability by 8–12% within 4–6 rides.",
    onSaddle: [
      { title: "Two-Point Hold (3 × 30 sec)", desc: "Maintain even weight in both stirrups without collapsing one hip." },
      { title: "No-Stirrups Sitting Trot (2 min)", desc: "Focus on equal seat bone pressure." },
      { title: "Halt Symmetry Check", desc: "Pause and test even weight before transitions." },
    ],
    offSaddle: [
      { title: "Single-Leg Romanian Deadlift (3 × 8)", desc: "Build unilateral hip control." },
      { title: "Side Plank (3 × 30–45 sec)", desc: "Improve lateral core stability." },
      { title: "Glute Bridge Hold (3 × 30 sec)", desc: "Activate posterior chain evenly." },
    ],
  },
  {
    name: "Lower Leg Stability", shortName: "Leg", value: 85, improvement: 16, bodyArea: "leg",
    deviation: { axis: "forward-back", value: -2, idealRange: 3 },
    breakdown: { ideal: 85, acceptable: 11, outOfRange: 4, streak: 28.7, variance: 2.4 },
    microInsight: "Your lower leg position has shown the most consistent improvement trend over the last month.",
    onSaddle: [
      { title: "Heel Drop Hold (3 × 30 sec)", desc: "Maintain deep heel with relaxed ankle at each gait." },
      { title: "Leg Yield Focus", desc: "Use leg yields to test independent leg control." },
      { title: "No-Stirrups Canter (1 min)", desc: "Build leg security without stirrup dependency." },
    ],
    offSaddle: [
      { title: "Calf Raises (3 × 15)", desc: "Strengthen ankle stability and heel position." },
      { title: "Single-Leg Balance (3 × 30 sec)", desc: "Build proprioception for leg stability." },
      { title: "Wall Sit (3 × 45 sec)", desc: "Simulate riding position with stable lower leg." },
    ],
  },
  {
    name: "Hand Stability", shortName: "Hands", value: 71, improvement: 8, bodyArea: "hand",
    deviation: { axis: "left-right", value: 3, idealRange: 2 },
    breakdown: { ideal: 71, acceptable: 20, outOfRange: 9, streak: 15.6, variance: 5.1 },
    microInsight: "Hand independence from seat motion is the primary factor. Focus on core strength to free up your arms.",
    onSaddle: [
      { title: "Cup of Tea Drill (2 min)", desc: "Imagine holding a cup — maintain level, quiet hands." },
      { title: "Neck Strap Hold", desc: "Use a neck strap to feel correct hand position at canter." },
      { title: "Independent Rein Exercise", desc: "Alternate rein length adjustments without body shift." },
    ],
    offSaddle: [
      { title: "Arm Circle Isolation (3 × 10)", desc: "Circle arms while keeping torso still on balance board." },
      { title: "Resistance Band Punch (3 × 12)", desc: "Extend arms against resistance with stable core." },
      { title: "Plank Shoulder Taps (3 × 10)", desc: "Build core-arm independence." },
    ],
  },
];

// ─── Colors ──────────────────────────────────────────────────────────────────

const GREEN = "#2E8B57";
const YELLOW = "#D4A017";
const CHARCOAL = "#1F2933";
const SECONDARY_TEXT = "#6B7280";
const BG = "#F7F8FA";
const GRAY_ZONE = "#9CA3AF";

// ─── Utility ─────────────────────────────────────────────────────────────────

const deviationColor = (val: number, idealRange: number) => {
  const abs = Math.abs(val);
  if (abs <= idealRange) return GREEN;
  if (abs <= idealRange * 2) return YELLOW;
  return GRAY_ZONE;
};

const deviationLabel = (dev: DeviationData) => {
  const abs = Math.abs(dev.value);
  if (dev.axis === "left-right") {
    return `${abs}° ${dev.value < 0 ? "left" : "right"} bias`;
  }
  return `${abs}° ${dev.value > 0 ? "forward" : "back"} lean`;
};

// ─── Arc Gauge ───────────────────────────────────────────────────────────────

const ArcGauge = ({ value, size = 72, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) => {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = 135;
  const endAngle = 405;
  const range = endAngle - startAngle;
  const valAngle = startAngle + (value / 100) * range;
  const polarToCart = (angle: number) => ({
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  });
  const arcPath = (from: number, to: number) => {
    const s = polarToCart(from);
    const e = polarToCart(to);
    const largeArc = to - from > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };
  const uid = `ag-${size}-${value}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <path d={arcPath(startAngle, endAngle)} fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth} strokeLinecap="round" />
      <defs>
        <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={YELLOW} />
          <stop offset="100%" stopColor={GREEN} />
        </linearGradient>
      </defs>
      <path d={arcPath(startAngle, valAngle)} fill="none" stroke={`url(#${uid})`} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
};

// ─── Biomechanical Wireframe Silhouette ──────────────────────────────────────

const BioSilhouette = ({ components }: { components: PositionComponent[] }) => {
  const getComp = (area: PositionComponent["bodyArea"]) => components.find((c) => c.bodyArea === area)!;
  const zc = (area: PositionComponent["bodyArea"]) => deviationColor(getComp(area).deviation.value, getComp(area).deviation.idealRange);

  // Joint positions (front-facing stick figure)
  const joints = {
    head:     { x: 60, y: 18 },
    neck:     { x: 60, y: 32 },
    lShoulder:{ x: 38, y: 42 },
    rShoulder:{ x: 82, y: 42 },
    chest:    { x: 60, y: 56 },
    hip:      { x: 60, y: 80 },
    lHip:     { x: 48, y: 82 },
    rHip:     { x: 72, y: 82 },
    lKnee:    { x: 44, y: 118 },
    rKnee:    { x: 76, y: 118 },
    lAnkle:   { x: 42, y: 155 },
    rAnkle:   { x: 78, y: 155 },
    lHand:    { x: 28, y: 68 },
    rHand:    { x: 92, y: 68 },
    lElbow:   { x: 32, y: 56 },
    rElbow:   { x: 88, y: 56 },
  };

  const boneLine = (from: keyof typeof joints, to: keyof typeof joints, color: string = "#D1D5DB") => (
    <line
      x1={joints[from].x} y1={joints[from].y}
      x2={joints[to].x} y2={joints[to].y}
      stroke={color} strokeWidth="1.5" strokeLinecap="round"
    />
  );

  const jointCircle = (name: keyof typeof joints, area: PositionComponent["bodyArea"], r: number = 3.5) => (
    <circle cx={joints[name].x} cy={joints[name].y} r={r} fill={zc(area)} opacity="0.9" />
  );

  // Deviation arc indicator near a joint
  const deviationArc = (jx: number, jy: number, area: PositionComponent["bodyArea"], offsetAngle: number = 0) => {
    const comp = getComp(area);
    const color = zc(area);
    const abs = Math.abs(comp.deviation.value);
    const arcR = 10;
    const startA = offsetAngle - 15;
    const endA = offsetAngle + 15;
    const toRad = (a: number) => (a * Math.PI) / 180;
    const sx = jx + arcR * Math.cos(toRad(startA));
    const sy = jy + arcR * Math.sin(toRad(startA));
    const ex = jx + arcR * Math.cos(toRad(endA));
    const ey = jy + arcR * Math.sin(toRad(endA));
    return (
      <g>
        <path
          d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 0 1 ${ex} ${ey}`}
          fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.7"
        />
        <text x={jx + 14 * Math.cos(toRad(offsetAngle))} y={jy + 14 * Math.sin(toRad(offsetAngle))}
          fontSize="7" fontWeight="600" fill={color} textAnchor="middle" dominantBaseline="middle">
          {abs}°
        </text>
      </g>
    );
  };

  return (
    <svg width="120" height="175" viewBox="0 0 120 175">
      {/* Ideal axis */}
      <line x1="60" y1="4" x2="60" y2="170" stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3 3" />

      {/* Bones */}
      {boneLine("head", "neck")}
      {boneLine("neck", "lShoulder")}
      {boneLine("neck", "rShoulder")}
      {boneLine("neck", "chest")}
      {boneLine("chest", "hip")}
      {boneLine("lShoulder", "lElbow", zc("hand"))}
      {boneLine("lElbow", "lHand", zc("hand"))}
      {boneLine("rShoulder", "rElbow", zc("hand"))}
      {boneLine("rElbow", "rHand", zc("hand"))}
      {boneLine("hip", "lHip")}
      {boneLine("hip", "rHip")}
      {boneLine("lHip", "lKnee", zc("leg"))}
      {boneLine("lKnee", "lAnkle", zc("leg"))}
      {boneLine("rHip", "rKnee", zc("leg"))}
      {boneLine("rKnee", "rAnkle", zc("leg"))}

      {/* Subtle zone overlays */}
      <ellipse cx="60" cy="56" rx="18" ry="16" fill={zc("upper")} opacity="0.08" />
      <ellipse cx="60" cy="82" rx="14" ry="8" fill={zc("hip")} opacity="0.08" />

      {/* Joints */}
      {jointCircle("head", "head", 6)}
      {jointCircle("lShoulder", "upper")}
      {jointCircle("rShoulder", "upper")}
      {jointCircle("hip", "hip", 4)}
      {jointCircle("lHip", "hip")}
      {jointCircle("rHip", "hip")}
      {jointCircle("lKnee", "leg")}
      {jointCircle("rKnee", "leg")}
      {jointCircle("lAnkle", "leg", 3)}
      {jointCircle("rAnkle", "leg", 3)}
      {jointCircle("lHand", "hand", 3)}
      {jointCircle("rHand", "hand", 3)}
      {jointCircle("lElbow", "hand", 2.5)}
      {jointCircle("rElbow", "hand", 2.5)}

      {/* Deviation arcs */}
      {deviationArc(joints.head.x, joints.head.y, "head", -90)}
      {deviationArc(joints.rShoulder.x, joints.rShoulder.y, "upper", -45)}
      {deviationArc(joints.hip.x, joints.hip.y, "hip", 180)}
      {deviationArc(joints.lKnee.x, joints.lKnee.y, "leg", 135)}
      {deviationArc(joints.rHand.x, joints.rHand.y, "hand", 0)}
    </svg>
  );
};

// ─── Segmented Performance Ring ──────────────────────────────────────────────

const SegmentedRing = ({ score, improvement }: { score: number; improvement: number }) => {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  const sw = 5;
  const gap = 6; // degrees gap between segments

  const segments = [
    { label: "Upper", score: 79, startDeg: 150, spanDeg: 80 },
    { label: "Core",  score: 76, startDeg: 150 + 80 + gap, spanDeg: 80 },
    { label: "Base",  score: 85, startDeg: 150 + 80 + gap + 80 + gap, spanDeg: 80 },
  ];

  const toRad = (d: number) => (d * Math.PI) / 180;
  const ptAt = (angle: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  const arcD = (start: number, span: number) => {
    const s = ptAt(start);
    const e = ptAt(start + span);
    const large = span > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="seg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={YELLOW} />
          <stop offset="100%" stopColor={GREEN} />
        </linearGradient>
      </defs>
      {/* Background arcs */}
      {segments.map((seg) => (
        <path key={seg.label + "-bg"} d={arcD(seg.startDeg, seg.spanDeg)} fill="none" stroke="#ECEEF0" strokeWidth={sw} strokeLinecap="round" />
      ))}
      {/* Filled arcs (proportional to score) */}
      {segments.map((seg) => {
        const filled = seg.spanDeg * (seg.score / 100);
        return (
          <path key={seg.label} d={arcD(seg.startDeg, filled)} fill="none" stroke="url(#seg-grad)" strokeWidth={sw} strokeLinecap="round" />
        );
      })}
      {/* Segment labels */}
      {segments.map((seg) => {
        const midAngle = seg.startDeg + seg.spanDeg / 2;
        const lr = r + 12;
        const pt = { x: cx + lr * Math.cos(toRad(midAngle)), y: cy + lr * Math.sin(toRad(midAngle)) };
        return (
          <text key={seg.label + "-t"} x={pt.x} y={pt.y} fontSize="6" fill={SECONDARY_TEXT} textAnchor="middle" dominantBaseline="middle" fontWeight="500">
            {seg.label}
          </text>
        );
      })}
      {/* Center score */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="28" fontWeight="700" fill={CHARCOAL}>{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fontWeight="600" fill={GREEN}>+{improvement}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fontSize="7" fill={SECONDARY_TEXT}>30 days</text>
    </svg>
  );
};

// ─── Continuum Bar ───────────────────────────────────────────────────────────

const ContinuumBar = ({ deviation }: { deviation: DeviationData }) => {
  const maxRange = 15; // degrees shown on each side
  const pct = 50 + (deviation.value / maxRange) * 50;
  const idealPct = (deviation.idealRange / maxRange) * 50;
  const color = deviationColor(deviation.value, deviation.idealRange);
  const labels = deviation.axis === "left-right" ? ["Left", "Right"] : ["Back", "Forward"];

  return (
    <div className="w-full mt-2">
      <div className="relative h-5 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 h-[3px] rounded-full top-1/2 -translate-y-1/2" style={{ background: "#E5E7EB" }} />
        {/* Ideal zone */}
        <div
          className="absolute h-[3px] rounded-full top-1/2 -translate-y-1/2"
          style={{
            left: `${50 - idealPct}%`,
            width: `${idealPct * 2}%`,
            background: `${GREEN}25`,
          }}
        />
        {/* Center tick */}
        <div className="absolute h-2.5 w-[1px] top-1/2 -translate-y-1/2 left-1/2" style={{ background: "#D1D5DB" }} />
        {/* Position dot */}
        <div
          className="absolute w-2.5 h-2.5 rounded-full top-1/2 -translate-y-1/2 shadow-sm"
          style={{
            left: `${Math.max(4, Math.min(96, pct))}%`,
            transform: "translate(-50%, -50%)",
            background: color,
          }}
        />
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[8px]" style={{ color: SECONDARY_TEXT }}>{labels[0]}</span>
        <span className="text-[8px]" style={{ color: SECONDARY_TEXT }}>Ideal</span>
        <span className="text-[8px]" style={{ color: SECONDARY_TEXT }}>{labels[1]}</span>
      </div>
    </div>
  );
};

// ─── Trend Chart ─────────────────────────────────────────────────────────────

const TrendChart = () => {
  const w = 320;
  const h = 80;
  const px = 28;
  const py = 10;
  const innerW = w - px * 2;
  const innerH = h - py * 2;
  const min = Math.min(...trendData.map((d) => d.value)) - 5;
  const max = Math.max(...trendData.map((d) => d.value)) + 5;
  const pts = trendData.map((d, i) => ({
    x: px + (i / (trendData.length - 1)) * innerW,
    y: py + innerH - ((d.value - min) / (max - min)) * innerH,
    ...d,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`}>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={px} x2={w - px} y1={py + innerH * (1 - f)} y2={py + innerH * (1 - f)} stroke="#F0F0F0" strokeWidth={0.5} />
      ))}
      <path d={line} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p) => (
        <g key={p.month}>
          <circle cx={p.x} cy={p.y} r={3} fill="white" stroke={GREEN} strokeWidth={1.5} />
          <text x={p.x} y={h - 1} textAnchor="middle" fontSize={9} fill={SECONDARY_TEXT}>{p.month}</text>
        </g>
      ))}
    </svg>
  );
};

// ─── Exercise Item ───────────────────────────────────────────────────────────

const ExerciseItem = ({ title, desc }: { title: string; desc: string }) => {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => setDone(!done)} className="w-full text-left flex items-start gap-2.5 py-2">
      <div
        className="mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
        style={{ borderColor: done ? GREEN : "#D1D5DB", backgroundColor: done ? GREEN : "transparent" }}
      >
        {done && <CheckCircle2 size={10} color="white" />}
      </div>
      <div>
        <p className="text-xs font-semibold" style={{ color: CHARCOAL }}>{title}</p>
        <p className="text-[10px] mt-0.5" style={{ color: SECONDARY_TEXT }}>{desc}</p>
      </div>
    </button>
  );
};

// ─── Visual Evidence Frame ───────────────────────────────────────────────────

const EvidenceFrame = ({
  type,
  bodyArea,
  deviation,
  timestamp,
  onClick,
}: {
  type: "stable" | "unstable";
  bodyArea: PositionComponent["bodyArea"];
  deviation: DeviationData;
  timestamp: string;
  onClick: () => void;
}) => {
  const accentColor = type === "stable" ? GREEN : YELLOW;
  const abs = Math.abs(deviation.value);
  const dirLabel = deviation.axis === "left-right"
    ? `${abs}° ${deviation.value < 0 ? "left" : "right"}`
    : `${abs}° ${deviation.value > 0 ? "fwd" : "back"}`;

  // Side-view riding skeleton positions (rider on horse, proportioned to image)
  const baseJoints = {
    head: { x: 52, y: 18 }, neck: { x: 50, y: 26 },
    shoulder: { x: 48, y: 32 }, elbow: { x: 42, y: 40 },
    hand: { x: 38, y: 46 }, midBack: { x: 50, y: 42 },
    hip: { x: 52, y: 52 }, knee: { x: 46, y: 64 },
    ankle: { x: 44, y: 76 }, toe: { x: 42, y: 80 },
  };

  // Apply deviation offset for unstable frame
  const dx = type === "unstable" ? (deviation.axis === "left-right" ? deviation.value * 0.5 : 0) : 0;
  const dy = type === "unstable" ? (deviation.axis === "forward-back" ? deviation.value * 0.4 : 0) : 0;

  const j = Object.fromEntries(
    Object.entries(baseJoints).map(([k, v]) => [k, { x: v.x + dx, y: v.y + dy }])
  ) as typeof baseJoints;

  const highlightMap: Record<string, (keyof typeof baseJoints)[]> = {
    head: ["head"], upper: ["shoulder", "midBack"],
    hip: ["hip"], leg: ["knee", "ankle"], hand: ["hand", "elbow"],
  };
  const highlighted = highlightMap[bodyArea] || [];

  const bones: [keyof typeof baseJoints, keyof typeof baseJoints][] = [
    ["head", "neck"], ["neck", "shoulder"], ["shoulder", "elbow"],
    ["elbow", "hand"], ["neck", "midBack"], ["midBack", "hip"],
    ["hip", "knee"], ["knee", "ankle"], ["ankle", "toe"],
  ];

  const jointKeys = Object.keys(baseJoints) as (keyof typeof baseJoints)[];

  const annotationJoint: Record<string, keyof typeof baseJoints> = {
    head: "head", upper: "shoulder", hip: "hip", leg: "knee", hand: "hand",
  };
  const aJ = annotationJoint[bodyArea] || "hip";

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl overflow-hidden relative group"
      style={{ aspectRatio: "3/4" }}
    >
      {/* Real video frame background */}
      <img
        src={heroRider}
        alt={`${type === "stable" ? "Most stable" : "Most unstable"} moment`}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: type === "unstable" ? "brightness(0.85) contrast(1.05)" : "brightness(0.9) contrast(1.05)",
        }}
      />

      {/* Subtle overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${accentColor}08 0%, transparent 40%, rgba(0,0,0,0.45) 100%)`,
        }}
      />

      {/* Skeleton overlay SVG */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 100" preserveAspectRatio="xMidYMid slice">
        {/* Faint vertical ideal axis */}
        <line x1="50" y1="8" x2="50" y2="85" stroke="white" strokeWidth="0.3" strokeDasharray="2 2" opacity="0.25" />

        {/* Ghost skeleton (ideal alignment) */}
        <g opacity="0.3">
          {bones.map(([a, b]) => (
            <line key={`ghost-${a}-${b}`}
              x1={baseJoints[a].x} y1={baseJoints[a].y}
              x2={baseJoints[b].x} y2={baseJoints[b].y}
              stroke="#B0B8C4" strokeWidth="0.7" strokeLinecap="round"
            />
          ))}
          {jointKeys.map((k) => (
            <circle key={`gj-${k}`}
              cx={baseJoints[k].x} cy={baseJoints[k].y}
              r={k === "head" ? 3 : 1.5}
              fill="none" stroke="#B0B8C4" strokeWidth="0.5"
            />
          ))}
        </g>

        {/* Actual detected skeleton */}
        {bones.map(([a, b]) => (
          <line key={`bone-${a}-${b}`}
            x1={j[a].x} y1={j[a].y}
            x2={j[b].x} y2={j[b].y}
            stroke={accentColor} strokeWidth="0.9" strokeLinecap="round" opacity="0.9"
          />
        ))}
        {jointKeys.map((k) => {
          const isHL = highlighted.includes(k);
          return (
            <circle key={`jt-${k}`}
              cx={j[k].x} cy={j[k].y}
              r={k === "head" ? 3.5 : isHL ? 2.2 : 1.5}
              fill={isHL ? accentColor : "white"}
              stroke={isHL ? "white" : accentColor}
              strokeWidth={isHL ? "0.6" : "0.4"}
              opacity={isHL ? 1 : 0.8}
            />
          );
        })}

        {/* Angle annotation */}
        <g>
          <rect
            x={j[aJ].x + 5} y={j[aJ].y - 7}
            width={dirLabel.length * 3.5 + 4} height="9"
            rx="2" fill="rgba(0,0,0,0.55)"
          />
          <text
            x={j[aJ].x + 7} y={j[aJ].y}
            fontSize="5.5" fontWeight="600" fill={accentColor}
            dominantBaseline="middle"
          >
            {dirLabel}
          </text>
        </g>

        {/* Accent frame border */}
        <rect x="0.5" y="0.5" width="79" height="99" rx="6"
          fill="none" stroke={accentColor} strokeWidth="0.6" opacity="0.3"
        />
      </svg>

      {/* Bottom label */}
      <div className="absolute bottom-0 inset-x-0 px-2 py-1.5"
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}
      >
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          <p className="text-[8px] font-semibold text-white tracking-wide">
            {type === "stable" ? "MOST STABLE" : "MOST UNSTABLE"}
          </p>
        </div>
        <p className="text-[7px] text-white opacity-60 mt-0.5">{timestamp}</p>
      </div>
    </button>
  );
};

// ─── Component Card ──────────────────────────────────────────────────────────

const ComponentCard = ({ comp, badge }: { comp: PositionComponent; badge: "focus" | "improved" | "stable" }) => {
  const [expanded, setExpanded] = useState(false);
  const [exTab, setExTab] = useState<"on" | "off">("on");
  const navigate = useNavigate();

  const badgeConfig = {
    focus: { label: "Focus", bg: `${YELLOW}20`, color: YELLOW, icon: "🔶" },
    improved: { label: "Improved", bg: `${GREEN}15`, color: GREEN, icon: "🟢" },
    stable: { label: "Stable", bg: "#F3F4F6", color: SECONDARY_TEXT, icon: "⚪" },
  }[badge];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold" style={{ color: CHARCOAL }}>{comp.name}</p>
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: badgeConfig.bg, color: badgeConfig.color }}
          >
            {badgeConfig.icon} {badgeConfig.label}
          </span>
        </div>

        {/* Arc gauge + score */}
        <div className="flex flex-col items-center">
          <ArcGauge value={comp.value} size={60} strokeWidth={3.5} />
          <span className="text-xl font-bold -mt-1" style={{ color: CHARCOAL }}>{comp.value}%</span>
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
            style={{ background: `${GREEN}15`, color: GREEN }}
          >
            +{comp.improvement}
          </span>
        </div>

        {/* Continuum bar */}
        <ContinuumBar deviation={comp.deviation} />
        <p className="text-[9px] text-center mt-1 font-medium" style={{ color: deviationColor(comp.deviation.value, comp.deviation.idealRange) }}>
          {deviationLabel(comp.deviation)}
        </p>
        <p className="text-[8px] text-center" style={{ color: SECONDARY_TEXT }}>
          Ideal range: ±{comp.deviation.idealRange}°
        </p>

        {/* Expand trigger */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 mt-3 text-[11px] font-medium"
          style={{ color: GREEN }}
        >
          View details
          <ChevronDown
            size={12}
            className="transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </button>
      </div>

      {/* Expandable content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-4">
              {/* Performance Breakdown */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: SECONDARY_TEXT }}>Performance</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {[
                    ["Ideal Range", `${comp.breakdown.ideal}%`],
                    ["Acceptable", `${comp.breakdown.acceptable}%`],
                    ["Out of Range", `${comp.breakdown.outOfRange}%`],
                    ["Streak", `${comp.breakdown.streak}s`],
                    ["Variance", `${comp.breakdown.variance}`],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-[10px]" style={{ color: SECONDARY_TEXT }}>{label}</span>
                      <span className="text-[10px] font-semibold" style={{ color: CHARCOAL }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual Evidence */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: SECONDARY_TEXT }}>Visual Evidence</p>
                <div className="flex gap-2">
                  <EvidenceFrame
                    type="stable"
                    bodyArea={comp.bodyArea}
                    deviation={{ ...comp.deviation, value: Math.round(comp.deviation.value * 0.3) }}
                    timestamp="12:34"
                    onClick={() => navigate("/evidence-studio")}
                  />
                  <EvidenceFrame
                    type="unstable"
                    bodyArea={comp.bodyArea}
                    deviation={comp.deviation}
                    timestamp="08:17"
                    onClick={() => navigate("/evidence-studio")}
                  />
                </div>
              </div>

              {/* Training */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: SECONDARY_TEXT }}>
                  Improve {comp.name}
                </p>
                <div className="flex gap-1 mb-2">
                  {([["on", "ON SADDLE"], ["off", "OFF SADDLE"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setExTab(key)}
                      className="px-2.5 py-1 text-[9px] font-semibold rounded-full transition-colors uppercase tracking-wider"
                      style={{
                        background: exTab === key ? GREEN : "#F3F4F6",
                        color: exTab === key ? "white" : SECONDARY_TEXT,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="space-y-0">
                  {(exTab === "on" ? comp.onSaddle : comp.offSaddle).map((ex) => (
                    <ExerciseItem key={ex.title} title={ex.title} desc={ex.desc} />
                  ))}
                </div>
              </div>

              {/* Micro Insight */}
              <div className="flex items-start gap-2 rounded-xl p-2.5" style={{ background: "#FAFAFA" }}>
                <Sparkles size={12} style={{ color: YELLOW }} className="shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed" style={{ color: SECONDARY_TEXT }}>{comp.microInsight}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

const PositionStabilityPage = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<"1W" | "1M" | "3M">("1M");

  const sortedComponents = useMemo(() => {
    return [...positionComponents].sort((a, b) => {
      if (a.value !== b.value) return a.value - b.value;
      return b.improvement - a.improvement;
    });
  }, []);

  const lowestIdx = 0;
  const mostImprovedIdx = sortedComponents.reduce(
    (best, c, i) => (c.improvement > sortedComponents[best].improvement ? i : best),
    0
  );

  const getBadge = (i: number): "focus" | "improved" | "stable" => {
    if (i === lowestIdx) return "focus";
    if (i === mostImprovedIdx) return "improved";
    return "stable";
  };

  return (
    <div className="min-h-screen pb-28" style={{ background: BG }}>
      <div className="px-5 pt-14 pb-4 space-y-5 max-w-lg mx-auto">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => navigate("/progress")}
          className="flex items-center gap-1 text-sm font-medium"
          style={{ color: GREEN }}
        >
          <ChevronLeft size={18} /> Progress
        </motion.button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-semibold font-display" style={{ color: CHARCOAL }}>Position & Stability</h1>
          <p className="text-sm mt-1" style={{ color: SECONDARY_TEXT }}>
            Measured through movement. Improved through practice.
          </p>
        </motion.div>

        {/* ── 1. Hero — Body Position Overview ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center justify-center gap-2">
            <BioSilhouette components={positionComponents} />
            <SegmentedRing score={overallScore} improvement={overallImprovement} />
          </div>

          <p className="text-[11px] text-center mt-3 max-w-[300px] mx-auto italic" style={{ color: SECONDARY_TEXT }}>
            "{aiSummary}"
          </p>
        </motion.div>

        {/* ── 2. Compact Trend Graph ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: SECONDARY_TEXT }}>Trend</p>
            <div className="flex gap-0.5 bg-white rounded-full p-0.5 border border-gray-100">
              {(["1W", "1M", "3M"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className="px-3 py-1 text-[10px] font-semibold rounded-full transition-colors"
                  style={{
                    background: timeRange === r ? GREEN : "transparent",
                    color: timeRange === r ? "white" : SECONDARY_TEXT,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <TrendChart />
        </motion.div>

        {/* ── 3. Position Components ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <p className="text-sm font-semibold mb-3" style={{ color: CHARCOAL }}>Position Components</p>
          <div className="grid grid-cols-2 gap-3">
            {sortedComponents.map((comp, i) => (
              <ComponentCard key={comp.name} comp={comp} badge={getBadge(i)} />
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <p className="text-[10px] text-center leading-relaxed px-4 pt-2" style={{ color: "#9CA3AF" }}>
          Position & Stability is calculated from head alignment, upper body control, hip symmetry, lower leg stability, and hand consistency across analyzed rides.
        </p>
      </div>
    </div>
  );
};

export default PositionStabilityPage;
