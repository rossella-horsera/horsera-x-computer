import { motion } from "framer-motion";
import { Play, BookOpen, ChevronRight, Sparkles, ArrowRight, Target, ArrowUpRight } from "lucide-react";
import { activeThread, getLatestTrainerFeedback, entryTypeConfig, getJourneyChains } from "@/lib/developmentThread";
import type { EntryType } from "@/lib/developmentThread";
import { useNavigate } from "react-router-dom";
import { getTrainerRecommendedItems, getContextualRecommendations, contentTypeConfig, practiceExercises, getExercisesForGoal } from "@/lib/learningContent";
import type { LearningItem, PracticeExercise, TrainerRecommendation } from "@/lib/learningContent";
import heroRider from "@/assets/hero-rider.jpg";

const HomePage = () => {
  const navigate = useNavigate();
  const trainerFeedback = getLatestTrainerFeedback(activeThread);
  const rideCount = activeThread.entries.filter((e) => e.type === "ride").length;
  const latestTrend = activeThread.skillTrajectories.find((s) => s.trend === "improving");
  const journeyChains = getJourneyChains(activeThread);
  const latestChain = journeyChains.length > 0 ? journeyChains[journeyChains.length - 1] : null;

  return (
    <div className="pb-6">
      {/* Hero — Full-width editorial image with overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative h-[320px] overflow-hidden"
      >
        <img
          src={heroRider}
          alt="Rider in motion"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1"
          >
            Your Focus
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-display font-semibold text-foreground leading-tight text-balance"
          >
            {activeThread.goal}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm text-muted-foreground mt-2"
          >
            {rideCount} rides · {latestTrend ? `${latestTrend.name} improving` : "Building foundation"} · Since {activeThread.startDate}
          </motion.p>
        </div>
      </motion.div>

      <div className="px-6 space-y-8 mt-6">
        {/* Primary Action — What's Next */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <button
            onClick={() => navigate("/ride")}
            className="w-full text-left group"
          >
            <div className="glass-card p-5 transition-all duration-200 active:scale-[0.98]">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                  {activeThread.nextAction.type === "ride" ? (
                    <Play size={20} className="text-primary-foreground ml-0.5" />
                  ) : (
                    <BookOpen size={20} className="text-primary-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">
                    Next Step
                  </p>
                  <p className="text-lg font-display font-semibold text-foreground leading-snug">
                    {activeThread.nextAction.title}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                    {activeThread.nextAction.rationale}
                  </p>
                </div>
                <ArrowUpRight size={18} className="text-muted-foreground/40 shrink-0 mt-1 group-hover:text-foreground transition-colors" />
              </div>
            </div>
          </button>
        </motion.section>

        {/* Journey Chain — Editorial insight */}
        {latestChain && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-3">
              Recent Progress
            </p>
            <div className="glass-card p-5">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Learned</p>
                    <p className="text-sm font-medium text-foreground">{latestChain.learned.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <ArrowRight size={12} className="text-muted-foreground/40" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Practiced</p>
                    <p className="text-sm font-medium text-foreground">{latestChain.practiced.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-2">
                  <ArrowRight size={12} className="text-muted-foreground/40" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-accent" />
                  <div>
                    <p className="text-xs text-muted-foreground">Improved</p>
                    <p className="text-sm font-medium text-foreground">
                      {latestChain.improved.skill}
                      {latestChain.improved.from > 0 && (
                        <span className="text-accent ml-2 font-semibold">
                          {latestChain.improved.from} → {latestChain.improved.to}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {/* Skills at a glance */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Skills
            </p>
            <button
              onClick={() => navigate("/progress")}
              className="text-xs text-accent font-medium flex items-center gap-0.5"
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeThread.skillTrajectories.slice(0, 4).map((skill, i) => {
              const latest = skill.dataPoints[skill.dataPoints.length - 1];
              const trendColor = skill.trend === "improving" ? "text-primary" : skill.trend === "plateau" ? "text-accent" : "text-muted-foreground";
              return (
                <motion.div
                  key={skill.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  className="glass-card p-4"
                >
                  <p className="text-xs text-muted-foreground mb-1">{skill.name}</p>
                  <p className="text-2xl font-display font-semibold text-foreground">
                    {latest?.score || "—"}
                    <span className="text-sm text-muted-foreground font-body font-normal">/5</span>
                  </p>
                  <p className={`text-[10px] font-medium mt-1 capitalize ${trendColor}`}>
                    {skill.trend}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* Trainer Feedback — elegant quote */}
        {trainerFeedback && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-3">
              Trainer Feedback
            </p>
            <div className="glass-card p-5 border-l-2 border-l-accent">
              <p className="text-sm font-display italic text-foreground leading-relaxed">
                "{trainerFeedback.trainerNote}"
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                {trainerFeedback.trainerName} · {trainerFeedback.date}
              </p>
            </div>
          </motion.section>
        )}

        {/* Genie nudge — subtle */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate("/genie")}
          className="w-full glass-card p-4 flex items-center gap-4 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-2xl bg-sage-light flex items-center justify-center">
            <Sparkles size={16} className="text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-foreground">Ask about your progress</p>
            <p className="text-xs text-muted-foreground">3 rides without trainer review</p>
          </div>
          <ChevronRight size={14} className="text-muted-foreground/40" />
        </motion.button>

        {/* Timeline — minimal horizontal */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Journey
            </p>
            <button
              onClick={() => navigate("/progress")}
              className="text-xs text-accent font-medium flex items-center gap-0.5"
            >
              Full view <ChevronRight size={12} />
            </button>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
            {activeThread.entries.slice(-5).map((entry) => {
              const config = entryTypeConfig[entry.type];
              return (
                <div key={entry.id} className="glass-card p-3.5 min-w-[140px] max-w-[160px] shrink-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                    {config.label}
                  </p>
                  <p className="text-xs font-medium text-foreground truncate">{entry.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{entry.date}</p>
                </div>
              );
            })}
          </div>
        </motion.section>
      </div>
    </div>
  );
};

export default HomePage;