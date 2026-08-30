import {
  generateNotifications,
  getUnreadNotificationCount,
  loadReadNotificationIds,
  saveReadNotificationIds,
} from "./notifications";

const TODAY = "2026-08-29";

describe("notification generation", () => {
  const createCoreData = () => ({
    invoices: [
      { id: "invoice-1", invoiceNo: "INV-1", totalAmount: 10000, paidAmount: 7000 },
    ],
    materials: [
      {
        id: "material-1",
        materialName: "Cement",
        currentStock: 4,
        reorderLevel: 10,
      },
      { id: "material-purchase", materialName: "Sand", quantity: 1 },
    ],
    sites: [{ id: "site-1", siteName: "River View" }],
    attendance: [
      { id: "attendance-1", employeeName: "Ravi", date: TODAY, status: "Absent" },
    ],
    salaries: [
      { id: "salary-1", employeeName: "Ravi", status: "Pending", pendingAmount: 1200 },
    ],
    vehicles: [{ id: "vehicle-1", vehicleNumber: "UP 01 AB 1234", status: "Maintenance" }],
    dailyProgressReports: [],
  });

  it("derives pending payments, low stock, missing DPR, attendance, salary and maintenance alerts", () => {
    const alerts = generateNotifications({
      role: "admin",
      today: TODAY,
      ...createCoreData(),
    });

    expect(alerts.map((alert) => alert.title)).toEqual(
      expect.arrayContaining([
        "Payment pending",
        "Low material stock",
        "Today’s DPR is pending",
        "Attendance needs attention",
        "Salary payment pending",
        "Vehicle maintenance reminder",
      ])
    );
    expect(alerts.some((alert) => alert.message.includes("Sand"))).toBe(false);
  });

  it("uses canonical site matching and deduplicated DPRs before flagging missing site reports", () => {
    const alerts = generateNotifications({
      role: "manager",
      today: TODAY,
      sites: [{ id: "site-1", siteName: "River   View" }],
      dailyProgressReports: [
        { id: "dpr-1", site: "river view", date: TODAY, workActivity: "Slab" },
        { id: "dpr-1", site: "river view", date: TODAY, workActivity: "Slab" },
      ],
    });

    expect(alerts.find((alert) => alert.title === "Today’s DPR is pending")).toBeUndefined();
  });

  it("adds one missing-attendance alert per site and flags unusually high recorded overtime", () => {
    const alerts = generateNotifications({
      role: "manager",
      today: TODAY,
      labours: [
        { id: "labour-1", name: "Amit", site: "River View", active: true },
        { id: "labour-2", name: "Ravi", site: "River View", active: true },
      ],
      attendance: [{ labourId: "labour-1", employeeName: "Amit", site: "River View", date: TODAY, status: "Present", overtimeHours: 9 }],
    });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Attendance not entered", site: "River View" }),
      expect.objectContaining({ title: "Unusual overtime reported", site: "River View" }),
    ]));
    expect(alerts.filter((alert) => alert.title === "Attendance not entered")).toHaveLength(1);
  });

  it("adds the highest applicable budget alert using canonical site financial data", () => {
    const alerts = generateNotifications({
      role: "admin",
      today: TODAY,
      sites: [{ id: "site-1", siteName: "River View", budget: { totalProjectBudget: 1000 } }],
      materials: [{ site: "river view", amount: 600 }],
      expenses: [{ site: "River View", amount: 350, expenseType: "Other" }],
    });

    const budgetAlert = alerts.find((alert) => alert.module === "Site Budget");
    expect(budgetAlert).toMatchObject({
      title: "Site budget is 90% used",
      severity: "critical",
      href: "/site-details/site-1",
    });
  });

  it("adds one loss and high-outstanding alert from the shared project financial summary", () => {
    const alerts = generateNotifications({
      role: "manager",
      today: TODAY,
      sites: [{ id: "river", siteName: "River View" }],
      invoices: [{ site: "River View", totalAmount: 1000, paidAmount: 200 }],
      expenses: [{ site: "River View", expenseType: "Other", amount: 1200 }],
    });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Project is running at a loss", module: "Project Financials", href: "/site-details/river" }),
      expect.objectContaining({ title: "High client receivable outstanding", module: "Project Financials", href: "/site-details/river" }),
    ]));
  });
  it("uses inventory movements for low and out-of-stock alerts without duplicating legacy material alerts", () => {
    const alerts = generateNotifications({
      role: "admin",
      today: TODAY,
      materials: [{
        id: "legacy-cement",
        materialName: "Cement",
        site: "River View",
        currentStock: 0,
        reorderLevel: 10,
      }],
      inventoryItems: [{
        id: "cement-river-view",
        materialName: "Cement",
        site: "river   view",
        unit: "Bag",
        openingStock: 3,
        reorderLevel: 2,
      }, {
        id: "sand-river-view",
        materialName: "Sand",
        site: "River View",
        unit: "Ton",
        openingStock: 0,
        reorderLevel: 1,
      }],
      inventoryTransactions: [{
        id: "cement-out",
        inventoryItemId: "cement-river-view",
        transactionType: "out",
        quantity: 2,
        date: TODAY,
      }],
    });

    expect(alerts.filter((alert) => alert.module === "Inventory")).toHaveLength(2);
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Low material stock", href: "/inventory" }),
      expect.objectContaining({ title: "Material out of stock", href: "/inventory" }),
    ]));
    expect(alerts.filter((alert) => alert.module === "Materials")).toHaveLength(0);
  });

  it("creates procurement alerts from real pending requests, deliveries, payables, and completed GRNs", () => {
    const alerts = generateNotifications({
      role: "manager",
      today: TODAY,
      purchaseRequests: [{ id: "pr-1", requestNumber: "PR-2026-0001", site: "River View", status: "Pending Approval" }],
      purchaseOrders: [{ id: "po-1", poNumber: "PO-2026-0001", site: "River View", vendorName: "ABC Traders", status: "Issued", expectedDeliveryDate: "2026-08-28", outstandingAmount: 2000 }],
      goodsReceipts: [{ id: "grn-1", grnNumber: "GRN-2026-0001", site: "River View", receiptDate: TODAY, materialName: "Cement", acceptedQuantity: 10, unit: "Bag" }],
    });

    expect(alerts.map((alert) => alert.title)).toEqual(expect.arrayContaining([
      "Purchase request awaiting approval",
      "Purchase delivery overdue",
      "Vendor payment outstanding",
      "Goods receipt completed",
    ]));
  });


  it("adds BOQ control alerts only for standard ERP roles", () => {
    const boqData = {
      boqItems: [{ id: "boq-1", site: "River View", itemNumber: "1.1", description: "Concrete", unit: "Cum", plannedQuantity: 100, rate: 100 }],
      boqMeasurements: [{ id: "measurement-1", boqItemId: "boq-1", quantity: 95, status: "Pending" }],
      boqVariations: [{ id: "variation-1", site: "River View", variationReference: "V-1", status: "Submitted" }],
    };
    const alerts = generateNotifications({ role: "manager", today: TODAY, ...boqData });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "BOQ quantity nearing limit", href: "/boq" }),
      expect.objectContaining({ title: "Measurement pending certification", href: "/boq" }),
      expect.objectContaining({ title: "BOQ variation awaiting approval", href: "/boq" }),
    ]));
    expect(generateNotifications({ role: "supervisor", today: TODAY, ...boqData }).every((alert) => alert.href === "/field-update")).toBe(true);
  });
  it("creates client-billing alerts only from submitted or overdue RA bills", () => {
    const alerts = generateNotifications({
      role: "manager", today: TODAY,
      raBills: [
        { id: "ra-1", raBillNumber: "RA-1", site: "River View", status: "Submitted", billDate: TODAY },
        { id: "ra-2", raBillNumber: "RA-2", site: "River View", status: "Partially Paid", pendingAmount: 1500, paymentDueDate: "2026-08-20" },
      ],
    });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "RA bill awaiting certification", href: "/client-billing" }),
      expect.objectContaining({ title: "Client RA payment overdue", href: "/client-billing", severity: "critical" }),
    ]));
    expect(generateNotifications({ role: "supervisor", today: TODAY, raBills: [{ status: "Submitted" }] }).every((alert) => alert.href === "/field-update")).toBe(true);
  });
  it("creates real work-order and contractor-bill alerts only for standard ERP roles", () => {
    const alerts = generateNotifications({
      role: "manager", today: TODAY,
      workOrders: [{ id: "wo-1", workOrderNumber: "WO-1", site: "River View", status: "Active", expectedCompletionDate: "2026-08-28" }],
      contractorBills: [{ id: "bill-1", billNumber: "CB-1", vendorName: "Build Co", site: "River View", billDate: TODAY, pendingAmount: 2500 }],
    });
    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Work order completion overdue", href: "/work-orders" }),
      expect.objectContaining({ title: "Contractor payment pending", href: "/work-orders" }),
    ]));
    expect(generateNotifications({ role: "supervisor", userId: "field-1", today: TODAY, workOrders: [{ status: "Active" }], contractorBills: [{ pendingAmount: 100 }]}).every((alert) => alert.href === "/field-update")).toBe(true);
  });  it("adds non-duplicated equipment breakdown and certificate-expiry alerts for ERP roles", () => {
    const alerts = generateNotifications({
      role: "manager",
      today: TODAY,
      vehicles: [{
        id: "equipment-1", vehicleNumber: "JCB-01", site: "River View", status: "Breakdown",
        insuranceExpiry: "2026-08-15", fitnessExpiry: "2026-09-10", permitExpiry: "2026-12-31",
      }],
    });

    expect(alerts).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: "Equipment breakdown reported", severity: "critical", href: "/vehicle" }),
      expect.objectContaining({ title: "Insurance expired", severity: "critical" }),
      expect.objectContaining({ title: "Fitness certificate expiry approaching", severity: "warning" }),
    ]));
    expect(alerts.filter((alert) => alert.title === "Equipment breakdown reported")).toHaveLength(1);
  });
  it("keeps field users on their own operational DPR alert only", () => {
    const alerts = generateNotifications({
      role: "supervisor",
      userId: "supervisor-1",
      today: TODAY,
      ...createCoreData(),
      dailyProgressReports: [
        { id: "other-user-dpr", createdBy: "other-user", site: "River View", date: TODAY },
      ],
    });

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      title: "Today’s site update is pending",
      href: "/field-update",
    });
  });

  it("returns an empty notification state when the ERP dataset is empty", () => {
    expect(generateNotifications({ role: "viewer", today: TODAY })).toEqual([]);
  });

  it("handles empty and malformed records without generating alerts", () => {
    expect(
      generateNotifications({
        role: "viewer",
        today: TODAY,
        invoices: [null, { id: "bad", totalAmount: "not-a-number" }],
        materials: [{ materialName: "Bad", currentStock: "x", reorderLevel: 2 }],
        sites: [null, {}],
        attendance: [{ date: "not-a-date", status: "Absent" }],
        salaries: [{ status: "Paid", pendingAmount: -5 }],
        vehicles: [{ status: "Active", nextMaintenanceDate: "invalid" }],
        dailyProgressReports: [null, "not-a-record"],
      })
    ).toEqual([]);
  });
});

describe("local notification read state", () => {
  it("stores read ids locally and calculates unread notifications", () => {
    const storage = {
      data: {},
      getItem(key) {
        return this.data[key] || null;
      },
      setItem(key, value) {
        this.data[key] = value;
      },
    };

    saveReadNotificationIds("user-1", ["one", "one", "two"], storage);
    expect(loadReadNotificationIds("user-1", storage)).toEqual(["one", "two"]);
    expect(
      getUnreadNotificationCount([{ id: "one" }, { id: "two" }, { id: "three" }], ["one", "two"])
    ).toBe(1);
  });
});
