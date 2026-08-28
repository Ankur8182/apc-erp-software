import React, { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Reports.css";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  calculateFinancialSummary,
  getSiteName,
  isDateInRange,
  isSameSite,
  toNumber,
} from "../utils/financialReporting";

const formatMoney = (amount) => {
  return `₹ ${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

/* =========================================
   REPORTS COMPONENT
========================================= */

function Reports() {
  const [sites, setSites] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);

  const [selectedSite, setSelectedSite] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(true);

  /* =========================================
     LOAD FIREBASE DATA
  ========================================= */

  useEffect(() => {
    const unsubscribers = [];
    const completedCollections = new Set();
    const totalCollections = 9;

    const markCollectionComplete = (collectionName) => {
      completedCollections.add(collectionName);

      if (completedCollections.size === totalCollections) {
        setLoading(false);
      }
    };

    const loadCollection = (
      collectionName,
      setData
    ) => {
      const unsubscribe = onSnapshot(
        collection(db, collectionName),

        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setData(data);

          markCollectionComplete(collectionName);
        },

        (error) => {
          console.error(
            `Error loading ${collectionName}:`,
            error
          );

          setData([]);

          markCollectionComplete(collectionName);
        }
      );

      unsubscribers.push(unsubscribe);
    };

    loadCollection("sites", setSites);
    loadCollection("invoices", setInvoices);
    loadCollection("expenses", setExpenses);
    loadCollection("materials", setMaterials);
    loadCollection("labours", setLabours);
    loadCollection("salaries", setSalaries);
    loadCollection("attendance", setAttendance);
    loadCollection("vehicles", setVehicles);
    loadCollection("vehicleExpenses", setVehicleExpenses);

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
  ]);

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

        return {
          siteName,
          income: summary.income,
          received: summary.received,
          expense: summary.totalExpense,
          profit: summary.profit,
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
    selectedSite,
  ]);

  /* =========================================
     RESET
  ========================================= */

  const handleReset = () => {
    setSelectedSite("all");
    setFromDate("");
    setToDate("");
  };

  /* =========================================
     PRINT
  ========================================= */

  const handlePrint = () => {
    window.print();
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

                {allSiteNames.map(
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
                      <th>Profit / Loss</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reportRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan="6"
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
            </div>

          </>
        )}

      </div>
    </Layout>
  );
}

export default Reports;
