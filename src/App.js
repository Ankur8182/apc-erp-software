import React, { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute, { PublicOnlyRoute } from "./auth/ProtectedRoute";
import {
  ADMIN_ROLES,
  FIELD_UPDATE_ROLES,
  STANDARD_ERP_ROLES,
} from "./auth/authorization";
import "./Styles/ProfessionalDataPages.css";

const Login = lazy(() => import("./Pages/Login"));
const Dashboard = lazy(() => import("./Pages/Dashboard"));
const Labour = lazy(() => import("./Pages/Labour"));
const Sites = lazy(() => import("./Pages/Sites"));
const SiteDetails = lazy(() => import("./Pages/SiteDetails"));
const Materials = lazy(() => import("./Pages/Materials"));
const Inventory = lazy(() => import("./Pages/Inventory"));
const Vendors = lazy(() => import("./Pages/Vendors"));
const PurchaseRequests = lazy(() => import("./Pages/PurchaseRequests"));
const PurchaseOrders = lazy(() => import("./Pages/PurchaseOrders"));
const GoodsReceipts = lazy(() => import("./Pages/GoodsReceipts"));
const WorkOrders = lazy(() => import("./Pages/WorkOrders"));
const Boq = lazy(() => import("./Pages/Boq"));
const ClientBilling = lazy(() => import("./Pages/ClientBilling"));
const Expenses = lazy(() => import("./Pages/Expenses"));
const Attendance = lazy(() => import("./Pages/Attendance"));
const Salary = lazy(() => import("./Pages/Salary"));
const Vehicle = lazy(() => import("./Pages/Vehicle"));
const Invoice = lazy(() => import("./Pages/Invoice"));
const Reports = lazy(() => import("./Pages/Reports"));
const DailyProgressReport = lazy(() => import("./Pages/DailyProgressReport"));
const FieldUpdate = lazy(() => import("./Pages/FieldUpdate"));
const FieldDashboard = lazy(() => import("./Pages/FieldDashboard"));
const AuditLog = lazy(() => import("./Pages/AuditLog"));
const UserManagement = lazy(() => import("./Pages/UserManagement"));
const BackupRecovery = lazy(() => import("./Pages/BackupRecovery"));
const DataHealthMigration = lazy(() => import("./Pages/DataHealthMigration"));

const protectedPage = (page, allowedRoles = STANDARD_ERP_ROLES) => (
  <ProtectedRoute allowedRoles={allowedRoles}>{page}</ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<p role="status">Loading application...</p>}>
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
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
