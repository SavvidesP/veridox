import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, TrendingUp, TrendingDown, DollarSign, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const statusStyle = (s) => ({
  active: { background: '#DCFCE7', color: '#166534' },
  inactive: { background: '#FEE2E2', color: '#991B1B' },
  suspended: { background: '#FEF9C3', color: '#854D0E' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const platformStyle = (p) => ({
  MT4: { background: '#EEF2FF', color: '#4338CA' },
  MT5: { background: '#F5F3FF', color: '#7C3AED' },
  cTrader: { background: '#ECFDF5', color: '#059669' },
}[p] || { background: '#F1F5F9', color: '#475569' });

function formatAmount(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function TradingAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [search, setSearch] = useState('');

  const empty = {
    client_id: '', account_number: '', platform: 'MT4', account_type: 'standard',
    currency: 'USD', balance: '', equity: '', margin: '', free_margin: '',
    margin_level: '', leverage: 100, status: 'active',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, [filterStatus, filterPlatform]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: acc }, { data: cli }] = await Promise.all([
      supabase.from('trading_accounts').select('*, client:client_id(first_name, last_name, email)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name, email').order('first_name'),
    ]);
    setAccounts(acc || []);
    setClients(cli || []);
    setLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      balance: parseFloat(form.balance) || 0,
      equity: parseFloat(form.equity) || 0,
      margin: parseFloat(form.margin) || 0,
      free_margin: parseFloat(form.free_margin) || 0,
      margin_level: parseFloat(form.margin_level) || 0,
      leverage: parseInt(form.leverage) || 100,
      client_id: form.client_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('trading_accounts').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('trading_accounts').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this trading account?')) return;
    await supabase.from('trading_accounts').delete().eq('id', id);
    fetchAll();
  }

  async function toggleStatus(id, current) {
    const next = current === 'active' ? 'inactive' : 'active';
    await supabase.from('trading_accounts').update({ status: next }).eq('id', id);
    fetchAll();
  }

  const filtered = accounts.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterPlatform !== 'all' && a.platform !== filterPlatform) return false;
    if (search && !a.account_number?.toLowerCase().includes(search.toLowerCase()) &&
      !a.client?.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !a.client?.last_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalBalance = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  const totalEquity = accounts.reduce((s, a) => s + (parseFloat(a.equity) || 0), 0);
  const activeAccounts = accounts.filter(a => a.status === 'active').length;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Trading Accounts</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{accounts.length} total accounts</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> Add Account
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Accounts', value: accounts.length, icon: Activity, color: '#6366F1', bg: '#EEF2FF' },
          { label: 'Active', value: activeAccounts, icon: TrendingUp, color: '#166534', bg: '#DCFCE7' },
          { label: 'Total Balance', value: `$${formatAmount(totalBalance)}`, icon: DollarSign, color: '#0369A1', bg: '#E0F2FE' },
          { label: 'Total Equity', value: `$${formatAmount(totalEquity)}`, icon: TrendingUp, color: '#7C3AED', bg: '#F5F3FF' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account, client..."
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Platforms</option>
          <option value="MT4">MT4</option>
          <option value="MT5">MT5</option>
          <option value="cTrader">cTrader</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Account No.', 'Client', 'Platform', 'Type', 'Balance', 'Equity', 'Margin', 'Leverage', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No trading accounts yet. Click <strong>Add Account</strong> to get started.</td></tr>
            ) : filtered.map(a => (
              <tr key={a.id} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>{a.account_number}</td>
                <td style={{ padding: '12px 16px' }}>
                  {a.client ? (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{a.client.first_name} {a.client.last_name}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{a.client.email}</div>
                    </div>
                  ) : <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ ...platformStyle(a.platform), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{a.platform}</span>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', textTransform: 'capitalize' }}>{a.account_type}</td>
                <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>${formatAmount(a.balance)}</td>
                <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '12px', textAlign: 'right' }}>${formatAmount(a.equity)}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', textAlign: 'right' }}>${formatAmount(a.margin)}</td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', textAlign: 'center' }}>1:{a.leverage}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ ...statusStyle(a.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{a.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => { setEditItem(a); setForm({ client_id: a.client_id || '', account_number: a.account_number, platform: a.platform, account_type: a.account_type, currency: a.currency, balance: a.balance, equity: a.equity, margin: a.margin, free_margin: a.free_margin, margin_level: a.margin_level, leverage: a.leverage, status: a.status }); setShowModal(true); }}
                      style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Edit2 size={13} color="#64748B" />
                    </button>
                    <button onClick={() => remove(a.id)}
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
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Trading Account' : 'Add Trading Account'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={inputStyle}>
                  <option value="">No client assigned</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Account Number *</label>
                  <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="e.g. 100001" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Platform</label>
                  <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} style={inputStyle}>
                    <option value="MT4">MT4</option>
                    <option value="MT5">MT5</option>
                    <option value="cTrader">cTrader</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Account Type</label>
                  <select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))} style={inputStyle}>
                    <option value="standard">Standard</option>
                    <option value="pro">Pro</option>
                    <option value="vip">VIP</option>
                    <option value="demo">Demo</option>
                    <option value="islamic">Islamic</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'JPY'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Balance</label>
                  <input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Equity</label>
                  <input type="number" value={form.equity} onChange={e => setForm(f => ({ ...f, equity: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Margin</label>
                  <input type="number" value={form.margin} onChange={e => setForm(f => ({ ...f, margin: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Free Margin</label>
                  <input type="number" value={form.free_margin} onChange={e => setForm(f => ({ ...f, free_margin: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Margin Level (%)</label>
                  <input type="number" value={form.margin_level} onChange={e => setForm(f => ({ ...f, margin_level: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Leverage</label>
                  <select value={form.leverage} onChange={e => setForm(f => ({ ...f, leverage: e.target.value }))} style={inputStyle}>
                    {[1, 2, 5, 10, 25, 50, 100, 200, 300, 400, 500].map(l => <option key={l} value={l}>1:{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.account_number}
                style={{ padding: '9px 20px', background: !form.account_number ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.account_number ? '#94A3B8' : 'white', cursor: !form.account_number ? 'not-allowed' : 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
