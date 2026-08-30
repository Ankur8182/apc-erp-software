import React from "react";
import BrandLogo from "./BrandLogo";
import { COMPANY_NAME, ERP_NAME } from "../config/branding";
import "../Styles/Branding.css";

function PrintBrandHeader({ title = ERP_NAME }) {
  return (
    <div className="print-brand-header" aria-hidden="true">
      <BrandLogo />
      <div>
        <strong>{COMPANY_NAME}</strong>
        <span>{title}</span>
      </div>
    </div>
  );
}

export default PrintBrandHeader;