import {
  createInitialDprForm,
  filterDailyProgressReports,
  getDailyProgressOperationalSummary,
  summariseDailyProgressReports,
  sortDailyProgressReports,
  validateDailyProgressReport,
} from "./dailyProgressReporting";

test("normalises a valid daily progress report", () => {
  const result = validateDailyProgressReport({
    date: "2026-09-01",
    site: "  LKO   Site ",
    workActivity: "  PCC work ",
    workLocation: " Block A ",
    quantity: "12.5",
    unit: "m³",
    manpowerCount: "8",
    materialsUsed: "Cement",
    equipmentUsed: "Mixer",
    remarks: "  Completed safely ",
  });

  expect(result).toMatchObject({
    isValid: true,
    value: {
      site: "LKO Site",
      workActivity: "PCC work",
      quantity: 12.5,
      manpowerCount: 8,
      remarks: "Completed safely",
    },
  });
});

test("blocks missing or negative DPR values", () => {
  expect(validateDailyProgressReport(createInitialDprForm())).toMatchObject({
    isValid: false,
  });

  expect(
    validateDailyProgressReport({
      date: "2026-09-01",
      site: "LKO",
      workActivity: "Excavation",
      workLocation: "Zone 1",
      quantity: "-1",
      unit: "m³",
      manpowerCount: "-2",
    })
  ).toMatchObject({
    isValid: false,
    error: "Quantity 0 se zyada valid number honi chahiye.",
  });
});

test("filters and sorts DPR records by site, date, and text", () => {
  const reports = [
    {
      id: "dpr-1",
      date: "2026-09-01",
      site: "LKO",
      workActivity: "Excavation",
      workLocation: "Zone A",
    },
    {
      id: "dpr-2",
      date: "2026-09-03",
      site: "Civil",
      workActivity: "PCC",
      workLocation: "Foundation",
      materialsUsed: "Cement",
    },
  ];

  expect(
    filterDailyProgressReports(reports, {
      site: "civil",
      fromDate: "2026-09-03",
      toDate: "2026-09-03",
      search: "cement",
    })
  ).toEqual([reports[1]]);

  expect(sortDailyProgressReports(reports).map((report) => report.id)).toEqual([
    "dpr-2",
    "dpr-1",
  ]);
});

test("summarises today's DPRs by canonical site without duplicate counting", () => {
  const reports = [
    {
      id: "dpr-1",
      date: "2026-09-03",
      site: "  LKO   Site ",
      workActivity: "PCC",
      workLocation: "Block A",
      quantity: "10",
      unit: "m³",
      manpowerCount: "8",
      materialsUsed: "Cement",
      equipmentUsed: "Mixer",
    },
    {
      id: "dpr-1",
      date: "2026-09-03",
      site: "LKO Site",
      workActivity: "PCC",
      workLocation: "Block A",
      quantity: "10",
      unit: "m³",
      manpowerCount: "8",
    },
    {
      id: "dpr-2",
      date: "2026-09-03",
      siteName: "lko site",
      workActivity: "Brick work",
      workLocation: "Block B",
      quantity: 5,
      unit: "m",
      manpowerCount: 2,
      materialsUsed: "Bricks",
      equipmentUsed: "Hoist",
    },
    {
      id: "dpr-3",
      date: "2026-09-02",
      site: "LKO Site",
      workActivity: "Excavation",
      workLocation: "Block C",
      quantity: 3,
      unit: "m³",
      manpowerCount: 4,
    },
    {
      id: "legacy-invalid",
      date: "not-a-date",
      site: "LKO Site",
      quantity: "invalid",
      unit: "m³",
      manpowerCount: -4,
    },
  ];

  const summary = getDailyProgressOperationalSummary(reports, {
    date: "2026-09-03",
    site: "lko site",
  });

  expect(summary.todayCount).toBe(2);
  expect(summary.totalManpower).toBe(10);
  expect(summary.submittedSites).toEqual(["LKO Site"]);
  expect(summary.outputByUnit).toEqual([
    { unit: "m", quantity: 5 },
    { unit: "m³", quantity: 10 },
  ]);
  expect(summary.materialsUsed).toEqual(["Cement", "Bricks"]);
  expect(summary.equipmentUsed).toEqual(["Mixer", "Hoist"]);
});

test("keeps malformed and legacy DPR dates out of date-filtered totals", () => {
  const reports = [
    null,
    {
      id: "today",
      date: "2026-09-03",
      site: "Civil",
      workActivity: "Plaster",
      workLocation: "Floor 1",
      quantity: 20,
      unit: "m²",
      manpowerCount: 6,
    },
    {
      id: "legacy",
      site: "Civil",
      workActivity: "Old entry",
      workLocation: "Floor 0",
      quantity: 9,
      unit: "m²",
      manpowerCount: 3,
    },
  ];

  const summary = getDailyProgressOperationalSummary(reports, {
    date: "2026-09-03",
  });

  expect(summary.todayCount).toBe(1);
  expect(summary.totalManpower).toBe(6);
  expect(summary.recentReports.map((report) => report.id)).toEqual([
    "today",
    "legacy",
  ]);
});

test("filters DPR reports by inclusive date range, canonical site, and activity", () => {
  const reports = [
    {
      id: "outside-range",
      date: "2026-09-01",
      site: "LKO Site",
      workActivity: "PCC",
    },
    {
      id: "matches",
      date: "2026-09-02",
      site: "  lko   site ",
      workActivity: "PCC foundation",
    },
    {
      id: "wrong-activity",
      date: "2026-09-03",
      site: "LKO Site",
      workActivity: "Excavation",
    },
    {
      id: "invalid-date",
      date: "invalid-date",
      site: "LKO Site",
      workActivity: "PCC",
    },
  ];

  const filtered = filterDailyProgressReports(reports, {
    site: "LKO Site",
    fromDate: "2026-09-02",
    toDate: "2026-09-03",
    workActivity: "pcc",
  });

  expect(filtered.map((report) => report.id)).toEqual(["matches"]);
});

test("summarises filtered DPR operational values without combining units", () => {
  const reports = [
    {
      id: "pcc-m3",
      date: "2026-09-02",
      site: "Civil",
      workActivity: "PCC",
      quantity: 12,
      unit: "m³",
      manpowerCount: 8,
      materialsUsed: "Cement",
      equipmentUsed: "Mixer",
    },
    {
      id: "pcc-m",
      date: "2026-09-03",
      siteName: "civil",
      workActivity: "PCC slab",
      quantity: 5,
      unit: "m",
      manpowerCount: 4,
      materialsUsed: "Steel",
      equipmentUsed: "Vibrator",
    },
    {
      id: "pcc-m3",
      date: "2026-09-02",
      site: "Civil",
      workActivity: "PCC",
      quantity: 12,
      unit: "m³",
      manpowerCount: 8,
    },
    {
      id: "bad-values",
      date: "2026-09-03",
      site: "Civil",
      workActivity: "PCC",
      quantity: "invalid",
      unit: "m³",
      manpowerCount: -2,
    },
  ];

  const summary = summariseDailyProgressReports(reports, {
    site: "CIVIL",
    fromDate: "2026-09-02",
    toDate: "2026-09-03",
    workActivity: "pcc",
  });

  expect(summary.reportCount).toBe(3);
  expect(summary.manpowerTotal).toBe(12);
  expect(summary.outputByUnit).toEqual([
    { unit: "m", quantity: 5 },
    { unit: "m³", quantity: 12 },
  ]);
  expect(summary.materialsUsed).toEqual(["Cement", "Steel"]);
  expect(summary.equipmentUsed).toEqual(["Mixer", "Vibrator"]);
});

test("returns a safe empty DPR summary for empty datasets", () => {
  expect(summariseDailyProgressReports([], {})).toMatchObject({
    reportCount: 0,
    manpowerTotal: 0,
    outputByUnit: [],
    materialsUsed: [],
    equipmentUsed: [],
    submittedSites: [],
  });
});
