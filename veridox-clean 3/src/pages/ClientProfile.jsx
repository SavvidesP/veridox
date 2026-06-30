import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, Mail, Phone, Globe, Building, MapPin, ArrowLeftRight, ShieldAlert, User, CheckCircle, TrendingUp, TrendingDown, Activity as ActivityIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tradescope } from '../lib/tradescope';
import { useAuth } from '../contexts/AuthContext';

const statusConfig = {
  pending: { label: 'Pending', bg: '#F3F4F6', color: '#374151' },
  under_review: { label: 'Under Review', bg: '#FEF9C3', color: '#854D0E' },
  approved: { label: 'Approved', bg: '#DCFCE7', color: '#166534' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#991B1B' },
};

const txTypeStyle = (t) => t?.toLowerCase() === 'deposit'
  ? { background: '#EEF2FF', color: '#4338CA' }
  : { background: '#FFF7ED', color: '#C2410C' };

const txStatusStyle = (s) => {
  const v = s?.toLowerCase();
  if (v === 'success' || v === 'approved') return { background: '#DCFCE7', color: '#166534' };
  if (v === 'failed' || v === 'rejected') return { background: '#FEE2E2', color: '#991B1B' };
  return { background: '#FEF9C3', color: '#854D0E' };
};

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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

const tabs = ['Overview', 'Transactions', 'Disputes', 'Documents', 'Notes', 'Activity'];

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [tsAccount, setTsAccount] = useState(null);
  const [tsTrades, setTsTrades] = useState([]);
  const [tsLoading, setTsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('documents').select('*').eq('client_id', id).order('uploaded_at', { ascending: false }),
      supabase.from('notes').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('activities').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    ]).then(([c, d, n, a]) => {
      setClient(c.data);
      setDocuments(d.data || []);
      setNotes(n.data || []);
      setActivities(a.data || []);
      // Fetch transactions by account_no or name
      if (c.data) {
        const name = `${c.data.first_name} ${c.data.last_name}`;
        Promise.all([
          supabase.from('transactions').select('*')
            .or(`first_name.ilike.%${c.data.first_name}%,last_name.ilike.%${c.data.last_name}%`)
            .order('created_date', { ascending: false })
            .limit(20),
          supabase.from('disputes').select('*')
            .ilike('client_name', `%${c.data.first_name}%`)
            .order('created_at', { ascending: false }),
        ]).then(([t, disp]) => {
          setTransactions(t.data || []);
          setDisputes(disp.data || []);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });
  }, [id]);

  // ── Live TradeScope trading activity (cross-platform) ──
  useEffect(() => {
    if (!client?.id) return;
    let channel, poll, active = true;

    async function loadTrades(traderId) {
      const { data } = await tradescope.from('trades').select('*').eq('trader_id', traderId).order('opened_at', { ascending: false });
      if (active) setTsTrades(data || []);
    }
    async function refreshAccount(traderId) {
      const { data } = await tradescope.from('trader_accounts').select('*').eq('id', traderId).maybeSingle();
      if (active && data) setTsAccount(data);
    }

    async function resolveAndLoad() {
      setTsLoading(true);
      // 1) explicit link via sales_leads.tradescope_trader_id, else 2) match by email
      let account = null;
      const { data: lead } = await supabase
        .from('sales_leads')
        .select('tradescope_trader_id, tradescope_email')
        .eq('converted_client_id', client.id)
        .not('tradescope_trader_id', 'is', null)
        .maybeSingle();

      if (lead?.tradescope_trader_id) {
        const { data } = await tradescope.from('trader_accounts').select('*').eq('id', lead.tradescope_trader_id).maybeSingle();
        account = data;
      }
      if (!account && (lead?.tradescope_email || client.email)) {
        const { data } = await tradescope.from('trader_accounts').select('*').eq('email', lead?.tradescope_email || client.email).maybeSingle();
        account = data;
      }

      if (!active) return;
      if (!account) { setTsAccount(null); setTsTrades([]); setTsLoading(false); return; }
      setTsAccount(account);
      await loadTrades(account.id);
      setTsLoading(false);

      // Realtime push (new/closed trades + balance changes) with a polling fallback
      channel = tradescope
        .channel(`ts-trades-${account.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `trader_id=eq.${account.id}` }, () => { loadTrades(account.id); refreshAccount(account.id); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trader_accounts', filter: `id=eq.${account.id}` }, (p) => { if (active && p.new) setTsAccount(prev => ({ ...prev, ...p.new })); })
        .subscribe();
      poll = setInterval(() => { loadTrades(account.id); refreshAccount(account.id); }, 8000);
    }

    resolveAndLoad();
    return () => { active = false; if (channel) tradescope.removeChannel(channel); if (poll) clearInterval(poll); };
  }, [client?.id, client?.email]);

  const updateStatus = async (newStatus) => {
    await supabase.from('clients').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await supabase.from('activities').insert({ client_id: id, action: 'Status Changed', description: `Status updated to ${newStatus}`, created_by: user?.id });
    setClient(prev => ({ ...prev, status: newStatus }));
    setActivities(prev => [{ id: Date.now(), action: 'Status Changed', description: `Status updated to ${newStatus}`, created_at: new Date().toISOString() }, ...prev]);
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data } = await supabase.from('notes').insert({ client_id: id, content: newNote, created_by: user?.id }).select().single();
    if (data) setNotes(prev => [data, ...prev]);
    setNewNote('');
    setSavingNote(false);
  };

  if (loading) return <div style={{ padding: '32px', color: '#6B7280', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Loading...</div>;
  if (!client) return <div style={{ padding: '32px', color: '#6B7280', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Client not found.</div>;

  const sc = statusConfig[client.status] || statusConfig.pending;
  const totalVolume = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const successTx = transactions.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'Inter, sans-serif' }}>
        <ArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: '700' }}>
              {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
            </div>
            <div>
              <h1 style={{ color: '#111827', fontSize: '20px', fontWeight: '700', margin: '0 0 4px', letterSpacing: '-0.3px' }}>{client.first_name} {client.last_name}</h1>
              <div style={{ color: '#6B7280', fontSize: '13px' }}>{client.company_name} · {client.country}</div>
              {client.email && <div style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>{client.email}</div>}
            </div>
          </div>
          <span style={{ background: sc.bg, color: sc.color, padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{sc.label}</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
          {[
            { label: 'Transactions', value: transactions.length, icon: ArrowLeftRight, color: '#6366F1', bg: '#EEF2FF' },
            { label: 'Total Volume', value: `$${formatAmount(totalVolume)}`, icon: CheckCircle, color: '#166534', bg: '#DCFCE7' },
            { label: 'Successful', value: successTx, icon: CheckCircle, color: '#166534', bg: '#DCFCE7' },
            { label: 'Disputes', value: disputes.length, icon: ShieldAlert, color: disputes.length > 0 ? '#991B1B' : '#166534', bg: disputes.length > 0 ? '#FEE2E2' : '#DCFCE7' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} style={{ background: '#F9FAFB', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', background: bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: '600' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Status Update */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          <span style={{ color: '#6B7280', fontSize: '12px', fontWeight: '600' }}>Update status:</span>
          {['pending', 'under_review', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => updateStatus(s)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #E5E7EB', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: client.status === s ? statusConfig[s].bg : 'white', color: client.status === s ? statusConfig[s].color : '#6B7280', fontFamily: 'Inter, sans-serif' }}>
              {statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '20px', background: '#F3F4F6', padding: '4px', borderRadius: '10px', width: 'fit-content', maxWidth: '100%' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? '#111827' : '#6B7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={16} color="#6366F1" /> Personal Details
            </div>
            {[
              { icon: Mail, label: 'Email', value: client.email },
              { icon: Phone, label: 'Phone', value: client.phone },
              { icon: MapPin, label: 'Country', value: client.country },
              { icon: Building, label: 'Company', value: client.company_name },
              { icon: Globe, label: 'Industry', value: client.industry },
              { icon: Clock, label: 'Added', value: formatDate(client.created_at) },
            ].map(({ icon: Icon, label, value }) => value ? (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: '32px', height: '32px', background: '#F3F4F6', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color="#6B7280" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>{value}</div>
                </div>
              </div>
            ) : null)}
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#6366F1" /> Recent Activity
            </div>
            {activities.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No activity yet.</div>
            ) : activities.slice(0, 6).map(act => (
              <div key={act.id} style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={12} color="#6366F1" />
                </div>
                <div>
                  <div style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>{act.action}</div>
                  {act.description && <div style={{ color: '#6B7280', fontSize: '12px' }}>{act.description}</div>}
                  <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{formatDate(act.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'Transactions' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'auto' }}>
          {transactions.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No transactions found for this client.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['Date', 'Transaction ID', 'Brand', 'Type', 'Amount', 'PSP', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#9CA3AF', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid #F3F4F6' }} onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '11px 16px', color: '#6B7280', fontSize: '12px' }}>{formatDate(t.created_date)}</td>
                    <td style={{ padding: '11px 16px', color: '#111827', fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' }}>{t.transaction_id || '-'}</td>
                    <td style={{ padding: '11px 16px', color: '#374151', fontSize: '12px' }}>{t.brand_name || '-'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {t.type && <span style={{ ...txTypeStyle(t.type), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.type}</span>}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#111827', fontSize: '12px', fontWeight: '600' }}>{formatAmount(t.amount)} {t.account_currency}</td>
                    <td style={{ padding: '11px 16px', color: '#374151', fontSize: '12px' }}>{t.psp_actual || '-'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {t.transaction_approval && <span style={{ ...txStatusStyle(t.transaction_approval), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.transaction_approval}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Disputes Tab */}
      {activeTab === 'Disputes' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          {disputes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>No disputes found for this client.</div>
          ) : disputes.map(d => (
            <div key={d.id} style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{d.transaction_id || 'No TX ID'}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{d.reason || '-'}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>{formatAmount(d.amount)} {d.currency}</div>
              <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: d.status === 'won' ? '#DCFCE7' : d.status === 'lost' ? '#FEE2E2' : '#FEF9C3', color: d.status === 'won' ? '#166534' : d.status === 'lost' ? '#991B1B' : '#854D0E' }}>{d.status}</span>
              <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatDate(d.deadline)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'Documents' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px' }}>
          {documents.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '48px 0' }}>No documents uploaded yet.</div>
          ) : documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', background: '#F3F4F6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={15} color="#6B7280" />
                </div>
                <div>
                  <div style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>{doc.name}</div>
                  <div style={{ color: '#9CA3AF', fontSize: '11px' }}>{formatDate(doc.uploaded_at)}</div>
                </div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: doc.status === 'approved' ? '#DCFCE7' : doc.status === 'rejected' ? '#FEE2E2' : '#F3F4F6', color: doc.status === 'approved' ? '#166534' : doc.status === 'rejected' ? '#991B1B' : '#374151' }}>{doc.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'Notes' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." onKeyDown={e => e.key === 'Enter' && addNote()} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addNote} disabled={savingNote} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Add</button>
          </div>
          {notes.length === 0 ? (
            <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No notes yet.</div>
          ) : notes.map(note => (
            <div key={note.id} style={{ padding: '14px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '10px', border: '1px solid #F3F4F6' }}>
              <div style={{ color: '#111827', fontSize: '13px', lineHeight: '1.5' }}>{note.content}</div>
              <div style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '6px' }}>{new Date(note.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'Activity' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Live TradeScope trading activity */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ActivityIcon size={16} color="#6366F1" />
                <span style={{ fontWeight: '700', fontSize: '14px', color: '#111827' }}>Live Trading Activity</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>· TradeScope</span>
              </div>
              {tsAccount && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: '1px solid #BBF7D0', borderRadius: '20px', padding: '3px 10px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 0 3px rgba(34,197,94,0.15)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#16A34A' }}>Live</span>
                </div>
              )}
            </div>

            {tsLoading ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Connecting to TradeScope…</div>
            ) : !tsAccount ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No linked TradeScope account for this client.</div>
            ) : (
              <>
                {/* Account summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                  {[
                    { label: 'Balance', value: fmtUsd(tsAccount.balance) },
                    { label: 'Equity', value: fmtUsd(tsAccount.equity) },
                    { label: 'Leverage', value: `1:${tsAccount.leverage || 100}` },
                    { label: 'Open', value: tsTrades.filter(t => t.status === 'open').length },
                    { label: 'Closed', value: tsTrades.filter(t => t.status === 'closed').length },
                  ].map(s => (
                    <div key={s.label} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#111827', marginTop: '3px' }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Trades feed */}
                {tsTrades.length === 0 ? (
                  <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No trades yet.</div>
                ) : (
                  <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
                    {tsTrades.map(tr => {
                      const buy = tr.type?.toLowerCase() === 'buy';
                      const open = tr.status === 'open';
                      const Icon = buy ? TrendingUp : TrendingDown;
                      return (
                        <div key={tr.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderBottom: '1px solid #F3F4F6' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: buy ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={15} color={buy ? '#16A34A' : '#DC2626'} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                )}
              </>
            )}
          </div>

          {/* CRM activity */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', marginBottom: '16px' }}>CRM Activity</div>
            {activities.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No activity yet.</div>
            ) : activities.map(act => (
              <div key={act.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={14} color="#6366F1" />
                </div>
                <div>
                  <div style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>{act.action}</div>
                  {act.description && <div style={{ color: '#6B7280', fontSize: '12px', marginTop: '2px' }}>{act.description}</div>}
                  <div style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '4px' }}>{new Date(act.created_at).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
