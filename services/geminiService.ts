import { MirrorMode } from "../types";

// Backend base URL (Render, Replit, etc.)
// Set in Netlify as VITE_BACKEND_URL
const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || '';

async function postJSON<T>(path: string, body: any): Promise<T> {
  if (!BACKEND_URL) throw new Error('Backend URL not configured (VITE_BACKEND_URL)');
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data as T;
}

export const getAppConfig = async () => {
  if (!BACKEND_URL) return null;
  const res = await fetch(`${BACKEND_URL}/api/config`);
  if (!res.ok) return null;
  return (await res.json()) as any;
};

export const generateInitialGreeting = async (base64Image: string, mode: MirrorMode, lang: string) => {
  const out = await postJSON<{ text: string }>(`/api/generate/greeting`, { image: base64Image, mode, lang });
  return out.text;
};

export const generateMakeupLook = async (base64Image: string, style: string, lang: string) => {
  const out = await postJSON<{ image: string }>(`/api/generate/makeup`, { image: base64Image, style, lang });
  return out.image;
};

export const generateOutfitLook = async (base64Image: string, vibe: string, lang: string) => {
  const out = await postJSON<{ image: string }>(`/api/generate/outfit`, { image: base64Image, vibe, lang });
  return out.image;
};

export const generateHairLook = async (base64Image: string, look: string, lang: string) => {
  const out = await postJSON<{ image: string }>(`/api/generate/hair`, { image: base64Image, look, lang });
  return out.image;
};

export const generateTutorialSteps = async (
  originalImage: string,
  targetImage: string,
  mode: 'MAKEUP' | 'CLOTHES' | 'HAIR',
  lang: string
) => {
  return await postJSON<any>(`/api/generate/tutorial`, { originalImage, targetImage, mode, lang });
};

export const generateShoppingItems = async (targetImage: string, mode: MirrorMode, lang: string) => {
  return await postJSON<any[]>(`/api/generate/shopping`, { targetImage, mode, lang });
};

export const getProgressFeedback = async (
  targetImage: string,
  currentProgressImage: string,
  currentStep: any,
  mode: MirrorMode,
  lang: string
) => {
  const out = await postJSON<{ text: string }>(`/api/generate/feedback`, {
    targetImage,
    currentProgressImage,
    currentStep,
    mode,
    lang,
  });
  return out.text;
};

export const askCoachQuestion = async (
  question: string,
  targetImage: string,
  mode: MirrorMode,
  currentStep: any,
  lang: string
) => {
  const out = await postJSON<{ text: string }>(`/api/generate/coach`, {
    question,
    targetImage,
    mode,
    currentStep,
    lang,
  });
  return out.text;
};

export const generateTTS = async (text: string) => {
  const out = await postJSON<{ audio: string }>(`/api/tts`, { text });
  return out.audio;
};

export const getBackendUrl = () => BACKEND_URL;
