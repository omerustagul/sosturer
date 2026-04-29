import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import React, { lazy, Suspense, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Loading } from './components/common/Loading';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const RecordsList = lazy(() => import('./pages/records/RecordsList').then((m) => ({ default: m.RecordsList })));
const RecordForm = lazy(() => import('./pages/records/RecordForm').then((m) => ({ default: m.RecordForm })));
const BulkRecordEntry = lazy(() => import('./pages/records/BulkRecordEntry').then((m) => ({ default: m.BulkRecordEntry })));

const ReportsList = lazy(() => import('./pages/ReportsList'));
const ReportsMachines = lazy(() => import('./pages/reports/ReportsMachines').then((m) => ({ default: m.ReportsMachines })));
const ReportsProducts = lazy(() => import('./pages/reports/ReportsProducts').then((m) => ({ default: m.ReportsProducts })));
const ReportsOperators = lazy(() => import('./pages/reports/ReportsOperators').then((m) => ({ default: m.ReportsOperators })));
const ReportsGeneral = lazy(() => import('./pages/reports/ReportsGeneral').then((m) => ({ default: m.ReportsGeneral })));

const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })));
const Definitions = lazy(() => import('./pages/Definitions'));
const AppSettings = lazy(() => import('./pages/AppSettings').then((m) => ({ default: m.AppSettings })));
const Profile = lazy(() => import('./pages/Profile'));
const CompanyUsers = lazy(() => import('./pages/CompanyUsers'));
const SuperAdmin = lazy(() => import('./pages/SuperAdmin').then((m) => ({ default: m.SuperAdmin })));
const CompanyManagement = lazy(() => import('./pages/CompanyManagement').then((m) => ({ default: m.CompanyManagement })));

const OvertimeCreate = lazy(() => import('./pages/overtime/OvertimeCreate').then((m) => ({ default: m.OvertimeCreate })));
const OvertimeList = lazy(() => import('./pages/overtime/OvertimeList').then((m) => ({ default: m.OvertimeList })));
const OvertimeReports = lazy(() => import('./pages/overtime/OvertimeReports').then((m) => ({ default: m.OvertimeReports })));

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));

const ProductionPlanning = lazy(() => import('./pages/planning/ProductionPlanning').then((m) => ({ default: m.ProductionPlanning })));
const WorkPlanList = lazy(() => import('./pages/planning/WorkPlanList').then((m) => ({ default: m.WorkPlanList })));
const WorkPlanForm = lazy(() => import('./pages/planning/WorkPlanForm').then((m) => ({ default: m.WorkPlanForm })));
const ProductionOrders = lazy(() => import('./pages/planning/ProductionOrders').then((m) => ({ default: m.ProductionOrders })));
const ProductionOrderForm = lazy(() => import('./pages/planning/ProductionOrderForm').then(m => ({ default: m.ProductionOrderForm })));

const InventoryDashboard = lazy(() => import('./pages/inventory/InventoryDashboard').then((m) => ({ default: m.InventoryDashboard })));
const StockMovements = lazy(() => import('./pages/inventory/StockMovements').then((m) => ({ default: m.StockMovements })));
const StockVouchers = lazy(() => import('./pages/inventory/StockVouchers').then((m) => ({ default: m.StockVouchers })));
const StockVoucherForm = lazy(() => import('./pages/inventory/StockVoucherForm').then((m) => ({ default: m.StockVoucherForm })));
const OrdersList = lazy(() => import('./pages/sales/OrdersList').then((m) => ({ default: m.OrdersList })));
const CustomersList = lazy(() => import('./pages/sales/CustomersList').then((m) => ({ default: m.CustomersList })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { MotionConfig } from 'framer-motion';

function App() {
  const { fetchSettings, settings } = useSettingsStore();
  const { isAuthenticated, refreshUser } = useAuthStore();
  
  // Security: Auto-logout after 30 mins of inactivity
  useInactivityTimeout();

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser().then(() => fetchSettings());
    }
  }, [isAuthenticated, refreshUser, fetchSettings]);

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion={settings.animationsEnabled ? 'never' : 'always'}>
        <BrowserRouter>
          <Suspense fallback={<Loading size="lg" />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Dashboard />} />
                <Route path="records" element={<RecordsList />} />
                <Route path="records/new" element={<RecordForm />} />
                <Route path="records/bulk" element={<BulkRecordEntry />} />
                <Route path="records/edit/:id" element={<RecordForm />} />
                <Route path="reports" element={<ReportsList />} />
                <Route path="reports/machines" element={<ReportsMachines />} />
                <Route path="reports/products" element={<ReportsProducts />} />
                <Route path="reports/operators" element={<ReportsOperators />} />
                <Route path="reports/general" element={<ReportsGeneral />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="definitions" element={<Definitions />} />
                <Route path="definitions/:tab" element={<Definitions />} />
                <Route path="settings" element={<AppSettings />} />
                <Route path="profile" element={<Profile />} />
                <Route path="users" element={<CompanyUsers />} />
                <Route path="superadmin" element={<SuperAdmin />} />
                <Route path="company" element={<CompanyManagement />} />
                <Route path="overtime/create" element={<OvertimeCreate />} />
                <Route path="overtime/edit/:id" element={<OvertimeCreate />} />
                <Route path="overtime/list" element={<OvertimeList />} />
                <Route path="overtime/reports" element={<OvertimeReports />} />

                <Route path="inventory/dashboard" element={<InventoryDashboard />} />
                <Route path="inventory/movements" element={<StockMovements />} />
                <Route path="inventory/stock-vouchers" element={<StockVouchers />} />
                <Route path="inventory/stock-vouchers/new" element={<StockVoucherForm />} />
                <Route path="inventory/stock-vouchers/:voucherNo" element={<StockVoucherForm />} />
                <Route path="sales/orders" element={<OrdersList />} />
                <Route path="sales/customers" element={<CustomersList />} />

                <Route path="planning/production" element={<ProductionPlanning />} />
                <Route path="planning/work-plans" element={<WorkPlanList />} />
                <Route path="planning/work-plans/new" element={<WorkPlanForm />} />
                <Route path="planning/work-plans/edit/:id" element={<WorkPlanForm />} />
                <Route path="production-orders" element={<ProductionOrders />} />
                <Route path="production-orders/new" element={<ProductionOrderForm />} />
                <Route path="production-orders/:lotNumber" element={<ProductionOrderForm />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </ErrorBoundary>
  );
}

export default App;
