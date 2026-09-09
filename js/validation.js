/* =========================================================
   validation.js
   دوال تحقق قابلة لإعادة الاستخدام لنموذج الحجز
   ========================================================= */

/**
 * يتحقق من أن اسم العريس مدخل ويتكون من 3 أجزاء على الأقل
 * @param {string} value
 * @returns {{ valid: boolean, message: string }}
 */
function validateName(value) {
  const trimmed = (value || "").trim().replace(/\s+/g, " ");

  if (!trimmed) {
    return { valid: false, message: "يرجى إدخال اسم العريس ثلاثيًا" };
  }

  const parts = trimmed.split(" ").filter(Boolean);

  if (parts.length < 3) {
    return { valid: false, message: "يرجى إدخال اسم العريس ثلاثيًا" };
  }

  return { valid: true, message: "" };
}

/**
 * يتحقق من صحة رقم هاتف مصري محلي (01XXXXXXXXX)
 * @param {string} value
 * @param {string} fieldErrorMessage رسالة الخطأ المخصصة (اختياري)
 * @returns {{ valid: boolean, message: string }}
 */
function validateEgyptianPhone(value, fieldErrorMessage) {
  const trimmed = (value || "").trim();
  const defaultMessage = fieldErrorMessage || "يرجى إدخال رقم هاتف مصري صحيح مكون من 11 رقمًا";
  const egyptianPhoneRegex = /^01[0-9]{9}$/;

  if (!trimmed) {
    return { valid: false, message: defaultMessage };
  }

  if (!/^[0-9]+$/.test(trimmed)) {
    return { valid: false, message: defaultMessage };
  }

  if (!egyptianPhoneRegex.test(trimmed)) {
    return { valid: false, message: defaultMessage };
  }

  return { valid: true, message: "" };
}

/**
 * يتحقق من أن تاريخ الحجز مدخل وليس في الماضي
 * @param {string} value قيمة input[type=date] بصيغة YYYY-MM-DD
 * @returns {{ valid: boolean, message: string }}
 */
function validateDate(value) {
  if (!value) {
    return { valid: false, message: "يرجى اختيار تاريخ الحجز" };
  }

  const selected = new Date(value + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(selected.getTime())) {
    return { valid: false, message: "تاريخ غير صحيح" };
  }

  if (selected < today) {
    return { valid: false, message: "لا يمكن اختيار تاريخ سابق لليوم" };
  }

  return { valid: true, message: "" };
}

/**
 * يتحقق من اختيار محافظة ومدينة
 * @param {string} governorate
 * @param {string} city
 * @returns {{ validGovernorate: boolean, validCity: boolean, governorateMessage: string, cityMessage: string }}
 */
function validateLocation(governorate, city) {
  const validGovernorate = Boolean(governorate);
  const validCity = Boolean(governorate) && Boolean(city);

  return {
    validGovernorate,
    validCity,
    governorateMessage: validGovernorate ? "" : "يرجى اختيار المحافظة",
    cityMessage: validCity ? "" : "يرجى اختيار المدينة"
  };
}

/**
 * يتحقق من كامل بيانات نموذج الحجز في الخطوة الأولى
 * @param {object} data
 * @param {string} data.groomName
 * @param {string} data.phone
 * @param {string} data.whatsapp
 * @param {string} data.bookingDate
 * @param {string} data.governorate
 * @param {string} data.city
 * @returns {{ isValid: boolean, errors: Object.<string, string> }}
 */
function validateBookingForm(data) {
  const errors = {};

  const nameResult = validateName(data.groomName);
  if (!nameResult.valid) errors.groomName = nameResult.message;

  const phoneResult = validateEgyptianPhone(data.phone);
  if (!phoneResult.valid) errors.phone = phoneResult.message;

  const whatsappResult = validateEgyptianPhone(
    data.whatsapp,
    "يرجى إدخال رقم واتساب مصري صحيح مكون من 11 رقمًا"
  );
  if (!whatsappResult.valid) errors.whatsapp = whatsappResult.message;

  const dateResult = validateDate(data.bookingDate);
  if (!dateResult.valid) errors.bookingDate = dateResult.message;

  const locationResult = validateLocation(data.governorate, data.city);
  if (!locationResult.validGovernorate) errors.governorate = locationResult.governorateMessage;
  if (!locationResult.validCity) errors.city = locationResult.cityMessage;

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * يحول رقم هاتف مصري محلي (01XXXXXXXXX) إلى الصيغة الدولية (201XXXXXXXXX)
 * @param {string} localNumber
 * @returns {string}
 */
function toInternationalEgyptianNumber(localNumber) {
  const trimmed = (localNumber || "").trim();
  if (!/^01[0-9]{9}$/.test(trimmed)) return trimmed;
  return "20" + trimmed.slice(1);
}
