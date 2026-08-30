import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../Components/Sidebar";
import Header from "../Components/Header";
import "../Styles/SiteDetails.css";

import { db } from "../firebase";
import {
  getRecordDate,
  getSiteName,
  isSameSite,
} from "../utils/financialReporting";
import {
  getDailyProgressOperationalSummary,
  getDprTodayDate,
  getDprUsageValues,
} from "../utils/dailyProgressReporting";
import { formatBudgetUsagePercent } from "../utils/siteBudget";
import { calculateProjectFinancialSummary } from "../utils/projectFinancials";
import { getClientBillingSummary } from "../utils/clientBilling";
import { getSiteBoqSummary } from "../utils/boqReporting";
import { buildProjectAnalyticsRows, formatAnalyticsPercent } from "../utils/projectAnalytics";

import {
  collection,
  onSnapshot
} from "firebase/firestore";

function SiteDetails() {

  const { id } = useParams();

  const [sites, setSites] = useState([]);
  const [siteBudgets, setSiteBudgets] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
  const [raBills, setRaBills] = useState([]);
  const [boqItems, setBoqItems] = useState([]);
  const [boqMeasurements, setBoqMeasurements] = useState([]);
  const [boqVariations, setBoqVariations] = useState([]);
  const [dprLoading, setDprLoading] = useState(true);
  const [dprError, setDprError] = useState("");

  const [selectedSite, setSelectedSite] = useState("");

  useEffect(() => {
    if (!id) return;

    const routeSite = sites.find((site) => site.id === id);

    if (routeSite) {
      setSelectedSite(getSiteName(routeSite));
    }
  }, [id, sites]);

  const availableSites = useMemo(() => {
    const siteMap = new Map();

    const addSite = (item) => {
      const siteName = getSiteName(item);
      const key = siteName.toLowerCase();

      if (!siteName || siteMap.has(key)) return;

      siteMap.set(key, {
        id: item.id || key,
        siteName,
      });
    };

    sites.forEach(addSite);
    [
      invoices,
      materials,
      labours,
      salaries,
      attendance,
      expenses,
      vehicles,
      vehicleExpenses,
      dailyProgressReports,
      raBills,
    ].forEach((records) => records.forEach(addSite));

    return Array.from(siteMap.values()).sort((first, second) =>
      first.siteName.localeCompare(second.siteName)
    );
  }, [
    sites,
    invoices,
    materials,
    labours,
    salaries,
    attendance,
    expenses,
    vehicles,
    vehicleExpenses,
    dailyProgressReports,
    raBills,
  ]);

  // =========================
  // SITES
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setSites(data);
      },
      (error) => {
        console.error("Sites error:", error);
      }
    );

    return () => unsubscribe();

  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "siteBudgets"),
      (snapshot) => {
        setSiteBudgets(snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })));
      },
      (error) => {
        console.error("Site budget error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // ATTENDANCE
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "attendance"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setAttendance(data);
      },
      (error) => {
        console.error("Attendance error:", error);
      }
    );

    return () => unsubscribe();

  }, []);

  // =========================
  // DAILY PROGRESS REPORTS
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "dailyProgressReports"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setDailyProgressReports(data);
        setDprError("");
        setDprLoading(false);
      },
      (error) => {
        console.error("Daily progress report error:", error);
        setDprError("Daily progress reports could not be loaded.");
        setDprLoading(false);
      }
    );

    return () => unsubscribe();

  }, []);

  // =========================
  // VEHICLE EXPENSE HISTORY
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "vehicleExpenses"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setVehicleExpenses(data);
      },
      (error) => {
        console.error("Vehicle expense error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // INVOICES
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setInvoices(data);
      },
      (error) => {
        console.error("Invoice error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // CLIENT RA BILLS
  // =========================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "raBills"),
      (snapshot) => setRaBills(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      (error) => console.error("RA bill error:", error)
    );
    return () => unsubscribe();
  }, []);
  // =========================
  // MATERIALS
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "materials"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setMaterials(data);
      },
      (error) => {
        console.error("Material error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // LABOURS
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "labours"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setLabours(data);
      },
      (error) => {
        console.error("Labour error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // SALARIES
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "salaries"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setSalaries(data);
      },
      (error) => {
        console.error("Salary error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // EXPENSES
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "expenses"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setExpenses(data);
      },
      (error) => {
        console.error("Expense error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // VEHICLES
  // =========================

  useEffect(() => {

    const unsubscribe = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setVehicles(data);
      },
      (error) => {
        console.error("Vehicle error:", error);
      }
    );

    return () => unsubscribe();

  }, []);


  // BOQ quantity records remain operational/commercial progress data and do
  // not flow into the existing project financial calculation.
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "boqItems"), (snapshot) => setBoqItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => {});
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "boqMeasurements"), (snapshot) => setBoqMeasurements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => {});
    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "boqVariations"), (snapshot) => setBoqVariations(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => {});
    return () => unsubscribe();
  }, []);
  // =========================
  // SITE REPORT CALCULATION
  // =========================

  const siteReport = useMemo(() => {
    const siteInvoices = invoices.filter((item) => isSameSite(item, selectedSite));
    const siteMaterials = materials.filter((item) => isSameSite(item, selectedSite));
    const siteLabours = labours.filter((item) => isSameSite(item, selectedSite));
    const siteSalaries = salaries.filter((item) => isSameSite(item, selectedSite));
    const siteAttendance = attendance.filter((item) => isSameSite(item, selectedSite));
    const siteExpenses = expenses.filter((item) => isSameSite(item, selectedSite));
    const siteVehicles = vehicles.filter((item) => isSameSite(item, selectedSite));
    const siteVehicleExpenses = vehicleExpenses.filter((item) => isSameSite(item, selectedSite));
    const siteRecord = sites.find((item) => isSameSite(item, selectedSite)) || { siteName: selectedSite };
    const budgetRecord = siteBudgets.find((budget) =>
      budget.siteId === siteRecord.id || budget.id === siteRecord.id || isSameSite(budget, selectedSite)
    ) || siteRecord;
    const summary = calculateProjectFinancialSummary({
      budgetRecord,
      invoices: siteInvoices,
      materials: siteMaterials,
      labours: siteLabours,
      salaries: siteSalaries,
      attendance: siteAttendance,
      attendanceSalaryCoverage: siteSalaries,
      expenses: siteExpenses,
      vehicles: siteVehicles,
      vehicleExpenses: siteVehicleExpenses,
      vehicleExpenseCoverage: siteVehicleExpenses,
      raBills: raBills.filter((item) => isSameSite(item, selectedSite)),
    });

    return {
      income: summary.revenue,
      received: summary.received,
      outstanding: summary.outstanding,
      retention: summary.retention,
      materialExpense: summary.materialCost,
      labourExpense: summary.labourCost,
      contractorExpense: summary.contractorCost,
      vehicleExpense: summary.vehicleCost,
      otherExpense: summary.otherCost,
      totalExpense: summary.totalCost,
      profitLoss: summary.profit,
      marginPercent: summary.marginPercent,
      invoiceCount: siteInvoices.length,
      materialCount: siteMaterials.length,
      expenseCount: siteExpenses.length,
      salaryCount: siteSalaries.length,
      financialSummary: summary,
    };
  }, [
    selectedSite,
    sites,
    siteBudgets,
    invoices,
    materials,
    labours,
    salaries,
    attendance,
    expenses,
    vehicles,
    vehicleExpenses,
    raBills,
  ]);

  const siteBudgetSummary = siteReport.financialSummary.budgetSummary;
  const siteClientBillingSummary = useMemo(
    () => getClientBillingSummary({
      invoices: invoices.filter((item) => isSameSite(item, selectedSite)),
      raBills: raBills.filter((item) => isSameSite(item, selectedSite)),
    }),
    [invoices, raBills, selectedSite]
  );
  const siteRABills = useMemo(
    () => raBills.filter((item) => isSameSite(item, selectedSite)).sort((first, second) => String(second.billDate || "").localeCompare(String(first.billDate || ""))),
    [raBills, selectedSite]
  );
  // =========================
  // SITE DPR OPERATIONAL SUMMARY
  // =========================

  const siteBoqSummary = useMemo(() => getSiteBoqSummary({ site: selectedSite, items: boqItems, measurements: boqMeasurements, variations: boqVariations, raBills }), [selectedSite, boqItems, boqMeasurements, boqVariations, raBills]);
  const siteAnalytics = useMemo(() => buildProjectAnalyticsRows({
    siteRows: [{
      id: id || selectedSite,
      siteName: selectedSite,
      status: sites.find((site) => isSameSite(site, selectedSite))?.status || "",
      ...siteReport.financialSummary,
    }],
    boqItems,
    boqMeasurements,
    boqVariations,
    raBills,
  })[0] || null, [id, selectedSite, sites, siteReport.financialSummary, boqItems, boqMeasurements, boqVariations, raBills]);

  const siteDprSummary = useMemo(
    () =>
      getDailyProgressOperationalSummary(dailyProgressReports, {
        date: getDprTodayDate(),
        site: selectedSite,
      }),
    [dailyProgressReports, selectedSite]
  );


  // =========================
  // FORMAT MONEY
  // =========================

  const formatMoney = (amount) => {

    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
      }
    ).format(amount || 0);

  };


  return (

    <div
      style={{
        display: "flex"
      }}
    >

      <Sidebar />

      <div
        className="main"
        style={{
          marginLeft: "250px",
          width: "calc(100% - 250px)",
          minHeight: "100vh",
          background: "#f4f6f9",
          padding: "25px"
        }}
      >

        <Header />

        <div className="site-details-page">


          {/* =========================
              TITLE
          ========================= */}

          <h1 className="site-details-title">

            🏗 Site-wise Financial Details

          </h1>


          <p className="site-details-subtitle">

            Select a site to view complete income,
            expense and profit/loss details

          </p>


          {/* =========================
              SITE SELECTOR
          ========================= */}

          <div className="site-selector-card">

            <label>

              Select Site

            </label>


            <select
              value={selectedSite}
              onChange={(e) =>
                setSelectedSite(
                  e.target.value
                )
              }
            >

              <option value="">

                -- Select Site --

              </option>


              {availableSites.map((item) => (

                <option
                  key={item.id}
                  value={item.siteName}
                >

                  {item.siteName}

                </option>

              ))}

            </select>

          </div>


          {/* =========================
              EMPTY STATE
          ========================= */}

          {!selectedSite ? (

            <div className="select-site-message">

              🏗 Please select a site to view
              financial details

            </div>

          ) : (

            <>


              {/* =========================
                  SELECTED SITE
              ========================= */}

              <h2 className="selected-site-heading">

                📍 {selectedSite}

              </h2>


              {/* =========================
                  SUMMARY CARDS
              ========================= */}

              <div className="site-summary-grid">


                <div className="site-summary-card income-card">

                  <span className="summary-icon">
                    💰
                  </span>

                  <h3>
                    Recognized Revenue
                  </h3>

                  <h2>
                    {formatMoney(siteReport.income)}
                  </h2>

                  <p>
                    {siteReport.invoiceCount} Invoice Records
                  </p>

                </div>


                <div className="site-summary-card material-card">

                  <span className="summary-icon">
                    📦
                  </span>

                  <h3>
                    Material Expense
                  </h3>

                  <h2>
                    {formatMoney(
                      siteReport.materialExpense
                    )}
                  </h2>

                  <p>
                    {siteReport.materialCount} Material Records
                  </p>

                </div>


                <div className="site-summary-card labour-card">

                  <span className="summary-icon">
                    👷
                  </span>

                  <h3>
                    Labour Expense
                  </h3>

                  <h2>
                    {formatMoney(
                      siteReport.labourExpense
                    )}
                  </h2>

                  <p>
                    {siteReport.salaryCount} Salary Records
                  </p>

                </div>


                               <div className="site-summary-card expense-card">
                 <span className="summary-icon">🧱</span>
                 <h3>Contractor Cost</h3>
                 <h2>{formatMoney(siteReport.contractorExpense)}</h2>
                 <p>Certified contractor bills post one linked expense</p>
               </div>
<div className="site-summary-card vehicle-card-report">

                  <span className="summary-icon">
                    🚚
                  </span>

                  <h3>
                    Vehicle Expense
                  </h3>

                  <h2>
                    {formatMoney(
                      siteReport.vehicleExpense
                    )}
                  </h2>

                </div>


                <div className="site-summary-card expense-card">

                  <span className="summary-icon">
                    💸
                  </span>

                  <h3>
                    Other Expense
                  </h3>

                  <h2>
                    {formatMoney(
                      siteReport.otherExpense
                    )}
                  </h2>

                  <p>
                    {siteReport.expenseCount} Expense Records
                  </p>

                </div>


                <div className="site-summary-card total-card">

                  <span className="summary-icon">
                    📊
                  </span>

                  <h3>
                    Total Expense
                  </h3>

                  <h2>
                    {formatMoney(
                      siteReport.totalExpense
                    )}
                  </h2>

                </div>

              </div>


              {/* =========================
                  PROFIT / LOSS
              ========================= */}

              <div
                className={
                  siteReport.profitLoss >= 0
                    ? "profit-loss-card profit"
                    : "profit-loss-card loss"
                }
              >

                <div>

                  <h3>

                    {
                      siteReport.profitLoss >= 0
                        ? "📈 Net Profit"
                        : "📉 Net Loss"
                    }

                  </h3>


                  <p>

                    Site: {selectedSite} · Margin: {siteReport.marginPercent === null ? "N/A" : `${siteReport.marginPercent}%`}

                  </p>

                </div>


                <h1>

                  {formatMoney(
                    Math.abs(
                      siteReport.profitLoss
                    )
                  )}

                </h1>

              </div>


              {/* =========================
                  FINANCIAL TABLE
              ========================= */}

              <div className="site-details-table-card">

                <h2>

                  📊 Financial Summary

                </h2>


                <table className="site-details-table">

                  <thead>

                    <tr>

                      <th>
                        Particular
                      </th>

                      <th>
                        Amount
                      </th>

                    </tr>
                    <tr>
                      <td>Cash Received</td>
                      <td>{formatMoney(siteReport.received)}</td>
                    </tr>
                    <tr>
                      <td>Outstanding Receivable</td>
                      <td>{formatMoney(siteReport.outstanding)}</td>
                    </tr>
                    <tr>
                      <td>Retention Receivable</td>
                      <td>{formatMoney(siteReport.retention)}</td>
                    </tr>

                  </thead>


                  <tbody>


                    <tr>

                      <td>
                        Recognized Revenue
                      </td>

                      <td>
                        {formatMoney(
                          siteReport.income
                        )}
                      </td>

                    </tr>


                    <tr>

                      <td>
                        Material Expense
                      </td>

                      <td>
                        {formatMoney(
                          siteReport.materialExpense
                        )}
                      </td>

                    </tr>


                    <tr>

                      <td>
                        Labour / Salary Expense
                      </td>

                      <td>
                        {formatMoney(
                          siteReport.labourExpense
                        )}
                      </td>

                    </tr>
                    <tr>
                      <td>Contractor / Subcontractor Cost</td>
                      <td>{formatMoney(siteReport.contractorExpense)}</td>
                    </tr>


                    <tr>

                      <td>
                        Vehicle Expense
                      </td>

                      <td>
                        {formatMoney(
                          siteReport.vehicleExpense
                        )}
                      </td>

                    </tr>


                    <tr>

                      <td>
                        Other Expense
                      </td>

                      <td>
                        {formatMoney(
                          siteReport.otherExpense
                        )}
                      </td>

                    </tr>


                    <tr className="total-row">

                      <td>
                        Total Expense
                      </td>

                      <td>
                        {formatMoney(
                          siteReport.totalExpense
                        )}
                      </td>

                    </tr>


                    <tr
                      className={
                        siteReport.profitLoss >= 0
                          ? "profit-row"
                          : "loss-row"
                      }
                    >

                      <td>

                        {
                          siteReport.profitLoss >= 0
                            ? "Net Profit"
                            : "Net Loss"
                        }

                      </td>


                      <td>

                        {formatMoney(
                          Math.abs(
                            siteReport.profitLoss
                          )
                        )}

                      </td>

                    </tr>


                  </tbody>

                </table>

              </div>
              <section className="site-budget-section" aria-labelledby="site-client-billing-title">
                <div className="site-budget-heading">
                  <div>
                    <h2 id="site-client-billing-title">🧾 Client Billing &amp; Receivables</h2>
                    <p>Certified RA bills create one linked invoice. Income and collections below reuse the same invoice ledger as the financial summary.</p>
                  </div>
                </div>
                <div className="site-budget-summary-grid">
                  <article className="site-budget-summary-card"><span>Invoice Billing</span><strong>{formatMoney(siteClientBillingSummary.totalClientBilling)}</strong><small>Canonical income source</small></article>
                  <article className="site-budget-summary-card"><span>Received</span><strong>{formatMoney(siteClientBillingSummary.totalReceived)}</strong><small>Recorded invoice collections</small></article>
                  <article className="site-budget-summary-card"><span>Outstanding</span><strong>{formatMoney(siteClientBillingSummary.outstandingReceivable)}</strong><small>Pending invoice receivables</small></article>
                  <article className="site-budget-summary-card"><span>Retention Held</span><strong>{formatMoney(siteClientBillingSummary.retentionReceivable)}</strong><small>{siteClientBillingSummary.pendingCertificationCount} RA bill(s) awaiting certification</small></article>
                </div>
                <div className="site-budget-table-responsive"><table className="site-budget-table"><thead><tr><th>RA Bill</th><th>Bill / Due</th><th>Net Receivable</th><th>Received / Pending</th><th>Retention</th><th>Status</th></tr></thead><tbody>
                  {siteRABills.length === 0 ? <tr><td colSpan="6">No RA bills are recorded for this site yet.</td></tr> : siteRABills.slice(0, 8).map((bill) => <tr key={bill.id}><td>{bill.raBillNumber || bill.id}<br /><small>{bill.clientName || "-"}</small></td><td>{bill.billDate || "-"}<br /><small>Due: {bill.paymentDueDate || "-"}</small></td><td>{formatMoney(bill.netBillAmount)}</td><td>{formatMoney(bill.receivedAmount)} / {formatMoney(bill.pendingAmount)}</td><td>{formatMoney(bill.retentionBalance)}</td><td>{bill.status || "Draft"}</td></tr>)}
                </tbody></table></div>
              </section>
              {/* =========================
                  BUDGET & COST CONTROL
              ========================= */}

              <section className="site-budget-section" aria-labelledby="site-budget-title">
                <div className="site-budget-heading">
                  <div>
                    <h2 id="site-budget-title">💰 Budget &amp; Cost Control</h2>
                    <p>Actuals reuse the financial summary above. DPR quantities are not treated as expenses.</p>
                  </div>
                  {siteBudgetSummary.hasBudget && (
                    <span className={`site-budget-status site-budget-status-${siteBudgetSummary.status}`}>
                      {siteBudgetSummary.status === "over-budget"
                        ? "Over budget"
                        : siteBudgetSummary.status === "critical"
                          ? "90% used"
                          : siteBudgetSummary.status === "warning"
                            ? "80% used"
                            : "On track"}
                    </span>
                  )}
                </div>

                {!siteBudgetSummary.hasBudget ? (
                  <p className="site-budget-empty">
                    No approved budget is recorded for this site yet. Admin or manager can add one from Site Management.
                  </p>
                ) : (
                  <>
                    <div className="site-budget-summary-grid">
                      <article className="site-budget-summary-card">
                        <span>Total Budget</span>
                        <strong>{formatMoney(siteBudgetSummary.totalBudget)}</strong>
                        {siteBudgetSummary.contingencyBudget > 0 && (
                          <small>Includes {formatMoney(siteBudgetSummary.contingencyBudget)} contingency</small>
                        )}
                      </article>
                      <article className="site-budget-summary-card">
                        <span>Actual Cost</span>
                        <strong>{formatMoney(siteBudgetSummary.actualCost)}</strong>
                        <small>Recorded materials, labour, contractor, vehicle and other costs</small>
                      </article>
                      <article className="site-budget-summary-card">
                        <span>Remaining Budget</span>
                        <strong className={siteBudgetSummary.overBudgetAmount > 0 ? "site-budget-over-text" : ""}>
                          {formatMoney(siteBudgetSummary.remainingBudget)}
                        </strong>
                        {siteBudgetSummary.overBudgetAmount > 0 && (
                          <small>Over by {formatMoney(siteBudgetSummary.overBudgetAmount)}</small>
                        )}
                      </article>
                      <article className="site-budget-summary-card">
                        <span>Budget Used</span>
                        <strong>{formatBudgetUsagePercent(siteBudgetSummary.usagePercent)}</strong>
                        <small>Income: {formatMoney(siteReport.income)} · {siteReport.profitLoss >= 0 ? "Profit" : "Loss"}: {formatMoney(Math.abs(siteReport.profitLoss))}</small>
                      </article>
                    </div>

                    <div className="site-budget-table-responsive">
                      <table className="site-budget-table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Budget</th>
                            <th>Actual</th>
                            <th>Remaining</th>
                            <th>Usage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            ["Material", siteBudgetSummary.categories.material],
                            ["Labour / Salary", siteBudgetSummary.categories.labour],
                            ["Contractor / Subcontractor", siteBudgetSummary.categories.contractor],
                            ["Vehicle / Equipment", siteBudgetSummary.categories.vehicle],
                            ["Other Expense", siteBudgetSummary.categories.other],
                          ].map(([label, category]) => (
                            <tr key={label}>
                              <td>{label}</td>
                              <td>{category.hasBudget ? formatMoney(category.budget) : "Not set"}</td>
                              <td>{formatMoney(category.actual)}</td>
                              <td className={category.remaining !== null && category.remaining < 0 ? "site-budget-over-text" : ""}>
                                {category.hasBudget ? formatMoney(category.remaining) : "Not set"}
                              </td>
                              <td>{formatBudgetUsagePercent(category.usagePercent)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
                            <section className="site-dpr-section">
                <div className="site-dpr-heading"><div><h2>🩺 Project Financial Performance</h2><p>Derived from the canonical invoice, cost, budget, RA, and BOQ records. It does not create a second financial ledger.</p></div></div>
                {!siteAnalytics ? <p className="site-dpr-empty">Project analytics are loading.</p> : <><div className="site-dpr-summary-grid"><div className="site-dpr-summary-card"><h3>Revenue / Actual Cost</h3><p>{formatMoney(siteAnalytics.revenue)} / {formatMoney(siteAnalytics.totalCost)}</p></div><div className="site-dpr-summary-card"><h3>Profit / Margin</h3><p className={siteAnalytics.profit >= 0 ? "profit-text" : "loss-text"}>{formatMoney(siteAnalytics.profit)} · {formatAnalyticsPercent(siteAnalytics.marginPercent)}</p></div><div className="site-dpr-summary-card"><h3>Project Health</h3><p className={siteAnalytics.health.status === "Critical" ? "loss-text" : siteAnalytics.health.status === "Healthy" ? "profit-text" : ""}>{siteAnalytics.health.status}{siteAnalytics.health.score === null ? "" : ` (${siteAnalytics.health.score})`}</p></div><div className="site-dpr-summary-card"><h3>Receivable / Overdue</h3><p>{formatMoney(siteAnalytics.outstanding)} / {formatMoney(siteAnalytics.revenueAnalytics.overdueReceivable)}</p></div></div><div className="site-dpr-history-card"><h3>Cost, Budget &amp; Progress Insights</h3><div className="site-dpr-table-responsive"><table className="site-dpr-table"><tbody><tr><th>Largest cost driver</th><td>{siteAnalytics.costBreakdown.largestCategory ? `${siteAnalytics.costBreakdown.largestCategory.label} · ${formatMoney(siteAnalytics.costBreakdown.largestCategory.amount)} (${formatAnalyticsPercent(siteAnalytics.costBreakdown.largestCategory.percent)})` : "No canonical cost data"}</td></tr><tr><th>Budget status</th><td>{siteAnalytics.budgetSummary?.hasBudget ? `${formatMoney(siteAnalytics.totalBudget)} budget · ${formatBudgetUsagePercent(siteAnalytics.budgetUsagePercent)} used · ${siteAnalytics.overBudgetAmount > 0 ? `${formatMoney(siteAnalytics.overBudgetAmount)} over budget` : formatMoney(siteAnalytics.budgetRemaining)} remaining` : "No approved budget set"}</td></tr><tr><th>Physical vs billing</th><td>{siteAnalytics.boqAnalytics.comparison} · {formatAnalyticsPercent(siteAnalytics.boqAnalytics.measuredProgressPercent)} physical / {formatAnalyticsPercent(siteAnalytics.boqAnalytics.billedProgressPercent)} billed</td></tr><tr><th>Conservative forecast</th><td>{siteAnalytics.forecast.status === "Available" ? `${formatMoney(siteAnalytics.forecast.projectedFinalCost)} projected cost · ${formatMoney(siteAnalytics.forecast.projectedProfit)} projected profit/loss · ${formatAnalyticsPercent(siteAnalytics.forecast.projectedMarginPercent)} margin` : "Insufficient data — requires actual cost, revised BOQ value, and measured BOQ progress."}</td></tr></tbody></table></div>{siteAnalytics.health.reasons.length > 0 && <p className="site-dpr-empty">Management signal: {siteAnalytics.health.reasons[0]}</p>}</div></>}
              </section>
<section className="site-dpr-section">
                <div className="site-dpr-heading"><div><h2>📐 BOQ &amp; Quantity Progress</h2><p>Measured and certified quantities are operational progress only; they are not added to site expenses or income.</p></div></div>
                {siteBoqSummary.itemCount === 0 ? <p className="site-dpr-empty">No BOQ items have been registered for this site.</p> : <><div className="site-dpr-summary-grid"><div className="site-dpr-summary-card"><h3>BOQ Items</h3><p>{siteBoqSummary.itemCount}</p></div><div className="site-dpr-summary-card"><h3>Measured Progress</h3><p>{siteBoqSummary.overallProgressPercent}%</p></div><div className="site-dpr-summary-card"><h3>Certified Value</h3><p>{formatMoney(siteBoqSummary.certifiedWorkValue)}</p></div></div><div className="site-dpr-history-card"><h3>Key Incomplete Items</h3><div className="site-dpr-table-responsive"><table className="site-dpr-table"><thead><tr><th>BOQ Item</th><th>Planned / Authorised</th><th>Measured / Certified</th><th>Billed</th><th>Balance</th><th>Progress</th></tr></thead><tbody>{siteBoqSummary.incompleteItems.slice(0, 8).map((item) => <tr key={item.itemId}><td>{item.itemNumber}<br /><small>{item.description}</small></td><td>{item.plannedQuantity} / {item.authorizedQuantity} {item.unit}</td><td>{item.measuredQuantity} / {item.certifiedQuantity} {item.unit}</td><td>{item.billedQuantity} {item.unit}</td><td>{item.balanceQuantity} {item.unit}</td><td>{item.progressPercent}%</td></tr>)}</tbody></table></div></div></>}
              </section>

              {/* =========================
                  DAILY PROGRESS REPORT
              ========================= */}}

              <section className="site-dpr-section">

                <div className="site-dpr-heading">
                  <div>
                    <h2>📋 Daily Progress Report</h2>
                    <p>Operational progress only — not included in financial expenses.</p>
                  </div>
                </div>

                {dprLoading ? (
                  <p className="site-dpr-state">Loading daily progress reports...</p>
                ) : dprError ? (
                  <p className="site-dpr-state site-dpr-error">{dprError}</p>
                ) : (
                  <>

                    <div className="site-dpr-summary-grid">

                      <div className="site-dpr-summary-card">
                        <h3>Today&apos;s DPR</h3>
                        <p>{siteDprSummary.todayCount}</p>
                      </div>

                      <div className="site-dpr-summary-card">
                        <h3>Today&apos;s Manpower</h3>
                        <p>{siteDprSummary.totalManpower}</p>
                      </div>

                      <div className="site-dpr-summary-card">
                        <h3>Output Units</h3>
                        <p>{siteDprSummary.outputByUnit.length}</p>
                      </div>

                    </div>

                    <div className="site-dpr-detail-grid">

                      <div className="site-dpr-detail-card">
                        <h3>🛠️ Today&apos;s Work / Activity</h3>

                        {siteDprSummary.todayReports.length === 0 ? (
                          <p className="site-dpr-empty">No DPR submitted for this site today.</p>
                        ) : (
                          <ul className="site-dpr-list">
                            {siteDprSummary.todayReports.map((report, index) => (
                              <li key={report.id || `today-${index}`}>
                                <strong>{report.workActivity || "Work activity not recorded"}</strong>
                                <span>{report.workLocation || "Location not recorded"}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="site-dpr-detail-card">
                        <h3>📐 Today&apos;s Output by Unit</h3>

                        {siteDprSummary.outputByUnit.length === 0 ? (
                          <p className="site-dpr-empty">No valid output quantity reported today.</p>
                        ) : (
                          <ul className="site-dpr-list site-dpr-output-list">
                            {siteDprSummary.outputByUnit.map((output) => (
                              <li key={output.unit}>
                                <strong>{output.unit}</strong>
                                <span>{output.quantity}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="site-dpr-detail-card">
                        <h3>📦 Materials Used Today</h3>

                        {siteDprSummary.materialsUsed.length === 0 ? (
                          <p className="site-dpr-empty">No materials recorded today.</p>
                        ) : (
                          <ul className="site-dpr-list">
                            {siteDprSummary.materialsUsed.map((material) => (
                              <li key={material}>{material}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="site-dpr-detail-card">
                        <h3>🚚 Equipment / Vehicles Used Today</h3>

                        {siteDprSummary.equipmentUsed.length === 0 ? (
                          <p className="site-dpr-empty">No equipment or vehicles recorded today.</p>
                        ) : (
                          <ul className="site-dpr-list">
                            {siteDprSummary.equipmentUsed.map((equipment) => (
                              <li key={equipment}>{equipment}</li>
                            ))}
                          </ul>
                        )}
                      </div>

                    </div>

                    <div className="site-dpr-history-card">
                      <h3>🕘 Recent DPR History</h3>

                      {siteDprSummary.recentReports.length === 0 ? (
                        <p className="site-dpr-empty">No DPR history available for this site.</p>
                      ) : (
                        <div className="site-dpr-table-responsive">
                          <table className="site-dpr-table">
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Work Activity</th>
                                <th>Location</th>
                                <th>Output</th>
                                <th>Manpower</th>
                                <th>Materials</th>
                                <th>Equipment</th>
                                <th>Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {siteDprSummary.recentReports.map((report, index) => (
                                <tr key={report.id || `history-${index}`}>
                                  <td>{getRecordDate(report) || "Date not recorded"}</td>
                                  <td>{report.workActivity || "Not recorded"}</td>
                                  <td>{report.workLocation || "Not recorded"}</td>
                                  <td>{report.quantity ?? "-"} {report.unit || ""}</td>
                                  <td>
                                    {report.manpowerCount === undefined || report.manpowerCount === ""
                                      ? "-"
                                      : report.manpowerCount}
                                  </td>
                                  <td>{getDprUsageValues(report.materialsUsed).join(", ") || "-"}</td>
                                  <td>{getDprUsageValues(report.equipmentUsed).join(", ") || "-"}</td>
                                  <td>{String(report.remarks || "").trim() || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </>
                )}

              </section>


            </>

          )}


        </div>

      </div>

    </div>

  );

}

export default SiteDetails;
