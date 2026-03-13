// Local persistence for rides and analysis results
// Will be replaced with Supabase when credentials are configured

export interface StoredRide {
  id: string;
  date: string;
  horse: string;
  type: 'training' | 'lesson' | 'hack' | 'mock-test';
  duration: number;
  videoFileName: string;
  biometrics: {
    lowerLegStability: number;
    reinSteadiness: number;
    reinSymmetry: number;
    coreStability: number;
    upperBodyAlignment: number;
    pelvisStability: number;
  };
  ridingQuality?: {
    rhythm: number;
    relaxation: number;
    contact: number;
    impulsion: number;
    straightness: number;
    balance: number;
  };
  overallScore: number;
  insights: string[];
}

const STORAGE_KEY = 'horsera_rides';

export function saveRide(ride: StoredRide): void {
  const rides = getRides();
  rides.unshift(ride); // newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rides));
}

export function getRides(): StoredRide[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteRide(id: string): void {
  const rides = getRides().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rides));
}
