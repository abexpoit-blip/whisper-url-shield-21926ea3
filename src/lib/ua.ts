// Lightweight UA parser — no external deps, edge-runtime safe.
export type UAInfo = {
  device: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  os: string;
  browser: string;
};

export function parseUA(uaRaw: string | null | undefined): UAInfo {
  if (!uaRaw) return { device: "unknown", os: "unknown", browser: "unknown" };
  const ua = uaRaw.toLowerCase();

  if (/bot|crawler|spider|facebookexternalhit|headless|curl|wget|python|scrapy/.test(ua)) {
    return { device: "bot", os: "bot", browser: "bot" };
  }

  let device: UAInfo["device"] = "desktop";
  if (/ipad|tablet|playbook|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) {
    device = "tablet";
  } else if (/mobi|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
    device = "mobile";
  }

  let os = "unknown";
  if (/windows nt 10/.test(ua)) os = "Windows 10/11";
  else if (/windows/.test(ua)) os = "Windows";
  else if (/iphone|ipad|ipod/.test(ua)) os = "iOS";
  else if (/mac os x/.test(ua)) os = "macOS";
  else if (/android/.test(ua)) os = "Android";
  else if (/linux/.test(ua)) os = "Linux";
  else if (/cros/.test(ua)) os = "ChromeOS";

  let browser = "unknown";
  if (/edg\//.test(ua)) browser = "Edge";
  else if (/opr\/|opera/.test(ua)) browser = "Opera";
  else if (/samsungbrowser/.test(ua)) browser = "Samsung Internet";
  else if (/fb_iab|fbav|instagram/.test(ua)) browser = "Facebook/IG In-App";
  else if (/chrome\//.test(ua)) browser = "Chrome";
  else if (/firefox\//.test(ua)) browser = "Firefox";
  else if (/safari\//.test(ua)) browser = "Safari";

  return { device, os, browser };
}
