import React, { useEffect, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Salary.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";


function Salary() {

  // =========================
  // STATES
  // =========================

  const [salaries, setSalaries] = useState([]);
  const [search, setSearch] = useState("");

  const [employeeName, setEmployeeName] = useState("");
  const [site, setSite] = useState("");
  const [month, setMonth] = useState("");
  const [workingDays, setWorkingDays] = useState("");
  const [salary, setSalary] = useState("");
  const [advance, setAdvance] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);


  // =========================
  // LOAD SALARY FROM FIRESTORE
  // =========================

  useEffect(() => {

    const salaryRef = collection(db, "salaries");

    const unsubscribe = onSnapshot(
      salaryRef,
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setSalaries(data);

      },
      (error) => {

        console.error("Firestore Salary Error:", error);

        alert(
          "Salary data load nahi ho saka."
        );

      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {

    setEmployeeName("");
    setSite("");
    setMonth("");
    setWorkingDays("");
    setSalary("");
    setAdvance("");
    setPaymentDate("");
    setStatus("");

    setEditId(null);

  };


  // =========================
  // SAVE / UPDATE SALARY
  // =========================

  const saveSalary = async () => {

    if (
      employeeName.trim() === "" ||
      month === "" ||
      salary.trim() === ""
    ) {

      alert(
        "Employee Name, Month aur Salary bharna zaroori hai."
      );

      return;

    }


    const salaryData = {

      employeeName: employeeName.trim(),
      site: site.trim(),
      month: month,
      workingDays: workingDays,
      salary: salary,
      advance: advance || "0",
      paymentDate: paymentDate,
      status: status

    };


    try {

      setLoading(true);


      // UPDATE

      if (editId) {

        await updateDoc(
          doc(db, "salaries", editId),
          salaryData
        );

        alert(
          "Salary successfully updated."
        );

      }

      // ADD NEW

      else {

        await addDoc(
          collection(db, "salaries"),
          salaryData
        );

        alert(
          "Salary successfully saved."
        );

      }


      clearForm();

    }

    catch (error) {

      console.error(
        "Save Salary Error:",
        error
      );

      alert(
        "Salary save nahi hua. Firebase connection check karein."
      );

    }

    finally {

      setLoading(false);

    }

  };


  // =========================
  // EDIT SALARY
  // =========================

  const editSalary = (item) => {

    setEmployeeName(
      item.employeeName || ""
    );

    setSite(
      item.site || ""
    );

    setMonth(
      item.month || ""
    );

    setWorkingDays(
      item.workingDays || ""
    );

    setSalary(
      item.salary || ""
    );

    setAdvance(
      item.advance || ""
    );

    setPaymentDate(
      item.paymentDate || ""
    );

    setStatus(
      item.status || ""
    );

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  };


  // =========================
  // DELETE SALARY
  // =========================

  const deleteSalary = async (id) => {

    const confirmDelete = window.confirm(
      "Kya aap is Salary record ko delete karna chahte hain?"
    );

    if (!confirmDelete) {
      return;
    }


    try {

      await deleteDoc(
        doc(db, "salaries", id)
      );

      alert(
        "Salary successfully deleted."
      );

    }

    catch (error) {

      console.error(
        "Delete Salary Error:",
        error
      );

      alert(
        "Salary delete nahi hui."
      );

    }

  };


  // =========================
  // SEARCH
  // =========================

  const filteredSalaries =
    salaries.filter((item) => {

      const text =
        search.toLowerCase();

      return (

        (item.employeeName || "")
          .toLowerCase()
          .includes(text)

        ||

        (item.site || "")
          .toLowerCase()
          .includes(text)

        ||

        (item.month || "")
          .toLowerCase()
          .includes(text)

        ||

        (item.status || "")
          .toLowerCase()
          .includes(text)

      );

    });


  // =========================
  // TOTAL SALARY
  // =========================

  const totalSalary =
    filteredSalaries.reduce(
      (total, item) =>
        total + Number(item.salary || 0),
      0
    );


  // =========================
  // TOTAL ADVANCE
  // =========================

  const totalAdvance =
    filteredSalaries.reduce(
      (total, item) =>
        total + Number(item.advance || 0),
      0
    );


  // =========================
  // PAGE
  // =========================

  return (

    <Layout title="💵 Salary Management">

      <div className="salary-page">


        {/* =========================
            FORM CARD
        ========================= */}

        <div className="page-card">

          <h2>
            💵 {editId
              ? "Update Salary"
              : "Add Salary"}
          </h2>


          {/* SEARCH */}

          <input
            type="text"
            className="search-box"
            placeholder="🔍 Search Employee..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />


          {/* FORM */}

          <div className="form-grid">


            <input
              type="text"
              placeholder="Employee / Labour Name *"
              value={employeeName}
              onChange={(e) =>
                setEmployeeName(
                  e.target.value
                )
              }
            />


            <input
              type="text"
              placeholder="Site Name"
              value={site}
              onChange={(e) =>
                setSite(e.target.value)
              }
            />


            <input
              type="month"
              value={month}
              onChange={(e) =>
                setMonth(e.target.value)
              }
            />


            <input
              type="number"
              placeholder="Working Days"
              value={workingDays}
              onChange={(e) =>
                setWorkingDays(
                  e.target.value
                )
              }
            />


            <input
              type="number"
              placeholder="Total Salary *"
              value={salary}
              onChange={(e) =>
                setSalary(e.target.value)
              }
            />


            <input
              type="number"
              placeholder="Advance"
              value={advance}
              onChange={(e) =>
                setAdvance(e.target.value)
              }
            />


            <input
              type="date"
              value={paymentDate}
              onChange={(e) =>
                setPaymentDate(
                  e.target.value
                )
              }
            />


            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
            >

              <option value="">
                Select Status
              </option>

              <option value="Pending">
                Pending
              </option>

              <option value="Paid">
                Paid
              </option>

              <option value="Partial">
                Partial
              </option>

            </select>


          </div>


          {/* SAVE BUTTON */}

          <button
            className="save-btn"
            onClick={saveSalary}
            disabled={loading}
          >

            {loading
              ? "⏳ Saving..."
              : editId
              ? "✏️ Update Salary"
              : "💾 Save Salary"
            }

          </button>


          {editId && (

            <button
              className="delete-btn"
              style={{
                marginLeft: "10px"
              }}
              onClick={clearForm}
            >
              ❌ Cancel
            </button>

          )}

        </div>


        {/* =========================
            SUMMARY
        ========================= */}

        <div
          className="page-card"
          style={{
            display: "flex",
            gap: "40px",
            flexWrap: "wrap"
          }}
        >

          <div>

            <h3>
              💰 Total Salary
            </h3>

            <h2>
              ₹ {totalSalary.toLocaleString("en-IN")}
            </h2>

          </div>


          <div>

            <h3>
              💸 Total Advance
            </h3>

            <h2>
              ₹ {totalAdvance.toLocaleString("en-IN")}
            </h2>

          </div>


          <div>

            <h3>
              👥 Records
            </h3>

            <h2>
              {filteredSalaries.length}
            </h2>

          </div>

        </div>


        {/* =========================
            TABLE
        ========================= */}

        <div className="table-card">

          <h2>
            📋 Salary Records
          </h2>


          <table className="salary-table">

            <thead>

              <tr>

                <th>S.No</th>
                <th>Employee</th>
                <th>Site</th>
                <th>Month</th>
                <th>Working Days</th>
                <th>Salary</th>
                <th>Advance</th>
                <th>Payment Date</th>
                <th>Status</th>
                <th>Action</th>

              </tr>

            </thead>


            <tbody>

              {filteredSalaries.length === 0 ? (

                <tr>

                  <td
                    colSpan="10"
                    style={{
                      textAlign: "center",
                      padding: "25px"
                    }}
                  >
                    No Salary Record Found
                  </td>

                </tr>

              ) : (

                filteredSalaries.map(
                  (item, index) => (

                    <tr key={item.id}>

                      <td>
                        {index + 1}
                      </td>

                      <td>
                        {item.employeeName}
                      </td>

                      <td>
                        {item.site || "-"}
                      </td>

                      <td>
                        {item.month || "-"}
                      </td>

                      <td>
                        {item.workingDays || "-"}
                      </td>

                      <td>
                        ₹ {item.salary || "0"}
                      </td>

                      <td>
                        ₹ {item.advance || "0"}
                      </td>

                      <td>
                        {item.paymentDate || "-"}
                      </td>

                      <td>
                        {item.status || "-"}
                      </td>

                      <td>

                        <button
                          className="edit-btn"
                          onClick={() =>
                            editSalary(item)
                          }
                        >
                          ✏️ Edit
                        </button>


                        <button
                          className="delete-btn"
                          onClick={() =>
                            deleteSalary(item.id)
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

      </div>

    </Layout>

  );

}


export default Salary;