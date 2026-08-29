import {
  calculateFinancialSummary,
  getInvoiceSummary,
  getRecordDate,
  getSiteName,
  isSameSite,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
  normaliseStatus,
} from "./financialReporting";
import {
  dedupeDailyProgressReports,
  getDprTodayDate,
  summariseDailyProgressReports,
} from "./dailyProgressReporting";
import { FIELD_USER_ROLES, STANDARD_ERP_ROLES } from "../auth/authorization";
import { calculateSiteBudgetSummary } from "./siteBudget";

export const NOTIFICATION_SEVERITIES = {
  info: "info",
  warning: "warning",
  critical: "critical",
};

const READ_STORAGE_PREFIX = "apc-erp-notification-read";

const cleanText = (value) => String(value || "").trim();
const cleanRole = (role) => cleanText(role).toLowerCase();

const normaliseId = (value) => cleanText(value).replace(/\s+/g, "-").toLowerCase();

const getRecordLabel = (record = {}, fallback = "Record") =>
  cleanText(
    record.invoiceNo ||
      record.materialName ||
      record.employeeName ||
      record.vehicleNumber ||
      record.vehicleName ||
      record.name ||
      getSiteName(record) ||
      fallback
  );

const getDateValue = (record = {}, fallbackDate = "") =>
  getRecordDate(record) || normaliseDate(record.updatedAt) || fallbackDate;

const addAlert = (alerts, alert) => {
  if (!alert?.id || alerts.some((item) => item.id === alert.id)) return;
  alerts.push(alert);
};

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(normaliseMoney(amount));

const getStrictNonNegativeNumber = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number(
    typeof value === "string" ? value.replace(/[₹,\s]/g, "") : value
  );

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const getExplicitValue = (record, fields) => {
  for (const field of fields) {
    const value = getStrictNonNegativeNumber(record?.[field]);
    if (value !== null) return value;
  }

  return null;
};

const getMaintenanceDueDate = (vehicle = {}) =>
  normaliseDate(
    vehicle.nextMaintenanceDate ||
      vehicle.maintenanceDueDate ||
      vehicle.serviceDueDate ||
      vehicle.nextServiceDate
  );

const orderAlerts = (alerts) => {
  const severityOrder = { critical: 0, warning: 1, info: 2 };

  return [...alerts].sort((first, second) => {
    const severityDifference =
      severityOrder[first.severity] - severityOrder[second.severity];

    if (severityDifference !== 0) return severityDifference;
    return String(second.date || "").localeCompare(String(first.date || ""));
  });
};

const createCoreAlerts = ({
  today,
  invoices = [],
  expenses = [],
  materials = [],
  sites = [],
  siteBudgets = [],
  labours = [],
  attendance = [],
  salaries = [],
  vehicles = [],
  vehicleExpenses = [],
  dailyProgressReports = [],
}) => {
  const alerts = [];

  invoices.forEach((invoice) => {
    if (!invoice || typeof invoice !== "object") return;

    const { pending } = getInvoiceSummary(invoice);
    if (pending <= 0) return;

    const label = getRecordLabel(invoice, "Invoice");
    addAlert(alerts, {
      id: `invoice-pending-${normaliseId(invoice.id || label)}`,
      severity: pending > 0 ? NOTIFICATION_SEVERITIES.warning : NOTIFICATION_SEVERITIES.info,
      title: "Payment pending",
      message: `${label} has ${formatMoney(pending)} pending.`,
      date: getDateValue(invoice, today),
      href: "/invoice",
      module: "Invoice",
    });
  });

  materials.forEach((material) => {
    if (!material || typeof material !== "object") return;

    // A stock alert is only shown when both values are explicitly present.
    // Purchase quantity alone is not stock and must never create a fake alert.
    const stock = getExplicitValue(material, [
      "currentStock",
      "stockQuantity",
      "availableQuantity",
      "availableStock",
    ]);
    const threshold = getExplicitValue(material, [
      "lowStockThreshold",
      "reorderLevel",
      "minimumStock",
      "minStock",
    ]);

    if (stock === null || threshold === null || stock > threshold) return;

    const label = getRecordLabel(material, "Material");
    addAlert(alerts, {
      id: `material-low-stock-${normaliseId(material.id || label)}`,
      severity:
        stock === 0 ? NOTIFICATION_SEVERITIES.critical : NOTIFICATION_SEVERITIES.warning,
      title: "Low material stock",
      message: `${label} has ${stock} remaining (reorder level ${threshold}).`,
      date: getDateValue(material, today),
      href: "/materials",
      module: "Materials",
    });
  });

  const todayReports = dedupeDailyProgressReports(dailyProgressReports).filter(
    (report) => normaliseDate(report?.date) === today
  );
  const submittedSiteKeys = new Set(
    todayReports
      .map((report) => normaliseSiteName(getSiteName(report)).toLowerCase())
      .filter(Boolean)
  );

  sites.forEach((site) => {
    if (!site || typeof site !== "object") return;

    const siteName = getSiteName(site) || cleanText(site.name);
    const siteKey = normaliseSiteName(siteName).toLowerCase();
    if (!siteKey || submittedSiteKeys.has(siteKey)) return;

    // The comparison keeps legacy site spelling/casing compatible.
    if (todayReports.some((report) => isSameSite(report, siteName))) return;

    addAlert(alerts, {
      id: `dpr-missing-${normaliseId(site.id || siteName)}-${today}`,
      severity: NOTIFICATION_SEVERITIES.warning,
      title: "Today’s DPR is pending",
      message: `${siteName} has not submitted a Daily Progress Report today.`,
      date: today,
      href: "/daily-progress-report",
      module: "Daily Progress Report",
      site: siteName,
    });
  });

  sites.forEach((site) => {
    if (!site || typeof site !== "object") return;

    const siteName = getSiteName(site) || cleanText(site.name);
    if (!siteName) return;

    // Actual cost always comes from the canonical financial summary. This
    // keeps a budget alert aligned with Dashboard, Reports, and SiteDetails.
    const financialSummary = calculateFinancialSummary({
      invoices: invoices.filter((item) => isSameSite(item, siteName)),
      expenses: expenses.filter((item) => isSameSite(item, siteName)),
      materials: materials.filter((item) => isSameSite(item, siteName)),
      labours: labours.filter((item) => isSameSite(item, siteName)),
      salaries: salaries.filter((item) => isSameSite(item, siteName)),
      attendance: attendance.filter((item) => isSameSite(item, siteName)),
      vehicles: vehicles.filter((item) => isSameSite(item, siteName)),
      vehicleExpenses: vehicleExpenses.filter((item) => isSameSite(item, siteName)),
    });
    const budgetRecord = siteBudgets.find((budget) =>
      budget?.siteId === site.id || budget?.id === site.id
    );
    const budgetSummary = calculateSiteBudgetSummary(
      budgetRecord || site,
      financialSummary
    );

    if (!budgetSummary.hasBudget || budgetSummary.actualCost <= 0) return;

    let title = "";
    let severity = NOTIFICATION_SEVERITIES.warning;
    if (budgetSummary.status === "over-budget") {
      title = "Site budget exceeded";
      severity = NOTIFICATION_SEVERITIES.critical;
    } else if (budgetSummary.status === "critical") {
      title = "Site budget is 90% used";
      severity = NOTIFICATION_SEVERITIES.critical;
    } else if (budgetSummary.status === "warning") {
      title = "Site budget is 80% used";
    } else {
      return;
    }

    addAlert(alerts, {
      id: `site-budget-${budgetSummary.status}-${normaliseId(site.id || siteName)}`,
      severity,
      title,
      message:
        budgetSummary.status === "over-budget"
          ? `${siteName} is over budget by ${formatMoney(budgetSummary.overBudgetAmount)}.`
          : `${siteName} has used ${formatMoney(budgetSummary.actualCost)} of ${formatMoney(budgetSummary.totalBudget)}.`,
      date: today,
      href: site.id ? `/site-details/${site.id}` : "/sites",
      module: "Site Budget",
      site: siteName,
    });
  });

  attendance.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (normaliseDate(entry.date) !== today) return;

    const status = normaliseStatus(entry.status);
    if (!["absent", "leave", "late"].includes(status)) return;

    const label = getRecordLabel(entry, "Labour");
    addAlert(alerts, {
      id: `attendance-${status}-${normaliseId(entry.id || `${label}-${getSiteName(entry)}`)}-${today}`,
      severity:
        status === "absent"
          ? NOTIFICATION_SEVERITIES.warning
          : NOTIFICATION_SEVERITIES.info,
      title: "Attendance needs attention",
      message: `${label} is marked ${status} today.`,
      date: today,
      href: "/attendance",
      module: "Attendance",
      site: getSiteName(entry),
    });
  });

  salaries.forEach((salary) => {
    if (!salary || typeof salary !== "object") return;

    const status = normaliseStatus(salary.status);
    const pendingAmount = getExplicitValue(salary, ["pendingAmount", "balanceAmount"]);
    if (!(["pending", "unpaid", "partial"].includes(status) || pendingAmount > 0)) {
      return;
    }

    const label = getRecordLabel(salary, "Salary payment");
    const amount = pendingAmount ?? normaliseMoney(salary.salary || salary.amount);
    addAlert(alerts, {
      id: `salary-pending-${normaliseId(salary.id || `${label}-${salary.month || ""}`)}`,
      severity: NOTIFICATION_SEVERITIES.warning,
      title: "Salary payment pending",
      message:
        amount > 0
          ? `${label} has ${formatMoney(amount)} awaiting payment.`
          : `${label} is marked as awaiting payment.`,
      date: getDateValue(salary, today),
      href: "/salary",
      module: "Salary",
      site: getSiteName(salary),
    });
  });

  vehicles.forEach((vehicle) => {
    if (!vehicle || typeof vehicle !== "object") return;

    const label = getRecordLabel(vehicle, "Vehicle");
    const maintenanceDueDate = getMaintenanceDueDate(vehicle);
    const status = normaliseStatus(vehicle.status);
    const maintenanceRequired = status === "maintenance";
    const maintenanceOverdue = maintenanceDueDate && maintenanceDueDate <= today;

    if (!maintenanceRequired && !maintenanceOverdue) return;

    addAlert(alerts, {
      id: `vehicle-maintenance-${normaliseId(vehicle.id || label)}-${maintenanceDueDate || status}`,
      severity: maintenanceOverdue
        ? NOTIFICATION_SEVERITIES.critical
        : NOTIFICATION_SEVERITIES.warning,
      title: "Vehicle maintenance reminder",
      message: maintenanceOverdue
        ? `${label} maintenance is due${maintenanceDueDate ? ` since ${maintenanceDueDate}` : ""}.`
        : `${label} is marked for maintenance.`,
      date: maintenanceDueDate || getDateValue(vehicle, today),
      href: "/vehicle",
      module: "Vehicle",
    });
  });

  return alerts;
};

export const generateNotifications = ({
  role = "",
  userId = "",
  today = getDprTodayDate(),
  invoices = [],
  expenses = [],
  materials = [],
  sites = [],
  siteBudgets = [],
  labours = [],
  attendance = [],
  salaries = [],
  vehicles = [],
  vehicleExpenses = [],
  dailyProgressReports = [],
} = {}) => {
  const currentDate = normaliseDate(today) || getDprTodayDate();
  const normalisedRole = cleanRole(role);
  const reports = dedupeDailyProgressReports(dailyProgressReports);

  // Field-only users must never receive finance, stock, attendance, salary, or
  // cross-site information. Their alert is based only on their permitted DPRs.
  if (FIELD_USER_ROLES.includes(normalisedRole)) {
    const ownReports = reports.filter(
      (report) => cleanText(report.createdBy) === cleanText(userId)
    );
    const todaySummary = summariseDailyProgressReports(ownReports, {
      fromDate: currentDate,
      toDate: currentDate,
    });

    if (todaySummary.reportCount > 0) return [];

    return [
      {
        id: `field-dpr-pending-${currentDate}`,
        severity: NOTIFICATION_SEVERITIES.info,
        title: "Today’s site update is pending",
        message: "Submit your Daily Progress Report when today’s work starts or changes.",
        date: currentDate,
        href: "/field-update",
        module: "Field Update",
      },
    ];
  }

  if (!STANDARD_ERP_ROLES.includes(normalisedRole)) return [];

  return orderAlerts(
    createCoreAlerts({
      today: currentDate,
      invoices,
      expenses,
      materials,
      sites,
      siteBudgets,
      labours,
      attendance,
      salaries,
      vehicles,
      vehicleExpenses,
      dailyProgressReports: reports,
    })
  );
};

export const getNotificationStorageKey = (userId = "") =>
  `${READ_STORAGE_PREFIX}:${cleanText(userId)}`;

export const loadReadNotificationIds = (userId = "", storage = window.localStorage) => {
  if (!cleanText(userId) || !storage) return [];

  try {
    const saved = JSON.parse(storage.getItem(getNotificationStorageKey(userId)) || "[]");
    return Array.isArray(saved)
      ? [...new Set(saved.filter((id) => cleanText(id)))]
      : [];
  } catch (error) {
    return [];
  }
};

export const saveReadNotificationIds = (
  userId = "",
  notificationIds = [],
  storage = window.localStorage
) => {
  if (!cleanText(userId) || !storage) return;

  try {
    storage.setItem(
      getNotificationStorageKey(userId),
      JSON.stringify([...new Set(notificationIds.filter((id) => cleanText(id)))])
    );
  } catch (error) {
    // Local read-state is an enhancement only. Storage failures must not
    // affect Firestore data or other ERP workflows.
  }
};

export const getUnreadNotificationCount = (notifications = [], readIds = []) => {
  const readSet = new Set(readIds);
  return notifications.filter((notification) => !readSet.has(notification.id)).length;
};

export const formatNotificationDate = (value) => {
  const date = normaliseDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
};
