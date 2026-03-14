import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockRides, mockGoal } from '../data/mock';
import type { Ride, BiometricsSnapshot } from '../data/mock';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { computeRidingQualities, generateInsights } from '../lib/poseAnalysis';
import type { MovementInsight } from '../lib/poseAnalysis';
import { saveRide, getRides } from '../lib/storage';
import type { StoredRide } from '../lib/storage';
import { getUserProfile, isProfileComplete, getHorseName } from '../lib/userProfile';
import VideoSilhouetteOverlay from '../components/VideoSilhouetteOverlay';
import ProfileSetupModal from '../components/ProfileSetupModal';

// ─────────────────────────────────────────────────────────
const COLORS = {
  parchment:  '#FAF7F3',
  cognac:     '#8C5A3C',
  champagne:  '#C9A96E',
  green:      '#7D9B76',
  attention:  '#C4714A',
  charcoal:   '#1A140E',
  muted:      '#B5A898',
  border:     '#EDE7DF',
  cardBg:     '#FFFFFF',
  softBg:     '#F0EBE4',
  cadence:    '#6B7FA3',
};

const FONTS = {
  heading: "'Playfair Display', serif",
  body:    "'DM Sans', sans-serif",
  mono:    "'DM Mono', monospace",
};

const signalConfig = {
  improving:    { color: COLORS.green,     symbol: '↑', label: 'Improving' },
  consistent:   { color: COLORS.champagne, symbol: '→', label: 'Consistent' },
  'needs-work': { color: COLORS.attention, symbol: '↓', label: 'Needs work' },
};

const getSignal = (signal: string | undefined) =>
  signalConfig[signal as keyof typeof signalConfig] ?? signalConfig.consistent;

const rideTypeLabel: Record<string, string> = {
  training:    '🐎 Training',
  lesson:      '👩‍🏫 Lesson',
  'mock-test': '📋 Mock Test',
  hack:        '🌳 Hack',
};

function scoreColor(score: number): string {
  if (score >= 0.80) return COLORS.green;
  if (score >= 0.60) return COLORS.champagne;
  return COLORS.attention;
}

function scoreLabel(score: number): string {
  if (score >= 0.85) return 'Excellent';
  if (score >= 0.70) return 'Good';
  if (score >= 0.55) return 'Developing';
  return 'Focus area';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Card #59 — allowed formats + size threshold
const ALLOWED_FORMATS = ['video/mp4', 'video/quicktime', 'video/avi', 'video/x-msvideo'];
const SIZE_WARN_MB = 500;

// Card #59 — cycling processing messages
const PROCESSING_MESSAGES = [
  'Reading your ride…',
  'Analyzing movement…',
  'Calculating scores…',
];

// ─────────────────────────────────────────────────────────
// CAMERA TIPS CHIPS (#59)
// ─────────────────────────────────────────────────────────

function CameraTips() {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
      {[
        { icon: '📐', text: 'Side view works best' },
        { icon: '☀️', text: 'Good lighting helps' },
        { icon: '📱', text: 'Any orientation works' },
      ].map(tip => (
        <div
          key={tip.text}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            background: 'rgba(201,169,110,0.12)',
            border: '1px solid rgba(201,169,110,0.35)',
            borderRadius: '20px', padding: '5px 10px',
            fontSize: '11px', color: '#7A6B5D',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <span style={{ fontSize: '12px' }}>{tip.icon}</span>
          {tip.text}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// BRANDED PULSE (#60)
// ─────────────────────────────────────────────────────────

function BrandedPulse() {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: '#C9A96E',
            animation: `champagnePulse 1.4s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MOCK DATA FOR RIDE DETAIL
// ─────────────────────────────────────────────────────────

const MOCK_DETAIL_BIO: BiometricsSnapshot = {
  lowerLegStability:  0.72,
  reinSteadiness:     0.68,
  reinSymmetry:       0.59,
  coreStability:      0.88,
  upperBodyAlignment: 0.81,
  pelvisStability:    0.74,
};

const METRIC_DETAIL_CONFIG = [
  {
    key: 'lowerLegStability' as keyof BiometricsSnapshot,
    label: 'Lower Leg Stability',
    shortLabel: 'Lower Leg',
    score: 72,
    trend: '↑' as const,
    trendDir: 'up' as const,
    insight: 'Minor drift detected on left rein — improves in second half of ride.',
  },
  {
    key: 'reinSteadiness' as keyof BiometricsSnapshot,
    label: 'Rein Steadiness',
    shortLabel: 'Rein Steady',
    score: 68,
    trend: '→' as const,
    trendDir: 'flat' as const,
    insight: 'Consistent through walk and canter; some bounce visible in rising trot.',
  },
  {
    key: 'reinSymmetry' as keyof BiometricsSnapshot,
    label: 'Rein Symmetry',
    shortLabel: 'Symmetry',
    score: 59,
    trend: '↓' as const,
    trendDir: 'down' as const,
    insight: 'Right hand sits 2–3cm higher. Watch elbow angle on right rein transitions.',
  },
  {
    key: 'coreStability' as keyof BiometricsSnapshot,
    label: 'Core Stability',
    shortLabel: 'Core',
    score: 88,
    trend: '↑' as const,
    trendDir: 'up' as const,
    insight: 'Your strongest metric. Torso steady through all gait transitions.',
  },
  {
    key: 'upperBodyAlignment' as keyof BiometricsSnapshot,
    label: 'Upper Body Alignment',
    shortLabel: 'Upper Body',
    score: 81,
    trend: '↑' as const,
    trendDir: 'up' as const,
    insight: 'Shoulder–hip–heel line clean throughout. Slight forward lean on downward transitions.',
  },
  {
    key: 'pelvisStability' as keyof BiometricsSnapshot,
    label: 'Pelvis Stability',
    shortLabel: 'Pelvis',
    score: 74,
    trend: '→' as const,
    trendDir: 'flat' as const,
    insight: 'Good sitting trot absorption. Some lateral tilt visible in canter left.',
  },
];

// ─────────────────────────────────────────────────────────
// RIDE DETAIL — HERO SCORE CIRCLE
// ─────────────────────────────────────────────────────────

function HeroScoreCircle({
  value,
  label,
  size = 88,
  strokeWidth = 7,
  color,
}: {
  value: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value / 100);
  const c = color || scoreColor(value / 100);
  const cx = size / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={COLORS.softBg} strokeWidth={strokeWidth} />
          <circle
            cx={cx} cy={cx} r={r}
            fill="none"
            stroke={c}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.9s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: size > 80 ? '22px' : '16px', fontWeight: 700, color: c, lineHeight: 1 }}>
            {value}
          </span>
          <span style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, lineHeight: 1, marginTop: 2 }}>
            /100
          </span>
        </div>
      </div>
      <span style={{ fontFamily: FONTS.body, fontSize: '11px', color: COLORS.muted, fontWeight: 500, textAlign: 'center' }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RIDE DETAIL — PER-METRIC CARD
// ─────────────────────────────────────────────────────────

function MetricDetailCard({
  label,
  score,
  trend,
  trendDir,
  insight,
}: {
  label: string;
  score: number;
  trend: '↑' | '↓' | '→';
  trendDir: 'up' | 'down' | 'flat';
  insight: string;
}) {
  const sc = scoreColor(score / 100);
  const trendColor = trendDir === 'up' ? COLORS.green : trendDir === 'down' ? COLORS.attention : COLORS.champagne;
  const barWidth = `${score}%`;

  return (
    <div style={{
      background: COLORS.cardBg, borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
      borderLeft: `3px solid ${sc}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: FONTS.body, fontSize: '12.5px', fontWeight: 600, color: COLORS.charcoal }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: '15px', fontWeight: 700, color: sc }}>{score}</span>
          <span style={{
            fontFamily: FONTS.mono, fontSize: '13px', color: trendColor,
            background: `${trendColor}15`, borderRadius: 6, padding: '1px 5px',
            fontWeight: 600,
          }}>{trend}</span>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ height: 4, background: COLORS.softBg, borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', width: barWidth, background: sc,
          borderRadius: 2, transition: 'width 0.7s ease',
        }} />
      </div>

      {/* Color indicator chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc, flexShrink: 0 }} />
        <span style={{ fontFamily: FONTS.mono, fontSize: '9px', color: sc, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {scoreLabel(score / 100)}
        </span>
      </div>

      <p style={{ fontFamily: FONTS.body, fontSize: '11.5px', color: '#7A6B5D', lineHeight: 1.5, margin: 0 }}>
        {insight}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RIDE DETAIL — KEY MOMENTS
// ─────────────────────────────────────────────────────────

function KeyMomentsSection({ duration }: { duration: number }) {
  const bestTs = Math.floor(duration * 60 * 0.38);
  const needsTs = Math.floor(duration * 60 * 0.67);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
        <span style={{ fontFamily: FONTS.heading, fontSize: 15, color: COLORS.charcoal }}>Key Moments</span>
      </div>

      <div style={{
        background: `${COLORS.green}10`, borderRadius: 14, padding: '12px 14px',
        border: `1px solid ${COLORS.green}30`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: `${COLORS.green}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>⭐</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontFamily: FONTS.body, fontSize: '12px', fontWeight: 600, color: COLORS.green }}>Best Moment</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted, background: COLORS.softBg, padding: '2px 6px', borderRadius: 6 }}>
              {fmt(bestTs)}
            </span>
          </div>
          <p style={{ fontFamily: FONTS.body, fontSize: '11.5px', color: '#5A7A56', lineHeight: 1.5, margin: 0 }}>
            Extended trot — shoulder-in left. Core and upper body in excellent alignment. Horse working through from behind.
          </p>
        </div>
      </div>

      <div style={{
        background: `${COLORS.attention}08`, borderRadius: 14, padding: '12px 14px',
        border: `1px solid ${COLORS.attention}25`,
        display: 'flex', alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: `${COLORS.attention}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>🎯</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontFamily: FONTS.body, fontSize: '12px', fontWeight: 600, color: COLORS.attention }}>Needs Work</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted, background: COLORS.softBg, padding: '2px 6px', borderRadius: 6 }}>
              {fmt(needsTs)}
            </span>
          </div>
          <p style={{ fontFamily: FONTS.body, fontSize: '11.5px', color: '#7A5A4A', lineHeight: 1.5, margin: 0 }}>
            Canter–trot transition right rein. Right hand tension causing rein asymmetry spike. Loss of inside leg contact.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RIDE DETAIL — ACTIONABLE TIPS
// ─────────────────────────────────────────────────────────

function ActionableTips({ bio }: { bio: BiometricsSnapshot }) {
  // Find 3 lowest-scoring metrics
  const metrics = [
    { key: 'lowerLegStability' as keyof BiometricsSnapshot, label: 'Lower Leg Stability', score: bio.lowerLegStability },
    { key: 'reinSteadiness' as keyof BiometricsSnapshot, label: 'Rein Steadiness', score: bio.reinSteadiness },
    { key: 'reinSymmetry' as keyof BiometricsSnapshot, label: 'Rein Symmetry', score: bio.reinSymmetry },
    { key: 'coreStability' as keyof BiometricsSnapshot, label: 'Core Stability', score: bio.coreStability },
    { key: 'upperBodyAlignment' as keyof BiometricsSnapshot, label: 'Upper Body Alignment', score: bio.upperBodyAlignment },
    { key: 'pelvisStability' as keyof BiometricsSnapshot, label: 'Pelvis Stability', score: bio.pelvisStability },
  ].sort((a, b) => a.score - b.score);

  const tipMap: Record<string, { tip: string; drill: string }> = {
    lowerLegStability:  { tip: 'Anchor your lower leg', drill: 'Try 10 minutes of stirrup-less walk and trot to reset your ankle position.' },
    reinSteadiness:     { tip: 'Soften the contact', drill: 'Tunnel rein exercise: thread reins through a loop so hands can\'t cross the midline.' },
    reinSymmetry:       { tip: 'Level your elbows', drill: 'Place a crop across your forearms to monitor left–right height before each set.' },
    coreStability:      { tip: 'Engage the deep core', drill: 'Practise breathing into your lower back through every gait transition.' },
    upperBodyAlignment: { tip: 'Sit tall through transitions', drill: 'Pick a spot ahead and keep eyes level. Ask your trainer to watch your downward transitions.' },
    pelvisStability:    { tip: 'Follow the swing, don\'t grip', drill: 'Loosen hip flexors: 5-minute lunge in walk before each ride, focus on pelvis follow-through.' },
  };

  const tips = metrics.slice(0, 3).map(m => ({ label: m.label, ...tipMap[m.key] }));

  return (
    <div>
      <div style={{ fontFamily: FONTS.heading, fontSize: 15, color: COLORS.charcoal, marginBottom: 10 }}>
        Actionable Tips
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tips.map((t, i) => (
          <div key={i} style={{
            background: COLORS.cardBg, borderRadius: 14, padding: '12px 14px',
            boxShadow: '0 2px 8px rgba(26,20,14,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: `${COLORS.cognac}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: FONTS.mono, fontSize: '10px', fontWeight: 700, color: COLORS.cognac,
                flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONTS.body, fontSize: '12px', fontWeight: 600, color: COLORS.charcoal, marginBottom: 2 }}>
                  {t.tip}
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.champagne, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  {t.label}
                </div>
                <p style={{ fontFamily: FONTS.body, fontSize: '11px', color: '#7A6B5D', lineHeight: 1.5, margin: 0 }}>
                  {t.drill}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RIDE DETAIL — GAIT BREAKDOWN
// ─────────────────────────────────────────────────────────

function GaitBreakdown({ duration }: { duration: number }) {
  const gaits = [
    { name: 'Walk', pct: 22, color: COLORS.cadence },
    { name: 'Trot', pct: 51, color: COLORS.champagne },
    { name: 'Canter', pct: 27, color: COLORS.cognac },
  ];

  return (
    <div style={{
      background: COLORS.cardBg, borderRadius: 16, padding: '14px 16px',
      boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
    }}>
      <div style={{ fontFamily: FONTS.mono, fontSize: '10px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        Gait Breakdown
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
        {gaits.map(g => (
          <div key={g.name} style={{ width: `${g.pct}%`, background: g.color, transition: 'width 0.6s ease' }} />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {gaits.map(g => (
          <div key={g.name} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '16px', fontWeight: 700, color: g.color }}>{g.pct}%</div>
            <div style={{ fontFamily: FONTS.body, fontSize: '10px', color: COLORS.muted }}>{g.name}</div>
            <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, marginTop: 1 }}>
              {Math.round(duration * 60 * g.pct / 100 / 60)}m {Math.round((duration * 60 * g.pct / 100) % 60)}s
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RICH RIDE DETAIL VIEW — CARD #56
// ─────────────────────────────────────────────────────────

function RideDetailView({
  ride,
  storedRide,
  onClose,
}: {
  ride: Ride;
  storedRide?: StoredRide;
  onClose: () => void;
}) {
  const bio = storedRide?.biometrics ?? ride.biometrics ?? MOCK_DETAIL_BIO;
  const effectiveBio = bio || MOCK_DETAIL_BIO;

  const qualities = computeRidingQualities(effectiveBio);
  const d = new Date(ride.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const overallRaw = storedRide?.overallScore
    ?? (Object.values(effectiveBio).reduce((a, b) => a + b, 0) / Object.values(effectiveBio).length);
  const overallPct = Math.round(overallRaw * 100);

  // Movement score = avg of the 3 movement-related metrics
  const movementPct = Math.round(
    ((effectiveBio.lowerLegStability + effectiveBio.reinSteadiness + effectiveBio.coreStability) / 3) * 100
  );
  // Position score = avg of position-related metrics
  const positionPct = Math.round(
    ((effectiveBio.upperBodyAlignment + effectiveBio.pelvisStability + effectiveBio.reinSymmetry) / 3) * 100
  );

  // Build metric cards with live bio scores
  const metricCards = [
    {
      key: 'lowerLegStability' as keyof BiometricsSnapshot,
      label: 'Lower Leg Stability',
      score: Math.round(effectiveBio.lowerLegStability * 100),
      trend: effectiveBio.lowerLegStability >= 0.75 ? '↑' : effectiveBio.lowerLegStability >= 0.60 ? '→' : '↓',
      trendDir: effectiveBio.lowerLegStability >= 0.75 ? 'up' : effectiveBio.lowerLegStability >= 0.60 ? 'flat' : 'down',
      insight: METRIC_DETAIL_CONFIG[0].insight,
    },
    {
      key: 'reinSteadiness' as keyof BiometricsSnapshot,
      label: 'Rein Steadiness',
      score: Math.round(effectiveBio.reinSteadiness * 100),
      trend: effectiveBio.reinSteadiness >= 0.75 ? '↑' : effectiveBio.reinSteadiness >= 0.60 ? '→' : '↓',
      trendDir: effectiveBio.reinSteadiness >= 0.75 ? 'up' : effectiveBio.reinSteadiness >= 0.60 ? 'flat' : 'down',
      insight: METRIC_DETAIL_CONFIG[1].insight,
    },
    {
      key: 'reinSymmetry' as keyof BiometricsSnapshot,
      label: 'Rein Symmetry',
      score: Math.round(effectiveBio.reinSymmetry * 100),
      trend: effectiveBio.reinSymmetry >= 0.75 ? '↑' : effectiveBio.reinSymmetry >= 0.60 ? '→' : '↓',
      trendDir: effectiveBio.reinSymmetry >= 0.75 ? 'up' : effectiveBio.reinSymmetry >= 0.60 ? 'flat' : 'down',
      insight: METRIC_DETAIL_CONFIG[2].insight,
    },
    {
      key: 'coreStability' as keyof BiometricsSnapshot,
      label: 'Core Stability',
      score: Math.round(effectiveBio.coreStability * 100),
      trend: effectiveBio.coreStability >= 0.82 ? '↑' : effectiveBio.coreStability >= 0.65 ? '→' : '↓',
      trendDir: effectiveBio.coreStability >= 0.82 ? 'up' : effectiveBio.coreStability >= 0.65 ? 'flat' : 'down',
      insight: METRIC_DETAIL_CONFIG[3].insight,
    },
    {
      key: 'upperBodyAlignment' as keyof BiometricsSnapshot,
      label: 'Upper Body Alignment',
      score: Math.round(effectiveBio.upperBodyAlignment * 100),
      trend: effectiveBio.upperBodyAlignment >= 0.78 ? '↑' : effectiveBio.upperBodyAlignment >= 0.60 ? '→' : '↓',
      trendDir: effectiveBio.upperBodyAlignment >= 0.78 ? 'up' : effectiveBio.upperBodyAlignment >= 0.60 ? 'flat' : 'down',
      insight: METRIC_DETAIL_CONFIG[4].insight,
    },
    {
      key: 'pelvisStability' as keyof BiometricsSnapshot,
      label: 'Pelvis Stability',
      score: Math.round(effectiveBio.pelvisStability * 100),
      trend: effectiveBio.pelvisStability >= 0.75 ? '↑' : effectiveBio.pelvisStability >= 0.60 ? '→' : '↓',
      trendDir: effectiveBio.pelvisStability >= 0.75 ? 'up' : effectiveBio.pelvisStability >= 0.60 ? 'flat' : 'down',
      insight: METRIC_DETAIL_CONFIG[5].insight,
    },
  ] as { key: keyof BiometricsSnapshot; label: string; score: number; trend: '↑'|'↓'|'→'; trendDir: 'up'|'down'|'flat'; insight: string }[];

  const discipline = ride.type === 'mock-test' ? 'Dressage' : ride.type === 'hack' ? 'Hacking' : 'Flatwork';

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 100, background: COLORS.parchment,
      animation: 'slideInRight 0.25s ease-out',
      overflowY: 'auto',
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes detailFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Sticky Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 20px',
        paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.parchment, position: 'sticky', top: 0, zIndex: 2,
        backdropFilter: 'blur(8px)',
      }}>
        <button
          onClick={onClose}
          style={{
            background: COLORS.softBg, border: 'none', cursor: 'pointer', padding: '6px 8px',
            display: 'flex', alignItems: 'center', borderRadius: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={COLORS.charcoal} strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: '15px', color: COLORS.charcoal }}>
            {rideTypeLabel[ride.type] ?? ride.type} · {ride.horse || getHorseName('Horse')}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted }}>
            {dateStr}
          </div>
        </div>
        <div style={{
          background: `${scoreColor(overallRaw)}15`, color: scoreColor(overallRaw),
          padding: '5px 12px', borderRadius: 10,
          fontFamily: FONTS.mono, fontSize: '14px', fontWeight: 700,
        }}>
          {overallPct}
        </div>
      </div>

      <div style={{ padding: '0 0 40px', animation: 'detailFadeIn 0.35s ease' }}>

        {/* ── 1. VIDEO THUMBNAIL / PLACEHOLDER ── */}
        <div style={{
          width: '100%', aspectRatio: '16/9',
          background: 'linear-gradient(135deg, #1C1510 0%, #3A2518 50%, #1C1510 100%)',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Decorative overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse at 60% 40%, rgba(201,169,110,0.12) 0%, transparent 60%)',
          }} />
          {/* Content */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 8,
          }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect x="3" y="5" width="30" height="26" rx="4" stroke="rgba(201,169,110,0.5)" strokeWidth="1.5" />
              <path d="M15 12l10 6-10 6V12z" fill="rgba(201,169,110,0.7)" />
            </svg>
            <span style={{ fontFamily: FONTS.body, fontSize: '12px', color: 'rgba(250,247,243,0.5)' }}>
              {ride.horse || getHorseName('Horse')} · {discipline}
            </span>
            <span style={{ fontFamily: FONTS.mono, fontSize: '10px', color: 'rgba(201,169,110,0.6)' }}>
              {dateStr} · {ride.duration}min
            </span>
          </div>
        </div>

        {/* ── 2. HERO SCORES ── */}
        <div style={{
          background: COLORS.cardBg, margin: '0 0 0',
          padding: '22px 20px 20px',
          boxShadow: '0 2px 12px rgba(26,20,14,0.07)',
        }}>
          <div style={{ fontFamily: FONTS.mono, fontSize: '10px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 16 }}>
            Analysis Results
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
            <HeroScoreCircle value={overallPct} label="Overall" size={92} strokeWidth={7} />
            <HeroScoreCircle value={movementPct} label="Movement" size={80} strokeWidth={6} color={COLORS.cadence} />
            <HeroScoreCircle value={positionPct} label="Position" size={80} strokeWidth={6} color={COLORS.champagne} />
          </div>
        </div>

        {/* ── 3. PER-METRIC BREAKDOWN ── */}
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: FONTS.heading, fontSize: 17, color: COLORS.charcoal }}>Metric Breakdown</span>
            <span style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted }}>6 Tier-1 metrics</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {metricCards.map(m => (
              <MetricDetailCard
                key={m.key}
                label={m.label}
                score={m.score}
                trend={m.trend}
                trendDir={m.trendDir}
                insight={m.insight}
              />
            ))}
          </div>
        </div>

        {/* ── 4. KEY MOMENTS ── */}
        <div style={{ padding: '20px 16px 0' }}>
          <KeyMomentsSection duration={ride.duration} />
        </div>

        {/* ── 5. ACTIONABLE TIPS ── */}
        <div style={{ padding: '20px 16px 0' }}>
          <ActionableTips bio={effectiveBio} />
        </div>

        {/* ── 6. METADATA ── */}
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 15, color: COLORS.charcoal, marginBottom: 10 }}>
            Session Info
          </div>

          <div style={{
            background: COLORS.cardBg, borderRadius: 16, padding: '14px 16px',
            boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
          }}>
            {/* Metadata grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 14 }}>
              {[
                { label: 'Date', value: dateStr },
                { label: 'Duration', value: `${ride.duration} min` },
                { label: 'Discipline', value: discipline },
                { label: 'Horse', value: ride.horse || getHorseName('Horse') },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>
                    {item.label}
                  </div>
                  <div style={{ fontFamily: FONTS.body, fontSize: '13px', color: COLORS.charcoal, fontWeight: 500 }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Signal chip */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: `${getSignal(ride.signal).color}14`,
              border: `1px solid ${getSignal(ride.signal).color}30`,
              padding: '5px 10px', borderRadius: 20,
            }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: 14, color: getSignal(ride.signal).color }}>
                {getSignal(ride.signal).symbol}
              </span>
              <span style={{ fontFamily: FONTS.body, fontSize: '11px', fontWeight: 500, color: getSignal(ride.signal).color }}>
                {getSignal(ride.signal).label}
              </span>
            </div>
          </div>
        </div>

        {/* ── 7. GAIT BREAKDOWN ── */}
        <div style={{ padding: '20px 16px 0' }}>
          <GaitBreakdown duration={ride.duration} />
        </div>

        {/* ── 8. RIDING QUALITIES ── */}
        <div style={{ padding: '20px 16px 0' }}>
          <div style={{ fontFamily: FONTS.heading, fontSize: 15, color: COLORS.charcoal, marginBottom: 10 }}>
            Riding Quality
          </div>
          <div style={{ background: COLORS.cardBg, borderRadius: 16, padding: '14px 16px', boxShadow: '0 2px 10px rgba(26,20,14,0.05)' }}>
            {qualities.map((q, i) => {
              const qColor = ['#C9A96E','#7D9B76','#8C5A3C','#C4714A','#6B7FA3','#B5A898'][i];
              const pct = Math.round(q.score * 100);
              return (
                <div key={q.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < qualities.length - 1 ? '1px solid #F0EBE4' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: qColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontFamily: FONTS.body, fontSize: '12px', color: COLORS.charcoal, fontWeight: 500 }}>{q.name}</div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: '13px', fontWeight: 600, color: qColor }}>{pct}</div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// ADD RIDE FAB (#55) — Floating pill button — CARD 55 + 57
// ─────────────────────────────────────────────────────────

function AddRideFAB({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Add a new ride"
      style={{
        position: 'fixed',
        bottom: 'calc(160px + env(safe-area-inset-bottom, 0px))',
        right: '20px',
        height: 48,
        paddingLeft: 20,
        paddingRight: 20,
        borderRadius: 24,
        background: COLORS.cognac,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 20px rgba(140,90,60,0.35)',
        zIndex: 50,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.04)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(140,90,60,0.45)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(140,90,60,0.35)';
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="#FAF7F3" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: FONTS.body, fontSize: '14px', fontWeight: 600, color: '#FAF7F3' }}>
        Add Ride
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// ADD RIDE MODAL SHEET (#57)
// ─────────────────────────────────────────────────────────

type RideType = 'training' | 'lesson' | 'mock-test' | 'hack';

interface AddRideModalProps {
  open: boolean;
  onClose: () => void;
  onAddRide: (data: {
    type: RideType;
    horse: string;
    date: string;
    duration: number;
    notes: string;
  }) => void;
}

function AddRideModal({ open, onClose, onAddRide }: AddRideModalProps) {
  const [rideType, setRideType] = useState<RideType>('training');
  const [horse, setHorse] = useState(() => getHorseName(''));
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(45);
  const [notes, setNotes] = useState('');

  if (!open) return null;

  const handleSubmit = () => {
    if (!horse.trim()) return;
    onAddRide({ type: rideType, horse: horse.trim(), date, duration, notes });
    setHorse(''); setNotes('');
    onClose();
  };

  const rideTypes: { value: RideType; label: string; emoji: string }[] = [
    { value: 'training', label: 'Training', emoji: '🐎' },
    { value: 'lesson', label: 'Lesson', emoji: '👩‍🏫' },
    { value: 'mock-test', label: 'Mock Test', emoji: '📋' },
    { value: 'hack', label: 'Hack', emoji: '🌳' },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,14,0.3)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        background: COLORS.parchment,
        borderRadius: '28px 28px 0 0',
        zIndex: 61,
        padding: '0 0 env(safe-area-inset-bottom, 24px)',
        boxShadow: '0 -8px 32px rgba(26,20,14,0.12)',
        animation: 'slideUp 0.25s ease-out',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, paddingBottom: 8 }}>
          <div style={{ width: 36, height: 4, background: COLORS.border, borderRadius: 2 }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 20px 16px' }}>
          <span style={{ fontFamily: FONTS.heading, fontSize: '18px', color: COLORS.charcoal }}>New Ride</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: COLORS.muted, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto', paddingBottom: 20 }}>

          {/* Type selector */}
          <div>
            <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Ride type</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {rideTypes.map(rt => (
                <button
                  key={rt.value}
                  onClick={() => setRideType(rt.value)}
                  style={{
                    padding: '10px', borderRadius: 12,
                    border: rideType === rt.value ? `2px solid ${COLORS.cognac}` : `1.5px solid ${COLORS.border}`,
                    background: rideType === rt.value ? `${COLORS.cognac}10` : COLORS.cardBg,
                    cursor: 'pointer', fontFamily: FONTS.body, fontSize: '13px',
                    color: rideType === rt.value ? COLORS.cognac : COLORS.charcoal,
                    fontWeight: rideType === rt.value ? 600 : 400,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: '16px' }}>{rt.emoji}</span>
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horse name */}
          <div>
            <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Horse</div>
            <input
              type="text" value={horse}
              onChange={e => setHorse(e.target.value)}
              placeholder="e.g. Caviar"
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.cardBg, fontSize: '14px', fontFamily: FONTS.body, color: COLORS.charcoal, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Date + Duration row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Date</div>
              <input
                type="date" value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '11px 10px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.cardBg, fontSize: '13px', fontFamily: FONTS.body, color: COLORS.charcoal, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Duration (min)</div>
              <input
                type="number" value={duration} min={5} max={300}
                onChange={e => setDuration(Number(e.target.value))}
                style={{ width: '100%', padding: '11px 10px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.cardBg, fontSize: '14px', fontFamily: FONTS.body, color: COLORS.charcoal, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <div style={{ fontFamily: FONTS.mono, fontSize: '9px', color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Notes <span style={{ color: COLORS.border }}>(optional)</span></div>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="How did it go?"
              rows={3}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1.5px solid ${COLORS.border}`, background: COLORS.cardBg, fontSize: '13px', fontFamily: FONTS.body, color: COLORS.charcoal, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!horse.trim()}
            style={{
              width: '100%', padding: '14px', borderRadius: 12,
              background: horse.trim() ? COLORS.cognac : '#D4C9BC',
              border: 'none', cursor: horse.trim() ? 'pointer' : 'default',
              fontFamily: FONTS.body, fontSize: '14px', fontWeight: 600,
              color: '#FAF7F3', transition: 'background 0.15s ease',
            }}
          >
            Log Ride
          </button>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// UPLOAD SHEET (#58 / #59)
// ─────────────────────────────────────────────────────────

interface UploadSheetProps {
  open: boolean;
  onClose: () => void;
  onVideoSelected: (file: File) => void;
  ride: Ride | null;
  storedRide: StoredRide | null;
}

function UploadSheet({ open, onClose, onVideoSelected, ride, storedRide }: UploadSheetProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationMsg, setValidationMsg] = useState<string | null>(null);

  if (!open || !ride) return null;

  const handleFile = (file: File) => {
    setValidationMsg(null);

    // #59 — format check
    if (!ALLOWED_FORMATS.includes(file.type)) {
      setValidationMsg('❌ Only MP4, MOV, or AVI files are supported for analysis.');
      return;
    }

    // #59 — size warning (soft)
    if (file.size > SIZE_WARN_MB * 1024 * 1024) {
      setValidationMsg(`⚠️ File is large (${formatFileSize(file.size)}). Analysis may take a while. Tap again to confirm.`);
      // still proceed — soft warning
    }

    onVideoSelected(file);
    onClose();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const dateStr = new Date(ride.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,20,14,0.35)', zIndex: 60 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '430px',
        background: COLORS.parchment,
        borderRadius: '24px 24px 0 0', zIndex: 61,
        padding: '0 0 env(safe-area-inset-bottom, 20px)',
        boxShadow: '0 -6px 30px rgba(26,20,14,0.12)',
        animation: 'slideUp 0.22s ease-out',
      }}>
        <style>{`@keyframes slideUp { from { transform: translateX(-50%) translateY(100%); } to { transform: translateX(-50%) translateY(0); } }`}</style>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 14, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, background: COLORS.border, borderRadius: 2 }} />
        </div>
        <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: FONTS.heading, fontSize: 17, color: COLORS.charcoal }}>Analyse Ride</div>
              <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted, marginTop: 2 }}>
                {ride.horse || getHorseName('Horse')} · {rideTypeLabel[ride.type] ?? ride.type} · {dateStr}
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted, fontSize: '20px' }}>×</button>
          </div>

          {storedRide?.videoBlob && (
            <div style={{
              background: `${COLORS.green}10`, border: `1px solid ${COLORS.green}30`,
              borderRadius: 12, padding: '10px 14px',
              fontFamily: FONTS.body, fontSize: 12, color: '#5A7A56',
            }}>
              ✓ This ride has been analysed. Upload a new video to re-analyse.
            </div>
          )}

          {/* Camera tips (#59) */}
          <CameraTips />

          {validationMsg && (
            <div style={{ fontFamily: FONTS.body, fontSize: '12px', color: validationMsg.startsWith('❌') ? COLORS.attention : '#C4714A', background: validationMsg.startsWith('❌') ? `${COLORS.attention}10` : `${COLORS.champagne}10`, borderRadius: 10, padding: '8px 12px' }}>
              {validationMsg}
            </div>
          )}

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{
              border: `2px dashed ${COLORS.champagne}`,
              borderRadius: 16, padding: '24px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              cursor: 'pointer', background: `${COLORS.champagne}06`,
              transition: 'background 0.15s',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: `${COLORS.cognac}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 15V3m0 0L8 7m4-4l4 4" stroke={COLORS.cognac} strokeWidth="2" strokeLinecap="round" />
                <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke={COLORS.cognac} strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: COLORS.charcoal }}>Choose video</div>
            <div style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.muted, textAlign: 'center' }}>
              MP4, MOV or AVI · any size
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleInputChange} />
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────

export default function RidesPage() {
  const navigate = useNavigate();
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedStoredRide, setSelectedStoredRide] = useState<StoredRide | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Ride | null>(null);
  const [uploadTargetStored, setUploadTargetStored] = useState<StoredRide | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [insights, setInsights] = useState<MovementInsight[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showAddRide, setShowAddRide] = useState(false);
  const [userRides, setUserRides] = useState<Ride[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(!isProfileComplete());
  const processMsgRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load stored rides
  useEffect(() => {
    const stored = getRides();
    if (stored.length > 0) {
      const converted: Ride[] = stored.map(s => ({
        id: s.id,
        date: s.date,
        horse: s.horse,
        type: s.type as Ride['type'],
        duration: s.duration,
        signal: (s as any).signal || 'consistent',
        tags: [],
        biometrics: s.biometrics,
      }));
      setUserRides(converted);
    }
  }, []);

  const { analyzeVideo } = useVideoAnalysis();

  const handleVideoSelected = async (file: File) => {
    if (!uploadTarget) return;
    setIsProcessing(true);
    setProcessingStep(0);
    setShowDetail(false);

    // Cycle through processing messages
    let step = 0;
    processMsgRef.current = setInterval(() => {
      step = (step + 1) % PROCESSING_MESSAGES.length;
      setProcessingStep(step);
    }, 1800);

    try {
      const result = await analyzeVideo(file);
      if (processMsgRef.current) clearInterval(processMsgRef.current);

      const bio: BiometricsSnapshot = result.biometrics;
      const qualities = computeRidingQualities(bio);
      const newInsights = generateInsights(bio);
      setInsights(newInsights);

      const videoBlob = file;
      const url = URL.createObjectURL(videoBlob);
      setVideoUrl(url);

      // Signal from analysis
      const overallScore = Object.values(bio).reduce((a, b) => a + b, 0) / Object.values(bio).length;
      const signal: 'improving' | 'consistent' | 'needs-work' =
        overallScore >= 0.75 ? 'improving' : overallScore >= 0.60 ? 'consistent' : 'needs-work';

      // Save to storage
      const storedRide: StoredRide = {
        id: uploadTarget.id,
        date: uploadTarget.date,
        horse: uploadTarget.horse,
        type: uploadTarget.type,
        duration: uploadTarget.duration,
        signal,
        biometrics: bio,
        overallScore,
        videoBlob: file,
        analysedAt: new Date().toISOString(),
      };
      saveRide(storedRide);
      setUploadTargetStored(storedRide);

      // Update ride signal in userRides
      setUserRides(prev => prev.map(r => r.id === uploadTarget.id ? { ...r, signal } : r));

      setSelectedRide(uploadTarget);
      setSelectedStoredRide(storedRide);
      setShowDetail(true);
    } catch (err) {
      if (processMsgRef.current) clearInterval(processMsgRef.current);
      console.error('Analysis failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddRide = (data: {
    type: RideType;
    horse: string;
    date: string;
    duration: number;
    notes: string;
  }) => {
    const newRide: Ride = {
      id: `user-${Date.now()}`,
      date: data.date,
      horse: data.horse,
      type: data.type,
      duration: data.duration,
      signal: 'consistent',
      tags: data.notes ? [data.notes] : [],
    };
    setUserRides(prev => [newRide, ...prev]);

    // Check if profile is complete; if not, show the setup modal
    if (!isProfileComplete()) {
      setShowProfileModal(true);
    }
  };

  const allRides = useMemo(() => {
    const combined = [...userRides, ...mockRides];
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [userRides]);

  // Empty state: no rides yet (#60)
  if (allRides.length === 0) {
    return (
      <div style={{ background: COLORS.parchment, minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <style>{`
          @keyframes champagnePulse {
            0%, 100% { transform: scale(1);   opacity: 0.8; }
            50%       { transform: scale(1.3); opacity: 1;   }
          }
        `}</style>
        <BrandedPulse />
        <h1 style={{ fontFamily: FONTS.heading, fontSize: 22, fontWeight: 400, color: COLORS.charcoal, marginTop: 20, marginBottom: 10 }}>
          Your rides will appear here
        </h1>
        <p style={{ fontFamily: FONTS.body, fontSize: 14, color: '#7A6B5D', lineHeight: 1.6, maxWidth: 280, marginBottom: 28 }}>
          Log your first ride to start tracking your progress and getting feedback.
        </p>
        <button
          onClick={() => setShowAddRide(true)}
          style={{
            background: COLORS.cognac, border: 'none', borderRadius: 24,
            padding: '13px 28px', cursor: 'pointer',
            fontFamily: FONTS.body, fontSize: 14, fontWeight: 600, color: '#FAF7F3',
            boxShadow: '0 4px 16px rgba(140,90,60,0.3)',
          }}
        >
          + Log Your First Ride
        </button>
        <AddRideModal open={showAddRide} onClose={() => setShowAddRide(false)} onAddRide={handleAddRide} />
        <ProfileSetupModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />
      </div>
    );
  }

  if (showDetail && selectedRide) {
    return (
      <RideDetailView
        ride={selectedRide}
        storedRide={selectedStoredRide ?? undefined}
        onClose={() => setShowDetail(false)}
      />
    );
  }

  return (
    <div style={{ background: COLORS.parchment, minHeight: '100%', paddingBottom: 100 }}>
      <style>{`
        @keyframes champagnePulse {
          0%, 100% { transform: scale(1);   opacity: 0.8; }
          50%       { transform: scale(1.3); opacity: 1;   }
        }
        @keyframes processingPulse {
          0%, 100% { opacity: 0.6; transform: scale(0.98); }
          50%       { opacity: 1;   transform: scale(1);    }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <h1 style={{ fontFamily: FONTS.heading, fontSize: '26px', fontWeight: 400, color: COLORS.charcoal, marginBottom: '4px' }}>
          Rides
        </h1>
        <p style={{ fontSize: '12px', color: COLORS.muted, fontFamily: FONTS.body, marginBottom: 16 }}>
          {allRides.length} session{allRides.length !== 1 ? 's' : ''} logged
        </p>
      </div>

      {/* ── Goal card ── */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{
          background: COLORS.cardBg,
          borderRadius: '16px', padding: '14px 16px',
          boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontFamily: FONTS.mono, fontSize: '10px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Current Focus
            </div>
            <div style={{
              fontFamily: FONTS.body, fontSize: '11px', color: COLORS.champagne,
              background: `${COLORS.champagne}15`, padding: '3px 8px', borderRadius: '8px',
            }}>
              {mockGoal.ridesConsistent}/{mockGoal.ridesRequired} rides
            </div>
          </div>
          <div style={{ fontFamily: FONTS.body, fontSize: '14px', fontWeight: 500, color: COLORS.charcoal }}>
            {mockGoal.name}
          </div>
          <div style={{ height: '4px', background: COLORS.softBg, borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(mockGoal.ridesConsistent / mockGoal.ridesRequired) * 100}%`,
              background: `linear-gradient(90deg, ${COLORS.cognac}, ${COLORS.champagne})`,
              borderRadius: '2px',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* ── Processing overlay ── */}
      {isProcessing && (
        <div style={{
          margin: '0 20px 16px',
          background: COLORS.cardBg, borderRadius: 16, padding: '18px 20px',
          boxShadow: '0 2px 12px rgba(26,20,14,0.08)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          animation: 'processingPulse 2s ease-in-out infinite',
        }}>
          <BrandedPulse />
          <div style={{ fontFamily: FONTS.body, fontSize: 14, color: COLORS.charcoal, fontWeight: 500 }}>
            {PROCESSING_MESSAGES[processingStep]}
          </div>
          <div style={{ fontFamily: FONTS.mono, fontSize: 10, color: COLORS.muted }}>
            Analysing your ride — this takes a moment
          </div>
        </div>
      )}

      {/* ── Rides list ── */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {allRides.map(ride => {
          const stored = getRides().find(s => s.id === ride.id);
          const d = new Date(ride.date);
          const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
          const scoreRaw = stored?.overallScore ?? ride.biometrics
            ? Object.values((stored?.biometrics ?? ride.biometrics)!).reduce((a, b) => a + b, 0) / 6
            : null;
          const scorePct = scoreRaw !== null ? Math.round(scoreRaw * 100) : null;
          const sc = scorePct !== null ? scoreColor(scoreRaw!) : COLORS.muted;

          return (
            <div
              key={ride.id}
              onClick={() => {
                setSelectedRide(ride);
                setSelectedStoredRide(stored ?? null);
                setShowDetail(true);
              }}
              style={{
                background: COLORS.cardBg, borderRadius: '14px',
                padding: '14px 16px', cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(26,20,14,0.05)',
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                borderLeft: `3px solid ${getSignal(ride.signal).color}`,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(26,20,14,0.10)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 10px rgba(26,20,14,0.05)';
              }}
            >
              {/* Score bubble or signal */}
              {scorePct !== null ? (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${sc}15`, border: `1.5px solid ${sc}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: '11px', fontWeight: 700, color: sc }}>{scorePct}</span>
                </div>
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: `${getSignal(ride.signal).color}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontFamily: FONTS.mono, fontSize: '14px', color: getSignal(ride.signal).color }}>
                    {getSignal(ride.signal).symbol}
                  </span>
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ fontFamily: FONTS.body, fontSize: '13px', fontWeight: 500, color: COLORS.charcoal }}>
                    {rideTypeLabel[ride.type] ?? ride.type}
                  </div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted, flexShrink: 0, marginLeft: 6 }}>
                    {dateStr}
                  </div>
                </div>

                <div style={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted, marginBottom: 6 }}>
                  {ride.horse || getHorseName('Horse')} · {ride.duration}min
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {ride.tags?.slice(0, 2).map(tag => (
                    <span key={tag} style={{
                      background: COLORS.softBg, color: '#7A6B5D',
                      fontSize: '10px', padding: '2px 8px', borderRadius: '8px',
                      fontFamily: FONTS.body,
                    }}>{tag}</span>
                  ))}
                  {!stored?.videoBlob && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setUploadTarget(ride);
                        setUploadTargetStored(stored ?? null);
                      }}
                      style={{
                        background: 'none', border: `1px solid ${COLORS.champagne}`,
                        borderRadius: '8px', padding: '2px 8px', cursor: 'pointer',
                        fontSize: '10px', color: COLORS.champagne, fontFamily: FONTS.body,
                        fontWeight: 500,
                      }}
                    >
                      + Analyse
                    </button>
                  )}
                  {stored?.videoBlob && (
                    <span style={{
                      fontSize: '9px', color: COLORS.green, background: `${COLORS.green}12`,
                      padding: '2px 7px', borderRadius: '8px', fontFamily: FONTS.mono,
                      fontWeight: 600,
                    }}>
                      Analysed
                    </span>
                  )}
                </div>
              </div>

              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 6l6 6-6 6" stroke="#D4C9BC" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </div>
          );
        })}
      </div>

      {/* ── Add Ride FAB ── */}
      <AddRideFAB onClick={() => setShowAddRide(true)} />

      <AddRideModal open={showAddRide} onClose={() => setShowAddRide(false)} onAddRide={handleAddRide} />

      <UploadSheet
        open={!!uploadTarget}
        onClose={() => setUploadTarget(null)}
        onVideoSelected={handleVideoSelected}
        ride={uploadTarget}
        storedRide={uploadTargetStored}
      />

      {videoUrl && (
        <VideoSilhouetteOverlay videoUrl={videoUrl} insights={insights} onClose={() => setVideoUrl(null)} />
      )}

      <ProfileSetupModal open={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </div>
  );
}
