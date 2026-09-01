import React, { useEffect, useMemo, useState } from "react";
import Layout from "../Components/Layout";
import { DataTablePagination, DataTableToolbar } from "../Components/DataTableControls";
import { getDistinctValues, useDataTable } from "../utils/dataTable";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { captureMonitoringError } from "../utils/monitoring";
import { useAuth } from "../auth/AuthProvider";
import "../Styles/Vehicle.css";

import { auth, db } from "../firebase";
import {
  getSiteName,
  isDateInRange,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
} from "../utils/financialReporting";
import {
  EQUIPMENT_STATUSES,
  FUEL_TYPES,
  MAINTENANCE_STATUSES,
  OWNERSHIP_TYPES,
  calculateMaintenanceTotal,
  createAssignmentPayload,
  getEquipmentLabel,
  getFuelEfficiencyHistory,
  getMeterKind,
  isEquipmentManager,
  normaliseEquipmentStatus,
  summariseEquipment,
  validateFuelEntry,
  validateMaintenanceRecord,
} from "../utils/equipment";

import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

const expenseTypes = [
  "Fuel",
  "Maintenance",
  "Repair",
  "Driver Payment",
  "Toll",
  "Insurance",
  "Other",
];

function Vehicle() {
  const { role, user } = useAuth();
  const canWrite = isEquipmentManager(role);
  const [sites, setSites] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [vehicleExpenses, setVehicleExpenses] = useState([]);
  const [vehicleAssignments, setVehicleAssignments] = useState([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [search, setSearch] = useState("");
  const [vehicleSiteFilter, setVehicleSiteFilter] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("");

  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [mobile, setMobile] = useState("");
  const [site, setSite] = useState("");
  const [fuel, setFuel] = useState("");
  const [status, setStatus] = useState("Active");
  const [equipmentName, setEquipmentName] = useState("");
  const [assetId, setAssetId] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [ownershipType, setOwnershipType] = useState("Company Owned");
  const [ownerVendorName, setOwnerVendorName] = useState("");
  const [purchaseRentDetails, setPurchaseRentDetails] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");
  const [fitnessExpiry, setFitnessExpiry] = useState("");
  const [pollutionExpiry, setPollutionExpiry] = useState("");
  const [permitExpiry, setPermitExpiry] = useState("");
  const [vehicleNotes, setVehicleNotes] = useState("");
  const [meterType, setMeterType] = useState("odometer");

  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);

  const [expenseVehicleId, setExpenseVehicleId] = useState("");
  const [expenseSite, setExpenseSite] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseType, setExpenseType] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseRemarks, setExpenseRemarks] = useState("");
  const [fuelType, setFuelType] = useState("Diesel");
  const [fuelQuantity, setFuelQuantity] = useState("");
  const [fuelRate, setFuelRate] = useState("");
  const [expenseMeterReading, setExpenseMeterReading] = useState("");
  const [expenseMeterType, setExpenseMeterType] = useState("odometer");
  const [fuelVendor, setFuelVendor] = useState("");
  const [fuelBillReference, setFuelBillReference] = useState("");
  const [expenseEditId, setExpenseEditId] = useState(null);
  const [expenseLoading, setExpenseLoading] = useState(false);

  const [historyVehicleFilter, setHistoryVehicleFilter] = useState("all");
  const [historySiteFilter, setHistorySiteFilter] = useState("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");
  const [historySearch, setHistorySearch] = useState("");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");
  const [assignmentVehicleId, setAssignmentVehicleId] = useState("");
  const [assignmentSite, setAssignmentSite] = useState("");
  const [assignmentDate, setAssignmentDate] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [maintenanceVehicleId, setMaintenanceVehicleId] = useState("");
  const [maintenanceSite, setMaintenanceSite] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [maintenanceIssue, setMaintenanceIssue] = useState("");
  const [maintenanceVendor, setMaintenanceVendor] = useState("");
  const [maintenanceLabourCost, setMaintenanceLabourCost] = useState("");
  const [maintenancePartsCost, setMaintenancePartsCost] = useState("");
  const [maintenanceOtherCost, setMaintenanceOtherCost] = useState("");
  const [maintenanceMeterReading, setMaintenanceMeterReading] = useState("");
  const [nextServiceDate, setNextServiceDate] = useState("");
  const [nextServiceMeterReading, setNextServiceMeterReading] = useState("");
  const [maintenanceStatus, setMaintenanceStatus] = useState("Open");
  const [maintenanceRemarks, setMaintenanceRemarks] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  // =========================
  // LOAD VEHICLES - REAL TIME
  // =========================

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sites"), (snapshot) => {
      setSites(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => { console.error("Site reference error:", error); void captureMonitoringError(error, { module: "vehicles", operation: "read" }); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const vehicleRef = collection(db, "vehicles");

    const unsubscribe = onSnapshot(
      vehicleRef,
      (snapshot) => {
        const data = snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setVehicles(data);
      },
      (error) => {
        console.error("Firestore Vehicle Error:", error);
        void captureMonitoringError(error, { module: "vehicles", operation: "read" });
        alert("Vehicle data load nahi ho saka.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "vehicleExpenses"),
      (snapshot) => {
        setVehicleExpenses(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );
      },
      (error) => {
        console.error("Firestore vehicle expense error:", error);
        void captureMonitoringError(error, { module: "vehicles", operation: "read" });
        alert("Vehicle expense history load nahi ho saka.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "vehicleAssignments"), (snapshot) => {
      setVehicleAssignments(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => { console.error("Vehicle assignment history error:", error); void captureMonitoringError(error, { module: "vehicles", operation: "read" }); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "vehicleMaintenance"), (snapshot) => {
      setMaintenanceRecords(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (error) => { console.error("Vehicle maintenance history error:", error); void captureMonitoringError(error, { module: "vehicles", operation: "read" }); });
    return () => unsubscribe();
  }, []);

  // =========================
  // CLEAR FORM
  // =========================

  const clearForm = () => {
    setVehicleNumber("");
    setVehicleType("");
    setDriverName("");
    setMobile("");
    setSite("");
    setFuel("");
    setStatus("Active");
    setEquipmentName(""); setAssetId(""); setMakeModel(""); setOwnershipType("Company Owned");
    setOwnerVendorName(""); setPurchaseRentDetails(""); setInsuranceExpiry(""); setFitnessExpiry("");
    setPollutionExpiry(""); setPermitExpiry(""); setVehicleNotes(""); setMeterType("odometer");
    setEditId(null);
  };

  const clearExpenseForm = () => {
    setExpenseVehicleId("");
    setExpenseSite("");
    setExpenseDate("");
    setExpenseType("");
    setExpenseAmount("");
    setExpenseRemarks("");
    setFuelType("Diesel"); setFuelQuantity(""); setFuelRate(""); setExpenseMeterReading("");
    setExpenseMeterType("odometer"); setFuelVendor(""); setFuelBillReference("");
    setExpenseEditId(null);
  };

  // =========================
  // SAVE / UPDATE VEHICLE
  // =========================

  const saveVehicle = async () => {
    const cleanVehicleNumber = vehicleNumber.trim().toUpperCase();
    const cleanVehicleType = vehicleType.trim();
    const fuelAmount = Number(fuel || 0);

    if (!cleanVehicleNumber || !cleanVehicleType || !site.trim()) {
      alert("Vehicle Number, Vehicle Type aur Site bharna zaroori hai.");
      return;
    }

    if (!editId && !user?.uid) {
      alert("A signed-in user is required to create equipment.");
      return;
    }

    if (mobile && !/^[0-9]{10}$/.test(mobile.trim())) {
      alert("Driver Mobile Number 10 digit ka hona chahiye.");
      return;
    }

    if (!Number.isFinite(fuelAmount) || fuelAmount < 0) {
      alert("Fuel Cost valid non-negative number hona chahiye.");
      return;
    }

    const duplicateVehicle = vehicles.find(
      (item) =>
        item.vehicleNumber?.toLowerCase() ===
          cleanVehicleNumber.toLowerCase() &&
        item.id !== editId
    );

    if (duplicateVehicle) {
      alert("Ye Vehicle Number pehle se system me available hai.");
      return;
    }

    const currentVehicle = editId
      ? vehicles.find((item) => item.id === editId)
      : null;

    if (currentVehicle && normaliseSiteName(currentVehicle.site) !== normaliseSiteName(site)) {
      alert("Use Site Assignment to move equipment between sites so its assignment history is preserved.");
      return;
    }

    const normalisedStatus = normaliseEquipmentStatus(status);
    if (!normalisedStatus) {
      alert("Valid equipment status select karein.");
      return;
    }

    const vehicleData = {
      vehicleNumber: cleanVehicleNumber,
      vehicleType: cleanVehicleType,
      category: cleanVehicleType,
      equipmentName: equipmentName.trim(),
      assetId: assetId.trim(),
      makeModel: makeModel.trim(),
      ownershipType,
      ownerVendorName: ownerVendorName.trim(),
      driverName: driverName.trim(),
      mobile: mobile.trim(),
      site: site.trim(),
      fuel: fuelAmount,
      status: normalisedStatus,
      purchaseRentDetails: purchaseRentDetails.trim(),
      insuranceExpiry: normaliseDate(insuranceExpiry),
      fitnessExpiry: normaliseDate(fitnessExpiry),
      pollutionExpiry: normaliseDate(pollutionExpiry),
      permitExpiry: normaliseDate(permitExpiry),
      notes: vehicleNotes.trim(),
      meterType,
      updatedAt: serverTimestamp()
    };

    if (!currentVehicle || Number(currentVehicle.fuel || 0) !== fuelAmount) {
      vehicleData.fuelUpdatedAt = serverTimestamp();
    }

    try {
      setLoading(true);

      if (editId) {
        await updateDoc(
          doc(db, "vehicles", editId),
          vehicleData
        );

        const auditResult = await logAuditEvent({
          action: "update",
          module: "vehicle",
          recordId: editId,
          recordLabel: vehicleData.vehicleNumber,
          details: "Vehicle record updated.",
          site: vehicleData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        alert("Vehicle successfully updated.");
      } else {
        const vehicleReference = doc(collection(db, "vehicles"));
        const assignmentReference = doc(collection(db, "vehicleAssignments"));
        const batch = writeBatch(db);
        batch.set(vehicleReference, {
          ...vehicleData,
          currentAssignmentId: assignmentReference.id,
          createdBy: user?.uid || "",
          createdAt: serverTimestamp(),
        });
        batch.set(assignmentReference, {
          vehicleId: vehicleReference.id,
          vehicleNumber: cleanVehicleNumber,
          vehicleName: equipmentName.trim() || cleanVehicleType,
          site: site.trim(),
          assignmentDate: normaliseDate(new Date()),
          releaseDate: "",
          assignmentStatus: "Assigned",
          createdBy: user?.uid || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();

        const auditResult = await logAuditEvent({
          action: "create",
          module: "vehicle",
          recordId: vehicleReference.id,
          recordLabel: vehicleData.vehicleNumber,
          details: "Vehicle record created.",
          site: vehicleData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());

        const assignmentAudit = await logAuditEvent({
          action: "create", module: "vehicleAssignments", recordId: assignmentReference.id,
          recordLabel: cleanVehicleNumber, details: `Initial equipment assignment to ${site.trim()}.`, site: site.trim(),
        });
        if (!assignmentAudit.success) alert(getAuditFailureMessage());

        alert("Vehicle successfully saved.");
      }

      clearForm();
    } catch (error) {
      console.error("Vehicle Error:", error);
      void captureMonitoringError(error, { module: "vehicles", operation: "write" });

      alert(
        "Vehicle save nahi hua. Firebase connection check karein."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // EDIT VEHICLE
  // =========================

  const editVehicle = (item) => {
    setVehicleNumber(item.vehicleNumber || "");
    setVehicleType(item.vehicleType || "");
    setEquipmentName(item.equipmentName || item.name || "");
    setAssetId(item.assetId || item.equipmentId || "");
    setMakeModel(item.makeModel || "");
    setOwnershipType(item.ownershipType || "Company Owned");
    setOwnerVendorName(item.ownerVendorName || item.vendorName || item.ownerName || "");
    setPurchaseRentDetails(item.purchaseRentDetails || "");
    setInsuranceExpiry(normaliseDate(item.insuranceExpiry));
    setFitnessExpiry(normaliseDate(item.fitnessExpiry));
    setPollutionExpiry(normaliseDate(item.pollutionExpiry));
    setPermitExpiry(normaliseDate(item.permitExpiry));
    setVehicleNotes(item.notes || "");
    setMeterType(getMeterKind(item));
    setDriverName(item.driverName || "");
    setMobile(item.mobile || "");
    setSite(item.site || "");
    setFuel(item.fuel ?? "");
    setStatus(normaliseEquipmentStatus(item.status) || "Active");

    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  // =========================
  // DELETE VEHICLE
  // =========================

  const deleteVehicle = async (id, vehicleNo, record = {}) => {
    const hasExpenseHistory = vehicleExpenses.some(
      (expense) =>
        expense.vehicleId === id ||
        String(expense.vehicleNumber || "").trim().toLowerCase() ===
          String(vehicleNo || "").trim().toLowerCase()
    );

    const hasOperationalHistory = vehicleAssignments.some((assignment) => assignment.vehicleId === id) ||
      maintenanceRecords.some((record) => record.vehicleId === id);
    if (hasExpenseHistory || hasOperationalHistory) {
      alert("Equipment has financial or operational history and cannot be deleted. Mark it Off Hire instead.");
      return;
    }

    const confirmDelete = window.confirm(
      `Kya aap vehicle "${vehicleNo}" ko delete karna chahte hain?`
    );

    if (!confirmDelete) return;

    try {
      await deleteDoc(
        doc(db, "vehicles", id)
      );

      const auditResult = await logAuditEvent({
        action: "delete",
        module: "vehicle",
        recordId: id,
        recordLabel: vehicleNo,
        details: "Vehicle record deleted.",
        site: record.site,
      });
      if (!auditResult.success) alert(getAuditFailureMessage());

      alert("Vehicle successfully deleted.");

      if (editId === id) {
        clearForm();
      }
    } catch (error) {
      console.error("Delete Vehicle Error:", error);
      void captureMonitoringError(error, { module: "vehicles", operation: "write" });

      alert("Vehicle delete nahi hua.");
    }
  };

  const selectExpenseVehicle = (selectedVehicleId) => {
    setExpenseVehicleId(selectedVehicleId);

    const selectedVehicle = vehicles.find(
      (item) => item.id === selectedVehicleId
    );

    if (selectedVehicle) {
      setExpenseSite(getSiteName(selectedVehicle));
      setExpenseMeterType(getMeterKind(selectedVehicle));
    }
  };

  const saveVehicleExpense = async () => {
    const selectedVehicle = vehicles.find(
      (item) => item.id === expenseVehicleId
    );
    const cleanSite = normaliseSiteName(expenseSite);
    const normalisedExpenseDate = normaliseDate(expenseDate);
    const amount = Number(expenseAmount);

    if (!selectedVehicle || !cleanSite || !normalisedExpenseDate || !expenseType) {
      alert("Vehicle, Site, Date aur Expense Type bharna zaroori hai.");
      return;
    }

    if (normalisedExpenseDate !== expenseDate) {
      alert("Valid expense date select karein.");
      return;
    }

    if (!expenseTypes.includes(expenseType)) {
      alert("Valid expense type select karein.");
      return;
    }

    const isFuelEntry = expenseType === "Fuel";
    // Old vehicle-expense records may record a Fuel amount without the later
    // litre/rate fields. Keep those records editable, but require every new
    // fuel entry to use the derived, auditable fuel ledger shape.
    const hasStructuredFuelValues = fuelQuantity !== "" || fuelRate !== "";
    const isStructuredFuelEntry = isFuelEntry && (!expenseEditId || hasStructuredFuelValues);
    const fuelValidation = isStructuredFuelEntry ? validateFuelEntry({
      vehicleId: selectedVehicle.id, site: cleanSite, date: normalisedExpenseDate, fuelType,
      quantity: fuelQuantity, rate: fuelRate, meterReading: expenseMeterReading,
    }) : null;
    if (isStructuredFuelEntry && !fuelValidation.isValid) { alert(fuelValidation.error); return; }
    if (!isStructuredFuelEntry && (!Number.isFinite(amount) || amount <= 0)) {
      alert("Expense amount 0 se zyada valid number hona chahiye.");
      return;
    }
    const safeAmount = isStructuredFuelEntry ? fuelValidation.value.totalAmount : normaliseMoney(amount);

    const expenseData = {
      vehicleId: selectedVehicle.id,
      vehicleNumber: String(selectedVehicle.vehicleNumber || "").trim(),
      vehicleName: String(
        selectedVehicle.vehicleType || selectedVehicle.vehicleNumber || ""
      ).trim(),
      site: cleanSite,
      date: normalisedExpenseDate,
      expenseType,
      amount: safeAmount,
      totalAmount: safeAmount,
      remarks: expenseRemarks.trim(),
      updatedAt: serverTimestamp(),
      ...(isStructuredFuelEntry ? {
        fuelType,
        quantity: fuelValidation.value.quantity,
        fuelQuantity: fuelValidation.value.quantity,
        ratePerLitre: fuelValidation.value.ratePerLitre,
        meterReading: fuelValidation.value.meterReading,
        meterType: expenseMeterType,
        vendorPump: fuelVendor.trim(),
        billReference: fuelBillReference.trim(),
      } : {
        ...(expenseMeterReading !== "" ? { meterReading: normaliseMoney(expenseMeterReading), meterType: expenseMeterType } : {}),
      }),
    };

    try {
      setExpenseLoading(true);

      if (expenseEditId) {
        await updateDoc(
          doc(db, "vehicleExpenses", expenseEditId),
          expenseData
        );
        const auditResult = await logAuditEvent({
          action: "update",
          module: "vehicleExpenses",
          recordId: expenseEditId,
          recordLabel: expenseData.vehicleNumber || expenseData.vehicleName,
          details: `${expenseData.expenseType} vehicle expense updated.`,
          site: expenseData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());
        alert("Vehicle expense successfully updated.");
      } else {
        const createdBy = auth.currentUser?.uid;
        if (!createdBy) {
          alert("A signed-in user is required to save a vehicle expense.");
          return;
        }

        const vehicleExpenseReference = await addDoc(collection(db, "vehicleExpenses"), {
          ...expenseData,
          createdBy,
          createdAt: serverTimestamp(),
        });
        const auditResult = await logAuditEvent({
          action: "create",
          module: "vehicleExpenses",
          recordId: vehicleExpenseReference.id,
          recordLabel: expenseData.vehicleNumber || expenseData.vehicleName,
          details: `${expenseData.expenseType} vehicle expense created.`,
          site: expenseData.site,
        });
        if (!auditResult.success) alert(getAuditFailureMessage());
        alert("Vehicle expense successfully saved.");
      }

      clearExpenseForm();
    } catch (error) {
      console.error("Save vehicle expense error:", error);
      void captureMonitoringError(error, { module: "vehicles", operation: "write" });
      alert("Vehicle expense save nahi hua. Firebase connection/rules check karein.");
    } finally {
      setExpenseLoading(false);
    }
  };

  const editVehicleExpense = (item) => {
    setExpenseVehicleId(item.vehicleId || "");
    setExpenseSite(getSiteName(item));
    setExpenseDate(normaliseDate(item.date));
    setExpenseType(item.expenseType || "");
    setExpenseAmount(item.amount ?? "");
    setExpenseRemarks(item.remarks || "");
    setFuelType(item.fuelType || "Diesel");
    setFuelQuantity(item.quantity ?? item.fuelQuantity ?? "");
    setFuelRate(item.ratePerLitre ?? "");
    setExpenseMeterReading(item.meterReading ?? "");
    setExpenseMeterType(item.meterType || "odometer");
    setFuelVendor(item.vendorPump || item.vendor || "");
    setFuelBillReference(item.billReference || "");
    setExpenseEditId(item.id);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteVehicleExpense = async (id, record = {}) => {
    if (!window.confirm("Kya aap is vehicle expense ko delete karna chahte hain?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "vehicleExpenses", id));
      const auditResult = await logAuditEvent({
        action: "delete",
        module: "vehicleExpenses",
        recordId: id,
        recordLabel: record.vehicleNumber || record.vehicleName,
        details: `${record.expenseType || "Vehicle"} expense deleted.`,
        site: getSiteName(record),
      });
      if (!auditResult.success) alert(getAuditFailureMessage());
      alert("Vehicle expense successfully deleted.");

      if (expenseEditId === id) {
        clearExpenseForm();
      }
    } catch (error) {
      console.error("Delete vehicle expense error:", error);
      void captureMonitoringError(error, { module: "vehicles", operation: "write" });
      alert("Vehicle expense delete nahi hua.");
    }
  };

  const selectAssignmentVehicle = (vehicleId) => {
    setAssignmentVehicleId(vehicleId);
    const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
    if (selected) setAssignmentSite(getSiteName(selected));
  };

  const saveAssignment = async () => {
    const vehicle = vehicles.find((item) => item.id === assignmentVehicleId);
    const validation = createAssignmentPayload({ vehicle, site: assignmentSite, assignmentDate, createdBy: user?.uid });
    if (!validation.isValid) { alert(validation.error); return; }
    const activeAssignment = vehicleAssignments.find((item) => item.vehicleId === vehicle.id && !normaliseDate(item.releaseDate));
    if (normaliseSiteName(getSiteName(vehicle)) === normaliseSiteName(validation.value.site)) {
      alert("Equipment is already assigned to this site.");
      return;
    }
    try {
      setAssignmentLoading(true);
      const newAssignment = doc(collection(db, "vehicleAssignments"));
      const batch = writeBatch(db);
      if (activeAssignment) {
        batch.update(doc(db, "vehicleAssignments", activeAssignment.id), {
          releaseDate: validation.value.assignmentDate, assignmentStatus: "Released", updatedAt: serverTimestamp(),
        });
      }
      batch.set(newAssignment, { ...validation.value, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.update(doc(db, "vehicles", vehicle.id), {
        site: validation.value.site, currentAssignmentId: newAssignment.id, assignmentDate: validation.value.assignmentDate, updatedAt: serverTimestamp(),
      });
      await batch.commit();
      const auditResult = await logAuditEvent({ action: "create", module: "vehicleAssignments", recordId: newAssignment.id, recordLabel: getEquipmentLabel(vehicle), details: `Equipment assigned to ${validation.value.site}.`, site: validation.value.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
      alert("Equipment site assignment saved.");
      setAssignmentVehicleId(""); setAssignmentSite(""); setAssignmentDate("");
    } catch (error) { console.error("Save assignment error:", error); void captureMonitoringError(error, { module: "vehicles", operation: "write" }); alert("Equipment assignment save nahi hua."); }
    finally { setAssignmentLoading(false); }
  };

  const selectMaintenanceVehicle = (vehicleId) => {
    setMaintenanceVehicleId(vehicleId);
    const selected = vehicles.find((vehicle) => vehicle.id === vehicleId);
    if (selected) {
      setMaintenanceSite(getSiteName(selected));
      setMaintenanceMeterReading("");
    }
  };

  const saveMaintenance = async () => {
    const vehicle = vehicles.find((item) => item.id === maintenanceVehicleId);
    const validation = validateMaintenanceRecord({
      vehicleId: maintenanceVehicleId, site: maintenanceSite, serviceDate: maintenanceDate,
      maintenanceType, status: maintenanceStatus, labourCost: maintenanceLabourCost,
      partsCost: maintenancePartsCost, otherCost: maintenanceOtherCost, meterReading: maintenanceMeterReading,
    });
    if (!validation.isValid || !vehicle || !user?.uid) { alert(validation.error || "A signed-in user and valid maintenance details are required."); return; }
    try {
      setMaintenanceLoading(true);
      const maintenanceReference = doc(collection(db, "vehicleMaintenance"));
      const expenseReference = validation.value.totalCost > 0 ? doc(collection(db, "vehicleExpenses")) : null;
      const batch = writeBatch(db);
      const maintenanceData = {
        vehicleId: vehicle.id, vehicleNumber: getEquipmentLabel(vehicle), vehicleName: vehicle.equipmentName || vehicle.vehicleType || getEquipmentLabel(vehicle),
        site: normaliseSiteName(maintenanceSite), maintenanceType: maintenanceType.trim(), issueDescription: maintenanceIssue.trim(),
        serviceDate: validation.value.serviceDate, vendorWorkshop: maintenanceVendor.trim(), ...validation.value,
        nextServiceDate: normaliseDate(nextServiceDate), nextServiceMeterReading: nextServiceMeterReading === "" ? null : normaliseMoney(nextServiceMeterReading),
        status: maintenanceStatus, remarks: maintenanceRemarks.trim(), linkedExpenseId: expenseReference?.id || "", createdBy: user.uid,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      };
      batch.set(maintenanceReference, maintenanceData);
      if (expenseReference) {
        batch.set(expenseReference, {
          vehicleId: vehicle.id, vehicleNumber: getEquipmentLabel(vehicle), vehicleName: vehicle.equipmentName || vehicle.vehicleType || getEquipmentLabel(vehicle),
          site: normaliseSiteName(maintenanceSite), date: validation.value.serviceDate, expenseType: "Maintenance",
          amount: validation.value.totalCost, totalAmount: validation.value.totalCost, maintenanceRecordId: maintenanceReference.id,
          maintenanceStatus, remarks: maintenanceRemarks.trim() || maintenanceIssue.trim(), createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
      if (maintenanceStatus === "Open" || maintenanceStatus === "In Progress") {
        batch.update(doc(db, "vehicles", vehicle.id), {
          status: maintenanceType.trim().toLowerCase().includes("breakdown") ? "Breakdown" : "Under Maintenance",
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      const auditResult = await logAuditEvent({ action: "create", module: "vehicleMaintenance", recordId: maintenanceReference.id, recordLabel: getEquipmentLabel(vehicle), details: `Maintenance record created${expenseReference ? ` with ${validation.value.totalCost} linked vehicle expense.` : "."}`, site: maintenanceData.site });
      if (!auditResult.success) alert(getAuditFailureMessage());
      if (expenseReference) {
        const expenseAudit = await logAuditEvent({
          action: "create", module: "vehicleExpenses", recordId: expenseReference.id,
          recordLabel: getEquipmentLabel(vehicle),
          details: `Maintenance expense linked to maintenance record ${maintenanceReference.id}.`,
          site: maintenanceData.site,
        });
        if (!expenseAudit.success) alert(getAuditFailureMessage());
      }
      alert("Maintenance record saved. Linked cost is counted once in Vehicle Expenses.");
      setMaintenanceVehicleId(""); setMaintenanceSite(""); setMaintenanceDate(""); setMaintenanceType(""); setMaintenanceIssue(""); setMaintenanceVendor(""); setMaintenanceLabourCost(""); setMaintenancePartsCost(""); setMaintenanceOtherCost(""); setMaintenanceMeterReading(""); setNextServiceDate(""); setNextServiceMeterReading(""); setMaintenanceStatus("Open"); setMaintenanceRemarks("");
    } catch (error) { console.error("Save maintenance error:", error); void captureMonitoringError(error, { module: "vehicles", operation: "write" }); alert("Maintenance record save nahi hua."); }
    finally { setMaintenanceLoading(false); }
  };

  // =========================
  // SEARCH
  // =========================

  const filteredVehicles = vehicles.filter((item) => {
    const text = search.toLowerCase().trim();
    const searchMatched = [item.vehicleNumber, item.vehicleType, item.equipmentName, item.assetId, item.makeModel, item.driverName, item.mobile, item.site, item.status]
      .some((value) => String(value || "").toLowerCase().includes(text));

    return searchMatched &&
      (!vehicleSiteFilter || item.site === vehicleSiteFilter) &&
      (!vehicleStatusFilter || item.status === vehicleStatusFilter);
  });

  const expenseSites = Array.from(
    new Set(
      [...vehicles, ...vehicleExpenses]
        .map((item) => getSiteName(item))
        .filter(Boolean)
    )
  ).sort((first, second) => first.localeCompare(second));

  const filteredVehicleExpenses = vehicleExpenses
    .filter((item) => {
      const historySearchText = historySearch.toLowerCase().trim();
      const selectedVehicle = vehicles.find(
        (vehicle) => vehicle.id === historyVehicleFilter
      );
      const vehicleMatched =
        historyVehicleFilter === "all" ||
        item.vehicleId === historyVehicleFilter ||
        (selectedVehicle &&
          String(item.vehicleNumber || "").trim().toLowerCase() ===
            String(selectedVehicle.vehicleNumber || "").trim().toLowerCase());
      const siteMatched =
        historySiteFilter === "all" ||
        getSiteName(item).toLowerCase() === historySiteFilter.toLowerCase();
      const typeMatched =
        historyTypeFilter === "all" || item.expenseType === historyTypeFilter;
      const searchMatched = [item.vehicleNumber, item.vehicleName, getSiteName(item), item.expenseType, item.remarks]
        .some((value) => String(value || "").toLowerCase().includes(historySearchText));

      return (
        vehicleMatched &&
        siteMatched &&
        typeMatched &&
        searchMatched &&
        isDateInRange(item, historyFromDate, historyToDate)
      );
    });

  const vehicleSortOptions = useMemo(
    () => [
      { value: "number", label: "Vehicle number", getValue: (item) => item.vehicleNumber },
      { value: "type", label: "Vehicle type", getValue: (item) => item.vehicleType },
      { value: "site", label: "Site", getValue: (item) => item.site },
      { value: "fuel", label: "Fuel / day", getValue: (item) => item.fuel },
      { value: "status", label: "Status", getValue: (item) => item.status },
    ],
    []
  );
  const vehicleTable = useDataTable(filteredVehicles, {
    sortOptions: vehicleSortOptions,
    defaultSortBy: "number",
    resetKey: `${search}|${vehicleSiteFilter}|${vehicleStatusFilter}`,
  });
  const vehicleExpenseSortOptions = useMemo(
    () => [
      { value: "date", label: "Date", getValue: (item) => normaliseDate(item.date) },
      { value: "vehicle", label: "Vehicle", getValue: (item) => item.vehicleNumber || item.vehicleName },
      { value: "site", label: "Site", getValue: (item) => getSiteName(item) },
      { value: "type", label: "Expense type", getValue: (item) => item.expenseType },
      { value: "amount", label: "Amount", getValue: (item) => normaliseMoney(item.amount) },
    ],
    []
  );
  const vehicleExpenseTable = useDataTable(filteredVehicleExpenses, {
    sortOptions: vehicleExpenseSortOptions,
    defaultSortBy: "date",
    defaultSortDirection: "desc",
    resetKey: `${historySearch}|${historyVehicleFilter}|${historySiteFilter}|${historyTypeFilter}|${historyFromDate}|${historyToDate}`,
  });
  const vehicleSites = useMemo(() => getDistinctValues(vehicles, (item) => item.site), [vehicles]);
  const vehicleStatuses = useMemo(() => getDistinctValues(vehicles, (item) => item.status), [vehicles]);
  const equipmentSummary = useMemo(
    () => summariseEquipment({ vehicles, vehicleExpenses }),
    [vehicles, vehicleExpenses]
  );
  const selectedHistoryVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === historyVehicleFilter),
    [vehicles, historyVehicleFilter]
  );
  const fuelEfficiencyHistory = useMemo(
    () => historyVehicleFilter === "all" ? [] : getFuelEfficiencyHistory(
      vehicleExpenses.filter((expense) => expense.vehicleId === historyVehicleFilter),
      selectedHistoryVehicle
    ),
    [vehicleExpenses, historyVehicleFilter, selectedHistoryVehicle]
  );

  // =========================
  // SUMMARY
  // =========================

  const totalVehicles = equipmentSummary.total;

  const activeVehicles = equipmentSummary.active;

  const inactiveVehicles = equipmentSummary.idle;

  const maintenanceVehicles = equipmentSummary.underMaintenance;

  const getStatusClass = (vehicleStatus) => {
    if (vehicleStatus === "Active") {
      return "status-active";
    }

    if (normaliseEquipmentStatus(vehicleStatus) === "Idle") {
      return "status-inactive";
    }

    if (normaliseEquipmentStatus(vehicleStatus) === "Under Maintenance") {
      return "status-maintenance";
    }

    return "";
  };

  return (
    <Layout title="🚚 Vehicle Management">

      <div className="data-page vehicle-page">

        {/* ========================= */}
        {/* FORM */}
        {/* ========================= */}

        <div className="page-card vehicle-form-card">

          <div className="vehicle-card-header">
            <div>
              <h2>
                🚚 {editId
                  ? "Update Vehicle"
                  : "Add Vehicle"}
              </h2>

              <p>
                Vehicle details aur daily fuel information manage karein
              </p>
              <p className="form-helper">Fields marked with * are required.</p>
            </div>

            {editId && (
              <span className="edit-mode-badge">
                ✏️ Edit Mode
              </span>
            )}
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label>Vehicle Number *</label>

              <input
                type="text"
                placeholder="UP32 AB 1234"
                value={vehicleNumber}
                onChange={(e) =>
                  setVehicleNumber(
                    e.target.value.toUpperCase()
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Vehicle Type *</label>

              <input
                type="text"
                placeholder="Pickup / Truck / JCB"
                value={vehicleType}
                onChange={(e) =>
                  setVehicleType(e.target.value)
                }
              />
            </div>

            <div className="form-group"><label>Equipment Name</label><input type="text" placeholder="e.g. Excavator" value={equipmentName} onChange={(e) => setEquipmentName(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Asset / Equipment ID</label><input type="text" placeholder="Internal asset ID" value={assetId} onChange={(e) => setAssetId(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Make / Model</label><input type="text" placeholder="Make and model" value={makeModel} onChange={(e) => setMakeModel(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Ownership Type</label><select value={ownershipType} onChange={(e) => setOwnershipType(e.target.value)} disabled={!canWrite}>{OWNERSHIP_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
            <div className="form-group"><label>Vendor / Owner</label><input type="text" placeholder="Owner or rental vendor" value={ownerVendorName} onChange={(e) => setOwnerVendorName(e.target.value)} disabled={!canWrite} /></div>

            <div className="form-group">
              <label>Driver Name</label>

              <input
                type="text"
                placeholder="Driver Name"
                value={driverName}
                onChange={(e) =>
                  setDriverName(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Driver Mobile</label>

              <input
                type="tel"
                maxLength="10"
                placeholder="10 Digit Mobile Number"
                value={mobile}
                onChange={(e) =>
                  setMobile(
                    e.target.value.replace(/\D/g, "")
                  )
                }
              />
            </div>

            <div className="form-group">
              <label>Site Name *</label>

              <select value={site} onChange={(e) => setSite(e.target.value)} disabled={!canWrite}>
                <option value="">Select Site</option>
                {Array.from(new Set([...sites.map((item) => getSiteName(item)), ...expenseSites])).filter(Boolean).map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Fuel / Day (₹)</label>

              <input
                type="number"
                min="0"
                placeholder="Daily Fuel Cost"
                value={fuel}
                onChange={(e) =>
                  setFuel(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label>Vehicle Status</label>

              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              >
                {EQUIPMENT_STATUSES.map((equipmentStatus) => <option key={equipmentStatus} value={equipmentStatus}>{equipmentStatus}</option>)}
              </select>
            </div>

            <div className="form-group"><label>Meter Type</label><select value={meterType} onChange={(e) => setMeterType(e.target.value)} disabled={!canWrite}><option value="odometer">Odometer (km)</option><option value="hour-meter">Hour Meter</option></select></div>
            <div className="form-group"><label>Purchase / Rent Details</label><input type="text" placeholder="Purchase/rent terms" value={purchaseRentDetails} onChange={(e) => setPurchaseRentDetails(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Insurance Expiry</label><input type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Fitness Expiry</label><input type="date" value={fitnessExpiry} onChange={(e) => setFitnessExpiry(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Pollution Certificate Expiry</label><input type="date" value={pollutionExpiry} onChange={(e) => setPollutionExpiry(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Permit Expiry</label><input type="date" value={permitExpiry} onChange={(e) => setPermitExpiry(e.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Notes</label><input type="text" placeholder="Operational notes" value={vehicleNotes} onChange={(e) => setVehicleNotes(e.target.value)} disabled={!canWrite} /></div>

          </div>

          <div className="vehicle-action-buttons">

            <button
              className="save-btn"
              onClick={saveVehicle}
              disabled={loading || !canWrite}
            >
              {!canWrite ? "Read-only access" : loading
                ? "⏳ Saving..."
                : editId
                ? "✏️ Update Vehicle"
                : "💾 Save Vehicle"
              }
            </button>

            {editId && (
              <button
                className="cancel-btn"
                onClick={clearForm}
              >
                ❌ Cancel
              </button>
            )}

          </div>

        </div>


        <div className="page-card vehicle-form-card">
          <div className="vehicle-card-header"><div><h2>📍 Site Assignment</h2><p>Move equipment through the assignment ledger; past assignments are released, never overwritten.</p></div></div>
          <div className="form-grid">
            <div className="form-group"><label>Vehicle / Equipment *</label><select value={assignmentVehicleId} onChange={(event) => selectAssignmentVehicle(event.target.value)} disabled={!canWrite}><option value="">Select Equipment</option>{vehicles.map((item) => <option key={item.id} value={item.id}>{getEquipmentLabel(item) || item.id}</option>)}</select></div>
            <div className="form-group"><label>Assign to Site *</label><select value={assignmentSite} onChange={(event) => setAssignmentSite(event.target.value)} disabled={!canWrite}><option value="">Select Site</option>{Array.from(new Set([...sites.map((item) => getSiteName(item)), ...expenseSites])).filter(Boolean).map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}</select></div>
            <div className="form-group"><label>Assignment Date *</label><input type="date" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} disabled={!canWrite} /></div>
          </div>
          <button className="save-btn" onClick={saveAssignment} disabled={assignmentLoading || !canWrite}>{!canWrite ? "Read-only access" : assignmentLoading ? "⏳ Saving..." : "💾 Save Assignment"}</button>
        </div>

        <div className="page-card vehicle-form-card">
          <div className="vehicle-card-header"><div><h2>🛠️ Maintenance / Breakdown</h2><p>Maintenance history is operational. Its linked Vehicle Expense is the only financial cost source.</p></div></div>
          <div className="form-grid">
            <div className="form-group"><label>Vehicle / Equipment *</label><select value={maintenanceVehicleId} onChange={(event) => selectMaintenanceVehicle(event.target.value)} disabled={!canWrite}><option value="">Select Equipment</option>{vehicles.map((item) => <option key={item.id} value={item.id}>{getEquipmentLabel(item) || item.id}</option>)}</select></div>
            <div className="form-group"><label>Site *</label><select value={maintenanceSite} onChange={(event) => setMaintenanceSite(event.target.value)} disabled={!canWrite}><option value="">Select Site</option>{expenseSites.map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}</select></div>
            <div className="form-group"><label>Service Date *</label><input type="date" value={maintenanceDate} onChange={(event) => setMaintenanceDate(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Maintenance Type *</label><input type="text" placeholder="Service / Repair / Breakdown" value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Status *</label><select value={maintenanceStatus} onChange={(event) => setMaintenanceStatus(event.target.value)} disabled={!canWrite}>{MAINTENANCE_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
            <div className="form-group"><label>Issue / Breakdown Description</label><input type="text" placeholder="Issue description" value={maintenanceIssue} onChange={(event) => setMaintenanceIssue(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Vendor / Workshop</label><input type="text" placeholder="Vendor/workshop" value={maintenanceVendor} onChange={(event) => setMaintenanceVendor(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Labour Cost (₹)</label><input type="number" min="0" value={maintenanceLabourCost} onChange={(event) => setMaintenanceLabourCost(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Parts Cost (₹)</label><input type="number" min="0" value={maintenancePartsCost} onChange={(event) => setMaintenancePartsCost(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Other Cost (₹)</label><input type="number" min="0" value={maintenanceOtherCost} onChange={(event) => setMaintenanceOtherCost(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Meter Reading</label><input type="number" min="0" value={maintenanceMeterReading} onChange={(event) => setMaintenanceMeterReading(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Next Service Date</label><input type="date" value={nextServiceDate} onChange={(event) => setNextServiceDate(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Next Service Meter</label><input type="number" min="0" value={nextServiceMeterReading} onChange={(event) => setNextServiceMeterReading(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Remarks</label><input type="text" value={maintenanceRemarks} onChange={(event) => setMaintenanceRemarks(event.target.value)} disabled={!canWrite} /></div>
          </div>
          <p className="form-helper">Calculated maintenance cost: ₹ {calculateMaintenanceTotal({ labourCost: maintenanceLabourCost, partsCost: maintenancePartsCost, otherCost: maintenanceOtherCost }).toLocaleString("en-IN")}</p>
          <button className="save-btn" onClick={saveMaintenance} disabled={maintenanceLoading || !canWrite}>{!canWrite ? "Read-only access" : maintenanceLoading ? "⏳ Saving..." : "💾 Save Maintenance"}</button>
        </div>

        {/* ========================= */}
        {/* VEHICLE EXPENSE HISTORY */}
        {/* ========================= */}

        <div className="page-card vehicle-form-card">

          <div className="vehicle-card-header">
            <div>
              <h2>
                💳 {expenseEditId
                  ? "Update Vehicle Expense"
                  : "Add Vehicle Expense"}
              </h2>

              <p>
                Fuel aur vehicle costs ko date ke saath record karein
              </p>
              <p className="form-helper">Fields marked with * are required.</p>
            </div>

            {expenseEditId && (
              <span className="edit-mode-badge">
                ✏️ Edit Mode
              </span>
            )}
          </div>

          <div className="form-grid">

            <div className="form-group">
              <label>Vehicle *</label>

              <select
                value={expenseVehicleId}
                onChange={(event) => selectExpenseVehicle(event.target.value)}
              >
                <option value="">Select Vehicle</option>
                {vehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.vehicleNumber || item.vehicleType || item.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Site *</label>

              <select
                value={expenseSite}
                onChange={(event) => setExpenseSite(event.target.value)}
              >
                <option value="">Select Site</option>
                {expenseSites.map((siteName) => (
                  <option key={siteName} value={siteName}>
                    {siteName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Expense Date *</label>

              <input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Expense Type *</label>

              <select
                value={expenseType}
                onChange={(event) => setExpenseType(event.target.value)}
              >
                <option value="">Select Expense Type</option>
                {expenseTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {expenseType === "Fuel" && <>
              <div className="form-group"><label>Fuel Type *</label><select value={fuelType} onChange={(event) => setFuelType(event.target.value)} disabled={!canWrite}>{FUEL_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></div>
              <div className="form-group"><label>Quantity (Litres) *</label><input type="number" min="0.01" step="0.01" value={fuelQuantity} onChange={(event) => setFuelQuantity(event.target.value)} disabled={!canWrite} /></div>
              <div className="form-group"><label>Rate per Litre (₹) *</label><input type="number" min="0.01" step="0.01" value={fuelRate} onChange={(event) => setFuelRate(event.target.value)} disabled={!canWrite} /></div>
              <div className="form-group"><label>Fuel Vendor / Pump</label><input type="text" value={fuelVendor} onChange={(event) => setFuelVendor(event.target.value)} disabled={!canWrite} /></div>
              <div className="form-group"><label>Bill / Reference</label><input type="text" value={fuelBillReference} onChange={(event) => setFuelBillReference(event.target.value)} disabled={!canWrite} /></div>
            </>}

            <div className="form-group"><label>{expenseMeterType === "hour-meter" ? "Hour Meter" : "Odometer"} Reading</label><input type="number" min="0" step="0.01" value={expenseMeterReading} onChange={(event) => setExpenseMeterReading(event.target.value)} disabled={!canWrite} /></div>
            <div className="form-group"><label>Meter Type</label><select value={expenseMeterType} onChange={(event) => setExpenseMeterType(event.target.value)} disabled={!canWrite}><option value="odometer">Odometer (km)</option><option value="hour-meter">Hour Meter</option></select></div>

            <div className="form-group">
              <label>{expenseType === "Fuel" ? "Calculated Amount (₹)" : "Amount (₹) *"}</label>

              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Expense Amount"
                value={expenseType === "Fuel" && (!expenseEditId || fuelQuantity || fuelRate) ? (fuelQuantity && fuelRate ? (normaliseMoney(fuelQuantity) * normaliseMoney(fuelRate)).toFixed(2) : "") : expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                readOnly={expenseType === "Fuel" && (!expenseEditId || fuelQuantity || fuelRate)}
                disabled={!canWrite}
              />
            </div>

            <div className="form-group">
              <label>Remarks</label>

              <input
                type="text"
                placeholder="Optional remarks"
                value={expenseRemarks}
                onChange={(event) => setExpenseRemarks(event.target.value)}
                disabled={!canWrite}
              />
            </div>

          </div>

          <div className="vehicle-action-buttons">
            <button
              className="save-btn"
              onClick={saveVehicleExpense}
              disabled={expenseLoading || !canWrite}
            >
              {!canWrite ? "Read-only access" : expenseLoading
                ? "⏳ Saving..."
                : expenseEditId
                ? "✏️ Update Expense"
                : "💾 Save Expense"}
            </button>

            {expenseEditId && (
              <button
                className="cancel-btn"
                onClick={clearExpenseForm}
              >
                ❌ Cancel
              </button>
            )}
          </div>

        </div>


        {/* ========================= */}
        {/* EXPENSE FILTERS */}
        {/* ========================= */}

        <div className="page-card vehicle-form-card">
          <div className="vehicle-card-header">
            <div>
              <h2>🔎 Vehicle Expense History</h2>
              <p>Vehicle, site, date aur type ke hisaab se filter karein</p>
            </div>

            <span className="record-count">
              {vehicleExpenseTable.count} Records
            </span>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Vehicle</label>
              <select
                value={historyVehicleFilter}
                onChange={(event) => setHistoryVehicleFilter(event.target.value)}
              >
                <option value="all">All Vehicles</option>
                {vehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.vehicleNumber || item.vehicleType || item.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Site</label>
              <select
                value={historySiteFilter}
                onChange={(event) => setHistorySiteFilter(event.target.value)}
              >
                <option value="all">All Sites</option>
                {expenseSites.map((siteName) => (
                  <option key={siteName} value={siteName}>
                    {siteName}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Expense Type</label>
              <select
                value={historyTypeFilter}
                onChange={(event) => setHistoryTypeFilter(event.target.value)}
              >
                <option value="all">All Expense Types</option>
                {expenseTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>From Date</label>
              <input
                type="date"
                value={historyFromDate}
                onChange={(event) => setHistoryFromDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label>To Date</label>
              <input
                type="date"
                value={historyToDate}
                onChange={(event) => setHistoryToDate(event.target.value)}
              />
            </div>
          </div>
        </div>


        <div className="table-card">
          <div className="table-header">
            <div>
              <h2>🧾 Vehicle Expense Records</h2>
              <p>New dated expenses are the preferred reporting source</p>
            </div>
          </div>

          <DataTableToolbar
            search={historySearch}
            onSearchChange={setHistorySearch}
            searchPlaceholder="Search vehicle, site, type or remarks..."
            table={vehicleExpenseTable}
          />

          <div className="table-responsive">
            <table className="vehicle-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Date</th>
                  <th>Vehicle</th>
                  <th>Site</th>
                  <th>Type</th>
                  <th>Fuel / Meter</th>
                  <th>Amount</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {vehicleExpenseTable.count === 0 ? (
                  <tr>
                    <td colSpan="9" className="no-record">
                      No Vehicle Expense Record Found
                    </td>
                  </tr>
                ) : (
                  vehicleExpenseTable.rows.map((item, index) => (
                    <tr key={item.id}>
                      <td>{vehicleExpenseTable.startIndex + index + 1}</td>
                      <td>{normaliseDate(item.date) || "-"}</td>
                      <td>{item.vehicleNumber || item.vehicleName || "-"}</td>
                      <td>{getSiteName(item) || "-"}</td>
                      <td>{item.expenseType || "-"}</td>
                      <td>{item.expenseType === "Fuel" ? `${item.quantity ?? item.fuelQuantity ?? "-"} L @ ₹${item.ratePerLitre ?? "-"} · ${item.meterReading ?? "-"}` : item.meterReading ?? "-"}</td>
                      <td className="fuel-amount">
                        ₹ {normaliseMoney(item.amount).toLocaleString("en-IN")}
                      </td>
                      <td>{item.remarks || "-"}</td>
                      <td className="action-cell">
                        {canWrite && <button
                          className="edit-btn"
                          onClick={() => editVehicleExpense(item)}
                        >
                          ✏️ Edit
                        </button>}
                        {canWrite && <button
                          className="delete-btn"
                          onClick={() => deleteVehicleExpense(item.id, item)}
                        >
                          🗑️ Delete
                        </button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataTablePagination table={vehicleExpenseTable} />
        </div>

        {fuelEfficiencyHistory.length > 0 && <div className="page-card vehicle-form-card"><div className="vehicle-card-header"><div><h2>⛽ Fuel Consumption Analytics</h2><p>{getEquipmentLabel(selectedHistoryVehicle)} — valid meter-to-meter comparisons only.</p></div></div><div className="table-responsive"><table className="vehicle-table"><thead><tr><th>Date</th><th>Meter</th><th>Distance / Hours</th><th>Fuel</th><th>Efficiency</th></tr></thead><tbody>{fuelEfficiencyHistory.map((entry) => <tr key={entry.id}><td>{entry.date}</td><td>{entry.meterReading}</td><td>{entry.distanceOrHours ?? "Insufficient reading"}</td><td>{entry.quantity} L</td><td>{entry.efficiency === null ? "Insufficient reading" : `${entry.efficiency} ${entry.meterKind === "hour-meter" ? "L/hour" : "km/L"}`}</td></tr>)}</tbody></table></div></div>}

        <div className="table-card"><div className="table-header"><div><h2>🛠️ Maintenance History</h2><p>Operational records; linked costs appear once in vehicle expenses.</p></div></div><div className="table-responsive"><table className="vehicle-table"><thead><tr><th>Date</th><th>Equipment</th><th>Site</th><th>Type</th><th>Status</th><th>Cost</th><th>Next Service</th></tr></thead><tbody>{maintenanceRecords.length === 0 ? <tr><td colSpan="7" className="no-record">No maintenance records found.</td></tr> : maintenanceRecords.slice().sort((a, b) => normaliseDate(b.serviceDate).localeCompare(normaliseDate(a.serviceDate))).map((record) => <tr key={record.id}><td>{normaliseDate(record.serviceDate) || "-"}</td><td>{record.vehicleNumber || record.vehicleName || "-"}</td><td>{getSiteName(record) || "-"}</td><td>{record.maintenanceType || "-"}</td><td>{record.status || "-"}</td><td>₹ {normaliseMoney(record.totalCost).toLocaleString("en-IN")}</td><td>{normaliseDate(record.nextServiceDate) || "-"}</td></tr>)}</tbody></table></div></div>

        <div className="table-card"><div className="table-header"><div><h2>📍 Assignment History</h2><p>Current site, assignment date, and release date are retained for each movement.</p></div></div><div className="table-responsive"><table className="vehicle-table"><thead><tr><th>Equipment</th><th>Site</th><th>Assigned</th><th>Released</th><th>Status</th></tr></thead><tbody>{vehicleAssignments.length === 0 ? <tr><td colSpan="5" className="no-record">Legacy equipment has no assignment history yet.</td></tr> : vehicleAssignments.slice().sort((a, b) => normaliseDate(b.assignmentDate).localeCompare(normaliseDate(a.assignmentDate))).map((assignment) => <tr key={assignment.id}><td>{assignment.vehicleNumber || assignment.vehicleName || "-"}</td><td>{assignment.site || "-"}</td><td>{normaliseDate(assignment.assignmentDate) || "-"}</td><td>{normaliseDate(assignment.releaseDate) || "Current"}</td><td>{assignment.assignmentStatus || "Assigned"}</td></tr>)}</tbody></table></div></div>


        {/* ========================= */}
        {/* SEARCH */}
        {/* ========================= */}

        <div className="page-card search-card">

          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search vehicle number, driver, site..."
            table={vehicleTable}
          >
            <label>
              <span>Site</span>
              <select value={vehicleSiteFilter} onChange={(event) => setVehicleSiteFilter(event.target.value)}>
                <option value="">All sites</option>
                {vehicleSites.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={vehicleStatusFilter} onChange={(event) => setVehicleStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                {vehicleStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </DataTableToolbar>

          <div className="search-result">
            Showing {vehicleTable.count} of {totalVehicles}
          </div>

        </div>


        {/* ========================= */}
        {/* SUMMARY */}
        {/* ========================= */}

        <div className="vehicle-summary-grid">

          <div className="summary-card">
            <span className="summary-icon">
              🚚
            </span>

            <div>
              <p>Total Vehicles</p>
              <h2>{totalVehicles}</h2>
            </div>
          </div>

          <div className="summary-card active-card">
            <span className="summary-icon">
              🟢
            </span>

            <div>
              <p>Active Vehicles</p>
              <h2>{activeVehicles}</h2>
            </div>
          </div>

          <div className="summary-card inactive-card">
            <span className="summary-icon">
              🔴
            </span>

            <div>
              <p>Inactive Vehicles</p>
              <h2>{inactiveVehicles}</h2>
            </div>
          </div>

          <div className="summary-card maintenance-card">
            <span className="summary-icon">
              🛠️
            </span>

            <div>
              <p>Maintenance</p>
              <h2>{maintenanceVehicles}</h2>
            </div>
          </div>

          <div className="summary-card"><span className="summary-icon">⚠️</span><div><p>Breakdown</p><h2>{equipmentSummary.breakdown}</h2></div></div>
          <div className="summary-card"><span className="summary-icon">⛽</span><div><p>Fuel Cost</p><h2>₹ {equipmentSummary.fuelCost.toLocaleString("en-IN")}</h2></div></div>
          <div className="summary-card"><span className="summary-icon">🛠️</span><div><p>Maintenance Cost</p><h2>₹ {equipmentSummary.maintenanceCost.toLocaleString("en-IN")}</h2></div></div>

        </div>


        {/* ========================= */}
        {/* TABLE */}
        {/* ========================= */}

        <div className="table-card">

          <div className="table-header">
            <div>
              <h2>📋 Vehicle Records</h2>
              <p>All registered vehicles</p>
            </div>

            <span className="record-count">
              {vehicleTable.count} Records
            </span>
          </div>

          <div className="table-responsive">

            <table className="vehicle-table">

              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Vehicle No.</th>
                  <th>Type</th>
                  <th>Driver</th>
                  <th>Mobile</th>
                  <th>Site</th>
                  <th>Fuel/Day</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {vehicleTable.count === 0 ? (

                  <tr>
                    <td
                      colSpan="9"
                      className="no-record"
                    >
                      🚚 No Vehicle Record Found
                    </td>
                  </tr>

                ) : (

                  vehicleTable.rows.map(
                    (item, index) => (

                      <tr key={item.id}>

                        <td>
                          {vehicleTable.startIndex + index + 1}
                        </td>

                        <td className="vehicle-number">
                          {item.vehicleNumber || "-"}
                        </td>

                        <td>
                          {item.vehicleType || "-"}
                        </td>

                        <td>
                          {item.driverName || "-"}
                        </td>

                        <td>
                          {item.mobile || "-"}
                        </td>

                        <td>
                          {item.site || "-"}
                        </td>

                        <td className="fuel-amount">
                          ₹ {Number(item.fuel || 0).toLocaleString("en-IN")}
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              item.status
                            )}`}
                          >
                            {item.status || "-"}
                          </span>
                        </td>

                        <td className="action-cell">

                          {canWrite && <button
                            className="edit-btn"
                            onClick={() =>
                              editVehicle(item)
                            }
                          >
                            ✏️ Edit
                          </button>}

                          {canWrite && <button
                            className="delete-btn"
                            onClick={() =>
                              deleteVehicle(
                                item.id,
                                item.vehicleNumber,
                                item
                              )
                            }
                          >
                            🗑️ Delete
                          </button>}

                        </td>

                      </tr>

                    )
                  )

                )}

              </tbody>

            </table>

          </div>

          <DataTablePagination table={vehicleTable} />

        </div>

      </div>

    </Layout>
  );
}

export default Vehicle;
