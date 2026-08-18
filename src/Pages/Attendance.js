import React, { useEffect, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Attendance.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc
} from "firebase/firestore";

function Attendance() {

  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState("");

  const [employeeName, setEmployeeName] = useState("");
  const [site, setSite] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [workType, setWorkType] = useState("");
  const [remarks, setRemarks] = useState("");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);


  // =========================
  // LOAD ATTENDANCE
  // =========================

  useEffect(() => {

    const attendanceRef = collection(db, "attendance");

    const unsubscribe = onSnapshot(
      attendanceRef,
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setAttendance(data);

      },
      (error) => {

        console.error(
          "Firestore Attendance Error:",
          error
        );

        alert(
          "Attendance data load nahi ho saka."
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
    setDate("");
    setStatus("");
    setWorkType("");
    setRemarks("");

    setEditId(null);

  };


  // =========================
  // SAVE / UPDATE
  // =========================

  const saveAttendance = async () => {

    if (
      employeeName.trim() === "" ||
      date === "" ||
      status === ""
    ) {

      alert(
        "Employee Name, Date aur Status bharna zaroori hai."
      );

      return;

    }


    const attendanceData = {

      employeeName: employeeName.trim(),
      site: site.trim(),
      date: date,
      status: status,
      workType: workType.trim(),
      remarks: remarks.trim()

    };


    try {

      setLoading(true);


      // UPDATE

      if (editId) {

        await updateDoc(
          doc(db, "attendance", editId),
          attendanceData
        );

        alert(
          "Attendance successfully updated."
        );

      }

      // NEW

      else {

        await addDoc(
          collection(db, "attendance"),
          attendanceData
        );

        alert(
          "Attendance successfully saved."
        );

      }


      clearForm();

    }

    catch (error) {

      console.error(
        "Attendance Error:",
        error
      );

      alert(
        "Attendance save nahi hua. Firebase connection check karein."
      );

    }

    finally {

      setLoading(false);

    }

  };


  // =========================
  // EDIT
  // =========================

  const editAttendance = (item) => {

    setEmployeeName(
      item.employeeName || ""
    );

    setSite(
      item.site || ""
    );

    setDate(
      item.date || ""
    );

    setStatus(
      item.status || ""
    );

    setWorkType(
      item.workType || ""
    );

    setRemarks(
      item.remarks || ""
    );

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  };


  // =========================
  // DELETE
  // =========================

  const deleteAttendance = async (id) => {

    const confirmDelete = window.confirm(
      "Kya aap ye attendance record delete karna chahte hain?"
    );

    if (!confirmDelete) {
      return;
    }


    try {

      await deleteDoc(
        doc(db, "attendance", id)
      );

      alert(
        "Attendance successfully deleted."
      );

    }

    catch (error) {

      console.error(
        "Delete Attendance Error:",
        error
      );

      alert(
        "Attendance delete nahi hui."
      );

    }

  };


  // =========================
  // SEARCH
  // =========================

  const filteredAttendance =
    attendance.filter((item) => {

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

        (item.status || "")
          .toLowerCase()
          .includes(text)

        ||

        (item.workType || "")
          .toLowerCase()
          .includes(text)

      );

    });


  // =========================
  // SUMMARY
  // =========================

  const presentCount =
    filteredAttendance.filter(
      (item) => item.status === "Present"
    ).length;

  const absentCount =
    filteredAttendance.filter(
      (item) => item.status === "Absent"
    ).length;

  const leaveCount =
    filteredAttendance.filter(
      (item) => item.status === "Leave"
    ).length;


  // =========================
  // PAGE
  // =========================

  return (

    <Layout title="📋 Attendance Management">

      <div className="attendance-page">


        {/* FORM */}

        <div className="page-card">

          <h2>
            📋 {editId
              ? "Update Attendance"
              : "Mark Attendance"}
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
              type="date"
              value={date}
              onChange={(e) =>
                setDate(e.target.value)
              }
            />


            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
            >

              <option value="">
                Select Attendance *
              </option>

              <option value="Present">
                Present
              </option>

              <option value="Absent">
                Absent
              </option>

              <option value="Leave">
                Leave
              </option>

              <option value="Half Day">
                Half Day
              </option>

            </select>


            <input
              type="text"
              placeholder="Work Type"
              value={workType}
              onChange={(e) =>
                setWorkType(
                  e.target.value
                )
              }
            />


            <input
              type="text"
              placeholder="Remarks"
              value={remarks}
              onChange={(e) =>
                setRemarks(
                  e.target.value
                )
              }
            />

          </div>


          <button
            className="save-btn"
            onClick={saveAttendance}
            disabled={loading}
          >

            {loading
              ? "⏳ Saving..."
              : editId
              ? "✏️ Update Attendance"
              : "💾 Save Attendance"
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


        {/* SUMMARY */}

        <div
          className="page-card"
          style={{
            display: "flex",
            gap: "50px",
            flexWrap: "wrap"
          }}
        >

          <div>

            <h3>
              👥 Total Records
            </h3>

            <h2>
              {filteredAttendance.length}
            </h2>

          </div>


          <div>

            <h3>
              🟢 Present
            </h3>

            <h2>
              {presentCount}
            </h2>

          </div>


          <div>

            <h3>
              🔴 Absent
            </h3>

            <h2>
              {absentCount}
            </h2>

          </div>


          <div>

            <h3>
              🟡 Leave
            </h3>

            <h2>
              {leaveCount}
            </h2>

          </div>

        </div>


        {/* TABLE */}

        <div className="table-card">

          <h2>
            📊 Attendance Records
          </h2>


          <table className="attendance-table">

            <thead>

              <tr>

                <th>S.No</th>
                <th>Employee</th>
                <th>Site</th>
                <th>Date</th>
                <th>Status</th>
                <th>Work Type</th>
                <th>Remarks</th>
                <th>Action</th>

              </tr>

            </thead>


            <tbody>

              {filteredAttendance.length === 0 ? (

                <tr>

                  <td
                    colSpan="8"
                    style={{
                      textAlign: "center",
                      padding: "25px"
                    }}
                  >
                    No Attendance Record Found
                  </td>

                </tr>

              ) : (

                filteredAttendance.map(
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
                        {item.date}
                      </td>

                      <td>
                        {item.status}
                      </td>

                      <td>
                        {item.workType || "-"}
                      </td>

                      <td>
                        {item.remarks || "-"}
                      </td>

                      <td>

                        <button
                          className="edit-btn"
                          onClick={() =>
                            editAttendance(item)
                          }
                        >
                          ✏️ Edit
                        </button>


                        <button
                          className="delete-btn"
                          onClick={() =>
                            deleteAttendance(
                              item.id
                            )
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

export default Attendance;