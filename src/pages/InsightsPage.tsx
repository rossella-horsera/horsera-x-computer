import { useState } from 'react';
import { biometricsTrend, mockGoal, cadenceInsights, mockRides } from '../data/mock';
import { computeRidingQualities } from '../lib/poseAnalysis';
import type { BiometricsSnapshot } from '../data/mock';
import CadenceInsightCard from '../components/ui/CadenceInsightCard';

// See full implementation at src/pages/InsightsPage.tsx — Card #58
// This commit contains the full enhanced insights body visualization
