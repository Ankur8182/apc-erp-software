import React from "react";
import { BRAND_LOGO_ALT, BRAND_LOGO_SRC } from "../config/branding";
import "../Styles/Branding.css";

function BrandLogo({ className = "", alt = BRAND_LOGO_ALT }) {
  return <img className={`brand-logo ${className}`.trim()} src={BRAND_LOGO_SRC} alt={alt} />;
}

export default BrandLogo;