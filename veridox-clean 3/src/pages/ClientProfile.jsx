import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, Mail, Phone, Globe, Building, MapPin, ArrowLeftRight, ShieldAlert, User, CheckCircle, TrendingUp, TrendingDown, Activity as ActivityIcon, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { tradescope } from '../lib/tradescope';
import { invalidate } from '../lib/cache';
import { useAuth } from '../contexts/AuthContext';
import { isAdmin as isAdminRole, roleLabel, roleStyle } from '../lib/roles';

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

// When a transaction has an initiated withdrawal, its status in the client's
// Transactions tab reflects the withdrawal's approval state instead of the deposit status.
const WITHDRAWAL_STATUS_DISPLAY = {
  pending: { label: 'Pending Withdrawal', background: '#FEF9C3', color: '#854D0E' },
  under_review: { label: 'Withdrawal Under Review', background: '#EEF2FF', color: '#4338CA' },
  approved: { label: 'Withdrawal Approved', background: '#DCFCE7', color: '#166534' },
  rejected: { label: 'Withdrawal Rejected', background: '#FEE2E2', color: '#991B1B' },
  completed: { label: 'Withdrawal Completed', background: '#F0FDF4', color: '#166534' },
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
  const { user, profile } = useAuth();
  const canEditWarning = isAdminRole(profile?.role);
  const canManageNotes = isAdminRole(profile?.role);
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [withdrawalStatusByTx, setWithdrawalStatusByTx] = useState({});
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteAuthors, setNoteAuthors] = useState({});
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('Overview');
  const [tsAccount, setTsAccount] = useState(null);
  const [tsTrades, setTsTrades] = useState([]);
  const [tsLoading, setTsLoading] = useState(true);
  const [warningDraft, setWarningDraft] = useState('');
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ email: '', phone: '', country: '' });
  const [savingDetails, setSavingDetails] = useState(false);

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
      loadNoteAuthors(n.data || []);
      setActivities(a.data || []);
      // Fetch transactions by account_no or name
      if (c.data) {
        const name = `${c.data.first_name} ${c.data.last_name}`;
        Promise.all([
          // Match transactions to THIS client by the persisted client_id FK
          // (added via migration; auto-linked on insert + on client-add by DB triggers).
          supabase.from('transactions').select('*')
            .eq('client_id', c.data.id)
            .order('created_date', { ascending: false })
            .limit(100),
          supabase.from('disputes').select('*')
            .ilike('client_name', `${c.data.first_name || ''} ${c.data.last_name || ''}`.trim())
            .order('created_at', { ascending: false }),
        ]).then(async ([t, disp]) => {
          const txs = t.data || [];
          setTransactions(txs);
          setDisputes(disp.data || []);
          // Overlay withdrawal state onto the matching transactions' status
          const txIds = txs.map(x => x.id);
          if (txIds.length) {
            const { data: wds } = await supabase.from('withdrawal_approvals')
              .select('source_transaction_id, status')
              .in('source_transaction_id', txIds);
            const map = {};
            (wds || []).forEach(w => { if (w.source_transaction_id) map[w.source_transaction_id] = w.status; });
            setWithdrawalStatusByTx(map);
          }
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

  // Sync the warning draft when a different trader account loads (not on every realtime tick)
  useEffect(() => { setWarningDraft(tsAccount?.admin_warning || ''); }, [tsAccount?.id]);

  // Admin sets / clears the warning shown on the client's TradeScope platform
  async function saveWarning() {
    if (!tsAccount) return;
    const val = warningDraft.trim() || null;
    await tradescope.from('trader_accounts').update({ admin_warning: val }).eq('id', tsAccount.id);
    setTsAccount(prev => (prev ? { ...prev, admin_warning: val } : prev));
  }
  async function clearWarning() {
    setWarningDraft('');
    if (!tsAccount) return;
    await tradescope.from('trader_accounts').update({ admin_warning: null }).eq('id', tsAccount.id);
    setTsAccount(prev => (prev ? { ...prev, admin_warning: null } : prev));
  }

  const updateStatus = async (newStatus) => {
    await supabase.from('clients').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    invalidate('clients');
    await supabase.from('activities').insert({ client_id: id, action: 'Status Changed', description: `Status updated to ${newStatus}`, created_by: user?.id });
    setClient(prev => ({ ...prev, status: newStatus }));
    setActivities(prev => [{ id: Date.now(), action: 'Status Changed', description: `Status updated to ${newStatus}`, created_at: new Date().toISOString() }, ...prev]);
  };

  const openEditDetails = () => {
    setDetailsForm({ email: client.email || '', phone: client.phone || '', country: client.country || '' });
    setEditingDetails(true);
  };
  const saveDetails = async () => {
    setSavingDetails(true);
    const updates = {
      email: detailsForm.email.trim() || null,
      phone: detailsForm.phone.trim() || null,
      country: detailsForm.country.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('clients').update(updates).eq('id', id);
    if (error) { setSavingDetails(false); alert('Could not save details: ' + error.message); return; }
    invalidate('clients');
    setClient(prev => ({ ...prev, ...updates }));
    await supabase.from('activities').insert({ client_id: id, action: 'Details Updated', description: 'Personal details edited', created_by: user?.id });
    setActivities(prev => [{ id: Date.now(), action: 'Details Updated', description: 'Personal details edited', created_at: new Date().toISOString() }, ...prev]);
    setSavingDetails(false);
    setEditingDetails(false);
  };

  // Resolve the author (name + role) for each note's created_by so the admin can
  // see who wrote each one — including notes agents added from their own panels.
  async function loadNoteAuthors(noteList) {
    const ids = [...new Set((noteList || []).map(n => n.created_by).filter(Boolean))];
    if (!ids.length) { setNoteAuthors({}); return; }
    const { data } = await supabase.from('profiles').select('id, full_name, role').in('id', ids);
    const map = {};
    (data || []).forEach(p => { map[p.id] = { name: p.full_name, role: p.role }; });
    setNoteAuthors(map);
  }

  const addNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data } = await supabase.from('notes').insert({ client_id: id, content: newNote, created_by: user?.id }).select().single();
    if (data) {
      setNotes(prev => [data, ...prev]);
      if (user?.id) setNoteAuthors(prev => ({ ...prev, [user.id]: { name: profile?.full_name, role: profile?.role } }));
    }
    setNewNote('');
    setSavingNote(false);
  };

  const startEditNote = (note) => { setEditingNoteId(note.id); setEditNoteText(note.content); };
  const cancelEditNote = () => { setEditingNoteId(null); setEditNoteText(''); };
  const saveEditNote = async (noteId) => {
    const content = editNoteText.trim();
    if (!content) return;
    setSavingEdit(true);
    const { error } = await supabase.from('notes').update({ content }).eq('id', noteId);
    setSavingEdit(false);
    if (error) { alert('Could not save note: ' + error.message); return; }
    setNotes(prev => prev.map(n => (n.id === noteId ? { ...n, content } : n)));
    cancelEditNote();
  };
  const deleteNote = async (noteId) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) { alert('Could not delete note: ' + error.message); return; }
    setNotes(prev => prev.filter(n => n.id !== noteId));
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <User size={16} color="#6366F1" /> Personal Details
              </div>
              {!editingDetails ? (
                <button onClick={openEditDetails} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#6366F1', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
                  <Pencil size={12} /> Edit
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button onClick={() => setEditingDetails(false)} disabled={savingDetails} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#374151', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Cancel</button>
                  <button onClick={saveDetails} disabled={savingDetails} style={{ padding: '5px 12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: savingDetails ? 'not-allowed' : 'pointer', opacity: savingDetails ? 0.7 : 1, fontFamily: "'Inter', sans-serif" }}>{savingDetails ? 'Saving…' : 'Save'}</button>
                </div>
              )}
            </div>
            {[
              { icon: Mail, label: 'Email', key: 'email', type: 'email' },
              { icon: Phone, label: 'Phone', key: 'phone', type: 'tel' },
              { icon: MapPin, label: 'Country', key: 'country', type: 'text' },
            ].map(({ icon: Icon, label, key, type }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ width: '32px', height: '32px', background: '#F3F4F6', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color="#6B7280" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>{label}</div>
                  {editingDetails ? (
                    <input type={type} value={detailsForm[key]} onChange={e => setDetailsForm(p => ({ ...p, [key]: e.target.value }))} placeholder={label} style={{ width: '100%', boxSizing: 'border-box', marginTop: '3px', padding: '7px 9px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', color: '#111827', outline: 'none', fontFamily: "'Inter', sans-serif" }} />
                  ) : (
                    <div style={{ fontSize: '13px', color: client[key] ? '#111827' : '#9CA3AF', fontWeight: '500' }}>{client[key] || '—'}</div>
                  )}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
              <div style={{ width: '32px', height: '32px', background: '#F3F4F6', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={14} color="#6B7280" />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>Added</div>
                <div style={{ fontSize: '13px', color: '#111827', fontWeight: '500' }}>{formatDate(client.created_at)}</div>
              </div>
            </div>
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
                  <tr key={t.id} onClick={() => navigate(`/transactions/${t.id}`)} style={{ borderTop: '1px solid #F3F4F6', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '11px 16px', color: '#6B7280', fontSize: '12px' }}>{formatDate(t.created_date)}</td>
                    <td style={{ padding: '11px 16px', color: '#111827', fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' }}>{t.transaction_id || '-'}</td>
                    <td style={{ padding: '11px 16px', color: '#374151', fontSize: '12px' }}>{t.brand_name || '-'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {t.type && <span style={{ ...txTypeStyle(t.type), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.type}</span>}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#111827', fontSize: '12px', fontWeight: '600' }}>{formatAmount(t.amount)} {t.account_currency}</td>
                    <td style={{ padding: '11px 16px', color: '#374151', fontSize: '12px' }}>{t.psp_actual || '-'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {(() => {
                        const wd = WITHDRAWAL_STATUS_DISPLAY[withdrawalStatusByTx[t.id]];
                        if (wd) return <span style={{ background: wd.background, color: wd.color, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{wd.label}</span>;
                        return t.transaction_approval && <span style={{ ...txStatusStyle(t.transaction_approval), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.transaction_approval}</span>;
                      })()}
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
          ) : notes.map(note => {
            const author = noteAuthors[note.created_by];
            const isEditing = editingNoteId === note.id;
            return (
              <div key={note.id} style={{ padding: '14px', background: '#F9FAFB', borderRadius: '8px', marginBottom: '10px', border: '1px solid #F3F4F6' }}>
                {isEditing ? (
                  <>
                    <textarea value={editNoteText} onChange={e => setEditNoteText(e.target.value)} rows={3} autoFocus
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '13px', color: '#111827', outline: 'none', resize: 'vertical', fontFamily: 'Inter, sans-serif' }} />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button onClick={() => saveEditNote(note.id)} disabled={savingEdit || !editNoteText.trim()} style={{ padding: '6px 14px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: savingEdit ? 'not-allowed' : 'pointer', opacity: savingEdit || !editNoteText.trim() ? 0.7 : 1 }}>{savingEdit ? 'Saving…' : 'Save'}</button>
                      <button onClick={cancelEditNote} disabled={savingEdit} style={{ padding: '6px 14px', background: 'white', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                      <div style={{ color: '#111827', fontSize: '13px', lineHeight: '1.5', flex: 1, whiteSpace: 'pre-wrap' }}>{note.content}</div>
                      {canManageNotes && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => startEditNote(note)} title="Edit note" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#6366F1', cursor: 'pointer' }}><Pencil size={13} /></button>
                          <button onClick={() => deleteNote(note.id)} title="Delete note" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', background: 'white', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#DC2626', cursor: 'pointer' }}><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {author && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>{author.name || 'Unknown'}</span>
                          {author.role && <span style={{ ...roleStyle(author.role), padding: '1px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{roleLabel(author.role)}</span>}
                          <span style={{ color: '#D1D5DB' }}>·</span>
                        </span>
                      )}
                      <span style={{ color: '#9CA3AF', fontSize: '11px' }}>{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
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

                {/* Last login + admin warning (P7) */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={13} color="#9CA3AF" /> Last login: <strong style={{ color: '#374151' }}>{tsAccount.last_login_at ? new Date(tsAccount.last_login_at).toLocaleString('en-GB') : 'Never'}</strong>
                  </div>
                  {canEditWarning ? (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Platform Warning</div>
                      <textarea value={warningDraft} onChange={e => setWarningDraft(e.target.value)} placeholder="Type a warning the client will see on their trading platform… (leave empty for none)" rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #FCD34D', borderRadius: '6px', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'Inter, sans-serif', background: '#fff', color: '#111827' }} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                        <button onClick={saveWarning} style={{ padding: '7px 16px', background: '#B45309', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Save warning</button>
                        {tsAccount.admin_warning && <button onClick={clearWarning} style={{ padding: '7px 16px', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '6px', color: '#6B7280', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Clear</button>}
                        <span style={{ fontSize: '11px', color: tsAccount.admin_warning ? '#B45309' : '#9CA3AF' }}>{tsAccount.admin_warning ? '● Showing on client platform' : 'Not shown to client'}</span>
                      </div>
                    </div>
                  ) : tsAccount.admin_warning ? (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#991B1B' }}>⚠ Warning shown to client: {tsAccount.admin_warning}</div>
                  ) : null}
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
