import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Activity as ActivityIcon } from 'lucide-react';
import { tradescope } from '../lib/tradescope';

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

export default function TradingAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

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
      await Promise.all([loadAccount(), loadTrades()]);
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

  const sectionLabel = (text) => (
    <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
  );

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <button onClick={() => navigate('/trading-accounts')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: "'Inter', sans-serif", padding: 0 }}>
        <ArrowLeft size={15} /> Back to Trading Accounts
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
        <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <ActivityIcon size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{account?.email || 'Trading Account'}</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>
            TradeScope account{account ? ` · ${openTrades.length} open · ${closedTrades.length} closed` : ''}
          </p>
        </div>
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
              { label: 'Leverage', value: `1:${account.leverage || 100}` },
              { label: 'Open Trades', value: openTrades.length },
              { label: 'Closed Trades', value: closedTrades.length },
              { label: 'Total P&L', value: `${totalPnL >= 0 ? '+' : ''}${fmtUsd(totalPnL)}`, color: totalPnL >= 0 ? '#16A34A' : '#DC2626' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: '#fff', borderRadius: '6px', padding: '20px 22px', border: '1px solid #E5E7EB' }}>
                <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '12px' }}>{label}</div>
                <div style={{ color: color || '#111827', fontSize: '26px', fontWeight: '700', letterSpacing: '-0.8px', lineHeight: 1 }}>{value}</div>
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

          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 20px' }}>
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
        </>
      )}
    </div>
  );
}
