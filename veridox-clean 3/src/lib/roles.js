// Central role model for Veridox.
// Department (conversion / retention) is encoded in the role name.
// Values match the profiles.role CHECK constraint in Supabase.

export const ROLE_OPTIONS = [
  { value: 'admin',              label: 'Admin / Manager' },
  { value: 'conversion_manager', label: 'Conversion Manager' },
  { value: 'retention_manager',  label: 'Retention Manager' },
  { value: 'conversion_agent',   label: 'Conversion Agent' },
  { value: 'retention_agent',    label: 'Retention Agent' },
];

export const ROLE_LABELS = {
  admin: 'Admin / Manager',
  conversion_manager: 'Conversion Manager',
  retention_manager: 'Retention Manager',
  conversion_agent: 'Conversion Agent',
  retention_agent: 'Retention Agent',
  // legacy fallbacks (pre-migration profiles)
  agent: 'Agent', analyst: 'Analyst', viewer: 'Viewer',
};

export const roleLabel = (r) => ROLE_LABELS[r] || (r ? r.replace(/_/g, ' ') : '—');

// ── Capability helpers ──
export const isAdmin   = (r) => r === 'admin';
export const isManager = (r) => r === 'admin' || r === 'conversion_manager' || r === 'retention_manager';
export const isAgent   = (r) => r === 'conversion_agent' || r === 'retention_agent';

// 'all' (admin) | 'conversion' | 'retention' | null
export const department = (r) =>
  r === 'admin' ? 'all'
  : (r && r.startsWith('conversion')) ? 'conversion'
  : (r && r.startsWith('retention')) ? 'retention'
  : null;

// ── Badge / pill colours per role ──
export const ROLE_STYLE = {
  admin:              { background: '#EEF2FF', color: '#4338CA' },
  conversion_manager: { background: '#ECFEFF', color: '#0E7490' },
  retention_manager:  { background: '#FEF3C7', color: '#B45309' },
  conversion_agent:   { background: '#F0FDF4', color: '#15803D' },
  retention_agent:    { background: '#FDF2F8', color: '#BE185D' },
  agent:              { background: '#F0FDF4', color: '#15803D' },
};
export const roleStyle = (r) => ROLE_STYLE[r] || ROLE_STYLE.agent;
