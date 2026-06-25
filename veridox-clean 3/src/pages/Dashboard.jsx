import { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeftRight, ShieldAlert, TrendingUp, DollarSign, ArrowRight, Bell, ArrowUpRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const kycBadge = (status) => {
  const styles = {
    approved: { background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' },
    under_review: { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' },
    pending: { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' },
    rejected: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }
  };
  const labels = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };
  return <span style={{ ...styles[status], padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{labels[status] || status}</span>;
};

const StatCard = ({ label, value, sub, onClick, trend, alert }) => (
  <div onClick={onClick} style={{
    background: 'white', borderRadius: '10px', padding: '20px 24px',
    border: `1px solid ${alert ? '#FECACA' : '#E5E7EB'}`,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'border-color 0.15s',
  }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = '#9CA3AF'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = alert ? '#FECACA' : '#E5E7EB'; }}>
    <div style={{ color: '#6B7280', fontSize: '12px', fontWeight: '500', marginBottom: '10px' }}>{label}</div>
    <div style={{ color: alert ? '#B91C1C' : '#111827', fontSize: '26px', fontWeight: '700', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ color: alert ? '#EF4444' : '#9CA3AF', fontSize: '11px', marginTop: '6px' }}>{sub}</div>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <div style={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '6px' }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}><span style={{ color: p.fill }}>{p.name}: </span>{p.value}</div>)}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
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
    const [{ data: c }, { data: t }, { data: d }] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('disputes').select('*').order('created_at', { ascending: false }),
    ]);
    setClients(c || []);
    setTransactions(t || []);
    setDisputes(d || []);

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

  const totalClients = clients.length;
  const pendingKYC = clients.filter(c => c.status === 'pending').length;
  const approvedClients = clients.filter(c => c.status === 'approved').length;
  const rejectedClients = clients.filter(c => c.status === 'rejected').length;
  const needsAttention = clients.filter(c => c.status === 'under_review' || c.status === 'rejected');
  const totalTx = transactions.length;
  const totalVolume = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const successTx = transactions.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;
  const approvalRate = totalTx > 0 ? ((successTx / totalTx) * 100).toFixed(1) : 0;
  const openDisputes = disputes.filter(d => d.status === 'open').length;
  const overdueDisputes = disputes.filter(d => { if (!d.deadline || d.status === 'won' || d.status === 'lost') return false; return new Date(d.deadline) < new Date(); }).length;

  const alerts = [
    openDisputes > 0 && { type: 'warning', message: `${openDisputes} open dispute${openDisputes > 1 ? 's' : ''} need attention`, link: '/disputes' },
    overdueDisputes > 0 && { type: 'error', message: `${overdueDisputes} dispute${overdueDisputes > 1 ? 's' : ''} overdue`, link: '/disputes' },
    pendingKYC > 0 && { type: 'info', message: `${pendingKYC} client${pendingKYC > 1 ? 's' : ''} pending KYC review`, link: '/pipeline' },
    parseFloat(approvalRate) < 50 && totalTx > 0 && { type: 'warning', message: `Low approval rate: ${approvalRate}% — check routing rules`, link: '/routing' },
  ].filter(Boolean);

  const formatVolume = (v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `$${(v / 1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ padding: '32px 36px', fontFamily: "'Inter', sans-serif", background: '#FAFAFA', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '20px', fontWeight: '600', margin: 0 }}>{greeting}, {name}</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0', fontWeight: '400' }}>{today}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {alerts.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Bell size={13} color="#EF4444" />
              <span style={{ color: '#B91C1C', fontSize: '12px', fontWeight: '500' }}>{alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>
            </div>
          )}
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ color: '#15803D', fontSize: '12px', fontWeight: '500' }}>All systems operational</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
          {alerts.map((alert, i) => (
            <div key={i} onClick={() => navigate(alert.link)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', borderRadius: '8px', cursor: 'pointer', background: 'white', border: `1px solid ${alert.type === 'error' ? '#FECACA' : alert.type === 'warning' ? '#FDE68A' : '#BFDBFE'}` }}>
              <AlertTriangle size={13} color={alert.type === 'error' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'} />
              <span style={{ flex: 1, fontSize: '13px', color: '#374151' }}>{alert.message}</span>
              <ArrowRight size={13} color="#9CA3AF" />
            </div>
          ))}
        </div>
      )}

      {/* Section: Clients */}
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Client Overview</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
        <StatCard label="Total Clients" value={loading ? '—' : totalClients} onClick={() => navigate('/clients')} />
        <StatCard label="Pending KYC" value={loading ? '—' : pendingKYC} sub={pendingKYC > 0 ? 'Needs review' : 'All clear'} onClick={() => navigate('/pipeline')} />
        <StatCard label="Approved" value={loading ? '—' : approvedClients} onClick={() => navigate('/clients')} />
        <StatCard label="Rejected" value={loading ? '—' : rejectedClients} alert={rejectedClients > 0} onClick={() => navigate('/clients')} />
      </div>

      {/* Section: Payments */}
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Payment Overview</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '28px' }}>
        <StatCard label="Transactions" value={loading ? '—' : totalTx.toLocaleString()} onClick={() => navigate('/transactions')} />
        <StatCard label="Total Volume" value={loading ? '—' : formatVolume(totalVolume)} onClick={() => navigate('/analytics')} />
        <StatCard label="Approval Rate" value={loading ? '—' : `${approvalRate}%`} sub={parseFloat(approvalRate) < 50 && totalTx > 0 ? 'Below threshold' : 'Healthy'} alert={parseFloat(approvalRate) < 50 && totalTx > 0} onClick={() => navigate('/analytics')} />
        <StatCard label="Open Disputes" value={loading ? '—' : openDisputes} sub={overdueDisputes > 0 ? `${overdueDisputes} overdue` : 'No overdue'} alert={overdueDisputes > 0} onClick={() => navigate('/disputes')} />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>Transaction Volume</div>
              <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>Last 6 months</div>
            </div>
            <button onClick={() => navigate('/analytics')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6B7280', fontSize: '12px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}>
              View Analytics <ArrowUpRight size={13} />
            </button>
          </div>
          {txByMonth.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF', fontSize: '13px' }}>No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={txByMonth} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deposits" name="Deposits" fill="#111827" radius={[3, 3, 0, 0]} />
                <Bar dataKey="withdrawals" name="Withdrawals" fill="#E5E7EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #E5E7EB', padding: '20px 24px' }}>
          <div style={{ color: '#111827', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>Needs Attention</div>
          <div style={{ color: '#9CA3AF', fontSize: '12px', marginBottom: '16px' }}>Clients requiring action</div>
          {needsAttention.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>All clear</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {needsAttention.slice(0, 5).map(c => (
                <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', border: '1px solid #E5E7EB', cursor: 'pointer', background: 'white' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <div style={{ width: '28px', height: '28px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                    {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ color: '#111827', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{c.company_name}</div>
                  </div>
                  {kycBadge(c.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/add-client')}
            style={{ padding: '8px 16px', background: '#111827', border: '1px solid #111827', borderRadius: '7px', fontSize: '13px', fontWeight: '500', color: 'white', cursor: 'pointer' }}>
            + Add Client
          </button>
          {[
            { label: 'Analytics', link: '/analytics' },
            { label: 'Routing Rules', link: '/routing' },
            { label: 'Disputes', link: '/disputes' },
            { label: 'Cascading', link: '/cascading' },
          ].map(({ label, link }) => (
            <button key={link} onClick={() => navigate(link)}
              style={{ padding: '8px 16px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '7px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Clients */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#111827', fontSize: '14px', fontWeight: '600' }}>Recent Clients</div>
          <button onClick={() => navigate('/clients')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#6B7280', fontSize: '12px', fontWeight: '500', background: 'none', border: 'none', cursor: 'pointer' }}>
            View all <ArrowUpRight size={13} />
          </button>
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>Loading...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            No clients yet. <span style={{ color: '#111827', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate('/add-client')}>Add your first client</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                {['Client', 'Company', 'Country', 'Industry', 'KYC Status'].map(h => (
                  <th key={h} style={{ padding: '10px 24px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 5).map(client => (
                <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)}
                  style={{ borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '14px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                        {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
                      </div>
                      <div>
                        <div style={{ color: '#111827', fontSize: '13px', fontWeight: '500' }}>{client.first_name} {client.last_name}</div>
                        <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{client.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 24px', color: '#374151', fontSize: '13px' }}>{client.company_name || '—'}</td>
                  <td style={{ padding: '14px 24px', color: '#374151', fontSize: '13px' }}>{client.country || '—'}</td>
                  <td style={{ padding: '14px 24px', color: '#374151', fontSize: '13px' }}>{client.industry || '—'}</td>
                  <td style={{ padding: '14px 24px' }}>{kycBadge(client.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
