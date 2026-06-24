import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, Users, DollarSign, TrendingUp, Copy, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => ({
  active: { background: '#DCFCE7', color: '#166534' },
  inactive: { background: '#FEE2E2', color: '#991B1B' },
  suspended: { background: '#FEF9C3', color: '#854D0E' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const commissionTypeLabel = (t) => ({
  per_lot: 'Per Lot',
  per_trade: 'Per Trade',
  revenue_share: 'Revenue Share',
  cpa: 'CPA',
}[t] || t);

function CopyBox({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: copied ? '#DCFCE7' : '#EEF2FF', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: '700', color: copied ? '#166534' : '#4338CA', cursor: 'pointer', fontFamily: 'monospace' }}>
      {value} {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
    </button>
  );
}

function formatAmount(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function IBAffiliate() {
  const [ibs, setIbs] = useState([]);
  const [clients, setClients] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [selectedIb, setSelectedIb] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch] = useState('');

  const empty = {
    client_id: '', ib_code: '', parent_ib_id: '',
    commission_type: 'per_lot', commission_rate: '',
    currency: 'USD', status: 'active', notes: '',
  };
  const [form, setForm] = useState(empty);

  const emptyReferral = { ib_id: '', referred_client_id: '', commission_amount: '', currency: 'USD', status: 'pending' };
  const [referralForm, setReferralForm] = useState(emptyReferral);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: ibData }, { data: cliData }, { data: refData }] = await Promise.all([
      supabase.from('ib_affiliates').select('*, client:client_id(first_name, last_name, email), parent:parent_ib_id(ib_code)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name, email').order('first_name'),
      supabase.from('ib_referrals').select('*, ib:ib_id(ib_code), referred_client:referred_client_id(first_name, last_name)').order('created_at', { ascending: false }),
    ]);
    setIbs(ibData || []);
    setClients(cliData || []);
    setReferrals(refData || []);
    setLoading(false);
  }

  function generateCode() {
    const code = 'IB' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setForm(f => ({ ...f, ib_code: code }));
  }

  async function save() {
    const payload = {
      ...form,
      commission_rate: parseFloat(form.commission_rate) || 0,
      client_id: form.client_id || null,
      parent_ib_id: form.parent_ib_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('ib_affiliates').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('ib_affiliates').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function saveReferral() {
    await supabase.from('ib_referrals').insert({
      ...referralForm,
      commission_amount: parseFloat(referralForm.commission_amount) || 0,
      ib_id: referralForm.ib_id || null,
      referred_client_id: referralForm.referred_client_id || null,
    });
    setShowReferralModal(false);
    setReferralForm(emptyReferral);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this IB?')) return;
    await supabase.from('ib_affiliates').delete().eq('id', id);
    fetchAll();
  }

  const filtered = ibs.filter(ib => {
    if (filterStatus !== 'all' && ib.status !== filterStatus) return false;
    if (search && !ib.ib_code?.toLowerCase().includes(search.toLowerCase()) &&
      !ib.client?.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !ib.client?.last_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalCommission = ibs.reduce((s, ib) => s + (parseFloat(ib.total_commission) || 0), 0);
  const pendingCommission = ibs.reduce((s, ib) => s + (parseFloat(ib.pending_commission) || 0), 0);
  const totalReferrals = ibs.reduce((s, ib) => s + (parseInt(ib.total_referrals) || 0), 0);

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  const ibReferrals = selectedIb ? referrals.filter(r => r.ib_id === selectedIb.id) : [];

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>IB / Affiliate System</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{ibs.length} total IBs · {referrals.length} referrals</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowReferralModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
            <Plus size={14} /> Add Referral
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> Add IB
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total IBs', value: ibs.length, color: '#6366F1', bg: '#EEF2FF', icon: Users },
          { label: 'Total Referrals', value: totalReferrals, color: '#059669', bg: '#ECFDF5', icon: TrendingUp },
          { label: 'Total Commission', value: `$${formatAmount(totalCommission)}`, color: '#0369A1', bg: '#E0F2FE', icon: DollarSign },
          { label: 'Pending Commission', value: `$${formatAmount(pendingCommission)}`, color: '#854D0E', bg: '#FEF9C3', icon: DollarSign },
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedIb ? '1fr 380px' : '1fr', gap: '20px' }}>
        {/* IB Table */}
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search IB code, client..."
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['IB Code', 'Client', 'Commission', 'Referrals', 'Total Earned', 'Pending', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No IBs yet. Click <strong>Add IB</strong> to get started.</td></tr>
                ) : filtered.map(ib => (
                  <tr key={ib.id} onClick={() => setSelectedIb(selectedIb?.id === ib.id ? null : ib)}
                    style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: selectedIb?.id === ib.id ? '#F8FAFC' : 'white' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = selectedIb?.id === ib.id ? '#F8FAFC' : 'white'}>
                    <td style={{ padding: '12px 16px' }}><CopyBox value={ib.ib_code} /></td>
                    <td style={{ padding: '12px 16px' }}>
                      {ib.client ? (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{ib.client.first_name} {ib.client.last_name}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{ib.client.email}</div>
                        </div>
                      ) : <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>{commissionTypeLabel(ib.commission_type)}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>${formatAmount(ib.commission_rate)}</div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '13px', fontWeight: '600', textAlign: 'center' }}>{ib.total_referrals}</td>
                    <td style={{ padding: '12px 16px', color: '#059669', fontSize: '13px', fontWeight: '700' }}>${formatAmount(ib.total_commission)}</td>
                    <td style={{ padding: '12px 16px', color: '#854D0E', fontSize: '13px', fontWeight: '600' }}>${formatAmount(ib.pending_commission)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ ...statusStyle(ib.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{ib.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={e => { e.stopPropagation(); setEditItem(ib); setForm({ client_id: ib.client_id || '', ib_code: ib.ib_code, parent_ib_id: ib.parent_ib_id || '', commission_type: ib.commission_type, commission_rate: ib.commission_rate, currency: ib.currency, status: ib.status, notes: ib.notes || '' }); setShowModal(true); }}
                          style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Edit2 size={13} color="#64748B" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); remove(ib.id); }}
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
        </div>

        {/* Referrals Panel */}
        {selectedIb && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>Referrals</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>IB: <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#4338CA' }}>{selectedIb.ib_code}</span></div>
              </div>
              <button onClick={() => setSelectedIb(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#94A3B8" /></button>
            </div>
            {ibReferrals.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No referrals yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ibReferrals.map(r => (
                  <div key={r.id} style={{ background: '#F8FAFC', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>
                        {r.referred_client ? `${r.referred_client.first_name} ${r.referred_client.last_name}` : '—'}
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>${formatAmount(r.commission_amount)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(r.created_at).toLocaleDateString('en-GB')}</div>
                      <span style={{ background: r.status === 'paid' ? '#DCFCE7' : '#FEF9C3', color: r.status === 'paid' ? '#166534' : '#854D0E', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', textTransform: 'capitalize' }}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* IB Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit IB' : 'Add IB'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>IB Code</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input value={form.ib_code} onChange={e => setForm(f => ({ ...f, ib_code: e.target.value }))} placeholder="e.g. IB001" style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={generateCode} style={{ padding: '8px 14px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: '#4338CA', cursor: 'pointer', whiteSpace: 'nowrap' }}>Generate</button>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Parent IB (optional)</label>
                <select value={form.parent_ib_id} onChange={e => setForm(f => ({ ...f, parent_ib_id: e.target.value }))} style={inputStyle}>
                  <option value="">No parent IB</option>
                  {ibs.filter(ib => !editItem || ib.id !== editItem.id).map(ib => <option key={ib.id} value={ib.id}>{ib.ib_code} — {ib.client?.first_name} {ib.client?.last_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Commission Type</label>
                  <select value={form.commission_type} onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))} style={inputStyle}>
                    <option value="per_lot">Per Lot</option>
                    <option value="per_trade">Per Trade</option>
                    <option value="revenue_share">Revenue Share %</option>
                    <option value="cpa">CPA</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Commission Rate</label>
                  <input type="number" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
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
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.ib_code}
                style={{ padding: '9px 20px', background: !form.ib_code ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.ib_code ? '#94A3B8' : 'white', cursor: !form.ib_code ? 'not-allowed' : 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add IB'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Referral Modal */}
      {showReferralModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>Add Referral</div>
              <button onClick={() => { setShowReferralModal(false); setReferralForm(emptyReferral); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>IB</label>
                <select value={referralForm.ib_id} onChange={e => setReferralForm(f => ({ ...f, ib_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select IB</option>
                  {ibs.map(ib => <option key={ib.id} value={ib.id}>{ib.ib_code} — {ib.client?.first_name} {ib.client?.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Referred Client</label>
                <select value={referralForm.referred_client_id} onChange={e => setReferralForm(f => ({ ...f, referred_client_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Commission Amount</label>
                  <input type="number" value={referralForm.commission_amount} onChange={e => setReferralForm(f => ({ ...f, commission_amount: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Currency</label>
                  <select value={referralForm.currency} onChange={e => setReferralForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>
                    {['USD', 'EUR', 'GBP'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Status</label>
                  <select value={referralForm.status} onChange={e => setReferralForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowReferralModal(false); setReferralForm(emptyReferral); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveReferral}
                style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
                Add Referral
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
