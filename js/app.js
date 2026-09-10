/* =========================================================
   app.js
   المنطق الرئيسي لتطبيق حجز سيشن الزفاف
   ========================================================= */

(function () {
  "use strict";

  // رقم WhatsApp الخاص بالـPhotography الذي يستقبل الحجوزات
  const BUSINESS_WHATSAPP = "201111714320";

  const PACKAGES_JSON_PATH = "./data/packages.json";

  /** حالة الحجز بالكامل */
  const bookingState = {
    groomName: "",
    phone: "",
    whatsapp: "",
    sameWhatsapp: true,
    bookingDate: "",
    governorate: "",
    city: "",
    selectedPackage: null
  };

  /** بيانات محملة من JSON */
  let locationsData = [];
  let packagesData = [];
  let currentStep = 1;
  let openPackageId = null;

  // ------------------------------------------------------
  // مراجع DOM
  // ------------------------------------------------------
  const els = {
    progressSteps: document.querySelectorAll(".progress-step"),
    installAppBtn: document.getElementById("installAppBtn"),

    form: document.getElementById("bookingForm"),
    groomName: document.getElementById("groomName"),
    groomNameError: document.getElementById("groomName-error"),
    phone: document.getElementById("phone"),
    phoneError: document.getElementById("phone-error"),
    whatsapp: document.getElementById("whatsapp"),
    whatsappError: document.getElementById("whatsapp-error"),
    sameWhatsapp: document.getElementById("sameWhatsapp"),
    bookingDate: document.getElementById("bookingDate"),
    bookingDateError: document.getElementById("bookingDate-error"),
    governorate: document.getElementById("governorate"),
    governorateError: document.getElementById("governorate-error"),
    city: document.getElementById("city"),
    cityError: document.getElementById("city-error"),
    locationsStatus: document.getElementById("locationsStatus"),
    requestSessionBtn: document.getElementById("requestSessionBtn"),

    step1: document.getElementById("step1"),
    step2: document.getElementById("step2"),
    step3: document.getElementById("step3"),

    packagesStatus: document.getElementById("packagesStatus"),
    packagesAccordion: document.getElementById("packagesAccordion"),
    backToStep1: document.getElementById("backToStep1"),

    stickyCta: document.getElementById("stickyCta"),
    stickyCtaLabel: document.getElementById("stickyCtaLabel"),
    stickyCtaPrice: document.getElementById("stickyCtaPrice"),
    confirmWhatsappBtn: document.getElementById("confirmWhatsappBtn"),

    summaryCard: document.getElementById("summaryCard"),
    backToStep2: document.getElementById("backToStep2"),

    toast: document.getElementById("toast")
  };

  const priceFormatter = new Intl.NumberFormat("ar-EG");

  // ------------------------------------------------------
  // أدوات مساعدة عامة
  // ------------------------------------------------------

  function formatPrice(amount) {
    return priceFormatter.format(amount);
  }

  let toastTimer = null;
  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 3200);
  }

  function setFieldError(inputEl, errorEl, message) {
    if (message) {
      inputEl.setAttribute("aria-invalid", "true");
      errorEl.textContent = message;
    } else {
      inputEl.removeAttribute("aria-invalid");
      errorEl.textContent = "";
    }
  }

  function clearAllFieldErrors() {
    setFieldError(els.groomName, els.groomNameError, "");
    setFieldError(els.phone, els.phoneError, "");
    setFieldError(els.whatsapp, els.whatsappError, "");
    setFieldError(els.bookingDate, els.bookingDateError, "");
    setFieldError(els.governorate, els.governorateError, "");
    setFieldError(els.city, els.cityError, "");
  }

  // ------------------------------------------------------
  // التنقل بين الخطوات + مؤشر التقدم
  // ------------------------------------------------------

  function goToStep(stepNumber) {
    currentStep = stepNumber;

    [els.step1, els.step2, els.step3].forEach((section, index) => {
      section.hidden = index + 1 !== stepNumber;
    });

    els.progressSteps.forEach((stepEl) => {
      const num = Number(stepEl.dataset.step);
      stepEl.classList.remove("is-active", "is-complete");
      if (num === stepNumber) {
        stepEl.classList.add("is-active");
      } else if (num < stepNumber) {
        stepEl.classList.add("is-complete");
      }
    });

    els.stickyCta.hidden = stepNumber !== 2 || !bookingState.selectedPackage;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ------------------------------------------------------
  // Step 1 — تحميل المحافظات والمدن
  // ------------------------------------------------------

  async function initLocations() {
    els.locationsStatus.textContent = "جاري تحميل بيانات المحافظات والمدن...";
    els.locationsStatus.dataset.state = "loading";
    els.governorate.disabled = true;

    try {
      locationsData = await loadLocations();
      populateGovernorateSelect(els.governorate, locationsData);
      els.governorate.disabled = false;
      els.locationsStatus.textContent = "";
      els.locationsStatus.removeAttribute("data-state");
    } catch (err) {
      els.locationsStatus.textContent = err.message;
      els.locationsStatus.dataset.state = "error";
    }
  }

  els.governorate.addEventListener("change", () => {
    const govId = els.governorate.value;
    populateCitySelect(els.city, locationsData, govId);
    setFieldError(els.governorate, els.governorateError, "");
    setFieldError(els.city, els.cityError, "");
  });

  // ------------------------------------------------------
  // Step 1 — checkbox "نفس رقم الاتصال هو رقم الواتساب"
  // ------------------------------------------------------

  function syncWhatsappField() {
    if (els.sameWhatsapp.checked) {
      els.whatsapp.value = els.phone.value;
      els.whatsapp.disabled = true;
      setFieldError(els.whatsapp, els.whatsappError, "");
    } else {
      els.whatsapp.disabled = false;
    }
  }

  els.sameWhatsapp.addEventListener("change", syncWhatsappField);
  els.phone.addEventListener("input", () => {
    if (els.sameWhatsapp.checked) {
      els.whatsapp.value = els.phone.value;
    }
  });

  // تهيئة أولية: الحقل مطابق افتراضيًا بحسب حالة الـcheckbox في HTML
  syncWhatsappField();

  // ------------------------------------------------------
  // Step 1 — تاريخ الحجز: منع اختيار تاريخ سابق
  // ------------------------------------------------------

  function initMinDate() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    els.bookingDate.min = `${yyyy}-${mm}-${dd}`;
  }

  // ------------------------------------------------------
  // Step 1 — إرسال النموذج
  // ------------------------------------------------------

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = {
      groomName: els.groomName.value,
      phone: els.phone.value,
      whatsapp: els.sameWhatsapp.checked ? els.phone.value : els.whatsapp.value,
      bookingDate: els.bookingDate.value,
      governorate: els.governorate.value,
      city: els.city.value
    };

    const result = validateBookingForm(formData);
    clearAllFieldErrors();

    if (!result.isValid) {
      const fieldMap = {
        groomName: [els.groomName, els.groomNameError],
        phone: [els.phone, els.phoneError],
        whatsapp: [els.whatsapp, els.whatsappError],
        bookingDate: [els.bookingDate, els.bookingDateError],
        governorate: [els.governorate, els.governorateError],
        city: [els.city, els.cityError]
      };

      let firstInvalidField = null;

      Object.keys(fieldMap).forEach((key) => {
        if (result.errors[key]) {
          const [inputEl, errorEl] = fieldMap[key];
          setFieldError(inputEl, errorEl, result.errors[key]);
          if (!firstInvalidField) firstInvalidField = inputEl;
        }
      });

      if (firstInvalidField) {
        firstInvalidField.focus();
      }

      showToast("يرجى مراجعة البيانات المدخلة");
      return;
    }

    Object.assign(bookingState, formData);

    goToStep(2);
    ensurePackagesLoaded();
  });

  els.backToStep1.addEventListener("click", () => goToStep(1));
  els.backToStep2.addEventListener("click", () => goToStep(2));

  // ------------------------------------------------------
  // Step 2 — تحميل الباكدجات وبناء الـAccordion
  // ------------------------------------------------------

  let packagesLoaded = false;

  async function ensurePackagesLoaded() {
    if (packagesLoaded) return;

    els.packagesStatus.textContent = "جاري تحميل الباكدجات...";
    els.packagesStatus.removeAttribute("data-state");
    els.packagesAccordion.innerHTML = "";

    let response;
    try {
      response = await fetch(PACKAGES_JSON_PATH);
    } catch (networkError) {
      console.error("تعذر الاتصال أثناء تحميل الباكدجات:", networkError);
      showPackagesError("تعذر تحميل الباكدجات، يرجى إعادة تحميل الصفحة.");
      return;
    }

    if (!response.ok) {
      console.error("استجابة غير ناجحة عند تحميل الباكدجات:", response.status);
      showPackagesError("تعذر تحميل الباكدجات، يرجى إعادة تحميل الصفحة.");
      return;
    }

    let json;
    try {
      json = await response.json();
    } catch (parseError) {
      console.error("خطأ في تحليل بيانات الباكدجات:", parseError);
      showPackagesError("تعذر تحميل الباكدجات، يرجى إعادة تحميل الصفحة.");
      return;
    }

    if (!json || !Array.isArray(json.packages)) {
      console.error("بيانات الباكدجات غير صحيحة:", json);
      showPackagesError("تعذر تحميل الباكدجات، يرجى إعادة تحميل الصفحة.");
      return;
    }

    if (json.packages.length === 0) {
      els.packagesStatus.textContent = "لا توجد باكدجات متاحة حاليًا.";
      return;
    }

    packagesData = json.packages;
    packagesLoaded = true;
    els.packagesStatus.textContent = "";
    renderPackages();
  }

  function showPackagesError(message) {
    els.packagesStatus.textContent = message;
    els.packagesStatus.dataset.state = "error";
  }

  function renderPackages() {
    els.packagesAccordion.innerHTML = "";

    packagesData.forEach((pkg) => {
      const card = document.createElement("div");
      card.className = "package-card";
      card.dataset.packageId = String(pkg.id);

      // ------- Header (button) -------
      const header = document.createElement("button");
      header.type = "button";
      header.className = "package-header";
      header.setAttribute("aria-expanded", "false");
      header.setAttribute("aria-controls", `package-panel-${pkg.id}`);

      const indicator = document.createElement("span");
      indicator.className = "package-select-indicator";
      indicator.setAttribute("aria-hidden", "true");

      const titleWrap = document.createElement("span");
      titleWrap.className = "package-title-wrap";

      const nameRow = document.createElement("span");
      nameRow.className = "package-name-row";

      const nameEl = document.createElement("span");
      nameEl.className = "package-name";
      nameEl.textContent = pkg.name;
      nameRow.appendChild(nameEl);

      if (pkg.popular) {
        const badge = document.createElement("span");
        badge.className = "package-badge";
        badge.textContent = "الأكثر طلبًا";
        nameRow.appendChild(badge);
      }

      const priceEl = document.createElement("span");
      priceEl.className = "package-price";
      priceEl.textContent = `${formatPrice(pkg.price)} ${pkg.currency}`;

      titleWrap.appendChild(nameRow);
      titleWrap.appendChild(priceEl);

      const chevron = document.createElement("span");
      chevron.className = "package-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.innerHTML =
        '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4.5 7l4.5 4.5L13.5 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      header.appendChild(indicator);
      header.appendChild(titleWrap);
      header.appendChild(chevron);

      // ------- Panel (features + select button) -------
      const panel = document.createElement("div");
      panel.className = "package-panel";
      panel.id = `package-panel-${pkg.id}`;

      const panelInner = document.createElement("div");
      panelInner.className = "package-panel-inner";

      const body = document.createElement("div");
      body.className = "package-body";

      const featuresList = document.createElement("ul");
      featuresList.className = "package-features";
      pkg.features.forEach((feature) => {
        const li = document.createElement("li");
        li.textContent = feature;
        featuresList.appendChild(li);
      });

      const selectBtn = document.createElement("button");
      selectBtn.type = "button";
      selectBtn.className = "btn btn-primary package-select-btn";
      selectBtn.textContent = "اختيار هذه الباكدج";

      body.appendChild(featuresList);
      body.appendChild(selectBtn);
      panelInner.appendChild(body);
      panel.appendChild(panelInner);

      card.appendChild(header);
      card.appendChild(panel);
      els.packagesAccordion.appendChild(card);

      header.addEventListener("click", () => toggleAccordion(pkg.id));
      selectBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        selectPackage(pkg.id);
      });
    });
  }

  function toggleAccordion(packageId) {
    const willOpen = openPackageId !== packageId;
    openPackageId = willOpen ? packageId : null;

    document.querySelectorAll(".package-card").forEach((card) => {
      const id = Number(card.dataset.packageId);
      const isOpen = id === openPackageId;
      card.classList.toggle("is-open", isOpen);
      const headerBtn = card.querySelector(".package-header");
      headerBtn.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function selectPackage(packageId) {
    const pkg = packagesData.find((p) => p.id === packageId);
    if (!pkg) return;

    bookingState.selectedPackage = pkg;

    document.querySelectorAll(".package-card").forEach((card) => {
      const id = Number(card.dataset.packageId);
      card.classList.toggle("is-selected", id === packageId);
    });

    updateStickyCta();
  }

  function updateStickyCta() {
    const pkg = bookingState.selectedPackage;

    if (!pkg) {
      els.stickyCta.hidden = true;
      els.confirmWhatsappBtn.disabled = true;
      return;
    }

    els.stickyCta.hidden = currentStep !== 2;
    els.stickyCtaLabel.textContent = `الباكدج المختارة: ${pkg.name}`;
    els.stickyCtaPrice.textContent = `${formatPrice(pkg.price)} ${pkg.currency}`;
    els.confirmWhatsappBtn.disabled = false;
  }

  // ------------------------------------------------------
  // Step 3 — ملخص الحجز + WhatsApp
  // ------------------------------------------------------

  function renderSummary() {
    const pkg = bookingState.selectedPackage;
    const { governorateName, cityName } = getLocationNames(
      locationsData,
      bookingState.governorate,
      bookingState.city
    );

    els.summaryCard.innerHTML = "";

    // بيانات العريس
    const groomBlock = document.createElement("div");
    groomBlock.className = "summary-block";
    const groomTitle = document.createElement("h3");
    groomTitle.textContent = "بيانات العريس";
    groomBlock.appendChild(groomTitle);

    groomBlock.appendChild(summaryRow("اسم العريس", bookingState.groomName));
    groomBlock.appendChild(summaryRow("رقم الهاتف للاتصال", bookingState.phone));
    groomBlock.appendChild(summaryRow("رقم الواتساب", bookingState.whatsapp));

    // تفاصيل الحجز
    const detailsBlock = document.createElement("div");
    detailsBlock.className = "summary-block";
    const detailsTitle = document.createElement("h3");
    detailsTitle.textContent = "تفاصيل الحجز";
    detailsBlock.appendChild(detailsTitle);

    detailsBlock.appendChild(summaryRow("تاريخ الحجز", formatDateArabic(bookingState.bookingDate)));
    detailsBlock.appendChild(summaryRow("مكان الفرح", `${governorateName} - ${cityName}`));

    // الباكدج
    const packageBlock = document.createElement("div");
    packageBlock.className = "summary-block";
    const packageTitle = document.createElement("h3");
    packageTitle.textContent = "الباكدج المختارة";
    packageBlock.appendChild(packageTitle);

    packageBlock.appendChild(summaryRow("اسم الباكدج", pkg.name));

    const featuresList = document.createElement("ul");
    featuresList.className = "summary-features";
    pkg.features.forEach((feature) => {
      const li = document.createElement("li");
      li.textContent = feature;
      featuresList.appendChild(li);
    });
    packageBlock.appendChild(featuresList);

    const totalRow = document.createElement("div");
    totalRow.className = "summary-total";
    const totalLabel = document.createElement("span");
    totalLabel.className = "summary-total-label";
    totalLabel.textContent = "السعر الإجمالي";
    const totalPrice = document.createElement("span");
    totalPrice.className = "summary-total-price";
    totalPrice.textContent = `${formatPrice(pkg.price)} ${pkg.currency}`;
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalPrice);
    packageBlock.appendChild(totalRow);

    els.summaryCard.appendChild(groomBlock);
    els.summaryCard.appendChild(detailsBlock);
    els.summaryCard.appendChild(packageBlock);
  }

  function summaryRow(label, value) {
    const row = document.createElement("div");
    row.className = "summary-row";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("span");
    valueEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valueEl);
    return row;
  }

  function formatDateArabic(isoDate) {
    if (!isoDate) return "";
    const date = new Date(isoDate + "T00:00:00");
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(date);
  }

  function buildWhatsappMessage() {
    const pkg = bookingState.selectedPackage;
    const { governorateName, cityName } = getLocationNames(
      locationsData,
      bookingState.governorate,
      bookingState.city
    );

    const featuresText = pkg.features.map((f) => `- ${f}`).join("\n");

    const message =
      `حجز سيشن زفاف جديد\n\n` +
      `بيانات العريس\n` +
      `اسم العريس: ${bookingState.groomName}\n` +
      `رقم الهاتف للاتصال: ${bookingState.phone}\n` +
      `رقم الواتساب: ${bookingState.whatsapp}\n\n` +
      `تفاصيل الحجز\n` +
      `تاريخ الحجز: ${formatDateArabic(bookingState.bookingDate)}\n` +
      `مكان الفرح: ${governorateName} - ${cityName}\n\n` +
      `الباكدج المختارة\n` +
      `اسم الباكدج: ${pkg.name}\n` +
      `الخدمات:\n${featuresText}\n\n` +
      `السعر الإجمالي: ${formatPrice(pkg.price)} ${pkg.currency}\n\n` +
      `تم إرسال الطلب من موقع حجز سيشن الزفاف.`;

    return message;
  }

  els.confirmWhatsappBtn.addEventListener("click", () => {
    if (!bookingState.selectedPackage) {
      showToast("يرجى اختيار باكدج أولًا");
      return;
    }

    renderSummary();
    goToStep(3);
    els.stickyCta.hidden = true;

    const message = buildWhatsappMessage();
    const whatsappUrl = `https://wa.me/${BUSINESS_WHATSAPP}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  });

  // ------------------------------------------------------
  // تسجيل Service Worker لتفعيل عمل الموقع بدون إنترنت
  // ------------------------------------------------------

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) => {
        console.error("تعذر تسجيل Service Worker:", err);
      });
    });
  }

  // ------------------------------------------------------
  // زر تثبيت التطبيق (PWA Install Prompt)
  // ------------------------------------------------------

  let deferredInstallPrompt = null;

  function isRunningAsInstalledApp() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function initInstallPrompt() {
    if (!els.installAppBtn || isRunningAsInstalledApp()) return;

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      els.installAppBtn.hidden = false;
    });

    els.installAppBtn.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;

      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      els.installAppBtn.hidden = true;
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      els.installAppBtn.hidden = true;
    });
  }

  // ------------------------------------------------------
  // التهيئة الأولية
  // ------------------------------------------------------

  function init() {
    initMinDate();
    initLocations();
    goToStep(1);
    registerServiceWorker();
    initInstallPrompt();
  }

  init();
})();
