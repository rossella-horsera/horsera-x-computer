import { useState } from 'react';
import CadenceInsightCard from '../components/ui/CadenceInsightCard';
import { mockGoals, mockRider, cadenceInsights, USDF_LEVELS } from '../data/mock';
import type { Milestone, DisciplineLevel, Goal } from '../data/mock';

// ─── Small readiness ring ──────────────────────────────────────────────────────

function ReadinessRing({ pct, size = 48 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  const color = pct >= 70 ? '#8C5A3C' : pct >= 35 ? '#C9A96E' : '#B5A898';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE7DF" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px', fontWeight: 500,
          color,
        }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

// ─── Skill ring ────────────────────────────────────────────────────────────────

function SkillRing({ milestone, onClick, isActive }: {
  milestone: Milestone;
  onClick: () => void;
  isActive: boolean;
}) {
  const size = 76;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const progress = milestone.state === 'mastered'
    ? 1
    : milestone.state === 'working'
    ? milestone.ridesConsistent / milestone.ridesRequired
    : 0;
  const dashLength = progress * circumference;

  const ringColor = milestone.state === 'mastered'
    ? '#8C5A3C'
    : milestone.state === 'working'
    ? '#C9A96E'
    : '#EDE7DF';

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '7px', padding: '12px 8px',
        background: isActive ? '#FFF8F2' : '#FFFFFF',
        borderRadius: '16px',
        border: `1.5px solid ${isActive ? '#8C5A3C' : 'transparent'}`,
        cursor: 'pointer',
        boxShadow: isActive ? '0 2px 12px rgba(140,90,60,0.12)' : '0 1px 4px rgba(26,20,14,0.04)',
        transition: 'all 0.15s ease',
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {milestone.state === 'mastered' && (
          <circle cx={size / 2} cy={size / 2} r={r + 8} fill="rgba(140,90,60,0.06)" />
        )}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDE7DF" strokeWidth={6} />
        {progress > 0 && (
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={ringColor} strokeWidth={6}
            strokeDasharray={`${dashLength} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        )}
        {milestone.state === 'mastered' && (
          <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="14" fill="#8C5A3C">✓</text>
        )}
        {milestone.state === 'working' && (
          <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11"
            fontFamily="'DM Mono', monospace" fill="#C9A96E" fontWeight="500">
            {milestone.ridesConsistent}/{milestone.ridesRequired}
          </text>
        )}
        {milestone.state === 'untouched' && (
          <circle cx={size / 2} cy={size / 2} r={4} fill="#D4C9BC" />
        )}
      </svg>
      <div style={{ textAlign: 'center', width: '100%', paddingInline: '4px' }}>
        <p style={{
          fontSize: '11px', color: '#1A140E',
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          lineHeight: 1.25, marginBottom: '2px',
        }}>
          {milestone.name}
        </p>
        <p style={{
          fontSize: '9.5px',
          color: ringColor === '#EDE7DF' ? '#B5A898' : ringColor,
          fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
          letterSpacing: '0.04em',
        }}>
          {milestone.state === 'mastered' ? 'Mastered'
            : milestone.state === 'working' ? 'Working'
            : 'Not started'}
        </p>
      </div>
    </button>
  );
}

// ─── Level path navigator ──────────────────────────────────────────────────────

function LevelPath({ currentLevel, selectedLevel, onLevelSelect }: { currentLevel: DisciplineLevel; selectedLevel: DisciplineLevel | null; onLevelSelect: (id: DisciplineLevel) => void }) {
  const currentIndex = USDF_LEVELS.findIndex(l => l.id === currentLevel);

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px' }}>
      {USDF_LEVELS.map((level, index) => {
        const isCurrent = level.id === currentLevel;
        const isPast = index < currentIndex;
        const isSelected = level.id === selectedLevel;
        return (
          <div key={level.id} style={{ display: 'flex', alignItems: 'center', flex: index === 0 ? 'none' : 1 }}>
            {index > 0 && (
              <div style={{ flex: 1, height: '2px', background: isPast ? '#C9A96E' : '#EDE7DF', minWidth: '12px' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <button
                onClick={() => onLevelSelect(level.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div style={{
                  width: isCurrent ? 13 : 9, height: isCurrent ? 13 : 9,
                  borderRadius: '50%',
                  background: isCurrent ? '#8C5A3C' : isPast ? '#C9A96E' : 'transparent',
                  border: `2px solid ${isCurrent ? '#8C5A3C' : isPast ? '#C9A96E' : '#C4B8AC'}`,
                  boxShadow: isSelected ? '0 0 0 3px rgba(140,90,60,0.25)' : isCurrent ? '0 0 0 3px rgba(140,90,60,0.15)' : 'none',
                }} />
              </button>
              <span style={{
                fontSize: '9px', fontFamily: "'DM Sans', sans-serif",
                fontWeight: isCurrent ? 700 : 400,
                color: isCurrent ? '#8C5A3C' : isPast ? '#C9A96E' : '#B5A898',
                whiteSpace: 'nowrap',
              }}>
                {level.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Milestone detail panel ────────────────────────────────────────────────────

function MilestoneDetail({ milestone }: { milestone: Milestone }) {
  const [tab, setTab] = useState<'exercises' | 'about'>('exercises');

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '16px', padding: '16px',
      marginTop: '8px', boxShadow: '0 2px 12px rgba(26,20,14,0.07)',
      border: '1px solid #F0EBE4',
    }}>
      <div style={{ marginBottom: '14px' }}>
        {[
          { label: 'What you can control', value: milestone.biomechanicsFocus.slice(0, 2).join(', '), color: '#8C5A3C' },
          { label: 'Riding quality', value: milestone.ridingQuality, color: '#C9A96E' },
          { label: 'Performance task', value: milestone.performanceTasks[0], color: '#7D9B76' },
        ].map((layer, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: i < 2 ? '8px' : 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: layer.color, flexShrink: 0, marginTop: 4 }} />
            <div>
              <div style={{ fontSize: '9.5px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1px' }}>
                {layer.label}
              </div>
              <div style={{ fontSize: '12.5px', color: '#1A140E', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>
                {layer.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: '1px', background: '#F0EBE4', marginBottom: '12px' }} />

      <div style={{ display: 'flex', gap: 4, marginBottom: '12px' }}>
        {(['exercises', 'about'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '7px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              background: tab === t ? '#F0EBE4' : 'transparent',
              fontSize: '12px', fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#8C5A3C' : '#B5A898',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'exercises' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {milestone.exercises.length > 0 ? milestone.exercises.map(ex => (
            <div key={ex.id} style={{ padding: '10px 12px', background: '#FAF7F3', borderRadius: '10px', border: '1px solid #F0EBE4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#1A140E', fontFamily: "'DM Sans', sans-serif" }}>{ex.name}</span>
                <span style={{ fontSize: '10px', color: '#B5A898', background: ex.type === 'on-saddle' ? '#F0EBE4' : '#F0F4F8', padding: '2px 7px', borderRadius: '10px', fontFamily: "'DM Sans', sans-serif" }}>
                  {ex.type === 'on-saddle' ? '🐴 in saddle' : '🧘 off saddle'}
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: '#7A6B5D', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}>{ex.description}</div>
              <div style={{ marginTop: '4px', fontSize: '10px', color: '#C9A96E', fontFamily: "'DM Mono', monospace" }}>{ex.duration}</div>
            </div>
          )) : (
            <div style={{ fontSize: '13px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
              Exercises unlock as you progress
            </div>
          )}
        </div>
      )}

      {tab === 'about' && (
        <p style={{ fontSize: '13px', color: '#7A6B5D', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
          {milestone.description}
        </p>
      )}
    </div>
  );
}

// ─── Goal readiness calculation ────────────────────────────────────────────────

function goalReadinessPct(goal: Goal): number {
  const relevant = goal.currentDisciplineLevel
    ? goal.milestones.filter(m => m.disciplineLevel === goal.currentDisciplineLevel)
    : goal.milestones;
  if (relevant.length === 0) return 0;
  const total = relevant.reduce((sum, m) => {
    if (m.state === 'mastered') return sum + 1;
    return sum + m.ridesConsistent / m.ridesRequired;
  }, 0);
  return Math.round((total / relevant.length) * 100);
}

// ─── Goal type badge ──────────────────────────────────────────────────────────

const goalTypeMeta: Record<string, { label: string; bg: string; color: string }> = {
  competition: { label: 'Competition',  bg: '#F8F3EC', color: '#8C5A3C' },
  experience:  { label: 'Experience',   bg: '#EEF2F8', color: '#6B7FA3' },
  skill:       { label: 'Skill',        bg: '#EFF6EF', color: '#7D9B76' },
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<DisciplineLevel | null>(null);

  // Find the selected milestone across all goals (for Cadence insight + detail panel)
  const selectedMilestone = selectedMilestoneId
    ? mockGoals.flatMap(g => g.milestones).find(m => m.id === selectedMilestoneId)
    : null;

  const cadenceText = selectedMilestone?.cadenceNote ?? cadenceInsights.journey;

  const handleSkillTap = (goalId: string, milestoneId: string) => {
    if (selectedMilestoneId === milestoneId) {
      setSelectedMilestoneId(null);
      setSelectedGoalId(null);
    } else {
      setSelectedMilestoneId(milestoneId);
      setSelectedGoalId(goalId);
    }
  };

  return (
    <div style={{ background: '#FAF7F3', minHeight: '100dvh', paddingBottom: '28px', position: 'relative' }}>

      {/* ─── Coming Soon Overlay ─── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 30,
        background: 'rgba(250,247,243,0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
        textAlign: 'center',
      }}>
        {/* Journey icon */}
        <div style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(140,90,60,0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          border: '1.5px solid rgba(201,169,110,0.2)',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3C12 3 5 10 5 15C5 18.87 8.13 22 12 22C15.87 22 19 18.87 19 15C19 10 12 3 12 3Z"
              stroke="#C9A96E"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="rgba(201,169,110,0.1)"
            />
            <path d="M9.5 14C10.5 13 13.5 13 14.5 14" stroke="#C9A96E" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M10 17C11 16 13 16 14 17" stroke="#C9A96E" strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="12" cy="10.5" r="1.2" fill="#C9A96E" />
          </svg>
        </div>

        <h2 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: '28px',
          fontWeight: 400,
          color: '#1A140E',
          marginBottom: 10,
          letterSpacing: '-0.01em',
        }}>
          Coming Soon
        </h2>

        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '14px',
          color: '#7A6B5D',
          lineHeight: 1.6,
          maxWidth: 280,
          marginBottom: 28,
        }}>
          Your personalised riding development path — goals, skills, and progress tracking — launching soon.
        </p>

        <button style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '13px',
          fontWeight: 600,
          color: '#8C5A3C',
          background: 'rgba(140,90,60,0.08)',
          border: '1.5px solid rgba(140,90,60,0.2)',
          borderRadius: '12px',
          padding: '10px 24px',
          cursor: 'pointer',
          letterSpacing: '0.02em',
        }}>
          Notify Me
        </button>
      </div>

      {/* ─── Header ─── */}
      <div style={{ padding: '20px 20px 16px' }}>
        <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", marginBottom: '4px' }}>
          Your Journey
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 400, color: '#1A140E' }}>
            Goals & Skills
          </h1>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#B5A898' }}>
            {mockRider.firstName} & {mockRider.horse}
          </div>
        </div>
      </div>

      {/* ─── Cadence insight — context-sensitive ─── */}
      <div style={{ padding: '0 20px 20px' }}>
        <CadenceInsightCard text={cadenceText} />
      </div>

      {/* ─── Goal cards ─── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 20px' }}>
        {mockGoals.map(goal => {
          const pct = goalReadinessPct(goal);
          const typeMeta = goalTypeMeta[goal.type];
          const currentLevelDef = goal.currentDisciplineLevel
            ? USDF_LEVELS.find(l => l.id === goal.currentDisciplineLevel)
            : null;

          // For USDF goals: split into current-level and reaching-ahead milestones
          const currentLevelMilestones = goal.currentDisciplineLevel
            ? goal.milestones.filter(m => m.disciplineLevel === goal.currentDisciplineLevel)
            : goal.milestones;

          const reachingAheadMilestones = goal.currentDisciplineLevel
            ? goal.milestones.filter(m => {
                const levelIndex = USDF_LEVELS.findIndex(l => l.id === m.disciplineLevel);
                const currentIndex = USDF_LEVELS.findIndex(l => l.id === goal.currentDisciplineLevel);
                return levelIndex > currentIndex && m.state !== 'untouched';
              })
            : [];

          const masteredCount = currentLevelMilestones.filter(m => m.state === 'mastered').length;

          return (
            <div key={goal.id} style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(26,20,14,0.06)',
              border: '1px solid #F0EBE4',
            }}>
              {/* Goal header */}
              <div style={{ padding: '16px 16px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    {/* Type + track badges */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                        padding: '3px 9px', borderRadius: '20px',
                        background: typeMeta.bg, color: typeMeta.color,
                        fontFamily: "'DM Sans', sans-serif",
                      }}>
                        {typeMeta.label}
                      </span>
                      {goal.track && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em',
                          padding: '3px 9px', borderRadius: '20px',
                          background: '#F0EBE4', color: '#7A6B5D',
                          fontFamily: "'DM Sans', sans-serif",
                        }}>
                          Dressage
                        </span>
                      )}
                    </div>

                    <h2 style={{
                      fontFamily: "'Playfair Display', serif",
                      fontSize: '18px', fontWeight: 400, color: '#1A140E',
                      lineHeight: 1.2, marginBottom: '3px',
                    }}>
                      {goal.name}
                    </h2>
                    {goal.description && (
                      <p style={{ fontSize: '11.5px', color: '#7A6B5D', fontFamily: "'DM Sans', sans-serif" }}>
                        {goal.description}
                      </p>
                    )}
                  </div>

                  <ReadinessRing pct={pct} size={52} />
                </div>

                {/* Level path — only for USDF goals */}
                {goal.currentDisciplineLevel && (
                  <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #F5F0E8' }}>
                    <LevelPath
                      currentLevel={goal.currentDisciplineLevel}
                      selectedLevel={selectedLevel}
                      onLevelSelect={(id) => setSelectedLevel(prev => prev === id ? null : id)}
                    />
                    {currentLevelDef && (
                      <p style={{ fontSize: '10px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", marginTop: '8px' }}>
                        {currentLevelDef.fullName} · {currentLevelDef.description}
                      </p>
                    )}
                    {selectedLevel && (() => {
                      const selDef = USDF_LEVELS.find(l => l.id === selectedLevel);
                      const selIndex = USDF_LEVELS.findIndex(l => l.id === selectedLevel);
                      const curIndex = USDF_LEVELS.findIndex(l => l.id === goal.currentDisciplineLevel);
                      if (!selDef) return null;
                      const isPast = selIndex < curIndex;
                      const isCur = selIndex === curIndex;
                      const dotColor = isCur ? '#8C5A3C' : isPast ? '#7D9B76' : '#D4C9BC';
                      const statusLabel = isCur ? 'Current level' : isPast ? 'Completed ✓' : 'Upcoming';
                      const statusColor = isCur ? '#8C5A3C' : isPast ? '#7D9B76' : '#B5A898';
                      return (
                        <div style={{ marginTop: '12px', padding: '12px 14px', background: '#FAF7F3', borderRadius: '12px', border: '1px solid #EDE7DF' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#1A140E', fontFamily: "'DM Sans', sans-serif" }}>
                              {selDef.fullName}
                            </span>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: statusColor, fontFamily: "'DM Sans', sans-serif" }}>
                              {statusLabel}
                            </span>
                          </div>
                          <p style={{ fontSize: '11px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", marginBottom: '10px' }}>
                            {selDef.description}
                          </p>
                          {selDef.performanceTasks.map((task, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', paddingBlock: '5px', borderBottom: i < selDef.performanceTasks.length - 1 ? '1px solid #EDE7DF' : 'none' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 5 }} />
                              <span style={{ fontSize: '12px', color: isCur || isPast ? '#1A140E' : '#B5A898', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4 }}>
                                {task}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Competition details — only for competition goals with a target date */}
                {goal.type === 'competition' && goal.targetDate && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10.5px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>
                      {masteredCount}/{currentLevelMilestones.length} skills mastered
                    </span>
                    {masteredCount < currentLevelMilestones.length && (
                      <span style={{ fontSize: '10.5px', color: '#C4714A', fontFamily: "'DM Sans', sans-serif" }}>
                        · {currentLevelMilestones.length - masteredCount} remaining
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Skills section */}
              <div style={{ borderTop: '1px solid #F5F0E8', padding: '14px 16px' }}>
                <p style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }}>
                  {goal.currentDisciplineLevel ? `${currentLevelDef?.fullName ?? ''} Skills` : 'Skills'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {currentLevelMilestones.map(milestone => (
                    <SkillRing
                      key={milestone.id}
                      milestone={milestone}
                      onClick={() => handleSkillTap(goal.id, milestone.id)}
                      isActive={selectedMilestoneId === milestone.id}
                    />
                  ))}
                </div>

                {/* Expanded detail — current-level milestones only (reaching-ahead milestones render below) */}
                {selectedGoalId === goal.id && selectedMilestone && !selectedMilestone.disciplineLevel?.includes('first') && (
                  <MilestoneDetail milestone={selectedMilestone} />
                )}
              </div>

              {/* Reaching ahead — only for USDF goal */}
              {reachingAheadMilestones.length > 0 && (
                <div style={{ borderTop: '1px solid #F5F0E8', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ background: '#EEF2F8', borderRadius: '8px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ fontSize: '11px' }}>↗</span>
                      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7FA3', fontFamily: "'DM Sans', sans-serif" }}>
                        Reaching Ahead
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>
                      {USDF_LEVELS.find(l => l.id === reachingAheadMilestones[0].disciplineLevel)?.fullName}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: '#7A6B5D', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5, marginBottom: '12px' }}>
                    You're already working on skills from the next level — the path isn't perfectly linear.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {reachingAheadMilestones.map(milestone => (
                      <div key={milestone.id} style={{ position: 'relative' }}>
                        <SkillRing
                          milestone={milestone}
                          onClick={() => handleSkillTap(goal.id, milestone.id)}
                          isActive={selectedMilestoneId === milestone.id}
                        />
                        <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#EEF2F8', borderRadius: '6px', padding: '2px 5px' }}>
                          <span style={{ fontSize: '8px', color: '#6B7FA3', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
                            {USDF_LEVELS.find(l => l.id === milestone.disciplineLevel)?.label.slice(0, 3).toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedGoalId === goal.id && selectedMilestone?.disciplineLevel !== goal.currentDisciplineLevel && selectedMilestone?.disciplineLevel && (
                    <MilestoneDetail milestone={selectedMilestone} />
                  )}
                </div>
              )}

              {/* Show Prep — only for competition goals with upcoming event */}
              {goal.type === 'competition' && goal.targetDate && (
                <div style={{ borderTop: '1px solid #F5F0E8', padding: '14px 16px' }}>
                  <p style={{ fontSize: '9.5px', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", marginBottom: '12px' }}>
                    Show Prep · USDF Spring Classic
                  </p>

                  {[
                    { task: 'Entry, halt, salute',           state: 'solid' },
                    { task: '20m trot circle (both reins)',  state: 'consolidating' },
                    { task: 'Free walk on long rein',         state: 'solid' },
                    { task: 'Working canter, 20m circle',     state: 'needs-work' },
                    { task: 'Return to trot, free walk',      state: 'solid' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 4 ? '1px solid #F5F0E8' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.state === 'solid' ? '#7D9B76' : item.state === 'consolidating' ? '#C9A96E' : '#C4714A' }} />
                      <span style={{ fontSize: '12.5px', color: '#7A6B5D', flex: 1, fontFamily: "'DM Sans', sans-serif" }}>{item.task}</span>
                      <span style={{ fontSize: '10px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", textTransform: 'capitalize' }}>
                        {item.state.replace('-', ' ')}
                      </span>
                    </div>
                  ))}

                  {/* Ride the Test — locked */}
                  <div style={{ marginTop: '12px', padding: '12px 14px', background: '#1C1510', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(201,169,110,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px' }}>🎬</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#C9A96E', fontFamily: "'DM Sans', sans-serif" }}>Ride the Test</span>
                        <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', color: '#B5A898', background: 'rgba(255,255,255,0.08)', padding: '2px 7px', borderRadius: '6px', fontFamily: "'DM Sans', sans-serif" }}>
                          COMING SOON
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(181,168,152,0.7)', fontFamily: "'DM Sans', sans-serif" }}>
                        Record your full test · get a Judge's Eye report
                      </div>
                    </div>
                    <span style={{ fontSize: '16px', opacity: 0.4 }}>🔒</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ─── Add a goal placeholder ─── */}
        <button style={{
          width: '100%', padding: '16px',
          border: '1.5px dashed #D4C9BC', borderRadius: '20px',
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '18px', color: '#C4B8AC', lineHeight: 1 }}>+</span>
          <span style={{ fontSize: '13px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>Add a goal</span>
        </button>

      </div>
    </div>
  );
}
