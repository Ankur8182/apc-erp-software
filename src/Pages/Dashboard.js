import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";

import Layout from "../Components/Layout";
import { db } from "../firebase";
import "../Styles/Dashboard.css";

function Dashboard() {
  const [sites, setSites] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [salaries, setSalaries] = useState([]);

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

    return () => {
      unsubscribeSites();
      unsubscribeInvoices();
      unsubscribeExpenses();
      unsubscribeMaterials();
      unsubscribeLabours();
      unsubscribeAttendance();
      unsubscribeSalaries();
    };
  }, []);

  // =========================
  // HELPER FUNCTIONS
  // =========================

  const getSiteName = (item) => {
    return (
      item.siteName ||
      item.site ||
      item.name ||
      "Unnamed Site"
    );
  };

  const formatMoney = (amount) => {
    return `₹ ${Number(amount || 0).toLocaleString("en-IN")}`;
  };

  const getMaterialAmount = (item) => {
    const quantity = Number(
      item.quantity ??
      item.qty ??
      0
    );

    const rate = Number(
      item.rate ??
      item.price ??
      item.unitPrice ??
      0
    );

    const directAmount = Number(
      item.totalAmount ??
      item.amount ??
      item.total ??
      0
    );

    if (directAmount > 0) {
      return directAmount;
    }

    return quantity * rate;
  };

  const getExpenseAmount = (item) => {
    return Number(
      item.amount ??
      item.expenseAmount ??
      item.totalAmount ??
      0
    );
  };

  const getSalaryAmount = (item) => {
    return Number(
      item.amount ??
      item.salary ??
      item.netSalary ??
      item.totalAmount ??
      0
    );
  };

  // =========================
  // DASHBOARD SUMMARY
  // =========================

  const summary = useMemo(() => {
    let totalInvoiceAmount = 0;
    let totalReceivedAmount = 0;
    let totalPendingAmount = 0;

    let totalExpense = 0;
    let totalMaterialExpense = 0;
    let totalSalary = 0;

    invoices.forEach((item) => {
      const total = Number(
        item.totalAmount ??
        item.amount ??
        0
      );

      const paid = Number(
        item.paidAmount ??
        item.receivedAmount ??
        0
      );

      const pending =
        item.pendingAmount !== undefined
          ? Number(item.pendingAmount || 0)
          : total - paid;

      totalInvoiceAmount += total;
      totalReceivedAmount += paid;
      totalPendingAmount += pending;
    });

    expenses.forEach((item) => {
      totalExpense += getExpenseAmount(item);
    });

    materials.forEach((item) => {
      totalMaterialExpense += getMaterialAmount(item);
    });

    salaries.forEach((item) => {
      totalSalary += getSalaryAmount(item);
    });

    const totalBusinessExpense =
      totalExpense +
      totalMaterialExpense +
      totalSalary;

    const estimatedProfit =
      totalInvoiceAmount -
      totalBusinessExpense;

    const cashProfit =
      totalReceivedAmount -
      totalBusinessExpense;

    return {
      totalInvoiceAmount,
      totalReceivedAmount,
      totalPendingAmount,
      totalExpense,
      totalMaterialExpense,
      totalSalary,
      totalBusinessExpense,
      estimatedProfit,
      cashProfit,
    };
  }, [invoices, expenses, materials, salaries]);

  // =========================
  // SITE SUMMARY
  // =========================

  const siteSummary = useMemo(() => {
    return sites.map((siteItem) => {
      const siteName = getSiteName(siteItem);

      let income = 0;
      let otherExpense = 0;
      let materialExpense = 0;
      let salaryExpense = 0;

      invoices.forEach((item) => {
        if (item.site === siteName) {
          income += Number(
            item.totalAmount ??
            item.amount ??
            0
          );
        }
      });

      expenses.forEach((item) => {
        if (item.site === siteName) {
          otherExpense += getExpenseAmount(item);
        }
      });

      materials.forEach((item) => {
        if (item.site === siteName) {
          materialExpense += getMaterialAmount(item);
        }
      });

      salaries.forEach((item) => {
        if (item.site === siteName) {
          salaryExpense += getSalaryAmount(item);
        }
      });

      const totalExpense =
        otherExpense +
        materialExpense +
        salaryExpense;

      const profit = income - totalExpense;

      return {
        id: siteItem.id,
        siteName,
        location:
          siteItem.location ||
          "-",
        status:
          siteItem.status ||
          "Running",
        income,
        otherExpense,
        materialExpense,
        salaryExpense,
        totalExpense,
        profit,
      };
    });
  }, [
    sites,
    invoices,
    expenses,
    materials,
    salaries,
  ]);

  // =========================
  // SITE STATUS COUNTS
  // =========================

  const runningSites = sites.filter(
    (item) =>
      (item.status || "").toLowerCase() ===
      "running"
  ).length;

  const completedSites = sites.filter(
    (item) =>
      (item.status || "").toLowerCase() ===
      "completed"
  ).length;

  const pendingSites = sites.filter(
    (item) =>
      (item.status || "").toLowerCase() ===
      "pending"
  ).length;

  // =========================
  // ATTENDANCE SUMMARY
  // =========================

  const presentCount = attendance.filter(
    (item) =>
      (item.status || "").toLowerCase() ===
      "present"
  ).length;

  const absentCount = attendance.filter(
    (item) =>
      (item.status || "").toLowerCase() ===
      "absent"
  ).length;

  // =========================
  // LOW STOCK MATERIAL
  // =========================

  const lowStockMaterials = materials.filter((item) => {
    const stock = Number(
      item.stock ??
      item.quantity ??
      item.qty ??
      0
    );

    const minimumStock = Number(
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
    const total = Number(
      item.totalAmount ??
      item.amount ??
      0
    );

    const paid = Number(
      item.paidAmount ??
      0
    );

    const pending =
      item.pendingAmount !== undefined
        ? Number(item.pendingAmount || 0)
        : total - paid;

    return pending > 0;
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
                summary.totalInvoiceAmount
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>💰 Received</h3>
            <p>
              {formatMoney(
                summary.totalReceivedAmount
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>⏳ Pending Payment</h3>
            <p>
              {formatMoney(
                summary.totalPendingAmount
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>📦 Material Expense</h3>
            <p>
              {formatMoney(
                summary.totalMaterialExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>💸 Other Expense</h3>
            <p>
              {formatMoney(
                summary.totalExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>👷 Salary Expense</h3>
            <p>
              {formatMoney(
                summary.totalSalary
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>📉 Total Expense</h3>
            <p>
              {formatMoney(
                summary.totalBusinessExpense
              )}
            </p>
          </div>

          <div className="dashboard-card">
            <h3>
              {summary.estimatedProfit >= 0
                ? "📈 Estimated Profit"
                : "📉 Estimated Loss"}
            </h3>

            <p
              className={
                summary.estimatedProfit >= 0
                  ? "profit-text"
                  : "loss-text"
              }
            >
              {formatMoney(
                summary.estimatedProfit
              )}
            </p>
          </div>

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
                  const total = Number(
                    item.totalAmount ??
                    item.amount ??
                    0
                  );

                  const paid = Number(
                    item.paidAmount ??
                    0
                  );

                  const pending =
                    item.pendingAmount !== undefined
                      ? Number(
                          item.pendingAmount || 0
                        )
                      : total - paid;

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