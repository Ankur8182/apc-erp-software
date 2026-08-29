import {
  getRecordDate,
  getSiteName,
  isDateInRange,
  isSameSite,
  normaliseDate,
  normaliseSiteName,
} from "./financialReporting";

export const DPR_UNITS = [
  "Nos",
  "m",
  "m²",
  "m³",
  "kg",
  "ton",
  "bag",
  "day",
  "Other",
];

export const createInitialDprForm = () => ({
  date: new Date().toISOString().slice(0, 10),
  site: "",
  workActivity: "",
  workLocation: "",
  quantity: "",
  unit: "Nos",
  manpowerCount: "",
  materialsUsed: "",
  equipmentUsed: "",
  remarks: "",
});

const normaliseText = (value) => String(value || "").trim();

const getFiniteNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const validateDailyProgressReport = (form = {}) => {
  const date = normaliseDate(form.date);
  const site = normaliseSiteName(form.site);
  const workActivity = normaliseText(form.workActivity);
  const workLocation = normaliseText(form.workLocation);
  const unit = normaliseText(form.unit);
  const quantity = getFiniteNumber(form.quantity);
  const manpowerCount = getFiniteNumber(form.manpowerCount);

  if (!date || !site || !workActivity || !workLocation || !unit) {
    return {
      isValid: false,
      error: "Date, Site, Work Activity, Work Location aur Unit bharna zaroori hai.",
    };
  }

  if (quantity === null || quantity <= 0) {
    return {
      isValid: false,
      error: "Quantity 0 se zyada valid number honi chahiye.",
    };
  }

  if (manpowerCount === null || manpowerCount < 0) {
    return {
      isValid: false,
      error: "Manpower Count valid non-negative number hona chahiye.",
    };
  }

  return {
    isValid: true,
    value: {
      date,
      site,
      workActivity,
      workLocation,
      quantity,
      unit,
      manpowerCount,
      materialsUsed: normaliseText(form.materialsUsed),
      equipmentUsed: normaliseText(form.equipmentUsed),
      remarks: normaliseText(form.remarks),
    },
  };
};

export const filterDailyProgressReports = (
  reports = [],
  { search = "", site = "all", fromDate = "", toDate = "" } = {}
) => {
  const searchText = normaliseText(search).toLowerCase();

  return reports.filter((report) => {
    const siteMatched = site === "all" || isSameSite(report, site);
    const dateMatched = isDateInRange(report, fromDate, toDate);

    if (!siteMatched || !dateMatched) return false;
    if (!searchText) return true;

    return [
      report.workActivity,
      report.workLocation,
      report.materialsUsed,
      report.equipmentUsed,
      report.remarks,
      report.site,
    ].some((value) => String(value || "").toLowerCase().includes(searchText));
  });
};

export const sortDailyProgressReports = (reports = []) =>
  [...reports].sort((first, second) =>
    getRecordDate(second).localeCompare(getRecordDate(first))
  );

const getReportIdentity = (report = {}) => {
  const id = normaliseText(report.id);

  if (id) return `id:${id}`;

  // Firestore records always have an id. This fallback only protects summary
  // views from duplicate legacy objects that were assembled outside Firestore.
  return [
    getRecordDate(report),
    normaliseText(getSiteName(report)).toLowerCase(),
    normaliseText(report.workActivity).toLowerCase(),
    normaliseText(report.workLocation).toLowerCase(),
    normaliseText(report.quantity),
    normaliseText(report.unit).toLowerCase(),
    normaliseText(report.manpowerCount),
    normaliseText(report.materialsUsed).toLowerCase(),
    normaliseText(report.equipmentUsed).toLowerCase(),
    normaliseText(report.remarks).toLowerCase(),
  ].join("|");
};

export const dedupeDailyProgressReports = (reports = []) => {
  const reportIds = new Set();

  return (Array.isArray(reports) ? reports : []).filter((report) => {
    if (!report || typeof report !== "object") return false;

    const identity = getReportIdentity(report);

    if (reportIds.has(identity)) return false;

    reportIds.add(identity);
    return true;
  });
};

const getSafeNonNegativeNumber = (value) => {
  const number = getFiniteNumber(value);
  return number !== null && number >= 0 ? number : 0;
};

const getOutputQuantity = (value) => {
  const number = getFiniteNumber(value);
  return number !== null && number > 0 ? number : 0;
};

const getUniqueTextValues = (reports, field) => {
  const values = new Map();

  reports.forEach((report) => {
    const value = normaliseText(report[field]);
    const key = value.toLowerCase();

    if (value && !values.has(key)) values.set(key, value);
  });

  return Array.from(values.values());
};

export const getDprTodayDate = (date = new Date()) => normaliseDate(date);

export const getDailyProgressOperationalSummary = (
  reports = [],
  { date = getDprTodayDate(), site = "", recentLimit = 5 } = {}
) => {
  const selectedDate = normaliseDate(date);
  const uniqueReports = dedupeDailyProgressReports(reports);
  const siteReports = site
    ? uniqueReports.filter((report) => isSameSite(report, site))
    : uniqueReports;
  const todayReports = selectedDate
    ? siteReports.filter((report) =>
        isDateInRange(report, selectedDate, selectedDate)
      )
    : [];
  const outputByUnit = new Map();
  const submittedSites = new Map();

  todayReports.forEach((report) => {
    const siteName = getSiteName(report);
    const siteKey = normaliseText(siteName).toLowerCase();

    if (siteName && !submittedSites.has(siteKey)) {
      submittedSites.set(siteKey, siteName);
    }

    const unit = normaliseText(report.unit);
    const quantity = getOutputQuantity(report.quantity);
    const unitKey = unit.toLowerCase();

    // Quantities are only aggregated within the same reported unit.
    if (unit && quantity > 0) {
      const current = outputByUnit.get(unitKey) || { unit, quantity: 0 };
      current.quantity += quantity;
      outputByUnit.set(unitKey, current);
    }
  });

  return {
    todayCount: todayReports.length,
    todayReports,
    totalManpower: todayReports.reduce(
      (total, report) => total + getSafeNonNegativeNumber(report.manpowerCount),
      0
    ),
    outputByUnit: Array.from(outputByUnit.values()).sort((first, second) =>
      first.unit.localeCompare(second.unit)
    ),
    submittedSites: Array.from(submittedSites.values()).sort((first, second) =>
      first.localeCompare(second)
    ),
    materialsUsed: getUniqueTextValues(todayReports, "materialsUsed"),
    equipmentUsed: getUniqueTextValues(todayReports, "equipmentUsed"),
    recentReports: sortDailyProgressReports(siteReports).slice(0, recentLimit),
  };
};
