import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../Components/Sidebar";
import Header from "../Components/Header";
import "../Styles/SiteDetails.css";

import { db } from "../firebase";

import {
  collection,
  onSnapshot
} from "firebase/firestore";

function SiteDetails() {

  const [sites, setSites] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labours, setLabours] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  const [selectedSite, setSelectedSite] = useState("");

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

    const toNumber = (value) => {

      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        return 0;
      }

      return (
        Number(
          String(value).replace(/[^0-9.-]+/g, "")
        ) || 0
      );
    };


    const normalize = (value) => {

      return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
    };


    const getItemSite = (item) => {

      return (
        item.site ||
        item.siteName ||
        item.siteId ||
        item.projectSite ||
        item.site_name ||
        ""
      );
    };


    const isSameSite = (item) => {

      const itemSite = normalize(
        getItemSite(item)
      );

      const currentSite = normalize(
        selectedSite
      );

      return (
        itemSite === currentSite &&
        currentSite !== ""
      );
    };


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


    // =========================
    // TOTAL INCOME
    // =========================

    const siteInvoices = invoices.filter(isSameSite);

    const income = siteInvoices.reduce(
      (total, item) => {

        return total + toNumber(
          item.amount ??
          item.total ??
          item.invoiceAmount ??
          item.grandTotal ??
          item.netAmount ??
          item.value
        );

      },
      0
    );


    // =========================
    // MATERIAL EXPENSE
    // =========================

    const siteMaterials = materials.filter(isSameSite);

    const materialExpense = siteMaterials.reduce(
      (total, item) => {

        return total + toNumber(
          item.totalAmount ??
          item.amount ??
          item.total ??
          item.cost ??
          item.purchaseAmount ??
          item.totalCost
        );

      },
      0
    );


    // =========================
    // SALARY EXPENSE
    // =========================

    const siteSalaries = salaries.filter(isSameSite);

    const salaryExpense = siteSalaries.reduce(
      (total, item) => {

        return total + toNumber(
          item.amount ??
          item.salary ??
          item.totalSalary ??
          item.paidAmount ??
          item.totalAmount
        );

      },
      0
    );


    // =========================
    // LABOUR EXPENSE
    // =========================

    const siteLabours = labours.filter(isSameSite);

    const labourExpenseFromLabours = siteLabours.reduce(
      (total, item) => {

        return total + toNumber(
          item.totalWage ??
          item.amount ??
          item.wage ??
          item.dailyWage ??
          item.payment
        );

      },
      0
    );


    // Salary collection available ho
    // to salary ko priority milegi

    const labourExpense =
      salaryExpense > 0
        ? salaryExpense
        : labourExpenseFromLabours;


    // =========================
    // VEHICLE EXPENSE
    // =========================

    const siteVehicles = vehicles.filter(isSameSite);

    const vehicleExpense = siteVehicles.reduce(
      (total, item) => {

        return total + toNumber(
          item.expense ??
          item.fuelExpense ??
          item.fuelCost ??
          item.amount ??
          item.totalFuelCost
        );

      },
      0
    );


    // =========================
    // OTHER EXPENSE
    // =========================

    const siteExpenses = expenses.filter(isSameSite);

    const otherExpense = siteExpenses.reduce(
      (total, item) => {

        return total + toNumber(
          item.amount ??
          item.totalAmount ??
          item.expenseAmount ??
          item.cost
        );

      },
      0
    );


    // =========================
    // TOTAL EXPENSE
    // =========================

    const totalExpense =
      materialExpense +
      labourExpense +
      vehicleExpense +
      otherExpense;


    // =========================
    // PROFIT / LOSS
    // =========================

    const profitLoss =
      income - totalExpense;


    return {

      income,

      materialExpense,

      labourExpense,

      vehicleExpense,

      otherExpense,

      totalExpense,

      profitLoss,

      invoiceCount:
        siteInvoices.length,

      materialCount:
        siteMaterials.length,

      expenseCount:
        siteExpenses.length,

      salaryCount:
        siteSalaries.length

    };

  }, [

    selectedSite,

    invoices,

    materials,

    labours,

    salaries,

    expenses,

    vehicles

  ]);


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


              {sites.map((item) => (

                <option
                  key={item.id}
                  value={
                    item.siteName ||
                    item.name ||
                    item.site ||
                    ""
                  }
                >

                  {
                    item.siteName ||
                    item.name ||
                    item.site
                  }

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


            </>

          )}


        </div>

      </div>

    </div>

  );

}

export default SiteDetails;