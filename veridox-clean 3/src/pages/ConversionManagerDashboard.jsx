import { useEffect, useState, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { dispMap } from '../lib/leadStatus';

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

const StatCard = ({ label, value, sub, accent }) => (
  <div style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
    <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
    <div style={{ color: accent || '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '8px' }}>{sub}</div>}
  </div>
);

const isConverted = (l) => l.disposition === 'converted' || !!l.converted_client_id;
const dateOf = (v) => v ? String(v).slice(0, 10) : '';
const monthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(now) };
};

export default function ConversionManagerDashboard() {
  const { profile, user } = useAuth();
  const [range, setRange] = useState(monthRange());
  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [firstDeposit, setFirstDeposit] = useState({}); // client_id → earliest deposit date
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // agent id being drilled into

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: agentData }, { data: leadData }, { data: txData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').in('role', ['conversion_agent', 'conversion_manager']).eq('active', true),
      supabase.from('sales_leads').select('id, first_name, last_name, assigned_agent_id, disposition, converted_client_id, created_at'),
      supabase.from('transactions').select('client_id, type, transaction_approval, created_date'),
    ]);
    // earliest successful deposit per client → FTD date
    const fd = {};
    (txData || []).forEach(t => {
      if (t.type?.toLowerCase() !== 'deposit') return;
      if (t.transaction_approval && t.transaction_approval.toLowerCase() !== 'success') return;
      if (!t.client_id || !t.created_date) return;
      const d = dateOf(t.created_date);
      if (!fd[t.client_id] || d < fd[t.client_id]) fd[t.client_id] = d;
    });
    setAgents((agentData || []).filter(a => a.role === 'conversion_agent').sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
    setLeads(leadData || []);
    setFirstDeposit(fd);
    setLoading(false);
  }

  const inRange = (d) => d && d >= range.from && d <= range.to;
  const ftdInRange = (l) => isConverted(l) && l.converted_client_id && inRange(firstDeposit[l.converted_client_id]);

  // Leads created within the range (funnel for the period)
  const leadsInRange = leads.filter(l => inRange(dateOf(l.created_at)));
  const totalLeads   = leadsInRange.length;
  const converted    = leadsInRange.filter(isConverted).length;
  const rate         = totalLeads ? ((converted / totalLeads) * 100).toFixed(1) : '0.0';
  const totalFTDs    = leads.filter(ftdInRange).length; // FTDs by deposit date in range (any converted client)

  const agentStats = agents.map(a => {
    const mine = leadsInRange.filter(l => l.assigned_agent_id === a.id);
    const conv = mine.filter(isConverted).length;
    const ftds = leads.filter(l => l.assigned_agent_id === a.id && ftdInRange(l)).length;
    return { agent: a, total: mine.length, converted: conv, ftds, rate: mine.length ? ((conv / mine.length) * 100).toFixed(1) : '0.0', leads: mine };
  }).sort((a, b) => b.total - a.total);

  const inputStyle = { padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', color: '#111827', background: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const th = { padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      {/* Header + date range */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{greeting}, {name}</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0' }}>Conversion team performance</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} style={inputStyle} />
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>→</span>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} style={inputStyle} />
          <button onClick={() => setRange(monthRange())} style={{ ...inputStyle, cursor: 'pointer', color: '#6B7280' }}>This month</button>
        </div>
      </div>

      {/* Metrics */}
      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <StatCard label="Total Leads" value={loading ? '—' : totalLeads} />
        <StatCard label="Converted"   value={loading ? '—' : converted} accent="#16A34A" />
        <StatCard label="Total FTDs"  value={loading ? '—' : totalFTDs} accent="#2563EB" />
        <StatCard label="Conversion Rate" value={loading ? '—' : `${rate}%`} />
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {/* Per-agent breakdown */}
      {sectionLabel('By Agent')}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Agent', 'Leads', 'Converted', 'FTDs', 'Conversion Rate'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : agentStats.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>No conversion agents yet.</td></tr>
            ) : agentStats.map(({ agent, total, converted, ftds, rate, leads }) => {
              const open = expanded === agent.id;
              return (
                <Fragment key={agent.id}>
                  <tr onClick={() => setExpanded(open ? null : agent.id)}
                    style={{ borderBottom: '1px solid #F3F4F6', cursor: 'pointer', background: open ? '#F9FAFB' : '#fff' }}
                    onMouseEnter={e => { if (!open) e.currentTarget.style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (!open) e.currentTarget.style.background = '#fff'; }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {open ? <ChevronDown size={14} color="#9CA3AF" /> : <ChevronRight size={14} color="#9CA3AF" />}
                        <span style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{agent.full_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827' }}>{total}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#16A34A', fontWeight: '600' }}>{converted}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#2563EB', fontWeight: '600' }}>{ftds}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827' }}>{rate}%</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={5} style={{ padding: '0 16px 14px 38px', background: '#F9FAFB' }}>
                        {leads.length === 0 ? (
                          <div style={{ padding: '12px 0', color: '#9CA3AF', fontSize: '12px' }}>No leads assigned in this period.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' }}>
                            {leads.map(l => {
                              const d = dispMap[l.disposition] || dispMap.new;
                              return (
                                <div key={l.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fff', border: '1px solid #F3F4F6', borderRadius: '5px' }}>
                                  <span style={{ fontSize: '12px', color: '#374151' }}>{l.first_name} {l.last_name}</span>
                                  <span style={{ background: d.bg, color: d.color, border: `1px solid ${d.border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>{d.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
