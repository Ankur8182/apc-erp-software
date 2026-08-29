import {
  createInitialDprForm,
  filterDailyProgressReports,
  getDailyProgressOperationalSummary,
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
