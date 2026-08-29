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

const mockUser = { uid: "supervisor-1", email: "supervisor@example.com" };

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);

jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "supervisor", user: mockUser }),
}));

jest.mock("../firebase", () => ({
  db: {},
  storage: {},
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
});
