import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, deposits: 0, withdrawals: 0, totalVolume: 0 });
  const [byBrand, setByBrand] = useState([]);
  const [byStatus, setByStatus] = useState([]);
  const [byMethod, setByMethod] = useState([]);
  const [byMonth, setByMonth] = useState([]);
  const [byType, setByType] = useState([]);

  useEffect(() => { fetchAnalytics(); }, []);

  async function fetchAnalytics() {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('*');
    if (!data) { setLoading(false); return; }

    // Stats
    const deposits = data.filter(t => t.type?.toLowerCase() === 'deposit');
    const withdrawals = data.filter(t => t.type?.toLowerCase() === 'withdrawal');
    const totalVolume = data.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
    setStats({ total: data.length, deposits: deposits.length, withdrawals: withdrawals.length, totalVolume });

    // By Brand
    const brandMap = {};
    data.forEach(t => {
      if (!t.brand_name) return;
      if (!brandMap[t.brand_name]) brandMap[t.brand_name] = { name: t.brand_name, deposits: 0, withdrawals: 0, volume: 0 };
      if (t.type?.toLowerCase() === 'deposit') brandMap[t.brand_name].deposits++;
      else brandMap[t.brand_name].withdrawals++;
      brandMap[t.brand_name].volume += parseFloat(t.amount) || 0;
    });
    setByBrand(Object.values(brandMap).sort((a, b) => b.volume - a.volume));

    // By Status
    const statusMap = {};
    data.forEach(t => {
      const s = t.transaction_approval || 'Unknown';
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    setByStatus(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    // By Payment Method
    const methodMap = {};
    data.forEach(t => {
      const m = t.payment_method || 'Unknown';
      methodMap[m] = (methodMap[m] || 0) + 1;
    });
    setByMethod(Object.entries(methodMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6));

    // By Month
    const monthMap = {};
    data.forEach(t => {
      if (!t.created_date) return;
      const month = new Date(t.created_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      if (!monthMap[month]) monthMap[month] = { month, deposits: 0, withdrawals: 0, volume: 0 };
      if (t.type?.toLowerCase() === 'deposit') monthMap[month].deposits++;
      else monthMap[month].withdrawals++;
      monthMap[month].volume += parseFloat(t.amount) || 0;
    });
    const sorted = Object.values(monthMap).sort((a, b) => new Date('01 ' + a.month) - new Date('01 ' + b.month));
    setByMonth(sorted.slice(-12));

    // By Type
    setByType([
      { name: 'Deposits', value: deposits.length },
      { name: 'Withdrawals', value: withdrawals.length },
    ]);

    setLoading(false);
  }

  const formatCurrency = (v) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(1)}K` : `$${v.toFixed(0)}`;

  const approvalRate = stats.total > 0
    ? ((byStatus.find(s => s.name?.toLowerCase() === 'success')?.value || 0) / stats.total * 100).toFixed(1)
    : 0;

  if (loading) return (
    <div style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: '#94A3B8', fontSize: '13px' }}>Loading analytics...</div>
    </div>
  );

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Analytics</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Transaction performance and insights</p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Transactions', value: stats.total.toLocaleString(), icon: Activity, color: '#6366F1', bg: '#EEF2FF', sub: 'All time' },
          { label: 'Total Volume', value: formatCurrency(stats.totalVolume), icon: DollarSign, color: '#166534', bg: '#DCFCE7', sub: 'All currencies' },
          { label: 'Approval Rate', value: `${approvalRate}%`, icon: TrendingUp, color: '#1D4ED8', bg: '#DBEAFE', sub: 'Successful txns' },
          { label: 'Withdrawals', value: stats.withdrawals.toLocaleString(), icon: TrendingDown, color: '#C2410C', bg: '#FFF7ED', sub: `${stats.deposits} deposits` },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '8px', borderRadius: '8px' }}>
                <Icon size={16} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>{value}</div>
            <div style={{ fontSize: '11px', color: '#94A3B8' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Volume by Month */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px' }}>Transaction Volume by Month</div>
        {byMonth.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px' }}>No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byMonth} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="deposits" name="Deposits" fill="#6366F1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="withdrawals" name="Withdrawals" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Row 2: Brand Performance + Status Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Brand Performance */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px' }}>Volume by Brand</div>
          {byBrand.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byBrand} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} tickFormatter={v => formatCurrency(v)} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={80} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} formatter={v => formatCurrency(v)} />
                <Bar dataKey="volume" name="Volume" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Breakdown */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px' }}>Transaction Status</div>
          {byStatus.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={byStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {byStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Payment Methods + Deposit vs Withdrawal */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        {/* Payment Methods */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px' }}>Top Payment Methods</div>
          {byMethod.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={byMethod} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                <Bar dataKey="value" name="Transactions" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deposit vs Withdrawal */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px' }}>Deposit vs Withdrawal</div>
          {byType.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8', fontSize: '13px' }}>No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={byType} cx="50%" cy="50%" outerRadius={70} paddingAngle={3} dataKey="value">
                    <Cell fill="#6366F1" />
                    <Cell fill="#F59E0B" />
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
                {byType.map((t, i) => (
                  <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: i === 0 ? '#6366F1' : '#F59E0B' }} />
                    {t.name}: <strong>{t.value}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
