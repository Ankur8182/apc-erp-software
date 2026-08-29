import { getTodayWorkforceSummary } from "./payrollReporting";

test("summarises active labour, today attendance and current-month salary balances", () => {
  expect(getTodayWorkforceSummary({
    today: "2026-08-30",
    labours: [{ id: "l1", active: true }, { id: "l2", active: false }, { id: "l3" }],
    attendance: [
      { labourId: "l1", date: "2026-08-30", status: "Present" },
      { labourId: "l3", date: "2026-08-30", status: "Absent" },
      { labourId: "l1", date: "2026-08-29", status: "Present" },
    ],
    salaries: [
      { month: "2026-08", netSalary: 1000, pendingAmount: 400 },
      { month: "2026-07", netSalary: 999, pendingAmount: 999 },
    ],
  })).toEqual({ presentToday: 1, absentToday: 1, activeLabour: 2, monthlyPayroll: 1000, pendingSalary: 400 });
});
