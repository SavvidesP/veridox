import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, UserPlus, Settings, LogOut, ArrowLeftRight, Zap, ShieldAlert, ShieldX, BarChart2, GitBranch } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
  { to: '/add-client', icon: UserPlus, label: 'Add Client' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const { signOut, profile, user } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

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
            <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
