import { useEffect, useState } from 'react';
import { Plus, X, CheckCircle, XCircle, Clock, AlertTriangle, FileText, Upload, Eye, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => ({
  pending: { background: '#FEF9C3', color: '#854D0E' },
  verified: { background: '#DCFCE7', color: '#166534' },
  rejected: { background: '#FEE2E2', color: '#991B1B' },
  expired: { background: '#F1F5F9', color: '#475569' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const docTypeLabel = (t) => ({
  passport: 'Passport',
  national_id: 'National ID',
  driving_license: "Driver's License",
  utility_bill: 'Utility Bill',
  bank_statement: 'Bank Statement',
  proof_of_address: 'Proof of Address',
  tax_document: 'Tax Document',
  incorporation: 'Incorporation Doc',
  other: 'Other',
}[t] || t);

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isExpiringSoon(date) {
  if (!date) return false;
  const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24);
  return diff > 0 && diff <= 30;
}

function isExpired(date) {
  if (!date) return false;
  return new Date(date) < new Date();
}

export default function DocumentCenter() {
  const [docs, setDocs] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [search, setSearch] = useState('');

  const empty = {
    client_id: '', document_type: 'passport', document_name: '',
    file_url: '', file_size: '', status: 'pending',
    expiry_date: '', notes: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: docData }, { data: cliData }] = await Promise.all([
      supabase.from('documents').select('*, client:client_id(first_name, last_name, email)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name, email').order('first_name'),
    ]);
    setDocs(docData || []);
    setClients(cliData || []);
    setLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      client_id: form.client_id || null,
      expiry_date: form.expiry_date || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('documents').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('documents').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function updateStatus(id, status, extra = {}) {
    const update = { status, updated_at: new Date().toISOString(), ...extra };
    if (status === 'verified') { update.verified_by = 'Admin'; update.verified_at = new Date().toISOString(); }
    await supabase.from('documents').update(update).eq('id', id);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', id);
    fetchAll();
  }

  const filtered = docs.filter(d => {
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterType !== 'all' && d.document_type !== filterType) return false;
    if (search && !d.client?.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !d.client?.last_name?.toLowerCase().includes(search.toLowerCase()) &&
      !d.document_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pendingCount = docs.filter(d => d.status === 'pending').length;
  const expiringSoon = docs.filter(d => isExpiringSoon(d.expiry_date)).length;
  const expired = docs.filter(d => isExpired(d.expiry_date) && d.status !== 'expired').length;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Document Center</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{docs.length} total documents</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> Add Document
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Documents', value: docs.length, color: '#6366F1', bg: '#EEF2FF', icon: FileText },
          { label: 'Pending Review', value: pendingCount, color: '#854D0E', bg: '#FEF9C3', icon: Clock },
          { label: 'Expiring Soon', value: expiringSoon, color: '#C2410C', bg: '#FFF7ED', icon: AlertTriangle },
          { label: 'Expired', value: expired, color: '#991B1B', bg: '#FEE2E2', icon: XCircle },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: `1px solid ${value > 0 && label !== 'Total Documents' ? '#FEE2E2' : '#E2E8F0'}`, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}><Icon size={14} color={color} /></div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: value > 0 && label !== 'Total Documents' ? color : '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Expiry Alerts */}
      {expiringSoon > 0 && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={16} color="#C2410C" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#C2410C' }}>
            {expiringSoon} document{expiringSoon > 1 ? 's' : ''} expiring within 30 days!
          </span>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search client, document..."
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Types</option>
          <option value="passport">Passport</option>
          <option value="national_id">National ID</option>
          <option value="driving_license">Driver's License</option>
          <option value="utility_bill">Utility Bill</option>
          <option value="bank_statement">Bank Statement</option>
          <option value="proof_of_address">Proof of Address</option>
          <option value="tax_document">Tax Document</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              {['Client', 'Document', 'Type', 'Expiry', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No documents yet. Click <strong>Add Document</strong> to get started.</td></tr>
            ) : filtered.map(d => (
              <tr key={d.id} style={{ borderTop: '1px solid #F1F5F9' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{d.client ? `${d.client.first_name} ${d.client.last_name}` : '—'}</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>{d.client?.email}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={14} color="#6366F1" />
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{d.document_name}</div>
                      {d.file_size && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{d.file_size}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{docTypeLabel(d.document_type)}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontSize: '13px', color: isExpired(d.expiry_date) ? '#991B1B' : isExpiringSoon(d.expiry_date) ? '#C2410C' : '#475569', fontWeight: isExpired(d.expiry_date) || isExpiringSoon(d.expiry_date) ? '700' : '400' }}>
                    {formatDate(d.expiry_date)}
                    {isExpiringSoon(d.expiry_date) && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#FFF7ED', color: '#C2410C', padding: '1px 5px', borderRadius: '4px' }}>Soon</span>}
                    {isExpired(d.expiry_date) && <span style={{ marginLeft: '6px', fontSize: '10px', background: '#FEE2E2', color: '#991B1B', padding: '1px 5px', borderRadius: '4px' }}>Expired</span>}
                  </div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ ...statusStyle(d.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{d.status}</span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {d.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(d.id, 'verified')}
                          style={{ padding: '5px 8px', border: '1px solid #BBF7D0', borderRadius: '6px', background: '#DCFCE7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '600', color: '#166534' }}>
                          <CheckCircle size={11} /> Verify
                        </button>
                        <button onClick={() => updateStatus(d.id, 'rejected')}
                          style={{ padding: '5px 8px', border: '1px solid #FECACA', borderRadius: '6px', background: '#FEE2E2', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '600', color: '#991B1B' }}>
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    <button onClick={() => { setEditItem(d); setForm({ client_id: d.client_id || '', document_type: d.document_type, document_name: d.document_name, file_url: d.file_url || '', file_size: d.file_size || '', status: d.status, expiry_date: d.expiry_date || '', notes: d.notes || '' }); setShowModal(true); }}
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Document' : 'Add Document'}</div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Document Type</label>
                  <select value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))} style={inputStyle}>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="driving_license">Driver's License</option>
                    <option value="utility_bill">Utility Bill</option>
                    <option value="bank_statement">Bank Statement</option>
                    <option value="proof_of_address">Proof of Address</option>
                    <option value="tax_document">Tax Document</option>
                    <option value="incorporation">Incorporation Doc</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Document Name</label>
                <input value={form.document_name} onChange={e => setForm(f => ({ ...f, document_name: e.target.value }))} placeholder="e.g. John_Smith_Passport.pdf" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>File URL (optional)</label>
                  <input value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} placeholder="https://..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>File Size (optional)</label>
                  <input value={form.file_size} onChange={e => setForm(f => ({ ...f, file_size: e.target.value }))} placeholder="e.g. 2.4 MB" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Expiry Date</label>
                <input type="date" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.document_name}
                style={{ padding: '9px 20px', background: !form.document_name ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.document_name ? '#94A3B8' : 'white', cursor: !form.document_name ? 'not-allowed' : 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add Document'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
