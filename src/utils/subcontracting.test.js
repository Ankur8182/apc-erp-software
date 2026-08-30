import {
  buildWorkOrderNumber,
  canManageSubcontracting,
  getSubcontractingSummary,
  isContractorExpense,
  validateContractorBill,
  validateContractorPayment,
  validateWorkOrder,
  validateWorkOrderProgress,
} from "./subcontracting";

const itemRateOrder = {
  id: "wo-1", workOrderNumber: "WO-2026-0001", vendorId: "vendor-1", vendorName: "Build Co", site: "River View",
  workTrade: "Civil", workDescription: "Block work", startDate: "2026-08-01", expectedCompletionDate: "2026-09-01",
  rateType: "Item Rate", quantity: 10, unit: "sqm", rate: 100, contractValue: 1000, retentionPercent: 10,
  advanceAmount: 200, advanceRecovered: 0, certifiedAmount: 600, status: "Active",
};

describe("subcontracting utilities", () => {
  it("normalises a valid item-rate work order and rejects unsafe commercial input", () => {
    const valid = validateWorkOrder({ ...itemRateOrder, retentionPercent: "10", advanceAmount: "100" });
    expect(valid).toMatchObject({ isValid: true });
    expect(valid.value.contractValue).toBe(1000);
    expect(validateWorkOrder({ ...itemRateOrder, retentionPercent: 101 })).toMatchObject({ isValid: false });
    expect(validateWorkOrder({ ...itemRateOrder, expectedCompletionDate: "2026-07-31" })).toMatchObject({ isValid: false });
  });

  it("caps certified item-rate progress by quantity, percentage, and contract value", () => {
    const progress = validateWorkOrderProgress({ workOrder: itemRateOrder, progressRecords: [], date: "2026-08-20", site: "river  view", quantity: 5, unit: "sqm", progressPercent: 50, remarks: "Half complete" });
    expect(progress).toMatchObject({ isValid: true });
    expect(progress.value.certifiedAmount).toBe(500);
    expect(validateWorkOrderProgress({
      workOrder: itemRateOrder, progressRecords: [{ workOrderId: "wo-1", quantity: 8, progressPercent: 80, certifiedAmount: 800 }],
      date: "2026-08-21", site: "River View", quantity: 3, unit: "sqm", progressPercent: 20,
    })).toMatchObject({ isValid: false });
  });

  it("keeps bill, retention, advance recovery, and payment limits consistent", () => {
    const bill = validateContractorBill({ workOrder: itemRateOrder, contractorBills: [], billDate: "2026-08-22", currentBillAmount: 500, advanceRecovery: 100, deductions: 20 });
    expect(bill).toMatchObject({ isValid: true });
    expect(bill.value).toMatchObject({ retentionAmount: 50, payableAmount: 330, pendingAmount: 330 });
    expect(validateContractorBill({ workOrder: itemRateOrder, contractorBills: [], billDate: "2026-08-22", currentBillAmount: 700 })).toMatchObject({ isValid: false });
    const payment = validateContractorPayment({ bill: { id: "bill-1", ...bill.value }, paymentDate: "2026-08-23", amount: 330, paymentMode: "UPI" });
    expect(payment).toMatchObject({ isValid: true });
    expect(payment.value.billUpdate).toMatchObject({ paidAmount: 330, pendingAmount: 0, paymentStatus: "Paid" });
    expect(validateContractorPayment({ bill: { id: "bill-1", ...bill.value }, paymentDate: "2026-08-23", amount: 331, paymentMode: "UPI" })).toMatchObject({ isValid: false });
  });

  it("summarises malformed data safely without treating progress or payments as expenses", () => {
    const summary = getSubcontractingSummary([itemRateOrder, { id: "wo-2", status: "Active", contractValue: "bad", advanceAmount: 100, advanceRecovered: 20, expectedCompletionDate: "2026-08-01" }, null], [{ pendingAmount: 200, retentionBalance: 50 }, { pendingAmount: "bad" }, null], "2026-08-30");
    expect(summary).toMatchObject({ activeWorkOrders: 2, totalContractValue: 1000, pendingPayable: 200, retentionBalance: 50, overdueWorkOrders: 1, advanceRecoveryPending: 280 });
    expect(isContractorExpense({ sourceType: "contractorBill", contractorBillId: "bill-1" })).toBe(true);
    expect(isContractorExpense({ sourceType: "contractorPayment", contractorBillId: "bill-1" })).toBe(false);
  });

  it("uses safe numbering and permits subcontracting writes only for admin/manager", () => {
    expect(buildWorkOrderNumber([{ workOrderNumber: "WO-2026-0001" }], new Date("2026-08-30"))).toBe("WO-2026-0002");
    expect(canManageSubcontracting("manager")).toBe(true);
    expect(canManageSubcontracting("viewer")).toBe(false);
  });
});