# 🚀 B.A.S Sangha — Vercel এ Deploy করার Guide

**App er সব code Vercel-ready করা হয়ে গেছে।** নিচের ৪টা step follow করলেই
আপনার ক্লাব অ্যাপ live হয়ে যাবে — সব free tier দিয়ে।

| Service | কাজ | Cost |
|---|---|---|
| **GitHub** | Code রাখার জায়গা | Free |
| **Turso** | Database (SQLite-compatible, hosted) | Free (9 GB) |
| **Vercel** | App hosting + HTTPS | Free (Hobby) |
| **Firebase** | Push notification (already configured) | Free |

---

## ✅ যা যা কোডে fix করা হয়েছে (Vercel-ready changes)

Vercel এর server **disk লিখা যায় না** (read-only/ephemeral) — তাই:

1. **Database** — Prisma এখন Turso (libSQL) support করে:
   - `src/lib/db.ts` — `DATABASE_URL` যদি `libsql://` হয়, official
     `@prisma/adapter-libsql` driver adapter নিজে থেকেই use হয়
   - Local dev আগের মতোই `file:` SQLite দিয়ে চলবে — কোনো কিছু বদলাতে হবে না
2. **Photo/Document upload** — আগে disk এ (`uploads/` ফোল্ডারে) save হতো,
   এখন **database এর ভিতরে** (new `StoredFile` table, base64) save হয়।
   URL একই আছে: `/api/files?name=...` — কোনো UI change লাগেনি।
   পুরনো ৬টা file ও database এ migrate করা হয়েছে।
3. **CSP security header** — Firebase push notification এর Google endpoints
   allow করা হয়েছে (`connect-src`), নাহলে production এ push কাজ করত না
4. **Build script** — `package.json` এ `build` এখন plain `next build`,
   `postinstall: prisma generate` add করা হয়েছে (Vercel এর জন্য দরকার)
5. **`.env.example`** — সব environment variable এর template commit-ready

---

## Step 1 — GitHub এ code তুলুন

### 1a. GitHub এ নতুন **Private** repository বানান
- https://github.com/new → Name: `bas-sangha` → **Private** ✓ → Create

### 1b. Local machine (বা sandbox) থেকে push করুন
```bash
cd /home/z/my-project
# git repo আগে থেকেই আছে — শুধু remote add করুন:
git remote add origin https://github.com/<your-username>/bas-sangha.git
git add -A
git commit -m "B.A.S Sangha - Vercel ready"
git push -u origin main
```

> **Token কীভাবে বানাবেন:** GitHub → Settings → Developer settings →
> Personal access tokens → **Tokens (classic)** → Generate new token →
> `repo` scope ✓ → token টা password এর জায়গায় দিন।

⚠️ **Secret গুলো নিয়ে চিন্তা নেই** — `.env`, `db/`, `uploads/` সব `.gitignore`
এ আছে, push হবে না। শুধু `.env.example` (placeholder) যাবে।

---

## Step 2 — Turso তে Database বানান

### 2a. Account + CLI
```bash
# Sign up: https://turso.tech (GitHub account দিয়ে login করা যায়)
# CLI install:
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
```

### 2b. Database তৈরি করুন
```bash
turso db create bas-sangha
turso db show bas-sangha --url          # → DATABASE_URL
turso db tokens create bas-sangha       # → DATABASE_AUTH_TOKEN
```
দুটো value clipboard এ রাখুন।

### 2c. Project এ `.env` এ সাময়িকভাবে Turso URL বসিয়ে schema push করুন
```bash
cd /home/z/my-project
# .env file এ এই দুই line add করুন (আগের DATABASE_URL মুছে):
# DATABASE_URL="libsql://bas-sangha-<yourname>.turso.io"
# DATABASE_AUTH_TOKEN="<token>"

node scripts/turso-push.mjs        # schema (সব table) তৈরি হবে
node scripts/seed-content.mjs      # banner/event/committee/settings seed হবে
```

✅ **Verify:** `turso db shell bas-sangha "SELECT count(*) FROM User;"` চালালে
error না দেখিয়ে কাজ করবে। (User table খালি থাকবে — admin পরে বানাবেন।)

> **মনে রাখবেন:** আপনার local database এর user/request/donation data
> production এ যাবে **না** (ওগুলো personal data)। শুধু public content
> (banner, event, committee, notice, UPI settings) seed হয়।

---

## Step 3 — Vercel এ Deploy করুন

### 3a. Import
1. https://vercel.com/new → **Continue with GitHub**
2. `bas-sangha` repository **Import** করুন
3. Framework auto-detect হবে: **Next.js** ✓

### 3b. Environment Variables (এটাই সবচেয়ে জরুরি step!)

Deploy করার আগেই **Environment Variables** section এ এই ১১টা add করুন:

| Name | Value | কোথায় পাবেন |
|---|---|---|
| `DATABASE_URL` | `libsql://bas-sangha-....turso.io` | Step 2b |
| `DATABASE_AUTH_TOKEN` | (Turso token) | Step 2b |
| `AUTH_SECRET` | আপনার local `.env` থেকে copy | `.env` file |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | local `.env` থেকে copy | `.env` file |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 〃 | 〃 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | 〃 | 〃 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 〃 | 〃 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 〃 | 〃 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 〃 | 〃 |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | 〃 | 〃 |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 〃 (লম্বা base64 line) | 〃 |

> 💡 সোজা উপায়: local `.env` file খুলে প্রতিটা line এর value Vercel এ paste
> করুন — শুধু `DATABASE_URL` টা Turso ওয়ালা দিন আর `DATABASE_AUTH_TOKEN` add করুন।

### 3c. Deploy
**Deploy** button → ২-৩ মিনিট → 🎉 `https://bas-sangha.vercel.app` live!

---

## Step 4 — Production এ Admin বানান (প্রথমবার)

নতুন database এ কোনো user নেই। Signup করে প্রথম user কে admin বানাতে হবে:

1. App খুলে সাধারণ signup করুন (আপনার admin email দিয়ে)
2. Turso shell দিয়ে role বদলান:
```bash
turso db shell bas-sangha "UPDATE User SET role='ADMIN' WHERE email='<your-admin-email>';"
```
3. এবার ওই account দিয়ে login করলেই Admin Panel পাবেন ✓
4. **জরুরি:** Admin → **Settings** এ গিয়ে `resetCode` সেট করুন (নতুন secret
   code — এটা ছাড়া production এ admin password reset কাজ করবে না। code টা
   কারও সাথে share করবেন না, GitHub এও দেবেন না)

---

## ✅ Deploy-এর পরে যা check করবেন

- [ ] Home page load হয়, banner/committee photo দেখা যাচ্ছে (`/api/files` DB থেকে serve হচ্ছে)
- [ ] Admin login কাজ করছে
- [ ] Admin → যেকোনো image upload → দেখা যাচ্ছে (database এ save হচ্ছে)
- [ ] More → Notifications toggle **ON** → browser permission allow → toast আসছে
- [ ] Admin → Push Send tab → "Server Connected: **YES**", Registered Devices বাড়ছে
- [ ] Push Send দিয়ে test notification পাঠান → phone/browser এ এলো ✓
- [ ] Donation flow + UTR submit কাজ করছে

কোনোটা fail করলে নিচের Troubleshooting দেখুন।

---

## 🔧 Troubleshooting

| সমস্যা | কারণ ও সমাধান |
|---|---|
| Deploy fail — `prisma generate` error | Vercel env vars এ `DATABASE_URL` missing। Step 3b আবার check করুন |
| 500 error সব API তে | `DATABASE_URL`/`DATABASE_AUTH_TOKEN` ভুল — Turso dashboard থেকে আবার copy করুন |
| Image 404 | Production DB তে `StoredFile` খালি — পুরনো image গুলো production এ নিতে হলে admin panel থেকে আবার upload করুন |
| Content খালি (banner/event নেই) | Step 2c এর `seed-content.mjs` চালাননি |
| Push কাজ করছে না | ① Browser HTTPS এ আছে ✓ (Vercel automatic) ② Vercel env এ `NEXT_PUBLIC_FIREBASE_VAPID_KEY` + `FIREBASE_SERVICE_ACCOUNT_KEY` আছে কিনা দেখুন ③ পরিবর্তনের পর **Redeploy** করুন |
| Login কাজ করছে না | `AUTH_SECRET` Vercel এ missing/ভুল |
| Rate limit | প্রতি serverless instance এ আলাদা — spam protection কাজ করছে, এটা স্বাভাবিক |

## 📝 দরকারী কমান্ড (পরে কাজে লাগবে)

```bash
# Local এ content বদলানোর পর production এ পাঠানো:
bun scripts/export-content.mjs
git add prisma/seed-content.json && git commit -m "update content" && git push
# তারপর Vercel redeploy হবে automatically — content এখনও seed করতে হবে:
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." node scripts/seed-content.mjs

# Schema change করলে (schema.prisma edit এর পরে):
bun run db:push                                    # local
DATABASE_URL="libsql://..." DATABASE_AUTH_TOKEN="..." node scripts/turso-push.mjs   # production

# নতুন admin বানাতে:
turso db shell bas-sangha "UPDATE User SET role='ADMIN' WHERE email='...';"
```
