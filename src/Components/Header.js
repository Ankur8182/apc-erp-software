import React from "react";
import "../Styles/Header.css";

function Header() {
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

        <span>👤 Admin</span>
      </div>
    </div>
  );
}

export default Header;