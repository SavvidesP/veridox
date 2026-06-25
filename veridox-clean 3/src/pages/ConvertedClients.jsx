import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const sourceBadge = (s) => {
  const map = {
    manual:    { color: '#6B7280', border: '#E5E7EB' },
    website:   { color: '#2563EB', border: '#BFDBFE' },
    referral:  { color: '#16A34A', border: '#BBF7D0' },
    social:    { color: '#D97706', border: '#FDE68A' },
    email:     { color: '#7C3AED', border: '#DDD6FE' },
    cold_call: { color: '#9CA3AF', border: '#E5E7EB' },
  };
  const t = map[s] || map.manual;
  return (
    <span style={{ background: 'transparent', color: t.color, border: `1px solid ${t.border}`, padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'capitalize' }}>
      {s?.replace('_', ' ') || '—'}
    </span>
  );
};

const kycBadge = (status) => {
  const styles = {
    approved:     { color: '#16A34A', border: '#BBF7D0' },
    under_review: { color: '#D97706', border: '#FDE68A' },
    pending:      { color: '#9CA3AF', border: '#E5E7EB' },
    rejected:     { color: '#DC2626', border: '#FECACA' },
  };
  const labels = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };
  const t = styles[status] || styles.pending;
  return (
    <span style={{ background: 'transparent', color: t.color, border: `1px solid ${t.border}`, padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px' }}>
      {labels[status] || status || '—'}
    </span>
  );
};

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(v) {
  if (!v) return '—';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

export default function ConvertedClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchConverted(); }, []);

  async function fetchConverted() {
    setLoading(true);
    // Get all leads that have been converted
    const { data: leads } = await supabase
      .from('sales_leads')
      .select('*')
      .not('converted_client_id', 'is', null)
      .order('updated_at', { ascending: false });

    if (!leads?.length) { setClients([]); setLoading(false); return; }

    const ids = leads.map(l => l.converted_client_id);
    const { data: cliData } = await supabase
      .from('clients')
      .select('*')
      .in('id', ids);

    // Enrich clients with lead metadata
    const enriched = (cliData || []).map(c => {
      const lead = leads.find(l => l.converted_client_id === c.id);
      return {
        ...c,
        lead_source:     lead?.source,
        assigned_to:     lead?.assigned_to,
        estimated_value: lead?.estimated_value,
        converted_at:    lead?.updated_at,
        lead_notes:      lead?.notes,
      };
    }).sort((a, b) => new Date(b.converted_at) - new Date(a.converted_at));

    setClients(enriched);
    setLoading(false);
  }

  const filtered = clients.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q)
    );
  });

  const totalValue = clients.reduce((s, c) => s + (parseFloat(c.estimated_value) || 0), 0);

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', maxWidth: '1280px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Converted Clients</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>Leads successfully converted to clients</p>
        </div>
      </div>

      {/* ── Stats ── */}
      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total Converted', value: loading ? '—' : clients.length },
          { label: 'Total Value',     value: loading ? '—' : formatAmount(totalValue) },
          { label: 'This Month',      value: loading ? '—' : clients.filter(c => {
              if (!c.converted_at) return false;
              const d = new Date(c.converted_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
            <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
            <div style={{ color: '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {/* ── Search ── */}
      {sectionLabel('Clients')}
      <div style={{ marginBottom: '16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, company…"
          style={{ padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', color: '#111827', outline: 'none', fontFamily: 'Inter, sans-serif', width: '240px' }}
        />
      </div>

      {/* ── Table ── */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Client', 'Company', 'Email', 'Country', 'Source', 'Value', 'KYC Status', 'Assigned To', 'Converted'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>
                {search ? 'No results found.' : 'No converted clients yet. Convert a lead from Sales CRM to get started.'}
              </td></tr>
            ) : filtered.map((c, idx) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/clients/${c.id}`)}
                style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <td style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', background: '#F3F4F6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                      {(c.first_name?.[0] || '') + (c.last_name?.[0] || '')}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{c.first_name} {c.last_name}</div>
                      {c.phone && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '1px' }}>{c.phone}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{c.company_name || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{c.email || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{c.country || '—'}</td>
                <td style={{ padding: '14px 16px' }}>{sourceBadge(c.lead_source)}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#111827' }}>{formatAmount(c.estimated_value)}</td>
                <td style={{ padding: '14px 16px' }}>{kycBadge(c.status)}</td>
                <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px' }}>{c.assigned_to || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#9CA3AF', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(c.converted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
