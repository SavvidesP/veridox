import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, MessageSquare, Clock, CheckCircle, XCircle, AlertTriangle, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const statusConfig = {
  pending: { label: 'Pending', bg: '#F1F5F9', color: '#475569' },
  under_review: { label: 'Under Review', bg: '#FEF9C3', color: '#854D0E' },
  approved: { label: 'Approved', bg: '#DCFCE7', color: '#166534' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#991B1B' },
};

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

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
      setLoading(false);
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

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'Inter, sans-serif' }}>
        <ArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', fontSize: '18px', fontWeight: '700' }}>
              {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
            </div>
            <div>
              <h1 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '700', margin: '0 0 4px', letterSpacing: '-0.3px' }}>{client.first_name} {client.last_name}</h1>
              <div style={{ color: '#64748B', fontSize: '13px' }}>{client.company_name} · {client.country}</div>
              {client.email && <div style={{ color: '#94A3B8', fontSize: '12px', marginTop: '2px' }}>{client.email}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: sc.bg, color: sc.color, padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>{sc.label}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
          <span style={{ color: '#64748B', fontSize: '12px', fontWeight: '600', marginRight: '4px' }}>Update status:</span>
          {['pending', 'under_review', 'approved', 'rejected'].map(s => (
            <button key={s} onClick={() => updateStatus(s)} style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #E2E8F0', fontSize: '11px', fontWeight: '600', cursor: 'pointer', background: client.status === s ? statusConfig[s].bg : 'white', color: client.status === s ? statusConfig[s].color : '#64748B', fontFamily: 'Inter, sans-serif' }}>
              {statusConfig[s].label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
        {/* Left: documents + notes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Documents */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700' }}>Documents</div>
            </div>
            {documents.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No documents uploaded yet.</div>
            ) : documents.map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', background: '#F1F5F9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={15} color="#64748B" />
                  </div>
                  <div>
                    <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{doc.name}</div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>{new Date(doc.uploaded_at).toLocaleDateString()}</div>
                  </div>
                </div>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', background: doc.status === 'approved' ? '#DCFCE7' : doc.status === 'rejected' ? '#FEE2E2' : '#F1F5F9', color: doc.status === 'approved' ? '#166534' : doc.status === 'rejected' ? '#991B1B' : '#475569' }}>{doc.status}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>Notes</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." onKeyDown={e => e.key === 'Enter' && addNote()} style={{ flex: 1, padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', outline: 'none', fontFamily: 'Inter, sans-serif' }} onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              <button onClick={addNote} disabled={savingNote} style={{ padding: '9px 16px', background: '#6366F1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Add</button>
            </div>
            {notes.length === 0 ? (
              <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No notes yet.</div>
            ) : notes.map(note => (
              <div key={note.id} style={{ padding: '12px', background: '#F8FAFC', borderRadius: '8px', marginBottom: '8px', border: '1px solid #F1F5F9' }}>
                <div style={{ color: '#0F172A', fontSize: '13px', lineHeight: '1.5' }}>{note.content}</div>
                <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '4px' }}>{new Date(note.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: activity */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: 'fit-content' }}>
          <div style={{ color: '#0F172A', fontSize: '14px', fontWeight: '700', marginBottom: '16px' }}>Activity Log</div>
          {activities.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No activity yet.</div>
          ) : activities.map((act, i) => (
            <div key={act.id} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={12} color="#6366F1" />
              </div>
              <div>
                <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{act.action}</div>
                {act.description && <div style={{ color: '#64748B', fontSize: '12px', marginTop: '2px' }}>{act.description}</div>}
                <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '2px' }}>{new Date(act.created_at).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
