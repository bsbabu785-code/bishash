/*
 * Bishash Halua — Backend API (updated)
 * নতুন: IncompleteOrder, Customer collection, order tracking history,
 * public tracking endpoint, GA + extra content fields.
 * সরানো: Coupon endpoints (আর দরকার নেই)।
 */

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const mongoose    = require('mongoose');
const jwt         = require('jsonwebtoken');
const multer      = require('multer');
const cloudinary  = require('cloudinary').v2;

const fetchFn = (typeof fetch !== 'undefined')
  ? fetch
  : ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// ---------- CORS ----------
const ALLOWED = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED.length === 0) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    console.warn(`⚠️  CORS blocked "${origin}"`);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ---------- MongoDB ----------
mongoose.set('strictQuery', true);
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => console.error('❌ MongoDB error:', err.message));
} else {
  console.warn('⚠️  MONGODB_URI not set — DB features disabled');
}
function requireDb(_req, res, next) {
  if (mongoose.connection.readyState !== 1)
    return res.status(503).json({ error: 'Database unavailable, try again in a moment.' });
  next();
}

// ---------- Schemas ----------
const reviewSchema = new mongoose.Schema({
  image: String,
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
}, { timestamps: true });

const trackingEntrySchema = new mongoose.Schema({
  status: String,
  note: String,
  at: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true },
  customerName: String, phone: String, address: String,
  product: String, weight: String, quantity: Number,
  productPrice: Number, deliveryCharge: Number,
  totalAmount: Number,
  paymentMethod: { type: String, enum: ['bkash', 'nagad', 'cod'], default: 'cod' },
  senderNumber: String, transactionId: String,
  status: { type: String, enum: ['pending','confirmed','processing','shipped','delivered','cancelled'], default: 'pending' },
  note: String,
  tracking: [trackingEntrySchema],
}, { timestamps: true });

const incompleteOrderSchema = new mongoose.Schema({
  sessionId: { type: String, index: true },
  customerName: String,
  phone: String,
  address: String,
  weight: String,
  quantity: Number,
  paymentMethod: String,
  note: String,
  contactedAt: Date,          // এডমিন কল করলে সেট
  confirmed: { type: Boolean, default: false },
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  phone: { type: String, unique: true, index: true },
  name: String,
  address: String,
  totalOrders: { type: Number, default: 0 },
  totalSpent:  { type: Number, default: 0 },
  lastOrderAt: Date,
}, { timestamps: true });

// Extended content: বেশি টেক্স ফিল্ড + GA
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
  sections: {
    benefitsTitle: String, benefitsSubtitle: String,
    reviewsTitle:  String, reviewsSubtitle:  String,
    orderTitle:    String, orderSubtitle:    String,
    aboutTitle:    String, aboutText:        String,
    footerText:    String,
  },
  tracking: {
    gaId: String,           // e.g. G-XXXXXXX
    gaEnabled: { type: Boolean, default: false },
    fbPixelId: String,
  },
}, { timestamps: true });

const Review           = mongoose.model('Review', reviewSchema);
const Order            = mongoose.model('Order',  orderSchema);
const IncompleteOrder  = mongoose.model('IncompleteOrder', incompleteOrderSchema);
const Customer         = mongoose.model('Customer', customerSchema);
const Content          = mongoose.model('Content', contentSchema);

// ---------- Auth ----------
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
  db: mongoose.connection.readyState === 1, time: new Date().toISOString(),
}));
app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));

// ---------- Auth ----------
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';
  const SECRET     = process.env.JWT_SECRET     || 'change-me-please-in-production';
  if (username !== ADMIN_USER || password !== ADMIN_PASS)
    return res.status(401).json({ error: 'ইউজারনেম বা পাসওয়ার্ড ভুল' });
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
      sections: {
        benefitsTitle: 'কেন বিশ্বাস হালুয়া?',
        benefitsSubtitle: 'গুণগত মান, আস্থা ও বিশ্বাস।',
        reviewsTitle: 'গ্রাহকদের মতামত',
        reviewsSubtitle: 'আমাদের প্রিয় গ্রাহকদের রিভিউ।',
        orderTitle: 'এখনই অর্ডার করুন',
        orderSubtitle: 'নিচের ফর্ম পূরণ করে অর্ডার সম্পন্ন করুন।',
        aboutTitle: 'আমাদের সম্পর্কে',
        aboutText: 'বিশ্বাস হালুয়া — খাঁটি ও প্রাকৃতিক উপাদানে ঘরোয়াভাবে তৈরি।',
        footerText: '© বিশ্বাস হালুয়া — সকল অধিকার সংরক্ষিত।',
      },
      tracking: { gaId: '', gaEnabled: false, fbPixelId: '' },
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

// ---------- Reviews (শুধু ইমেজ) ----------
app.get('/api/reviews', requireDb, async (_req, res, next) => {
  try { res.json(await Review.find({ active: true }).sort({ order: 1, createdAt: -1 })); } catch (e) { next(e); }
});
app.post('/api/reviews', auth, requireDb, async (req, res, next) => {
  try { res.json(await Review.create({ image: req.body.image, active: req.body.active !== false })); } catch (e) { next(e); }
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

async function upsertCustomer(o) {
  if (!o.phone) return;
  await Customer.findOneAndUpdate(
    { phone: o.phone },
    {
      $set: { name: o.customerName, address: o.address, lastOrderAt: new Date() },
      $inc: { totalOrders: 1, totalSpent: o.totalAmount || 0 },
    },
    { upsert: true, new: true }
  );
}

app.post('/api/orders', requireDb, async (req, res, next) => {
  try {
    const payload = { ...req.body, orderId: generateOrderId(),
      tracking: [{ status: 'pending', note: 'অর্ডার প্লেস হয়েছে', at: new Date() }] };
    const order = await Order.create(payload);
    await upsertCustomer(order.toObject());

    // ইনকমপ্লিট অর্ডার থাকলে মুছে দাও
    if (order.phone) {
      IncompleteOrder.deleteMany({ phone: order.phone }).catch(()=>{});
    }
    if (req.body.sessionId) IncompleteOrder.deleteMany({ sessionId: req.body.sessionId }).catch(()=>{});

    if (process.env.APPS_SCRIPT_URL) {
      Promise.resolve(fetchFn(process.env.APPS_SCRIPT_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: process.env.NOTIFY_EMAIL || 'bsbabu785@gmail.com', order: order.toObject() }),
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
    res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(500));
  } catch (e) { next(e); }
});

app.put('/api/orders/:id', auth, requireDb, async (req, res, next) => {
  try {
    const existing = await Order.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const body = { ...req.body };
    if (body.status && body.status !== existing.status) {
      body.$push = { tracking: { status: body.status, note: body.trackingNote || '', at: new Date() } };
      delete body.trackingNote;
    }
    const updated = await Order.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json(updated);
  } catch (e) { next(e); }
});

app.delete('/api/orders/:id', auth, requireDb, async (req, res, next) => {
  try { await Order.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

// ---------- Public tracking ----------
app.get('/api/track/:orderId', requireDb, async (req, res, next) => {
  try {
    const o = await Order.findOne({ orderId: req.params.orderId });
    if (!o) return res.status(404).json({ error: 'অর্ডার খুঁজে পাওয়া যায়নি' });
    res.json({
      orderId: o.orderId,
      status: o.status,
      customerName: o.customerName,
      product: o.product,
      weight: o.weight,
      quantity: o.quantity,
      totalAmount: o.totalAmount,
      createdAt: o.createdAt,
      tracking: o.tracking || [],
    });
  } catch (e) { next(e); }
});

// ---------- Incomplete orders ----------
app.post('/api/incomplete-orders', requireDb, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.sessionId && !b.phone) return res.status(400).json({ error: 'sessionId or phone required' });
    const filter = b.sessionId ? { sessionId: b.sessionId } : { phone: b.phone };
    const doc = await IncompleteOrder.findOneAndUpdate(
      filter,
      { $set: {
        sessionId: b.sessionId, customerName: b.customerName, phone: b.phone,
        address: b.address, weight: b.weight, quantity: b.quantity,
        paymentMethod: b.paymentMethod, note: b.note,
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, id: doc._id });
  } catch (e) { next(e); }
});

app.get('/api/incomplete-orders', auth, requireDb, async (_req, res, next) => {
  try {
    const list = await IncompleteOrder.find({ confirmed: { $ne: true } }).sort({ updatedAt: -1 }).limit(500);
    res.json(list);
  } catch (e) { next(e); }
});

app.patch('/api/incomplete-orders/:id', auth, requireDb, async (req, res, next) => {
  try { res.json(await IncompleteOrder.findByIdAndUpdate(req.params.id, req.body, { new: true })); }
  catch (e) { next(e); }
});
app.delete('/api/incomplete-orders/:id', auth, requireDb, async (req, res, next) => {
  try { await IncompleteOrder.findByIdAndDelete(req.params.id); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// ---------- Customers ----------
app.get('/api/customers', auth, requireDb, async (_req, res, next) => {
  try {
    // Prefer stored Customer collection; fallback aggregate from orders
    const rows = await Customer.find().sort({ lastOrderAt: -1 }).limit(1000);
    res.json(rows.map(c => ({
      _id: c._id, name: c.name, phone: c.phone, address: c.address,
      orders: c.totalOrders, totalSpent: c.totalSpent, lastOrder: c.lastOrderAt,
    })));
  } catch (e) { next(e); }
});

// ---------- Dashboard ----------
app.get('/api/dashboard/stats', auth, requireDb, async (_req, res, next) => {
  try {
    const [totalOrders, todayOrders, agg, byStatus, recent, best, incompleteCount, custCount, visitorCount] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Order.aggregate([{ $group: { _id: null, sum: { $sum: '$totalAmount' } } }]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.find().sort({ createdAt: -1 }).limit(8),
      Order.aggregate([
        { $group: { _id: '$product', count: { $sum: '$quantity' }, revenue: { $sum: '$totalAmount' } } },
        { $sort: { count: -1 } }, { $limit: 5 },
      ]),
      IncompleteOrder.countDocuments({ confirmed: { $ne: true } }),
      Customer.countDocuments(),
      // simple analytics placeholder (GA fills real numbers client-side)
      Promise.resolve(0),
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
      pending: status.pending || 0, confirmed: status.confirmed || 0,
      delivered: status.delivered || 0, cancelled: status.cancelled || 0,
      customers: custCount, incomplete: incompleteCount, visitors: visitorCount,
      recent, best, salesLast7,
    });
  } catch (e) { next(e); }
});

// ---------- 404 + errors ----------
app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.path }));
app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

process.on('unhandledRejection', e => console.error('unhandledRejection:', e));
process.on('uncaughtException',  e => console.error('uncaughtException:',  e));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('🚀 Bishash API on :' + PORT);
  console.log('   ALLOWED_ORIGINS =', ALLOWED.length ? ALLOWED.join(', ') : '(none)');
  console.log('   MONGODB_URI set =', !!process.env.MONGODB_URI);
});
