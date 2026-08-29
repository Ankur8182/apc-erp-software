import {
  calculateAttendanceTotals,
  calculatePayroll,
  createSalaryPaymentPayload,
  dedupeAttendance,
  getAdvanceRecoveryAllocations,
  getAttendanceKey,
} from "./payroll";

const labour = { id: "labour-1", name: "Amit", site: "River View", dailyWage: 500 };

describe("payroll utilities", () => {
  test("counts present, half-day and overtime once per labour/date", () => {
    const attendance = dedupeAttendance([
      { id: "old", labourId: "labour-1", date: "2026-08-01", status: "Present", overtimeHours: 2, updatedAt: 1 },
      { id: "new", labourId: "labour-1", date: "2026-08-01", status: "Half Day", overtimeHours: 1, updatedAt: 2 },
      { labourId: "labour-1", date: "2026-08-02", status: "Present" },
    ]);
    expect(attendance).toHaveLength(2);
    expect(calculateAttendanceTotals({ attendance, labour, month: "2026-08", site: "River View" }))
      .toEqual(expect.objectContaining({ payableDays: 1.5, halfDays: 1, overtimeHours: 1 }));
  });

  test("calculates daily payroll, advance deduction, payments and pending without double counting attendance", () => {
    const payroll = calculatePayroll({
      labour,
      month: "2026-08",
      attendance: [
        { labourId: "labour-1", site: "River View", date: "2026-08-01", status: "Present", overtimeHours: 2 },
        { labourId: "labour-1", site: "River View", date: "2026-08-02", status: "Half Day" },
      ],
      advances: [{ labourId: "labour-1", site: "River View", date: "2026-08-01", amount: 300 }],
      advanceRecovery: 200,
      deductions: 50,
      overtimeRate: 75,
      payments: [{ salaryId: "salary-1", amount: 300 }],
      payrollId: "salary-1",
    });
    expect(payroll).toEqual(expect.objectContaining({ grossPay: 900, totalDeductions: 250, netPay: 650, paidAmount: 300, pendingAmount: 350 }));
  });

  test("prorates monthly pay safely and does not invent overtime costs", () => {
    const payroll = calculatePayroll({
      labour: { ...labour, payType: "monthly", monthlySalary: 30000 },
      month: "2026-08",
      attendance: [{ labourId: "labour-1", date: "2026-08-01", status: "Present", overtimeHours: 6 }],
    });
    expect(payroll).toEqual(expect.objectContaining({ basePay: 1000, overtimePay: 0, netPay: 1000 }));
  });

  test("makes stable attendance keys and blocks payments above pending", () => {
    expect(getAttendanceKey({ labourId: "labour 1", date: "2026-08-11" })).toBe("labour-1__2026-08-11");
    expect(createSalaryPaymentPayload({ payroll: { pendingAmount: 200 }, labour, amount: 201, paymentDate: "2026-08-31", paymentMode: "Cash" }).isValid).toBe(false);
  });

  test("allocates advance recovery oldest-first and never beyond the balance", () => {
    expect(getAdvanceRecoveryAllocations({
      labour,
      month: "2026-08",
      amount: 500,
      advances: [
        { id: "advance-2", labourId: "labour-1", date: "2026-08-02", amount: 400 },
        { id: "advance-1", labourId: "labour-1", date: "2026-08-01", amount: 200, recoveredAmount: 50 },
      ],
    })).toEqual([{ advanceId: "advance-1", amount: 150 }, { advanceId: "advance-2", amount: 350 }]);
  });
});
