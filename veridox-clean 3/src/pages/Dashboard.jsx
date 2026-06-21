import { Users, Clock, CheckCircle, XCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { dashboardStats, monthlyData, clients } from '../data/mockData';
import { useNavigate } from 'react-router-dom';

const kycBadge = (status) => {
  const styles = {
    approved: { background: '#DCFCE7', color: '#166534' },
    under_review: { background: '#FEF9C3', color: '#854D0E' },
    pending: { background: '#F1F5F9', color: '#475569' },
    rejected: { background: '#FEE2E2', color: '#991B1B' },
  };
  const labels = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };
  return (
    <span style={{
      ...styles[status],
      padding: '3px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.2px',
    }}>
      {labels[status]}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, iconBg, iconColor, trend }) => (
  <div style={{
    background: 'white',
    borderRadius: '12px',
    padding: '20px 24px',
    border: '1px solid #E2E8F0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
      <div>
        <div style={{ color: '#64748B', fontSize: '12px', fontWeight: '600', letterSpacing: '0.3px', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ color: '#0F172A', fontSize: '28px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
        {trend && <div style={{ color: '#22C55E', fontSize: '11px', fontWeight: '600', marginTop: '6px' }}>{trend}</div>}
      </div>
      <div style={{
        width: '44px', height: '44px',
        background: iconBg,
        borderRadius: '10px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
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
        {payload.map((p, i) => (
          <div key={i} style={{ color: 'white', fontSize: '13px', fontWeight: '600' }}>
            <span style={{ color: p.fill }}>{p.name}: </span>{p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const recent = clients.slice(0, 5);

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Dashboard</h1>
            <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>
              Sunday, June 21, 2026 · TradeFX Pro Workspace
            </p>
          </div>
          <div style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '8px',
            padding: '8px 14px',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />
            <span style={{ color: '#1D4ED8', fontSize: '12px', fontWeight: '600' }}>All systems operational</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard icon={Users} label="Total Clients" value={dashboardStats.totalClients} iconBg="#EEF2FF" iconColor="#6366F1" trend="↑ 2 this week" />
        <StatCard icon={Clock} label="Pending KYC" value={dashboardStats.pendingKyc} iconBg="#FFFBEB" iconColor="#D97706" />
        <StatCard icon={CheckCircle} label="Approved This Month" value={dashboardStats.approvedThisMonth} iconBg="#F0FDF4" iconColor="#16A34A" trend="↑ From last month" />
        <StatCard icon={XCircle} label="Rejected" value={dashboardStats.rejected} iconBg="#FFF1F2" iconColor="#E11D48" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', marginBottom: '24px' }}>
        {/* Chart */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700' }}>KYC Activity</div>
              <div style={{ color: '#64748B', fontSize: '12px', marginTop: '2px' }}>Approvals vs Rejections — Last 6 months</div>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#6366F1' }} />
                <span style={{ color: '#64748B', fontSize: '12px' }}>Approved</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#F43F5E' }} />
                <span style={{ color: '#64748B', fontSize: '12px' }}>Rejected</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barSize={14} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="approved" fill="#6366F1" radius={[4, 4, 0, 0]} name="Approved" />
              <Bar dataKey="rejected" fill="#F43F5E" radius={[4, 4, 0, 0]} name="Rejected" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>Needs Attention</div>
          <div style={{ color: '#64748B', fontSize: '12px', marginBottom: '16px' }}>Clients requiring action</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {clients.filter(c => c.kycStatus === 'under_review' || c.kycStatus === 'rejected').map(c => (
              <div
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  cursor: 'pointer',
                }}
              >
                <AlertTriangle size={14} color={c.kycStatus === 'rejected' ? '#E11D48' : '#D97706'} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{c.name.split(' ')[0]} {c.name.split(' ').slice(-1)}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>{c.company}</div>
                </div>
                {kycBadge(c.kycStatus)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent clients table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700' }}>Recent Clients</div>
          <button
            onClick={() => navigate('/clients')}
            style={{ color: '#6366F1', fontSize: '12px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View all →
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Client', 'Company', 'Country', 'Industry', 'KYC Status', 'Agent'].map(h => (
                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((client, i) => (
              <tr
                key={client.id}
                onClick={() => navigate(`/clients/${client.id}`)}
                style={{
                  borderTop: '1px solid #F1F5F9',
                  cursor: 'pointer',
                  background: 'white',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}
              >
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px',
                      background: `hsl(${client.id * 60}, 70%, 95%)`,
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: `hsl(${client.id * 60}, 70%, 35%)`,
                      fontSize: '11px', fontWeight: '700',
                    }}>
                      {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{client.name}</div>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>{client.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.company}</td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.country}</td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.industry}</td>
                <td style={{ padding: '14px 20px' }}>{kycBadge(client.kycStatus)}</td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.assignedTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
