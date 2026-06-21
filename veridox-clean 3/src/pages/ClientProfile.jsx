import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle, XCircle, Clock, MessageSquare, Activity, Mail, Phone, Building2, Globe } from 'lucide-react';
import { clients } from '../data/mockData';

const kycBadge = (status) => {
  const styles = {
    approved: { background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0' },
    under_review: { background: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE68A' },
    pending: { background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' },
    rejected: { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA' },
  };
  const labels = { approved: 'Approved', under_review: 'Under Review', pending: 'Pending', rejected: 'Rejected' };
  return (
    <span style={{ ...styles[status], padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
      {labels[status]}
    </span>
  );
};

const docStatusIcon = (status) => {
  if (status === 'verified') return <CheckCircle size={15} color="#16A34A" />;
  if (status === 'rejected') return <XCircle size={15} color="#E11D48" />;
  return <Clock size={15} color="#D97706" />;
};

const card = {
  background: 'white',
  borderRadius: '12px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  marginBottom: '16px',
  overflow: 'hidden',
};

const cardHeader = {
  padding: '16px 20px',
  borderBottom: '1px solid #F1F5F9',
  display: 'flex', alignItems: 'center', gap: '8px',
};

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find(c => c.id === parseInt(id));

  if (!client) return <div style={{ padding: '32px', color: '#64748B' }}>Client not found.</div>;

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Back */}
      <button
        onClick={() => navigate('/clients')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'Inter, sans-serif' }}
      >
        <ArrowLeft size={15} /> Back to Clients
      </button>

      {/* Header Card */}
      <div style={{ ...card, marginBottom: '20px' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px', height: '56px',
                background: `hsl(${client.id * 60}, 70%, 95%)`,
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: `hsl(${client.id * 60}, 70%, 35%)`,
                fontSize: '18px', fontWeight: '800',
              }}>
                {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h1 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.3px' }}>{client.name}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} />{client.email}</span>
                  <span style={{ color: '#64748B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} />{client.phone}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {kycBadge(client.kycStatus)}
              <select style={{
                padding: '7px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
                fontSize: '12px', fontWeight: '600', color: '#475569', background: 'white',
                cursor: 'pointer', outline: 'none', fontFamily: 'Inter, sans-serif',
              }}>
                <option>Change Status</option>
                <option>Pending</option>
                <option>Under Review</option>
                <option>Approve</option>
                <option>Reject</option>
              </select>
            </div>
          </div>

          {/* Details row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1px', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #F1F5F9' }}>
            {[
              { icon: Building2, label: 'Company', value: client.company },
              { icon: Globe, label: 'Country', value: client.country },
              { icon: FileText, label: 'Industry', value: client.industry },
              { icon: Clock, label: 'Client Since', value: client.createdAt },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ padding: '0 16px', borderRight: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94A3B8', fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  <Icon size={11} />{label}
                </div>
                <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
        <div>
          {/* Documents */}
          <div style={card}>
            <div style={cardHeader}>
              <FileText size={15} color="#6366F1" />
              <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>KYC Documents</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {client.documents.length === 0 ? (
                <p style={{ color: '#94A3B8', fontSize: '13px', margin: 0 }}>No documents submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {client.documents.map((doc, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {docStatusIcon(doc.status)}
                        <div>
                          <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{doc.name}</div>
                          <div style={{ color: '#94A3B8', fontSize: '11px' }}>{doc.uploadedAt ? `Uploaded ${doc.uploadedAt}` : 'Not yet uploaded'}</div>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                        background: doc.status === 'verified' ? '#DCFCE7' : doc.status === 'rejected' ? '#FEE2E2' : '#FEF9C3',
                        color: doc.status === 'verified' ? '#166534' : doc.status === 'rejected' ? '#991B1B' : '#854D0E',
                      }}>
                        {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button style={{ color: '#6366F1', fontSize: '12px', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'Inter, sans-serif' }}>
                + Request document
              </button>
            </div>
          </div>

          {/* Notes */}
          <div style={card}>
            <div style={cardHeader}>
              <MessageSquare size={15} color="#6366F1" />
              <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>Notes</span>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {client.notes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                  {client.notes.map((note, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: '700' }}>{note.author}</span>
                        <span style={{ color: '#94A3B8', fontSize: '11px' }}>{note.date}</span>
                      </div>
                      <p style={{ color: '#475569', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{note.text}</p>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                placeholder="Add a compliance note..."
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid #E2E8F0',
                  fontSize: '13px', color: '#0F172A', resize: 'none', outline: 'none',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <button style={{
                marginTop: '8px',
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white', border: 'none', borderRadius: '7px',
                padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}>
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Activity */}
        <div style={{ ...card, height: 'fit-content' }}>
          <div style={cardHeader}>
            <Activity size={15} color="#6366F1" />
            <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>Activity Timeline</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '2px solid #E2E8F0' }}>
              {client.activity.map((item, i) => (
                <div key={i} style={{ position: 'relative', paddingBottom: '16px' }}>
                  <div style={{
                    position: 'absolute', left: '-25px', top: '3px',
                    width: '10px', height: '10px',
                    background: i === 0 ? '#6366F1' : '#E2E8F0',
                    borderRadius: '50%',
                    border: '2px solid white',
                    boxShadow: '0 0 0 2px ' + (i === 0 ? '#6366F1' : '#E2E8F0'),
                  }} />
                  <div style={{ color: '#0F172A', fontSize: '12px', fontWeight: '600' }}>{item.event}</div>
                  <div style={{ color: '#94A3B8', fontSize: '11px', marginTop: '2px' }}>{item.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
