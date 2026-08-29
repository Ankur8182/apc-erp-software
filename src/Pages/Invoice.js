import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import "../Styles/Invoice.css";

import { db } from "../firebase";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

function Invoice() {
  // =========================
  // STATES
  // =========================

  const [invoices, setInvoices] = useState([]);
  const [sites, setSites] = useState([]);
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("");
  const [site, setSite] = useState("");
  const [clientName, setClientName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [status, setStatus] = useState("Pending");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  // =========================
  // LOAD INVOICES
  // =========================

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "invoices"),
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }));

        setInvoices(data);
      },
      (error) => {
        console.error("Invoice Load Error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // LOAD SITES
  // =========================

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
        console.error("Site Load Error:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================
  // AUTO STATUS
  // =========================

  const getStatus = (total, paid) => {
    const totalValue = Number(total || 0);
    const paidValue = Number(paid || 0);

    if (paidValue <= 0) return "Pending";

    if (paidValue >= totalValue) return "Paid";

    return "Partial";
  };

  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {
    setInvoiceNo("");
    setSite("");
    setClientName("");
    setInvoiceDate("");
    setDescription("");
    setTotalAmount("");
    setPaidAmount("");
    setStatus("Pending");
    setEditId(null);
  };

  // =========================
  // SAVE / UPDATE
  // =========================

  const saveInvoice = async () => {
    if (
      invoiceNo.trim() === "" ||
      site.trim() === "" ||
      clientName.trim() === "" ||
      totalAmount === "" ||
      invoiceDate === ""
    ) {
      alert(
        "Invoice No, Site, Client Name, Invoice Date aur Total Amount bharna zaroori hai."
      );
      return;
    }

    const total = Number(totalAmount || 0);
    const paid = Number(paidAmount || 0);

    if (!Number.isFinite(total) || total <= 0) {
      alert("Total Amount 0 se zyada valid number hona chahiye.");
      return;
    }

    if (!Number.isFinite(paid) || paid < 0 || paid > total) {
      alert("Paid Amount 0 aur Total Amount ke beech hona chahiye.");
      return;
    }

    const pending = total - paid;
    const invoiceStatus = getStatus(total, paid);

    const invoiceData = {
      invoiceNo: invoiceNo.trim(),
      site: site.trim(),
      clientName: clientName.trim(),
      invoiceDate,
      description: description.trim(),

      totalAmount: total,
      amount: total,

      paidAmount: paid,
      pendingAmount: pending,

      status: invoiceStatus,

      updatedAt: serverTimestamp(),
    };

    try {
      setLoading(true);

      if (editId) {
        await updateDoc(
          doc(db, "invoices", editId),
          invoiceData
        );

        const auditResult = await logAuditEvent({
          action: "update",
          module: "invoices",
          recordId: editId,
          recordLabel: invoiceData.invoiceNo,
          details: "Invoice record updated.",
          site: invoiceData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Invoice successfully updated.");
      } else {
        const invoiceReference = await addDoc(
          collection(db, "invoices"),
          {
            ...invoiceData,
            createdAt: serverTimestamp(),
          }
        );

        const auditResult = await logAuditEvent({
          action: "create",
          module: "invoices",
          recordId: invoiceReference.id,
          recordLabel: invoiceData.invoiceNo,
          details: "Invoice record created.",
          site: invoiceData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Invoice successfully saved.");
      }

      clearForm();
    } catch (error) {
      console.error("Save Invoice Error:", error);

      alert(
        "Invoice save nahi hua. Firebase connection/rules check karein."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // EDIT
  // =========================

  const editInvoice = (item) => {
    setInvoiceNo(item.invoiceNo || "");
    setSite(item.site || "");
    setClientName(item.clientName || "");
    setInvoiceDate(item.invoiceDate || "");
    setDescription(item.description || "");

    setTotalAmount(
      item.totalAmount ??
      item.amount ??
      ""
    );

    setPaidAmount(
      item.paidAmount ?? ""
    );

    setStatus(item.status || "Pending");
    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // =========================
  // DELETE
  // =========================

  const deleteInvoice = async (id, record = {}) => {
    const confirmDelete = window.confirm(
      "Kya aap is Invoice ko delete karna chahte hain?"
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, "invoices", id));

      const auditResult = await logAuditEvent({
        action: "delete",
        module: "invoices",
        recordId: id,
        recordLabel: record.invoiceNo,
        details: "Invoice record deleted.",
        site: record.site,
      });
      if (!auditResult.success) alert(getAuditFailureMessage());

      alert("Invoice successfully deleted.");
    } catch (error) {
      console.error("Delete Invoice Error:", error);

      alert("Invoice delete nahi hua.");
    }
  };

  // =========================
  // FILTER
  // =========================

  const filteredInvoices = invoices.filter((item) => {
    const text = search.toLowerCase();
    const searchMatched = [item.invoiceNo, item.site, item.clientName, item.status]
      .some((value) => String(value || "").toLowerCase().includes(text));

    return searchMatched &&
      (!siteFilter || item.site === siteFilter) &&
      (!statusFilter || item.status === statusFilter);
  });

  const invoiceSortOptions = useMemo(
    () => [
      { value: "date", label: "Invoice date", getValue: (item) => item.invoiceDate },
      { value: "invoice", label: "Invoice number", getValue: (item) => item.invoiceNo },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "total", label: "Invoice amount", getValue: (item) => item.totalAmount ?? item.amount },
      { value: "pending", label: "Pending amount", getValue: (item) => item.pendingAmount ?? Number(item.totalAmount ?? item.amount ?? 0) - Number(item.paidAmount ?? 0) },
    ],
    []
  );
  const invoiceTable = useDataTable(filteredInvoices, {
    sortOptions: invoiceSortOptions,
    defaultSortBy: "date",
    defaultSortDirection: "desc",
    resetKey: `${search}|${siteFilter}|${statusFilter}`,
  });
  const invoiceSites = useMemo(() => getDistinctValues(invoices, (item) => item.site), [invoices]);
  const invoiceStatuses = useMemo(() => getDistinctValues(invoices, (item) => item.status), [invoices]);

  // =========================
  // SUMMARY
  // =========================

  const summary = useMemo(() => {
    let totalInvoiceAmount = 0;
    let totalPaidAmount = 0;
    let totalPendingAmount = 0;

    invoices.forEach((item) => {
      const total = Number(
        item.totalAmount ??
        item.amount ??
        0
      );

      const paid = Number(
        item.paidAmount ?? 0
      );

      const pending =
        item.pendingAmount !== undefined
          ? Number(item.pendingAmount || 0)
          : total - paid;

      totalInvoiceAmount += total;
      totalPaidAmount += paid;
      totalPendingAmount += pending;
    });

    return {
      totalInvoiceAmount,
      totalPaidAmount,
      totalPendingAmount,
      totalInvoices: invoices.length,
    };
  }, [invoices]);

  // =========================
  // FORMAT MONEY
  // =========================

  const formatMoney = (amount) => {
    return `₹ ${Number(amount || 0).toLocaleString(
      "en-IN"
    )}`;
  };

  // =========================
  // PAGE
  // =========================

  return (
    <Layout title="🧾 Invoice Management">
      <div className="data-page invoice-page">

        {/* =========================
            SUMMARY CARDS
        ========================= */}

        <div className="invoice-summary-grid">

          <div className="invoice-summary-card">
            <span className="invoice-summary-icon">
              🧾
            </span>

            <div>
              <p>Total Invoices</p>

              <h3>
                {summary.totalInvoices}
              </h3>
            </div>
          </div>

          <div className="invoice-summary-card">
            <span className="invoice-summary-icon">
              💰
            </span>

            <div>
              <p>Total Invoice Amount</p>

              <h3>
                {formatMoney(
                  summary.totalInvoiceAmount
                )}
              </h3>
            </div>
          </div>

          <div className="invoice-summary-card">
            <span className="invoice-summary-icon">
              ✅
            </span>

            <div>
              <p>Total Received</p>

              <h3>
                {formatMoney(
                  summary.totalPaidAmount
                )}
              </h3>
            </div>
          </div>

          <div className="invoice-summary-card">
            <span className="invoice-summary-icon">
              ⏳
            </span>

            <div>
              <p>Total Pending</p>

              <h3>
                {formatMoney(
                  summary.totalPendingAmount
                )}
              </h3>
            </div>
          </div>

        </div>

        {/* =========================
            INVOICE FORM
        ========================= */}

        <div className="page-card">

          <h2>
            🧾 {editId
              ? "Update Invoice"
              : "Create New Invoice"}
          </h2>
          <p className="form-helper">Fields marked with * are required.</p>

          <div className="form-grid">

            <input
              type="text"
              placeholder="Invoice Number *"
              value={invoiceNo}
              onChange={(e) =>
                setInvoiceNo(e.target.value)
              }
            />

            <select
              value={site}
              onChange={(e) =>
                setSite(e.target.value)
              }
            >
              <option value="">
                Select Site *
              </option>

              {sites.map((item) => {
                const siteName =
                  item.siteName ||
                  item.name ||
                  item.site ||
                  "";

                return (
                  <option
                    key={item.id}
                    value={siteName}
                  >
                    {siteName || "Unnamed Site"}
                  </option>
                );
              })}
            </select>

            <input
              type="text"
              placeholder="Client Name *"
              value={clientName}
              onChange={(e) =>
                setClientName(e.target.value)
              }
            />

            <input
              type="date"
              aria-label="Invoice Date *"
              value={invoiceDate}
              onChange={(e) =>
                setInvoiceDate(e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Total Invoice Amount *"
              value={totalAmount}
              onChange={(e) =>
                setTotalAmount(e.target.value)
              }
            />

            <input
              type="number"
              placeholder="Paid / Received Amount"
              value={paidAmount}
              onChange={(e) =>
                setPaidAmount(e.target.value)
              }
            />

            <input
              type="text"
              placeholder="Description / Work Details"
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
            />

            {/* AUTO STATUS */}

            <input
              type="text"
              value={
                totalAmount !== ""
                  ? getStatus(
                      totalAmount,
                      paidAmount
                    )
                  : status
              }
              readOnly
              placeholder="Payment Status"
            />

          </div>

          {/* LIVE PAYMENT SUMMARY */}

          {totalAmount !== "" && (
            <div className="invoice-payment-info">

              <div>
                <span>Total:</span>

                <strong>
                  {formatMoney(totalAmount)}
                </strong>
              </div>

              <div>
                <span>Received:</span>

                <strong>
                  {formatMoney(paidAmount)}
                </strong>
              </div>

              <div>
                <span>Pending:</span>

                <strong>
                  {formatMoney(
                    Number(totalAmount || 0) -
                    Number(paidAmount || 0)
                  )}
                </strong>
              </div>

            </div>
          )}

          <div className="invoice-action-buttons">

            <button
              className="save-btn"
              onClick={saveInvoice}
              disabled={loading}
            >
              {loading
                ? "⏳ Saving..."
                : editId
                ? "✏️ Update Invoice"
                : "💾 Save Invoice"}
            </button>

            {editId && (
              <button
                className="delete-btn"
                onClick={clearForm}
              >
                ❌ Cancel Edit
              </button>
            )}

          </div>

        </div>

        {/* =========================
            INVOICE TABLE
        ========================= */}

        <div className="table-card">

          <h2>
            📋 Invoice List
          </h2>

          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search invoice, site, client or status..."
            table={invoiceTable}
          >
            <label>
              <span>Site</span>
              <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
                <option value="">All sites</option>
                {invoiceSites.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Payment status</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {invoiceStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </DataTableToolbar>

          <div className="table-responsive">

            <table className="invoice-table">

              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Invoice No</th>
                  <th>Site</th>
                  <th>Client</th>
                  <th>Date</th>
                  <th>Total Amount</th>
                  <th>Received</th>
                  <th>Pending</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {invoiceTable.count === 0 ? (
                  <tr>
                    <td
                      colSpan="10"
                      style={{
                        textAlign: "center",
                        padding: "25px",
                      }}
                    >
                      No Invoice Found
                    </td>
                  </tr>
                ) : (
                  invoiceTable.rows.map(
                    (item, index) => {
                      const total = Number(
                        item.totalAmount ??
                        item.amount ??
                        0
                      );

                      const paid = Number(
                        item.paidAmount ?? 0
                      );

                      const pending =
                        item.pendingAmount !== undefined
                          ? Number(
                              item.pendingAmount || 0
                            )
                          : total - paid;

                      const invoiceStatus =
                        item.status ||
                        getStatus(total, paid);

                      return (
                        <tr key={item.id}>

                          <td>
                            {invoiceTable.startIndex + index + 1}
                          </td>

                          <td>
                            <strong>
                              {item.invoiceNo}
                            </strong>
                          </td>

                          <td>
                            {item.site}
                          </td>

                          <td>
                            {item.clientName}
                          </td>

                          <td>
                            {item.invoiceDate || "-"}
                          </td>

                          <td>
                            {formatMoney(total)}
                          </td>

                          <td>
                            {formatMoney(paid)}
                          </td>

                          <td>
                            {formatMoney(pending)}
                          </td>

                          <td>
                            <span
                              className={
                                invoiceStatus === "Paid"
                                  ? "paid-badge"
                                  : invoiceStatus === "Partial"
                                  ? "partial-badge"
                                  : "pending-badge"
                              }
                            >
                              {invoiceStatus}
                            </span>
                          </td>

                          <td>

                            <button
                              className="edit-btn"
                              onClick={() =>
                                editInvoice(item)
                              }
                            >
                              ✏️ Edit
                            </button>

                            <button
                              className="delete-btn"
                              onClick={() =>
                                deleteInvoice(item.id, item)
                              }
                            >
                              🗑️ Delete
                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

          <DataTablePagination table={invoiceTable} />

        </div>

      </div>
    </Layout>
  );
}

export default Invoice;
