/* =========================================================
   locations.js
   تحميل بيانات المحافظات والمدن المصرية وإدارة القوائم المنسدلة
   ========================================================= */

const LOCATIONS_JSON_PATH = "./data/egypt-locations.json";

/**
 * يحمّل ملف بيانات المحافظات والمدن
 * @returns {Promise<Array>} مصفوفة المحافظات
 */
async function loadLocations() {
  let response;

  try {
    response = await fetch(LOCATIONS_JSON_PATH);
  } catch (networkError) {
    console.error("تعذر الاتصال أثناء تحميل بيانات المحافظات والمدن:", networkError);
    throw new Error("تعذر تحميل بيانات المحافظات والمدن، يرجى إعادة تحميل الصفحة.");
  }

  if (!response.ok) {
    console.error("استجابة غير ناجحة عند تحميل بيانات المحافظات والمدن:", response.status);
    throw new Error("تعذر تحميل بيانات المحافظات والمدن، يرجى إعادة تحميل الصفحة.");
  }

  let json;
  try {
    json = await response.json();
  } catch (parseError) {
    console.error("خطأ في تحليل بيانات المحافظات والمدن:", parseError);
    throw new Error("تعذر تحميل بيانات المحافظات والمدن، يرجى إعادة تحميل الصفحة.");
  }

  if (!json || !Array.isArray(json.locations) || json.locations.length === 0) {
    console.error("بيانات المحافظات والمدن فارغة أو غير صحيحة:", json);
    throw new Error("تعذر تحميل بيانات المحافظات والمدن، يرجى إعادة تحميل الصفحة.");
  }

  return json.locations;
}

/**
 * يملأ قائمة المحافظات المنسدلة
 * @param {HTMLSelectElement} selectEl
 * @param {Array} locations
 */
function populateGovernorateSelect(selectEl, locations) {
  const placeholder = selectEl.querySelector("option[value='']");
  selectEl.innerHTML = "";

  if (placeholder) {
    selectEl.appendChild(placeholder);
  } else {
    const opt = document.createElement("option");
    opt.value = "";
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = "اختر المحافظة";
    selectEl.appendChild(opt);
  }

  locations.forEach((gov) => {
    const option = document.createElement("option");
    option.value = gov.id;
    option.textContent = gov.name;
    selectEl.appendChild(option);
  });
}

/**
 * يملأ قائمة المدن المنسدلة بناءً على المحافظة المختارة
 * @param {HTMLSelectElement} selectEl
 * @param {Array} locations
 * @param {string} governorateId
 */
function populateCitySelect(selectEl, locations, governorateId) {
  selectEl.innerHTML = "";

  const placeholderOpt = document.createElement("option");
  placeholderOpt.value = "";
  placeholderOpt.disabled = true;
  placeholderOpt.selected = true;
  placeholderOpt.textContent = "اختر المدينة";
  selectEl.appendChild(placeholderOpt);

  const governorate = locations.find((gov) => gov.id === governorateId);

  if (!governorate) {
    selectEl.disabled = true;
    return;
  }

  governorate.cities.forEach((city) => {
    const option = document.createElement("option");
    option.value = city.id;
    option.textContent = city.name;
    selectEl.appendChild(option);
  });

  selectEl.disabled = false;
}

/**
 * يبحث عن اسم المحافظة والمدينة بالـ id لعرضها في الملخص أو رسالة واتساب
 * @param {Array} locations
 * @param {string} governorateId
 * @param {string} cityId
 * @returns {{ governorateName: string, cityName: string }}
 */
function getLocationNames(locations, governorateId, cityId) {
  const governorate = locations.find((gov) => gov.id === governorateId);
  if (!governorate) return { governorateName: "", cityName: "" };

  const city = governorate.cities.find((c) => c.id === cityId);
  return {
    governorateName: governorate.name,
    cityName: city ? city.name : ""
  };
}
