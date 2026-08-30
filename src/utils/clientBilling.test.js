import {
  buildClientReceiptKey,
  calculateRABill,
  canManageClientBilling,
  getClientBillingSummary,
  validateBillingProfile,
  validateClientReceipt,
  validateRABill,
  validateRetentionRelease,
} from "./clientBilling";

const profile = {
  siteId: "site-1", siteName: "River View", clientId: "client-1", clientName: "AP Client", agreementNumber: "AGR-1",
  contractValue: 100000, startDate: "2026-01-01", completionDate: "2026-12-31", billingType: "Running Account",
  gstApplicable: true, gstRate: 18, retentionPercent: 5, securityDeposit: 0, advanceReceived: 10000, advanceAdjusted: 2000, certifiedWorkValue: 20000,
};

const billForm = { billingPeriodFrom: "2026-08-01", billingPeriodTo: "2026-08-31", billDate: "2026-08-31", paymentDueDate: "2026-09-15", currentWorkValue: 10000, variationAmount: 1000, materialAdvanceRecovery: 500, advanceAdjustment: 1000, otherDeductions: 300, tdsPercent: 1 };

describe("client billing utilities", () => {
  it("calculates GST, retention, TDS, recoveries, and a rounded net RA receivable", () => {
    expect(calculateRABill(billForm, profile)).toMatchObject({
      grossWorkValue: 11000, gstAmount: 1980, retentionAmount: 550, tdsAmount: 110, recoveries: 1800, netBillAmount: 10520,
    });
  });

  it("prevents RA bills above contract balance or available client advance", () => {
    const valid = validateRABill({ form: billForm, profile });
    expect(valid).toMatchObject({ isValid: true });
    expect(valid.value.previousCertifiedAmount).toBe(20000);
    expect(validateRABill({ form: { ...billForm, currentWorkValue: 90000 }, profile })).toMatchObject({ isValid: false });
    expect(validateRABill({ form: { ...billForm, advanceAdjustment: 9001 }, profile })).toMatchObject({ isValid: false });
  });

  it("validates billing profile contract and dates", () => {
    expect(validateBillingProfile(profile)).toMatchObject({ isValid: true });
    expect(validateBillingProfile({ ...profile, completionDate: "2025-12-31" })).toMatchObject({ isValid: false });
  });

  it("rejects a payment due date earlier than the RA bill date", () => {
    expect(validateRABill({ form: { ...billForm, paymentDueDate: "2026-08-30" }, profile })).toMatchObject({ isValid: false });
  });
  it("handles partial/full receipts including TDS without overpayment or duplicate keys", () => {
    const bill = { id: "RA-2026-0001", raBillNumber: "RA-2026-0001", site: "River View", clientName: "AP Client", netBillAmount: 1000, receivedAmount: 100, pendingAmount: 900, linkedInvoiceId: "invoice-1" };
    const receipt = validateClientReceipt({ bill, receiptDate: "2026-09-10", amount: 700, tdsDeducted: 50, paymentMode: "Bank Transfer", reference: "UTR-1" });
    expect(receipt).toMatchObject({ isValid: true });
    expect(receipt.value).toMatchObject({ creditedAmount: 750, billUpdate: { receivedAmount: 850, pendingAmount: 150, status: "Partially Paid" } });
    expect(validateClientReceipt({ bill, receiptDate: "2026-09-10", amount: 901, tdsDeducted: 0, paymentMode: "UPI" })).toMatchObject({ isValid: false });
    expect(buildClientReceiptKey({ billId: bill.id, receiptDate: "2026-09-10", amount: 700, tdsDeducted: 50, reference: "UTR-1" })).toBe(receipt.value.receiptKey);
  });

  it("tracks retention release without exceeding the retained balance", () => {
    const bill = { id: "RA-1", raBillNumber: "RA-1", site: "River View", clientName: "AP Client", retentionReleased: 100, retentionBalance: 400 };
    expect(validateRetentionRelease({ bill, releaseDate: "2026-10-01", amount: 250, paymentMode: "Cheque" })).toMatchObject({ isValid: true, value: { billUpdate: { retentionReleased: 350, retentionBalance: 150 } } });
    expect(validateRetentionRelease({ bill, releaseDate: "2026-10-01", amount: 401, paymentMode: "Cheque" })).toMatchObject({ isValid: false });
  });

  it("uses invoices—including linked RA invoices—as the single income/receipt source", () => {
    const summary = getClientBillingSummary({
      today: "2026-10-01",
      invoices: [{ totalAmount: 1000, paidAmount: 400 }, { totalAmount: 500, paidAmount: 500, sourceType: "raBill", raBillId: "RA-1" }],
      raBills: [{ status: "Partially Paid", pendingAmount: 600, retentionBalance: 50, paymentDueDate: "2026-09-15" }],
    });
    expect(summary).toMatchObject({ totalClientBilling: 1500, totalReceived: 900, outstandingReceivable: 600, retentionReceivable: 50, overdueReceivable: 600 });
    expect(canManageClientBilling("manager")).toBe(true);
    expect(canManageClientBilling("viewer")).toBe(false);
  });
});