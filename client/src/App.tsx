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

const OvertimeCreate = lazy(() => import('./pages/overtime/OvertimeCreate').then((m) => ({ default: m.OvertimeCreate })));
const OvertimeList = lazy(() => import('./pages/overtime/OvertimeList').then((m) => ({ default: m.OvertimeList })));
const OvertimeReports = lazy(() => import('./pages/overtime/OvertimeReports').then((m) => ({ default: m.OvertimeReports })));

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then((m) => ({ default: m.Register })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
}

function App() {
  const { fetchSettings } = useSettingsStore();
  const { isAuthenticated, refreshUser } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      refreshUser().then(() => fetchSettings());
    }
  }, [isAuthenticated, refreshUser, fetchSettings]);

  return (
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
            <Route path="settings" element={<AppSettings />} />
            <Route path="profile" element={<Profile />} />
            <Route path="team" element={<CompanyUsers />} />
            <Route path="superadmin" element={<SuperAdmin />} />
            <Route path="overtime/create" element={<OvertimeCreate />} />
            <Route path="overtime/edit/:id" element={<OvertimeCreate />} />
            <Route path="overtime/list" element={<OvertimeList />} />
            <Route path="overtime/reports" element={<OvertimeReports />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
