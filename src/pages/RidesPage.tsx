import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockRides, mockGoal } from '../data/mock';
import type { Ride, BiometricsSnapshot } from '../data/mock';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { computeRidingQualities, generateInsights } from '../lib/poseAnalysis';
import type { MovementInsight } from '../lib/poseAnalysis';
import { saveRide, getRides } from '../lib/storage';
import type { StoredRide } from '../lib/storage';
import { getUserProfile, isProfileComplete } from '../lib/userProfile';
import VideoSilhouetteOverlay from '../components/VideoSilhouetteOverlay';
import ProfileSetupModal from '../components/ProfileSetupModal';

// See full implementation at src/pages/RidesPage.tsx — Card #56
// This commit contains the full enhanced ride detail view
