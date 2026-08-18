import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import Labour from "./Pages/Labour";
import Sites from "./Pages/Sites";
import SiteDetails from "./Pages/SiteDetails";
import Materials from "./Pages/Materials";
import Expenses from "./Pages/Expenses";
import Attendance from "./Pages/Attendance";
import Salary from "./Pages/Salary";
import Vehicle from "./Pages/Vehicle";
import Invoice from "./Pages/Invoice";
import Reports from "./Pages/Reports";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/" element={<Login />} />

        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/labour" element={<Labour />} />

        <Route path="/sites" element={<Sites />} />

        {/* SITE DETAILS */}
        <Route
          path="/site-details/:id"
          element={<SiteDetails />}
        />

        <Route path="/materials" element={<Materials />} />

        <Route path="/expenses" element={<Expenses />} />

        <Route path="/attendance" element={<Attendance />} />

        <Route path="/salary" element={<Salary />} />

        <Route path="/vehicle" element={<Vehicle />} />

        <Route path="/invoice" element={<Invoice />} />

        <Route path="/reports" element={<Reports />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;