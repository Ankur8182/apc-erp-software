import { getSiteName, normaliseDate, normaliseMoney } from "./financialReporting";

export const EQUIPMENT_STATUSES = ["Active", "Idle", "Under Maintenance", "Breakdown", "Off Hire"];
export const OWNERSHIP_TYPES = ["Company Owned", "Rented", "Hired"];
export const FUEL_TYPES = ["Diesel", "Petrol", "CNG", "Electric", "Other"];
export const MAINTENANCE_STATUSES = ["Open", "In Progress", "Completed"];

const cleanText = (value) => String(value || "").trim();
const cleanKey = (value) => cleanText(value).toLowerCase();

export const isEquipmentManager = (role) => ["admin", "manager"].includes(cleanKey(role));

export const getEquipmentLabel = (vehicle = {}) => cleanText(
  vehicle.vehicleNumber || vehicle.registrationNumber || vehicle.name || vehicle.equipmentName || vehicle.vehicleType
);

export const getMeterKind = (vehicle = {}, value = "") => {
  const explicit = cleanKey(value || vehicle.meterType);
  if (["odometer", "hour-meter"].includes(explicit)) return explicit;
  return cleanKey(vehicle.category || vehicle.vehicleType).includes("equipment") ? "hour-meter" : "odometer";
};

export const normaliseEquipmentStatus = (value) => {
  const status = cleanKey(value).replace(/\s+/g, " ");
  const aliases = {
    active: "Active", idle: "Idle", maintenance: "Under Maintenance", "under maintenance": "Under Maintenance",
    breakdown: "Breakdown", "off hire": "Off Hire", inactive: "Idle",
  };
  return aliases[status] || "";
};

export const calculateFuelTotal = (quantity, rate) => {
  const litres = normaliseMoney(quantity);
  const ratePerLitre = normaliseMoney(rate);
  return litres * ratePerLitre;
};

export const validateFuelEntry = ({ vehicleId, site, date, fuelType, quantity, rate, meterReading } = {}) => {
  const safeDate = normaliseDate(date);
  const litres = normaliseMoney(quantity);
  const ratePerLitre = normaliseMoney(rate);
  const reading = meterReading === "" || meterReading === undefined ? null : Number(meterReading);
  if (!cleanText(vehicleId) || !cleanText(site) || !safeDate || !FUEL_TYPES.includes(cleanText(fuelType))) {
    return { isValid: false, error: "Vehicle, site, date and fuel type are required." };
  }
  if (litres <= 0 || ratePerLitre <= 0) return { isValid: false, error: "Fuel quantity and rate must be greater than zero." };
  if (reading !== null && (!Number.isFinite(reading) || reading < 0)) {
    return { isValid: false, error: "Meter reading must be a non-negative number." };
  }
  return { isValid: true, value: { date: safeDate, quantity: litres, ratePerLitre, totalAmount: calculateFuelTotal(litres, ratePerLitre), meterReading: reading } };
};

export const calculateMaintenanceTotal = ({ labourCost = 0, partsCost = 0, otherCost = 0 } = {}) =>
  // Keep the same IEEE-754 addition as the rule expression. Formatting is
  // deferred to the UI so a valid decimal breakdown is never rejected due to
  // a client-side rounding mismatch.
  normaliseMoney(labourCost) + normaliseMoney(partsCost) + normaliseMoney(otherCost);

export const validateMaintenanceRecord = ({ vehicleId, site, serviceDate, maintenanceType, status, labourCost, partsCost, otherCost, meterReading } = {}) => {
  const safeDate = normaliseDate(serviceDate);
  const reading = meterReading === "" || meterReading === undefined ? null : Number(meterReading);
  if (!cleanText(vehicleId) || !cleanText(site) || !safeDate || !cleanText(maintenanceType) || !MAINTENANCE_STATUSES.includes(cleanText(status))) {
    return { isValid: false, error: "Vehicle, site, service date, maintenance type and status are required." };
  }
  if (reading !== null && (!Number.isFinite(reading) || reading < 0)) return { isValid: false, error: "Meter reading must be non-negative." };
  return {
    isValid: true,
    value: {
      serviceDate: safeDate,
      labourCost: normaliseMoney(labourCost),
      partsCost: normaliseMoney(partsCost),
      otherCost: normaliseMoney(otherCost),
      totalCost: calculateMaintenanceTotal({ labourCost, partsCost, otherCost }),
      meterReading: reading,
    },
  };
};

export const getFuelEfficiencyHistory = (entries = [], vehicle = {}) => {
  const kind = getMeterKind(vehicle);
  const ordered = (Array.isArray(entries) ? entries : [])
    .filter((entry) => entry && cleanKey(entry.expenseType) === "fuel" && Number.isFinite(Number(entry.meterReading)) && Number(entry.meterReading) >= 0)
    .sort((left, right) => normaliseDate(left.date).localeCompare(normaliseDate(right.date)));
  return ordered.map((entry, index) => {
    const previous = ordered[index - 1];
    const quantity = normaliseMoney(entry.quantity ?? entry.fuelQuantity);
    const delta = previous ? Number(entry.meterReading) - Number(previous.meterReading) : null;
    const valid = previous && delta > 0 && quantity > 0;
    return {
      id: entry.id,
      date: normaliseDate(entry.date),
      meterKind: getMeterKind(vehicle, entry.meterType) || kind,
      meterReading: Number(entry.meterReading),
      distanceOrHours: valid ? delta : null,
      quantity,
      // Vehicles: km/litre. Equipment: litres/hour. No previous valid meter
      // reading means no fabricated efficiency.
      efficiency: valid ? Number(((getMeterKind(vehicle, entry.meterType) === "hour-meter" ? quantity / delta : delta / quantity)).toFixed(2)) : null,
    };
  });
};

export const summariseEquipment = ({ vehicles = [], vehicleExpenses = [] } = {}) => {
  const summary = { total: 0, active: 0, idle: 0, underMaintenance: 0, breakdown: 0, offHire: 0, fuelCost: 0, maintenanceCost: 0 };
  (Array.isArray(vehicles) ? vehicles : []).forEach((vehicle) => {
    if (!vehicle || typeof vehicle !== "object") return;
    summary.total += 1;
    const status = normaliseEquipmentStatus(vehicle.status);
    if (status === "Active") summary.active += 1;
    if (status === "Idle") summary.idle += 1;
    if (status === "Under Maintenance") summary.underMaintenance += 1;
    if (status === "Breakdown") summary.breakdown += 1;
    if (status === "Off Hire") summary.offHire += 1;
  });
  (Array.isArray(vehicleExpenses) ? vehicleExpenses : []).forEach((expense) => {
    const amount = normaliseMoney(expense?.amount ?? expense?.totalAmount);
    const type = cleanKey(expense?.expenseType);
    if (type === "fuel") summary.fuelCost += amount;
    if (["maintenance", "repair"].includes(type)) summary.maintenanceCost += amount;
  });
  return summary;
};

export const createAssignmentPayload = ({ vehicle, site, assignmentDate, createdBy = "" } = {}) => {
  const date = normaliseDate(assignmentDate);
  const siteName = cleanText(site);
  if (!vehicle?.id || !siteName || !date || !cleanText(createdBy)) return { isValid: false, error: "Vehicle, site, assignment date and signed-in user are required." };
  return { isValid: true, value: { vehicleId: vehicle.id, vehicleNumber: getEquipmentLabel(vehicle), vehicleName: cleanText(vehicle.name || vehicle.equipmentName || vehicle.vehicleType), site: siteName, assignmentDate: date, releaseDate: "", assignmentStatus: "Assigned", createdBy: cleanText(createdBy) } };
};

export const isVehicleExpenseFinancialSource = (expense = {}) =>
  cleanKey(expense.expenseType) === "fuel" || ["maintenance", "repair"].includes(cleanKey(expense.expenseType));

export const getLegacyVehicleSite = (vehicle = {}) => getSiteName(vehicle);
