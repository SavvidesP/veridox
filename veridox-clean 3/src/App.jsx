import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
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
import BonusManagement from './pages/BonusManagement';
import IBAffiliate from './pages/IBAffiliate';
import FinancialReports from './pages/FinancialReports';

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Layout><ClientList /></Layout></ProtectedRoute>} />
        <Route path="/clients/:id" element={<ProtectedRoute><Layout><ClientProfile /></Layout></ProtectedRoute>} />
        <Route path="/pipeline" element={<ProtectedRoute><Layout><KYCPipeline /></Layout></ProtectedRoute>} />
        <Route path="/add-client" element={<ProtectedRoute><Layout><AddClient /></Layout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Layout><Transactions /></Layout></ProtectedRoute>} />
        <Route path="/transactions/:id" element={<ProtectedRoute><Layout><TransactionDetail /></Layout></ProtectedRoute>} />
        <Route path="/routing" element={<ProtectedRoute><Layout><Routing /></Layout></ProtectedRoute>} />
        <Route path="/disputes" element={<ProtectedRoute><Layout><Disputes /></Layout></ProtectedRoute>} />
        <Route path="/fraud-rules" element={<ProtectedRoute><Layout><FraudRules /></Layout></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
        <Route path="/cascading" element={<ProtectedRoute><Layout><Cascading /></Layout></ProtectedRoute>} />
        <Route path="/integrations" element={<ProtectedRoute><Layout><Integrations /></Layout></ProtectedRoute>} />
        <Route path="/trading-accounts" element={<ProtectedRoute><Layout><TradingAccounts /></Layout></ProtectedRoute>} />
        <Route path="/bonus-management" element={<ProtectedRoute><Layout><BonusManagement /></Layout></ProtectedRoute>} />
        <Route path="/ib-affiliate" element={<ProtectedRoute><Layout><IBAffiliate /></Layout></ProtectedRoute>} />
        <Route path="/financial-reports" element={<ProtectedRoute><Layout><FinancialReports /></Layout></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
