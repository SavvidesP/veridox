import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Shield, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

const severityConfig = {
  low: { label: 'Low', color: '#166534', bg: '#DCFCE7', icon: Info },
  medium: { label: 'Medium', color: '#854D0E', bg: '#FEF9C3', icon: AlertTriangle },
  high: { label: 'High', color: '#991B1B', bg: '#FEE2E2', icon: AlertOctagon },
};

const fieldOptions = [
  { value: 'amount', label: 'Amount' },
  { value: 'country_group', label: 'Country' },
  { value: 'payment_method', label: 'Payment Method' },
  { value: 'psp_actual', label: 'PSP' },
  { value: 'account_no', label: 'Account No.' },
  { value: 'brand_name', label: 'Brand' },
  { value: 'type', label: 'Transaction Type' },
  { value: 'account_currency', label: 'Currency' },
];

const operatorOptions = {
  amount: [
    { value: 'gt', label: 'greater than' },
    { value: 'lt', label: 'less than' },
    { value: 'eq', label: 'equals' },
    { value: 'gte', label: 'greater than or equal' },
    { value: 'lte', label: 'less than or equal' },
  ],
  default: [
    { value: 'eq', label: 'equals' },
    { value: 'neq', label: 'not equals' },
    { value: 'contains', label: 'contains' },
  ],
};

const actionConfig = {
  flag: { label: 'Flag', color: '#854D0E', bg: '#FEF9C3' },
  block: { label: 'Block', color: '#991B1B', bg: '#FEE2E2' },
  review: { label: 'Send to Review', color: '#1D4ED8', bg: '#DBEAFE' },
};

export default function FraudRules() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const empty = { name: '', field: 'amount', operator: 'gt', value: '', action: 'flag', severity: 'medium', status: 'active' };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchRules(); }, []);

  async function fetchRules() {
    setLoading(true);
    const { data } = await supabase.from('fraud_rules').select('*').order('created_at', { ascending: false });
    setRules(data || []);
    setLoading(false);
  }

  async function save() {
    if (editItem) {
      await supabase.from('fraud_rules').update(form).eq('id', editItem.id);
    } else {
      await supabase.from('fraud_rules').insert(form);
    }
    setShowModal(false);
    setEditItem(null);
    setForm(empty);
    fetchRules();
  }

  async function remove(id) {
    if (!window.confirm('Delete this rule?')) return;
    await supabase.from('fraud_rules').delete().eq('id', id);
    fetchRules();
  }

  async function toggleStatus(id, current) {
    await supabase.from('fraud_rules').update({ status: current === 'active' ? 'inactive' : 'active' }).eq('id', id);
    fetchRules();
  }

  const operators = operatorOptions[form.field] || operatorOptions.default;
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  const stats = {
    total: rules.length,
    active: rules.filter(r => r.status === 'active').length,
    high: rules.filter(r => r.severity === 'high').length,
    triggered: rules.reduce((s, r) => s + (r.triggered_count || 0), 0),
  };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Anti-Fraud Rules</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Define rules to flag, block or review suspicious transactions</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> Add Rule
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Rules', value: stats.total, color: '#6366F1', bg: '#EEF2FF' },
          { label: 'Active', value: stats.active, color: '#166534', bg: '#DCFCE7' },
          { label: 'High Severity', value: stats.high, color: '#991B1B', bg: '#FEE2E2' },
          { label: 'Total Triggered', value: stats.triggered, color: '#854D0E', bg: '#FEF9C3' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}>
                <Shield size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Rules List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8', fontSize: '13px' }}>Loading...</div>
        ) : rules.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            No fraud rules yet. Click <strong>Add Rule</strong> to get started.
          </div>
        ) : rules.map(rule => {
          const sev = severityConfig[rule.severity] || severityConfig.medium;
          const SevIcon = sev.icon;
          const act = actionConfig[rule.action] || actionConfig.flag;
          const fieldLabel = fieldOptions.find(f => f.value === rule.field)?.label || rule.field;
          const opLabel = [...(operatorOptions[rule.field] || operatorOptions.default)].find(o => o.value === rule.operator)?.label || rule.operator;

          return (
            <div key={rule.id} style={{ background: 'white', borderRadius: '12px', border: `1px solid ${rule.status === 'active' ? '#E2E8F0' : '#F1F5F9'}`, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', opacity: rule.status === 'active' ? 1 : 0.6 }}>
              <div style={{ width: '36px', height: '36px', background: sev.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <SevIcon size={18} color={sev.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '4px' }}>{rule.name}</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>
                  IF <strong style={{ color: '#4338CA' }}>{fieldLabel}</strong> {opLabel} <strong style={{ color: '#4338CA' }}>{rule.value}</strong>
                  {' → '}
                  <span style={{ ...act, padding: '1px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: '700' }}>{act.label}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span style={{ background: sev.bg, color: sev.color, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{sev.label}</span>
                {rule.triggered_count > 0 && (
                  <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                    🔥 {rule.triggered_count}x triggered
                  </span>
                )}
                <button onClick={() => toggleStatus(rule.id, rule.status)}
                  style={{ padding: '5px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', background: rule.status === 'active' ? '#DCFCE7' : '#F1F5F9', color: rule.status === 'active' ? '#166534' : '#94A3B8', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
                  {rule.status === 'active' ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => { setEditItem(rule); setForm({ name: rule.name, field: rule.field, operator: rule.operator, value: rule.value, action: rule.action, severity: rule.severity, status: rule.status }); setShowModal(true); }}
                  style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Edit2 size={13} color="#64748B" />
                </button>
                <button onClick={() => remove(rule.id)}
                  style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={13} color="#EF4444" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '480px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Rule' : 'Add Fraud Rule'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Rule Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. High Amount Flag" style={inputStyle} />
              </div>
              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Condition (IF)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={labelStyle}>Field</label>
                    <select value={form.field} onChange={e => setForm(f => ({ ...f, field: e.target.value, operator: 'eq' }))} style={inputStyle}>
                      {fieldOptions.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Operator</label>
                    <select value={form.operator} onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} style={inputStyle}>
                      {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Value</label>
                    <input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.field === 'amount' ? '5000' : 'e.g. DE'} style={inputStyle} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Action</label>
                  <select value={form.action} onChange={e => setForm(f => ({ ...f, action: e.target.value }))} style={inputStyle}>
                    <option value="flag">Flag</option>
                    <option value="block">Block</option>
                    <option value="review">Send to Review</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Severity</label>
                  <select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} style={inputStyle}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.name || !form.value} style={{ padding: '9px 20px', background: !form.name || !form.value ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.name || !form.value ? '#94A3B8' : 'white', cursor: !form.name || !form.value ? 'not-allowed' : 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
