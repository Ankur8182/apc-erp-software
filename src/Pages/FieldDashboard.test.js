import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import FieldDashboard from "./FieldDashboard";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useDprOutboxSync } from "../hooks/useDprOutboxSync";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "supervisor", user: { uid: "supervisor-1", email: "supervisor@example.com" } }),
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("../hooks/useDprOutboxSync", () => ({ useDprOutboxSync: jest.fn() }));
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }));
jest.mock("../utils/fieldUpdateDrafts", () => ({
  FIELD_DRAFT_EVENT: "apc-field-draft-change",
  hasSavedFieldUpdateDraft: () => true,
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ name })),
  onSnapshot: jest.fn(),
  query: jest.fn((source) => source),
  where: jest.fn(),
}));

const mockRetryEntry = jest.fn();
const mockDiscardEntry = jest.fn();

const createOutboxState = (overrides = {}) => ({
  isOnline: false,
  entries: [{ clientSubmissionId: "local-dpr", retryable: true }],
  summary: { pending: 1, syncing: 0, failed: 0, total: 1 },
  isSyncing: false,
  syncMessage: "",
  retryPending: jest.fn(),
  retryEntry: mockRetryEntry,
  discardEntry: mockDiscardEntry,
  ...overrides,
});

describe("FieldDashboard mobile operational view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDprOutboxSync.mockReturnValue(createOutboxState());
    collection.mockImplementation((database, name) => ({ name }));
    query.mockImplementation((source) => source);
    onSnapshot.mockImplementation((source, onNext) => {
      if (source.name === "dailyProgressReports") {
        onNext({
          docs: [{
            id: "dpr-1",
            data: () => ({
              createdBy: "supervisor-1",
              site: "Civil Site",
              date: new Date().toISOString().slice(0, 10),
              workActivity: "Concrete work",
              quantity: 4,
              unit: "m³",
              manpowerCount: 6,
            }),
          }],
        });
      } else {
        onNext({ docs: [{ id: "site-1", data: () => ({ siteName: "Civil Site" }) }] });
      }
      return jest.fn();
    });
  });

  afterEach(() => jest.clearAllMocks());

  it("shows only operational own-DPR information and available site references", () => {
    render(<FieldDashboard />);

    expect(screen.getByRole("heading", { name: /field dashboard/i })).toBeInTheDocument();
    expect(screen.getByText("Concrete work")).toBeInTheDocument();
    expect(screen.getByText("Civil Site")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("○ Offline sync")).toBeInTheDocument();
    expect(screen.getByText(/1 pending/)).toBeInTheDocument();
    expect(screen.queryByText(/Revenue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payroll/)).not.toBeInTheDocument();
    expect(query).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith("createdBy", "==", "supervisor-1");
  });

  it("explains a failed local DPR and requires deliberate confirmation before discarding it", () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    useDprOutboxSync.mockReturnValue(createOutboxState({
      isOnline: true,
      entries: [{
        clientSubmissionId: "dpr-permission",
        syncStatus: "failed",
        retryable: false,
        failureCode: "permission-denied",
        site: "Civil Site",
        payload: { workActivity: "Jointing", date: "2026-09-06", site: "Civil Site" },
      }],
      summary: { pending: 0, syncing: 0, failed: 1, total: 1 },
    }));

    render(<FieldDashboard />);

    expect(screen.getByRole("heading", { name: /local updates needing attention/i })).toBeInTheDocument();
    expect(screen.getByText("Jointing")).toBeInTheDocument();
    expect(screen.getByText(/Permission denied while submitting this DPR/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry Sync" }));
    expect(mockRetryEntry).toHaveBeenCalledWith("dpr-permission");
    fireEvent.click(screen.getByRole("button", { name: "Discard Local Update" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockDiscardEntry).toHaveBeenCalledWith("dpr-permission");
    confirmSpy.mockRestore();
  });
});