import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Copy, Check, Eye, EyeOff, Upload, Download, X, Search, CheckSquare, Square } from 'lucide-react';

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

// ── Columns available in the export ──
const ALL_EXPORT_COLUMNS = [
  { key: 'first_name',           label: 'First Name' },
  { key: 'last_name',            label: 'Last Name' },
  { key: 'email',                label: 'Email' },
  { key: 'phone',                label: 'Phone' },
  { key: 'company_name',         label: 'Company' },
  { key: 'country',              label: 'Country' },
  { key: 'lead_source',          label: 'Source' },
  { key: 'estimated_value',      label: 'Value' },
  { key: 'status',               label: 'KYC Status' },
  { key: 'assigned_to',          label: 'Assigned To' },
  { key: 'converted_at',         label: 'Converted At' },
  { key: 'tradescope_email',     label: 'TradeScope Email' },
  { key: 'tradescope_password',  label: 'TradeScope Password' },
  { key: 'tradescope_trader_id', label: 'TradeScope Trader ID' },
  { key: 'payment_methods',      label: 'Payment Methods' },
  { key: 'psps',                 label: 'PSPs' },
  { key: 'payment_processors',   label: 'Payment Processors' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} style={{ padding: '2px 7px', border: '1px solid #E5E7EB', borderRadius: '4px', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#6B7280', flexShrink: 0 }}>
      {copied ? <Check size={10} color="#16A34A" /> : <Copy size={10} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CredentialsCell({ email, password }) {
  const [show, setShow] = useState(false);
  if (!email) return <span style={{ color: '#D1D5DB', fontSize: '11px' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }} onClick={e => e.stopPropagation()}>
      {/* Status badge */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A', flexShrink: 0 }} />
        <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: '600' }}>TradeScope Active</span>
      </div>
      {/* Email row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: '#374151', fontFamily: 'monospace' }}>{email}</span>
        <CopyButton text={email} />
      </div>
      {/* Password row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: '#374151', fontFamily: 'monospace', letterSpacing: show ? '0.5px' : '2px' }}>
          {show ? password : '••••••••••••'}
        </span>
        <button onClick={e => { e.stopPropagation(); setShow(v => !v); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', display: 'flex', alignItems: 'center', color: '#9CA3AF' }}>
          {show ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
        {show && <CopyButton text={password} />}
      </div>
      {/* Copy all */}
      <CopyButton text={`TradeScope Login\nURL: https://tradescope.net\nEmail: ${email}\nPassword: ${password}`} />
    </div>
  );
}

// Small pill used to preview a client's deposit methods in the table
function MethodPills({ values }) {
  if (!values.length) return <span style={{ color: '#D1D5DB', fontSize: '11px' }}>—</span>;
  const shown = values.slice(0, 3);
  const extra = values.length - shown.length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {shown.map(v => (
        <span key={v} style={{ background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', whiteSpace: 'nowrap' }}>{v}</span>
      ))}
      {extra > 0 && <span style={{ color: '#9CA3AF', fontSize: '11px', alignSelf: 'center' }}>+{extra}</span>}
    </div>
  );
}

export default function ConvertedClients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [txByClient, setTxByClient] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('all');
  const [filterPsp, setFilterPsp] = useState('all');
  const [filterProcessor, setFilterProcessor] = useState('all');

  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCols, setSelectedCols] = useState(ALL_EXPORT_COLUMNS.map(c => c.key));
  const [exportFilters, setExportFilters] = useState({ dateFrom: '', dateTo: '', method: 'all', psp: 'all', processor: 'all' });
  const [exporting, setExporting] = useState(false);

  useEffect(() => { fetchConverted(); }, []);

  // Auto-refresh: re-fetch (silently) when transactions/leads change in real time,
  // or when the tab regains focus — so newly imported deposits show up (and their
  // PSP/method/processor values populate the filter dropdowns) without a manual reload.
  useEffect(() => {
    let debounce;
    const refresh = () => { clearTimeout(debounce); debounce = setTimeout(() => fetchConverted({ silent: true }), 400); };

    const channel = supabase
      .channel('converted-clients-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_leads' }, refresh)
      .subscribe();

    const onFocus = () => { if (document.visibilityState !== 'hidden') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearTimeout(debounce);
      supabase.removeChannel(channel);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  async function fetchConverted({ silent = false } = {}) {
    if (!silent) setLoading(true);
    const { data: leads } = await supabase
      .from('sales_leads')
      .select('*')
      .not('converted_client_id', 'is', null)
      .order('updated_at', { ascending: false });

    if (!leads?.length) { setClients([]); setTxByClient({}); setLoading(false); return; }

    const ids = leads.map(l => l.converted_client_id);
    const [{ data: cliData }, { data: txData }] = await Promise.all([
      supabase.from('clients').select('*').in('id', ids),
      supabase
        .from('transactions')
        .select('client_id, payment_method, psp_actual, payment_processor, created_date, type')
        .in('client_id', ids),
    ]);

    // Group transactions per client for filtering / preview / export
    const txMap = {};
    (txData || []).forEach(t => {
      if (!t.client_id) return;
      (txMap[t.client_id] ||= []).push(t);
    });
    setTxByClient(txMap);

    const enriched = (cliData || []).map(c => {
      const lead = leads.find(l => l.converted_client_id === c.id);
      return {
        ...c,
        lead_source:          lead?.source,
        assigned_to:          lead?.assigned_to,
        estimated_value:      lead?.estimated_value,
        converted_at:         lead?.updated_at,
        lead_notes:           lead?.notes,
        tradescope_email:     lead?.tradescope_email,
        tradescope_password:  lead?.tradescope_password,
        tradescope_trader_id: lead?.tradescope_trader_id,
      };
    }).sort((a, b) => new Date(b.converted_at) - new Date(a.converted_at));

    setClients(enriched);
    setLoading(false);
  }

  // Distinct values (from the converted clients' transactions) that populate the filter dropdowns
  const allTx = Object.values(txByClient).flat();
  const methodOptions    = [...new Set(allTx.map(t => t.payment_method).filter(Boolean))].sort();
  const pspOptions       = [...new Set(allTx.map(t => t.psp_actual).filter(Boolean))].sort();
  const processorOptions = [...new Set(allTx.map(t => t.payment_processor).filter(Boolean))].sort();

  // Distinct methods/psps/processors for a single client (preview + export)
  const distinctFor = (clientId, key) =>
    [...new Set((txByClient[clientId] || []).map(t => t[key]).filter(Boolean))];

  // A client passes the transaction filters if ANY of their transactions satisfies
  // every active condition simultaneously (method AND psp AND processor AND date range).
  function matchesTxFilters(c, { method, psp, processor, dateFrom, dateTo }) {
    const noFilter =
      (!method || method === 'all') &&
      (!psp || psp === 'all') &&
      (!processor || processor === 'all') &&
      !dateFrom && !dateTo;
    if (noFilter) return true;
    const txs = txByClient[c.id] || [];
    return txs.some(t => {
      if (method && method !== 'all' && t.payment_method !== method) return false;
      if (psp && psp !== 'all' && t.psp_actual !== psp) return false;
      if (processor && processor !== 'all' && t.payment_processor !== processor) return false;
      const d = t.created_date ? String(t.created_date).slice(0, 10) : '';
      if (dateFrom && (!d || d < dateFrom)) return false;
      if (dateTo && (!d || d > dateTo)) return false;
      return true;
    });
  }

  const filtered = clients.filter(c => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hit =
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return matchesTxFilters(c, { method: filterMethod, psp: filterPsp, processor: filterProcessor });
  });

  const totalValue = clients.reduce((s, c) => s + (parseFloat(c.estimated_value) || 0), 0);
  const withTradeScope = clients.filter(c => c.tradescope_email).length;

  const clearFilters = () => { setFilterMethod('all'); setFilterPsp('all'); setFilterProcessor('all'); };
  const filtersActive = filterMethod !== 'all' || filterPsp !== 'all' || filterProcessor !== 'all';

  // ── Import: each row becomes a client + a linked closed_won lead (so it shows here) ──
  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });

      const pick = (r, ...keys) => {
        for (const k of keys) { if (r[k] != null && r[k] !== '') return r[k]; }
        return null;
      };

      let ok = 0, fail = 0;
      for (const r of rows) {
        const firstName = pick(r, 'First Name', 'first_name');
        const lastName  = pick(r, 'Last Name', 'last_name');
        const email     = pick(r, 'Email', 'email');
        if (!firstName && !lastName && !email) continue;

        const phone   = pick(r, 'Phone', 'phone');
        const company = pick(r, 'Company', 'company_name', 'company');
        const country = pick(r, 'Country', 'country');
        const kyc     = (pick(r, 'KYC Status', 'status') || 'approved').toString().toLowerCase().replace(/\s+/g, '_');

        // 1. Create the client
        const { data: cli, error: cErr } = await supabase.from('clients').insert({
          first_name: firstName || null,
          last_name:  lastName || null,
          email:      email || null,
          phone:      phone || null,
          company_name: company || null,
          country:    country || null,
          status:     kyc,
        }).select().single();

        if (cErr || !cli) { fail++; continue; }

        // 2. Create a converted (closed_won) lead pointing at the client
        const { error: lErr } = await supabase.from('sales_leads').insert({
          first_name: firstName || null,
          last_name:  lastName || null,
          email:      email || null,
          phone:      phone || null,
          company:    company || null,
          country:    country || null,
          source:     (pick(r, 'Source', 'source') || 'manual'),
          status:     'active',
          stage:      'closed_won',
          assigned_to: pick(r, 'Assigned To', 'assigned_to'),
          estimated_value: parseFloat(pick(r, 'Value', 'Estimated Value', 'estimated_value')) || 0,
          currency:   'USD',
          converted_client_id: cli.id,
          tradescope_email:     pick(r, 'TradeScope Email', 'tradescope_email'),
          tradescope_password:  pick(r, 'TradeScope Password', 'tradescope_password'),
          tradescope_trader_id: pick(r, 'TradeScope Trader ID', 'tradescope_trader_id'),
          updated_at: new Date().toISOString(),
        });

        if (lErr) fail++; else ok++;
      }

      alert(`Imported ${ok} converted client${ok === 1 ? '' : 's'}.` + (fail ? ` ${fail} row${fail === 1 ? '' : 's'} failed.` : ''));
      fetchConverted();
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Export: converted clients matching the modal filters, chosen columns ──
  async function exportExcel() {
    setExporting(true);
    try {
      const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const activeCols = ALL_EXPORT_COLUMNS.filter(c => selectedCols.includes(c.key));
      const matched = clients.filter(c => matchesTxFilters(c, exportFilters));

      if (!matched.length) { alert('No converted clients match your filters.'); setExporting(false); return; }

      const rows = matched.map(c => {
        const row = {};
        activeCols.forEach(col => {
          if (col.key === 'payment_methods')      row[col.label] = distinctFor(c.id, 'payment_method').join(', ');
          else if (col.key === 'psps')            row[col.label] = distinctFor(c.id, 'psp_actual').join(', ');
          else if (col.key === 'payment_processors') row[col.label] = distinctFor(c.id, 'payment_processor').join(', ');
          else if (col.key === 'converted_at')    row[col.label] = formatDate(c.converted_at);
          else if (col.key === 'estimated_value') row[col.label] = parseFloat(c.estimated_value) || 0;
          else row[col.label] = c[col.key] || '';
        });
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Converted Clients');
      XLSX.writeFile(wb, `veridox-converted-clients-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setShowExportModal(false);
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const inputStyle = {
    padding: '7px 10px',
    border: '1px solid #E5E7EB',
    borderRadius: '5px',
    fontSize: '13px',
    color: '#111827',
    background: '#fff',
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
  };

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Converted Clients</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>Leads successfully converted to clients</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: importing ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => { if (!importing) e.currentTarget.style.borderColor = '#9CA3AF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <Upload size={13} /> {importing ? 'Importing…' : 'Import'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button
            onClick={() => setShowExportModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111827', border: '1px solid #111827', borderRadius: '5px', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer', letterSpacing: '0.1px' }}
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* Stats */}
      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total Converted', value: loading ? '—' : clients.length },
          { label: 'Total Value',     value: loading ? '—' : formatAmount(totalValue) },
          { label: 'TradeScope Accounts', value: loading ? '—' : withTradeScope },
          { label: 'This Month', value: loading ? '—' : clients.filter(c => {
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

      {/* Filters */}
      {sectionLabel('Clients')}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            style={{ ...inputStyle, paddingLeft: '32px', width: '240px' }}
          />
        </div>

        <select value={filterMethod} onChange={e => setFilterMethod(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="all">All Methods</option>
          {methodOptions.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={filterPsp} onChange={e => setFilterPsp(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="all">All PSPs</option>
          {pspOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select value={filterProcessor} onChange={e => setFilterProcessor(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="all">All Processors</option>
          {processorOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {filtersActive && (
          <button
            onClick={clearFilters}
            style={{ fontSize: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontFamily: 'Inter, sans-serif' }}
          >
            Clear filters
          </button>
        )}

        <span style={{ marginLeft: 'auto', color: '#9CA3AF', fontSize: '12px' }}>
          {loading ? '' : `${filtered.length} of ${clients.length}`}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1120px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Client', 'Company', 'Email', 'Country', 'Source', 'Value', 'KYC', 'Payment Methods', 'TradeScope Credentials', 'Assigned To', 'Converted'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={11} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>
                {search || filtersActive ? 'No results found.' : 'No converted clients yet. Convert a lead from Sales CRM to get started.'}
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
                <td style={{ padding: '14px 16px', minWidth: '160px' }}><MethodPills values={distinctFor(c.id, 'payment_method')} /></td>
                <td style={{ padding: '14px 16px', minWidth: '200px' }}>
                  <CredentialsCell email={c.tradescope_email} password={c.tradescope_password} />
                </td>
                <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px' }}>{c.assigned_to || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#9CA3AF', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(c.converted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '6px', width: '560px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB' }}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#111827', fontWeight: '700', fontSize: '15px', letterSpacing: '-0.2px' }}>Export Converted Clients</div>
                <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '3px' }}>Filter by the payment method, PSP, processor and date of their deposits</div>
              </div>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>

              {/* Filters section */}
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>Filters</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Date From</label>
                    <input type="date" value={exportFilters.dateFrom} onChange={e => setExportFilters(f => ({ ...f, dateFrom: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Date To</label>
                    <input type="date" value={exportFilters.dateTo} onChange={e => setExportFilters(f => ({ ...f, dateTo: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Payment Method</label>
                    <select value={exportFilters.method} onChange={e => setExportFilters(f => ({ ...f, method: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="all">All Methods</option>
                      {methodOptions.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>PSP</label>
                    <select value={exportFilters.psp} onChange={e => setExportFilters(f => ({ ...f, psp: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="all">All PSPs</option>
                      {pspOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Payment Processor</label>
                    <select value={exportFilters.processor} onChange={e => setExportFilters(f => ({ ...f, processor: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="all">All Processors</option>
                      {processorOptions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => setExportFilters({ dateFrom: '', dateTo: '', method: 'all', psp: 'all', processor: 'all' })}
                  style={{ marginTop: '10px', fontSize: '12px', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}
                >
                  Clear filters
                </button>
              </div>

              {/* Columns section */}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Columns <span style={{ color: '#D1D5DB' }}>({selectedCols.length}/{ALL_EXPORT_COLUMNS.length})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setSelectedCols(ALL_EXPORT_COLUMNS.map(c => c.key))} style={{ fontSize: '12px', fontWeight: '600', color: '#111827', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Select all</button>
                    <button onClick={() => setSelectedCols([])} style={{ fontSize: '12px', fontWeight: '500', color: '#9CA3AF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                  {ALL_EXPORT_COLUMNS.map(col => {
                    const checked = selectedCols.includes(col.key);
                    return (
                      <label
                        key={col.key}
                        onClick={e => e.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', borderRadius: '5px', cursor: 'pointer', background: checked ? '#F9FAFB' : 'transparent' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelectedCols(prev => checked ? prev.filter(k => k !== col.key) : [...prev, col.key])}
                          style={{ display: 'none' }}
                        />
                        {checked
                          ? <CheckSquare size={14} color="#111827" />
                          : <Square size={14} color="#D1D5DB" />
                        }
                        <span style={{ fontSize: '12px', color: checked ? '#111827' : '#6B7280', fontWeight: checked ? '500' : '400' }}>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowExportModal(false)}
                style={{ padding: '8px 18px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#fff', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
              >
                Cancel
              </button>
              <button
                onClick={exportExcel}
                disabled={selectedCols.length === 0 || exporting}
                style={{
                  padding: '8px 20px',
                  background: selectedCols.length === 0 || exporting ? '#F3F4F6' : '#111827',
                  border: '1px solid transparent',
                  borderRadius: '5px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: selectedCols.length === 0 || exporting ? '#9CA3AF' : '#fff',
                  cursor: selectedCols.length === 0 || exporting ? 'not-allowed' : 'pointer',
                  minWidth: '160px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  justifyContent: 'center',
                  letterSpacing: '0.1px',
                }}
              >
                {exporting
                  ? 'Exporting…'
                  : <><Download size={13} />Export {selectedCols.length} columns</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
