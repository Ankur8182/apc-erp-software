import React from "react";
import { render, screen } from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import ClientBilling from "./ClientBilling";

jest.mock("../Components/Layout", () => ({ children }) => <>{children}</>);
jest.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ role: "admin", user: { uid: "admin-1" } }),
}));
jest.mock("../firebase", () => ({ db: {} }));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn((database, name) => ({ database, name })),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
  query: jest.fn((reference) => reference),
  runTransaction: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
  writeBatch: jest.fn(),
}));

const docSnapshot = (id, data) => ({ id, data: () => data });

const renderClientBilling = (recordsByCollection = {}) => {
  const collectionNames = [
    "sites", "clients", "siteBillingProfiles", "raBills",
    "clientReceipts", "raRetentionReleases", "invoices",
  ];
  let subscriptionIndex = 0;
  onSnapshot.mockImplementation((reference, onNext) => {
    void reference;
    const name = collectionNames[subscriptionIndex] || "";
    subscriptionIndex += 1;
    onNext({ docs: recordsByCollection[name] || [] });
    return jest.fn();
  });

  return render(<ClientBilling />);
};

beforeEach(() => {
  jest.clearAllMocks();
});

test("renders safely with empty Firebase collections during the initial loading render", async () => {
  renderClientBilling();

  expect(await screen.findByText("No RA bills match the selected filters.")).toBeInTheDocument();
  expect(screen.getByText("No client profiles yet.")).toBeInTheDocument();
  expect(screen.getByText("No site billing profiles yet.")).toBeInTheDocument();
  expect(screen.getByText("No client receipts yet.")).toBeInTheDocument();
  expect(screen.getByText("No retention releases yet.")).toBeInTheDocument();
  expect(screen.getByText("0 records")).toBeInTheDocument();
});

test("normalizes legacy Firestore documents with missing optional data without crashing the RA register", async () => {
  renderClientBilling({
    sites: [docSnapshot("site-1", null)],
    clients: [docSnapshot("client-1", {})],
    siteBillingProfiles: [docSnapshot("profile-1", {})],
    raBills: [docSnapshot("ra-1", {})],
    clientReceipts: [docSnapshot("receipt-1", {})],
    raRetentionReleases: [docSnapshot("release-1", {})],
    invoices: [docSnapshot("invoice-1", {})],
  });

  expect(await screen.findByText("RA Bill Register")).toBeInTheDocument();
  expect(screen.getByText("Unnamed client")).toBeInTheDocument();
  expect(screen.getByText("1 record")).toBeInTheDocument();
});