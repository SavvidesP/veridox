import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

export default function TradingAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: accs } = await supabase
      .from('trader_accounts')
      .select('*')
      .order('created_at', { ascending: false });
    const { data: trs } = await supabase
      .from('trades')
      .select('*')
      .order('opened_at', { ascending: false });
    setAccounts(accs || []);
    setTrades(trs || []);
    setLoading(false);
  }

  function exportXLSX() {
    const rows = accounts.map(a => {
      const accountTrades = trades.filter(t => t.trader_id === a.id);
      const openTrades = accountTrades.filter(t => t.status === 'open');
      const closedTrades = accountTrades.filter(t => t.status === 'closed');
      const totalPnL = closedTrades.reduce((s, t) => s + (t.profit || 0), 0);
      return {
        'Email': a.email,
        'Name': a.name || '—',
        'Balance': a.balance?.toFixed(2),
        'Equity': a.equity?.toFixed(2),
        'Leverage': `1:${a.leverage || 100}`,
        'Open Trades': openTrades.length,
        'Closed Trades': closedTrades.length,
        'Total P&L': totalPnL.toFixed(2),
        'Created': a.created_at ? new Date(a.created_at).toLocaleDateString() : '—',
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Trading Accounts');
    XLSX.writeFile(wb, 'trading_accounts.xlsx');
  }

  const C = {
    bg: '#0f1117', panel: '#1a1d27', border: '#2a2e39',
    text: '#d1d4dc', muted: '#787b86', accent: '#6366F1',
    green: '#26a69a', red: '#ef5350',
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.muted, fontFamily: 'Inter,sans-serif' }}>
      Loading...
    </div>
  );

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter,sans-serif', color: C.text }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', color: C.text, margin: 0 }}>Trading Accounts</h1>
          <p style={{ fontSize: '13px', color: C.muted, margin: '4px 0 0' }}>{accounts.length} trader accounts</p>
        </div>
        <button
          onClick={exportXLSX}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: C.accent, border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter,sans-serif' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export .xlsx
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Accounts', value: accounts.length },
          { label: 'Total Balance', value: `$${accounts.reduce((s, a) => s + (a.balance || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Open Trades', value: trades.filter(t => t.status === 'open').length },
          { label: 'Closed Trades', value: trades.filter(t => t.status === 'closed').length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: C.panel, borderRadius: '10px', padding: '16px 20px', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: C.text }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: C.panel, borderRadius: '12px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Email', 'Balance', 'Equity', 'Leverage', 'Open', 'Closed', 'Total P&L', 'Created'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: C.muted, fontWeight: '600', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => {
              const accountTrades = trades.filter(t => t.trader_id === a.id);
              const openTrades = accountTrades.filter(t => t.status === 'open').length;
              const closedTrades = accountTrades.filter(t => t.status === 'closed').length;
              const totalPnL = accountTrades.filter(t => t.status === 'closed').reduce((s, t) => s + (t.profit || 0), 0);
              return (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '12px 16px', color: C.text, fontWeight: '500' }}>{a.email}</td>
                  <td style={{ padding: '12px 16px', color: C.text, fontFamily: 'monospace' }}>${(a.balance || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', color: C.text, fontFamily: 'monospace' }}>${(a.equity || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', color: C.muted }}>1:{a.leverage || 100}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: 'rgba(41,98,255,0.15)', color: '#2962ff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{openTrades}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: C.muted }}>{closedTrades}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '600', color: totalPnL >= 0 ? C.green : C.red }}>
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', color: C.muted, fontSize: '12px' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr><td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: C.muted }}>No trading accounts found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
