import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Video, ChevronRight, Clock, MapPin, Target, CheckCircle2, MessageSquare, BookOpen, Sparkles, UserCheck, Dumbbell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { mockVideoAssets } from "@/lib/videoAnalysis";
import { activeThread, getRideEntries, getLatestTrainerFeedback } from "@/lib/developmentThread";
import { getContextualRecommendations, getTrainerRecForItem, contentTypeConfig, practiceExercises, getExercisesForGoal } from "@/lib/learningContent";
import type { LearningItem, PracticeExercise, ExercisePracticeLog } from "@/lib/learningContent";

type ViewState = "main" | "pre-ride" | "post-ride" | "learning-moment";

interface ReflectionData {
  ratings: Record<string, number>;
  note: string;
  practicedExercises: ExercisePracticeLog[];
}

const RidePage = () => {
  const [view, setView] = useState<ViewState>("main");
  const [reflectionData, setReflectionData] = useState<ReflectionData>({ ratings: {}, note: "", practicedExercises: [] });
  const rides = getRideEntries(activeThread);

  const handleReflectionSaved = (data: ReflectionData) => {
    setReflectionData(data);
    setView("learning-moment");
  };

  return (
    <div className="px-6 pt-14 space-y-6">
      <AnimatePresence mode="wait">
        {view === "main" && (
          <MainView key="main" rides={rides} onStartRide={() => setView("pre-ride")} onLogRide={() => setView("post-ride")} />
        )}
        {view === "pre-ride" && (
          <PreRideView key="pre" onBack={() => setView("main")} onStarted={() => setView("post-ride")} />
        )}
        {view === "post-ride" && (
          <PostRideView key="post" onSaved={handleReflectionSaved} />
        )}
        {view === "learning-moment" && (
          <PostRideLearningMoment key="learn" reflectionData={reflectionData} onDone={() => setView("main")} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Main View ───────────────────────────────────────────────────────────────

const MainView = ({
  rides,
  onStartRide,
  onLogRide,
}: {
  rides: ReturnType<typeof getRideEntries>;
  onStartRide: () => void;
  onLogRide: () => void;
}) => {
  const navigate = useNavigate();
  return (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 pb-4">
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">Session</p>
      <h1 className="text-3xl font-display font-semibold text-foreground">Ride</h1>
      <p className="text-sm text-muted-foreground mt-2">Every ride serves your goal</p>
    </div>

    {/* Active Goal Context */}
    <div className="glass-card p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
        <Target size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">Active Focus</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{activeThread.goal}</p>
      </div>
    </div>

    {/* Start Ride CTA */}
    <button
      onClick={onStartRide}
      className="w-full rounded-2xl bg-primary text-primary-foreground p-6 flex items-center gap-5 active:scale-[0.98] transition-transform"
    >
      <div className="w-14 h-14 rounded-2xl bg-primary-foreground/15 flex items-center justify-center">
        <Play size={22} className="text-primary-foreground ml-0.5" />
      </div>
      <div className="text-left flex-1">
        <p className="font-display text-xl font-semibold">Start a Ride</p>
        <p className="text-xs text-primary-foreground/60 mt-1">Set your intent and ride with purpose</p>
      </div>
      <ChevronRight size={16} className="text-primary-foreground/40" />
    </button>

    {/* Quick Actions */}
    <div className="grid grid-cols-2 gap-3">
      <button onClick={onLogRide} className="glass-card p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform">
        <div className="w-10 h-10 rounded-xl bg-warmth-light flex items-center justify-center">
          <CheckCircle2 size={18} className="text-accent" />
        </div>
        <p className="font-medium text-sm text-foreground">Log a Ride</p>
        <p className="text-[10px] text-muted-foreground">Quick reflection</p>
      </button>
      <button onClick={() => navigate("/ride/new/evidence")} className="glass-card p-4 flex flex-col items-center gap-2 active:scale-[0.97] transition-transform">
        <div className="w-10 h-10 rounded-xl bg-warmth-light flex items-center justify-center">
          <Sparkles size={18} className="text-accent" />
        </div>
        <p className="font-medium text-sm text-foreground">Analyze a Ride</p>
        <p className="text-[10px] text-muted-foreground">Upload a ride video and receive visual AI insights</p>
      </button>
    </div>

    {/* Recent Rides */}
    <section>
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-3">Recent Rides</p>
      <div className="space-y-2.5">
        {rides.slice().reverse().map((ride) => {
          const hasVideo = !!mockVideoAssets[ride.id];
          const hasAnalysis = hasVideo; // analysis exists if video exists in mock
          return (
          <div key={ride.id} className="glass-card overflow-hidden active:scale-[0.98] transition-transform cursor-pointer">
            {/* Media thumbnail row */}
            {hasVideo && (
              <button
                onClick={() => navigate(`/ride/${ride.id}/evidence`)}
                className="w-full relative bg-muted/30 h-32 flex items-center justify-center group"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/60" />
                <Video size={28} className="text-muted-foreground/40" />
                {/* Status overlays */}
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <span className="text-[9px] font-medium bg-background/70 backdrop-blur-sm text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Video size={8} /> Video
                  </span>
                  {hasAnalysis && (
                    <span className="text-[9px] font-medium bg-primary/10 backdrop-blur-sm text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles size={8} /> Analyzed
                    </span>
                  )}
                </div>
              </button>
            )}
            <div className="p-3.5">
              <div className="flex items-center gap-3">
                {!hasVideo && (
                  <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center shrink-0">
                    <Clock size={16} className="text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-foreground">{ride.title}</p>
                    <span className="text-[10px] text-muted-foreground">{ride.date}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ride.duration && <span className="text-xs text-muted-foreground">{ride.duration}</span>}
                    {ride.location && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <MapPin size={10} /> {ride.location}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {ride.reflection && (
                <p className={`text-xs text-muted-foreground mt-2 line-clamp-1 italic ${hasVideo ? "" : "pl-[52px]"}`}>"{ride.reflection}"</p>
              )}
              {ride.trainerNote && (
                <div className={`mt-2 flex items-center gap-1.5 ${hasVideo ? "" : "pl-[52px]"}`}>
                  <MessageSquare size={10} className="text-warmth" />
                  <span className="text-[10px] text-warmth font-medium">Trainer feedback from {ride.trainerName}</span>
                </div>
              )}
              {/* Actions row */}
              <div className={`mt-2 flex items-center gap-3 ${hasVideo ? "" : "pl-[52px]"}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/ride/${ride.id}/evidence`); }}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-primary hover:underline"
                >
                  {hasVideo ? <><Sparkles size={10} /> View Evidence Studio</> : <><Video size={10} /> Attach Video</>}
                </button>
                {ride.trainerNote && (
                  <button className="flex items-center gap-1 text-[10px] font-medium text-warmth hover:underline">
                    <UserCheck size={10} /> Trainer feedback
                  </button>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  </motion.div>
  );
};

// ─── Pre-Ride View ───────────────────────────────────────────────────────────

const PreRideView = ({ onBack, onStarted }: { onBack: () => void; onStarted: () => void }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <div>
      <button onClick={onBack} className="text-sm text-primary font-medium mb-2">← Back</button>
      <h1 className="text-2xl font-display font-semibold text-foreground">Session Intent</h1>
      <p className="text-sm text-muted-foreground mt-1">What are you working on today?</p>
    </div>

    <div className="rounded-2xl bg-primary text-primary-foreground p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-primary-foreground/60">Today's Goal</p>
      <p className="font-display font-semibold mt-1">{activeThread.goal}</p>
    </div>

    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skill Targets</p>
      <div className="space-y-2">
        {activeThread.skills.map((skill) => (
          <div key={skill} className="glass-card px-4 py-3 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-sm text-foreground">{skill}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="glass-card p-4 border-l-2 border-l-sage">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Suggested Session</p>
      <p className="text-sm text-foreground">{activeThread.nextAction.title}</p>
      <p className="text-xs text-muted-foreground mt-1">{activeThread.nextAction.rationale}</p>
    </div>

    <button
      onClick={onStarted}
      className="w-full rounded-2xl bg-primary text-primary-foreground p-4 font-display font-semibold text-lg active:scale-[0.97] transition-transform"
    >
      Begin Ride →
    </button>
  </motion.div>
);

// ─── Post-Ride View (with exercise practice logging) ─────────────────────────

const PostRideView = ({ onSaved }: { onSaved: (data: ReflectionData) => void }) => {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [practicedExercises, setPracticedExercises] = useState<ExercisePracticeLog[]>([]);
  const [showExercises, setShowExercises] = useState(false);

  const goalExercises = getExercisesForGoal(activeThread.goal);

  const toggleExercisePracticed = (exercise: PracticeExercise) => {
    const existing = practicedExercises.find((p) => p.exerciseId === exercise.id);
    if (existing) {
      setPracticedExercises((prev) => prev.filter((p) => p.exerciseId !== exercise.id));
    } else {
      setPracticedExercises((prev) => [...prev, { exerciseId: exercise.id, date: "Today", howItWent: "okay", briefReflection: "" }]);
    }
  };

  const updateExerciseLog = (exerciseId: string, field: keyof ExercisePracticeLog, value: string) => {
    setPracticedExercises((prev) =>
      prev.map((p) => (p.exerciseId === exerciseId ? { ...p, [field]: value } : p))
    );
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-display font-semibold text-foreground">Reflect</h1>
        <p className="text-sm text-muted-foreground mt-1">How did your ride serve your goal?</p>
      </div>

      <div className="glass-card p-3.5 flex items-center gap-3">
        <Target size={16} className="text-primary" />
        <p className="text-sm font-medium text-foreground">{activeThread.goal}</p>
      </div>

      {/* Skill Ratings */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">How did each skill feel?</p>
        <div className="space-y-3">
          {activeThread.skills.map((skill) => (
            <div key={skill} className="glass-card p-3.5">
              <p className="text-sm font-medium text-foreground mb-2">{skill}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRatings((prev) => ({ ...prev, [skill]: n }))}
                    className={`w-9 h-9 rounded-xl text-sm font-medium transition-colors ${
                      ratings[skill] === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exercises Practiced */}
      <div>
        <button
          onClick={() => setShowExercises(!showExercises)}
          className="flex items-center gap-2 w-full mb-2"
        >
          <Dumbbell size={14} className="text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Exercises Practiced
          </p>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {practicedExercises.length > 0 ? `${practicedExercises.length} logged` : "Tap to add"}
          </span>
          <ChevronRight size={12} className={`text-muted-foreground transition-transform ${showExercises ? "rotate-90" : ""}`} />
        </button>

        <AnimatePresence>
          {showExercises && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-2">
              {goalExercises.map((exercise) => {
                const practiced = practicedExercises.find((p) => p.exerciseId === exercise.id);
                return (
                  <div key={exercise.id} className={`glass-card p-3.5 transition-colors ${practiced ? "border-l-[3px] border-l-primary" : ""}`}>
                    <button
                      onClick={() => toggleExercisePracticed(exercise)}
                      className="w-full text-left flex items-start gap-2.5"
                    >
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        practiced ? "bg-primary border-primary" : "border-muted-foreground/30"
                      }`}>
                        {practiced && <CheckCircle2 size={12} className="text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{exercise.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {exercise.onSaddle ? "🐴 On-saddle" : "💪 Off-saddle"} · {exercise.estimatedDuration}
                        </p>
                        <p className="text-[11px] text-primary mt-1 italic">↳ {exercise.intent.slice(0, 80)}…</p>
                      </div>
                    </button>

                    {/* Reflection for practiced exercises */}
                    {practiced && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 ml-7 space-y-2.5">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">How did it go?</p>
                          <div className="flex gap-1.5">
                            {(["struggled", "okay", "good", "nailed-it"] as const).map((rating) => (
                              <button
                                key={rating}
                                onClick={() => updateExerciseLog(exercise.id, "howItWent", rating)}
                                className={`text-[10px] font-medium px-2.5 py-1.5 rounded-full transition-colors ${
                                  practiced.howItWent === rating
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {rating === "nailed-it" ? "Nailed it" : rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          value={practiced.briefReflection}
                          onChange={(e) => updateExerciseLog(exercise.id, "briefReflection", e.target.value)}
                          placeholder="Brief note — what felt different?"
                          className="w-full bg-muted/50 rounded-xl p-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none h-14"
                        />
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reflection Note */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Reflection</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What went well? What felt different?"
          className="w-full glass-card p-3.5 text-sm text-foreground placeholder:text-muted-foreground bg-transparent resize-none h-24 outline-none focus:ring-1 focus:ring-primary/30 rounded-2xl"
        />
      </div>

      <div className="flex gap-3">
        <button className="flex-1 glass-card py-3 text-sm font-medium text-foreground active:scale-[0.97] transition-transform">
          Request Trainer Review
        </button>
        <button
          onClick={() => onSaved({ ratings, note, practicedExercises })}
          className="flex-1 rounded-2xl bg-primary text-primary-foreground py-3 text-sm font-semibold active:scale-[0.97] transition-transform"
        >
          Save Reflection
        </button>
      </div>
    </motion.div>
  );
};

// ─── Post-Ride Learning Moment ───────────────────────────────────────────────

const PostRideLearningMoment = ({
  reflectionData,
  onDone,
}: {
  reflectionData: ReflectionData;
  onDone: () => void;
}) => {
  const navigate = useNavigate();
  const trainerFeedback = getLatestTrainerFeedback(activeThread);

  const { learningRecs, practiceRecs, focusSummary } = useMemo(() => {
    const { ratings, note } = reflectionData;
    const ratedSkills = Object.entries(ratings).sort(([, a], [, b]) => a - b);
    const weakestSkillName = ratedSkills.length > 0 ? ratedSkills[0][0] : undefined;
    const weakestRating = ratedSkills.length > 0 ? ratedSkills[0][1] : undefined;
    const trajectory = weakestSkillName
      ? activeThread.skillTrajectories.find((s) => s.name === weakestSkillName)
      : undefined;
    const trend = trajectory?.trend;

    const allRecs = getContextualRecommendations(
      activeThread.goal,
      weakestSkillName,
      trend,
      trainerFeedback?.trainerNote
    );

    const learning = allRecs
      .filter(({ item }) => ["lesson", "explanation", "clinic"].includes(item.type))
      .slice(0, 3);
    const practice = allRecs
      .filter(({ item }) => ["exercise-on-saddle", "exercise-off-saddle"].includes(item.type))
      .slice(0, 2);

    if (learning.length < 2) {
      const extras = allRecs
        .filter(({ item }) => !learning.some((l) => l.item.id === item.id) && !practice.some((p) => p.item.id === item.id))
        .slice(0, 3 - learning.length);
      learning.push(...extras);
    }
    if (practice.length < 1) {
      const extras = allRecs
        .filter(({ item }) => !learning.some((l) => l.item.id === item.id) && !practice.some((p) => p.item.id === item.id))
        .slice(0, 2 - practice.length);
      practice.push(...extras);
    }

    let summary = "";
    if (weakestSkillName && weakestRating && weakestRating <= 3) {
      summary = `Your ${weakestSkillName} felt like it needs work (${weakestRating}/5).`;
      if (trend === "plateau") summary += ` It's been plateauing — targeted practice can break through.`;
      else if (trend === "improving") summary += ` It's been improving though — keep at it.`;
    } else if (note) {
      summary = "Based on your reflection, here's what would help consolidate today's progress.";
    } else {
      summary = "Here's what would help most for your next session.";
    }

    if (trainerFeedback?.trainerNote) {
      summary += ` Emma's recent note: "${trainerFeedback.trainerNote}"`;
    }

    return { learningRecs: learning, practiceRecs: practice, focusSummary: summary };
  }, [reflectionData, trainerFeedback]);

  // Show practiced exercises summary
  const practicedSummary = reflectionData.practicedExercises.length > 0
    ? reflectionData.practicedExercises.map((log) => {
        const ex = practiceExercises.find((e) => e.id === log.exerciseId);
        return ex ? { ...log, exercise: ex } : null;
      }).filter(Boolean) as (ExercisePracticeLog & { exercise: PracticeExercise })[]
    : [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5 pb-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-sage-light flex items-center justify-center">
            <Sparkles size={14} className="text-primary" />
          </div>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Post-Ride Insight</p>
        </div>
        <h1 className="text-2xl font-display font-semibold text-foreground">
          Based on today's ride
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's what would help most next.
        </p>
      </div>

      {/* Reflection summary */}
      <div className="glass-card p-4 border-l-2 border-l-primary">
        <p className="text-sm text-foreground leading-relaxed">{focusSummary}</p>
      </div>

      {/* Practiced exercises recap */}
      {practicedSummary.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Dumbbell size={12} /> Exercises practiced today
          </p>
          <div className="space-y-2">
            {practicedSummary.map(({ exercise, howItWent, briefReflection }) => (
              <div key={exercise.id} className="glass-card p-3 border-l-[3px] border-l-primary">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-primary shrink-0" />
                  <p className="text-sm font-medium text-foreground flex-1">{exercise.title}</p>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    howItWent === "nailed-it" ? "bg-primary/15 text-primary" :
                    howItWent === "good" ? "bg-primary/10 text-primary" :
                    howItWent === "struggled" ? "bg-destructive/10 text-destructive" :
                    "bg-muted text-muted-foreground"
                  }`}>{howItWent === "nailed-it" ? "Nailed it" : howItWent}</span>
                </div>
                {briefReflection && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 ml-[22px] italic">"{briefReflection}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill snapshot */}
      {Object.keys(reflectionData.ratings).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Today's Skill Snapshot</p>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(reflectionData.ratings)
              .sort(([, a], [, b]) => a - b)
              .map(([skill, rating]) => (
                <div key={skill} className="glass-card px-3 py-2 flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{skill}</span>
                  <span className={`text-xs font-bold ${rating <= 2 ? "text-destructive" : rating <= 3 ? "text-warmth" : "text-primary"}`}>
                    {rating}/5
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Learning Resources */}
      {learningRecs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <BookOpen size={12} /> Deepen your understanding
          </p>
          <div className="space-y-2">
            {learningRecs.map(({ item, reason }) => (
              <LearningMomentCard key={item.id} item={item} reason={reason} onTap={() => navigate("/learn")} />
            ))}
          </div>
        </div>
      )}

      {/* Practice Exercises */}
      {practiceRecs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Target size={12} /> Practice for next rides
          </p>
          <div className="space-y-2">
            {practiceRecs.map(({ item, reason }) => (
              <LearningMomentCard key={item.id} item={item} reason={reason} onTap={() => navigate("/learn")} />
            ))}
          </div>
        </div>
      )}

      {/* Suggested exercises for next ride */}
      {practicedSummary.length === 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Dumbbell size={12} /> Try these exercises next ride
          </p>
          <div className="space-y-2">
            {getExercisesForGoal(activeThread.goal).slice(0, 2).map((ex) => (
              <div key={ex.id} className="glass-card p-3.5">
                <p className="text-sm font-medium text-foreground">{ex.title}</p>
                <p className="text-[11px] text-primary mt-1 italic">↳ {ex.intent.slice(0, 100)}…</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {ex.onSaddle ? "🐴 On-saddle" : "💪 Off-saddle"} · {ex.estimatedDuration} · Supports: {ex.linkedSkills.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      <button
        onClick={onDone}
        className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-sm font-semibold active:scale-[0.97] transition-transform"
      >
        Got it — back to rides
      </button>
    </motion.div>
  );
};

const LearningMomentCard = ({
  item,
  reason,
  onTap,
}: {
  item: LearningItem;
  reason: string;
  onTap: () => void;
}) => {
  const typeConfig = contentTypeConfig[item.type];
  const trainerRec = getTrainerRecForItem(item.id);
  const isTrainer = !!trainerRec;

  return (
    <button onClick={onTap} className={`w-full text-left glass-card p-3.5 active:scale-[0.98] transition-transform ${isTrainer ? "border-l-[3px] border-l-warmth" : ""}`}>
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
                <Sparkles size={8} /> AI-suggested
              </span>
            )}
            <span className="text-[9px] text-muted-foreground">· {typeConfig.label} · {item.duration}</span>
            {trainerRec?.priority === "required" && (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warmth text-white">Required</span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {isTrainer && trainerRec.note && (
            <p className="text-[11px] text-warmth mt-1 italic leading-snug">↳ "{trainerRec.note}"</p>
          )}
          {!isTrainer && (
            <p className="text-[11px] text-primary mt-1 italic leading-snug">↳ Why this is relevant now: {reason}</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-0.5">
            What this supports: {item.linkedSkills.join(", ")}
          </p>
        </div>
        <ChevronRight size={12} className="text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
};

export default RidePage;
