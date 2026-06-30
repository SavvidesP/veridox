import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Activity as ActivityIcon, SlidersHorizontal, X, History } from 'lucide-react';
import { tradescope } from '../lib/tradescope';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function fmtUsd(v) {
  return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtPrice(v) {
  return v == null ? '—' : Number(v).toFixed(5);
}
function fmtTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Real adjustable columns on TradeScope trader_accounts
const ADJUSTABLE = [
  { key: 'balance', label: 'Balance', prefix: '$' },
  { key: 'equity', label: 'Equity', prefix: '$' },
  { key: 'margin', label: 'Margin', prefix: '$' },
  { key: 'free_margin', label: 'Free Margin', prefix: '$' },
  { key: 'leverage', label: 'Leverage', prefix: '1:' },
];

const fieldLabel = (k) => (ADJUSTABLE.find(f => f.key === k)?.label || k);

export default function TradingAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjustments, setAdjustments] = useState([]);
  const [showAdjust, setShowAdjust] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [auditMissing, setAuditMissing] = useState(false);

  async function loadAdjustments() {
    const { data, error } = await supabase
      .from('account_adjustments')
      .select('*')
      .eq('trader_account_id', id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) { setAuditMissing(true); setAdjustments([]); }
    else { setAuditMissing(false); setAdjustments(data || []); }
  }

  useEffect(() => {
    if (!id) return;
    let channel, poll, active = true;

    async function loadAccount() {
      const { data } = await tradescope.from('trader_accounts').select('*').eq('id', id).maybeSingle();
      if (active && data) setAccount(data);
    }
    async function loadTrades() {
      const { data } = await tradescope.from('trades').select('*').eq('trader_id', id).order('opened_at', { ascending: false });
      if (active) setTrades(data || []);
    }

    (async () => {
      setLoading(true);
      await Promise.all([loadAccount(), loadTrades(), loadAdjustments()]);
      if (!active) return;
      setLoading(false);
      channel = tradescope
        .channel(`acct-${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `trader_id=eq.${id}` }, () => { loadTrades(); loadAccount(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trader_accounts', filter: `id=eq.${id}` }, (p) => { if (active && p.new) setAccount(prev => ({ ...prev, ...p.new })); })
        .subscribe();
      poll = setInterval(() => { loadTrades(); loadAccount(); }, 8000);
    })();

    return () => { active = false; if (channel) tradescope.removeChannel(channel); if (poll) clearInterval(poll); };
  }, [id]);

  const openTrades = trades.filter(t => t.status === 'open');
  const closedTrades = trades.filter(t => t.status === 'closed');
  const totalPnL = closedTrades.reduce((s, t) => s + (t.profit || 0), 0);

  function openAdjust() {
    const f = {};
    ADJUSTABLE.forEach(({ key }) => { f[key] = account?.[key] ?? 0; });
    setForm(f);
    setShowAdjust(true);
  }

  async function saveAdjust() {
    if (!account) return;
    setSaving(true);
    const updates = {};
    const changes = [];
    ADJUSTABLE.forEach(({ key }) => {
      const oldVal = Number(account[key] ?? 0);
      const newVal = Number(form[key]);
      if (!isNaN(newVal) && newVal !== oldVal) {
        updates[key] = newVal;
        changes.push({ field: key, old_value: oldVal, new_value: newVal });
      }
    });
    if (changes.length === 0) { setSaving(false); setShowAdjust(false); return; }

    // 1) Apply to TradeScope account
    const { error: upErr } = await tradescope.from('trader_accounts').update(updates).eq('id', id);
    if (upErr) { setSaving(false); alert('Could not apply adjustment: ' + upErr.message); return; }

    // 2) Write audit trail to Veridox
    const rows = changes.map(c => ({
      trader_account_id: id,
      trader_email: account.email,
      field: c.field,
      old_value: c.old_value,
      new_value: c.new_value,
      changed_by: user?.id || null,
      changed_by_name: profile?.full_name || user?.email || 'Unknown',
    }));
    await supabase.from('account_adjustments').insert(rows);

    setAccount(prev => ({ ...prev, ...updates }));
    await loadAdjustments();
    setSaving(false);
    setShowAdjust(false);
  }

  const sectionLabel = (text) => (
    <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
  );

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <button onClick={() => navigate('/trading-accounts')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: "'Inter', sans-serif", padding: 0 }}>
        <ArrowLeft size={15} /> Back to Trading Accounts
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ActivityIcon size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{account?.email || 'Trading Account'}</h1>
            <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>
              TradeScope account{account ? ` · ${account.currency || 'USD'} · ${openTrades.length} open · ${closedTrades.length} closed` : ''}
            </p>
          </div>
        </div>
        {account && (
          <button
            onClick={openAdjust}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          >
            <SlidersHorizontal size={14} /> Adjust account
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#D1D5DB', fontSize: '13px', padding: '24px 0' }}>Loading…</div>
      ) : !account ? (
        <div style={{ color: '#9CA3AF', fontSize: '13px', padding: '24px 0' }}>Account not found.</div>
      ) : (
        <>
          {/* Overview */}
          {sectionLabel('Overview')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            {[
              { label: 'Balance', value: fmtUsd(account.balance) },
              { label: 'Equity', value: fmtUsd(account.equity) },
              { label: 'Margin', value: fmtUsd(account.margin) },
              { label: 'Free Margin', value: fmtUsd(account.free_margin) },
              { label: 'Leverage', value: `1:${account.leverage || 100}` },
              { label: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}${fmtUsd(totalPnL)}`, color: totalPnL >= 0 ? '#16A34A' : '#DC2626' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: '6px', padding: '20px 22px', border: '1px solid #E5E7EB' }}>
                <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '12px' }}>{label}</div>
                <div style={{ color: color || '#111827', fontSize: '24px', fontWeight: '700', letterSpacing: '-0.7px', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

          {/* Live trading activity */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ActivityIcon size={16} color="#6366F1" />
              <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>Live Trading Activity</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #BBF7D0', borderRadius: '20px', padding: '3px 10px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 3px rgba(34,197,94,0.15)' }} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: '#16A34A' }}>Live</span>
            </div>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 20px', marginBottom: '32px' }}>
            {trades.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No trades yet.</div>
            ) : trades.map((tr, idx) => {
              const buy = tr.type?.toLowerCase() === 'buy';
              const open = tr.status === 'open';
              const Icon = buy ? TrendingUp : TrendingDown;
              return (
                <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: idx < trades.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: buy ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={buy ? '#16A34A' : '#DC2626'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#111827' }}>{tr.symbol}</span>
                      <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: buy ? '#16A34A' : '#DC2626' }}>{tr.type}</span>
                      <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{tr.lot_size} lot</span>
                      {open && <span style={{ fontSize: '10px', fontWeight: '700', color: '#2563EB', border: '1px solid #BFDBFE', borderRadius: '4px', padding: '1px 6px' }}>OPEN</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
                      {fmtPrice(tr.open_price)}{!open && tr.close_price != null ? ` → ${fmtPrice(tr.close_price)}` : ''} · {fmtTime(open ? tr.opened_at : tr.closed_at)}
                    </div>
                  </div>
                  {!open && (
                    <div style={{ fontSize: '13px', fontWeight: '700', color: (tr.profit || 0) >= 0 ? '#16A34A' : '#DC2626', flexShrink: 0 }}>
                      {(tr.profit || 0) >= 0 ? '+' : ''}{fmtUsd(tr.profit)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Adjustment history (audit log) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <History size={16} color="#6366F1" />
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>Adjustment History</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>· audit log</span>
          </div>
          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 20px' }}>
            {auditMissing ? (
              <div style={{ color: '#9CA3AF', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Audit table not set up yet.</div>
            ) : adjustments.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No adjustments recorded.</div>
            ) : adjustments.map((a, idx) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: idx < adjustments.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#111827' }}>
                    <span style={{ fontWeight: '700' }}>{fieldLabel(a.field)}</span>
                    <span style={{ color: '#9CA3AF' }}> {a.field === 'leverage' ? `1:${a.old_value}` : fmtUsd(a.old_value)} → </span>
                    <span style={{ fontWeight: '700', color: '#6366F1' }}>{a.field === 'leverage' ? `1:${a.new_value}` : fmtUsd(a.new_value)}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>by {a.changed_by_name || 'Unknown'} · {fmtTime(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Adjust modal */}
      {showAdjust && account && (
        <div onClick={() => !saving && setShowAdjust(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '440px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>Adjust account</div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{account.email} · changes are audit-logged</div>
              </div>
              <button onClick={() => !saving && setShowAdjust(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {ADJUSTABLE.map(({ key, label, prefix }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{label}</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                      <span style={{ padding: '0 0 0 12px', color: '#9CA3AF', fontSize: '13px' }}>{prefix}</span>
                      <input
                        type="number"
                        value={form[key]}
                        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: '#111827', width: '100%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                <button onClick={() => setShowAdjust(false)} disabled={saving} style={{ flex: 1, padding: '11px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                <button onClick={saveAdjust} disabled={saving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: "'Inter', sans-serif" }}>{saving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
