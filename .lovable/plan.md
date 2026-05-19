## লক্ষ্য

1. পুরনো admin (`clicktaka@mailum.com`) সম্পূর্ণ মুছে ফেলা
2. `/login` থেকে admin redirect/check logic পুরোপুরি সরানো — admin শুধু `/control-panel` দিয়ে ঢুকবে
3. পুরো অ্যাপ "click → instant response" feel দেওয়ার জন্য বড় performance pass

---

## Part 1 — পুরনো admin user মুছে ফেলা

Migration দিয়ে cascading delete:
- `public.user_roles` থেকে user_id = `0cde9c89-...` row
- `public.profiles` থেকে সংশ্লিষ্ট row
- `auth.users` থেকে `clicktaka@mailum.com` row (auth admin delete)

নতুন admin `admin@sleepox.com` অক্ষত থাকবে।

---

## Part 2 — /login থেকে admin logic সরানো

`src/routes/login.tsx`:
- `getIsAdmin` import + `useServerFn(getIsAdmin)` সরাও
- session থাকলে যে `checkAdmin()` call হয় + `signOut()` block — সব সরাও
- submit flow থেকে post-login admin check সরাও
- ফলাফল: `/login` সাধারণ user-এর জন্য একদম clean, কোনো extra server round-trip নেই (এতে login itself দ্রুত হবে)

Admin login একমাত্র path হবে `/control-panel` (যা ইতিমধ্যে আছে)।

---

## Part 3 — Performance optimization (সবচেয়ে বড় কাজ)

### 3a. Admin dashboard (`/admin`)
- `getAdminAdvancedStats` কে split করে দুই serverFn করব: `getAdminCoreStats` (KPI cards — instantly) + `getAdminTrends` (charts + lists — পরে load)
- React Query দিয়ে `staleTime: 60s`, parallel `useQueries`
- KPI cards আগে দেখাবে, trends/lists pending হলে skeleton

### 3b. User dashboard (`/dashboard`)
- বর্তমান code পড়ে দেখব — সম্ভবত প্রতিবার পুরো links list fetch হচ্ছে
- React Query cache + `staleTime: 30s`, pagination/limit যোগ
- N+1 query থাকলে single join-এ আনব

### 3c. Public redirect `/r/:code` (সবচেয়ে critical — ad traffic-এর latency এখানেই)
- `resolveLink` serverFn audit করব: rule lookups parallel করা, unnecessary select * → specific columns
- DB indexes ইতিমধ্যে যোগ করা আছে — query plan ব্যবহার নিশ্চিত করব
- prelander variant fetch cache (Worker memory cache, 60s)

### 3d. App-wide
- `QueryClient` defaults: `staleTime: 30_000`, `refetchOnWindowFocus: false`, `retry: 1`
- Heavy admin routes lazy-load (route-level code split আগে থেকেই হয়, কিন্তু component-level charts dynamic import করব)
- `__root.tsx`-এ unused providers/scripts থাকলে সরাব

---

## কী delete হবে না

- নতুন admin `admin@sleepox.com`
- `/control-panel` route
- `/admin/*` pages
- কোনো user data বা links

---

## ডেলিভারি ক্রম

1. Migration: পুরনো admin delete
2. `login.tsx` সরল করা
3. `getAdminCoreStats` + `getAdminTrends` split + admin index refactor
4. QueryClient defaults + dashboard tune
5. `resolveLink` audit + cache

প্রতি backend change এর পরে deploy + log check command দেওয়া হবে (memory rule অনুযায়ী)।