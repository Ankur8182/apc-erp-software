import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../auth/AuthProvider";
import { isFieldOnlyRole } from "../auth/authorization";
import "../Styles/Layout.css";

function Layout({ title, children }) {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "manager";
  const fieldOnly = isFieldOnlyRole(role);

  return (
    <div
      className={`layout${fieldOnly ? " field-layout" : ""}`}
      data-layout-mode={fieldOnly ? "field" : "erp"}
      data-write-access={canWrite}
    >
      <Sidebar />

      <div className="layout-main">
        <Header />

        <div className="layout-content">
          {title ? <h1 className="page-title">{title}</h1> : null}

          {fieldOnly ? (
            <p className="field-access-notice" role="status">
              <strong>📱 Field access</strong>
              Submit operational site updates and view your own DPR history. Financial and administration areas are restricted.
            </p>
          ) : !canWrite ? (
            <p className="read-only-notice" role="status">
              Viewer access: records can be viewed and filtered, but changes are unavailable.
            </p>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}

export default Layout;