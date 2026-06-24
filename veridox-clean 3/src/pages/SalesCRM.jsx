import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, User, Phone, Mail, TrendingUp, Target, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const stageStyle = (s) => ({
  prospecting: { background: '#F1F5F9', color: '#475569' },
  qualified: { background: '#EEF2FF', color: '#4338CA' },
  proposal: { background: '#FFF7ED', color: '#C2410C' },
  negotiation: { background: '#FEF9C3', color: '#854D0E' },
  closed_won: { background: '#DCFCE7', color: '#166534' },
  closed_lost: { background: '#FEE2E2', color: '#991B1B' },
}[s] || { background: '#F1F5F9', color: '#475569' });

const sourceStyle = (s) => ({
  manual: { background: '#F1F5F9', color: '#475569' },
  website: { background: '#EEF2FF', color: '#4338CA' },
  referral: { background: '#ECFDF5', color: '#059669' },
  social: { background: '#FFF7ED', color: '#C2410C' },
  email: { background: '#F5F3FF', color: '#7C3AED' },
  cold_call: { background: '#FEF9C3', color: '#854D0E' },
}[s] || { background: '#F1F5F9', color: '#475569' });

function formatAmount(v) {
  if (!v) return '$0';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const stages = ['prospecting', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

export default function SalesCRM() {
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStage, setFilterStage] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('table'); // table or kanban

  const empty = {
    first_name: '', last_name: '', email: '', phone: '', company: '',
    country: '', source: 'manual', status: 'active', stage: 'prospecting',
    assigned_to: '', estimated_value: '', currency: 'USD',
    notes: '', next_followup_at: '',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: leadData }, { data: cliData }] = await Promise.all([
      supabase.from('sales_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name').order('first_name'),
    ]);
    setLeads(leadData || []);
    setClients(cliData || []);
    setLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      estimated_value: parseFloat(form.estimated_value) || 0,
      next_followup_at: form.next_followup_at || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('sales_leads').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('sales_leads').insert(payload);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchAll();
  }

  async function updateStage(id, stage) {
    await supabase.from('sales_leads').update({ stage, updated_at: new Date().toISOString() }).eq('id', id);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this lead?')) return;
    await supabase.from('sales_leads').delete().eq('id', id);
    fetchAll();
  }

  async function convertToClient(lead) {
    if (!window.confirm(`Convert ${lead.first_name} ${lead.last_name} to a client?`)) return;
    const { data } = await supabase.from('clients').insert({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      country: lead.country,
    }).select().single();
    if (data) {
      await supabase.from('sales_leads').update({ stage: 'closed_won', converted_client_id: data.id, updated_at: new Date().toISOString() }).eq('id', lead.id);
      fetchAll();
      alert(`✅ ${lead.first_name} ${lead.last_name} converted to client!`);
    }
  }

  const filtered = leads.filter(l => {
    if (filterStage !== 'all' && l.stage !== filterStage) return false;
    if (filterSource !== 'all' && l.source !== filterSource) return false;
    if (search && !l.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !l.last_name?.toLowerCase().includes(search.toLowerCase()) &&
      !l.email?.toLowerCase().includes(search.toLowerCase()) &&
      !l.company?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalValue = leads.filter(l => l.stage === 'closed_won').reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);
  const pipelineValue = leads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage)).reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);
  const wonCount = leads.filter(l => l.stage === 'closed_won').length;
  const conversionRate = leads.length > 0 ? Math.round((wonCount / leads.length) * 100) : 0;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Sales CRM</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{leads.length} total leads</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px' }}>
            <button onClick={() => setView('table')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: view === 'table' ? 'white' : 'transparent', fontSize: '13px', fontWeight: '600', color: view === 'table' ? '#0F172A' : '#64748B', cursor: 'pointer', boxShadow: view === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Table</button>
            <button onClick={() => setView('kanban')} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: view === 'kanban' ? 'white' : 'transparent', fontSize: '13px', fontWeight: '600', color: view === 'kanban' ? '#0F172A' : '#64748B', cursor: 'pointer', boxShadow: view === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Kanban</button>
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Leads', value: leads.length, color: '#6366F1', bg: '#EEF2FF', icon: User },
          { label: 'Pipeline Value', value: formatAmount(pipelineValue), color: '#0369A1', bg: '#E0F2FE', icon: TrendingUp },
          { label: 'Won Revenue', value: formatAmount(totalValue), color: '#059669', bg: '#ECFDF5', icon: Target },
          { label: 'Conversion Rate', value: `${conversionRate}%`, color: '#7C3AED', bg: '#F5F3FF', icon: CheckCircle },
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
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, company..."
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Stages</option>
          {stages.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
          <option value="all">All Sources</option>
          {['manual', 'website', 'referral', 'social', 'email', 'cold_call'].map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                {['Lead', 'Company', 'Source', 'Stage', 'Value', 'Next Follow-up', 'Assigned', ''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No leads yet. Click <strong>Add Lead</strong> to get started.</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} style={{ borderTop: '1px solid #F1F5F9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{l.first_name} {l.last_name}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{l.email}</div>
                    {l.phone && <div style={{ fontSize: '11px', color: '#94A3B8' }}>{l.phone}</div>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{l.company || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ ...sourceStyle(l.source), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize' }}>{l.source?.replace('_', ' ')}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <select value={l.stage} onChange={e => updateStage(l.id, e.target.value)}
                      style={{ ...stageStyle(l.stage), padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer', outline: 'none', textTransform: 'capitalize' }}>
                      {stages.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{formatAmount(l.estimated_value)}</td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: l.next_followup_at && new Date(l.next_followup_at) < new Date() ? '#991B1B' : '#64748B', fontWeight: l.next_followup_at && new Date(l.next_followup_at) < new Date() ? '700' : '400' }}>
                    {formatDate(l.next_followup_at)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569' }}>{l.assigned_to || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {!l.converted_client_id && l.stage !== 'closed_lost' && (
                        <button onClick={() => convertToClient(l)}
                          style={{ padding: '5px 8px', border: '1px solid #BBF7D0', borderRadius: '6px', background: '#DCFCE7', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#166534', whiteSpace: 'nowrap' }}>
                          Convert
                        </button>
                      )}
                      <button onClick={() => { setEditItem(l); setForm({ first_name: l.first_name, last_name: l.last_name, email: l.email || '', phone: l.phone || '', company: l.company || '', country: l.country || '', source: l.source, status: l.status, stage: l.stage, assigned_to: l.assigned_to || '', estimated_value: l.estimated_value, currency: l.currency, notes: l.notes || '', next_followup_at: l.next_followup_at ? l.next_followup_at.slice(0, 10) : '' }); setShowModal(true); }}
                        style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} color="#64748B" />
                      </button>
                      <button onClick={() => remove(l.id)}
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
      )}

      {/* Kanban View */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', overflowX: 'auto' }}>
          {stages.map(stage => {
            const stageLeads = filtered.filter(l => l.stage === stage);
            const stageValue = stageLeads.reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);
            const sStyle = stageStyle(stage);
            return (
              <div key={stage} style={{ minWidth: '200px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ ...sStyle, padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' }}>{stage.replace('_', ' ')}</span>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>{stageLeads.length}</span>
                </div>
                {stageValue > 0 && <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px', fontWeight: '600' }}>{formatAmount(stageValue)}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '100px' }}>
                  {stageLeads.map(l => (
                    <div key={l.id} style={{ background: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>{l.first_name} {l.last_name}</div>
                      {l.company && <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{l.company}</div>}
                      {l.estimated_value > 0 && <div style={{ fontSize: '12px', fontWeight: '700', color: '#6366F1' }}>{formatAmount(l.estimated_value)}</div>}
                      {l.next_followup_at && (
                        <div style={{ fontSize: '10px', color: new Date(l.next_followup_at) < new Date() ? '#991B1B' : '#94A3B8', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} /> {formatDate(l.next_followup_at)}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                        {!l.converted_client_id && stage !== 'closed_lost' && stage !== 'closed_won' && (
                          <button onClick={() => convertToClient(l)}
                            style={{ flex: 1, padding: '4px', border: '1px solid #BBF7D0', borderRadius: '5px', background: '#DCFCE7', cursor: 'pointer', fontSize: '10px', fontWeight: '700', color: '#166534' }}>
                            Convert
                          </button>
                        )}
                        <button onClick={() => remove(l.id)}
                          style={{ padding: '4px 6px', border: '1px solid #FEE2E2', borderRadius: '5px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={10} color="#EF4444" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Lead' : 'Add Lead'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="John" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Smith" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@company.com" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+357 99 123456" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Company</label>
                  <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Company Ltd" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="Cyprus" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Source</label>
                  <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={inputStyle}>
                    <option value="manual">Manual</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="social">Social Media</option>
                    <option value="email">Email Campaign</option>
                    <option value="cold_call">Cold Call</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Stage</label>
                  <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={inputStyle}>
                    {stages.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Estimated Value</label>
                  <input type="number" value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Assigned To</label>
                  <input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder="Agent name" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Next Follow-up</label>
                  <input type="date" value={form.next_followup_at} onChange={e => setForm(f => ({ ...f, next_followup_at: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes about this lead..." rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.first_name || !form.last_name}
                style={{ padding: '9px 20px', background: !form.first_name || !form.last_name ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.first_name || !form.last_name ? '#94A3B8' : 'white', cursor: !form.first_name || !form.last_name ? 'not-allowed' : 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
