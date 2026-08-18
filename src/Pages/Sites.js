import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "../Components/Sidebar";
import Header from "../Components/Header";

import "../Styles/Sites.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  updateDoc,
  doc,
} from "firebase/firestore";

function Sites() {
  const navigate = useNavigate();

  // =========================
  // STATES
  // =========================

  const [sites, setSites] = useState([]);

  const [siteName, setSiteName] = useState("");
  const [location, setLocation] = useState("");
  const [engineer, setEngineer] = useState("");
  const [status, setStatus] = useState("");

  const [search, setSearch] = useState("");

  const [editId, setEditId] = useState(null);

  const [loading, setLoading] = useState(true);

  // =========================
  // FIRESTORE - LIVE DATA
  // =========================

  useEffect(() => {
    const sitesRef = collection(db, "sites");

    const unsubscribe = onSnapshot(
      sitesRef,
      (snapshot) => {
        const siteData = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setSites(siteData);
        setLoading(false);
      },

      (error) => {
        console.error("Firestore Error:", error);

        alert(
          "Firebase data load nahi ho pa raha hai. Console check karein."
        );

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {
    setSiteName("");
    setLocation("");
    setEngineer("");
    setStatus("");
    setEditId(null);
  };

  // =========================
  // SAVE / UPDATE SITE
  // =========================

  const saveSite = async () => {
    if (siteName.trim() === "" || location.trim() === "") {
      alert("Site Name aur Location bharna zaroori hai.");
      return;
    }

    const siteData = {
      siteName: siteName.trim(),
      location: location.trim(),
      engineer: engineer.trim(),
      status: status || "Pending",
    };

    try {
      // UPDATE EXISTING SITE
      if (editId) {
        await updateDoc(
          doc(db, "sites", editId),
          siteData
        );

        alert("✅ Site successfully updated.");
      }

      // ADD NEW SITE
      else {
        await addDoc(
          collection(db, "sites"),
          siteData
        );

        alert("✅ Site successfully saved.");
      }

      clearForm();

    } catch (error) {
      console.error("Save Site Error:", error);

      alert(
        "❌ Site save/update nahi ho payi.\n\n" +
        error.message
      );
    }
  };

  // =========================
  // EDIT SITE
  // =========================

  const editSite = (item) => {
    setSiteName(item.siteName || "");
    setLocation(item.location || "");
    setEngineer(item.engineer || "");
    setStatus(item.status || "");

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================
  // VIEW SITE DETAILS
  // =========================

  const viewSite = (id) => {
    navigate(`/site-details/${id}`);
  };

  // =========================
  // DELETE SITE
  // =========================

  const deleteSite = async (id) => {
    const confirmDelete = window.confirm(
      "Kya aap is Site ko delete karna chahte hain?"
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteDoc(
        doc(db, "sites", id)
      );

      alert("🗑 Site successfully deleted.");

      if (editId === id) {
        clearForm();
      }

    } catch (error) {
      console.error("Delete Site Error:", error);

      alert(
        "❌ Site delete nahi ho payi.\n\n" +
        error.message
      );
    }
  };

  // =========================
  // SEARCH
  // =========================

  const filteredSites = sites.filter((item) => {
    const searchText = search.toLowerCase();

    return (
      (item.siteName || "")
        .toLowerCase()
        .includes(searchText)

      ||

      (item.location || "")
        .toLowerCase()
        .includes(searchText)

      ||

      (item.engineer || "")
        .toLowerCase()
        .includes(searchText)

      ||

      (item.status || "")
        .toLowerCase()
        .includes(searchText)
    );
  });

  // =========================
  // PAGE
  // =========================

  return (
    <div style={{ display: "flex" }}>

      <Sidebar />

      <div
        className="main"
        style={{
          marginLeft: "250px",
          width: "calc(100% - 250px)",
          minHeight: "100vh",
          background: "#f4f6f9",
          padding: "25px",
        }}
      >

        <Header />

        <div className="site-page">

          {/* =========================
              TITLE
          ========================= */}

          <h1 className="site-title">
            🏗 Site Management
          </h1>

          {/* =========================
              FORM CARD
          ========================= */}

          <div className="page-card">

            <h2>
              {editId
                ? "✏️ Update Site"
                : "➕ Add New Site"}
            </h2>

            <div className="form-grid">

              {/* SITE NAME */}

              <input
                type="text"
                placeholder="Site Name *"
                value={siteName}
                onChange={(e) =>
                  setSiteName(e.target.value)
                }
              />

              {/* LOCATION */}

              <input
                type="text"
                placeholder="Location *"
                value={location}
                onChange={(e) =>
                  setLocation(e.target.value)
                }
              />

              {/* ENGINEER */}

              <input
                type="text"
                placeholder="Site Engineer"
                value={engineer}
                onChange={(e) =>
                  setEngineer(e.target.value)
                }
              />

              {/* STATUS */}

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              >
                <option value="">
                  Select Status
                </option>

                <option value="Running">
                  Running
                </option>

                <option value="Completed">
                  Completed
                </option>

                <option value="Pending">
                  Pending
                </option>

              </select>

            </div>

            {/* BUTTONS */}

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "20px",
              }}
            >

              <button
                className="save-btn"
                onClick={saveSite}
              >
                {editId
                  ? "✏️ Update Site"
                  : "💾 Save Site"}
              </button>

              {editId && (

                <button
                  type="button"
                  onClick={clearForm}
                  style={{
                    padding: "12px 20px",
                    border: "none",
                    borderRadius: "8px",
                    background: "#64748b",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ❌ Cancel
                </button>

              )}

            </div>

          </div>

          {/* =========================
              SEARCH
          ========================= */}

          <div className="page-card">

            <input
              type="text"
              className="search-box"
              placeholder="🔍 Search Site, Location, Engineer..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
            />

          </div>

          {/* =========================
              TABLE
          ========================= */}

          <div className="table-card">

            <h2 style={{ marginBottom: "20px" }}>
              📋 Site List
            </h2>

            {loading ? (

              <p
                style={{
                  textAlign: "center",
                  padding: "30px",
                }}
              >
                🔄 Loading Sites...
              </p>

            ) : (

              <div
                style={{
                  overflowX: "auto",
                }}
              >

                <table className="site-table">

                  <thead>

                    <tr>
                      <th>S.No</th>
                      <th>Site Name</th>
                      <th>Location</th>
                      <th>Engineer</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>

                  </thead>

                  <tbody>

                    {filteredSites.length === 0 ? (

                      <tr>

                        <td
                          colSpan="6"
                          style={{
                            textAlign: "center",
                            padding: "30px",
                          }}
                        >
                          📭 No Sites Found
                        </td>

                      </tr>

                    ) : (

                      filteredSites.map(
                        (item, index) => (

                          <tr key={item.id}>

                            <td>
                              {index + 1}
                            </td>

                            <td>
                              {item.siteName}
                            </td>

                            <td>
                              {item.location}
                            </td>

                            <td>
                              {item.engineer || "-"}
                            </td>

                            <td>

                              <span
                                className={
                                  item.status === "Running"
                                    ? "status-running"
                                    : item.status === "Completed"
                                    ? "status-completed"
                                    : "status-pending"
                                }
                              >
                                {item.status || "Pending"}
                              </span>

                            </td>

                            {/* ACTION BUTTONS */}

                            <td
                              style={{
                                whiteSpace: "nowrap",
                              }}
                            >

                              <button
                                className="view-btn"
                                onClick={() => viewSite(item.id)}
                                style={{
                                  marginRight: "6px",
                                }}
                              >
                                👁️ View
                              </button>

                              <button
                                className="edit-btn"
                                onClick={() => editSite(item)}
                                style={{
                                  marginRight: "6px",
                                }}
                              >
                                ✏️ Edit
                              </button>

                              <button
                                className="delete-btn"
                                onClick={() => deleteSite(item.id)}
                              >
                                🗑 Delete
                              </button>

                            </td>

                          </tr>

                        )
                      )

                    )}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        </div>

      </div>

    </div>
  );
}

export default Sites;