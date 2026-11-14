const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "referrer",
  "source",
  "ns_campaign",
  "ns_mchannel",
  "ns_source",
  "igshid",
  "_ga",
]);

/**
 * Canonical form of an article URL for identity and display: https, lowercase host,
 * tracking parameters removed, remaining query sorted, no fragment, no trailing slash
 * on paths other than root. Returns undefined for anything that is not http(s).
 */
export function canonicalUrl(raw: string, base?: string): string | undefined {
  let u: URL;
  try {
    u = new URL(raw.trim(), base);
  } catch {
    return undefined;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase();
  u.hash = "";
  u.username = "";
  u.password = "";

  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams) {
    const key = k.toLowerCase();
    if (key.startsWith("utm_") || TRACKING_PARAMS.has(key)) continue;
    kept.push([k, v]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = "";
  for (const [k, v] of kept) u.searchParams.append(k, v);

  if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
    u.pathname = u.pathname.slice(0, -1);
  }
  return u.toString();
}
