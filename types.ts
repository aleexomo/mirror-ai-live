
export type MirrorMode = 'MAKEUP' | 'CLOTHES' | 'HAIR';
export type AppState = 'IDLE' | 'PREFERENCE_SELECTION' | 'CAPTURE_INITIAL' | 'GENERATING_LOOK' | 'GUIDING' | 'CHECKING_PROGRESS' | 'FINAL_REVEAL' | 'GALLERY';

export interface TutorialStep {
  id: number;
  title: string;
  instruction: string;
  tip: string;
  stepImage?: string | null;
  stepFeedback?: string | null;
}

export interface RecommendedItem {
  name: string;
  price: string;
  brand: string;
  url: string;
  matchReason: string;
}

export interface FavoriteItem {
  id: string;
  mode: MirrorMode;
  preference: string;
  targetImage: string;
  outcomeImage: string;
  timestamp: number;
}

export interface SessionData {
  mode: MirrorMode | null;
  originalImage: string | null;
  targetImage: string | null;
  currentProgressImage: string | null;
  steps: TutorialStep[];
  currentStepIndex: number;
  aiFeedback: string;
  preference: string; // Style for makeup, Outfit vibe for clothes, or Hair look
  recommendedItems: RecommendedItem[];
  compliment?: string;
}
