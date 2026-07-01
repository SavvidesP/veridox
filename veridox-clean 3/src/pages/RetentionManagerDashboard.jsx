import { useEffect, useState, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

const StatCard = ({ label, value, accent }) => (
  <div style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
    <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
    <div style={{ color: accent || '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
  </div>
);

const money = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateOf = (v) => v ? String(v).slice(0, 10) : '';
const monthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(start), to: fmt(now) };
};

export default function RetentionManagerDashboard() {
  const { profile, user } = useAuth();
  const [range, setRange] = useState(monthRange());
  const [agents, setAgents] = useState([]);
  const [leads, setLeads] = useState([]);
  const [clientById, setClientById] = useState({});
  const [tx, setTx] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: agentData }, { data: leadData }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role').eq('role', 'retention_agent').eq('active', true),
      supabase.from('sales_leads').select('id, first_name, last_name, converted_client_id, retention_agent_id').not('retention_agent_id', 'is', null).not('converted_client_id', 'is', null),
    ]);
    const clientIds = (leadData || []).map(l => l.converted_client_id);
    let clientsMap = {}, txData = [];
    if (clientIds.length) {
      const [{ data: clients }, { data: txs }] = await Promise.all([
        supabase.from('clients').select('id, first_name, last_name').in('id', clientIds),
        supabase.from('transactions').select('client_id, type, transaction_approval, amount, created_date').in('client_id', clientIds),
      ]);
      clientsMap = Object.fromEntries((clients || []).map(c => [c.id, c]));
      txData = txs || [];
    }
    setAgents((agentData || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
    setLeads(leadData || []);
    setClientById(clientsMap);
    setTx(txData);
    setLoading(false);
  }

  const inRange = (d) => d && d >= range.from && d <= range.to;

  // deposit volume per client within the range (successful deposits)
  const volByClient = {};
  tx.forEach(t => {
    if (t.type?.toLowerCase() !== 'deposit') return;
    if (t.transaction_approval && t.transaction_approval.toLowerCase() !== 'success') return;
    if (!inRange(dateOf(t.created_date))) return;
    volByClient[t.client_id] = (volByClient[t.client_id] || 0) + (parseFloat(t.amount) || 0);
  });

  const agentStats = agents.map(a => {
    const mine = leads.filter(l => l.retention_agent_id === a.id);
    const clients = mine.map(l => {
      const c = clientById[l.converted_client_id] || {};
      return {
        id: l.converted_client_id,
        name: `${c.first_name || l.first_name || ''} ${c.last_name || l.last_name || ''}`.trim() || '—',
        volume: volByClient[l.converted_client_id] || 0,
      };
    }).sort((x, y) => y.volume - x.volume);
    const volume = clients.reduce((s, c) => s + c.volume, 0);
    return { agent: a, count: clients.length, volume, clients };
  }).sort((a, b) => b.volume - a.volume);

  const totalClients = leads.length;
  const totalVolume  = Object.values(volByClient).reduce((s, v) => s + v, 0);

  const inputStyle = { padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', color: '#111827', background: '#fff', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const th = { padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '32px', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{greeting}, {name}</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0' }}>Retention team performance</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="date" value={range.from} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} style={inputStyle} />
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>→</span>
          <input type="date" value={range.to} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} style={inputStyle} />
          <button onClick={() => setRange(monthRange())} style={{ ...inputStyle, cursor: 'pointer', color: '#6B7280' }}>This month</button>
        </div>
      </div>

      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 280px))', gap: '12px', marginBottom: '32px' }}>
        <StatCard label="Total Clients" value={loading ? '—' : totalClients} />
        <StatCard label="Total Volume"  value={loading ? '—' : money(totalVolume)} accent="#16A34A" />
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {sectionLabel('By Agent')}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Agent', 'Clients', 'Volume Deposited'].map(h => <th key={h} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : agentStats.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>No retention agents yet.</td></tr>
            ) : agentStats.map(({ agent, count, volume, clients }) => {
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
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#111827' }}>{count}</td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#16A34A', fontWeight: '600', fontFamily: 'monospace' }}>{money(volume)}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={3} style={{ padding: '0 16px 14px 38px', background: '#F9FAFB' }}>
                        {clients.length === 0 ? (
                          <div style={{ padding: '12px 0', color: '#9CA3AF', fontSize: '12px' }}>No clients assigned.</div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0' }}>
                            {clients.map(c => (
                              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#fff', border: '1px solid #F3F4F6', borderRadius: '5px' }}>
                                <span style={{ fontSize: '12px', color: '#374151' }}>{c.name}</span>
                                <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: '600', fontFamily: 'monospace' }}>{money(c.volume)}</span>
                              </div>
                            ))}
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
