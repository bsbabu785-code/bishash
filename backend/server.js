/*
 * Bishash Halua — Backend API
 * Stack: Express + MongoDB (Mongoose) + Cloudinary + JWT + Apps Script (email)
 */

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const mongoose    = require('mongoose');
const jwt         = require('jsonwebtoken');
const multer      = require('multer');
const cloudinary  = require('cloudinary').v2;

// Use built-in fetch on Node 18+, fall back to node-fetch v2 otherwise
const fetchFn = (typeof fetch !== 'undefined')
  ? fetch
  : ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy
app.use(express.json({ limit: '10mb' }));

// ---------- CORS (permissive if ALLOWED_ORIGINS is empty) ----------
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // curl, server-to-server, mobile webview
    if (ALLOWED.length === 0) return cb(null, true); // no allow-list configured
    if (ALLOWED.includes(origin)) return cb(null, true);
    // Log so it's obvious in Render logs *why* a login/order request failed
    console.warn(`⚠️  CORS blocked origin "${origin}". Add it to ALLOWED_ORIGINS if this is your real frontend/admin panel domain.`);
    return cb(null, false); // return false, don't throw, so it's not a 500
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ---------- MongoDB (non-fatal on failure) ----------
mongoose.set('strictQuery', true);
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));
} else {
  console.warn('⚠️  MONGODB_URI not set — DB features disabled');
}

function requireDb(_req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: 'Database unavailable, try again in a moment.' });
  }
  next();
}

// ---------- Schemas ----------
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  weight: String, weightKey: String,
  regularPrice: Number, salePrice: Number,
  stock: { type: Number, default: 100 },
  status: { type: String, default: 'active' },
  image: String,
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
  image: String,
  active: { type: Boolean, default: true },
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customerName: String, phone: String, address: String,
  product: String, weight: String, quantity: Number,
  productPrice: Number, deliveryCharge: Number,
  couponCode: String, discount: { type: Number, default: 0 },
  totalAmount: Number,
  paymentMethod: { type: String, enum: ['bkash', 'nagad', 'cod'], default: 'cod' },
  senderNumber: String, transactionId: String,
  status: { type: String, enum: ['pending','confirmed','processing','shipped','delivered','cancelled'], default: 'pending' },
  note: String,
}, { timestamps: true });

const contentSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  hero: { title:String, highlight:String, subtitle:String, ctaText:String, image:String },
  youtube: { enabled:{type:Boolean,default:true}, videoId:String, title:String, subtitle:String },
  benefits: [{ icon: String, text: String }],
  productInfo: { name: String, description: String },
  contact: { phone:String, whatsapp:String, email:String, address:String },
  social:  { facebook:String, instagram:String, youtube:String, tiktok:String },
  payments:{ bkash:String, nagad:String },
  delivery:{ insideDhaka:{type:Number,default:70}, outsideDhaka:{type:Number,default:130} },
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
app.get('/', (_req, res) => res.json({
  ok: true, name: 'Bishash Halua API',
  db: mongoose.connection.readyState === 1,
  time: new Date().toISOString(),
}));
app.get('/api/health', (_req, res) => res.json({
  ok: true, db: mongoose.connection.readyState === 1,
}));

// ---------- Auth (works even without DB) ----------
app.post('/api/auth/login', (req, res) => {
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
        { icon: '🚫', text: 'কোনো প্রিজারভেটিভ নেই' },
        { icon: '🏠', text: 'ঘরোয়া পদ্ধতিতে তৈরি' },
      ],
      productInfo: { name: 'বিশ্বাস হালুয়া', description: 'সুস্বাদু ও পুষ্টিকর ঘরোয়া হালুয়া।' },
      contact: { phone: '', whatsapp: '', email: '', address: '' },
      social: { facebook: '', instagram: '', youtube: '', tiktok: '' },
      payments: { bkash: '', nagad: '' },
      delivery: { insideDhaka: 70, outsideDhaka: 130 },
    });
  }
  return c;
}
app.get('/api/content', async (_req, res, next) => {
  try { res.json(await getOrCreateContent()); } catch (e) { next(e); }
});
app.put('/api/content', auth, requireDb, async (req, res, next) => {
  try {
    const c = await Content.findOneAndUpdate({ key: 'main' }, req.body, { new: true, upsert: true });
    res.json(c);
  } catch (e) { next(e); }
});

// ---------- Products ----------
app.get('/api/products', requireDb, async (_req, res, next) => {
  try { res.json(await Product.find().sort({ order: 1, createdAt: -1 })); } catch (e) { next(e); }
});
app.post('/api/products', auth, requireDb, async (req, res, next) => {
  try { res.json(await Product.create(req.body)); } catch (e) { next(e); }
});
app.put('/api/products/:id', auth, requireDb, async (req, res, next) => {
  try { res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
});
app.delete('/api/products/:id', auth, requireDb, async (req, res, next) => {
  try { await Product.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// ---------- Coupons ----------
app.get('/api/coupons', auth, requireDb, async (_req, res, next) => {
  try { res.json(await Coupon.find().sort({ createdAt: -1 })); } catch (e) { next(e); }
});
app.post('/api/coupons', auth, requireDb, async (req, res, next) => {
  try { res.json(await Coupon.create(req.body)); } catch (e) { next(e); }
});
app.put('/api/coupons/:id', auth, requireDb, async (req, res, next) => {
  try { res.json(await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
});
app.delete('/api/coupons/:id', auth, requireDb, async (req, res, next) => {
  try { await Coupon.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});
app.post('/api/coupons/validate', requireDb, async (req, res, next) => {
  try {
    const { code, subtotal = 0 } = req.body || {};
    const c = await Coupon.findOne({ code: String(code || '').toUpperCase(), active: true });
    if (!c) return res.status(404).json({ error: 'কুপন খুঁজে পাওয়া যায়নি' });
    if (c.expiresAt && new Date(c.expiresAt) < new Date()) return res.status(400).json({ error: 'কুপনের মেয়াদ শেষ' });
    if (subtotal < (c.minOrder || 0)) return res.status(400).json({ error: `সর্বনিম্ন অর্ডার ৳${c.minOrder}` });
    const discount = c.type === 'percent' ? Math.round(subtotal * (c.value / 100)) : c.value;
    res.json({ ok: true, discount, code: c.code });
  } catch (e) { next(e); }
});

// ---------- Reviews ----------
app.get('/api/reviews', requireDb, async (_req, res, next) => {
  try { res.json(await Review.find({ active: true }).sort({ createdAt: -1 })); } catch (e) { next(e); }
});
app.post('/api/reviews', auth, requireDb, async (req, res, next) => {
  try { res.json(await Review.create(req.body)); } catch (e) { next(e); }
});
app.put('/api/reviews/:id', auth, requireDb, async (req, res, next) => {
  try { res.json(await Review.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
});
app.delete('/api/reviews/:id', auth, requireDb, async (req, res, next) => {
  try { await Review.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// ---------- Uploads ----------
app.post('/api/uploads', auth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const b64 = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
    const r = await cloudinary.uploader.upload(b64, { folder: 'bishash' });
    res.json({ url: r.secure_url, public_id: r.public_id });
  } catch (e) { next(e); }
});

// ---------- Orders ----------
function generateOrderId() {
  const d = new Date();
  const s = d.toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return 'BH' + s + Math.floor(Math.random() * 900 + 100);
}

app.post('/api/orders', requireDb, async (req, res, next) => {
  try {
    const payload = { ...req.body, orderId: generateOrderId() };
    const order = await Order.create(payload);

    if (process.env.APPS_SCRIPT_URL) {
      Promise.resolve(fetchFn(process.env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: process.env.NOTIFY_EMAIL || 'bsbabu785@gmail.com',
          order: order.toObject(),
        }),
      })).catch(err => console.error('Apps Script forward failed:', err.message));
    }

    res.json({ ok: true, order });
  } catch (e) { next(e); }
});

app.get('/api/orders', auth, requireDb, async (req, res, next) => {
  try {
    const { status, q, from, to } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (from || to) filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to)   filter.createdAt.$lte = new Date(to);
    if (q) filter.$or = [
      { orderId: new RegExp(q, 'i') },
      { customerName: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') },
    ];
    const list = await Order.find(filter).sort({ createdAt: -1 }).limit(500);
    res.json(list);
  } catch (e) { next(e); }
});

app.put('/api/orders/:id', auth, requireDb, async (req, res, next) => {
  try { res.json(await Order.findByIdAndUpdate(req.params.id, req.body, { new: true })); } catch (e) { next(e); }
});
app.delete('/api/orders/:id', auth, requireDb, async (req, res, next) => {
  try { await Order.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// ---------- Customers ----------
app.get('/api/customers', auth, requireDb, async (_req, res, next) => {
  try {
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
  } catch (e) { next(e); }
});

// ---------- Dashboard stats ----------
app.get('/api/dashboard/stats', auth, requireDb, async (_req, res, next) => {
  try {
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
      totalOrders, todayOrders,
      totalSales: agg[0]?.sum || 0,
      pending: status.pending || 0,
      confirmed: status.confirmed || 0,
      delivered: status.delivered || 0,
      cancelled: status.cancelled || 0,
      recent, best, salesLast7,
    });
  } catch (e) { next(e); }
});

// ---------- 404 + error handler (always JSON) ----------
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));
app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

process.on('unhandledRejection', e => console.error('unhandledRejection:', e));
process.on('uncaughtException',  e => console.error('uncaughtException:',  e));

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 Bishash API on :' + PORT);
  console.log('   ALLOWED_ORIGINS =', ALLOWED.length ? ALLOWED.join(', ') : '(none set — all origins allowed)');
  console.log('   ADMIN_USERNAME set =', !!process.env.ADMIN_USERNAME, '| ADMIN_PASSWORD set =', !!process.env.ADMIN_PASSWORD);
  console.log('   MONGODB_URI set =', !!process.env.MONGODB_URI);
});