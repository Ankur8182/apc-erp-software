import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Sidebar from "../Components/Sidebar";
import Header from "../Components/Header";
import "../Styles/SiteDetails.css";

import { db } from "../firebase";
import {
  calculateFinancialSummary,
  getSiteName,
  isSameSite,
} from "../utils/financialReporting";

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


            </>

          )}


        </div>

      </div>

    </div>

  );

}

export default SiteDetails;
