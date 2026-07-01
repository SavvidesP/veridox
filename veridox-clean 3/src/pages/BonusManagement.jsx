import { useEffect, useState } from 'react';
import { Plus, X, Edit2, Trash2, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin as isAdminRole, roleLabel, roleStyle } from '../lib/roles';

function money(v) {
  return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

export default function BonusManagement() {
  const { user, profile } = useAuth();
  const canEdit = isAdminRole(profile?.role); // only Admin / Manager adjusts bonuses

  const [bonuses, setBonuses] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const empty = { agent_id: '', amount: '', reason: '', bonus_date: new Date().toISOString().slice(0, 10) };
  const [form, setForm] = useState(empty);

  useEffect(() => { if (profile) fetchAll(); }, [user?.id, profile?.role]);

  async function fetchAll() {
    setLoading(true);
    // Admin sees all bonuses; everyone else sees only their own.
    let bq = supabase.from('agent_bonuses').select('*, agent:agent_id(id, full_name, role)').order('bonus_date', { ascending: false });
    if (!canEdit && user?.id) bq = bq.eq('agent_id', user.id);
    const [{ data: bon }, { data: ag }] = await Promise.all([
      bq,
      supabase.from('profiles').select('id, full_name, role').in('role', ['conversion_agent', 'conversion_manager', 'retention_agent', 'retention_manager']).eq('active', true),
    ]);
    setBonuses(bon || []);
    setAgents((ag || []).sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
    setLoading(false);
  }

  async function save() {
    if (!form.agent_id) { alert('Select an agent.'); return; }
    const payload = {
      agent_id: form.agent_id,
      amount: parseFloat(form.amount) || 0,
      reason: form.reason || null,
      bonus_date: form.bonus_date || null,
      created_by: user?.id || null,
    };
    if (editItem) await supabase.from('agent_bonuses').update(payload).eq('id', editItem.id);
    else await supabase.from('agent_bonuses').insert(payload);
    setShowModal(false); setEditItem(null); setForm(empty);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this bonus?')) return;
    await supabase.from('agent_bonuses').delete().eq('id', id);
    fetchAll();
  }

  function openAdd() { setEditItem(null); setForm(empty); setShowModal(true); }
  function openEdit(b) {
    setEditItem(b);
    setForm({ agent_id: b.agent_id || '', amount: b.amount ?? '', reason: b.reason || '', bonus_date: b.bonus_date ? b.bonus_date.slice(0, 10) : '' });
    setShowModal(true);
  }

  const totalAmount = bonuses.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #E5E7EB', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif', background: '#fff' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', marginBottom: '5px' };
  const th = { padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{canEdit ? 'Bonuses' : 'My Bonuses'}</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0' }}>{canEdit ? 'Bonuses awarded to team members' : 'Bonuses awarded to you'}</p>
        </div>
        {canEdit && (
          <button onClick={openAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', background: '#111827', border: '1px solid #111827', borderRadius: '5px', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>
            <Plus size={14} /> Add Bonus
          </button>
        )}
      </div>

      {/* Stats */}
      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 260px))', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
          <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>Total Bonuses</div>
          <div style={{ color: '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{loading ? '—' : bonuses.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
          <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>Total Amount</div>
          <div style={{ color: '#16A34A', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{loading ? '—' : money(totalAmount)}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {/* Table */}
      {sectionLabel(canEdit ? 'All Bonuses' : 'Your Bonuses')}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {(canEdit ? ['Agent', 'Amount', 'Reason', 'Date', ''] : ['Amount', 'Reason', 'Date']).map((h, i) => <th key={i} style={th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={canEdit ? 5 : 3} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>Loading…</td></tr>
            ) : bonuses.length === 0 ? (
              <tr><td colSpan={canEdit ? 5 : 3} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>{canEdit ? 'No bonuses yet. Click Add Bonus to award one.' : 'No bonuses yet.'}</td></tr>
            ) : bonuses.map((b, idx) => (
              <tr key={b.id} style={{ borderBottom: idx < bonuses.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff' }}>
                {canEdit && (
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}>{b.agent?.full_name || '—'}</div>
                    {b.agent?.role && (
                      <span style={{ ...roleStyle(b.agent.role), fontSize: '10px', fontWeight: '700', padding: '1px 7px', borderRadius: '10px', display: 'inline-block', marginTop: '3px' }}>{roleLabel(b.agent.role)}</span>
                    )}
                  </td>
                )}
                <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '700', color: '#16A34A', fontFamily: 'monospace' }}>{money(b.amount)}</td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>{b.reason || '—'}</td>
                <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap' }}>{formatDate(b.bonus_date)}</td>
                {canEdit && (
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(b)} style={{ padding: '5px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex' }}><Edit2 size={13} color="#6B7280" /></button>
                      <button onClick={() => remove(b.id)} style={{ padding: '5px', border: '1px solid #FECACA', borderRadius: '6px', background: '#fff', cursor: 'pointer', display: 'flex' }}><Trash2 size={13} color="#DC2626" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal (admin only) */}
      {showModal && canEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '10px', width: '440px', maxWidth: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', border: '1px solid #E5E7EB' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}><Gift size={16} color="#6366F1" /> {editItem ? 'Edit Bonus' : 'Add Bonus'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Agent</label>
                <select value={form.agent_id} onChange={e => setForm(f => ({ ...f, agent_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select agent</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.full_name} · {roleLabel(a.role)}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Amount</label>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={form.bonus_date} onChange={e => setForm(f => ({ ...f, bonus_date: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <input type="text" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Top performer — June" style={inputStyle} />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 18px', border: '1px solid #E5E7EB', borderRadius: '7px', background: '#fff', fontSize: '13px', fontWeight: '500', color: '#374151', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} style={{ padding: '9px 20px', background: '#111827', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer' }}>{editItem ? 'Save' : 'Add Bonus'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
