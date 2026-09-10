/* =========================================================
   sw.js
   Service Worker — يفعّل عمل الموقع بالكامل بدون إنترنت
   بعد أول زيارة (تحميل التطبيق مرة واحدة أونلاين)
   ========================================================= */

// غيّر هذا الرقم عند تحديث أي ملف من ملفات الموقع لإجبار
// المتصفح على تحميل النسخة الجديدة بدل النسخة المخزنة مسبقًا
const CACHE_VERSION = "v1";
const CACHE_NAME = `am-photography-${CACHE_VERSION}`;

// كل الملفات اللازمة لتشغيل الموقع بالكامل بدون إنترنت
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/validation.js",
  "./js/locations.js",
  "./data/packages.json",
  "./data/egypt-locations.json",
  "./img/logo-gold.png",
  "./img/icon-whatsapp.png",
  "./img/icon-facebook.png",
  "./img/icon-tiktok.png",
  "./img/icon-192.png",
  "./img/icon-512.png",
  "./img/icon-maskable-512.png",
  "./img/apple-touch-icon.png"
];

// ------------------------------------------------------
// التثبيت: تحميل كل ملفات الموقع في الكاش دفعة واحدة
// ------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ------------------------------------------------------
// التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة
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
// الجلب: الكاش أولًا (Cache First) لضمان عمل الموقع
// بالكامل بدون إنترنت، مع تحديث الكاش من الشبكة عند توفرها
// ------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // نتعامل فقط مع طلبات GET من نفس أصل الموقع
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // نحدّث الكاش في الخلفية إن كان هناك اتصال، دون تعطيل العرض الحالي
        fetchAndUpdateCache(request);
        return cachedResponse;
      }

      return fetchAndUpdateCache(request).catch(() => {
        // كحل أخير لطلبات التنقل بين الصفحات بدون إنترنت وبدون كاش مسبق
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      });
    })
  );
});

function fetchAndUpdateCache(request) {
  return fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
      }
      return networkResponse;
    })
    .catch((err) => {
      throw err;
    });
}
