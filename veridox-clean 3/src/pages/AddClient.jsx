import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ChevronRight, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/cache';

const COL_FILTERS_KEY = 'veridox-client-colfilters';

// Per-column filter definitions (label + how to extract the searchable text from a row).
const CLIENT_COLUMNS = [
  { label: 'Client', key: 'client', get: c => `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''}` },
  { label: 'Country', key: 'country', get: c => c.country || '' },
  { label: 'Added', key: 'added', get: c => (c.created_at ? new Date(c.created_at).toLocaleDateString() : '') },
  { label: 'Assigned To', key: 'assigned', get: c => c._assignedTo || '' },
  { label: '', key: null },
];

export default function ClientList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  // Column filters persist across refresh (saved to localStorage) until the user clears them.
  const [colFilters, setColFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COL_FILTERS_KEY)) || {}; } catch { return {}; }
  });
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedQuery('clients', () => supabase.from('clients').select('*').order('created_at', { ascending: false }).then(r => r.data || [])).then(async data => {
      // Resolve the assigned agent for each client from its linked lead (retention agent
      // preferred, else conversion agent), so the "Assigned To" column shows a real name.
      const ids = data.map(c => c.id);
      const assignedMap = {};
      if (ids.length) {
        const { data: leads } = await supabase.from('sales_leads')
          .select('converted_client_id, assigned_to, assigned_agent_id, retention_agent_id')
          .in('converted_client_id', ids);
        const agentIds = [...new Set((leads || []).flatMap(l => [l.assigned_agent_id, l.retention_agent_id]).filter(Boolean))];
        const profMap = {};
        if (agentIds.length) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', agentIds);
          (profs || []).forEach(p => { profMap[p.id] = p.full_name; });
        }
        (leads || []).forEach(l => {
          const name = profMap[l.retention_agent_id] || profMap[l.assigned_agent_id] || (l.assigned_to || '').trim() || null;
          if (name && l.converted_client_id) assignedMap[l.converted_client_id] = name;
        });
      }
      setClients(data.map(c => ({ ...c, _assignedTo: c.assigned_to || assignedMap[c.id] || '' })));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    try { localStorage.setItem(COL_FILTERS_KEY, JSON.stringify(colFilters)); } catch { /* ignore */ }
  }, [colFilters]);

  const hasActiveFilters = search.trim() !== '' || Object.values(colFilters).some(v => (v || '').trim() !== '');
  const clearFilters = () => { setSearch(''); setColFilters({}); };

  const filtered = clients.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (c.company_name || '').toLowerCase().includes(search.toLowerCase()) || (c.country || '').toLowerCase().includes(search.toLowerCase());
    const matchCols = CLIENT_COLUMNS.every(col => {
      if (!col.key) return true;
      const fv = (colFilters[col.key] || '').trim().toLowerCase();
      return !fv || col.get(c).toLowerCase().includes(fv);
    });
    return matchSearch && matchCols;
  });

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Clients</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{clients.length} total clients</p>
        </div>
        <button onClick={() => navigate('/add-client')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
          <UserPlus size={15} /> Add Client
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: '0 0 340px', maxWidth: '340px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input type="text" placeholder="Search clients, companies..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', background: 'white', outline: 'none' }} />
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', color: '#64748B', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {CLIENT_COLUMNS.map((col, i) => (
                <th key={col.label || `c${i}`} style={{ padding: '11px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{col.label}</th>
              ))}
            </tr>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {CLIENT_COLUMNS.map((col, i) => (
                <th key={(col.label || `c${i}`) + '-f'} style={{ padding: '0 20px 8px' }}>
                  {col.key && (
                    <input value={colFilters[col.key] || ''} onChange={e => setColFilters(f => ({ ...f, [col.key]: e.target.value }))} placeholder="Filter…"
                      style={{ width: '100%', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '11px', fontWeight: '400', color: '#0F172A', background: 'white', outline: 'none', textTransform: 'none', letterSpacing: 'normal' }} />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No clients found.</td></tr>
            ) : filtered.map(client => (
              <tr key={client.id} onClick={() => navigate(`/clients/${client.id}`)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: 'white', transition: 'background 0.1s' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                      {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
                    </div>
                    <div>
                      <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>{client.first_name} {client.last_name}</div>
                      <div style={{ color: '#94A3B8', fontSize: '11px' }}>{client.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.country}</td>
                <td style={{ padding: '14px 20px', color: '#94A3B8', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(client.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '14px 20px', color: client._assignedTo ? '#475569' : '#CBD5E1', fontSize: '13px', whiteSpace: 'nowrap' }}>{client._assignedTo || '—'}</td>
                <td style={{ padding: '14px 16px' }}><ChevronRight size={16} color="#CBD5E1" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
