import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, CheckCircle, XCircle, Clock, AlertTriangle, DollarSign, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => ({
  pending: { background: '#FEF9C3', color: '#854D0E' },
  under_review: { background: '#EEF2FF', color: '#4338CA' },
  approved: { background: '#DCFCE7', color: '#166534' },
  rejected: { background: '#FEE2E2', color: '#991B1B' },
  completed: { background: '#F0FDF4', color: '#166534' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const statusIcon = (s) => ({
  pending: <Clock size={12} />,
  under_review: <Eye size={12} />,
  approved: <CheckCircle size={12} />,
  rejected: <XCircle size={12} />,
  completed: <CheckCircle size={12} />,
}[s] || null);

function formatAmount(v, currency = 'USD') {
  if (v == null) return '-';
  return `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function WithdrawalApprovals() {
  const navigate = useNavigate();
  const [withdrawals, setWithdrawals] = useState([]);
  const [clients, setClients] = useState([]);
  const [tradingAccounts, setTradingAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [rejectionReason, setRejectionReason] = useState('');

  const empty = {
    client_id: '', trading_account_id: '', amount: '', currency: 'USD',
    payment_method: 'bank_transfer', payment_details: '', notes: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, [filterStatus]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: wd }, { data: cli }, { data: acc }] = await Promise.all([
      supabase.from('withdrawal_approvals').select('*, client:client_id(first_name, last_name, email), trading_account:trading_account_id(account_number, platform), source_tx:source_transaction_id(id, transaction_id)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name, email').order('first_name'),
      supabase.from('trading_accounts').select('id, account_number, platform, client_id').order('account_number'),
    ]);
    setWithdrawals(wd || []);
    setClients(cli || []);
    setTradingAccounts(acc || []);
    setLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      client_id: form.client_id || null,
      trading_account_id: form.trading_account_id || null,
      payment_details: form.payment_details ? { raw: form.payment_details } : null,
      status: 'pending',
      requested_at: new Date().toISOString(),
    };
    await supabase.from('withdrawal_approvals').insert(payload);
    setShowModal(false);
    setForm(empty);
    fetchAll();
  }

  async function updateStatus(id, status, extra = {}) {
    const update = { status, updated_at: new Date().toISOString(), ...extra };
    if (status === 'approved') { update.approved_at = new Date().toISOString(); update.approved_by = 'Admin'; }
    if (status === 'under_review') { update.reviewed_at = new Date().toISOString(); update.reviewed_by = 'Admin'; }
    if (status === 'rejected') { update.rejection_reason = rejectionReason; }
    await supabase.from('withdrawal_approvals').update(update).eq('id', id);
    setShowDetailModal(false);
    setSelected(null);
    setRejectionReason('');
    fetchAll();
  }

  const filtered = filterStatus === 'all' ? withdrawals : withdrawals.filter(w => w.status === filterStatus);
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const reviewCount = withdrawals.filter(w => w.status === 'under_review').length;
  const totalPending = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + (parseFloat(w.amount) || 0), 0);

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };
  const filteredAccounts = form.client_id ? tradingAccounts.filter(a => a.client_id === form.client_id) : tradingAccounts;

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Withdrawal Approvals</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{withdrawals.length} total requests</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> New Request
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Pending', value: pendingCount, color: '#854D0E', bg: '#FEF9C3', icon: Clock },
          { label: 'Under Review', value: reviewCount, color: '#4338CA', bg: '#EEF2FF', icon: Eye },
          { label: 'Approved', value: withdrawals.filter(w => w.status === 'approved').length, color: '#166534', bg: '#DCFCE7', icon: CheckCircle },
          { label: 'Pending Amount', value: `$${Number(totalPending).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, color: '#0369A1', bg: '#E0F2FE', icon: DollarSign },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}><Icon size={14} color={color} /></div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'under_review', 'approved', 'rejected', 'completed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${filterStatus === s ? '#6366F1' : '#E2E8F0'}`, background: filterStatus === s ? '#EEF2FF' : 'white', fontSize: '12px', fontWeight: '600', color: filterStatus === s ? '#4338CA' : '#475569', cursor: 'pointer', textTransform: 'capitalize' }}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
            {s === 'pending' && pendingCount > 0 && <span style={{ marginLeft: '6px', background: '#FEF9C3', color: '#854D0E', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>{pendingCount}</span>}
            {s === 'under_review' && reviewCount > 0 && <span style={{ marginLeft: '6px', background: '#EEF2FF', color: '#4338CA', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>{reviewCount}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Client', 'Transaction', 'Account', 'Amount', 'Method', 'Requested', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No withdrawal requests. Click <strong>New Request</strong> to add one.</td></tr>
            ) : filtered.map(w => (
              <tr key={w.id} onClick={() => w.source_transaction_id && navigate(`/transactions/${w.source_transaction_id}`)}
                style={{ borderTop: '1px solid #F1F5F9', cursor: w.source_transaction_id ? 'pointer' : 'default' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{w.client ? `${w.client.first_name} ${w.client.last_name}` : '—'}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{w.client?.email}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {w.source_tx ? (
                    <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'monospace', color: '#4338CA' }}>{w.source_tx.transaction_id || 'View'}</span>
                  ) : <span style={{ fontSize: '12px', color: '#94A3B8' }}>—</span>}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  {w.trading_account ? (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '600', fontFamily: 'monospace', color: '#0F172A' }}>{w.trading_account.account_number}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{w.trading_account.platform}</div>
                    </div>
                  ) : '—'}
                </td>
                <td style={{ padding: '12px 16px', fontSize: '15px', fontWeight: '800', color: '#0F172A' }}>{formatAmount(w.amount, w.currency)}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', textTransform: 'capitalize' }}>{w.payment_method?.replace('_', ' ')}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748B' }}>{formatDate(w.requested_at)}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ ...statusStyle(w.status), padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', textTransform: 'capitalize' }}>
                    {statusIcon(w.status)} {w.status?.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={(e) => { e.stopPropagation(); setSelected(w); setShowDetailModal(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>
                    <Eye size={13} /> Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Request Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>New Withdrawal Request</div>
              <button onClick={() => { setShowModal(false); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
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
                  <label style={labelStyle}>Amount</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP', 'USDT', 'BTC'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))} style={inputStyle}>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="crypto">Crypto</option>
                  <option value="card">Card</option>
                  <option value="wire">Wire Transfer</option>
                  <option value="skrill">Skrill</option>
                  <option value="neteller">Neteller</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Payment Details</label>
                <textarea value={form.payment_details} onChange={e => setForm(f => ({ ...f, payment_details: e.target.value }))} placeholder="IBAN, wallet address, etc." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.amount}
                style={{ padding: '9px 20px', background: !form.amount ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.amount ? '#94A3B8' : 'white', cursor: !form.amount ? 'not-allowed' : 'pointer' }}>
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail/Review Modal */}
      {showDetailModal && selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>Withdrawal Review</div>
              <button onClick={() => { setShowDetailModal(false); setSelected(null); setRejectionReason(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
              {/* Amount highlight */}
              <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '12px', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px' }}>Withdrawal Amount</div>
                <div style={{ color: 'white', fontSize: '36px', fontWeight: '900', letterSpacing: '-1px' }}>{formatAmount(selected.amount, selected.currency)}</div>
              </div>

              {/* Details */}
              {[
                ['Client', selected.client ? `${selected.client.first_name} ${selected.client.last_name}` : '—'],
                ['Email', selected.client?.email || '—'],
                ['Trading Account', selected.trading_account ? `${selected.trading_account.account_number} (${selected.trading_account.platform})` : '—'],
                ['Payment Method', selected.payment_method?.replace('_', ' ')],
                ['Payment Details', selected.payment_details?.raw || '—'],
                ['Requested', formatDate(selected.requested_at)],
                ['Reviewed By', selected.reviewed_by || '—'],
                ['Approved By', selected.approved_by || '—'],
                ['Rejection Reason', selected.rejection_reason || '—'],
                ['Notes', selected.notes || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}>
                  <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>{label}</span>
                  <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: '600', textAlign: 'right', maxWidth: '280px', wordBreak: 'break-word', textTransform: 'capitalize' }}>{value}</span>
                </div>
              ))}

              {/* Status */}
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <span style={{ ...statusStyle(selected.status), padding: '6px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px', textTransform: 'capitalize' }}>
                  {statusIcon(selected.status)} {selected.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Rejection reason input */}
              {selected.status !== 'rejected' && selected.status !== 'completed' && (
                <div style={{ marginTop: '16px' }}>
                  <label style={labelStyle}>Rejection Reason (if rejecting)</label>
                  <input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Reason for rejection..." style={inputStyle} />
                </div>
              )}
            </div>

            {/* Action buttons */}
            {selected.status !== 'completed' && selected.status !== 'rejected' && (
              <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selected.status === 'pending' && (
                  <button onClick={() => updateStatus(selected.id, 'under_review')}
                    style={{ flex: 1, padding: '9px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>
                    Mark Under Review
                  </button>
                )}
                {(selected.status === 'pending' || selected.status === 'under_review') && (
                  <>
                    <button onClick={() => updateStatus(selected.id, 'approved')}
                      style={{ flex: 1, padding: '9px', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#166534', cursor: 'pointer' }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => updateStatus(selected.id, 'rejected')}
                      style={{ flex: 1, padding: '9px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#991B1B', cursor: 'pointer' }}>
                      ✗ Reject
                    </button>
                  </>
                )}
                {selected.status === 'approved' && (
                  <button onClick={() => updateStatus(selected.id, 'completed')}
                    style={{ flex: 1, padding: '9px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
                    Mark as Completed
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
