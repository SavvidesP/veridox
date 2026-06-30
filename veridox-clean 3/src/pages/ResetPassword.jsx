import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The recovery link puts a token in the URL; supabase-js turns it into a session.
    supabase.auth.getSession().then(({ data }) => { setHasSession(!!data.session); setChecking(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) { setHasSession(true); setChecking(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) return setError(err.message);
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => navigate('/'), 1800);
  };

  const s = {
    page: { minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: '20px' },
    card: { background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '40px', width: '380px', maxWidth: '100%', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
    logo: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '24px' },
    logoIcon: { width: '44px', height: '44px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    heading: { color: 'white', fontSize: '20px', fontWeight: '700', textAlign: 'center', marginBottom: '4px', letterSpacing: '-0.3px' },
    sub: { color: '#64748B', fontSize: '13px', textAlign: 'center', marginBottom: '24px' },
    label: { display: 'block', color: '#94A3B8', fontSize: '12px', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.3px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', marginBottom: '16px', fontFamily: "'Inter', sans-serif" },
    btn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: "'Inter', sans-serif" },
    link: { color: '#A5B4FC', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', fontFamily: "'Inter', sans-serif" },
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M5 11 L9 16 L17 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ color: 'white', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' }}>Veridox</span>
        </div>

        {checking ? (
          <div style={{ ...s.sub, marginBottom: 0 }}>Loading…</div>
        ) : done ? (
          <>
            <div style={s.heading}>Password updated ✅</div>
            <div style={s.sub}>Redirecting you to sign in…</div>
          </>
        ) : !hasSession ? (
          <>
            <div style={s.heading}>Link expired</div>
            <div style={s.sub}>This reset link is invalid or has expired. Request a new one from the sign-in page.</div>
            <button onClick={() => navigate('/')} style={s.btn}>Back to sign in</button>
          </>
        ) : (
          <>
            <div style={s.heading}>Set a new password</div>
            <div style={s.sub}>Choose a new password for your account.</div>
            <form onSubmit={submit}>
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#F87171', fontSize: '13px', marginBottom: '16px' }}>{error}</div>
              )}
              <label style={s.label}>NEW PASSWORD</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={s.input} placeholder="••••••••" required onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#334155'} />
              <label style={s.label}>CONFIRM PASSWORD</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={s.input} placeholder="••••••••" required onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#334155'} />
              <button type="submit" style={s.btn} disabled={saving}>{saving ? 'Updating…' : 'Update password'}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
