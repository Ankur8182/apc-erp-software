import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../Styles/Sidebar.css";
import { useAuth } from "../auth/AuthProvider";
import {
  ADMIN_ROLES,
  FIELD_UPDATE_ROLES,
  STANDARD_ERP_ROLES,
} from "../auth/authorization";

function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useAuth();

  const menuItems = [
    { path: "/dashboard", icon: "🏠", label: "Dashboard", roles: STANDARD_ERP_ROLES },
    { path: "/labour", icon: "👷", label: "Labour", roles: STANDARD_ERP_ROLES },
    { path: "/sites", icon: "🏗️", label: "Sites", roles: STANDARD_ERP_ROLES },
    { path: "/materials", icon: "📦", label: "Materials", roles: STANDARD_ERP_ROLES },
    { path: "/inventory", icon: "📋", label: "Inventory", roles: STANDARD_ERP_ROLES },
    { path: "/vendors", icon: "🤝", label: "Vendors", roles: STANDARD_ERP_ROLES },
    { path: "/purchase-requests", icon: "📝", label: "Purchase Requests", roles: STANDARD_ERP_ROLES },
    { path: "/purchase-orders", icon: "📄", label: "Purchase Orders", roles: STANDARD_ERP_ROLES },
    { path: "/goods-receipts", icon: "🚚", label: "Goods Receipts", roles: STANDARD_ERP_ROLES },
    { path: "/expenses", icon: "💰", label: "Expenses", roles: STANDARD_ERP_ROLES },
    { path: "/attendance", icon: "📅", label: "Attendance", roles: STANDARD_ERP_ROLES },
    { path: "/salary", icon: "💵", label: "Salary", roles: STANDARD_ERP_ROLES },
    { path: "/vehicle", icon: "🚚", label: "Vehicle", roles: STANDARD_ERP_ROLES },
    { path: "/invoice", icon: "📜", label: "Invoice", roles: STANDARD_ERP_ROLES },
    { path: "/daily-progress-report", icon: "📋", label: "Daily Progress", roles: STANDARD_ERP_ROLES },
    { path: "/field-dashboard", icon: "📱", label: "Field Home", roles: FIELD_UPDATE_ROLES },
    { path: "/field-update", icon: "📱", label: "Field Update", roles: FIELD_UPDATE_ROLES },
    { path: "/reports", icon: "📊", label: "Reports", roles: STANDARD_ERP_ROLES },
    { path: "/audit-logs", icon: "🛡️", label: "Audit Log", roles: ADMIN_ROLES },
    { path: "/user-management", icon: "👥", label: "User Management", roles: ADMIN_ROLES },
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
          {menuItems.filter((item) => item.roles.includes(role)).map((item) => (
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
