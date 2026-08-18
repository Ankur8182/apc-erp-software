import React from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import "../Styles/Layout.css";

function Layout({ title, children }) {
  return (
    <div className="layout">

      <Sidebar />

      <div className="layout-main">

        <Header />

        <div className="layout-content">

          <h1 className="page-title">{title}</h1>

          {children}

        </div>

      </div>

    </div>
  );
}

export default Layout;