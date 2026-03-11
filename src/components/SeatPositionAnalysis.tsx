import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Play, Shield } from "lucide-react";
import {
  type SeatAnalysisData, type SeatMetric, type SeatView, type InsightStatus, type InsightConfidence,
  statusConfig, confidenceConfig,
} from "@/lib/videoAnalysis";

// ─── Color System ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<InsightStatus, { fill: string; stroke: string; label: string }> = {
  good: { fill: "hsl(152, 38%, 45%)", stroke: "hsl(152, 38%, 55%)", label: "hsl(152, 38%, 35%)" },
  moderate: { fill: "hsl(38, 70%, 52%)", stroke: "hsl(38, 70%, 62%)", label: "hsl(38, 70%, 42%)" },
  "needs-attention": { fill: "hsl(0, 60%, 52%)", stroke: "hsl(0, 60%, 62%)", label: "hsl(0, 60%, 42%)" },
};

function desaturate(color: string, factor: number): string {
  // Reduce saturation for low confidence
  return color.replace(/(\d+)%/, (_, s) => `${Math.round(Number(s) * factor)}%`);
}

function metricToStatus(metric: SeatMetric): InsightStatus {
  const dist = Math.abs(metric.valueDegrees) - metric.idealMax;
  if (dist <= 0) return "good";
  if (dist <= 3) return "moderate";
  return "needs-attention";
}

function getSegmentColor(status: InsightStatus, confidence: InsightConfidence): string {
  const base = STATUS_COLORS[status].fill;
  return confidence === "low" ? desaturate(base, 0.5) : base;
}

function getSegmentStroke(status: InsightStatus, confidence: InsightConfidence): string {
  const base = STATUS_COLORS[status].stroke;
  return confidence === "low" ? desaturate(base, 0.5) : base;
}

// ─── Arc Gauge SVG ───────────────────────────────────────────────────────────

const ArcGauge = ({ metric, confidence, size = 60 }: { metric: SeatMetric; confidence: InsightConfidence; size?: number }) => {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const startAngle = -150;
  const endAngle = -30;
  const totalArc = endAngle - startAngle;
  const maxRange = 20;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPoint = (angle: number) => ({
    x: cx + r * Math.cos(toRad(angle)),
    y: cy + r * Math.sin(toRad(angle)),
  });

  // Background arc
  const bgStart = arcPoint(startAngle);
  const bgEnd = arcPoint(endAngle);
  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${r} ${r} 0 0 1 ${bgEnd.x} ${bgEnd.y}`;

  // Ideal range band
  const idealStartFrac = Math.max(0, metric.idealMin / maxRange);
  const idealEndFrac = Math.min(1, metric.idealMax / maxRange);
  const idealStartAngle = startAngle + idealStartFrac * totalArc;
  const idealEndAngle = startAngle + idealEndFrac * totalArc;
  const idealStart = arcPoint(idealStartAngle);
  const idealEnd = arcPoint(idealEndAngle);
  const idealPath = `M ${idealStart.x} ${idealStart.y} A ${r} ${r} 0 0 1 ${idealEnd.x} ${idealEnd.y}`;

  // Needle position
  const valueFrac = Math.min(1, Math.max(0, Math.abs(metric.valueDegrees) / maxRange));
  const needleAngle = startAngle + valueFrac * totalArc;
  const needleLength = r - 8;
  const needleEnd = {
    x: cx + needleLength * Math.cos(toRad(needleAngle)),
    y: cy + needleLength * Math.sin(toRad(needleAngle)),
  };

  // Marker dot on the arc
  const markerPos = arcPoint(needleAngle);

  const status = metricToStatus(metric);
  const color = getSegmentColor(status, confidence);
  const strokeColor = getSegmentStroke(status, confidence);

  return (
    <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
      {/* Background arc */}
      <path d={bgPath} fill="none" stroke="hsl(35, 15%, 85%)" strokeWidth={6} strokeLinecap="round" />
      {/* Ideal range (green band) */}
      <path d={idealPath} fill="none" stroke="hsl(152, 35%, 75%)" strokeWidth={6} strokeLinecap="round" opacity={0.7} />
      {/* Needle line */}
      <line x1={cx} y1={cy} x2={needleEnd.x} y2={needleEnd.y} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      {/* Marker dot on arc */}
      <circle cx={markerPos.x} cy={markerPos.y} r={5} fill={color} stroke="hsl(40, 33%, 97%)" strokeWidth={2} />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={2.5} fill="hsl(35, 15%, 70%)" />
    </svg>
  );
};

// ─── Rider Silhouette SVG with Color-Coded Segments ──────────────────────────

const RiderSilhouette = ({
  view,
  metrics,
  confidence,
}: {
  view: SeatView;
  metrics: SeatAnalysisData["metrics"];
  confidence: InsightConfidence;
}) => {
  const w = 200;
  const h = 320;

  const joints = view === "back"
    ? {
        head: { x: 100, y: 30 }, neck: { x: 100, y: 50 },
        shoulderL: { x: 70, y: 65 }, shoulderR: { x: 130, y: 65 },
        elbowL: { x: 58, y: 100 }, elbowR: { x: 142, y: 100 },
        handL: { x: 65, y: 130 }, handR: { x: 135, y: 130 },
        hipL: { x: 80, y: 145 }, hipR: { x: 120, y: 145 },
        pelvis: { x: 100, y: 145 },
        kneeL: { x: 72, y: 195 }, kneeR: { x: 128, y: 195 },
        ankleL: { x: 70, y: 245 }, ankleR: { x: 130, y: 245 },
      }
    : view === "left"
    ? {
        head: { x: 105, y: 25 }, neck: { x: 100, y: 48 },
        shoulderL: { x: 95, y: 65 }, shoulderR: { x: 95, y: 65 },
        elbowL: { x: 80, y: 105 }, elbowR: { x: 80, y: 105 },
        handL: { x: 85, y: 135 }, handR: { x: 85, y: 135 },
        hipL: { x: 105, y: 145 }, hipR: { x: 105, y: 145 },
        pelvis: { x: 105, y: 145 },
        kneeL: { x: 80, y: 195 }, kneeR: { x: 80, y: 195 },
        ankleL: { x: 90, y: 250 }, ankleR: { x: 90, y: 250 },
      }
    : {
        head: { x: 95, y: 25 }, neck: { x: 100, y: 48 },
        shoulderL: { x: 105, y: 65 }, shoulderR: { x: 105, y: 65 },
        elbowL: { x: 120, y: 105 }, elbowR: { x: 120, y: 105 },
        handL: { x: 115, y: 135 }, handR: { x: 115, y: 135 },
        hipL: { x: 95, y: 145 }, hipR: { x: 95, y: 145 },
        pelvis: { x: 95, y: 145 },
        kneeL: { x: 120, y: 195 }, kneeR: { x: 120, y: 195 },
        ankleL: { x: 110, y: 250 }, ankleR: { x: 110, y: 250 },
      };

  // Color segments by their related metric
  const pelvisColor = getSegmentColor(metricToStatus(metrics.pelvicBalance), confidence);
  const hipColor = getSegmentColor(metricToStatus(metrics.hipDrop), confidence);
  const torsoColor = getSegmentColor(metricToStatus(metrics.upperBodyLean), confidence);
  const neutralColor = "hsl(35, 20%, 70%)";

  // Segment drawing helper
  const seg = (x1: number, y1: number, x2: number, y2: number, color: string, width = 3) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} strokeLinecap="round" />
  );

  // Vertical balance line
  const balanceLineColor = metricToStatus(metrics.upperBodyLean) === "good"
    ? "hsl(152, 28%, 75%)"
    : metricToStatus(metrics.upperBodyLean) === "moderate"
    ? "hsl(38, 50%, 70%)"
    : "hsl(0, 40%, 70%)";

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mx-auto">
      {/* Vertical balance line */}
      <line
        x1={joints.head.x} y1={joints.head.y}
        x2={joints.pelvis.x} y2={joints.pelvis.y}
        stroke={balanceLineColor} strokeWidth={1} strokeDasharray="4 3" opacity={0.5}
      />

      {/* Torso — colored by upper body lean */}
      {seg(joints.neck.x, joints.neck.y, joints.pelvis.x, joints.pelvis.y, torsoColor, 4)}

      {/* Shoulders — neutral */}
      {seg(joints.shoulderL.x, joints.shoulderL.y, joints.shoulderR.x, joints.shoulderR.y, neutralColor)}

      {/* Arms — neutral */}
      {seg(joints.shoulderL.x, joints.shoulderL.y, joints.elbowL.x, joints.elbowL.y, neutralColor, 2.5)}
      {seg(joints.elbowL.x, joints.elbowL.y, joints.handL.x, joints.handL.y, neutralColor, 2.5)}
      {view === "back" && (
        <>
          {seg(joints.shoulderR.x, joints.shoulderR.y, joints.elbowR.x, joints.elbowR.y, neutralColor, 2.5)}
          {seg(joints.elbowR.x, joints.elbowR.y, joints.handR.x, joints.handR.y, neutralColor, 2.5)}
        </>
      )}

      {/* Hips — colored by hip drop */}
      {seg(joints.hipL.x, joints.hipL.y, joints.hipR.x, joints.hipR.y, hipColor, 3.5)}

      {/* Upper legs — colored by hip metric */}
      {seg(joints.hipL.x, joints.hipL.y, joints.kneeL.x, joints.kneeL.y, hipColor, 2.5)}
      {view === "back" && seg(joints.hipR.x, joints.hipR.y, joints.kneeR.x, joints.kneeR.y, hipColor, 2.5)}

      {/* Lower legs — neutral */}
      {seg(joints.kneeL.x, joints.kneeL.y, joints.ankleL.x, joints.ankleL.y, neutralColor, 2.5)}
      {view === "back" && seg(joints.kneeR.x, joints.kneeR.y, joints.ankleR.x, joints.ankleR.y, neutralColor, 2.5)}

      {/* Pelvis highlight zone — colored by pelvic balance */}
      <ellipse
        cx={joints.pelvis.x} cy={joints.pelvis.y}
        rx={view === "back" ? 24 : 16} ry={12}
        fill={pelvisColor} opacity={0.25}
        stroke={pelvisColor} strokeWidth={2}
      />

      {/* Joint dots */}
      {Object.values(joints).map((j, i) => (
        <circle key={i} cx={j.x} cy={j.y} r={4} fill="hsl(40, 33%, 97%)" stroke="hsl(35, 20%, 65%)" strokeWidth={1.5} />
      ))}

      {/* Head */}
      <circle cx={joints.head.x} cy={joints.head.y} r={14} fill="hsl(25, 15%, 30%)" stroke="hsl(35, 20%, 65%)" strokeWidth={1.5} />
    </svg>
  );
};

// ─── Metric Card ─────────────────────────────────────────────────────────────

const MetricCard = ({ metric, confidence, side }: { metric: SeatMetric; confidence: InsightConfidence; side: "left" | "right" }) => {
  const status = metricToStatus(metric);
  const colors = STATUS_COLORS[status];
  const labelColor = confidence === "low" ? desaturate(colors.label, 0.5) : colors.label;

  return (
    <div className={`flex items-center gap-2 ${side === "right" ? "flex-row-reverse text-right" : ""}`}>
      <ArcGauge metric={metric} confidence={confidence} size={56} />
      <div>
        <p className="text-[10px] font-semibold text-foreground">{metric.label}</p>
        <p className="text-[10px] text-muted-foreground">
          You: <span className="font-semibold" style={{ color: labelColor }}>{metric.valueDegrees}°</span>
        </p>
        <p className="text-[9px] text-muted-foreground">
          Ideal: {metric.idealMin}–{metric.idealMax}°
        </p>
      </div>
    </div>
  );
};

// ─── Overall Status Computation ──────────────────────────────────────────────

function computeOverallStatus(metrics: SeatAnalysisData["metrics"]): InsightStatus {
  // Based on the MOST significant deviation, not average
  const statuses = [
    metricToStatus(metrics.pelvicBalance),
    metricToStatus(metrics.hipDrop),
    metricToStatus(metrics.upperBodyLean),
    metricToStatus(metrics.seatStability),
  ];
  if (statuses.includes("needs-attention")) return "needs-attention";
  if (statuses.includes("moderate")) return "moderate";
  return "good";
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface SeatPositionAnalysisProps {
  seatAnalysis: SeatAnalysisData;
  extractedFrames: string[];
  onJumpToTimestamp: (seconds: number) => void;
}

const SeatPositionAnalysis = ({
  seatAnalysis,
  extractedFrames,
  onJumpToTimestamp,
}: SeatPositionAnalysisProps) => {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<SeatView>("left");
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(0);

  // Compute overall status from most significant deviation
  const computedStatus = computeOverallStatus(seatAnalysis.metrics);
  const stConfig = statusConfig[computedStatus] || statusConfig["moderate"];
  const confConfig = confidenceConfig[seatAnalysis.confidence] || confidenceConfig["low"];
  const overallColors = STATUS_COLORS[computedStatus];

  // Get evidence frames
  const evidenceFrames = seatAnalysis.evidenceFrameIndices
    .filter((idx) => idx < extractedFrames.length)
    .slice(0, 3);

  const thumbnailFrame = evidenceFrames.length > 0 ? extractedFrames[evidenceFrames[0]] : extractedFrames[0];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {/* Collapsed Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left glass-card p-3.5 active:scale-[0.99] transition-transform"
      >
        <div className="flex items-start gap-3">
          {/* Thumbnail with status border */}
          {thumbnailFrame && !expanded && (
            <div
              className="shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2"
              style={{ borderColor: overallColors.stroke }}
            >
              <img src={thumbnailFrame} alt="Seat frame" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">🪑</span>
              <span className="text-xs font-semibold text-foreground">Seat Position</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${overallColors.fill}15`,
                  color: overallColors.label,
                }}
              >
                {stConfig.label}
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={`w-1 h-1 rounded-full ${i < confConfig.dots ? "bg-foreground" : "bg-border"}`} />
                ))}
                <span className="ml-0.5">{confConfig.label}</span>
              </span>
            </div>
          </div>

          {expanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0 mt-1" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0 mt-1" />}
        </div>
      </button>

      {/* Expanded Panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card mt-1 p-4 space-y-5">
              {/* View Switcher */}
              <div className="flex rounded-xl bg-muted p-1 gap-1">
                {(["left", "back", "right"] as SeatView[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize transition-colors ${
                      view === v ? "bg-foreground text-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {v === "left" ? "Left" : v === "back" ? "Back" : "Right"}
                  </button>
                ))}
              </div>

              {/* Color Legend */}
              <div className="flex items-center gap-3 justify-center">
                {([
                  { status: "good" as InsightStatus, label: "Good" },
                  { status: "moderate" as InsightStatus, label: "Watch" },
                  { status: "needs-attention" as InsightStatus, label: "Focus" },
                ]).map(({ status, label }) => (
                  <div key={status} className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status].fill }} />
                    <span className="text-[9px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              {/* Rider Pose + Metrics */}
              <div className="relative">
                <div className="flex items-start justify-between">
                  {/* Left metrics */}
                  <div className="space-y-4 pt-8 flex-shrink-0 w-[90px]">
                    <MetricCard metric={seatAnalysis.metrics.pelvicBalance} confidence={seatAnalysis.confidence} side="left" />
                    <MetricCard metric={seatAnalysis.metrics.seatStability} confidence={seatAnalysis.confidence} side="left" />
                  </div>

                  {/* Rider figure */}
                  <div className="flex-shrink-0">
                    <RiderSilhouette view={view} metrics={seatAnalysis.metrics} confidence={seatAnalysis.confidence} />
                  </div>

                  {/* Right metrics */}
                  <div className="space-y-4 pt-8 flex-shrink-0 w-[90px]">
                    <MetricCard metric={seatAnalysis.metrics.hipDrop} confidence={seatAnalysis.confidence} side="right" />
                    <MetricCard metric={seatAnalysis.metrics.upperBodyLean} confidence={seatAnalysis.confidence} side="right" />
                  </div>
                </div>
              </div>

              {/* Evidence Selector */}
              {evidenceFrames.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Evidence</p>
                  <div className="flex gap-2">
                    {evidenceFrames.map((frameIdx, i) => (
                      <button
                        key={frameIdx}
                        onClick={() => {
                          setSelectedFrameIdx(i);
                          if (seatAnalysis.evidenceTimestamps[i] !== undefined) {
                            onJumpToTimestamp(seatAnalysis.evidenceTimestamps[i]);
                          }
                        }}
                        className={`relative flex-1 rounded-xl overflow-hidden border-2 transition-colors ${
                          selectedFrameIdx === i ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <img
                          src={extractedFrames[frameIdx]}
                          alt={`Seat evidence ${i + 1}`}
                          className="w-full aspect-[4/3] object-cover"
                        />
                        <div className="absolute inset-0 bg-foreground/10 hover:bg-foreground/20 transition-colors flex items-center justify-center">
                          <Play size={16} className="text-background opacity-60" />
                        </div>
                        {seatAnalysis.evidenceTimestamps[i] !== undefined && (
                          <span className="absolute bottom-1 left-1 text-[8px] bg-foreground/60 text-background px-1 py-0.5 rounded font-medium">
                            {formatTime(seatAnalysis.evidenceTimestamps[i])}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Coach Feedback */}
              <div className="space-y-2.5 pt-1">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Seat Summary</p>
                  <p className="text-xs text-foreground leading-relaxed">{seatAnalysis.summary}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Why it matters</p>
                  <p className="text-xs text-foreground leading-relaxed">{seatAnalysis.whyItMatters}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-sage-light/50">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Try this</p>
                  <p className="text-xs font-medium text-foreground">{seatAnalysis.tryThis}</p>
                </div>
              </div>

              {/* Confidence note */}
              {seatAnalysis.confidence === "low" && (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                  <Shield size={10} className="text-muted-foreground shrink-0" />
                  <p className="text-[9px] text-muted-foreground italic">
                    Lower confidence — colors are softened. Results may improve with clearer video angles.
                  </p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="flex items-center gap-1">
                <Shield size={9} className="text-muted-foreground" />
                <p className="text-[9px] text-muted-foreground italic">Assistive · AI Vision · Reuses existing pose data</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default SeatPositionAnalysis;
