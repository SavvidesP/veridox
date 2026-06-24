import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, Gift, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => ({
  active: { background: '#DCFCE7', color: '#166534' },
  pending: { background: '#FEF9C3', color: '#854D0E' },
  expired: { background: '#FEE2E2', color: '#991B1B' },
  cancelled: { background: '#F1F5F9', color: '#475569' },
  completed: { background: '#EEF2FF', color: '#4338CA' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const bonusTypeStyle = (t) => ({
  welcome: { background: '#ECFDF5', color: '#059669' },
  deposit: { background: '#EEF2FF', color: '#4338CA' },
  referral: { background: '#FFF7ED', color: '#C2410C' },
  loyalty: { background: '#F5F3FF', color: '#7C3AED' },
  promotion: { background: '#FEF9C3', color: '#854D0E' },
  rebate: { background: '#E0F2FE', color: '#0369A1' },
}[t] || { background: '#F1F5F9', color: '#475569' });

const statusIcon = (s) => ({
  active: <CheckCircle size={12} />,
  pending: <Clock size={12} />,
  expired: <XCircle size={12} />,
  cancelled: <XCircle size={12} />,
  completed: <CheckCircle size={12} />,
}[s] || null);

function formatAmount(v, currency = 'USD') {
  if (v == null) return '-';
  return `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BonusManagement() {
  const [bonuses, setBonuses] = useState([]);
  const [clients, setClients] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  const empty = {
    client_id: '', trading_account_id: '', bonus_type: 'welcome',
    amount: '', currency: 'USD', status: 'pending',
    expires_at: '', wagering_requirement: '', wagering_completed: '', notes: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: bon }, { data: cli }, { data: acc }] = await Promise.all([
      supabase.from('bonuses').select('*, client:client_id(first_name, last_name), trading_account:trading_account_id(account_number, platform)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name').order('first_name'),
      supabase.from('trading_accounts').select('id, account_number, platform, client_id').order('account_number'),
    ]);
    setBonuses(bon || []);
    setClients(cli || []);
    setTradingAccounts(acc || []);
    setLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      wagering_requirement: parseFloat(form.wagering_requirement) || 0,
      wagering_completed: parseFloat(form.wagering_completed) || 0,
      client_id: form.client_id || null,
      trading_account_id: form.trading_account_id || null,
      expires_at: form.expires_at || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('bonuses').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('bonuses').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this bonus?')) return;
    await supabase.from('bonuses').delete().eq('id', id);
    fetchAll();
  }

  const filtered = bonuses.filter(b => {
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (filterType !== 'all' && b.bonus_type !== filterType) return false;
    if (search && !b.client?.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !b.client?.last_name?.toLowerCase().includes(search.toLowerCase()) &&
      !b.trading_account?.account_number?.includes(search)) return false;
    return true;
  });

  const totalActive = bonuses.filter(b => b.status === 'active').reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const totalPending = bonuses.filter(b => b.status === 'pending').reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const activeCount = bonuses.filter(b => b.status === 'active').length;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  // Filter trading accounts by selected client
  const filteredAccounts = form.client_id
    ? tradingAccounts.filter(a => a.client_id === form.client_id)
    : tradingAccounts;

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Bonus Management</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{bonuses.length} total bonuses</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> Add Bonus
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Bonuses', value: bonuses.length, color: '#6366F1', bg: '#EEF2FF', icon: Gift },
          { label: 'Active', value: activeCount, color: '#166534', bg: '#DCFCE7', icon: CheckCircle },
          { label: 'Active Amount', value: `$${Number(totalActive).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#0369A1', bg: '#E0F2FE', icon: Gift },
          { label: 'Pending Amount', value: `$${Number(totalPending).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#854D0E', bg: '#FEF9C3', icon: Clock },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, account..."
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Types</option>
          <option value="welcome">Welcome</option>
          <option value="deposit">Deposit</option>
          <option value="referral">Referral</option>
          <option value="loyalty">Loyalty</option>
          <option value="promotion">Promotion</option>
          <option value="rebate">Rebate</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Client', 'Trading Account', 'Bonus Type', 'Amount', 'Wagering', 'Expires', 'Status', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No bonuses yet. Click <strong>Add Bonus</strong> to get started.</td></tr>
            ) : filtered.map(b => {
              const wageringPct = b.wagering_requirement > 0 ? Math.min(100, Math.round((b.wagering_completed / b.wagering_requirement) * 100)) : null;
              return (
                <tr key={b.id} style={{ borderTop: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>
                      {b.client ? `${b.client.first_name} ${b.client.last_name}` : '—'}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {b.trading_account ? (
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A', fontFamily: 'monospace' }}>{b.trading_account.account_number}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8' }}>{b.trading_account.platform}</div>
                      </div>
                    ) : <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ ...bonusTypeStyle(b.bonus_type), padding: '2px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>{b.bonus_type}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>{formatAmount(b.amount, b.currency)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {wageringPct !== null ? (
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{wageringPct}% complete</div>
                        <div style={{ height: '4px', background: '#E2E8F0', borderRadius: '2px', width: '80px' }}>
                          <div style={{ height: '4px', background: wageringPct >= 100 ? '#059669' : '#6366F1', borderRadius: '2px', width: `${wageringPct}%` }} />
                        </div>
                      </div>
                    ) : <span style={{ color: '#94A3B8', fontSize: '12px' }}>No req.</span>}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#64748B', fontSize: '12px' }}>{formatDate(b.expires_at)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ ...statusStyle(b.status), padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
                      {statusIcon(b.status)} {b.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setEditItem(b); setForm({ client_id: b.client_id || '', trading_account_id: b.trading_account_id || '', bonus_type: b.bonus_type, amount: b.amount, currency: b.currency, status: b.status, expires_at: b.expires_at ? b.expires_at.slice(0, 10) : '', wagering_requirement: b.wagering_requirement, wagering_completed: b.wagering_completed, notes: b.notes || '' }); setShowModal(true); }}
                        style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} color="#64748B" />
                      </button>
                      <button onClick={() => remove(b.id)}
                        style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '540px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Bonus' : 'Add Bonus'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value, trading_account_id: '' }))} style={inputStyle}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Trading Account</label>
                <select value={form.trading_account_id} onChange={e => setForm(f => ({ ...f, trading_account_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select account</option>
                  {filteredAccounts.map(a => <option key={a.id} value={a.id}>{a.account_number} ({a.platform})</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Bonus Type</label>
                  <select value={form.bonus_type} onChange={e => setForm(f => ({ ...f, bonus_type: e.target.value }))} style={inputStyle}>
                    <option value="welcome">Welcome</option>
                    <option value="deposit">Deposit</option>
                    <option value="referral">Referral</option>
                    <option value="loyalty">Loyalty</option>
                    <option value="promotion">Promotion</option>
                    <option value="rebate">Rebate</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="expired">Expired</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP', 'CHF', 'AUD'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Wagering Requirement</label>
                  <input type="number" value={form.wagering_requirement} onChange={e => setForm(f => ({ ...f, wagering_requirement: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Wagering Completed</label>
                  <input type="number" value={form.wagering_completed} onChange={e => setForm(f => ({ ...f, wagering_completed: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Expires At</label>
                  <input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={inputStyle} />
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
                {editItem ? 'Save Changes' : 'Add Bonus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
