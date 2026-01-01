
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppState, SessionData, MirrorMode, FavoriteItem, RecommendedItem } from './types';
import Camera, { CameraHandle } from './components/Camera';
import PaywallModal, { PaywallReason } from './components/PaywallModal';
import { 
  generateMakeupLook, 
  generateOutfitLook, 
  generateHairLook,
  generateTutorialSteps, 
  getProgressFeedback, 
  generateShoppingItems,
  askCoachQuestion,
  generateInitialGreeting
} from './services/geminiService';
import { trackUserSession, trackAffiliateClick, syncSavedLook } from './services/apiService';
import { generateTTS, getAppConfig } from './services/geminiService';
import { createCheckout } from './services/billingService';

const FAVORITES_KEY = 'mirror_favorites_v3';
type RemoteConfig = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enabledModes: { MAKEUP: boolean; CLOTHES: boolean; HAIR: boolean };
  features: { audioGuidance: boolean; shopping: boolean; vault: boolean; coach: boolean };
  limits: { maxLooksPerDay: number };
  branding: { watermarkText: string };
  billing?: {
    enabled?: boolean;
    freeCoachQuestionsPerSession?: number;
    gateCoachSecondStep?: boolean;
    premiumLooksPerDay?: number;
  };
} | null;

const applyBranding = (base64: string, watermarkText: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0);
      const fontSize = Math.max(16, Math.floor(canvas.width * 0.045));
      ctx.font = `italic ${fontSize}px "Cormorant Garamond", serif`;
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      const padding = fontSize * 1.2;
      ctx.fillText(watermarkText || "Everyday Mirror", canvas.width - padding, canvas.height - padding);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

const I18N: Record<string, any> = {
  en: {
    tagline: "THE REFLECTION OF YOUR POTENTIAL. YOUR PERSONAL AI STYLIST.",
    makeup: "makeup", clothes: "clothes", hair: "hair", vault: "Style Vault", home: "Home",
    audioOn: "AUDIO ON", muted: "MUTED", selectAesthetic: "SELECT YOUR AESTHETIC", restore: "Restore Coach",
    goal: "GOAL", step: "STEP", coachFeedback: "COACH FEEDBACK", askPlaceholder: "Ask me anything...",
    askBtn: "Ask", 
    letMeSeeInstruction: "When you're through with this step, click 'Let me see' so I can check your work. And remember, if you want to buy any of these things, I'm your girl—just click shop! Any questions?",
    checking: "CHECKING...", skipNext: "SKIP / NEXT", shop: "SHOP", boutique: "STYLE BOUTIQUE",
    verifiedMatches: "VERIFIED MATCHES", buyAtStore: "BUY AT STORE", backToMirror: "BACK TO MIRROR",
    radiant: "Radiant", vaultIt: "VAULT IT", newLook: "NEW LOOK", back: "BACK",
    compare: "HOLD TO COMPARE", analyzing: "EMMA IS LOOKING...", error: "Oops! Something went wrong.",
    shopThis: "SHOP THIS LOOK", shopMakeup: "SHOP MAKEUP", shopHair: "SHOP ACCESSORIES",
    letMeSee: "LET ME SEE",
    loadingMessages: [
      "Almost ready to unveil the glow...",
      "Polishing your reflection...",
      "Emma is perfecting the look...",
      "Enhancing the highlights..."
    ],
    paywall: {
      limit: {
        title: "Want another look today?",
        subtitle: "You’ve used today’s free looks. Unlock Premium and keep going — more looks, full coaching, and personal shopper.",
      },
      coach: {
        title: "Ready for the next step?",
        subtitle: "Full step-by-step coaching is a Premium feature. Upgrade to unlock the rest of Emma’s guidance.",
      },
      coachqa: {
        title: "Want Emma to answer more questions?",
        subtitle: "Unlimited Coach Q&A is Premium. Upgrade to keep asking and get deeper, more personalized tips.",
      },
      common: {
        highlight: "This is you — upgraded.",
        benefits: [
          "More looks per day (no waiting)",
          "Full coaching (all steps)",
          "Unlimited Coach Q&A",
          "Personal shopper + curated picks",
          "Save more looks in your Style Vault",
          "Priority improvements as we ship updates",
        ],
        payWithPix: "Pay with Pix",
        payWithCard: "Pay with card",
        close: "Close",
        ctaSecondary: "Not now",
        smallPrint: "Premium unlocks instantly on this device. You can cancel anytime in your payment portal.",
      }
    },
    moods: {
      'Clean Girl': 'Clean Girl', 'Natural Glow': 'Natural Glow', 'Mild Neutral': 'Mild Neutral',
      'Office Chic': 'Office Chic', 'Golden Hour': 'Golden Hour', 'Bold Statement': 'Bold Statement',
      'Evening Glam': 'Evening Glam', 'Wild Creative': 'Wild Creative', 'Surprise Me': 'Surprise Me',
      'Casual Chic': 'Casual Chic', 'High Elegance': 'High Elegance', 'Carnival Celebration': 'Carnival',
      'Office Power': 'Office Power', 'Classic Sophistication': 'Classic', 'Modern Edge': 'Modern Edge',
      'Creative Avant-Garde': 'Avant-Garde', 'Romantic Waves': 'Romantic'
    }
  },
  ja: {
    tagline: "あなたの可能性を映し出す。あなた専属のAIスタイリスト。",
    makeup: "メイク", clothes: "ファッション", hair: "ヘアスタイル", vault: "スタイル保存", home: "ホーム",
    audioOn: "音声ON", muted: "ミュート中", selectAesthetic: "スタイルを選択", restore: "復元",
    goal: "ゴール", step: "ステップ", coachFeedback: "コーチのフィードバック", askPlaceholder: "何でも聞いてください...",
    askBtn: "送信", 
    letMeSeeInstruction: "準備ができたら「チェック」を押してください。私がアドバイスします。商品が気になったら「ショップ」を見てくださいね！何か質問はありますか？",
    checking: "チェック中...", skipNext: "スキップ / 次へ", shop: "ショップ", boutique: "スタイルブティック",
    verifiedMatches: "厳選アイテム", buyAtStore: "ストアで購入", backToMirror: "戻る",
    radiant: "輝いています", vaultIt: "保存する", newLook: "新しいルック", back: "戻る",
    compare: "長押しで比較", analyzing: "エマが分析中...", error: "エラーが発生しました。",
    shopThis: "このルックを購入", shopMakeup: "メイク用品を購入", shopHair: "ヘアケア用品を購入",
    letMeSee: "チェック",
    loadingMessages: ["準備中...", "鏡を磨いています...", "エマが仕上げをしています...", "ハイライトを調整中..."],
    paywall: {
      limit: {
        title: "今日はもう少し続けたい？",
        subtitle: "本日の無料ルック数に達しました。プレミアムで、もっとルック、フルコーチング、パーソナルショッパーを解放しましょう。",
      },
      coach: {
        title: "次のステップへ進みますか？",
        subtitle: "ステップ別フルコーチングはプレミアム機能です。アップグレードして、エマのガイドを最後まで受け取りましょう。",
      },
      coachqa: {
        title: "もっと質問したい？",
        subtitle: "コーチへの無制限Q&Aはプレミアムです。アップグレードして、より深くパーソナライズされたアドバイスを受け取れます。",
      },
      common: {
        highlight: "あなたの魅力、さらにアップ。",
        benefits: [
          "1日あたりのルック数UP",
          "フルコーチング（全ステップ）",
          "無制限コーチQ&A",
          "パーソナルショッパー + 厳選アイテム",
          "スタイル保存をもっと",
          "新機能を優先的に提供",
        ],
        payWithPix: "Pixで支払う",
        payWithCard: "カードで支払う",
        close: "閉じる",
        ctaSecondary: "今はしない",
        smallPrint: "プレミアムはこの端末ですぐ有効になります。支払いポータルからいつでも解約できます。",
      },
    },
    moods: {
      'Clean Girl': 'クリーンガール', 'Natural Glow': 'ナチュラルグロウ', 'Mild Neutral': 'マイルドニュートラル',
      'Office Chic': 'オフィスシック', 'Golden Hour': 'ゴールデンアワー', 'Bold Statement': 'ボールドステートメント',
      'Evening Glam': 'イブニンググラム', 'Wild Creative': 'ワイルドクリエイティブ', 'Surprise Me': 'おまかせ',
      'Casual Chic': 'カジュアルシック', 'High Elegance': 'エレガント', 'Carnival Celebration': 'カーニバル',
      'Office Power': 'オフィスパワー', 'Classic Sophistication': 'クラシック', 'Modern Edge': 'モダンエッジ',
      'Creative Avant-Garde': 'アバンギャルド', 'Romantic Waves': 'ロマンチックウェーブ'
    }
  },
  pt: {
    tagline: "O REFLEXO DO SEU POTENCIAL. SEU ESTILISTA PESSOAL DE IA.",
    makeup: "maquiagem", clothes: "roupas", hair: "cabelo", vault: "Cofre", home: "Início",
    audioOn: "ÁUDIO ON", muted: "MUDO", selectAesthetic: "SELECIONE SUA ESTÉTICA", restore: "Restaurar",
    goal: "OBJETIVO", step: "PASSO", coachFeedback: "FEEDBACK", askPlaceholder: "Pergunte-me algo...",
    askBtn: "Enviar", 
    letMeSeeInstruction: "Ao terminar este passo, clique em 'Deixe-me ver'. Se quiser levar o look, lembre-se que sou sua consultora—é só clicar na loja! Dúvidas?",
    checking: "VERIFICANDO...", skipNext: "PULAR / PRÓXIMO", shop: "LOJA", boutique: "BOUTIQUE",
    buyAtStore: "COMPRAR", backToMirror: "VOLTAR",
    radiant: "Radiante", vaultIt: "GUARDAR", newLook: "NOVO LOOK", back: "VOLTAR",
    compare: "SEGURE PARA COMPARAR", analyzing: "EMMA ESTÁ OLHANDO...", error: "Algo deu errado.",
    shopThis: "COMPRAR LOOK", shopMakeup: "COMPRAR MAQUIAGEM", shopHair: "COMPRAR ACESSÓRIOS",
    letMeSee: "DEIXE-ME VER",
    loadingMessages: ["Quase pronta...", "Limpando o espelho...", "Emma está finalizando..."],
    paywall: {
      limit: {
        title: "Quer mais um look hoje?",
        subtitle: "Você já usou seus looks grátis de hoje. Libere o Premium para continuar — mais looks, coaching completo e personal shopper.",
      },
      coach: {
        title: "Pronta para o próximo passo?",
        subtitle: "O coaching passo a passo completo é um recurso Premium. Faça upgrade para desbloquear o resto das orientações da Emma.",
      },
      coachqa: {
        title: "Quer fazer mais perguntas para a Emma?",
        subtitle: "Perguntas ilimitadas para a Coach é Premium. Faça upgrade e receba dicas mais profundas e personalizadas.",
      },
      common: {
        highlight: "Você — versão Premium.",
        benefits: [
          "Mais looks por dia (sem esperar)",
          "Coaching completo (todos os passos)",
          "Coach Q&A ilimitado",
          "Personal shopper + sugestões curadas",
          "Guarde mais looks no seu Cofre",
          "Melhorias prioritárias nas atualizações",
        ],
        payWithPix: "Pagar com Pix",
        payWithCard: "Pagar com cartão",
        close: "Fechar",
        ctaSecondary: "Agora não",
        smallPrint: "O Premium é liberado na hora neste dispositivo. Você pode cancelar a qualquer momento no portal de pagamento.",
      },
    }
  },
  es: {
    tagline: "EL REFLEJO DE TU POTENCIAL. EL ESTILISTA PERSONAL DE IA.",
    makeup: "maquillaje", clothes: "ropa", hair: "cabello", vault: "Bóveda", home: "Inicio",
    audioOn: "AUDIO ON", muted: "MUDO", selectAesthetic: "SELECCIONA TU ESTÉTICA", restore: "Restaurar",
    goal: "OBJETIVO", step: "PASO", coachFeedback: "FEEDBACK", askPlaceholder: "Pregúntame lo que quieras...",
    askBtn: "Enviar", 
    letMeSeeInstruction: "Cuando termines este paso, haz clic en 'Déjame ver'. Si te encanta, ¡recuerda que soy tu chica! Haz clic en tienda para comprarlo. ¿Dudas?",
    checking: "VERIFICANDO...", skipNext: "SALTAR / SIGUIENTE", shop: "TIENDA", boutique: "BOUTIQUE",
    buyAtStore: "COMPRAR", backToMirror: "VOLVER",
    radiant: "Radiante", vaultIt: "GUARDAR", newLook: "NOVO LOOK", back: "VOLTAR",
    compare: "MANTÉN PARA COMPARAR", analyzing: "EMMA ANALIZANDO...", error: "Algo salió mal.",
    shopThis: "COMPRAR ESTE LOOK", shopMakeup: "COMPRAR MAQUILLAJE", shopHair: "COMPRAR ACCESORIOS",
    letMeSee: "DÉJAME VER",
    loadingMessages: ["Casi lista...", "Puliendo el espejo...", "Emma terminando..."],
    paywall: {
      limit: {
        title: "¿Quieres otro look hoy?",
        subtitle: "Ya usaste tus looks gratis de hoy. Desbloquea Premium para seguir — más looks, coaching completo y personal shopper.",
      },
      coach: {
        title: "¿Lista para el siguiente paso?",
        subtitle: "El coaching completo paso a paso es Premium. Actualiza para desbloquear el resto de la guía de Emma.",
      },
      coachqa: {
        title: "¿Quieres hacer más preguntas a Emma?",
        subtitle: "Preguntas ilimitadas al Coach es Premium. Actualiza para seguir preguntando y recibir tips más personalizados.",
      },
      common: {
        highlight: "Tú — mejorada.",
        benefits: [
          "Más looks por día (sin esperar)",
          "Coaching completo (todos los pasos)",
          "Coach Q&A ilimitado",
          "Personal shopper + selecciones curadas",
          "Guarda más looks en tu Bóveda",
          "Mejoras prioritarias en updates",
        ],
        payWithPix: "Pagar con Pix",
        payWithCard: "Pagar con tarjeta",
        close: "Cerrar",
        ctaSecondary: "Ahora no",
        smallPrint: "Premium se activa al instante en este dispositivo. Puedes cancelar cuando quieras en el portal de pago.",
      },
    }
  }
};

const MOOD_ICONS: Record<string, string> = {
  'Clean Girl': '🧼', 'Natural Glow': '✨', 'Mild Neutral': '🌸', 'Office Chic': '👓',
  'Golden Hour': '🌅', 'Bold Statement': '💄', 'Wild Creative': '🎨', 'Evening Glam': '🌙',
  'Surprise Me': '🎲', 'Casual Chic': '👕', 'High Elegance': '💃', 'Carnival Celebration': '🎭',
  'Office Power': '💼', 'Classic Sophistication': '💇', 'Modern Edge': '⚡', 'Creative Avant-Garde': '🌈',
  'Romantic Waves': '🌊'
};

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const STYLE_MOODS: Record<MirrorMode, string[]> = {
  MAKEUP: ['Clean Girl', 'Natural Glow', 'Mild Neutral', 'Office Chic', 'Golden Hour', 'Bold Statement', 'Evening Glam', 'Wild Creative', 'Surprise Me'],
  CLOTHES: ['Casual Chic', 'High Elegance', 'Carnival Celebration', 'Office Power', 'Surprise Me'],
  HAIR: ['Classic Sophistication', 'Modern Edge', 'Creative Avant-Garde', 'Romantic Waves', 'Surprise Me']
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [isTargetExpanded, setIsTargetExpanded] = useState(false);
  const [isCoachMinimized, setIsCoachMinimized] = useState(false);
  const [isShoppingDrawerOpen, setIsShoppingDrawerOpen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [isAudioGuidanceOn, setIsAudioGuidanceOn] = useState(true);
  const [isCheckingProgress, setIsCheckingProgress] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [isCoachAnswering, setIsCoachAnswering] = useState(false);
  const [initialGreeting, setInitialGreeting] = useState<string | null>(null);
  const [isGreetingMinimized, setIsGreetingMinimized] = useState(false);
  const [isGreetingLoading, setIsGreetingLoading] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const [isPremium, setIsPremium] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState<PaywallReason>('limit');
  const [paywallPreview, setPaywallPreview] = useState<string | null>(null);
  
  const moodRef = useRef<string>('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const cameraRef = useRef<CameraHandle>(null);
  const greetingTriggered = useRef<boolean>(false);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const lastSpeechIdRef = useRef<number>(0);
  const coachQuestionsUsedRef = useRef<number>(0);

  // Auto-detect browser language and fallback to English if not supported
  const lang = useMemo(() => {
    const short = (navigator.language || 'en').split('-')[0].toLowerCase();
    return I18N[short] ? short : 'en';
  }, []);

  const t = I18N[lang] || I18N.en;

  const country = useMemo(() => {
    const navLang = (navigator.language || '').toLowerCase();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (navLang.includes('pt-br')) return 'BR';
    if (tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza') || tz.startsWith('America/Belem')) return 'BR';
    return 'OTHER';
  }, []);

  const allowPix = country === 'BR';

  const paywallCopy = useMemo(() => {
    const base: any = {
      en: {
        limit: {
          title: 'Unlock Premium Looks',
          subtitle: "You’ve used today’s free looks. Keep going — your next look is waiting.",
          highlight: 'YOUR PHOTO • YOUR UPGRADE',
          benefits: [
            'More looks per day (no waiting)',
            'Full step-by-step coaching (all steps)',
            'Personal shopper: better matches + faster shopping',
            'Priority features + new modes first',
          ],
          ctaSecondary: 'Not now',
          payWithPix: 'Pay with Pix',
          payWithCard: 'Pay with Card',
          close: 'Close',
          smallPrint: 'Secure checkout. Cancel anytime. Your mirror, upgraded.'
        },
        coach: {
          title: 'Full Coaching is Premium',
          subtitle: 'Want the next step? Premium unlocks the complete coaching flow — and more daily looks.',
          highlight: 'COACHING • PREMIUM',
          benefits: [
            'Unlock the next coaching steps',
            'More looks per day',
            'Personal shopper + curated picks',
            'Priority updates',
          ],
          ctaSecondary: 'Continue free',
          payWithPix: 'Pay with Pix',
          payWithCard: 'Get Premium',
          close: 'Close',
          smallPrint: 'Upgrade once and the mirror becomes your daily stylist.'
        },
        coachqa: {
          title: 'Coach Q&A is Premium',
          subtitle: 'You’ve used your free coaching question. Premium unlocks unlimited Q&A during your session.',
          highlight: 'Q&A • PREMIUM',
          benefits: [
            'Unlimited coach questions',
            'Full coaching steps',
            'More looks per day',
            'Personal shopper',
          ],
          ctaSecondary: 'Maybe later',
          payWithPix: 'Pay with Pix',
          payWithCard: 'Get Premium',
          close: 'Close',
          smallPrint: 'Ask anything — Emma stays with you step by step.'
        },
        shop: {
          title: 'Personal Shopper is Premium',
          subtitle: 'Premium unlocks more verified matches and smarter shopping suggestions for your exact vibe.',
          highlight: 'SHOPPING • PREMIUM',
          benefits: [
            'More verified matches',
            'Better brand suggestions',
            'More looks per day',
            'Full coaching',
          ],
          ctaSecondary: 'Keep browsing',
          payWithPix: 'Pay with Pix',
          payWithCard: 'Get Premium',
          close: 'Close',
          smallPrint: 'Upgrade to shop smarter, faster, and with confidence.'
        }
      },
      pt: {
        limit: {
          title: 'Desbloqueie o Premium',
          subtitle: 'Você já usou os looks grátis de hoje. Continue — seu próximo look está pronto.',
          highlight: 'SUA FOTO • SEU UPGRADE',
          benefits: [
            'Mais looks por dia (sem esperar)',
            'Coaching completo passo a passo',
            'Personal shopper: melhores sugestões',
            'Novidades e recursos primeiro',
          ],
          ctaSecondary: 'Agora não',
          payWithPix: 'Pagar com Pix',
          payWithCard: 'Pagar no cartão',
          close: 'Fechar',
          smallPrint: 'Pagamento seguro. Cancele quando quiser. Seu espelho, melhorado.'
        },
        coach: {
          title: 'Coaching completo é Premium',
          subtitle: 'Quer o próximo passo? O Premium libera todo o coaching — e mais looks por dia.',
          highlight: 'COACHING • PREMIUM',
          benefits: ['Libere os próximos passos', 'Mais looks por dia', 'Personal shopper', 'Atualizações prioritárias'],
          ctaSecondary: 'Continuar grátis',
          payWithPix: 'Pagar com Pix',
          payWithCard: 'Quero Premium',
          close: 'Fechar',
          smallPrint: 'Faça upgrade e tenha um estilista todos os dias.'
        },
        coachqa: {
          title: 'Perguntas ao Coach é Premium',
          subtitle: 'Você já usou sua pergunta grátis. O Premium libera perguntas ilimitadas.',
          highlight: 'Q&A • PREMIUM',
          benefits: ['Perguntas ilimitadas', 'Coaching completo', 'Mais looks por dia', 'Personal shopper'],
          ctaSecondary: 'Talvez depois',
          payWithPix: 'Pagar com Pix',
          payWithCard: 'Quero Premium',
          close: 'Fechar',
          smallPrint: 'Pergunte qualquer coisa — a Emma te guia.'
        },
        shop: {
          title: 'Personal shopper é Premium',
          subtitle: 'O Premium libera mais matches e sugestões de compra mais inteligentes.',
          highlight: 'LOJA • PREMIUM',
          benefits: ['Mais matches', 'Sugestões melhores', 'Mais looks por dia', 'Coaching completo'],
          ctaSecondary: 'Continuar vendo',
          payWithPix: 'Pagar com Pix',
          payWithCard: 'Quero Premium',
          close: 'Fechar',
          smallPrint: 'Faça upgrade para comprar com mais confiança.'
        }
      },
      es: {
        limit: {
          title: 'Desbloquea Premium',
          subtitle: 'Ya usaste tus looks gratis de hoy. Sigue — tu próximo look te espera.',
          highlight: 'TU FOTO • TU UPGRADE',
          benefits: ['Más looks por día', 'Coaching completo paso a paso', 'Personal shopper', 'Nuevas funciones primero'],
          ctaSecondary: 'Ahora no',
          payWithPix: 'Pagar con Pix',
          payWithCard: 'Pagar con tarjeta',
          close: 'Cerrar',
          smallPrint: 'Pago seguro. Cancela cuando quieras.'
        },
        coach: {
          title: 'El coaching completo es Premium',
          subtitle: '¿Quieres el siguiente paso? Premium desbloquea todo el coaching y más looks por día.',
          highlight: 'COACHING • PREMIUM',
          benefits: ['Desbloquea más pasos', 'Más looks por día', 'Personal shopper', 'Actualizaciones prioritarias'],
          ctaSecondary: 'Seguir gratis',
          payWithPix: 'Pagar con Pix',
          payWithCard: 'Quiero Premium',
          close: 'Cerrar',
          smallPrint: 'Upgrade y tu espejo se vuelve tu estilista diario.'
        },
        coachqa: {
          title: 'Preguntas al coach es Premium',
          subtitle: 'Ya usaste tu pregunta gratis. Premium desbloquea preguntas ilimitadas.',
          highlight: 'Q&A • PREMIUM',
          benefits: ['Preguntas ilimitadas', 'Coaching completo', 'Más looks por día', 'Personal shopper'],
          ctaSecondary: 'Luego',
          payWithPix: 'Pagar con Pix',
          payWithCard: 'Quiero Premium',
          close: 'Cerrar',
          smallPrint: 'Pregunta lo que quieras — Emma te guía.'
        },
        shop: {
          title: 'Personal shopper es Premium',
          subtitle: 'Premium desbloquea más matches verificados y mejores sugerencias.',
          highlight: 'TIENDA • PREMIUM',
          benefits: ['Más matches', 'Mejores marcas', 'Más looks por día', 'Coaching completo'],
          ctaSecondary: 'Seguir viendo',
          payWithPix: 'Pagar con Pix',
          payWithCard: 'Quiero Premium',
          close: 'Cerrar',
          smallPrint: 'Compra más rápido y con confianza.'
        }
      },
      ja: {
        limit: {
          title: 'プレミアムを解除',
          subtitle: '本日の無料ルックは使い切りました。続けて次のルックへ。',
          highlight: 'あなたの写真 • アップグレード',
          benefits: ['1日あたりのルック数アップ', 'フルコーチング（全ステップ）', 'パーソナルショッパー', '新機能を優先解放'],
          ctaSecondary: '今はやめる',
          payWithPix: 'Pixで支払う',
          payWithCard: 'カードで支払う',
          close: '閉じる',
          smallPrint: '安全な決済。いつでもキャンセル可能。'
        },
        coach: {
          title: 'フルコーチングはプレミアム',
          subtitle: '次のステップへ進みたい？プレミアムで全コーチング＋もっとルック。',
          highlight: 'COACHING • PREMIUM',
          benefits: ['次のステップを解除', '1日あたりのルック数アップ', 'パーソナルショッパー', '優先アップデート'],
          ctaSecondary: '無料で続ける',
          payWithPix: 'Pixで支払う',
          payWithCard: 'プレミアムにする',
          close: '閉じる',
          smallPrint: '毎日のスタイリストを手に入れよう。'
        },
        coachqa: {
          title: 'Q&Aはプレミアム',
          subtitle: '無料の質問を使い切りました。プレミアムで無制限に質問できます。',
          highlight: 'Q&A • PREMIUM',
          benefits: ['質問し放題', 'フルコーチング', 'もっとルック', 'パーソナルショッパー'],
          ctaSecondary: 'あとで',
          payWithPix: 'Pixで支払う',
          payWithCard: 'プレミアムにする',
          close: '閉じる',
          smallPrint: 'Emmaが最後まで一緒にガイドします。'
        },
        shop: {
          title: 'パーソナルショッパーはプレミアム',
          subtitle: 'プレミアムでより多くのおすすめ＆賢い提案を解除。',
          highlight: 'SHOPPING • PREMIUM',
          benefits: ['おすすめを増やす', 'ブランド提案UP', 'もっとルック', 'フルコーチング'],
          ctaSecondary: '閲覧を続ける',
          payWithPix: 'Pixで支払う',
          payWithCard: 'プレミアムにする',
          close: '閉じる',
          smallPrint: 'もっとスマートにお買い物。'
        }
      },
    };

    const l = (lang as any) in base ? (lang as any) : 'en';
    const per = base[l][paywallReason];
    return {
      title: per.title,
      subtitle: per.subtitle,
      highlight: per.highlight,
      benefits: per.benefits,
      ctaPrimary: per.payWithCard,
      ctaSecondary: per.ctaSecondary,
      payWithPix: per.payWithPix,
      payWithCard: per.payWithCard,
      close: per.close,
      smallPrint: per.smallPrint,
    };
  }, [lang, paywallReason]);

  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>(null);
  const isMaintenance = !!remoteConfig?.maintenanceMode;

  const [session, setSession] = useState<SessionData>({
    mode: null, originalImage: null, targetImage: null, currentProgressImage: null,
    steps: [], currentStepIndex: 0, aiFeedback: '', preference: '', recommendedItems: []
  });

  useEffect(() => {
    trackUserSession();
    getAppConfig().then(cfg => {
      if (cfg) {
        setRemoteConfig(cfg);
        // Respect server-side feature toggles
        if (cfg.features?.audioGuidance === false) setIsAudioGuidanceOn(false);
      }
    }).catch(() => null);
    const savedFavs = localStorage.getItem(FAVORITES_KEY);
    if (savedFavs) setFavorites(JSON.parse(savedFavs));

    // Soft "premium" flag for post-checkout success redirects
    const params = new URLSearchParams(window.location.search);

    // Optional deep-link to open the Premium modal (e.g. from /landing)
    if (params.get('buy') === '1' || params.get('checkout') === '1') {
      setPaywallReason('limit');
      setPaywallPreview(null);
      setPaywallOpen(true);
    }
    const premium = params.get('premium') || params.get('paid') || params.get('success');
    if (premium === '1' || premium === 'true') {
      localStorage.setItem('mirror_is_premium', '1');
      setIsPremium(true);
      // Clean URL
      params.delete('premium');
      params.delete('paid');
      params.delete('success');
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', next);
    } else {
      setIsPremium(localStorage.getItem('mirror_is_premium') === '1');
    }
  }, []);

  useEffect(() => {
    let interval: number;
    if (['GENERATING_LOOK', 'CHECKING_PROGRESS'].includes(appState)) {
      interval = window.setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % t.loadingMessages.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [appState, t.loadingMessages]);

  const killCurrentSpeech = () => {
    lastSpeechIdRef.current++;
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch (e) { /* already stopped */ }
      currentAudioSourceRef.current = null;
    }
  };

  const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  const canGenerateLookToday = () => {
    const max = isPremium ? (remoteConfig?.billing?.premiumLooksPerDay ?? 25) : (remoteConfig?.limits?.maxLooksPerDay ?? 3);
    if (max <= 0) return false;
    const key = `mirror_looks_${getTodayKey()}`;
    const used = Number(localStorage.getItem(key) || '0');
    return used < max;
  };

  const openPaywall = (reason: PaywallReason, preview?: string | null) => {
    if (remoteConfig?.billing?.enabled === false) {
      alert(`This feature is currently unavailable.`);
      return;
    }
    setPaywallReason(reason);
    setPaywallPreview(preview || session.originalImage || null);
    setPaywallOpen(true);
  };

  const markLookUsed = () => {
    const key = `mirror_looks_${getTodayKey()}`;
    const used = Number(localStorage.getItem(key) || '0');
    localStorage.setItem(key, String(used + 1));
  };

  const toggleAudio = () => {
    const newVal = !isAudioGuidanceOn;
    setIsAudioGuidanceOn(newVal);
    if (!newVal) {
      killCurrentSpeech();
    }
  };

  const speak = async (text: string) => {
    if (!isAudioGuidanceOn) return;
    killCurrentSpeech();
    const speechId = lastSpeechIdRef.current;
    if (audioContextRef.current?.state === 'suspended') await audioContextRef.current.resume();
    try {
      const audioData = await generateTTS(text);
      if (speechId !== lastSpeechIdRef.current || !isAudioGuidanceOn) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;
      const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
      if (speechId !== lastSpeechIdRef.current || !isAudioGuidanceOn) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      currentAudioSourceRef.current = source;
    } catch (e) {
      console.error(e);
    }
  };

  const selectMode = (mode: MirrorMode) => {
    if (remoteConfig?.enabledModes && remoteConfig.enabledModes[mode] === false) {
      alert('That mode is temporarily disabled. Please try another one.');
      return;
    }
    setSession(prev => ({ ...prev, mode }));
    setAppState('CAPTURE_INITIAL');
    greetingTriggered.current = false;
    setInitialGreeting(null);
    setIsGreetingMinimized(false);
  };

  const handleCaptureForGreeting = async (base64: string) => {
    if (greetingTriggered.current) return;
    greetingTriggered.current = true;
    setIsGreetingLoading(true);
    try {
      const greeting = await generateInitialGreeting(base64, session.mode!, lang);
      setInitialGreeting(greeting);
      speak(greeting);
    } catch (e) { console.error(e); } finally { setIsGreetingLoading(false); }
  };

  useEffect(() => {
    if (appState === 'CAPTURE_INITIAL' && !greetingTriggered.current) {
      const timer = setTimeout(() => cameraRef.current?.takePhoto(), 1500);
      return () => clearTimeout(timer);
    }
  }, [appState]);

  const handleInitialCapture = async (base64: string) => {
    if (!initialGreeting && !greetingTriggered.current) {
      handleCaptureForGreeting(base64);
      return;
    }
    const selectedMood = moodRef.current;
    if (!selectedMood) return;

    if (!canGenerateLookToday()) {
      openPaywall('limit', base64);
      setAppState('CAPTURE_INITIAL');
      return;
    }

    setAppState('GENERATING_LOOK');
    try {
      let target = "";
      if (session.mode === 'MAKEUP') target = await generateMakeupLook(base64, selectedMood, lang);
      else if (session.mode === 'CLOTHES') target = await generateOutfitLook(base64, selectedMood, lang);
      else target = await generateHairLook(base64, selectedMood, lang);
      
      if (!target) throw new Error("Please try another angle.");

      // Count this look as used once we have a valid result
      markLookUsed();

      const brandedTarget = await applyBranding(target, remoteConfig?.branding?.watermarkText || 'Everyday Mirror');
      const tutorialData = await generateTutorialSteps(base64, brandedTarget, session.mode!, lang);
      
      if (remoteConfig?.features?.shopping !== false) {
        generateShoppingItems(brandedTarget, session.mode!, lang).then(items => {
          setSession(prev => ({ ...prev, recommendedItems: items }));
        }).catch(e => console.error("Shopping fetch failed", e));
      }

      setSession(prev => ({ 
        ...prev, originalImage: base64, targetImage: brandedTarget, 
        steps: tutorialData.steps, compliment: tutorialData.compliment,
        currentStepIndex: 0, preference: selectedMood
      }));
      setAppState('GUIDING');
      
      const firstStep = tutorialData.steps[0];
      speak(`${tutorialData.compliment}. ${firstStep.title}: ${firstStep.instruction}. ${t.letMeSeeInstruction}`);
    } catch (error: any) {
      alert(error.message || t.error);
      setAppState('CAPTURE_INITIAL');
    }
  };

  const handleCaptureForProgress = async (base64: string) => {
    setIsCheckingProgress(true);
    setSession(prev => ({ ...prev, currentProgressImage: base64 }));
    try {
      const feedback = await getProgressFeedback(session.targetImage!, base64, session.steps[session.currentStepIndex], session.mode!, lang);
      setSession(prev => ({ ...prev, aiFeedback: feedback }));
      speak(`${feedback}. ${t.letMeSeeInstruction}`);
    } catch (e) { console.error(e); } finally { setIsCheckingProgress(false); }
  };

  const handleMoodAction = (mood: string) => {
    moodRef.current = mood;
    setSession(prev => ({ ...prev, preference: mood }));
    cameraRef.current?.takePhoto();
  };

  const handleAskQuestion = async () => {
    if (!userQuestion.trim() || isCoachAnswering) return;
    if (!isPremium) {
      const free = remoteConfig?.billing?.freeCoachQuestionsPerSession ?? 1;
      if (coachQuestionsUsedRef.current >= free) {
        openPaywall('coachqa');
        return;
      }
      coachQuestionsUsedRef.current += 1;
    }
    setIsCoachAnswering(true);
    const q = userQuestion;
    setUserQuestion('');
    try {
      const answer = await askCoachQuestion(q, session.targetImage!, session.mode!, session.steps[session.currentStepIndex], lang);
      setSession(prev => ({ ...prev, aiFeedback: answer }));
      speak(answer);
    } catch (e) { console.error(e); } finally { setIsCoachAnswering(false); }
  };

  const handleNextStep = () => {
    if (session.currentStepIndex < session.steps.length - 1) {
      const nextIdx = session.currentStepIndex + 1;
      const gateSecond = remoteConfig?.billing?.gateCoachSecondStep ?? true;
      if (!isPremium && gateSecond && nextIdx >= 1) {
        openPaywall('coach');
        return;
      }
      const nextStep = session.steps[nextIdx];
      setSession(prev => ({ ...prev, currentStepIndex: nextIdx, aiFeedback: '' }));
      speak(`${nextStep.title}: ${nextStep.instruction}. ${t.letMeSeeInstruction}`);
    } else {
      setAppState('FINAL_REVEAL');
    }
  };

  const resetSession = () => {
    moodRef.current = ''; greetingTriggered.current = false;
    setInitialGreeting(null); setAppState('IDLE'); setIsShoppingDrawerOpen(false);
    killCurrentSpeech();
    coachQuestionsUsedRef.current = 0;
    setSession({ mode: null, originalImage: null, targetImage: null, currentProgressImage: null, steps: [], currentStepIndex: 0, aiFeedback: '', preference: '', recommendedItems: [] });
  };

  const saveToVault = async () => {
    if (remoteConfig?.features?.vault === false) return;
    if (!session.targetImage || !session.mode) return;
    const item: FavoriteItem = {
      id: `fav_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`,
      mode: session.mode,
      preference: session.preference || 'Surprise Me',
      targetImage: session.targetImage,
      outcomeImage: session.targetImage,
      timestamp: Date.now(),
    };
    const next = [item, ...favorites].slice(0, 100);
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    syncSavedLook(item);
    alert('Saved to Style Vault');
  };

  const shopLabel = session.mode === 'MAKEUP' ? t.shopMakeup : session.mode === 'HAIR' ? t.shopHair : t.shopThis;

  return (
    <div className={`h-screen w-full relative flex flex-col bg-black text-white font-sans overflow-hidden`}>

      <PaywallModal
        open={paywallOpen}
        previewImage={paywallPreview}
        copy={paywallCopy}
        allowPix={allowPix}
        onClose={() => setPaywallOpen(false)}
        onCheckout={async (method) => {
          const out = await createCheckout(method, { country: allowPix ? 'BR' : 'OTHER', lang, reason: paywallReason });
          window.location.href = out.url;
        }}
      />

      {isMaintenance && (
        <div className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/90 px-6 text-center">
          <div className="max-w-md">
            <div className="text-2xl font-black tracking-tight">Everyday Mirror</div>
            <div className="mt-2 text-white/70">
              {remoteConfig?.maintenanceMessage || 'We are polishing the mirror. Please check back soon.'}
            </div>
          </div>
        </div>
      )}
      
      {/* GLOBAL NAVIGATION */}
      {appState !== 'IDLE' && (
        <nav className="fixed top-6 left-0 right-0 z-[500] px-6 flex justify-center pointer-events-none">
          <div className="glass-panel rounded-full px-2 py-1 flex items-center shadow-2xl pointer-events-auto border border-white/5">
            <button onClick={resetSession} className="px-3 py-2 rounded-full text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">{t.home}</button>
            <div className="h-3 w-[1px] bg-white/10 mx-2"></div>
            {remoteConfig?.features?.vault !== false && (
              <>
                <button onClick={() => setAppState('GALLERY')} className="px-3 py-2 rounded-full text-[8px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-all">{t.vault}</button>
                <div className="h-3 w-[1px] bg-white/10 mx-2"></div>
              </>
            )}
            <button onClick={toggleAudio} className={`px-3 py-2 rounded-full text-[8px] font-black uppercase tracking-widest transition-colors ${isAudioGuidanceOn ? 'text-amber-500' : 'text-white/40'}`}>
              {isAudioGuidanceOn ? t.audioOn : t.muted}
            </button>
          </div>
        </nav>
      )}

      {/* CAMERA / MIRROR LAYER */}
      {['CAPTURE_INITIAL', 'GUIDING', 'GENERATING_LOOK', 'CHECKING_PROGRESS'].includes(appState) && (
        <Camera 
          ref={cameraRef}
          isMirrorMode={true} 
          onCapture={appState === 'CAPTURE_INITIAL' && !initialGreeting ? handleInitialCapture : (appState === 'GUIDING' ? handleCaptureForProgress : handleInitialCapture)} 
          showButton={false} 
          isProcessing={appState === 'GENERATING_LOOK' || isCheckingProgress} 
        />
      )}

      {/* EMMA GREETING - MINIMIZABLE PILL */}
      {appState === 'CAPTURE_INITIAL' && initialGreeting && (
        <div className="fixed top-20 inset-x-0 z-[600] flex justify-center px-4 pointer-events-none">
          {!isGreetingMinimized ? (
            <div className="glass-panel rounded-3xl pl-6 pr-4 py-3 border border-amber-500/30 shadow-2xl animate-slide-up-greeting pointer-events-auto max-w-[85%] flex items-center gap-3">
              <p className="serif text-[13px] italic text-white text-center leading-relaxed flex-1">"{initialGreeting}"</p>
              <button 
                onClick={() => setIsGreetingMinimized(true)} 
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                title="Minimize compliment"
              >
                <span className="text-lg">−</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsGreetingMinimized(false)}
              className="w-12 h-12 rounded-full glass-panel border border-amber-500/40 shadow-2xl flex items-center justify-center text-amber-500 hover:scale-110 active:scale-95 transition-all pointer-events-auto animate-fade-in relative group"
              title="Expand compliment"
            >
              <span className="text-xl group-hover:scale-125 transition-transform">✨</span>
              <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping opacity-30"></div>
            </button>
          )}
        </div>
      )}

      {/* IDLE STATE - COMPACT HOME SCREEN */}
      {appState === 'IDLE' && (
        <div className="h-full flex flex-col items-center justify-between py-12 px-6 text-center animate-fade-in overflow-hidden">
          <div className="flex flex-col items-center">
            <h1 className="serif text-[4.5rem] md:text-9xl italic leading-none mb-1 tracking-tight">Everyday Mirror</h1>
            <p className="text-amber-500/80 text-[9px] md:text-[11px] uppercase tracking-[0.4em] font-bold max-w-sm">
              {t.tagline}
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-4 w-full max-w-5xl justify-center items-center h-[55vh]">
            {['MAKEUP', 'CLOTHES', 'HAIR'].map((m) => (
              <button 
                key={m} 
                onClick={() => selectMode(m as MirrorMode)} 
                className="w-full md:flex-1 h-full max-h-[150px] md:max-h-none rounded-[45px] border border-white/10 flex flex-col items-center justify-center hover:border-amber-500/40 hover:bg-white/[0.02] transition-all duration-500 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/[0.02]"></div>
                <span className="serif text-2xl md:text-4xl italic text-white/90 group-hover:text-amber-500 transition-colors z-10">
                  {t[m.toLowerCase()]}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center">
            <button onClick={() => setAppState('GALLERY')} className="text-white/20 text-[9px] uppercase tracking-[0.4em] hover:text-white transition-colors">{t.vault}</button>
          </div>
        </div>
      )}

      {/* MOOD SELECTION (CAPTURE_INITIAL) */}
      {appState === 'CAPTURE_INITIAL' && session.mode && (
        <div className="fixed inset-x-0 bottom-0 z-[500] pb-10 px-6 flex flex-col items-center pointer-events-none">
          {isGreetingLoading && !initialGreeting && (
            <div className="mb-10 text-center">
              <div className="w-6 h-6 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-amber-500 text-[8px] uppercase tracking-widest font-black">{t.analyzing}</p>
            </div>
          )}
          <div className="max-w-full w-full flex overflow-x-auto space-x-5 scroll-hide py-4 px-6 pointer-events-auto justify-start md:justify-center">
            {STYLE_MOODS[session.mode].map((mood) => (
              <div key={mood} className="flex flex-col items-center space-y-3 flex-shrink-0">
                <button 
                  onClick={() => handleMoodAction(mood)}
                  className="w-14 h-14 rounded-full glass-panel border border-white/20 flex items-center justify-center text-2xl hover:border-amber-500 hover:scale-110 active:scale-95 transition-all duration-300 group"
                >
                  <span className="group-hover:drop-shadow-[0_0_8px_rgba(212,175,55,1)]">{MOOD_ICONS[mood] || '✨'}</span>
                </button>
                <span className="text-[7px] font-black text-white/40 uppercase tracking-widest text-center max-w-[70px]">
                  {t.moods[mood]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLOATING TARGET MINIATURE (TOP-RIGHT) */}
      {appState === 'GUIDING' && isCoachMinimized && session.targetImage && (
        <div className="fixed top-20 right-6 z-[700] animate-fade-in pointer-events-auto">
          <div className="relative group">
            <button 
              onClick={() => setIsTargetExpanded(true)}
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-2xl hover:scale-105 transition-all duration-300"
            >
              <img src={session.targetImage} className="w-full h-full object-cover" />
            </button>
            <button 
              onClick={() => setIsCoachMinimized(false)}
              className="absolute -bottom-3 -left-3 w-7 h-7 rounded-full glass-panel border border-white/20 flex items-center justify-center text-[10px] text-white hover:text-amber-500"
            >
              ↑
            </button>
            <button 
              onClick={resetSession}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white/10 hover:bg-red-500 text-white flex items-center justify-center text-[8px] transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* COACH GUIDANCE PANEL */}
      {appState === 'GUIDING' && session.targetImage && !isCoachMinimized && (
        <div className="fixed inset-x-0 bottom-0 z-[500] p-4 md:p-6 pointer-events-none animate-slide-up">
          <div className="max-w-xl mx-auto glass-panel rounded-[40px] p-6 border border-white/5 pointer-events-auto shadow-3xl relative">
            <button onClick={() => { setIsCoachMinimized(true); killCurrentSpeech(); }} className="absolute top-5 right-8 text-white/20 hover:text-white uppercase text-[7px] font-black tracking-widest">
              Minimize
            </button>
            <div className="flex flex-col space-y-4">
              <div className="flex items-start space-x-4">
                <div onClick={() => setIsTargetExpanded(true)} className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 cursor-zoom-in group relative">
                  <img src={session.targetImage} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-[6px] uppercase tracking-widest font-black">Goal</span>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-amber-500 text-[7px] font-black uppercase tracking-[0.4em] mb-1">{t.step} {session.currentStepIndex + 1}</p>
                  <h3 className="serif text-base italic text-white mb-1 leading-tight">{session.steps[session.currentStepIndex]?.title}</h3>
                  <p className="text-white/40 text-[10px] italic leading-relaxed">"{session.steps[session.currentStepIndex]?.instruction}"</p>
                </div>
                {session.recommendedItems.length > 0 && (
                  <button onClick={() => setIsShoppingDrawerOpen(true)} className="shrink-0 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-1">🛒</div>
                    <span className="text-[6px] font-black uppercase tracking-widest text-amber-500">Shop</span>
                  </button>
                )}
              </div>
              
              {session.aiFeedback && (
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-3 animate-fade-in">
                  <p className="text-amber-500 text-[6px] font-black uppercase tracking-widest mb-1">{t.coachFeedback}</p>
                  <p className="text-white/80 text-[11px] italic leading-tight">"{session.aiFeedback}"</p>
                </div>
              )}

              {/* Question Input */}
              <div className="flex space-x-2 bg-white/5 border border-white/5 rounded-full px-4 py-1">
                <input 
                  type="text" 
                  value={userQuestion}
                  onChange={(e) => setUserQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                  placeholder={t.askPlaceholder}
                  className="flex-1 bg-transparent border-none outline-none text-[11px] placeholder:text-white/20 py-2"
                />
                <button 
                  onClick={handleAskQuestion}
                  disabled={isCoachAnswering || !userQuestion.trim()}
                  className="text-amber-500 text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                >
                  {isCoachAnswering ? '...' : t.askBtn}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => cameraRef.current?.takePhoto()} disabled={isCheckingProgress} className="py-3 bg-amber-500 text-black rounded-full font-black text-[9px] uppercase tracking-widest active:scale-95 transition-all">
                  {isCheckingProgress ? t.checking : t.letMeSee}
                </button>
                <button onClick={handleNextStep} className="py-3 bg-white/10 border border-white/10 text-white rounded-full font-black text-[9px] uppercase tracking-widest">Next</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHOPPING DRAWER */}
      {isShoppingDrawerOpen && (
        <div className="fixed inset-0 z-[1500] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsShoppingDrawerOpen(false)}></div>
          <div className="w-full md:w-[400px] h-full glass-panel border-l border-white/10 animate-slide-left p-8 overflow-y-auto relative z-10">
            <button onClick={() => setIsShoppingDrawerOpen(false)} className="absolute top-8 right-8 text-white/40 hover:text-white">✕</button>
            <h2 className="serif text-4xl italic mb-8 mt-4">{t.boutique}</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/60 mb-8">{t.verifiedMatches}</p>
            
            <div className="space-y-6">
              {(isPremium ? session.recommendedItems : session.recommendedItems.slice(0, 3)).map((item, i) => (
                <div key={i} className="glass-panel p-6 rounded-[35px] border border-white/5 hover:border-amber-500/30 transition-all group">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-white font-bold text-sm leading-tight group-hover:text-amber-500 transition-colors">{item.name}</h4>
                    <span className="text-amber-500 font-black text-[10px]">{item.price}</span>
                  </div>
                  <p className="text-white/40 text-[9px] uppercase tracking-widest mb-3">{item.brand}</p>
                  <p className="text-white/60 text-[11px] italic mb-4 leading-relaxed">"{item.matchReason}"</p>
                  <a 
                    href={item.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    onClick={() => trackAffiliateClick(item.name, item.brand, item.price)}
                    className="block w-full py-3 bg-white text-black text-center rounded-full font-black text-[9px] uppercase tracking-widest hover:bg-amber-500 transition-colors"
                  >
                    {t.buyAtStore}
                  </a>
                </div>
              ))}

              {!isPremium && session.recommendedItems.length > 3 && (
                <div className="glass-panel p-6 rounded-[35px] border border-amber-500/20">
                  <div className="text-sm font-black">Unlock Personal Shopper</div>
                  <div className="mt-2 text-xs text-white/70 leading-relaxed">
                    Get more verified matches, smarter suggestions, and better brand picks for your exact vibe.
                  </div>
                  <button
                    onClick={() => openPaywall('shop')}
                    className="mt-4 w-full py-3 rounded-full bg-amber-500 text-black font-black text-[9px] uppercase tracking-widest hover:bg-amber-400 transition"
                  >
                    Get Premium
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FINAL REVEAL */}
      {appState === 'FINAL_REVEAL' && (
        <div className="h-full flex flex-col items-center justify-center p-8 animate-fade-in bg-black z-[800]">
          <h2 className="serif text-7xl italic mb-10 tracking-tight">{t.radiant}</h2>
          <div className="w-full max-w-sm aspect-square rounded-[60px] overflow-hidden border border-white/5 mb-10 relative shadow-3xl">
            <img src={showOriginal ? session.originalImage! : session.targetImage!} className="w-full h-full object-cover transition-opacity duration-300" />
            {session.recommendedItems.length > 0 && (
              <button 
                onClick={() => setIsShoppingDrawerOpen(true)}
                className="absolute bottom-6 right-6 p-4 glass-panel rounded-full text-amber-500 border border-amber-500/30 shadow-2xl animate-pulse"
              >
                🛒
              </button>
            )}
          </div>
          <div className="flex flex-col space-y-3 w-full max-w-[280px]">
             <button onMouseDown={() => setShowOriginal(true)} onMouseUp={() => setShowOriginal(false)} onTouchStart={() => setShowOriginal(true)} onTouchEnd={() => setShowOriginal(false)} className="py-5 bg-amber-500 text-black rounded-full font-black text-[10px] tracking-[0.3em] uppercase transition-all select-none">{t.compare}</button>
             {remoteConfig?.features?.vault !== false && (
               <button onClick={saveToVault} className="py-4 bg-white text-black rounded-full font-black text-[9px] uppercase tracking-widest hover:bg-amber-500 transition-colors">
                 Save to Style Vault
               </button>
             )}
             <div className="flex space-x-2">
               <button onClick={resetSession} className="flex-1 py-4 bg-white/5 border border-white/10 text-white rounded-full font-black text-[9px] uppercase tracking-widest">{t.newLook}</button>
               <button onClick={() => setAppState('IDLE')} className="flex-1 py-4 bg-white text-black rounded-full font-black text-[9px] uppercase tracking-widest">Done</button>
             </div>
             {session.recommendedItems.length > 0 && (
               <button onClick={() => setIsShoppingDrawerOpen(true)} className="py-4 text-amber-500/80 text-[10px] font-black uppercase tracking-[0.2em]">{shopLabel}</button>
             )}
          </div>
        </div>
      )}

      {/* LOADING STATES */}
      {['GENERATING_LOOK', 'CHECKING_PROGRESS'].includes(appState) && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/98 backdrop-blur-3xl">
          <div className="relative w-40 h-40 flex items-center justify-center mb-10">
            <div className="polish-ring w-40 h-40 opacity-10"></div>
            <div className="polish-ring w-28 h-28 opacity-30 [animation-delay:0.5s]"></div>
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin z-10"></div>
          </div>
          <p className="serif text-2xl italic text-white/90 text-center px-10 animate-pulse">{t.loadingMessages[loadingMsgIdx]}</p>
        </div>
      )}

      {/* ZOOM MODAL */}
      {isTargetExpanded && (
        <div className="fixed inset-0 z-[2000] bg-black/98 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setIsTargetExpanded(false)}>
          <img src={session.targetImage!} className="max-w-full max-h-[85vh] object-contain rounded-[40px] shadow-3xl border border-white/10" />
        </div>
      )}

      {/* GALLERY */}
      {appState === 'GALLERY' && (
        <div className="h-full p-10 overflow-y-auto bg-black z-[800]">
          <h2 className="serif text-5xl italic text-center mb-12 tracking-tight">{t.vault}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto pb-24">
            {favorites.map(f => (
              <div key={f.id} className="aspect-[3/4] rounded-[40px] overflow-hidden border border-white/10 relative group shadow-xl">
                <img src={f.outcomeImage} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                   <p className="serif italic text-xl mb-1">{f.preference}</p>
                   <p className="text-[7px] font-black uppercase tracking-widest text-amber-500">{new Date(f.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setAppState('IDLE')} className="fixed bottom-10 left-1/2 -translate-x-1/2 px-12 py-5 bg-white text-black rounded-full font-black text-[10px] tracking-[0.3em] uppercase shadow-2xl hover:bg-amber-500 transition-colors">Home</button>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-left { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slide-up-greeting { from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up { animation: slide-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-left { animation: slide-left 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-up-greeting { animation: slide-up-greeting 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .polish-ring { position: absolute; border: 1px solid #d4af37; border-radius: 50%; animation: mirror-polish 2.5s infinite ease-in-out; }
        @keyframes mirror-polish { 0% { transform: scale(0.6); opacity: 0; } 50% { transform: scale(1.1); opacity: 0.2; } 100% { transform: scale(0.9); opacity: 0; } }
      `}</style>
    </div>
  );
};

export default App;
