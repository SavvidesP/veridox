import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const DEMO_EMAIL = 'demo@crmveridox.com';
const DEMO_PASSWORD = 'Demo2024!';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');

  const handleForgot = async () => {
    setForgotMsg(''); setError('');
    if (!email) { setError('Type your email above first, then tap "Forgot password".'); return; }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' });
    if (err) setError(err.message);
    else setForgotMsg('Reset link sent — check your email.');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoggingIn(true);
    const { error: err } = await signIn(email, password);
    if (err) {
      setError('Invalid email or password.');
      setLoggingIn(false);
    } else {
      navigate('/dashboard');
    }
  };

  const handleDemo = async () => {
    setError('');
    setLoggingIn(true);
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    const { error: err } = await signIn(DEMO_EMAIL, DEMO_PASSWORD);
    if (err) {
      setError('Demo account unavailable. Please try again.');
      setLoggingIn(false);
    } else {
      navigate('/dashboard');
    }
  };

  const s = {
    page: { minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' },
    glow: { position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' },
    card: { background: '#1E293B', border: '1px solid #334155', borderRadius: '16px', padding: '40px', width: '380px', position: 'relative', zIndex: 1, boxShadow: '0 25px 50px rgba(0,0,0,0.5)' },
    logo: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '32px' },
    logoIcon: { width: '44px', height: '44px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    logoText: { color: 'white', fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px' },
    tagline: { color: '#475569', fontSize: '11px', fontWeight: '600', letterSpacing: '1.5px', textAlign: 'center', marginBottom: '28px', textTransform: 'uppercase' },
    heading: { color: 'white', fontSize: '20px', fontWeight: '700', textAlign: 'center', marginBottom: '4px', letterSpacing: '-0.3px' },
    sub: { color: '#64748B', fontSize: '13px', textAlign: 'center', marginBottom: '28px' },
    label: { display: 'block', color: '#94A3B8', fontSize: '12px', fontWeight: '600', marginBottom: '6px', letterSpacing: '0.3px' },
    input: { width: '100%', boxSizing: 'border-box', padding: '10px 14px', background: '#0F172A', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '14px', outline: 'none', marginBottom: '16px', transition: 'border-color 0.15s', fontFamily: 'Inter, sans-serif' },
    btn: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', color: 'white', fontSize: '14px', fontWeight: '600', cursor: loggingIn ? 'not-allowed' : 'pointer', marginTop: '8px', letterSpacing: '0.2px', opacity: loggingIn ? 0.7 : 1, fontFamily: 'Inter, sans-serif' },
  };

  return (
    <div style={s.page}>
      <div style={s.glow} />
      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M5 11 L9 16 L17 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={s.logoText}>Veridox</span>
        </div>
        <div style={s.tagline}>Compliance CRM for Fintech</div>
        <div style={s.heading}>Welcome back</div>
        <div style={s.sub}>Sign in to your workspace</div>

        {/* Demo Banner */}
        <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '14px', marginBottom: '20px', textAlign: 'center' }}>
          <div style={{ color: '#A5B4FC', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>🎯 Try Veridox instantly</div>
          <button onClick={handleDemo} disabled={loggingIn}
            style={{ width: '100%', padding: '9px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '7px', color: '#A5B4FC', fontSize: '13px', fontWeight: '700', cursor: loggingIn ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '0.2px' }}>
            {loggingIn ? 'Loading...' : '⚡ Launch Demo Account'}
          </button>
          <div style={{ color: '#475569', fontSize: '11px', marginTop: '8px' }}>
            No signup needed · Read-only demo data
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, height: '1px', background: '#1E293B' }} />
          <span style={{ color: '#475569', fontSize: '11px', fontWeight: '600' }}>OR SIGN IN</span>
          <div style={{ flex: 1, height: '1px', background: '#1E293B' }} />
        </div>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#F87171', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}
          <label style={s.label}>EMAIL ADDRESS</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={s.input} placeholder="you@company.com" required onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#334155'} />
          <label style={s.label}>PASSWORD</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={s.input} placeholder="••••••••" required onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#334155'} />
          <button type="submit" style={s.btn} disabled={loggingIn}>{loggingIn ? 'Signing in...' : 'Sign in to Veridox'}</button>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <span onClick={handleForgot} style={{ color: '#94A3B8', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Forgot password?</span>
          </div>
          {forgotMsg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 14px', color: '#4ADE80', fontSize: '12px', marginTop: '12px', textAlign: 'center' }}>{forgotMsg}</div>}
        </form>

        <div style={{ marginTop: '24px', padding: '12px', background: '#0F172A', borderRadius: '8px', border: '1px solid #1E293B' }}>
          <div style={{ color: '#475569', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', marginBottom: '6px' }}>SECURITY NOTICE</div>
          <div style={{ color: '#64748B', fontSize: '11px', lineHeight: '1.5' }}>This platform handles regulated client data. All sessions are logged and monitored.</div>
        </div>
      </div>
    </div>
  );
}
