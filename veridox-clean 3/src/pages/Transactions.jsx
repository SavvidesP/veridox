import { useEffect, useState, useRef } from 'react';
import { Upload, Download, FileText, Search, X, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const COLUMNS = [
  { key: 'created_date', label: 'Date' },
  { key: 'transaction_id', label: 'Transaction ID' },
  { key: 'brand_name', label: 'Brand' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'account_no', label: 'Account No.' },
  { key: 'type', label: 'Type' },
  { key: 'account_currency', label: 'Currency' },
  { key: 'amount', label: 'Amount' },
  { key: 'usd_amount', label: 'USD Amount' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'psp_actual', label: 'PSP' },
  { key: 'transaction_approval', label: 'Status' },
  { key: 'country_group', label: 'Country' },
];

const ALL_EXPORT_COLUMNS = [
  { key: 'created_date', label: 'Date' },
  { key: 'confirmation_date', label: 'Confirmation Date' },
  { key: 'transaction_id', label: 'Transaction ID' },
  { key: 'brand_name', label: 'Brand' },
  { key: 'first_name', label: 'First Name' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'deposit_owner', label: 'Deposit Owner' },
  { key: 'account_no', label: 'Account No.' },
  { key: 'type', label: 'Type' },
  { key: 'account_currency', label: 'Currency' },
  { key: 'amount', label: 'Amount' },
  { key: 'usd_amount', label: 'USD Amount' },
  { key: 'exchange_rate', label: 'Exchange Rate' },
  { key: 'net_deposit', label: 'Net Deposit' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'payment_processor', label: 'Payment Processor' },
  { key: 'sub_psp', label: 'Sub PSP' },
  { key: 'psp_actual', label: 'PSP' },
  { key: 'psp_actual_category', label: 'PSP Category' },
  { key: 'psp_transaction_id', label: 'PSP Transaction ID' },
  { key: 'cleared_by_name', label: 'Cleared By' },
  { key: 'sub_psp_transaction_id', label: 'Sub PSP Transaction ID' },
  { key: 'transaction_approval', label: 'Status' },
  { key: 'department', label: 'Department' },
  { key: 'department_type', label: 'Department Type' },
  { key: 'country_group', label: 'Country' },
];

// ── Badge helpers — same visual language as Dashboard kycBadge ──
const statusBadge = (s) => {
  if (!s) return null;
  const v = s.toLowerCase();
  let style;
  if (v === 'success' || v === 'approved') {
    style = { color: '#16A34A', border: '1px solid #BBF7D0' };
  } else if (v === 'failed' || v === 'rejected') {
    style = { color: '#DC2626', border: '1px solid #FECACA' };
  } else {
    style = { color: '#9CA3AF', border: '1px solid #E5E7EB' };
  }
  return (
    <span style={{
      ...style,
      background: 'transparent',
      padding: '2px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.3px',
    }}>
      {s}
    </span>
  );
};

const typeBadge = (t) => {
  if (!t) return null;
  const isDeposit = t.toLowerCase() === 'deposit';
  return (
    <span style={{
      background: 'transparent',
      color: isDeposit ? '#2563EB' : '#D97706',
      border: `1px solid ${isDeposit ? '#BFDBFE' : '#FDE68A'}`,
      padding: '2px 10px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: '600',
      letterSpacing: '0.3px',
    }}>
      {t}
    </span>
  );
};

function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TX_COL_FILTERS_KEY = 'veridox-tx-colfilters';

// Text used for per-column filtering (matches what's shown in the cell where it differs from the raw value).
function cellText(key, t) {
  if (key === 'created_date') return formatDate(t.created_date);
  if (key === 'amount') return formatAmount(t.amount);
  if (key === 'usd_amount') return formatAmount(t.usd_amount);
  return String(t[key] ?? '');
}

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

export default function Transactions() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedCols, setSelectedCols] = useState(ALL_EXPORT_COLUMNS.map(c => c.key));
  const [exportFilters, setExportFilters] = useState({ dateFrom: '', dateTo: '', brand: 'all', status: 'all', type: 'all', firstName: '', lastName: '' });
  const [exporting, setExporting] = useState(false);
  // Per-column filters (client-side, across the whole dataset) — persist across refresh until cleared.
  const [colFilters, setColFilters] = useState(() => {
    try { return JSON.parse(localStorage.getItem(TX_COL_FILTERS_KEY)) || {}; } catch { return {}; }
  });
  const fileRef = useRef();
  const PAGE_SIZE = 50;

  const brands = [...new Set(transactions.map(t => t.brand_name).filter(Boolean))].sort();

  // Load ALL transactions once (batched to bypass the 1000-row cap) so every filter
  // — search, brand/type/status and per-column — applies across the entire dataset, then
  // paginate client-side.
  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    try { localStorage.setItem(TX_COL_FILTERS_KEY, JSON.stringify(colFilters)); } catch { /* ignore */ }
  }, [colFilters]);

  // Any filter change returns to the first page.
  useEffect(() => { setPage(0); }, [search, filterBrand, filterType, filterStatus, colFilters]);

  async function fetchAll() {
    setLoading(true);
    const all = [];
    const BATCH = 1000;
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await supabase.from('transactions').select('*').order('created_date', { ascending: false }).range(from, from + BATCH - 1);
      if (error || !data || data.length === 0) break;
      all.push(...data);
      if (data.length < BATCH) break;
    }
    setTransactions(all);
    setLoading(false);
  }

  async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'yyyy-mm-dd' });
    const mapped = rows.map(r => ({
      created_date: r['created_date'] || null,
      confirmation_date: r['Confirmation Date'] || null,
      brand_name: r['brand_name'] || null,
      transaction_id: r['Transaction ID'] || null,
      deposit_owner: r['Deposit Owner'] || null,
      account_no: String(r['Account No.'] || ''),
      type: r['Type'] || null,
      account_currency: r['account_currency'] || null,
      amount: parseFloat(r['amount']) || null,
      usd_amount: parseFloat(r['usd amount']) || null,
      exchange_rate: parseFloat(r['usd/eur exchange rate']) || null,
      net_deposit: parseFloat(r['Net Deposit']) || null,
      payment_method: r['Payment Method'] || null,
      payment_processor: r['Payment Processor'] || null,
      sub_psp: r['sub_psp'] || null,
      psp_actual: r['psp_actual'] || null,
      psp_actual_category: r['psp_actual_category'] || null,
      psp_transaction_id: r['psp_transaction_id'] || null,
      cleared_by_name: r['cleared_by_name'] || null,
      sub_psp_transaction_id: r['sub_psp_transaction_id'] || null,
      first_name: r['first_name'] || null,
      last_name: r['last_name'] || null,
      transaction_approval: r['Transaction Approval'] || null,
      department: r['Department'] || null,
      department_type: r['Department Type'] || null,
      country_group: r['country_group'] || null,
    }));
    for (let i = 0; i < mapped.length; i += 500) {
      await supabase.from('transactions').insert(mapped.slice(i, i + 500));
    }
    setImporting(false);
    setPage(0);
    fetchAll();
  }

  async function exportExcel() {
    setExporting(true);
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    let q = supabase.from('transactions').select('*');
    if (exportFilters.brand !== 'all') q = q.eq('brand_name', exportFilters.brand);
    if (exportFilters.status !== 'all') q = q.ilike('transaction_approval', exportFilters.status);
    if (exportFilters.type !== 'all') q = q.eq('type', exportFilters.type);
    if (exportFilters.dateFrom) q = q.gte('created_date', exportFilters.dateFrom);
    if (exportFilters.dateTo) q = q.lte('created_date', exportFilters.dateTo + 'T23:59:59');
    if (exportFilters.firstName) q = q.ilike('first_name', `%${exportFilters.firstName}%`);
    if (exportFilters.lastName) q = q.ilike('last_name', `%${exportFilters.lastName}%`);
    const { data } = await q;
    if (!data?.length) { alert('No transactions match your filters.'); setExporting(false); return; }
    const rateMap = {};
    const uniqueCombos = [...new Map(
      data
        .filter(t => t.account_currency && t.account_currency !== 'USD' && t.created_date)
        .map(t => {
          const date = String(t.created_date).slice(0, 10);
          const key = `${date}|${t.account_currency}`;
          return [key, { date, currency: t.account_currency, key }];
        })
    ).values()];
    for (let i = 0; i < uniqueCombos.length; i += 5) {
      const batch = uniqueCombos.slice(i, i + 5);
      await Promise.all(batch.map(async ({ date, currency, key }) => {
        try {
          const res = await fetch(`https://api.frankfurter.app/${date}?from=${currency}&to=USD`);
          if (!res.ok) { rateMap[key] = null; return; }
          const json = await res.json();
          rateMap[key] = json.rates?.USD ?? null;
        } catch { rateMap[key] = null; }
      }));
    }
    const activeCols = ALL_EXPORT_COLUMNS.filter(c => selectedCols.includes(c.key));
    const rows = data.map(t => {
      const row = {};
      activeCols.forEach(col => {
        const v = t[col.key];
        if (col.key === 'created_date' || col.key === 'confirmation_date') row[col.label] = formatDate(v);
        else if (['amount', 'usd_amount', 'exchange_rate', 'net_deposit'].includes(col.key)) row[col.label] = v;
        else row[col.label] = v || '';
      });
      const amt = parseFloat(t.amount) || 0;
      if (t.account_currency === 'USD') {
        row['Amount (USD)'] = parseFloat(amt.toFixed(2));
      } else if (t.account_currency && t.created_date) {
        const key = `${String(t.created_date).slice(0, 10)}|${t.account_currency}`;
        const rate = rateMap[key];
        row['Amount (USD)'] = rate ? parseFloat((amt * rate).toFixed(2)) : 'N/A';
      } else {
        row['Amount (USD)'] = 'N/A';
      }
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `veridox-transactions-${new Date().toISOString().slice(0, 10)}.xlsx`);
    setExporting(false);
    setShowExportModal(false);
  }

  async function downloadStatement(brand) {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    const { data } = await supabase.from('transactions').select('*').eq('brand_name', brand).order('created_date', { ascending: true });
    if (!data?.length) return;
    let balance = 0;
    const rows = data.map(t => {
      const amt = t.type?.toLowerCase() === 'withdrawal' ? -(t.amount || 0) : (t.amount || 0);
      balance += amt;
      return {
        'Date': formatDate(t.created_date),
        'Transaction ID': t.transaction_id,
        'Description': `${t.type || ''} via ${t.payment_method || 'N/A'} — ${t.first_name || ''} ${t.last_name || ''}`.trim(),
        'Amount': amt,
        'Currency': t.account_currency,
        'Balance': parseFloat(balance.toFixed(2)),
      };
    });
    const totalDeposits    = data.filter(t => t.type?.toLowerCase() === 'deposit').reduce((s, t) => s + (t.amount || 0), 0);
    const totalWithdrawals = data.filter(t => t.type?.toLowerCase() === 'withdrawal').reduce((s, t) => s + (t.amount || 0), 0);
    const successful       = data.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;
    const summary = [
      { 'Field': 'Company',            'Value': brand },
      { 'Field': 'Statement Date',     'Value': new Date().toLocaleDateString() },
      { 'Field': 'Total Transactions', 'Value': data.length },
      { 'Field': 'Successful',         'Value': successful },
      { 'Field': 'Total Deposits',     'Value': parseFloat(totalDeposits.toFixed(2)) },
      { 'Field': 'Total Withdrawals',  'Value': parseFloat(totalWithdrawals.toFixed(2)) },
      { 'Field': 'Net Balance',        'Value': parseFloat((totalDeposits - totalWithdrawals).toFixed(2)) },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transactions');
    XLSX.writeFile(wb, `${brand}-statement-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // Filter the ENTIRE dataset (search + brand/type/status + per-column), then paginate client-side.
  const searchLc = search.trim().toLowerCase();
  const filteredAll = transactions.filter(t => {
    if (filterBrand !== 'all' && t.brand_name !== filterBrand) return false;
    if (filterType !== 'all' && (t.type || '') !== filterType) return false;
    if (filterStatus !== 'all' && (t.transaction_approval || '').toLowerCase() !== filterStatus.toLowerCase()) return false;
    if (searchLc && ![t.transaction_id, t.first_name, t.last_name, t.account_no].some(v => String(v || '').toLowerCase().includes(searchLc))) return false;
    return COLUMNS.every(col => {
      const fv = (colFilters[col.key] || '').trim().toLowerCase();
      return !fv || cellText(col.key, t).toLowerCase().includes(fv);
    });
  });
  const total = transactions.length;
  const totalPages = Math.ceil(filteredAll.length / PAGE_SIZE);
  const displayed = filteredAll.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasColFilters = Object.values(colFilters).some(v => (v || '').trim() !== '');
  const clearColFilters = () => setColFilters({});

  // ── shared input style (matches Dashboard selects/inputs) ──
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
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', maxWidth: '1280px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Transactions</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>{total.toLocaleString()} total records</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => fileRef.current.click()}
            disabled={importing}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: importing ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => { if (!importing) e.currentTarget.style.borderColor = '#9CA3AF'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; }}
          >
            <Upload size={13} /> {importing ? 'Importing…' : 'Import Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button
            onClick={() => setShowExportModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111827', border: '1px solid #111827', borderRadius: '5px', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer', letterSpacing: '0.1px' }}
          >
            <Download size={13} /> Export Excel
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      {sectionLabel('Filters')}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search ID, name, account…"
            style={{ ...inputStyle, paddingLeft: '32px', width: '220px' }}
          />
        </div>

        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setPage(0); }} style={inputStyle}>
          <option value="all">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>

        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }} style={inputStyle}>
          <option value="all">All Types</option>
          <option value="Deposit">Deposit</option>
          <option value="Withdrawal">Withdrawal</option>
        </select>

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} style={inputStyle}>
          <option value="all">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Failed">Failed</option>
          <option value="Pending">Pending</option>
        </select>

        {hasColFilters && (
          <button onClick={clearColFilters} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>
            <X size={13} /> Clear filters
          </button>
        )}

        {filterBrand !== 'all' && (
          <button
            onClick={() => downloadStatement(filterBrand)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
          >
            <FileText size={13} /> Statement — {filterBrand}
          </button>
        )}
      </div>

      {/* ── Brand statements row (when no brand filter active) ── */}
      {brands.length > 0 && filterBrand === 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <span style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Statements</span>
          {brands.map(b => (
            <button
              key={b}
              onClick={() => downloadStatement(b)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '12px', fontWeight: '500', color: '#374151', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
            >
              <FileText size={12} /> {b}
            </button>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {COLUMNS.map(c => (
                <th key={c.key} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {c.label}
                </th>
              ))}
            </tr>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {COLUMNS.map(c => (
                <th key={c.key + '-f'} style={{ padding: '0 16px 8px' }}>
                  <input value={colFilters[c.key] || ''} onChange={e => setColFilters(f => ({ ...f, [c.key]: e.target.value }))} placeholder="Filter…"
                    style={{ width: '100%', minWidth: '80px', boxSizing: 'border-box', padding: '5px 8px', border: '1px solid #E5E7EB', borderRadius: '5px', fontSize: '11px', fontWeight: '400', color: '#111827', background: '#fff', outline: 'none', textTransform: 'none', letterSpacing: 'normal' }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>
                  Loading…
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>
                  {transactions.length === 0 ? (
                    <>No transactions yet.{' '}
                      <span style={{ color: '#111827', fontWeight: '500', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => fileRef.current.click()}>
                        Import your first file
                      </span>
                    </>
                  ) : 'No transactions match your filters.'}
                </td>
              </tr>
            ) : displayed.map((t, idx) => (
              <tr
                key={t.id}
                onClick={() => navigate(`/transactions/${t.id}`)}
                style={{ borderBottom: idx < displayed.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: 'pointer', background: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <td style={{ padding: '14px 16px', color: '#9CA3AF', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(t.created_date)}</td>
                <td style={{ padding: '14px 16px', color: '#111827', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{t.transaction_id || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px', whiteSpace: 'nowrap' }}>{t.brand_name || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{t.first_name || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '13px' }}>{t.last_name || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{t.account_no || '—'}</td>
                <td style={{ padding: '14px 16px' }}>{typeBadge(t.type)}</td>
                <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '12px' }}>{t.account_currency || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(t.amount)}</td>
                <td style={{ padding: '14px 16px', color: '#9CA3AF', fontSize: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(t.usd_amount)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.payment_method || '—'}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.psp_actual || '—'}</td>
                <td style={{ padding: '14px 16px' }}>{statusBadge(t.transaction_approval)}</td>
                <td style={{ padding: '14px 16px', color: '#374151', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.country_group || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredAll.length)} of {filteredAll.length.toLocaleString()}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#fff', fontSize: '13px', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? '#D1D5DB' : '#374151', fontFamily: 'Inter, sans-serif' }}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{ padding: '6px 14px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#fff', fontSize: '13px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: page >= totalPages - 1 ? '#D1D5DB' : '#374151', fontFamily: 'Inter, sans-serif' }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── Export Modal ── */}
      {showExportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '6px', width: '560px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB' }}>

            {/* Modal header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#111827', fontWeight: '700', fontSize: '15px', letterSpacing: '-0.2px' }}>Export Transactions</div>
                <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '3px' }}>Amount (USD) uses the exchange rate from each transaction's date</div>
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
                  {[
                    { label: 'Date From', key: 'dateFrom', type: 'date' },
                    { label: 'Date To',   key: 'dateTo',   type: 'date' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>{label}</label>
                      <input
                        type={type}
                        value={exportFilters[key]}
                        onChange={e => setExportFilters(f => ({ ...f, [key]: e.target.value }))}
                        style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Brand</label>
                    <select value={exportFilters.brand} onChange={e => setExportFilters(f => ({ ...f, brand: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="all">All Brands</option>
                      {brands.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Status</label>
                    <select value={exportFilters.status} onChange={e => setExportFilters(f => ({ ...f, status: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="all">All Statuses</option>
                      <option value="Success">Approved</option>
                      <option value="Failed">Declined</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Type</label>
                    <select value={exportFilters.type} onChange={e => setExportFilters(f => ({ ...f, type: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', cursor: 'pointer' }}>
                      <option value="all">All Types</option>
                      <option value="Deposit">Deposit</option>
                      <option value="Withdrawal">Withdrawal</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>First Name</label>
                    <input type="text" placeholder="e.g. James" value={exportFilters.firstName} onChange={e => setExportFilters(f => ({ ...f, firstName: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' }}>Last Name</label>
                    <input type="text" placeholder="e.g. Smith" value={exportFilters.lastName} onChange={e => setExportFilters(f => ({ ...f, lastName: e.target.value }))} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
                <button
                  onClick={() => setExportFilters({ dateFrom: '', dateTo: '', brand: 'all', status: 'all', type: 'all', firstName: '', lastName: '' })}
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
                  ? 'Fetching rates…'
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
