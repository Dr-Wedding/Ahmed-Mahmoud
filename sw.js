/* =========================================================
   sw.js
   Service Worker — يفعّل عمل الموقع بالكامل بدون إنترنت
   بعد أول زيارة (تحميل التطبيق مرة واحدة أونلاين)
   ========================================================= */

// غيّر هذا الرقم عند تحديث أي ملف من ملفات الموقع (HTML/CSS/JS)
// لإجبار المتصفح على تحميل النسخة الجديدة بدل النسخة المخزنة مسبقًا.
// ده هو المفتاح الوحيد اللي بيخلي المتصفح يكتشف إن فيه تحديث —
// لازم يتغيّر مع كل نشر جديد على الموقع، حتى لو التعديل بسيط.
// بمجرد ما المتصفح يكتشف التغيير، الكاش الجديد بيتحمّل بالكامل من
// الشبكة في الخلفية، وبعدها js/app.js بيعمل Reload تلقائي وصامت
// لأي تبويب مفتوح بالفعل — الزائر يشوف آخر نسخة من غير أي تدخل
// يدوي منه، وبدون ما يضيع أي بيانات كان بيكتبها في الفورم.
const CACHE_VERSION = "v12";
const CACHE_NAME = `am-photography-${CACHE_VERSION}`;

// ملفات الهيكل الأساسي للموقع (نادرًا ما تتغيّر) — كاش أولًا لسرعة فورية،
// مع تحديث الكاش من الشبكة في الخلفية كلما توفر اتصال
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/validation.js",
  "./js/locations.js",
  "./img/logo-gold.png",
  "./img/logo-gold.webp",
  "./img/icon-whatsapp.png",
  "./img/icon-android-gold.png",
  "./img/icon-apple-gold.png",
  "./img/icon-facebook.png",
  "./img/icon-tiktok.png",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/icon-maskable-512.png",
  "./img/apple-touch-icon.png"
];

// ملفات البيانات (الباكدجات والمحافظات) — تتغيّر بشكل متكرر مع تعديلات
// صاحب الموقع، لذلك نطلبها من الشبكة أولًا كي يظهر أي تعديل فورًا،
// وتُستخدم النسخة المخزنة فقط عند انعدام الإنترنت
const NETWORK_FIRST_URLS = ["./data/packages.json", "./data/egypt-locations.json", "./data/booked-dates.json"];

const ALL_PRECACHE_URLS = [...APP_SHELL, ...NETWORK_FIRST_URLS];

// ------------------------------------------------------
// التثبيت: تحميل كل ملفات الموقع في الكاش دفعة واحدة
// ------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ALL_PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ------------------------------------------------------
// التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة، والسيطرة
// الفورية على كل الصفحات المفتوحة بدون انتظار إغلاقها
// ------------------------------------------------------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ------------------------------------------------------
// الجلب: استراتيجية مزدوجة حسب نوع الملف
// ------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // نتعامل فقط مع طلبات GET من نفس أصل الموقع
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  // نقارن بالمسار فقط (بدون أي Query String) عشان نتعرّف صح على طلبات
  // تحديث الباكدجات التلقائي حتى لو معاها ?t=... لمنع أي كاش وسيط
  const requestPath = new URL(request.url).pathname;
  const isNetworkFirst = NETWORK_FIRST_URLS.some((url) => requestPath.endsWith(url.replace("./", "/")));

  event.respondWith(isNetworkFirst ? networkFirst(request) : cacheFirst(request));
});

// مفتاح كاش موحّد بدون أي Query String، عشان طلبات نفس الملف اللي
// بيتغيّر معاها ?t=timestamp (تحديث الباكدجات كل دقيقة) تتخزن كلها
// تحت نفس المفتاح بدل ما تتراكم كإدخالات كاش منفصلة بلا نهاية
function normalizedCacheKey(request) {
  const url = new URL(request.url);
  url.search = "";
  return new Request(url.toString(), { method: "GET" });
}

// الشبكة أولًا: لبيانات الباكدجات والمحافظات، حتى تظهر أي تعديلات
// فورًا لأي زائر متصل بالإنترنت، مع البقاء على الكاش كخطة بديلة بدون نت
async function networkFirst(request) {
  const cacheKey = normalizedCacheKey(request);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(cacheKey, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;
    throw err;
  }
}

// الكاش أولًا: لملفات الهيكل الأساسي، لضمان سرعة فورية وعمل كامل
// بدون إنترنت، مع تحديث الكاش من الشبكة في الخلفية لأي زيارة تالية
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    fetchAndUpdateCache(request);
    return cachedResponse;
  }

  try {
    return await fetchAndUpdateCache(request);
  } catch (err) {
    if (request.mode === "navigate") {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }
    throw err;
  }
}

function fetchAndUpdateCache(request) {
  return fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
    }
    return networkResponse;
  });
}
