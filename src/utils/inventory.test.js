import {
  calculateInventoryItemSummary,
  canManageInventory,
  canReadInventoryAvailability,
  getDprMaterialReferencesForInventoryItem,
  summariseInventory,
  validateInventoryItem,
  validateInventoryTransaction,
} from "./inventory";

const item = {
  id: "cement-river-view",
  materialName: "Cement",
  site: "River View",
  unit: "Bag",
  openingStock: 10,
  reorderLevel: 5,
};

describe("inventory stock calculations", () => {
  const transactions = [
    { id: "in-1", inventoryItemId: item.id, transactionType: "in", quantity: 20 },
    { id: "out-1", inventoryItemId: item.id, transactionType: "out", quantity: 8 },
    { id: "adjust-1", inventoryItemId: item.id, transactionType: "adjustment", adjustmentDirection: "decrease", quantity: 2 },
    { id: "adjust-2", inventoryItemId: item.id, transactionType: "adjustment", adjustmentDirection: "increase", quantity: 1 },
  ];

  it("uses opening + received + adjustments - issued without duplicate transactions", () => {
    const summary = calculateInventoryItemSummary(item, [...transactions, transactions[0]]);

    expect(summary).toMatchObject({
      openingStock: 10,
      received: 20,
      issued: 8,
      adjustmentIncrease: 1,
      adjustmentDecrease: 2,
      currentStock: 21,
      status: "available",
    });
  });

  it("identifies low and out-of-stock items", () => {
    expect(
      calculateInventoryItemSummary(item, [
        { id: "out-low", inventoryItemId: item.id, transactionType: "out", quantity: 6 },
      ]).status
    ).toBe("low");
    expect(
      calculateInventoryItemSummary(item, [
        { id: "out-all", inventoryItemId: item.id, transactionType: "out", quantity: 10 },
      ]).status
    ).toBe("out");
  });

  it("handles malformed legacy quantities safely without showing negative availability", () => {
    const summary = calculateInventoryItemSummary(
      { ...item, openingStock: "invalid", reorderLevel: "invalid" },
      [{ inventoryItemId: item.id, transactionType: "out", quantity: "invalid" }]
    );

    expect(summary).toMatchObject({ currentStock: 0, status: "out", hasLegacyDeficit: false });
  });

  it("blocks stock out and decrease adjustments above available stock", () => {
    expect(
      validateInventoryTransaction(
        { inventoryItemId: item.id, transactionType: "out", quantity: "11", date: "2026-08-30" },
        item,
        10
      )
    ).toMatchObject({ isValid: false });
    expect(
      validateInventoryTransaction(
        {
          inventoryItemId: item.id,
          transactionType: "adjustment",
          adjustmentDirection: "decrease",
          quantity: "2",
          reason: "Damaged bags",
          date: "2026-08-30",
        },
        item,
        10
      )
    ).toMatchObject({ isValid: true, delta: -2 });
  });
});

describe("inventory validation, DPR safety, and access", () => {
  it("requires non-negative opening and reorder levels", () => {
    expect(
      validateInventoryItem({
        materialName: "Cement",
        site: "River View",
        unit: "Bag",
        openingStock: "0",
        reorderLevel: "5",
      })
    ).toMatchObject({ isValid: true });
    expect(validateInventoryItem({ ...item, openingStock: "-1" })).toMatchObject({ isValid: false });
  });

  it("keeps DPR material mentions informational and never changes stock", () => {
    const reports = [
      { id: "dpr-1", site: "river view", materialsUsed: "Cement" },
      { id: "dpr-1", site: "river view", materialsUsed: "Cement" },
    ];
    const before = calculateInventoryItemSummary(item, []);
    const references = getDprMaterialReferencesForInventoryItem(reports, item);
    const inventory = summariseInventory([item], [], reports);

    expect(references).toHaveLength(1);
    expect(inventory.rows[0].dprReferenceCount).toBe(1);
    expect(inventory.rows[0].currentStock).toBe(before.currentStock);
  });

  it("allows only admin and manager inventory writes while field roles can read availability", () => {
    expect(canManageInventory("admin")).toBe(true);
    expect(canManageInventory("manager")).toBe(true);
    expect(canManageInventory("viewer")).toBe(false);
    expect(canManageInventory("engineer")).toBe(false);
    expect(canReadInventoryAvailability("supervisor")).toBe(true);
    expect(canReadInventoryAvailability("viewer")).toBe(true);
  });
});
