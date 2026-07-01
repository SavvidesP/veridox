import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Kanban, UserPlus, Settings, LogOut, ArrowLeftRight, Zap, ShieldAlert, ShieldX, BarChart2, GitBranch, Menu, X, Plug, LineChart, Gift, Network, FileText, ArrowDownCircle, FolderOpen, MessageCircle, Briefcase, ChevronDown, ChevronRight, CreditCard, Building2, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { roleLabel, isAdmin as isAdminRole } from '../lib/roles';
import NotificationBell from './NotificationBell';
import { useState, useEffect } from 'react';

const navGroups = [
  {
    label: 'Core',
    icon: LayoutDashboard,
    alwaysOpen: true,
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/clients', icon: Users, label: 'Clients' },
    ],
  },
  {
    label: 'Payments',
    icon: CreditCard,
    items: [
      { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
      { to: '/analytics', icon: BarChart2, label: 'Analytics' },
      { to: '/routing', icon: Zap, label: 'Smart Routing' },
      { to: '/cascading', icon: GitBranch, label: 'Cascading' },
    ],
  },
  {
    label: 'Forex Back Office',
    icon: Building2,
    items: [
      { to: '/bonus-management', icon: Gift, label: 'Bonus Management' },
      { to: '/withdrawal-approvals', icon: ArrowDownCircle, label: 'Withdrawals' },
      { to: '/communication-center', icon: MessageCircle, label: 'Communications' },
      { to: '/sales-crm', icon: Briefcase, label: 'Sales CRM' },
      { to: '/converted-clients', icon: UserCheck, label: 'Converted Clients' },
    ],
  },
  {
    label: 'System',
    icon: Settings,
    items: [
      { to: '/integrations', icon: Plug, label: 'Integrations' },
      { to: '/add-client', icon: UserPlus, label: 'Add Client' },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

const allNavItems = navGroups.flatMap(g => g.items);

// Panels restricted to admins — agents never see these in nav and can't open them by URL (see AdminRoute in App.jsx).
const ADMIN_ONLY = new Set(['/clients', '/routing', '/cascading', '/integrations', '/add-client', '/settings']);

const mobileNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/converted-clients', icon: UserCheck, label: 'Clients+' },
  { to: '/analytics', icon: BarChart2, label: 'Analytics' },
];

function NavGroup({ group, openGroups, setOpenGroups }) {
  const location = useLocation();
  const isOpen = openGroups.includes(group.label);
  const hasActive = group.items.some(item => location.pathname === item.to);
  const Icon = group.icon;

  if (group.alwaysOpen) {
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: '600', letterSpacing: '1px', padding: '6px 10px 4px', textTransform: 'uppercase' }}>{group.label}</div>
        {group.items.map(({ to, icon: ItemIcon, label }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', borderRadius: '6px',
            marginBottom: '1px', textDecoration: 'none', fontSize: '13.5px',
            fontWeight: isActive ? '600' : '400',
            color: isActive ? '#111827' : '#6B7280',
            background: isActive ? '#F3F4F6' : 'transparent',
            transition: 'all 0.1s ease',
          })}>
            <ItemIcon size={15} />
            {label}
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '4px' }}>
      <button
        onClick={() => setOpenGroups(prev => prev.includes(group.label) ? prev.filter(g => g !== group.label) : [...prev, group.label])}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px 10px', borderRadius: '6px', border: 'none',
          background: hasActive && !isOpen ? '#F3F4F6' : 'transparent',
          cursor: 'pointer', color: hasActive ? '#111827' : '#6B7280',
          fontSize: '13.5px', fontWeight: hasActive ? '600' : '500',
          textAlign: 'left', transition: 'all 0.1s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
        onMouseLeave={e => e.currentTarget.style.background = hasActive && !isOpen ? '#F3F4F6' : 'transparent'}>
        <Icon size={15} />
        <span style={{ flex: 1 }}>{group.label}</span>
        {isOpen ? <ChevronDown size={13} color="#9CA3AF" /> : <ChevronRight size={13} color="#9CA3AF" />}
      </button>
      {isOpen && (
        <div style={{ marginLeft: '10px', paddingLeft: '12px', borderLeft: '1px solid #E5E7EB', marginTop: '2px', marginBottom: '4px' }}>
          {group.items.map(({ to, icon: ItemIcon, label }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '6px',
              marginBottom: '1px', textDecoration: 'none', fontSize: '13px',
              fontWeight: isActive ? '600' : '400',
              color: isActive ? '#111827' : '#6B7280',
              background: isActive ? '#F3F4F6' : 'transparent',
              transition: 'all 0.1s ease',
            })}
            onMouseEnter={e => { if (!e.currentTarget.classList.contains('active')) e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = ''; }}>
              <ItemIcon size={14} />
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [openGroups, setOpenGroups] = useState(['Payments']);

  // Role-based nav: agents never see admin-only panels. Empty groups are dropped.
  const isAdmin = isAdminRole(profile?.role);
  const canSee = (to) => isAdmin || !ADMIN_ONLY.has(to);
  const visibleGroups = navGroups
    .map(g => ({ ...g, items: g.items.filter(i => canSee(i.to)) }))
    .filter(g => g.items.length > 0);
  const visibleAllItems = allNavItems.filter(i => canSee(i.to));
  const visibleMobileItems = mobileNavItems.filter(i => canSee(i.to));

  useEffect(() => {
    navGroups.forEach(group => {
      if (!group.alwaysOpen && group.items.some(item => location.pathname === item.to)) {
        setOpenGroups(prev => prev.includes(group.label) ? prev : [...prev, group.label]);
      }
    });
  }, [location.pathname]);

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
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F9FAFB', fontFamily: "'Inter', sans-serif" }}>
        <header style={{ background: 'white', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', background: '#111827', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M4 9 L7.5 13 L14 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ color: '#111827', fontWeight: '700', fontSize: '16px' }}>Veridox</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <NotificationBell />
            <button onClick={() => setMobileMenuOpen(true)}
              style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Menu size={18} color="#6B7280" />
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: '#111827', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <path d="M4 9 L7.5 13 L14 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ color: '#111827', fontWeight: '700', fontSize: '16px' }}>Veridox</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)}
                style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '7px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <X size={18} color="#6B7280" />
              </button>
            </div>
            <nav style={{ flex: 1, padding: '12px', overflowY: 'auto' }}>
              {visibleAllItems.map(({ to, icon: Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                  style={({ isActive }) => ({ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', marginBottom: '2px', textDecoration: 'none', fontSize: '15px', fontWeight: isActive ? '600' : '400', color: isActive ? '#111827' : '#6B7280', background: isActive ? '#F3F4F6' : 'transparent' })}>
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div style={{ padding: '16px', borderTop: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', background: '#111827', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: '700' }}>{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>{profile?.full_name || user?.email?.split('@')[0]}</div>
                  <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{roleLabel(profile?.role)}</div>
                </div>
                <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        <main style={{ flex: 1, overflowY: 'auto', paddingBottom: '70px' }}>
          {children}
        </main>

        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'white', borderTop: '1px solid #E5E7EB', display: 'flex', zIndex: 100 }}>
          {visibleMobileItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to}
              style={({ isActive }) => ({ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '10px 4px', textDecoration: 'none', color: isActive ? '#111827' : '#9CA3AF', borderTop: isActive ? '2px solid #111827' : '2px solid transparent' })}>
              <Icon size={20} />
              <span style={{ fontSize: '10px', fontWeight: '600' }}>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F9FAFB', fontFamily: "'Inter', sans-serif" }}>
      <aside style={{ width: '240px', minWidth: '240px', background: '#F8FAFC', display: 'flex', flexDirection: 'column', borderRight: '1px solid #E5E7EB' }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M4 9 L7.5 13 L14 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div style={{ color: '#111827', fontWeight: '700', fontSize: '15px', letterSpacing: '-0.3px' }}>Veridox</div>
              <div style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: '500', letterSpacing: '0.3px' }}>Compliance CRM</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {visibleGroups.map(group => (
            <NavGroup key={group.label} group={group} openGroups={openGroups} setOpenGroups={setOpenGroups} />
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', background: '#111827', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ color: '#111827', fontSize: '12px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name || user?.email?.split('@')[0] || 'User'}</div>
              <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{roleLabel(profile?.role)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <NotificationBell />
              <button onClick={handleSignOut} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }} title="Sign out">
                <LogOut size={14} />
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
