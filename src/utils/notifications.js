import {
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
import { calculateProjectFinancialSummary } from "./projectFinancials";
import { summariseInventory } from "./inventory";
import { buildBoqAlerts, getSiteBoqSummary } from "./boqReporting";
import { formatAnalyticsPercent, getBoqPhysicalFinancialAnalytics, getProjectHealth, getRevenueCollectionAnalytics } from "./projectAnalytics";
import { formatBudgetUsagePercent } from "./siteBudget";

export const NOTIFICATION_SEVERITIES = {
  info: "info",
  warning: "warning",
  critical: "critical",
};

const READ_STORAGE_PREFIX = "apc-erp-notification-read";

const cleanText = (value) => String(value || "").trim();
const cleanRole = (role) => cleanText(role).toLowerCase();

const normaliseId = (value) => cleanText(value).replace(/\s+/g, "-").toLowerCase();

const getInventoryAlertIdentity = (item = {}) =>
  `${normaliseSiteName(getSiteName(item)).toLowerCase()}|${
    normaliseSiteName(item.materialName).toLowerCase()
  }`;

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

const getVehicleExpiryAlerts = (vehicle = {}, today = "") => {
  const safeToday = normaliseDate(today);
  if (!safeToday) return [];
  const limit = new Date(`${safeToday}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  const threshold = limit.toISOString().slice(0, 10);
  const fields = [
    ["Insurance", ["insuranceExpiry", "insuranceExpiryDate"]],
    ["Fitness certificate", ["fitnessExpiry", "fitnessExpiryDate"]],
    ["Pollution certificate", ["pollutionExpiry", "pollutionCertificateExpiry", "pucExpiry"]],
    ["Permit", ["permitExpiry", "permitExpiryDate"]],
  ];

  return fields.map(([label, names]) => {
    const date = normaliseDate(names.map((name) => vehicle[name]).find(Boolean));
    if (!date || date > threshold) return null;
    return { label, date, expired: date < safeToday };
  }).filter(Boolean);
};
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
  inventoryItems = [],
  inventoryTransactions = [],
  purchaseRequests = [],
  purchaseOrders = [],
  goodsReceipts = [],
  workOrders = [],
  contractorBills = [],
  raBills = [],
  boqItems = [],
  boqMeasurements = [],
  boqVariations = [],
}) => {
  const alerts = [];
  buildBoqAlerts({ items: boqItems, measurements: boqMeasurements, variations: boqVariations, raBills }).forEach((alert) => addAlert(alerts, { ...alert, module: "BOQ" }));

  const inventorySummary = summariseInventory(
    inventoryItems,
    inventoryTransactions,
    dailyProgressReports
  );
  const trackedInventoryIdentities = new Set(
    inventorySummary.rows.map((item) => getInventoryAlertIdentity(item))
  );

  inventorySummary.rows.forEach((item) => {
    if (item.status === "available") return;

    const outOfStock = item.status === "out";
    const label = item.materialName || "Material";
    const siteName = getSiteName(item) || "this site";
    addAlert(alerts, {
      id: `inventory-${item.status}-${normaliseId(item.id || item.itemKey || label)}`,
      severity: outOfStock
        ? NOTIFICATION_SEVERITIES.critical
        : NOTIFICATION_SEVERITIES.warning,
      title: outOfStock ? "Material out of stock" : "Low material stock",
      message: outOfStock
        ? `${label} is out of stock at ${siteName}.`
        : `${label} has ${item.currentStock} ${item.unit || "units"} available at ${siteName} (reorder level ${item.reorderLevel}).`,
      date: getDateValue(item, today),
      href: "/inventory",
      module: "Inventory",
    });
  });

  (Array.isArray(purchaseRequests) ? purchaseRequests : []).forEach((request) => {
    if (!request || typeof request !== "object") return;
    const status = normaliseStatus(request.status);
    const label = request.requestNumber || "Purchase request";

    if (status === "pending approval") {
      addAlert(alerts, {
        id: `purchase-request-pending-${normaliseId(request.id || label)}`,
        severity: NOTIFICATION_SEVERITIES.warning,
        title: "Purchase request awaiting approval",
        message: `${label} for ${getSiteName(request) || "a site"} is pending approval.`,
        date: getDateValue(request, today),
        href: "/purchase-requests",
        module: "Purchase Request",
        site: getSiteName(request),
      });
      return;
    }

    if (["approved", "rejected"].includes(status) && normaliseDate(request.updatedAt) === today) {
      addAlert(alerts, {
        id: `purchase-request-${status}-${normaliseId(request.id || label)}-${today}`,
        severity: status === "approved" ? NOTIFICATION_SEVERITIES.info : NOTIFICATION_SEVERITIES.warning,
        title: status === "approved" ? "Purchase request approved" : "Purchase request rejected",
        message: `${label} has been ${status}.`,
        date: today,
        href: "/purchase-requests",
        module: "Purchase Request",
        site: getSiteName(request),
      });
    }
  });

  (Array.isArray(purchaseOrders) ? purchaseOrders : []).forEach((order) => {
    if (!order || typeof order !== "object") return;
    const status = normaliseStatus(order.status);
    if (!["issued", "partially received"].includes(status)) return;
    const label = order.poNumber || "Purchase order";
    const expectedDate = normaliseDate(order.expectedDeliveryDate);
    const overdue = expectedDate && expectedDate < today;
    addAlert(alerts, {
      id: `purchase-order-delivery-${normaliseId(order.id || label)}`,
      severity: overdue ? NOTIFICATION_SEVERITIES.critical : NOTIFICATION_SEVERITIES.info,
      title: overdue ? "Purchase delivery overdue" : "Purchase order awaiting delivery",
      message: overdue
        ? `${label} was expected on ${expectedDate}.`
        : `${label} is ${status} and awaiting delivery.`,
      date: expectedDate || getDateValue(order, today),
      href: "/goods-receipts",
      module: "Purchase Order",
      site: getSiteName(order),
    });

    const outstanding = normaliseMoney(order.outstandingAmount);
    if (outstanding <= 0) return;
    addAlert(alerts, {
      id: `vendor-outstanding-${normaliseId(order.id || label)}`,
      severity: NOTIFICATION_SEVERITIES.warning,
      title: "Vendor payment outstanding",
      message: `${order.vendorName || "Vendor"} has ${formatMoney(outstanding)} outstanding for ${label}.`,
      date: getDateValue(order, today),
      href: "/vendors",
      module: "Vendor",
      site: getSiteName(order),
    });
  });

  (Array.isArray(goodsReceipts) ? goodsReceipts : []).forEach((receipt) => {
    if (!receipt || typeof receipt !== "object" || normaliseDate(receipt.receiptDate) !== today) return;
    const label = receipt.grnNumber || "Goods receipt";
    addAlert(alerts, {
      id: `goods-receipt-completed-${normaliseId(receipt.id || label)}`,
      severity: NOTIFICATION_SEVERITIES.info,
      title: "Goods receipt completed",
      message: `${label} recorded ${receipt.acceptedQuantity || 0} ${receipt.unit || "units"} accepted for ${receipt.materialName || "material"}.`,
      date: receipt.receiptDate,
      href: "/goods-receipts",
      module: "Goods Receipt",
      site: getSiteName(receipt),
    });
  });

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

    // A tracked inventory item is the preferred stock source. Do not create a
    // second alert from a legacy material-level stock field for the same site.
    if (trackedInventoryIdentities.has(getInventoryAlertIdentity(material))) return;

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

    // The shared project summary keeps Dashboard, Reports, SiteDetails, and
    // notifications on the identical cost/revenue classification.
    const budgetRecord = siteBudgets.find((budget) =>
      budget?.siteId === site.id || budget?.id === site.id || isSameSite(budget, siteName)
    );
    const siteRABills = raBills.filter((item) => isSameSite(item, siteName));
    const financialSummary = calculateProjectFinancialSummary({
      budgetRecord: budgetRecord || site,
      invoices: invoices.filter((item) => isSameSite(item, siteName)),
      expenses: expenses.filter((item) => isSameSite(item, siteName)),
      materials: materials.filter((item) => isSameSite(item, siteName)),
      labours: labours.filter((item) => isSameSite(item, siteName)),
      salaries: salaries.filter((item) => isSameSite(item, siteName)),
      attendance: attendance.filter((item) => isSameSite(item, siteName)),
      vehicles: vehicles.filter((item) => isSameSite(item, siteName)),
      vehicleExpenses: vehicleExpenses.filter((item) => isSameSite(item, siteName)),
      raBills: siteRABills,
    });
    const budgetSummary = financialSummary.budgetSummary;
    const boqAnalytics = getBoqPhysicalFinancialAnalytics(getSiteBoqSummary({
      site: siteName,
      items: boqItems,
      measurements: boqMeasurements,
      variations: boqVariations,
      raBills: siteRABills,
    }));
    const revenueAnalytics = getRevenueCollectionAnalytics({ financialSummary, raBills: siteRABills, today });
    const health = getProjectHealth({ financialSummary, revenueAnalytics, boqAnalytics });
    const siteHref = site.id ? `/site-details/${site.id}` : "/sites";

    if (budgetSummary.hasBudget && budgetSummary.actualCost > 0) {
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
      }

      if (title) {
        addAlert(alerts, {
          id: `site-budget-${budgetSummary.status}-${normaliseId(site.id || siteName)}`,
          severity,
          title,
          message: budgetSummary.status === "over-budget"
            ? `${siteName} is over budget by ${formatMoney(budgetSummary.overBudgetAmount)}.`
            : `${siteName} has used ${formatMoney(budgetSummary.actualCost)} of ${formatMoney(budgetSummary.totalBudget)}.`,
          date: today,
          href: siteHref,
          module: "Site Budget",
          site: siteName,
        });
      }
    }

    if (financialSummary.revenue > 0 && financialSummary.profit < 0) {
      addAlert(alerts, {
        id: `site-negative-margin-${normaliseId(site.id || siteName)}`,
        severity: NOTIFICATION_SEVERITIES.critical,
        title: "Project is running at a loss",
        message: `${siteName} has ${formatMoney(Math.abs(financialSummary.profit))} more actual cost than recognized revenue.`,
        date: today,
        href: siteHref,
        module: "Project Financials",
        site: siteName,
      });
    }

    const lossMaking = financialSummary.revenue > 0 && financialSummary.profit < 0;
    const highOutstanding = financialSummary.revenue > 0 && financialSummary.outstanding / financialSummary.revenue >= 0.5;
    if (highOutstanding) {
      addAlert(alerts, {
        id: `site-high-outstanding-${normaliseId(site.id || siteName)}`,
        severity: NOTIFICATION_SEVERITIES.warning,
        title: "High client receivable outstanding",
        message: `${siteName} has ${formatMoney(financialSummary.outstanding)} outstanding against ${formatMoney(financialSummary.revenue)} recognized revenue.`,
        date: today,
        href: siteHref,
        module: "Project Financials",
        site: siteName,
      });
    }
    if (health.costAheadOfPhysical) {
      addAlert(alerts, {
        id: `site-cost-ahead-of-work-${normaliseId(site.id || siteName)}`,
        severity: NOTIFICATION_SEVERITIES.warning,
        title: "Cost progress is ahead of BOQ work",
        message: `${siteName} has used ${formatBudgetUsagePercent(budgetSummary.usagePercent)} of budget against ${formatAnalyticsPercent(boqAnalytics.measuredProgressPercent)} measured BOQ progress.`,
        date: today,
        href: siteHref,
        module: "Project Analytics",
        site: siteName,
      });
    }
    if (health.status === "Critical" && !lossMaking && !budgetSummary.overBudgetAmount && !highOutstanding) {
      addAlert(alerts, {
        id: `site-critical-health-${normaliseId(site.id || siteName)}`,
        severity: NOTIFICATION_SEVERITIES.critical,
        title: "Project health needs review",
        message: `${siteName}: ${health.reasons[0] || "Multiple management risk signals require review."}`,
        date: today,
        href: siteHref,
        module: "Project Analytics",
        site: siteName,
      });
    }
  });
  attendance.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    if (normaliseDate(entry.date) !== today) return;

    const status = normaliseStatus(entry.status);
    const label = getRecordLabel(entry, "Labour");
    if (["absent", "leave", "late"].includes(status)) {
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
    }

    const overtimeHours = normaliseMoney(entry.overtimeHours ?? entry.overtime);
    if (overtimeHours > 8) {
      addAlert(alerts, {
        id: `attendance-overtime-${normaliseId(entry.id || `${label}-${getSiteName(entry)}`)}-${today}`,
        severity: NOTIFICATION_SEVERITIES.warning,
        title: "Unusual overtime reported",
        message: `${label} has ${overtimeHours} overtime hours recorded today.`,
        date: today,
        href: "/attendance",
        module: "Attendance",
        site: getSiteName(entry),
      });
    }
  });

  // One aggregate alert per site avoids notification spam while still making
  // missing daily attendance visible to operations.
  const attendanceKeys = new Set(attendance.filter((entry) => normaliseDate(entry?.date) === today)
    .map((entry) => cleanText(entry.labourId || entry.employeeName || entry.labourName).toLowerCase())
    .filter(Boolean));
  const missingAttendanceBySite = new Map();
  labours.filter((labour) => labour && labour.active !== false && normaliseStatus(labour.status) !== "inactive")
    .forEach((labour) => {
      const labourKey = cleanText(labour.id || labour.name).toLowerCase();
      if (!labourKey || attendanceKeys.has(labourKey)) return;
      const siteName = getSiteName(labour) || "Unassigned site";
      missingAttendanceBySite.set(siteName, (missingAttendanceBySite.get(siteName) || 0) + 1);
    });
  missingAttendanceBySite.forEach((count, siteName) => addAlert(alerts, {
    id: `attendance-missing-${normaliseId(siteName)}-${today}`,
    severity: NOTIFICATION_SEVERITIES.info,
    title: "Attendance not entered",
    message: `${count} active labour ${count === 1 ? "record has" : "records have"} no attendance entry for today at ${siteName}.`,
    date: today,
    href: "/attendance",
    module: "Attendance",
    site: siteName,
  }));

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

  (Array.isArray(workOrders) ? workOrders : []).forEach((order) => {
    if (!order || typeof order !== "object" || !["approved", "active"].includes(normaliseStatus(order.status))) return;
    const dueDate = normaliseDate(order.expectedCompletionDate);
    const label = order.workOrderNumber || "Work order";
    if (dueDate && dueDate < today) {
      addAlert(alerts, {
        id: `work-order-overdue-${normaliseId(order.id || label)}`,
        severity: NOTIFICATION_SEVERITIES.critical,
        title: "Work order completion overdue",
        message: `${label} for ${getSiteName(order) || "a site"} was due on ${dueDate}.`,
        date: dueDate, href: "/work-orders", module: "Work Order", site: getSiteName(order),
      });
    }
  });

  (Array.isArray(contractorBills) ? contractorBills : []).forEach((bill) => {
    if (!bill || typeof bill !== "object") return;
    const pending = normaliseMoney(bill.pendingAmount);
    if (pending <= 0) return;
    const label = bill.billNumber || bill.workOrderNumber || "Contractor bill";
    addAlert(alerts, {
      id: `contractor-bill-pending-${normaliseId(bill.id || label)}`,
      severity: NOTIFICATION_SEVERITIES.warning,
      title: "Contractor payment pending",
      message: `${bill.vendorName || "Contractor"} has ${formatMoney(pending)} pending for ${label}.`,
      date: normaliseDate(bill.billDate) || getDateValue(bill, today),
      href: "/work-orders", module: "Contractor Bill", site: getSiteName(bill),
    });
  });

  (Array.isArray(raBills) ? raBills : []).forEach((bill) => {
    if (!bill || typeof bill !== "object") return;
    const status = normaliseStatus(bill.status);
    const pending = normaliseMoney(bill.pendingAmount);
    const dueDate = normaliseDate(bill.paymentDueDate);
    const label = bill.raBillNumber || "RA bill";
    if (["certified", "partial"].includes(status) && pending > 0 && dueDate && dueDate < today) {
      addAlert(alerts, {
        id: `ra-bill-overdue-${normaliseId(bill.id || label)}`,
        severity: NOTIFICATION_SEVERITIES.critical,
        title: "Client RA payment overdue",
        message: `${label} for ${getSiteName(bill) || "a site"} has ${formatMoney(pending)} overdue since ${dueDate}.`,
        date: dueDate, href: "/client-billing", module: "Client Billing", site: getSiteName(bill),
      });
    }
    if (status === "submitted") {
      addAlert(alerts, {
        id: `ra-bill-submitted-${normaliseId(bill.id || label)}`,
        severity: NOTIFICATION_SEVERITIES.info,
        title: "RA bill awaiting certification",
        message: `${label} for ${getSiteName(bill) || "a site"} is submitted for certification.`,
        date: normaliseDate(bill.billDate) || today, href: "/client-billing", module: "Client Billing", site: getSiteName(bill),
      });
    }
  });
  vehicles.forEach((vehicle) => {
    if (!vehicle || typeof vehicle !== "object") return;

    const label = getRecordLabel(vehicle, "Vehicle");
    const vehicleId = normaliseId(vehicle.id || label);
    const maintenanceDueDate = getMaintenanceDueDate(vehicle);
    const status = normaliseStatus(vehicle.status);
    const maintenanceRequired = ["maintenance", "under maintenance"].includes(status);
    const maintenanceOverdue = maintenanceDueDate && maintenanceDueDate <= today;

    if (status === "breakdown") {
      addAlert(alerts, {
        id: `vehicle-breakdown-${vehicleId}`,
        severity: NOTIFICATION_SEVERITIES.critical,
        title: "Equipment breakdown reported",
        message: `${label} is marked as breakdown and needs operational attention.`,
        date: getDateValue(vehicle, today), href: "/vehicle", module: "Vehicle", site: getSiteName(vehicle),
      });
    }

    if (maintenanceRequired || maintenanceOverdue) {
      addAlert(alerts, {
        id: `vehicle-maintenance-${vehicleId}-${maintenanceDueDate || status}`,
        severity: maintenanceOverdue
          ? NOTIFICATION_SEVERITIES.critical
          : NOTIFICATION_SEVERITIES.warning,
        title: "Vehicle maintenance reminder",
        message: maintenanceOverdue
          ? `${label} maintenance is due${maintenanceDueDate ? ` since ${maintenanceDueDate}` : ""}.`
          : `${label} is marked for maintenance.`,
        date: maintenanceDueDate || getDateValue(vehicle, today),
        href: "/vehicle", module: "Vehicle", site: getSiteName(vehicle),
      });
    }

    getVehicleExpiryAlerts(vehicle, today).forEach((expiry) => {
      addAlert(alerts, {
        id: `vehicle-${normaliseId(expiry.label)}-${vehicleId}-${expiry.date}`,
        severity: expiry.expired ? NOTIFICATION_SEVERITIES.critical : NOTIFICATION_SEVERITIES.warning,
        title: `${expiry.label} ${expiry.expired ? "expired" : "expiry approaching"}`,
        message: expiry.expired
          ? `${label} ${expiry.label.toLowerCase()} expired on ${expiry.date}.`
          : `${label} ${expiry.label.toLowerCase()} expires on ${expiry.date}.`,
        date: expiry.date, href: "/vehicle", module: "Vehicle", site: getSiteName(vehicle),
      });
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
  inventoryItems = [],
  inventoryTransactions = [],
  purchaseRequests = [],
  purchaseOrders = [],
  goodsReceipts = [],
  workOrders = [],
  contractorBills = [],
  raBills = [],
  boqItems = [],
  boqMeasurements = [],
  boqVariations = [],
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
      inventoryItems,
      inventoryTransactions,
      purchaseRequests,
      purchaseOrders,
      goodsReceipts,
      workOrders,
      contractorBills,
      raBills,
      boqItems,
      boqMeasurements,
      boqVariations,
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
