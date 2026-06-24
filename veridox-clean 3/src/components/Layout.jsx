import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, UserPlus, Settings, LogOut, ArrowLeftRight, Zap, ShieldAlert, ShieldX, BarChart2, GitBranch, Menu, X, Plug, LineChart, Gift, Network, FileText, ArrowDownCircle, FolderOpen, MessageCircle, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/pipeline', icon: Kanban, label: 'KYC Pipeline' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
  { to: '/routing', icon: Zap, label: 'Smart Routing' },
  { to: '/cascading', icon: GitBranch, label: 'Cascading' },
  { to: '/disputes', icon: ShieldAlert, label: 'Disputes' },
  { to: '/fraud-rules', icon: ShieldX, label: 'Anti-Fraud' },
  { to: '/trading-accounts', icon: LineChart, label: 'Trading Accounts' },
  { to: '/bonus-management', icon: Gift, label: 'Bonus Management' },
  { to: '/ib-affiliate', icon: Network, label: 'IB / Affiliate' },
  { to: '/financial-reports', icon: FileText, label: 'Financial Reports' },
  { to: '/withdrawal-approvals', icon: ArrowDownCircle, label: 'Withdrawals' },
  { to: '/document-center', icon: FolderOpen, label: 'Document Center' },
  { to: '/communication-center', icon: MessageCircle, label: 'Communications' },
  { to: '/sales-crm', icon: Briefcase, label: 'Sales CRM' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/add-client', icon: UserPlus, label: 'Add Client' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const mobileNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/disputes', icon: ShieldAlert, label: 'Disputes' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>
        <header style={{ background: '#0F172A', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E293B', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M4 9 L7.5 13 L14 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>Veridox</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotificationBell />
            <button onClick={() => setMobileMenuOpen(true)}
              style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Menu size={18} color="#94A3B8" />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div style={{ position: 'fixed', inset: 0, background: '#0F172A', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1E293B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <path d="M4 9 L7.5 13 L14 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ color: 'white', fontWeight: '700', fontSize: '16px' }}>Veridox</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)}
                style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={18} color="#94A3B8" />
              </button>
            </div>
            <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
              {navItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                  style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderRadius: '10px', marginBottom: '4px', textDecoration: 'none', fontSize: '15px', fontWeight: isActive ? '600' : '400', color: isActive ? 'white' : '#94A3B8', background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', borderLeft: isActive ? '2px solid #6366F1' : '2px solid transparent' })}>
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div style={{ padding: '16px', borderTop: '1px solid #1E293B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '700' }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>{profile?.full_name || user?.email?.split('@')[0]}</div>
                  <div style={{ color: '#475569', fontSize: '11px', textTransform: 'capitalize' }}>{profile?.role || 'analyst'}</div>
                </div>
                <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '70px' }}>
          {children}
        </main>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#0F172A', borderTop: '1px solid #1E293B', display: 'flex', zIndex: 100 }}>
          {mobileNavItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '10px 4px', textDecoration: 'none', color: isActive ? '#6366F1' : '#475569', borderTop: isActive ? '2px solid #6366F1' : '2px solid transparent' })}>
              <Icon size={20} />
              <span style={{ fontSize: '10px', fontWeight: '600' }}>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F1F5F9', fontFamily: "'Inter', sans-serif" }}>
      <aside style={{ width: '240px', minWidth: '240px', background: '#0F172A', display: 'flex', flexDirection: 'column', borderRight: '1px solid #1E293B' }}>
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9 L7.5 13 L14 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: '700', fontSize: '16px', letterSpacing: '-0.3px' }}>Veridox</div>
              <div style={{ color: '#475569', fontSize: '11px', fontWeight: '500', letterSpacing: '0.5px' }}>COMPLIANCE CRM</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          <div style={{ color: '#475569', fontSize: '10px', fontWeight: '600', letterSpacing: '1px', padding: '8px 10px 4px', textTransform: 'uppercase' }}>Menu</div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', marginBottom: '2px', textDecoration: 'none', fontSize: '13.5px', fontWeight: isActive ? '600' : '400', color: isActive ? 'white' : '#94A3B8', background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent', borderLeft: isActive ? '2px solid #6366F1' : '2px solid transparent', transition: 'all 0.15s ease' })}>
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '700' }}>{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: 'white', fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || user?.email?.split('@')[0] || 'User'}</div>
              <div style={{ color: '#475569', fontSize: '11px', textTransform: 'capitalize' }}>{profile?.role || 'analyst'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <NotificationBell />
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }} title="Sign out">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
