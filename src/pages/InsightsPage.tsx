import { useState } from 'react';
import { biometricsTrend, mockGoal, cadenceInsights, mockRides } from '../data/mock';
import { computeRidingQualities } from '../lib/poseAnalysis';
import type { BiometricsSnapshot } from '../data/mock';
import CadenceInsightCard from '../components/ui/CadenceInsightCard';

type TabId = 'trends' | 'milestones' | 'patterns';
type AnalysisLayerId = 'movement' | 'position' | 'performance';

const METRIC_CONFIG = [
  { key: 'lowerLeg',   label: 'Lower Leg',   color: '#8C5A3C' },
  { key: 'reins',      label: 'Reins',        color: '#C9A96E' },
  { key: 'core',       label: 'Core',         color: '#7D9B76' },
  { key: 'upperBody',  label: 'Upper Body',   color: '#6B7FA3' },
  { key: 'pelvis',     label: 'Pelvis',       color: '#B5A898' },
] as const;

type MetricKey = typeof METRIC_CONFIG[number]['key'];

// ─────────────────────────────────────────────────────────
// MOCK SCORES for body visualization
// ─────────────────────────────────────────────────────────

const BODY_SCORES: BiometricsSnapshot = {
  lowerLegStability:  0.72,
  reinSteadiness:     0.68,
  reinSymmetry:       0.59,
  coreStability:      0.88,
  upperBodyAlignment: 0.81,
  pelvisStability:    0.74,
};

// Last 5 rides mock sparkline data (0-100 scale)
const SPARKLINE_DATA: Record<string, number[]> = {
  lowerLeg:  [64, 68, 70, 69, 72],
  reins:     [61, 63, 65, 67, 68],
  core:      [82, 84, 86, 87, 88],
  upperBody: [74, 76, 78, 80, 81],
  pelvis:    [68, 70, 72, 73, 74],
};

function scoreColor(score: number): string {
  if (score >= 0.80) return '#4CAF50';
  if (score >= 0.60) return '#F9A825';
  return '#E53935';
}

function scoreColorDark(score: number): string {
  if (score >= 0.80) return '#4CAF50';
  if (score >= 0.60) return '#F9A825';
  return '#E53935';
}

function scoreLabel(score: number): string {
  if (score >= 0.85) return 'Excellent';
  if (score >= 0.70) return 'Good';
  if (score >= 0.55) return 'Developing';
  return 'Focus area';
}

// ─────────────────────────────────────────────────────────
// SPARKLINE COMPONENT
// ─────────────────────────────────────────────────────────

function SparkLine({ data, color }: { data: number[]; color: string }) {
  const w = 80, h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 0.01;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {data.length > 0 && (() => {
        const last = data[data.length - 1];
        const x = w;
        const y = h - ((last - min) / range) * (h - 4) - 2;
        return <circle cx={x} cy={y} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// TREND CHART
// ─────────────────────────────────────────────────────────

function TrendChart({
  data,
  activeMetrics,
}: {
  data: typeof biometricsTrend;
  activeMetrics: Set<MetricKey>;
}) {
  const W = 320, H = 140;
  const padL = 28, padR = 8, padT = 8, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const yTicks = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

  const xPos = (i: number) => padL + (i / (data.length - 1)) * chartW;
  const yPos = (v: number) => padT + chartH - ((v - 0.5) / 0.5) * chartH;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {yTicks.map(t => (
        <g key={t}>
          <line
            x1={padL} y1={yPos(t)} x2={W - padR} y2={yPos(t)}
            stroke="#EDE7DF" strokeWidth="0.8"
          />
          <text
            x={padL - 4} y={yPos(t) + 4}
            fontSize="8" fill="#B5A898" textAnchor="end"
            fontFamily="'DM Mono', monospace"
          >
            {Math.round(t * 100)}
          </text>
        </g>
      ))}

      {data.map((d, i) => (
        <text
          key={i}
          x={xPos(i)} y={H - 4}
          fontSize="7.5" fill="#B5A898" textAnchor="middle"
          fontFamily="'DM Sans', sans-serif"
        >
          {d.date.replace('Feb ', 'F').replace('Mar ', 'M')}
        </text>
      ))}

      {METRIC_CONFIG.map(({ key, color }) => {
        if (!activeMetrics.has(key)) return null;
        const pts = data.map((d, i) =>
          `${xPos(i)},${yPos((d as unknown as Record<string, number>)[key])}`
        ).join(' ');
        return (
          <g key={key}>
            <polyline
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {data.map((d, i) => (
              <circle
                key={i}
                cx={xPos(i)}
                cy={yPos((d as unknown as Record<string, number>)[key])}
                r="2"
                fill={color}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────
// METRIC SUMMARY ROW
// ─────────────────────────────────────────────────────────

function MetricSummaryRow({ metricKey, label, color, data }: {
  metricKey: MetricKey;
  label: string;
  color: string;
  data: typeof biometricsTrend;
}) {
  const values = data.map(d => (d as unknown as Record<string, number>)[metricKey]);
  const latest = values[values.length - 1];
  const first = values[0];
  const delta = latest - first;
  const latestPct = Math.round(latest * 100);
  const deltaPct = Math.round(delta * 100);
  const trend = delta > 0.02 ? 'up' : delta < -0.02 ? 'down' : 'flat';

  const trendColor = trend === 'up' ? '#7D9B76' : trend === 'down' ? '#C4714A' : '#C9A96E';
  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F0EBE4' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12.5px', color: '#1A140E', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
          {label}
        </div>
        <div style={{ fontSize: '10px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>
          {latestPct}% · <span style={{ color: trendColor }}>{trendSymbol} {Math.abs(deltaPct)}pts since Feb</span>
        </div>
      </div>
      <SparkLine data={values} color={color} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// PATTERNS TAB
// ─────────────────────────────────────────────────────────

function PatternsTab() {
  const signalCounts = { improving: 0, consistent: 0, 'needs-work': 0 };
  mockRides.forEach(r => signalCounts[r.signal]++);
  const total = mockRides.length;

  const patterns = [
    {
      icon: '🔁',
      title: 'Right-rein drift',
      detail: 'Your lower leg tends to drift forward on the right rein — visible in 4 of your last 5 rides.',
      color: '#C4714A',
      tag: 'Persistent',
    },
    {
      icon: '⏱',
      title: 'Warm-up pattern',
      detail: 'Rein steadiness consistently improves in the second half of every ride.',
      color: '#C9A96E',
      tag: 'Consistent',
    },
    {
      icon: '✓',
      title: 'Core is solid',
      detail: 'Core stability scores have been above 85% for 6 consecutive rides. This is mastered.',
      color: '#7D9B76',
      tag: 'Mastered',
    },
    {
      icon: '📈',
      title: '4-week trajectory',
      detail: 'All 5 biometric areas have improved over the past 4 weeks. Lower leg shows the most growth (+17pts).',
      color: '#8C5A3C',
      tag: 'Positive',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }}>
          Ride Signals — Last {total} Rides
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { label: 'Improving', count: signalCounts.improving, color: '#7D9B76', symbol: '↑' },
            { label: 'Consistent', count: signalCounts.consistent, color: '#C9A96E', symbol: '→' },
            { label: 'Needs work', count: signalCounts['needs-work'], color: '#C4714A', symbol: '↓' },
          ].map(({ label, count, color, symbol }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center', background: '#FAF7F3', borderRadius: '10px', padding: '10px 4px' }}>
              <div style={{ fontSize: '20px', color, marginBottom: '2px' }}>{symbol}</div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#1A140E', fontFamily: "'DM Mono', monospace" }}>{count}</div>
              <div style={{ fontSize: '9px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {patterns.map((p, i) => (
        <div key={i} style={{
          background: '#FFFFFF', borderRadius: '16px', padding: '14px 16px',
          boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
          borderLeft: `3px solid ${p.color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
            <span style={{ fontSize: '14px' }}>{p.icon}</span>
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#1A140E', fontFamily: "'DM Sans', sans-serif" }}>
              {p.title}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: '9px', fontWeight: 600,
              color: p.color, background: `${p.color}18`,
              padding: '2px 7px', borderRadius: '6px',
              fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em',
            }}>
              {p.tag}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#7A6B5D', lineHeight: 1.55, fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
            {p.detail}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BODY DIAGRAM — SVG Rider Figure (Card #58)
// ─────────────────────────────────────────────────────────

function RiderBodyDiagram({ scores }: { scores: BiometricsSnapshot }) {
  const lowerLegColor = scoreColor(scores.lowerLegStability);
  const reinColor     = scoreColor(scores.reinSteadiness);
  const coreColor     = scoreColor(scores.coreStability);
  const upperColor    = scoreColor(scores.upperBodyAlignment);
  const pelvisColor   = scoreColor(scores.pelvisStability);
  const symColor      = scoreColor(scores.reinSymmetry);

  const fillOpacity = 0.32;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { label: 'Excellent (>80)', color: '#4CAF50' },
          { label: 'Good (60–80)', color: '#F9A825' },
          { label: 'Focus (<60)', color: '#E53935' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, opacity: 0.8 }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#B5A898' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* SVG Body Diagram — Elegant Rider Silhouette */}
      <svg
        width="200"
        height="260"
        viewBox="0 0 200 260"
        style={{ overflow: 'visible' }}
      >
        {/* === HORSE BODY (simplified) === */}
        {/* Horse torso */}
        <ellipse cx="100" cy="210" rx="68" ry="26" fill="#EDE7DF" opacity="0.7" />
        {/* Horse neck */}
        <path d="M62 196 Q52 178 58 164 Q65 155 74 158 Q82 162 80 176 Q78 188 72 196Z"
          fill="#EDE7DF" opacity="0.7" />
        {/* Horse head */}
        <path d="M55 165 Q44 158 42 148 Q40 136 50 130 Q60 125 68 132 Q74 140 70 152 Q66 160 58 165Z"
          fill="#EDE7DF" opacity="0.7" />
        {/* Horse legs - front pair */}
        <rect x="76" y="228" width="8" height="30" rx="4" fill="#EDE7DF" opacity="0.6" />
        <rect x="92" y="232" width="8" height="28" rx="4" fill="#EDE7DF" opacity="0.6" />
        {/* Horse legs - back pair */}
        <rect x="112" y="228" width="8" height="30" rx="4" fill="#EDE7DF" opacity="0.6" />
        <rect x="128" y="232" width="8" height="28" rx="4" fill="#EDE7DF" opacity="0.6" />
        {/* Horse tail */}
        <path d="M168 200 Q180 195 183 185 Q185 175 178 172" stroke="#EDE7DF" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />

        {/* === SADDLE AREA === */}
        <ellipse cx="105" cy="188" rx="30" ry="9" fill="#C9A96E" opacity="0.3" />

        {/* === RIDER — LOWER LEG ZONE (ankles/lower legs) === */}
        {/* Left lower leg */}
        <path d="M76 190 Q68 198 66 212 Q64 222 70 226 Q76 230 80 220 Q84 210 82 198Z"
          fill={lowerLegColor} opacity={fillOpacity} />
        {/* Right lower leg */}
        <path d="M128 190 Q136 198 138 212 Q140 222 134 226 Q128 230 124 220 Q120 210 122 198Z"
          fill={lowerLegColor} opacity={fillOpacity} />
        {/* Lower leg outline */}
        <path d="M76 190 Q68 198 66 212 Q64 222 70 226 Q76 230 80 220 Q84 210 82 198Z"
          fill="none" stroke={lowerLegColor} strokeWidth="1.2" opacity={0.5} />
        <path d="M128 190 Q136 198 138 212 Q140 222 134 226 Q128 230 124 220 Q120 210 122 198Z"
          fill="none" stroke={lowerLegColor} strokeWidth="1.2" opacity={0.5} />

        {/* === RIDER — PELVIS ZONE (hip area) === */}
        <ellipse cx="104" cy="183" rx="24" ry="12"
          fill={pelvisColor} opacity={fillOpacity} />
        <ellipse cx="104" cy="183" rx="24" ry="12"
          fill="none" stroke={pelvisColor} strokeWidth="1.2" opacity={0.5} />

        {/* === RIDER — CORE ZONE (torso/midsection) === */}
        <path d="M86 158 Q84 168 86 178 Q90 186 104 186 Q118 186 118 178 Q120 168 118 158 Q114 148 104 146 Q94 144 86 158Z"
          fill={coreColor} opacity={fillOpacity} />
        <path d="M86 158 Q84 168 86 178 Q90 186 104 186 Q118 186 118 178 Q120 168 118 158 Q114 148 104 146 Q94 144 86 158Z"
          fill="none" stroke={coreColor} strokeWidth="1.2" opacity={0.5} />

        {/* === RIDER — UPPER BODY ZONE (shoulders/upper back) === */}
        <path d="M80 130 Q76 140 80 152 Q86 158 104 158 Q122 158 124 152 Q128 140 124 130 Q120 122 104 120 Q88 118 80 130Z"
          fill={upperColor} opacity={fillOpacity} />
        <path d="M80 130 Q76 140 80 152 Q86 158 104 158 Q122 158 124 152 Q128 140 124 130 Q120 122 104 120 Q88 118 80 130Z"
          fill="none" stroke={upperColor} strokeWidth="1.2" opacity={0.5} />

        {/* === RIDER — REIN/HAND ZONE (forearms/hands) === */}
        {/* Left arm */}
        <path d="M80 130 Q68 135 60 142 Q54 148 52 155 Q50 162 58 164 Q66 165 70 158 Q74 150 78 142 Q82 136 82 130Z"
          fill={reinColor} opacity={fillOpacity} />
        <path d="M80 130 Q68 135 60 142 Q54 148 52 155 Q50 162 58 164 Q66 165 70 158 Q74 150 78 142 Q82 136 82 130Z"
          fill="none" stroke={reinColor} strokeWidth="1.2" opacity={0.5} />
        {/* Right arm (rein symmetry coloring) */}
        <path d="M124 130 Q136 135 144 142 Q150 148 152 155 Q154 162 146 164 Q138 165 134 158 Q130 150 126 142 Q122 136 122 130Z"
          fill={symColor} opacity={fillOpacity} />
        <path d="M124 130 Q136 135 144 142 Q150 148 152 155 Q154 162 146 164 Q138 165 134 158 Q130 150 126 142 Q122 136 122 130Z"
          fill="none" stroke={symColor} strokeWidth="1.2" opacity={0.5} />

        {/* === RIDER OUTLINE (clean silhouette over zones) === */}
        {/* Head */}
        <circle cx="104" cy="106" r="14" fill="#FAF7F3" stroke="#C9A96E" strokeWidth="1.5" opacity="0.9" />
        {/* Neck */}
        <rect x="100" y="118" width="8" height="8" rx="2" fill="#FAF7F3" stroke="#C9A96E" strokeWidth="1" opacity="0.9" />
        {/* Shoulders */}
        <path d="M80 128 Q104 120 128 128" fill="none" stroke="#8C5A3C" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        {/* Spine line */}
        <line x1="104" y1="126" x2="104" y2="186" stroke="#8C5A3C" strokeWidth="1" strokeDasharray="3,2" opacity="0.4" />
        {/* Stirrup irons */}
        <circle cx="68" cy="224" r="5" fill="none" stroke="#B5A898" strokeWidth="1.5" opacity="0.8" />
        <circle cx="140" cy="224" r="5" fill="none" stroke="#B5A898" strokeWidth="1.5" opacity="0.8" />
        {/* Reins */}
        <path d="M56 160 Q65 168 76 175 Q88 182 104 183" stroke="#8C5A3C" strokeWidth="1" strokeDasharray="2,2" fill="none" opacity="0.5" />
        <path d="M148 160 Q139 168 128 175 Q116 182 104 183" stroke="#8C5A3C" strokeWidth="1" strokeDasharray="2,2" fill="none" opacity="0.5" />

        {/* Zone labels */}
        <text x="148" y="100" fontSize="8" fill={lowerLegColor} fontFamily="'DM Mono', monospace" opacity="0.9">Leg</text>
        <text x="148" y="185" fontSize="8" fill={pelvisColor} fontFamily="'DM Mono', monospace" opacity="0.9">Pelvis</text>
        <text x="148" y="168" fontSize="8" fill={coreColor} fontFamily="'DM Mono', monospace" opacity="0.9">Core</text>
        <text x="148" y="140" fontSize="8" fill={upperColor} fontFamily="'DM Mono', monospace" opacity="0.9">Upper</text>
        <text x="10" y="162" fontSize="7" fill={reinColor} fontFamily="'DM Mono', monospace" opacity="0.9">L Rein</text>
        <text x="152" y="162" fontSize="7" fill={symColor} fontFamily="'DM Mono', monospace" opacity="0.9">R Rein</text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SCORE CHIPS ROW
// ─────────────────────────────────────────────────────────

function ScoreChipsRow({ scores }: { scores: BiometricsSnapshot }) {
  const chips = [
    { label: 'Lower Leg', score: scores.lowerLegStability, abbr: 'LL' },
    { label: 'Rein Steady', score: scores.reinSteadiness, abbr: 'RS' },
    { label: 'Symmetry', score: scores.reinSymmetry, abbr: 'SY' },
    { label: 'Core', score: scores.coreStability, abbr: 'CO' },
    { label: 'Upper Body', score: scores.upperBodyAlignment, abbr: 'UB' },
    { label: 'Pelvis', score: scores.pelvisStability, abbr: 'PV' },
  ];

  return (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
      {chips.map(chip => {
        const c = scoreColorDark(chip.score);
        const pct = Math.round(chip.score * 100);
        return (
          <div key={chip.abbr} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            flexShrink: 0, gap: 4,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `${c}15`,
              border: `2px solid ${c}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '13px', fontWeight: 700, color: c }}>
                {pct}
              </span>
            </div>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '9px', color: '#B5A898', textAlign: 'center', maxWidth: 44, lineHeight: 1.2 }}>
              {chip.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SYMMETRY BAR COMPARISON
// ─────────────────────────────────────────────────────────

function SymmetryBars({ scores }: { scores: BiometricsSnapshot }) {
  // Mock left/right split: reinSymmetry drives the divergence
  const reinSym = scores.reinSymmetry;
  const pelvisSym = scores.pelvisStability;

  const reinLeft  = Math.round((reinSym * 0.9 + 0.05) * 100);
  const reinRight = Math.round((reinSym * 1.1 - 0.05) * 100);
  const pelvisLeft  = Math.round(pelvisSym * 100);
  const pelvisRight = Math.round((pelvisSym * 0.92) * 100);

  const bars = [
    { label: 'Rein Symmetry', left: reinLeft, right: reinRight, color: '#C9A96E' },
    { label: 'Pelvis Tilt', left: pelvisLeft, right: pelvisRight, color: '#6B7FA3' },
  ];

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
        Left / Right Symmetry
      </div>
      {bars.map(bar => (
        <div key={bar.label} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: bar.color }}>L {bar.left}</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#1A140E', fontWeight: 500 }}>{bar.label}</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: bar.color }}>R {bar.right}</span>
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#F0EBE4' }}>
            <div style={{ width: `${bar.left}%`, background: bar.color, opacity: 0.9 }} />
            <div style={{ flex: 1, background: 'transparent' }} />
          </div>
          <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#F0EBE4', marginTop: 2 }}>
            <div style={{ width: `${bar.right}%`, background: bar.color, opacity: 0.6 }} />
            <div style={{ flex: 1, background: 'transparent' }} />
          </div>
          {Math.abs(bar.left - bar.right) > 5 && (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#C4714A', marginTop: 4 }}>
              ↕ {Math.abs(bar.left - bar.right)}pt difference — worth monitoring
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// 3-LAYER ANALYSIS TABS
// ─────────────────────────────────────────────────────────

function AnalysisLayerTabs({ scores }: { scores: BiometricsSnapshot }) {
  const [activeLayer, setActiveLayer] = useState<AnalysisLayerId>('movement');

  const layers: { id: AnalysisLayerId; label: string; desc: string }[] = [
    { id: 'movement',    label: 'Movement',    desc: 'Biomechanics raw scores' },
    { id: 'position',    label: 'Position',    desc: 'Riding quality derived' },
    { id: 'performance', label: 'Performance', desc: 'Readiness & trends' },
  ];

  const qualities = computeRidingQualities(scores);
  const latest = biometricsTrend[biometricsTrend.length - 1];
  const overallPct = Math.round(
    ((latest.lowerLeg + latest.reins + latest.core + latest.upperBody + latest.pelvis) / 5) * 100
  );

  const movementMetrics = [
    { label: 'Lower Leg Stability', score: Math.round(scores.lowerLegStability * 100), color: '#8C5A3C', desc: 'Ankle drift and stirrup consistency' },
    { label: 'Rein Steadiness',     score: Math.round(scores.reinSteadiness * 100),     color: '#C9A96E', desc: 'Hand movement amplitude' },
    { label: 'Rein Symmetry',       score: Math.round(scores.reinSymmetry * 100),       color: '#C4714A', desc: 'Left–right hand balance' },
    { label: 'Core Stability',      score: Math.round(scores.coreStability * 100),      color: '#7D9B76', desc: 'Torso angle consistency' },
    { label: 'Upper Body Align.',   score: Math.round(scores.upperBodyAlignment * 100), color: '#6B7FA3', desc: 'Shoulder–hip–heel line' },
    { label: 'Pelvis Stability',    score: Math.round(scores.pelvisStability * 100),    color: '#B5A898', desc: 'Hip follow and lateral tilt' },
  ];

  const positionScores = [
    { label: 'Rhythm',      score: Math.round(qualities[0].score * 100), color: '#C9A96E', desc: qualities[0].qualityNote },
    { label: 'Relaxation',  score: Math.round(qualities[1].score * 100), color: '#7D9B76', desc: qualities[1].qualityNote },
    { label: 'Contact',     score: Math.round(qualities[2].score * 100), color: '#8C5A3C', desc: qualities[2].qualityNote },
    { label: 'Impulsion',   score: Math.round(qualities[3].score * 100), color: '#C4714A', desc: qualities[3].qualityNote },
    { label: 'Straightness',score: Math.round(qualities[4].score * 100), color: '#6B7FA3', desc: qualities[4].qualityNote },
    { label: 'Balance',     score: Math.round(qualities[5].score * 100), color: '#B5A898', desc: qualities[5].qualityNote },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: '4px',
        background: '#F0EBE4', borderRadius: '12px', padding: '4px',
        marginBottom: 14,
      }}>
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            style={{
              flex: 1, padding: '7px 4px',
              background: activeLayer === layer.id ? '#FFFFFF' : 'transparent',
              border: 'none', borderRadius: '9px', cursor: 'pointer',
              fontSize: '11.5px', fontWeight: activeLayer === layer.id ? 600 : 400,
              color: activeLayer === layer.id ? '#8C5A3C' : '#B5A898',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s ease',
              boxShadow: activeLayer === layer.id ? '0 1px 4px rgba(26,20,14,0.08)' : 'none',
            }}
          >
            {layer.label}
          </button>
        ))}
      </div>

      {/* Movement tab */}
      {activeLayer === 'movement' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#7A6B5D', margin: '0 0 8px', lineHeight: 1.5 }}>
            Raw biomechanics scores — how your body moves in the saddle across 6 AI-detected dimensions.
          </p>
          {movementMetrics.map(m => {
            const c = scoreColorDark(m.score / 100);
            return (
              <div key={m.label} style={{
                background: '#FFFFFF', borderRadius: 14, padding: '10px 14px',
                boxShadow: '0 1px 6px rgba(26,20,14,0.05)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${c}15`, border: `1.5px solid ${c}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'DM Mono', monospace", fontSize: '12px', fontWeight: 700, color: c,
                  flexShrink: 0,
                }}>
                  {m.score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#1A140E' }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#B5A898' }}>
                    {m.desc}
                  </div>
                </div>
                <div style={{ height: 4, width: 48, background: '#F0EBE4', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${m.score}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Position tab */}
      {activeLayer === 'position' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#7A6B5D', margin: '0 0 8px', lineHeight: 1.5 }}>
            Derived riding quality scores based on the classical USDF Scales of Training — how your position affects your horse.
          </p>
          {positionScores.map(m => {
            const c = scoreColorDark(m.score / 100);
            return (
              <div key={m.label} style={{
                background: '#FFFFFF', borderRadius: 14, padding: '10px 14px',
                boxShadow: '0 1px 6px rgba(26,20,14,0.05)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${c}15`, border: `1.5px solid ${c}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'DM Mono', monospace", fontSize: '12px', fontWeight: 700, color: c,
                  flexShrink: 0,
                }}>
                  {m.score}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 600, color: '#1A140E' }}>
                    {m.label}
                  </div>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', color: '#B5A898' }}>
                    {m.desc}
                  </div>
                </div>
                <div style={{ height: 4, width: 48, background: '#F0EBE4', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', width: `${m.score}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Performance tab */}
      {activeLayer === 'performance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#7A6B5D', margin: '0 0 4px', lineHeight: 1.5 }}>
            Overall readiness and progress over the past 4 weeks.
          </p>

          {/* Readiness dial */}
          <div style={{
            background: '#FFFFFF', borderRadius: 16, padding: '18px 16px',
            boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="36" cy="36" r="30" fill="none" stroke="#F0EBE4" strokeWidth="6" />
                <circle cx="36" cy="36" r="30" fill="none"
                  stroke="#7D9B76" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 30}`}
                  strokeDashoffset={`${2 * Math.PI * 30 * (1 - overallPct / 100)}`}
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '16px', fontWeight: 700, color: '#7D9B76', lineHeight: 1 }}>{overallPct}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '8px', color: '#B5A898' }}>/100</span>
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, color: '#1A140E', marginBottom: 4 }}>
                Overall Readiness
              </div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#7A6B5D', lineHeight: 1.5 }}>
                Based on your last 5 rides. You're in the top 30% of riders at this stage.
              </div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#7D9B76', marginTop: 4 }}>
                ↑ +8pts over 4 weeks
              </div>
            </div>
          </div>

          {/* Top 3 sparklines */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
              Top 3 Metrics — Last 5 Rides
            </div>
            {[
              { key: 'core', label: 'Core Stability', color: '#7D9B76' },
              { key: 'upperBody', label: 'Upper Body', color: '#6B7FA3' },
              { key: 'lowerLeg', label: 'Lower Leg', color: '#8C5A3C' },
            ].map(m => {
              const data = SPARKLINE_DATA[m.key];
              const latest = data[data.length - 1];
              const delta = latest - data[0];
              return (
                <div key={m.key} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 0', borderBottom: '1px solid #F0EBE4',
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: 500, color: '#1A140E' }}>
                      {m.label}
                    </div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: '#B5A898' }}>
                      {latest}% · <span style={{ color: '#7D9B76' }}>↑ +{delta}pts</span>
                    </div>
                  </div>
                  <SparkLine data={data} color={m.color} />
                </div>
              );
            })}
          </div>

          {/* Symmetry */}
          <SymmetryBars scores={scores} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

function trendToBiometrics(d: typeof biometricsTrend[0]): BiometricsSnapshot {
  return {
    lowerLegStability: d.lowerLeg,
    reinSteadiness: d.reins,
    reinSymmetry: d.reins * 0.85,
    coreStability: d.core,
    upperBodyAlignment: d.upperBody,
    pelvisStability: d.pelvis,
  };
}

const GLOSSARY_POSITION = [
  { term: 'Lower Leg Stability', def: 'Ankle drift relative to hip-line and stirrup pressure consistency.' },
  { term: 'Rein Steadiness', def: 'Hand movement amplitude and smoothness of contact.' },
  { term: 'Rein Symmetry', def: 'Left/right balance and lateral drift patterns.' },
  { term: 'Core Stability', def: 'Torso angle consistency and absorption of horse movement.' },
  { term: 'Upper Body Alignment', def: 'Shoulder-hip-heel line and forward/backward lean.' },
  { term: 'Pelvis Stability', def: 'Lateral tilt, rotational consistency, sitting trot absorption.' },
];

const GLOSSARY_QUALITY = [
  { term: 'Rhythm', def: 'Consistency of tempo across all gaits.' },
  { term: 'Relaxation', def: 'Freedom from tension in body and contact.' },
  { term: 'Contact', def: 'Steady, elastic connection through the reins.' },
  { term: 'Impulsion', def: 'Energy and thrust from the hindquarters.' },
  { term: 'Straightness', def: 'Alignment of forehand to hindquarters.' },
  { term: 'Balance', def: 'Self-carriage and distribution of weight.' },
];

const QUALITY_COLORS = ['#C9A96E', '#7D9B76', '#8C5A3C', '#C4714A', '#6B7FA3', '#B5A898'];

// ─────────────────────────────────────────────────────────
// MAIN INSIGHTS PAGE
// ─────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('trends');
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['lowerLeg', 'reins', 'core'])
  );
  const [showGlossary, setShowGlossary] = useState(false);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const latest = biometricsTrend[biometricsTrend.length - 1];
  const overallScore = Math.round(
    ((latest.lowerLeg + latest.reins + latest.core + latest.upperBody + latest.pelvis) / 5) * 100
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'trends', label: 'Trends' },
    { id: 'milestones', label: 'Milestones' },
    { id: 'patterns', label: 'Patterns' },
  ];

  return (
    <div style={{ background: '#FAF7F3', minHeight: '100%' }}>

      <div style={{ padding: '20px 20px 0' }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 400, color: '#1A140E', marginBottom: '4px' }}>
          Insights
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px' }}>
          <p style={{ fontSize: '12px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>
            4-week position overview
          </p>
          <button
            onClick={() => setShowGlossary(g => !g)}
            style={{
              background: showGlossary ? '#8C5A3C' : '#F0EBE4',
              border: 'none', borderRadius: '8px', padding: '3px 9px',
              cursor: 'pointer', fontSize: '10px', fontWeight: 600,
              color: showGlossary ? '#FAF7F3' : '#8C5A3C',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'all 0.15s',
            }}
          >
            ℹ️ Glossary
          </button>
        </div>

        {showGlossary && (
          <div style={{
            background: '#FFFFFF', borderRadius: '16px', padding: '16px',
            boxShadow: '0 2px 10px rgba(26,20,14,0.05)', marginBottom: '8px',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }}>
              Your Position
            </div>
            <p style={{ fontSize: '11px', color: '#7A6B5D', fontFamily: "'DM Sans', sans-serif", margin: '0 0 8px', lineHeight: 1.5 }}>
              How your body moves in the saddle. These 6 metrics capture your alignment, stability, and balance.
            </p>
            {GLOSSARY_POSITION.map(g => (
              <div key={g.term} style={{ padding: '4px 0', borderBottom: '1px solid #F0EBE4' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#1A140E', fontFamily: "'DM Sans', sans-serif" }}>{g.term}</span>
                <span style={{ fontSize: '10.5px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}> — {g.def}</span>
              </div>
            ))}
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginTop: '14px', marginBottom: '10px' }}>
              Riding Quality
            </div>
            <p style={{ fontSize: '11px', color: '#7A6B5D', fontFamily: "'DM Sans', sans-serif", margin: '0 0 8px', lineHeight: 1.5 }}>
              The classical training scales that describe the quality of your horse's way of going, directly influenced by your position.
            </p>
            {GLOSSARY_QUALITY.map(g => (
              <div key={g.term} style={{ padding: '4px 0', borderBottom: '1px solid #F0EBE4' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#1A140E', fontFamily: "'DM Sans', sans-serif" }}>{g.term}</span>
                <span style={{ fontSize: '10.5px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}> — {g.def}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: '#FFFFFF', borderRadius: '12px', padding: '8px 14px',
          boxShadow: '0 2px 8px rgba(26,20,14,0.06)', marginBottom: '16px',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7D9B76' }} />
          <span style={{ fontSize: '13px', color: '#1A140E', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
            Overall score
          </span>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontSize: '15px',
            fontWeight: 500, color: '#8C5A3C', marginLeft: '4px',
          }}>
            {overallScore}%
          </span>
          <span style={{ fontSize: '10px', color: '#7D9B76', fontFamily: "'DM Sans', sans-serif" }}>
            ↑ 4wk
          </span>
        </div>
      </div>

      <div style={{ padding: '0 20px 28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        <CadenceInsightCard text={cadenceInsights.insights} />

        {/* ── BODY VISUALIZATION SECTION (Card #58) ── */}
        <div style={{
          background: '#FFFFFF', borderRadius: '20px', padding: '20px',
          boxShadow: '0 2px 12px rgba(26,20,14,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#1A140E' }}>
              Body Analysis
            </span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#B5A898' }}>
              latest session
            </span>
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#B5A898', margin: '0 0 16px' }}>
            Colour-coded zones show your score per body region. Tap a metric for detail.
          </p>

          {/* Body diagram */}
          <RiderBodyDiagram scores={BODY_SCORES} />

          {/* Score chips */}
          <div style={{ marginTop: 16 }}>
            <ScoreChipsRow scores={BODY_SCORES} />
          </div>
        </div>

        {/* ── 3-LAYER ANALYSIS ── */}
        <div style={{
          background: '#FFFFFF', borderRadius: '20px', padding: '16px 16px 20px',
          boxShadow: '0 2px 12px rgba(26,20,14,0.07)',
        }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#1A140E', marginBottom: 4 }}>
            Deep Analysis
          </div>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', color: '#B5A898', margin: '0 0 14px' }}>
            Three layers: raw biomechanics, training scales, and performance readiness.
          </p>
          <AnalysisLayerTabs scores={BODY_SCORES} />
        </div>

        {/* ── TABS (Trends / Milestones / Patterns) ── */}
        <div style={{
          display: 'flex', gap: '4px',
          background: '#F0EBE4', borderRadius: '12px', padding: '4px',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1, padding: '7px 4px',
                background: activeTab === tab.id ? '#FFFFFF' : 'transparent',
                border: 'none', borderRadius: '9px', cursor: 'pointer',
                fontSize: '12px', fontWeight: activeTab === tab.id ? 600 : 400,
                color: activeTab === tab.id ? '#8C5A3C' : '#B5A898',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.15s ease',
                boxShadow: activeTab === tab.id ? '0 1px 4px rgba(26,20,14,0.08)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'trends' && (
          <>
            {/* ── Your Position — Movement Trends ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, marginTop: 4 }}>
              <span style={{ fontSize: 20 }}>🧍</span>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#1A140E' }}>Your Position</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#B5A898' }}>Movement Trends</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {METRIC_CONFIG.map(({ key, label, color }) => {
                const active = activeMetrics.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleMetric(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                      border: `1.5px solid ${active ? color : '#EDE7DF'}`,
                      background: active ? `${color}18` : '#FFFFFF',
                      fontSize: '11px', fontFamily: "'DM Sans', sans-serif",
                      color: active ? color : '#B5A898',
                      fontWeight: active ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? color : '#EDE7DF' }} />
                    {label}
                  </button>
                );
              })}
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }}>
                Score Over Time (0–100%)
              </div>
              <TrendChart data={biometricsTrend} activeMetrics={activeMetrics} />
              <div style={{ fontSize: '9px', color: '#B5A898', fontFamily: "'DM Mono', monospace", marginTop: '8px', textAlign: 'right' }}>
                AI-assisted · Sample data
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.14em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", marginBottom: '4px' }}>
                Latest Snapshot
              </div>
              {METRIC_CONFIG.map(({ key, label, color }) => (
                <MetricSummaryRow key={key} metricKey={key} label={label} color={color} data={biometricsTrend} />
              ))}
            </div>

            {/* ── Riding Quality — The Scales Over Time ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2, marginTop: 12 }}>
              <span style={{ fontSize: 20 }}>🎯</span>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#1A140E' }}>Riding Quality</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#B5A898' }}>The Scales Over Time</div>
              </div>
            </div>

            <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '14px 16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
              {(() => {
                const latestBio = trendToBiometrics(latest);
                const firstBio = trendToBiometrics(biometricsTrend[0]);
                const latestQ = computeRidingQualities(latestBio);
                const firstQ = computeRidingQualities(firstBio);
                return latestQ.map((q, i) => {
                  const delta = q.score - firstQ[i].score;
                  const trend = delta > 0.02 ? 'up' : delta < -0.02 ? 'down' : 'flat';
                  const trendColor = trend === 'up' ? '#7D9B76' : trend === 'down' ? '#C4714A' : '#C9A96E';
                  const trendSymbol = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
                  const pct = Math.round(q.score * 100);
                  return (
                    <div key={q.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: i < latestQ.length - 1 ? '1px solid #F0EBE4' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: QUALITY_COLORS[i], flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12.5px', color: '#1A140E', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                          {q.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>
                          {pct}% · <span style={{ color: trendColor }}>{trendSymbol} {Math.abs(Math.round(delta * 100))}pts</span>
                        </div>
                      </div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '14px', fontWeight: 500, color: QUALITY_COLORS[i] }}>
                        {pct}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}

        {activeTab === 'milestones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {mockGoal.milestones.map(ms => {
              const stateColor = ms.state === 'mastered' ? '#7D9B76' : ms.state === 'working' ? '#C9A96E' : '#EDE7DF';
              const progress = ms.state === 'mastered' ? 1 : ms.ridesConsistent / ms.ridesRequired;
              return (
                <div key={ms.id} style={{
                  background: '#FFFFFF', borderRadius: '16px', padding: '14px 16px',
                  boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#1A140E' }}>
                      {ms.name}
                    </div>
                    <div style={{
                      fontSize: '9px', fontWeight: 600, letterSpacing: '0.1em',
                      textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif",
                      color: stateColor, background: `${stateColor}18`,
                      padding: '2px 8px', borderRadius: '6px',
                    }}>
                      {ms.state === 'mastered' ? 'Mastered' : ms.state === 'working' ? 'In progress' : 'Not started'}
                    </div>
                  </div>

                  {ms.state !== 'untouched' && (
                    <>
                      <div style={{ height: '4px', background: '#F0EBE4', borderRadius: '2px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ height: '100%', width: `${progress * 100}%`, background: stateColor, borderRadius: '2px', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: '#B5A898', fontFamily: "'DM Mono', monospace" }}>
                        {ms.state === 'mastered' ? '5/5 rides consistent' : `${ms.ridesConsistent}/${ms.ridesRequired} rides consistent`}
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {ms.biomechanicsFocus.slice(0, 2).map(f => (
                      <span key={f} style={{
                        fontSize: '9.5px', color: '#6B7FA3', background: '#EEF2F8',
                        padding: '2px 7px', borderRadius: '6px',
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'patterns' && <PatternsTab />}

      </div>
    </div>
  );
}
