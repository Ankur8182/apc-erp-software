import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import Layout from "../Components/Layout";
import { db } from "../firebase";
import "../Styles/Dashboard.css";
import {
  calculateFinancialSummary,
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
import {
  calculateSiteBudgetSummary,
  formatBudgetUsagePercent,
} from "../utils/siteBudget";
import { summariseInventory } from "../utils/inventory";
import { getProcurementSummary } from "../utils/procurement";

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
    };
  }, []);

  // =========================
  // HELPER FUNCTIONS
  // =========================

  const formatMoney = (amount) => {
    return `₹ ${toNumber(amount).toLocaleString("en-IN")}`;
  };

  const siteBudgetBySiteId = useMemo(
    () => new Map(siteBudgets.map((budget) => [budget.siteId || budget.id, budget])),
    [siteBudgets]
  );

  const inventorySummary = useMemo(
    () => summariseInventory(inventoryItems, inventoryTransactions),
    [inventoryItems, inventoryTransactions]
  );

  const procurementSummary = useMemo(
    () => getProcurementSummary(purchaseRequests, purchaseOrders, goodsReceipts),
    [purchaseRequests, purchaseOrders, goodsReceipts]
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
      calculateFinancialSummary({
        invoices,
        expenses,
        materials,
        labours,
        salaries,
        attendance,
        vehicles,
        vehicleExpenses,
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

  const siteSummary = useMemo(() => {
    const siteMap = new Map();

    const addSite = (item, siteDetails = {}) => {
      const siteName = getSiteName(item);
      const key = siteName.toLowerCase();

      if (!siteName || siteMap.has(key)) return;

      siteMap.set(key, {
        id: siteDetails.id || key,
        siteName,
        location: siteDetails.location || "-",
        status: siteDetails.status || "Running",
      });
    };

    sites.forEach((site) => addSite(site, site));
    [
      invoices,
      expenses,
      materials,
      salaries,
      attendance,
      vehicles,
      vehicleExpenses,
    ].forEach((records) => records.forEach((record) => addSite(record)));

    return Array.from(siteMap.values()).map((siteItem) => {
      const siteName = getSiteName(siteItem) || "Unnamed Site";
      const siteFinancialSummary = calculateFinancialSummary({
        invoices: invoices.filter((item) => isSameSite(item, siteName)),
        expenses: expenses.filter((item) => isSameSite(item, siteName)),
        materials: materials.filter((item) => isSameSite(item, siteName)),
        labours: labours.filter((item) => isSameSite(item, siteName)),
        salaries: salaries.filter((item) => isSameSite(item, siteName)),
        attendance: attendance.filter((item) => isSameSite(item, siteName)),
        vehicles: vehicles.filter((item) => isSameSite(item, siteName)),
        vehicleExpenses: vehicleExpenses.filter((item) =>
          isSameSite(item, siteName)
        ),
      });
      const budgetSummary = calculateSiteBudgetSummary(
        siteBudgetBySiteId.get(siteItem.id) || siteItem,
        siteFinancialSummary
      );

      return {
        id: siteItem.id,
        siteName,
        location:
          siteItem.location ||
          "-",
        status:
          siteItem.status ||
          "Running",
        income: siteFinancialSummary.income,
        otherExpense: siteFinancialSummary.otherExpense,
        materialExpense: siteFinancialSummary.materialExpense,
        salaryExpense: siteFinancialSummary.labourExpense,
        totalExpense: siteFinancialSummary.totalExpense,
        profit: siteFinancialSummary.profit,
        budgetSummary,
      };
    });
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
    siteBudgetBySiteId,
  ]);

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

  const presentCount = attendance.filter(
    (item) => normaliseStatus(item.status) === "present"
  ).length;

  const absentCount = attendance.filter(
    (item) => normaliseStatus(item.status) === "absent"
  ).length;

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
      label: "Total Income",
      value: formatMoney(summary.income),
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
      label: "Pending",
      value: formatMoney(summary.pending),
      icon: "⏳",
      tone: "pending",
      helper: "Awaiting collection",
    },
    {
      label: "Total Expense",
      value: formatMoney(summary.totalExpense),
      icon: "📉",
      tone: "expense",
      helper: "All recorded costs",
    },
    {
      label: summary.profit >= 0 ? "Net Profit" : "Net Loss",
      value: formatMoney(Math.abs(summary.profit)),
      icon: summary.profit >= 0 ? "📈" : "📉",
      tone: summary.profit >= 0 ? "profit" : "loss",
      helper: summary.profit >= 0 ? "Income after expenses" : "Expenses exceed income",
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
  ];

  const incomeExpenseChartData = [
    { name: "Income", amount: toNumber(summary.income) },
    { name: "Expense", amount: toNumber(summary.totalExpense) },
  ];

  const siteProfitChartData = siteSummary.map((site) => ({
    name: site.siteName,
    profit: toNumber(site.profit),
  }));

  const expenseBreakdownData = [
    { name: "Material", value: toNumber(summary.materialExpense) },
    { name: "Labour", value: toNumber(summary.labourExpense) },
    { name: "Vehicle", value: toNumber(summary.vehicleExpense) },
    { name: "Other", value: toNumber(summary.otherExpenseFromExpenses) },
  ].filter((item) => item.value > 0);

  return (
    <Layout title="🏗️ AP Construction ERP">
      <div className="dashboard-page">
        <section className="dashboard-hero">
          <div>
            <span className="dashboard-eyebrow">Operations overview</span>
            <h2>Project performance, live from your ERP.</h2>
            <p>Track finances, field progress, workforce, and site health in one place.</p>
          </div>
          <div className="dashboard-hero-status">
            <span>Live operational data</span>
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
                  <th>Income</th>
                  <th>Material</th>
                  <th>Other Expense</th>
                  <th>Labour</th>
                  <th>Total Expense</th>
                  <th>Budget</th>
                  <th>Budget Used</th>
                  <th>Remaining</th>
                  <th>Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                {siteSummary.length === 0 ? (
                  <tr>
                    <td className="dashboard-table-empty" colSpan="13">No site financial records are available yet.</td>
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
                        <td>{formatMoney(item.income)}</td>
                        <td>{formatMoney(item.materialExpense)}</td>
                        <td>{formatMoney(item.otherExpense)}</td>
                        <td>{formatMoney(item.salaryExpense)}</td>
                        <td><strong>{formatMoney(item.totalExpense)}</strong></td>
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
                  <h3>Income vs Expense</h3>
                  <p>Live totals from invoices and recorded expenses.</p>
                </div>
              </div>
              {summary.income === 0 && summary.totalExpense === 0 ? (
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
                        <Cell key={entry.name} fill={entry.name === "Income" ? "#2563eb" : "#ef4444"} />
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

        <section aria-labelledby="attendance-overview">
          <div className="dashboard-section-header">
            <div>
              <span className="dashboard-eyebrow">Workforce operations</span>
              <h2 id="attendance-overview">👥 Attendance Overview</h2>
            </div>
          </div>
          <div className="dashboard-status-grid dashboard-attendance-grid">
            <article className="dashboard-status-card status-present"><span>🟢 Present</span><strong>{presentCount}</strong><small>Attendance records marked present</small></article>
            <article className="dashboard-status-card status-absent"><span>🔴 Absent</span><strong>{absentCount}</strong><small>Attendance records marked absent</small></article>
            <article className="dashboard-status-card status-labour"><span>👷 Total Labour</span><strong>{labours.length}</strong><small>Registered labour records</small></article>
          </div>
        </section>

        <section className="dashboard-alert-grid" aria-label="Operational alerts">
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
        </section>
      </div>
    </Layout>
  );
}

export default Dashboard;
