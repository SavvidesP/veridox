import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, Download, FileText, TrendingUp, TrendingDown, DollarSign, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => ({
  draft: { background: '#F1F5F9', color: '#475569' },
  final: { background: '#DCFCE7', color: '#166534' },
  archived: { background: '#FEE2E2', color: '#991B1B' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const reportTypeLabel = (t) => ({
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  custom: 'Custom',
}[t] || t);

function formatAmount(v) {
  if (v == null) return '$0.00';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FinancialReports() {
  const [reports, setReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [generating, setGenerating] = useState(false);

  const empty = {
    client_id: '', report_type: 'monthly', period_from: '', period_to: '',
    total_deposits: '', total_withdrawals: '', total_commission: '',
    total_bonus: '', net_revenue: '', currency: 'USD', status: 'draft', notes: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: rep }, { data: cli }] = await Promise.all([
      supabase.from('financial_reports').select('*, client:client_id(first_name, last_name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name').order('first_name'),
    ]);
    setReports(rep || []);
    setClients(cli || []);
    setLoading(false);
  }

  async function generateFromTransactions() {
    if (!form.period_from || !form.period_to) { alert('Please set period dates first.'); return; }
    setGenerating(true);
    let q = supabase.from('transactions').select('*')
      .gte('created_date', form.period_from)
      .lte('created_date', form.period_to + 'T23:59:59');
    if (form.client_id) q = q.eq('client_id', form.client_id);
    const { data: txs } = await q;
    if (txs) {
      const deposits = txs.filter(t => t.type?.toLowerCase() === 'deposit' && t.transaction_approval?.toLowerCase() === 'success').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const withdrawals = txs.filter(t => t.type?.toLowerCase() === 'withdrawal' && t.transaction_approval?.toLowerCase() === 'success').reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const net = deposits - withdrawals;
      setForm(f => ({ ...f, total_deposits: deposits.toFixed(2), total_withdrawals: withdrawals.toFixed(2), net_revenue: net.toFixed(2) }));
    }
    setGenerating(false);
  }

  async function save() {
    const payload = {
      ...form,
      total_deposits: parseFloat(form.total_deposits) || 0,
      total_withdrawals: parseFloat(form.total_withdrawals) || 0,
      total_commission: parseFloat(form.total_commission) || 0,
      total_bonus: parseFloat(form.total_bonus) || 0,
      net_revenue: parseFloat(form.net_revenue) || 0,
      client_id: form.client_id || null,
      period_from: form.period_from || null,
      period_to: form.period_to || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('financial_reports').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('financial_reports').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this report?')) return;
    await supabase.from('financial_reports').delete().eq('id', id);
    fetchAll();
  }

  function exportReport(r) {
    const separator = '='.repeat(60);
    const divider = '-'.repeat(60);
    const line = (label, value) => `${label.padEnd(30)}: ${value}`;
    const content = [
      separator,
      `VERIDOX FINANCIAL REPORT`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      separator,
      '',
      '[ REPORT DETAILS ]',
      divider,
      line('Report Type', reportTypeLabel(r.report_type)),
      line('Period', `${formatDate(r.period_from)} — ${formatDate(r.period_to)}`),
      line('Client', r.client ? `${r.client.first_name} ${r.client.last_name}` : 'All Clients'),
      line('Currency', r.currency),
      line('Status', r.status),
      '',
      '[ FINANCIAL SUMMARY ]',
      divider,
      line('Total Deposits', formatAmount(r.total_deposits)),
      line('Total Withdrawals', formatAmount(r.total_withdrawals)),
      line('Total Commission', formatAmount(r.total_commission)),
      line('Total Bonus', formatAmount(r.total_bonus)),
      line('Net Revenue', formatAmount(r.net_revenue)),
      '',
      r.notes ? ['[ NOTES ]', divider, r.notes, ''].join('\n') : '',
      separator,
      'END OF REPORT — Veridox Compliance CRM',
      separator,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-report-${r.report_type}-${r.period_from || 'custom'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = reports.filter(r => {
    if (filterType !== 'all' && r.report_type !== filterType) return false;
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    return true;
  });

  const totalDeposits = reports.reduce((s, r) => s + (parseFloat(r.total_deposits) || 0), 0);
  const totalWithdrawals = reports.reduce((s, r) => s + (parseFloat(r.total_withdrawals) || 0), 0);
  const totalNetRevenue = reports.reduce((s, r) => s + (parseFloat(r.net_revenue) || 0), 0);

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Financial Reports</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{reports.length} total reports</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> New Report
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Reports', value: reports.length, color: '#6366F1', bg: '#EEF2FF', icon: FileText },
          { label: 'Total Deposits', value: formatAmount(totalDeposits), color: '#059669', bg: '#ECFDF5', icon: TrendingUp },
          { label: 'Total Withdrawals', value: formatAmount(totalWithdrawals), color: '#991B1B', bg: '#FEE2E2', icon: TrendingDown },
          { label: 'Net Revenue', value: formatAmount(totalNetRevenue), color: '#0369A1', bg: '#E0F2FE', icon: DollarSign },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Types</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
          <option value="custom">Custom</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="final">Final</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Type', 'Client', 'Period', 'Deposits', 'Withdrawals', 'Commission', 'Net Revenue', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No reports yet. Click <strong>New Report</strong> to get started.</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #F1F5F9' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{reportTypeLabel(r.report_type)}</span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>
                  {r.client ? `${r.client.first_name} ${r.client.last_name}` : 'All Clients'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748B' }}>
                  {formatDate(r.period_from)} — {formatDate(r.period_to)}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: '#059669' }}>{formatAmount(r.total_deposits)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#991B1B' }}>{formatAmount(r.total_withdrawals)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{formatAmount(r.total_commission)}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: parseFloat(r.net_revenue) >= 0 ? '#059669' : '#991B1B' }}>{formatAmount(r.net_revenue)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ ...statusStyle(r.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{r.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => exportReport(r)}
                      style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Download size={13} color="#6366F1" />
                    </button>
                    <button onClick={() => { setEditItem(r); setForm({ client_id: r.client_id || '', report_type: r.report_type, period_from: r.period_from || '', period_to: r.period_to || '', total_deposits: r.total_deposits, total_withdrawals: r.total_withdrawals, total_commission: r.total_commission, total_bonus: r.total_bonus, net_revenue: r.net_revenue, currency: r.currency, status: r.status, notes: r.notes || '' }); setShowModal(true); }}
                      style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Edit2 size={13} color="#64748B" />
                    </button>
                    <button onClick={() => remove(r.id)}
                      style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={13} color="#EF4444" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Report' : 'New Financial Report'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Report Type</label>
                  <select value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))} style={inputStyle}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="draft">Draft</option>
                    <option value="final">Final</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Period From</label>
                  <input type="date" value={form.period_from} onChange={e => setForm(f => ({ ...f, period_from: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Period To</label>
                  <input type="date" value={form.period_to} onChange={e => setForm(f => ({ ...f, period_to: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Client (optional)</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={inputStyle}>
                  <option value="">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>

              {/* Auto-generate */}
              <button onClick={generateFromTransactions} disabled={generating}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#059669', cursor: generating ? 'not-allowed' : 'pointer' }}>
                <BarChart2 size={14} /> {generating ? 'Calculating...' : 'Auto-calculate from Transactions'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Total Deposits</label>
                  <input type="number" value={form.total_deposits} onChange={e => setForm(f => ({ ...f, total_deposits: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Total Withdrawals</label>
                  <input type="number" value={form.total_withdrawals} onChange={e => setForm(f => ({ ...f, total_withdrawals: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Total Commission</label>
                  <input type="number" value={form.total_commission} onChange={e => setForm(f => ({ ...f, total_commission: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Total Bonus</label>
                  <input type="number" value={form.total_bonus} onChange={e => setForm(f => ({ ...f, total_bonus: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Net Revenue</label>
                  <input type="number" value={form.net_revenue} onChange={e => setForm(f => ({ ...f, net_revenue: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save}
                style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
                {editItem ? 'Save Changes' : 'Create Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
