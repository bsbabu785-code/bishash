# বিশ্বাস হালুয়া — ব্যাকএন্ড ডিপ্লয়মেন্ট নির্দেশিকা

## সমস্যা কী ছিল?
1. **CORS error** — Render-এ পুরানো `server.js` deploy ছিল, তাই `Access-Control-Allow-Origin` header পাঠাচ্ছিল না।
2. **JWT_SECRET = "change-me-please-in-production"** — এটা শুধু placeholder। প্রোডাকশনে অবশ্যই strong random str# ============================================================
# Render দাশবোর্ডে পেস্ট করার জন্য Environment Variables
# (Render → আপনার Service → "Environment" ট্যাব → এক এক করে Add করুন)
# ============================================================

# নতুন, শক্তিশালী secret — জেনারেট করা হয়েছে, আগেরটার বদলে এটা ব্যবহার করুন
JWT_SECRET=0b3277137b2e5d430536c1602a3030583f4289a481286c1786f124d80514eb41

# ⚠️ নিচেরগুলো _env.example এ প্লেইনটেক্সটে ছিল বলে ধরে নিন এগুলো এক্সপোজড।
# আগে এইগুলো নিজ নিজ ড্যাশবোর্ডে গিয়ে ROTATE (regenerate) করুন,
# তারপর নতুন ভ্যালু এখানে বসান:

MONGODB_URI=<MongoDB Atlas থেকে নতুন পাসওয়ার্ড দিয়ে regenerate করা connection string>
CLOUDINARY_API_SECRET=<Cloudinary dashboard থেকে regenerate করা নতুন secret>
ADMIN_PASSWORD=<নতুন, শক্তিশালী admin পাসওয়ার্ড এখানে বসান>

# এগুলো অপরিবর্তিত রাখা যায় (secret না):
ADMIN_USERNAME=admin
CLOUDINARY_CLOUD_NAME=uaaepahg
CLOUDINARY_API_KEY=267774731115932
ALLOWED_ORIGINS=https://bishash-5o21.vercel.app,https://bishash-v85c.vercel.app
APPS_SCRIPT_URL=https://script.google.com/macros/s/AKfycbyQf_-mCRq8ICznbTZSfwpmAM36TMU5t0EmZuduFQqbtFWlkbTYcNAntZMAVuDMBaZH/exec
NOTIFY_EMAIL=bsbabu785@gmail.com
PORT=10000ing দিতে হবে। এই zip-এর `.env.example`-এ ইতিমধ্যেই একটি ৯৬-অক্ষরের strong secret দেওয়া আছে।
3. **সব ডেটা MongoDB-তে** — Backend শুরু থেকেই MongoDB (Mongoose) ব্যবহার করে; localStorage-এ কোনো ডেটা রাখা হয় না। শুধু নিশ্চিত করতে হবে `MONGODB_URI` env variable সঠিকভাবে সেট আছে।

## Render-এ কী করতে হবে (গুরুত্বপূর্ণ)

1. Render Dashboard → আপনার service → **Environment** ট্যাব খুলুন।
2. নিচের সব key-value যোগ করুন (`.env.example` থেকে কপি করুন):
   - `MONGODB_URI` = `mongodb+srv://bsbabu785_db_user:FV0VRCoapFz5nJqe@cluster0.rpv7p77.mongodb.net/bishash?appName=Cluster0`
   - `ADMIN_USERNAME` = `admin`
   - `ADMIN_PASSWORD` = `admin123`
   - `JWT_SECRET` = (`.env.example`-এর long string)
   - `ALLOWED_ORIGINS` = খালি রাখুন (সব origin allow হবে) অথবা `https://bishash-v85c.vercel.app`
   - Cloudinary keys (যদি image upload লাগে)
3. **Manual Deploy → Deploy latest commit** (অথবা এই নতুন `server.js` push করুন)।
4. Deploy শেষ হলে test: `https://bishash-backend.onrender.com/api/health` → `{"ok":true,"db":true}` দেখাবে।

## MongoDB Atlas-এ Network Access
Atlas → Network Access → **Add IP Address → Allow Access from Anywhere (0.0.0.0/0)** — এটা করা না থাকলে Render থেকে DB connect হবে না।

## Login credentials
- Username: `admin`
- Password: `admin123`
