import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { useAuth } from "../auth/AuthProvider";
import "../Styles/Layout.css";

function Layout({ title, children }) {
  const { role } = useAuth();
  const canWrite = role === "admin" || role === "manager";

  return (
    <div className="layout" data-write-access={canWrite}>

      <Sidebar />

      <div className="layout-main">

        <Header />

        <div className="layout-content">

          <h1 className="page-title">{title}</h1>

          {!canWrite && (
            <p className="read-only-notice" role="status">
              Viewer access: records can be viewed and filtered, but changes are unavailable.
            </p>
          )}

          {children}

        </div>

      </div>

    </div>
  );
}

export default Layout;
