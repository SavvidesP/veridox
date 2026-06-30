import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { tradescope } from '../lib/tradescope';

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

function formatMoney(v) {
  return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TradingAccounts() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: accs } = await tradescope
      .from('trader_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: trs } = await tradescope
      .from('trades')
      .select('*')
      .order('opened_at', { ascending: false });
    setAccounts(accs || []);
    setTrades(trs || []);
    setLoading(false);
  }

  function exportCSV() {
    const headers = ['Email', 'Name', 'Balance', 'Equity', 'Leverage', 'Open Trades', 'Closed Trades', 'Total P&L', 'Created'];
    const rows = accounts.map(a => {
      const accountTrades = trades.filter(t => t.trader_id === a.id);
      const openTrades = accountTrades.filter(t => t.status === 'open');
      const closedTrades = accountTrades.filter(t => t.status === 'closed');
      const totalPnL = closedTrades.reduce((s, t) => s + (t.profit || 0), 0);
      return [
        a.email, a.name || '', (a.balance || 0).toFixed(2), (a.equity || 0).toFixed(2),
        `1:${a.leverage || 100}`, openTrades.length, closedTrades.length,
        totalPnL.toFixed(2), a.created_at ? new Date(a.created_at).toLocaleDateString() : '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'trading_accounts.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', color: '#D1D5DB', fontSize: '13px' }}>
      Loading…
    </div>
  );

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const openCount = trades.filter(t => t.status === 'open').length;
  const closedCount = trades.filter(t => t.status === 'closed').length;

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Trading Accounts</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>{accounts.length} trader account{accounts.length === 1 ? '' : 's'}</p>
        </div>
        <button
          onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', color: '#374151', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}
        >
          <Download size={14} /> Export .csv
        </button>
      </div>

      {/* Stats */}
      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Total Accounts', value: accounts.length },
          { label: 'Total Balance', value: formatMoney(totalBalance) },
          { label: 'Open Trades', value: openCount },
          { label: 'Closed Trades', value: closedCount },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: '6px', padding: '24px 28px', border: '1px solid #E5E7EB' }}>
            <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '14px' }}>{label}</div>
            <div style={{ color: '#111827', fontSize: '32px', fontWeight: '700', letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

      {/* Table */}
      {sectionLabel('Accounts')}
      <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Email', 'Balance', 'Equity', 'Leverage', 'Open', 'Closed', 'Total P&L', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>No trading accounts found.</td></tr>
            ) : accounts.map((a, idx) => {
              const accountTrades = trades.filter(t => t.trader_id === a.id);
              const openTrades = accountTrades.filter(t => t.status === 'open').length;
              const closedTrades = accountTrades.filter(t => t.status === 'closed').length;
              const totalPnL = accountTrades.filter(t => t.status === 'closed').reduce((s, t) => s + (t.profit || 0), 0);
              return (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/trading-accounts/${a.id}`)}
                  style={{ borderBottom: idx < accounts.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                >
                  <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontWeight: '500' }}>{a.email}</td>
                  <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontFamily: 'monospace' }}>{formatMoney(a.balance)}</td>
                  <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontFamily: 'monospace' }}>{formatMoney(a.equity)}</td>
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>1:{a.leverage || 100}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: 'transparent', color: '#2563EB', border: '1px solid #BFDBFE', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{openTrades}</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>{closedTrades}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: totalPnL >= 0 ? '#16A34A' : '#DC2626' }}>
                    {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL).replace('$', '$')}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#9CA3AF', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
