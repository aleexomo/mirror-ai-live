import { GoogleGenAI, Modality, Type } from '@google/genai';

export type MirrorMode = 'MAKEUP' | 'CLOTHES' | 'HAIR';

const getLangInst = (lang: string) =>
  `Emma the Stylist instruction: All generated text must be in ${
    lang === 'pt' ? 'Portuguese' : lang === 'es' ? 'Spanish' : lang === 'ja' ? 'Japanese' : 'English'
  }. Brand 'Everyday Mirror' remains in English.`;

const STYLE_PROTOCOL =
  'CRITICAL: Do NOT add, modify, or emphasize any facial hair (beards, stubble, or mustaches). Maintain a clean, sophisticated, and feminine aesthetic. Focus strictly on requested changes.';

const PRESERVATION_PROTOCOL =
  'CRITICAL: Maintain the exact body shape, weight, height, and pose of the person. Do NOT change the background or environment. The person must be 100% recognizable as themselves in their current setting.';

const extractBase64 = (str: string) => {
  if (!str) return '';
  const parts = str.split(',');
  return parts.length > 1 ? parts[1] : str;
};

const getImageUrlFromResponse = (response: any) => {
  const candidate = response.candidates?.[0];
  if (!candidate) return '';
  if (candidate.finishReason === 'SAFETY') {
    throw new Error(
      "I couldn't generate this specific look due to safety guidelines. Please try a different photo or style!"
    );
  }
  if (candidate.content?.parts) {
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return `data:image/jpeg;base64,${part.inlineData.data}`;
      }
    }
  }
  return '';
};

function aiFromEnv() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY on server');
  return new GoogleGenAI({ apiKey });
}

export async function generateInitialGreeting(base64Image: string, mode: MirrorMode, lang: string) {
  const ai = aiFromEnv();
  const imgData = extractBase64(base64Image);
  if (!imgData) throw new Error('Invalid image data');

  const prompt = `You are Emma, a world-class personal stylist for 'Everyday Mirror'.
1. Analyze their features and give a warm, specific, and natural compliment (about 15-20 words). Focus on something genuine like their smile, the light in their eyes, or their natural glow.
2. Follow it with: "Let's make you look even more fabulous today! When you're ready, pick a look below and I'll guide you."
${getLangInst(lang)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [{ text: prompt }, { inlineData: { data: imgData, mimeType: 'image/jpeg' } }],
    },
  });
  return response.text;
}

export async function generateMakeupLook(base64Image: string, style: string, lang: string) {
  const ai = aiFromEnv();
  const basePrompt =
    style === 'Surprise Me'
      ? `Apply a breathtaking, high-end makeup look that complements these features.`
      : `Apply a professional "${style}" makeup look to this face.`;
  const prompt = `${basePrompt} Focus strictly on cosmetic application (lips, eyes, skin, and contour). ${PRESERVATION_PROTOCOL} The person must look exactly like themselves, just with professional makeup. ${STYLE_PROTOCOL} OUTPUT THE EDITED IMAGE DATA. ${getLangInst(lang)}`;
  const imgData = extractBase64(base64Image);
  if (!imgData) throw new Error('Invalid image data');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }, { inlineData: { data: imgData, mimeType: 'image/jpeg' } }] },
    config: { imageConfig: { aspectRatio: '1:1' } },
  });
  return getImageUrlFromResponse(response);
}

export async function generateOutfitLook(base64Image: string, vibe: string, lang: string) {
  const ai = aiFromEnv();
  let specificPrompt = `Show this person wearing a high-fashion "${vibe}" outfit.`;
  if (vibe === 'Carnival Celebration') {
    specificPrompt = `Transform this person's outfit into a spectacular Brazilian Carnival costume.`;
  }
  const prompt = `${specificPrompt} Only the clothing should be transformed. ${PRESERVATION_PROTOCOL} The person must be immediately recognizable as themselves in their exact environment and pose. ${STYLE_PROTOCOL} OUTPUT THE EDITED IMAGE DATA. ${getLangInst(lang)}`;
  const imgData = extractBase64(base64Image);
  if (!imgData) throw new Error('Invalid image data');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }, { inlineData: { data: imgData, mimeType: 'image/jpeg' } }] },
    config: { imageConfig: { aspectRatio: '1:1' } },
  });
  return getImageUrlFromResponse(response);
}

export async function generateHairLook(base64Image: string, look: string, lang: string) {
  const ai = aiFromEnv();
  const prompt = `Change the person's hair on top of their head to a sophisticated "${look}" style. Only the hair should be modified. ${PRESERVATION_PROTOCOL} Maintain facial identity exactly as it is without adding facial hair or changing body shape. OUTPUT THE EDITED IMAGE DATA. ${getLangInst(lang)}`;
  const imgData = extractBase64(base64Image);
  if (!imgData) throw new Error('Invalid image data');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }, { inlineData: { data: imgData, mimeType: 'image/jpeg' } }] },
    config: { imageConfig: { aspectRatio: '1:1' } },
  });
  return getImageUrlFromResponse(response);
}

export async function generateTutorialSteps(
  originalImage: string,
  targetImage: string,
  mode: MirrorMode,
  lang: string
) {
  const ai = aiFromEnv();
  const origData = extractBase64(originalImage);
  const targetData = extractBase64(targetImage);
  if (!origData || !targetData) throw new Error('Invalid image data for tutorial');

  const prompt = `You are Emma, the Everyday Mirror stylist.
1. Provide a charming, natural, and realistic compliment (approx 15-20 words) about why this specific new look beautifully enhances their unique features. Create an emotional connection.
2. Provide professional steps to achieve this.
${getLangInst(lang)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: origData, mimeType: 'image/jpeg' } },
        { inlineData: { data: targetData, mimeType: 'image/jpeg' } },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          compliment: { type: Type.STRING },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                title: { type: Type.STRING },
                instruction: { type: Type.STRING },
                tip: { type: Type.STRING },
              },
              required: ['id', 'title', 'instruction', 'tip'],
            },
          },
        },
        required: ['compliment', 'steps'],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

export async function generateShoppingItems(targetImage: string, mode: MirrorMode, lang: string) {
  const ai = aiFromEnv();
  let itemCategory = 'makeup products';
  if (mode === 'CLOTHES') itemCategory = 'clothing and outfits';
  if (mode === 'HAIR') itemCategory = 'hair accessories and products';

  const prompt = `Identify 3 real-world ${itemCategory} used in this look. Provide details for each. ${getLangInst(lang)}`;
  const imgData = extractBase64(targetImage);
  if (!imgData) throw new Error('Invalid image data for shopping');

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: { parts: [{ inlineData: { data: imgData, mimeType: 'image/jpeg' } }, { text: prompt }] },
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            price: { type: Type.STRING },
            brand: { type: Type.STRING },
            url: { type: Type.STRING },
            matchReason: { type: Type.STRING },
          },
          required: ['name', 'price', 'brand', 'url', 'matchReason'],
        },
      },
    },
  });
  return JSON.parse(response.text || '[]');
}

export async function getProgressFeedback(
  targetImage: string,
  currentProgressImage: string,
  currentStep: any,
  mode: MirrorMode,
  lang: string
) {
  const ai = aiFromEnv();
  const prompt = `Emma the Stylist: Compare their current progress for step: "${currentStep?.title}". Give warm, encouraging, and specific feedback on what they did well and what to tweak. Be natural and helpful (approx 20 words). ${getLangInst(lang)}`;
  const targetData = extractBase64(targetImage);
  const progressData = extractBase64(currentProgressImage);
  if (!targetData || !progressData) throw new Error('Invalid image data for feedback');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { data: targetData, mimeType: 'image/jpeg' } },
        { inlineData: { data: progressData, mimeType: 'image/jpeg' } },
        { text: prompt },
      ],
    },
  });
  return response.text;
}

export async function askCoachQuestion(
  question: string,
  targetImage: string,
  mode: MirrorMode,
  currentStep: any,
  lang: string
) {
  const ai = aiFromEnv();
  const prompt = `User asks: "${question}". Emma, answer professionally and warmly based on the target look provided in the image and current step "${currentStep?.title}". Keep it conversational and encouraging. ${getLangInst(lang)}`;
  const imgData = extractBase64(targetImage);
  if (!imgData) throw new Error('Invalid image data for QA');

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts: [{ inlineData: { data: imgData, mimeType: 'image/jpeg' } }, { text: prompt }] },
  });
  return response.text;
}

export async function tts(text: string, voiceName = 'Kore') {
  const ai = aiFromEnv();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });
  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!audioData) throw new Error('No audio returned');
  return audioData as string;
}
