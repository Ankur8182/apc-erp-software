import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import Login from "./Login";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock("../firebase", () => ({
  auth: {},
  db: {},
}));

describe("Login", () => {
  test("shows the official A P Construction brand without changing login controls", () => {
    render(<Login />);

    expect(screen.getByAltText("A P Construction logo")).toBeInTheDocument();
    expect(screen.getByText("A P CONSTRUCTION")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AP Construction ERP" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LOGIN" })).toBeInTheDocument();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    window.alert = jest.fn();
    doc.mockReturnValue({});
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ active: true, role: "manager" }),
    });
  });

  afterEach(() => {
    console.error.mockRestore();
  });
  test("requires an email address and password", () => {
    render(<Login />);
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("Email and Password are required.");
  });

  test("uses Firebase Authentication instead of a client-side credential", async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "user-1" } });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "manager@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() =>
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        "manager@example.com",
        "secure-password"
      )
    );

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  test("sends an authorized supervisor directly to Field Home", async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "supervisor-1" } });
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ active: true, role: "supervisor" }),
    });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "supervisor@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/field-dashboard")
    );
  });

  test("shows a safe retry message when Firebase authentication is unavailable", async () => {
    signInWithEmailAndPassword.mockRejectedValue({ code: "auth/network-request-failed" });
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "manager@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(
      "Unable to connect right now. Check your internet connection and try again."
    ));
  });
  test("signs out a Firebase user without an active ERP role", async () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "user-1" } });
    getDoc.mockResolvedValue({ exists: () => false });
    signOut.mockResolvedValue();
    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText("Email Address"), {
      target: { value: "unapproved@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));

    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(
      "This account does not have an active ERP role. Contact an administrator."
    );
  });
});
