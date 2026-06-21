import { useNavigate } from 'react-router-dom';
import { clients } from '../data/mockData';
import { FileText } from 'lucide-react';

const stages = [
  { key: 'lead', label: 'Lead', color: '#F8FAFC', border: '#E2E8F0', dot: '#94A3B8', accent: '#64748B' },
  { key: 'docs_submitted', label: 'Docs Submitted', color: '#EFF6FF', border: '#BFDBFE', dot: '#3B82F6', accent: '#1D4ED8' },
  { key: 'under_review', label: 'Under Review', color: '#FFFBEB', border: '#FDE68A', dot: '#F59E0B', accent: '#B45309' },
  { key: 'active', label: 'Approved', color: '#F0FDF4', border: '#BBF7D0', dot: '#22C55E', accent: '#15803D' },
  { key: 'rejected', label: 'Rejected', color: '#FFF1F2', border: '#FECDD3', dot: '#F43F5E', accent: '#BE123C' },
];

const industryStyle = {
  Forex: { background: '#EEF2FF', color: '#4338CA' },
  Payments: { background: '#F5F3FF', color: '#7C3AED' },
  iGaming: { background: '#FFF7ED', color: '#C2410C' },
};

export default function KYCPipeline() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif", height: '100%' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>KYC Pipeline</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Track clients through each compliance stage</p>
      </div>

      <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px' }}>
        {stages.map(stage => {
          const stageClients = clients.filter(c => c.stage === stage.key);
          return (
            <div key={stage.key} style={{ flexShrink: 0, width: '230px' }}>
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '10px', padding: '0 2px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.dot }} />
                  <span style={{ color: '#0F172A', fontSize: '12px', fontWeight: '700', letterSpacing: '0.2px' }}>{stage.label}</span>
                </div>
                <div style={{
                  background: '#F1F5F9', color: '#64748B',
                  borderRadius: '20px', padding: '2px 8px',
                  fontSize: '11px', fontWeight: '700',
                }}>{stageClients.length}</div>
              </div>

              {/* Column body */}
              <div style={{
                background: stage.color,
                border: `1px solid ${stage.border}`,
                borderRadius: '12px',
                padding: '10px',
                minHeight: '120px',
                display: 'flex', flexDirection: 'column', gap: '8px',
              }}>
                {stageClients.length === 0 && (
                  <div style={{ color: '#CBD5E1', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Empty</div>
                )}
                {stageClients.map(client => (
                  <div
                    key={client.id}
                    onClick={() => navigate(`/clients/${client.id}`)}
                    style={{
                      background: 'white',
                      borderRadius: '10px',
                      padding: '12px',
                      border: '1px solid #E2E8F0',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      transition: 'box-shadow 0.15s, transform 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px',
                        background: `hsl(${client.id * 60}, 70%, 95%)`,
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: `hsl(${client.id * 60}, 70%, 35%)`,
                        fontSize: '10px', fontWeight: '800', flexShrink: 0,
                      }}>
                        {client.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ color: '#0F172A', fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.name}</div>
                        <div style={{ color: '#94A3B8', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{client.company}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        ...industryStyle[client.industry],
                        padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: '600',
                      }}>{client.industry}</span>
                      <span style={{ color: '#94A3B8', fontSize: '10px' }}>{client.assignedTo}</span>
                    </div>

                    {client.documents.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={10} color="#94A3B8" />
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {client.documents.map((doc, i) => (
                            <div key={i} title={`${doc.name}: ${doc.status}`} style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: doc.status === 'verified' ? '#22C55E' : doc.status === 'rejected' ? '#F43F5E' : '#F59E0B',
                            }} />
                          ))}
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: '10px' }}>
                          {client.documents.filter(d => d.status === 'verified').length}/{client.documents.length}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
