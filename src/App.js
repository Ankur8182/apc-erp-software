import React from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import Login from "./Pages/Login";
import Dashboard from "./Pages/Dashboard";
import Labour from "./Pages/Labour";
import Sites from "./Pages/Sites";
import SiteDetails from "./Pages/SiteDetails";
import Materials from "./Pages/Materials";
import Inventory from "./Pages/Inventory";
import Vendors from "./Pages/Vendors";
import PurchaseRequests from "./Pages/PurchaseRequests";
import PurchaseOrders from "./Pages/PurchaseOrders";
import GoodsReceipts from "./Pages/GoodsReceipts";
import WorkOrders from "./Pages/WorkOrders";
import Boq from "./Pages/Boq";
import ClientBilling from "./Pages/ClientBilling";
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
import BackupRecovery from "./Pages/BackupRecovery";
import DataHealthMigration from "./Pages/DataHealthMigration";
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

          <Route path="/inventory" element={protectedPage(<Inventory />)} />

          <Route path="/vendors" element={protectedPage(<Vendors />)} />

          <Route path="/purchase-requests" element={protectedPage(<PurchaseRequests />)} />

          <Route path="/purchase-orders" element={protectedPage(<PurchaseOrders />)} />

          <Route path="/goods-receipts" element={protectedPage(<GoodsReceipts />)} />

          <Route path="/work-orders" element={protectedPage(<WorkOrders />)} />

          <Route path="/boq" element={protectedPage(<Boq />)} />

          <Route path="/client-billing" element={protectedPage(<ClientBilling />)} />

          <Route path="/expenses" element={protectedPage(<Expenses />)} />

          <Route path="/attendance" element={protectedPage(<Attendance />)} />

          <Route path="/salary" element={protectedPage(<Salary />)} />

          <Route path="/vehicle" element={protectedPage(<Vehicle />)} />

          <Route path="/invoice" element={protectedPage(<Invoice />)} />

          <Route path="/reports" element={protectedPage(<Reports />)} />

          <Route path="/daily-progress-report" element={protectedPage(<DailyProgressReport />)} />

          <Route path="/audit-logs" element={protectedPage(<AuditLog />, ADMIN_ROLES)} />

          <Route path="/user-management" element={protectedPage(<UserManagement />, ADMIN_ROLES)} />

          <Route path="/backup-recovery" element={protectedPage(<BackupRecovery />, ADMIN_ROLES)} />

          <Route path="/data-health-migration" element={protectedPage(<DataHealthMigration />, ADMIN_ROLES)} />

          <Route
            path="/field-update"
            element={protectedPage(<FieldUpdate />, FIELD_UPDATE_ROLES)}
          />

          <Route
            path="/field-dashboard"
            element={protectedPage(<FieldDashboard />, FIELD_UPDATE_ROLES)}
          />

          {/* Keep an unknown direct URL from rendering a blank application shell. */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
