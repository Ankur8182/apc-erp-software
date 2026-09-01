import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import "../Styles/Sidebar.css";
import { useAuth } from "../auth/AuthProvider";
import {
  ADMIN_ROLES,
  FIELD_UPDATE_ROLES,
  isFieldOnlyRole,
  STANDARD_ERP_ROLES,
} from "../auth/authorization";
import BrandLogo from "./BrandLogo";
import { COMPANY_NAME, ERP_NAME } from "../config/branding";

function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role } = useAuth();
  const fieldOnly = isFieldOnlyRole(role);

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
    { path: "/work-orders", icon: "🧱", label: "Work Orders", roles: STANDARD_ERP_ROLES },
    { path: "/boq", icon: "📐", label: "BOQ & Measurement", roles: STANDARD_ERP_ROLES },
    { path: "/client-billing", icon: "🧾", label: "Client Billing", roles: STANDARD_ERP_ROLES },
    { path: "/expenses", icon: "💰", label: "Expenses", roles: STANDARD_ERP_ROLES },
    { path: "/attendance", icon: "📅", label: "Attendance", roles: STANDARD_ERP_ROLES },
    { path: "/salary", icon: "💵", label: "Salary", roles: STANDARD_ERP_ROLES },
    { path: "/vehicle", icon: "🚚", label: "Vehicle", roles: STANDARD_ERP_ROLES },
    { path: "/invoice", icon: "📜", label: "Invoice", roles: STANDARD_ERP_ROLES },
    { path: "/daily-progress-report", icon: "📋", label: "Daily Progress", roles: STANDARD_ERP_ROLES },
    { path: "/field-dashboard", icon: "📱", label: "Field Home", roles: FIELD_UPDATE_ROLES },
    { path: "/field-update", icon: "✍️", label: "Field Update", roles: FIELD_UPDATE_ROLES },
    { path: "/reports", icon: "📊", label: "Reports", roles: STANDARD_ERP_ROLES },
    { path: "/audit-logs", icon: "🛡️", label: "Audit Log", roles: ADMIN_ROLES },
    { path: "/system-health", icon: "🩺", label: "System Health", roles: ADMIN_ROLES },
    { path: "/backup-recovery", icon: "🗄️", label: "Backup & Recovery", roles: ADMIN_ROLES },
    { path: "/data-health-migration", icon: "🩺", label: "Data Health & Migration", roles: ADMIN_ROLES },
    { path: "/user-management", icon: "👥", label: "User Management", roles: ADMIN_ROLES },
  ];
  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(role));
  const fieldMenuItems = visibleMenuItems.filter((item) =>
    ["/field-dashboard", "/field-update"].includes(item.path)
  );

  const closeSidebar = () => setMobileOpen(false);

  return (
    <>
      <button
        type="button"
        className={`mobile-menu-btn${fieldOnly ? " field-mobile-menu-btn" : ""}`}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((open) => !open)}
      >
        ☰
      </button>

      {mobileOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar${mobileOpen ? " sidebar-open" : ""}${fieldOnly ? " field-sidebar" : ""}`}>
        <div className="sidebar-logo">
          <BrandLogo className="sidebar-brand-logo" />
          <div className="logo-text">
            <h2>{COMPANY_NAME}</h2>
            <span>{ERP_NAME}</span>
          </div>
        </div>

        <div className="sidebar-divider" />

        <nav className="sidebar-menu" aria-label="ERP navigation">
          {visibleMenuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <span className="sidebar-menu-icon">{item.icon}</span>
              <span className="sidebar-menu-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-box">
            <span>🏢</span>
            <div>
              <strong>{COMPANY_NAME}</strong>
              <small>{fieldOnly ? "Field operations" : ERP_NAME}</small>
            </div>
          </div>
        </div>
      </aside>

      {fieldOnly && (
        <nav className="field-mobile-nav" aria-label="Field mobile navigation">
          {fieldMenuItems.map((item) => (
            <NavLink
              key={`mobile-${item.path}`}
              to={item.path}
              className={({ isActive }) => `field-mobile-nav-link ${isActive ? "active" : ""}`}
              aria-label={item.label}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.path === "/field-dashboard" ? "Home" : "Update"}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </>
  );
}

export default Sidebar;