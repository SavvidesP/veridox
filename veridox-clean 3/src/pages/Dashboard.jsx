import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/cache';
import { useAuth } from '../contexts/AuthContext';
import ConversionAgentDashboard from './ConversionAgentDashboard';
import ConversionManagerDashboard from './ConversionManagerDashboard';

const kycBadge = (status) => {
  const styles = {
    approved:     { background: 'transparent', color: '#16A34A', border: '1px solid #BBF7D0' },
    under_review: { background: 'transparent', color: '#D97706', border: '1px solid #FDE68A' },
    pending:      { background: 'transparent', color: '#9CA3AF', border: '1px solid #E5E7EB' },
    rejected:     { background: 'transparent', color: '#DC2626', border: '1px solid #FECACA' },
  };
  const labels = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };
  return (
    <span style={{
      ...styles[status],
      padding: '2px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.3px',
    }}>
      {labels[status] || status}
    </span>
  );
};

const StatCard = ({ label, value, sub, onClick, alert }) => (
  <div
    onClick={onClick}
    style={{
      background: '#fff',
      borderRadius: '6px',
      padding: '24px 28px',
      border: `1px solid ${alert ? '#FECACA' : '#E5E7EB'}`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color 0.12s',
    }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = '#9CA3AF'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = alert ? '#FECACA' : '#E5E7EB'; }}
  >
    <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
    <div style={{ color: alert ? '#DC2626' : '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ color: alert ? '#EF4444' : '#9CA3AF', fontSize: '12px', marginTop: '8px', fontWeight: '400' }}>{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '10px 14px' }}>
        <div style={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '6px' }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>
            <span style={{ color: p.fill === '#111827' ? '#6B7280' : p.fill }}>{p.name}: </span>{p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Role-aware dashboard: each role gets its own view.
export default function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role;
  if (role === 'conversion_agent') return <ConversionAgentDashboard />;
  if (role === 'conversion_manager') return <ConversionManagerDashboard />;
  // retention_agent / retention_manager → own dashboards (next phases).
  // admin / manager (and any legacy role) → the full overview below.
  return <AdminDashboard />;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const [clients, setClients] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txByMonth, setTxByMonth] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [c, t, d] = await Promise.all([
      cachedQuery('clients', () => supabase.from('clients').select('*').order('created_at', { ascending: false }).then(r => r.data || [])),
      cachedQuery('transactions', () => supabase.from('transactions').select('*').order('created_at', { ascending: false }).then(r => r.data || [])),
      cachedQuery('disputes', () => supabase.from('disputes').select('*').order('created_at', { ascending: false }).then(r => r.data || [])),
    ]);
    setClients(c);
    setTransactions(t);
    setDisputes(d);

    const monthMap = {};
    ;(t || []).forEach(tx => {
      if (!tx.created_date) return;
      const month = new Date(tx.created_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (!monthMap[month]) monthMap[month] = { month, deposits: 0, withdrawals: 0 };
      if (tx.type?.toLowerCase() === 'deposit') monthMap[month].deposits++;
      else monthMap[month].withdrawals++;
    });
    const sorted = Object.values(monthMap).sort((a, b) => new Date('01 ' + a.month) - new Date('01 ' + b.month));
    setTxByMonth(sorted.slice(-6));
    setLoading(false);
  }

  const totalClients    = clients.length;
  const pendingKYC      = clients.filter(c => c.status === 'pending').length;
  const approvedClients = clients.filter(c => c.status === 'approved').length;
  const rejectedClients = clients.filter(c => c.status === 'rejected').length;
  const needsAttention  = clients.filter(c => c.status === 'under_review' || c.status === 'rejected');
  const totalTx         = transactions.length;
  const totalVolume     = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const successTx       = transactions.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;
  const approvalRate    = totalTx > 0 ? ((successTx / totalTx) * 100).toFixed(1) : 0;
  const openDisputes    = disputes.filter(d => d.status === 'open').length;
  const overdueDisputes = disputes.filter(d => {
    if (!d.deadline || d.status === 'won' || d.status === 'lost') return false;
    return new Date(d.deadline) < new Date();
  }).length;

  const alerts = [
    openDisputes > 0    && { type: 'warning', message: `${openDisputes} open dispute${openDisputes > 1 ? 's' : ''} need attention`, link: '/disputes' },
    overdueDisputes > 0 && { type: 'error',   message: `${overdueDisputes} dispute${overdueDisputes > 1 ? 's' : ''} overdue`, link: '/disputes' },
    pendingKYC > 0      && { type: 'info',    message: `${pendingKYC} client${pendingKYC > 1 ? 's' : ''} pending KYC review`, link: '/pipeline' },
    parseFloat(approvalRate) < 50 && totalTx > 0 && { type: 'warning', message: `Low approval rate: ${approvalRate}% — check routing rules`, link: '/routing' },
  ].filter(Boolean);

  const formatVolume = (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
  const today    = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name     = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  const sectionLabel = (text) => (
    <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
  );

  const divider = <div style={{ borderTop: '1px solid #F3F4F6', margin: '32px 0' }} />;

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>
            {greeting}, {name}
          </h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {alerts.length > 0 && (
            <div style={{ border: '1px solid #FECACA', borderRadius: '5px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={12} color="#EF4444" />
              <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: '600' }}>{alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>
            </div>
          )}
          <div style={{ border: '1px solid #BBF7D0', borderRadius: '5px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ color: '#16A34A', fontSize: '12px', fontWeight: '600' }}>All systems operational</span>
          </div>
        </div>
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '32px' }}>
          {alerts.map((alert, i) => (
            <div
              key={i}
              onClick={() => navigate(alert.link)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderRadius: '5px', cursor: 'pointer',
                border: `1px solid ${alert.type === 'error' ? '#FECACA' : alert.type === 'warning' ? '#FDE68A' : '#BFDBFE'}`,
                background: '#fff',
              }}
            >
              <AlertTriangle size={13} color={alert.type === 'error' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'} />
              <span style={{ flex: 1, fontSize: '13px', color: '#374151' }}>{alert.message}</span>
              <ArrowRight size={12} color="#D1D5DB" />
            </div>
          ))}
        </div>
      )}

      {/* ── Clients ── */}
      {sectionLabel('Clients')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <StatCard label="Total" value={loading ? '—' : totalClients} onClick={() => navigate('/clients')} />
        <StatCard label="Pending KYC" value={loading ? '—' : pendingKYC} sub={pendingKYC > 0 ? 'Needs review' : 'All clear'} onClick={() => navigate('/pipeline')} />
        <StatCard label="Approved" value={loading ? '—' : approvedClients} onClick={() => navigate('/clients')} />
        <StatCard label="Rejected" value={loading ? '—' : rejectedClients} alert={rejectedClients > 0} onClick={() => navigate('/clients')} />
      </div>

      {divider}

      {/* ── Payments ── */}
      {sectionLabel('Payments')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <StatCard label="Transactions" value={loading ? '—' : totalTx.toLocaleString()} onClick={() => navigate('/transactions')} />
        <StatCard label="Volume" value={loading ? '—' : formatVolume(totalVolume)} onClick={() => navigate('/analytics')} />
        <StatCard label="Approval Rate" value={loading ? '—' : `${approvalRate}%`} sub={parseFloat(approvalRate) < 50 && totalTx > 0 ? 'Below threshold' : 'Healthy'} alert={parseFloat(approvalRate) < 50 && totalTx > 0} onClick={() => navigate('/analytics')} />
        <StatCard label="Open Disputes" value={loading ? '—' : openDisputes} sub={overdueDisputes > 0 ? `${overdueDisputes} overdue` : 'No overdue'} alert={overdueDisputes > 0} onClick={() => navigate('/disputes')} />
      </div>

      {divider}

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '32px' }}>

        {/* Bar chart */}
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div style={{ color: '#111827', fontSize: '15px', fontWeight: '600', letterSpacing: '-0.2px' }}>Transaction Volume</div>
              <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '3px' }}>Last 6 months</div>
            </div>
            <button onClick={() => navigate('/analytics')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9CA3AF', fontSize: '12px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Analytics <ArrowUpRight size={12} />
            </button>
          </div>
          {txByMonth.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#D1D5DB', fontSize: '13px' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={txByMonth} barSize={12} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="deposits"    name="Deposits"    fill="#111827" radius={[3, 3, 0, 0]} />
                <Bar dataKey="withdrawals" name="Withdrawals" fill="#E5E7EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Needs Attention */}
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', padding: '24px 28px' }}>
          <div style={{ color: '#111827', fontSize: '15px', fontWeight: '600', letterSpacing: '-0.2px', marginBottom: '3px' }}>Needs Attention</div>
          <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '20px' }}>Clients requiring action</div>
          {needsAttention.length === 0 ? (
            <div style={{ color: '#D1D5DB', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>All clear</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {needsAttention.slice(0, 5).map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: '5px', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ width: '28px', height: '28px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                    {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ color: '#111827', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{c.company_name || '—'}</div>
                  </div>
                  {kycBadge(c.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {divider}

      {/* ── Quick Actions ── */}
      <div style={{ marginBottom: '32px' }}>
        {sectionLabel('Quick Actions')}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/add-client')}
            style={{ padding: '8px 18px', background: '#111827', border: '1px solid #111827', borderRadius: '5px', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer', letterSpacing: '0.1px' }}
          >
            + Add Client
          </button>
          {[
            { label: 'Analytics',     link: '/analytics' },
            { label: 'Routing Rules', link: '/routing' },
            { label: 'Disputes',      link: '/disputes' },
            { label: 'Cascading',     link: '/cascading' },
          ].map(({ label, link }) => (
            <button
              key={link}
              onClick={() => navigate(link)}
              style={{ padding: '8px 18px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {divider}

      {/* ── Recent Clients table ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ color: '#111827', fontSize: '15px', fontWeight: '600', letterSpacing: '-0.2px' }}>Recent Clients</div>
          <button onClick={() => navigate('/clients')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#9CA3AF', fontSize: '12px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            View all <ArrowUpRight size={12} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>
            No clients yet.{' '}
            <span style={{ color: '#111827', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/add-client')}>
              Add your first client
            </span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Client', 'Company', 'Country', 'Industry', 'KYC Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 8).map((client, idx) => (
                <tr
                  key={client.id}
                  onClick={() => navigate(`/clients/${client.id}`)}
                  style={{ borderBottom: idx < 7 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ padding: '16px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '30px', height: '30px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                        {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
                      </div>
                      <div>
                        <div style={{ color: '#111827', fontSize: '13px', fontWeight: '500' }}>{client.first_name} {client.last_name}</div>
                        <div style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '1px' }}>{client.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px 16px', color: '#374151', fontSize: '13px' }}>{client.company_name || '—'}</td>
                  <td style={{ padding: '16px 16px', color: '#374151', fontSize: '13px' }}>{client.country || '—'}</td>
                  <td style={{ padding: '16px 16px', color: '#374151', fontSize: '13px' }}>{client.industry || '—'}</td>
                  <td style={{ padding: '16px 16px' }}>{kycBadge(client.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
