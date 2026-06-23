import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowDown, ArrowRight, CheckCircle, XCircle, AlertTriangle, Plus, Trash2 } from 'lucide-react';

const statusColor = { active: '#166534', inactive: '#991B1B' };
const statusBg = { active: '#DCFCE7', inactive: '#FEE2E2' };

export default function Cascading() {
  const [psps, setPsps] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState('all');

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from('psp_connectors').select('*').order('created_at'),
      supabase.from('routing_rules').select('*, psp:psp_id(name, status), fallback:fallback_psp_id(name, status)').order('priority'),
    ]);
    setPsps(p || []);
    setRules(r || []);
    setLoading(false);
  }

  async function deleteRule(id) {
    if (!window.confirm('Delete this rule?')) return;
    await supabase.from('routing_rules').delete().eq('id', id);
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
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Cascading Logic</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Visual PSP fallback flow per routing rule</p>
      </div>

      {/* PSP Status Overview */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Connected PSPs</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {psps.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px' }}>No PSPs connected yet. Go to <strong>Smart Routing</strong> to add PSP connectors.</div>
          ) : psps.map(psp => (
            <div key={psp.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 14px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: psp.status === 'active' ? '#22C55E' : '#EF4444' }} />
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{psp.name}</span>
              <span style={{ fontSize: '11px', color: statusColor[psp.status], background: statusBg[psp.status], padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>{psp.status}</span>
            </div>
          ))}
        </div>
      </div>

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

      {/* Cascading Flow */}
      {filteredRules.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
          No routing rules yet. Go to <strong>Smart Routing</strong> to add rules with PSP assignments.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredRules.map((rule, idx) => (
            <div key={rule.id} style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Rule Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#6366F1' }}>
                    {rule.priority}
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>{rule.name}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      {[rule.brand && `Brand: ${rule.brand}`, rule.currency && `Currency: ${rule.currency}`, rule.type && `Type: ${rule.type}`, rule.country && `Country: ${rule.country}`, rule.amount_min && `Min: ${rule.amount_min}`, rule.amount_max && `Max: ${rule.amount_max}`].filter(Boolean).join(' · ') || 'No conditions set'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: rule.status === 'active' ? '#DCFCE7' : '#FEE2E2', color: rule.status === 'active' ? '#166534' : '#991B1B', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{rule.status}</span>
                  <button onClick={() => deleteRule(rule.id)} style={{ padding: '5px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={13} color="#EF4444" />
                  </button>
                </div>
              </div>

              {/* Cascade Flow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Transaction */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '100px' }}>
                  <div style={{ fontSize: '18px', marginBottom: '4px' }}>💳</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B' }}>TRANSACTION</div>
                </div>

                <ArrowRight size={20} color="#CBD5E1" />

                {/* Primary PSP */}
                {rule.psp ? (
                  <div style={{ background: rule.psp.status === 'active' ? '#EEF2FF' : '#FEF9C3', border: `2px solid ${rule.psp.status === 'active' ? '#6366F1' : '#F59E0B'}`, borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', marginBottom: '4px' }}>PRIMARY PSP</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: rule.psp.status === 'active' ? '#4338CA' : '#854D0E' }}>{rule.psp.name}</div>
                    <div style={{ marginTop: '6px' }}>
                      {rule.psp.status === 'active'
                        ? <CheckCircle size={14} color="#22C55E" style={{ display: 'inline' }} />
                        : <AlertTriangle size={14} color="#F59E0B" style={{ display: 'inline' }} />}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#F8FAFC', border: '2px dashed #E2E8F0', borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8' }}>NO PRIMARY PSP</div>
                  </div>
                )}

                {/* Fallback */}
                {rule.fallback && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#EF4444' }}>FAILS</div>
                      <ArrowRight size={20} color="#EF4444" />
                    </div>
                    <div style={{ background: rule.fallback.status === 'active' ? '#FFF7ED' : '#FEF9C3', border: `2px solid ${rule.fallback.status === 'active' ? '#F59E0B' : '#E2E8F0'}`, borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '120px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', marginBottom: '4px' }}>FALLBACK PSP</div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#C2410C' }}>{rule.fallback.name}</div>
                      <div style={{ marginTop: '6px' }}>
                        {rule.fallback.status === 'active'
                          ? <CheckCircle size={14} color="#22C55E" style={{ display: 'inline' }} />
                          : <XCircle size={14} color="#EF4444" style={{ display: 'inline' }} />}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#EF4444' }}>FAILS</div>
                      <ArrowRight size={20} color="#EF4444" />
                    </div>

                    {/* Final Decline */}
                    <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '100px' }}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>❌</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#991B1B' }}>DECLINED</div>
                    </div>
                  </>
                )}

                {!rule.fallback && rule.psp && (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '600', color: '#EF4444' }}>FAILS</div>
                      <ArrowRight size={20} color="#EF4444" />
                    </div>
                    <div style={{ background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '100px' }}>
                      <div style={{ fontSize: '18px', marginBottom: '4px' }}>❌</div>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#991B1B' }}>DECLINED</div>
                    </div>
                  </>
                )}

                {/* Success */}
                <div style={{ marginLeft: 'auto', background: '#F0FDF4', border: '2px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px', textAlign: 'center', minWidth: '100px' }}>
                  <div style={{ fontSize: '18px', marginBottom: '4px' }}>✅</div>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534' }}>APPROVED</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
