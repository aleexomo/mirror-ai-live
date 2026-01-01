import React, { useMemo, useState } from 'react';

export type PaywallReason = 'limit' | 'coach' | 'coachqa' | 'shop';

export type PaywallCopy = {
  title: string;
  subtitle: string;
  highlight: string;
  benefits: string[];
  ctaPrimary: string;
  ctaSecondary: string;
  payWithPix: string;
  payWithCard: string;
  close: string;
  smallPrint: string;
};

type Props = {
  open: boolean;
  previewImage?: string | null;
  copy: PaywallCopy;
  allowPix: boolean;
  onClose: () => void;
  onCheckout: (method: 'card' | 'pix') => Promise<void>;
};

export default function PaywallModal({ open, previewImage, copy, allowPix, onClose, onCheckout }: Props) {
  const [loading, setLoading] = useState<'card' | 'pix' | null>(null);
  const canShowImage = useMemo(() => !!previewImage && previewImage.startsWith('data:image'), [previewImage]);
  if (!open) return null;

  const start = async (method: 'card' | 'pix') => {
    if (loading) return;
    setLoading(method);
    try {
      await onCheckout(method);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-2xl glass-panel rounded-[2rem] border border-amber-500/20 shadow-3xl overflow-hidden">
        <div className="grid md:grid-cols-[240px_1fr]">
          <div className="bg-black/50 p-6 flex flex-col items-center justify-center">
            <div className="w-full aspect-square rounded-[1.6rem] overflow-hidden border border-white/10 bg-black">
              {canShowImage ? (
                <img src={previewImage!} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40 text-sm">✨</div>
              )}
            </div>
            <div className="mt-4 text-[10px] text-white/60 uppercase tracking-[0.35em] font-black text-center">
              {copy.highlight}
            </div>
          </div>

          <div className="p-6 md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-2xl md:text-3xl font-black tracking-tight">{copy.title}</div>
                <div className="mt-2 text-sm text-white/70 leading-relaxed">{copy.subtitle}</div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition"
                title={copy.close}
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid sm:grid-cols-2 gap-3">
              {copy.benefits.slice(0, 6).map((b, idx) => (
                <div key={idx} className="glass-panel rounded-2xl p-4 border border-white/5">
                  <div className="text-xs text-white/80 leading-relaxed">{b}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {allowPix && (
                <button
                  onClick={() => start('pix')}
                  disabled={!!loading}
                  className="flex-1 px-6 py-3 rounded-full bg-white text-black font-black tracking-widest uppercase text-xs hover:bg-amber-500 transition disabled:opacity-60"
                >
                  {loading === 'pix' ? '…' : copy.payWithPix}
                </button>
              )}
              <button
                onClick={() => start('card')}
                disabled={!!loading}
                className="flex-1 px-6 py-3 rounded-full bg-amber-500 text-black font-black tracking-widest uppercase text-xs hover:bg-amber-400 transition disabled:opacity-60"
              >
                {loading === 'card' ? '…' : copy.payWithCard}
              </button>
            </div>

            <button
              onClick={onClose}
              className="mt-3 w-full px-6 py-3 rounded-full glass-panel border border-white/10 text-white font-black tracking-widest uppercase text-xs hover:border-white/20 transition"
            >
              {copy.ctaSecondary}
            </button>

            <div className="mt-4 text-[11px] text-white/50 leading-relaxed">{copy.smallPrint}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
