import { useEffect, useState, useRef } from 'react';
import { Bell, X, CheckCheck, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

const typeConfig = {
  info: { icon: Info, color: '#3B82F6', bg: '#EFF6FF' },
  warning: { icon: AlertTriangle, color: '#F59E0B', bg: '#FFFBEB' },
  error: { icon: XCircle, color: '#EF4444', bg: '#FEF2F2' },
  success: { icon: CheckCircle, color: '#22C55E', bg: '#F0FDF4' },
};

function timeAgo(date) {
  const diff = Math.floor((new Date() - new Date(date)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const panelRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    // Auto-generate notifications based on data
    generateNotifications();
    // Close on outside click
    const handler = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  async function fetchNotifications() {
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20);
    setNotifications(data || []);
    setLoading(false);
  }

  async function generateNotifications() {
    // Check for conditions that should trigger notifications
    const [{ data: disputes }, { data: transactions }, { data: clients }] = await Promise.all([
      supabase.from('disputes').select('*').eq('status', 'open'),
      supabase.from('transactions').select('transaction_approval, amount'),
      supabase.from('clients').select('status').eq('status', 'pending'),
    ]);

    const newNotifications = [];

    // Overdue disputes
    const overdue = (disputes || []).filter(d => d.deadline && new Date(d.deadline) < new Date());
    if (overdue.length > 0) {
      newNotifications.push({
        title: 'Overdue Disputes',
        message: `${overdue.length} dispute${overdue.length > 1 ? 's are' : ' is'} past deadline and needs immediate attention.`,
        type: 'error',
        link: '/disputes',
      });
    }

    // Low approval rate
    const total = (transactions || []).length;
    const success = (transactions || []).filter(t => t.transaction_approval?.toLowerCase() === 'success').length;
    const rate = total > 0 ? (success / total) * 100 : 0;
    if (rate < 50 && total > 0) {
      newNotifications.push({
        title: 'Low Approval Rate',
        message: `Current approval rate is ${rate.toFixed(1)}%. Review your routing rules to improve performance.`,
        type: 'warning',
        link: '/routing',
      });
    }

    // Pending KYC clients
    if ((clients || []).length > 0) {
      newNotifications.push({
        title: 'Pending KYC Reviews',
        message: `${clients.length} client${clients.length > 1 ? 's are' : ' is'} waiting for KYC approval.`,
        type: 'info',
        link: '/pipeline',
      });
    }

    // Insert new notifications (avoid duplicates by checking title)
    const { data: existing } = await supabase.from('notifications').select('title').order('created_at', { ascending: false }).limit(50);
    const existingTitles = new Set((existing || []).map(n => n.title));

    for (const notif of newNotifications) {
      if (!existingTitles.has(notif.title)) {
        await supabase.from('notifications').insert(notif);
      }
    }

    fetchNotifications();
  }

  async function markAsRead(id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  async function deleteNotification(id, e) {
    e.stopPropagation();
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function handleClick(notif) {
    markAsRead(notif.id);
    if (notif.link) { navigate(notif.link); setOpen(false); }
  }

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button onClick={() => setOpen(!open)}
        style={{ position: 'relative', background: unread > 0 ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${unread > 0 ? '#FECACA' : '#E2E8F0'}`, borderRadius: '10px', padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Bell size={16} color={unread > 0 ? '#EF4444' : '#64748B'} />
        {unread > 0 && (
          <span style={{ background: '#EF4444', color: 'white', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '10px', minWidth: '18px', textAlign: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '380px', background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', zIndex: 1000, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: '#0F172A' }}>Notifications</div>
              <div style={{ fontSize: '12px', color: '#64748B' }}>{unread} unread</div>
            </div>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#6366F1', fontSize: '12px', fontWeight: '600' }}>
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Loading...</div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                <Bell size={24} style={{ marginBottom: '8px', opacity: 0.3 }} />
                <div>No notifications yet</div>
              </div>
            ) : notifications.map(notif => {
              const config = typeConfig[notif.type] || typeConfig.info;
              const Icon = config.icon;
              return (
                <div key={notif.id} onClick={() => handleClick(notif)}
                  style={{ display: 'flex', gap: '12px', padding: '14px 20px', borderBottom: '1px solid #F8FAFC', cursor: notif.link ? 'pointer' : 'default', background: notif.read ? 'white' : '#FAFBFF', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'white' : '#FAFBFF'}>
                  <div style={{ width: '32px', height: '32px', background: config.bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} color={config.color} />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: notif.read ? '600' : '700', fontSize: '13px', color: '#0F172A' }}>{notif.title}</span>
                      {!notif.read && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.4', marginBottom: '4px' }}>{notif.message}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8' }}>{timeAgo(notif.created_at)}</div>
                  </div>
                  <button onClick={(e) => deleteNotification(notif.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '2px', flexShrink: 0, alignSelf: 'flex-start' }}>
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
