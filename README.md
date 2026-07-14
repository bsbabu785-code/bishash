# বিশ্বাস হালুয়া — Full System

তিনটি অংশ:
- `frontend/` — ল্যান্ডিং পেজ (`index.html`)
- `admin_panel/` — এডমিন প্যানেল (`admin.html`)
- `backend/` — Node/Express + MongoDB + Cloudinary API
- `apps_script/` — Gmail নোটিফিকেশনের জন্য Google Apps Script

## ১. Backend (Render)

```
cd backend
npm install
cp .env.example .env    # সব ভ্যারিয়েবল পূরণ করুন
npm start
```

### Render deploy
1. GitHub-এ `backend/` push করুন
2. Render → New Web Service → Build: `npm install`, Start: `npm start`
3. Environment tab-এ `.env.example`-এর সব KEY বসান
4. URL কপি করুন (যেমন `https://bishash-backend.onrender.com`)

## ২. Apps Script (ইমেইল নোটিফিকেশন)

1. https://script.google.com → New project
2. `apps_script/Code.gs`-এর কনটেন্ট পেস্ট করুন
3. Deploy → New deployment → Type: Web app
   - Execute as: **আপনি (bsbabu785@gmail.com)**
   - Who has access: **Anyone**
4. `/exec` URL কপি করে backend `.env` → `APPS_SCRIPT_URL` এ বসান
5. Render → Environment এ একই URL সেট করুন

অর্ডার এলে বিস্তারিতসহ ইমেইল যাবে `bsbabu785@gmail.com` এ।

## ৩. Frontend (Vercel)

1. `frontend/index.html` খুলে শেষে থাকা script-এ:
   ```js
   const API = 'https://bishash-backend.onrender.com';   // Render URL বসান
   ```
2. Vercel → New Project → `frontend/` folder deploy
3. `vercel.json` অটো cache header দিবে

## ৪. Admin Panel (Vercel — আলাদা প্রজেক্ট)

1. `admin_panel/` folder Vercel-এ deploy করুন
2. প্রথম লগইন-এর পর সেটিংস → **Backend API URL** বসান (Render URL)
3. ডিফল্ট লগইন: `admin` / `admin123` (backend `.env` থেকে পরিবর্তন করুন)

## ফিচার ম্যাপ

| এডমিন সেকশন | কী কী করে |
|---|---|
| ড্যাশবোর্ড | মোট/আজ/pending/confirmed/delivered অর্ডার, সাপ্তাহিক chart, best selling |
| অর্ডার | সব অর্ডার list, search/filter, edit/delete, স্ট্যাটাস পরিবর্তন |
| পণ্য | পণ্য যোগ/এডিট/ডিলিট, Cloudinary ইমেজ, স্টক, price |
| গ্রাহক | অর্ডার থেকে aggregated |
| কুপন | percent/flat কুপন CRUD, `/api/coupons/validate` public |
| পেমেন্ট | bKash/Nagad নম্বর, পেমেন্ট মেথড অনুযায়ী রিপোর্ট |
| রিভিউ | Cloudinary ইমেজসহ রিভিউ CRUD → index.html-এ show |
| ওয়েবসাইট কনটেন্ট | Hero টেক্স+ইমেজ, **YouTube on/off toggle**, benefits, contact, social, delivery |
| সেটিংস | Backend API URL কনফিগ |

## গুরুত্বপূর্ণ

- সব ইমেজ Cloudinary-তে যাবে (এডমিন থেকে আপলোড → automatic)
- সব ডেটা MongoDB Atlas-এ থাকবে
- অর্ডার এলে দুই জায়গায় saved হবে: (১) MongoDB (২) `bsbabu785@gmail.com` এ ইমেইল
- ইউটিউব সেকশন এডমিন থেকে on/off করা যাবে
- ল্যান্ডিং পেজ preconnect + Cloudinary CDN + fonts optimized → দ্রুত লোড

## সিকিউরিটি

- আপলোড করা `.env` এর সব সিক্রেট চ্যাটে expose হয়েছে — Atlas password ও Cloudinary secret এখনই regenerate করুন।
- `.env` কখনো git-এ push করবেন না।
- Production-এ `ADMIN_PASSWORD` ও `JWT_SECRET` অবশ্যই strong random string দিন।
