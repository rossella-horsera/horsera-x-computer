import { useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Target, ChevronRight, ChevronLeft, Sparkles, X, Loader2, UserCheck, MessageSquare, Dumbbell, BookOpen, Filter, Bookmark, BookmarkCheck, Plus, CheckCircle2, Link2, ExternalLink, SlidersHorizontal } from "lucide-react";
import { activeThread } from "@/lib/developmentThread";
import type { SkillTrajectory } from "@/lib/developmentThread";
import {
  learningCatalog,
  getRecommendedItems,
  getTrainerRecommendedItems,
  getTrainerRecForItem,
  getRecommendationSource,
  contentTypeConfig,
  skillDomainConfig,
  browseCategories,
  practiceExercises,
  getExercisesForGoal,
  trainerRecommendations,
  type LearningItem,
  type SkillDomain,
  type Discipline,
  type TrainerRecommendation,
  type PracticeExercise,
} from "@/lib/learningContent";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─── Relevance scoring ──────────────────────────────────────────────────────

function scoreRelevance(item: LearningItem): number {
  let score = 0;
  const trainerItemIds = new Set(trainerRecommendations.map((r) => r.itemId));
  if (trainerItemIds.has(item.id)) score += 50;
  if (item.linkedGoals.includes(activeThread.goal)) score += 30;
  const matchedSkills = item.linkedSkills.filter((s) => activeThread.skills.includes(s));
  score += matchedSkills.length * 10;
  for (const skill of matchedSkills) {
    const traj = activeThread.skillTrajectories.find((t) => t.name === skill);
    if (traj?.trend === "plateau") score += 15;
    if (traj?.trend === "declining") score += 20;
  }
  if (item.recommended) score += 5;
  return score;
}

function getRecommendationExplanation(item: LearningItem): string {
  if (item.recommendationReason) return item.recommendationReason;
  const trainerRec = getTrainerRecForItem(item.id);
  if (trainerRec) return trainerRec.note;
  // Build contextual reason
  const matchedSkills = item.linkedSkills.filter((s) => activeThread.skills.includes(s));
  for (const skill of matchedSkills) {
    const traj = activeThread.skillTrajectories.find((t) => t.name === skill);
    if (traj?.trend === "plateau") return `Your ${skill} has plateaued — this directly targets it`;
    if (traj?.trend === "declining") return `Your ${skill} needs attention — this can help rebuild`;
  }
  if (item.linkedGoals.includes(activeThread.goal)) return `Supports your "${activeThread.goal}" goal`;
  return "Relevant to your current training";
}

// ─── Main Component ─────────────────────────────────────────────────────────

const LearnPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LearningItem[] | null>(null);
  const [searchInsight, setSearchInsight] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LearningItem | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<PracticeExercise | null>(null);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [threadItems, setThreadItems] = useState<Set<string>>(new Set(["l1", "l3"])); // Mock: some already linked
  const [appliedItems, setAppliedItems] = useState<Set<string>>(new Set(["l4"])); // Mock: seat & balance already applied
  const [showBrowseFilters, setShowBrowseFilters] = useState(false);
  const [browseFilter, setBrowseFilter] = useState<{ domain?: SkillDomain; discipline?: Discipline; difficulty?: string; type?: string; trainerOnly?: boolean }>({});

  const trainerRecs = getTrainerRecommendedItems();
  const goalExercises = getExercisesForGoal(activeThread.goal);

  // Recommended for you — top 5 by relevance, with explanations
  const recommendedItems = useMemo(() => {
    return [...learningCatalog]
      .filter((i) => i.linkedGoals.includes(activeThread.goal))
      .sort((a, b) => scoreRelevance(b) - scoreRelevance(a))
      .slice(0, 5);
  }, []);

  // Items linked to thread (working on)
  const workingOnItems = useMemo(() => {
    return learningCatalog.filter((i) => threadItems.has(i.id));
  }, [threadItems]);

  // Browse library — filtered
  const browseItems = useMemo(() => {
    let items = [...learningCatalog];
    if (browseFilter.domain) items = items.filter((i) => i.skillDomains.includes(browseFilter.domain!));
    if (browseFilter.discipline) items = items.filter((i) => i.discipline === browseFilter.discipline);
    if (browseFilter.difficulty) items = items.filter((i) => i.difficulty === browseFilter.difficulty);
    if (browseFilter.type) items = items.filter((i) => i.type === browseFilter.type);
    if (browseFilter.trainerOnly) items = items.filter((i) => i.trainerRecommended);
    return items;
  }, [browseFilter]);

  const hasActiveBrowseFilters = Object.values(browseFilter).some(Boolean);

  const toggleSaved = (id: string) => {
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast({ title: "Removed from saved" }); }
      else { next.add(id); toast({ title: "Saved for later", description: "This doesn't count as progress — it's a bookmark." }); }
      return next;
    });
  };

  const addToThread = (id: string) => {
    setThreadItems((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast({ title: "Added to your focus", description: "Linked to your Development Thread. Apply it in a ride to make it count." });
  };

  const markApplied = (id: string) => {
    setAppliedItems((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    toast({ title: "Marked as applied", description: "Nice! Remember: progress is measured from ride performance." });
  };

  const doSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults(null); setSearchInsight(""); return; }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("learn-search", {
        body: { query, catalog: learningCatalog },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Search issue", description: data.error, variant: "destructive" });
        setSearchResults([]); return;
      }
      const ids: string[] = data?.ids || [];
      const results = ids.map((id: string) => learningCatalog.find((item) => item.id === id)).filter(Boolean) as LearningItem[];
      setSearchResults(results);
      setSearchInsight(data?.insight || "");
    } catch (e) {
      console.error(e);
      const lower = query.toLowerCase();
      const results = learningCatalog.filter((item) =>
        item.title.toLowerCase().includes(lower) || item.description.toLowerCase().includes(lower) ||
        item.linkedSkills.some((s) => s.toLowerCase().includes(lower))
      );
      setSearchResults(results);
      setSearchInsight("");
    } finally { setIsSearching(false); }
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); doSearch(searchQuery); };
  const clearSearch = () => { setSearchQuery(""); setSearchResults(null); setSearchInsight(""); };

  const savedItemsList = useMemo(() => learningCatalog.filter((i) => savedItems.has(i.id)), [savedItems]);

  return (
    <div className="px-6 pt-14 pb-6 space-y-7">
      <AnimatePresence mode="wait">
        {selectedItem ? (
          <ItemDetail
            key="detail"
            item={selectedItem}
            onBack={() => setSelectedItem(null)}
            isSaved={savedItems.has(selectedItem.id)}
            isInThread={threadItems.has(selectedItem.id)}
            isApplied={appliedItems.has(selectedItem.id)}
            onToggleSave={() => toggleSaved(selectedItem.id)}
            onAddToThread={() => addToThread(selectedItem.id)}
            onMarkApplied={() => markApplied(selectedItem.id)}
          />
        ) : selectedExercise ? (
          <ExerciseDetail key="ex-detail" exercise={selectedExercise} onBack={() => setSelectedExercise(null)} />
        ) : (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground mb-1">Knowledge</p>
              <h1 className="text-3xl font-display font-semibold text-foreground">Learn & Practice</h1>
              <p className="text-sm text-muted-foreground mt-2">Explore freely. Connect to your goals for it to compound.</p>
            </motion.div>

            {/* Active goal context */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-3 flex items-center gap-3">
              <Target size={16} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Active goal</p>
                <p className="text-sm font-medium text-foreground">{activeThread.goal}</p>
              </div>
              <div className="text-[9px] text-muted-foreground text-right">
                <p>{activeThread.entries.filter((e) => e.type === "ride").length} rides</p>
                <p>Since {activeThread.startDate}</p>
              </div>
            </motion.div>

            {/* AI Search */}
            <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="glass-card flex items-center gap-2 px-3.5 py-2.5">
                {isSearching ? <Loader2 size={16} className="text-muted-foreground animate-spin shrink-0" /> : <Search size={16} className="text-muted-foreground shrink-0" />}
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ask: 'I keep losing balance in canter'..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
                {(searchQuery || searchResults) && <button type="button" onClick={clearSearch}><X size={14} className="text-muted-foreground" /></button>}
                <button type="submit" disabled={!searchQuery.trim() || isSearching} className="text-xs font-semibold text-primary disabled:opacity-30">Search</button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 ml-1 flex items-center gap-1">
                <Sparkles size={8} /> AI-assisted — describe what you need in natural language
              </p>
            </motion.form>

            {/* Search results */}
            {searchResults && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {searchInsight && (
                  <div className="glass-card p-3 border-l-2 border-l-[hsl(var(--genie-glow))]">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles size={10} className="text-[hsl(var(--genie-glow))]" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI insight</span>
                    </div>
                    <p className="text-xs text-foreground">{searchInsight}</p>
                  </div>
                )}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{searchResults.length} results</p>
                <div className="space-y-2.5">
                  {searchResults.map((item) => (
                    <ContentCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} isSaved={savedItems.has(item.id)} isInThread={threadItems.has(item.id)} onToggleSave={() => toggleSaved(item.id)} onAddToThread={() => addToThread(item.id)} />
                  ))}
                  {searchResults.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No matching content found.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Main catalog sections — only shown when not searching */}
            {!searchResults && (
              <>
                {/* ═══ 1. RECOMMENDED FOR YOU ═══ */}
                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-[hsl(var(--genie-glow))]" />
                    <p className="text-sm font-display font-semibold text-foreground">Recommended for You</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">Based on your goal, recent rides, and trainer feedback</p>
                  <div className="space-y-2.5">
                    {recommendedItems.map((item, i) => (
                      <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                        <RecommendedCard
                          item={item}
                          reason={getRecommendationExplanation(item)}
                          onSelect={() => setSelectedItem(item)}
                          isSaved={savedItems.has(item.id)}
                          isInThread={threadItems.has(item.id)}
                          onToggleSave={() => toggleSaved(item.id)}
                          onAddToThread={() => addToThread(item.id)}
                        />
                      </motion.div>
                    ))}
                  </div>
                </motion.section>

                {/* ═══ 2. EXERCISES YOU'RE WORKING ON ═══ */}
                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <div className="flex items-center gap-2 mb-1">
                    <Dumbbell size={14} className="text-primary" />
                    <p className="text-sm font-display font-semibold text-foreground">Exercises You're Working On</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">Linked to your Development Thread — your current focus</p>
                  {goalExercises.length > 0 ? (
                    <Carousel>
                      {goalExercises.map((ex) => (
                        <ExerciseChip key={ex.id} exercise={ex} onSelect={() => setSelectedExercise(ex)} />
                      ))}
                    </Carousel>
                  ) : (
                    <div className="glass-card p-4 text-center">
                      <p className="text-xs text-muted-foreground">No exercises linked yet. Browse and add some!</p>
                    </div>
                  )}
                </motion.section>

                {/* ═══ 3. WORKING ON (Learning linked to thread) ═══ */}
                {workingOnItems.length > 0 && (
                  <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Link2 size={14} className="text-primary" />
                      <p className="text-sm font-display font-semibold text-foreground">In Your Focus</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Learning linked to your Development Thread</p>
                    <div className="space-y-2">
                      {workingOnItems.map((item) => (
                        <ThreadLinkedCard
                          key={item.id}
                          item={item}
                          isApplied={appliedItems.has(item.id)}
                          onSelect={() => setSelectedItem(item)}
                          onMarkApplied={() => markApplied(item.id)}
                        />
                      ))}
                    </div>
                  </motion.section>
                )}

                {/* ═══ 4. BROWSE THE LIBRARY ═══ */}
                <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <BookOpen size={14} className="text-muted-foreground" />
                      <p className="text-sm font-display font-semibold text-foreground">Browse the Library</p>
                    </div>
                    <button onClick={() => setShowBrowseFilters(!showBrowseFilters)} className={`text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${showBrowseFilters ? "bg-primary text-primary-foreground" : "glass-card text-muted-foreground"}`}>
                      <SlidersHorizontal size={10} /> Filters {hasActiveBrowseFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">Explore freely — save or add to your focus anytime</p>

                  {/* Browse filters */}
                  <AnimatePresence>
                    {showBrowseFilters && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
                        <div className="glass-card p-3.5 space-y-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Skill</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {(Object.keys(skillDomainConfig) as SkillDomain[]).map((d) => (
                                <button key={d} onClick={() => setBrowseFilter((p) => ({ ...p, domain: p.domain === d ? undefined : d }))} className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${browseFilter.domain === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  {skillDomainConfig[d].label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Discipline</p>
                            <div className="flex gap-1.5 flex-wrap">
                              {(["general", "dressage", "jumping", "eventing", "western"] as Discipline[]).map((d) => (
                                <button key={d} onClick={() => setBrowseFilter((p) => ({ ...p, discipline: p.discipline === d ? undefined : d }))} className={`text-[10px] font-medium px-2.5 py-1 rounded-full capitalize transition-colors ${browseFilter.discipline === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  {d}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Level</p>
                            <div className="flex gap-1.5">
                              {["beginner", "intermediate", "advanced"].map((l) => (
                                <button key={l} onClick={() => setBrowseFilter((p) => ({ ...p, difficulty: p.difficulty === l ? undefined : l }))} className={`text-[10px] font-medium px-2.5 py-1 rounded-full capitalize transition-colors ${browseFilter.difficulty === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                  {l}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setBrowseFilter((p) => ({ ...p, trainerOnly: !p.trainerOnly }))} className={`text-[10px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors ${browseFilter.trainerOnly ? "bg-warmth text-white" : "bg-muted text-muted-foreground"}`}>
                              <UserCheck size={9} /> Trainer-recommended
                            </button>
                            {hasActiveBrowseFilters && (
                              <button onClick={() => setBrowseFilter({})} className="text-[10px] text-primary font-medium">Reset</button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Category carousels or filtered list */}
                  {hasActiveBrowseFilters ? (
                    <div className="space-y-2.5">
                      <p className="text-xs text-muted-foreground">{browseItems.length} items</p>
                      {browseItems.map((item) => (
                        <ContentCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} isSaved={savedItems.has(item.id)} isInThread={threadItems.has(item.id)} onToggleSave={() => toggleSaved(item.id)} onAddToThread={() => addToThread(item.id)} />
                      ))}
                      {browseItems.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No items match these filters.</p>}
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {browseCategories.map((cat) => {
                        const items = learningCatalog.filter(cat.filter);
                        if (items.length === 0) return null;
                        return (
                          <div key={cat.id}>
                            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                              {cat.icon} {cat.label}
                              <span className="text-muted-foreground font-normal">({items.length})</span>
                            </p>
                            <Carousel>
                              {items.map((item) => (
                                <BrowseChip key={item.id} item={item} onSelect={() => setSelectedItem(item)} isSaved={savedItems.has(item.id)} onToggleSave={() => toggleSaved(item.id)} />
                              ))}
                            </Carousel>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.section>

                {/* ═══ 5. SAVED FOR LATER ═══ */}
                {savedItemsList.length > 0 && (
                  <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Bookmark size={14} className="text-muted-foreground" />
                      <p className="text-sm font-display font-semibold text-foreground">Saved for Later</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mb-3">Bookmarked — not progress, not linked to your thread</p>
                    <div className="space-y-2">
                      {savedItemsList.map((item) => (
                        <ContentCard key={item.id} item={item} onSelect={() => setSelectedItem(item)} isSaved isInThread={threadItems.has(item.id)} onToggleSave={() => toggleSaved(item.id)} onAddToThread={() => addToThread(item.id)} />
                      ))}
                    </div>
                  </motion.section>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Horizontal Carousel ────────────────────────────────────────────────────

const Carousel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
    {children}
  </div>
);

// ─── Recommended Card (with explanation) ────────────────────────────────────

const RecommendedCard = ({
  item, reason, onSelect, isSaved, isInThread, onToggleSave, onAddToThread,
}: {
  item: LearningItem; reason: string; onSelect: () => void;
  isSaved: boolean; isInThread: boolean; onToggleSave: () => void; onAddToThread: () => void;
}) => {
  const typeConfig = contentTypeConfig[item.type];
  const trainerRec = getTrainerRecForItem(item.id);
  const isTrainer = !!trainerRec;

  return (
    <button onClick={onSelect} className={`w-full text-left glass-card p-4 active:scale-[0.98] transition-transform ${isTrainer ? "border-l-[3px] border-l-warmth" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            {isTrainer ? (
              <span className="text-[9px] font-bold uppercase tracking-wider text-warmth flex items-center gap-0.5">
                <UserCheck size={9} /> {trainerRec!.trainerName}
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
          <p className="font-medium text-sm text-foreground">{item.title}</p>
          <p className="text-[11px] text-primary mt-1 italic leading-snug">↳ Why now: {reason}</p>
          {/* Actions */}
          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {!isInThread && (
              <button onClick={onAddToThread} className="text-[10px] font-medium px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <Plus size={9} /> Add to focus
              </button>
            )}
            {isInThread && (
              <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <CheckCircle2 size={9} /> In your focus
              </span>
            )}
            <button onClick={onToggleSave} className="text-[10px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
              {isSaved ? <BookmarkCheck size={9} /> : <Bookmark size={9} />}
              {isSaved ? "Saved" : "Save"}
            </button>
          </div>
        </div>
        <ChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
};

// ─── Thread-Linked Card ─────────────────────────────────────────────────────

const ThreadLinkedCard = ({
  item, isApplied, onSelect, onMarkApplied,
}: {
  item: LearningItem; isApplied: boolean; onSelect: () => void; onMarkApplied: () => void;
}) => {
  const typeConfig = contentTypeConfig[item.type];
  return (
    <button onClick={onSelect} className="w-full text-left glass-card p-3.5 border-l-[3px] border-l-primary active:scale-[0.98] transition-transform">
      <div className="flex items-start gap-3">
        <span className="text-base mt-0.5">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{typeConfig.label}</span>
            <span className="text-[10px] text-muted-foreground">· {item.duration}</span>
            {isApplied ? (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-0.5 ml-auto">
                <CheckCircle2 size={7} /> Applied in ride
              </span>
            ) : (
              <span className="text-[8px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-auto">
                Not yet applied
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {!isApplied && (
            <div className="mt-2" onClick={(e) => e.stopPropagation()}>
              <button onClick={onMarkApplied} className="text-[10px] font-medium px-2 py-1 rounded-full bg-primary text-primary-foreground flex items-center gap-1">
                <CheckCircle2 size={9} /> Mark as applied in a ride
              </button>
            </div>
          )}
        </div>
        <ChevronRight size={12} className="text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
};

// ─── Content Card (browse/search) ───────────────────────────────────────────

const ContentCard = ({
  item, onSelect, isSaved, isInThread, onToggleSave, onAddToThread,
}: {
  item: LearningItem; onSelect: () => void;
  isSaved: boolean; isInThread: boolean; onToggleSave: () => void; onAddToThread: () => void;
}) => {
  const typeConfig = contentTypeConfig[item.type];
  return (
    <button onClick={onSelect} className={`w-full text-left glass-card p-3.5 active:scale-[0.98] transition-transform ${item.trainerRecommended ? "border-l-[3px] border-l-warmth" : ""}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-base mt-0.5">{typeConfig.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{typeConfig.label}</span>
            <span className="text-[10px] text-muted-foreground">· {item.duration}</span>
            {item.trainerRecommended && (
              <span className="text-[9px] font-bold uppercase text-warmth flex items-center gap-0.5">
                <UserCheck size={8} />
              </span>
            )}
            {item.source && <span className="text-[9px] text-muted-foreground">· {item.source}</span>}
          </div>
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.description}</p>
          <div className="flex items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
            {!isInThread && (
              <button onClick={onAddToThread} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                <Plus size={8} /> Focus
              </button>
            )}
            {isInThread && (
              <span className="text-[10px] text-primary flex items-center gap-0.5">
                <CheckCircle2 size={8} /> In focus
              </span>
            )}
            <button onClick={onToggleSave} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              {isSaved ? <BookmarkCheck size={8} /> : <Bookmark size={8} />}
            </button>
          </div>
        </div>
      </div>
    </button>
  );
};

// ─── Browse Chip (carousel card) ────────────────────────────────────────────

const BrowseChip = ({
  item, onSelect, isSaved, onToggleSave,
}: {
  item: LearningItem; onSelect: () => void; isSaved: boolean; onToggleSave: () => void;
}) => {
  const typeConfig = contentTypeConfig[item.type];
  return (
    <button onClick={onSelect} className="glass-card p-3 min-w-[180px] max-w-[200px] shrink-0 text-left active:scale-[0.98] transition-transform">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-xs">{typeConfig.icon}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{typeConfig.label}</span>
        {item.trainerRecommended && <UserCheck size={8} className="text-warmth" />}
      </div>
      <p className="text-xs font-medium text-foreground line-clamp-2">{item.title}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{item.duration} · {item.difficulty}</p>
      <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button onClick={onToggleSave} className="text-[9px] text-muted-foreground flex items-center gap-0.5">
          {isSaved ? <BookmarkCheck size={8} className="text-primary" /> : <Bookmark size={8} />}
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>
    </button>
  );
};

// ─── Exercise Chip (carousel card) ──────────────────────────────────────────

const ExerciseChip = ({ exercise, onSelect }: { exercise: PracticeExercise; onSelect: () => void }) => (
  <button onClick={onSelect} className="glass-card p-3 min-w-[180px] max-w-[200px] shrink-0 text-left active:scale-[0.98] transition-transform">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-xs">{exercise.onSaddle ? "🐴" : "💪"}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {exercise.onSaddle ? "On-Saddle" : "Off-Saddle"}
      </span>
    </div>
    <p className="text-xs font-medium text-foreground line-clamp-2">{exercise.title}</p>
    <p className="text-[10px] text-muted-foreground mt-0.5">{exercise.estimatedDuration} · {exercise.difficulty}</p>
    {exercise.trainerNotes && (
      <p className="text-[9px] text-warmth mt-1 flex items-center gap-0.5">
        <UserCheck size={7} /> Trainer note
      </p>
    )}
  </button>
);

// ─── Item Detail View ───────────────────────────────────────────────────────

const ItemDetail = ({
  item, onBack, isSaved, isInThread, isApplied, onToggleSave, onAddToThread, onMarkApplied,
}: {
  item: LearningItem; onBack: () => void;
  isSaved: boolean; isInThread: boolean; isApplied: boolean;
  onToggleSave: () => void; onAddToThread: () => void; onMarkApplied: () => void;
}) => {
  const typeConfig = contentTypeConfig[item.type];
  const trainerRec = getTrainerRecForItem(item.id);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pb-8">
      <div>
        <button onClick={onBack} className="text-sm text-primary font-medium mb-2">← Back</button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{typeConfig.icon}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{typeConfig.label}</span>
          <span className="text-xs text-muted-foreground">· {item.duration}</span>
        </div>
        <h1 className="text-2xl font-display font-semibold text-foreground">{item.title}</h1>
        <div className="flex items-center gap-2 mt-1.5">
          {item.source && <span className="text-[10px] text-muted-foreground">Source: {item.source}</span>}
          {item.trainerName && <span className="text-[10px] text-warmth font-medium">By {item.trainerName}</span>}
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
            item.difficulty === "beginner" ? "bg-green-100 text-green-700" :
            item.difficulty === "intermediate" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
          }`}>{item.difficulty}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">{item.discipline}</span>
        </div>
      </div>

      {/* Thread actions */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
        <div className="flex flex-wrap gap-2">
          {!isInThread ? (
            <button onClick={onAddToThread} className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1.5">
              <Plus size={12} /> Add to my focus
            </button>
          ) : (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary flex items-center gap-1.5">
              <CheckCircle2 size={12} /> In your focus
            </span>
          )}
          {isInThread && !isApplied && (
            <button onClick={onMarkApplied} className="text-xs font-medium px-3 py-1.5 rounded-full bg-sage-light text-primary flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Mark as applied in a ride
            </button>
          )}
          {isApplied && (
            <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Applied in ride
            </span>
          )}
          <button onClick={onToggleSave} className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1.5">
            {isSaved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            {isSaved ? "Saved" : "Save for later"}
          </button>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium px-3 py-1.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1.5">
              <ExternalLink size={12} /> Open source
            </a>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Completing this does NOT equal progress. Apply it in a ride for it to count.
        </p>
      </div>

      {/* Trainer recommendation */}
      {trainerRec && (
        <div className="rounded-2xl bg-warmth-light p-4 border-l-[3px] border-l-warmth">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck size={14} className="text-warmth" />
            <span className="text-xs font-bold text-warmth uppercase tracking-wider">
              {trainerRec.trainerName}'s Recommendation
            </span>
            {trainerRec.priority === "required" && (
              <span className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-warmth text-white ml-auto">Required</span>
            )}
          </div>
          <p className="text-sm text-foreground italic leading-relaxed">"{trainerRec.note}"</p>
          <p className="text-[10px] text-muted-foreground mt-2">
            {trainerRec.date} · Attached to {trainerRec.attachedTo.type}: {trainerRec.attachedTo.name}
          </p>
        </div>
      )}

      {/* Goal linkage */}
      <div className="glass-card p-3.5">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Connected to</p>
        <div className="flex flex-wrap gap-1.5">
          {item.linkedGoals.map((goal) => (
            <span key={goal} className="text-xs px-2.5 py-1 rounded-full bg-sage-light text-primary font-medium flex items-center gap-1">
              <Target size={10} /> {goal}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {item.linkedSkills.map((skill) => (
            <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{skill}</span>
          ))}
        </div>
      </div>

      <div><p className="text-sm text-foreground leading-relaxed">{item.description}</p></div>

      {item.steps && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Steps</p>
          <div className="space-y-2">
            {item.steps.map((step, i) => (
              <div key={i} className="glass-card px-4 py-3 flex gap-3">
                <span className="text-xs font-bold text-primary w-5 shrink-0">{i + 1}</span>
                <p className="text-sm text-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.keyTakeaways && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Takeaways</p>
          <div className="glass-card p-4 space-y-2">
            {item.keyTakeaways.map((takeaway, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-primary text-xs mt-0.5">✦</span>
                <p className="text-sm text-foreground">{takeaway}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {item.recommendationReason && !trainerRec && (
        <div className="glass-card p-3.5 border-l-2 border-l-primary">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">Why this is recommended</p>
          <p className="text-xs text-foreground">{item.recommendationReason}</p>
        </div>
      )}

      {item.skillDomains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.skillDomains.map((domain) => (
            <span key={domain} className={`text-[10px] text-white font-semibold uppercase px-2.5 py-1 rounded-full ${skillDomainConfig[domain].color}`}>
              {skillDomainConfig[domain].label}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ─── Exercise Detail View ───────────────────────────────────────────────────

const ExerciseDetail = ({ exercise, onBack }: { exercise: PracticeExercise; onBack: () => void }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pb-8">
    <div>
      <button onClick={onBack} className="text-sm text-primary font-medium mb-2">← Back</button>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{exercise.onSaddle ? "🐴" : "💪"}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {exercise.onSaddle ? "On-Saddle Exercise" : "Off-Saddle Exercise"}
        </span>
        <span className="text-xs text-muted-foreground">· {exercise.estimatedDuration}</span>
      </div>
      <h1 className="text-2xl font-display font-semibold text-foreground">{exercise.title}</h1>
    </div>

    <div className="rounded-2xl bg-sage-light p-4 border-l-[3px] border-l-primary">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1.5">What this builds</p>
      <p className="text-sm text-foreground leading-relaxed">{exercise.intent}</p>
    </div>

    {exercise.trainerNotes && (
      <div className="rounded-2xl bg-warmth-light p-4 border-l-[3px] border-l-warmth">
        <div className="flex items-center gap-2 mb-1.5">
          <UserCheck size={14} className="text-warmth" />
          <span className="text-xs font-bold text-warmth uppercase tracking-wider">Trainer Note</span>
        </div>
        <p className="text-sm text-foreground italic leading-relaxed">"{exercise.trainerNotes}"</p>
      </div>
    )}

    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">How to perform</p>
      <div className="space-y-2">
        {exercise.howToPerform.map((step, i) => (
          <div key={i} className="glass-card px-4 py-3 flex gap-3">
            <span className="text-xs font-bold text-primary w-5 shrink-0">{i + 1}</span>
            <p className="text-sm text-foreground">{step}</p>
          </div>
        ))}
      </div>
    </div>

    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Success criteria</p>
      <div className="space-y-2">
        <div className="glass-card p-3.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">Quality</p>
          <p className="text-sm text-foreground">{exercise.successCriteria.quality}</p>
        </div>
        <div className="glass-card p-3.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">Consistency</p>
          <p className="text-sm text-foreground">{exercise.successCriteria.consistency}</p>
        </div>
        <div className="glass-card p-3.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">Repetition</p>
          <p className="text-sm text-foreground">{exercise.successCriteria.repetition}</p>
        </div>
      </div>
    </div>

    <div className="glass-card p-3.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Connected to</p>
      <div className="flex flex-wrap gap-1.5">
        {exercise.linkedGoals.map((goal) => (
          <span key={goal} className="text-xs px-2.5 py-1 rounded-full bg-sage-light text-primary font-medium flex items-center gap-1">
            <Target size={10} /> {goal}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {exercise.linkedSkills.map((skill) => (
          <span key={skill} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{skill}</span>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap gap-2">
      <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full ${
        exercise.difficulty === "beginner" ? "bg-green-100 text-green-700" :
        exercise.difficulty === "intermediate" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
      }`}>{exercise.difficulty}</span>
      {exercise.skillDomains.map((domain) => (
        <span key={domain} className={`text-[10px] text-white font-semibold uppercase px-2.5 py-1 rounded-full ${skillDomainConfig[domain].color}`}>
          {skillDomainConfig[domain].label}
        </span>
      ))}
    </div>
  </motion.div>
);

export default LearnPage;
