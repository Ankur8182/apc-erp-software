import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import "../Styles/Labour.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "firebase/firestore";


function Labour() {

  // =========================
  // STATES
  // =========================

  const [labours, setLabours] = useState([]);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [workFilter, setWorkFilter] = useState("");

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  const [work, setWork] = useState("");
  const [site, setSite] = useState("");
  const [wage, setWage] = useState("");
  const [joiningDate, setJoiningDate] = useState("");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);


  // =========================
  // FIRESTORE - LOAD LABOURS
  // =========================

  useEffect(() => {

    const labourRef = collection(db, "labours");

    const unsubscribe = onSnapshot(
      labourRef,
      (snapshot) => {

        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setLabours(data);
      },
      (error) => {

        console.error("Firestore Error:", error);

        alert(
          "Labour data load nahi ho saka. Firebase connection check karein."
        );

      }
    );

    return () => unsubscribe();

  }, []);


  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {

    setName("");
    setMobile("");
    setAadhaar("");
    setWork("");
    setSite("");
    setWage("");
    setJoiningDate("");

    setEditId(null);

  };


  // =========================
  // SAVE / UPDATE LABOUR
  // =========================

  const saveLabour = async () => {

    const cleanMobile = mobile.trim();
    const wageAmount = Number(wage);

    if (
      name.trim() === "" ||
      cleanMobile === "" ||
      work.trim() === "" ||
      site.trim() === "" ||
      wage === ""
    ) {

      alert(
        "Labour Name, Mobile Number, Work Type, Site aur Wage bharna zaroori hai."
      );

      return;
    }

    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      alert("Mobile Number 10 digit ka hona chahiye.");
      return;
    }

    if (!Number.isFinite(wageAmount) || wageAmount <= 0) {
      alert("Wage 0 se zyada hona chahiye.");
      return;
    }


    const labourData = {

      name: name.trim(),
      mobile: cleanMobile,
      aadhaar: aadhaar.trim(),
      work: work.trim(),
      site: site.trim(),
      wage: wageAmount,
      joiningDate: joiningDate,
      updatedAt: serverTimestamp()

    };


    try {

      setLoading(true);


      // UPDATE
      if (editId) {

        const labourDoc = doc(
          db,
          "labours",
          editId
        );

        await updateDoc(
          labourDoc,
          labourData
        );

        const auditResult = await logAuditEvent({
          action: "update",
          module: "labour",
          recordId: editId,
          recordLabel: labourData.name,
          details: "Labour record updated.",
          site: labourData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Labour successfully updated.");

      }

      // ADD NEW
      else {

        const labourReference = await addDoc(
          collection(db, "labours"),
          {
            ...labourData,
            createdAt: serverTimestamp()
          }
        );

        const auditResult = await logAuditEvent({
          action: "create",
          module: "labour",
          recordId: labourReference.id,
          recordLabel: labourData.name,
          details: "Labour record created.",
          site: labourData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Labour successfully saved.");

      }


      clearForm();

    }

    catch (error) {

      console.error("Save Labour Error:", error);

      alert(
        "Labour save nahi hua. Firebase connection/rules check karein."
      );

    }

    finally {

      setLoading(false);

    }

  };


  // =========================
  // EDIT LABOUR
  // =========================

  const editLabour = (item) => {

    setName(item.name || "");
    setMobile(item.mobile || "");
    setAadhaar(item.aadhaar || "");
    setWork(item.work || "");
    setSite(item.site || "");
    setWage(item.wage || "");
    setJoiningDate(item.joiningDate || "");

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  };


  // =========================
  // DELETE LABOUR
  // =========================

  const deleteLabour = async (id, record = {}) => {

    const confirmDelete = window.confirm(
      "Kya aap is Labour ko delete karna chahte hain?"
    );

    if (!confirmDelete) {
      return;
    }


    try {

      await deleteDoc(
        doc(db, "labours", id)
      );

      const auditResult = await logAuditEvent({
        action: "delete",
        module: "labour",
        recordId: id,
        recordLabel: record.name,
        details: "Labour record deleted.",
        site: record.site,
      });
      if (!auditResult.success) alert(getAuditFailureMessage());

      alert("Labour successfully deleted.");

    }

    catch (error) {

      console.error("Delete Labour Error:", error);

      alert(
        "Labour delete nahi hua. Firebase connection/rules check karein."
      );

    }

  };


  // =========================
  // SEARCH
  // =========================

  const filteredLabours = labours.filter((item) => {
    const searchText = search.toLowerCase();
    const searchMatched = [item.name, item.mobile, item.work, item.site]
      .some((value) => String(value || "").toLowerCase().includes(searchText));

    return searchMatched &&
      (!siteFilter || item.site === siteFilter) &&
      (!workFilter || item.work === workFilter);
  });

  const labourSortOptions = useMemo(
    () => [
      { value: "name", label: "Name", getValue: (item) => item.name },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "work", label: "Work type", getValue: (item) => item.work },
      { value: "wage", label: "Daily wage", getValue: (item) => item.wage },
      { value: "date", label: "Joining date", getValue: (item) => item.joiningDate },
    ],
    []
  );
  const labourTable = useDataTable(filteredLabours, {
    sortOptions: labourSortOptions,
    defaultSortBy: "name",
    resetKey: `${search}|${siteFilter}|${workFilter}`,
  });
  const labourSites = useMemo(() => getDistinctValues(labours, (item) => item.site), [labours]);
  const labourWorkTypes = useMemo(() => getDistinctValues(labours, (item) => item.work), [labours]);


  // =========================
  // PAGE
  // =========================

  return (

    <Layout title="👷 Labour Management">

      <div className="data-page labour-page">


        {/* =========================
            FORM CARD
        ========================= */}

        <div className="page-card">

          <h2>
            👷 {editId ? "Update Labour" : "Add New Labour"}
          </h2>
          <p className="form-helper">Fields marked with * are required.</p>


          {/* FORM */}

          <div className="form-grid">


            <input
              type="text"
              placeholder="Labour Name *"
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
            />


            <input
              type="text"
              placeholder="Mobile Number *"
              value={mobile}
              onChange={(e) =>
                setMobile(e.target.value)
              }
            />


            <input
              type="text"
              placeholder="Aadhaar Number"
              value={aadhaar}
              onChange={(e) =>
                setAadhaar(e.target.value)
              }
            />


            <input
              type="text"
              placeholder="Work Type *"
              value={work}
              onChange={(e) =>
                setWork(e.target.value)
              }
            />


            <input
              type="text"
              placeholder="Site Name *"
              value={site}
              onChange={(e) =>
                setSite(e.target.value)
              }
            />


            <input
              type="number"
              placeholder="Daily Wage *"
              value={wage}
              onChange={(e) =>
                setWage(e.target.value)
              }
            />


            <input
              type="date"
              value={joiningDate}
              onChange={(e) =>
                setJoiningDate(e.target.value)
              }
            />

          </div>


          {/* BUTTONS */}

          <button
            className="save-btn"
            onClick={saveLabour}
            disabled={loading}
          >

            {loading
              ? "⏳ Saving..."
              : editId
              ? "✏️ Update Labour"
              : "💾 Save Labour"
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
            LABOUR TABLE
        ========================= */}

        <div className="table-card">

          <h2>
            📋 Labour List
          </h2>

          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, mobile, work or site..."
            table={labourTable}
          >
            <label>
              <span>Site</span>
              <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                <option value="">All sites</option>
                {labourSites.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Work type</span>
              <select value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}>
                <option value="">All work types</option>
                {labourWorkTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </DataTableToolbar>

          <div className="table-responsive">
          <table className="labour-table">

            <thead>

              <tr>

                <th>S.No</th>

                <th>Name</th>

                <th>Mobile</th>

                <th>Aadhaar</th>

                <th>Work</th>

                <th>Site</th>

                <th>Daily Wage</th>

                <th>Joining Date</th>

                <th>Action</th>

              </tr>

            </thead>


            <tbody>

              {labourTable.count === 0 ? (

                <tr>

                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      padding: "25px"
                    }}
                  >

                    No Labour Found

                  </td>

                </tr>

              ) : (

                labourTable.rows.map(
                  (item, index) => (

                    <tr key={item.id}>

                      <td>
                        {labourTable.startIndex + index + 1}
                      </td>


                      <td>
                        {item.name}
                      </td>


                      <td>
                        {item.mobile}
                      </td>


                      <td>
                        {item.aadhaar || "-"}
                      </td>


                      <td>
                        {item.work}
                      </td>


                      <td>
                        {item.site || "-"}
                      </td>


                      <td>
                        ₹ {item.wage || "0"}
                      </td>


                      <td>
                        {item.joiningDate || "-"}
                      </td>


                      <td>

                        <button
                          className="edit-btn"
                          onClick={() =>
                            editLabour(item)
                          }
                        >
                          ✏️ Edit
                        </button>


                        <button
                          className="delete-btn"
                          onClick={() =>
                            deleteLabour(item.id, item)
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
          <DataTablePagination table={labourTable} />

        </div>

      </div>

    </Layout>

  );

}


export default Labour;
