import React, { useEffect, useMemo, useState } from 'react';
import { getBackendUrl } from '../services/geminiService';

type Overview = {
  config: any;
  counts: { sessions: number; looks: number; events: number };
  recentSessions: any[];
  recentLooks: any[];
  recentEvents: any[];
};

async function adminFetch<T>(path: string, token: string, method: 'GET' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
  const base = getBackendUrl();
  if (!base) throw new Error('Missing VITE_BACKEND_URL');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Admin request failed');
  return data as T;
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cfg = overview?.config;

  const load = async () => {
    setError(null);
    const data = await adminFetch<Overview>('/api/admin/overview', token);
    setOverview(data);
  };

  useEffect(() => {
    // quick auto-login if token is in localStorage
    const saved = localStorage.getItem('mirror_admin_token');
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (!token) return;
    localStorage.setItem('mirror_admin_token', token);
  }, [token]);

  const canShow = useMemo(() => authed && overview, [authed, overview]);

  const saveConfig = async () => {
    if (!overview) return;
    setSaving(true);
    setError(null);
    try {
      const next = await adminFetch<any>('/api/admin/config', token, 'PUT', overview.config);
      setOverview((prev) => (prev ? { ...prev, config: next } : prev));
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const clear = async (what: 'sessions' | 'looks' | 'events' | 'all') => {
    setSaving(true);
    setError(null);
    try {
      await adminFetch('/api/admin/clear', token, 'DELETE', { what });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Clear failed');
    } finally {
      setSaving(false);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md glass-panel rounded-3xl p-6">
          <div className="text-2xl font-black">Admin</div>
          <div className="mt-1 text-sm text-white/60">Enter your admin token to manage the mirror.</div>

          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ADMIN_TOKEN"
            className="mt-4 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
          />

          <button
            onClick={async () => {
              try {
                setError(null);
                await load();
                setAuthed(true);
              } catch (e: any) {
                setError(e?.message || 'Login failed');
              }
            }}
            className="mt-4 w-full px-4 py-3 rounded-full bg-amber-500 text-black font-black tracking-widest uppercase hover:bg-amber-400 transition"
          >
            Enter
          </button>
          {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
          <div className="mt-4 text-xs text-white/40">
            Backend URL: <span className="text-white/60">{getBackendUrl() || '(not set)'}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="min-h-screen bg-[#070707] text-white flex items-center justify-center">Loading…</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070707] text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-3xl font-black">Everyday Mirror — Admin</div>
            <div className="mt-1 text-sm text-white/60">Full control over features, limits, and monitoring.</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={load}
              className="px-4 py-2 rounded-full glass-panel border border-white/10 text-xs font-black tracking-widest uppercase hover:border-white/20"
            >
              Refresh
            </button>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="px-4 py-2 rounded-full bg-amber-500 text-black text-xs font-black tracking-widest uppercase hover:bg-amber-400 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {error && <div className="mt-4 glass-panel border border-red-500/20 rounded-2xl p-4 text-sm text-red-200">{error}</div>}

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { t: 'Sessions tracked', v: overview.counts.sessions },
            { t: 'Saved looks', v: overview.counts.looks },
            { t: 'Events', v: overview.counts.events },
          ].map((c) => (
            <div key={c.t} className="glass-panel rounded-3xl p-6">
              <div className="text-xs text-white/60 font-black tracking-widest uppercase">{c.t}</div>
              <div className="mt-2 text-3xl font-black text-amber-400">{c.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid lg:grid-cols-2 gap-6">
          <div className="glass-panel rounded-3xl p-6">
            <div className="text-xl font-black">Controls</div>
            <div className="mt-1 text-sm text-white/60">Toggle features and set daily limits.</div>

            <div className="mt-6 space-y-5">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-black">Maintenance mode</div>
                  <div className="text-xs text-white/60">Locks the mirror and shows a message.</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!cfg.maintenanceMode}
                  onChange={(e) =>
                    setOverview((p) => (p ? { ...p, config: { ...p.config, maintenanceMode: e.target.checked } } : p))
                  }
                />
              </label>

              <div>
                <div className="font-black">Maintenance message</div>
                <input
                  value={cfg.maintenanceMessage || ''}
                  onChange={(e) => setOverview((p) => (p ? { ...p, config: { ...p.config, maintenanceMessage: e.target.value } } : p))}
                  className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="grid sm:grid-cols-3 gap-3">
                {(['MAKEUP', 'CLOTHES', 'HAIR'] as const).map((m) => (
                  <label key={m} className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                    <div className="text-sm font-black">{m}</div>
                    <input
                      type="checkbox"
                      checked={cfg.enabledModes?.[m] !== false}
                      onChange={(e) =>
                        setOverview((p) =>
                          p
                            ? {
                                ...p,
                                config: {
                                  ...p.config,
                                  enabledModes: { ...(p.config.enabledModes || {}), [m]: e.target.checked },
                                },
                              }
                            : p
                        )
                      }
                    />
                  </label>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {([
                  ['audioGuidance', 'Audio guidance'],
                  ['shopping', 'Shopping'],
                  ['vault', 'Style Vault'],
                  ['coach', 'Coach Q&A'],
                ] as const).map(([k, label]) => (
                  <label key={k} className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                    <div className="text-sm font-black">{label}</div>
                    <input
                      type="checkbox"
                      checked={cfg.features?.[k] !== false}
                      onChange={(e) =>
                        setOverview((p) =>
                          p
                            ? { ...p, config: { ...p.config, features: { ...(p.config.features || {}), [k]: e.target.checked } } }
                            : p
                        )
                      }
                    />
                  </label>
                ))}
              </div>

              <div>
                <div className="font-black">Daily free looks per device</div>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={cfg.limits?.maxLooksPerDay ?? 3}
                  onChange={(e) =>
                    setOverview((p) =>
                      p ? { ...p, config: { ...p.config, limits: { ...(p.config.limits || {}), maxLooksPerDay: Number(e.target.value) } } } : p
                    )
                  }
                  className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                />
              </div>

              <div className="glass-panel rounded-2xl p-4 border border-white/5">
                <div className="font-black">Billing / Paywall</div>
                <div className="mt-1 text-xs text-white/60">Controls Premium gating + prices shown in Stripe Checkout.</div>

                <div className="mt-4 space-y-4">
                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-black">Enable billing</div>
                      <div className="text-xs text-white/60">If off, paywalls will show a simple alert instead.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={cfg.billing?.enabled !== false}
                      onChange={(e) =>
                        setOverview((p) =>
                          p ? { ...p, config: { ...p.config, billing: { ...(p.config.billing || {}), enabled: e.target.checked } } } : p
                        )
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-black">Gate coaching after Step 1</div>
                      <div className="text-xs text-white/60">If on, Step 2+ requires Premium.</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={cfg.billing?.gateCoachSecondStep !== false}
                      onChange={(e) =>
                        setOverview((p) =>
                          p
                            ? {
                                ...p,
                                config: { ...p.config, billing: { ...(p.config.billing || {}), gateCoachSecondStep: e.target.checked } },
                              }
                            : p
                        )
                      }
                    />
                  </label>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <div className="font-black">Premium looks/day</div>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={cfg.billing?.premiumLooksPerDay ?? 25}
                        onChange={(e) =>
                          setOverview((p) =>
                            p
                              ? {
                                  ...p,
                                  config: {
                                    ...p.config,
                                    billing: { ...(p.config.billing || {}), premiumLooksPerDay: Number(e.target.value) },
                                  },
                                }
                              : p
                          )
                        }
                        className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <div className="font-black">Free Coach Q&amp;A/session</div>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        value={cfg.billing?.freeCoachQuestionsPerSession ?? 1}
                        onChange={(e) =>
                          setOverview((p) =>
                            p
                              ? {
                                  ...p,
                                  config: {
                                    ...p.config,
                                    billing: { ...(p.config.billing || {}), freeCoachQuestionsPerSession: Number(e.target.value) },
                                  },
                                }
                              : p
                          )
                        }
                        className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="font-black">Stripe product name</div>
                    <input
                      value={cfg.billing?.productName || 'Everyday Mirror Premium'}
                      onChange={(e) =>
                        setOverview((p) =>
                          p ? { ...p, config: { ...p.config, billing: { ...(p.config.billing || {}), productName: e.target.value } } } : p
                        )
                      }
                      className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <div className="font-black">Price (Brazil) BRL / month</div>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={cfg.billing?.priceMonthlyBRL ?? 19.9}
                        onChange={(e) =>
                          setOverview((p) =>
                            p
                              ? {
                                  ...p,
                                  config: {
                                    ...p.config,
                                    billing: { ...(p.config.billing || {}), priceMonthlyBRL: Number(e.target.value) },
                                  },
                                }
                              : p
                          )
                        }
                        className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                      />
                    </div>
                    <div>
                      <div className="font-black">Price (Elsewhere) USD / month</div>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={cfg.billing?.priceMonthlyUSD ?? 4.99}
                        onChange={(e) =>
                          setOverview((p) =>
                            p
                              ? {
                                  ...p,
                                  config: {
                                    ...p.config,
                                    billing: { ...(p.config.billing || {}), priceMonthlyUSD: Number(e.target.value) },
                                  },
                                }
                              : p
                          )
                        }
                        className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-black">Watermark text</div>
                <input
                  value={cfg.branding?.watermarkText || ''}
                  onChange={(e) => setOverview((p) => (p ? { ...p, config: { ...p.config, branding: { ...(p.config.branding || {}), watermarkText: e.target.value } } } : p))}
                  className="mt-2 w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-sm outline-none"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => clear('sessions')} className="px-3 py-2 rounded-full glass-panel text-xs font-black tracking-widest uppercase">
                Clear sessions
              </button>
              <button onClick={() => clear('looks')} className="px-3 py-2 rounded-full glass-panel text-xs font-black tracking-widest uppercase">
                Clear looks
              </button>
              <button onClick={() => clear('events')} className="px-3 py-2 rounded-full glass-panel text-xs font-black tracking-widest uppercase">
                Clear events
              </button>
              <button onClick={() => clear('all')} className="px-3 py-2 rounded-full bg-red-500 text-black text-xs font-black tracking-widest uppercase">
                Clear all
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xl font-black">Recent sessions</div>
              <div className="mt-3 max-h-72 overflow-auto scroll-hide">
                <table className="w-full text-xs">
                  <thead className="text-white/50">
                    <tr><th className="text-left py-2">Time</th><th className="text-left py-2">Mode</th><th className="text-left py-2">UA</th></tr>
                  </thead>
                  <tbody>
                    {overview.recentSessions.map((s) => (
                      <tr key={s.id} className="border-t border-white/5">
                        <td className="py-2 text-white/70">{new Date(s.timestamp).toLocaleString()}</td>
                        <td className="py-2 text-white/70">{s.initialMode || '-'}</td>
                        <td className="py-2 text-white/50 truncate max-w-[240px]">{s.userAgent || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel rounded-3xl p-6">
              <div className="text-xl font-black">Recent affiliate clicks/events</div>
              <div className="mt-3 max-h-72 overflow-auto scroll-hide">
                <table className="w-full text-xs">
                  <thead className="text-white/50">
                    <tr><th className="text-left py-2">Time</th><th className="text-left py-2">Event</th><th className="text-left py-2">Details</th></tr>
                  </thead>
                  <tbody>
                    {overview.recentEvents.map((e) => (
                      <tr key={e.id} className="border-t border-white/5">
                        <td className="py-2 text-white/70">{new Date(e.timestamp).toLocaleString()}</td>
                        <td className="py-2 text-white/70">{e.event}</td>
                        <td className="py-2 text-white/50 truncate max-w-[260px]">{JSON.stringify(e.payload || {})}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 glass-panel rounded-3xl p-6">
          <div className="text-xl font-black">Recent saved looks</div>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {overview.recentLooks.map((l) => (
              <div key={l.id} className="rounded-3xl overflow-hidden border border-white/10 bg-black/40">
                <div className="aspect-square bg-black">
                  <img src={l.image} alt="look" className="w-full h-full object-cover" />
                </div>
                <div className="p-3">
                  <div className="text-xs font-black">{l.mode} — {l.mood}</div>
                  <div className="text-[10px] text-white/50 mt-1">{new Date(l.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {overview.recentLooks.length === 0 && (
              <div className="text-sm text-white/50">No saved looks yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
