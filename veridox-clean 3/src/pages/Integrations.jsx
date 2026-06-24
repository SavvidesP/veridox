import { useState } from 'react';
import { Copy, CheckCircle, Webhook, Key, Globe, Book, Zap, Shield, ArrowRight, ExternalLink } from 'lucide-react';

const WEBHOOK_URL = 'https://daulxapmeckxsyhircbn.supabase.co/functions/v1/psp-webhook';
const PLATFORM_URL = 'https://veridox.net';

function CopyBox({ label, value, mono }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div style={{ marginBottom: '12px' }}>
      {label && <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 14px' }}>
        <span style={{ flex: 1, fontSize: '13px', color: '#0F172A', fontFamily: mono ? 'monospace' : 'Inter, sans-serif', wordBreak: 'break-all' }}>{value}</span>
        <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', background: copied ? '#DCFCE7' : 'white', border: `1px solid ${copied ? '#BBF7D0' : '#E2E8F0'}`, borderRadius: '6px', fontSize: '12px', fontWeight: '600', color: copied ? '#166534' : '#475569', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {copied ? <><CheckCircle size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
    </div>
  );
}

function Card({ title, icon: Icon, color, bg, children }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ width: '36px', height: '36px', background: bg, borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

const psps = [
  {
    name: 'Stripe',
    logo: '🟦',
    docs: 'https://stripe.com/docs/webhooks',
    fields: { event_id: 'id', transaction_id: 'metadata.transaction_id', status: 'type', decline_reason: 'data.object.failure_message', decline_code: 'data.object.failure_code' },
    steps: ['Go to Stripe Dashboard → Developers → Webhooks', 'Click "Add endpoint"', 'Paste the Webhook URL below', 'Select events: payment_intent.payment_failed, payment_intent.succeeded', 'Set metadata.transaction_id on each PaymentIntent to match your Transaction ID'],
  },
  {
    name: 'Adyen',
    logo: '🟩',
    docs: 'https://docs.adyen.com/development-resources/webhooks',
    fields: { transaction_id: 'merchantReference', status: 'eventCode', decline_reason: 'reason', decline_code: 'refusalReasonCode' },
    steps: ['Go to Adyen Dashboard → Developers → Webhooks', 'Click "Add webhook" → Standard webhook', 'Paste the Webhook URL below', 'Set merchantReference to your Transaction ID', 'Enable HMAC signature (optional but recommended)'],
  },
  {
    name: 'PaySafe',
    logo: '🟧',
    docs: 'https://developer.paysafe.com/en/webhooks',
    fields: { transaction_id: 'merchantRefNum', status: 'status', decline_reason: 'error.message', decline_code: 'error.code' },
    steps: ['Go to PaySafe Portal → Settings → Webhooks', 'Add new webhook endpoint', 'Paste the Webhook URL below', 'Set merchantRefNum to your Transaction ID', 'Select event types: PAYMENT_FAILED, PAYMENT_COMPLETED'],
  },
  {
    name: 'Checkout.com',
    logo: '🟥',
    docs: 'https://www.checkout.com/docs/webhooks',
    fields: { transaction_id: 'data.reference', status: 'type', decline_reason: 'data.response_summary', decline_code: 'data.response_code' },
    steps: ['Go to Checkout.com Dashboard → Settings → Webhooks', 'Click "New webhook"', 'Paste the Webhook URL below', 'Set reference to your Transaction ID', 'Enable: payment_declined, payment_approved events'],
  },
  {
    name: 'Generic PSP',
    logo: '⚙️',
    docs: null,
    fields: { transaction_id: 'transaction_id', status: 'status', decline_reason: 'decline_reason', decline_code: 'decline_code' },
    steps: ['Configure your PSP to send POST requests to the Webhook URL', 'Include transaction_id in the request body', 'Include status (success/failed)', 'Include decline_reason and decline_code when available', 'Content-Type must be application/json'],
  },
];

export default function Integrations() {
  const [activePsp, setActivePsp] = useState(0);
  const psp = psps[activePsp];

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', margin: 0, letterSpacing: '-0.5px' }}>Integrations</h1>
        <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0' }}>Connect your PSPs to Veridox and receive real-time transaction data</p>
      </div>

      {/* Quick Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <div style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', borderRadius: '14px', padding: '20px', color: 'white' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginBottom: '8px' }}>Platform URL</div>
          <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{PLATFORM_URL}</div>
          <button onClick={() => { navigator.clipboard.writeText(PLATFORM_URL); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
            <Copy size={12} /> Copy
          </button>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #059669, #10B981)', borderRadius: '14px', padding: '20px', color: 'white' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginBottom: '8px' }}>Webhook URL</div>
          <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: '1.4' }}>{WEBHOOK_URL}</div>
          <button onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); }} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: 'white', cursor: 'pointer' }}>
            <Copy size={12} /> Copy
          </button>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)', borderRadius: '14px', padding: '20px', color: 'white' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', opacity: 0.8, marginBottom: '8px' }}>Supported PSPs</div>
          <div style={{ fontSize: '32px', fontWeight: '900', marginBottom: '4px' }}>5+</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Stripe, Adyen, PaySafe, Checkout.com & more</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        {/* PSP List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Select PSP</div>
          {psps.map((p, i) => (
            <button key={i} onClick={() => setActivePsp(i)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: activePsp === i ? '#EEF2FF' : 'white', border: `1px solid ${activePsp === i ? '#C7D2FE' : '#E2E8F0'}`, borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif' }}>
              <span style={{ fontSize: '20px' }}>{p.logo}</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: activePsp === i ? '#4338CA' : '#0F172A' }}>{p.name}</div>
                <div style={{ fontSize: '11px', color: '#94A3B8' }}>{p.steps.length} setup steps</div>
              </div>
              {activePsp === i && <ArrowRight size={14} color="#6366F1" style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>

        {/* PSP Detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Webhook URL for this PSP */}
          <Card title={`${psp.logo} ${psp.name} — Webhook Setup`} icon={Webhook} color="#6366F1" bg="#EEF2FF">
            <CopyBox label="Webhook Endpoint URL" value={WEBHOOK_URL} mono />
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
              Copy this URL and paste it in your {psp.name} dashboard as the webhook endpoint.
            </div>

            <div style={{ fontSize: '11px', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Setup Steps</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {psp.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ width: '22px', height: '22px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#6366F1', flexShrink: 0, marginTop: '1px' }}>{i + 1}</div>
                  <div style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>{step}</div>
                </div>
              ))}
            </div>

            {psp.docs && (
              <a href={psp.docs} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: '#475569', textDecoration: 'none' }}>
                <Book size={14} /> View {psp.name} Docs <ExternalLink size={12} />
              </a>
            )}
          </Card>

          {/* Field Mapping */}
          <Card title="Field Mapping" icon={Zap} color="#F59E0B" bg="#FFFBEB">
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
              Veridox automatically maps these fields from {psp.name} webhook payloads:
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: '10px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F1F5F9' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Veridox Field</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{psp.name} Field</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(psp.fields).map(([veridox, pspField], i) => (
                    <tr key={i} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: '600', color: '#6366F1', fontFamily: 'monospace' }}>{veridox}</td>
                      <td style={{ padding: '10px 14px', fontSize: '12px', color: '#475569', fontFamily: 'monospace' }}>{pspField}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Test Webhook */}
          <Card title="Test Your Integration" icon={Shield} color="#059669" bg="#ECFDF5">
            <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '16px' }}>
              Test your webhook integration by sending a sample payload to the endpoint.
            </div>
            <CopyBox
              label="Sample cURL Request"
              value={`curl -X POST "${WEBHOOK_URL}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"transaction_id": "TXN100049", "status": "failed", "decline_reason": "Insufficient funds", "decline_code": "insufficient_funds", "psp_name": "${psp.name}"}'`}
              mono
            />
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 16px', fontSize: '12px', color: '#166534' }}>
              ✅ After sending, check the transaction <strong>TXN100049</strong> in Veridox to see the decline reason updated automatically.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
