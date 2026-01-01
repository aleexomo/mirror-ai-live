
import { FavoriteItem, MirrorMode } from "../types";

// Backend URL (Render/Replit). Set in Netlify as VITE_BACKEND_URL
const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || '';

/**
 * Tracks a new visitor/session for the Admin Dashboard.
 */
export const trackUserSession = async (mode?: string) => {
  if (!BACKEND_URL) return;
  try {
    await fetch(`${BACKEND_URL}/api/users/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        initialMode: mode || 'IDLE'
      }),
    });
  } catch (e) {
    console.warn("Backend tracking failed. Running in offline mode.");
  }
};

/**
 * Syncs a saved look to the Admin Dashboard "Saved Looks" section.
 */
export const syncSavedLook = async (fav: FavoriteItem) => {
  if (!BACKEND_URL) return;
  try {
    await fetch(`${BACKEND_URL}/api/looks/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: fav.id,
        timestamp: fav.timestamp,
        mode: fav.mode,
        mood: fav.preference,
        image: fav.outcomeImage || fav.targetImage,
      }),
    });
  } catch (e) {
    console.error("Failed to sync look to admin dashboard", e);
  }
};

/**
 * Tracks when a user clicks an affiliate shopping link.
 */
export const trackAffiliateClick = async (productName: string, brand: string, price: string) => {
  if (!BACKEND_URL) return;
  try {
    await fetch(`${BACKEND_URL}/api/events/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'AFFILIATE_CLICK',
        productName,
        brand,
        price,
        timestamp: Date.now()
      }),
    });
  } catch (e) {
    console.error("Click tracking failed", e);
  }
};
