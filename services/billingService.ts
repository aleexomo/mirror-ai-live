import { getBackendUrl } from "./geminiService";

export type CheckoutMethod = "card" | "pix";

export async function createCheckout(
  method: CheckoutMethod,
  opts: { country?: string; lang?: string; reason?: string } = {}
): Promise<{ url: string }> {
  const base = getBackendUrl();
  if (!base) throw new Error("Missing VITE_BACKEND_URL");

  const res = await fetch(`${base}/api/billing/create-checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, ...opts }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Checkout failed");
  }
  return { url: data.url };
}
