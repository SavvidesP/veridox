import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientProfile from './pages/ClientProfile';
import KYCPipeline from './pages/KYCPipeline';
import AddClient from './pages/AddClient';
import Settings from './pages/Settings';
import Transactions from './pages/Transactions';
import Routing from './pages/Routing';
import Disputes from './pages/Disputes';
import FraudRules from './pages/FraudRules';
import Analytics from './pages/Analytics';
import Cascading from './pages/Cascading';
import TransactionDetail from './pages/TransactionDetail';
import Integrations from './pages/Integrations';
import TradingAccounts from './pages/TradingAccounts';
import TradingAccountDetail from './pages/TradingAccountDetail';
import TeamMemberDetail from './pages/TeamMemberDetail';
import BonusManagement from './pages/BonusManagement';
import IBAffiliate from './pages/IBAffiliate';
import FinancialReports from './pages/FinancialReports';
import WithdrawalApprovals from './pages/WithdrawalApprovals';
import DocumentCenter from './pages/DocumentCenter';
import CommunicationCenter from './pages/CommunicationCenter';
import SalesCRM from './pages/SalesCRM';
import ConvertedClients from './pages/ConvertedClients';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366F1', fontSize: '14px' }}>Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  return children;
}

// Admin-only routes: agents are redirected to the dashboard (defence-in-depth alongside hiding the nav).
// `loading` stays true until the profile is fetched, so the role check below never runs prematurely.
function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#6366F1', fontSize: '14px' }}>Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/" replace />;
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

// Wherever a password-recovery link lands, route to the reset-password page.
function RecoveryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) navigate('/reset-password', { replace: true });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <RecoveryRedirect />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Layout><ClientList /></Layout></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><Layout><ClientProfile /></Layout></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Layout><KYCPipeline /></Layout></ProtectedRoute>} />
        <Route path="/add-client" element={<AdminRoute><Layout><AddClient /></Layout></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><Layout><Settings /></Layout></AdminRoute>} />
        <Route path="/team/:id" element={<AdminRoute><Layout><TeamMemberDetail /></Layout></AdminRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
        <Route path="/transactions/:id" element={<ProtectedRoute><Layout><TransactionDetail /></Layout></ProtectedRoute>} />
        <Route path="/routing" element={<AdminRoute><Layout><Routing /></Layout></AdminRoute>} />
        <Route path="/disputes" element={<AdminRoute><Layout><Disputes /></Layout></AdminRoute>} />
        <Route path="/fraud-rules" element={<AdminRoute><Layout><FraudRules /></Layout></AdminRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
        <Route path="/cascading" element={<AdminRoute><Layout><Cascading /></Layout></AdminRoute>} />
        <Route path="/integrations" element={<AdminRoute><Layout><Integrations /></Layout></AdminRoute>} />
        <Route path="/trading-accounts" element={<ProtectedRoute><Layout><TradingAccounts /></Layout></ProtectedRoute>} />
        <Route path="/trading-accounts/:id" element={<ProtectedRoute><Layout><TradingAccountDetail /></Layout></ProtectedRoute>} />
        <Route path="/bonus-management" element={<AdminRoute><Layout><BonusManagement /></Layout></AdminRoute>} />
        <Route path="/ib-affiliate" element={<AdminRoute><Layout><IBAffiliate /></Layout></AdminRoute>} />
        <Route path="/financial-reports" element={<AdminRoute><Layout><FinancialReports /></Layout></AdminRoute>} />
        <Route path="/withdrawal-approvals" element={<ProtectedRoute><Layout><WithdrawalApprovals /></Layout></ProtectedRoute>} />
        <Route path="/document-center" element={<ProtectedRoute><Layout><DocumentCenter /></Layout></ProtectedRoute>} />
        <Route path="/communication-center" element={<ProtectedRoute><Layout><CommunicationCenter /></Layout></ProtectedRoute>} />
        <Route path="/sales-crm" element={<ProtectedRoute><Layout><SalesCRM /></Layout></ProtectedRoute>} />
        <Route path="/converted-clients" element={<ProtectedRoute><Layout><ConvertedClients /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
