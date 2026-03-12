// Horsera — useVideoAnalysis hook
// Loads MoveNet Thunder dynamically, extracts pose frames from an uploaded video,
// computes biomechanics metrics, and finds the best-moment clip for display.

import { useState, useCallback, useRef } from 'react';
import {
  computeBiometricsFromFrames,
  generateInsights,
  findBestMomentTimestamp,
} from '../lib/poseAnalysis';
import type { PoseFrame, MovementInsight } from '../lib/poseAnalysis';
import type { BiometricsSnapshot } from '../data/mock';

export interface TimestampedFrame {
  time:  number;    // seconds into the video
  frame: PoseFrame; // normalized keypoints (x, y 0–1)
}

export interface VideoAnalysisResult {
  biometrics:        BiometricsSnapshot;
  insights:          MovementInsight[];
  frameCount:        number;

  // Video playback — show the actual clip with skeleton overlay
  videoPlaybackUrl:  string;          // blob URL — callers must revoke on unmount
  bestMomentStart:   number;          // start of 6s clip to show (seconds)
  allFrames:         TimestampedFrame[]; // all sampled keypoints for skeleton overlay

  // Static thumbnail fallback (if video playback is blocked)
  thumbnailDataUrl:  string;
  bestFrame:         PoseFrame | null;
}

export type AnalysisStatus =
  | 'idle'
  | 'loading-model'
  | 'extracting'
  | 'processing'
  | 'done'
  | 'error';

const SAMPLE_INTERVAL_SEC = 5;
const MAX_FRAMES          = 600;

export function useVideoAnalysis(previousBiometrics?: BiometricsSnapshot) {
  const [status,   setStatus]   = useState<AnalysisStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result,   setResult]   = useState<VideoAnalysisResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  const detectorRef = useRef<{
    estimatePoses: (input: HTMLCanvasElement) => Promise<{
      keypoints: Array<{ x: number; y: number; score?: number }>;
    }[]>;
  } | null>(null);

  // Track previous blob URL so we can revoke it when analysis restarts
  const prevPlaybackUrlRef = useRef<string>('');

  const analyzeVideo = useCallback(async (file: File) => {
    // Revoke previous blob URL to free memory
    if (prevPlaybackUrlRef.current) {
      URL.revokeObjectURL(prevPlaybackUrlRef.current);
      prevPlaybackUrlRef.current = '';
    }

    setStatus('loading-model');
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      // ── Load TF.js + MoveNet (dynamic import — only on first call) ──
      const [poseDetection, tfCore] = await Promise.all([
        import('@tensorflow-models/pose-detection'),
        import('@tensorflow/tfjs'),
      ]);

      await (tfCore as { ready: () => Promise<void> }).ready();

      if (!detectorRef.current) {
        const model = (poseDetection as {
          SupportedModels: { MoveNet: string };
          movenet: { modelType: { SINGLEPOSE_THUNDER: string } };
          createDetector: (model: string, config: object) => Promise<typeof detectorRef.current>;
        });
        detectorRef.current = await model.createDetector(
          model.SupportedModels.MoveNet,
          { modelType: model.movenet.modelType.SINGLEPOSE_THUNDER }
        );
      }

      // ── Load video ──────────────────────────────────────────────────
      setStatus('extracting');

      // Create ONE blob URL — kept alive for playback after analysis
      const videoPlaybackUrl = URL.createObjectURL(file);
      prevPlaybackUrlRef.current = videoPlaybackUrl;

      const video = document.createElement('video');
      video.src       = videoPlaybackUrl;
      video.muted     = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Could not read video file. Supported formats: MP4, MOV.'));
        setTimeout(() => reject(new Error('Video load timed out. Try a shorter clip.')), 30_000);
      });

      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        throw new Error('Video duration could not be determined. Try re-saving the file.');
      }

      const totalSamples  = Math.min(Math.floor(duration / SAMPLE_INTERVAL_SEC), MAX_FRAMES);
      const actualInterval = duration / totalSamples;

      // ── Canvas for MoveNet inference ────────────────────────────────
      // Match the video's native aspect ratio so keypoints normalize correctly.
      // Processing at a square 256×256 would squash the image and misplace all keypoints
      // when the overlay is drawn over the native-AR video playback.
      const canvas = document.createElement('canvas');
      canvas.width  = 256;
      canvas.height = Math.max(1, Math.round(256 * video.videoHeight / video.videoWidth));
      const ctx = canvas.getContext('2d')!;

      // ── Frame loop ──────────────────────────────────────────────────
      const allFrames:    TimestampedFrame[] = [];
      const frameKps:     PoseFrame[]        = [];  // for metric computation
      let thumbnailDataUrl = '';

      for (let i = 0; i < totalSamples; i++) {
        const seekTime = i * actualInterval;
        video.currentTime = seekTime;

        await new Promise<void>(resolve => {
          const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
          video.addEventListener('seeked', onSeeked);
          setTimeout(resolve, 800); // safety fallback
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        setStatus('processing');

        const poses = await detectorRef.current!.estimatePoses(canvas);
        if (poses.length > 0) {
          const kps: PoseFrame = poses[0].keypoints.map(kp => ({
            x:     kp.x / canvas.width,
            y:     kp.y / canvas.height,
            score: kp.score ?? 0,
          }));
          allFrames.push({ time: seekTime, frame: kps });
          frameKps.push(kps);

          // Thumbnail at ~20% through ride (fallback if video playback blocked)
          if (i === Math.floor(totalSamples * 0.2)) {
            thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.80);
          }
        }

        setProgress(Math.round(((i + 1) / totalSamples) * 100));
      }

      // ── Find best moment ────────────────────────────────────────────
      const timestamps   = allFrames.map(f => f.time);
      const rawBestTime  = findBestMomentTimestamp(frameKps, timestamps, 15);
      // Start clip 2s before the best moment (gives context) — clamp to 0
      const bestMomentStart = Math.max(0, rawBestTime - 2);

      // Best static frame = the keypoints closest to rawBestTime
      const bestFrameEntry  = allFrames.reduce((closest, f) =>
        Math.abs(f.time - rawBestTime) < Math.abs(closest.time - rawBestTime) ? f : closest,
        allFrames[0]
      );

      // ── Compute metrics ─────────────────────────────────────────────
      const biometrics = computeBiometricsFromFrames(frameKps);
      const insights   = generateInsights(biometrics, previousBiometrics);

      setResult({
        biometrics,
        insights,
        frameCount:       allFrames.length,
        videoPlaybackUrl,
        bestMomentStart,
        allFrames,
        thumbnailDataUrl,
        bestFrame:        bestFrameEntry?.frame ?? null,
      });
      setStatus('done');
      setProgress(100);

    } catch (err) {
      console.error('[Horsera] Video analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed — please try again.');
      setStatus('error');
    }
  }, [previousBiometrics]);

  const reset = useCallback(() => {
    if (prevPlaybackUrlRef.current) {
      URL.revokeObjectURL(prevPlaybackUrlRef.current);
      prevPlaybackUrlRef.current = '';
    }
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
  }, []);

  return { status, progress, result, error, analyzeVideo, reset };
}
