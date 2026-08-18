import React, { useEffect, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Labour.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc
} from "firebase/firestore";


function Labour() {

  // =========================
  // STATES
  // =========================

  const [labours, setLabours] = useState([]);
  const [search, setSearch] = useState("");

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

    if (
      name.trim() === "" ||
      mobile.trim() === "" ||
      work.trim() === ""
    ) {

      alert(
        "Labour Name, Mobile Number aur Work Type bharna zaroori hai."
      );

      return;
    }


    const labourData = {

      name: name.trim(),
      mobile: mobile.trim(),
      aadhaar: aadhaar.trim(),
      work: work.trim(),
      site: site.trim(),
      wage: wage,
      joiningDate: joiningDate

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

        alert("Labour successfully updated.");

      }

      // ADD NEW
      else {

        await addDoc(
          collection(db, "labours"),
          labourData
        );

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

  const deleteLabour = async (id) => {

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

    return (

      (item.name || "")
        .toLowerCase()
        .includes(searchText)

      ||

      (item.mobile || "")
        .toLowerCase()
        .includes(searchText)

      ||

      (item.work || "")
        .toLowerCase()
        .includes(searchText)

      ||

      (item.site || "")
        .toLowerCase()
        .includes(searchText)

    );

  });


  // =========================
  // PAGE
  // =========================

  return (

    <Layout title="👷 Labour Management">

      <div className="labour-page">


        {/* =========================
            FORM CARD
        ========================= */}

        <div className="page-card">

          <h2>
            👷 {editId ? "Update Labour" : "Add New Labour"}
          </h2>


          {/* SEARCH */}

          <input
            type="text"
            className="search-box"
            placeholder="🔍 Search Labour..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />


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
              placeholder="Site Name"
              value={site}
              onChange={(e) =>
                setSite(e.target.value)
              }
            />


            <input
              type="number"
              placeholder="Daily Wage"
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

              {filteredLabours.length === 0 ? (

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

                filteredLabours.map(
                  (item, index) => (

                    <tr key={item.id}>

                      <td>
                        {index + 1}
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
                            deleteLabour(item.id)
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


export default Labour;