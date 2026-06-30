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

// Real adjustable columns on TradeScope trader_accounts.
// equity & free_margin are DERIVED (auto-calculated from balance/margin) so the account stays internally consistent.
const ADJUSTABLE = [
  { key: 'balance', label: 'Balance', prefix: '$' },
  { key: 'equity', label: 'Equity', prefix: '$', derived: true },
  { key: 'margin', label: 'Margin', prefix: '$' },
  { key: 'free_margin', label: 'Free Margin', prefix: '$', derived: true },
  { key: 'leverage', label: 'Leverage', prefix: '1:' },
];

// Standard forex account math.
const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const round2 = (n) => Math.round(n * 100) / 100;
// Equity = Balance + floating P&L (of open positions); Free Margin = Equity − Used Margin.
const deriveEquity = (balance, floatPnL) => round2(toNum(balance) + toNum(floatPnL));
const deriveFreeMargin = (equity, margin) => round2(toNum(equity) - toNum(margin));
// Margin Level % = Equity / Used Margin × 100 (null when no margin is used).
const calcMarginLevel = (equity, margin) => { const m = toNum(margin); return m > 0 ? round2((toNum(equity) / m) * 100) : null; };
const fmtMarginLevel = (ml) => (ml == null ? '—' : `${ml.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);

const fieldLabel = (k) => (ADJUSTABLE.find(f => f.key === k)?.label || k);

// Editable columns on a single TradeScope trade
const TRADE_FIELDS = [
  { key: 'type', label: 'Type', input: 'select', options: ['buy', 'sell'] },
  { key: 'status', label: 'Status', input: 'select', options: ['open', 'closed'] },
  { key: 'lot_size', label: 'Lot Size', input: 'number', step: '0.01' },
  { key: 'leverage', label: 'Leverage (1:N)', input: 'number', step: '1' },
  { key: 'open_price', label: 'Open Price', input: 'number', step: 'any' },
  { key: 'close_price', label: 'Close Price', input: 'number', step: 'any', nullable: true },
  { key: 'stop_loss', label: 'Stop Loss', input: 'number', step: 'any', nullable: true },
  { key: 'take_profit', label: 'Take Profit', input: 'number', step: 'any', nullable: true },
  { key: 'profit', label: 'Profit ($)', input: 'number', step: 'any', nullable: true },
  { key: 'opened_at', label: 'Opened At', input: 'datetime' },
  { key: 'closed_at', label: 'Closed At', input: 'datetime', nullable: true },
];
// Account-level fields editable from the same modal (write to trader_accounts)
const TRADE_ACCOUNT_FIELDS = [
  { key: 'balance', label: 'Balance', input: 'number', step: 'any' },
  { key: 'equity', label: 'Equity', input: 'number', step: 'any', derived: true },
  { key: 'margin', label: 'Margin', input: 'number', step: 'any' },
  { key: 'free_margin', label: 'Free Margin', input: 'number', step: 'any', derived: true },
];

// ISO ⇄ <input type="datetime-local"> helpers (local-time display, ISO storage)
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(val) {
  if (!val) return null;
  const d = new Date(val); return isNaN(d) ? null : d.toISOString();
}
function normalizeField(field, raw) {
  if (field.input === 'datetime') return fromLocalInput(raw);
  if (field.input === 'select') return raw;
  if (raw === '' || raw == null) return field.nullable ? null : 0;
  const n = Number(raw); return isNaN(n) ? null : n;
}
function sameValue(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
// Stored audit text → proper typed value for re-applying on revert
function parseStored(scope, field, text) {
  if (text == null) return null;
  const f = (scope === 'trade' ? TRADE_FIELDS : TRADE_ACCOUNT_FIELDS).find(x => x.key === field);
  if (!f || f.input === 'datetime' || f.input === 'select') return text;
  const n = Number(text); return isNaN(n) ? text : n;
}

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
  const [editTrade, setEditTrade] = useState(null);
  const [tradeForm, setTradeForm] = useState({});
  const [tradeSaving, setTradeSaving] = useState(false);
  const [tradeHasOriginal, setTradeHasOriginal] = useState(false);
  const [tradeChecking, setTradeChecking] = useState(false);
  const [floatPnL, setFloatPnL] = useState(0); // open-positions' floating P&L = equity − balance (captured when a modal opens)
  const [linkBase, setLinkBase] = useState({ balance: 0, profit: 0 }); // captured at trade-modal open for the bidirectional Balance ↔ trade-profit link

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
    setFloatPnL(round2(toNum(account?.equity) - toNum(account?.balance)));
    setShowAdjust(true);
  }

  // Adjust-account modal: editing Balance (or Margin) auto-recomputes Equity, Free Margin & Margin Level.
  function setAdjustField(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      if (key === 'balance') next.equity = deriveEquity(value, floatPnL);
      if (key === 'balance' || key === 'margin' || key === 'equity') {
        next.free_margin = deriveFreeMargin(next.equity, next.margin);
      }
      return next;
    });
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

  async function openEditTrade(tr) {
    const f = {};
    TRADE_FIELDS.forEach(fl => { f[fl.key] = fl.input === 'datetime' ? toLocalInput(tr[fl.key]) : (tr[fl.key] ?? ''); });
    TRADE_ACCOUNT_FIELDS.forEach(fl => { f['acct_' + fl.key] = account?.[fl.key] ?? 0; });
    setTradeForm(f);
    setFloatPnL(round2(toNum(account?.equity) - toNum(account?.balance)));
    setLinkBase({ balance: toNum(account?.balance), profit: toNum(tr.profit) });
    setEditTrade(tr);
    // Can we revert? Only if this trade already has recorded adjustments (original captured).
    // Reset + flag while checking so Revert stays disabled until we actually know (no stale
    // "enabled" state from a previously-opened trade, and no early-click no-op).
    setTradeHasOriginal(false);
    setTradeChecking(true);
    const { data } = await supabase.from('trade_adjustments').select('id').eq('trade_id', tr.id).limit(1);
    setTradeHasOriginal(!!(data && data.length));
    setTradeChecking(false);
  }

  // Per-trade modal account section: editing Balance (or Margin) auto-recomputes Equity, Free Margin & Margin Level.
  function setTradeAcctField(key, value) {
    setTradeForm(prev => {
      const next = { ...prev, ['acct_' + key]: value };
      if (key === 'balance') {
        next.acct_equity = deriveEquity(value, floatPnL);
        // Bidirectional link: balance change flows into this trade's profit by the same delta.
        next.profit = round2(linkBase.profit + (toNum(value) - linkBase.balance));
      }
      if (key === 'balance' || key === 'margin' || key === 'equity') {
        next.acct_free_margin = deriveFreeMargin(next.acct_equity, next.acct_margin);
      }
      return next;
    });
  }
  // Setting a Closed-At time means the position is closed → flip status to 'closed' automatically,
  // so on Save the trade closes exactly at the entered time (and counts toward realized Total P&L).
  function setTradeClosedAt(value) {
    setTradeForm(prev => ({ ...prev, closed_at: value, ...(value ? { status: 'closed' } : {}) }));
  }
  // Bidirectional link (other direction): editing this trade's profit flows into the account balance/equity.
  function setTradeProfit(value) {
    setTradeForm(prev => {
      const newBalance = round2(linkBase.balance + (toNum(value) - linkBase.profit));
      const equity = deriveEquity(newBalance, floatPnL);
      return { ...prev, profit: value, acct_balance: newBalance, acct_equity: equity, acct_free_margin: deriveFreeMargin(equity, prev.acct_margin) };
    });
  }

  async function saveTradeEdit() {
    if (!editTrade) return;
    setTradeSaving(true);
    const tradeUpdates = {}, acctUpdates = {}, audit = [];
    TRADE_FIELDS.forEach(fl => {
      if (fl.input === 'datetime') {
        // Compare at the input's minute granularity so an UNTOUCHED timestamp isn't
        // rewritten (which would strip seconds and log a spurious change).
        const origStr = toLocalInput(editTrade[fl.key]);
        const curStr = tradeForm[fl.key] || '';
        if (curStr === origStr) return;
        const nv = fromLocalInput(curStr);
        const ov = editTrade[fl.key] ? new Date(editTrade[fl.key]).toISOString() : null;
        tradeUpdates[fl.key] = nv;
        audit.push({ scope: 'trade', field: fl.key, old_value: ov == null ? null : String(ov), new_value: nv == null ? null : String(nv) });
        return;
      }
      const nv = normalizeField(fl, tradeForm[fl.key]);
      const ov = editTrade[fl.key] ?? null;
      if (!sameValue(nv, ov)) { tradeUpdates[fl.key] = nv; audit.push({ scope: 'trade', field: fl.key, old_value: ov == null ? null : String(ov), new_value: nv == null ? null : String(nv) }); }
    });
    TRADE_ACCOUNT_FIELDS.forEach(fl => {
      const nv = normalizeField(fl, tradeForm['acct_' + fl.key]);
      const ov = account?.[fl.key] ?? 0;
      if (!sameValue(nv, ov)) { acctUpdates[fl.key] = nv; audit.push({ scope: 'account', field: fl.key, old_value: String(ov), new_value: nv == null ? null : String(nv) }); }
    });
    if (audit.length === 0) { setTradeSaving(false); setEditTrade(null); return; }
    // 1) Write through to the client's real TradeScope account
    if (Object.keys(tradeUpdates).length) {
      const { error } = await tradescope.from('trades').update(tradeUpdates).eq('id', editTrade.id);
      if (error) { setTradeSaving(false); alert('Could not update trade: ' + error.message); return; }
    }
    if (Object.keys(acctUpdates).length) {
      const { error } = await tradescope.from('trader_accounts').update(acctUpdates).eq('id', id);
      if (error) { setTradeSaving(false); alert('Could not update account: ' + error.message); return; }
    }
    // 2) Audit log to Veridox (graceful if the table isn't set up yet — the change still applies)
    await supabase.from('trade_adjustments').insert(audit.map(a => ({
      trade_id: editTrade.id, trader_account_id: id, scope: a.scope, field: a.field,
      old_value: a.old_value, new_value: a.new_value,
      changed_by: user?.id || null, changed_by_name: profile?.full_name || user?.email || 'Unknown',
    })));
    // 3) Optimistic UI (realtime + 8s poll will reconcile)
    setTrades(prev => prev.map(t => t.id === editTrade.id ? { ...t, ...tradeUpdates } : t));
    if (Object.keys(acctUpdates).length) setAccount(prev => ({ ...prev, ...acctUpdates }));
    setTradeSaving(false); setEditTrade(null);
  }

  async function revertTrade() {
    if (!editTrade) return;
    if (!window.confirm('Revert this trade (and any related account changes) to their original values?')) return;
    setTradeSaving(true);
    const { data, error } = await supabase.from('trade_adjustments').select('*').eq('trade_id', editTrade.id).order('created_at', { ascending: true });
    if (error || !data || !data.length) { setTradeSaving(false); alert('No recorded changes to revert.'); return; }
    // Original value = earliest recorded old_value per (scope, field)
    const orig = {};
    data.forEach(r => { const k = r.scope + ':' + r.field; if (!(k in orig)) orig[k] = r; });
    const tradeUpdates = {}, acctUpdates = {}, log = [];
    Object.values(orig).forEach(r => {
      const val = parseStored(r.scope, r.field, r.old_value);
      const cur = r.scope === 'trade' ? editTrade[r.field] : account?.[r.field];
      if (r.scope === 'trade') tradeUpdates[r.field] = val; else acctUpdates[r.field] = val;
      log.push({ trade_id: editTrade.id, trader_account_id: id, scope: r.scope, field: r.field, old_value: cur == null ? null : String(cur), new_value: r.old_value, changed_by: user?.id || null, changed_by_name: (profile?.full_name || user?.email || 'Unknown') + ' · revert' });
    });
    if (Object.keys(tradeUpdates).length) { const { error: e1 } = await tradescope.from('trades').update(tradeUpdates).eq('id', editTrade.id); if (e1) { setTradeSaving(false); alert('Revert failed (trade): ' + e1.message); return; } }
    if (Object.keys(acctUpdates).length) { const { error: e2 } = await tradescope.from('trader_accounts').update(acctUpdates).eq('id', id); if (e2) { setTradeSaving(false); alert('Revert failed (account): ' + e2.message); return; } }
    await supabase.from('trade_adjustments').insert(log);
    setTrades(prev => prev.map(t => t.id === editTrade.id ? { ...t, ...tradeUpdates } : t));
    if (Object.keys(acctUpdates).length) setAccount(prev => ({ ...prev, ...acctUpdates }));
    setTradeSaving(false); setEditTrade(null);
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
              { label: 'Margin Level', value: fmtMarginLevel(calcMarginLevel(account.equity, account.margin)), color: (() => { const ml = calcMarginLevel(account.equity, account.margin); return ml == null ? undefined : ml < 50 ? '#DC2626' : ml < 100 ? '#D97706' : '#16A34A'; })() },
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
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#6366F1', border: '1px solid #C7D2FE', borderRadius: '4px', padding: '1px 6px' }}>1:{tr.leverage || 100}</span>
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
                  <button onClick={() => openEditTrade(tr)} title="Edit / adjust this trade" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#6366F1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                    <SlidersHorizontal size={12} /> Edit
                  </button>
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
                {ADJUSTABLE.map(({ key, label, prefix, derived }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{label}{derived ? ' · auto' : ''}</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', background: derived ? '#F9FAFB' : '#fff' }}>
                      <span style={{ padding: '0 0 0 12px', color: '#9CA3AF', fontSize: '13px' }}>{prefix}</span>
                      <input
                        type="number"
                        value={form[key]}
                        readOnly={derived}
                        onChange={derived ? undefined : (e => setAdjustField(key, e.target.value))}
                        style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: derived ? '#6B7280' : '#111827', width: '100%', background: 'transparent', cursor: derived ? 'not-allowed' : 'text' }}
                      />
                    </div>
                  </div>
                ))}
                {(() => { const ml = calcMarginLevel(form.equity, form.margin); const c = ml == null ? '#6B7280' : ml < 50 ? '#DC2626' : ml < 100 ? '#D97706' : '#16A34A'; return (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Margin Level · auto</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F9FAFB', padding: '10px 12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: c }}>{fmtMarginLevel(ml)}</span>
                    </div>
                  </div>
                ); })()}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                <button onClick={() => setShowAdjust(false)} disabled={saving} style={{ flex: 1, padding: '11px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                <button onClick={saveAdjust} disabled={saving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: "'Inter', sans-serif" }}>{saving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit-trade modal */}
      {editTrade && (
        <div onClick={() => !tradeSaving && setEditTrade(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>Edit trade · {editTrade.symbol}</div>
                <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>Writes through to the client's TradeScope account · audit-logged</div>
              </div>
              <button onClick={() => !tradeSaving && setEditTrade(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>Trade</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {TRADE_FIELDS.map(fl => (
                  <div key={fl.key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{fl.label}</label>
                    {fl.input === 'select' ? (
                      <select value={tradeForm[fl.key] ?? ''} onChange={e => setTradeForm(p => ({ ...p, [fl.key]: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', outline: 'none', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: '#111827', background: '#fff' }}>
                        {fl.options.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={fl.input === 'datetime' ? 'datetime-local' : 'number'} step={fl.step} value={tradeForm[fl.key] ?? ''} onChange={fl.key === 'profit' ? (e => setTradeProfit(e.target.value)) : fl.key === 'closed_at' ? (e => setTradeClosedAt(e.target.value)) : (e => setTradeForm(p => ({ ...p, [fl.key]: e.target.value })))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', outline: 'none', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: fl.key === 'profit' && toNum(tradeForm.profit) < 0 ? '#DC2626' : '#111827', fontWeight: fl.key === 'profit' ? '700' : '400' }} />
                    )}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '22px 0 12px' }}>Account · applies to the whole account</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {TRADE_ACCOUNT_FIELDS.map(fl => (
                  <div key={fl.key}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>{fl.label}{fl.derived ? ' · auto' : ''}</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', background: fl.derived ? '#F9FAFB' : '#fff' }}>
                      <span style={{ padding: '0 0 0 12px', color: '#9CA3AF', fontSize: '13px' }}>$</span>
                      <input type="number" step={fl.step} value={tradeForm['acct_' + fl.key] ?? ''} readOnly={fl.derived} onChange={fl.derived ? undefined : (e => setTradeAcctField(fl.key, e.target.value))} style={{ flex: 1, width: '100%', padding: '10px 12px', border: 'none', outline: 'none', fontSize: '14px', fontFamily: "'Inter', sans-serif", color: fl.derived ? '#6B7280' : '#111827', background: 'transparent', cursor: fl.derived ? 'not-allowed' : 'text' }} />
                    </div>
                  </div>
                ))}
                {(() => { const ml = calcMarginLevel(tradeForm.acct_equity, tradeForm.acct_margin); const c = ml == null ? '#6B7280' : ml < 50 ? '#DC2626' : ml < 100 ? '#D97706' : '#16A34A'; return (
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Margin Level · auto</label>
                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#F9FAFB', padding: '10px 12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: c }}>{fmtMarginLevel(ml)}</span>
                    </div>
                  </div>
                ); })()}
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                <button onClick={() => setEditTrade(null)} disabled={tradeSaving} style={{ flex: '0 0 auto', padding: '11px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                <button onClick={revertTrade} disabled={tradeSaving || tradeChecking || !tradeHasOriginal} title={tradeChecking ? 'Checking history…' : tradeHasOriginal ? 'Restore this trade to its original values' : 'No recorded changes yet'} style={{ flex: '0 0 auto', padding: '11px 16px', background: '#fff', border: `1px solid ${tradeHasOriginal && !tradeChecking ? '#FCA5A5' : '#F3F4F6'}`, borderRadius: '8px', color: tradeHasOriginal && !tradeChecking ? '#DC2626' : '#D1D5DB', fontSize: '13px', fontWeight: '600', cursor: (tradeHasOriginal && !tradeChecking) ? 'pointer' : 'not-allowed', fontFamily: "'Inter', sans-serif" }}>{tradeChecking ? 'Checking…' : 'Revert to original'}</button>
                <button onClick={saveTradeEdit} disabled={tradeSaving} style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: tradeSaving ? 'not-allowed' : 'pointer', opacity: tradeSaving ? 0.7 : 1, fontFamily: "'Inter', sans-serif" }}>{tradeSaving ? 'Saving…' : 'Save changes'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
