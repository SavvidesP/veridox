import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { Users, Plus, Trash2, X, Copy, Check, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// Secondary client used ONLY to create invited users via signUp, without
// touching the current admin's session (persistSession: false).
const inviteClient = createClient(
  'https://daulxapmeckxsyhircbn.supabase.co',
  'sb_publishable_ipNGBD8g_ncDIXze2vjCkA_S0EStRIJ',
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const slug = (s) => (s || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 9; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p + '!' + Math.floor(10 + Math.random() * 89);
}

const roleStyle = {
  admin: { background: '#EEF2FF', color: '#4338CA' },
  agent: { background: '#F0FDF4', color: '#15803D' },
};

function CopyRow({ label, value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '10px 12px', background: '#F9FAFB', borderRadius: '8px', border: '1px solid #F3F4F6' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '10px', color: '#9CA3AF', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
        <div style={{ fontSize: '13px', color: '#111827', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', border: '1px solid #E5E7EB', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#6B7280', flexShrink: 0 }}>
        {copied ? <Check size={12} color="#16A34A" /> : <Copy size={12} />}{copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export default function Settings() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('agent');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null); // generated credentials to show

  useEffect(() => { loadMembers(); }, [user?.id]);

  async function loadMembers() {
    setLoading(true);
    // Bootstrap: ensure the current (owner) user has a profile, as admin.
    if (user?.id) {
      const { data: me } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
      if (!me) {
        await supabase.from('profiles').insert({
          id: user.id,
          full_name: profile?.full_name || user.email?.split('@')[0] || 'Admin',
          email: user.email,
          username: slug(user.email?.split('@')[0] || 'admin'),
          role: 'admin',
          active: true,
        });
      }
    }
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  }

  function resetInvite() {
    setFirstName(''); setLastName(''); setRole('agent'); setError(''); setCreated(null); setCreating(false);
  }

  async function handleInvite() {
    if (!firstName.trim() || !lastName.trim()) { setError('Enter first and last name.'); return; }
    setCreating(true); setError('');
    const username = `${slug(firstName)}.${slug(lastName)}`;
    const email = `${username}.${Math.floor(1000 + Math.random() * 9000)}@veridox.net`;
    const password = genPassword();

    // 1) Create the auth user (separate client → admin stays logged in)
    const { data, error: signErr } = await inviteClient.auth.signUp({ email, password });
    if (signErr || !data?.user) {
      setError(signErr?.message || 'Could not create user.');
      setCreating(false);
      return;
    }
    // 2) Create their profile (team membership + role)
    const { error: profErr } = await supabase.from('profiles').insert({
      id: data.user.id,
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      email, username, role, active: true,
    });
    if (profErr) { setError('User created but profile failed: ' + profErr.message); setCreating(false); return; }

    setCreated({ name: `${firstName.trim()} ${lastName.trim()}`, email, username, password });
    setCreating(false);
    loadMembers();
  }

  async function changeRole(member, newRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', member.id);
    setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m));
  }

  async function removeMember(member) {
    if (member.id === user?.id) { alert("You can't remove yourself."); return; }
    if (!confirm(`Remove ${member.full_name || member.email}? They will lose access.`)) return;
    await supabase.from('profiles').delete().eq('id', member.id);
    setMembers(prev => prev.filter(m => m.id !== member.id));
  }

  const initials = (m) => (m.full_name || m.email || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: '40px 44px', fontFamily: "'Inter', sans-serif", background: '#fff', minHeight: '100vh' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ color: '#111827', fontSize: '26px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Settings</h1>
        <p style={{ color: '#9CA3AF', fontSize: '13px', margin: '5px 0 0' }}>Manage your team and access</p>
      </div>

      <div style={{ maxWidth: '760px' }}>
        {/* Team Members — the only panel */}
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} color="#6366F1" />
              <span style={{ color: '#111827', fontSize: '13px', fontWeight: '700' }}>Team Members</span>
              <span style={{ color: '#9CA3AF', fontSize: '12px' }}>· {members.length}</span>
            </div>
            <button onClick={() => { resetInvite(); setShowInvite(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '7px', padding: '7px 13px', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
              <Plus size={13} /> Invite Member
            </button>
          </div>

          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ color: '#D1D5DB', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>Loading…</div>
            ) : members.length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>No team members yet. Invite your first one.</div>
            ) : members.map(member => (
              <div key={member.id} onClick={() => navigate(`/team/${member.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 14px', borderRadius: '8px', border: '1px solid #F3F4F6', background: '#F9FAFB', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'} onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '34px', height: '34px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>{initials(member)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#111827', fontSize: '13px', fontWeight: '600' }}>{member.full_name || '—'}{member.id === user?.id && <span style={{ color: '#9CA3AF', fontWeight: '400' }}> (you)</span>}</div>
                    <div style={{ color: '#9CA3AF', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email}{member.username ? ` · @${member.username}` : ''}</div>
                  </div>
                </div>
                <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  {/* Role toggle */}
                  <div style={{ position: 'relative' }}>
                    <select value={member.role || 'agent'} onChange={e => changeRole(member, e.target.value)}
                      style={{ ...roleStyle[member.role] || roleStyle.agent, appearance: 'none', WebkitAppearance: 'none', border: 'none', borderRadius: '20px', padding: '4px 26px 4px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Inter', sans-serif", textTransform: 'capitalize' }}>
                      <option value="admin">admin</option>
                      <option value="agent">agent</option>
                    </select>
                    <ChevronDown size={12} color="#6B7280" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: member.active === false ? '#9CA3AF' : '#22C55E' }} title={member.active === false ? 'inactive' : 'active'} />
                  <button onClick={() => removeMember(member)} disabled={member.id === user?.id} style={{ background: 'none', border: 'none', cursor: member.id === user?.id ? 'not-allowed' : 'pointer', color: '#D1D5DB', padding: '2px', opacity: member.id === user?.id ? 0.4 : 1 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: '12px', fontSize: '12px', color: '#9CA3AF', lineHeight: 1.5 }}>
          <strong style={{ color: '#6B7280' }}>Admin</strong> sees all panels and every trading account. <strong style={{ color: '#6B7280' }}>Agents</strong> only see the trading accounts they assign to themselves.
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div onClick={() => !creating && setShowInvite(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '440px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#111827' }}>{created ? 'Member created' : 'Invite member'}</div>
              <button onClick={() => setShowInvite(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '4px' }}><X size={18} /></button>
            </div>

            {!created ? (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>First name</label>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: "'Inter', sans-serif" }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Last name</label>
                    <input value={lastName} onChange={e => setLastName(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', outline: 'none', fontFamily: "'Inter', sans-serif" }} />
                  </div>
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Role</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['agent', 'admin'].map(r => (
                      <button key={r} onClick={() => setRole(r)} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${role === r ? '#6366F1' : '#E5E7EB'}`, background: role === r ? '#EEF2FF' : '#fff', color: role === r ? '#4338CA' : '#6B7280', fontSize: '13px', fontWeight: '600', cursor: 'pointer', textTransform: 'capitalize', fontFamily: "'Inter', sans-serif" }}>{r}</button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '16px' }}>Email, username and password are generated automatically. You'll get the credentials to hand over.</div>
                {error && <div style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '12px', padding: '9px 12px', borderRadius: '8px', marginBottom: '14px' }}>{error}</div>}
                <button onClick={handleInvite} disabled={creating} style={{ width: '100%', padding: '11px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer', opacity: creating ? 0.7 : 1, fontFamily: "'Inter', sans-serif" }}>{creating ? 'Creating…' : 'Generate & create member'}</button>
              </div>
            ) : (
              <div style={{ padding: '20px 24px' }}>
                <div style={{ fontSize: '13px', color: '#374151', marginBottom: '14px' }}>✅ <strong>{created.name}</strong> can now sign in to Veridox with these credentials. Copy and hand them over — the password won't be shown again.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
                  <CopyRow label="Email (login)" value={created.email} />
                  <CopyRow label="Username" value={created.username} />
                  <CopyRow label="Password" value={created.password} />
                </div>
                <button onClick={() => { setShowInvite(false); resetInvite(); }} style={{ width: '100%', padding: '11px', background: '#111827', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
