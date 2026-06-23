import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, Link, GripVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => ({
  active: { background: '#DCFCE7', color: '#166534' },
  inactive: { background: '#FEE2E2', color: '#991B1B' },
}[s] || { background: '#F1F5F9', color: '#64748B' });

export default function Routing() {
  const [psps, setPsps] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('connectors');
  const [showPspModal, setShowPspModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editPsp, setEditPsp] = useState(null);
  const [editRule, setEditRule] = useState(null);

  const emptyPsp = { name: '', api_key: '', api_secret: '', endpoint_url: '', status: 'active' };
  const emptyRule = { name: '', brand: '', currency: '', type: '', country: '', amount_min: '', amount_max: '', priority: 1, status: 'active', cascade_psps: [] };

  const [pspForm, setPspForm] = useState(emptyPsp);
  const [ruleForm, setRuleForm] = useState(emptyRule);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('psp_connectors').select('*').order('created_at', { ascending: false }),
      supabase.from('routing_rules').select('*').order('priority', { ascending: true }),
    ]);
    setPsps(p || []);
    setRules(r || []);
    setLoading(false);
  }

  async function savePsp() {
    if (editPsp) {
      await supabase.from('psp_connectors').update(pspForm).eq('id', editPsp.id);
    } else {
      await supabase.from('psp_connectors').insert(pspForm);
    }
    setShowPspModal(false);
    setEditPsp(null);
    setPspForm(emptyPsp);
    fetchAll();
  }

  async function deletePsp(id) {
    if (!window.confirm('Delete this PSP connector?')) return;
    await supabase.from('psp_connectors').delete().eq('id', id);
    fetchAll();
  }

  async function saveRule() {
    const payload = {
      name: ruleForm.name,
      brand: ruleForm.brand || null,
      currency: ruleForm.currency || null,
      type: ruleForm.type || null,
      country: ruleForm.country || null,
      amount_min: ruleForm.amount_min ? parseFloat(ruleForm.amount_min) : null,
      amount_max: ruleForm.amount_max ? parseFloat(ruleForm.amount_max) : null,
      priority: parseInt(ruleForm.priority) || 1,
      status: ruleForm.status,
      cascade_psps: ruleForm.cascade_psps || [],
      // Keep old fields for backward compat
      psp_id: ruleForm.cascade_psps?.[0]?.id || null,
      fallback_psp_id: ruleForm.cascade_psps?.[1]?.id || null,
    };
    if (editRule) {
      await supabase.from('routing_rules').update(payload).eq('id', editRule.id);
    } else {
      await supabase.from('routing_rules').insert(payload);
    }
    setShowRuleModal(false);
    setEditRule(null);
    setRuleForm(emptyRule);
    fetchAll();
  }

  async function deleteRule(id) {
    if (!window.confirm('Delete this rule?')) return;
    await supabase.from('routing_rules').delete().eq('id', id);
    fetchAll();
  }

  async function toggleStatus(table, id, current) {
    await supabase.from(table).update({ status: current === 'active' ? 'inactive' : 'active' }).eq('id', id);
    fetchAll();
  }

  function addCascadePsp() {
    setRuleForm(f => ({ ...f, cascade_psps: [...(f.cascade_psps || []), { id: '', name: '' }] }));
  }

  function removeCascadePsp(idx) {
    setRuleForm(f => ({ ...f, cascade_psps: f.cascade_psps.filter((_, i) => i !== idx) }));
  }

  function updateCascadePsp(idx, pspId) {
    const psp = psps.find(p => p.id === pspId);
    if (!psp) return;
    setRuleForm(f => ({
      ...f,
      cascade_psps: f.cascade_psps.map((p, i) => i === idx ? { id: psp.id, name: psp.name } : p)
    }));
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  const cascadeColors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Smart Routing</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Manage PSP connectors and routing rules</p>
        </div>
        <button onClick={() => activeTab === 'connectors' ? setShowPspModal(true) : setShowRuleModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Plus size={14} /> {activeTab === 'connectors' ? 'Add PSP' : 'Add Rule'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {['connectors', 'rules'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '7px 20px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? '#0F172A' : '#64748B', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {tab === 'connectors' ? '🔌 PSP Connectors' : '⚡ Routing Rules'}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: '#94A3B8', fontSize: '13px' }}>Loading...</div> : (
        <>
          {/* PSP Connectors Tab */}
          {activeTab === 'connectors' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {psps.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px', color: '#94A3B8', fontSize: '13px' }}>
                  No PSP connectors yet. Click <strong>Add PSP</strong> to get started.
                </div>
              )}
              {psps.map(psp => (
                <div key={psp.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Link size={16} color="white" />
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>{psp.name}</div>
                        <span style={{ ...statusStyle(psp.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{psp.status}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => { setEditPsp(psp); setPspForm({ name: psp.name, api_key: psp.api_key || '', api_secret: psp.api_secret || '', endpoint_url: psp.endpoint_url || '', status: psp.status }); setShowPspModal(true); }}
                        style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={13} color="#64748B" />
                      </button>
                      <button onClick={() => deletePsp(psp.id)}
                        style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {psp.endpoint_url && <div>🌐 {psp.endpoint_url}</div>}
                    {psp.api_key && <div>🔑 ••••••{psp.api_key.slice(-4)}</div>}
                  </div>
                  <button onClick={() => toggleStatus('psp_connectors', psp.id, psp.status)}
                    style={{ marginTop: '12px', width: '100%', padding: '6px', border: '1px solid #E2E8F0', borderRadius: '7px', background: '#F8FAFC', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                    {psp.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Routing Rules Tab */}
          {activeTab === 'rules' && (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
              {rules.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: '#94A3B8', fontSize: '13px' }}>
                  No routing rules yet. Click <strong>Add Rule</strong> to get started.
                </div>
              ) : rules.map((rule, i) => {
                const cascadePsps = rule.cascade_psps || [];
                return (
                  <div key={rule.id} style={{ padding: '16px 20px', borderBottom: i < rules.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#6366F1', flexShrink: 0, marginTop: '2px' }}>
                        {rule.priority}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A', marginBottom: '6px' }}>{rule.name}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {rule.brand && <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600' }}>Brand: {rule.brand}</span>}
                          {rule.currency && <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600' }}>Currency: {rule.currency}</span>}
                          {rule.type && <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600' }}>Type: {rule.type}</span>}
                          {rule.country && <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600' }}>Country: {rule.country}</span>}
                        </div>
                        {/* Cascade chain */}
                        {cascadePsps.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {cascadePsps.map((psp, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span style={{ fontSize: '9px', fontWeight: '700', color: '#94A3B8', marginBottom: '2px' }}>
                                    {idx === 0 ? 'PRIMARY' : `FALLBACK ${idx}`}
                                  </span>
                                  <span style={{ background: `${cascadeColors[idx]}20`, color: cascadeColors[idx], padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', border: `1px solid ${cascadeColors[idx]}40` }}>
                                    {psp.name}
                                  </span>
                                </div>
                                {idx < cascadePsps.length - 1 && (
                                  <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '600' }}>→ FAILS →</span>
                                )}
                              </div>
                            ))}
                            <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '600' }}>→ DECLINED</span>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ ...statusStyle(rule.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{rule.status}</span>
                        <button onClick={() => { setEditRule(rule); setRuleForm({ name: rule.name, brand: rule.brand || '', currency: rule.currency || '', type: rule.type || '', country: rule.country || '', amount_min: rule.amount_min || '', amount_max: rule.amount_max || '', priority: rule.priority, status: rule.status, cascade_psps: rule.cascade_psps || [] }); setShowRuleModal(true); }}
                          style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Edit2 size={13} color="#64748B" />
                        </button>
                        <button onClick={() => deleteRule(rule.id)}
                          style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={13} color="#EF4444" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* PSP Modal */}
      {showPspModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '460px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editPsp ? 'Edit PSP Connector' : 'Add PSP Connector'}</div>
              <button onClick={() => { setShowPspModal(false); setEditPsp(null); setPspForm(emptyPsp); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[['name', 'PSP Name *', 'e.g. Stripe'], ['api_key', 'API Key', 'sk_live_...'], ['api_secret', 'API Secret', '••••••••'], ['endpoint_url', 'Endpoint URL', 'https://api.psp.com/v1']].map(([key, label, placeholder]) => (
                <div key={key}>
                  <label style={labelStyle}>{label}</label>
                  <input value={pspForm[key]} onChange={e => setPspForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} type={key === 'api_secret' ? 'password' : 'text'} style={inputStyle} />
                </div>
              ))}
              <div>
                <label style={labelStyle}>Status</label>
                <select value={pspForm.status} onChange={e => setPspForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPspModal(false); setEditPsp(null); setPspForm(emptyPsp); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={savePsp} disabled={!pspForm.name} style={{ padding: '9px 20px', background: !pspForm.name ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !pspForm.name ? '#94A3B8' : 'white', cursor: !pspForm.name ? 'not-allowed' : 'pointer' }}>
                {editPsp ? 'Save Changes' : 'Add PSP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rule Modal */}
      {showRuleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '540px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editRule ? 'Edit Routing Rule' : 'Add Routing Rule'}</div>
              <button onClick={() => { setShowRuleModal(false); setEditRule(null); setRuleForm(emptyRule); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={labelStyle}>Rule Name *</label>
                <input value={ruleForm.name} onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. EUR Deposits via Stripe" style={inputStyle} />
              </div>
              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conditions (IF)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[['brand', 'Brand', 'e.g. AlphaFX'], ['currency', 'Currency', 'e.g. EUR'], ['type', 'Type', 'Deposit / Withdrawal'], ['country', 'Country', 'e.g. DE']].map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label style={labelStyle}>{label}</label>
                      <input value={ruleForm[key]} onChange={e => setRuleForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} style={inputStyle} />
                    </div>
                  ))}
                  <div>
                    <label style={labelStyle}>Amount Min</label>
                    <input type="number" value={ruleForm.amount_min} onChange={e => setRuleForm(f => ({ ...f, amount_min: e.target.value }))} placeholder="0" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Amount Max</label>
                    <input type="number" value={ruleForm.amount_max} onChange={e => setRuleForm(f => ({ ...f, amount_max: e.target.value }))} placeholder="99999" style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* Cascade PSP Chain */}
              <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>PSP Cascade Chain</div>
                  <button onClick={addCascadePsp}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
                    <Plus size={11} /> Add PSP
                  </button>
                </div>
                {ruleForm.cascade_psps?.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '12px', color: '#94A3B8', fontSize: '12px' }}>
                    No PSPs added yet. Click "Add PSP" to build your cascade chain.
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ruleForm.cascade_psps?.map((psp, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', background: `${cascadeColors[idx % cascadeColors.length]}20`, border: `1px solid ${cascadeColors[idx % cascadeColors.length]}40`, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: cascadeColors[idx % cascadeColors.length], flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', minWidth: '60px' }}>
                        {idx === 0 ? 'PRIMARY' : `FALLBACK ${idx}`}
                      </span>
                      <select value={psp.id} onChange={e => updateCascadePsp(idx, e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                        <option value="">Select PSP</option>
                        {psps.filter(p => p.status === 'active').map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button onClick={() => removeCascadePsp(idx)}
                        style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <Trash2 size={13} color="#EF4444" />
                      </button>
                    </div>
                  ))}
                </div>
                {ruleForm.cascade_psps?.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '8px', background: '#FEF2F2', borderRadius: '6px', fontSize: '11px', color: '#991B1B', fontWeight: '600', textAlign: 'center' }}>
                    ❌ If all PSPs fail → DECLINED
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>Priority</label>
                  <input type="number" value={ruleForm.priority} onChange={e => setRuleForm(f => ({ ...f, priority: e.target.value }))} min="1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={ruleForm.status} onChange={e => setRuleForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowRuleModal(false); setEditRule(null); setRuleForm(emptyRule); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveRule} disabled={!ruleForm.name} style={{ padding: '9px 20px', background: !ruleForm.name ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !ruleForm.name ? '#94A3B8' : 'white', cursor: !ruleForm.name ? 'not-allowed' : 'pointer' }}>
                {editRule ? 'Save Changes' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
