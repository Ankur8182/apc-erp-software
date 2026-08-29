import { getDistinctValues, getPageSlice, sortRecords } from "./dataTable";

describe("data table helpers", () => {
  const records = [
    { name: "Gamma", amount: "300", date: "2026-02-10", site: "North" },
    { name: "alpha", amount: "100", date: "2026-01-02", site: "South" },
    { name: "Beta", amount: "200", date: "2026-01-30", site: "North" },
  ];

  it("sorts text, numeric values, and ISO dates without changing the source records", () => {
    expect(sortRecords(records, (record) => record.name).map((record) => record.name)).toEqual(["alpha", "Beta", "Gamma"]);
    expect(sortRecords(records, (record) => record.amount, "desc").map((record) => record.amount)).toEqual(["300", "200", "100"]);
    expect(sortRecords(records, (record) => record.date).map((record) => record.date)).toEqual(["2026-01-02", "2026-01-30", "2026-02-10"]);
    expect(records[0].name).toBe("Gamma");
  });

  it("returns distinct, non-empty filter options", () => {
    expect(getDistinctValues(records, (record) => record.site)).toEqual(["North", "South"]);
  });

  it("returns a safe page slice and clamps an out-of-range page", () => {
    expect(getPageSlice(records, 3, 2)).toMatchObject({ currentPage: 2, totalPages: 2, startIndex: 2, rows: [records[2]] });
  });
});
