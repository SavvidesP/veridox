import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', color: '#0F172A', background: 'white', outline: 'none', fontFamily: 'Inter, sans-serif' };
const labelStyle = { display: 'block', color: '#64748B', fontSize: '11px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' };

export default function AddClient() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', company: '', country: '', industry: 'Forex', dob: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('clients').insert({
      first_name: form.firstName,
      last_name: form.lastName,
      email: form.email,
      phone: form.phone,
      company_name: form.company,
      country: form.country,
      industry: form.industry,
      status: 'pending',
      risk_level: 'medium',
    });
    if (err) {
      setError('Failed to save client. Please try again.');
      setSaving(false);
    } else {
      setSubmitted(true);
      setTimeout(() => navigate('/clients'), 2000);
    }
  };

  if (submitted) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <CheckCircle size={32} color="#16A34A" />
          </div>
          <h2 style={{ color: '#0F172A', fontSize: '18px', fontWeight: '700', margin: '0 0 8px' }}>Client Added Successfully</h2>
          <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>Redirecting to client list...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={() => navigate('/clients')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'Inter, sans-serif' }}>
        <ArrowLeft size={15} /> Back to Clients
      </button>
      <div style={{ maxWidth: '640px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Add New Client</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 24px' }}>Begin the KYC onboarding process</p>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '12px 16px', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '16px' }}>
            <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>Personal Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { label: 'First Name', key: 'firstName', placeholder: 'John', type: 'text', required: true },
                { label: 'Last Name', key: 'lastName', placeholder: 'Smith', type: 'text', required: true },
                { label: 'Email Address', key: 'email', placeholder: 'john@company.com', type: 'email', required: true },
                { label: 'Phone Number', key: 'phone', placeholder: '+357 99 000000', type: 'tel' },
                { label: 'Date of Birth', key: 'dob', placeholder: '', type: 'date' },
                { label: 'Country', key: 'country', placeholder: 'Cyprus', type: 'text', required: true },
              ].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}{field.required && <span style={{ color: '#E11D48' }}> *</span>}</label>
                  <input required={field.required} type={field.type} value={form[field.key]} placeholder={field.placeholder} onChange={e => setForm({ ...form, [field.key]: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '24px' }}>
            <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #F1F5F9' }}>Company Information</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Company Name <span style={{ color: '#E11D48' }}>*</span></label>
                <input required type="text" value={form.company} placeholder="TradeFast Ltd" onChange={e => setForm({ ...form, company: e.target.value })} style={inputStyle} onFocus={e => e.target.style.borderColor = '#6366F1'} onBlur={e => e.target.style.borderColor = '#E2E8F0'} />
              </div>
              <div>
                <label style={labelStyle}>Industry</label>
                <select value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Forex</option>
                  <option>Payments</option>
                  <option>iGaming</option>
                  <option>Crypto</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '13px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Add Client'}
            </button>
            <button type="button" onClick={() => navigate('/clients')} style={{ background: 'white', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '11px 24px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
