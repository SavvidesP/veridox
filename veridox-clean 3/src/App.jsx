import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientProfile from './pages/ClientProfile';
import KYCPipeline from './pages/KYCPipeline';
import AddClient from './pages/AddClient';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/clients" element={<Layout><ClientList /></Layout>} />
        <Route path="/clients/:id" element={<Layout><ClientProfile /></Layout>} />
        <Route path="/pipeline" element={<Layout><KYCPipeline /></Layout>} />
        <Route path="/add-client" element={<Layout><AddClient /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
