import { useEffect, useState } from 'react';
import { Plus, X, Mail, MessageSquare, Phone, Send, Inbox, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

const channelStyle = (c) => ({
  email: { background: '#EEF2FF', color: '#4338CA', icon: Mail },
  sms: { background: '#ECFDF5', color: '#059669', icon: MessageSquare },
  phone: { background: '#FFF7ED', color: '#C2410C', icon: Phone },
}[c] || { background: '#F1F5F9', color: '#475569', icon: MessageSquare });

const statusStyle = (s) => ({
  sent: { background: '#DCFCE7', color: '#166534' },
  delivered: { background: '#EEF2FF', color: '#4338CA' },
  failed: { background: '#FEE2E2', color: '#991B1B' },
  pending: { background: '#FEF9C3', color: '#854D0E' },
  read: { background: '#F0FDF4', color: '#166534' },
}[s] || { background: '#F1F5F9', color: '#475569' });

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const templates = [
  { id: 'welcome', label: 'Welcome Message', subject: 'Welcome to our platform', message: 'Dear {name},\n\nWelcome to our platform! We are excited to have you on board.\n\nBest regards,\nThe Team' },
  { id: 'kyc_pending', label: 'KYC Pending', subject: 'Action Required: Complete Your KYC', message: 'Dear {name},\n\nYour KYC verification is pending. Please submit the required documents to complete your account verification.\n\nBest regards,\nCompliance Team' },
  { id: 'withdrawal_approved', label: 'Withdrawal Approved', subject: 'Your Withdrawal Has Been Approved', message: 'Dear {name},\n\nYour withdrawal request has been approved and is being processed. Please allow 2-5 business days for the funds to arrive.\n\nBest regards,\nFinance Team' },
  { id: 'withdrawal_rejected', label: 'Withdrawal Rejected', subject: 'Withdrawal Request Update', message: 'Dear {name},\n\nWe regret to inform you that your withdrawal request has been rejected. Please contact support for more information.\n\nBest regards,\nFinance Team' },
  { id: 'document_expiry', label: 'Document Expiry Reminder', subject: 'Document Expiring Soon', message: 'Dear {name},\n\nThis is a reminder that one of your documents is expiring soon. Please upload an updated version to maintain your account status.\n\nBest regards,\nCompliance Team' },
];

export default function CommunicationCenter() {
  const [comms, setComms] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);

  const empty = {
    client_id: '', channel: 'email', direction: 'outbound',
    subject: '', message: '', status: 'sent', sent_by: 'Admin',
  };
  const [form, setForm] = useState(empty);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [{ data: commData }, { data: cliData }] = await Promise.all([
      supabase.from('communications').select('*, client:client_id(first_name, last_name, email)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, first_name, last_name, email').order('first_name'),
    ]);
    setComms(commData || []);
    setClients(cliData || []);
    setLoading(false);
  }

  async function send() {
    await supabase.from('communications').insert({
      ...form,
      client_id: form.client_id || null,
      sent_by: 'Admin',
      created_at: new Date().toISOString(),
    });
    setShowModal(false);
    setForm(empty);
    fetchAll();
  }

  async function sendBulk() {
    if (!window.confirm(`Send this message to all ${clients.length} clients?`)) return;
    const inserts = clients.map(c => ({
      ...form,
      client_id: c.id,
      message: form.message.replace('{name}', `${c.first_name} ${c.last_name}`),
      sent_by: 'Admin',
      created_at: new Date().toISOString(),
    }));
    for (let i = 0; i < inserts.length; i += 50) {
      await supabase.from('communications').insert(inserts.slice(i, i + 50));
    }
    setShowModal(false);
    setForm(empty);
    fetchAll();
  }

  function applyTemplate(t) {
    setForm(f => ({ ...f, subject: t.subject, message: t.message }));
  }

  const filtered = comms.filter(c => {
    if (filterChannel !== 'all' && c.channel !== filterChannel) return false;
    if (filterDirection !== 'all' && c.direction !== filterDirection) return false;
    if (search && !c.client?.first_name?.toLowerCase().includes(search.toLowerCase()) &&
      !c.client?.last_name?.toLowerCase().includes(search.toLowerCase()) &&
      !c.subject?.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedClient && c.client_id !== selectedClient) return false;
    return true;
  });

  const sentCount = comms.filter(c => c.direction === 'outbound').length;
  const receivedCount = comms.filter(c => c.direction === 'inbound').length;
  const emailCount = comms.filter(c => c.channel === 'email').length;

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Communication Center</h1>
          <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>{comms.length} total messages</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
          <Send size={14} /> New Message
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Messages', value: comms.length, color: '#6366F1', bg: '#EEF2FF', icon: MessageSquare },
          { label: 'Sent', value: sentCount, color: '#059669', bg: '#ECFDF5', icon: Send },
          { label: 'Received', value: receivedCount, color: '#0369A1', bg: '#E0F2FE', icon: Inbox },
          { label: 'Emails', value: emailCount, color: '#7C3AED', bg: '#F5F3FF', icon: Mail },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748B' }}>{label}</span>
              <div style={{ background: bg, padding: '6px', borderRadius: '6px' }}><Icon size={14} color={color} /></div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#0F172A' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '20px' }}>
        {/* Client List */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', height: 'fit-content' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Clients</div>
          <button onClick={() => setSelectedClient(null)}
            style={{ width: '100%', padding: '8px 12px', background: !selectedClient ? '#EEF2FF' : 'transparent', border: `1px solid ${!selectedClient ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '8px', fontSize: '13px', fontWeight: !selectedClient ? '700' : '400', color: !selectedClient ? '#4338CA' : '#475569', cursor: 'pointer', textAlign: 'left', marginBottom: '6px' }}>
            All Clients ({comms.length})
          </button>
          {clients.map(c => {
            const count = comms.filter(m => m.client_id === c.id).length;
            return (
              <button key={c.id} onClick={() => setSelectedClient(c.id)}
                style={{ width: '100%', padding: '8px 12px', background: selectedClient === c.id ? '#EEF2FF' : 'transparent', border: `1px solid ${selectedClient === c.id ? '#C7D2FE' : 'transparent'}`, borderRadius: '8px', fontSize: '13px', fontWeight: selectedClient === c.id ? '700' : '400', color: selectedClient === c.id ? '#4338CA' : '#475569', cursor: 'pointer', textAlign: 'left', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{c.first_name} {c.last_name}</span>
                {count > 0 && <span style={{ background: '#EEF2FF', color: '#4338CA', padding: '1px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '700' }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Messages */}
        <div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search messages..."
                style={{ ...inputStyle, paddingLeft: '32px', width: '100%' }} />
            </div>
            <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All Channels</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="phone">Phone</option>
            </select>
            <select value={filterDirection} onChange={e => setFilterDirection(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', outline: 'none', background: 'white', fontFamily: 'Inter, sans-serif' }}>
              <option value="all">All</option>
              <option value="outbound">Sent</option>
              <option value="inbound">Received</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0' }}>No messages yet. Click <strong>New Message</strong> to send one.</div>
            ) : filtered.map(m => {
              const ch = channelStyle(m.channel);
              const ChIcon = ch.icon;
              return (
                <div key={m.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                      <div style={{ width: '36px', height: '36px', background: ch.background, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ChIcon size={16} color={ch.color} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>
                            {m.client ? `${m.client.first_name} ${m.client.last_name}` : 'All Clients'}
                          </span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>{m.client?.email}</span>
                          <span style={{ background: m.direction === 'outbound' ? '#ECFDF5' : '#EEF2FF', color: m.direction === 'outbound' ? '#059669' : '#4338CA', padding: '1px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>
                            {m.direction === 'outbound' ? '↑ Sent' : '↓ Received'}
                          </span>
                        </div>
                        {m.subject && <div style={{ fontSize: '13px', fontWeight: '600', color: '#0F172A', marginBottom: '4px' }}>{m.subject}</div>}
                        <div style={{ fontSize: '13px', color: '#64748B', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{m.message}</div>
                        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
                          {formatDate(m.created_at)} {m.sent_by && `· by ${m.sent_by}`}
                        </div>
                      </div>
                    </div>
                    <span style={{ ...statusStyle(m.status), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize', flexShrink: 0 }}>{m.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '14px', width: '580px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#0F172A' }}>New Message</div>
              <button onClick={() => { setShowModal(false); setForm(empty); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color="#94A3B8" /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
              {/* Templates */}
              <div>
                <label style={labelStyle}>Quick Templates</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {templates.map(t => (
                    <button key={t.id} onClick={() => applyTemplate(t)}
                      style={{ padding: '5px 10px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Channel</label>
                  <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} style={inputStyle}>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Direction</label>
                  <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} style={inputStyle}>
                    <option value="outbound">Outbound (Sent)</option>
                    <option value="inbound">Inbound (Received)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Client (leave empty for bulk)</label>
                <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} style={inputStyle}>
                  <option value="">All Clients (Bulk)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.email}</option>)}
                </select>
              </div>

              {form.channel === 'email' && (
                <div>
                  <label style={labelStyle}>Subject</label>
                  <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject..." style={inputStyle} />
                </div>
              )}

              <div>
                <label style={labelStyle}>Message {!form.client_id && <span style={{ color: '#6366F1' }}>· Use {'{name}'} for personalization</span>}</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Type your message..." rows={6} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowModal(false); setForm(empty); }} style={{ padding: '9px 20px', border: '1px solid #E2E8F0', borderRadius: '8px', background: 'white', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
              {!form.client_id && (
                <button onClick={sendBulk} disabled={!form.message}
                  style={{ padding: '9px 20px', background: !form.message ? '#E2E8F0' : '#0F172A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.message ? '#94A3B8' : 'white', cursor: !form.message ? 'not-allowed' : 'pointer' }}>
                  Send to All ({clients.length})
                </button>
              )}
              <button onClick={send} disabled={!form.message}
                style={{ padding: '9px 20px', background: !form.message ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: !form.message ? '#94A3B8' : 'white', cursor: !form.message ? 'not-allowed' : 'pointer' }}>
                <Send size={13} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {form.client_id ? 'Send Message' : 'Send to Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
