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
import DailyProgressReport from "./Pages/DailyProgressReport";
import FieldUpdate from "./Pages/FieldUpdate";
import FieldDashboard from "./Pages/FieldDashboard";
import AuditLog from "./Pages/AuditLog";
import UserManagement from "./Pages/UserManagement";
import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute, { PublicOnlyRoute } from "./auth/ProtectedRoute";
import {
  ADMIN_ROLES,
  FIELD_UPDATE_ROLES,
  STANDARD_ERP_ROLES,
} from "./auth/authorization";
import "./Styles/ProfessionalDataPages.css";

const protectedPage = (page, allowedRoles = STANDARD_ERP_ROLES) => (
  <ProtectedRoute allowedRoles={allowedRoles}>{page}</ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          <Route path="/" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />

          <Route path="/dashboard" element={protectedPage(<Dashboard />)} />

          <Route path="/labour" element={protectedPage(<Labour />)} />

          <Route path="/sites" element={protectedPage(<Sites />)} />

          {/* SITE DETAILS */}
          <Route
            path="/site-details/:id"
            element={protectedPage(<SiteDetails />)}
          />

          <Route path="/materials" element={protectedPage(<Materials />)} />

          <Route path="/expenses" element={protectedPage(<Expenses />)} />

          <Route path="/attendance" element={protectedPage(<Attendance />)} />

          <Route path="/salary" element={protectedPage(<Salary />)} />

          <Route path="/vehicle" element={protectedPage(<Vehicle />)} />

          <Route path="/invoice" element={protectedPage(<Invoice />)} />

          <Route path="/reports" element={protectedPage(<Reports />)} />

          <Route path="/daily-progress-report" element={protectedPage(<DailyProgressReport />)} />

          <Route path="/audit-logs" element={protectedPage(<AuditLog />, ADMIN_ROLES)} />

          <Route path="/user-management" element={protectedPage(<UserManagement />, ADMIN_ROLES)} />

          <Route
            path="/field-update"
            element={protectedPage(<FieldUpdate />, FIELD_UPDATE_ROLES)}
          />

          <Route
            path="/field-dashboard"
            element={protectedPage(<FieldDashboard />, FIELD_UPDATE_ROLES)}
          />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
