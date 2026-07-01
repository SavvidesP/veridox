import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DISPOSITIONS, dispMap, toLocalInput } from '../lib/leadStatus';

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

const StatCard = ({ label, value, accent }) => (
  <div style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
    <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
    <div style={{ color: accent || '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
  </div>
);

export default function ConversionAgentDashboard() {
  const { user, profile } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (user?.id) fetchLeads(); }, [user?.id]);

  async function fetchLeads() {
    setLoading(true);
    const { data } = await supabase
      .from('sales_leads')
      .select('*')
      .eq('assigned_agent_id', user.id)
      .order('created_at', { ascending: false });
    setLeads(data || []);
    setLoading(false);
  }

  async function updateDisposition(id, disposition) {
    const patch = { disposition, updated_at: new Date().toISOString() };
    if (disposition !== 'callback') patch.callback_at = null;
    await supabase.from('sales_leads').update(patch).eq('id', id);
    fetchLeads();
  }

  async function updateCallbackAt(id, iso) {
    await supabase.from('sales_leads').update({ callback_at: iso || null, updated_at: new Date().toISOString() }).eq('id', id);
    fetchLeads();
  }

  const total     = leads.length;
  const countBy   = (d) => leads.filter(l => (l.disposition || 'new') === d).length;
  const newCount  = countBy('new');
  const converted = countBy('converted');
  const callbacks = countBy('callback');

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name     = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const today    = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <div style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: '500', marginBottom: '6px' }}>{today}</div>
        <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{greeting}, {name}</h1>
        <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0' }}>Your assigned leads — update each status as you work them.</p>
      </div>

      {/* Stats */}
      {sectionLabel('My Leads')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        <StatCard label="Assigned" value={loading ? '—' : total} />
        <StatCard label="New"       value={loading ? '—' : newCount} accent="#15803D" />
        <StatCard label="Callbacks" value={loading ? '—' : callbacks} accent={callbacks > 0 ? '#D97706' : '#111827'} />
        <StatCard label="Converted" value={loading ? '—' : converted} accent="#16A34A" />
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {/* Leads table */}
      {sectionLabel('Lead List')}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Lead', 'Phone', 'Source', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>No leads assigned to you yet.</td></tr>
            ) : leads.map((l, idx) => {
              const d = dispMap[l.disposition] || dispMap.new;
              return (
                <tr key={l.id} style={{ borderBottom: idx < leads.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{l.first_name} {l.last_name}</div>
                    {l.email && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{l.email}</div>}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px', whiteSpace: 'nowrap' }}>{l.phone || '—'}</td>
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px', textTransform: 'capitalize' }}>{l.source?.replace('_', ' ') || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <select value={l.disposition || 'new'} onChange={e => updateDisposition(l.id, e.target.value)}
                        style={{ background: d.bg, color: d.color, border: `1px solid ${d.border}`, padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif', width: 'fit-content' }}>
                        {DISPOSITIONS.map(o => <option key={o.value} value={o.value} style={{ background: '#fff', color: '#111827' }}>{o.label}</option>)}
                      </select>
                      {l.disposition === 'callback' && (
                        <input type="datetime-local" value={toLocalInput(l.callback_at)}
                          onChange={e => updateCallbackAt(l.id, e.target.value ? new Date(e.target.value).toISOString() : null)}
                          style={{ fontSize: '11px', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '4px', padding: '2px 6px', outline: 'none', fontFamily: 'Inter, sans-serif', background: '#FFFBEB', width: 'fit-content' }} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
