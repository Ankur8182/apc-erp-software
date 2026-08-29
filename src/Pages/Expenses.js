import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import "../Styles/Expenses.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";


function Expenses() {

  // =========================
  // STATES
  // =========================

  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [site, setSite] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [description, setDescription] = useState("");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);


  // =========================
  // LOAD EXPENSES FROM FIRESTORE
  // =========================

  useEffect(() => {

    const expenseRef = collection(db, "expenses");

    const unsubscribe = onSnapshot(
      expenseRef,
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setExpenses(data);

      },
      (error) => {

        console.error("Firestore Error:", error);

        alert(
          "Expense data load nahi ho saka. Firebase connection check karein."
        );

      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {

    setSite("");
    setExpenseType("");
    setAmount("");
    setDate("");
    setPaidTo("");
    setDescription("");

    setEditId(null);

  };


  // =========================
  // SAVE / UPDATE EXPENSE
  // =========================

  const saveExpense = async () => {

    const amountValue = Number(amount);

    if (
      site.trim() === "" ||
      expenseType.trim() === "" ||
      amount.trim() === "" ||
      date === ""
    ) {

      alert(
        "Site, Expense Type, Amount aur Date bharna zaroori hai."
      );

      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {

      alert("Amount 0 se zyada valid number hona chahiye.");

      return;
    }


    const expenseData = {

      site: site.trim(),
      expenseType: expenseType.trim(),
      amount: amountValue,
      date: date,
      paidTo: paidTo.trim(),
      description: description.trim(),
      updatedAt: serverTimestamp()

    };


    try {

      setLoading(true);


      // UPDATE
      if (editId) {

        const expenseDoc = doc(
          db,
          "expenses",
          editId
        );

        await updateDoc(
          expenseDoc,
          expenseData
        );

        alert("Expense successfully updated.");

      }

      // ADD NEW
      else {

        await addDoc(
          collection(db, "expenses"),
          {
            ...expenseData,
            createdAt: serverTimestamp()
          }
        );

        alert("Expense successfully saved.");

      }


      clearForm();

    }

    catch (error) {

      console.error("Save Expense Error:", error);

      alert(
        "Expense save nahi hua. Firebase connection/rules check karein."
      );

    }

    finally {

      setLoading(false);

    }

  };


  // =========================
  // EDIT EXPENSE
  // =========================

  const editExpense = (item) => {

    setSite(item.site || "");
    setExpenseType(item.expenseType || "");
    setAmount(item.amount || "");
    setDate(item.date || "");
    setPaidTo(item.paidTo || "");
    setDescription(item.description || "");

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  };


  // =========================
  // DELETE EXPENSE
  // =========================

  const deleteExpense = async (id) => {

    const confirmDelete = window.confirm(
      "Kya aap is Expense ko delete karna chahte hain?"
    );

    if (!confirmDelete) {
      return;
    }


    try {

      await deleteDoc(
        doc(db, "expenses", id)
      );

      alert("Expense successfully deleted.");

    }

    catch (error) {

      console.error("Delete Expense Error:", error);

      alert(
        "Expense delete nahi hua. Firebase connection/rules check karein."
      );

    }

  };


  // =========================
  // SEARCH
  // =========================

  const filteredExpenses = expenses.filter((item) => {
    const searchText = search.toLowerCase();
    const searchMatched = [item.site, item.expenseType, item.paidTo, item.description]
      .some((value) => String(value || "").toLowerCase().includes(searchText));

    return searchMatched &&
      (!siteFilter || item.site === siteFilter) &&
      (!typeFilter || item.expenseType === typeFilter);
  });

  const expenseSortOptions = useMemo(
    () => [
      { value: "date", label: "Date", getValue: (item) => item.date },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "type", label: "Expense type", getValue: (item) => item.expenseType },
      { value: "amount", label: "Amount", getValue: (item) => item.amount },
      { value: "paidTo", label: "Paid to", getValue: (item) => item.paidTo },
    ],
    []
  );
  const expenseTable = useDataTable(filteredExpenses, {
    sortOptions: expenseSortOptions,
    defaultSortBy: "date",
    defaultSortDirection: "desc",
    resetKey: `${search}|${siteFilter}|${typeFilter}`,
  });
  const expenseSites = useMemo(() => getDistinctValues(expenses, (item) => item.site), [expenses]);
  const expenseTypes = useMemo(() => getDistinctValues(expenses, (item) => item.expenseType), [expenses]);


  // =========================
  // TOTAL EXPENSE
  // =========================

  const totalExpense = filteredExpenses.reduce(
    (total, item) =>
      total + Number(item.amount || 0),
    0
  );


  // =========================
  // PAGE
  // =========================

  return (

    <Layout title="💰 Expense Management">

      <div className="data-page expenses-page">


        {/* =========================
            FORM CARD
        ========================= */}

        <div className="page-card">

          <h2>
            💰 {editId
              ? "Update Expense"
              : "Add New Expense"}
          </h2>
          <p className="form-helper">Fields marked with * are required.</p>


          {/* FORM */}

          <div className="form-grid">


            <input
              type="text"
              placeholder="Site Name *"
              value={site}
              onChange={(e) =>
                setSite(e.target.value)
              }
            />


            <select
              value={expenseType}
              onChange={(e) =>
                setExpenseType(e.target.value)
              }
            >

              <option value="">
                Select Expense Type *
              </option>

              <option value="Labour">
                Labour
              </option>

              <option value="Material">
                Material
              </option>

              <option value="Fuel">
                Fuel
              </option>

              <option value="Transport">
                Transport
              </option>

              <option value="Machine">
                Machine
              </option>

              <option value="Office">
                Office
              </option>

              <option value="Other">
                Other
              </option>

            </select>


            <input
              type="number"
              placeholder="Amount *"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
            />


            <input
              type="date"
              value={date}
              onChange={(e) =>
                setDate(e.target.value)
              }
            />


            <input
              type="text"
              placeholder="Paid To / Vendor"
              value={paidTo}
              onChange={(e) =>
                setPaidTo(e.target.value)
              }
            />


            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
            />

          </div>


          {/* BUTTONS */}

          <button
            className="save-btn"
            onClick={saveExpense}
            disabled={loading}
          >

            {loading
              ? "⏳ Saving..."
              : editId
              ? "✏️ Update Expense"
              : "💾 Save Expense"
            }

          </button>


          {editId && (

            <button
              type="button"
              className="delete-btn"
              style={{
                marginLeft: "10px"
              }}
              onClick={clearForm}
            >
              ❌ Cancel Edit
            </button>

          )}

        </div>


        {/* =========================
            TOTAL EXPENSE CARD
        ========================= */}

        <div
          className="page-card"
          style={{
            marginBottom: "25px"
          }}
        >

          <h2>
            💰 Total Expense
          </h2>

          <h1>
            ₹ {totalExpense.toLocaleString("en-IN")}
          </h1>

        </div>


        {/* =========================
            EXPENSE TABLE
        ========================= */}

        <div className="table-card">

          <h2>
            📋 Expense List
          </h2>

          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search site, type, paid to or details..."
            table={expenseTable}
          >
            <label>
              <span>Site</span>
              <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                <option value="">All sites</option>
                {expenseSites.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Expense type</span>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All types</option>
                {expenseTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </DataTableToolbar>

          <div className="table-responsive">
          <table className="expense-table">

            <thead>

              <tr>

                <th>S.No</th>

                <th>Site</th>

                <th>Expense Type</th>

                <th>Amount</th>

                <th>Date</th>

                <th>Paid To</th>

                <th>Description</th>

                <th>Action</th>

              </tr>

            </thead>


            <tbody>

              {expenseTable.count === 0 ? (

                <tr>

                  <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "25px"
                    }}
                  >
                    No Expense Found
                  </td>

                </tr>

              ) : (

                expenseTable.rows.map(
                  (item, index) => (

                    <tr key={item.id}>

                      <td>
                        {expenseTable.startIndex + index + 1}
                      </td>


                      <td>
                        {item.site}
                      </td>


                      <td>
                        {item.expenseType}
                      </td>


                      <td>
                        ₹ {item.amount || "0"}
                      </td>


                      <td>
                        {item.date}
                      </td>


                      <td>
                        {item.paidTo || "-"}
                      </td>


                      <td>
                        {item.description || "-"}
                      </td>


                      <td>

                        <button
                          className="edit-btn"
                          onClick={() =>
                            editExpense(item)
                          }
                        >
                          ✏️ Edit
                        </button>


                        <button
                          className="delete-btn"
                          onClick={() =>
                            deleteExpense(item.id)
                          }
                        >
                          🗑️ Delete
                        </button>

                      </td>

                    </tr>

                  )
                )

              )}

            </tbody>

          </table>
          </div>
          <DataTablePagination table={expenseTable} />

        </div>

      </div>

    </Layout>

  );

}


export default Expenses;
