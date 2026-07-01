import { useEffect, useState } from 'react';
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

export default function RetentionAgentDashboard() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user?.id) fetchClients(); }, [user?.id]);

  async function fetchClients() {
    setLoading(true);
    const { data: leads } = await supabase
      .from('sales_leads')
      .select('id, first_name, last_name, converted_client_id, estimated_value')
      .eq('retention_agent_id', user.id)
      .not('converted_client_id', 'is', null);

    const clientIds = (leads || []).map(l => l.converted_client_id);
    if (!clientIds.length) { setRows([]); setLoading(false); return; }

    const [{ data: clients }, { data: txData }] = await Promise.all([
      supabase.from('clients').select('id, first_name, last_name, phone, country, status').in('id', clientIds),
      supabase.from('transactions').select('client_id, type, transaction_approval, amount').in('client_id', clientIds),
    ]);

    // deposit volume per client (successful deposits)
    const volByClient = {};
    (txData || []).forEach(t => {
      if (t.type?.toLowerCase() !== 'deposit') return;
      if (t.transaction_approval && t.transaction_approval.toLowerCase() !== 'success') return;
      volByClient[t.client_id] = (volByClient[t.client_id] || 0) + (parseFloat(t.amount) || 0);
    });

    const clientById = Object.fromEntries((clients || []).map(c => [c.id, c]));
    const built = (leads || []).map(l => {
      const c = clientById[l.converted_client_id] || {};
      return {
        id: l.converted_client_id,
        name: `${c.first_name || l.first_name || ''} ${c.last_name || l.last_name || ''}`.trim() || '—',
        phone: c.phone || '—',
        country: c.country || '—',
        volume: volByClient[l.converted_client_id] || 0,
      };
    }).sort((a, b) => b.volume - a.volume);

    setRows(built);
    setLoading(false);
  }

  const totalVolume = rows.reduce((s, r) => s + r.volume, 0);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <div style={{ marginBottom: '36px' }}>
        <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>{today}</div>
        <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{greeting}, {name}</h1>
        <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0' }}>Your assigned clients and their deposit volume.</p>
      </div>

      {sectionLabel('My Clients')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 260px))', gap: '12px', marginBottom: '32px' }}>
        <StatCard label="Assigned Clients" value={loading ? '—' : rows.length} />
        <StatCard label="Total Volume" value={loading ? '—' : money(totalVolume)} accent="#16A34A" />
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {sectionLabel('Client List')}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Client', 'Phone', 'Country', 'Volume Deposited'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>No clients assigned to you yet.</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={r.id} style={{ borderBottom: idx < rows.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff' }}>
                <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '500', color: '#111827' }}>{r.name}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>{r.phone}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>{r.country}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#16A34A', fontFamily: 'monospace' }}>{money(r.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
