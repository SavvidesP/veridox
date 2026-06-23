import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusConfig = {
  open: { label: 'Open', color: '#854D0E', bg: '#FEF9C3', icon: Clock },
  in_review: { label: 'In Review', color: '#1D4ED8', bg: '#DBEAFE', icon: AlertTriangle },
  won: { label: 'Won', color: '#166534', bg: '#DCFCE7', icon: CheckCircle },
  lost: { label: 'Lost', color: '#991B1B', bg: '#FEE2E2', icon: XCircle },
};

function daysLeft(deadline) {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
}

function DeadlineBadge({ deadline }) {
  const days = daysLeft(deadline);
  if (days === null) return <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>;
  const color = days < 0 ? '#991B1B' : days <= 3 ? '#C2410C' : days <= 7 ? '#854D0E' : '#166534';
  const bg = days < 0 ? '#FEE2E2' : days <= 3 ? '#FFF7ED' : days <= 7 ? '#FEF9C3' : '#DCFCE7';
  return (
    <span style={{ background: bg, color, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
    </span>
  );
}

export default function Disputes() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const empty = { transaction_id: '', client_name: '', brand: '', amount: '', currency: 'USD', reason: '', status: 'open', deadline: '', evidence_notes: '', assigned_to: '', outcome: '' };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchDisputes(); }, [filterStatus]);

  async function fetchDisputes() {
    setLoading(true);
    let q = supabase.from('disputes').select('*').order('created_at', { ascending: false });
    if (filterStatus !== 'all') q = q.eq('status', filterStatus);
    const { data } = await q;
    setDisputes(data || []);
    setLoading(false);
  }

  async function save() {
    const payload = { ...form, amount: form.amount ? parseFloat(form.amount) : null, updated_at: new Date().toISOString() };
    if (editItem) {
      await supabase.from('disputes').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('disputes').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchDisputes();
  }

  async function remove(id) {
    if (!window.confirm('Delete this dispute?')) return;
    await supabase.from('disputes').delete().eq('id', id);
    fetchDisputes();
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  const stats = {
    open: disputes.filter(d => d.status === 'open').length,
    in_review: disputes.filter(d => d.status === 'in_review').length,
    won: disputes.filter(d => d.status === 'won').length,
    lost: disputes.filter(d => d.status === 'lost').length,
  };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Dispute Management</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{disputes.length} total disputes</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> Add Dispute
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {Object.entries(statusConfig).map(([key, { label, color, bg, icon: Icon }]) => (
          <div key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            style={{ background: 'white', borderRadius: '10px', border: `1px solid ${filterStatus === key ? color : '#E2E8F0'}`, padding: '16px', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A' }}>{stats[key]}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['all', 'open', 'in_review', 'won', 'lost'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #E2E8F0', background: filterStatus === s ? '#0F172A' : 'white', color: filterStatus === s ? 'white' : '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            {s === 'all' ? 'All' : statusConfig[s].label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Transaction ID', 'Client', 'Brand', 'Amount', 'Reason', 'Status', 'Deadline', 'Assigned To', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : disputes.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No disputes found. Click <strong>Add Dispute</strong> to get started.</td></tr>
            ) : disputes.map(d => {
              const s = statusConfig[d.status] || statusConfig.open;
              const StatusIcon = s.icon;
              return (
                <tr key={d.id} style={{ borderTop: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#0F172A', fontFamily: 'monospace' }}>{d.transaction_id || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{d.client_name || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{d.brand || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: '600', color: '#0F172A', whiteSpace: 'nowrap' }}>{d.amount ? `${Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${d.currency}` : '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.reason || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: s.bg, color: s.color, padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <StatusIcon size={11} /> {s.label}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}><DeadlineBadge deadline={d.deadline} /></td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{d.assigned_to || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setEditItem(d); setForm({ transaction_id: d.transaction_id || '', client_name: d.client_name || '', brand: d.brand || '', amount: d.amount || '', currency: d.currency || 'USD', reason: d.reason || '', status: d.status, deadline: d.deadline || '', evidence_notes: d.evidence_notes || '', assigned_to: d.assigned_to || '', outcome: d.outcome || '' }); setShowModal(true); }}
                        style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} color="#64748B" />
                      </button>
                      <button onClick={() => remove(d.id)}
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
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Dispute' : 'Add Dispute'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Transaction ID</label>
                  <input value={form.transaction_id} onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} placeholder="TXN100049" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Client Name</label>
                  <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="John Smith" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Brand</label>
                  <input value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder="AlphaFX" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="1500.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'JPY'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="open">Open</option>
                    <option value="in_review">In Review</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Deadline</label>
                  <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Assigned To</label>
                  <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Agent name" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Unauthorized transaction" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Evidence Notes</label>
                <textarea value={form.evidence_notes} onChange={e => setForm(f => ({ ...f, evidence_notes: e.target.value }))} placeholder="Add notes about evidence, documentation, etc..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              {(form.status === 'won' || form.status === 'lost') && (
                <div>
                  <label style={labelStyle}>Outcome Notes</label>
                  <textarea value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} placeholder="Describe the outcome..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              )}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add Dispute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
