import React from "react";
import { signOut } from "firebase/auth";
import "../Styles/Header.css";
import { auth } from "../firebase";
import { useAuth } from "../auth/AuthProvider";

function Header() {
  const { user } = useAuth();

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

        <span
          role="button"
          tabIndex={0}
          title="Sign out"
          aria-label="Sign out"
          onClick={handleLogout}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              handleLogout();
            }
          }}
        >
          👤 {user?.email || "User"}
        </span>
      </div>
    </div>
  );
}

export default Header;
