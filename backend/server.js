/*
 * Bishash Halua — Backend API
 * Stack: Express + MongoDB (Mongoose) + Cloudinary + JWT + Apps Script (email)
 *
 * Endpoints:
 *   POST  /api/auth/login                → admin login (JWT)
 *   GET   /api/content                   → public site content (hero, youtube, contact, payments, delivery, etc.)
 *   PUT   /api/content                   → admin update content
 *   GET   /api/products                  → public list
 *   POST  /api/products                  → admin create
 *   PUT   /api/products/:id              → admin update
 *   DELETE/api/products/:id              → admin delete
 *   GET   /api/coupons                   → admin list
 *   POST  /api/coupons                   → admin create
 *   PUT   /api/coupons/:id, DELETE       → admin
 *   POST  /api/coupons/validate          → public {code, subtotal} → discount
 *   GET   /api/reviews                   → public list
 *   POST/PUT/DELETE /api/reviews[/id]    → admin
 *   POST  /api/orders                    → public create (frontend) → also triggers Apps Script email
 *   GET   /api/orders                    → admin list (filter/search)
 *   PUT   /api/orders/:id                → admin update (status/edit)
 *   DELETE/api/orders/:id                → admin
 *   GET   /api/customers                 → admin list (aggregated from orders)
 *   GET   /api/dashboard/stats           → admin stats
 *   POST  /api/uploads                   → admin upload image to Cloudinary
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ---------- CORS (bulletproof: reflect any origin, handle preflight) ----------
const ALLOWED = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = {
  origin: (origin, cb) => {
    // Allow tools (curl/postman) with no Origin, and reflect any browser origin.
    if (!origin) return cb(null, true);
    if (ALLOWED.length === 0) return cb(null, true); // permissive by default
    if (ALLOWED.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // explicit preflight for all routes

// Extra safety net — always attach ACAO even on early errors
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (ALLOWED.length === 0 || ALLOWED.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ---------- MongoDB ----------
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err.message));

// ---------- Schemas ----------
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  weight: String,          // "1 কেজি" / "500 গ্রাম"
  weightKey: String,       // "1000" / "500"
  regularPrice: Number,
  salePrice: Number,
  stock: { type: Number, default: 100 },
  status: { type: String, default: 'active' }, // active/inactive
  image: String,           // Cloudinary URL
  order: { type: Number, default: 0 },
}, { timestamps: true });

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
  value: Number,
  minOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  expiresAt: Date,
}, { timestamps: true });

const reviewSchema = new mongoose.Schema({
  customerName: String,
  rating: { type: Number, default: 5 },
  text: String,
  image: String,           // Cloudinary
  active: { type: Boolean, default: true },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customerName: String,
  phone: String,
  address: String,
  product: String,
  weight: String,
  quantity: Number,
  productPrice: Number,
  deliveryCharge: Number,
  couponCode: String,
  discount: { type: Number, default: 0 },
  totalAmount: Number,
  paymentMethod: { type: String, enum: ['bkash', 'nagad', 'cod'], default: 'cod' },
  senderNumber: String,    // bkash/nagad sender number
  transactionId: String,
  status: { type: String, enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
  note: String,
}, { timestamps: true });

const contentSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  hero: {
    title: String,
    highlight: String,
    subtitle: String,
    ctaText: String,
    image: String,
  },
  youtube: {
    enabled: { type: Boolean, default: true },
    videoId: String,
    title: String,
    subtitle: String,
  },
  benefits: [{ icon: String, text: String }],
  productInfo: {
    name: String,
    description: String,
  },
  contact: {
    phone: String,
    whatsapp: String,
    email: String,
    address: String,
  },
  social: {
    facebook: String,
    instagram: String,
    youtube: String,
    tiktok: String,
  },
  payments: {
    bkash: String,
    nagad: String,
  },
  delivery: {
    insideDhaka: { type: Number, default: 70 },
    outsideDhaka: { type: Number, default: 130 },
  },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
const Coupon  = mongoose.model('Coupon',  couponSchema);
const Review  = mongoose.model('Review',  reviewSchema);
const Order   = mongoose.model('Order',   orderSchema);
const Content = mongoose.model('Content', contentSchema);

// ---------- Auth middleware ----------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'change-me-please-in-production');
    next();
  } catch { return res.status(401).json({ error: 'Invalid token' }); }
}
 
// ---------- Health ----------
app.get('/', (_req, res) => res.json({ ok: true, name: 'Bishash Halua API' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// ---------- Auth ----------
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
  const SECRET     = process.env.JWT_SECRET     || 'change-me-please-in-production';
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'ইউজারনেম বা পাসওয়ার্ড ভুল' });
  }
  const token = jwt.sign({ u: username, role: 'admin' }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { username, role: 'admin' } });
});

// ---------- Content ----------
async function getOrCreateContent() {
  let c = await Content.findOne({ key: 'main' });
  if (!c) {
    c = await Content.create({
      key: 'main',
      hero: {
        title: 'খাঁটি ঘরোয়া স্বাদের',
        highlight: 'বিশ্বাস হালুয়া',
        subtitle: 'প্রাকৃতিক উপাদানে তৈরি, কোনো প্রিজারভেটিভ ছাড়াই।',
        ctaText: 'এখনই অর্ডার করুন',
        image: '',
      },
      youtube: { enabled: true, videoId: '', title: 'বিশ্বাস হালুয়া তৈরির প্রক্রিয়া', subtitle: 'ভিডিওতে দেখুন কীভাবে আমরা হালুয়া তৈরি করি।' },
      benefits: [
        { icon: '✅', text: '১০০% খাঁটি ও প্রাকৃতিক উপাদান' },
        { icon: '✅', text: 'কোনো প্রিজারভেটিভ নেই' },
        { icon: '✅', text: 'ঘরোয়া রেসিপিতে তৈরি' },
      ],
      productInfo: { name: 'বিশ্বাস হালুয়া', description: 'খাঁটি ঘি ও বাদামে তৈরি বিশেষ হালুয়া।' },
      contact: { phone: '01716221962', whatsapp: '8801716221962', email: 'bsbabu785@gmail.com', address: 'ঢাকা, বাংলাদেশ' },
      social: { facebook: '', instagram: '', youtube: '', tiktok: '' },
      payments: { bkash: '01716221962', nagad: '01332663380' },
      delivery: { insideDhaka: 70, outsideDhaka: 130 },
    });
  }
  return c;
}
app.get('/api/content', async (_req, res) => {
  const c = await getOrCreateContent();
  res.json(c);
});
app.put('/api/content', auth, async (req, res) => {
  const c = await Content.findOneAndUpdate({ key: 'main' }, req.body, { new: true, upsert: true });
  res.json(c);
});

// ---------- Products ----------
app.get('/api/products', async (_req, res) => {
  const list = await Product.find().sort({ order: 1, createdAt: -1 });
  res.json(list);
});
app.post('/api/products', auth, async (req, res) => {
  const p = await Product.create(req.body);
  res.json(p);
});
app.put('/api/products/:id', auth, async (req, res) => {
  const p = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(p);
});
app.delete('/api/products/:id', auth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ---------- Coupons ----------
app.get('/api/coupons', auth, async (_req, res) => res.json(await Coupon.find().sort({ createdAt: -1 })));
app.post('/api/coupons', auth, async (req, res) => res.json(await Coupon.create(req.body)));
app.put('/api/coupons/:id', auth, async (req, res) => res.json(await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/coupons/:id', auth, async (req, res) => { await Coupon.findByIdAndDelete(req.params.id); res.json({ ok: true }); });
app.post('/api/coupons/validate', async (req, res) => {
  const { code, subtotal = 0 } = req.body || {};
  const c = await Coupon.findOne({ code: String(code || '').toUpperCase(), active: true });
  if (!c) return res.status(404).json({ error: 'কুপন খুঁজে পাওয়া যায়নি' });
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return res.status(400).json({ error: 'কুপনের মেয়াদ শেষ' });
  if (subtotal < (c.minOrder || 0)) return res.status(400).json({ error: `সর্বনিম্ন অর্ডার ৳${c.minOrder}` });
  const discount = c.type === 'percent' ? Math.round(subtotal * (c.value / 100)) : c.value;
  res.json({ ok: true, discount, code: c.code });
});

// ---------- Reviews ----------
app.get('/api/reviews', async (_req, res) => res.json(await Review.find({ active: true }).sort({ createdAt: -1 })));
app.post('/api/reviews', auth, async (req, res) => res.json(await Review.create(req.body)));
app.put('/api/reviews/:id', auth, async (req, res) => res.json(await Review.findByIdAndUpdate(req.params.id, req.body, { new: true })));
app.delete('/api/reviews/:id', auth, async (req, res) => { await Review.findByIdAndDelete(req.params.id); res.json({ ok: true }); });

// ---------- Uploads ----------
app.post('/api/uploads', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  try {
    const b64 = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    const r = await cloudinary.uploader.upload(b64, { folder: 'bishash' });
    res.json({ url: r.secure_url, public_id: r.public_id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Orders ----------
function generateOrderId() {
  const d = new Date();
  const s = d.toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return 'BH' + s + Math.floor(Math.random() * 900 + 100);
}

app.post('/api/orders', async (req, res) => {
  try {
    const payload = { ...req.body, orderId: generateOrderId() };
    const order = await Order.create(payload);

    // Fire-and-forget Apps Script email
    if (process.env.APPS_SCRIPT_URL) {
      fetch(process.env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: process.env.NOTIFY_EMAIL || 'bsbabu785@gmail.com',
          order: order.toObject(),
        }),
      }).catch(err => console.error('Apps Script forward failed:', err.message));
    }

    res.json({ ok: true, order });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/orders', auth, async (req, res) => {
  const { status, q, from, to } = req.query;
  const filter = {};
  if (status && status !== 'all') filter.status = status;
  if (from || to) filter.createdAt = {};
  if (from) filter.createdAt.$gte = new Date(from);
  if (to) filter.createdAt.$lte = new Date(to);
  if (q) filter.$or = [
    { orderId: new RegExp(q, 'i') },
    { customerName: new RegExp(q, 'i') },
    { phone: new RegExp(q, 'i') },
  ];
  const list = await Order.find(filter).sort({ createdAt: -1 }).limit(500);
  res.json(list);
});

app.put('/api/orders/:id', auth, async (req, res) => {
  const o = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(o);
});

app.delete('/api/orders/:id', auth, async (req, res) => {
  await Order.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ---------- Customers (aggregated) ----------
app.get('/api/customers', auth, async (_req, res) => {
  const rows = await Order.aggregate([
    { $group: {
      _id: '$phone',
      name: { $last: '$customerName' },
      phone: { $last: '$phone' },
      address: { $last: '$address' },
      orders: { $sum: 1 },
      totalSpent: { $sum: '$totalAmount' },
      lastOrder: { $max: '$createdAt' },
    }},
    { $sort: { lastOrder: -1 } },
    { $limit: 500 },
  ]);
  res.json(rows);
});

// ---------- Dashboard stats ----------
app.get('/api/dashboard/stats', auth, async (_req, res) => {
  const [totalOrders, todayOrders, agg, byStatus, recent, best] = await Promise.all([
    Order.countDocuments(),
    Order.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
    Order.aggregate([{ $group: { _id: null, sum: { $sum: '$totalAmount' } } }]),
    Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.find().sort({ createdAt: -1 }).limit(8),
    Order.aggregate([
      { $group: { _id: '$product', count: { $sum: '$quantity' }, revenue: { $sum: '$totalAmount' } } },
      { $sort: { count: -1 } }, { $limit: 5 },
    ]),
  ]);
  const salesLast7 = await Order.aggregate([
    { $match: { createdAt: { $gte: new Date(Date.now() - 7*86400000) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, sum: { $sum: '$totalAmount' } } },
    { $sort: { _id: 1 } },
  ]);
  const status = Object.fromEntries(byStatus.map(x => [x._id, x.count]));
  res.json({
    totalOrders,
    todayOrders,
    totalSales: agg[0]?.sum || 0,
    pending: status.pending || 0,
    confirmed: status.confirmed || 0,
    delivered: status.delivered || 0,
    cancelled: status.cancelled || 0,
    recent, best, salesLast7,
  });
});

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('🚀 API on :' + PORT));
