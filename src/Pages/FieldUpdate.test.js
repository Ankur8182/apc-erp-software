import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import FieldUpdate from "./FieldUpdate";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import { logAuditEvent } from "../utils/auditLogging";
import { hasFieldUpdateDraftContent, saveFieldUpdateDraft } from "../utils/fieldUpdateDrafts";

const mockUser = { uid: "supervisor-1", email: "supervisor@example.com" };

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "supervisor", user: mockUser }),
}));

jest.mock("../firebase", () => ({
  db: {},
  storage: {},
}));

jest.mock("../utils/auditLogging", () => ({
  getAuditFailureMessage: () => "The record was saved, but its audit entry could not be recorded. Please contact an administrator.",
  logAuditEvent: jest.fn(() => Promise.resolve({ success: true })),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ name })),
  doc: jest.fn(() => ({ id: "new-dpr" })),
  onSnapshot: jest.fn(),
  query: jest.fn((source) => source),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  setDoc: jest.fn(),
  where: jest.fn(),
}));

jest.mock("firebase/storage", () => ({
  deleteObject: jest.fn(() => Promise.resolve()),
  getDownloadURL: jest.fn(),
  ref: jest.fn((storage, path) => ({ path })),
  uploadBytesResumable: jest.fn(),
}));

jest.mock("../utils/fieldUpdateDrafts", () => ({
  clearFieldUpdateDraft: jest.fn(),
  hasFieldUpdateDraftContent: jest.fn(() => false),
  loadFieldUpdateDraft: jest.fn(() => null),
  saveFieldUpdateDraft: jest.fn(() => true),
}));

const renderFieldUpdate = () => {
  onSnapshot.mockImplementation((source, onNext) => {
    void source;
    onNext({
      docs: [{ id: "site-1", data: () => ({ siteName: "Civil Site" }) }],
    });
    return jest.fn();
  });

  return render(<FieldUpdate />);
};

const completeRequiredForm = () => {
  fireEvent.change(screen.getByLabelText(/^Site/), {
    target: { value: "Civil Site" },
  });
  fireEvent.change(screen.getByLabelText(/^Date/), {
    target: { value: "2026-09-04" },
  });
  fireEvent.change(screen.getByLabelText(/^Work Activity/), {
    target: { value: "PCC work" },
  });
  fireEvent.change(screen.getByLabelText(/^Work Location/), {
    target: { value: "Block A" },
  });
  fireEvent.change(screen.getByLabelText(/^Manpower Count/), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByLabelText(/^Output Quantity/), {
    target: { value: "0" },
  });
};

describe("FieldUpdate submission", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    collection.mockImplementation((database, name) => ({ name }));
    doc.mockReturnValue({ id: "new-dpr" });
    query.mockImplementation((source) => source);
    serverTimestamp.mockReturnValue("SERVER_TIMESTAMP");
    where.mockReturnValue({});
    setDoc.mockResolvedValue();
    logAuditEvent.mockResolvedValue({ success: true });
    ref.mockImplementation((storage, path) => ({ path }));
    deleteObject.mockResolvedValue();
    getDownloadURL.mockResolvedValue("https://example.com/photo");
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("saves a valid supervisor DPR with the authenticated UID and server timestamps", async () => {
    renderFieldUpdate();
    completeRequiredForm();

    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1]).toMatchObject({
      site: "Civil Site",
      quantity: 0,
      manpowerCount: 5,
      createdBy: "supervisor-1",
      createdAt: "SERVER_TIMESTAMP",
      updatedAt: "SERVER_TIMESTAMP",
      photos: [],
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Site update submitted successfully."
    );
  });

  test("keeps the form available and shows a safe error when the DPR save is denied", async () => {
    setDoc.mockRejectedValue({ code: "permission-denied" });
    renderFieldUpdate();
    completeRequiredForm();

    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("You do not have permission to complete this action.");
    expect(screen.getByDisplayValue("PCC work")).toBeInTheDocument();
  });

  test("saves the DPR without photos when Firebase Storage is unavailable", async () => {
    uploadBytesResumable.mockReturnValue({
      on: (event, progress, reject) =>
        reject({
          code: "storage/no-default-bucket",
          message: "Firebase Storage has not been set up",
        }),
    });
    renderFieldUpdate();
    completeRequiredForm();

    const image = new File(["photo"], "progress.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Site Progress Photos/), {
      target: { files: [image] },
    });
    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1].photos).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Photo upload is currently unavailable."
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Site update submitted successfully without photos."
    );
  });
  test("keeps an offline field entry as a local draft without attempting a Firestore write", async () => {
    const originalOnline = window.navigator.onLine;
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });

    try {
      hasFieldUpdateDraftContent.mockReturnValue(true);
      renderFieldUpdate();
      completeRequiredForm();
      fireEvent.click(screen.getByRole("button", { name: /offline.*reconnect/i }));

      expect(screen.getByRole("alert")).toHaveTextContent("Your entered site update remains saved as a local draft");
      expect(await screen.findByRole("status")).toHaveTextContent("Draft saved on this device");
      expect(saveFieldUpdateDraft).toHaveBeenCalled();
      expect(setDoc).not.toHaveBeenCalled();
    } finally {
      hasFieldUpdateDraftContent.mockReturnValue(false);
      Object.defineProperty(window.navigator, "onLine", { configurable: true, value: originalOnline });
    }
  });

  test("uses touch-friendly numeric input modes without exposing financial fields", () => {
    renderFieldUpdate();

    expect(screen.getByLabelText(/^Manpower Count/)).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText(/^Output Quantity/)).toHaveAttribute("inputmode", "decimal");
    expect(screen.queryByText(/Revenue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget/)).not.toBeInTheDocument();
  });
});
