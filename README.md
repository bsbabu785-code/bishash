# বিশ্বাস হালুয়া — ব্যাকএন্ড ডিপ্লয়মেন্ট নির্দেশিকা

## সমস্যা কী ছিল?
1. **CORS error** — Render-এ পুরানো `server.js` deploy ছিল, তাই `Access-Control-Allow-Origin` header পাঠাচ্ছিল না।
2. **JWT_SECRET = "change-me-please-in-production"** — এটা শুধু placeholder। প্রোডাকশনে অবশ্যই strong random string দিতে হবে। এই zip-এর `.env.example`-এ ইতিমধ্যেই একটি ৯৬-অক্ষরের strong secret দেওয়া আছে।
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
