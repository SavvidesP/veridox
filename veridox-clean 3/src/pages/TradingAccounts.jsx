import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, TrendingUp, TrendingDown, DollarSign, Activity, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const TS_URL = 'https://atqucerzdqzchdgylmfo.supabase.co';
const TS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0cXVjZXJ6ZHF6Y2hkZ3lsbWZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjM5MzMyNiwiZXhwIjoyMDk3OTY5MzI2fQ.JAdc5f9FRkMcamUcwDbp1phY16WYiJSpGrmZgCHkpUc';

async function tsGet(path) {
  const res = await fetch(`${TS_URL}/rest/v1/${path}`, {
    headers: { apikey: TS_KEY, Authorization: `Bearer ${TS_KEY}`, 'Content-Type': 'application/json' },
  });
  return res.json();
}
async function tsPatch(path, body) {
  const res = await fetch(`${TS_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: TS_KEY, Authorization: `Bearer ${TS_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function fmt(n, d = 2) { return n != null ? Number(n).toFixed(d) : '0.00'; }
function fmtP(n) { const v = Number(n || 0); return (v >= 0 ? '+' : '') + '$' + Math.abs(v).toFixed(2); }

const statusStyle = (s) => ({
  active:    { background: '#DCFCE7', color: '#166534' },
  inactive:  { background: '#FEE2E2', color: '#991B1B' },
  suspended: { background: '#FEF9C3', color: '#854D0E' },
}[s] || { background: '#F1F5F9', color: '#475569' });

function formatAmount(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── TradeScope Trader Row ──
function TraderRow({ trader, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [positions, setPositions] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [balanceModal, setBalanceModal] = useState(false);
  const [leverageModal, setLeverageModal] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceType, setBalanceType] = useState('add');
  const [newLeverage, setNewLeverage] = useState(trader.leverage || 100);
  const [saving, setSaving] = useState(false);

  const pnl = positions.reduce((s, p) => {
    const cur = trader.equity - trader.balance;
    return s + (p.profit || 0);
  }, 0);

  async function loadData() {
    setLoadingData(true);
    const [pos, hist] = await Promise.all([
      tsGet(`trades?trader_id=eq.${trader.id}&status=eq.open&order=opened_at.desc`),
      tsGet(`trades?trader_id=eq.${trader.id}&status=eq.closed&order=closed_at.desc&limit=20`),
    ]);
    setPositions(Array.isArray(pos) ? pos : []);
    setHistory(Array.isArray(hist) ? hist : []);
    setLoadingData(false);
  }

  function toggle() {
    if (!expanded) loadData();
    setExpanded(v => !v);
  }

  async function closePosition(tradeId) {
    if (!window.confirm('Close this position?')) return;
    await tsPatch(`trades?id=eq.${tradeId}`, {
      status: 'closed',
      closed_at: new Date().toISOString(),
      profit: 0,
    });
    loadData();
    onRefresh();
  }

  async function adjustBalance() {
    const amt = parseFloat(balanceAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const delta = balanceType === 'add' ? amt : -amt;
    const newBalance = Math.max(0, trader.balance + delta);
    await tsPatch(`trader_accounts?id=eq.${trader.id}`, {
      balance: newBalance,
      equity: newBalance,
      free_margin: newBalance,
    });
    setBalanceModal(false);
    setBalanceAmount('');
    setSaving(false);
    onRefresh();
  }

  async function updateLeverage() {
    setSaving(true);
    await tsPatch(`trader_accounts?id=eq.${trader.id}`, { leverage: parseInt(newLeverage) });
    setLeverageModal(false);
    setSaving(false);
    onRefresh();
  }

  const livePnL = trader.equity - trader.balance;

  return (
    <>
      <tr
        onClick={toggle}
        style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer', background: expanded ? '#F8FAFF' : 'white' }}
        onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = '#F8FAFC'; }}
        onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'white'; }}
      >
        {/* Expand icon */}
        <td style={{ padding: '12px 8px 12px 16px', width: '20px' }}>
          {expanded ? <ChevronUp size={14} color="#6366F1" /> : <ChevronDown size={14} color="#94A3B8" />}
        </td>
        {/* Email */}
        <td style={{ padding: '12px 8px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{trader.email}</div>
          <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '1px' }}>{trader.id?.slice(0, 8)}…</div>
        </td>
        {/* Balance */}
        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>${fmt(trader.balance)}</span>
        </td>
        {/* Equity */}
        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
          <span style={{ fontSize: '13px', color: '#0F172A' }}>${fmt(trader.equity)}</span>
        </td>
        {/* Margin */}
        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
          <span style={{ fontSize: '13px', color: '#475569' }}>${fmt(trader.margin)}</span>
        </td>
        {/* Free Margin */}
        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
          <span style={{ fontSize: '13px', color: '#475569' }}>${fmt(trader.free_margin)}</span>
        </td>
        {/* P&L */}
        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: livePnL >= 0 ? '#16A34A' : '#DC2626' }}>
            {fmtP(livePnL)}
          </span>
        </td>
        {/* Leverage */}
        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: '#475569' }}>1:{trader.leverage}</span>
        </td>
        {/* Currency */}
        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
          <span style={{ fontSize: '11px', background: '#EEF2FF', color: '#4338CA', padding: '2px 7px', borderRadius: '5px', fontWeight: '600' }}>{trader.currency || 'USD'}</span>
        </td>
        {/* Actions */}
        <td style={{ padding: '12px 16px 12px 8px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button onClick={() => { setBalanceModal(true); }} title="Adjust Balance"
              style={{ padding: '4px 8px', border: '1px solid #BBF7D0', borderRadius: '5px', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#16A34A', whiteSpace: 'nowrap' }}>
              + / −
            </button>
            <button onClick={() => { setNewLeverage(trader.leverage || 100); setLeverageModal(true); }} title="Change Leverage"
              style={{ padding: '4px 8px', border: '1px solid #BFDBFE', borderRadius: '5px', background: 'transparent', cursor: 'pointer', fontSize: '11px', fontWeight: '600', color: '#2563EB', whiteSpace: 'nowrap' }}>
              Leverage
            </button>
            <a href="https://tradescope.net" target="_blank" rel="noreferrer" title="Open TradeScope"
              style={{ padding: '4px 7px', border: '1px solid #E2E8F0', borderRadius: '5px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
              <ExternalLink size={12} color="#6366F1" />
            </a>
          </div>
        </td>
      </tr>

      {/* ── Expanded Panel ── */}
      {expanded && (
        <tr>
          <td colSpan={10} style={{ padding: 0, background: '#F8FAFF', borderTop: '1px solid #E8EDFF', borderBottom: '1px solid #E8EDFF' }}>
            <div style={{ padding: '16px 24px 20px' }}>

              {/* Account summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Balance',     value: `$${fmt(trader.balance)}`,     color: '#0F172A' },
                  { label: 'Equity',      value: `$${fmt(trader.equity)}`,      color: '#0F172A' },
                  { label: 'Margin',      value: `$${fmt(trader.margin)}`,      color: '#475569' },
                  { label: 'Free Margin', value: `$${fmt(trader.free_margin)}`, color: '#475569' },
                  { label: 'Open P&L',   value: fmtP(livePnL),                 color: livePnL >= 0 ? '#16A34A' : '#DC2626' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'white', borderRadius: '8px', border: '1px solid #E8EDFF', padding: '12px 14px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color, fontFamily: 'monospace' }}>{value}</div>
                  </div>
                ))}
              </div>

              {loadingData ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8', fontSize: '13px' }}>Loading positions…</div>
              ) : (
                <>
                  {/* Open Positions */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>
                      Open Positions ({positions.length})
                    </div>
                    {positions.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94A3B8', padding: '10px 0' }}>No open positions</div>
                    ) : (
                      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #E8EDFF', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EDFF' }}>
                              {['Symbol','Type','Lots','Open Price','Current','P&L','SL','TP',''].map(h => (
                                <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {positions.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0F172A' }}>{p.symbol}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{ color: p.type === 'buy' ? '#16A34A' : '#DC2626', fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', background: p.type === 'buy' ? '#DCFCE7' : '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>{p.type}</span>
                                </td>
                                <td style={{ padding: '8px 12px', color: '#475569' }}>{p.lot_size}</td>
                                <td style={{ padding: '8px 12px', color: '#475569', fontFamily: 'monospace' }}>{Number(p.open_price).toFixed(5)}</td>
                                <td style={{ padding: '8px 12px', color: '#0F172A', fontFamily: 'monospace' }}>—</td>
                                <td style={{ padding: '8px 12px', fontWeight: '700', color: (p.profit || 0) >= 0 ? '#16A34A' : '#DC2626' }}>{fmtP(p.profit || 0)}</td>
                                <td style={{ padding: '8px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>{p.stop_loss ? Number(p.stop_loss).toFixed(5) : '—'}</td>
                                <td style={{ padding: '8px 12px', color: '#94A3B8', fontFamily: 'monospace', fontSize: '11px' }}>{p.take_profit ? Number(p.take_profit).toFixed(5) : '—'}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <button onClick={() => closePosition(p.id)}
                                    style={{ padding: '3px 8px', border: '1px solid #FECACA', borderRadius: '4px', background: '#FFF5F5', cursor: 'pointer', fontSize: '10px', fontWeight: '600', color: '#DC2626' }}>
                                    Close
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Trade History */}
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '8px' }}>
                      Trade History ({history.length})
                    </div>
                    {history.length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94A3B8', padding: '10px 0' }}>No trade history</div>
                    ) : (
                      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #E8EDFF', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E8EDFF' }}>
                              {['Symbol','Type','Lots','Open','Close','P&L','Closed At'].map(h => (
                                <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {history.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '7px 12px', fontWeight: '700', color: '#0F172A' }}>{p.symbol}</td>
                                <td style={{ padding: '7px 12px' }}>
                                  <span style={{ color: p.type === 'buy' ? '#16A34A' : '#DC2626', fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', background: p.type === 'buy' ? '#DCFCE7' : '#FEE2E2', padding: '2px 6px', borderRadius: '4px' }}>{p.type}</span>
                                </td>
                                <td style={{ padding: '7px 12px', color: '#475569' }}>{p.lot_size}</td>
                                <td style={{ padding: '7px 12px', color: '#475569', fontFamily: 'monospace' }}>{Number(p.open_price).toFixed(5)}</td>
                                <td style={{ padding: '7px 12px', color: '#475569', fontFamily: 'monospace' }}>{p.close_price ? Number(p.close_price).toFixed(5) : '—'}</td>
                                <td style={{ padding: '7px 12px', fontWeight: '700', color: (p.profit || 0) >= 0 ? '#16A34A' : '#DC2626' }}>{fmtP(p.profit || 0)}</td>
                                <td style={{ padding: '7px 12px', color: '#94A3B8', fontSize: '11px' }}>{p.closed_at ? new Date(p.closed_at).toLocaleString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}

      {/* Balance Modal */}
      {balanceModal && (
        <tr><td colSpan={10} style={{ padding: 0 }}>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '12px', width: '380px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>Adjust Balance</div>
                <button onClick={() => setBalanceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#94A3B8" /></button>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>Current Balance</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>${fmt(trader.balance)}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>Action</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['add','remove'].map(t => (
                      <button key={t} onClick={() => setBalanceType(t)} style={{ flex: 1, padding: '8px', border: `1px solid ${balanceType === t ? (t === 'add' ? '#BBF7D0' : '#FECACA') : '#E2E8F0'}`, borderRadius: '7px', background: balanceType === t ? (t === 'add' ? '#DCFCE7' : '#FEE2E2') : 'white', cursor: 'pointer', fontSize: '12px', fontWeight: '700', color: balanceType === t ? (t === 'add' ? '#16A34A' : '#DC2626') : '#475569', textTransform: 'capitalize' }}>
                        {t === 'add' ? '+ Add' : '− Remove'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>Amount (USD)</label>
                  <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)} placeholder="0.00" min="0"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '15px', fontWeight: '600', fontFamily: 'monospace', outline: 'none' }} />
                </div>
                {balanceAmount && (
                  <div style={{ background: '#F8FAFC', borderRadius: '7px', padding: '8px 12px', fontSize: '12px', color: '#475569' }}>
                    New balance: <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>
                      ${fmt(Math.max(0, trader.balance + (balanceType === 'add' ? 1 : -1) * (parseFloat(balanceAmount) || 0)))}
                    </strong>
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setBalanceModal(false)} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '7px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button onClick={adjustBalance} disabled={saving || !balanceAmount}
                  style={{ padding: '8px 20px', background: saving || !balanceAmount ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: '600', color: saving || !balanceAmount ? '#94A3B8' : 'white', cursor: saving || !balanceAmount ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </td></tr>
      )}

      {/* Leverage Modal */}
      {leverageModal && (
        <tr><td colSpan={10} style={{ padding: 0 }}>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'white', borderRadius: '12px', width: '340px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>Change Leverage</div>
                <button onClick={() => setLeverageModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} color="#94A3B8" /></button>
              </div>
              <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#F8FAFC', borderRadius: '8px', padding: '10px 14px' }}>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '2px' }}>Current Leverage</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A' }}>1:{trader.leverage}</div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '6px' }}>New Leverage</label>
                  <select value={newLeverage} onChange={e => setNewLeverage(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '14px', fontWeight: '600', outline: 'none', fontFamily: 'Inter, sans-serif' }}>
                    {[1,2,5,10,25,50,100,200,300,400,500].map(l => <option key={l} value={l}>1:{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ padding: '14px 22px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setLeverageModal(false)} style={{ padding: '8px 16px', border: '1px solid #E2E8F0', borderRadius: '7px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button onClick={updateLeverage} disabled={saving}
                  style={{ padding: '8px 20px', background: saving ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: '600', color: saving ? '#94A3B8' : 'white', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        </td></tr>
      )}
    </>
  );
}

// ── Main Component ──
export default function TradingAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [clients, setClients] = useState([]);
  const [traders, setTraders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tsLoading, setTsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const [tsSearch, setTsSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tradescope');

  const empty = {
    client_id: '', account_number: '', platform: 'MT4', account_type: 'standard',
    currency: 'USD', balance: '', equity: '', margin: '', free_margin: '',
    margin_level: '', leverage: 100, status: 'active',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); fetchTraders(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: acc }, { data: cli }] = await Promise.all([
      supabase.from('trading_accounts').select('*, client:client_id(first_name, last_name, email)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name, email').order('first_name'),
    ]);
    setAccounts(acc || []);
    setClients(cli || []);
    setLoading(false);
  }

  async function fetchTraders() {
    setTsLoading(true);
    try {
      const data = await tsGet('trader_accounts?order=email.asc');
      setTraders(Array.isArray(data) ? data : []);
    } catch {}
    setTsLoading(false);
  }

  async function save() {
    const payload = {
      ...form,
      balance: parseFloat(form.balance) || 0,
      equity: parseFloat(form.equity) || 0,
      margin: parseFloat(form.margin) || 0,
      free_margin: parseFloat(form.free_margin) || 0,
      margin_level: parseFloat(form.margin_level) || 0,
      leverage: parseInt(form.leverage) || 100,
      client_id: form.client_id || null,
      updated_at: new Date().toISOString(),
    };
    if (editItem) {
      await supabase.from('trading_accounts').update(payload).eq('id', editItem.id);
    } else {
      await supabase.from('trading_accounts').insert(payload);
    }
    setShowModal(false); setEditItem(null); setForm(empty);
    fetchAll();
  }

  async function remove(id) {
    if (!window.confirm('Delete this trading account?')) return;
    await supabase.from('trading_accounts').delete().eq('id', id);
    fetchAll();
  }

  const filtered = accounts.filter(a => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (filterPlatform !== 'all' && a.platform !== filterPlatform) return false;
    if (search && !a.account_number?.toLowerCase().includes(search.toLowerCase()) &&
      !a.client?.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !a.client?.last_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredTraders = traders.filter(t =>
    !tsSearch || t.email?.toLowerCase().includes(tsSearch.toLowerCase())
  );

  const totalBalance = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  const totalEquity  = accounts.reduce((s, a) => s + (parseFloat(a.equity) || 0), 0);
  const activeAcc    = accounts.filter(a => a.status === 'active').length;
  const tsTotalBal   = traders.reduce((s, t) => s + (parseFloat(t.balance) || 0), 0);

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Trading Accounts</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{traders.length} TradeScope traders · {accounts.length} manual accounts</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchTraders} title="Refresh TradeScope data"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '500', color: '#475569', cursor: 'pointer' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setShowModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
            <Plus size={14} /> Add Account
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'TradeScope Traders', value: traders.length,              icon: Activity,      color: '#6366F1', bg: '#EEF2FF' },
          { label: 'TS Total Balance',   value: `$${formatAmount(tsTotalBal)}`, icon: DollarSign,    color: '#059669', bg: '#ECFDF5' },
          { label: 'Manual Accounts',    value: accounts.length,             icon: TrendingUp,    color: '#0369A1', bg: '#E0F2FE' },
          { label: 'Manual Balance',     value: `$${formatAmount(totalBalance)}`, icon: DollarSign, color: '#7C3AED', bg: '#F5F3FF' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}>
                <Icon size={14} color={color} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: '20px', gap: '0' }}>
        {[
          { id: 'tradescope', label: `TradeScope Traders (${traders.length})` },
          { id: 'manual',     label: `Manual Accounts (${accounts.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ padding: '10px 20px', border: 'none', borderBottom: activeTab === t.id ? '2px solid #6366F1' : '2px solid transparent', background: 'none', fontSize: '13px', fontWeight: '600', color: activeTab === t.id ? '#6366F1' : '#94A3B8', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TRADESCOPE TAB ── */}
      {activeTab === 'tradescope' && (
        <>
          <div style={{ marginBottom: '14px' }}>
            <input value={tsSearch} onChange={e => setTsSearch(e.target.value)} placeholder="Search by email…"
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '240px', fontFamily: 'Inter, sans-serif' }} />
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ width: '20px', padding: '10px 8px 10px 16px' }} />
                  {['Email / ID','Balance','Equity','Margin','Free Margin','P&L','Leverage','Currency','Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 8px', textAlign: h === 'Email / ID' ? 'left' : 'right', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap', ...(h === 'Actions' ? { textAlign: 'left' } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tsLoading ? (
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading TradeScope traders…</td></tr>
                ) : filteredTraders.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No traders found.</td></tr>
                ) : filteredTraders.map(trader => (
                  <TraderRow key={trader.id} trader={trader} onRefresh={fetchTraders} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── MANUAL TAB ── */}
      {activeTab === 'manual' && (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search account, client…"
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', width: '220px', fontFamily: 'Inter, sans-serif' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
            <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All Platforms</option>
              <option value="MT4">MT4</option>
              <option value="MT5">MT5</option>
              <option value="cTrader">cTrader</option>
            </select>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Account No.','Client','Platform','Type','Balance','Equity','Margin','Leverage','Status',''].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No trading accounts yet.</td></tr>
                ) : filtered.map(a => (
                  <tr key={a.id} style={{ borderTop: '1px solid #F1F5F9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '700', fontFamily: 'monospace' }}>{a.account_number}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {a.client ? (
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A' }}>{a.client.first_name} {a.client.last_name}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>{a.client.email}</div>
                        </div>
                      ) : <span style={{ color: '#94A3B8', fontSize: '12px' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>{a.platform}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', textTransform: 'capitalize' }}>{a.account_type}</td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600', textAlign: 'right' }}>${formatAmount(a.balance)}</td>
                    <td style={{ padding: '12px 16px', color: '#0F172A', fontSize: '12px', textAlign: 'right' }}>${formatAmount(a.equity)}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', textAlign: 'right' }}>${formatAmount(a.margin)}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', textAlign: 'center' }}>1:{a.leverage}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ ...statusStyle(a.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{a.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setEditItem(a); setForm({ client_id: a.client_id || '', account_number: a.account_number, platform: a.platform, account_type: a.account_type, currency: a.currency, balance: a.balance, equity: a.equity, margin: a.margin, free_margin: a.free_margin, margin_level: a.margin_level, leverage: a.leverage, status: a.status }); setShowModal(true); }}
                          style={{ padding: '5px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Edit2 size={13} color="#64748B" />
                        </button>
                        <button onClick={() => remove(a.id)}
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
        </>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>{editItem ? 'Edit Trading Account' : 'Add Trading Account'}</div>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              <div>
                <label style={labelStyle}>Client</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={inputStyle}>
                  <option value="">No client assigned</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={labelStyle}>Account Number *</label><input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="e.g. 100001" style={inputStyle} /></div>
                <div><label style={labelStyle}>Platform</label><select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} style={inputStyle}><option>MT4</option><option>MT5</option><option>cTrader</option></select></div>
                <div><label style={labelStyle}>Account Type</label><select value={form.account_type} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))} style={inputStyle}><option value="standard">Standard</option><option value="pro">Pro</option><option value="vip">VIP</option><option value="demo">Demo</option><option value="islamic">Islamic</option></select></div>
                <div><label style={labelStyle}>Currency</label><select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={inputStyle}>{['USD','EUR','GBP','CHF','AUD','JPY'].map(c => <option key={c}>{c}</option>)}</select></div>
                <div><label style={labelStyle}>Balance</label><input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0.00" style={inputStyle} /></div>
                <div><label style={labelStyle}>Equity</label><input type="number" value={form.equity} onChange={e => setForm(f => ({ ...f, equity: e.target.value }))} placeholder="0.00" style={inputStyle} /></div>
                <div><label style={labelStyle}>Margin</label><input type="number" value={form.margin} onChange={e => setForm(f => ({ ...f, margin: e.target.value }))} placeholder="0.00" style={inputStyle} /></div>
                <div><label style={labelStyle}>Free Margin</label><input type="number" value={form.free_margin} onChange={e => setForm(f => ({ ...f, free_margin: e.target.value }))} placeholder="0.00" style={inputStyle} /></div>
                <div><label style={labelStyle}>Leverage</label><select value={form.leverage} onChange={e => setForm(f => ({ ...f, leverage: e.target.value }))} style={inputStyle}>{[1,2,5,10,25,50,100,200,300,400,500].map(l => <option key={l} value={l}>1:{l}</option>)}</select></div>
                <div><label style={labelStyle}>Status</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setEditItem(null); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={!form.account_number}
                style={{ padding: '9px 20px', background: !form.account_number ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.account_number ? '#94A3B8' : 'white', cursor: !form.account_number ? 'not-allowed' : 'pointer' }}>
                {editItem ? 'Save Changes' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
