import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Clock, Mail, Phone, Globe, Building, MapPin, ArrowLeftRight, ShieldAlert, User, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const statusConfig = {
  pending: { label: 'Pending', bg: '#F1F5F9', color: '#475569' },
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

  if (loading) return <div style={{ padding: '32px', color: '#64748B', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Loading...</div>;
  if (!client) return <div style={{ padding: '32px', color: '#64748B', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Client not found.</div>;

  const sc = statusConfig[client.status] || statusConfig.pending;
  const totalVolume = transactions.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
  const successTx = transactions.filter(t => t.transaction_approval?.toLowerCase() === 'success').length;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'Inter, sans-serif' }}>
        <ArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '60px', height: '60px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: '700' }}>
              {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
            </div>
            <div>
              <h1 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '700', margin: '0 0 4px', letterSpacing: '-0.3px' }}>{client.first_name} {client.last_name}</h1>
              <div style={{ color: '#64748B', fontSize: '13px' }}>{client.company_name} · {client.country}</div>
              {client.email && <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>{client.email}</div>}
            </div>
          </div>
          <span style={{ background: sc.bg, color: sc.color, padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{sc.label}</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
          {[
            { label: 'Transactions', value: transactions.length, icon: ArrowLeftRight, color: '#6366F1', bg: '#EEF2FF' },
            { label: 'Total Volume', value: `$${formatAmount(totalVolume)}`, icon: CheckCircle, color: '#166534', bg: '#DCFCE7' },
            { label: 'Successful', value: successTx, icon: CheckCircle, color: '#166534', bg: '#DCFCE7' },
            { label: 'Disputes', value: disputes.length, icon: ShieldAlert, color: disputes.length > 0 ? '#991B1B' : '#166534', bg: disputes.length > 0 ? '#FEE2E2' : '#DCFCE7' },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', background: bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: '600' }}>{label}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Status Update */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          <span style={{ color: '#64748B', fontSize: '12px', fontWeight: '600' }}>Update status:</span>
          {['pending', 'under_review', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => updateStatus(s)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: client.status === s ? statusConfig[s].bg : 'white', color: client.status === s ? statusConfig[s].color : '#64748B', fontFamily: 'Inter, sans-serif' }}>
              {statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ padding: '7px 16px', borderRadius: '7px', border: 'none', fontSize: '13px', fontWeight: '600', cursor: 'pointer', background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? '#0F172A' : '#64748B', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}>
                <div style={{ width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} color="#64748B" />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: '600' }}>{label}</div>
                  <div style={{ fontSize: '13px', color: '#0F172A', fontWeight: '500' }}>{value}</div>
                </div>
              </div>
            ) : null)}
          </div>

          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
            <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#6366F1" /> Recent Activity
            </div>
            {activities.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No activity yet.</div>
            ) : activities.slice(0, 6).map(act => (
              <div key={act.id} style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock size={12} color="#6366F1" />
                </div>
                <div>
                  <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{act.action}</div>
                  {act.description && <div style={{ color: '#64748B', fontSize: '12px' }}>{act.description}</div>}
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>{formatDate(act.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'Transactions' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
          {transactions.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No transactions found for this client.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Date', 'Transaction ID', 'Brand', 'Type', 'Amount', 'PSP', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} style={{ borderTop: '1px solid #F1F5F9' }} onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '11px 16px', color: '#64748B', fontSize: '12px' }}>{formatDate(t.created_date)}</td>
                    <td style={{ padding: '11px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' }}>{t.transaction_id || '-'}</td>
                    <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>{t.brand_name || '-'}</td>
                    <td style={{ padding: '11px 16px' }}>
                      {t.type && <span style={{ ...txTypeStyle(t.type), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{t.type}</span>}
                    </td>
                    <td style={{ padding: '11px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600' }}>{formatAmount(t.amount)} {t.account_currency}</td>
                    <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>{t.psp_actual || '-'}</td>
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
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {disputes.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>No disputes found for this client.</div>
          ) : disputes.map(d => (
            <div key={d.id} style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '700', fontSize: '13px', color: '#0F172A' }}>{d.transaction_id || 'No TX ID'}</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{d.reason || '-'}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>{formatAmount(d.amount)} {d.currency}</div>
              <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: d.status === 'won' ? '#DCFCE7' : d.status === 'lost' ? '#FEE2E2' : '#FEF9C3', color: d.status === 'won' ? '#166534' : d.status === 'lost' ? '#991B1B' : '#854D0E' }}>{d.status}</span>
              <div style={{ fontSize: '11px', color: '#94A3B8' }}>{formatDate(d.deadline)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'Documents' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
          {documents.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '48px 0' }}>No documents uploaded yet.</div>
          ) : documents.map(doc => (
            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={15} color="#64748B" />
                </div>
                <div>
                  <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{doc.name}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px' }}>{formatDate(doc.uploaded_at)}</div>
                </div>
              </div>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: doc.status === 'approved' ? '#DCFCE7' : doc.status === 'rejected' ? '#FEE2E2' : '#F1F5F9', color: doc.status === 'approved' ? '#166534' : doc.status === 'rejected' ? '#991B1B' : '#475569' }}>{doc.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'Notes' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." onKeyDown={e => e.key === 'Enter' && addNote()} style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addNote} disabled={savingNote} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Add</button>
          </div>
          {notes.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No notes yet.</div>
          ) : notes.map(note => (
            <div key={note.id} style={{ padding: '14px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '10px', border: '1px solid #F1F5F9' }}>
              <div style={{ color: '#0F172A', fontSize: '13px', lineHeight: '1.5' }}>{note.content}</div>
              <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '6px' }}>{new Date(note.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'Activity' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px' }}>
          {activities.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No activity yet.</div>
          ) : activities.map(act => (
            <div key={act.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ width: '32px', height: '32px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={14} color="#6366F1" />
              </div>
              <div>
                <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{act.action}</div>
                {act.description && <div style={{ color: '#64748B', fontSize: '12px', marginTop: '2px' }}>{act.description}</div>}
                <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>{new Date(act.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
