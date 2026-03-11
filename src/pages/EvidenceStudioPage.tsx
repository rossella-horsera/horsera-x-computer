import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

import {
  ArrowLeft, Play, Pause, Target, Sparkles, AlertTriangle, ChevronRight, Plus,
  CheckCircle2, BookmarkPlus, Clock, Eye, Shield, Video, ChevronDown, ChevronUp,
  MessageSquare, Scissors, Link2, Upload, ExternalLink, Info, Send, Loader2, X, Search,
  SkipBack, SkipForward, Camera, Gauge
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { activeThread } from "@/lib/developmentThread";
import {
  generateMockAnalysis, mockVideoAssets, insightCategoryConfig, patternLabels,
  severityConfig, statusConfig, confidenceConfig, severityToStatus,
  detectPlatform, getEmbedUrl, platformLabels,
  saveVideoAsset, getVideoAssetForRide, saveAnalysis, getAnalysisForRide,
  saveMoments, getMomentsForVideo, extractFramesFromVideo, mapAIResponseToAnalysis,
  saveFrame,
  type VideoAsset, type VideoAnalysisResult, type VideoMoment, type NextRideAction,
  type AggregatedInsight, type FocusSegment, type ExternalPlatform, type AIAnalysisResponse,
  type RideSnapshot, type SavedFrame, type SeatAnalysisData
} from "@/lib/videoAnalysis";
import { supabase } from "@/integrations/supabase/client";
import SeatPositionAnalysis from "@/components/SeatPositionAnalysis";

type StudioPhase = "attach" | "analyzing" | "results";
type AttachMode = "upload" | "link";
type GenieMode = "hidden" | "search" | "expanded";
type UploadOrigin = "file-input" | "photo-library";

const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const toPlaybackUrl = (asset: VideoAsset | null): string => {
  if (!asset || asset.sourceType !== "upload") return "";
  if (asset.nativeUri && Capacitor.isNativePlatform()) {
    return Capacitor.convertFileSrc(asset.nativeUri);
  }
  return asset.url || "";
};

const sanitizeFileName = (name: string): string => name.replace(/[^\w.-]/g, "_");

const EvidenceStudioPage = () => {
  const navigate = useNavigate();
  const { rideId } = useParams<{ rideId: string }>();
  const resolvedRideId = rideId || "e6";

  const ride = activeThread.entries.find((e) => e.id === resolvedRideId);

  const isNewRide = rideId === "new";
  const persistedAsset = isNewRide ? null : getVideoAssetForRide(resolvedRideId);
  const existingVideo = isNewRide ? null : (persistedAsset || mockVideoAssets[resolvedRideId]);
  const persistedAnalysis = isNewRide ? null : getAnalysisForRide(resolvedRideId);

  const [phase, setPhase] = useState<StudioPhase>(existingVideo ? "results" : "attach");
  const [videoAsset, setVideoAsset] = useState<VideoAsset | null>(existingVideo || null);
  const [videoUrl, setVideoUrl] = useState<string>(toPlaybackUrl(existingVideo));
  const [analysis, setAnalysis] = useState<VideoAnalysisResult | null>(persistedAnalysis);
  const [moments, setMoments] = useState<VideoMoment[]>(existingVideo ? getMomentsForVideo(existingVideo.id) : []);
  const [focusSegment, setFocusSegment] = useState<FocusSegment | null>(null);
  const [showDurationPrompt, setShowDurationPrompt] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState("");
  const [extractedFrames, setExtractedFrames] = useState<string[]>([]);
  

  // Generate analysis on mount if video exists but no analysis
  useEffect(() => {
    if (existingVideo && phase === "results" && !analysis) {
      const result = generateMockAnalysis(existingVideo.id, resolvedRideId, existingVideo.duration, undefined, existingVideo.sourceType);
      setAnalysis(result);
      saveAnalysis(result);
    }
  }, [existingVideo, phase, analysis, resolvedRideId]);

  useEffect(() => {
    if (videoAsset && moments.length > 0) {
      saveMoments(videoAsset.id, moments);
    }
  }, [moments, videoAsset]);

  useEffect(() => {
    setVideoUrl(toPlaybackUrl(videoAsset));
  }, [videoAsset]);

  const runAIAnalysis = useCallback(async (asset: VideoAsset, url: string, segment?: FocusSegment) => {
    setPhase("analyzing");
    setAnalyzingStep("Extracting frames...");

    try {
      const tempVideo = document.createElement("video");
      tempVideo.crossOrigin = "anonymous";
      tempVideo.preload = "auto";
      tempVideo.muted = true;
      tempVideo.src = url;

      await new Promise<void>((resolve, reject) => {
        tempVideo.onloadeddata = () => resolve();
        tempVideo.onerror = () => reject(new Error("Failed to load video"));
      });

      setAnalyzingStep("Sampling frames...");
      const frames = await extractFramesFromVideo(tempVideo, 12, segment || undefined);
      setExtractedFrames(frames);

      setAnalyzingStep("Analyzing seat & balance...");
      
      const { data, error } = await supabase.functions.invoke("video-analysis", {
        body: {
          frames,
          riderContext: {
            goal: activeThread.goal,
            skills: activeThread.skills,
            recentNotes: activeThread.entries[0]?.reflection || "",
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalyzingStep("Building insights...");
      const aiResponse = data as AIAnalysisResponse;
      const result = mapAIResponseToAnalysis(aiResponse, asset.id, resolvedRideId, frames.length, segment, asset.sourceType);
      setAnalysis(result);
      saveAnalysis(result);
      setPhase("results");
    } catch (err) {
      console.error("AI analysis failed, falling back to mock:", err);
      const result = generateMockAnalysis(asset.id, resolvedRideId, asset.duration || 150, segment, asset.sourceType);
      setAnalysis(result);
      saveAnalysis(result);
      setPhase("results");
    }
  }, [resolvedRideId]);

  const ingestSelectedVideo = useCallback((input: {
    fileName?: string;
    webPlaybackUrl: string;
    stableNativeUri?: string;
    source: UploadOrigin;
  }) => {
    const { fileName, webPlaybackUrl, stableNativeUri, source } = input;
    
    setVideoUrl(webPlaybackUrl);

    const tempVideo = document.createElement("video");
    tempVideo.preload = "metadata";

    const persistAsset = (duration: number, forcePrompt?: boolean) => {
      const asset: VideoAsset = {
        id: `vid-${Date.now()}`,
        rideId: resolvedRideId,
        url: stableNativeUri || webPlaybackUrl,
        nativeUri: stableNativeUri,
        duration,
        createdAt: new Date().toLocaleDateString(),
        fileName,
        sourceType: "upload",
        uploadOrigin: source,
      };
      setVideoAsset(asset);
      saveVideoAsset(asset);
      if (forcePrompt || duration > 3600) setShowDurationPrompt(true);
      runAIAnalysis(asset, webPlaybackUrl);
    };

    tempVideo.onerror = (err) => {
      console.error("[Evidence Studio] Video metadata load error:", err);
      persistAsset(0, true);
    };

    tempVideo.onloadedmetadata = () => {
      const duration = Math.round(tempVideo.duration);
      console.log("[Evidence Studio] Metadata loaded, duration:", duration);
      persistAsset(duration, false);
    };

    tempVideo.src = webPlaybackUrl;
  }, [resolvedRideId, runAIAnalysis]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("[Evidence Studio] File selected:", file.name, "size:", (file.size / 1024 / 1024).toFixed(0) + "MB");
    const webPlaybackUrl = URL.createObjectURL(file);
    ingestSelectedVideo({
      fileName: file.name,
      webPlaybackUrl,
      source: "file-input",
    });
    e.target.value = "";
  };


  const handleExternalLink = (url: string) => {
    const platform = detectPlatform(url);
    const asset: VideoAsset = {
      id: `vid-${Date.now()}`, rideId: resolvedRideId, url, duration: 0,
      createdAt: new Date().toLocaleDateString(), sourceType: "external",
      externalUrl: url, externalPlatform: platform,
    };
    setVideoAsset(asset);
    saveVideoAsset(asset);

    setPhase("analyzing");
    setAnalyzingStep("Generating contextual insights...");
    setTimeout(() => {
      const result = generateMockAnalysis(asset.id, resolvedRideId, 150, undefined, "external");
      setAnalysis(result);
      saveAnalysis(result);
      setPhase("results");
    }, 2000);
  };

  const reanalyzeWithFocus = (seg: FocusSegment) => {
    if (!videoAsset || !videoUrl) return;
    setFocusSegment(seg);
    const updatedAsset = { ...videoAsset, focusStartSeconds: seg.startSeconds, focusEndSeconds: seg.endSeconds };
    setVideoAsset(updatedAsset);
    saveVideoAsset(updatedAsset);
    runAIAnalysis(updatedAsset, videoUrl, seg);
  };

  return (
    <div className="px-5 pt-14 pb-8 space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => navigate("/ride")} className="text-sm text-primary font-medium mb-2 flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Rides
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-sage-light flex items-center justify-center">
            <Video size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">Evidence Studio</h1>
            <p className="text-xs text-muted-foreground">
              {ride ? `${ride.title} · ${ride.date}` : "Ride video analysis"}
            </p>
          </div>
        </div>
      </motion.div>

      {phase === "attach" && (
        <AttachView
          onFileSelected={handleFileUpload}
          onLinkSubmit={handleExternalLink}
          rideTitle={ride?.title}
        />
      )}
      {phase === "analyzing" && (
        <AnalyzingView focusSegment={focusSegment} sourceType={videoAsset?.sourceType || "upload"} step={analyzingStep} />
      )}
      {phase === "results" && analysis && (
        <ResultsView
          analysis={analysis}
          videoAsset={videoAsset}
          videoUrl={videoUrl || ""}
          moments={moments}
          onAddMoment={(m) => setMoments((prev) => [...prev, m])}
          onReanalyzeWithFocus={reanalyzeWithFocus}
          showDurationPrompt={showDurationPrompt}
          onDismissDurationPrompt={() => setShowDurationPrompt(false)}
          extractedFrames={extractedFrames}
        />
      )}
    </div>
  );
};

// ─── Attach View (Upload + Link) ─────────────────────────────────────────────

const AttachView = ({
  onFileSelected,
  onLinkSubmit,
  rideTitle,
}: {
  onFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLinkSubmit: (url: string) => void;
  rideTitle?: string;
}) => {
  const [mode, setMode] = useState<AttachMode>("upload");
  const [linkUrl, setLinkUrl] = useState("");
  const [detectedPlatform, setDetectedPlatform] = useState<ExternalPlatform | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLinkChange = (url: string) => {
    setLinkUrl(url);
    if (url.length > 8) {
      setDetectedPlatform(detectPlatform(url));
    } else {
      setDetectedPlatform(null);
    }
  };

  const handleSubmitLink = () => {
    if (!linkUrl.trim()) return;
    onLinkSubmit(linkUrl.trim());
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* Context */}
      <div className="glass-card p-4 border-l-2 border-l-primary">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Analysis Context</p>
        <p className="text-sm text-foreground">
          Video is analyzed first on its own. Relevant insights may then be highlighted based on your goal: <span className="font-semibold text-primary">{activeThread.goal}</span>
        </p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {activeThread.skills.map((s) => (
            <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
          ))}
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        <button
          onClick={() => setMode("upload")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mode === "upload" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Upload size={14} /> Upload from Device
        </button>
        <button
          onClick={() => setMode("link")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
            mode === "link" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Link2 size={14} /> Attach Link
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "upload" ? (
          <motion.div key="upload-area" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
            <input ref={fileInputRef} type="file" accept="video/*" onChange={onFileSelected} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full text-left">
              <div className="glass-card p-8 flex flex-col items-center gap-4 border-2 border-dashed border-border hover:border-primary/40 transition-colors">
                <div className="w-16 h-16 rounded-full bg-sage-light flex items-center justify-center">
                  <Video size={28} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-semibold text-foreground">Upload ride video</p>
                  <p className="text-sm text-muted-foreground mt-1">From device, Files, or iCloud Drive</p>
                  <p className="text-xs text-muted-foreground mt-0.5">MP4, MOV, WebM · Any size</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
                  Choose File
                </div>
              </div>
            </button>


            <div className="glass-card p-3 flex items-start gap-2.5 mt-4">
              <Sparkles size={14} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-foreground font-medium">AI Vision Analysis</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Frames are extracted and analyzed by AI for seat, balance, hands, legs, core, and rhythm. Like having a trainer watch your video.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="link-area" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
            <div className="glass-card p-5 space-y-4">
              <div>
                <p className="font-display text-base font-semibold text-foreground mb-1">Paste a video link</p>
                <p className="text-xs text-muted-foreground">YouTube (unlisted), Vimeo, Loom, Google Drive, or iCloud share link</p>
              </div>

              <div className="relative">
                <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => handleLinkChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full rounded-xl bg-muted pl-9 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {detectedPlatform && (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                  <span className="text-sm">{platformLabels[detectedPlatform].icon}</span>
                  <span className="text-xs font-medium text-foreground">{platformLabels[detectedPlatform].label} detected</span>
                  {platformLabels[detectedPlatform].supportsEmbed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Embeddable</span>
                  )}
                </motion.div>
              )}

              <button
                onClick={handleSubmitLink}
                disabled={!linkUrl.trim()}
                className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-40 active:scale-[0.97] transition-transform"
              >
                Attach Video Link
              </button>
            </div>

            <div className="glass-card p-3.5 space-y-2">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Supported sources</p>
              <div className="grid grid-cols-2 gap-1.5">
                {(["youtube", "vimeo", "loom", "google-drive", "icloud"] as ExternalPlatform[]).map((p) => (
                  <div key={p} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{platformLabels[p].icon}</span>
                    <span>{platformLabels[p].label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-3 flex items-start gap-2.5">
              <Info size={14} className="text-warmth shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-foreground font-medium">Playback + Moments + Genie</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Linked videos support playback, moment tagging, and Genie coaching. Frame-by-frame AI vision analysis requires an uploaded file.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card p-3 flex items-start gap-2.5">
        <AlertTriangle size={14} className="text-warmth shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-foreground font-medium">Assistive / Beta</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
            All insights are assistive. Not a replacement for trainer judgment.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Analyzing View (Dynamic Microcopy) ──────────────────────────────────────

const ANALYSIS_MICROCOPY = [
  "Analyzing position…",
  "Detecting key moments…",
  "Evaluating seat & balance…",
  "Reviewing hand position…",
  "Assessing leg stability…",
  "Checking rhythm patterns…",
  "Generating insights…",
];

const AnalyzingView = ({ focusSegment, sourceType, step }: { focusSegment: FocusSegment | null; sourceType: string; step: string }) => {
  const [microcopyIndex, setMicrocopyIndex] = useState(0);
  const steps = sourceType === "external"
    ? ["Validating video link", "Loading goal context", "Generating contextual insights"]
    : ["Extracting sampled frames", "Analyzing seat & balance", "Evaluating hands & legs", "Building coaching insights"];

  useEffect(() => {
    const interval = setInterval(() => {
      setMicrocopyIndex((prev) => (prev + 1) % ANALYSIS_MICROCOPY.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-6 text-center py-12">
      <motion.div
        animate={{ scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="w-20 h-20 rounded-full bg-sage-light flex items-center justify-center mx-auto"
      >
        <Sparkles size={32} className="text-primary" />
      </motion.div>
      <div>
        <p className="font-display text-xl font-semibold text-foreground">
          {sourceType === "external" ? "Preparing video analysis" : "AI is analyzing your ride"}
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={microcopyIndex}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="text-sm text-muted-foreground mt-2"
          >
            {step || ANALYSIS_MICROCOPY[microcopyIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="space-y-1.5 max-w-[280px] mx-auto">
        {steps.map((s, i) => (
          <motion.div key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.8 }} className="flex items-center gap-2">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.8 + 0.5 }}>
              <CheckCircle2 size={14} className="text-primary" />
            </motion.div>
            <p className="text-xs text-muted-foreground">{s}</p>
          </motion.div>
        ))}
      </div>
      <div className="glass-card p-2.5 inline-flex items-center gap-1.5 mx-auto">
        <Shield size={10} className="text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">Assistive / Beta · {sourceType === "external" ? "Context-based analysis" : "AI Vision Analysis"}</p>
      </div>
    </motion.div>
  );
};

// ─── Ride Snapshot ────────────────────────────────────────────────────────────

const RideSnapshotSection = ({
  snapshot,
  videoRef,
  duration,
}: {
  snapshot: RideSnapshot;
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
}) => {
  const jumpTo = (fraction: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = fraction * duration;
      videoRef.current.play();
    }
  };

  const metrics = [
    { icon: "🚶", label: "Walk", value: `${snapshot.walkMinutes} min`, jumpFraction: 0.05 },
    { icon: "🏃", label: "Trot", value: `${snapshot.trotMinutes} min`, jumpFraction: 0.3 },
    { icon: "🐎", label: "Canter", value: `${snapshot.canterMinutes} min`, jumpFraction: 0.65 },
    { icon: "🔁", label: "Transitions", value: `${snapshot.transitions}`, jumpFraction: 0.4 },
    { icon: "⚖️", label: "Seat Stability", value: snapshot.seatStability, jumpFraction: 0.5 },
    { icon: "🎯", label: "Primary Focus", value: snapshot.primaryFocus, jumpFraction: 0.2 },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5">Ride Snapshot</p>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((m) => (
          <button
            key={m.label}
            onClick={() => jumpTo(m.jumpFraction)}
            className="flex items-center gap-1.5 p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
          >
            <span className="text-sm">{m.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground leading-tight">{m.label}</p>
              <p className="text-xs font-semibold text-foreground truncate">{m.value}</p>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
};

// ─── Results View (Analysis-First) ──────────────────────────────────────────

const ResultsView = ({
  analysis,
  videoAsset,
  videoUrl,
  moments,
  onAddMoment,
  onReanalyzeWithFocus,
  showDurationPrompt,
  onDismissDurationPrompt,
  extractedFrames,
}: {
  analysis: VideoAnalysisResult;
  videoAsset: VideoAsset | null;
  videoUrl: string;
  moments: VideoMoment[];
  onAddMoment: (m: VideoMoment) => void;
  onReanalyzeWithFocus: (seg: FocusSegment) => void;
  showDurationPrompt: boolean;
  onDismissDurationPrompt: () => void;
  extractedFrames: string[];
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [actionsState, setActionsState] = useState<Record<string, boolean>>({});
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [genieMode, setGenieMode] = useState<GenieMode>("hidden");
  const [showDeeperAnalysis, setShowDeeperAnalysis] = useState(false);
  const [focusStart, setFocusStart] = useState(0);
  const [focusEnd, setFocusEnd] = useState(90);
  const [isDragging, setIsDragging] = useState<"start" | "end" | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [savedFrameToast, setSavedFrameToast] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isExternal = videoAsset?.sourceType === "external";
  const embedUrl = isExternal && videoAsset?.externalPlatform
    ? getEmbedUrl(videoAsset.externalUrl || videoAsset.url, videoAsset.externalPlatform)
    : null;
  const platformInfo = isExternal && videoAsset?.externalPlatform
    ? platformLabels[videoAsset.externalPlatform]
    : null;
  const duration = videoAsset?.duration || 152;

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skipTime = (delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + delta));
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 0.5, 0.25];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    setPlaybackRate(newRate);
    if (videoRef.current) videoRef.current.playbackRate = newRate;
  };

  const captureFrame = () => {
    if (!videoRef.current || !videoAsset) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const frame: SavedFrame = {
      id: `sf-${Date.now()}`,
      videoId: videoAsset.id,
      timestampSeconds: Math.round(videoRef.current.currentTime),
      dataUrl,
      savedAt: new Date().toISOString(),
    };
    saveFrame(frame);
    setSavedFrameToast(true);
    setTimeout(() => setSavedFrameToast(false), 2000);
  };

  const jumpToTimestamp = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const addMomentAtCurrentTime = () => {
    if (!videoAsset) return;
    const moment: VideoMoment = {
      id: `mom-${Date.now()}`,
      videoId: videoAsset.id,
      timestampSeconds: Math.round(currentTime),
      skillTag: activeThread.skills[0],
    };
    onAddMoment(moment);
  };

  const toggleActionAdded = (actionId: string) => {
    setActionsState((prev) => ({ ...prev, [actionId]: !prev[actionId] }));
  };

  // Get a relevant frame for an insight — ensure unique frames
  const usedFrameIndices = new Set<number>();
  const getFrameForInsight = (insight: AggregatedInsight): string | undefined => {
    if (extractedFrames.length === 0 || insight.frameIndices.length === 0) return undefined;
    // Find first unused frame index
    for (const idx of insight.frameIndices) {
      if (!usedFrameIndices.has(idx) && extractedFrames[idx]) {
        usedFrameIndices.add(idx);
        return extractedFrames[idx];
      }
    }
    // Fallback: use any unused frame
    for (let i = 0; i < extractedFrames.length; i++) {
      if (!usedFrameIndices.has(i)) {
        usedFrameIndices.add(i);
        return extractedFrames[i];
      }
    }
    return extractedFrames[insight.frameIndices[0]];
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
      {/* 1. Video Player with Genie Overlay */}
      <div className="rounded-2xl overflow-hidden bg-foreground/5 relative">
        {isExternal && embedUrl ? (
          <iframe
            src={embedUrl}
            className="w-full aspect-video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title="Ride video"
          />
        ) : isExternal && !embedUrl ? (
          <div className="w-full aspect-video bg-muted flex items-center justify-center">
            <div className="text-center p-6 max-w-xs">
              <ExternalLink size={32} className="text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">
                {platformInfo?.label || "External"} Video
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                This video can't be embedded directly. Open it in a new tab to watch.
              </p>
              <a
                href={videoAsset?.externalUrl || videoAsset?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                <ExternalLink size={12} /> Open Video
              </a>
            </div>
          </div>
        ) : videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full aspect-video object-cover"
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onEnded={() => setIsPlaying(false)}
            />
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center bg-foreground/10 opacity-0 hover:opacity-100 transition-opacity"
            >
              {isPlaying ? <Pause size={40} className="text-background" /> : <Play size={40} className="text-background ml-1" />}
            </button>
          </>
        ) : (
          <div className="w-full aspect-video bg-muted flex items-center justify-center">
            <div className="text-center">
              <Video size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Video preview</p>
              <p className="text-[10px] text-muted-foreground">{videoAsset?.fileName || "arena-session.mp4"}</p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {!isExternal && (
          <div className="absolute bottom-0 left-0 right-0 px-3 pb-2">
            <div className="relative h-1.5 bg-background/30 rounded-full">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
              {moments.map((m) => (
                <div
                  key={m.id}
                  className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-warmth border border-background"
                  style={{ left: `${(m.timestampSeconds / duration) * 100}%` }}
                  title={`${m.skillTag} · ${formatTime(m.timestampSeconds)}`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-background/70">{formatTime(Math.round(currentTime))}</span>
              <span className="text-[9px] text-background/70">{formatTime(duration)}</span>
            </div>
          </div>
        )}

        {/* Saved frame toast */}
        <AnimatePresence>
          {savedFrameToast && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-full z-30"
            >
              📸 Frame saved
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Genie Button */}
        <AnimatePresence>
          {genieMode === "hidden" && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              onClick={() => setGenieMode("search")}
              className="absolute bottom-12 right-3 w-11 h-11 rounded-full bg-[hsl(var(--genie-glow))] text-white flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform z-20"
              title="Ask Genie"
            >
              <Sparkles size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Genie Search Bar Overlay (on video) */}
        <AnimatePresence>
          {genieMode === "search" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-12 left-3 right-3 z-20"
            >
              <div className="bg-background/95 backdrop-blur-md rounded-2xl p-3 shadow-xl border border-border/50">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[hsl(var(--genie-glow))] shrink-0" />
                  <GenieSearchInput
                    onSend={(text) => {
                      setGenieMode("expanded");
                      setTimeout(() => {
                        const event = new CustomEvent("genie-initial-message", { detail: text });
                        window.dispatchEvent(event);
                      }, 100);
                    }}
                    placeholder="Ask about your riding..."
                  />
                  <button onClick={() => setGenieMode("hidden")} className="text-muted-foreground hover:text-foreground p-1">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["How are my hands?", "Is my leg stable?", "What should I focus on?"].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setGenieMode("expanded");
                        setTimeout(() => {
                          window.dispatchEvent(new CustomEvent("genie-initial-message", { detail: s }));
                        }, 100);
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-full bg-[hsl(var(--genie-glow-light))] text-[hsl(var(--genie-glow))] font-medium hover:opacity-80 transition-opacity"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Video Controls Bar */}
      {!isExternal && videoUrl && (
        <div className="flex items-center justify-center gap-1">
          <button onClick={() => skipTime(-10)} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors" title="Back 10s">
            <SkipBack size={16} className="text-foreground" />
          </button>
          <button onClick={togglePlay} className="p-2.5 rounded-xl bg-primary text-primary-foreground" title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button onClick={() => skipTime(10)} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors" title="Forward 10s">
            <SkipForward size={16} className="text-foreground" />
          </button>
          <div className="w-px h-6 bg-border mx-1" />
          <button
            onClick={cyclePlaybackRate}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${playbackRate !== 1 ? "bg-warmth/15 text-warmth" : "bg-muted text-muted-foreground"}`}
            title="Slow motion"
          >
            <span className="flex items-center gap-1"><Gauge size={12} /> {playbackRate}x</span>
          </button>
          <button onClick={captureFrame} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors" title="Save frame">
            <Camera size={16} className="text-foreground" />
          </button>
          <button onClick={addMomentAtCurrentTime} className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors" title="Save moment">
            <BookmarkPlus size={16} className="text-foreground" />
          </button>
        </div>
      )}

      {/* Genie Expanded Chat (below video) */}
      <AnimatePresence>
        {genieMode === "expanded" && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <EmbeddedGenieChat
              analysis={analysis}
              extractedFrames={extractedFrames}
              onClose={() => setGenieMode("hidden")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isExternal && platformInfo && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-sm">{platformInfo.icon}</span>
          <span className="text-xs font-medium text-foreground">{platformInfo.label}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Linked video</span>
        </div>
      )}

      {/* Duration hint (subtle banner) */}
      {showDurationPrompt && !isExternal && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-warmth/10 text-xs text-warmth">
          <AlertTriangle size={12} className="shrink-0" />
          <span>Video is over 60 min. Use <strong>Deeper Analysis</strong> below to focus on a segment for better results.</span>
          <button onClick={onDismissDurationPrompt} className="ml-auto shrink-0"><X size={12} /></button>
        </motion.div>
      )}

      {isExternal && (
        <div className="glass-card p-3.5 border-l-2 border-l-warmth flex items-start gap-2.5">
          <Info size={14} className="text-warmth shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">Context-based insights</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              Frame sampling requires direct pixel access. Because this video is hosted externally, insights are generated from your goal context. For AI vision analysis, upload the video directly.
            </p>
          </div>
        </div>
      )}

      {/* Ride Snapshot */}
      {analysis.snapshot && !isExternal && (
        <RideSnapshotSection snapshot={analysis.snapshot} videoRef={videoRef} duration={duration} />
      )}

      {/* Seat Position Analysis */}
      {analysis.seatAnalysis && !isExternal && (
        <SeatPositionAnalysis
          seatAnalysis={analysis.seatAnalysis}
          extractedFrames={extractedFrames}
          onJumpToTimestamp={jumpToTimestamp}
        />
      )}

      {/* Goal Relevance Note */}
      {analysis.goalRelevance && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3.5 border-l-2 border-l-warmth flex items-start gap-2.5">
          <Info size={14} className="text-warmth shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">Goal Relevance</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{analysis.goalRelevance}</p>
          </div>
        </motion.div>
      )}

      {/* Detected Gaits */}
      {analysis.detectedGaits && analysis.detectedGaits.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Gaits detected:</span>
          {analysis.detectedGaits.map((g) => (
            <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">{g}</span>
          ))}
        </div>
      )}

      {/* 2. AI Coach Summary */}
      {analysis.overallSummary && (
        <div className="glass-card p-4 border-l-2 border-l-primary">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">AI Coach Summary</p>
          <p className="text-sm text-foreground leading-relaxed">{analysis.overallSummary}</p>
          {analysis.analysisMode === "focus-segment" && analysis.focusSegment && (
            <p className="text-[10px] text-warmth mt-2 font-medium">
              🎯 Focus segment: {formatTime(analysis.focusSegment.startSeconds)} – {formatTime(analysis.focusSegment.endSeconds)}
            </p>
          )}
        </div>
      )}

      {/* 3. Insights — Visual-First Cards */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Eye size={12} /> Insights — {isExternal ? "context-based" : "AI vision analysis"}
        </p>
        <div className="space-y-2.5">
          {analysis.insights
            .sort((a, b) => {
              const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
              return order[a.severity] - order[b.severity];
            })
            .map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                expanded={expandedInsight === insight.id}
                onToggle={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                frameCount={analysis.sampledFrames.length}
                isExternal={isExternal}
                relevantFrame={getFrameForInsight(insight)}
                onJumpToTimestamp={jumpToTimestamp}
              />
            ))}
        </div>
      </section>

      {/* 4. Deeper Analysis Card */}
      {!isExternal && (
        <section>
          <button
            onClick={() => setShowDeeperAnalysis(!showDeeperAnalysis)}
            className="w-full glass-card p-4 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Scissors size={16} className="text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-foreground">Want deeper analysis?</p>
              <p className="text-xs text-muted-foreground">Select a 30–90s segment for focused frame-by-frame analysis</p>
            </div>
            {showDeeperAnalysis ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {showDeeperAnalysis && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="glass-card mt-2 p-4 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Drag the handles to select a <span className="font-semibold text-foreground">30–90 second</span> segment for deeper analysis.
                  </p>

                  {/* Frame strip thumbnails */}
                  {extractedFrames.length > 0 && (
                    <div className="flex gap-0.5 rounded-lg overflow-hidden">
                      {extractedFrames.map((frame, i) => {
                        const frameTime = (i / extractedFrames.length) * duration;
                        const inRange = frameTime >= focusStart && frameTime <= focusEnd;
                        return (
                          <div
                            key={i}
                            className={`flex-1 aspect-[4/3] overflow-hidden transition-opacity ${inRange ? "opacity-100" : "opacity-30"}`}
                          >
                            <img src={frame} alt={`Frame ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Timeline slider */}
                  <div className="space-y-1">
                    <div
                      ref={timelineRef}
                      className="relative h-10 bg-muted rounded-xl cursor-pointer select-none touch-none"
                      onPointerDown={(e) => {
                        if (!timelineRef.current) return;
                        const rect = timelineRef.current.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const t = Math.round(pct * duration);
                        const distToStart = Math.abs(t - focusStart);
                        const distToEnd = Math.abs(t - focusEnd);
                        if (distToStart <= distToEnd) {
                          setIsDragging("start");
                          const newStart = Math.max(0, Math.min(t, focusEnd - 30));
                          setFocusStart(newStart);
                          if (focusEnd - newStart > 90) setFocusEnd(newStart + 90);
                        } else {
                          setIsDragging("end");
                          const newEnd = Math.min(duration, Math.max(t, focusStart + 30));
                          setFocusEnd(newEnd);
                          if (newEnd - focusStart > 90) setFocusStart(newEnd - 90);
                        }
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onPointerMove={(e) => {
                        if (!isDragging || !timelineRef.current) return;
                        const rect = timelineRef.current.getBoundingClientRect();
                        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        const t = Math.round(pct * duration);
                        if (isDragging === "start") {
                          const newStart = Math.max(0, Math.min(t, focusEnd - 30));
                          setFocusStart(newStart);
                          if (focusEnd - newStart > 90) setFocusEnd(newStart + 90);
                        } else {
                          const newEnd = Math.min(duration, Math.max(t, focusStart + 30));
                          setFocusEnd(newEnd);
                          if (newEnd - focusStart > 90) setFocusStart(newEnd - 90);
                        }
                      }}
                      onPointerUp={() => setIsDragging(null)}
                      onPointerCancel={() => setIsDragging(null)}
                    >
                      <div className="absolute inset-y-0 left-0 bg-muted rounded-l-xl" style={{ width: `${(focusStart / duration) * 100}%` }} />
                      <div
                        className="absolute inset-y-0 bg-primary/15 border-y-2 border-primary/30"
                        style={{
                          left: `${(focusStart / duration) * 100}%`,
                          width: `${((focusEnd - focusStart) / duration) * 100}%`,
                        }}
                      >
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-primary bg-background/80 px-2 py-0.5 rounded-full">
                            {focusEnd - focusStart}s
                          </span>
                        </div>
                      </div>
                      <div className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize z-10" style={{ left: `${(focusStart / duration) * 100}%` }}>
                        <div className={`w-1.5 h-8 rounded-full transition-colors ${isDragging === "start" ? "bg-primary" : "bg-primary/70"}`} />
                      </div>
                      <div className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize z-10" style={{ left: `${(focusEnd / duration) * 100}%` }}>
                        <div className={`w-1.5 h-8 rounded-full transition-colors ${isDragging === "end" ? "bg-primary" : "bg-primary/70"}`} />
                      </div>
                      {moments.map((m) => (
                        <div key={m.id} className="absolute top-1 w-1.5 h-1.5 rounded-full bg-warmth" style={{ left: `${(m.timestampSeconds / duration) * 100}%` }} />
                      ))}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-medium text-primary">{formatTime(focusStart)}</span>
                      <span className="text-[10px] text-muted-foreground">{formatTime(0)} — {formatTime(duration)}</span>
                      <span className="text-[10px] font-medium text-primary">{formatTime(focusEnd)}</span>
                    </div>
                  </div>

                  {(focusEnd - focusStart < 30 || focusEnd - focusStart > 90) && (
                    <p className="text-[10px] text-destructive flex items-center gap-1">
                      <AlertTriangle size={10} /> Segment must be 30–90 seconds
                    </p>
                  )}

                  <button
                    onClick={() => onReanalyzeWithFocus({ startSeconds: focusStart, endSeconds: focusEnd })}
                    disabled={focusEnd - focusStart < 30 || focusEnd - focusStart > 90}
                    className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold active:scale-[0.97] transition-transform disabled:opacity-40"
                  >
                    Re-analyze {formatTime(focusStart)} – {formatTime(focusEnd)}
                  </button>

                  <div className="flex items-center gap-1.5 pt-1">
                    <Info size={10} className="text-muted-foreground shrink-0" />
                    <p className="text-[9px] text-muted-foreground">Non-destructive: your original video is never modified or trimmed.</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* 5. Next Ride Actions */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target size={12} /> What this means for your next ride
        </p>
        <div className="space-y-2.5">
          {analysis.nextRideActions.map((action) => (
            <div key={action.id} className={`glass-card p-3.5 transition-colors ${actionsState[action.id] ? "border-l-[3px] border-l-primary" : ""}`}>
              <div className="flex items-start gap-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{action.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Supports: <span className="text-primary font-medium">{action.linkedSkill}</span>
                  </p>
                </div>
                <button
                  onClick={() => toggleActionAdded(action.id)}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                    actionsState[action.id] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {actionsState[action.id] ? (
                    <span className="flex items-center gap-1"><CheckCircle2 size={10} /> Added</span>
                  ) : (
                    <span className="flex items-center gap-1"><Plus size={10} /> Add to thread</span>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Saved Moments */}
      {moments.length > 0 && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <BookmarkPlus size={12} /> Saved Moments
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {moments.map((m) => (
              <button key={m.id} onClick={() => jumpToTimestamp(m.timestampSeconds)} className="glass-card p-2.5 min-w-[120px] shrink-0 text-left">
                <p className="text-xs font-medium text-foreground">{formatTime(m.timestampSeconds)}</p>
                <p className="text-[10px] text-primary mt-0.5">{m.skillTag}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 7. Disclaimer */}
      <div className="flex items-center gap-2 px-1">
        <Shield size={12} className="text-muted-foreground shrink-0" />
        <p className="text-[10px] text-muted-foreground">{analysis.disclaimer}</p>
      </div>
    </motion.div>
  );
};

// ─── Genie Search Input ──────────────────────────────────────────────────────

const GenieSearchInput = ({ onSend, placeholder }: { onSend: (text: string) => void; placeholder: string }) => {
  const [value, setValue] = useState("");
  return (
    <div className="flex-1 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) { onSend(value.trim()); setValue(""); } }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 border-none outline-none"
        autoFocus
      />
      <button
        onClick={() => { if (value.trim()) { onSend(value.trim()); setValue(""); } }}
        disabled={!value.trim()}
        className="rounded-lg bg-[hsl(var(--genie-glow))] text-white p-1.5 disabled:opacity-40"
      >
        <Send size={12} />
      </button>
    </div>
  );
};

// ─── Embedded Genie Chat ─────────────────────────────────────────────────────

const EmbeddedGenieChat = ({
  analysis,
  extractedFrames,
  onClose,
}: {
  analysis: VideoAnalysisResult;
  extractedFrames: string[];
  onClose: () => void;
}) => {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = [
    "How are my hands?",
    "Is my leg position correct?",
    "What should I focus on next ride?",
    "Am I sitting balanced?",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail;
      if (text) sendMessage(text);
    };
    window.addEventListener("genie-initial-message", handler);
    return () => window.removeEventListener("genie-initial-message", handler);
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: "user" as const, content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const insightsSummary = analysis.insights
      .map((i) => `${insightCategoryConfig[i.category]?.label || i.category}: ${i.insightText} (${i.severity} severity)`)
      .join("\n");

    let assistantContent = "";

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/genie-chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          videoFrames: extractedFrames.slice(0, 5),
          videoInsights: insightsSummary,
        }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Genie chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I couldn't process that right now. Please try again." },
      ]);
    }

    setIsLoading(false);
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[hsl(var(--genie-glow))]" />
          <span className="text-sm font-medium text-foreground">Genie</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
          <X size={14} />
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <Sparkles size={20} className="text-[hsl(var(--genie-glow))] mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Ask me anything about your ride video. I can see the frames and analysis.</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-[hsl(var(--genie-glow-light))] text-[hsl(var(--genie-glow))] font-medium hover:opacity-80 transition-opacity"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl px-3.5 py-2.5">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask about your riding..."
          className="flex-1 rounded-xl bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 border-none outline-none focus:ring-2 focus:ring-[hsl(var(--genie-glow))]/30"
          disabled={isLoading}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || isLoading}
          className="rounded-xl bg-[hsl(var(--genie-glow))] text-white px-3 py-2 disabled:opacity-40 active:scale-95 transition-transform"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};

// ─── Insight Card (Visual-First Refactor) ────────────────────────────────────

const InsightCard = ({
  insight,
  expanded,
  onToggle,
  frameCount,
  isExternal,
  relevantFrame,
  onJumpToTimestamp,
}: {
  insight: AggregatedInsight;
  expanded: boolean;
  onToggle: () => void;
  frameCount: number;
  isExternal: boolean;
  relevantFrame?: string;
  onJumpToTimestamp: (seconds: number) => void;
}) => {
  const catConfig = insightCategoryConfig[insight.category] || { label: insight.category, icon: "📋", color: "text-muted-foreground" };
  const resolvedStatus = insight.status || severityToStatus(insight.severity);
  const stConfig = statusConfig[resolvedStatus] || statusConfig["moderate"];
  const confConfig = confidenceConfig[insight.confidence] || confidenceConfig["low"];

  return (
    <button onClick={onToggle} className="w-full text-left glass-card p-3.5 active:scale-[0.99] transition-transform">
      <div className="flex items-start gap-2.5">
        {/* Frame thumbnail (collapsed view) */}
        {relevantFrame && !expanded && (
          <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden">
            <img src={relevantFrame} alt="Evidence frame" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Header: always visible */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-sm">{catConfig.icon}</span>
            <span className={`text-xs font-semibold ${catConfig.color}`}>
              {catConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${stConfig.bgClass} ${stConfig.textClass}`}>
              {stConfig.label}
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className={`w-1 h-1 rounded-full ${i < confConfig.dots ? "bg-foreground" : "bg-border"}`} />
              ))}
              <span className="ml-0.5">{isExternal ? "Context" : confConfig.label}</span>
            </span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{insight.whatText || insight.insightText.split(".")[0] + "."}</p>

          {/* Expanded body */}
          <AnimatePresence>
            {expanded && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                  {/* Evidence frame */}
                  {relevantFrame && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onJumpToTimestamp(insight.evidenceTimestamp); }}
                      className="relative rounded-xl overflow-hidden group w-full"
                    >
                      <img src={relevantFrame} alt="Evidence" className="w-full max-w-[240px] rounded-xl object-cover" />
                      <div className="absolute inset-0 bg-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                        <Play size={24} className="text-background" />
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-foreground/70 text-background px-1.5 py-0.5 rounded-full font-medium">
                        {formatTime(insight.evidenceTimestamp)}
                      </span>
                    </button>
                  )}

                  {/* What */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">What</p>
                    <p className="text-xs text-foreground leading-relaxed">{insight.whatText || insight.insightText.split(".")[0] + "."}</p>
                  </div>

                  {/* Why it matters */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Why it matters</p>
                    <p className="text-xs text-foreground leading-relaxed">{insight.whyItMatters || "May affect overall balance and connection."}</p>
                  </div>

                  {/* Try this */}
                  <div className="p-2.5 rounded-xl bg-sage-light/50">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">Try this</p>
                    <p className="text-xs font-medium text-foreground">{insight.tryThis || insight.recommendedExercise?.title || "Focus on this area next session."}</p>
                  </div>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1">
                    {insight.relatedSkills.map((s) => (
                      <span key={s} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{s}</span>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 mt-1">
                    <Shield size={9} className="text-muted-foreground" />
                    <p className="text-[9px] text-muted-foreground italic">
                      Assistive · {isExternal ? "Context-based" : "AI Vision"}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {expanded ? <ChevronUp size={12} className="text-muted-foreground shrink-0 mt-1" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0 mt-1" />}
      </div>
    </button>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default EvidenceStudioPage;
