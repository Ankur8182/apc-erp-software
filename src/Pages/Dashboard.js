import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

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

function Dashboard() {
  const [sites, setSites] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [dailyProgressReports, setDailyProgressReports] = useState([]);
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

    return () => {
      unsubscribeSites();
      unsubscribeInvoices();
      unsubscribeExpenses();
      unsubscribeMaterials();
      unsubscribeLabours();
      unsubscribeAttendance();
      unsubscribeSalaries();
      unsubscribeVehicles();
      unsubscribeVehicleExpenses();
      unsubscribeDailyProgressReports();
    };
  }, []);

  // =========================
  // HELPER FUNCTIONS
  // =========================

  const formatMoney = (amount) => {
    return `₹ ${toNumber(amount).toLocaleString("en-IN")}`;
  };

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
      const siteSummary = calculateFinancialSummary({
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

      return {
        id: siteItem.id,
        siteName,
        location:
          siteItem.location ||
          "-",
        status:
          siteItem.status ||
          "Running",
        income: siteSummary.income,
        otherExpense: siteSummary.otherExpense,
        materialExpense: siteSummary.materialExpense,
        salaryExpense: siteSummary.labourExpense,
        totalExpense: siteSummary.totalExpense,
        profit: siteSummary.profit,
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

  return (
    <Layout title="🏗️ AP Construction ERP">

      <div className="dashboard-page">

        {/* =========================
            SITE OVERVIEW
        ========================= */}

        <h2 className="dashboard-heading">
          🏗️ Site Overview
        </h2>

        <div className="dashboard-card-grid">

          <div className="dashboard-card">
            <h3>🟢 Running</h3>
            <p>{runningSites}</p>
          </div>

          <div className="dashboard-card">
            <h3>✅ Completed</h3>
            <p>{completedSites}</p>
          </div>

          <div className="dashboard-card">
            <h3>⏳ Pending</h3>
            <p>{pendingSites}</p>
          </div>

          <div className="dashboard-card">
            <h3>🏗️ Total Sites</h3>
            <p>{sites.length}</p>
          </div>

        </div>


        {/* =========================
            SITE FINANCIAL TABLE
        ========================= */}

        <div className="dashboard-table-card">

          <h2>📊 Site-wise Financial Summary</h2>

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
                  <th>Salary</th>
                  <th>Total Expense</th>
                  <th>Profit/Loss</th>
                </tr>
              </thead>

              <tbody>

                {siteSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      style={{
                        textAlign: "center",
                        padding: "25px",
                      }}
                    >
                      No Site Found
                    </td>
                  </tr>
                ) : (
                  siteSummary.map(
                    (item, index) => (
                      <tr key={item.id}>

                        <td>
                          {index + 1}
                        </td>

                        <td>
                          <strong>
                            {item.siteName}
                          </strong>
                        </td>

                        <td>
                          {item.location}
                        </td>

                        <td>
                          <span
                            className={
                              item.status === "Completed"
                                ? "completed-status"
                                : item.status === "Pending"
                                ? "pending-status"
                                : "running-status"
                            }
                          >
                            {item.status}
                          </span>
                        </td>

                        <td>
                          {formatMoney(item.income)}
                        </td>

                        <td>
                          {formatMoney(
                            item.materialExpense
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            item.otherExpense
                          )}
                        </td>

                        <td>
                          {formatMoney(
                            item.salaryExpense
                          )}
                        </td>

                        <td>
                          <strong>
                            {formatMoney(
                              item.totalExpense
                            )}
                          </strong>
                        </td>

                        <td>
                          <strong
                            className={
                              item.profit >= 0
                                ? "profit-text"
                                : "loss-text"
                            }
                          >
                            {formatMoney(item.profit)}
                          </strong>
                        </td>

                      </tr>
                    )
                  )
                )}

              </tbody>

            </table>

          </div>

        </div>


        {/* =========================
            FINANCIAL SUMMARY
        ========================= */}

        <h2 className="dashboard-heading">
          📅 Financial Summary
        </h2>

        <div className="dashboard-card-grid financial-grid">

          <div className="dashboard-card">
            <h3>🧾 Total Invoice</h3>
            <p>
              {formatMoney(
                summary.income
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>💰 Received</h3>
            <p>
              {formatMoney(
                summary.received
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>⏳ Pending Payment</h3>
            <p>
              {formatMoney(
                summary.pending
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>📦 Material Expense</h3>
            <p>
              {formatMoney(
                summary.materialExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>💸 Other Expense</h3>
            <p>
              {formatMoney(
                summary.otherExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>👷 Labour / Salary Expense</h3>
            <p>
              {formatMoney(
                summary.labourExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>📉 Total Expense</h3>
            <p>
              {formatMoney(
                summary.totalExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>
              {summary.profit >= 0
                ? "📈 Estimated Profit"
                : "📉 Estimated Loss"}
            </h3>

            <p
              className={
                summary.profit >= 0
                  ? "profit-text"
                  : "loss-text"
              }
            >
              {formatMoney(
                summary.profit
              )}
            </p>
          </div>

        </div>


        {/* =========================
            TODAY'S DPR OVERVIEW
        ========================= */}

        <h2 className="dashboard-heading">
          📋 Today&apos;s Site Progress
        </h2>

        <div className="dashboard-card-grid dpr-dashboard-grid">

          <div className="dashboard-card">
            <h3>📋 DPR Submitted</h3>
            <p>{todayDprSummary.todayCount}</p>
          </div>

          <div className="dashboard-card">
            <h3>👷 Manpower Reported</h3>
            <p>{todayDprSummary.totalManpower}</p>
          </div>

          <div className="dashboard-card">
            <h3>🏗️ Sites Submitted</h3>
            <p>{todayDprSummary.submittedSites.length}</p>
          </div>

          <div className="dashboard-card">
            <h3>⏳ Sites Without DPR</h3>
            <p>{sitesWithoutDprToday}</p>
          </div>

        </div>

        <div className="dashboard-dpr-activity-card">

          <h2>🛠️ Recent DPR Activity</h2>

          {dprLoading ? (
            <p className="empty-text">Loading daily progress reports...</p>
          ) : dprError ? (
            <p className="dashboard-dpr-error">{dprError}</p>
          ) : todayDprSummary.recentReports.length === 0 ? (
            <p className="empty-text">No daily progress reports available yet.</p>
          ) : (
            <div className="dashboard-dpr-list">
              {todayDprSummary.recentReports.map((report, index) => (
                <div
                  className="dashboard-dpr-item"
                  key={report.id || `${report.date || "legacy"}-${index}`}
                >
                  <div>
                    <strong>{report.workActivity || "Work activity not recorded"}</strong>
                    <p>
                      {getSiteName(report) || "Site not recorded"} · {report.date || "Date not recorded"}
                    </p>
                  </div>

                  <span>
                    {report.quantity || "-"} {report.unit || ""}
                    {report.manpowerCount !== undefined && report.manpowerCount !== ""
                      ? ` · ${report.manpowerCount} manpower`
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>


        {/* =========================
            ATTENDANCE
        ========================= */}

        <h2 className="dashboard-heading">
          👥 Attendance Overview
        </h2>

        <div className="dashboard-card-grid small-grid">

          <div className="dashboard-card">
            <h3>🟢 Present</h3>
            <p>{presentCount}</p>
          </div>

          <div className="dashboard-card">
            <h3>🔴 Absent</h3>
            <p>{absentCount}</p>
          </div>

          <div className="dashboard-card">
            <h3>👷 Total Labour</h3>
            <p>{labours.length}</p>
          </div>

        </div>


        {/* =========================
            ALERTS
        ========================= */}

        <div className="dashboard-alert-grid">

          {/* PENDING INVOICES */}

          <div className="dashboard-alert-card">

            <h2>⏳ Pending Invoice Alerts</h2>

            {pendingInvoices.length === 0 ? (
              <p className="empty-text">
                🎉 No Pending Invoice
              </p>
            ) : (
              pendingInvoices.slice(0, 5).map(
                (item) => {
                  const { pending } = getInvoiceSummary(item);

                  return (
                    <div
                      className="alert-item"
                      key={item.id}
                    >
                      <div>
                        <strong>
                          {item.invoiceNo}
                        </strong>

                        <p>
                          {item.site}
                        </p>
                      </div>

                      <strong className="loss-text">
                        {formatMoney(pending)}
                      </strong>
                    </div>
                  );
                }
              )
            )}

          </div>


          {/* LOW STOCK */}

          <div className="dashboard-alert-card">

            <h2>⚠️ Low Stock Alert</h2>

            {lowStockMaterials.length === 0 ? (
              <p className="empty-text">
                🎉 Stock Level Normal
              </p>
            ) : (
              lowStockMaterials.slice(0, 5).map(
                (item) => (
                  <div
                    className="alert-item"
                    key={item.id}
                  >
                    <div>
                      <strong>
                        {item.materialName ||
                          item.name ||
                          "Material"}
                      </strong>

                      <p>
                        Site: {item.site || "-"}
                      </p>
                    </div>

                    <strong className="loss-text">
                      {item.stock ??
                        item.quantity ??
                        item.qty ??
                        0}
                    </strong>
                  </div>
                )
              )
            )}

          </div>

        </div>

      </div>

    </Layout>
  );
}

export default Dashboard;
