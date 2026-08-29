import {
  calculatePurchaseOrderTotals,
  canApprovePurchaseRequest,
  createGoodsReceiptKey,
  createInventoryStockInFromGoodsReceipt,
  findInventoryItemForPurchaseLine,
  getPurchaseOrderReceiptStatus,
  getProcurementSummary,
  getVendorPayableSummary,
  validateGoodsReceipt,
  validatePurchaseOrder,
  validatePurchaseRequest,
} from "./procurement";

describe("procurement utilities", () => {
  const purchaseOrder = {
    id: "po-1",
    site: "River View",
    items: [{
      lineId: "cement",
      materialId: "material-cement",
      materialName: "Cement",
      quantity: 10,
      unit: "Bag",
      rate: 100,
      taxPercent: 18,
      discount: 100,
      lineGrandTotal: 1062,
      receivedQuantity: 3,
    }],
  };

  it("calculates PO totals without floating point leakage", () => {
    expect(calculatePurchaseOrderTotals([{ quantity: 10, rate: 100, taxPercent: 18, discount: 100 }]))
      .toMatchObject({ subtotal: 1000, discount: 100, tax: 162, grandTotal: 1062 });
  });

  it("blocks invalid purchase-order monetary inputs", () => {
    expect(validatePurchaseOrder({ ...purchaseOrder, vendorId: "vendor-1", vendorName: "ABC", poDate: "2026-08-30", expectedDeliveryDate: "2026-09-01", paidAmount: 2000 })).toMatchObject({ isValid: false });
  });

  it("only permits procurement roles to approve purchase requests", () => {
    expect(canApprovePurchaseRequest("admin")).toBe(true);
    expect(canApprovePurchaseRequest("manager")).toBe(true);
    expect(canApprovePurchaseRequest("viewer")).toBe(false);
    expect(canApprovePurchaseRequest("supervisor")).toBe(false);
  });

  it("validates a partial GRN and rejects over-receipt", () => {
    expect(validateGoodsReceipt({ purchaseOrder, lineId: "cement", receiptDate: "2026-09-01", receivedQuantity: 4, acceptedQuantity: 3, rejectedQuantity: 1 })).toMatchObject({ isValid: true, value: { updatedReceivedQuantity: 7 } });
    expect(validateGoodsReceipt({ purchaseOrder, lineId: "cement", receiptDate: "2026-09-01", receivedQuantity: 8, acceptedQuantity: 8, rejectedQuantity: 0 })).toMatchObject({ isValid: false });
  });

  it("derives partial and fully received PO states", () => {
    expect(getPurchaseOrderReceiptStatus(purchaseOrder.items)).toBe("partially received");
    expect(getPurchaseOrderReceiptStatus([{ quantity: 2, receivedQuantity: 2 }])).toBe("received");
  });

  it("creates only one traceable inventory Stock-In payload per GRN", () => {
    const movement = createInventoryStockInFromGoodsReceipt({
      goodsReceiptId: "GRN-2026-0001",
      purchaseOrder,
      vendorId: "vendor-1",
      siteId: "site-1",
      receiptDate: "2026-09-01",
      inventoryItem: { id: "river-view__cement__bag" },
      line: { ...purchaseOrder.items[0], acceptedQuantity: 3 },
    });
    expect(movement).toMatchObject({ transactionType: "in", quantity: 3, goodsReceiptId: "GRN-2026-0001", purchaseOrderId: "po-1" });
  });

  it("uses a stable GRN key to prevent duplicate processing of the same receipt", () => {
    const receipt = { purchaseOrderId: "po-1", lineId: "cement", challanNumber: "CH-22", receiptDate: "2026-09-01", receivedQuantity: 4, acceptedQuantity: 3, rejectedQuantity: 1 };
    expect(createGoodsReceiptKey(receipt)).toBe(createGoodsReceiptKey(receipt));
    expect(createGoodsReceiptKey(receipt)).not.toBe(createGoodsReceiptKey({ ...receipt, challanNumber: "CH-23" }));
  });

  it("matches inventory canonically and keeps DPR/material usage out of stock math", () => {
    expect(findInventoryItemForPurchaseLine([
      { id: "river-view__cement__bag", site: "river   view", materialName: "Cement", unit: "Bag" },
    ], purchaseOrder, purchaseOrder.items[0])).toMatchObject({ id: "river-view__cement__bag" });
  });

  it("calculates vendor outstanding without negative values", () => {
    expect(getVendorPayableSummary({ id: "vendor-1", openingBalance: 100 }, [
      { vendorId: "vendor-1", grandTotal: 1000, paidAmount: 300, status: "Issued" },
      { vendorId: "vendor-1", grandTotal: 500, paidAmount: 1000, status: "Received" },
    ])).toMatchObject({ totalPurchases: 1500, totalPaid: 1300, outstandingAmount: 300 });
  });

  it("rejects duplicate/invalid request line values", () => {
    expect(validatePurchaseRequest({ date: "2026-09-01", site: "River View", requestedBy: "Site Engineer", requiredDate: "2026-09-02", priority: "High", items: [
      { materialName: "Cement", quantity: 2, unit: "Bag" },
      { materialName: "cement", quantity: 2, unit: "Bag" },
      { materialName: "Sand", quantity: -1, unit: "Ton" },
    ] })).toMatchObject({ isValid: true, value: { items: [{ materialName: "Cement" }] } });
  });

  it("handles empty and legacy procurement records safely", () => {
    expect(getProcurementSummary([null, {}], [null, { status: "Cancelled", grandTotal: "bad" }], [null]))
      .toMatchObject({ pendingRequests: 0, openPurchaseOrders: 0, pendingDeliveries: 0, purchaseValue: 0, vendorOutstanding: 0, goodsReceiptCount: 0 });
    expect(getVendorPayableSummary({}, [null])).toMatchObject({ totalPurchases: 0, totalPaid: 0, outstandingAmount: 0 });
  });
});
