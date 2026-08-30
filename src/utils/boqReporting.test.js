import {
  buildBoqAlerts,
  calculateDimensionalQuantity,
  canManageBoq,
  canReadBoq,
  filterBoqRecords,
  getBoqItemProgressRows,
  getSiteBoqSummary,
  validateBoqBillingLines,
  validateBoqItem,
  validateMeasurement,
  validateVariation,
} from "./boqReporting";

const item = { id: "boq-1", site: "River View", itemNumber: "1.1", itemCode: "CW-01", description: "Concrete work", unit: "Cum", plannedQuantity: 100, rate: 2500 };

describe("BOQ reporting utilities", () => {
  test("derives BOQ amount from planned quantity and rate", () => {
    expect(validateBoqItem({ ...item, siteId: "site-1", status: "Draft" })).toMatchObject({ isValid: true, value: { amount: 250000 } });
  });

  test("handles dimensional and direct measurement safely", () => {
    expect(calculateDimensionalQuantity({ measurementType: "Area (L × W)", length: 12.5, width: 4 })).toBe(50);
    expect(calculateDimensionalQuantity({ measurementType: "Volume (L × W × H)", length: 10, width: 2, height: 0.5 })).toBe(10);
    expect(calculateDimensionalQuantity({ measurementType: "Direct quantity", quantity: -1 })).toBeNull();
  });

  test("computes measured, certified, billed, balance and zero-safe progress", () => {
    const rows = getBoqItemProgressRows({
      items: [item, { ...item, id: "zero", itemNumber: "2", plannedQuantity: 0 }],
      measurements: [
        { id: "m-1", boqItemId: "boq-1", quantity: 30, status: "Pending" },
        { id: "m-2", boqItemId: "boq-1", quantity: 20, status: "Certified" },
      ],
      variations: [{ id: "v-1", boqItemId: "boq-1", quantityChange: 10, variationValue: 25000, status: "Approved" }],
      raBills: [{ id: "ra-1", status: "Certified", boqLineItems: [{ boqItemId: "boq-1", currentBilledQuantity: 15 }] }],
    });
    expect(rows[0]).toMatchObject({ authorizedQuantity: 110, measuredQuantity: 50, certifiedQuantity: 20, billedQuantity: 15, balanceQuantity: 60, progressPercent: expect.closeTo(45.455, 2) });
    expect(rows[1].progressPercent).toBe(0);
  });

  test("prevents over-measurement before a variation is approved", () => {
    const progress = { authorizedQuantity: 100, measuredQuantity: 95 };
    expect(validateMeasurement({ form: { siteId: "site-1", site: "River View", boqItemId: "boq-1", date: "2026-08-30", location: "Block A", measurementType: "Direct quantity", quantity: 6 }, item, progress })).toMatchObject({ isValid: false });
  });

  test("uses only approved variations in site value and quantity", () => {
    const summary = getSiteBoqSummary({
      site: "River View", items: [item], measurements: [], raBills: [],
      variations: [
        { id: "approved", site: "River View", boqItemId: "boq-1", status: "Approved", quantityChange: 5, variationValue: 12500 },
        { id: "draft", site: "River View", boqItemId: "boq-1", status: "Draft", quantityChange: 50, variationValue: 125000 },
      ],
    });
    expect(summary).toMatchObject({ originalBoqValue: 250000, approvedVariationValue: 12500, revisedBoqValue: 262500, pendingVariationCount: 0 });
    expect(summary.rows[0].authorizedQuantity).toBe(105);
  });

  test("prevents BOQ-linked RA bill lines over the authorized quantity", () => {
    const progressRows = [{ ...item, itemId: "boq-1", authorizedQuantity: 100, billedQuantity: 90, rate: 2500 }];
    expect(validateBoqBillingLines({ lines: [{ boqItemId: "boq-1", currentBilledQuantity: 11 }], progressRows })).toMatchObject({ isValid: false });
    expect(validateBoqBillingLines({ lines: [{ boqItemId: "boq-1", currentBilledQuantity: 10 }], progressRows })).toMatchObject({ isValid: true, value: [expect.objectContaining({ currentAmount: 25000, cumulativeBilledQuantity: 100 })] });
  });

  test("keeps legacy DPR data outside the certified measurement ledger", () => {
    const summary = getSiteBoqSummary({
      site: "River View", items: [item],
      measurements: [{ id: "m-1", boqItemId: "boq-1", quantity: 10, status: "Certified" }],
      variations: [], raBills: [], dailyProgressReports: [{ id: "legacy-dpr", site: "River View", quantity: 999 }],
    });
    expect(summary.rows[0].measuredQuantity).toBe(10);
  });

  test("allows a controlled quantity reduction but rejects reducing an item to zero", () => {
    expect(validateVariation({ form: { siteId: "site", site: "River View", variationReference: "V-1", quantityChange: -10, status: "Submitted" }, item, progress: { authorizedQuantity: 100 } })).toMatchObject({ isValid: true, value: { quantityChange: -10, variationValue: -25000 } });
    expect(validateVariation({ form: { siteId: "site", site: "River View", variationReference: "V-2", quantityChange: -100 }, item, progress: { authorizedQuantity: 100 } })).toMatchObject({ isValid: false });
  });

  test("deduplicates records, filters measurement dates, and scopes site summaries", () => {
    const filtered = filterBoqRecords({
      items: [item, { ...item, id: "boq-2", site: "Hill Site", itemNumber: "2" }],
      measurements: [{ id: "m-1", site: "River View", boqItemId: "boq-1", date: "2026-08-10" }, { id: "m-1", site: "River View", boqItemId: "boq-1", date: "2026-08-10" }, { id: "m-2", site: "Hill Site", boqItemId: "boq-2", date: "2026-09-01" }, null],
      variations: [], filters: { site: "River View", fromDate: "2026-08-01", toDate: "2026-08-31" },
    });
    expect(filtered.items).toHaveLength(1);
    expect(filtered.measurements).toHaveLength(1);
  });

  test("builds one safe alert per BOQ control condition", () => {
    const alerts = buildBoqAlerts({
      items: [item],
      measurements: [{ id: "pending", boqItemId: "boq-1", quantity: 95, status: "Pending" }],
      variations: [{ id: "variation", site: "River View", status: "Submitted", variationReference: "V-3" }],
      raBills: [],
    });
    expect(alerts.map((alert) => alert.id)).toEqual(expect.arrayContaining(["boq-nearing-boq-1", "boq-certification-boq-1", "boq-variation-variation"]));
  });
  test("keeps commercial BOQ access out of field-only roles", () => {
    expect(canManageBoq("admin")).toBe(true);
    expect(canManageBoq("manager")).toBe(true);
    expect(canManageBoq("viewer")).toBe(false);
    expect(canManageBoq("supervisor")).toBe(false);
    expect(canReadBoq("viewer")).toBe(true);
    expect(canReadBoq("engineer")).toBe(false);
  });
});