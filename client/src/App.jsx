import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import HelpWidget from './components/HelpWidget';
import Navbar from './components/Navbar';
import AppShell from './components/AppShell';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import DashboardPage from './pages/DashboardPage';
import AllClientsPage from './pages/AllClientsPage';
import NewClientPage from './pages/NewClientPage';
import DataManagementPage from './pages/DataManagementPage';
import NewsPage from './pages/NewsPage';
import Terms from './pages/Terms';
import OverviewPage from './pages/Overview';
import UploadPage from './pages/Upload';
import FeaturesPage from './pages/FeaturesPage';
import LibraryPage from './pages/LibraryPage';
import ExplorerPage from './pages/ExplorerPage';
import AIChatUpdated from './pages/AIChatUpdated';

/* Routes where the global top Navbar must be hidden (AppShell provides its own chrome). */
const SHELL_PREFIXES = [
  '/home', '/news', '/upload', '/overview', '/features',
  '/clients', '/data-management', '/dashboard',
  '/library', '/explorer', '/ai-chat-updated',
  /* legacy redirects — hide Navbar while the redirect happens */
  '/documents', '/doc-explorer',
  '/gst-case-laws', '/gst-notifications', '/gst-circulars', '/gst-orders',
];

const GlobalNavbar = () => {
  const { pathname } = useLocation();
  const hide = SHELL_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (hide) return null;
  return <Navbar />;
};

const AuthLayout = ({ children }) => (
  <div className="min-h-screen bg-bg-base font-sans">
    <div className="pt-[60px] min-h-screen">{children}</div>
  </div>
);

const RequireAuth = ({ children }) => {
  const { isAuthenticated, initialLoading } = useAuth();
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-sm text-[#5a4c3c]">Checking authentication…</div>
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/" replace />;
};

const RedirectIfAuthenticated = ({ children }) => {
  const { isAuthenticated, initialLoading } = useAuth();
  if (initialLoading) return null;
  return isAuthenticated ? <Navigate to="/home" replace /> : children;
};

const Shell = ({ children }) => (
  <RequireAuth><AppShell>{children}</AppShell></RequireAuth>
);

const App = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <Router>
          <GlobalNavbar />

          <Routes>
            {/* ── Public / auth ── */}
            <Route path="/"       element={<AuthLayout><RedirectIfAuthenticated><SignIn /></RedirectIfAuthenticated></AuthLayout>} />
            <Route path="/signup" element={<AuthLayout><RedirectIfAuthenticated><SignUp /></RedirectIfAuthenticated></AuthLayout>} />
            <Route path="/terms"  element={<Terms />} />

            {/* ── Core app pages ── */}
            <Route path="/home"            element={<Shell><DashboardPage /></Shell>} />
            <Route path="/dashboard"       element={<Shell><Dashboard /></Shell>} />
            <Route path="/data-management" element={<Shell><DataManagementPage /></Shell>} />
            <Route path="/clients"         element={<Shell><AllClientsPage /></Shell>} />
            <Route path="/clients/new"     element={<Shell><NewClientPage /></Shell>} />
            <Route path="/news"            element={<Shell><NewsPage /></Shell>} />
            <Route path="/upload"          element={<Shell><UploadPage /></Shell>} />
            <Route path="/overview"        element={<Shell><OverviewPage /></Shell>} />
            <Route path="/features"        element={<Shell><FeaturesPage /></Shell>} />

            {/* ── GST Documents — unified Library + Explorer ── */}
            <Route path="/library"  element={<Shell><LibraryPage /></Shell>} />
            <Route path="/explorer" element={<Shell><ExplorerPage /></Shell>} />

            {/* ── AI Chat (Updated) — case law RAG chat ── */}
            <Route path="/ai-chat-updated" element={<Shell><AIChatUpdated /></Shell>} />

            {/* ── Backward compat redirects ── */}
            <Route path="/documents"                   element={<Navigate to="/library"  replace />} />
            <Route path="/doc-explorer"                element={<Navigate to="/explorer" replace />} />
            <Route path="/gst-case-laws"               element={<Navigate to="/library"  replace />} />
            <Route path="/gst-case-laws/library"       element={<Navigate to="/library"  replace />} />
            <Route path="/gst-case-laws/explorer"      element={<Navigate to="/explorer" replace />} />
            <Route path="/gst-notifications"           element={<Navigate to="/library"  replace />} />
            <Route path="/gst-notifications/library"   element={<Navigate to="/library"  replace />} />
            <Route path="/gst-notifications/explorer"  element={<Navigate to="/explorer" replace />} />
            <Route path="/gst-circulars"               element={<Navigate to="/library"  replace />} />
            <Route path="/gst-circulars/library"       element={<Navigate to="/library"  replace />} />
            <Route path="/gst-circulars/explorer"      element={<Navigate to="/explorer" replace />} />
            <Route path="/gst-orders"                  element={<Navigate to="/library"  replace />} />
            <Route path="/gst-orders/library"          element={<Navigate to="/library"  replace />} />
            <Route path="/gst-orders/explorer"         element={<Navigate to="/explorer" replace />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <HelpWidget />
        </Router>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
