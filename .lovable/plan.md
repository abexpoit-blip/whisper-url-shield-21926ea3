
# Smart URL Shortener SaaS — Phase 1 MVP

## Overview
A SaaS URL shortener platform where users sign up, buy a package, and create short links for Facebook/Instagram ad boosting. Includes bot filtering, click analytics, and admin panel.

## What We Build Now (Phase 1 — Lovable)

### 1. Landing Page (`/`)
- Hero section: headline, value proposition, CTA
- Features section: 3-4 key features with icons
- Pricing section: 3 packages (Starter/Pro/Agency)
- Footer with links

### 2. Auth System
- Enable Lovable Cloud (database + auth)
- User signup/login (Email + Google)
- Password reset flow
- User profiles table

### 3. Database Schema
- `profiles` — user info, plan type, link quota
- `links` — short URLs, destination, created_by, status
- `clicks` — click tracking (IP, country, device, bot_score, timestamp)
- `packages` — plan details (name, price, link_limit)
- `subscriptions` — user subscription status

### 4. User Dashboard (`/_authenticated/dashboard`)
- Create new short link (paste long URL → get short link)
- Link list with stats (clicks, last click, status)
- Copy link button, delete link
- Basic analytics per link (click chart, top countries, device split)
- Account usage bar (50/50 links used)

### 5. Link Redirect System (`/r/$code`)
- Public route — no auth needed
- Lookup short code → get destination URL
- Log click data (IP, user-agent, referer, country)
- Basic bot detection (user-agent check, known bot IPs)
- Bot → show neutral "Loading..." page
- Real user → redirect to destination

### 6. Pricing & Payments
- Pricing page with 3 tiers
- Stripe integration (built-in Lovable payments)
- After payment → update user plan + quota

### 7. Admin Panel (`/_authenticated/admin`)
- Total users, total links, total clicks stats
- User list with plan info
- Revenue overview
- Ability to ban/suspend users

### 8. Design Direction
- Modern, dark-themed SaaS aesthetic
- Dashboard with clean cards and charts
- Mobile responsive

## Technical Details

### Stack
- TanStack Start (already configured)
- Lovable Cloud (Supabase) for DB + Auth
- Stripe for payments (built-in)
- Server functions for link redirect + bot check
- Recharts for analytics charts

### Route Structure
```
src/routes/
├── index.tsx              (landing page)
├── login.tsx              (login)
├── signup.tsx             (signup)
├── pricing.tsx            (pricing page)
├── r.$code.tsx            (redirect handler)
├── _authenticated.tsx     (auth guard)
├── _authenticated/
│   ├── dashboard.tsx      (user dashboard)
│   ├── links.$id.tsx      (single link analytics)
│   └── admin.tsx          (admin panel)
```

### Security
- RLS on all tables (users see only their own data)
- Admin role table (separate from profiles)
- Rate limiting on link creation
- Input validation with Zod

## What We Skip for Now
- Custom domain support (Phase 2)
- IPQualityScore API integration (Phase 2, basic UA check for now)
- Pre-lander builder (Phase 3)
- API access (Phase 3)
- White-label (Phase 3)
- VPS migration (Phase 3)

## Deployment
- Test on Lovable preview URL (free)
- Publish on lovable.app when ready
- Add custom domain later ($12/yr)
