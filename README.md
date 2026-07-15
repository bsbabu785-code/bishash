# Bishash Halua — Project

```
BISHASH/
├── admin_panel/
│   ├── admin.html
│   └── vercel.json
├── backend/
│   ├── .env
│   ├── package.json
│   └── server.js
├── frontend/
│   └── index.html
├── render.yaml
├── .gitignore
└── README.md
```

## ⚠️ জরুরি: আপনার সিক্রেট এখনই বদলান

`backend/.env` ফাইলে যে MongoDB পাসওয়ার্ড, JWT secret, আর Cloudinary secret আছে —
এগুলো ফাইলে প্লেইন টেক্সটে ছিল এবং এই চ্যাটেও পেস্ট হয়েছে, তাই এগুলোকে এখন থেকে
**exposed (ফাঁস হওয়া)** ধরে নেওয়া উচিত, আগে কোথাও পুশ হয়ে থাকুক বা না থাকুক। ডিপ্লয়
করার আগে অবশ্যই:

1. **MongoDB Atlas** → Database Access → ইউজার পাসওয়ার্ড regenerate করুন, নতুন
   connection string বসান।
2. **Cloudinary** → Settings → Security → API secret regenerate করুন।
3. **JWT_SECRET** → যেকোনো নতুন র‍্যান্ডম স্ট্রিং বসান (regenerate করলে পুরনো সব
   admin login token invalid হয়ে যাবে, যা কাঙ্ক্ষিত)।
4. নতুন মানগুলো **কোড ফাইলে নয়, শুধু Render-এর Environment Variables ড্যাশবোর্ডে**
   বসান। `backend/.env` শুধু লোকাল ডেভেলপমেন্টের জন্য, এটা কখনো GitHub-এ পুশ হবে
   না (`.gitignore`-এ `.env` আছে ✅)।

## লগইন ও অর্ডার কাজ না করার সম্ভাব্য কারণ

কোডে (server.js, admin.html, index.html) লজিক নিজে ঠিকই আছে — `admin.html` এবং
`index.html` দুটোই `https://bishash-1.onrender.com`-কে backend ধরে fetch করে। আমি
লাইভ সার্ভারটা এই পরিবেশ থেকে টেস্ট করতে পারিনি (নেটওয়ার্ক অ্যাক্সেস নেই), তাই
Render ড্যাশবোর্ডে গিয়ে নিচেরগুলো চেক করুন — প্রায় সবসময় এই কারণগুলোর একটাতেই
সমস্যা হয়:

### ১. Render-এ Environment Variables সেট আছে কিনা
`render.yaml`-এ সব env var `sync: false` করে রাখা মানে Render নিজে থেকে এগুলো
বসাবে না — Render Dashboard → আপনার সার্ভিস → Environment ট্যাবে গিয়ে
`MONGODB_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
`ALLOWED_ORIGINS`, `CLOUDINARY_*`, `APPS_SCRIPT_URL`, `NOTIFY_EMAIL` — সবগুলো
হাতে বসাতে হবে। কোনো একটা মিসিং থাকলে login/order fail করবে।

### ২. `ALLOWED_ORIGINS` আপনার আসল ডোমেইনের সাথে না মিললে (CORS)
`.env`-এ এখন আছে:
```
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,https://bishash-5o21.vercel.app,https://bishash-v85c.vercel.app
```
আপনার admin panel আর frontend যেই আসল Vercel URL-এ deploy হয়েছে, সেটা যদি এই
লিস্টে না থাকে, ব্রাউজার CORS error দিয়ে রিকোয়েস্ট ব্লক করবে — লগইন ফর্মে তখন
"Failed to fetch" এর মতো একটা এরর দেখাবে। Vercel-এ deploy করার পর আসল URL কপি
করে Render-এর `ALLOWED_ORIGINS`-এ যোগ করুন (কমা দিয়ে আলাদা করে), তারপর সার্ভিস
redeploy/restart করুন।
> এই আপডেটেড `server.js`-এ এখন CORS ব্লক হলে Render লগে ঠিক কোন origin ব্লক
> হয়েছে সেটা print হবে (`⚠️ CORS blocked origin "..."`), তাই Render → Logs
> দেখলেই বোঝা যাবে সমস্যাটা এটাই কিনা।

### ৩. MongoDB Atlas Network Access
Atlas-এ Network Access লিস্টে `0.0.0.0/0` (allow from anywhere) যোগ করা আছে কিনা
দেখুন — না থাকলে Render থেকে DB কানেকশন রিফিউজ হবে, `/api/orders` তখন
`503 Database unavailable` রিটার্ন করবে (অ্যাডমিন লগইন তখনও কাজ করবে, কারণ
লগইন DB ছাড়াই কাজ করে — তাই "লগইন হয় না, অর্ডারও হয় না" দুটো একসাথে হলে এটাই
প্রথম সন্দেহভাজন)।

### ৪. Render Free Plan Cold Start
Free plan-এ সার্ভিস কিছুক্ষণ ব্যবহার না হলে ঘুমিয়ে পড়ে; প্রথম রিকোয়েস্টে
৩০–৬০ সেকেন্ড সময় লাগতে পারে এবং সেই সময় fetch টাইমআউট/এরর দেখাতে পারে। দ্বিতীয়বার
চেষ্টা করলে কাজ করে কিনা দেখুন।

### ৫. Admin ইউজারনেম/পাসওয়ার্ড
`ADMIN_USERNAME`/`ADMIN_PASSWORD` Render-এ যা সেট করা আছে সেটাই টাইপ করছেন কিনা
নিশ্চিত করুন (কোডে ফলব্যাক ডিফল্ট `admin` / `admin123`, কিন্তু production-এ এটা
বদলে রাখাই ভালো — env var সেট থাকলে সেটাই ব্যবহার হবে)।

### দ্রুত টেস্ট করার উপায়
ব্রাউজারে সরাসরি এই URL খুলুন:
```
https://bishash-1.onrender.com/api/health
```
`{"ok":true,"db":true}` এলে backend + DB ঠিক আছে। `db:false` এলে সমস্যা #৩,
পুরো পেজ লোড না হলে/error এলে সমস্যা #১ বা #৪।

## Deploy চেকলিস্ট

1. **backend/** → Render-এ নতুন Web Service (rootDir `backend`, বা এই রিপোর
   root-এ থাকা `render.yaml` অনুযায়ী auto-deploy), Environment ট্যাবে উপরের সব
   var বসান (regenerate করা নতুন secret দিয়ে)।
2. **frontend/** ও **admin_panel/** → আলাদা আলাদা Vercel প্রজেক্ট হিসেবে deploy
   করুন (প্রতিটার নিজস্ব `vercel.json` লাগবে যদি রিরাইট দরকার হয়; admin_panel-এ
   আগে থেকেই আছে)।
3. Vercel deploy শেষে যে দুটো URL পাবেন, সেগুলো Render-এর `ALLOWED_ORIGINS`-এ
   বসান এবং Render সার্ভিস redeploy করুন।
4. `admin.html`-এর Settings পেজে (`apiUrlInp`) গিয়ে backend URL ঠিক আছে কিনা
   যাচাই করুন — না থাকলে ওখান থেকেই বদলানো যায় (localStorage-এ সেভ হয়)।
