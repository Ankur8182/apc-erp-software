import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import BackupRecovery from "./BackupRecovery";
import { collection, getDocs } from "firebase/firestore";
import { useAuth } from "../auth/AuthProvider";
import { downloadErpFirestoreBackup, exportErpFirestoreBackup } from "../utils/erpBackup";

jest.mock("../Components/Layout", () => ({ children, title }) => <main><h1>{title}</h1>{children}</main>);
jest.mock("../auth/AuthProvider", () => ({ useAuth: jest.fn() }));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ database, name })),
  getDocs: jest.fn(),
}));
jest.mock("../utils/erpBackup", () => ({
  ERP_BACKUP_COLLECTIONS: ["sites", "expenses"],
  ERP_BACKUP_EXCLUSIONS: {
    users: "User profiles are excluded.",
    firebaseAuthentication: "Authentication is excluded.",
    firebaseStorage: "Storage is excluded.",
    firestoreInfrastructure: "Infrastructure is excluded.",
  },
  createErpBackupFileName: () => "ap-construction-erp-backup-2026-09-01.json",
  downloadErpFirestoreBackup: jest.fn(),
  exportErpFirestoreBackup: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
  useAuth.mockReturnValue({ role: "admin" });
  collection.mockImplementation((database, name) => ({ database, name }));
  getDocs.mockResolvedValue({ docs: [] });
  exportErpFirestoreBackup.mockImplementation(async ({ loadCollection }) => {
    await loadCollection("sites");
    await loadCollection("expenses");
    return {
      metadata: {
        exportedAt: "2026-09-01T08:00:00.000Z",
        documentCount: 4,
        collectionCount: 2,
        redactedFieldCount: 0,
      },
    };
  });
});

test("allows only an admin to start a read-only ERP backup download", async () => {
  render(<BackupRecovery />);

  expect(screen.getByText(/Firestore ERP data export/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /download firestore json backup/i }));

  await waitFor(() => expect(downloadErpFirestoreBackup).toHaveBeenCalledTimes(1));
  expect(window.confirm).toHaveBeenCalled();
  expect(collection).toHaveBeenNthCalledWith(1, {}, "sites");
  expect(collection).toHaveBeenNthCalledWith(2, {}, "expenses");
  expect(getDocs).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("status")).toHaveTextContent("Backup downloaded");
});

test("shows no export control when a non-admin reaches the component", () => {
  useAuth.mockReturnValue({ role: "manager" });
  render(<BackupRecovery />);

  expect(screen.getByRole("alert")).toHaveTextContent(/restricted to active administrators/i);
  expect(screen.queryByRole("button", { name: /download firestore json backup/i })).not.toBeInTheDocument();
  expect(exportErpFirestoreBackup).not.toHaveBeenCalled();
});