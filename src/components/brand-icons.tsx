// Lightweight brand / device / browser / OS icon set.
// Plain functional SVG components — no helper indirection so the TSX parser
// stays happy on long path-data attributes.

import * as React from "react";
import {
  Smartphone,
  Tablet,
  Monitor,
  Bot as BotIcon,
  HelpCircle,
  Globe,
} from "lucide-react";

type IconProps = { className?: string };

const SVG: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    {children}
  </svg>
);

/* ----------------------------- OS / Platform ---------------------------- */

const ANDROID_D =
  "M17.523 15.341a1.005 1.005 0 1 1 0-2.01 1.005 1.005 0 0 1 0 2.01m-11.046 0a1.005 1.005 0 1 1 0-2.01 1.005 1.005 0 0 1 0 2.01m11.405-6.02 2.005-3.47a.418.418 0 0 0-.723-.418l-2.03 3.514a12.6 12.6 0 0 0-5.134-1.071c-1.823 0-3.557.388-5.135 1.07L4.836 5.434a.418.418 0 0 0-.723.418l2.005 3.47C2.69 11.196.4 14.738 0 18.92h24c-.4-4.182-2.69-7.724-6.118-9.598";

const APPLE_D =
  "M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25";

const WINDOWS_D =
  "M0 3.449 9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801";

const LINUX_D =
  "M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.96.96 0 0 0-.218.117c-.31.224-.467.555-.526.882-.058.327-.034.654.014.97.094.628.298 1.27.402 1.704.043.18.067.343.063.464a.776.776 0 0 1-.094.34c-.39.6-.107 1.27.302 1.604.41.334.957.464 1.5.474 1.087.018 2.27-.41 3.06-.84.79-.43 1.49-.65 2.16-.65.67 0 1.37.22 2.16.65.79.43 1.97.858 3.06.84.543-.01 1.09-.14 1.5-.474.41-.334.692-1.004.302-1.604a.776.776 0 0 1-.094-.34c-.004-.121.02-.285.063-.464.104-.434.308-1.076.402-1.704.048-.316.072-.643.014-.97-.059-.327-.216-.658-.526-.882a.96.96 0 0 0-.218-.117c.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298a6.027 6.027 0 0 0-.48-.021z";

const CHROMEOS_D =
  "M12 0a12 12 0 0 1 10.39 6H12a6 6 0 0 0-5.2 9L1.61 6A12 12 0 0 1 12 0M3.34 7.5l5.2 9a6 6 0 0 0 10.4 0L13.74 24A12 12 0 0 1 3.34 7.5M22.66 16.5A12 12 0 0 1 12 24l5.2-9A6 6 0 0 0 12 6h10.39a12 12 0 0 1 .27 10.5";

/* -------------------------------- Browsers ------------------------------- */

const FIREFOX_D =
  "M9.79.2 8.86 1.96l.61 1.06.91.5L9.21 5.4l-1.78.42-.92 1.78-1.32 4.4 1.32 2.69 1.92 1.62 2.83.9 4.13-.91 2.96-2.96.92-3.43-1.5-3.13-2.95-1.5L12 2.74 9.79.2zM3.71 9.7 1.93 12l.5 3.7 2.66 3.46 4.27 2.83 4.84.9 4.41-.91 3.43-2.27 1.65-3.39-.41-3.74-2.74 2.83-3.21 1.65-3.86.42-2.83-1.5-1.78-2.27-.21-2.18.95-1.94-2.27.46L4.9 11.07 3.71 9.7z";

const EDGE_D =
  "M21.86 17.86q.14 0 .25.12.1.13.1.25-.55 1.92-2.04 3.52T16.5 24q-1.95 0-3.66-.74-1.7-.73-2.95-2.04-1.25-1.3-1.97-3.04Q7.2 16.43 7.2 14.36q0-1.78.85-3.36t2.34-2.61q.4 4.7 4.85 8.81.6.5 1.5 1.06.91.55 1.85 1 .94.46 1.65.7.7.25 1.62.4l-.04.36q-.85 1.81-2.43 2.81-1.59 1-3.81 1-1.31 0-2.47-.43-1.16-.43-2.06-1.21-.9-.78-1.41-1.85-.51-1.07-.51-2.36 0-.79.18-1.61.17-.83.5-1.61t.83-1.5q.5-.71 1.18-1.32-.39 1.4-.39 2.93 0 1.32.47 2.45.46 1.13 1.31 1.93t2.05 1.25q1.2.45 2.66.45 1.65 0 2.91-.45 1.26-.46 2.07-1.27.81-.8 1.24-1.83.43-1.02.43-2.09 0-2.04-1.33-3.43-1.32-1.4-3.83-1.93-.13-.13-.13-.34v-.32q0-.36.27-.6.27-.25.65-.25z";

const SAMSUNG_D =
  "M22.84 12.5c0-.61-.05-1.16-.16-1.66h-9.92v3.16h5.69c-.25 1.34-1 2.47-2.13 3.22v2.69h3.46c2.04-1.88 3.06-4.66 3.06-7.41zM12.74 22.84c2.86 0 5.27-.95 7.04-2.57l-3.46-2.69c-.95.64-2.17 1.02-3.58 1.02-2.75 0-5.08-1.86-5.92-4.36H3.32v2.78c1.77 3.52 5.39 5.82 9.42 5.82zM6.82 14.24c-.21-.64-.34-1.32-.34-2.04s.13-1.4.34-2.04V7.38H3.32A10.79 10.79 0 0 0 2.16 12.2c0 1.74.41 3.39 1.16 4.82l3.5-2.78zM12.74 5.6c1.55 0 2.95.53 4.05 1.58l3.05-3.05C17.99 2.5 15.59 1.56 12.74 1.56c-4.03 0-7.65 2.31-9.42 5.82l3.5 2.78c.84-2.5 3.17-4.36 5.92-4.36z";

const FACEBOOK_D =
  "M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12";

export const AndroidIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#3DDC84" d={ANDROID_D} />
  </SVG>
);

export const AppleIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="currentColor" d={APPLE_D} />
  </SVG>
);

export const WindowsIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#00ADEF" d={WINDOWS_D} />
  </SVG>
);

export const LinuxIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="currentColor" d={LINUX_D} />
  </SVG>
);

export const ChromeOSIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#4285F4" d={CHROMEOS_D} />
  </SVG>
);

export const ChromeIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <circle cx="12" cy="12" r="4" fill="#fff" />
    <path
      fill="#EA4335"
      d="M12 2a10 10 0 0 1 8.66 5H12a5 5 0 0 0-4.33 2.5L4.42 4A10 10 0 0 1 12 2z"
    />
    <path
      fill="#34A853"
      d="M3.55 5.5 8 13a5 5 0 0 0 8.66 0L13.05 22A10 10 0 0 1 3.55 5.5z"
    />
    <path
      fill="#FBBC05"
      d="M22 12a10 10 0 0 1-9 9.95L17.33 13A5 5 0 0 0 12 7h8.66A9.97 9.97 0 0 1 22 12z"
    />
  </SVG>
);

export const FirefoxIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#FF7139" d={FIREFOX_D} />
  </SVG>
);

export const SafariIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <circle cx="12" cy="12" r="10" fill="#1B88CA" />
    <path fill="#fff" d="m15 9-6 6 2 2 6-6-2-2z" />
  </SVG>
);

export const EdgeIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#0078D7" d={EDGE_D} />
  </SVG>
);

export const SamsungIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#1428A0" d={SAMSUNG_D} />
  </SVG>
);

export const FacebookIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <path fill="#1877F2" d={FACEBOOK_D} />
  </SVG>
);

export const InstagramIcon = ({ className }: IconProps) => (
  <SVG className={className}>
    <defs>
      <linearGradient id="ig-g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="#f58529" />
        <stop offset=".5" stopColor="#dd2a7b" />
        <stop offset="1" stopColor="#515bd4" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5" fill="url(#ig-g)" />
    <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.6" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="#fff" />
  </SVG>
);

/* ------------------------------- Resolver -------------------------------- */

function norm(s: string) {
  return s.toLowerCase().replace(/[\s/_-]+/g, "");
}

export function getBrandIcon(rawKey: string): React.ComponentType<IconProps> {
  const k = norm(rawKey);

  if (k.includes("android")) return AndroidIcon;
  if (k === "ios" || k.includes("iphone") || k.includes("ipad") || k.includes("ipod")) return AppleIcon;
  if (k.includes("macos") || k === "mac") return AppleIcon;
  if (k.includes("windows")) return WindowsIcon;
  if (k.includes("chromeos")) return ChromeOSIcon;
  if (k.includes("linux")) return LinuxIcon;

  if (k.includes("facebook") || k.includes("fbiab") || k.includes("fbav")) return FacebookIcon;
  if (k.includes("instagram") || k.includes("igin")) return InstagramIcon;
  if (k.includes("chrome")) return ChromeIcon;
  if (k.includes("firefox")) return FirefoxIcon;
  if (k.includes("safari")) return SafariIcon;
  if (k.includes("edge")) return EdgeIcon;
  if (k.includes("samsung")) return SamsungIcon;
  if (k.includes("opera")) return Globe;

  if (k === "mobile") return Smartphone;
  if (k === "tablet") return Tablet;
  if (k === "desktop") return Monitor;
  if (k === "bot") return BotIcon;

  return HelpCircle;
}

export function prettyLabel(rawKey: string) {
  const k = norm(rawKey);
  if (k === "ios") return "iOS";
  if (k === "mac" || k.includes("macos")) return "macOS";
  if (k.includes("chromeos")) return "ChromeOS";
  if (k.includes("facebook") || k.includes("fbiab") || k.includes("fbav")) return "Facebook In-App";
  if (k.includes("instagram")) return "Instagram In-App";
  if (k === "unknown") return "Unknown";
  return rawKey
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/* ====================== Unified badge primitives ====================== */
// All visual marks (country flag, OS/browser/device icons, referrer favicons)
// render inside the same 20x20 chip so they share sizing, border, spacing.

const BADGE_CLASS =
  "inline-flex h-5 w-5 items-center justify-center rounded-md bg-background/70 ring-1 ring-border/60 shadow-sm shrink-0 overflow-hidden";

export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", ID: "Indonesia", TH: "Thailand", SG: "Singapore",
  IN: "India", GB: "United Kingdom", DE: "Germany", FR: "France",
  BR: "Brazil", JP: "Japan", CN: "China", RU: "Russia", CA: "Canada",
  AU: "Australia", MX: "Mexico", IT: "Italy", ES: "Spain", NL: "Netherlands",
  TR: "Turkey", BD: "Bangladesh", PK: "Pakistan", PH: "Philippines",
  VN: "Vietnam", MY: "Malaysia", KR: "South Korea", AE: "UAE", SA: "Saudi Arabia",
  EG: "Egypt", ZA: "South Africa", NG: "Nigeria", AR: "Argentina", CL: "Chile",
  HK: "Hong Kong", TW: "Taiwan", PL: "Poland", SE: "Sweden", CH: "Switzerland",
  BE: "Belgium", AT: "Austria", DK: "Denmark", FI: "Finland", NO: "Norway",
  IE: "Ireland", PT: "Portugal", GR: "Greece", CZ: "Czech Republic",
  RO: "Romania", HU: "Hungary", IL: "Israel", NZ: "New Zealand",
  CO: "Colombia", PE: "Peru", VE: "Venezuela", UA: "Ukraine",
};

export function CountryFlag({ cc, className }: { cc: string; className?: string }) {
  const up = (cc || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) {
    return (
      <span className={`${BADGE_CLASS} ${className ?? ""}`}>
        <Globe className="h-3 w-3 text-muted-foreground" />
      </span>
    );
  }
  const lo = up.toLowerCase();
  return (
    <span className={`${BADGE_CLASS} ${className ?? ""}`}>
      <img
        src={`https://flagcdn.com/w40/${lo}.png`}
        srcSet={`https://flagcdn.com/w80/${lo}.png 2x`}
        alt={up}
        width={20}
        height={15}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

export function BrandBadge({ name, className }: { name: string; className?: string }) {
  const Icon = getBrandIcon(name);
  return (
    <span className={`${BADGE_CLASS} ${className ?? ""}`}>
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}

export function ReferrerFavicon({ host, className }: { host: string; className?: string }) {
  const h = (host || "").toLowerCase().trim();
  if (!h || h === "direct" || h === "unknown") {
    return (
      <span className={`${BADGE_CLASS} ${className ?? ""}`}>
        <Globe className="h-3 w-3 text-primary" />
      </span>
    );
  }
  const domain = h.replace(/^www\./, "").split("/")[0];
  return (
    <span className={`${BADGE_CLASS} ${className ?? ""}`}>
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(domain)}`}
        alt={domain}
        width={16}
        height={16}
        loading="lazy"
        className="h-4 w-4"
      />
    </span>
  );
}

export function prettyReferrer(host: string) {
  const h = (host || "").toLowerCase().trim();
  if (!h || h === "direct") return "Direct";
  if (h === "unknown") return "Unknown";
  return h.replace(/^www\./, "");
}
