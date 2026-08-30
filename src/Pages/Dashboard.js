import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Layout from "../Components/Layout";
import BrandLogo from "../Components/BrandLogo";
import { COMPANY_NAME } from "../config/branding";
import { db } from "../firebase";
import "../Styles/Dashboard.css";
import {
  getInvoiceSummary,
  getSiteName,
  isSameSite,
  normaliseMoney,
  normaliseStatus,
  toNumber,
} from "../utils/financialReporting";
import {
  getDailyProgressOperationalSummary,
  getDprTodayDate,
} from "../utils/dailyProgressReporting";
import { formatBudgetUsagePercent } from "../utils/siteBudget";
import {
  buildMonthlyFinancialTrend,
  buildSiteFinancialRows,
  calculatePortfolioFinancialSummary,
  calculateProjectFinancialSummary,
} from "../utils/projectFinancials";
import { summariseInventory } from "../utils/inventory";
import { getProcurementSummary } from "../utils/procurement";
import { getTodayWorkforceSummary } from "../utils/payrollReporting";
import { summariseEquipment } from "../utils/equipment";
import { getSubcontractingSummary } from "../utils/subcontracting";
import { getClientBillingSummary } from "../utils/clientBilling";
import { getSiteBoqSummary } from "../utils/boqReporting";
import { buildProjectAnalyticsRows, calculatePortfolioAnalytics, formatAnalyticsPercent } from "../utils/projectAnalytics";

const CHART_COLORS = ["#2563eb", "#0f766e", "#8b5cf6", "#f59e0b"];

function Dashboard() {
  const [sites, setSites] = useState([]);
  const [siteBudgets, setSiteBudgets] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [contractorBills, setContractorBills] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [boqMeasurements, setBoqMeasurements] = useState([]);
  const [boqVariations, setBoqVariations] = useState([]);
  const [dprLoading, setDprLoading] = useState(true);
  const [dprError, setDprError] = useState("");

  // =========================
  // LOAD ALL FIREBASE DATA
  // =========================

  useEffect(() => {
    const unsubscribeSites = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setSites(data);
      },
      (error) => {
        console.error("Sites Error:", error);
      }
    );

    const unsubscribeInvoices = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setInvoices(data);
      },
      (error) => {
        console.error("Invoice Error:", error);
      }
    );

    const unsubscribeSiteBudgets = onSnapshot(
      collection(db, "siteBudgets"),
      (snapshot) => {
        setSiteBudgets(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })));
      },
      (error) => {
        console.error("Site budget Error:", error);
      }
    );

    const unsubscribeInventoryItems = onSnapshot(
      collection(db, "inventoryItems"),
      (snapshot) => {
        setInventoryItems(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })));
      },
      (error) => {
        console.error("Inventory items Error:", error);
      }
    );

    const unsubscribeInventoryTransactions = onSnapshot(
      collection(db, "inventoryTransactions"),
      (snapshot) => {
        setInventoryTransactions(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })));
      },
      (error) => {
        console.error("Inventory transactions Error:", error);
      }
    );

    const unsubscribeExpenses = onSnapshot(
      collection(db, "expenses"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setExpenses(data);
      },
      (error) => {
        console.error("Expense Error:", error);
      }
    );

    const unsubscribeMaterials = onSnapshot(
      collection(db, "materials"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setMaterials(data);
      },
      (error) => {
        console.error("Material Error:", error);
      }
    );

    const unsubscribeLabours = onSnapshot(
      collection(db, "labours"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setLabours(data);
      },
      (error) => {
        console.error("Labour Error:", error);
      }
    );

    const unsubscribeAttendance = onSnapshot(
      collection(db, "attendance"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setAttendance(data);
      },
      (error) => {
        console.error("Attendance Error:", error);
      }
    );

    const unsubscribeSalaries = onSnapshot(
      collection(db, "salaries"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setSalaries(data);
      },
      (error) => {
        console.error("Salary Error:", error);
      }
    );

    const unsubscribeVehicles = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setVehicles(data);
      },
      (error) => {
        console.error("Vehicle Error:", error);
      }
    );

    const unsubscribeVehicleExpenses = onSnapshot(
      collection(db, "vehicleExpenses"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setVehicleExpenses(data);
      },
      (error) => {
        console.error("Vehicle expense Error:", error);
      }
    );

    const unsubscribeDailyProgressReports = onSnapshot(
      collection(db, "dailyProgressReports"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setDailyProgressReports(data);
        setDprError("");
        setDprLoading(false);
      },
      (error) => {
        console.error("Daily progress report Error:", error);
        setDprError("Daily progress reports could not be loaded.");
        setDprLoading(false);
      }
    );

    const unsubscribePurchaseRequests = onSnapshot(
      collection(db, "purchaseRequests"),
      (snapshot) => setPurchaseRequests(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("Purchase request Error:", error)
    );

    const unsubscribePurchaseOrders = onSnapshot(
      collection(db, "purchaseOrders"),
      (snapshot) => setPurchaseOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("Purchase order Error:", error)
    );

    const unsubscribeGoodsReceipts = onSnapshot(
      collection(db, "goodsReceipts"),
      (snapshot) => setGoodsReceipts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("Goods receipt Error:", error)
    );

    const unsubscribeWorkOrders = onSnapshot(
      collection(db, "workOrders"),
      (snapshot) => setWorkOrders(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("Work order Error:", error)
    );
    const unsubscribeRaBills = onSnapshot(
      collection(db, "raBills"),
      (snapshot) => setRaBills(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("RA bill Error:", error)
    );
    const unsubscribeBoqItems = onSnapshot(collection(db, "boqItems"), (snapshot) => setBoqItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => console.error("BOQ items Error:", error));
    const unsubscribeBoqMeasurements = onSnapshot(collection(db, "boqMeasurements"), (snapshot) => setBoqMeasurements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => console.error("BOQ measurements Error:", error));
    const unsubscribeBoqVariations = onSnapshot(collection(db, "boqVariations"), (snapshot) => setBoqVariations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), (error) => console.error("BOQ variations Error:", error));
    const unsubscribeContractorBills = onSnapshot(
      collection(db, "contractorBills"),
      (snapshot) => setContractorBills(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("Contractor bill Error:", error)
    );
    return () => {
      unsubscribeSites();
      unsubscribeSiteBudgets();
      unsubscribeInventoryItems();
      unsubscribeInventoryTransactions();
      unsubscribeInvoices();
      unsubscribeExpenses();
      unsubscribeMaterials();
      unsubscribeLabours();
      unsubscribeAttendance();
      unsubscribeSalaries();
      unsubscribeVehicles();
      unsubscribeVehicleExpenses();
      unsubscribeDailyProgressReports();
      unsubscribePurchaseRequests();
      unsubscribePurchaseOrders();
      unsubscribeGoodsReceipts();
      unsubscribeWorkOrders();
      unsubscribeRaBills();
      unsubscribeBoqItems();
      unsubscribeBoqMeasurements();
      unsubscribeBoqVariations();
      unsubscribeContractorBills();
    };
  }, []);

  // =========================
  // HELPER FUNCTIONS
  // =========================

  const formatMoney = (amount) => {
    return `₹ ${toNumber(amount).toLocaleString("en-IN")}`;
  };

  const inventorySummary = useMemo(
    () => summariseInventory(inventoryItems, inventoryTransactions),
    [inventoryItems, inventoryTransactions]
  );

  const procurementSummary = useMemo(
    () => getProcurementSummary(purchaseRequests, purchaseOrders, goodsReceipts),
    [purchaseRequests, purchaseOrders, goodsReceipts]
  );
  const subcontractingSummary = useMemo(
    () => getSubcontractingSummary(workOrders, contractorBills),
    [workOrders, contractorBills]
  );
  const clientBillingSummary = useMemo(
    () => getClientBillingSummary({ invoices, raBills }),
    [invoices, raBills]
  );
  const boqSummary = useMemo(
    () => getSiteBoqSummary({ items: boqItems, measurements: boqMeasurements, variations: boqVariations, raBills }),
    [boqItems, boqMeasurements, boqVariations, raBills]
  );
  const lowProgressBoqSites = useMemo(() => Array.from(new Set(boqSummary.incompleteItems.filter((item) => item.progressPercent <= 25).map((item) => item.site).filter(Boolean))), [boqSummary]);
  const equipmentSummary = useMemo(
    () => summariseEquipment({ vehicles, vehicleExpenses }),
    [vehicles, vehicleExpenses]
  );

  const recentProcurement = useMemo(() => [
    ...purchaseRequests.map((item) => ({ ...item, type: "Purchase Request", activityDate: item.updatedAt?.toDate?.() || item.date || "", label: item.requestNumber || item.id })),
    ...purchaseOrders.map((item) => ({ ...item, type: "Purchase Order", activityDate: item.updatedAt?.toDate?.() || item.poDate || "", label: item.poNumber || item.id })),
    ...goodsReceipts.map((item) => ({ ...item, type: "Goods Receipt", activityDate: item.updatedAt?.toDate?.() || item.receiptDate || "", label: item.grnNumber || item.id })),
  ].sort((first, second) => new Date(second.activityDate || 0) - new Date(first.activityDate || 0)).slice(0, 6), [purchaseRequests, purchaseOrders, goodsReceipts]);

  // =========================
  // DASHBOARD SUMMARY
  // =========================

  const summary = useMemo(
    () =>
      calculateProjectFinancialSummary({
        invoices,
        expenses,
        materials,
        labours,
        salaries,
        attendance,
        vehicles,
        vehicleExpenses,
        raBills,
      }),
    [
      invoices,
      expenses,
      materials,
      labours,
      salaries,
      attendance,
      vehicles,
      vehicleExpenses,
      raBills,
    ]
  );

  const todayDprSummary = useMemo(
    () =>
      getDailyProgressOperationalSummary(dailyProgressReports, {
        date: getDprTodayDate(),
      }),
    [dailyProgressReports]
  );

  const sitesWithoutDprToday = useMemo(() => {
    const seenSites = new Set();

    return sites.reduce((count, site) => {
      const siteName = getSiteName(site);
      const siteKey = siteName.toLowerCase();

      if (!siteName || seenSites.has(siteKey)) return count;

      seenSites.add(siteKey);
      const hasDpr = todayDprSummary.submittedSites.some((submittedSite) =>
        isSameSite({ site: submittedSite }, siteName)
      );

      return count + (hasDpr ? 0 : 1);
    }, 0);
  }, [sites, todayDprSummary.submittedSites]);

  // =========================
  // SITE SUMMARY
  // =========================

  const siteSummary = useMemo(
    () =>
      buildSiteFinancialRows({
        sites,
        siteBudgets,
        invoices,
        expenses,
        materials,
        labours,
        salaries,
        attendance,
        attendanceSalaryCoverage: salaries,
        vehicles,
        vehicleExpenses,
        vehicleExpenseCoverage: vehicleExpenses,
        raBills,
      }),
    [
      sites,
      siteBudgets,
      invoices,
      expenses,
      materials,
      labours,
      salaries,
      attendance,
      vehicles,
      vehicleExpenses,
      raBills,
    ]
  );

  const portfolioInsights = useMemo(
    () => calculatePortfolioFinancialSummary(siteSummary),
    [siteSummary]
  );
  const projectAnalyticsRows = useMemo(
    () => buildProjectAnalyticsRows({
      siteRows: siteSummary,
      boqItems,
      boqMeasurements,
      boqVariations,
      raBills,
    }),
    [siteSummary, boqItems, boqMeasurements, boqVariations, raBills]
  );
  const portfolioAnalytics = useMemo(
    () => calculatePortfolioAnalytics(projectAnalyticsRows),
    [projectAnalyticsRows]
  );
  const projectWatchlist = useMemo(
    () => projectAnalyticsRows.filter((row) => row.health.status !== "Healthy").sort((first, second) => {
      const healthRank = { Critical: 0, Attention: 1, Healthy: 2 };
      return healthRank[first.health.status] - healthRank[second.health.status] || first.profit - second.profit;
    }).slice(0, 6),
    [projectAnalyticsRows]
  );

  // =========================
  // SITE STATUS COUNTS
  // =========================

  const runningSites = sites.filter(
    (item) => normaliseStatus(item.status) === "running"
  ).length;

  const completedSites = sites.filter(
    (item) => normaliseStatus(item.status) === "completed"
  ).length;

  const pendingSites = sites.filter(
    (item) => normaliseStatus(item.status) === "pending"
  ).length;

  const sitesWithBudget = siteSummary.filter(
    (site) => site.budgetSummary.hasBudget
  ).length;
  const sitesWithBudgetAlerts = siteSummary.filter((site) =>
    ["warning", "critical", "over-budget"].includes(site.budgetSummary.status)
  ).length;

  // =========================
  // ATTENDANCE SUMMARY
  // =========================

  const workforceSummary = useMemo(
    () => getTodayWorkforceSummary({
      attendance,
      labours,
      salaries,
      today: getDprTodayDate(),
    }),
    [attendance, labours, salaries]
  );

  // =========================
  // LOW STOCK MATERIAL
  // =========================

  const lowStockMaterials = materials.filter((item) => {
    const stock = normaliseMoney(
      item.stock ??
      item.quantity ??
      item.qty ??
      0
    );

    const minimumStock = normaliseMoney(
      item.minimumStock ??
      item.minStock ??
      10
    );

    return stock <= minimumStock;
  });

  // =========================
  // PENDING INVOICES
  // =========================

  const pendingInvoices = invoices.filter((item) => {
    return getInvoiceSummary(item).pending > 0;
  });

  const primaryKpis = [
    {
      label: "Total Revenue",
      value: formatMoney(summary.revenue),
      icon: "🧾",
      tone: "income",
      helper: "Invoice value",
    },
    {
      label: "Received",
      value: formatMoney(summary.received),
      icon: "💳",
      tone: "received",
      helper: "Payments collected",
    },
    {
      label: "Outstanding Receivable",
      value: formatMoney(summary.pending),
      icon: "⏳",
      tone: "pending",
      helper: "Awaiting collection",
    },
    {
      label: "Actual Cost",
      value: formatMoney(summary.totalCost),
      icon: "📉",
      tone: "expense",
      helper: "All recorded costs",
    },
    {
      label: summary.profit >= 0 ? "Net Profit" : "Net Loss",
      value: formatMoney(Math.abs(summary.profit)),
      icon: summary.profit >= 0 ? "📈" : "📉",
      tone: summary.profit >= 0 ? "profit" : "loss",
      helper: summary.profit >= 0 ? "Revenue after actual cost" : "Actual cost exceeds revenue",
    },
    {
      label: "Active Sites",
      value: sites.length,
      icon: "🏗️",
      tone: "sites",
      helper: `${runningSites} running`,
    },
    {
      label: "Labour",
      value: labours.length,
      icon: "👷",
      tone: "labour",
      helper: "Registered workforce",
    },
    {
      label: "Today’s DPR",
      value: todayDprSummary.todayCount,
      icon: "📋",
      tone: "dpr",
      helper: `${todayDprSummary.totalManpower} manpower reported`,
    },
    {
      label: "Profit Margin",
      value: summary.marginPercent === null ? "N/A" : `${summary.marginPercent}%`,
      icon: "📐",
      tone: "margin",
      helper: "Recognized revenue after cost",
    },
    {
      label: "Budget Used",
      value: formatBudgetUsagePercent(portfolioInsights.budgetUsagePercent),
      icon: "🎯",
      tone: "budget",
      helper: `${portfolioInsights.budgetedSiteCount} budgeted site${portfolioInsights.budgetedSiteCount === 1 ? "" : "s"}`,
    },
  ];

  const incomeExpenseChartData = useMemo(() => [
    { name: "Revenue", amount: toNumber(summary.revenue) },
    { name: "Actual Cost", amount: toNumber(summary.totalCost) },
  ], [summary.revenue, summary.totalCost]);

  const siteProfitChartData = useMemo(
    () => siteSummary
      .filter((site) => toNumber(site.revenue) !== 0 || toNumber(site.totalCost) !== 0)
      .map((site) => ({ name: site.siteName, profit: toNumber(site.profit) })),
    [siteSummary]
  );

  const expenseBreakdownData = useMemo(
    () => [
      { name: "Material", value: toNumber(summary.materialCost) },
      { name: "Labour", value: toNumber(summary.labourCost) },
      { name: "Contractor", value: toNumber(summary.contractorCost) },
      { name: "Vehicle", value: toNumber(summary.vehicleCost) },
      { name: "Other", value: toNumber(summary.otherCost) },
    ].filter((item) => item.value > 0),
    [summary.contractorCost, summary.labourCost, summary.materialCost, summary.otherCost, summary.vehicleCost]
  );

  const budgetVsActualChartData = useMemo(
    () => siteSummary
      .filter((site) => site.budgetSummary?.hasBudget)
      .map((site) => ({
        name: site.siteName,
        budget: toNumber(site.totalBudget),
        actual: toNumber(site.totalCost),
      })),
    [siteSummary]
  );

  const monthlyFinancialTrendData = useMemo(
    () => buildMonthlyFinancialTrend({
      invoices,
      expenses,
      materials,
      labours,
      salaries,
      attendance,
      vehicles,
      vehicleExpenses,
      raBills,
    }).map((item) => ({ ...item, label: item.month })),
    [attendance, expenses, invoices, labours, materials, raBills, salaries, vehicleExpenses, vehicles]
  );

  const hasIncomeExpenseData = summary.revenue !== 0 || summary.totalCost !== 0;
  const hasBudgetVsActualData = budgetVsActualChartData.some((item) => item.budget !== 0 || item.actual !== 0);
  const hasMonthlyTrendData = monthlyFinancialTrendData.some((item) => item.revenue !== 0 || item.cost !== 0);

  return (
    <Layout>
      <div className="dashboard-page">
        <section className="dashboard-hero">
          <div>
            <span className="dashboard-eyebrow">Operations overview</span>
            <h1>Project performance, live from your ERP.</h1>
            <p>Track finances, field progress, workforce, and site health in one place.</p>
          </div>
          <div className="dashboard-hero-status">
            <div className="dashboard-brand-lockup">
              <BrandLogo className="dashboard-brand-logo" />
              <span>{COMPANY_NAME}</span>
            </div>
            <strong>{sites.length} sites in view</strong>
          </div>
        </section>

        <section aria-labelledby="dashboard-kpis">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Key performance indicators</span>
              <h2 id="dashboard-kpis">Business at a glance</h2>
            </div>
          </div>
          <div className="dashboard-kpi-grid">
            {primaryKpis.map((kpi) => (
              <article className={`dashboard-kpi-card dashboard-kpi-${kpi.tone}`} key={kpi.label}>
                <div className="dashboard-kpi-icon" aria-hidden="true">{kpi.icon}</div>
                <div>
                  <span>{kpi.label}</span>
                  <strong className={kpi.tone === "profit" ? "profit-text" : kpi.tone === "loss" ? "loss-text" : ""}>
                    {kpi.value}
                  </strong>
                  <small>{kpi.helper}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="site-overview">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Portfolio</span>
              <h2 id="site-overview">🏗️ Site Overview</h2>
            </div>
          </div>
          <div className="dashboard-status-grid dashboard-site-overview-grid">
            <article className="dashboard-status-card status-running">
              <span>🟢 Running</span>
              <strong>{runningSites}</strong>
              <small>Sites currently in progress</small>
            </article>
            <article className="dashboard-status-card status-completed">
              <span>✅ Completed</span>
              <strong>{completedSites}</strong>
              <small>Sites marked complete</small>
            </article>
            <article className="dashboard-status-card status-pending">
              <span>⏳ Pending</span>
              <strong>{pendingSites}</strong>
              <small>Sites awaiting work</small>
            </article>
            <article className="dashboard-status-card status-budget">
              <span>⚠️ Budget Alerts</span>
              <strong>{sitesWithBudgetAlerts}</strong>
              <small>{sitesWithBudget} sites have approved budgets</small>
            </article>
          </div>
        </section>

        <section aria-labelledby="portfolio-financial-health">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Canonical financial ledger</span>
              <h2 id="portfolio-financial-health">💼 Portfolio Profitability &amp; Cost Control</h2>
            </div>
          </div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-running"><span>💰 Portfolio Revenue</span><strong>{formatMoney(summary.revenue)}</strong><small>Certified invoices; receipts are not re-counted</small></article>
            <article className="dashboard-status-card status-budget"><span>📉 Actual Cost</span><strong>{formatMoney(summary.totalCost)}</strong><small>Material, labour, contractor, vehicle and other</small></article>
            <article className="dashboard-status-card status-inventory"><span>{summary.profit >= 0 ? "📈 Profit" : "📉 Loss"}</span><strong className={summary.profit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(Math.abs(summary.profit))}</strong><small>Margin: {summary.marginPercent === null ? "N/A" : `${summary.marginPercent}%`}</small></article>
            <article className="dashboard-status-card status-pending"><span>⏳ Outstanding</span><strong>{formatMoney(summary.outstanding)}</strong><small>Cash received: {formatMoney(summary.received)}</small></article>
            <article className="dashboard-status-card status-inventory-low"><span>⚠️ Over-budget Sites</span><strong>{portfolioInsights.sitesOverBudget}</strong><small>{portfolioInsights.budgetedSiteCount} site budgets in view</small></article>
            <article className="dashboard-status-card status-inventory-out"><span>📉 Loss-making Sites</span><strong>{portfolioInsights.lossMakingSites}</strong><small>Only sites with recognized revenue</small></article>
            <article className="dashboard-status-card status-budget"><span>🎯 Budget Used</span><strong>{formatBudgetUsagePercent(portfolioInsights.budgetUsagePercent)}</strong><small>{portfolioInsights.totalBudget > 0 ? `Budget: ${formatMoney(portfolioInsights.totalBudget)}` : "No approved budgets yet"}</small></article>
          </div>
        </section>

        <section aria-labelledby="project-performance-analytics">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Derived management view</span>
              <h2 id="project-performance-analytics">🩺 Project Health &amp; Performance</h2>
            </div>
          </div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-running"><span>✅ Healthy Projects</span><strong>{projectAnalyticsRows.filter((row) => row.health.status === "Healthy").length}</strong><small>Transparent, derived health score</small></article>
            <article className="dashboard-status-card status-pending"><span>⚠️ Attention Projects</span><strong>{portfolioAnalytics.attentionProjects}</strong><small>Review collection, budget, or progress signals</small></article>
            <article className="dashboard-status-card status-inventory-out"><span>🚨 Critical Projects</span><strong>{portfolioAnalytics.criticalProjects}</strong><small>Loss, over-budget, or stacked risk signals</small></article>
            <article className="dashboard-status-card status-budget"><span>📦 Top Cost Driver</span><strong>{portfolioAnalytics.largestCostCategory?.label || "N/A"}</strong><small>{portfolioAnalytics.largestCostCategory ? formatMoney(portfolioAnalytics.largestCostCategory.amount) : "No canonical cost data"}</small></article>
            <article className="dashboard-status-card status-pending"><span>⌛ Overdue Receivables</span><strong>{formatMoney(portfolioAnalytics.totalOverdueReceivable)}</strong><small>Only RA bills with a past due date</small></article>
          </div>
          <div className="dashboard-table-card">
            <div className="dashboard-table-heading"><div><span className="dashboard-eyebrow">Priority watchlist</span><h3>Projects needing management review</h3></div><span className="dashboard-table-note">Health is a deterministic indicator, not an accounting standard</span></div>
            <div className="dashboard-table-responsive"><table className="dashboard-table"><thead><tr><th>Site</th><th>Health</th><th>Profit / Margin</th><th>Cost Driver</th><th>Physical vs Billing</th><th>Forecast</th></tr></thead><tbody>{projectWatchlist.length === 0 ? <tr><td className="dashboard-table-empty" colSpan="6">No project health risks are currently derived from the available data.</td></tr> : projectWatchlist.map((row) => <tr key={`health-${row.id || row.siteName}`}><td><strong>{row.siteName}</strong><small>{row.health.reasons[0] || "No critical signal"}</small></td><td><span className={row.health.status === "Critical" ? "pending-status" : "running-status"}>{row.health.status}{row.health.score === null ? "" : ` (${row.health.score})`}</span></td><td className={row.profit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(row.profit)}<small>{formatAnalyticsPercent(row.marginPercent)}</small></td><td>{row.costBreakdown.largestCategory?.label || "N/A"}<small>{row.costBreakdown.largestCategory ? formatMoney(row.costBreakdown.largestCategory.amount) : ""}</small></td><td>{row.boqAnalytics.comparison}<small>{row.boqAnalytics.measuredProgressPercent === null ? "No BOQ data" : `${formatAnalyticsPercent(row.boqAnalytics.measuredProgressPercent)} physical · ${formatAnalyticsPercent(row.boqAnalytics.billedProgressPercent)} billed`}</small></td><td>{row.forecast.status === "Available" ? <><strong className={row.forecast.projectedProfit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(row.forecast.projectedProfit)}</strong><small>Projected profit</small></> : <span>Insufficient data</span>}</td></tr>)}</tbody></table></div>
          </div>
        </section>
        <section className="dashboard-table-card" aria-labelledby="site-financial-summary">
          <div className="dashboard-table-heading">
            <div>
              <span className="dashboard-eyebrow">Financial health by site</span>
              <h2 id="site-financial-summary">📊 Site-wise Financial Summary</h2>
            </div>
            <span className="dashboard-table-note">Scroll horizontally on smaller screens</span>
          </div>
          <div className="dashboard-table-responsive">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Site</th>
                  <th>Location</th>
                  <th>Status</th>
                                    <th>Revenue</th>
                  <th>Material</th>
                  <th>Labour</th>
                  <th>Contractor</th>
                  <th>Vehicle</th>
                  <th>Other</th>
                  <th>Actual Cost</th>
                  <th>Budget</th>
                  <th>Budget Used</th>
                  <th>Remaining</th>
                  <th>Profit/Loss</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {siteSummary.length === 0 ? (
                  <tr>
                    <td className="dashboard-table-empty" colSpan="16">No site financial records are available yet.</td>
                  </tr>
                ) : (
                  siteSummary.map((item, index) => {
                    const siteStatus = normaliseStatus(item.status);
                    const statusClass = siteStatus === "completed"
                      ? "completed-status"
                      : siteStatus === "pending"
                        ? "pending-status"
                        : "running-status";

                    return (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td><strong>{item.siteName}</strong></td>
                        <td>{item.location}</td>
                        <td><span className={statusClass}>{item.status}</span></td>
                                                <td>{formatMoney(item.revenue)}</td>
                        <td>{formatMoney(item.materialCost)}</td>
                        <td>{formatMoney(item.labourCost)}</td>
                        <td>{formatMoney(item.contractorCost)}</td>
                        <td>{formatMoney(item.vehicleCost)}</td>
                        <td>{formatMoney(item.otherCost)}</td>
                        <td><strong>{formatMoney(item.totalCost)}</strong></td>
                        <td>
                          {item.budgetSummary.hasBudget
                            ? formatMoney(item.budgetSummary.totalBudget)
                            : "Not set"}
                        </td>
                        <td>
                          {item.budgetSummary.hasBudget
                            ? formatBudgetUsagePercent(item.budgetSummary.usagePercent)
                            : "Not set"}
                        </td>
                        <td>
                          {item.budgetSummary.hasBudget ? (
                            <strong className={item.budgetSummary.overBudgetAmount > 0 ? "loss-text" : ""}>
                              {formatMoney(item.budgetSummary.remainingBudget)}
                            </strong>
                          ) : "Not set"}
                        </td>
                        <td>
                          <strong className={item.profit >= 0 ? "profit-text" : "loss-text"}>
                            {formatMoney(item.profit)}
                          </strong>
                        </td>
                        <td>{item.marginPercent === null ? "N/A" : `${item.marginPercent}%`}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section aria-labelledby="inventory-overview">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Material availability</span>
              <h2 id="inventory-overview">📦 Inventory Overview</h2>
            </div>
          </div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-inventory"><span>📦 Inventory Items</span><strong>{inventorySummary.itemCount}</strong><small>Tracked material/site/unit records</small></article>
            <article className="dashboard-status-card status-inventory-low"><span>⚠️ Low Stock</span><strong>{inventorySummary.lowStockCount}</strong><small>At or below the reorder level</small></article>
            <article className="dashboard-status-card status-inventory-out"><span>⛔ Out of Stock</span><strong>{inventorySummary.outOfStockCount}</strong><small>Needs material received or adjustment</small></article>
          </div>
        </section>

        <section aria-labelledby="procurement-overview">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Purchase workflow</span>
              <h2 id="procurement-overview">🛒 Procurement Overview</h2>
            </div>
          </div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-pending"><span>📝 Pending Requests</span><strong>{procurementSummary.pendingRequests}</strong><small>Awaiting approval</small></article>
            <article className="dashboard-status-card status-inventory"><span>📄 Open Purchase Orders</span><strong>{procurementSummary.openPurchaseOrders}</strong><small>{procurementSummary.pendingDeliveries} delivery pending</small></article>
            <article className="dashboard-status-card status-budget"><span>💳 Purchase Value</span><strong>{formatMoney(procurementSummary.purchaseValue)}</strong><small>{procurementSummary.goodsReceiptCount} completed GRNs</small></article>
            <article className="dashboard-status-card status-inventory-low"><span>⚠️ Vendor Outstanding</span><strong>{formatMoney(procurementSummary.vendorOutstanding)}</strong><small>From active purchase orders</small></article>
          </div>
          <article className="dashboard-dpr-activity-card">
            <div className="dashboard-card-title-row"><div><h3>Recent Procurement Activity</h3><p>Requests, purchase orders, and completed goods receipts.</p></div></div>
            {recentProcurement.length === 0 ? <p className="empty-text">No procurement records are available yet.</p> : <div className="dashboard-dpr-list">{recentProcurement.map((item) => <div className="dashboard-dpr-item" key={`${item.type}-${item.id}`}><div><strong>{item.label}</strong><p>{item.type} · {getSiteName(item) || "Site not recorded"}</p></div><span>{item.status || "-"}</span></div>)}</div>}
          </article>
        </section>

        <section aria-labelledby="subcontracting-overview">
          <div className="dashboard-section-header"><div><span className="dashboard-eyebrow">Vendor work execution</span><h2 id="subcontracting-overview">🧱 Subcontracting Overview</h2></div></div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-pending"><span>🧱 Active Work Orders</span><strong>{subcontractingSummary.activeWorkOrders}</strong><small>Approved or in progress</small></article>
            <article className="dashboard-status-card status-budget"><span>💳 Contract Value</span><strong>{formatMoney(subcontractingSummary.totalContractValue)}</strong><small>Cancelled work excluded</small></article>
            <article className="dashboard-status-card status-inventory"><span>✅ Certified Work</span><strong>{formatMoney(subcontractingSummary.certifiedAmount)}</strong><small>Operational certification, not an extra expense</small></article>
            <article className="dashboard-status-card status-inventory-low"><span>⏳ Pending Bills</span><strong>{formatMoney(subcontractingSummary.pendingPayable)}</strong><small>Retention: {formatMoney(subcontractingSummary.retentionBalance)}</small></article>
            <article className="dashboard-status-card status-inventory-out"><span>⚠️ Overdue Orders</span><strong>{subcontractingSummary.overdueWorkOrders}</strong><small>Review expected completion dates</small></article>
          </div>
        </section>
        <section aria-labelledby="boq-overview">
          <div className="dashboard-section-header"><div><span className="dashboard-eyebrow">Quantity control</span><h2 id="boq-overview">📐 BOQ &amp; Measurement Overview</h2></div></div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-inventory"><span>📋 BOQ Items</span><strong>{boqSummary.itemCount}</strong><small>Original BOQ: {formatMoney(boqSummary.originalBoqValue)}</small></article>
            <article className="dashboard-status-card status-running"><span>📈 Measured Progress</span><strong>{boqSummary.overallProgressPercent}%</strong><small>{formatMoney(boqSummary.measuredWorkValue)} measured value</small></article>
            <article className="dashboard-status-card status-pending"><span>✅ Pending Certification</span><strong>{boqSummary.pendingCertificationQuantity}</strong><small>{formatMoney(boqSummary.certifiedWorkValue)} certified value</small></article>
            <article className="dashboard-status-card status-budget"><span>🧾 Approved Variations</span><strong>{formatMoney(boqSummary.approvedVariationValue)}</strong><small>{boqSummary.pendingVariationCount} variation(s) awaiting approval</small></article>
            <article className="dashboard-status-card status-inventory-low"><span>⚠️ Low Progress Sites</span><strong>{lowProgressBoqSites.length}</strong><small>{lowProgressBoqSites.slice(0, 3).join(", ") || "No BOQ items yet"}</small></article>
          </div>
        </section>        <section aria-labelledby="client-billing-overview">
          <div className="dashboard-section-header"><div><span className="dashboard-eyebrow">Client receivables</span><h2 id="client-billing-overview">🧾 Client Billing Overview</h2></div></div>
          <div className="dashboard-status-grid">
            <article className="dashboard-status-card status-inventory"><span>🧾 Certified RA Bills</span><strong>{clientBillingSummary.certifiedRABillCount}</strong><small>Operational bills with a canonical invoice</small></article>
            <article className="dashboard-status-card status-running"><span>💳 Received</span><strong>{formatMoney(clientBillingSummary.totalReceived)}</strong><small>From the existing invoice ledger</small></article>
            <article className="dashboard-status-card status-pending"><span>⏳ Outstanding</span><strong>{formatMoney(clientBillingSummary.outstandingReceivable)}</strong><small>Invoice receivables still pending</small></article>
            <article className="dashboard-status-card status-budget"><span>🔒 Retention Held</span><strong>{formatMoney(clientBillingSummary.retentionReceivable)}</strong><small>Not counted as additional income</small></article>
            <article className="dashboard-status-card status-inventory-out"><span>⚠️ Overdue RA Receivable</span><strong>{formatMoney(clientBillingSummary.overdueReceivable)}</strong><small>{clientBillingSummary.pendingCertificationCount} submitted bill(s) awaiting certification</small></article>
          </div>
        </section>
        <section aria-labelledby="financial-charts">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Visual reporting</span>
              <h2 id="financial-charts">Financial performance</h2>
            </div>
          </div>
          <div className="dashboard-chart-grid">
            <article className="dashboard-chart-card">
              <div className="dashboard-chart-heading">
                <div>
                  <h3>Revenue vs Actual Cost</h3>
                  <p>Canonical invoices compared with recorded project costs.</p>
                </div>
              </div>
              {!hasIncomeExpenseData ? (
                <p className="dashboard-chart-empty">No financial entries are available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={incomeExpenseChartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${toNumber(value).toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value) => formatMoney(value)} cursor={{ fill: "#eff6ff" }} />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {incomeExpenseChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.name === "Revenue" ? "#2563eb" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="dashboard-chart-card">
              <div className="dashboard-chart-heading">
                <div>
                  <h3>Site-wise Profit / Loss</h3>
                  <p>Each bar uses the same site summary shown above.</p>
                </div>
              </div>
              {siteProfitChartData.length === 0 ? (
                <p className="dashboard-chart-empty">No site financial data is available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={siteProfitChartData} margin={{ top: 12, right: 8, left: 0, bottom: 34 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} angle={-18} textAnchor="end" interval={0} height={62} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${toNumber(value).toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Bar dataKey="profit" radius={[7, 7, 0, 0]}>
                      {siteProfitChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.profit >= 0 ? "#16a34a" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="dashboard-chart-card">
              <div className="dashboard-chart-heading">
                <div>
                  <h3>Expense Breakdown</h3>
                  <p>Categories reconcile to total expense without double counting.</p>
                </div>
              </div>
              {expenseBreakdownData.length === 0 ? (
                <p className="dashboard-chart-empty">No expense entries are available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <PieChart>
                    <Pie data={expenseBreakdownData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={90} paddingAngle={3}>
                      {expenseBreakdownData.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="dashboard-chart-card">
              <div className="dashboard-chart-heading">
                <div>
                  <h3>Budget vs Actual Cost</h3>
                  <p>Only sites with approved budgets are included.</p>
                </div>
              </div>
              {!hasBudgetVsActualData ? (
                <p className="dashboard-chart-empty">No approved site budgets with actual costs are available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart data={budgetVsActualChartData} margin={{ top: 12, right: 8, left: 0, bottom: 34 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} angle={-18} textAnchor="end" interval={0} height={62} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${toNumber(value).toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Legend verticalAlign="top" height={28} />
                    <Bar dataKey="budget" name="Budget" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="actual" name="Actual cost" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </article>

            <article className="dashboard-chart-card">
              <div className="dashboard-chart-heading">
                <div>
                  <h3>Monthly Revenue &amp; Cost Trend</h3>
                  <p>Month-wise canonical financial entries only.</p>
                </div>
              </div>
              {!hasMonthlyTrendData ? (
                <p className="dashboard-chart-empty">No dated financial trend data is available yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={270}>
                  <LineChart data={monthlyFinancialTrendData} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `₹${toNumber(value).toLocaleString("en-IN")}`} />
                    <Tooltip formatter={(value) => formatMoney(value)} />
                    <Legend verticalAlign="top" height={28} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="cost" name="Actual cost" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </article>
          </div>
        </section>

        <section aria-labelledby="today-dpr">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Field operations</span>
              <h2 id="today-dpr">📋 Today&apos;s Site Progress</h2>
            </div>
          </div>
          <div className="dashboard-status-grid dashboard-dpr-grid">
            <article className="dashboard-status-card status-dpr"><span>📋 DPR Submitted</span><strong>{todayDprSummary.todayCount}</strong><small>Updates received today</small></article>
            <article className="dashboard-status-card status-manpower"><span>👷 Manpower Reported</span><strong>{todayDprSummary.totalManpower}</strong><small>Across today&apos;s DPRs</small></article>
            <article className="dashboard-status-card status-sites"><span>🏗️ Sites Submitted</span><strong>{todayDprSummary.submittedSites.length}</strong><small>Sites with updates today</small></article>
            <article className="dashboard-status-card status-pending"><span>⏳ Sites Without DPR</span><strong>{sitesWithoutDprToday}</strong><small>Awaiting today&apos;s update</small></article>
          </div>

          <article className="dashboard-dpr-activity-card">
            <div className="dashboard-card-title-row">
              <div>
                <h3>🛠️ Recent DPR Activity</h3>
                <p>Operational updates only — not included in financial expenses.</p>
              </div>
            </div>
            {dprLoading ? (
              <p className="empty-text">Loading daily progress reports...</p>
            ) : dprError ? (
              <p className="dashboard-dpr-error">{dprError}</p>
            ) : todayDprSummary.recentReports.length === 0 ? (
              <p className="empty-text">No daily progress reports are available yet.</p>
            ) : (
              <div className="dashboard-dpr-list">
                {todayDprSummary.recentReports.map((report, index) => (
                  <div className="dashboard-dpr-item" key={report.id || `${report.date || "legacy"}-${index}`}>
                    <div>
                      <strong>{report.workActivity || "Work activity not recorded"}</strong>
                      <p>{getSiteName(report) || "Site not recorded"} · {report.date || "Date not recorded"}</p>
                    </div>
                    <span>
                      {report.quantity ?? "-"} {report.unit || ""}
                      {report.manpowerCount !== undefined && report.manpowerCount !== "" ? ` · ${report.manpowerCount} manpower` : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section aria-labelledby="equipment-overview">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Plant and transport operations</span>
              <h2 id="equipment-overview">🚚 Equipment &amp; Vehicle Overview</h2>
            </div>
          </div>
          <div className="dashboard-status-grid dashboard-equipment-grid">
            <article className="dashboard-status-card status-inventory"><span>🚚 Total Equipment</span><strong>{equipmentSummary.total}</strong><small>Registered vehicles and equipment</small></article>
            <article className="dashboard-status-card status-running"><span>🟢 Active</span><strong>{equipmentSummary.active}</strong><small>Available for site operations</small></article>
            <article className="dashboard-status-card status-pending"><span>⏸️ Idle</span><strong>{equipmentSummary.idle}</strong><small>Not currently deployed</small></article>
            <article className="dashboard-status-card status-budget"><span>🛠️ Under Maintenance</span><strong>{equipmentSummary.underMaintenance}</strong><small>Service work in progress</small></article>
            <article className="dashboard-status-card status-inventory-out"><span>⚠️ Breakdown</span><strong>{equipmentSummary.breakdown}</strong><small>Requires operational attention</small></article>
            <article className="dashboard-status-card status-labour"><span>⛽ Fuel Cost</span><strong>{formatMoney(equipmentSummary.fuelCost)}</strong><small>From dated fuel ledger entries</small></article>
            <article className="dashboard-status-card status-inventory-low"><span>🔧 Maintenance Cost</span><strong>{formatMoney(equipmentSummary.maintenanceCost)}</strong><small>Linked vehicle-expense entries only</small></article>
          </div>
        </section>

        <section aria-labelledby="attendance-overview">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Workforce operations</span>
              <h2 id="attendance-overview">👥 Attendance Overview</h2>
            </div>
          </div>
          <div className="dashboard-status-grid dashboard-attendance-grid">
            <article className="dashboard-status-card status-present"><span>🟢 Present Today</span><strong>{workforceSummary.presentToday}</strong><small>Today's attendance records</small></article>
            <article className="dashboard-status-card status-absent"><span>🔴 Absent Today</span><strong>{workforceSummary.absentToday}</strong><small>Today's attendance records</small></article>
            <article className="dashboard-status-card status-labour"><span>👷 Active Labour</span><strong>{workforceSummary.activeLabour}</strong><small>Active labour masters</small></article>
            <article className="dashboard-status-card status-labour"><span>💵 Monthly Payroll</span><strong>{formatMoney(workforceSummary.monthlyPayroll)}</strong><small>Current-month net payroll</small></article>
            <article className="dashboard-status-card status-labour"><span>💵 Pending Salary</span><strong>{formatMoney(workforceSummary.pendingSalary)}</strong><small>Current-month payroll balance</small></article>
          </div>
        </section>

        <section aria-labelledby="attention-required">
          <div className="dashboard-section-header dashboard-attention-heading">
            <div>
              <span className="dashboard-eyebrow">Follow-up queue</span>
              <h2 id="attention-required">⚠️ Attention Required</h2>
            </div>
          </div>
          <div className="dashboard-alert-grid">
          <article className="dashboard-alert-card">
            <div className="dashboard-card-title-row">
              <div><h3>⏳ Pending Invoice Alerts</h3><p>Invoices with a balance still outstanding.</p></div>
              <span className="dashboard-alert-count">{pendingInvoices.length}</span>
            </div>
            {pendingInvoices.length === 0 ? (
              <p className="empty-text">🎉 No pending invoices.</p>
            ) : (
              pendingInvoices.slice(0, 5).map((item) => {
                const { pending } = getInvoiceSummary(item);

                return (
                  <div className="alert-item" key={item.id}>
                    <div><strong>{item.invoiceNo || "Invoice"}</strong><p>{getSiteName(item) || "Site not recorded"}</p></div>
                    <strong className="loss-text">{formatMoney(pending)}</strong>
                  </div>
                );
              })
            )}
          </article>

          <article className="dashboard-alert-card">
            <div className="dashboard-card-title-row">
              <div><h3>⚠️ Low Stock Alert</h3><p>Materials at or below their configured minimum.</p></div>
              <span className="dashboard-alert-count dashboard-alert-warning">{lowStockMaterials.length}</span>
            </div>
            {lowStockMaterials.length === 0 ? (
              <p className="empty-text">🎉 Stock levels are normal.</p>
            ) : (
              lowStockMaterials.slice(0, 5).map((item) => (
                <div className="alert-item" key={item.id}>
                  <div><strong>{item.materialName || item.name || "Material"}</strong><p>Site: {getSiteName(item) || "-"}</p></div>
                  <strong className="loss-text">{item.stock ?? item.quantity ?? item.qty ?? 0}</strong>
                </div>
              ))
            )}
          </article>
          </div>
        </section>
      </div>
    </Layout>
  );
}

export default Dashboard;
