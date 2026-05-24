# Advanced Bot Filter + Smart Routing System

আপনার select করা ৮টা feature implement করব ৩ phase-এ। সব backend logic redirect server function-এ থাকবে যাতে high traffic (50L+/day) handle হয়।

## Phase 1 — Bot Detection Layer (Day 1-2)

### 1. TLS/JA3 Fingerprinting + Header Analysis
- Cloudflare Worker / Nginx থেকে `cf-ja3`, `User-Agent`, `Accept`, `Accept-Language`, `Accept-Encoding`, `Sec-CH-UA` headers check
- Headless browser signatures (Puppeteer, Playwright, PhantomJS, Selenium) detect
- Mismatched UA + TLS combo = bot flag
- Header order anomaly check (real browsers এর specific order থাকে)

### 2. Referrer Validation
- `document.referrer` + `Referer` header check
- Whitelist: Facebook, Instagram, Twitter, Telegram, WhatsApp, TikTok, Google
- Direct hit (no referrer) = suspicion score +30
- Search engine bot referrer = instant bot
- New table: `referrer_rules` (pattern, trust_score, action)

### 3. Cloaking (FB/Google reviewer detection)
- Known reviewer IPs/ASN list: Facebook Crawler (AS32934), Google (AS15169), Bing, Yandex
- `User-Agent` contains "facebookexternalhit", "Googlebot", "AdsBot", "bingbot" → safe page
- Reverse DNS lookup cache (Redis-like in-memory)
- New `cloaking_rules` table: ip_range, ua_pattern, asn, action

### 4. Bot Pattern Learning (auto-blacklist)
- Each click stores: `fingerprint_hash` (IP+UA+screen+TZ hash)
- New table: `bot_fingerprints` (hash, hit_count, first_seen, last_seen, auto_blocked)
- Trigger: যদি same fingerprint 3+ বার bot detect হয় → auto add to blacklist
- Background job (pg_cron): hourly aggregate

## Phase 2 — Smart Routing (Day 2-3)

### 5. GEO-Targeting (Tier-based offers)
- IP → country detection (CF-IPCountry header, free)
- New table: `geo_offers` (link_id, tier, country_codes[], offer_url, weight)
- Tier-1: US, UK, CA, AU, DE, FR (high pay)
- Tier-2: BR, MX, IN, ID, TR (medium)
- Tier-3: rest (low / fallback)
- Per-link override possible

### 6. A/B Testing
- New table: `ab_variants` (link_id, variant_label, offer_url, weight_pct, clicks, conversions)
- Redirect logic: weighted random pick
- Sticky session (cookie 24hr) যাতে same user same variant পায়
- Dashboard: CTR comparison chart

## Phase 3 — Analytics (Day 3-4)

### 7. Real-time Dashboard
- Live click feed (Supabase Realtime subscription on `clicks` table)
- Bot % gauge (last 1hr / 24hr / 7d)
- Country world map (using react-simple-maps)
- Top links, top countries, peak hours chart
- Revenue estimate (clicks × CPM placeholder)
- Auto-refresh every 5 sec

### 8. Cohort Analysis (Traffic Quality)
- Group clicks by `referrer_source` (FB/Google/Direct/Telegram/etc.)
- Metrics per cohort: total clicks, bot %, conversion %, avg session
- 7-day retention curve per source
- Identify best-quality source

---

## Database Schema Changes

New tables:
- `referrer_rules` — pattern, trust_score, action
- `cloaking_rules` — ip_range/ua/asn pattern, action  
- `bot_fingerprints` — hash, hit_count, auto_blocked
- `geo_offers` — link_id, tier, countries, url, weight
- `ab_variants` — link_id, label, url, weight, stats
- `click_analytics` (materialized view) — hourly aggregates for fast dashboard

Updated `clicks` table — add columns:
- `fingerprint_hash` (text)
- `referrer_source` (text)
- `country_tier` (int)
- `ab_variant` (text)
- `ja3_hash` (text, nullable)

## Tech Stack
- **Redirect endpoint**: TanStack server route at `/api/r/$shortCode` — already exists, will extend
- **Realtime**: Supabase Realtime (self-host এ enabled)
- **Maps**: react-simple-maps (lightweight, no API key)
- **Charts**: recharts (already in shadcn)
- **GeoIP**: CF-IPCountry header (free, accurate)

## High-Traffic Optimization
- Click insert: batch via queue (every 2 sec flush)
- Fingerprint lookup: in-memory LRU cache (10k entries)
- Materialized view refresh: every 5 min via pg_cron
- Index on `clicks(link_id, created_at DESC)`, `clicks(fingerprint_hash)`

---

## Build Order
1. DB migration (all 6 new tables + clicks columns + indexes)
2. Bot detection module (`src/lib/bot-detect.ts`)
3. Redirect server route extend (cloaking → bot check → geo route → A/B pick)
4. Admin pages: `/admin/cloaking`, `/admin/geo-offers`, `/admin/ab-tests`, `/admin/bot-blacklist`
5. Real-time dashboard `/dashboard/live`
6. Cohort analysis `/dashboard/cohorts`

প্রতি phase complete হলে deploy command দিব।

---

## প্রশ্ন

1. **IP Geolocation** — Cloudflare free CF-IPCountry use করব নাকি MaxMind DB download? (CF free + accurate, recommend)
2. **A/B variant default count** — প্রতি link-এ max কতগুলো variant allow? (2-5 suggest)
3. **Cohort source detection** — শুধু referrer header, নাকি UTM params (`utm_source`) ও support?
4. **Bot auto-block threshold** — কতবার detect হলে permanent block? (default 3 suggest)

Approve করলে Phase 1 দিয়ে শুরু করি।