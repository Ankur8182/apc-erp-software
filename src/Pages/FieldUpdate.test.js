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
import { useDprOutboxSync } from "../hooks/useDprOutboxSync";

const mockUser = { uid: "supervisor-1", email: "supervisor@example.com" };
let mockIsOnline = true;
let mockOutboxEntries = [];
const mockQueueDpr = jest.fn();
const mockRetryPending = jest.fn();

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "supervisor", user: mockUser }),
}));
jest.mock("../firebase", () => ({ db: {}, storage: {} }));
jest.mock("../hooks/useDprOutboxSync", () => ({ useDprOutboxSync: jest.fn() }));
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
    onNext({ docs: [{ id: "site-1", data: () => ({ siteName: "Civil Site" }) }] });
    return jest.fn();
  });
  return render(<FieldUpdate />);
};

const completeRequiredForm = () => {
  fireEvent.change(screen.getByLabelText(/^Site/), { target: { value: "Civil Site" } });
  fireEvent.change(screen.getByLabelText(/^Date/), { target: { value: "2026-09-04" } });
  fireEvent.change(screen.getByLabelText(/^Work Activity/), { target: { value: "PCC work" } });
  fireEvent.change(screen.getByLabelText(/^Work Location/), { target: { value: "Block A" } });
  fireEvent.change(screen.getByLabelText(/^Manpower Count/), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText(/^Output Quantity/), { target: { value: "0" } });
};

describe("FieldUpdate submission", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockOutboxEntries = [];
    mockQueueDpr.mockResolvedValue({ created: true });
    mockRetryPending.mockResolvedValue();
    useDprOutboxSync.mockImplementation(() => ({
      isOnline: mockIsOnline,
      entries: mockOutboxEntries,
      summary: { pending: 0, syncing: 0, failed: 0, total: mockOutboxEntries.length },
      isSyncing: false,
      syncMessage: "",
      queueDpr: mockQueueDpr,
      retryPending: mockRetryPending,
    }));
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

  afterEach(() => consoleErrorSpy.mockRestore());

  test("saves a valid supervisor DPR with its authenticated UID, stable ID, and server timestamps", async () => {
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
      clientSubmissionId: expect.stringMatching(/^dpr-supervisor-1-/),
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Site update submitted successfully.");
  });

  test("keeps the form available and shows a safe error when the DPR save is denied", async () => {
    setDoc.mockRejectedValue({ code: "permission-denied" });
    renderFieldUpdate();
    completeRequiredForm();
    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to complete this action.");
    expect(screen.getByDisplayValue("PCC work")).toBeInTheDocument();
    expect(mockQueueDpr).not.toHaveBeenCalled();
  });

  test("queues a valid offline site update locally without claiming a Firestore save", async () => {
    mockIsOnline = false;
    renderFieldUpdate();
    completeRequiredForm();
    fireEvent.click(screen.getByRole("button", { name: /save on this device/i }));

    await waitFor(() => expect(mockQueueDpr).toHaveBeenCalledTimes(1));
    expect(mockQueueDpr).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ site: "Civil Site", createdBy: "supervisor-1" }),
      clientSubmissionId: expect.stringMatching(/^dpr-supervisor-1-/),
    }));
    expect(setDoc).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent("pending synchronization");
  });

  test("queues after a temporary Firestore failure but keeps permission failures out of retry queue", async () => {
    setDoc.mockRejectedValue({ code: "unavailable", message: "network offline" });
    renderFieldUpdate();
    completeRequiredForm();
    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    await waitFor(() => expect(mockQueueDpr).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("status")).toHaveTextContent("connection was interrupted");
  });

  test("saves the DPR without photos when Firebase Storage is unavailable", async () => {
    uploadBytesResumable.mockReturnValue({
      on: (event, progress, reject) => reject({ code: "storage/no-default-bucket" }),
    });
    renderFieldUpdate();
    completeRequiredForm();
    const image = new File(["photo"], "progress.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Site Progress Photos/), { target: { files: [image] } });
    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1].photos).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent("Photo upload is currently unavailable.");
    expect(screen.getByRole("status")).toHaveTextContent("submitted successfully without photos");
  });

  test("previews selected evidence and lets the field user remove it before submission", () => {
    const createObjectUrl = jest.fn(() => "blob:selected-site-photo");
    const revokeObjectUrl = jest.fn();
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });

    renderFieldUpdate();
    const image = new File(["photo"], "progress.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Site Progress Photos/), { target: { files: [image] } });

    expect(screen.getByRole("img", { name: "Selected site evidence 1" })).toHaveAttribute("src", "blob:selected-site-photo");
    fireEvent.click(screen.getByRole("button", { name: "Remove selected photo 1" }));
    expect(screen.queryByRole("img", { name: "Selected site evidence 1" })).not.toBeInTheDocument();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:selected-site-photo");
  });

  test("links uploaded evidence metadata to the confirmed DPR write", async () => {
    uploadBytesResumable.mockReturnValue({
      snapshot: { ref: { path: "photo-reference" } },
      on: (event, progress, reject, complete) => {
        void event;
        void reject;
        progress({ bytesTransferred: 10, totalBytes: 10 });
        complete();
      },
    });
    renderFieldUpdate();
    completeRequiredForm();
    const image = new File(["photo"], "progress.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Site Progress Photos/), { target: { files: [image] } });
    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(setDoc.mock.calls[0][1].photos).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^photo-/),
        storagePath: expect.stringMatching(/^dprPhotos\/supervisor-1\/new-dpr\/photo-[A-Za-z0-9_-]+[.]jpg$/),
        url: "https://example.com/photo",
        uploadedBy: "supervisor-1",
        contentType: "image/jpeg",
        size: 5,
      }),
    ]);
    expect(logAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      details: expect.stringMatching(/1 photo evidence item/),
    }));
  });

  test("keeps the selected DPR and photos available for retry after a non-fallback upload failure", async () => {
    uploadBytesResumable.mockReturnValue({
      on: (event, progress, reject) => {
        void event;
        void progress;
        reject({ code: "storage/unknown" });
      },
    });
    renderFieldUpdate();
    completeRequiredForm();
    const image = new File(["photo"], "progress.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText(/Site Progress Photos/), { target: { files: [image] } });
    fireEvent.click(screen.getByRole("button", { name: /submit site update/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Photo upload could not be completed.");
    expect(setDoc).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("PCC work")).toBeInTheDocument();
    expect(screen.getByText(/1 photo selected/i)).toBeInTheDocument();
  });
  test("uses touch-friendly numeric inputs without exposing financial fields", () => {
    renderFieldUpdate();
    expect(screen.getByLabelText(/^Manpower Count/)).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText(/^Output Quantity/)).toHaveAttribute("inputmode", "decimal");
    expect(screen.queryByText(/Revenue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Budget/)).not.toBeInTheDocument();
  });
});