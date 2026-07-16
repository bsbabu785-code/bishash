# bishash.shop — SEO রিপোর্ট ও করণীয় (Implementation Report)

## যা যা কোডে করে দেওয়া হয়েছে (`index.html`)

1. **Title Tag** — টার্গেট কীওয়ার্ড দিয়ে নতুন করে লেখা হয়েছে:
   `বিশ্বাস হালুয়া (Bishash Halwa) | Buy Premium Halwa Online in Bangladesh`

2. **Meta Description** — বাংলা + ইংরেজি উভয় কীওয়ার্ড সহ আকর্ষণীয় description।

3. **Meta Keywords** — আপনার দেওয়া সবগুলো কীওয়ার্ড (বিশ্বাস ডট শপ, হালুয়া, Bishash Halwa, Buy Halwa Online ইত্যাদি) যুক্ত করা হয়েছে।

4. **Canonical URL** — `https://bishash.shop/` সেট করা হয়েছে যাতে ডুপ্লিকেট কনটেন্ট সমস্যা না হয়।

5. **Robots meta + robots.txt + sitemap.xml** — গুগলকে পুরো সাইট ইনডেক্স করার অনুমতি ও sitemap লোকেশন জানিয়ে দেওয়া হয়েছে।

6. **Open Graph + Twitter Card** — ফেসবুক/হোয়াটসঅ্যাপ/টুইটারে লিংক শেয়ার করলে সুন্দর প্রিভিউ (title, description, ছবি) দেখাবে।

7. **JSON-LD Structured Data** (Schema.org) — যোগ করা হয়েছে:
   - `Organization` (ব্র্যান্ড তথ্য)
   - `WebSite`
   - `Product` (হালুয়া, দাম, রেটিং সহ) — গুগল সার্চে rich snippet (⭐ রেটিং, দাম) দেখানোর সুযোগ তৈরি করে
   - `FAQPage` — আপনার FAQ সেকশন থেকে নেওয়া, গুগল সার্চে প্রশ্নোত্তর সরাসরি দেখাতে পারে
   - `BreadcrumbList`

8. **Image ALT Text অপ্টিমাইজেশন** — হিরো, বেনিফিট, কম্পেয়ার সেকশনের ছবি এবং লোগোতে বাংলা+ইংরেজি কীওয়ার্ড সহ বর্ণনামূলক alt text যোগ করা হয়েছে (ingredient bubble গুলোর alt আগে থেকেই ঠিক ছিল)।

9. **Hidden SEO-friendly Subtitle** — H1 এর নিচে ভিজ্যুয়ালি-হিডেন (ডিজাইন অপরিবর্তিত রেখে) একটি বাক্য যোগ করা হয়েছে যাতে সব টার্গেট কীওয়ার্ড (হালুয়া কিনুন, খাঁটি হালুয়া, প্রিমিয়াম হালুয়া, Buy Halwa Online, Authentic Halwa ইত্যাদি) প্রাকৃতিকভাবে থাকে।

10. **Footer** — নতুন footer যোগ করা হয়েছে ব্র্যান্ড নাম, কীওয়ার্ড-সমৃদ্ধ বাক্য ও ইন্টারনাল লিংক সহ (এতে ফুটার পুরো সাইটের প্রতিটি পেজে একই কীওয়ার্ড সিগন্যাল দেবে)।

11. ডুপ্লিকেট `</body></html>` ট্যাগ (কোডে বাগ ছিল) ঠিক করে দেওয়া হয়েছে।

## কেন এগুলো প্রয়োজন ছিল
আপনার দেওয়া কীওয়ার্ড লিস্টের প্রতিটি শব্দ/phrase (বিশ্বাস ডট শপ, হালুয়া, হালুয়া কিনুন, অনলাইনে হালুয়া, খাঁটি হালুয়া, প্রিমিয়াম হালুয়া, হালুয়া বাংলাদেশ, Buy Halwa Online, Premium Halwa, Authentic Halwa, Halwa Bangladesh, Best Halwa, দেশি হালুয়া, Fresh Halwa, Traditional Halwa, হালুয়ার দাম, Halwa Online BD, Buy Halwa) এখন title, description, keywords meta, hidden subtitle, footer, এবং alt text — এই কয়েক জায়গায় স্বাভাবিকভাবে ছড়িয়ে দেওয়া হয়েছে, যাতে গুগল বুঝতে পারে পেজটি এই সব সার্চের জন্য প্রাসঙ্গিক।

---

## এখন আপনাকে যা করতে হবে (Off-page / Deployment steps — কোডে করা সম্ভব না)

1. **আপডেটেড `index.html` ডিপ্লয় করুন** bishash.shop এ (বর্তমান ফাইলটি রিপ্লেস করুন)।
2. **`robots.txt` ও `sitemap.xml`** ফাইল দুটো ডোমেইনের রুটে আপলোড করুন, যাতে সেগুলো এই লিংকে পাওয়া যায়:
   - https://bishash.shop/robots.txt
   - https://bishash.shop/sitemap.xml
3. **Google Search Console**-এ (search.google.com/search-console) সাইট verify করে sitemap সাবমিট করুন।
4. **Google Business Profile** খুলুন "বিশ্বাস হালুয়া" নামে — লোকাল সার্চ ("হালুয়া বাংলাদেশ", "হালুয়া কিনুন") এ অনেক সাহায্য করবে।
5. og:image URL (`https://bishash.shop/assets/main1.png`) লাইভ হওয়ার পর Facebook Sharing Debugger ও Twitter Card Validator দিয়ে চেক করুন।
6. পেজ লোড স্পিড ভালো রাখতে hero-তে থাকা বড় base64 লোগো ইমেজটিকে সাধারণ `<img src="assets/logo.png">` তে পরিবর্তনের কথা বিবেচনা করুন — বর্তমানে base64 embed HTML সাইজ অনেক বাড়িয়ে দিচ্ছে, যা পেজ স্পিড ও SEO score-কে নেগেটিভলি প্রভাবিত করতে পারে।
7. সম্ভব হলে ছবিগুলোর ফাইলনেম বাংলা/ইংরেজি কীওয়ার্ডসহ রাখুন (যেমন `bishash-halwa-1kg.png`), বর্তমানে কিছু ফাইলের নাম জেনেরিক (main1.png, mane3.png ইত্যাদি)।
8. ব্যাকলিংক তৈরি করুন — ফেসবুক পেজ, লোকাল ডিরেক্টরি, ফুড ব্লগ ইত্যাদিতে bishash.shop এর লিংক শেয়ার করুন।
9. নিয়মিত কাস্টমার রিভিউ কালেক্ট করুন — এটি `aggregateRating` স্কিমাকে বাস্তবসম্মত রাখতে সাহায্য করবে (বর্তমানে placeholder রেটিং বসানো হয়েছে, আসল রিভিউ সংখ্যা/রেটিং দিয়ে আপডেট করবেন)।