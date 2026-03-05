# 🚀 TaskPro — دليل التشغيل الكامل

## الملفات في المشروع

```
taskpro/
├── frontend/
│   ├── index.html      ← صفحة تسجيل الدخول
│   ├── worker.html     ← واجهة العامل
│   ├── admin.html      ← لوحة الإدارة
│   └── supabase.js     ← كل منطق قاعدة البيانات
└── backend/
    └── schema.sql      ← قاعدة البيانات (تشغّلها في Supabase مرة واحدة)
```

---

## الخطوة 1 — إنشاء حساب Supabase (مجاناً)

1. اذهب إلى: https://supabase.com
2. اضغط **Start for free**
3. سجّل بـ GitHub أو Google
4. اضغط **New Project** واختر اسم المشروع
5. احفظ كلمة مرور قاعدة البيانات

---

## الخطوة 2 — إعداد قاعدة البيانات

1. في Supabase Dashboard، اذهب إلى **SQL Editor**
2. افتح ملف `backend/schema.sql`
3. انسخ كل المحتوى والصقه في SQL Editor
4. اضغط **Run**
5. يجب أن تظهر رسالة: `Success. No rows returned`

---

## الخطوة 3 — ربط supabase.js بمشروعك

1. في Supabase، اذهب إلى **Settings → API**
2. انسخ:
   - **Project URL** (يبدأ بـ `https://`)
   - **anon public** key
3. افتح ملف `frontend/supabase.js`
4. بدّل هذين السطرين:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'   // ← ضع URL مشروعك
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY'              // ← ضع المفتاح
```

---

## الخطوة 4 — نشر الموقع على Vercel (مجاناً)

### الطريقة السريعة (بدون Git):
1. اذهب إلى: https://vercel.com
2. سجّل بـ GitHub
3. اضغط **Add New → Project**
4. اختر **Deploy without a Git repository**
5. ارفع مجلد `frontend` كاملاً
6. اضغط **Deploy**
7. ستحصل على رابط مثل: `https://taskpro-xxx.vercel.app`

### الطريقة عبر GitHub:
```bash
# في terminal
cd taskpro/frontend
npx vercel --prod
```

---

## الخطوة 5 — إنشاء حساب Admin

1. افتح موقعك ← `index.html`
2. اضغط **حساب جديد**
3. اختر دور **صاحب عمل**
4. سجّل بإيميلك
5. افعّل الحساب من الإيميل
6. ادخل → ستنتقل تلقائياً لـ `admin.html`

---

## الخطوة 6 (اختياري) — ربط مدفوعات USDT حقيقية

### عبر NOWPayments:
1. سجّل في: https://nowpayments.io
2. احصل على API Key
3. أضف هذا الكود في `supabase.js` في دالة `requestWithdraw`:

```javascript
// إرسال USDT تلقائياً
const response = await fetch('https://api.nowpayments.io/v1/payout', {
  method: 'POST',
  headers: {
    'x-api-key': 'YOUR_NOWPAYMENTS_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ipn_callback_url: 'https://your-site.com/webhook',
    withdrawals: [{
      address: walletAddress,
      currency: 'usdttrc20',
      amount: amount
    }]
  })
})
```

> ⚠️ NOWPayments يأخذ رسوم صغيرة (~0.5%) على كل معاملة

---

## ملخص التكاليف

| الخدمة | التكلفة |
|--------|---------|
| Supabase (Free tier) | مجاني حتى 50K طلب/شهر |
| Vercel (Hobby) | مجاني |
| Domain اختياري | ~$10/سنة |
| NOWPayments رسوم | ~0.5% من كل دفعة |

**إجمالي البداية: $0** 🎉

---

## مميزات المنصة

### صاحب المنصة (Admin):
- ✅ نشر مهام (تصميم / برمجة / كتابة / تسويق)
- ✅ مراجعة وقبول/رفض التسليمات
- ✅ دفع USDT للعمال تلقائياً
- ✅ إدارة العمال والمدفوعات

### العامل (Worker):
- ✅ استعراض وفلترة المهام
- ✅ التقديم للمهام
- ✅ تسليم العمل
- ✅ تتبع الأرباح والمحفظة
- ✅ طلب سحب USDT

---

## للمساعدة أو الأسئلة

كل شيء في `supabase.js` — إذا احتجت تضيف ميزة جديدة، أضف دالة هناك واستدعيها من الصفحة المناسبة.
