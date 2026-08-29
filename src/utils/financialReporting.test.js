import {
  calculateFinancialSummary,
  getInvoiceSummary,
  isDateInRange,
  isSameSite,
  normaliseDate,
  normaliseMoney,
  normaliseSiteName,
  normaliseStatus,
} from "./financialReporting";

const liveCollectionFixture = {
  invoices: [
    { site: "lko", amount: "100000", date: "2026-08-01" },
    {
      site: "civil",
      totalAmount: "200000",
      paidAmount: "50000",
      pendingAmount: "150000",
      invoiceDate: "2026-08-01",
    },
    {
      site: "png gas pipeline/lko",
      totalAmount: "100000",
      paidAmount: "90000",
      pendingAmount: "10000",
      invoiceDate: "2026-08-05",
    },
  ],
  expenses: [
    { site: "lko", expenseType: "Labour", amount: "1000", date: "2026-08-09" },
    { site: "civil", expenseType: "Fuel", amount: "1000", date: "2026-08-08" },
    { site: "lko", expenseType: "Other", amount: "1000", date: "2026-08-19" },
    { site: "lko", expenseType: "Other", amount: "10000", date: "2026-08-19" },
  ],
  materials: [
    { site: "civil", totalAmount: "40000", entryType: "Purchase", date: "2026-08-09" },
    { site: "lko", quantity: "200", rate: "380" },
  ],
  labours: [
    { site: "lko", name: "monu", wage: "400" },
    { site: "lko", name: "nnn", wage: "400" },
    { site: "gomti nagar/lko", name: "monu", wage: "400" },
    { site: "CFE", name: "xyz", wage: "1000" },
  ],
  salaries: [
    {
      site: "lko",
      employeeName: "monu",
      salary: "12000",
      workingDays: "8",
      paymentDate: "2026-08-09",
      month: "2026-08",
    },
  ],
  attendance: [
    { site: "lko", employeeName: "monu", status: "Present", date: "2026-08-08" },
  ],
  vehicles: [
    { site: "lko", fuel: "10" },
    { site: "lko", fuel: "1" },
  ],
};

test("matches all live Firebase collection totals without double-counting wages", () => {
  expect(calculateFinancialSummary(liveCollectionFixture)).toMatchObject({
    income: 400000,
    received: 140000,
    pending: 260000,
    materialExpense: 116000,
    labourExpense: 13000,
    otherExpense: 12011,
    totalExpense: 141011,
    profit: 258989,
    salaryExpense: 12000,
    labourExpenseFromExpenses: 1000,
    attendanceExpense: 0,
    vehicleExpense: 11,
  });
});

test("uses attendance wages only when payroll has not already covered the worker's month", () => {
  const summary = calculateFinancialSummary({
    labours: [{ site: "lko", name: "monu", wage: "400" }],
    attendance: [
      { site: "lko", employeeName: "monu", status: "Present", date: "2026-08-08" },
      { site: "lko", employeeName: "monu", status: "Half Day", date: "2026-08-09" },
    ],
  });

  expect(summary.attendanceExpense).toBe(600);
  expect(summary.labourExpense).toBe(600);
});

test("date filters include boundaries and exclude undated legacy records", () => {
  expect(isDateInRange({ invoiceDate: "2026-08-01" }, "2026-08-01", "2026-08-01")).toBe(true);
  expect(isDateInRange({ date: "2026-08-08" }, "2026-08-09", "2026-08-10")).toBe(false);
  expect(isDateInRange({ fuelUpdatedAt: new Date("2026-08-10T00:00:00Z") }, "2026-08-10", "2026-08-10")).toBe(true);
  expect(isDateInRange({ fuel: 10 }, "2026-08-01", "2026-08-31")).toBe(false);
  expect(isDateInRange({ fuel: 10 }, "", "")).toBe(true);
});

test("normalises legacy site, status, date, and money values safely", () => {
  expect(normaliseSiteName("  LKO   Site ")).toBe("LKO Site");
  expect(normaliseStatus("Half Day")).toBe("half-day");
  expect(normaliseDate("not-a-date")).toBe("");
  expect(normaliseMoney("₹ 1,250")).toBe(1250);
  expect(normaliseMoney("invalid")).toBe(0);
  expect(normaliseMoney("-100")).toBe(0);
  expect(
    isDateInRange(
      { invoiceDate: "invalid", date: "2026-08-10" },
      "2026-08-10",
      "2026-08-10"
    )
  ).toBe(true);
});

test("keeps invoice received and pending amounts internally consistent", () => {
  expect(
    getInvoiceSummary({ totalAmount: 1000, paidAmount: 1200, pendingAmount: 900 })
  ).toEqual({ total: 1000, received: 1000, pending: 0 });
  expect(getInvoiceSummary({ totalAmount: 1000, pendingAmount: 250 })).toEqual({
    total: 1000,
    received: 750,
    pending: 250,
  });
  expect(getInvoiceSummary({ totalAmount: 1000, pendingAmount: "invalid" })).toEqual({
    total: 1000,
    received: 0,
    pending: 1000,
  });
});

test("never treats labour master values as direct expenses", () => {
  const summary = calculateFinancialSummary({
    labours: [
      {
        site: "LKO",
        name: "Monu",
        wage: 400,
        amount: 5000,
        totalAmount: 5000,
      },
    ],
    expenses: [{ site: "LKO", expenseType: "Labour", amount: 1000 }],
  });

  expect(summary.directLabourPayment).toBe(0);
  expect(summary.labourExpense).toBe(1000);
});

test("uses the payroll net salary once and never treats its payment ledger as a second expense", () => {
  const summary = calculateFinancialSummary({
    labours: [{ id: "labour-1", site: "LKO", name: "Amit", dailyWage: 500 }],
    attendance: [{ labourId: "labour-1", site: "LKO", date: "2026-08-01", status: "Present" }],
    salaries: [{ labourId: "labour-1", site: "LKO", month: "2026-08", grossPay: 500, netSalary: 450, salary: 500, paidAmount: 450 }],
  });

  expect(summary.salaryExpense).toBe(450);
  expect(summary.attendanceExpense).toBe(0);
  expect(summary.labourExpense).toBe(450);
});

test("counts a material or vehicle record only once when legacy amount aliases coexist", () => {
  const summary = calculateFinancialSummary({
    materials: [
      {
        site: "LKO",
        totalAmount: 100,
        amount: 100,
        expenseAmount: 100,
      },
    ],
    vehicles: [{ site: "LKO", fuel: 25, fuelCost: 25, amount: 25 }],
  });

  expect(summary.materialExpense).toBe(100);
  expect(summary.vehicleExpense).toBe(25);
  expect(summary.totalExpense).toBe(125);
});

test("uses legacy vehicle fuel only when the vehicle has no expense history", () => {
  const summary = calculateFinancialSummary({
    vehicles: [
      { id: "truck-1", vehicleNumber: "UP32 AB 1234", site: "LKO", fuel: 100 },
      { id: "truck-2", vehicleNumber: "UP32 AB 5678", site: "LKO", fuel: 50 },
    ],
    vehicleExpenses: [
      {
        vehicleNumber: "UP32 AB 1234",
        site: "LKO",
        date: "2026-08-10",
        expenseType: "Fuel",
        amount: 200,
      },
    ],
  });

  expect(summary.vehicleExpenseFromLedger).toBe(200);
  expect(summary.legacyVehicleExpense).toBe(50);
  expect(summary.vehicleExpense).toBe(250);
});

test("calculates site and date filtered vehicle expenses without double counting", () => {
  const vehicles = [
    { id: "truck-lko", vehicleNumber: "UP32 AB 1234", site: "LKO", fuel: 100 },
    { id: "truck-civil", vehicleNumber: "UP32 AB 5678", site: "Civil", fuel: 50 },
  ];
  const vehicleExpenses = [
    {
      vehicleId: "truck-lko",
      vehicleNumber: "UP32 AB 1234",
      site: "LKO",
      date: "2026-08-10",
      expenseType: "Fuel",
      amount: 200,
    },
    {
      vehicleId: "truck-civil",
      vehicleNumber: "UP32 AB 5678",
      site: "Civil",
      date: "2026-08-11",
      expenseType: "Repair",
      amount: 75,
    },
  ];
  const lkoExpenses = vehicleExpenses.filter((item) => isSameSite(item, "lko"));
  const august10Expenses = vehicleExpenses.filter((item) =>
    isDateInRange(item, "2026-08-10", "2026-08-10")
  );

  const lkoSummary = calculateFinancialSummary({
    invoices: [{ site: "LKO", totalAmount: 1000 }],
    vehicles: vehicles.filter((item) => isSameSite(item, "LKO")),
    vehicleExpenses: lkoExpenses,
    vehicleExpenseCoverage: lkoExpenses,
  });
  const august10Summary = calculateFinancialSummary({
    vehicles,
    vehicleExpenses: august10Expenses,
    vehicleExpenseCoverage: vehicleExpenses,
  });

  expect(lkoSummary.vehicleExpense).toBe(200);
  expect(lkoSummary.totalExpense).toBe(200);
  expect(lkoSummary.profit).toBe(800);
  expect(august10Summary.vehicleExpense).toBe(200);
  expect(august10Summary.legacyVehicleExpense).toBe(0);
});

test("uses the same site key for site-wise financial calculations", () => {
  const invoices = [
    { site: " LKO  Site ", totalAmount: 1000 },
    { site: "Civil", totalAmount: 2000 },
  ];
  const summary = calculateFinancialSummary({
    invoices: invoices.filter((invoice) => isSameSite(invoice, "lko site")),
    expenses: [{ site: "LKO Site", amount: 100, expenseType: "Other" }],
  });

  expect(summary.income).toBe(1000);
  expect(summary.totalExpense).toBe(100);
  expect(summary.profit).toBe(900);
});

test("matches the live Reports totals for date-filtered records", () => {
  const filterByDate = (records, fromDate, toDate) =>
    records.filter((record) => isDateInRange(record, fromDate, toDate));

  const august8Summary = calculateFinancialSummary({
    invoices: filterByDate(liveCollectionFixture.invoices, "2026-08-08", "2026-08-08"),
    expenses: filterByDate(liveCollectionFixture.expenses, "2026-08-08", "2026-08-08"),
    materials: filterByDate(liveCollectionFixture.materials, "2026-08-08", "2026-08-08"),
    labours: liveCollectionFixture.labours,
    salaries: filterByDate(liveCollectionFixture.salaries, "2026-08-08", "2026-08-08"),
    attendance: filterByDate(liveCollectionFixture.attendance, "2026-08-08", "2026-08-08"),
    attendanceSalaryCoverage: liveCollectionFixture.salaries,
    vehicles: filterByDate(liveCollectionFixture.vehicles, "2026-08-08", "2026-08-08"),
  });
  const august19Summary = calculateFinancialSummary({
    invoices: filterByDate(liveCollectionFixture.invoices, "2026-08-19", "2026-08-19"),
    expenses: filterByDate(liveCollectionFixture.expenses, "2026-08-19", "2026-08-19"),
    materials: filterByDate(liveCollectionFixture.materials, "2026-08-19", "2026-08-19"),
    labours: liveCollectionFixture.labours,
    salaries: filterByDate(liveCollectionFixture.salaries, "2026-08-19", "2026-08-19"),
    attendance: filterByDate(liveCollectionFixture.attendance, "2026-08-19", "2026-08-19"),
    vehicles: filterByDate(liveCollectionFixture.vehicles, "2026-08-19", "2026-08-19"),
  });

  expect(august8Summary).toMatchObject({
    labourExpense: 0,
    otherExpense: 1000,
    totalExpense: 1000,
    profit: -1000,
  });
  expect(august19Summary).toMatchObject({
    otherExpense: 11000,
    totalExpense: 11000,
    profit: -11000,
  });
});
