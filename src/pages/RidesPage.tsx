import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockRides, mockGoal } from '../data/mock';
import type { Ride, BiometricsSnapshot } from '../data/mock';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { computeRidingQualities } from '../lib/poseAnalysis';
import type { MovementInsight } from '../lib/poseAnalysis';
import { saveRide, getRides } from '../lib/storage';
import type { StoredRide } from '../lib/storage';

// ─────────────────────────────────────────────────────────
// DESIGN TOKENS
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

// ─────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────

export default function RidesPage() {
  const navigate = useNavigate();

  // Log form state
  const [showLogForm, setShowLogForm] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [logFocus, setLogFocus] = useState(mockGoal.milestones[0].id);
  const [logDuration, setLogDuration] = useState('45');
  const [logType, setLogType] = useState<'training' | 'lesson' | 'hack'>('training');
  const [logSubmitted, setLogSubmitted] = useState(false);

  // Video analysis
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const { status, progress, result, error, analyzeVideo, reset } = useVideoAnalysis();

  // Saved session state
  const [sessionSaved, setSessionSaved] = useState(false);
  const [storedRides, setStoredRides] = useState<StoredRide[]>(getRides);

  // Refresh stored rides on mount
  useEffect(() => {
    setStoredRides(getRides());
  }, []);

  const isDone = status === 'done' && result !== null;
  const isAnalyzing = status === 'loading-model' || status === 'extracting' || status === 'processing';

  const handleLogSubmit = () => {
    setLogSubmitted(true);
    setTimeout(() => {
      setLogSubmitted(false);
      setShowLogForm(false);
      setLogNote('');
    }, 2000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setSessionSaved(false);
      analyzeVideo(file);
    }
  };

  const handleSaveSession = () => {
    if (!result || !videoFile) return;
    const bio = result.biometrics;
    const qualities = computeRidingQualities(bio);
    const overall = Object.values(bio).reduce((a, b) => a + b, 0) / Object.values(bio).length;

    const ride: StoredRide = {
      id: `stored-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      horse: 'Allegra',
      type: logType,
      duration: parseInt(logDuration, 10) || 45,
      videoFileName: videoFile.name,
      biometrics: { ...bio },
      ridingQuality: {
        rhythm:       qualities[0].score,
        relaxation:   qualities[1].score,
        contact:      qualities[2].score,
        impulsion:    qualities[3].score,
        straightness: qualities[4].score,
        balance:      qualities[5].score,
      },
      overallScore: Math.round(overall * 100) / 100,
      insights: result.insights.map(i => i.text),
    };

    saveRide(ride);
    setStoredRides(getRides());
    setSessionSaved(true);
  };

  const handleReset = () => {
    reset();
    setVideoFile(null);
    setSessionSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Combine stored rides with mock rides for the history
  const allRides = useMemo(() => {
    // Convert stored rides to Ride-like objects for display
    const fromStorage: Ride[] = storedRides.map(sr => ({
      id: sr.id,
      date: sr.date,
      horse: sr.horse,
      type: sr.type,
      duration: sr.duration,
      focusMilestone: 'Video Analysis',
      reflection: sr.insights[0] ?? '',
      signal: sr.overallScore >= 0.75 ? 'improving' as const : sr.overallScore >= 0.60 ? 'consistent' as const : 'needs-work' as const,
      biometrics: sr.biometrics,
      videoUploaded: true,
      milestoneId: '',
    }));
    return [...fromStorage, ...mockRides];
  }, [storedRides]);

  const grouped = allRides.reduce((acc, ride) => {
    const d = new Date(ride.date);
    const key = d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(ride);
    return acc;
  }, {} as Record<string, Ride[]>);

  // Status message for analysis progress
  const statusMessage = (() => {
    switch (status) {
      case 'loading-model': return 'Loading AI model…';
      case 'extracting':    return 'Extracting frames…';
      case 'processing':    return 'Analyzing biomechanics…';
      default:              return '';
    }
  })();

  return (
    <div style={{ background: COLORS.parchment, minHeight: '100%' }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: FONTS.heading, fontSize: '26px', fontWeight: 400, color: COLORS.charcoal }}>
              Ride Analysis
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: '11px', color: COLORS.muted }}>
              AI-powered biomechanics
            </div>
          </div>
          {videoFile && (
            <button
              onClick={handleReset}
              style={{
                background: 'none',
                border: `1.5px solid ${COLORS.border}`,
                borderRadius: '10px',
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 500,
                color: '#7A6B5D',
                cursor: 'pointer',
                fontFamily: FONTS.body,
              }}
            >
              New Session
            </button>
          )}
        </div>
      </div>

      {/* ── LOG FORM ────────────────────────────────────────── */}
      {showLogForm && (
        <div style={{
          background: COLORS.cardBg, margin: '12px 20px',
          borderRadius: '20px', padding: '20px',
          boxShadow: '0 4px 20px rgba(26,20,14,0.1)',
          border: `1px solid ${COLORS.softBg}`,
        }}>
          {logSubmitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
              <div style={{ fontFamily: FONTS.heading, fontSize: '18px', color: COLORS.cognac }}>
                Ride logged.
              </div>
              <div style={{ fontSize: '12px', color: COLORS.muted, fontFamily: FONTS.body, marginTop: '4px' }}>
                Cadence is analysing...
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ fontFamily: FONTS.heading, fontSize: '18px', color: COLORS.charcoal }}>Log a Ride</div>
                <button onClick={() => setShowLogForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.muted, fontSize: '20px' }}>×</button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONTS.body, display: 'block', marginBottom: '8px' }}>Ride type</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['training', 'lesson', 'hack'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setLogType(type)}
                      style={{
                        flex: 1, padding: '8px 4px',
                        borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: logType === type ? COLORS.cognac : COLORS.softBg,
                        color: logType === type ? COLORS.parchment : '#7A6B5D',
                        fontSize: '12px', fontWeight: 500,
                        fontFamily: FONTS.body,
                      }}
                    >
                      {rideTypeLabel[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONTS.body, display: 'block', marginBottom: '8px' }}>Duration (minutes)</label>
                <input
                  type="number"
                  value={logDuration}
                  onChange={e => setLogDuration(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '10px', border: `1.5px solid ${COLORS.border}`,
                    fontSize: '14px', color: COLORS.charcoal,
                    fontFamily: FONTS.mono,
                    outline: 'none', background: COLORS.parchment,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONTS.body, display: 'block', marginBottom: '8px' }}>Focus milestone</label>
                <select
                  value={logFocus}
                  onChange={e => setLogFocus(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '10px', border: `1.5px solid ${COLORS.border}`,
                    fontSize: '13px', color: COLORS.charcoal,
                    fontFamily: FONTS.body,
                    background: COLORS.parchment, outline: 'none',
                  }}
                >
                  {mockGoal.milestones.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: COLORS.muted, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: FONTS.body, display: 'block', marginBottom: '8px' }}>Reflection (optional)</label>
                <textarea
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  placeholder="How did the ride feel? What worked, what didn't?"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '10px', border: `1.5px solid ${COLORS.border}`,
                    fontSize: '13px', color: COLORS.charcoal,
                    fontFamily: FONTS.body,
                    background: COLORS.parchment, outline: 'none',
                    resize: 'none', lineHeight: 1.5,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* ── Video Upload Area ──────────────────────────── */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `1.5px dashed ${COLORS.border}`, borderRadius: '10px',
                  padding: '14px', textAlign: 'center', marginBottom: '18px',
                  cursor: 'pointer',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 4 }}><rect x="3" y="4" width="18" height="16" rx="3" stroke={COLORS.champagne} strokeWidth="1.5" /><path d="M10 8.5V15.5L16 12L10 8.5Z" fill={COLORS.champagne} /></svg>
                <div style={{ fontSize: '12px', color: COLORS.muted, fontFamily: FONTS.body }}>
                  {videoFile ? videoFile.name : 'Upload video (optional)'}
                </div>
                <div style={{ fontSize: '11px', color: COLORS.champagne, fontFamily: FONTS.body, marginTop: '2px' }}>
                  Upload a riding video and Cadence will analyze your position
                </div>
              </div>

              <button
                onClick={handleLogSubmit}
                style={{
                  width: '100%', background: COLORS.cognac, color: COLORS.parchment,
                  border: 'none', borderRadius: '12px', padding: '13px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: FONTS.body,
                }}
              >
                Save Ride
              </button>
            </>
          )}
        </div>
      )}

      {/* ── VIDEO ANALYSIS SECTION ─────────────────────────── */}
      {(isAnalyzing || isDone || status === 'error') && (
        <div style={{ padding: '0 20px', marginBottom: '16px' }}>
          <div style={{
            background: COLORS.cardBg,
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(26,20,14,0.1)',
            border: `1px solid ${COLORS.softBg}`,
          }}>

            {/* ── Video Area with Progress Overlay ──────────── */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#1A140E' }}>

              {/* Video element (visible during analysis and after done) */}
              {result?.videoPlaybackUrl && (
                <video
                  src={result.videoPlaybackUrl}
                  controls={isDone}
                  muted
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}

              {/* ── Premium Progress Overlay ─────────────────── */}
              {isAnalyzing && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'rgba(26, 20, 14, 0.85)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '16px',
                  animation: 'fadeIn 0.3s ease',
                }}>
                  {/* Circular progress ring */}
                  <div style={{ position: 'relative', width: 88, height: 88 }}>
                    <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
                      {/* Background ring */}
                      <circle
                        cx="44" cy="44" r="38"
                        fill="none"
                        stroke="rgba(201,169,110,0.2)"
                        strokeWidth="4"
                      />
                      {/* Progress ring */}
                      <circle
                        cx="44" cy="44" r="38"
                        fill="none"
                        stroke={COLORS.champagne}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 38}`}
                        strokeDashoffset={`${2 * Math.PI * 38 * (1 - progress / 100)}`}
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                      />
                    </svg>
                    {/* Percentage text */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: FONTS.mono, fontSize: '16px', color: COLORS.champagne,
                      fontWeight: 500,
                    }}>
                      {progress}%
                    </div>
                  </div>

                  {/* Status text */}
                  <div style={{
                    fontFamily: FONTS.body, fontSize: '13px', color: 'rgba(250,247,243,0.8)',
                    letterSpacing: '0.02em',
                  }}>
                    {statusMessage}
                  </div>

                  {/* Subtle pulsing dot */}
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: COLORS.champagne,
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                </div>
              )}
            </div>

            {/* ── Error State ────────────────────────────────── */}
            {status === 'error' && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', color: COLORS.attention, fontFamily: FONTS.body, marginBottom: '12px' }}>
                  {error ?? 'Analysis failed. Please try again.'}
                </div>
                <button
                  onClick={handleReset}
                  style={{
                    background: COLORS.softBg, color: COLORS.cognac,
                    border: 'none', borderRadius: '10px', padding: '10px 20px',
                    fontSize: '13px', fontFamily: FONTS.body, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              </div>
            )}

            {/* ── Results: Biometrics Panel (6 Gauges) ─────── */}
            {isDone && (
              <div style={{
                padding: '20px',
                animation: 'slideUp 0.5s ease',
              }}>
                <div style={{
                  fontFamily: FONTS.heading, fontSize: '17px', color: COLORS.charcoal,
                  marginBottom: '4px',
                }}>
                  Biomechanics Analysis
                </div>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted,
                  marginBottom: '16px',
                }}>
                  {result.frameCount} frames analyzed
                </div>

                {/* 6 Radial Gauges — 2×3 grid */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px', marginBottom: '20px',
                }}>
                  {([
                    ['lowerLegStability',  'Lower Leg'],
                    ['reinSteadiness',     'Rein Steady'],
                    ['reinSymmetry',       'Symmetry'],
                    ['coreStability',      'Core'],
                    ['upperBodyAlignment', 'Upper Body'],
                    ['pelvisStability',    'Pelvis'],
                  ] as [keyof BiometricsSnapshot, string][]).map(([key, label]) => {
                    const val = result.biometrics[key];
                    return (
                      <RadialGauge key={key} value={val} label={label} />
                    );
                  })}
                </div>

                {/* ── Insights Summary Card ──────────────────── */}
                <InsightsCard insights={result.insights} />

                {/* ── Save Session / Reset buttons ───────────── */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  {!sessionSaved ? (
                    <button
                      onClick={handleSaveSession}
                      style={{
                        flex: 1, background: COLORS.cognac, color: COLORS.parchment,
                        border: 'none', borderRadius: '12px', padding: '13px',
                        fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                        fontFamily: FONTS.body,
                      }}
                    >
                      Save Session
                    </button>
                  ) : (
                    <div style={{
                      flex: 1, textAlign: 'center', padding: '13px',
                      background: `${COLORS.green}15`, borderRadius: '12px',
                      color: COLORS.green, fontFamily: FONTS.body,
                      fontSize: '14px', fontWeight: 600,
                    }}>
                      ✓ Session Saved
                    </div>
                  )}
                  <button
                    onClick={handleReset}
                    style={{
                      background: COLORS.softBg, color: COLORS.muted,
                      border: 'none', borderRadius: '12px', padding: '13px 18px',
                      fontSize: '13px', fontFamily: FONTS.body, fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    New
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Upload (when no analysis active) ──────── */}
      {status === 'idle' && !showLogForm && (
        <div style={{ padding: '0 20px', marginBottom: '12px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: COLORS.cardBg, borderRadius: '20px',
              padding: '32px 24px', textAlign: 'center',
              boxShadow: '0 2px 16px rgba(26,20,14,0.06)',
              border: '2px dashed rgba(201,169,110,0.35)',
              cursor: 'pointer',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(140,90,60,0.08) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              border: '1.5px solid rgba(201,169,110,0.2)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="3" stroke={COLORS.champagne} strokeWidth="1.5" fill="none" />
                <path d="M10 8.5V15.5L16 12L10 8.5Z" fill={COLORS.champagne} />
              </svg>
            </div>
            <div style={{ fontFamily: FONTS.heading, fontSize: '20px', color: COLORS.charcoal, marginBottom: '6px' }}>
              Analyze Your Ride
            </div>
            <div style={{ fontFamily: FONTS.body, fontSize: '13px', color: '#7A6B5D', lineHeight: 1.5, maxWidth: 260, margin: '0 auto 16px' }}>
              Upload a riding video and Cadence will analyze your position, balance, and biomechanics in real time.
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: COLORS.cognac, color: COLORS.parchment,
              borderRadius: '14px', padding: '11px 24px',
              fontSize: '14px', fontWeight: 600, fontFamily: FONTS.body,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 4v12M6 10l6-6 6 6" stroke={COLORS.parchment} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 18h16" stroke={COLORS.parchment} strokeWidth="2" strokeLinecap="round" />
              </svg>
              Upload Session
            </div>
            <div style={{ fontFamily: FONTS.mono, fontSize: '10px', color: COLORS.muted, marginTop: 12 }}>
              MP4 or MOV · Landscape recommended
            </div>
          </div>
        </div>
      )}

      {/* ── SESSION HISTORY ─────────────────────────────────── */}
      <div style={{ padding: '16px 20px 28px' }}>
        <div style={{
          fontFamily: FONTS.heading, fontSize: '18px', color: COLORS.charcoal,
          marginBottom: '12px',
        }}>
          Session History
        </div>

        {Object.entries(grouped).map(([month, rides]) => (
          <div key={month}>
            <div style={{
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: COLORS.muted,
              fontFamily: FONTS.body, marginBottom: '10px', marginTop: '8px',
            }}>
              {month}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {rides.map(ride => {
                const isStored = ride.id.startsWith('stored-');
                const stored = isStored ? storedRides.find(s => s.id === ride.id) : null;
                return (
                  <RideRow
                    key={ride.id}
                    ride={ride}
                    storedRide={stored ?? undefined}
                    onClick={() => {
                      if (!isStored) navigate(`/rides/${ride.id}`);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── CSS Keyframes ────────────────────────────────────── */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RADIAL GAUGE COMPONENT
// ─────────────────────────────────────────────────────────

function RadialGauge({ value, label }: { value: number; label: string }) {
  const pct = Math.round(value * 100);
  const color = scoreColor(value);
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - value);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={r} fill="none" stroke={COLORS.softBg} strokeWidth="5" />
          <circle
            cx="32" cy="32" r={r}
            fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: FONTS.mono, fontSize: '13px', fontWeight: 600, color,
        }}>
          {pct}
        </div>
      </div>
      <div style={{
        fontFamily: FONTS.body, fontSize: '10px', color: COLORS.muted,
        textAlign: 'center', lineHeight: 1.2,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: FONTS.mono, fontSize: '9px', color,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {scoreLabel(value)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// INSIGHTS CARD COMPONENT
// ─────────────────────────────────────────────────────────

function InsightsCard({ insights }: { insights: MovementInsight[] }) {
  return (
    <div style={{
      background: COLORS.parchment, borderRadius: '14px',
      padding: '16px', border: `1px solid ${COLORS.border}`,
    }}>
      <div style={{
        fontFamily: FONTS.heading, fontSize: '14px', color: COLORS.charcoal,
        marginBottom: '12px',
      }}>
        Key Insights
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {insights.map((insight, i) => (
          <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: `${insight.iconColor}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', color: insight.iconColor,
              flexShrink: 0, marginTop: 1,
            }}>
              {insight.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  fontFamily: FONTS.body, fontSize: '11px', fontWeight: 600,
                  color: COLORS.charcoal,
                }}>
                  {insight.metric}
                </span>
                <span style={{
                  fontFamily: FONTS.mono, fontSize: '9px',
                  color: insight.trendColor, textTransform: 'uppercase',
                }}>
                  {insight.trend}
                </span>
              </div>
              <div style={{
                fontFamily: FONTS.body, fontSize: '11.5px',
                color: '#6B5E50', lineHeight: 1.45,
              }}>
                {insight.text}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// RIDE ROW COMPONENT
// ─────────────────────────────────────────────────────────

function RideRow({ ride, storedRide, onClick }: { ride: Ride; storedRide?: StoredRide; onClick: () => void }) {
  const signal = signalConfig[ride.signal];
  const d = new Date(ride.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.cardBg, borderRadius: '14px', padding: '13px 15px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 8px rgba(26,20,14,0.05)', cursor: 'pointer',
        transition: 'transform 0.1s ease',
        border: storedRide ? `1px solid ${COLORS.champagne}30` : 'none',
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: signal.color, flexShrink: 0, marginTop: 1 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '13.5px', fontWeight: 500, color: COLORS.charcoal, fontFamily: FONTS.body }}>
            {rideTypeLabel[ride.type] ?? ride.type} · {ride.horse}
          </span>
          {ride.videoUploaded && (
            <span style={{ fontSize: '10px', background: '#F0F4F8', color: '#6B7FA3', padding: '2px 6px', borderRadius: '6px', fontFamily: FONTS.body }}>
              📹
            </span>
          )}
          {storedRide && (
            <span style={{
              fontSize: '9px', background: `${COLORS.champagne}20`, color: COLORS.champagne,
              padding: '2px 6px', borderRadius: '6px', fontFamily: FONTS.mono,
              fontWeight: 600, letterSpacing: '0.03em',
            }}>
              AI
            </span>
          )}
        </div>
        <div style={{ fontFamily: FONTS.mono, fontSize: '10.5px', color: COLORS.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dateStr} · {ride.duration}min{storedRide ? ` · Score ${Math.round(storedRide.overallScore * 100)}%` : ` · ${ride.focusMilestone}`}
        </div>

        {/* Mini score bar for stored rides */}
        {storedRide && (
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            {([
              ['LL', storedRide.biometrics.lowerLegStability],
              ['RS', storedRide.biometrics.reinSteadiness],
              ['SY', storedRide.biometrics.reinSymmetry],
              ['CO', storedRide.biometrics.coreStability],
              ['UB', storedRide.biometrics.upperBodyAlignment],
              ['PV', storedRide.biometrics.pelvisStability],
            ] as [string, number][]).map(([abbr, val]) => (
              <div key={abbr} style={{
                fontFamily: FONTS.mono, fontSize: '8px',
                color: scoreColor(val), background: `${scoreColor(val)}12`,
                padding: '2px 4px', borderRadius: '4px',
              }}>
                {abbr} {Math.round(val * 100)}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '18px', color: signal.color, lineHeight: 1 }}>{signal.symbol}</div>
        <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: COLORS.muted, fontFamily: FONTS.body }}>
          {signal.label}
        </div>
      </div>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M9 6l6 6-6 6" stroke="#D4C9BC" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
