import React from "react";
import { render, screen } from "@testing-library/react";
import FieldDashboard from "./FieldDashboard";
import { collection, onSnapshot, query, where } from "firebase/firestore";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "supervisor", user: { uid: "supervisor-1", email: "supervisor@example.com" } }),
}));
jest.mock("../firebase", () => ({ db: {} }));
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

describe("FieldDashboard mobile operational view", () => {
  beforeEach(() => {
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
    expect(screen.queryByText(/Revenue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Payroll/)).not.toBeInTheDocument();
    expect(query).toHaveBeenCalled();
    expect(where).toHaveBeenCalledWith("createdBy", "==", "supervisor-1");
  });
});