import { useState } from 'react';
import { Check, Trash2, Plus, Building2, Users, Shield } from 'lucide-react';
import { teamMembers } from '../data/mockData';

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px',
  border: '1px solid #E2E8F0',
  borderRadius: '8px',
  fontSize: '13px',
  color: '#0F172A',
  background: 'white',
  outline: 'none',
  fontFamily: 'Inter, sans-serif',
};

const labelStyle = {
  display: 'block',
  color: '#64748B',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.5px',
  textTransform: 'uppercase',
  marginBottom: '6px',
};

const sectionCard = {
  background: 'white',
  borderRadius: '12px',
  border: '1px solid #E2E8F0',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  marginBottom: '16px',
  overflow: 'hidden',
};

export default function Settings() {
  const [saved, setSaved] = useState(false);
  const [company, setCompany] = useState({
    name: 'Forex Pro Brokers Ltd',
    email: 'compliance@forexprobrokers.com',
    website: 'https://forexprobrokers.com',
    country: 'Cyprus',
    regulator: 'CySEC',
    licenseNo: 'CIF 000/00',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roleStyle = {
    admin: { background: '#EEF2FF', color: '#4338CA' },
    agent: { background: '#F0FDF4', color: '#15803D' },
  };

  return (
    <div style={{ padding: '32px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Settings</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Manage your workspace and team</p>
      </div>

      <div style={{ maxWidth: '680px' }}>
        {/* Company */}
        <div style={sectionCard}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={15} color="#6366F1" />
            <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>Company Information</span>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { label: 'Company Name', key: 'name' },
                { label: 'Compliance Email', key: 'email' },
                { label: 'Website', key: 'website' },
                { label: 'Country', key: 'country' },
                { label: 'Regulator', key: 'regulator' },
                { label: 'License Number', key: 'licenseNo' },
              ].map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <input
                    type="text"
                    value={company[field.key]}
                    onChange={e => setCompany({ ...company, [field.key]: e.target.value })}
                    style={inputStyle}
                    onFocus={e => e.target.style.borderColor = '#6366F1'}
                    onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSave}
              style={{
                marginTop: '16px',
                display: 'flex', alignItems: 'center', gap: '6px',
                background: saved ? '#16A34A' : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                color: 'white', border: 'none', borderRadius: '8px',
                padding: '10px 20px', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                transition: 'background 0.2s',
              }}
            >
              {saved ? <><Check size={14} /> Saved</> : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Team */}
        <div style={sectionCard}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} color="#6366F1" />
              <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>Team Members</span>
            </div>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              color: '#6366F1', fontSize: '12px', fontWeight: '600',
              background: '#EEF2FF', border: 'none', borderRadius: '7px',
              padding: '6px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}>
              <Plus size={13} /> Invite Member
            </button>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {teamMembers.map(member => (
              <div key={member.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: '8px',
                border: '1px solid #F1F5F9', background: '#F8FAFC',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px', height: '34px',
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '11px', fontWeight: '700',
                  }}>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div style={{ color: '#0F172A', fontSize: '13px', fontWeight: '600' }}>{member.name}</div>
                    <div style={{ color: '#94A3B8', fontSize: '11px' }}>{member.email}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ ...roleStyle[member.role], padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                    {member.role}
                  </span>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: member.status === 'active' ? '#22C55E' : '#94A3B8',
                  }} />
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: '2px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* KYC Requirements */}
        <div style={sectionCard}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={15} color="#6366F1" />
            <span style={{ color: '#0F172A', fontSize: '13px', fontWeight: '700' }}>KYC Requirements</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              'Passport / National ID',
              'Proof of Address (max 3 months old)',
              'Source of Funds Declaration',
              'Business License (for corporate clients)',
            ].map((req, i) => (
              <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ accentColor: '#6366F1', width: '14px', height: '14px' }} />
                <span style={{ color: '#475569', fontSize: '13px' }}>{req}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
