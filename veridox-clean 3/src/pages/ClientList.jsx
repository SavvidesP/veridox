import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cachedQuery } from '../lib/cache';

const KYC_LABELS = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };

const kycBadge = (status) => {
  const styles = { approved: { background: '#DCFCE7', color: '#166534' }, under_review: { background: '#FEF9C3', color: '#854D0E' }, pending: { background: '#F1F5F9', color: '#475569' }, rejected: { background: '#FEE2E2', color: '#991B1B' } };
  return <span style={{ ...styles[status], padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>{KYC_LABELS[status]}</span>;
};

// Per-column filter definitions (label + how to extract the searchable text from a row).
const CLIENT_COLUMNS = [
  { label: 'Client', key: 'client', get: c => `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''}` },
  { label: 'Company', key: 'company', get: c => c.company_name || '' },
  { label: 'Country', key: 'country', get: c => c.country || '' },
  { label: 'Industry', key: 'industry', get: c => c.industry || '' },
  { label: 'KYC Status', key: 'status', get: c => KYC_LABELS[c.status] || c.status || '' },
  { label: 'Added', key: 'added', get: c => (c.created_at ? new Date(c.created_at).toLocaleDateString() : '') },
  { label: '', key: null },
];

const filters = [
  { key: 'all', label: 'All Clients' },
  { key: 'pending', label: 'Pending' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function ClientList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [colFilters, setColFilters] = useState({});
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cachedQuery('clients', () => supabase.from('clients').select('*').order('created_at', { ascending: false }).then(r => r.data || [])).then(data => {
      setClients(data);
      setLoading(false);
    });
  }, []);

  const filtered = clients.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (c.company_name || '').toLowerCase().includes(search.toLowerCase()) || (c.country || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = activeFilter === 'all' || c.status === activeFilter;
    const matchCols = CLIENT_COLUMNS.every(col => {
      if (!col.key) return true;
      const fv = (colFilters[col.key] || '').trim().toLowerCase();
      return !fv || col.get(c).toLowerCase().includes(fv);
    });
    return matchSearch && matchFilter && matchCols;
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

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0', width: 'fit-content' }}>
        {filters.map(f => (
          <button key={f.key} onClick={() => setActiveFilter(f.key)} style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: activeFilter === f.key ? '#6366F1' : 'transparent', color: activeFilter === f.key ? 'white' : '#64748B', transition: 'all 0.15s' }}>
            {f.label}
            {f.key !== 'all' && <span style={{ marginLeft: '6px', opacity: 0.7 }}>{clients.filter(c => c.status === f.key).length}</span>}
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '340px' }}>
        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
        <input type="text" placeholder="Search clients, companies..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', paddingLeft: '36px', paddingRight: '12px', paddingTop: '9px', paddingBottom: '9px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', background: 'white', outline: 'none' }} />
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
              <tr><td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No clients found.</td></tr>
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
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>{client.company_name}</td>
                <td style={{ padding: '14px 20px', color: '#475569', fontSize: '13px' }}>{client.country}</td>
                <td style={{ padding: '14px 20px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: client.industry === 'Forex' ? '#EEF2FF' : client.industry === 'Payments' ? '#F5F3FF' : '#FFF7ED', color: client.industry === 'Forex' ? '#4338CA' : client.industry === 'Payments' ? '#7C3AED' : '#C2410C' }}>{client.industry}</span>
                </td>
                <td style={{ padding: '14px 20px' }}>{kycBadge(client.status)}</td>
                <td style={{ padding: '14px 20px', color: '#94A3B8', fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(client.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '14px 16px' }}><ChevronRight size={16} color="#CBD5E1" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
