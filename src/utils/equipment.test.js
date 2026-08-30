import {
  calculateFuelTotal,
  calculateMaintenanceTotal,
  createAssignmentPayload,
  getFuelEfficiencyHistory,
  isEquipmentManager,
  summariseEquipment,
  validateFuelEntry,
  validateMaintenanceRecord,
} from "./equipment";

describe("equipment and fuel utilities", () => {
  test("derives fuel total and rejects invalid fuel values", () => {
    expect(calculateFuelTotal("10.5", "90")).toBe(945);
    expect(validateFuelEntry({ vehicleId: "v1", site: "North", date: "2026-08-30", fuelType: "Diesel", quantity: 10, rate: 90 }).value.totalAmount).toBe(900);
    expect(validateFuelEntry({ vehicleId: "v1", site: "North", date: "2026-08-30", fuelType: "Diesel", quantity: -1, rate: 90 }).isValid).toBe(false);
  });

  test("calculates maintenance totals and validates safe records", () => {
    expect(calculateMaintenanceTotal({ labourCost: 400, partsCost: 600, otherCost: 25 })).toBe(1025);
    expect(validateMaintenanceRecord({ vehicleId: "v1", site: "North", serviceDate: "2026-08-30", maintenanceType: "Service", status: "Completed", labourCost: 1, partsCost: 2 }).value.totalCost).toBe(3);
    expect(validateMaintenanceRecord({ vehicleId: "v1", site: "North", serviceDate: "bad", maintenanceType: "Service", status: "Completed" }).isValid).toBe(false);
  });

  test("calculates only valid fuel efficiency readings", () => {
    const history = getFuelEfficiencyHistory([
      { id: "f2", expenseType: "Fuel", date: "2026-08-02", meterReading: 150, quantity: 10 },
      { id: "f1", expenseType: "Fuel", date: "2026-08-01", meterReading: 100, quantity: 8 },
    ], { meterType: "odometer" });
    expect(history[0].efficiency).toBeNull();
    expect(history[1].efficiency).toBe(5);
  });

  test("summarises statuses/costs without reading legacy master fuel twice", () => {
    expect(summariseEquipment({
      vehicles: [{ status: "Active", fuel: 999 }, { status: "Breakdown" }, { status: "Idle" }],
      vehicleExpenses: [{ expenseType: "Fuel", amount: 100 }, { expenseType: "Maintenance", amount: 50 }],
    })).toEqual(expect.objectContaining({ total: 3, active: 1, breakdown: 1, idle: 1, fuelCost: 100, maintenanceCost: 50 }));
  });

  test("does not fabricate hour-meter efficiency or count master fuel as a ledger cost", () => {
    const history = getFuelEfficiencyHistory([
      { id: "h1", expenseType: "Fuel", date: "2026-08-01", meterReading: 20, quantity: 5, meterType: "hour-meter" },
      { id: "h2", expenseType: "Fuel", date: "2026-08-02", meterReading: 20, quantity: 6, meterType: "hour-meter" },
      { id: "h3", expenseType: "Fuel", date: "2026-08-03", meterReading: 24, quantity: 8, meterType: "hour-meter" },
    ], { meterType: "hour-meter" });

    expect(history.map((entry) => entry.efficiency)).toEqual([null, null, 2]);
    expect(summariseEquipment({
      vehicles: [{ status: "Active", fuel: 5000 }],
      vehicleExpenses: [{ expenseType: "Maintenance", amount: 125 }],
    })).toEqual(expect.objectContaining({ fuelCost: 0, maintenanceCost: 125 }));
  });
  test("creates assignments only for manager roles with safe payload data", () => {
    expect(isEquipmentManager("manager")).toBe(true);
    expect(isEquipmentManager("viewer")).toBe(false);
    expect(createAssignmentPayload({ vehicle: { id: "v1", vehicleNumber: "UP 32" }, site: "North", assignmentDate: "2026-08-30", createdBy: "manager-1" }).isValid).toBe(true);
  });
});
