import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const stages = [
  { key: 'pending', label: 'Pending', color: '#64748B', bg: '#F1F5F9' },
  { key: 'under_review', label: 'Under Review', color: '#D97706', bg: '#FFFBEB' },
  { key: 'approved', label: 'Approved', color: '#16A34A', bg: '#F0FDF4' },
  { key: 'rejected', label: 'Rejected', color: '#DC2626', bg: '#FEF2F2' },
];

export default function KYCPipeline() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('clients').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setClients(data || []);
      setLoading(false);
    });
  }, []);

  const updateStatus = async (clientId, newStatus) => {
    await supabase.from('clients').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', clientId);
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c));
  };

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>KYC Pipeline</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Drag clients through compliance stages</p>
      </div>

      {loading ? (
        <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '60px' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
          {stages.map(stage => {
            const stageClients = clients.filter(c => c.status === stage.key);
            return (
              <div key={stage.key} style={{ background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }} />
                    <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>{stage.label}</span>
                  </div>
                  <span style={{ background: stage.bg, color: stage.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>{stageClients.length}</span>
                </div>
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px' }}>
                  {stageClients.length === 0 ? (
                    <div style={{ color: '#CBD5E1', fontSize: '12px', textAlign: 'center', padding: '24px 0' }}>No clients</div>
                  ) : stageClients.map(client => (
                    <div key={client.id} style={{ background: 'white', borderRadius: '8px', border: '1px solid #E2E8F0', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer' }} onClick={() => navigate(`/clients/${client.id}`)}>
                        <div style={{ width: '28px', height: '28px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
                          {(client.first_name?.[0] || '') + (client.last_name?.[0] || '')}
                        </div>
                        <div>
                          <div style={{ color: '#0F172A', fontSize: '12px', fontWeight: '600' }}>{client.first_name} {client.last_name}</div>
                          <div style={{ color: '#94A3B8', fontSize: '11px' }}>{client.company_name}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {stages.filter(s => s.key !== stage.key).map(s => (
                          <button key={s.key} onClick={() => updateStatus(client.id, s.key)} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #E2E8F0', fontSize: '10px', fontWeight: '600', cursor: 'pointer', background: 'white', color: '#64748B', fontFamily: 'Inter, sans-serif' }}>
                            → {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
