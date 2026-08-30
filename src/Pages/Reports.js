import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import ReportExportActions from "../Components/ReportExportActions";
import "../Styles/Reports.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
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
import { formatBudgetUsagePercent } from "../utils/siteBudget";
import {
  buildMonthlyFinancialTrend,
  buildSiteFinancialRows,
  calculatePortfolioFinancialSummary,
  calculateProjectFinancialSummary,
} from "../utils/projectFinancials";
import { summariseInventory } from "../utils/inventory";
import { getProcurementSummary } from "../utils/procurement";
import { getEquipmentLabel, getFuelEfficiencyHistory, summariseEquipment } from "../utils/equipment";
import { getSubcontractingSummary } from "../utils/subcontracting";
import { getClientBillingSummary } from "../utils/clientBilling";

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
  const [vehicleMaintenance, setVehicleMaintenance] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [workOrderProgress, setWorkOrderProgress] = useState([]);
  const [contractorBills, setContractorBills] = useState([]);
  const [contractorPayments, setContractorPayments] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [clientReceipts, setClientReceipts] = useState([]);
  const [billingProfiles, setBillingProfiles] = useState([]);

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
    const totalCollections = 25;

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
    loadCollection("vehicleMaintenance", setVehicleMaintenance);
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
    loadCollection("workOrders", setWorkOrders);
    loadCollection("workOrderProgress", setWorkOrderProgress);
    loadCollection("contractorBills", setContractorBills);
    loadCollection("contractorPayments", setContractorPayments);
    loadCollection("raBills", setRaBills);
    loadCollection("clientReceipts", setClientReceipts);
    loadCollection("siteBillingProfiles", setBillingProfiles);

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
    vehicleMaintenance.forEach((item) =>
      addSite(getSiteName(item))
    );

    inventoryItems.forEach((item) =>
      addSite(getSiteName(item))
    );

    purchaseRequests.forEach((item) => addSite(getSiteName(item)));
    purchaseOrders.forEach((item) => addSite(getSiteName(item)));
    goodsReceipts.forEach((item) => addSite(getSiteName(item)));
    workOrders.forEach((item) => addSite(getSiteName(item)));
    workOrderProgress.forEach((item) => addSite(getSiteName(item)));
    contractorBills.forEach((item) => addSite(getSiteName(item)));
    contractorPayments.forEach((item) => addSite(getSiteName(item)));
    raBills.forEach((item) => addSite(getSiteName(item)));
    clientReceipts.forEach((item) => addSite(getSiteName(item)));
    billingProfiles.forEach((item) => addSite(getSiteName(item)));

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
    vehicleMaintenance,
    inventoryItems,
    purchaseRequests,
    purchaseOrders,
    goodsReceipts,
    workOrders,
    workOrderProgress,
    contractorBills,
    contractorPayments,
    raBills,
    clientReceipts,
    billingProfiles,
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

  // Equipment master records are a current register. Site filters apply, but
  // a historical date range must not hide currently registered equipment.
  const filteredVehicles = useMemo(
    () => vehicles.filter((item) => selectedSite === "all" || isSameSite(item, selectedSite)),
    [vehicles, selectedSite]
  );

  // Financial reporting keeps the existing dated-master behavior for legacy
  // vehicle fuel fallback. The current equipment register above is separate.
  const financialFilteredVehicles = useMemo(
    () => filterRecords(vehicles),
    [vehicles, filterRecords]
  );
  const filteredVehicleExpenses = useMemo(
    () => filterRecords(vehicleExpenses),
    [vehicleExpenses, filterRecords]
  );

  const filteredVehicleMaintenance = useMemo(
    () => vehicleMaintenance.filter((item) => {
      const dateMatched = isDateInRange({ ...item, date: item.serviceDate || item.date }, fromDate, toDate);
      return (selectedSite === "all" || isSameSite(item, selectedSite)) && dateMatched;
    }),
    [vehicleMaintenance, selectedSite, fromDate, toDate]
  );

  const equipmentSummary = useMemo(
    () => summariseEquipment({ vehicles: filteredVehicles, vehicleExpenses: filteredVehicleExpenses }),
    [filteredVehicles, filteredVehicleExpenses]
  );

  const siteEquipmentRows = useMemo(
    () => allSiteNames.map((siteName) => {
      const siteVehicles = vehicles.filter((item) => isSameSite(item, siteName));
      const siteExpenses = filteredVehicleExpenses.filter((item) => isSameSite(item, siteName));
      const siteMaintenance = filteredVehicleMaintenance.filter((item) => isSameSite(item, siteName));
      const summary = summariseEquipment({ vehicles: siteVehicles, vehicleExpenses: siteExpenses });
      return { site: siteName, ...summary, maintenanceRecords: siteMaintenance.length };
    }).filter((item) => selectedSite === "all" || item.site.toLowerCase() === selectedSite.toLowerCase()),
    [allSiteNames, vehicles, filteredVehicleExpenses, filteredVehicleMaintenance, selectedSite]
  );

  const fuelEfficiencyRows = useMemo(() => {
    const selectedFuelEntries = filteredVehicleExpenses.filter((item) => String(item.expenseType || "").toLowerCase() === "fuel");
    const selectedEntryIds = new Set(selectedFuelEntries.map((item) => item.id));
    const groups = new Map();
    selectedFuelEntries.forEach((entry) => {
      const vehicleKey = entry.vehicleId || String(entry.vehicleNumber || "").trim().toLowerCase();
      if (vehicleKey && !groups.has(vehicleKey)) groups.set(vehicleKey, entry);
    });
    return Array.from(groups.entries()).flatMap(([vehicleKey, fallback]) => {
      const vehicle = vehicles.find((item) => item.id === fallback.vehicleId) || fallback;
      const completeHistory = vehicleExpenses.filter((entry) =>
        entry && String(entry.expenseType || "").toLowerCase() === "fuel" &&
        (entry.vehicleId === fallback.vehicleId || (!fallback.vehicleId && String(entry.vehicleNumber || "").trim().toLowerCase() === vehicleKey))
      );
      return getFuelEfficiencyHistory(completeHistory, vehicle)
        .filter((entry) => selectedEntryIds.has(entry.id))
        .map((entry) => {
          const sourceEntry = completeHistory.find((item) => item.id === entry.id) || fallback;
          return {
            ...entry,
            vehicle: getEquipmentLabel(vehicle) || fallback.vehicleNumber || "-",
            site: getSiteName(sourceEntry) || "-",
            amount: toNumber(sourceEntry.amount ?? sourceEntry.totalAmount),
            vendor: sourceEntry.vendorPump || sourceEntry.vendor || "-",
            billReference: sourceEntry.billReference || "-",
          };
        });
    }).sort((left, right) => String(right.date).localeCompare(String(left.date)));
  }, [filteredVehicleExpenses, vehicleExpenses, vehicles]);

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

  const filterSubcontractRecord = useCallback((record, dateFields) => {
    const date = normaliseDate(dateFields.map((field) => record?.[field]).find(Boolean) || record?.createdAt);
    return (selectedSite === "all" || isSameSite(record, selectedSite)) &&
      (!fromDate || (date && date >= fromDate)) && (!toDate || (date && date <= toDate)) &&
      (!vendorFilter || record?.vendorId === vendorFilter);
  }, [selectedSite, fromDate, toDate, vendorFilter]);

  const filteredWorkOrders = useMemo(
    () => workOrders.filter((order) => filterSubcontractRecord(order, ["startDate", "expectedCompletionDate"])),
    [workOrders, filterSubcontractRecord]
  );
  const filteredWorkOrderProgress = useMemo(
    () => workOrderProgress.filter((record) => filterSubcontractRecord(record, ["date"])),
    [workOrderProgress, filterSubcontractRecord]
  );
  const filteredContractorBills = useMemo(
    () => contractorBills.filter((bill) => filterSubcontractRecord(bill, ["billDate"])),
    [contractorBills, filterSubcontractRecord]
  );
  const filteredContractorPayments = useMemo(
    () => contractorPayments.filter((payment) => filterSubcontractRecord(payment, ["paymentDate"])),
    [contractorPayments, filterSubcontractRecord]
  );
  const subcontractingSummary = useMemo(
    () => getSubcontractingSummary(filteredWorkOrders, filteredContractorBills),
    [filteredWorkOrders, filteredContractorBills]
  );
  const filteredRABills = useMemo(
    () => raBills.filter((bill) => (selectedSite === "all" || isSameSite(bill, selectedSite)) && isDateInRange({ ...bill, date: bill.billDate }, fromDate, toDate)),
    [raBills, selectedSite, fromDate, toDate]
  );
  const clientBillingSummary = useMemo(
    () => getClientBillingSummary({ invoices: filteredInvoices, raBills: filteredRABills }),
    [filteredInvoices, filteredRABills]
  );  const filteredClientReceipts = useMemo(
    () => clientReceipts.filter((receipt) => {
      const receiptDate = normaliseDate(receipt.receiptDate);
      return (selectedSite === "all" || isSameSite(receipt, selectedSite)) &&
        (!fromDate || (receiptDate && receiptDate >= fromDate)) &&
        (!toDate || (receiptDate && receiptDate <= toDate));
    }),
    [clientReceipts, selectedSite, fromDate, toDate]
  );
  const filteredBillingProfiles = useMemo(
    () => billingProfiles.filter((profile) => selectedSite === "all" || isSameSite(profile, selectedSite)),
    [billingProfiles, selectedSite]
  );
  const clientBillingBreakdowns = useMemo(() => {
    const byClient = new Map();
    const bySite = new Map();
    const add = (map, label, bill) => {
      const current = map.get(label) || { label, bills: 0, net: 0, received: 0, pending: 0, retention: 0, gst: 0, tds: 0, advanceAdjusted: 0 };
      current.bills += 1; current.net += toNumber(bill.netBillAmount); current.received += toNumber(bill.receivedAmount); current.pending += toNumber(bill.pendingAmount); current.retention += toNumber(bill.retentionBalance); current.gst += toNumber(bill.gstAmount); current.tds += toNumber(bill.tdsAmount); current.advanceAdjusted += toNumber(bill.advanceAdjustment);
      map.set(label, current);
    };
    filteredRABills.forEach((bill) => { add(byClient, bill.clientName || "Unknown client", bill); add(bySite, getSiteName(bill) || "Unassigned site", bill); });
    const rows = (map) => Array.from(map.values()).sort((first, second) => second.pending - first.pending || first.label.localeCompare(second.label));
    return { byClient: rows(byClient), bySite: rows(bySite) };
  }, [filteredRABills]);
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
      calculateProjectFinancialSummary({
        invoices: filteredInvoices,
        expenses: filteredExpenses,
        materials: filteredMaterials,
        labours: filteredLabours,
        salaries: filteredSalaries,
        attendance: filteredAttendance,
        attendanceSalaryCoverage,
        vehicles: financialFilteredVehicles,
        vehicleExpenses: filteredVehicleExpenses,
        vehicleExpenseCoverage,
        raBills: filteredRABills,
      }),
    [
      filteredInvoices,
      filteredExpenses,
      filteredMaterials,
      filteredLabours,
      filteredSalaries,
      filteredAttendance,
      attendanceSalaryCoverage,
      financialFilteredVehicles,
      filteredVehicleExpenses,
      vehicleExpenseCoverage,
      filteredRABills,
    ]
  );
  /* =========================================
     SITE WISE REPORT
  ========================================= */

  const reportRows = useMemo(() => {
    const availableSiteKeys = new Set(allSiteNames.map((siteName) => siteName.toLowerCase()));
    return buildSiteFinancialRows({
      sites,
      siteBudgets,
      invoices: filteredInvoices,
      expenses: filteredExpenses,
      materials: filteredMaterials,
      labours: filteredLabours,
      salaries: filteredSalaries,
      attendance: filteredAttendance,
      attendanceSalaryCoverage: salaries,
      vehicles: financialFilteredVehicles,
      vehicleExpenses: filteredVehicleExpenses,
      vehicleExpenseCoverage: vehicleExpenses,
      raBills: filteredRABills,
    }).filter((row) => {
      const matchesKnownSite = availableSiteKeys.has(row.siteName.toLowerCase());
      const matchesSelectedSite = selectedSite === "all" || isSameSite(row, selectedSite);
      return matchesKnownSite && matchesSelectedSite;
    }).map((row) => ({ ...row, expense: row.totalCost }));
  }, [
    allSiteNames,
    sites,
    siteBudgets,
    filteredInvoices,
    filteredExpenses,
    filteredMaterials,
    filteredLabours,
    filteredSalaries,
    filteredAttendance,
    salaries,
    financialFilteredVehicles,
    filteredVehicleExpenses,
    vehicleExpenses,
    filteredRABills,
    selectedSite,
  ]);

  const portfolioFinancial = useMemo(
    () => calculatePortfolioFinancialSummary(reportRows),
    [reportRows]
  );

  const monthlyFinancialTrend = useMemo(
    () => buildMonthlyFinancialTrend({
      invoices: filteredInvoices,
      expenses: filteredExpenses,
      materials: filteredMaterials,
      labours: filteredLabours,
      salaries: filteredSalaries,
      attendance: filteredAttendance,
      vehicles: financialFilteredVehicles,
      vehicleExpenses: filteredVehicleExpenses,
      raBills: filteredRABills,
    }),
    [
      filteredInvoices,
      filteredExpenses,
      filteredMaterials,
      filteredLabours,
      filteredSalaries,
      filteredAttendance,
      financialFilteredVehicles,
      filteredVehicleExpenses,
      filteredRABills,
    ]
  );
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
    { title: "Total Revenue", value: financialSummary.revenue, icon: "💰", className: "income-card" },
    { title: "Total Received", value: financialSummary.received, icon: "💵", className: "received-card" },
    { title: "Outstanding Receivable", value: financialSummary.outstanding, icon: "⏳", className: "pending-card" },
    { title: "Material Cost", value: financialSummary.materialCost, icon: "📦", className: "material-card" },
    { title: "Labour Cost", value: financialSummary.labourCost, icon: "👷", className: "labour-card" },
    { title: "Contractor Cost", value: financialSummary.contractorCost, icon: "🧱", className: "other-card" },
    { title: "Vehicle Cost", value: financialSummary.vehicleCost, icon: "🚚", className: "other-card" },
    { title: "Other Cost", value: financialSummary.otherCost, icon: "🛠️", className: "other-card" },
    { title: "Actual Cost", value: financialSummary.totalCost, icon: "📉", className: "expense-card" },
    {
      title: financialSummary.profit >= 0 ? "Net Profit" : "Net Loss",
      value: Math.abs(financialSummary.profit),
      icon: financialSummary.profit >= 0 ? "📈" : "📉",
      className: financialSummary.profit >= 0 ? "profit-card" : "loss-card",
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
    title: "Site Profitability & Budget Report",
    filters: baseExportFilters,
    summary: [
      { label: "Sites", value: reportRows.length },
      { label: "Total Revenue", value: formatExportMoney(financialSummary.revenue) },
      { label: "Total Received", value: formatExportMoney(financialSummary.received) },
      { label: "Outstanding", value: formatExportMoney(financialSummary.outstanding) },
      { label: "Actual Cost", value: formatExportMoney(financialSummary.totalCost) },
      { label: financialSummary.profit >= 0 ? "Net Profit" : "Net Loss", value: formatExportMoney(Math.abs(financialSummary.profit)) },
    ],
    columns: [
      { key: "siteName", label: "Site", width: 1.5 },
      { key: "revenue", label: "Revenue (INR)", format: formatExportMoney },
      { key: "received", label: "Received (INR)", format: formatExportMoney },
      { key: "outstanding", label: "Outstanding (INR)", format: formatExportMoney },
      { key: "materialCost", label: "Material (INR)", format: formatExportMoney },
      { key: "labourCost", label: "Labour (INR)", format: formatExportMoney },
      { key: "contractorCost", label: "Contractor (INR)", format: formatExportMoney },
      { key: "vehicleCost", label: "Vehicle (INR)", format: formatExportMoney },
      { key: "otherCost", label: "Other (INR)", format: formatExportMoney },
      { key: "totalCost", label: "Actual Cost (INR)", format: formatExportMoney },
      { key: "budget", label: "Budget", width: 1.1 },
      { key: "budgetUsed", label: "Budget Used" },
      { key: "profit", label: "Profit / Loss (INR)", format: formatExportMoney },
      { key: "margin", label: "Margin %" },
    ],
    rows: reportRows.map((row) => ({
      ...row,
      budget: row.budgetSummary.hasBudget ? formatExportMoney(row.budgetSummary.totalBudget) : "Not set",
      budgetUsed: row.budgetSummary.hasBudget ? formatBudgetUsagePercent(row.budgetSummary.usagePercent) : "Not set",
      margin: row.marginPercent === null ? "N/A" : `${row.marginPercent}%`,
    })),
  };

  const projectFinancialExport = {
    title: "Portfolio Profitability & Cost Breakdown",
    filters: baseExportFilters,
    summary: [
      { label: "Portfolio Revenue", value: formatExportMoney(portfolioFinancial.revenue) },
      { label: "Actual Cost", value: formatExportMoney(portfolioFinancial.totalCost) },
      { label: "Profit / Loss", value: formatExportMoney(portfolioFinancial.profit) },
      { label: "Margin", value: portfolioFinancial.marginPercent === null ? "N/A" : `${portfolioFinancial.marginPercent}%` },
      { label: "Outstanding", value: formatExportMoney(portfolioFinancial.outstanding) },
      { label: "Sites Over Budget", value: portfolioFinancial.sitesOverBudget },
    ],
    columns: [
      { key: "metric", label: "Metric", width: 1.7 },
      { key: "amount", label: "Amount / Value" },
    ],
    rows: [
      { metric: "Material Cost", amount: formatExportMoney(portfolioFinancial.materialCost) },
      { metric: "Labour Cost", amount: formatExportMoney(portfolioFinancial.labourCost) },
      { metric: "Contractor Cost", amount: formatExportMoney(portfolioFinancial.contractorCost) },
      { metric: "Vehicle Cost", amount: formatExportMoney(portfolioFinancial.vehicleCost) },
      { metric: "Other Cost", amount: formatExportMoney(portfolioFinancial.otherCost) },
      { metric: "Retention Receivable", amount: formatExportMoney(portfolioFinancial.retention) },
      ...monthlyFinancialTrend.map((trend) => ({ metric: `${trend.month} Profit / Loss`, amount: formatExportMoney(trend.profit) })),
    ],
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

  const equipmentRegisterExport = {
    title: "Vehicle / Equipment Register",
    filters: [
      { label: "Site", value: selectedSite === "all" ? "All Sites" : selectedSite },
      { label: "Date Range", value: "Current register (date independent)" },
    ],
    summary: [
      { label: "Total Equipment", value: equipmentSummary.total },
      { label: "Active", value: equipmentSummary.active },
      { label: "Under Maintenance", value: equipmentSummary.underMaintenance },
      { label: "Breakdown", value: equipmentSummary.breakdown },
    ],
    columns: [
      { key: "number", label: "Registration / ID" }, { key: "name", label: "Equipment" },
      { key: "type", label: "Type / Category" }, { key: "site", label: "Current Site" },
      { key: "ownership", label: "Ownership" }, { key: "status", label: "Status" },
      { key: "driver", label: "Operator / Driver" }, { key: "meter", label: "Meter Type" },
    ],
    rows: filteredVehicles.map((vehicle) => ({
      number: vehicle.vehicleNumber || vehicle.assetId || vehicle.id,
      name: vehicle.equipmentName || vehicle.name || "-",
      type: vehicle.category || vehicle.vehicleType || "-",
      site: getSiteName(vehicle) || "-", ownership: vehicle.ownershipType || "-",
      status: vehicle.status || "-", driver: vehicle.driverName || "-", meter: vehicle.meterType || "Odometer",
    })),
  };

  const siteEquipmentExport = {
    title: "Site-wise Equipment Report",
    filters: baseExportFilters,
    summary: [
      { label: "Sites", value: siteEquipmentRows.length },
      { label: "Equipment", value: siteEquipmentRows.reduce((total, row) => total + row.total, 0) },
      { label: "Fuel Cost", value: formatExportMoney(siteEquipmentRows.reduce((total, row) => total + row.fuelCost, 0)) },
      { label: "Maintenance Cost", value: formatExportMoney(siteEquipmentRows.reduce((total, row) => total + row.maintenanceCost, 0)) },
    ],
    columns: [
      { key: "site", label: "Site" }, { key: "total", label: "Equipment" },
      { key: "active", label: "Active" }, { key: "idle", label: "Idle" },
      { key: "maintenance", label: "Under Maintenance" }, { key: "breakdown", label: "Breakdown" },
      { key: "fuel", label: "Fuel Cost (INR)", format: formatExportMoney },
      { key: "maintenanceCost", label: "Maintenance Cost (INR)", format: formatExportMoney },
      { key: "records", label: "Maintenance Records" },
    ],
    rows: siteEquipmentRows.map((row) => ({
      site: row.site, total: row.total, active: row.active, idle: row.idle,
      maintenance: row.underMaintenance, breakdown: row.breakdown, fuel: row.fuelCost,
      maintenanceCost: row.maintenanceCost, records: row.maintenanceRecords,
    })),
  };

  const fuelConsumptionExport = {
    title: "Fuel Cost & Consumption Report",
    filters: baseExportFilters,
    summary: [
      { label: "Fuel Entries", value: filteredVehicleExpenses.filter((item) => String(item.expenseType || "").toLowerCase() === "fuel").length },
      { label: "Fuel Cost", value: formatExportMoney(equipmentSummary.fuelCost) },
      { label: "Efficiency", value: "Shown only for valid consecutive meter readings" },
    ],
    columns: [
      { key: "date", label: "Date" }, { key: "vehicle", label: "Vehicle / Equipment" },
      { key: "site", label: "Site" }, { key: "meterKind", label: "Meter" },
      { key: "meterReading", label: "Reading" }, { key: "quantity", label: "Fuel (L)" },
      { key: "amount", label: "Amount (INR)", format: formatExportMoney },
      { key: "distanceOrHours", label: "Distance / Hours" }, { key: "efficiency", label: "Efficiency" },
      { key: "vendor", label: "Vendor / Pump" }, { key: "billReference", label: "Bill / Reference" },
    ],
    rows: (() => {
      const efficiencyByEntryId = new Map(fuelEfficiencyRows.map((entry) => [entry.id, entry]));
      return filteredVehicleExpenses
        .filter((item) => String(item.expenseType || "").toLowerCase() === "fuel")
        .map((entry) => {
          const efficiency = efficiencyByEntryId.get(entry.id);
          const meterKind = entry.meterType === "hour-meter" ? "hour-meter" : "odometer";
          return {
            date: normaliseDate(entry.date) || "-", vehicle: entry.vehicleNumber || entry.vehicleName || "-",
            site: getSiteName(entry) || "-", meterKind: meterKind === "hour-meter" ? "Hour Meter" : "Odometer",
            meterReading: entry.meterReading ?? "Not recorded", quantity: toNumber(entry.quantity ?? entry.fuelQuantity),
            amount: toNumber(entry.amount ?? entry.totalAmount),
            distanceOrHours: efficiency?.distanceOrHours ?? "Insufficient reading",
            efficiency: efficiency?.efficiency === null || !efficiency ? "Insufficient reading" : `${efficiency.efficiency} ${meterKind === "hour-meter" ? "L/hour" : "km/L"}`,
            vendor: entry.vendorPump || entry.vendor || "-", billReference: entry.billReference || "-",
          };
        });
    })(),
  };

  const maintenanceExport = {
    title: "Maintenance & Breakdown Report",
    filters: baseExportFilters,
    summary: [
      { label: "Maintenance Records", value: filteredVehicleMaintenance.length },
      { label: "Breakdown Records", value: filteredVehicleMaintenance.filter((item) => `${item.maintenanceType || ""} ${item.issueDescription || ""}`.toLowerCase().includes("breakdown")).length },
      { label: "Linked Financial Cost", value: formatExportMoney(equipmentSummary.maintenanceCost) },
    ],
    columns: [
      { key: "date", label: "Service Date" }, { key: "vehicle", label: "Vehicle / Equipment" },
      { key: "site", label: "Site" }, { key: "type", label: "Maintenance Type" },
      { key: "issue", label: "Issue / Breakdown" }, { key: "status", label: "Status" },
      { key: "vendor", label: "Vendor / Workshop" }, { key: "cost", label: "Operational Cost (INR)", format: formatExportMoney },
      { key: "nextService", label: "Next Service" },
    ],
    rows: filteredVehicleMaintenance.map((item) => ({
      date: normaliseDate(item.serviceDate || item.date) || "-",
      vehicle: item.vehicleNumber || item.vehicleName || "-", site: getSiteName(item) || "-",
      type: item.maintenanceType || "-", issue: item.issueDescription || "-", status: item.status || "-",
      vendor: item.vendorWorkshop || "-", cost: toNumber(item.totalCost), nextService: normaliseDate(item.nextServiceDate) || "-",
    })),
  };

  const equipmentCostExport = {
    title: "Equipment Cost Report",
    filters: baseExportFilters,
    summary: [
      { label: "Fuel Cost", value: formatExportMoney(equipmentSummary.fuelCost) },
      { label: "Maintenance / Repair Cost", value: formatExportMoney(equipmentSummary.maintenanceCost) },
      { label: "Equipment Cost", value: formatExportMoney(equipmentSummary.fuelCost + equipmentSummary.maintenanceCost) },
    ],
    columns: [{ key: "category", label: "Cost Category" }, { key: "amount", label: "Amount (INR)", format: formatExportMoney }],
    rows: [
      { category: "Fuel", amount: equipmentSummary.fuelCost },
      { category: "Maintenance / Repair", amount: equipmentSummary.maintenanceCost },
      { category: "Total Equipment Cost", amount: equipmentSummary.fuelCost + equipmentSummary.maintenanceCost },
    ],
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
      { key: "overtime", label: "Overtime (Hrs)" },
      { key: "workType", label: "Work Type" },
      { key: "remarks", label: "Remarks", width: 1.5 },
    ],
    rows: filteredAttendance.map((entry) => ({
      date: getRecordDate(entry) || "-",
      site: getSiteName(entry) || "-",
      employee: entry.employeeName || entry.labourName || entry.name || "-",
      status: entry.status || "-",
      overtime: toNumber(entry.overtimeHours ?? entry.overtime),
      workType: entry.workType || "-",
      remarks: entry.remarks || "-",
    })),
  };

  const payrollSummary = filteredSalaries.reduce((summary, salary) => ({
    payroll: summary.payroll + toNumber(salary.netSalary ?? salary.netPay ?? salary.salary),
    paid: summary.paid + toNumber(salary.paidAmount),
    pending: summary.pending + toNumber(salary.pendingAmount),
    overtime: summary.overtime + toNumber(salary.overtimeHours),
  }), { payroll: 0, paid: 0, pending: 0, overtime: 0 });
  const payrollExport = {
    title: "Payroll Report",
    filters: baseExportFilters,
    summary: [
      { label: "Payroll Records", value: filteredSalaries.length },
      { label: "Net Payroll", value: formatExportMoney(payrollSummary.payroll) },
      { label: "Salary Paid", value: formatExportMoney(payrollSummary.paid) },
      { label: "Pending Salary", value: formatExportMoney(payrollSummary.pending) },
      { label: "Overtime Hours", value: payrollSummary.overtime },
    ],
    columns: [
      { key: "month", label: "Payroll Month" }, { key: "site", label: "Site" },
      { key: "labour", label: "Labour" }, { key: "present", label: "Present Days" },
      { key: "half", label: "Half Days" }, { key: "overtime", label: "Overtime (Hrs)" },
      { key: "gross", label: "Gross (INR)", format: formatExportMoney },
      { key: "net", label: "Net Salary (INR)", format: formatExportMoney },
      { key: "paid", label: "Paid (INR)", format: formatExportMoney },
      { key: "pending", label: "Pending (INR)", format: formatExportMoney },
      { key: "status", label: "Status" },
    ],
    rows: filteredSalaries.map((salary) => ({
      month: salary.month || salary.payrollMonth || "-", site: getSiteName(salary) || "-",
      labour: salary.employeeName || salary.labourName || "-", present: toNumber(salary.presentDays),
      half: toNumber(salary.halfDays), overtime: toNumber(salary.overtimeHours),
      gross: toNumber(salary.grossPay ?? salary.salary), net: toNumber(salary.netSalary ?? salary.netPay ?? salary.salary),
      paid: toNumber(salary.paidAmount), pending: toNumber(salary.pendingAmount), status: salary.status || "-",
    })),
  };

  const clientBillingExport = {
    title: "Client Billing, RA Bills & Receipts Report", filters: baseExportFilters,
    summary: [
      { label: "Certified RA Bills", value: clientBillingSummary.certifiedRABillCount },
      { label: "Canonical Invoice Billing", value: formatExportMoney(clientBillingSummary.totalClientBilling) },
      { label: "Received", value: formatExportMoney(clientBillingSummary.totalReceived) },
      { label: "Outstanding", value: formatExportMoney(clientBillingSummary.outstandingReceivable) },
      { label: "Retention Held", value: formatExportMoney(clientBillingSummary.retentionReceivable) },
      { label: "Client Receipts", value: filteredClientReceipts.length },
    ],
    columns: [
      { key: "recordType", label: "Record Type" }, { key: "date", label: "Date" }, { key: "reference", label: "RA Bill / Receipt" }, { key: "site", label: "Site" }, { key: "client", label: "Client" },
      { key: "gross", label: "Gross Work (INR)", format: formatExportMoney }, { key: "net", label: "Net Receivable (INR)", format: formatExportMoney }, { key: "cash", label: "Cash Receipt (INR)", format: formatExportMoney }, { key: "tds", label: "TDS Credit (INR)", format: formatExportMoney },
      { key: "received", label: "Received (INR)", format: formatExportMoney }, { key: "pending", label: "Pending (INR)", format: formatExportMoney }, { key: "retention", label: "Retention (INR)", format: formatExportMoney }, { key: "status", label: "Status / Mode" },
    ],
    rows: [
      ...filteredRABills.map((bill) => ({ recordType: "RA Bill", date: bill.billDate || "-", reference: bill.raBillNumber || bill.id, site: getSiteName(bill) || "-", client: bill.clientName || "-", gross: toNumber(bill.grossWorkValue), net: toNumber(bill.netBillAmount), cash: 0, tds: toNumber(bill.tdsAmount), received: toNumber(bill.receivedAmount), pending: toNumber(bill.pendingAmount), retention: toNumber(bill.retentionBalance), status: bill.status || "Draft" })),
      ...filteredClientReceipts.map((receipt) => ({ recordType: "Client Receipt", date: receipt.receiptDate || "-", reference: receipt.reference || receipt.raBillNumber || receipt.id, site: getSiteName(receipt) || "-", client: receipt.clientName || "-", gross: 0, net: 0, cash: toNumber(receipt.amount), tds: toNumber(receipt.tdsDeducted), received: toNumber(receipt.creditedAmount), pending: 0, retention: 0, status: receipt.paymentMode || "Recorded" })),
    ],
  };  const subcontractingExport = {
    title: "Subcontracting & Work Orders Report",
    filters: baseExportFilters,
    summary: [
      { label: "Work Orders", value: filteredWorkOrders.length },
      { label: "Certified Progress Records", value: filteredWorkOrderProgress.length },
      { label: "Contract Value", value: formatExportMoney(subcontractingSummary.totalContractValue) },
      { label: "Certified Work", value: formatExportMoney(subcontractingSummary.certifiedAmount) },
      { label: "Pending Contractor Bills", value: formatExportMoney(subcontractingSummary.pendingPayable) },
      { label: "Retention Held", value: formatExportMoney(subcontractingSummary.retentionBalance) },
    ],
    columns: [
      { key: "recordType", label: "Record Type" }, { key: "date", label: "Date" },
      { key: "reference", label: "Reference" }, { key: "vendor", label: "Vendor" },
      { key: "site", label: "Site" }, { key: "details", label: "Details" },
      { key: "amount", label: "Amount (INR)", format: formatExportMoney },
      { key: "status", label: "Status" },
    ],
    rows: [
      ...filteredWorkOrders.map((order) => ({ recordType: "Work Order", date: order.startDate || "-", reference: order.workOrderNumber || order.id, vendor: order.vendorName || "-", site: getSiteName(order) || "-", details: order.workTrade || "-", amount: toNumber(order.contractValue), status: order.status || "Draft" })),
      ...filteredWorkOrderProgress.map((record) => ({ recordType: "Certified Progress", date: record.date || "-", reference: record.workOrderNumber || "-", vendor: record.vendorName || "-", site: getSiteName(record) || "-", details: `${toNumber(record.quantity)} ${record.unit || ""} / ${toNumber(record.progressPercent)}%`, amount: toNumber(record.certifiedAmount), status: "Certified" })),
      ...filteredContractorBills.map((bill) => ({ recordType: "Contractor Bill", date: bill.billDate || "-", reference: bill.billNumber || bill.id, vendor: bill.vendorName || "-", site: getSiteName(bill) || "-", details: `Pending ${formatExportMoney(bill.pendingAmount)}; retention ${formatExportMoney(bill.retentionBalance)}`, amount: toNumber(bill.currentBillAmount), status: bill.paymentStatus || "Pending" })),
      ...filteredContractorPayments.map((payment) => ({ recordType: "Contractor Payment", date: payment.paymentDate || "-", reference: payment.workOrderNumber || payment.contractorBillId || "-", vendor: payment.vendorName || "-", site: getSiteName(payment) || "-", details: `${payment.paymentType || "Payment"} / ${payment.paymentMode || "-"}`, amount: toNumber(payment.amount), status: "Recorded" })),
    ],
  };
  const handlePrint = () => {
    printReport(financialSummaryExport);
  };

  /* =========================================
     PAGE
  ========================================= */

  return (
    <Layout>
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
             <ReportExportActions report={projectFinancialExport} disabled={loading} />
            <ReportExportActions report={dprExport} disabled={loading || Boolean(dprError)} />
            <ReportExportActions report={expensesExport} disabled={loading} />
            <ReportExportActions report={attendanceExport} disabled={loading} />
            <ReportExportActions report={payrollExport} disabled={loading} />
            <ReportExportActions report={equipmentRegisterExport} disabled={loading} />
            <ReportExportActions report={siteEquipmentExport} disabled={loading} />
            <ReportExportActions report={fuelConsumptionExport} disabled={loading} />
            <ReportExportActions report={maintenanceExport} disabled={loading} />
            <ReportExportActions report={equipmentCostExport} disabled={loading} />
            <ReportExportActions report={inventoryExport} disabled={loading} />
            <ReportExportActions report={procurementExport} disabled={loading} />
            <ReportExportActions report={subcontractingExport} disabled={loading} />
            <ReportExportActions report={clientBillingExport} disabled={loading} />
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

                         <div className="report-section-title">
               <h2>💼 Project Costing, Profitability &amp; Budget Control</h2>
             </div>

             <div className="dpr-report-summary-grid">
               <div className="dpr-report-summary-card"><span>💰 Portfolio Revenue</span><h3>{formatMoney(portfolioFinancial.revenue)}</h3></div>
               <div className="dpr-report-summary-card"><span>📉 Actual Cost</span><h3>{formatMoney(portfolioFinancial.totalCost)}</h3></div>
               <div className="dpr-report-summary-card"><span>{portfolioFinancial.profit >= 0 ? "📈 Profit" : "📉 Loss"}</span><h3 className={portfolioFinancial.profit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(Math.abs(portfolioFinancial.profit))}</h3></div>
               <div className="dpr-report-summary-card"><span>📊 Margin</span><h3>{portfolioFinancial.marginPercent === null ? "N/A" : `${portfolioFinancial.marginPercent}%`}</h3></div>
               <div className="dpr-report-summary-card"><span>⏳ Outstanding</span><h3>{formatMoney(portfolioFinancial.outstanding)}</h3></div>
               <div className="dpr-report-summary-card"><span>⚠️ Over-budget Sites</span><h3>{portfolioFinancial.sitesOverBudget}</h3></div>
             </div>

             <div className="reports-table-card">
               <div className="table-responsive">
                 <table className="reports-table">
                   <thead><tr><th>Site</th><th>Revenue</th><th>Received / Outstanding</th><th>Material</th><th>Labour</th><th>Contractor</th><th>Vehicle</th><th>Other</th><th>Actual Cost</th><th>Budget Used</th><th>Profit / Loss</th><th>Margin</th></tr></thead>
                   <tbody>
                     {reportRows.length === 0 ? <tr><td colSpan="12" className="no-report-data">No site financial records match the selected filters.</td></tr> : reportRows.map((row) => (
                       <tr key={`profitability-${row.id}`}>
                         <td><strong>{row.siteName}</strong></td><td>{formatMoney(row.revenue)}</td><td>{formatMoney(row.received)} / {formatMoney(row.outstanding)}</td><td>{formatMoney(row.materialCost)}</td><td>{formatMoney(row.labourCost)}</td><td>{formatMoney(row.contractorCost)}</td><td>{formatMoney(row.vehicleCost)}</td><td>{formatMoney(row.otherCost)}</td><td><strong>{formatMoney(row.totalCost)}</strong></td><td>{row.budgetSummary.hasBudget ? formatBudgetUsagePercent(row.budgetUsagePercent) : "Not set"}</td><td className={row.profit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(row.profit)}</td><td>{row.marginPercent === null ? "N/A" : `${row.marginPercent}%`}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             <div className="reports-table-card">
               <div className="report-section-title"><h2>📈 Monthly Revenue, Cost &amp; Profit Trend</h2></div>
               <div className="table-responsive">
                 <table className="reports-table">
                   <thead><tr><th>Month</th><th>Revenue</th><th>Actual Cost</th><th>Profit / Loss</th></tr></thead>
                   <tbody>{monthlyFinancialTrend.length === 0 ? <tr><td colSpan="4" className="no-report-data">No dated canonical financial records match the selected filters.</td></tr> : monthlyFinancialTrend.map((trend) => <tr key={trend.month}><td>{trend.month}</td><td>{formatMoney(trend.revenue)}</td><td>{formatMoney(trend.cost)}</td><td className={trend.profit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(trend.profit)}</td></tr>)}</tbody>
                 </table>
               </div>
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

            <div className="report-section-title">
              <h2>🚚 Equipment, Fuel &amp; Maintenance</h2>
            </div>
            <div className="inventory-report-note">
              Fuel and maintenance costs use dated <strong>Vehicle Expenses</strong> entries as the single financial source.
              Maintenance records provide history only and are not added a second time to expense or profit.
            </div>
            <div className="dpr-report-summary-grid">
              <div className="dpr-report-summary-card"><span>🚚 Total Equipment</span><h3>{equipmentSummary.total}</h3></div>
              <div className="dpr-report-summary-card"><span>🟢 Active</span><h3>{equipmentSummary.active}</h3></div>
              <div className="dpr-report-summary-card"><span>⏸️ Idle</span><h3>{equipmentSummary.idle}</h3></div>
              <div className="dpr-report-summary-card"><span>🛠️ Under Maintenance</span><h3>{equipmentSummary.underMaintenance}</h3></div>
              <div className="dpr-report-summary-card"><span>⚠️ Breakdown</span><h3>{equipmentSummary.breakdown}</h3></div>
              <div className="dpr-report-summary-card"><span>⛽ Fuel Cost</span><h3>{formatMoney(equipmentSummary.fuelCost)}</h3></div>
              <div className="dpr-report-summary-card"><span>🔧 Maintenance Cost</span><h3>{formatMoney(equipmentSummary.maintenanceCost)}</h3></div>
            </div>

            <div className="reports-table-card">
              <div className="table-responsive"><table className="reports-table"><thead><tr><th>Site</th><th>Equipment</th><th>Active</th><th>Idle</th><th>Maintenance</th><th>Breakdown</th><th>Fuel Cost</th><th>Maintenance Cost</th></tr></thead><tbody>
                {siteEquipmentRows.length === 0 ? <tr><td colSpan="8" className="no-report-data">No equipment records match the selected site.</td></tr> : siteEquipmentRows.map((row) => <tr key={row.site}><td className="site-name-cell">{row.site}</td><td>{row.total}</td><td>{row.active}</td><td>{row.idle}</td><td>{row.underMaintenance}</td><td>{row.breakdown}</td><td>{formatMoney(row.fuelCost)}</td><td>{formatMoney(row.maintenanceCost)}</td></tr>)}
              </tbody></table></div>
            </div>

            <div className="reports-table-card">
              <div className="table-responsive"><table className="reports-table"><thead><tr><th>Date</th><th>Vehicle / Equipment</th><th>Site</th><th>Fuel (L)</th><th>Amount</th><th>Reading</th><th>Efficiency</th></tr></thead><tbody>
                {filteredVehicleExpenses.filter((item) => String(item.expenseType || "").toLowerCase() === "fuel").length === 0 ? <tr><td colSpan="7" className="no-report-data">No fuel entries match the current filters.</td></tr> : (() => { const efficiencyById = new Map(fuelEfficiencyRows.map((entry) => [entry.id, entry])); return filteredVehicleExpenses.filter((item) => String(item.expenseType || "").toLowerCase() === "fuel").map((entry) => { const efficiency = efficiencyById.get(entry.id); return <tr key={entry.id}><td>{normaliseDate(entry.date) || "-"}</td><td>{entry.vehicleNumber || entry.vehicleName || "-"}</td><td>{getSiteName(entry) || "-"}</td><td>{toNumber(entry.quantity ?? entry.fuelQuantity)}</td><td>{formatMoney(entry.amount ?? entry.totalAmount)}</td><td>{entry.meterReading ?? "Not recorded"}</td><td>{efficiency?.efficiency === null || !efficiency ? "Insufficient reading" : `${efficiency.efficiency} ${efficiency.meterKind === "hour-meter" ? "L/hour" : "km/L"}`}</td></tr>; }); })()}
              </tbody></table></div>
            </div>

            <div className="reports-table-card">
              <div className="table-responsive"><table className="reports-table"><thead><tr><th>Service Date</th><th>Vehicle / Equipment</th><th>Site</th><th>Type</th><th>Issue</th><th>Status</th><th>Operational Cost</th><th>Next Service</th></tr></thead><tbody>
                {filteredVehicleMaintenance.length === 0 ? <tr><td colSpan="8" className="no-report-data">No maintenance or breakdown records match the current filters.</td></tr> : filteredVehicleMaintenance.map((item) => <tr key={item.id}><td>{normaliseDate(item.serviceDate || item.date) || "-"}</td><td>{item.vehicleNumber || item.vehicleName || "-"}</td><td>{getSiteName(item) || "-"}</td><td>{item.maintenanceType || "-"}</td><td>{item.issueDescription || "-"}</td><td>{item.status || "-"}</td><td>{formatMoney(item.totalCost)}</td><td>{normaliseDate(item.nextServiceDate) || "-"}</td></tr>)}
              </tbody></table></div>
            </div>

            <div className="report-section-title"><h2>🧱 Subcontracting &amp; Work Orders</h2></div>
            <div className="inventory-report-note">Work-order value and certified progress are operational/commitment figures. Financial expense is recorded once from each linked certified contractor bill in <strong>Expenses</strong>; contractor payments do not create a second expense.</div>
            <div className="dpr-report-summary-grid">
              <div className="dpr-report-summary-card"><span>🧱 Active Work Orders</span><h3>{subcontractingSummary.activeWorkOrders}</h3></div>
              <div className="dpr-report-summary-card"><span>💳 Contract Value</span><h3>{formatMoney(subcontractingSummary.totalContractValue)}</h3></div>
              <div className="dpr-report-summary-card"><span>✅ Certified Work</span><h3>{formatMoney(subcontractingSummary.certifiedAmount)}</h3></div>
              <div className="dpr-report-summary-card"><span>⏳ Pending Bills</span><h3>{formatMoney(subcontractingSummary.pendingPayable)}</h3></div>
              <div className="dpr-report-summary-card"><span>🔒 Retention Held</span><h3>{formatMoney(subcontractingSummary.retentionBalance)}</h3></div>
              <div className="dpr-report-summary-card"><span>⚠️ Overdue Orders</span><h3>{subcontractingSummary.overdueWorkOrders}</h3></div>
            </div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Work Order</th><th>Vendor</th><th>Site</th><th>Scope</th><th>Contract</th><th>Certified</th><th>Progress</th><th>Status</th></tr></thead><tbody>
              {filteredWorkOrders.length === 0 ? <tr><td colSpan="8" className="no-report-data">No work orders match the selected site, date, or vendor filters.</td></tr> : filteredWorkOrders.map((order) => <tr key={order.id}><td>{order.workOrderNumber || order.id}<small>{normaliseDate(order.startDate) || "-"}</small></td><td>{order.vendorName || "-"}</td><td>{getSiteName(order) || "-"}</td><td>{order.workTrade || "-"}</td><td>{formatMoney(order.contractValue)}</td><td>{formatMoney(order.certifiedAmount)}</td><td>{toNumber(order.progressPercent)}%</td><td>{order.status || "Draft"}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Certification Date</th><th>Work Order</th><th>Site</th><th>Quantity / Unit</th><th>Progress</th><th>Certified Amount</th></tr></thead><tbody>
              {filteredWorkOrderProgress.length === 0 ? <tr><td colSpan="6" className="no-report-data">No certified progress records match the selected filters.</td></tr> : filteredWorkOrderProgress.map((record) => <tr key={record.id}><td>{normaliseDate(record.date) || "-"}</td><td>{record.workOrderNumber || "-"}</td><td>{getSiteName(record) || "-"}</td><td>{toNumber(record.quantity)} {record.unit || ""}</td><td>{toNumber(record.progressPercent)}%</td><td>{formatMoney(record.certifiedAmount)}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Bill</th><th>Date</th><th>Vendor / Site</th><th>Current Bill</th><th>Paid / Pending</th><th>Retention</th><th>Status</th></tr></thead><tbody>
              {filteredContractorBills.length === 0 ? <tr><td colSpan="7" className="no-report-data">No contractor bills match the selected filters.</td></tr> : filteredContractorBills.map((bill) => <tr key={bill.id}><td>{bill.billNumber || bill.id}<small>{bill.workOrderNumber || "-"}</small></td><td>{normaliseDate(bill.billDate) || "-"}</td><td>{bill.vendorName || "-"}<small>{getSiteName(bill) || "-"}</small></td><td>{formatMoney(bill.currentBillAmount)}</td><td>{formatMoney(bill.paidAmount)} / {formatMoney(bill.pendingAmount)}</td><td>{formatMoney(bill.retentionBalance)}</td><td>{bill.paymentStatus || "Pending"}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Payment Date</th><th>Bill / Work Order</th><th>Vendor / Site</th><th>Type</th><th>Mode</th><th>Amount</th><th>Reference</th></tr></thead><tbody>
              {filteredContractorPayments.length === 0 ? <tr><td colSpan="7" className="no-report-data">No contractor payments match the selected filters.</td></tr> : filteredContractorPayments.map((payment) => <tr key={payment.id}><td>{normaliseDate(payment.paymentDate) || "-"}</td><td>{payment.workOrderNumber || "-"}</td><td>{payment.vendorName || "-"}<small>{getSiteName(payment) || "-"}</small></td><td>{payment.paymentType || "-"}</td><td>{payment.paymentMode || "-"}</td><td>{formatMoney(payment.amount)}</td><td>{payment.reference || "-"}</td></tr>)}
            </tbody></table></div></div>
            <div className="report-section-title"><h2>🧾 Client Billing &amp; Receivables</h2></div>
            <div className="inventory-report-note">Certified RA bills create exactly one linked invoice. Income, received amount and pending receivable below are calculated from those existing invoices; RA bill rows and retention are operational tracking only.</div>
            <div className="dpr-report-summary-grid">
              <div className="dpr-report-summary-card"><span>🧾 Certified RA Bills</span><h3>{clientBillingSummary.certifiedRABillCount}</h3></div>
              <div className="dpr-report-summary-card"><span>💳 Invoice Billing</span><h3>{formatMoney(clientBillingSummary.totalClientBilling)}</h3></div>
              <div className="dpr-report-summary-card"><span>✅ Received</span><h3>{formatMoney(clientBillingSummary.totalReceived)}</h3></div>
              <div className="dpr-report-summary-card"><span>⏳ Outstanding</span><h3>{formatMoney(clientBillingSummary.outstandingReceivable)}</h3></div>
              <div className="dpr-report-summary-card"><span>🔒 Retention Held</span><h3>{formatMoney(clientBillingSummary.retentionReceivable)}</h3></div>
              <div className="dpr-report-summary-card"><span>⚠️ Overdue / Pending Cert.</span><h3>{formatMoney(clientBillingSummary.overdueReceivable)}</h3><small>{clientBillingSummary.pendingCertificationCount} awaiting certification</small></div>
            </div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>RA Bill</th><th>Bill / Due</th><th>Client / Site</th><th>Gross Work</th><th>Net Receivable</th><th>Received / Pending</th><th>Retention</th><th>Status</th></tr></thead><tbody>
              {filteredRABills.length === 0 ? <tr><td colSpan="8" className="no-report-data">No RA bills match the selected site or date filters.</td></tr> : filteredRABills.map((bill) => <tr key={bill.id}><td>{bill.raBillNumber || bill.id}<small>{bill.agreementNumber || "-"}</small></td><td>{bill.billDate || "-"}<small>Due: {bill.paymentDueDate || "-"}</small></td><td>{bill.clientName || "-"}<small>{getSiteName(bill) || "-"}</small></td><td>{formatMoney(bill.grossWorkValue)}</td><td>{formatMoney(bill.netBillAmount)}</td><td>{formatMoney(bill.receivedAmount)} / {formatMoney(bill.pendingAmount)}</td><td>{formatMoney(bill.retentionBalance)}</td><td>{bill.status || "Draft"}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Client</th><th>RA Bills</th><th>Net Billing</th><th>Received</th><th>Outstanding</th><th>Retention</th><th>Advance Adjusted</th><th>GST / TDS</th></tr></thead><tbody>
              {clientBillingBreakdowns.byClient.length === 0 ? <tr><td colSpan="8" className="no-report-data">No client billing records match the selected filters.</td></tr> : clientBillingBreakdowns.byClient.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.bills}</td><td>{formatMoney(row.net)}</td><td>{formatMoney(row.received)}</td><td>{formatMoney(row.pending)}</td><td>{formatMoney(row.retention)}</td><td>{formatMoney(row.advanceAdjusted)}</td><td>{formatMoney(row.gst)} / {formatMoney(row.tds)}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Site</th><th>RA Bills</th><th>Net Billing</th><th>Received</th><th>Outstanding</th><th>Retention</th><th>Advance Adjusted</th><th>GST / TDS</th></tr></thead><tbody>
              {clientBillingBreakdowns.bySite.length === 0 ? <tr><td colSpan="8" className="no-report-data">No site billing records match the selected filters.</td></tr> : clientBillingBreakdowns.bySite.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.bills}</td><td>{formatMoney(row.net)}</td><td>{formatMoney(row.received)}</td><td>{formatMoney(row.pending)}</td><td>{formatMoney(row.retention)}</td><td>{formatMoney(row.advanceAdjusted)}</td><td>{formatMoney(row.gst)} / {formatMoney(row.tds)}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Receipt Date</th><th>RA Bill</th><th>Client / Site</th><th>Cash</th><th>TDS Credit</th><th>Total Credit</th><th>Mode</th><th>Reference</th></tr></thead><tbody>
              {filteredClientReceipts.length === 0 ? <tr><td colSpan="8" className="no-report-data">No client receipts match the selected filters.</td></tr> : filteredClientReceipts.slice().sort((first, second) => String(second.receiptDate || "").localeCompare(String(first.receiptDate || ""))).map((receipt) => <tr key={receipt.id}><td>{receipt.receiptDate || "-"}</td><td>{receipt.raBillNumber || receipt.raBillId || "-"}</td><td>{receipt.clientName || "-"}<small>{getSiteName(receipt) || "-"}</small></td><td>{formatMoney(receipt.amount)}</td><td>{formatMoney(receipt.tdsDeducted)}</td><td>{formatMoney(receipt.creditedAmount)}</td><td>{receipt.paymentMode || "-"}</td><td>{receipt.reference || "-"}</td></tr>)}
            </tbody></table></div></div>
            <div className="reports-table-card"><div className="table-responsive"><table className="reports-table"><thead><tr><th>Site</th><th>Client</th><th>Agreement</th><th>Client Advance</th><th>Adjusted</th><th>Remaining Advance</th><th>Contract Value</th></tr></thead><tbody>
              {filteredBillingProfiles.length === 0 ? <tr><td colSpan="7" className="no-report-data">No billing profiles match the selected site.</td></tr> : filteredBillingProfiles.map((profile) => <tr key={profile.id}><td>{profile.siteName}</td><td>{profile.clientName}</td><td>{profile.agreementNumber}</td><td>{formatMoney(profile.advanceReceived)}</td><td>{formatMoney(profile.advanceAdjusted)}</td><td>{formatMoney(toNumber(profile.advanceReceived) - toNumber(profile.advanceAdjusted))}</td><td>{formatMoney(profile.contractValue)}</td></tr>)}
            </tbody></table></div></div>
            {/* PROCUREMENT */}

            <div className="report-section-title">
              <h2>👷 Workforce & Payroll</h2>
            </div>
            <div className="dpr-report-summary-grid">
              <div className="dpr-report-summary-card"><span>💵 Net Payroll</span><h3>{formatMoney(payrollSummary.payroll)}</h3></div>
              <div className="dpr-report-summary-card"><span>⏳ Pending Salary</span><h3>{formatMoney(payrollSummary.pending)}</h3></div>
              <div className="dpr-report-summary-card"><span>🕒 Overtime Hours</span><h3>{payrollSummary.overtime}</h3></div>
              <div className="dpr-report-summary-card"><span>📋 Attendance Records</span><h3>{filteredAttendance.length}</h3></div>
            </div>
            <div className="reports-table-card">
              <div className="table-responsive"><table className="reports-table"><thead><tr><th>Labour</th><th>Site</th><th>Month</th><th>Present / Half</th><th>OT</th><th>Net Salary</th><th>Paid</th><th>Pending</th><th>Status</th></tr></thead><tbody>
                {filteredSalaries.length === 0 ? <tr><td colSpan="9" className="no-report-data">No payroll records match the current filters.</td></tr> : filteredSalaries.map((salary) => <tr key={salary.id}><td>{salary.employeeName || salary.labourName || "-"}</td><td>{getSiteName(salary) || "-"}</td><td>{salary.month || salary.payrollMonth || "-"}</td><td>{toNumber(salary.presentDays)} / {toNumber(salary.halfDays)}</td><td>{toNumber(salary.overtimeHours)}h</td><td>{formatMoney(salary.netSalary ?? salary.netPay ?? salary.salary)}</td><td>{formatMoney(salary.paidAmount)}</td><td>{formatMoney(salary.pendingAmount)}</td><td>{salary.status || "-"}</td></tr>)}
              </tbody></table></div>
            </div>

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

              <span>
                RA Bills: {raBills.length}
              </span>
            </div>

          </>
        )}

      </div>
    </Layout>
  );
}

export default Reports;
