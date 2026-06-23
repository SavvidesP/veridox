import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowRight, CheckCircle, XCircle, AlertTriangle, Trash2, TrendingUp, Lightbulb, Check, GripVertical } from 'lucide-react';

const statusColor = { active: '#166534', inactive: '#991B1B' };
const statusBg = { active: '#DCFCE7', inactive: '#FEE2E2' };
const cascadeColors = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6'];

export default function Cascading() {
  const [psps, setPsps] = useState([]);
  const [rules, setRules] = useState([]);
  const [pspStats, setPspStats] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(null);
  const [applied, setApplied] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [dragState, setDragState] = useState({ ruleId: null, fromIdx: null });
  const [savingOrder, setSavingOrder] = useState(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: txns }] = await Promise.all([
      supabase.from('psp_connectors').select('*').order('created_at'),
      supabase.from('routing_rules').select('*, psp:psp_id(name, status), fallback:fallback_psp_id(name, status)').order('priority'),
      supabase.from('transactions').select('psp_actual, transaction_approval, amount'),
    ]);
    setPsps(p || []);
    setRules(r || []);

    const stats = {};
    (txns || []).forEach(t => {
      const psp = t.psp_actual;
      if (!psp) return;
      if (!stats[psp]) stats[psp] = { total: 0, success: 0, failed: 0, volume: 0 };
      stats[psp].total++;
      stats[psp].volume += parseFloat(t.amount) || 0;
      const s = t.transaction_approval?.toLowerCase();
      if (s === 'success' || s === 'approved') stats[psp].success++;
      else if (s === 'failed' || s === 'rejected') stats[psp].failed++;
    });
    Object.keys(stats).forEach(k => {
      stats[k].approvalRate = stats[k].total > 0 ? ((stats[k].success / stats[k].total) * 100).toFixed(1) : 0;
    });
    setPspStats(stats);
    generateSuggestions(r || [], stats, p || []);
    setLoading(false);
  }

  function generateSuggestions(rules, stats, psps) {
    const suggestions = [];
    const bestPsp = Object.entries(stats).filter(([_, s]) => s.total >= 3).sort((a, b) => parseFloat(b[1].approvalRate) - parseFloat(a[1].approvalRate))[0];

    rules.forEach(rule => {
      if (!rule.psp) return;
      const primaryStats = stats[rule.psp.name];
      if (!primaryStats) return;
      const approvalRate = parseFloat(primaryStats.approvalRate);

      if (approvalRate < 50 && bestPsp && bestPsp[0] !== rule.psp.name) {
        suggestions.push({ id: `low-approval-${rule.id}`, ruleId: rule.id, type: 'warning', title: `Low approval rate on "${rule.name}"`, description: `${rule.psp.name} has only ${approvalRate}% approval rate. Consider switching to ${bestPsp[0]} (${bestPsp[1].approvalRate}% approval rate).`, action: 'swap_primary', suggestedPspId: psps.find(p => p.name === bestPsp[0])?.id, ruleData: rule });
      }
      if (!rule.fallback && psps.length > 1) {
        const fallbackCandidate = psps.find(p => p.name !== rule.psp.name && p.status === 'active');
        if (fallbackCandidate) {
          suggestions.push({ id: `no-fallback-${rule.id}`, ruleId: rule.id, type: 'info', title: `No fallback PSP for "${rule.name}"`, description: `Adding ${fallbackCandidate.name} as fallback will improve resilience.`, action: 'add_fallback', suggestedPspId: fallbackCandidate.id, ruleData: rule });
        }
      }
      if (rule.fallback) {
        const fallbackStats = stats[rule.fallback.name];
        if (fallbackStats && parseFloat(fallbackStats.approvalRate) > approvalRate + 15) {
          suggestions.push({ id: `swap-fallback-${rule.id}`, ruleId: rule.id, type: 'warning', title: `Swap PSPs for "${rule.name}"`, description: `Fallback ${rule.fallback.name} (${fallbackStats.approvalRate}%) is outperforming primary ${rule.psp.name} (${approvalRate}%). Consider swapping them.`, action: 'swap_primary_fallback', suggestedPspId: rule.fallback_psp_id, currentPspId: rule.psp_id, ruleData: rule });
        }
      }
    });
    setSuggestions(suggestions);
  }

  async function applySuggestion(suggestion) {
    setApplying(suggestion.id);
    const rule = suggestion.ruleData;
    if (suggestion.action === 'swap_primary' || suggestion.action === 'swap_primary_fallback') {
      await supabase.from('routing_rules').update({ psp_id: suggestion.suggestedPspId, fallback_psp_id: suggestion.action === 'swap_primary_fallback' ? rule.psp_id : rule.fallback_psp_id || null }).eq('id', rule.id);
    } else if (suggestion.action === 'add_fallback') {
      await supabase.from('routing_rules').update({ fallback_psp_id: suggestion.suggestedPspId }).eq('id', rule.id);
    }
    setApplied(prev => [...prev, suggestion.id]);
    setApplying(null);
    fetchData();
  }

  async function deleteRule(id) {
    if (!window.confirm('Delete this rule?')) return;
    await supabase.from('routing_rules').delete().eq('id', id);
    fetchData();
  }

  // Drag and drop for PSP cascade order within a rule
  function handleDragStart(ruleId, fromIdx) {
    setDragState({ ruleId, fromIdx });
  }

  function handleDragOver(e, ruleId, toIdx) {
    e.preventDefault();
    if (dragState.ruleId !== ruleId || dragState.fromIdx === toIdx) return;
    setRules(prev => prev.map(rule => {
      if (rule.id !== ruleId) return rule;
      const cascade = [...(rule.cascade_psps || [])];
      const [moved] = cascade.splice(dragState.fromIdx, 1);
      cascade.splice(toIdx, 0, moved);
      return { ...rule, cascade_psps: cascade };
    }));
    setDragState({ ruleId, fromIdx: toIdx });
  }

  async function handleDragEnd(ruleId) {
    setDragState({ ruleId: null, fromIdx: null });
    const rule = rules.find(r => r.id === ruleId);
    if (!rule?.cascade_psps) return;
    setSavingOrder(ruleId);
    await supabase.from('routing_rules').update({
      cascade_psps: rule.cascade_psps,
      psp_id: rule.cascade_psps[0]?.id || null,
      fallback_psp_id: rule.cascade_psps[1]?.id || null,
    }).eq('id', ruleId);
    setSavingOrder(null);
    fetchData();
  }

  // Drag and drop for rule priority order
  const [dragRule, setDragRule] = useState({ fromIdx: null });

  function handleRuleDragStart(fromIdx) {
    setDragRule({ fromIdx });
  }

  function handleRuleDragOver(e, toIdx) {
    e.preventDefault();
    if (dragRule.fromIdx === null || dragRule.fromIdx === toIdx) return;
    setRules(prev => {
      const reordered = [...prev];
      const [moved] = reordered.splice(dragRule.fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      return reordered;
    });
    setDragRule({ fromIdx: toIdx });
  }

  async function handleRuleDragEnd() {
    setDragRule({ fromIdx: null });
    // Update priority for all rules
    const updates = rules.map((rule, idx) => supabase.from('routing_rules').update({ priority: idx + 1 }).eq('id', rule.id));
    await Promise.all(updates);
    fetchData();
  }

  const brands = [...new Set(rules.map(r => r.brand).filter(Boolean))];
  const filteredRules = selectedBrand === 'all' ? rules : rules.filter(r => r.brand === selectedBrand || !r.brand);

  if (loading) return (
    <div style={{ padding: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ color: '#94A3B8', fontSize: '13px' }}>Loading...</div>
    </div>
  );

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Cascading Logic</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Drag rules to reorder priority · Drag PSPs within a rule to reorder cascade</p>
      </div>

      {/* PSP Performance */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>PSP Performance</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {psps.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px' }}>No PSPs connected yet.</div>
          ) : psps.map(psp => {
            const s = pspStats[psp.name];
            const rate = s ? parseFloat(s.approvalRate) : null;
            const rateColor = rate === null ? '#94A3B8' : rate >= 70 ? '#166534' : rate >= 40 ? '#854D0E' : '#991B1B';
            const rateBg = rate === null ? '#F1F5F9' : rate >= 70 ? '#DCFCE7' : rate >= 40 ? '#FEF9C3' : '#FEE2E2';
            return (
              <div key={psp.id} style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px 18px', minWidth: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: psp.status === 'active' ? '#22C55E' : '#EF4444' }} />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{psp.name}</span>
                </div>
                {s ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Approval Rate</span>
                      <span style={{ background: rateBg, color: rateColor, padding: '1px 7px', borderRadius: '5px', fontSize: '12px', fontWeight: '700' }}>{rate}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Transactions</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>{s.total}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Volume</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#475569' }}>${(s.volume / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94A3B8' }}>No transaction data</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.filter(s => !applied.includes(s.id)).length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Lightbulb size={13} /> Smart Suggestions
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {suggestions.filter(s => !applied.includes(s.id)).map(s => (
              <div key={s.id} style={{ background: s.type === 'warning' ? '#FFFBEB' : '#EFF6FF', border: `1px solid ${s.type === 'warning' ? '#FDE68A' : '#BFDBFE'}`, borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ flexShrink: 0 }}>
                  {s.type === 'warning' ? <AlertTriangle size={18} color="#F59E0B" /> : <TrendingUp size={18} color="#3B82F6" />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', marginBottom: '2px' }}>{s.title}</div>
                  <div style={{ fontSize: '12px', color: '#64748B' }}>{s.description}</div>
                </div>
                <button onClick={() => applySuggestion(s)} disabled={applying === s.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: applying === s.id ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: applying === s.id ? '#94A3B8' : 'white', cursor: applying === s.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                  {applying === s.id ? 'Applying...' : <><Check size={13} /> Apply</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Brand Filter */}
      {brands.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {['all', ...brands].map(b => (
            <button key={b} onClick={() => setSelectedBrand(b)}
              style={{ padding: '6px 14px', borderRadius: '7px', border: '1px solid #E2E8F0', background: selectedBrand === b ? '#0F172A' : 'white', color: selectedBrand === b ? 'white' : '#475569', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
              {b === 'all' ? 'All Brands' : b}
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: '#4338CA', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GripVertical size={14} /> Drag the ⠿ handle to reorder rules by priority · Drag PSP badges inside a rule to reorder cascade chain
      </div>

      {/* Rules */}
      {filteredRules.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
          No routing rules yet. Go to <strong>Smart Routing</strong> to add rules.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredRules.map((rule, ruleIdx) => (
            <div key={rule.id}
              draggable
              onDragStart={() => handleRuleDragStart(ruleIdx)}
              onDragOver={(e) => handleRuleDragOver(e, ruleIdx)}
              onDragEnd={handleRuleDragEnd}
              style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'grab', opacity: dragRule.fromIdx === ruleIdx ? 0.5 : 1, transition: 'opacity 0.15s' }}>

              {/* Rule Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <GripVertical size={18} color="#CBD5E1" style={{ cursor: 'grab' }} />
                  <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#6366F1' }}>
                    {ruleIdx + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>{rule.name}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      {[rule.brand && `Brand: ${rule.brand}`, rule.currency && `Currency: ${rule.currency}`, rule.type && `Type: ${rule.type}`, rule.country && `Country: ${rule.country}`].filter(Boolean).join(' · ') || 'No conditions'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {savingOrder === rule.id && <span style={{ fontSize: '11px', color: '#6366F1', fontWeight: '600' }}>Saving...</span>}
                  <span style={{ background: rule.status === 'active' ? '#DCFCE7' : '#FEE2E2', color: rule.status === 'active' ? '#166534' : '#991B1B', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{rule.status}</span>
                  <button onClick={() => deleteRule(rule.id)} style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} color="#EF4444" />
                  </button>
                </div>
              </div>

              {/* Cascade Flow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '16px', marginBottom: '2px' }}>💳</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748B' }}>TRANSACTION</div>
                </div>

                <ArrowRight size={16} color="#CBD5E1" />

                {/* Cascade PSPs - Draggable */}
                {(rule.cascade_psps || []).length > 0 ? (
                  (rule.cascade_psps || []).map((psp, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        draggable
                        onDragStart={(e) => { e.stopPropagation(); handleDragStart(rule.id, idx); }}
                        onDragOver={(e) => { e.stopPropagation(); handleDragOver(e, rule.id, idx); }}
                        onDragEnd={(e) => { e.stopPropagation(); handleDragEnd(rule.id); }}
                        style={{ background: `${cascadeColors[idx % cascadeColors.length]}15`, border: `2px solid ${cascadeColors[idx % cascadeColors.length]}`, borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '110px', cursor: 'grab', transition: 'transform 0.1s', opacity: dragState.ruleId === rule.id && dragState.fromIdx === idx ? 0.5 : 1 }}>
                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '3px' }}>
                          {idx === 0 ? 'PRIMARY' : `FALLBACK ${idx}`}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: cascadeColors[idx % cascadeColors.length] }}>{psp.name}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>⠿ drag to reorder</div>
                      </div>
                      {idx < (rule.cascade_psps || []).length - 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: '#EF4444', fontWeight: '700' }}>FAILS</span>
                          <ArrowRight size={16} color="#EF4444" />
                        </div>
                      )}
                    </div>
                  ))
                ) : rule.psp ? (
                  <>
                    <div style={{ background: '#EEF2FF', border: '2px solid #6366F1', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '110px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '3px' }}>PRIMARY</div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#4338CA' }}>{rule.psp.name}</div>
                    </div>
                    {rule.fallback && (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: '#EF4444', fontWeight: '700' }}>FAILS</span>
                          <ArrowRight size={16} color="#EF4444" />
                        </div>
                        <div style={{ background: '#FFF7ED', border: '2px solid #F59E0B', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '110px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#94A3B8', marginBottom: '3px' }}>FALLBACK</div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#C2410C' }}>{rule.fallback.name}</div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '110px' }}>
                    <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>No PSP assigned</div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#EF4444', fontWeight: '700' }}>FAILS</span>
                  <ArrowRight size={16} color="#EF4444" />
                </div>

                <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '16px', marginBottom: '2px' }}>❌</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#991B1B' }}>DECLINED</div>
                </div>

                <div style={{ marginLeft: 'auto', background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: '10px', padding: '10px 14px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '16px', marginBottom: '2px' }}>✅</div>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#166534' }}>APPROVED</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
