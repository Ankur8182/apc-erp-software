import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../Components/Sidebar";
import Header from "../Components/Header";
import "../Styles/SiteDetails.css";

import { db } from "../firebase";
import {
  calculateFinancialSummary,
  getRecordDate,
  getSiteName,
  isSameSite,
} from "../utils/financialReporting";
import {
  getDailyProgressOperationalSummary,
  getDprTodayDate,
  getDprUsageValues,
} from "../utils/dailyProgressReporting";

import {
  collection,
  onSnapshot
} from "firebase/firestore";

function SiteDetails() {

  const { id } = useParams();

  const [sites, setSites] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
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


  // =========================
  // SITE REPORT CALCULATION
  // =========================

  const siteReport = useMemo(() => {

    if (!selectedSite) {
      return {
        income: 0,
        materialExpense: 0,
        labourExpense: 0,
        vehicleExpense: 0,
        otherExpense: 0,
        totalExpense: 0,
        profitLoss: 0,
        invoiceCount: 0,
        materialCount: 0,
        expenseCount: 0,
        salaryCount: 0
      };
    }

    const siteInvoices = invoices.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteMaterials = materials.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteLabours = labours.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteSalaries = salaries.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteAttendance = attendance.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteExpenses = expenses.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteVehicles = vehicles.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const siteVehicleExpenses = vehicleExpenses.filter((item) =>
      isSameSite(item, selectedSite)
    );
    const summary = calculateFinancialSummary({
      invoices: siteInvoices,
      materials: siteMaterials,
      labours: siteLabours,
      salaries: siteSalaries,
      attendance: siteAttendance,
      expenses: siteExpenses,
      vehicles: siteVehicles,
      vehicleExpenses: siteVehicleExpenses
    });

    return {
      income: summary.income,
      materialExpense: summary.materialExpense,
      labourExpense: summary.labourExpense,
      vehicleExpense: summary.vehicleExpense,
      otherExpense: summary.otherExpenseFromExpenses,
      totalExpense: summary.totalExpense,
      profitLoss: summary.profit,
      invoiceCount: siteInvoices.length,
      materialCount: siteMaterials.length,
      expenseCount: siteExpenses.length,
      salaryCount: siteSalaries.length
    };

  }, [

    selectedSite,

    invoices,

    materials,

    labours,

    salaries,

    attendance,

    expenses,

    vehicles,

    vehicleExpenses

  ]);


  // =========================
  // SITE DPR OPERATIONAL SUMMARY
  // =========================

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
                    Total Income
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

                    Site: {selectedSite}

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

                  </thead>


                  <tbody>


                    <tr>

                      <td>
                        Total Income
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


              {/* =========================
                  DAILY PROGRESS REPORT
              ========================= */}

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
