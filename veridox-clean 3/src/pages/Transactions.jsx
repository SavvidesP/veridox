import { useEffect, useState, useRef } from 'react';
import { Upload, Download, FileText, Search, Filter, X } from 'lucide-react';
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

const statusStyle = (s) => {
  if (!s) return {};
  const v = s.toLowerCase();
  if (v === 'success' || v === 'approved') return { background: '#DCFCE7', color: '#166534' };
  if (v === 'failed' || v === 'rejected') return { background: '#FEE2E2', color: '#991B1B' };
  return { background: '#FEF9C3', color: '#854D0E' };
};

const typeStyle = (t) => {
  if (!t) return {};
  return t.toLowerCase() === 'deposit'
    ? { background: '#EEF2FF', color: '#4338CA' }
    : { background: '#FFF7ED', color: '#C2410C' };
};

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const fileRef = useRef();
  const PAGE_SIZE = 50;

  const brands = [...new Set(transactions.map(t => t.brand_name).filter(Boolean))].sort();

  useEffect(() => { fetchTransactions(); }, [page, filterBrand, filterType, filterStatus]);

  async function fetchTransactions() {
    setLoading(true);
    let q = supabase.from('transactions').select('*', { count: 'exact' });
    if (filterBrand !== 'all') q = q.eq('brand_name', filterBrand);
    if (filterType !== 'all') q = q.eq('type', filterType);
    if (filterStatus !== 'all') q = q.ilike('transaction_approval', filterStatus);
    if (search) q = q.or(`transaction_id.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,account_no.ilike.%${search}%`);
    q = q.order('created_date', { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    const { data, count } = await q;
    setTransactions(data || []);
    setTotal(count || 0);
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

    // Insert in batches of 500
    for (let i = 0; i < mapped.length; i += 500) {
      await supabase.from('transactions').insert(mapped.slice(i, i + 500));
    }
    setImporting(false);
    setPage(0);
    fetchTransactions();
  }

  async function exportExcel() {
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
    let q = supabase.from('transactions').select('*');
    if (filterBrand !== 'all') q = q.eq('brand_name', filterBrand);
    if (filterType !== 'all') q = q.eq('type', filterType);
    if (filterStatus !== 'all') q = q.ilike('transaction_approval', filterStatus);
    const { data } = await q;
    if (!data?.length) return;
    const rows = data.map(t => ({
      'Date': formatDate(t.created_date),
      'Transaction ID': t.transaction_id,
      'Brand': t.brand_name,
      'First Name': t.first_name,
      'Last Name': t.last_name,
      'Account No.': t.account_no,
      'Type': t.type,
      'Currency': t.account_currency,
      'Amount': t.amount,
      'USD Amount': t.usd_amount,
      'Payment Method': t.payment_method,
      'PSP': t.psp_actual,
      'Status': t.transaction_approval,
      'Country': t.country_group,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `veridox-transactions-${new Date().toISOString().slice(0,10)}.xlsx`);
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

    const totalDeposits = data.filter(t => t.type?.toLowerCase() === 'deposit').reduce((s, t) => s + (t.amount || 0), 0);
    const totalWithdrawals = data.filter(t => t.type?.toLowerCase() === 'withdrawal').reduce((s, t) => s + (t.amount || 0), 0);
    const successful = data.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;

    // Summary sheet
    const summary = [
      { 'Field': 'Company', 'Value': brand },
      { 'Field': 'Statement Date', 'Value': new Date().toLocaleDateString() },
      { 'Field': 'Total Transactions', 'Value': data.length },
      { 'Field': 'Successful', 'Value': successful },
      { 'Field': 'Total Deposits', 'Value': parseFloat(totalDeposits.toFixed(2)) },
      { 'Field': 'Total Withdrawals', 'Value': parseFloat(totalWithdrawals.toFixed(2)) },
      { 'Field': 'Net Balance', 'Value': parseFloat((totalDeposits - totalWithdrawals).toFixed(2)) },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transactions');
    XLSX.writeFile(wb, `${brand}-statement-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Transactions</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{total.toLocaleString()} total transactions</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => fileRef.current.click()} disabled={importing} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <Upload size={14} /> {importing ? 'Importing...' : 'Import Excel'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImport} />
          <button onClick={exportExcel} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
            <Download size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} onKeyDown={e => e.key === 'Enter' && fetchTransactions()} placeholder="Search ID, name, account..." style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
        </div>
        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); setPage(0); }} style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', background: 'white', outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
          <option value="all">All Brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }} style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', background: 'white', outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
          <option value="all">All Types</option>
          <option value="Deposit">Deposit</option>
          <option value="Withdrawal">Withdrawal</option>
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', background: 'white', outline: 'none', fontFamily: 'Inter, sans-serif', cursor: 'pointer' }}>
          <option value="all">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Failed">Failed</option>
          <option value="Pending">Pending</option>
        </select>

        {/* Statement download per brand */}
        {filterBrand !== 'all' && (
          <button onClick={() => downloadStatement(filterBrand)} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#166534', cursor: 'pointer' }}>
            <FileText size={14} /> Download Statement for {filterBrand}
          </button>
        )}
      </div>

      {/* Statement buttons for each brand */}
      {brands.length > 0 && filterBrand === 'all' && (
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ color: '#64748B', fontSize: '12px', fontWeight: '600', alignSelf: 'center' }}>Statements:</span>
          {brands.map(b => (
            <button key={b} onClick={() => downloadStatement(b)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              <FileText size={12} /> {b}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {COLUMNS.map(c => (
                <th key={c.key} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={COLUMNS.length} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                No transactions yet. Click <strong>Import Excel</strong> to upload your data.
              </td></tr>
            ) : transactions.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid #F1F5F9', background: 'white' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '11px 16px', color: '#64748B', fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDate(t.created_date)}</td>
                <td style={{ padding: '11px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>{t.transaction_id || '-'}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.brand_name || '-'}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>{t.first_name || '-'}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>{t.last_name || '-'}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px', fontFamily: 'monospace' }}>{t.account_no || '-'}</td>
                <td style={{ padding: '11px 16px' }}>
                  {t.type && <span style={{ ...typeStyle(t.type), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.type}</span>}
                </td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>{t.account_currency || '-'}</td>
                <td style={{ padding: '11px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(t.amount)}</td>
                <td style={{ padding: '11px 16px', color: '#64748B', fontSize: '12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{formatAmount(t.usd_amount)}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.payment_method || '-'}</td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.psp_actual || '-'}</td>
                <td style={{ padding: '11px 16px' }}>
                  {t.transaction_approval && <span style={{ ...statusStyle(t.transaction_approval), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.transaction_approval}</span>}
                </td>
                <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>{t.country_group || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
          <span style={{ color: '#64748B', fontSize: '13px' }}>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: '6px 14px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: page === 0 ? 'not-allowed' : 'pointer', color: page === 0 ? '#CBD5E1' : '#475569', fontFamily: 'Inter, sans-serif' }}>Previous</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ padding: '6px 14px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: page >= totalPages - 1 ? '#CBD5E1' : '#475569', fontFamily: 'Inter, sans-serif' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
