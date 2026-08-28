import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import "../Styles/Materials.css";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebase";

function Materials() {
  const [materials, setMaterials] = useState([]);
  const [sites, setSites] = useState([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);

  const initialFormData = {
    materialName: "",
    category: "",
    quantity: "",
    unit: "Bag",
    rate: "",
    site: "",
    supplier: "",
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    remarks: "",
  };

  const [formData, setFormData] = useState(initialFormData);

  // ==============================
  // FETCH MATERIALS FROM FIREBASE
  // ==============================
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "materials"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        // Latest entry ऊपर दिखाने के लिए
        data.sort((a, b) => {
          const aTime = a.createdAt?.seconds
            ? a.createdAt.seconds
            : 0;

          const bTime = b.createdAt?.seconds
            ? b.createdAt.seconds
            : 0;

          return bTime - aTime;
        });

        setMaterials(data);
      },
      (error) => {
        console.error("Material fetch error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ==============================
  // FETCH SITES FROM FIREBASE
  // ==============================
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setSites(data);
      },
      (error) => {
        console.error("Site fetch error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // ==============================
  // HANDLE INPUT CHANGE
  // ==============================
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ==============================
  // TOTAL AMOUNT
  // ==============================
  const totalAmount = useMemo(() => {
    const quantity = Number(formData.quantity) || 0;
    const rate = Number(formData.rate) || 0;

    return quantity * rate;
  }, [formData.quantity, formData.rate]);

  // ==============================
  // SAVE MATERIAL
  // ==============================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const quantity = Number(formData.quantity);
    const rate = Number(formData.rate);

    if (
      !formData.materialName.trim() ||
      !formData.site ||
      !formData.date
    ) {
      alert("Material Name, Site aur Date bharna zaroori hai.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      alert("Quantity aur Rate 0 se zyada valid numbers hone chahiye.");
      return;
    }

    try {
      setLoading(true);

      const calculatedTotal = quantity * rate;

      const materialData = {
        materialName: formData.materialName.trim(),
        category: formData.category.trim(),
        quantity,
        unit: formData.unit,
        rate,
        site: formData.site,
        supplier: formData.supplier.trim(),
        billNo: formData.billNo.trim(),
        date: formData.date,
        remarks: formData.remarks.trim(),

        // Reports के लिए important fields
        totalAmount: calculatedTotal,
        amount: calculatedTotal,
        expenseAmount: calculatedTotal,

        updatedAt: serverTimestamp(),
      };

      if (editId) {
        await updateDoc(
          doc(db, "materials", editId),
          materialData
        );

        alert("Material entry updated successfully.");
      } else {
        await addDoc(collection(db, "materials"), {
          ...materialData,
          createdAt: serverTimestamp(),
        });

        alert("Material added successfully.");
      }

      setFormData({
        ...initialFormData,
        date: new Date().toISOString().split("T")[0],
      });

      setEditId(null);
    } catch (error) {
      console.error("Material save error:", error);
      alert("Material save nahi hua. Firebase error check karein.");
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // EDIT MATERIAL
  // ==============================
  const handleEdit = (item) => {
    setEditId(item.id);

    setFormData({
      materialName: item.materialName || item.name || "",
      category: item.category || "",
      quantity: item.quantity || "",
      unit: item.unit || "Bag",
      rate: item.rate || "",
      site: item.site || "",
      supplier: item.supplier || "",
      billNo: item.billNo || "",
      date:
        item.date ||
        new Date().toISOString().split("T")[0],
      remarks: item.remarks || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ==============================
  // DELETE MATERIAL
  // ==============================
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm(
      "Kya aap ye material entry delete karna chahte hain?"
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "materials", id));

      alert("Material deleted successfully.");

      if (editId === id) {
        setEditId(null);

        setFormData({
          ...initialFormData,
          date: new Date().toISOString().split("T")[0],
        });
      }
    } catch (error) {
      console.error("Material delete error:", error);
      alert("Material delete nahi hua.");
    }
  };

  // ==============================
  // CANCEL EDIT
  // ==============================
  const handleCancelEdit = () => {
    setEditId(null);

    setFormData({
      ...initialFormData,
      date: new Date().toISOString().split("T")[0],
    });
  };

  // ==============================
  // FILTER MATERIALS
  // ==============================
  const filteredMaterials = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return materials;
    }

    return materials.filter((item) => {
      const materialName =
        item.materialName || item.name || "";

      const category = item.category || "";
      const site = item.site || "";
      const supplier = item.supplier || "";
      const billNo = item.billNo || "";

      return (
        materialName.toLowerCase().includes(searchText) ||
        category.toLowerCase().includes(searchText) ||
        site.toLowerCase().includes(searchText) ||
        supplier.toLowerCase().includes(searchText) ||
        billNo.toLowerCase().includes(searchText)
      );
    });
  }, [materials, search]);

  // ==============================
  // TOTAL MATERIAL EXPENSE
  // ==============================
  const totalMaterialExpense = useMemo(() => {
    return materials.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;

      const itemAmount =
        Number(
          item.totalAmount ??
            item.amount ??
            item.expenseAmount
        ) || quantity * rate;

      return total + itemAmount;
    }, 0);
  }, [materials]);

  // ==============================
  // SITE NAME HELPER
  // ==============================
  const getSiteName = (site) => {
    if (typeof site === "string") return site;

    if (site && typeof site === "object") {
      return (
        site.siteName ||
        site.name ||
        site.title ||
        ""
      );
    }

    return "";
  };

  return (
    <Layout>
      <div className="materials-page">

        {/* =========================
            PAGE HEADER
        ========================= */}
        <div className="materials-header">
          <div>
            <h1>📦 Materials Management</h1>
            <p>
              Add, manage and track all project materials
            </p>
          </div>

          <div className="material-summary-box">
            <span>Total Material Expense</span>
            <strong>
              ₹ {totalMaterialExpense.toLocaleString("en-IN")}
            </strong>
          </div>
        </div>

        {/* =========================
            ADD / EDIT FORM
        ========================= */}
        <div className="material-form-card">
          <h2>
            {editId
              ? "✏️ Edit Material Entry"
              : "➕ Add Material Entry"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="material-form-grid">

              <div className="form-group">
                <label>Material Name *</label>

                <input
                  type="text"
                  name="materialName"
                  value={formData.materialName}
                  onChange={handleChange}
                  placeholder="e.g. Cement"
                />
              </div>

              <div className="form-group">
                <label>Category</label>

                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  placeholder="e.g. Cement / Steel"
                />
              </div>

              <div className="form-group">
                <label>Quantity *</label>

                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="0"
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Unit</label>

                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                >
                  <option value="Bag">Bag</option>
                  <option value="Kg">Kg</option>
                  <option value="Ton">Ton</option>
                  <option value="Piece">Piece</option>
                  <option value="Feet">Feet</option>
                  <option value="Meter">Meter</option>
                  <option value="Litre">Litre</option>
                </select>
              </div>

              <div className="form-group">
                <label>Rate per Unit *</label>

                <input
                  type="number"
                  name="rate"
                  value={formData.rate}
                  onChange={handleChange}
                  placeholder="₹ Rate"
                  min="1"
                />
              </div>

              <div className="form-group">
                <label>Total Amount</label>

                <input
                  type="text"
                  value={`₹ ${totalAmount.toLocaleString("en-IN")}`}
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Site *</label>

                <select
                  name="site"
                  value={formData.site}
                  onChange={handleChange}
                >
                  <option value="">
                    Select Site
                  </option>

                  {sites.map((site) => {
                    const siteName =
                      getSiteName(site);

                    return (
                      <option
                        key={site.id}
                        value={siteName}
                      >
                        {siteName}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label>Supplier</label>

                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  placeholder="Supplier Name"
                />
              </div>

              <div className="form-group">
                <label>Bill No.</label>

                <input
                  type="text"
                  name="billNo"
                  value={formData.billNo}
                  onChange={handleChange}
                  placeholder="Bill Number"
                />
              </div>

              <div className="form-group">
                <label>Date</label>

                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group full-width">
                <label>Remarks</label>

                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  placeholder="Any additional details..."
                  rows="3"
                />
              </div>

            </div>

            <div className="material-form-actions">

              <button
                type="submit"
                className="material-save-btn"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : editId
                  ? "💾 Update Material"
                  : "➕ Save Material"}
              </button>

              {editId && (
                <button
                  type="button"
                  className="material-cancel-btn"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}

            </div>
          </form>
        </div>

        {/* =========================
            SEARCH
        ========================= */}
        <div className="material-table-card">

          <div className="material-table-header">
            <h2>📋 Material Records</h2>

            <input
              type="text"
              placeholder="Search material, site, supplier..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="material-search"
            />
          </div>

          <div className="material-table-wrapper">
            <table className="material-table">

              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Material</th>
                  <th>Category</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Total Amount</th>
                  <th>Site</th>
                  <th>Supplier</th>
                  <th>Bill No.</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {filteredMaterials.length > 0 ? (
                  filteredMaterials.map(
                    (item, index) => {
                      const quantity =
                        Number(item.quantity) || 0;

                      const rate =
                        Number(item.rate) || 0;

                      const itemTotal =
                        Number(
                          item.totalAmount ??
                            item.amount ??
                            item.expenseAmount
                        ) ||
                        quantity * rate;

                      return (
                        <tr key={item.id}>

                          <td>{index + 1}</td>

                          <td>
                            {item.materialName ||
                              item.name ||
                              "-"}
                          </td>

                          <td>
                            {item.category || "-"}
                          </td>

                          <td>
                            {quantity} {item.unit || ""}
                          </td>

                          <td>
                            ₹{" "}
                            {rate.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td className="material-amount">
                            ₹{" "}
                            {itemTotal.toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td>
                            {getSiteName(item.site) ||
                              "-"}
                          </td>

                          <td>
                            {item.supplier || "-"}
                          </td>

                          <td>
                            {item.billNo || "-"}
                          </td>

                          <td>
                            {item.date || "-"}
                          </td>

                          <td className="material-action-cell">

                            <button
                              className="material-edit-btn"
                              onClick={() =>
                                handleEdit(item)
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="material-delete-btn"
                              onClick={() =>
                                handleDelete(item.id)
                              }
                            >
                              Delete
                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )
                ) : (
                  <tr>
                    <td
                      colSpan="11"
                      className="no-material-data"
                    >
                      No material records found
                    </td>
                  </tr>
                )}

              </tbody>

            </table>
          </div>
        </div>

      </div>
    </Layout>
  );
}

export default Materials;
