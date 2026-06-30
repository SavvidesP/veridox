import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, UserPlus, X } from 'lucide-react';
import { tradescope } from '../lib/tradescope';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

function formatMoney(v) {
  return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function TradingAccounts() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [accounts, setAccounts] = useState([]);
  const [trades, setTrades] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: accs }, { data: trs }, { data: asg }] = await Promise.all([
      tradescope.from('trader_accounts').select('*').order('created_at', { ascending: false }),
      tradescope.from('trades').select('*').order('opened_at', { ascending: false }),
      supabase.from('account_assignments').select('*'),
    ]);
    setAccounts(accs || []);
    setTrades(trs || []);
    setAssignments(asg || []);
    setLoading(false);
  }

  const assignmentFor = (accId) => assignments.find(a => a.trader_account_id === accId);

  async function assignToMe(e, acc) {
    e.stopPropagation();
    const row = { trader_account_id: acc.id, trader_email: acc.email, agent_id: user.id, agent_name: profile?.full_name || user?.email };
    const { data } = await supabase.from('account_assignments').insert(row).select().single();
    if (data) setAssignments(prev => [...prev, data]);
  }

  async function release(e, acc) {
    e.stopPropagation();
    await supabase.from('account_assignments').delete().eq('trader_account_id', acc.id);
    setAssignments(prev => prev.filter(a => a.trader_account_id !== acc.id));
  }

  // Scoping: admin sees all; agent sees unassigned + own
  const visible = isAdmin ? accounts : accounts.filter(a => {
    const asg = assignmentFor(a.id);
    return !asg || asg.agent_id === user?.id;
  });

  function exportCSV() {
    const headers = ['Email', 'Balance', 'Equity', 'Leverage', 'Open', 'Closed', 'Total P&L', 'Assigned To', 'Created'];
    const rows = visible.map(a => {
      const accountTrades = trades.filter(t => t.trader_id === a.id);
      const closed = accountTrades.filter(t => t.status === 'closed');
      const totalPnL = closed.reduce((s, t) => s + (t.profit || 0), 0);
      return [a.email, (a.balance || 0).toFixed(2), (a.equity || 0).toFixed(2), `1:${a.leverage || 100}`,
        accountTrades.filter(t => t.status === 'open').length, closed.length, totalPnL.toFixed(2),
        assignmentFor(a.id)?.agent_name || '', a.created_at ? new Date(a.created_at).toLocaleDateString() : ''];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'trading_accounts.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh', color: '#D1D5DB', fontSize: '13px' }}>Loading…</div>
  );

  const totalBalance = visible.reduce((s, a) => s + (a.balance || 0), 0);
  const visibleIds = new Set(visible.map(a => a.id));
  const openCount = trades.filter(t => t.status === 'open' && visibleIds.has(t.trader_id)).length;
  const closedCount = trades.filter(t => t.status === 'closed' && visibleIds.has(t.trader_id)).length;

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '36px', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Trading Accounts</h1>
          <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0', fontWeight: '400' }}>
            {visible.length} account{visible.length === 1 ? '' : 's'}{!isAdmin && ' · your assigned + unassigned'}
          </p>
        </div>
        <button onClick={exportCSV}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', color: '#374151', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#9CA3AF'}
          onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
          <Download size={14} /> Export .csv
        </button>
      </div>

      {/* Stats */}
      {sectionLabel('Overview')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: isAdmin ? 'Total Accounts' : 'Your View', value: visible.length },
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
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
              {['Email', 'Balance', 'Equity', 'Leverage', 'Open', 'Closed', 'Total P&L', 'Assigned', 'Created'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#D1D5DB', fontSize: '13px' }}>No trading accounts to show.</td></tr>
            ) : visible.map((a, idx) => {
              const accountTrades = trades.filter(t => t.trader_id === a.id);
              const openTrades = accountTrades.filter(t => t.status === 'open').length;
              const closedTrades = accountTrades.filter(t => t.status === 'closed').length;
              const totalPnL = accountTrades.filter(t => t.status === 'closed').reduce((s, t) => s + (t.profit || 0), 0);
              const asg = assignmentFor(a.id);
              const mine = asg && asg.agent_id === user?.id;
              return (
                <tr key={a.id} onClick={() => navigate(`/trading-accounts/${a.id}`)}
                  style={{ borderBottom: idx < visible.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontWeight: '500' }}>{a.email}</td>
                  <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontFamily: 'monospace' }}>{formatMoney(a.balance)}</td>
                  <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontFamily: 'monospace' }}>{formatMoney(a.equity)}</td>
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>1:{a.leverage || 100}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: 'transparent', color: '#2563EB', border: '1px solid #BFDBFE', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{openTrades}</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>{closedTrades}</td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600', color: totalPnL >= 0 ? '#16A34A' : '#DC2626' }}>
                    {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL)}
                  </td>
                  {/* Assigned column */}
                  <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' }}>
                    {mine ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Yours</span>
                        <button onClick={e => release(e, a)} title="Release" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: '2px', display: 'flex' }}><X size={13} /></button>
                      </span>
                    ) : asg ? (
                      // assigned to someone else — only admins see these rows
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ background: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>{asg.agent_name || 'Assigned'}</span>
                        {isAdmin && <button onClick={e => release(e, a)} title="Unassign" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: '2px', display: 'flex' }}><X size={13} /></button>}
                      </span>
                    ) : (
                      <button onClick={e => assignToMe(e, a)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '5px', color: '#6366F1', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = '#6366F1'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#E5E7EB'}>
                        <UserPlus size={12} /> Assign to me
                      </button>
                    )}
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
