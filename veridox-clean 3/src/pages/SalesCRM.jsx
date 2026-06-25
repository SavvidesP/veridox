import { useEffect, useState, useRef } from 'react';
import { Plus, X, Edit2, Trash2, Clock, Upload, Download, ChevronUp, ChevronDown, Zap, PenLine } from 'lucide-react';
import { supabase } from '../lib/supabase';

// ── Badge helpers ──
const stageBadge = (s) => {
  const map = {
    prospecting: { color: '#6B7280', border: '#E5E7EB' },
    qualified:   { color: '#2563EB', border: '#BFDBFE' },
    proposal:    { color: '#D97706', border: '#FDE68A' },
    negotiation: { color: '#7C3AED', border: '#DDD6FE' },
    closed_won:  { color: '#16A34A', border: '#BBF7D0' },
    closed_lost: { color: '#DC2626', border: '#FECACA' },
  };
  const t = map[s] || map.prospecting;
  return (
    <span style={{ background: 'transparent', color: t.color, border: `1px solid ${t.border}`, padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'capitalize' }}>
      {s?.replace('_', ' ')}
    </span>
  );
};

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
      {s?.replace('_', ' ')}
    </span>
  );
};

const pspStatusBadge = (status) => {
  if (!status) return <span style={{ color: '#D1D5DB', fontSize: '11px' }}>—</span>;
  const map = {
    success: { color: '#16A34A', border: '#BBF7D0' },
    failed:  { color: '#DC2626', border: '#FECACA' },
    pending: { color: '#9CA3AF', border: '#E5E7EB' },
  };
  const t = map[status.toLowerCase()] || map.pending;
  return (
    <span style={{ background: 'transparent', color: t.color, border: `1px solid ${t.border}`, padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'capitalize' }}>
      {status}
    </span>
  );
};

const stageColors = {
  prospecting: { color: '#6B7280', border: '#E5E7EB' },
  qualified:   { color: '#2563EB', border: '#BFDBFE' },
  proposal:    { color: '#D97706', border: '#FDE68A' },
  negotiation: { color: '#7C3AED', border: '#DDD6FE' },
  closed_won:  { color: '#16A34A', border: '#BBF7D0' },
  closed_lost: { color: '#DC2626', border: '#FECACA' },
};

function formatAmount(v) {
  if (!v) return '$0';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const stages = ['prospecting', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

const SORT_FIELDS = [
  { key: 'first_name',       label: 'Name' },
  { key: 'company',          label: 'Company' },
  { key: 'stage',            label: 'Stage' },
  { key: 'estimated_value',  label: 'Value' },
  { key: 'next_followup_at', label: 'Follow-up' },
  { key: 'created_at',       label: 'Date Added' },
];

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

const divider = <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />;

// Payment method type → auto or manual
const isAutoMethod = (m) => m === 'card' || m === 'bank_transfer';

export default function SalesCRM() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStage, setFilterStage] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('table');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const fileRef = useRef();

  const empty = {
    first_name: '', last_name: '', email: '', phone: '', company: '',
    country: '', source: 'manual', status: 'active', stage: 'prospecting',
    assigned_to: '', estimated_value: '', currency: 'USD',
    notes: '', next_followup_at: '',
    payment_method_type: '',
    psp_status: '',
    decline_reason: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const { data: leadData } = await supabase.from('sales_leads').select('*').order('created_at', { ascending: false });
    setLeads(leadData || []);
    setLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      estimated_value: parseFloat(form.estimated_value) || 0,
      next_followup_at: form.next_followup_at || null,
      // if auto method, don't overwrite psp_status with manual value
      psp_status: form.psp_status || null,
      decline_reason: form.decline_reason || null,
      payment_method_type: form.payment_method_type || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('sales_leads').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('sales_leads').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function updateStage(id, stage) {
    await supabase.from('sales_leads').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this lead?')) return;
    await supabase.from('sales_leads').delete().eq('id', id);
    fetchAll();
  }

  async function convertToClient(lead) {
    if (!window.confirm(`Convert ${lead.first_name} ${lead.last_name} to a client?`)) return;
    const { data, error } = await supabase.from('clients').insert({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email || null,
      phone: lead.phone || null,
      company_name: lead.company || null,
      country: lead.country || null,
      status: 'pending',
    }).select().single();
    if (error) {
      alert(`Error converting lead: ${error.message}`);
      return;
    }
    if (data) {
      await supabase.from('sales_leads').update({
        stage: 'closed_won',
        converted_client_id: data.id,
        updated_at: new Date().toISOString(),
      }).eq('id', lead.id);
      fetchAll();
      alert(`✅ ${lead.first_name} ${lead.last_name} converted to client!`);
    }
  }

  function openEdit(l) {
    setEditItem(l);
    setForm({
      first_name: l.first_name, last_name: l.last_name,
      email: l.email || '', phone: l.phone || '',
      company: l.company || '', country: l.country || '',
      source: l.source, status: l.status, stage: l.stage,
      assigned_to: l.assigned_to || '',
      estimated_value: l.estimated_value, currency: l.currency,
      notes: l.notes || '',
      next_followup_at: l.next_followup_at ? l.next_followup_at.slice(0, 10) : '',
      payment_method_type: l.payment_method_type || '',
      psp_status: l.psp_status || '',
      decline_reason: l.decline_reason || '',
    });
    setShowModal(true);
  }

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  async function exportExcel() {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const rows = filtered.map(l => ({
      'First Name': l.first_name, 'Last Name': l.last_name,
      'Email': l.email || '', 'Phone': l.phone || '',
      'Company': l.company || '', 'Country': l.country || '',
      'Source': l.source || '', 'Stage': l.stage || '',
      'Estimated Value': l.estimated_value || 0, 'Currency': l.currency || 'USD',
      'Assigned To': l.assigned_to || '',
      'Payment Method': l.payment_method_type || '',
      'PSP Status': l.psp_status || '',
      'Decline Reason': l.decline_reason || '',
      'Next Follow-up': l.next_followup_at ? formatDate(l.next_followup_at) : '',
      'Notes': l.notes || '',
      'Date Added': formatDate(l.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Leads');
    XLSX.writeFile(wb, `sales-leads-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false });
    const mapped = rows.map(r => ({
      first_name: r['First Name'] || r['first_name'] || '',
      last_name: r['Last Name'] || r['last_name'] || '',
      email: r['Email'] || r['email'] || null,
      phone: r['Phone'] || r['phone'] || null,
      company: r['Company'] || r['company'] || null,
      country: r['Country'] || r['country'] || null,
      source: r['Source'] || r['source'] || 'manual',
      stage: r['Stage'] || r['stage'] || 'prospecting',
      estimated_value: parseFloat(r['Estimated Value'] || r['estimated_value']) || 0,
      currency: r['Currency'] || r['currency'] || 'USD',
      assigned_to: r['Assigned To'] || r['assigned_to'] || null,
      notes: r['Notes'] || r['notes'] || null,
      payment_method_type: r['Payment Method'] || r['payment_method_type'] || null,
      psp_status: r['PSP Status'] || r['psp_status'] || null,
      decline_reason: r['Decline Reason'] || r['decline_reason'] || null,
      status: 'active',
    })).filter(r => r.first_name);
    if (!mapped.length) { alert('No valid rows found.'); return; }
    for (let i = 0; i < mapped.length; i += 100) {
      await supabase.from('sales_leads').insert(mapped.slice(i, i + 100));
    }
    fetchAll();
    e.target.value = '';
  }

  const filtered = leads
    .filter(l => {
      if (filterStage !== 'all' && l.stage !== filterStage) return false;
      if (filterSource !== 'all' && l.source !== filterSource) return false;
      if (search && !l.first_name?.toLowerCase().includes(search.toLowerCase()) &&
        !l.last_name?.toLowerCase().includes(search.toLowerCase()) &&
        !l.email?.toLowerCase().includes(search.toLowerCase()) &&
        !l.company?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortKey] ?? '';
      let bVal = b[sortKey] ?? '';
      if (sortKey === 'estimated_value') { aVal = parseFloat(aVal) || 0; bVal = parseFloat(bVal) || 0; }
      if (sortKey === 'next_followup_at' || sortKey === 'created_at') { aVal = aVal ? new Date(aVal) : new Date(0); bVal = bVal ? new Date(bVal) : new Date(0); }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const totalValue     = leads.filter(l => l.stage === 'closed_won').reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);
  const pipelineValue  = leads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage)).reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);
  const wonCount       = leads.filter(l => l.stage === 'closed_won').length;
  const conversionRate = leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0;

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '7px 10px', border: '1px solid #E5E7EB', borderRadius: '5px',
    fontSize: '13px', color: '#111827', outline: 'none',
    fontFamily: 'Inter, sans-serif', background: '#fff',
  };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' };

  function SortIcon({ field }) {
    if (sortKey !== field) return <ChevronUp size={12} color="#D1D5DB" />;
    return sortDir === 'asc' ? <ChevronUp size={12} color="#111827" /> : <ChevronDown size={12} color="#111827" />;
  }

  // ── PSP column cell ──
  const PspCell = ({ lead }) => {
    const auto = isAutoMethod(lead.payment_method_type);
    return (
      <td style={{ padding: '14px 16px', minWidth: '140px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* method type pill */}
          {lead.payment_method_type && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
              {auto
                ? <Zap size={10} color="#9CA3AF" />
                : <PenLine size={10} color="#9CA3AF" />
              }
              <span style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: '500', textTransform: 'capitalize' }}>
                {lead.payment_method_type.replace('_', ' ')}
              </span>
            </div>
          )}
          {/* status badge */}
          {pspStatusBadge(lead.psp_status)}
          {/* decline reason */}
          {lead.decline_reason && (
            <div style={{ fontSize: '10px', color: '#DC2626', marginTop: '2px', maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lead.decline_reason}>
              {lead.decline_reason}
            </div>
          )}
        </div>
      </td>
    );
  };

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', maxWidth: '1400px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Sales CRM</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>{leads.length} total leads</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', border: '1px solid #E5E7EB', borderRadius: '5px', overflow: 'hidden' }}>
            {['table', 'kanban'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '7px 16px', border: 'none', borderRight: v === 'table' ? '1px solid #E5E7EB' : 'none', background: view === v ? '#111827' : '#fff', fontSize: '13px', fontWeight: '500', color: view === v ? '#fff' : '#374151', cursor: 'pointer', textTransform: 'capitalize' }}>
                {v}
              </button>
            ))}
          </div>
          <button onClick={() => fileRef.current.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
            <Upload size={13} /> Import
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
            <Download size={13} /> Export
          </button>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111827', border: '1px solid #111827', borderRadius: '5px', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer', letterSpacing: '0.1px' }}>
            <Plus size={13} /> Add Lead
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {sectionLabel('Pipeline Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total Leads',     value: leads.length },
          { label: 'Pipeline Value',  value: formatAmount(pipelineValue) },
          { label: 'Won Revenue',     value: formatAmount(totalValue) },
          { label: 'Conversion Rate', value: `${conversionRate}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
            <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
            <div style={{ color: '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{loading ? '—' : value}</div>
          </div>
        ))}
      </div>

      {divider}

      {/* ── Filters ── */}
      {sectionLabel('Filters')}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, company…" style={{ ...inputStyle, width: '220px' }} />
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="all">All Stages</option>
          {stages.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
          <option value="all">All Sources</option>
          {['manual', 'website', 'referral', 'social', 'email', 'cold_call'].map(s => (
            <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Sort</span>
          <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>
            {SORT_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#fff', fontSize: '12px', fontWeight: '500', color: '#374151', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
            {sortDir === 'asc' ? <><ChevronUp size={13} /> Asc</> : <><ChevronDown size={13} /> Desc</>}
          </button>
        </div>
      </div>

      {/* ── Table View ── */}
      {view === 'table' && (
        <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {[
                  { label: 'Lead',           key: 'first_name' },
                  { label: 'Company',        key: 'company' },
                  { label: 'Source',         key: 'source' },
                  { label: 'Stage',          key: 'stage' },
                  { label: 'Value',          key: 'estimated_value' },
                  { label: 'PSP',            key: null },
                  { label: 'Next Follow-up', key: 'next_followup_at' },
                  { label: 'Assigned',       key: 'assigned_to' },
                  { label: '',               key: null },
                ].map(({ label, key }, i) => (
                  <th key={i} onClick={key ? () => handleSort(key) : undefined} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: key ? 'pointer' : 'default', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {label}{key && <SortIcon field={key} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>
                  No leads yet.{' '}
                  <span style={{ color: '#111827', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowModal(true)}>Add your first lead</span>
                </td></tr>
              ) : filtered.map((l, idx) => {
                const overdue = l.next_followup_at && new Date(l.next_followup_at) < new Date();
                return (
                  <tr key={l.id} style={{ borderBottom: idx < filtered.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{l.first_name} {l.last_name}</div>
                      {l.email && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{l.email}</div>}
                      {l.phone && <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{l.phone}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{l.company || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>{sourceBadge(l.source)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <select value={l.stage} onChange={e => updateStage(l.id, e.target.value)} style={{ background: 'transparent', color: stageColors[l.stage]?.color || '#6B7280', border: `1px solid ${stageColors[l.stage]?.border || '#E5E7EB'}`, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', outline: 'none', textTransform: 'capitalize', fontFamily: 'Inter, sans-serif' }}>
                        {stages.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: '#111827' }}>{formatAmount(l.estimated_value)}</td>

                    {/* ── PSP column ── */}
                    <PspCell lead={l} />

                    <td style={{ padding: '14px 16px', fontSize: '12px', color: overdue ? '#DC2626' : '#6B7280', fontWeight: overdue ? '600' : '400' }}>{formatDate(l.next_followup_at)}</td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#6B7280' }}>{l.assigned_to || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        {!l.converted_client_id && l.stage !== 'closed_lost' && (
                          <button onClick={() => convertToClient(l)} style={{ padding: '4px 10px', border: '1px solid #BBF7D0', borderRadius: '4px', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#16A34A', whiteSpace: 'nowrap' }}>Convert</button>
                        )}
                        <button onClick={() => openEdit(l)} style={{ padding: '5px', border: '1px solid #E5E7EB', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                          <Edit2 size={12} color="#6B7280" />
                        </button>
                        <button onClick={() => remove(l.id)} style={{ padding: '5px', border: '1px solid #FECACA', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={12} color="#DC2626" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Kanban View ── */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', overflowX: 'auto' }}>
          {stages.map(stage => {
            const stageLeads = filtered.filter(l => l.stage === stage);
            const stageValue = stageLeads.reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);
            const c = stageColors[stage];
            return (
              <div key={stage} style={{ minWidth: '180px' }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ background: 'transparent', color: c.color, border: `1px solid ${c.border}`, padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{stage.replace('_', ' ')}</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>{stageLeads.length}</span>
                  </div>
                  {stageValue > 0 && <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: '600', paddingLeft: '2px' }}>{formatAmount(stageValue)}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '80px' }}>
                  {stageLeads.map(l => (
                    <div key={l.id} style={{ background: '#fff', borderRadius: '6px', border: '1px solid #E5E7EB', padding: '12px' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827', marginBottom: '3px' }}>{l.first_name} {l.last_name}</div>
                      {l.company && <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>{l.company}</div>}
                      {l.estimated_value > 0 && <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{formatAmount(l.estimated_value)}</div>}
                      {/* PSP status in kanban */}
                      {l.psp_status && <div style={{ marginBottom: '4px' }}>{pspStatusBadge(l.psp_status)}</div>}
                      {l.decline_reason && <div style={{ fontSize: '10px', color: '#DC2626', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.decline_reason}>{l.decline_reason}</div>}
                      {l.next_followup_at && (
                        <div style={{ fontSize: '10px', color: new Date(l.next_followup_at) < new Date() ? '#DC2626' : '#9CA3AF', display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '8px' }}>
                          <Clock size={10} /> {formatDate(l.next_followup_at)}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {!l.converted_client_id && stage !== 'closed_lost' && stage !== 'closed_won' && (
                          <button onClick={() => convertToClient(l)} style={{ flex: 1, padding: '4px', border: '1px solid #BBF7D0', borderRadius: '4px', background: 'transparent', cursor: 'pointer', fontSize: '10px', fontWeight: '600', color: '#16A34A' }}>Convert</button>
                        )}
                        <button onClick={() => remove(l.id)} style={{ padding: '4px 6px', border: '1px solid #FECACA', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={10} color="#DC2626" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '6px', width: '580px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB' }}>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827', letterSpacing: '-0.2px' }}>{editItem ? 'Edit Lead' : 'Add Lead'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}><X size={16} /></button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* Basic fields */}
                {[
                  { label: 'First Name *', key: 'first_name', placeholder: 'John' },
                  { label: 'Last Name *',  key: 'last_name',  placeholder: 'Smith' },
                  { label: 'Email',        key: 'email',      placeholder: 'john@company.com', type: 'email' },
                  { label: 'Phone',        key: 'phone',      placeholder: '+357 99 123456' },
                  { label: 'Company',      key: 'company',    placeholder: 'Company Ltd' },
                  { label: 'Country',      key: 'country',    placeholder: 'Cyprus' },
                ].map(({ label, key, placeholder, type }) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input type={type || 'text'} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
                  </div>
                ))}

                <div>
                  <label style={labelStyle}>Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="manual">Manual</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="social">Social Media</option>
                    <option value="email">Email Campaign</option>
                    <option value="cold_call">Cold Call</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {stages.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estimated Value</label>
                  <input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Assigned To</label>
                  <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Agent name" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Next Follow-up</label>
                  <input type="date" value={form.next_followup_at} onChange={e => setForm(f => ({ ...f, next_followup_at: e.target.value }))} style={inputStyle} />
                </div>

                {/* ── PSP Section ── */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #F3F4F6', paddingTop: '16px', marginTop: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Payment & PSP</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Payment Method</label>
                      <select
                        value={form.payment_method_type}
                        onChange={e => {
                          const val = e.target.value;
                          // if switching to auto, clear manual psp fields
                          setForm(f => ({ ...f, payment_method_type: val, ...(isAutoMethod(val) ? { psp_status: '', decline_reason: '' } : {}) }));
                        }}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        <option value="">— Not set —</option>
                        <option value="card">Debit / Credit Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="crypto">Crypto Wallet</option>
                      </select>
                    </div>

                    {/* Auto method: read-only note */}
                    {isAutoMethod(form.payment_method_type) && (
                      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '5px' }}>
                        <Zap size={13} color="#9CA3AF" />
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                          PSP status and decline reason will be populated automatically via webhook.
                        </span>
                      </div>
                    )}

                    {/* Crypto / not set: manual fields */}
                    {(!form.payment_method_type || form.payment_method_type === 'crypto') && (
                      <>
                        <div>
                          <label style={labelStyle}>PSP Status</label>
                          <select value={form.psp_status} onChange={e => setForm(f => ({ ...f, psp_status: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                            <option value="">— Not set —</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                        <div>
                          <label style={labelStyle}>Decline Reason</label>
                          <input
                            value={form.decline_reason}
                            onChange={e => setForm(f => ({ ...f, decline_reason: e.target.value }))}
                            placeholder={form.psp_status === 'failed' ? 'e.g. Insufficient funds' : '—'}
                            disabled={form.psp_status !== 'failed'}
                            style={{ ...inputStyle, background: form.psp_status !== 'failed' ? '#F9FAFB' : '#fff', color: form.psp_status !== 'failed' ? '#9CA3AF' : '#111827' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes about this lead…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '8px 18px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#fff', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                Cancel
              </button>
              <button onClick={save} disabled={!form.first_name || !form.last_name} style={{ padding: '8px 20px', background: !form.first_name || !form.last_name ? '#F3F4F6' : '#111827', border: '1px solid transparent', borderRadius: '5px', fontSize: '13px', fontWeight: '600', color: !form.first_name || !form.last_name ? '#9CA3AF' : '#fff', cursor: !form.first_name || !form.last_name ? 'not-allowed' : 'pointer', letterSpacing: '0.1px' }}>
                {editItem ? 'Save Changes' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
