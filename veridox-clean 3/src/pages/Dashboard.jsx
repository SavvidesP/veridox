import { useEffect, useState } from 'react';
import { Users, Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeftRight, ShieldAlert, TrendingUp, TrendingDown, DollarSign, Activity, ArrowRight, Bell } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const kycBadge = (status) => {
  const styles = { approved: { background: '#DCFCE7', color: '#166534' }, under_review: { background: '#FEF9C3', color: '#854D0E' }, pending: { background: '#F1F5F9', color: '#475569' }, rejected: { background: '#FEE2E2', color: '#991B1B' } };
  const labels = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };
  return <span style={{ ...styles[status], padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{labels[status] || status}</span>;
};

const StatCard = ({ icon: Icon, label, value, iconBg, iconColor, sub, onClick, alert }) => (
  <div onClick={onClick} style={{ background: 'white', borderRadius: '12px', padding: '20px 24px', border: `1px solid ${alert ? '#FCA5A5' : '#E2E8F0'}`, boxShadow: alert ? '0 0 0 3px #FEE2E2' : '0 1px 3px rgba(0,0,0,0.04)', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ color: '#64748B', fontSize: '12px', fontWeight: '600', letterSpacing: '0.3px', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: '#0F172A', fontSize: '28px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ color: alert ? '#EF4444' : '#94A3B8', fontSize: '11px', fontWeight: '600', marginTop: '6px' }}>{sub}</div>}
      </div>
      <div style={{ width: '44px', height: '44px', background: iconBg, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={iconColor} />
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px', padding: '10px 14px' }}>
        <div style={{ color: '#94A3B8', fontSize: '12px', marginBottom: '4px' }}>{label}</div>
        {payload.map((p, i) => <div key={i} style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}><span style={{ color: p.color || p.fill }}>{p.name}: </span>{p.value}</div>)}
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
  const [fraudRules, setFraudRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txByMonth, setTxByMonth] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: c }, { data: t }, { data: d }, { data: f }] = await Promise.all([
      supabase.from('clients').select('*').order('created_at', { ascending: false }),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('disputes').select('*').order('created_at', { ascending: false }),
      supabase.from('fraud_rules').select('*').eq('status', 'active'),
    ]);
    setClients(c || []);
    setTransactions(t || []);
    setDisputes(d || []);
    setFraudRules(f || []);

    // Build monthly transaction chart
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

  // Client stats
  const totalClients = clients.length;
  const pendingKYC = clients.filter(c => c.status === 'pending').length;
  const approvedClients = clients.filter(c => c.status === 'approved').length;
  const rejectedClients = clients.filter(c => c.status === 'rejected').length;
  const needsAttention = clients.filter(c => c.status === 'under_review' || c.status === 'rejected');

  // Transaction stats
  const totalTx = transactions.length;
  const totalVolume = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const successTx = transactions.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;
  const approvalRate = totalTx > 0 ? ((successTx / totalTx) * 100).toFixed(1) : 0;

  // Dispute stats
  const openDisputes = disputes.filter(d => d.status === 'open').length;
  const overdueDisputes = disputes.filter(d => {
    if (!d.deadline || d.status === 'won' || d.status === 'lost') return false;
    return new Date(d.deadline) < new Date();
  }).length;

  // Alerts
  const alerts = [
    openDisputes > 0 && { type: 'warning', message: `${openDisputes} open dispute${openDisputes > 1 ? 's' : ''} need attention`, link: '/disputes' },
    overdueDisputes > 0 && { type: 'error', message: `${overdueDisputes} dispute${overdueDisputes > 1 ? 's' : ''} overdue!`, link: '/disputes' },
    pendingKYC > 0 && { type: 'info', message: `${pendingKYC} client${pendingKYC > 1 ? 's' : ''} pending KYC review`, link: '/pipeline' },
    parseFloat(approvalRate) < 50 && totalTx > 0 && { type: 'warning', message: `Low approval rate: ${approvalRate}% — check routing rules`, link: '/routing' },
  ].filter(Boolean);

  const formatVolume = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v.toFixed(0)}`;
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{greeting}, {name} 👋</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{today} · Veridox Workspace</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {alerts.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={14} color="#EF4444" />
              <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: '600' }}>{alerts.length} alert{alerts.length > 1 ? 's' : ''}</span>
            </div>
          )}
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ color: '#166534', fontSize: '12px', fontWeight: '600' }}>All systems operational</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {alerts.map((alert, i) => (
            <div key={i} onClick={() => navigate(alert.link)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', cursor: 'pointer', background: alert.type === 'error' ? '#FEF2F2' : alert.type === 'warning' ? '#FFFBEB' : '#EFF6FF', border: `1px solid ${alert.type === 'error' ? '#FECACA' : alert.type === 'warning' ? '#FDE68A' : '#BFDBFE'}` }}>
              <AlertTriangle size={15} color={alert.type === 'error' ? '#EF4444' : alert.type === 'warning' ? '#F59E0B' : '#3B82F6'} />
              <span style={{ flex: 1, fontSize: '13px', fontWeight: '600', color: alert.type === 'error' ? '#991B1B' : alert.type === 'warning' ? '#854D0E' : '#1D4ED8' }}>{alert.message}</span>
              <ArrowRight size={14} color="#94A3B8" />
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards - Row 1: Clients */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Client Overview</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <StatCard icon={Users} label="Total Clients" value={loading ? '...' : totalClients} iconBg="#EEF2FF" iconColor="#6366F1" onClick={() => navigate('/clients')} />
        <StatCard icon={Clock} label="Pending KYC" value={loading ? '...' : pendingKYC} iconBg="#FFFBEB" iconColor="#D97706" sub={pendingKYC > 0 ? 'Needs review' : 'All clear'} alert={pendingKYC > 3} onClick={() => navigate('/pipeline')} />
        <StatCard icon={CheckCircle} label="Approved" value={loading ? '...' : approvedClients} iconBg="#F0FDF4" iconColor="#16A34A" onClick={() => navigate('/clients')} />
        <StatCard icon={XCircle} label="Rejected" value={loading ? '...' : rejectedClients} iconBg="#FFF1F2" iconColor="#E11D48" onClick={() => navigate('/clients')} />
      </div>

      {/* KPI Cards - Row 2: Payments */}
      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Payment Overview</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        <StatCard icon={ArrowLeftRight} label="Transactions" value={loading ? '...' : totalTx.toLocaleString()} iconBg="#EEF2FF" iconColor="#6366F1" onClick={() => navigate('/transactions')} />
        <StatCard icon={DollarSign} label="Total Volume" value={loading ? '...' : formatVolume(totalVolume)} iconBg="#F0FDF4" iconColor="#16A34A" onClick={() => navigate('/analytics')} />
        <StatCard icon={TrendingUp} label="Approval Rate" value={loading ? '...' : `${approvalRate}%`} iconBg={parseFloat(approvalRate) < 50 ? '#FFF1F2' : '#F0FDF4'} iconColor={parseFloat(approvalRate) < 50 ? '#E11D48' : '#16A34A'} sub={parseFloat(approvalRate) < 50 ? '⚠️ Below threshold' : '✅ Healthy'} alert={parseFloat(approvalRate) < 50 && totalTx > 0} onClick={() => navigate('/analytics')} />
        <StatCard icon={ShieldAlert} label="Open Disputes" value={loading ? '...' : openDisputes} iconBg={openDisputes > 0 ? '#FFF1F2' : '#F0FDF4'} iconColor={openDisputes > 0 ? '#E11D48' : '#16A34A'} sub={overdueDisputes > 0 ? `${overdueDisputes} overdue!` : 'No overdue'} alert={overdueDisputes > 0} onClick={() => navigate('/disputes')} />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px', marginBottom: '20px' }}>
        {/* Transaction Volume Chart */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700' }}>Transaction Volume</div>
              <div style={{ color: '#64748B', fontSize: '12px' }}>Last 6 months</div>
            </div>
            <button onClick={() => navigate('/analytics')} style={{ color: '#6366F1', fontSize: '12px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}>Full Analytics →</button>
          </div>
          {txByMonth.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '13px' }}>No transaction data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={txByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deposits" name="Deposits" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" name="Withdrawals" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Needs Attention */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Needs Attention</div>
          <div style={{ color: '#64748B', fontSize: '12px', marginBottom: '16px' }}>Clients requiring action</div>
          {needsAttention.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>🎉 All clear!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {needsAttention.slice(0, 5).map(c => (
                <div key={c.id} onClick={() => navigate(`/clients/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                  <AlertTriangle size={14} color={c.status === 'rejected' ? '#E11D48' : '#D97706'} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.first_name} {c.last_name}</div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>{c.company_name}</div>
                  </div>
                  {kycBadge(c.status)}
                </div>
              ))}
              {needsAttention.length > 5 && (
                <button onClick={() => navigate('/pipeline')} style={{ color: '#6366F1', fontSize: '12px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center' }}>
                  +{needsAttention.length - 5} more →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: '+ Add Client', link: '/add-client', bg: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white' },
            { label: '📊 View Analytics', link: '/analytics', bg: 'white', color: '#475569' },
            { label: '⚡ Routing Rules', link: '/routing', bg: 'white', color: '#475569' },
            { label: '🛡️ Disputes', link: '/disputes', bg: 'white', color: '#475569' },
            { label: '🔀 Cascading', link: '/cascading', bg: 'white', color: '#475569' },
          ].map(({ label, link, bg, color }) => (
            <button key={link} onClick={() => navigate(link)}
              style={{ padding: '9px 18px', background: bg, border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Clients */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700' }}>Recent Clients</div>
          <button onClick={() => navigate('/clients')} style={{ color: '#6366F1', fontSize: '12px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
        </div>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</div>
        ) : clients.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No clients yet. <span style={{ color: '#6366F1', cursor: 'pointer' }} onClick={() => navigate('/add-client')}>Add your first client →</span></div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Client', 'Company', 'Country', 'Industry', 'KYC Status'].map(h => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.slice(0, 5).map(client => (
                <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: 'white' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '14px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', fontSize: '11px', fontWeight: '700' }}>
                        {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
                      </div>
                      <div>
                        <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{client.first_name} {client.last_name}</div>
                        <div style={{ color: '#94A3B8', fontSize: '11px' }}>{client.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.company_name}</td>
                  <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.country}</td>
                  <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.industry}</td>
                  <td style={{ padding: '14px 20px' }}>{kycBadge(client.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
