import React from "react";
import { signOut } from "firebase/auth";
import "../Styles/Header.css";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthProvider";

function Header() {
  const { role, user } = useAuth();
  const roleLabel = role
    ? `${role.charAt(0).toUpperCase()}${role.slice(1)}`
    : "User";

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Firebase logout error:", error);
      alert("Unable to sign out. Please try again.");
    }
  };

  return (
    <div className="header">
      <div className="header-left">
        <h2>🏗 AP Construction ERP</h2>
      </div>

      <div className="header-right">
        <input
          type="text"
          placeholder="Search..."
        />

        <span>🔔</span>

        <button
          type="button"
          className="header-logout-btn"
          title="Sign out"
          aria-label="Sign out"
          onClick={handleLogout}
        >
          <span className="header-user-identity">👤 {user?.email || "User"}</span>
          <small>{roleLabel}</small>
          <strong>Logout</strong>
        </button>
      </div>
    </div>
  );
}

export default Header;
