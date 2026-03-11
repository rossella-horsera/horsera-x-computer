import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, CheckCircle2, TrendingUp, ArrowRight, ChevronDown, ChevronUp, Award, BookOpen, ChevronRight, UserCheck, Sparkles, Dumbbell, Link2, ShieldCheck, Info, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { activeThread, completedThread, entryTypeConfig, getLatestTrainerFeedback, getJourneyChains } from "@/lib/developmentThread";
import type { DevelopmentThread, SkillTrajectory, ThreadEntry, JourneyChain } from "@/lib/developmentThread";
import { getContextualRecommendations, getItemsByGoal, getTrainerRecForItem, contentTypeConfig, practiceExercises } from "@/lib/learningContent";
import type { LearningItem } from "@/lib/learningContent";

const ProgressPage = () => {
  const [expandedThread, setExpandedThread] = useState<string | null>(activeThread.id);

  const navigate = useNavigate();

  return (
    <div className="px-6 pt-14 pb-6 space-y-7">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">Development</p>
        <h1 className="text-3xl font-display font-semibold text-foreground">Your Progress</h1>
        <p className="text-sm text-muted-foreground mt-2">Learning informs practice. Performance proves progress.</p>
      </motion.div>

      {/* ── Position & Stability Link ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
        <button
          onClick={() => navigate("/progress/position-stability")}
          className="w-full glass-card p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target size={18} className="text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">Position & Stability</p>
              <p className="text-[11px] text-muted-foreground">Longitudinal biomechanics across rides</p>
            </div>
          </div>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </motion.div>

      {/* ── How Progress Works ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <ProgressPipelineCard />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <ThreadSection
          thread={activeThread}
          expanded={expandedThread === activeThread.id}
          onToggle={() => setExpandedThread(expandedThread === activeThread.id ? null : activeThread.id)}
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <ThreadSection
          thread={completedThread}
          expanded={expandedThread === completedThread.id}
          onToggle={() => setExpandedThread(expandedThread === completedThread.id ? null : completedThread.id)}
        />
      </motion.div>
    </div>
  );
};

// ─── Progress Pipeline Explainer ─────────────────────────────────────────────

const ProgressPipelineCard = () => {
  const [expanded, setExpanded] = useState(false);

  const steps = [
    { icon: "📖", label: "Learn", desc: "Knowledge & understanding", color: "text-blue-500" },
    { icon: "🐴", label: "Practice", desc: "Apply in the saddle", color: "text-primary" },
    { icon: "📊", label: "Perform", desc: "Measurable improvement", color: "text-primary" },
    { icon: "✅", label: "Validate", desc: "Trainer-confirmed mastery", color: "text-warmth" },
  ];

  return (
    <div className="glass-card p-3.5">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info size={14} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">How milestone progress works</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-3">
          <div className="flex items-center gap-1.5">
            {steps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1.5">
                {i > 0 && <ArrowRight size={10} className="text-muted-foreground shrink-0" />}
                <div className="flex items-center gap-1">
                  <span className="text-xs">{step.icon}</span>
                  <span className={`text-[10px] font-semibold ${step.color}`}>{step.label}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
            <p>📖 <strong className="text-foreground">Completing a lesson ≠ skill improvement.</strong> Learning builds understanding, but progress is only measured through riding performance.</p>
            <p>📊 <strong className="text-foreground">Skill scores come from rides</strong>, not from watching videos or reading content.</p>
            <p>✅ <strong className="text-foreground">Milestone validation requires trainer confirmation</strong> — either through direct observation or video review.</p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ─── Thread Section ──────────────────────────────────────────────────────────

const ThreadSection = ({
  thread,
  expanded,
  onToggle,
}: {
  thread: DevelopmentThread;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const navigate = useNavigate();
  const isActive = thread.status === "active";
  const trainerFeedback = getLatestTrainerFeedback(thread);
  const goalItems = getItemsByGoal(thread.goal);
  const journeyChains = getJourneyChains(thread);
  const entryMap = new Map(thread.entries.map((e) => [e.id, e]));

  // Counts
  const learnCount = thread.entries.filter((e) => e.type === "learn").length;
  const rideCount = thread.entries.filter((e) => e.type === "ride").length;
  const hasValidation = thread.entries.some((e) => e.validated);

  return (
    <div className="space-y-3">
      {/* Header */}
      <button onClick={onToggle} className="w-full text-left">
        <div className={`rounded-2xl p-4 ${isActive ? "bg-primary text-primary-foreground" : "glass-card"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isActive ? (
                <Target size={20} className="text-primary-foreground" />
              ) : (
                <CheckCircle2 size={20} className="text-primary" />
              )}
              <div>
                <p className={`text-[10px] uppercase tracking-wider font-semibold ${isActive ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {isActive ? "Active Goal" : "Completed & Validated"}
                </p>
                <p className={`font-display font-semibold ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                  {thread.goal}
                </p>
              </div>
            </div>
            {expanded ? (
              <ChevronUp size={18} className={isActive ? "text-primary-foreground/50" : "text-muted-foreground"} />
            ) : (
              <ChevronDown size={18} className={isActive ? "text-primary-foreground/50" : "text-muted-foreground"} />
            )}
          </div>
          <p className={`text-xs mt-1.5 ${isActive ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {thread.startDate} {thread.completedDate ? `→ ${thread.completedDate}` : "→ now"} · {learnCount} learned · {rideCount} rides{hasValidation ? " · ✅ Validated" : ""}
          </p>
        </div>
      </button>

      {expanded && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-4 overflow-hidden">

          {/* ── Journey Chains: "I learned X → practiced Y → improved Z" ── */}
          {journeyChains.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <Link2 size={12} /> How learning shaped your riding
              </p>
              <p className="text-[10px] text-muted-foreground mb-2 italic">
                Learning informed these rides — progress was measured by performance, not completion.
              </p>
              <div className="space-y-2.5">
                {journeyChains.slice(0, 4).map((chain, i) => (
                  <JourneyChainCard key={i} chain={chain} />
                ))}
              </div>
            </div>
          )}

          {/* ── Recommended Learning for This Goal ── */}
          {goalItems.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen size={12} /> Learning for this goal
                </p>
                <button onClick={() => navigate("/learn")} className="text-[10px] text-primary font-medium flex items-center gap-0.5">
                  View all <ChevronRight size={10} />
                </button>
              </div>
              <div className="space-y-2">
                {getContextualRecommendations(
                  thread.goal,
                  undefined,
                  undefined,
                  trainerFeedback?.trainerNote
                ).map(({ item, reason }) => (
                  <RecommendedCard key={item.id} item={item} reason={reason} />
                ))}
              </div>
            </div>
          )}

          {/* Skill Trajectories — validated by performance */}
          {isActive && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skill Breakdown</p>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-0.5">
                  <Eye size={8} /> Measured from rides
                </span>
              </div>
              <div className="space-y-2">
                {thread.skillTrajectories.map((skill) => (
                  <SkillCard
                    key={skill.name}
                    skill={skill}
                    goalName={thread.goal}
                    trainerNote={trainerFeedback?.trainerNote}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Thread Timeline — enriched with learning connections */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Journey Timeline</p>
            <div className="relative pl-4 border-l-2 border-border space-y-3">
              {thread.entries.map((entry) => (
                <TimelineEntry key={entry.id} entry={entry} entryMap={entryMap} />
              ))}
            </div>
          </div>

          {thread.validationSource && (
            <div className="glass-card p-3.5 border-l-[3px] border-l-warmth bg-warmth/5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-warmth" />
                <span className="text-xs font-semibold text-warmth">Milestone Validated by Trainer</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{thread.validationSource}</p>
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                Validation confirms mastery through observed performance — not learning completion alone.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

// ─── Timeline Entry (with learn vs progress distinction) ─────────────────────

const TimelineEntry = ({ entry, entryMap }: { entry: ThreadEntry; entryMap: Map<string, ThreadEntry> }) => {
  const config = entryTypeConfig[entry.type];
  const informedByEntries = entry.informedBy?.map((id) => entryMap.get(id)).filter(Boolean) as ThreadEntry[] | undefined;
  const exerciseNames = entry.practicedExercises?.map((id) => practiceExercises.find((e) => e.id === id)?.title).filter(Boolean);

  // Visual distinction: learn entries are blue/informational, ride progress is green, validation is gold
  const isLearn = entry.type === "learn";
  const isValidated = entry.validated;
  const hasProgress = entry.ledToProgress && entry.ledToProgress.length > 0;

  return (
    <div className="relative">
      <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-background ${
        isValidated ? "bg-warmth" : config.color
      }`} />
      <div className={`glass-card p-3 ${
        isLearn ? "border-l-[3px] border-l-blue-400/50" : 
        isValidated ? "border-l-[3px] border-l-warmth" :
        hasProgress ? "border-l-[3px] border-l-primary" : ""
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs">{config.icon}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{config.label}</span>
          <span className="text-[10px] text-muted-foreground">· {entry.date}</span>
          {/* Status badge */}
          {isLearn && (
            <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 ml-auto">
              Knowledge
            </span>
          )}
          {hasProgress && !isValidated && (
            <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-auto flex items-center gap-0.5">
              <TrendingUp size={7} /> Performance
            </span>
          )}
          {isValidated && (
            <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warmth/15 text-warmth ml-auto flex items-center gap-0.5">
              <ShieldCheck size={7} /> Validated
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground">{entry.title}</p>

        {/* Learn entries: show what it builds understanding of, but NOT progress */}
        {isLearn && entry.description && (
          <p className="text-xs text-blue-500/80 mt-0.5">{entry.description}</p>
        )}

        {entry.reflection && (
          <p className="text-xs text-muted-foreground mt-1 italic">"{entry.reflection}"</p>
        )}
        {entry.insight && (
          <p className="text-xs text-muted-foreground mt-1">{entry.insight}</p>
        )}
        {entry.recommendation && (
          <div className="flex items-start gap-1.5 mt-1.5">
            <ArrowRight size={12} className="text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-accent">{entry.recommendation}</p>
          </div>
        )}

        {/* Informed by — which learning fed this ride */}
        {informedByEntries && informedByEntries.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-500 mb-1 flex items-center gap-1">
              <BookOpen size={9} /> Informed by <span className="font-normal text-muted-foreground">(learning, not validation)</span>
            </p>
            <div className="flex flex-wrap gap-1">
              {informedByEntries.map((src) => (
                <span key={src.id} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                  {entryTypeConfig[src.type].icon} {src.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Exercises practiced */}
        {exerciseNames && exerciseNames.length > 0 && (
          <div className="mt-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
              <Dumbbell size={9} /> Exercises practiced
            </p>
            <div className="flex flex-wrap gap-1">
              {exerciseNames.map((name, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-sage-light text-primary font-medium">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Progress made — from performance, not learning */}
        {hasProgress && (
          <div className="mt-1.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
              <TrendingUp size={9} /> Progress from this ride
            </p>
            <div className="flex flex-wrap gap-1.5">
              {entry.ledToProgress!.map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                  {p.skill}
                  {p.from > 0 && (
                    <span className="text-[9px] opacity-70">{p.from}→{p.to}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.trainerNote && (
          <div className="mt-2 p-2 rounded-xl bg-warmth-light">
            <p className="text-[10px] font-semibold text-warmth">{entry.trainerName}</p>
            <p className="text-xs text-foreground mt-0.5">"{entry.trainerNote}"</p>
          </div>
        )}
        {isValidated && (
          <div className="flex items-center gap-1.5 mt-2 p-2 rounded-xl bg-warmth/10">
            <ShieldCheck size={12} className="text-warmth" />
            <span className="text-[10px] font-semibold text-warmth">Trainer-validated achievement</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Journey Chain Card ─────────────────────────────────────────────────────

const JourneyChainCard = ({ chain }: { chain: JourneyChain }) => {
  const learnConfig = entryTypeConfig[chain.learned.type];

  return (
    <div className="glass-card p-3.5 border-l-[3px] border-l-blue-400">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Learned — informational */}
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-0.5">
            {learnConfig.icon} {chain.learned.title}
          </span>
          <ArrowRight size={10} className="text-muted-foreground shrink-0" />
          <span className="text-[8px] text-muted-foreground italic">informed</span>
          <ArrowRight size={10} className="text-muted-foreground shrink-0" />
          {/* Practiced — performance */}
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-sage-light text-primary flex items-center gap-0.5">
            🐴 {chain.practiced.title} · {chain.practiced.date}
          </span>
          <ArrowRight size={10} className="text-muted-foreground shrink-0" />
          <span className="text-[8px] text-muted-foreground italic">proved</span>
          <ArrowRight size={10} className="text-muted-foreground shrink-0" />
          {/* Improved — measured result */}
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-0.5">
            📈 {chain.improved.skill}
            {chain.improved.from > 0 && (
              <span className="font-normal opacity-70 ml-0.5">{chain.improved.from}→{chain.improved.to}</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Recommended Card ────────────────────────────────────────────────────────

const RecommendedCard = ({ item, reason }: { item: LearningItem; reason: string }) => {
  const navigate = useNavigate();
  const typeConfig = contentTypeConfig[item.type];
  const trainerRec = getTrainerRecForItem(item.id);
  const isTrainer = !!trainerRec;

  return (
    <button
      onClick={() => navigate("/learn")}
      className={`w-full text-left glass-card p-3 active:scale-[0.98] transition-transform ${isTrainer ? "border-l-[3px] border-l-warmth" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {isTrainer ? (
              <span className="text-[9px] font-bold uppercase tracking-wider text-warmth flex items-center gap-0.5">
                <UserCheck size={9} /> {trainerRec.trainerName}
              </span>
            ) : (
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-0.5">
                <Sparkles size={8} /> AI
              </span>
            )}
            <span className="text-[9px] text-muted-foreground">· {typeConfig.label} · {item.duration}</span>
            {trainerRec?.priority === "required" && (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warmth text-white">Required</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {isTrainer && trainerRec.note ? (
            <p className="text-[11px] text-warmth mt-1 italic leading-snug">↳ "{trainerRec.note}"</p>
          ) : (
            <p className="text-[11px] text-primary mt-1 italic leading-snug">↳ Why now: {reason}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Supports: {item.linkedSkills.join(", ")}
          </p>
        </div>
        <ChevronRight size={12} className="text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
};

// ─── Skill Card with recommendations ─────────────────────────────────────────

const SkillCard = ({
  skill,
  goalName,
  trainerNote,
}: {
  skill: SkillTrajectory;
  goalName: string;
  trainerNote?: string;
}) => {
  const [showRecs, setShowRecs] = useState(false);
  const navigate = useNavigate();
  const trendColor = skill.trend === "improving" ? "text-primary" : skill.trend === "plateau" ? "text-warmth" : "text-destructive";
  const trendLabel = skill.trend === "improving" ? "Improving" : skill.trend === "plateau" ? "Plateau" : "Needs focus";

  const recs = getContextualRecommendations(goalName, skill.name, skill.trend, trainerNote);

  return (
    <div className="glass-card p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-foreground">{skill.name}</p>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${trendColor} flex items-center gap-1`}>
          <TrendingUp size={10} /> {trendLabel}
        </span>
      </div>
      {/* Mini trajectory dots */}
      <div className="flex items-center gap-1">
        {skill.dataPoints.map((dp, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className="w-4 h-px bg-border" />}
            <div className="flex flex-col items-center gap-0.5">
              <div className={`w-3 h-3 rounded-full ${i === skill.dataPoints.length - 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <span className="text-[8px] text-muted-foreground">{dp.score}</span>
            </div>
          </div>
        ))}
        <span className="text-[8px] text-muted-foreground ml-2 italic">from rides</span>
      </div>
      {skill.latestNote && (
        <p className="text-xs text-muted-foreground mt-2">{skill.latestNote}</p>
      )}

      {/* Practice suggestions toggle */}
      {recs.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50">
          <button
            onClick={() => setShowRecs(!showRecs)}
            className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary"
          >
            <BookOpen size={10} />
            {showRecs ? "Hide" : "Show"} suggested learning ({recs.length})
            {showRecs ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showRecs && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 space-y-1.5">
              {recs.map(({ item, reason }) => (
                <button
                  key={item.id}
                  onClick={() => navigate("/learn")}
                  className="w-full text-left p-2 rounded-xl bg-background/60 active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs">{contentTypeConfig[item.type].icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{item.title}</p>
                      <p className="text-[10px] text-primary mt-0.5 italic">↳ {reason}</p>
                    </div>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressPage;
