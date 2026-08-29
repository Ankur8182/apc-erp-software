import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../Styles/Sidebar.css";

function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const menuItems = [
    { path: "/dashboard", icon: "🏠", label: "Dashboard" },
    { path: "/labour", icon: "👷", label: "Labour" },
    { path: "/sites", icon: "🏗️", label: "Sites" },
    { path: "/materials", icon: "📦", label: "Materials" },
    { path: "/expenses", icon: "💰", label: "Expenses" },
    { path: "/attendance", icon: "📅", label: "Attendance" },
    { path: "/salary", icon: "💵", label: "Salary" },
    { path: "/vehicle", icon: "🚚", label: "Vehicle" },
    { path: "/invoice", icon: "📜", label: "Invoice" },
    { path: "/daily-progress-report", icon: "📋", label: "Daily Progress" },
    { path: "/reports", icon: "📊", label: "Reports" },
  ];

  const closeSidebar = () => {
    setMobileOpen(false);
  };

  return (
    <>
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        ☰
      </button>

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-logo">
          <div className="logo-icon">🏗️</div>
          <div className="logo-text">
            <h2>AP ERP</h2>
            <span>Construction Management</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="sidebar-menu">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "active" : ""}`
              }
            >
              <span className="sidebar-menu-icon">
                {item.icon}
              </span>

              <span className="sidebar-menu-text">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-box">
            <span>🏢</span>

            <div>
              <strong>AP Construction</strong>
              <small>ERP Management System</small>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
