import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockRides, mockGoal } from '../data/mock';
import type { Ride } from '../data/mock';

const signalConfig = {
  improving:   { color: '#7D9B76', symbol: '↑', label: 'Improving' },
  consistent:  { color: '#C9A96E', symbol: '→', label: 'Consistent' },
  'needs-work': { color: '#C4714A', symbol: '↓', label: 'Needs work' },
};

const rideTypeLabel = {
  training:    '🐎 Training',
  lesson:      '👩‍🏫 Lesson',
  'mock-test': '📋 Mock Test',
  hack:        '🌳 Hack',
};

export default function RidesPage() {
  const navigate = useNavigate();
  const [showLogForm, setShowLogForm] = useState(false);
  const [logNote, setLogNote] = useState('');
  const [logFocus, setLogFocus] = useState(mockGoal.milestones[0].id);
  const [logDuration, setLogDuration] = useState('45');
  const [logType, setLogType] = useState<'training' | 'lesson' | 'hack'>('training');
  const [logSubmitted, setLogSubmitted] = useState(false);

  const handleLogSubmit = () => {
    setLogSubmitted(true);
    setTimeout(() => {
      setLogSubmitted(false);
      setShowLogForm(false);
      setLogNote('');
    }, 2000);
  };

  const grouped = mockRides.reduce((acc, ride) => {
    const d = new Date(ride.date);
    const key = d.toLocaleDateString('en', { month: 'long', year: 'numeric' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(ride);
    return acc;
  }, {} as Record<string, Ride[]>);

  return (
    <div style={{ background: '#FAF7F3', minHeight: '100%' }}>

      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #EDE7DF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 400, color: '#1A140E' }}>
              Rides
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: '#B5A898' }}>
              {mockRides.length} rides logged
            </div>
          </div>
          <button
            onClick={() => setShowLogForm(true)}
            style={{
              background: '#8C5A3C', color: '#FAF7F3',
              border: 'none', borderRadius: '12px',
              padding: '10px 16px', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span> Log Ride
          </button>
        </div>
      </div>

      {showLogForm && (
        <div style={{
          background: '#FFFFFF', margin: '12px 20px',
          borderRadius: '20px', padding: '20px',
          boxShadow: '0 4px 20px rgba(26,20,14,0.1)',
          border: '1px solid #F0EBE4',
        }}>
          {logSubmitted ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#8C5A3C' }}>
                Ride logged.
              </div>
              <div style={{ fontSize: '12px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif", marginTop: '4px' }}>
                Cadence is analysing...
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#1A140E' }}>Log a Ride</div>
                <button onClick={() => setShowLogForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B5A898', fontSize: '20px' }}>×</button>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", display: 'block', marginBottom: '8px' }}>Ride type</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['training', 'lesson', 'hack'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setLogType(type)}
                      style={{
                        flex: 1, padding: '8px 4px',
                        borderRadius: '10px', border: 'none', cursor: 'pointer',
                        background: logType === type ? '#8C5A3C' : '#F0EBE4',
                        color: logType === type ? '#FAF7F3' : '#7A6B5D',
                        fontSize: '12px', fontWeight: 500,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {rideTypeLabel[type]}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", display: 'block', marginBottom: '8px' }}>Duration (minutes)</label>
                <input
                  type="number"
                  value={logDuration}
                  onChange={e => setLogDuration(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '10px', border: '1.5px solid #EDE7DF',
                    fontSize: '14px', color: '#1A140E',
                    fontFamily: "'DM Mono', monospace",
                    outline: 'none', background: '#FAF7F3',
                  }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", display: 'block', marginBottom: '8px' }}>Focus milestone</label>
                <select
                  value={logFocus}
                  onChange={e => setLogFocus(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '10px', border: '1.5px solid #EDE7DF',
                    fontSize: '13px', color: '#1A140E',
                    fontFamily: "'DM Sans', sans-serif",
                    background: '#FAF7F3', outline: 'none',
                  }}
                >
                  {mockGoal.milestones.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#B5A898', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif", display: 'block', marginBottom: '8px' }}>Reflection (optional)</label>
                <textarea
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  placeholder="How did the ride feel? What worked, what didn't?"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px',
                    borderRadius: '10px', border: '1.5px solid #EDE7DF',
                    fontSize: '13px', color: '#1A140E',
                    fontFamily: "'DM Sans', sans-serif",
                    background: '#FAF7F3', outline: 'none',
                    resize: 'none', lineHeight: 1.5,
                  }}
                />
              </div>

              <div style={{
                border: '1.5px dashed #EDE7DF', borderRadius: '10px',
                padding: '14px', textAlign: 'center', marginBottom: '18px',
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>🎬</div>
                <div style={{ fontSize: '12px', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>
                  Upload video (optional)
                </div>
                <div style={{ fontSize: '11px', color: '#C9A96E', fontFamily: "'DM Sans', sans-serif", marginTop: '2px' }}>
                  Cadence will analyse your position
                </div>
              </div>

              <button
                onClick={handleLogSubmit}
                style={{
                  width: '100%', background: '#8C5A3C', color: '#FAF7F3',
                  border: 'none', borderRadius: '12px', padding: '13px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Save Ride
              </button>
            </>
          )}
        </div>
      )}

      <div style={{ padding: '16px 20px 28px' }}>
        {Object.entries(grouped).map(([month, rides]) => (
          <div key={month}>
            <div style={{
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.14em',
              textTransform: 'uppercase', color: '#B5A898',
              fontFamily: "'DM Sans', sans-serif", marginBottom: '10px', marginTop: '8px',
            }}>
              {month}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {rides.map(ride => (
                <RideRow key={ride.id} ride={ride} onClick={() => navigate(`/rides/${ride.id}`)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RideRow({ ride, onClick }: { ride: Ride; onClick: () => void }) {
  const signal = signalConfig[ride.signal];
  const d = new Date(ride.date);
  const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const rideTypeLabel: Record<string, string> = {
    training: '🐎 Training',
    lesson: '👩‍🏫 Lesson',
    'mock-test': '📋 Mock Test',
    hack: '🌳 Hack',
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: '#FFFFFF', borderRadius: '14px', padding: '13px 15px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 2px 8px rgba(26,20,14,0.05)', cursor: 'pointer',
        transition: 'transform 0.1s ease',
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: signal.color, flexShrink: 0, marginTop: 1 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: '13.5px', fontWeight: 500, color: '#1A140E', fontFamily: "'DM Sans', sans-serif" }}>
            {rideTypeLabel[ride.type]} · {ride.horse}
          </span>
          {ride.videoUploaded && (
            <span style={{ fontSize: '10px', background: '#F0F4F8', color: '#6B7FA3', padding: '2px 6px', borderRadius: '6px', fontFamily: "'DM Sans', sans-serif" }}>
              📹
            </span>
          )}
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10.5px', color: '#B5A898', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {dateStr} · {ride.duration}min · {ride.focusMilestone}
        </div>
      </div>

      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '18px', color: signal.color, lineHeight: 1 }}>{signal.symbol}</div>
        <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#B5A898', fontFamily: "'DM Sans', sans-serif" }}>
          {signal.label}
        </div>
      </div>

      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M9 6l6 6-6 6" stroke="#D4C9BC" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    </div>
  );
}
