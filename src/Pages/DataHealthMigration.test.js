import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DataHealthMigration from "./DataHealthMigration";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { runDataHealthDryRun } from "../utils/dataHealth";

jest.mock("../Components/Layout", () => ({ children, title }) => <main><h1>{title}</h1>{children}</main>);
jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ database, name })),
  getDocs: jest.fn(),
  limit: jest.fn((count) => ({ count })),
  query: jest.fn((reference, constraint) => ({ reference, constraint })),
}));
jest.mock("../utils/dataHealth", () => ({
  DATA_HEALTH_COLLECTIONS: ["sites", "labours"],
  DATA_HEALTH_EXCLUSIONS: { users: "Profiles excluded.", firebaseAuthentication: "Authentication excluded.", firebaseStorage: "Storage excluded.", unknownCollections: "Unknown collections excluded." },
  DATA_HEALTH_MAX_DOCUMENTS_PER_COLLECTION: 100,
  filterDataHealthCandidates: (items, filters) => items.filter((item) => (!filters.category || item.category === filters.category) && (!filters.collection || item.collection === filters.collection) && (!filters.severity || item.severity === filters.severity)),
  runDataHealthDryRun: jest.fn(),
}));

const report = {
  summary: { recordsScanned: 2, recordsAlreadyValid: 1, recordsNormalizable: 1, recordsRequiringManualReview: 0, duplicateCandidates: 0, orphanCandidates: 0, invalidFinancialCandidates: 0, possibleTestDemoCandidates: 0, proposedChanges: 1, collectionsScanned: 2 },
  collectionSummary: [
    { collection: "sites", label: "Sites", scanned: 1, alreadyValid: 1, normalizable: 0, manualReview: 0, immutableHistory: false },
    { collection: "labours", label: "Labour Masters", scanned: 1, alreadyValid: 0, normalizable: 1, manualReview: 0, immutableHistory: false },
  ],
  candidates: [{ id: "normalization::labours::labour-1", category: "normalization", severity: "info", collection: "labours", collectionLabel: "Labour Masters", recordId: "labour-1", recordLabel: "Riya", site: "North Site", summary: "A deterministic normalization is available.", field: "", value: "", expected: "", manualReview: false, relatedRecordIds: [], proposedChanges: [{ field: "dailyWage", from: "500", to: 500, reason: "Number copy" }] }],
};

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
  jest.spyOn(console, "error").mockImplementation(() => {});
  useAuth.mockReturnValue({ role: "admin" });
  getDocs.mockResolvedValue({ docs: [{ id: "one", data: () => ({ name: "Record" }) }] });
  runDataHealthDryRun.mockReturnValue(report);
});

test("allows an admin to run a read-only diagnostic and renders the result", async () => {
  render(<DataHealthMigration />);
  fireEvent.click(screen.getByRole("button", { name: /run read-only data health dry run/i }));

  await waitFor(() => expect(runDataHealthDryRun).toHaveBeenCalledTimes(1));
  expect(window.confirm).toHaveBeenCalled();
  expect(collection).toHaveBeenNthCalledWith(1, {}, "sites");
  expect(collection).toHaveBeenNthCalledWith(2, {}, "labours");
  expect(query).toHaveBeenCalledTimes(2);
  expect(limit).toHaveBeenCalledWith(101);
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Records scanned")).toBeInTheDocument();
  expect(screen.getAllByText("Labour Masters").length).toBeGreaterThan(0);
  expect(screen.getByText(/0 write operations/i)).toBeInTheDocument();
});

test("keeps the diagnostic controls unavailable to non-admin users", () => {
  useAuth.mockReturnValue({ role: "manager" });
  render(<DataHealthMigration />);

  expect(screen.getByRole("alert")).toHaveTextContent(/restricted to active administrators/i);
  expect(screen.queryByRole("button", { name: /run read-only/i })).not.toBeInTheDocument();
  expect(getDocs).not.toHaveBeenCalled();
});

test("shows an understandable error and does not claim a migration when a read fails", async () => {
  getDocs.mockRejectedValue({ code: "permission-denied" });
  render(<DataHealthMigration />);
  fireEvent.click(screen.getByRole("button", { name: /run read-only data health dry run/i }));

  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(runDataHealthDryRun).not.toHaveBeenCalled();
  expect(screen.queryByText(/No migration applied/i)).not.toBeInTheDocument();
  console.error.mockRestore();
});