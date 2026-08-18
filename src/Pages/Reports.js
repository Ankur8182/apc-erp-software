import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Reports.css";

import { db } from "../firebase";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

/* =========================================
   HELPER FUNCTIONS
========================================= */

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? 0 : value;
  }

  const cleanValue = String(value)
    .replace(/₹/g, "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");

  const number = Number(cleanValue);

  return Number.isNaN(number) ? 0 : number;
};

const formatMoney = (amount) => {
  return `₹ ${toNumber(amount).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
};

const getDateValue = (item) => {
  return (
    item.invoiceDate ||
    item.paymentDate ||
    item.date ||
    item.purchaseDate ||
    item.createdAt ||
    ""
  );
};

const normalizeDate = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.substring(0, 10);
  }

  if (value?.toDate) {
    return value.toDate().toISOString().split("T")[0];
  }

  try {
    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch (error) {
    return "";
  }

  return "";
};

const isDateInRange = (item, fromDate, toDate) => {
  if (!fromDate && !toDate) {
    return true;
  }

  const date = normalizeDate(getDateValue(item));

  if (!date) {
    return true;
  }

  if (fromDate && date < fromDate) {
    return false;
  }

  if (toDate && date > toDate) {
    return false;
  }

  return true;
};

const getSiteName = (item) => {
  return String(
    item?.site ||
      item?.siteName ||
      item?.projectName ||
      item?.project ||
      ""
  ).trim();
};

/* =========================================
   MATERIAL AMOUNT HELPER
   Purchase = expense
   Usage = expense dobara count nahi hoga
========================================= */

const getMaterialAmount = (item) => {
  const entryType = String(
    item?.entryType || "Purchase"
  )
    .trim()
    .toLowerCase();

  if (
    entryType === "usage" ||
    entryType === "used" ||
    entryType === "consume" ||
    entryType === "consumption"
  ) {
    return 0;
  }

  const savedAmount =
    toNumber(item?.totalAmount) ||
    toNumber(item?.purchaseAmount) ||
    toNumber(item?.amount) ||
    toNumber(item?.total) ||
    toNumber(item?.cost);

  if (savedAmount > 0) {
    return savedAmount;
  }

  const quantity = toNumber(item?.quantity);

  const rate = toNumber(
    item?.rate ||
      item?.unitRate ||
      item?.price
  );

  return quantity * rate;
};

/* =========================================
   INVOICE HELPERS
========================================= */

const getInvoiceAmount = (item) => {
  return (
    toNumber(item?.totalAmount) ||
    toNumber(item?.invoiceAmount) ||
    toNumber(item?.amount) ||
    toNumber(item?.total) ||
    0
  );
};

const getReceivedAmount = (item) => {
  return (
    toNumber(item?.paidAmount) ||
    toNumber(item?.receivedAmount) ||
    toNumber(item?.paymentReceived) ||
    0
  );
};

/* =========================================
   EXPENSE HELPERS
========================================= */

const getExpenseType = (item) => {
  return String(
    item?.expenseType ||
      item?.category ||
      item?.type ||
      ""
  )
    .trim()
    .toLowerCase();
};

const getExpenseAmount = (item) => {
  return (
    toNumber(item?.amount) ||
    toNumber(item?.totalAmount) ||
    toNumber(item?.total) ||
    toNumber(item?.cost) ||
    0
  );
};

const isMaterialExpense = (item) => {
  const type = getExpenseType(item);

  return (
    type === "material" ||
    type === "materials"
  );
};

const isLabourExpense = (item) => {
  const type = getExpenseType(item);

  return (
    type === "labour" ||
    type === "labor" ||
    type === "wages"
  );
};

/* =========================================
   LABOUR / SALARY HELPERS
========================================= */

const getLabourAmount = (item) => {
  const directAmount =
    toNumber(item?.amount) ||
    toNumber(item?.payment) ||
    toNumber(item?.paidAmount) ||
    toNumber(item?.totalAmount);

  if (directAmount > 0) {
    return directAmount;
  }

  const dailyWage =
    toNumber(item?.salary) ||
    toNumber(item?.wage) ||
    toNumber(item?.rate);

  const days =
    toNumber(item?.days) ||
    toNumber(item?.workingDays);

  if (dailyWage > 0 && days > 0) {
    return dailyWage * days;
  }

  return dailyWage;
};

const getSalaryAmount = (item) => {
  return (
    toNumber(item?.salary) ||
    toNumber(item?.amount) ||
    toNumber(item?.paidAmount) ||
    toNumber(item?.totalAmount) ||
    0
  );
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

  const [selectedSite, setSelectedSite] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [loading, setLoading] = useState(true);

  /* =========================================
     LOAD FIREBASE DATA
  ========================================= */

  useEffect(() => {
    const unsubscribers = [];
    let loadedCollections = 0;
    const totalCollections = 6;

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

          loadedCollections += 1;

          if (loadedCollections >= totalCollections) {
            setLoading(false);
          }
        },

        (error) => {
          console.error(
            `Error loading ${collectionName}:`,
            error
          );

          setData([]);

          loadedCollections += 1;

          if (loadedCollections >= totalCollections) {
            setLoading(false);
          }
        }
      );

      unsubscribers.push(unsubscribe);
    };

    loadCollection("sites", setSites);
    loadCollection("invoices", setInvoices);
    loadCollection("expenses", setExpenses);
    loadCollection("materials", setMaterials);
    loadCollection("labour", setLabours);
    loadCollection("salaries", setSalaries);

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
  ]);

  /* =========================================
     COMMON FILTER
  ========================================= */

  const filterRecords = (data) => {
    return data.filter((item) => {
      const itemSite = getSiteName(item);

      const siteMatched =
        selectedSite === "all" ||
        itemSite.toLowerCase() ===
          selectedSite.toLowerCase();

      const dateMatched = isDateInRange(
        item,
        fromDate,
        toDate
      );

      return siteMatched && dateMatched;
    });
  };

  /* =========================================
     FILTERED DATA
  ========================================= */

  const filteredInvoices = useMemo(
    () => filterRecords(invoices),
    [invoices, selectedSite, fromDate, toDate]
  );

  const filteredExpenses = useMemo(
    () => filterRecords(expenses),
    [expenses, selectedSite, fromDate, toDate]
  );

  const filteredMaterials = useMemo(
    () => filterRecords(materials),
    [materials, selectedSite, fromDate, toDate]
  );

  const filteredLabours = useMemo(
    () => filterRecords(labours),
    [labours, selectedSite, fromDate, toDate]
  );

  const filteredSalaries = useMemo(
    () => filterRecords(salaries),
    [salaries, selectedSite, fromDate, toDate]
  );

  /* =========================================
     INCOME CALCULATIONS
  ========================================= */

  const totalIncome = useMemo(() => {
    return filteredInvoices.reduce(
      (total, item) =>
        total + getInvoiceAmount(item),
      0
    );
  }, [filteredInvoices]);

  const totalReceived = useMemo(() => {
    return filteredInvoices.reduce(
      (total, item) =>
        total + getReceivedAmount(item),
      0
    );
  }, [filteredInvoices]);

  const totalPending = Math.max(
    totalIncome - totalReceived,
    0
  );

  /* =========================================
     MATERIAL EXPENSE
  ========================================= */

  const materialPurchaseExpense = useMemo(() => {
    return filteredMaterials.reduce(
      (total, item) =>
        total + getMaterialAmount(item),
      0
    );
  }, [filteredMaterials]);

  const materialExpenseFromExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (total, item) => {
        if (isMaterialExpense(item)) {
          return total + getExpenseAmount(item);
        }

        return total;
      },
      0
    );
  }, [filteredExpenses]);

  const totalMaterialExpense =
    materialPurchaseExpense +
    materialExpenseFromExpenses;

  /* =========================================
     LABOUR EXPENSE
  ========================================= */

  const labourExpenseFromExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (total, item) => {
        if (isLabourExpense(item)) {
          return total + getExpenseAmount(item);
        }

        return total;
      },
      0
    );
  }, [filteredExpenses]);

  const labourCollectionExpense = useMemo(() => {
    return filteredLabours.reduce(
      (total, item) =>
        total + getLabourAmount(item),
      0
    );
  }, [filteredLabours]);

  const salaryExpense = useMemo(() => {
    return filteredSalaries.reduce(
      (total, item) =>
        total + getSalaryAmount(item),
      0
    );
  }, [filteredSalaries]);

  const labourBaseExpense =
    salaryExpense > 0
      ? salaryExpense
      : labourCollectionExpense;

  const totalLabourExpense =
    labourExpenseFromExpenses +
    labourBaseExpense;

  /* =========================================
     OTHER EXPENSE
  ========================================= */

  const otherExpense = useMemo(() => {
    return filteredExpenses.reduce(
      (total, item) => {
        if (
          isMaterialExpense(item) ||
          isLabourExpense(item)
        ) {
          return total;
        }

        return total + getExpenseAmount(item);
      },
      0
    );
  }, [filteredExpenses]);

  /* =========================================
     FINAL EXPENSE / PROFIT
  ========================================= */

  const totalExpense =
    totalMaterialExpense +
    totalLabourExpense +
    otherExpense;

  const netProfit =
    totalIncome - totalExpense;

  /* =========================================
     SITE WISE REPORT
  ========================================= */

  const reportRows = useMemo(() => {
    return allSiteNames
      .map((siteName) => {
        const siteMatch = (item) =>
          getSiteName(item).toLowerCase() ===
          siteName.toLowerCase();

        const siteInvoices =
          invoices.filter(
            (item) =>
              siteMatch(item) &&
              isDateInRange(
                item,
                fromDate,
                toDate
              )
          );

        const siteExpenses =
          expenses.filter(
            (item) =>
              siteMatch(item) &&
              isDateInRange(
                item,
                fromDate,
                toDate
              )
          );

        const siteMaterials =
          materials.filter(
            (item) =>
              siteMatch(item) &&
              isDateInRange(
                item,
                fromDate,
                toDate
              )
          );

        const siteLabours =
          labours.filter(
            (item) =>
              siteMatch(item) &&
              isDateInRange(
                item,
                fromDate,
                toDate
              )
          );

        const siteSalaries =
          salaries.filter(
            (item) =>
              siteMatch(item) &&
              isDateInRange(
                item,
                fromDate,
                toDate
              )
          );

        const income =
          siteInvoices.reduce(
            (total, item) =>
              total + getInvoiceAmount(item),
            0
          );

        const received =
          siteInvoices.reduce(
            (total, item) =>
              total + getReceivedAmount(item),
            0
          );

        /* Material aur Labour ko normal expense
           me include nahi karenge */

        const normalExpense =
          siteExpenses.reduce(
            (total, item) => {
              if (
                isMaterialExpense(item) ||
                isLabourExpense(item)
              ) {
                return total;
              }

              return (
                total +
                getExpenseAmount(item)
              );
            },
            0
          );

        const materialFromMaterials =
          siteMaterials.reduce(
            (total, item) =>
              total +
              getMaterialAmount(item),
            0
          );

        const materialFromExpenses =
          siteExpenses.reduce(
            (total, item) => {
              if (isMaterialExpense(item)) {
                return (
                  total +
                  getExpenseAmount(item)
                );
              }

              return total;
            },
            0
          );

        const materialExpense =
          materialFromMaterials +
          materialFromExpenses;

        const labourFromLabour =
          siteLabours.reduce(
            (total, item) =>
              total +
              getLabourAmount(item),
            0
          );

        const salaryExpenseForSite =
          siteSalaries.reduce(
            (total, item) =>
              total +
              getSalaryAmount(item),
            0
          );

        const labourFromExpenses =
          siteExpenses.reduce(
            (total, item) => {
              if (isLabourExpense(item)) {
                return (
                  total +
                  getExpenseAmount(item)
                );
              }

              return total;
            },
            0
          );

        const labourBaseForSite =
          salaryExpenseForSite > 0
            ? salaryExpenseForSite
            : labourFromLabour;

        const labourExpense =
          labourFromExpenses +
          labourBaseForSite;

        const expense =
          normalExpense +
          materialExpense +
          labourExpense;

        const profit =
          income - expense;

        return {
          siteName,
          income,
          received,
          expense,
          profit,
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
    invoices,
    expenses,
    materials,
    labours,
    salaries,
    selectedSite,
    fromDate,
    toDate,
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
      value: totalIncome,
      icon: "💰",
      className: "income-card",
    },
    {
      title: "Total Received",
      value: totalReceived,
      icon: "💵",
      className: "received-card",
    },
    {
      title: "Pending Payment",
      value: totalPending,
      icon: "⏳",
      className: "pending-card",
    },
    {
      title: "Material Expense",
      value: totalMaterialExpense,
      icon: "📦",
      className: "material-card",
    },
    {
      title: "Labour Expense",
      value: totalLabourExpense,
      icon: "👷",
      className: "labour-card",
    },
    {
      title: "Other Expense",
      value: otherExpense,
      icon: "🛠️",
      className: "other-card",
    },
    {
      title: "Total Expense",
      value: totalExpense,
      icon: "📉",
      className: "expense-card",
    },
    {
      title:
        netProfit >= 0
          ? "Net Profit"
          : "Net Loss",

      value: Math.abs(netProfit),

      icon:
        netProfit >= 0
          ? "📈"
          : "📉",

      className:
        netProfit >= 0
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