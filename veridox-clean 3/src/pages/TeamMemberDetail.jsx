import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LineChart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tradescope } from '../lib/tradescope';
import { useAuth } from '../contexts/AuthContext';

function fmtUsd(v) {
  return `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const roleStyle = {
  admin: { background: '#EEF2FF', color: '#4338CA' },
  agent: { background: '#F0FDF4', color: '#15803D' },
};

const sectionLabel = (text) => (
  <div style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>{text}</div>
);

export default function TeamMemberDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [member, setMember] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !isAdmin) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      const { data: asg } = await supabase.from('account_assignments').select('*').eq('agent_id', id).order('created_at', { ascending: false });
      const ids = (asg || []).map(a => a.trader_account_id);
      let accs = [];
      if (ids.length) {
        const { data } = await tradescope.from('trader_accounts').select('*').in('id', ids);
        // keep assignment order
        accs = ids.map(tid => (data || []).find(a => a.id === tid)).filter(Boolean);
      }
      if (!active) return;
      setMember(m);
      setAccounts(accs);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id, isAdmin]);

  if (!isAdmin) return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <p style={{ color: '#9CA3AF', fontSize: '13px' }}>This area is available to admins only.</p>
    </div>
  );

  const initials = (member?.full_name || member?.email || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <button onClick={() => navigate('/settings')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: "'Inter', sans-serif", padding: 0 }}>
        <ArrowLeft size={15} /> Back to Team
      </button>

      {loading ? (
        <div style={{ color: '#D1D5DB', fontSize: '13px', padding: '24px 0' }}>Loading…</div>
      ) : !member ? (
        <div style={{ color: '#9CA3AF', fontSize: '13px', padding: '24px 0' }}>Member not found.</div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <div style={{ width: '52px', height: '52px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '17px', fontWeight: '700', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1 }}>
              <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>{member.full_name || '—'}</h1>
              <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '4px 0 0' }}>{member.email}{member.username ? ` · @${member.username}` : ''}</p>
            </div>
            <span style={{ ...(roleStyle[member.role] || roleStyle.agent), padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize' }}>{member.role}</span>
          </div>

          {/* Stats */}
          {sectionLabel('Assigned Accounts')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '32px' }}>
            {[
              { label: 'Accounts Assigned', value: accounts.length },
              { label: 'Balance Under Mgmt', value: fmtUsd(totalBalance) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', borderRadius: '6px', padding: '20px 22px', border: '1px solid #E5E7EB' }}>
                <div style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: '600', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '12px' }}>{label}</div>
                <div style={{ color: '#111827', fontSize: '26px', fontWeight: '700', letterSpacing: '-0.8px', lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #F3F4F6', margin: '28px 0' }} />

          {/* Assigned trading accounts list */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <LineChart size={16} color="#6366F1" />
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>Trading Accounts</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>· assigned to {member.full_name || 'this member'}</span>
          </div>

          <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'auto' }}>
            {accounts.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No trading accounts assigned to this member yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['Account', 'Balance', 'Equity', 'Leverage'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.6px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a, idx) => (
                    <tr key={a.id} onClick={() => navigate(`/trading-accounts/${a.id}`)}
                      style={{ borderBottom: idx < accounts.length - 1 ? '1px solid #F3F4F6' : 'none', background: '#fff', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                      <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontWeight: '500' }}>{a.email}</td>
                      <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontFamily: 'monospace' }}>{fmtUsd(a.balance)}</td>
                      <td style={{ padding: '14px 16px', color: '#111827', fontSize: '13px', fontFamily: 'monospace' }}>{fmtUsd(a.equity)}</td>
                      <td style={{ padding: '14px 16px', color: '#6B7280', fontSize: '13px' }}>1:{a.leverage || 100}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
