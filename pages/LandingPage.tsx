import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';

type Lang = 'en' | 'pt' | 'es' | 'ja';

const COPY: Record<Lang, any> = {
  en: {
    badge: 'NEW • AI Mirror',
    heroH: 'Meet your best version — in one photo.',
    heroP: 'Everyday Mirror turns your selfie into a complete look (makeup, outfit, or hair) — then guides you step-by-step and suggests what to buy.',
    ctaPrimary: 'Try it free',
    ctaSecondary: 'Get Premium',
    trust: 'No app download. Works in your browser. Private by design.',
    how: 'How it works',
    steps: [
      { t: 'Upload or snap a photo', p: 'No editing. Just you.' },
      { t: 'Pick your vibe', p: 'Clean, glam, office, casual — your call.' },
      { t: 'Get the full look', p: 'A styled result + simple coaching steps.' },
    ],
    featuresH: 'Why people love it',
    features: [
      'Feels like a friendly coach (not a cold tool)',
      'Makeup, outfit, and hair modes',
      'Step-by-step guidance you can actually follow',
      'Shopping suggestions that match your style',
      'Save your best looks in the Style Vault',
    ],
    premiumH: 'Premium makes it addictive',
    premiumP: 'More looks per day, full coaching, and a smarter personal shopper — unlocked instantly after checkout.',
    premiumBullets: ['More looks per day', 'Full coaching (all steps)', 'Unlimited Coach Q&A', 'Personal shopper + curated picks'],
    priceNoteBR: 'Brazil: Pix or card. Elsewhere: card.',
    footer: 'Ready to see yourself differently — today?',
  },
  pt: {
    badge: 'NOVO • Espelho com IA',
    heroH: 'Veja sua melhor versão — com uma foto.',
    heroP: 'O Everyday Mirror transforma sua selfie em um look completo (maquiagem, roupa ou cabelo) — e depois te guia passo a passo e sugere o que comprar.',
    ctaPrimary: 'Testar grátis',
    ctaSecondary: 'Quero o Premium',
    trust: 'Sem baixar app. Funciona no navegador. Privado por padrão.',
    how: 'Como funciona',
    steps: [
      { t: 'Envie ou tire uma foto', p: 'Sem edição. Só você.' },
      { t: 'Escolha seu estilo', p: 'Clean, glam, trabalho, casual — você decide.' },
      { t: 'Receba o look completo', p: 'Resultado + coaching simples e prático.' },
    ],
    featuresH: 'Por que as pessoas amam',
    features: [
      'Parece uma coach de verdade (não uma ferramenta fria)',
      'Modos: maquiagem, roupa e cabelo',
      'Passo a passo fácil de seguir',
      'Sugestões de compra que combinam com você',
      'Guarde seus melhores looks no Cofre',
    ],
    premiumH: 'Premium vicia (no bom sentido)',
    premiumP: 'Mais looks por dia, coaching completo e personal shopper melhor — liberado na hora após o pagamento.',
    premiumBullets: ['Mais looks por dia', 'Coaching completo (todos os passos)', 'Coach Q&A ilimitado', 'Personal shopper + seleções curadas'],
    priceNoteBR: 'Brasil: Pix ou cartão. Outros países: cartão.',
    footer: 'Pronto para se ver de um jeito novo — hoje?',
  },
  es: {
    badge: 'NUEVO • Espejo con IA',
    heroH: 'Conoce tu mejor versión — con una foto.',
    heroP: 'Everyday Mirror convierte tu selfie en un look completo (maquillaje, ropa o cabello) — y luego te guía paso a paso y sugiere qué comprar.',
    ctaPrimary: 'Probar gratis',
    ctaSecondary: 'Quiero Premium',
    trust: 'Sin descargar app. Funciona en el navegador. Privado por defecto.',
    how: 'Cómo funciona',
    steps: [
      { t: 'Sube o toma una foto', p: 'Sin edición. Solo tú.' },
      { t: 'Elige tu vibe', p: 'Clean, glam, oficina, casual — tú decides.' },
      { t: 'Recibe el look completo', p: 'Resultado + coaching simple.' },
    ],
    featuresH: 'Por qué encanta',
    features: [
      'Se siente como una coach (no una herramienta fría)',
      'Modos: maquillaje, ropa y cabello',
      'Guía paso a paso fácil',
      'Sugerencias de compra que combinan contigo',
      'Guarda tus mejores looks en la Bóveda',
    ],
    premiumH: 'Premium lo hace imparable',
    premiumP: 'Más looks por día, coaching completo y un personal shopper mejor — se desbloquea al instante tras el pago.',
    premiumBullets: ['Más looks por día', 'Coaching completo (todos los pasos)', 'Coach Q&A ilimitado', 'Personal shopper + selecciones'],
    priceNoteBR: 'Brasil: Pix o tarjeta. Otros países: tarjeta.',
    footer: '¿Listo para verte diferente — hoy?',
  },
  ja: {
    badge: 'NEW • AIミラー',
    heroH: '一枚の写真で、最高の自分へ。',
    heroP: 'Everyday Mirrorはセルフィーから「メイク・服・髪」の完成ルックを提案し、手順をやさしくガイド。買い物のおすすめも出します。',
    ctaPrimary: '無料で試す',
    ctaSecondary: 'プレミアム',
    trust: 'アプリ不要。ブラウザでOK。プライバシー重視。',
    how: '使い方',
    steps: [
      { t: '写真を撮る/アップロード', p: '加工なしで大丈夫。' },
      { t: '雰囲気を選ぶ', p: 'クリーン/グラム/オフィス/カジュアル など' },
      { t: '完成ルック + コーチング', p: 'すぐ実践できるステップで案内。' },
    ],
    featuresH: '選ばれる理由',
    features: [
      '冷たいツールじゃなく、優しいコーチみたい',
      'メイク・服・髪の3モード',
      '分かりやすいステップガイド',
      '雰囲気に合う買い物提案',
      'Style Vaultに保存できる',
    ],
    premiumH: 'プレミアムでさらに楽しく',
    premiumP: '1日のルック数アップ、フルコーチング、パーソナルショッパーが解放されます。',
    premiumBullets: ['1日のルック数アップ', 'フルコーチング', '無制限Q&A', 'パーソナルショッパー'],
    priceNoteBR: 'ブラジル: Pix / カード。他: カード。',
    footer: '今日、違う自分に会いに行こう。',
  },
};

export default function LandingPage() {
  const lang = useMemo<Lang>(() => {
    const short = (navigator.language || 'en').split('-')[0].toLowerCase();
    return (COPY as any)[short] ? (short as Lang) : 'en';
  }, []);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const isBR = useMemo(() => {
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.includes('pt-br')) return true;
    return tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza') || tz.startsWith('America/Belem');
  }, [tz]);

  const c = COPY[lang];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between">
          <div className="text-lg font-black tracking-tight">Everyday Mirror</div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="px-4 py-2 rounded-full bg-white text-black text-xs font-black tracking-widest uppercase"
            >
              {c.ctaPrimary}
            </Link>
            <Link
              to="/?checkout=1"
              className="px-4 py-2 rounded-full border border-white/20 text-xs font-black tracking-widest uppercase hover:bg-white/10"
            >
              {c.ctaSecondary}
            </Link>
          </div>
        </header>

        <main className="mt-12 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel border border-white/10 text-[10px] font-black tracking-widest uppercase text-white/80">
              <span className="text-amber-400">●</span> {c.badge}
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-black leading-tight">{c.heroH}</h1>
            <p className="mt-4 text-white/70 text-base leading-relaxed">{c.heroP}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/" className="px-6 py-3 rounded-full bg-amber-400 text-black font-black">
                {c.ctaPrimary}
              </Link>
              <Link to="/?checkout=1" className="px-6 py-3 rounded-full border border-white/20 font-black hover:bg-white/10">
                {c.ctaSecondary}
              </Link>
            </div>

            <p className="mt-4 text-xs text-white/60">{c.trust}</p>
          </div>

          <div className="glass-panel rounded-3xl p-6 border border-white/10">
            <div className="text-sm font-black tracking-widest uppercase text-white/70">{c.how}</div>
            <div className="mt-4 space-y-4">
              {c.steps.map((s: any, idx: number) => (
                <div key={idx} className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center font-black">{idx + 1}</div>
                  <div>
                    <div className="font-black">{s.t}</div>
                    <div className="text-sm text-white/60">{s.p}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <section className="mt-12 grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-3xl p-6 border border-white/10">
            <div className="text-xl font-black">{c.featuresH}</div>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {c.features.map((f: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-panel rounded-3xl p-6 border border-amber-400/30">
            <div className="text-xl font-black">{c.premiumH}</div>
            <p className="mt-2 text-sm text-white/70">{c.premiumP}</p>
            <ul className="mt-4 grid sm:grid-cols-2 gap-2 text-sm text-white/80">
              {c.premiumBullets.map((b: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="text-amber-400">★</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-white/60">{c.priceNoteBR}</p>
            <div className="mt-5 flex gap-3">
              <Link to="/?checkout=1" className="px-6 py-3 rounded-full bg-white text-black font-black">
                {c.ctaSecondary}
              </Link>
              <Link to="/" className="px-6 py-3 rounded-full border border-white/20 font-black hover:bg-white/10">
                {c.ctaPrimary}
              </Link>
            </div>
            {isBR && (
              <div className="mt-3 text-[11px] text-white/60">
                Pix disponível no Brasil.
              </div>
            )}
          </div>
        </section>

        <footer className="mt-12 text-center">
          <div className="text-2xl font-black">{c.footer}</div>
          <div className="mt-4 flex justify-center gap-3">
            <Link to="/" className="px-6 py-3 rounded-full bg-amber-400 text-black font-black">
              {c.ctaPrimary}
            </Link>
            <Link to="/?checkout=1" className="px-6 py-3 rounded-full border border-white/20 font-black hover:bg-white/10">
              {c.ctaSecondary}
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
