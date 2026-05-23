## আসল লক্ষ্য (আপনার কথা থেকে)

একটা **lightweight, fast, user-friendly SaaS** — যেখানে users sign up করে payment দিয়ে Facebook Ads এর জন্য cloaked redirect links বানাবে → Adsterra Direct Link এ যাবে। পুরনো codebase এর কোনো কিছুই রাখা হবে না।

**Core principle এবার:** "যা দরকার নেই, সেটা থাকবে না।" Less code = less bugs = fast deploy।

---

## ১) Confirmed Requirements

- ✅ **Wipe everything** — VPS, DB, GitHub সব fresh
- ✅ **Multi-user SaaS** (signup + login + payment + quota)
- ✅ **Per user 1 Adsterra direct link** (simple, no geo/device rotation)
- ✅ **Fresh short codes** (পুরনো ah73m6 ইত্যাদি রাখা হবে না)
- ✅ **Admin:** `admin@sleepox.com`, domain `sleepox.com`
- ✅ **Self-hosted Supabase** + GitHub → VPS deploy
- ❌ Google Ads, TikTok Ads, heavy analytics, recharts, Lovable Cloud — সব বাদ

---

## ২) Final Scope (যা যা থাকবে — শুধুমাত্র এগুলো)

**User-facing (login দিয়ে):**
1. Signup / Login (email+password)
2. Dashboard — শুধু একটা link create করার form: Adsterra Direct Link URL + safe URL
3. Short link copy (`sleepox.com/r/abc123`)
4. Simple stats: total clicks, human clicks, bot clicks (number only, no chart)
5. Upgrade page — package list + Plisio crypto pay button
6. Profile / logout

**Admin (`admin@sleepox.com`):**
7. All users list, ban/unban
8. All links list
9. Pending upgrade requests → approve/reject
10. Packages edit (price, click quota)

**Public:**
11. `/` — generic safe landing page (Facebook reviewer safe)
12. `/r/:code` — cloaking redirect (bot → safe, human → Adsterra)
13. `/login`, `/signup`, `/pricing`

**That's it. আর কিছু না।**

---

## ৩) Database (মাত্র ৬টা table — পুরনো ২৫+ থেকে কমানো)

```text
profiles          id, email, plan_slug, click_quota, clicks_used, is_banned, is_admin
links             id, user_id, short_code, adsterra_url, safe_url, is_active,
                  clicks_count, bot_clicks_count, created_at
clicks            id, link_id, ip, country, ua, is_bot, bot_reason, created_at
packages          id, slug, name, price_usd, click_quota, link_limit, is_active
upgrade_requests  id, user_id, package_slug, plisio_invoice_id, status, amount
bot_rules         id, type (ua|asn|ip), pattern, action, is_active   -- admin managed
```

পুরনো এই table গুলো **থাকবে না**: link_geo_rules, link_device_rules, link_time_rules, link_variant_overrides, link_variant_tests, link_destinations, prelander_variants, custom_domains, domain_health_checks, fb_asn_blocklist (merge into bot_rules), referer_rules (merge into bot_rules), shared_domains, ad_rotation_config, duplicate_clicks, plisio_webhook_retry_queue, plisio_activity_log, admin_audit_logs। একটা table এ যা হয়, সেটাই থাকবে।

---

## ৪) Tech Stack — Lightweight First

| Layer | Choice |
|---|---|
| Framework | TanStack Start (same) |
| UI | Tailwind + shadcn (শুধু button, input, card, dialog — ১০টার বেশি না) |
| Charts | ❌ কোনো chart library না, plain number |
| Server | Single PM2 process, Node 20, no wrangler dev mode bloat |
| DB | Self-hosted Supabase (existing instance reuse, schema reset) |
| Payment | Plisio (crypto) — 1 file |
| Deploy | `git pull && bun i && bun run build && pm2 restart` |

**Removed for speed:** recharts, framer-motion (use CSS), heavy icons, multi-variant prelander system, geo/device/time rule engines, duplicate-click table, audit-logs, retry-queue cron.

Expected bundle: পুরনো ~500KB JS থেকে **<150KB** এ নামবে।

---

## ৫) Build Phases (একসাথে সব না, যাচাই করে এগোবো)

### Phase 1 — Foundation (এই turn এই শুরু)
- পুরো `src/` মুছে clean shell (root + index + login