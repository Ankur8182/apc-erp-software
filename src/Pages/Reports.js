import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import ReportExportActions from "../Components/ReportExportActions";
import "../Styles/Reports.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  calculateFinancialSummary,
  getExpenseAmount,
  getRecordDate,
  getSiteName,
  isDateInRange,
  isSameSite,
  normaliseDate,
  toNumber,
} from "../utils/financialReporting";
import {
  getDprUsageValues,
  summariseDailyProgressReports,
} from "../utils/dailyProgressReporting";
import { printReport } from "../utils/reportExporting";
import {
  calculateSiteBudgetSummary,
  formatBudgetUsagePercent,
} from "../utils/siteBudget";
import { summariseInventory } from "../utils/inventory";
import { getProcurementSummary } from "../utils/procurement";

const formatMoney = (amount) => {
  return `₹ ${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const formatExportMoney = (amount) =>
  `INR ${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatInventoryStatus = (status) => {
  if (status === "out") return "Out of Stock";
  if (status === "low") return "Low Stock";
  return "Available";
};

/* =========================================
   REPORTS COMPONENT
========================================= */

function Reports() {
  const [sites, setSites] = useState([]);
  const [siteBudgets, setSiteBudgets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);

  const [selectedSite, setSelectedSite] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [workActivity, setWorkActivity] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [materialFilter, setMaterialFilter] = useState("");
  const [purchaseOrderStatusFilter, setPurchaseOrderStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [dprError, setDprError] = useState("");

  /* =========================================
     LOAD FIREBASE DATA
  ========================================= */

  useEffect(() => {
    const unsubscribers = [];
    const completedCollections = new Set();
    const totalCollections = 17;

    const markCollectionComplete = (collectionName) => {
      completedCollections.add(collectionName);

      if (completedCollections.size === totalCollections) {
        setLoading(false);
      }
    };

    const loadCollection = (
      collectionName,
      setData,
      setCollectionError
    ) => {
      const unsubscribe = onSnapshot(
        collection(db, collectionName),

        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setData(data);
          if (setCollectionError) setCollectionError("");

          markCollectionComplete(collectionName);
        },

        (error) => {
          console.error(
            `Error loading ${collectionName}:`,
            error
          );

          setData([]);
          if (setCollectionError) {
            setCollectionError("Daily progress reports could not be loaded.");
          }

          markCollectionComplete(collectionName);
        }
      );

      unsubscribers.push(unsubscribe);
    };

    loadCollection("sites", setSites);
    loadCollection("siteBudgets", setSiteBudgets);
    loadCollection("invoices", setInvoices);
    loadCollection("expenses", setExpenses);
    loadCollection("materials", setMaterials);
    loadCollection("labours", setLabours);
    loadCollection("salaries", setSalaries);
    loadCollection("attendance", setAttendance);
    loadCollection("vehicles", setVehicles);
    loadCollection("vehicleExpenses", setVehicleExpenses);
    loadCollection(
      "dailyProgressReports",
      setDailyProgressReports,
      setDprError
    );
    loadCollection("inventoryItems", setInventoryItems);
    loadCollection("inventoryTransactions", setInventoryTransactions);
    loadCollection("vendors", setVendors);
    loadCollection("purchaseRequests", setPurchaseRequests);
    loadCollection("purchaseOrders", setPurchaseOrders);
    loadCollection("goodsReceipts", setGoodsReceipts);

    return () => {
      unsubscribers.forEach((unsubscribe) =>
        unsubscribe()
      );
    };
  }, []);

  /* =========================================
     ALL SITE NAMES
  ========================================= */

  const allSiteNames = useMemo(() => {
    const siteMap = new Map();

    const addSite = (name) => {
      const cleanName = String(name || "").trim();

      if (!cleanName) return;

      const key = cleanName.toLowerCase();

      if (!siteMap.has(key)) {
        siteMap.set(key, cleanName);
      }
    };

    sites.forEach((item) => {
      addSite(
        item.siteName ||
          item.name ||
          item.site
      );
    });

    invoices.forEach((item) =>
      addSite(getSiteName(item))
    );

    expenses.forEach((item) =>
      addSite(getSiteName(item))
    );

    materials.forEach((item) =>
      addSite(getSiteName(item))
    );

    labours.forEach((item) =>
      addSite(getSiteName(item))
    );

    salaries.forEach((item) =>
      addSite(getSiteName(item))
    );

    attendance.forEach((item) =>
      addSite(getSiteName(item))
    );

    vehicles.forEach((item) =>
      addSite(getSiteName(item))
    );

    vehicleExpenses.forEach((item) =>
      addSite(getSiteName(item))
    );

    inventoryItems.forEach((item) =>
      addSite(getSiteName(item))
    );

    purchaseRequests.forEach((item) => addSite(getSiteName(item)));
    purchaseOrders.forEach((item) => addSite(getSiteName(item)));
    goodsReceipts.forEach((item) => addSite(getSiteName(item)));

    return Array.from(siteMap.values()).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [
    sites,
    invoices,
    expenses,
    materials,
    labours,
    salaries,
    attendance,
    vehicles,
    vehicleExpenses,
    inventoryItems,
    purchaseRequests,
    purchaseOrders,
    goodsReceipts,
  ]);

  const reportSiteNames = useMemo(() => {
    const siteMap = new Map();

    [...allSiteNames, ...dailyProgressReports.map(getSiteName)].forEach(
      (siteName) => {
        const cleanName = String(siteName || "").trim();
        const siteKey = cleanName.toLowerCase();

        if (cleanName && !siteMap.has(siteKey)) {
          siteMap.set(siteKey, cleanName);
        }
      }
    );

    return Array.from(siteMap.values()).sort((first, second) =>
      first.localeCompare(second)
    );
  }, [allSiteNames, dailyProgressReports]);

  /* =========================================
     COMMON FILTER
  ========================================= */

  const filterRecords = useCallback(
    (data) => data.filter((item) => {
      const siteMatched =
        selectedSite === "all" ||
        isSameSite(item, selectedSite);

      const dateMatched = isDateInRange(
        item,
        fromDate,
        toDate
      );

      return siteMatched && dateMatched;
    }),
    [selectedSite, fromDate, toDate]
  );

  /* =========================================
     FILTERED DATA
  ========================================= */

  const filteredInvoices = useMemo(
    () => filterRecords(invoices),
    [invoices, filterRecords]
  );

  const filteredExpenses = useMemo(
    () => filterRecords(expenses),
    [expenses, filterRecords]
  );

  const filteredMaterials = useMemo(
    () => filterRecords(materials),
    [materials, filterRecords]
  );

  const filteredLabours = useMemo(
    () =>
      labours.filter((item) =>
        selectedSite === "all" ||
        isSameSite(item, selectedSite)
      ),
    [labours, selectedSite]
  );

  const filteredSalaries = useMemo(
    () => filterRecords(salaries),
    [salaries, filterRecords]
  );

  // Payroll covers the worker's whole salary month. Keep that coverage when a
  // narrow date range excludes the payment date, otherwise attendance wages
  // for a salaried worker could be charged again.
  const attendanceSalaryCoverage = useMemo(
    () =>
      salaries.filter(
        (item) => selectedSite === "all" || isSameSite(item, selectedSite)
      ),
    [salaries, selectedSite]
  );

  const filteredAttendance = useMemo(
    () => filterRecords(attendance),
    [attendance, filterRecords]
  );

  const filteredVehicles = useMemo(
    () => filterRecords(vehicles),
    [vehicles, filterRecords]
  );

  const filteredVehicleExpenses = useMemo(
    () => filterRecords(vehicleExpenses),
    [vehicleExpenses, filterRecords]
  );

  const dprSummary = useMemo(
    () =>
      summariseDailyProgressReports(dailyProgressReports, {
        site: selectedSite,
        fromDate,
        toDate,
        workActivity,
      }),
    [dailyProgressReports, selectedSite, fromDate, toDate, workActivity]
  );

  // Inventory is a current stock position, not a historical-cost report. The
  // selected site narrows it; date filters intentionally do not change stock.
  const inventorySummary = useMemo(
    () =>
      summariseInventory(inventoryItems, inventoryTransactions, dailyProgressReports, {
        site: selectedSite,
      }),
    [inventoryItems, inventoryTransactions, dailyProgressReports, selectedSite]
  );

  const filteredPurchaseOrders = useMemo(
    () => purchaseOrders.filter((order) => {
      const orderDate = normaliseDate(order.poDate || order.date || order.createdAt);
      const siteMatched = selectedSite === "all" || isSameSite(order, selectedSite);
      const dateMatched = (!fromDate || (orderDate && orderDate >= fromDate)) &&
        (!toDate || (orderDate && orderDate <= toDate));
      const vendorMatched = !vendorFilter || order.vendorId === vendorFilter;
      const statusMatched = !purchaseOrderStatusFilter || String(order.status || "").toLowerCase() === purchaseOrderStatusFilter;
      const materialMatched = !materialFilter || (order.items || []).some((item) =>
        String(item.materialName || "").toLowerCase().includes(materialFilter.toLowerCase())
      );
      return siteMatched && dateMatched && vendorMatched && statusMatched && materialMatched;
    }),
    [purchaseOrders, selectedSite, fromDate, toDate, vendorFilter, materialFilter, purchaseOrderStatusFilter]
  );

  const filteredPurchaseRequests = useMemo(
    () => purchaseRequests.filter((request) => {
      const date = normaliseDate(request.date || request.createdAt);
      return (selectedSite === "all" || isSameSite(request, selectedSite)) &&
        (!fromDate || (date && date >= fromDate)) && (!toDate || (date && date <= toDate));
    }),
    [purchaseRequests, selectedSite, fromDate, toDate]
  );

  const filteredGoodsReceipts = useMemo(
    () => goodsReceipts.filter((receipt) => {
      const date = normaliseDate(receipt.receiptDate || receipt.date || receipt.createdAt);
      return (selectedSite === "all" || isSameSite(receipt, selectedSite)) &&
        (!fromDate || (date && date >= fromDate)) && (!toDate || (date && date <= toDate)) &&
        (!vendorFilter || receipt.vendorId === vendorFilter) &&
        (!materialFilter || String(receipt.materialName || "").toLowerCase().includes(materialFilter.toLowerCase()));
    }),
    [goodsReceipts, selectedSite, fromDate, toDate, vendorFilter, materialFilter]
  );

  const procurementSummary = useMemo(
    () => getProcurementSummary(filteredPurchaseRequests, filteredPurchaseOrders, filteredGoodsReceipts),
    [filteredPurchaseRequests, filteredPurchaseOrders, filteredGoodsReceipts]
  );

  const procurementBreakdowns = useMemo(() => {
    const bySite = new Map();
    const byVendor = new Map();
    const byMaterial = new Map();
    const byMonth = new Map();
    const byStatus = new Map();
    filteredPurchaseOrders.forEach((order) => {
      const total = toNumber(order.grandTotal);
      const site = getSiteName(order) || "Unassigned";
      const vendor = order.vendorName || "Unknown vendor";
      const month = normaliseDate(order.poDate || order.date).slice(0, 7) || "Unknown";
      bySite.set(site, (bySite.get(site) || 0) + total);
      byVendor.set(vendor, (byVendor.get(vendor) || 0) + total);
      byMonth.set(month, (byMonth.get(month) || 0) + total);
      const status = order.status || "draft";
      byStatus.set(status, (byStatus.get(status) || 0) + 1);
      (order.items || []).forEach((item) => {
        const material = item.materialName || "Unknown material";
        byMaterial.set(material, (byMaterial.get(material) || 0) + toNumber(item.lineGrandTotal));
      });
    });
    const rows = (map) => Array.from(map, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
    return { bySite: rows(bySite), byVendor: rows(byVendor), byMaterial: rows(byMaterial), byMonth: rows(byMonth), byStatus: rows(byStatus) };
  }, [filteredPurchaseOrders]);

  const vehicleExpenseCoverage = useMemo(
    () =>
      vehicleExpenses.filter(
        (item) => selectedSite === "all" || isSameSite(item, selectedSite)
      ),
    [vehicleExpenses, selectedSite]
  );

  const financialSummary = useMemo(
    () =>
      calculateFinancialSummary({
        invoices: filteredInvoices,
        expenses: filteredExpenses,
        materials: filteredMaterials,
        labours: filteredLabours,
        salaries: filteredSalaries,
        attendance: filteredAttendance,
        attendanceSalaryCoverage,
        vehicles: filteredVehicles,
        vehicleExpenses: filteredVehicleExpenses,
        vehicleExpenseCoverage,
      }),
    [
      filteredInvoices,
      filteredExpenses,
      filteredMaterials,
      filteredLabours,
      filteredSalaries,
      filteredAttendance,
      attendanceSalaryCoverage,
      filteredVehicles,
      filteredVehicleExpenses,
      vehicleExpenseCoverage,
    ]
  );

  /* =========================================
     SITE WISE REPORT
  ========================================= */

  const reportRows = useMemo(() => {
    return allSiteNames
      .map((siteName) => {
        const siteRecords = {
          invoices: filteredInvoices.filter((item) => isSameSite(item, siteName)),
          expenses: filteredExpenses.filter((item) => isSameSite(item, siteName)),
          materials: filteredMaterials.filter((item) => isSameSite(item, siteName)),
          labours: filteredLabours.filter((item) => isSameSite(item, siteName)),
          salaries: filteredSalaries.filter((item) => isSameSite(item, siteName)),
          attendance: filteredAttendance.filter((item) => isSameSite(item, siteName)),
          attendanceSalaryCoverage: salaries.filter((item) =>
            isSameSite(item, siteName)
          ),
          vehicles: filteredVehicles.filter((item) => isSameSite(item, siteName)),
          vehicleExpenses: filteredVehicleExpenses.filter((item) =>
            isSameSite(item, siteName)
          ),
          vehicleExpenseCoverage: vehicleExpenses.filter((item) =>
            isSameSite(item, siteName)
          ),
        };
        const summary = calculateFinancialSummary(siteRecords);
        const siteRecord = sites.find((item) => isSameSite(item, siteName)) || {
          siteName,
        };
        const budgetRecord = siteBudgets.find((item) =>
          item.siteId === siteRecord.id || item.id === siteRecord.id
        );
        const budgetSummary = calculateSiteBudgetSummary(
          budgetRecord || siteRecord,
          summary
        );

        return {
          siteName,
          income: summary.income,
          received: summary.received,
          expense: summary.totalExpense,
          profit: summary.profit,
          budgetSummary,
        };
      })
      .filter((item) => {
        if (selectedSite === "all") {
          return true;
        }

        return (
          item.siteName.toLowerCase() ===
          selectedSite.toLowerCase()
        );
      });
  }, [
    allSiteNames,
    filteredInvoices,
    filteredExpenses,
    filteredMaterials,
    filteredLabours,
    filteredSalaries,
    filteredAttendance,
    filteredVehicles,
    filteredVehicleExpenses,
    salaries,
    vehicleExpenses,
    sites,
    siteBudgets,
    selectedSite,
  ]);

  /* =========================================
     RESET
  ========================================= */

  const handleReset = () => {
    setSelectedSite("all");
    setFromDate("");
    setToDate("");
    setWorkActivity("");
    setVendorFilter("");
    setMaterialFilter("");
    setPurchaseOrderStatusFilter("");
  };

  /* =========================================
     FINANCIAL CARDS
  ========================================= */

  const financialCards = [
    {
      title: "Total Income",
      value: financialSummary.income,
      icon: "💰",
      className: "income-card",
    },
    {
      title: "Total Received",
      value: financialSummary.received,
      icon: "💵",
      className: "received-card",
    },
    {
      title: "Pending Payment",
      value: financialSummary.pending,
      icon: "⏳",
      className: "pending-card",
    },
    {
      title: "Material Expense",
      value: financialSummary.materialExpense,
      icon: "📦",
      className: "material-card",
    },
    {
      title: "Labour Expense",
      value: financialSummary.labourExpense,
      icon: "👷",
      className: "labour-card",
    },
    {
      title: "Other Expense",
      value: financialSummary.otherExpense,
      icon: "🛠️",
      className: "other-card",
    },
    {
      title: "Total Expense",
      value: financialSummary.totalExpense,
      icon: "📉",
      className: "expense-card",
    },
    {
      title:
        financialSummary.profit >= 0
          ? "Net Profit"
          : "Net Loss",

      value: Math.abs(financialSummary.profit),

      icon:
        financialSummary.profit >= 0
          ? "📈"
          : "📉",

      className:
        financialSummary.profit >= 0
          ? "profit-card"
          : "loss-card",
    },
  ];

  const baseExportFilters = [
    { label: "Site", value: selectedSite === "all" ? "All Sites" : selectedSite },
    { label: "From Date", value: fromDate || "All Dates" },
    { label: "To Date", value: toDate || "All Dates" },
  ];
  const dprExportFilters = [
    ...baseExportFilters,
    { label: "Work Activity", value: workActivity || "All Activities" },
  ];

  const financialSummaryExport = {
    title: "Financial Summary",
    filters: baseExportFilters,
    summary: financialCards.map((card) => ({
      label: card.title,
      value: formatExportMoney(card.value),
    })),
    columns: [
      { key: "metric", label: "Metric", width: 1.6 },
      { key: "amount", label: "Amount (INR)", format: formatExportMoney },
    ],
    rows: financialCards.map((card) => ({
      metric: card.title,
      amount: card.value,
    })),
  };

  const siteFinancialExport = {
    title: "Site-wise Financial Report",
    filters: baseExportFilters,
    summary: [
      { label: "Sites", value: reportRows.length },
      { label: "Total Income", value: formatExportMoney(financialSummary.income) },
      { label: "Total Received", value: formatExportMoney(financialSummary.received) },
      { label: "Total Expense", value: formatExportMoney(financialSummary.totalExpense) },
      { label: financialSummary.profit >= 0 ? "Net Profit" : "Net Loss", value: formatExportMoney(Math.abs(financialSummary.profit)) },
    ],
    columns: [
      { key: "siteName", label: "Site", width: 1.5 },
      { key: "income", label: "Income (INR)", format: formatExportMoney },
      { key: "received", label: "Received (INR)", format: formatExportMoney },
      { key: "expense", label: "Expense (INR)", format: formatExportMoney },
      { key: "budget", label: "Budget", width: 1.1 },
      { key: "budgetUsed", label: "Budget Used" },
      { key: "remainingBudget", label: "Remaining Budget", width: 1.15 },
      { key: "profit", label: "Profit / Loss (INR)", format: formatExportMoney },
    ],
    rows: reportRows.map((row) => ({
      ...row,
      budget: row.budgetSummary.hasBudget
        ? formatExportMoney(row.budgetSummary.totalBudget)
        : "Not set",
      budgetUsed: row.budgetSummary.hasBudget
        ? formatBudgetUsagePercent(row.budgetSummary.usagePercent)
        : "Not set",
      remainingBudget: row.budgetSummary.hasBudget
        ? formatExportMoney(row.budgetSummary.remainingBudget)
        : "Not set",
    })),
  };

  const dprExport = {
    title: "Daily Progress Report",
    filters: dprExportFilters,
    summary: [
      { label: "DPR Count", value: dprSummary.reportCount },
      { label: "Total Manpower", value: dprSummary.manpowerTotal },
      { label: "Sites Reported", value: dprSummary.submittedSites.length },
      { label: "Output by Unit", value: dprSummary.outputByUnit.map((item) => `${item.quantity} ${item.unit}`).join("; ") || "No output reported" },
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "site", label: "Site" },
      { key: "activity", label: "Activity" },
      { key: "location", label: "Location" },
      { key: "manpower", label: "Manpower" },
      { key: "output", label: "Output Quantity / Unit", width: 1.2 },
      { key: "materials", label: "Materials Used", width: 1.4 },
      { key: "equipment", label: "Equipment / Vehicles", width: 1.4 },
    ],
    rows: dprSummary.reports.map((report) => ({
      date: getRecordDate(report) || "-",
      site: getSiteName(report) || "-",
      activity: report.workActivity || "-",
      location: report.workLocation || "-",
      manpower: report.manpowerCount ?? 0,
      output: `${report.quantity ?? 0} ${report.unit || ""}`.trim(),
      materials: getDprUsageValues(report.materialsUsed).join(", ") || "-",
      equipment: getDprUsageValues(report.equipmentUsed).join(", ") || "-",
    })),
  };

  const inventoryExport = {
    title: "Site-wise Inventory Summary",
    filters: [
      { label: "Site", value: selectedSite === "all" ? "All Sites" : selectedSite },
      { label: "Stock Position", value: "Current (all recorded transactions)" },
    ],
    summary: [
      { label: "Inventory Items", value: inventorySummary.itemCount },
      { label: "Low Stock", value: inventorySummary.lowStockCount },
      { label: "Out of Stock", value: inventorySummary.outOfStockCount },
    ],
    columns: [
      { key: "materialName", label: "Material", width: 1.25 },
      { key: "site", label: "Site", width: 1.2 },
      { key: "unit", label: "Unit" },
      { key: "opening", label: "Opening" },
      { key: "received", label: "Received" },
      { key: "issued", label: "Issued / Used" },
      { key: "available", label: "Available" },
      { key: "reorder", label: "Reorder Level" },
      { key: "status", label: "Stock Status" },
      { key: "dprReferences", label: "DPR Mentions" },
    ],
    rows: inventorySummary.rows.map((row) => ({
      materialName: row.materialName || "-",
      site: getSiteName(row) || "-",
      unit: row.unit || "-",
      opening: row.openingStock,
      received: row.receivedStock,
      issued: row.issuedStock,
      available: row.currentStock,
      reorder: row.reorderLevel,
      status: formatInventoryStatus(row.status),
      dprReferences: row.dprReferenceCount,
    })),
  };

  const procurementExport = {
    title: "Procurement Report",
    filters: [
      ...baseExportFilters,
      { label: "Vendor", value: vendors.find((vendor) => vendor.id === vendorFilter)?.vendorName || "All Vendors" },
      { label: "Material", value: materialFilter || "All Materials" },
      { label: "PO Status", value: purchaseOrderStatusFilter || "All Statuses" },
    ],
    summary: [
      { label: "Purchase Orders", value: filteredPurchaseOrders.length },
      { label: "Purchase Value", value: formatExportMoney(procurementSummary.purchaseValue) },
      { label: "Vendor Outstanding", value: formatExportMoney(procurementSummary.vendorOutstanding) },
      { label: "Completed GRNs", value: procurementSummary.goodsReceiptCount },
    ],
    columns: [
      { key: "poNumber", label: "PO Number" },
      { key: "date", label: "PO Date" },
      { key: "vendor", label: "Vendor" },
      { key: "site", label: "Site" },
      { key: "materials", label: "Materials", width: 1.5 },
      { key: "status", label: "Status" },
      { key: "total", label: "PO Total (INR)", format: formatExportMoney },
      { key: "paid", label: "Paid (INR)", format: formatExportMoney },
      { key: "outstanding", label: "Outstanding (INR)", format: formatExportMoney },
    ],
    rows: filteredPurchaseOrders.map((order) => ({
      poNumber: order.poNumber || order.id,
      date: normaliseDate(order.poDate || order.date) || "-",
      vendor: order.vendorName || "-",
      site: getSiteName(order) || "-",
      materials: (order.items || []).map((item) => `${item.materialName} (${item.quantity} ${item.unit})`).join(", ") || "-",
      status: order.status || "draft",
      total: toNumber(order.grandTotal),
      paid: toNumber(order.paidAmount),
      outstanding: toNumber(order.outstandingAmount),
    })),
  };

  const listedExpenseTotal =
    financialSummary.materialExpenseFromExpenses +
    financialSummary.labourExpenseFromExpenses +
    financialSummary.otherExpenseFromExpenses;
  const expensesExport = {
    title: "Expenses Report",
    filters: baseExportFilters,
    summary: [
      { label: "Expense Records", value: filteredExpenses.length },
      { label: "Listed Expense Total", value: formatExportMoney(listedExpenseTotal) },
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "site", label: "Site" },
      { key: "type", label: "Expense Type" },
      { key: "paidTo", label: "Paid To" },
      { key: "description", label: "Description", width: 1.4 },
      { key: "amount", label: "Amount (INR)", format: formatExportMoney },
    ],
    rows: filteredExpenses.map((expense) => ({
      date: getRecordDate(expense) || "-",
      site: getSiteName(expense) || "-",
      type: expense.expenseType || expense.category || expense.type || "-",
      paidTo: expense.paidTo || expense.vendor || "-",
      description: expense.description || expense.remarks || "-",
      amount: getExpenseAmount(expense),
    })),
  };

  const attendanceStatusCounts = filteredAttendance.reduce(
    (counts, entry) => {
      const status = String(entry.status || "Not recorded").trim() || "Not recorded";
      counts[status] = (counts[status] || 0) + 1;
      return counts;
    },
    {}
  );
  const attendanceExport = {
    title: "Attendance Report",
    filters: baseExportFilters,
    summary: [
      { label: "Attendance Records", value: filteredAttendance.length },
      ...Object.entries(attendanceStatusCounts).map(([label, value]) => ({ label, value })),
    ],
    columns: [
      { key: "date", label: "Date" },
      { key: "site", label: "Site" },
      { key: "employee", label: "Employee / Labour" },
      { key: "status", label: "Status" },
      { key: "workType", label: "Work Type" },
      { key: "remarks", label: "Remarks", width: 1.5 },
    ],
    rows: filteredAttendance.map((entry) => ({
      date: getRecordDate(entry) || "-",
      site: getSiteName(entry) || "-",
      employee: entry.employeeName || entry.labourName || entry.name || "-",
      status: entry.status || "-",
      workType: entry.workType || "-",
      remarks: entry.remarks || "-",
    })),
  };

  const handlePrint = () => {
    printReport(financialSummaryExport);
  };

  /* =========================================
     PAGE
  ========================================= */

  return (
    <Layout title="📊 Reports & Analytics">
      <div className="reports-page">

        <div className="reports-title-section">
          <h1>
            📊 Reports & Analytics
          </h1>

          <p>
            Complete financial and project performance overview
          </p>
        </div>

        {/* FILTER CARD */}

        <div className="reports-filter-card">
          <div className="report-filter-grid">

            <div className="filter-group">
              <label>
                Select Site
              </label>

              <select
                value={selectedSite}
                onChange={(event) =>
                  setSelectedSite(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  All Sites
                </option>

                {reportSiteNames.map(
                  (siteName) => (
                    <option
                      key={siteName}
                      value={siteName}
                    >
                      {siteName}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="filter-group">
              <label>
                From Date
              </label>

              <input
                type="date"
                value={fromDate}
                onChange={(event) =>
                  setFromDate(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="filter-group">
              <label>
                To Date
              </label>

              <input
                type="date"
                value={toDate}
                onChange={(event) =>
                  setToDate(
                    event.target.value
                  )
                }
              />
            </div>

            <div className="filter-group">
              <label>
                Work Activity (DPR)
              </label>

              <input
                type="text"
                value={workActivity}
                onChange={(event) =>
                  setWorkActivity(
                    event.target.value
                  )
                }
                placeholder="e.g. Excavation"
              />
            </div>

            <div className="filter-group">
              <label>Vendor (Procurement)</label>
              <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)}>
                <option value="">All Vendors</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.vendorName || vendor.id}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Material (Procurement)</label>
              <input type="text" value={materialFilter} onChange={(event) => setMaterialFilter(event.target.value)} placeholder="e.g. Cement" />
            </div>

            <div className="filter-group">
              <label>PO Status</label>
              <select value={purchaseOrderStatusFilter} onChange={(event) => setPurchaseOrderStatusFilter(event.target.value)}>
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="partially received">Partially Received</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="report-buttons">
              <button
                type="button"
                className="reset-report-btn"
                onClick={handleReset}
              >
                ↻ Reset
              </button>

              <button
                type="button"
                className="print-report-btn"
                onClick={handlePrint}
              >
                🖨 Print Report
              </button>
            </div>

          </div>
        </div>

        <section className="report-export-section" aria-labelledby="filtered-report-exports">
          <div>
            <h2 id="filtered-report-exports">Export Filtered Reports</h2>
            <p>Each export uses only the records matching the filters above.</p>
          </div>
          <div className="report-export-grid">
            <ReportExportActions report={financialSummaryExport} disabled={loading} />
            <ReportExportActions report={siteFinancialExport} disabled={loading} />
            <ReportExportActions report={dprExport} disabled={loading || Boolean(dprError)} />
            <ReportExportActions report={expensesExport} disabled={loading} />
            <ReportExportActions report={attendanceExport} disabled={loading} />
            <ReportExportActions report={inventoryExport} disabled={loading} />
            <ReportExportActions report={procurementExport} disabled={loading} />
          </div>
        </section>

        {/* LOADING */}

        {loading ? (
          <div className="report-loading">
            Loading report data...
          </div>
        ) : (
          <>

            <div className="report-section-title">
              <h2>
                💰 Financial Summary
              </h2>
            </div>

            <div className="financial-cards">
              {financialCards.map((card) => (
                <div
                  key={card.title}
                  className={`financial-card ${card.className}`}
                >
                  <div className="financial-icon">
                    {card.icon}
                  </div>

                  <div>
                    <span>
                      {card.title}
                    </span>

                    <h3>
                      {formatMoney(card.value)}
                    </h3>
                  </div>
                </div>
              ))}
            </div>

            {/* DAILY PROGRESS REPORT */}

            <div className="report-section-title">
              <h2>
                📋 Daily Progress Report
              </h2>
            </div>

            {dprError ? (
              <div className="dpr-report-state dpr-report-error">
                {dprError}
              </div>
            ) : (
              <>
                <div className="dpr-report-summary-grid">
                  <div className="dpr-report-summary-card">
                    <span>📋 DPR Count</span>
                    <h3>{dprSummary.reportCount}</h3>
                  </div>

                  <div className="dpr-report-summary-card">
                    <span>👷 Total Manpower</span>
                    <h3>{dprSummary.manpowerTotal}</h3>
                  </div>

                  <div className="dpr-report-summary-card">
                    <span>🏗️ Sites Reported</span>
                    <h3>{dprSummary.submittedSites.length}</h3>
                  </div>
                </div>

                {dprSummary.reportCount === 0 ? (
                  <div className="dpr-report-state">
                    No Daily Progress Report data matches the selected filters.
                  </div>
                ) : (
                  <div className="dpr-report-details-card">
                    <div className="dpr-report-detail-grid">
                      <div className="dpr-report-detail">
                        <h3>📐 Work Output by Unit</h3>

                        {dprSummary.outputByUnit.length === 0 ? (
                          <p>No valid output quantities reported.</p>
                        ) : (
                          <ul className="dpr-report-list">
                            {dprSummary.outputByUnit.map((output) => (
                              <li key={output.unit}>
                                <strong>{output.unit}</strong>
                                <span>{output.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="dpr-report-detail">
                        <h3>📦 Materials Used</h3>

                        {dprSummary.materialsUsed.length === 0 ? (
                          <p>No materials recorded.</p>
                        ) : (
                          <ul className="dpr-report-list">
                            {dprSummary.materialsUsed.map((material) => (
                              <li key={material}>{material}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="dpr-report-detail">
                        <h3>🚚 Equipment / Vehicle Usage</h3>

                        {dprSummary.equipmentUsed.length === 0 ? (
                          <p>No equipment or vehicles recorded.</p>
                        ) : (
                          <ul className="dpr-report-list">
                            {dprSummary.equipmentUsed.map((equipment) => (
                              <li key={equipment}>{equipment}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* INVENTORY */}

            <div className="report-section-title">
              <h2>📦 Site-wise Inventory Summary</h2>
            </div>

            <div className="inventory-report-note">
              Current stock uses all recorded stock transactions. Site filtering is applied;
              financial and date filters do not change the current stock position. DPR
              material mentions are informational and are not deducted automatically.
            </div>

            <div className="dpr-report-summary-grid">
              <div className="dpr-report-summary-card">
                <span>📦 Inventory Items</span>
                <h3>{inventorySummary.itemCount}</h3>
              </div>
              <div className="dpr-report-summary-card">
                <span>⚠️ Low Stock</span>
                <h3>{inventorySummary.lowStockCount}</h3>
              </div>
              <div className="dpr-report-summary-card">
                <span>⛔ Out of Stock</span>
                <h3>{inventorySummary.outOfStockCount}</h3>
              </div>
            </div>

            <div className="reports-table-card">
              <div className="table-responsive">
                <table className="reports-table inventory-report-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Site</th>
                      <th>Unit</th>
                      <th>Opening</th>
                      <th>Received</th>
                      <th>Issued / Used</th>
                      <th>Available</th>
                      <th>Reorder</th>
                      <th>Status</th>
                      <th>DPR Mentions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventorySummary.rows.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="no-report-data">
                          No inventory items match the selected site.
                        </td>
                      </tr>
                    ) : (
                      inventorySummary.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="site-name-cell">{row.materialName}</td>
                          <td>{getSiteName(row) || "-"}</td>
                          <td>{row.unit || "-"}</td>
                          <td>{row.openingStock}</td>
                          <td>{row.receivedStock}</td>
                          <td>{row.issuedStock}</td>
                          <td>{row.currentStock}</td>
                          <td>{row.reorderLevel}</td>
                          <td>
                            <span className={`inventory-report-status inventory-report-status-${row.status}`}>
                              {formatInventoryStatus(row.status)}
                            </span>
                          </td>
                          <td>{row.dprReferenceCount}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PROCUREMENT */}

            <div className="report-section-title">
              <h2>🛒 Procurement Summary</h2>
            </div>

            <div className="inventory-report-note">
              Purchase-order values are procurement commitments and payable tracking only.
              Financial cost is recorded once from accepted GRN quantities in Materials, so PO
              totals are not added again to expense, budget, or profit calculations.
            </div>

            <div className="dpr-report-summary-grid">
              <div className="dpr-report-summary-card"><span>📝 Pending Requests</span><h3>{procurementSummary.pendingRequests}</h3></div>
              <div className="dpr-report-summary-card"><span>📄 Open POs</span><h3>{procurementSummary.openPurchaseOrders}</h3></div>
              <div className="dpr-report-summary-card"><span>🚚 Pending Deliveries</span><h3>{procurementSummary.pendingDeliveries}</h3></div>
              <div className="dpr-report-summary-card"><span>💳 Vendor Outstanding</span><h3>{formatMoney(procurementSummary.vendorOutstanding)}</h3></div>
            </div>

            <div className="reports-table-card">
              <div className="table-responsive">
                <table className="reports-table procurement-report-table">
                  <thead><tr><th>PO</th><th>Date</th><th>Vendor</th><th>Site</th><th>Materials</th><th>Status</th><th>PO Value</th><th>Outstanding</th></tr></thead>
                  <tbody>
                    {filteredPurchaseOrders.length === 0 ? <tr><td colSpan="8" className="no-report-data">No purchase orders match the current procurement filters.</td></tr> : filteredPurchaseOrders.map((order) => <tr key={order.id}>
                      <td>{order.poNumber || order.id}</td><td>{normaliseDate(order.poDate || order.date) || "-"}</td><td>{order.vendorName || "-"}</td><td>{getSiteName(order) || "-"}</td>
                      <td>{(order.items || []).map((item) => `${item.materialName} (${item.quantity} ${item.unit})`).join(", ") || "-"}</td><td>{order.status || "draft"}</td><td>{formatMoney(order.grandTotal)}</td><td>{formatMoney(order.outstandingAmount)}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="procurement-report-breakdown">
              {[
                ["Purchase by Site", procurementBreakdowns.bySite, true],
                ["Purchase by Vendor", procurementBreakdowns.byVendor, true],
                ["Purchase by Material", procurementBreakdowns.byMaterial, true],
                ["Monthly Purchase Trend", procurementBreakdowns.byMonth, true],
                ["PO Status", procurementBreakdowns.byStatus, false],
              ].map(([title, rows, isMoney]) => (
                <div className="dpr-report-detail" key={title}>
                  <h3>{title}</h3>
                  {rows.length === 0 ? <p>No matching data.</p> : <ul className="dpr-report-list">{rows.slice(0, 8).map((row) => <li key={row.label}><strong>{row.label}</strong><span>{isMoney ? formatMoney(row.value) : row.value}</span></li>)}</ul>}
                </div>
              ))}
            </div>

            {/* PROJECT PERFORMANCE */}

            <div className="report-section-title">
              <h2>
                🏗 Project Performance
              </h2>
            </div>

            <div className="reports-table-card">
              <div className="table-responsive">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Site Name</th>
                      <th>Total Income</th>
                      <th>Received</th>
                      <th>Total Expense</th>
                      <th>Budget</th>
                      <th>Budget Used</th>
                      <th>Remaining</th>
                      <th>Profit / Loss</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reportRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan="9"
                          className="no-report-data"
                        >
                          No report data found.
                        </td>
                      </tr>
                    ) : (
                      reportRows.map(
                        (row, index) => (
                          <tr
                            key={`${row.siteName}-${index}`}
                          >
                            <td>
                              {index + 1}
                            </td>

                            <td className="site-name-cell">
                              {row.siteName}
                            </td>

                            <td>
                              {formatMoney(row.income)}
                            </td>

                            <td>
                              {formatMoney(row.received)}
                            </td>

                            <td>
                              {formatMoney(row.expense)}
                            </td>

                            <td>
                              {row.budgetSummary.hasBudget
                                ? formatMoney(row.budgetSummary.totalBudget)
                                : "Not set"}
                            </td>

                            <td>
                              {row.budgetSummary.hasBudget
                                ? formatBudgetUsagePercent(row.budgetSummary.usagePercent)
                                : "Not set"}
                            </td>

                            <td className={row.budgetSummary.overBudgetAmount > 0 ? "loss-text" : ""}>
                              {row.budgetSummary.hasBudget
                                ? formatMoney(row.budgetSummary.remainingBudget)
                                : "Not set"}
                            </td>

                            <td
                              className={
                                row.profit >= 0
                                  ? "profit-text"
                                  : "loss-text"
                              }
                            >
                              {row.profit >= 0
                                ? "Profit: "
                                : "Loss: "}

                              {formatMoney(
                                Math.abs(row.profit)
                              )}
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DATA CHECK */}

            <div className="report-debug-info">
              <strong>
                Firebase Data:
              </strong>

              <span>
                Sites: {sites.length}
              </span>

              <span>
                Invoices: {invoices.length}
              </span>

              <span>
                Expenses: {expenses.length}
              </span>

              <span>
                Materials: {materials.length}
              </span>

              <span>
                Labour: {labours.length}
              </span>

              <span>
                Salaries: {salaries.length}
              </span>

              <span>
                DPR: {dailyProgressReports.length}
              </span>

              <span>
                Inventory: {inventoryItems.length}
              </span>

              <span>
                POs: {purchaseOrders.length}
              </span>

              <span>
                GRNs: {goodsReceipts.length}
              </span>
            </div>

          </>
        )}

      </div>
    </Layout>
  );
}

export default Reports;
