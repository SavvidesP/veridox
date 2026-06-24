import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, CheckCircle, XCircle, Clock, CreditCard, User, Building, ArrowLeftRight, Shield, Download, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const statusStyle = (s) => {
  if (!s) return { background: '#F1F5F9', color: '#475569' };
  const v = s.toLowerCase();
  if (v === 'success' || v === 'approved') return { background: '#DCFCE7', color: '#166534' };
  if (v === 'failed' || v === 'rejected') return { background: '#FEE2E2', color: '#991B1B' };
  return { background: '#FEF9C3', color: '#854D0E' };
};

const typeStyle = (t) => {
  if (!t) return {};
  return t.toLowerCase() === 'deposit'
    ? { background: '#EEF2FF', color: '#4338CA' }
    : { background: '#FFF7ED', color: '#C2410C' };
};

function formatDate(v) {
  if (!v) return '-';
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatAmount(v, currency) {
  if (v == null) return '-';
  return `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || ''}`;
}

function mask6plus4(accountNo) {
  if (!accountNo) return '-';
  const str = String(accountNo);
  if (str.length <= 10) return str;
  return `${str.slice(0, 6)} ${'•'.repeat(str.length - 10)} ${str.slice(-4)}`;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? '#166534' : '#94A3B8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      {copied ? <><CheckCircle size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

function InfoRow({ label, value, mono, copy, badge, badgeStyle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F8FAFC' }}>
      <span style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600', minWidth: '160px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {badge ? (
          <span style={{ ...badgeStyle, padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>{value}</span>
        ) : (
          <span style={{ fontSize: '13px', color: '#0F172A', fontWeight: mono ? '500' : '600', fontFamily: mono ? 'monospace' : 'Inter, sans-serif' }}>{value || '-'}</span>
        )}
        {copy && value && <CopyButton value={value} />}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, color, bg, children }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ width: '32px', height: '32px', background: bg, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={16} color={color} />
        </div>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function exportSingleLog(tx, log) {
  const line = (label, value) => `${label.padEnd(30)}: ${value || '-'}`;
  const separator = '='.repeat(60);
  const divider = '-'.repeat(60);
  const content = [
    separator,
    `VERIDOX PSP ATTEMPT LOG`,
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    separator,
    '',
    '[ TRANSACTION REFERENCE ]',
    divider,
    line('Transaction ID', tx.transaction_id),
    line('Client', `${tx.first_name || ''} ${tx.last_name || ''}`.trim()),
    line('Account No.', tx.account_no),
    line('Amount', formatAmount(tx.amount, tx.account_currency)),
    line('Type', tx.type),
    '',
    '[ PSP ATTEMPT DETAILS ]',
    divider,
    line('Attempt No.', String(log.attempt_number)),
    line('PSP Name', log.psp_name),
    line('Status', log.status),
    line('Reason', log.reason),
    line('Timestamp', formatDate(log.created_at)),
    '',
    log.request_payload ? ['[ REQUEST PAYLOAD ]', divider, JSON.stringify(log.request_payload, null, 2), ''].join('\n') : '',
    log.response_payload ? ['[ RESPONSE PAYLOAD ]', divider, JSON.stringify(log.response_payload, null, 2), ''].join('\n') : '',
    separator,
    `END OF LOG — Veridox Compliance CRM`,
    separator,
  ].filter(s => s !== '').join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `psp-log-${tx.transaction_id}-attempt${log.attempt_number}-${log.psp_name}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllLogs(tx, logs) {
  const separator = '='.repeat(60);
  const divider = '-'.repeat(60);
  const line = (label, value) => `${label.padEnd(30)}: ${value || '-'}`;

  const content = [
    separator,
    `VERIDOX FULL TRANSACTION LOG`,
    `Generated: ${new Date().toLocaleString('en-GB')}`,
    separator,
    '',
    '[ TRANSACTION OVERVIEW ]',
    divider,
    line('Transaction ID', tx.transaction_id),
    line('Status', tx.transaction_approval),
    line('Type', tx.type),
    line('Date', formatDate(tx.created_date)),
    line('Client', `${tx.first_name || ''} ${tx.last_name || ''}`.trim()),
    line('Account No.', tx.account_no),
    line('Amount', formatAmount(tx.amount, tx.account_currency)),
    line('Brand', tx.brand_name),
    '',
    `[ PSP ATTEMPTS (${logs.length} total) ]`,
    divider,
    ...logs.map(log => [
      `ATTEMPT ${log.attempt_number} — ${log.psp_name}`,
      line('  Status', log.status),
      line('  Reason', log.reason),
      line('  Timestamp', formatDate(log.created_at)),
      log.request_payload ? `  Request : ${JSON.stringify(log.request_payload)}` : '',
      log.response_payload ? `  Response: ${JSON.stringify(log.response_payload)}` : '',
      '',
    ].filter(Boolean).join('\n')),
    separator,
    `END OF LOG — Veridox Compliance CRM`,
    separator,
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `full-log-${tx.transaction_id}-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tx, setTx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [relatedTx, setRelatedTx] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showAddLog, setShowAddLog] = useState(false);
  const [logForm, setLogForm] = useState({ psp_name: '', attempt_number: 1, status: 'failed', reason: '', request_payload: '', response_payload: '' });
  const [savingLog, setSavingLog] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data } = await supabase.from('transactions').select('*').eq('id', id).single();
      setTx(data);
      if (data?.account_no) {
        const { data: related } = await supabase.from('transactions').select('*').eq('account_no', data.account_no).neq('id', id).order('created_date', { ascending: false }).limit(5);
        setRelatedTx(related || []);
      }
      const { data: txLogs } = await supabase.from('transaction_logs').select('*').eq('transaction_id', data?.transaction_id || '').order('attempt_number', { ascending: true });
      setLogs(txLogs || []);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  async function saveLog() {
    if (!logForm.psp_name) return;
    setSavingLog(true);
    let reqPayload = null, resPayload = null;
    try { reqPayload = logForm.request_payload ? JSON.parse(logForm.request_payload) : null; } catch { reqPayload = { raw: logForm.request_payload }; }
    try { resPayload = logForm.response_payload ? JSON.parse(logForm.response_payload) : null; } catch { resPayload = { raw: logForm.response_payload }; }

    await supabase.from('transaction_logs').insert({
      transaction_id: tx.transaction_id,
      psp_name: logForm.psp_name,
      attempt_number: parseInt(logForm.attempt_number),
      status: logForm.status,
      reason: logForm.reason,
      request_payload: reqPayload,
      response_payload: resPayload,
    });

    const { data: txLogs } = await supabase.from('transaction_logs').select('*').eq('transaction_id', tx.transaction_id).order('attempt_number', { ascending: true });
    setLogs(txLogs || []);
    setLogForm({ psp_name: '', attempt_number: (parseInt(logForm.attempt_number) + 1), status: 'failed', reason: '', request_payload: '', response_payload: '' });
    setSavingLog(false);
    setShowAddLog(false);
  }

  async function deleteLog(logId) {
    if (!window.confirm('Delete this log entry?')) return;
    await supabase.from('transaction_logs').delete().eq('id', logId);
    setLogs(prev => prev.filter(l => l.id !== logId));
  }

  if (loading) return <div style={{ padding: '32px', color: '#64748B', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Loading...</div>;
  if (!tx) return <div style={{ padding: '32px', color: '#64748B', fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Transaction not found.</div>;

  const sStyle = statusStyle(tx.transaction_approval);
  const StatusIcon = tx.transaction_approval?.toLowerCase() === 'success' ? CheckCircle : tx.transaction_approval?.toLowerCase() === 'failed' ? XCircle : Clock;
  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #E2E8F0', borderRadius: '7px', fontSize: '13px', outline: 'none', fontFamily: 'Inter, sans-serif' };
  const labelStyle = { display: 'block', fontSize: '11px', fontWeight: '600', color: '#64748B', marginBottom: '4px' };

  return (
    <div style={{ padding: '32px', fontFamily: "'Inter', sans-serif", maxWidth: '1100px' }}>
      <button onClick={() => navigate('/transactions')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '20px', fontFamily: 'Inter, sans-serif' }}>
        <ArrowLeft size={15} /> Back to Transactions
      </button>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}>{tx.transaction_id}</span>
              <CopyButton value={tx.transaction_id} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ ...sStyle, padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <StatusIcon size={13} /> {tx.transaction_approval || 'Unknown'}
              </span>
              {tx.type && <span style={{ ...typeStyle(tx.type), padding: '4px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}>{tx.type}</span>}
              <span style={{ color: '#64748B', fontSize: '13px' }}>{formatDate(tx.created_date)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#0F172A', letterSpacing: '-1px' }}>{formatAmount(tx.amount, tx.account_currency)}</div>
            {tx.usd_amount && <div style={{ fontSize: '13px', color: '#94A3B8' }}>≈ {formatAmount(tx.usd_amount, 'USD')}</div>}
            {logs.length > 0 && (
              <button onClick={() => exportAllLogs(tx, logs)}
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 16px', background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', color: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                <Download size={14} /> Export All Logs
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <Section title="Client Information" icon={User} color="#6366F1" bg="#EEF2FF">
          <InfoRow label="Full Name" value={`${tx.first_name || ''} ${tx.last_name || ''}`.trim()} />
          <InfoRow label="Account No." value={tx.account_no} mono copy />
          <InfoRow label="Account (6+4)" value={mask6plus4(tx.account_no)} mono />
          <InfoRow label="Department" value={tx.department} />
          <InfoRow label="Department Type" value={tx.department_type} />
          <InfoRow label="Deposit Owner" value={tx.deposit_owner} />
          <InfoRow label="Country" value={tx.country_group} />
        </Section>

        <Section title="Payment Details" icon={CreditCard} color="#8B5CF6" bg="#F5F3FF">
          <InfoRow label="Brand" value={tx.brand_name} />
          <InfoRow label="Payment Method" value={tx.payment_method} />
          <InfoRow label="Currency" value={tx.account_currency} />
          <InfoRow label="Amount" value={formatAmount(tx.amount, tx.account_currency)} />
          <InfoRow label="USD Amount" value={formatAmount(tx.usd_amount, 'USD')} />
          <InfoRow label="Exchange Rate" value={tx.exchange_rate ? `1 ${tx.account_currency} = ${tx.exchange_rate} USD` : null} />
          <InfoRow label="Net Deposit" value={formatAmount(tx.net_deposit, tx.account_currency)} />
          <InfoRow label="Confirmation Date" value={formatDate(tx.confirmation_date)} />
        </Section>

        <Section title="PSP & Processing" icon={Building} color="#059669" bg="#ECFDF5">
          <InfoRow label="PSP" value={tx.psp_actual} />
          <InfoRow label="PSP Category" value={tx.psp_actual_category} />
          <InfoRow label="PSP Transaction ID" value={tx.psp_transaction_id} mono copy />
          <InfoRow label="Payment Processor" value={tx.payment_processor} />
          <InfoRow label="Sub PSP" value={tx.sub_psp} />
          <InfoRow label="Sub PSP Txn ID" value={tx.sub_psp_transaction_id} mono copy />
          <InfoRow label="Cleared By" value={tx.cleared_by_name} />
          <InfoRow label="Status" value={tx.transaction_approval} badge badgeStyle={sStyle} />
        </Section>

        {/* PSP Attempt Logs */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', background: '#FFFBEB', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowLeftRight size={16} color="#F59E0B" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>PSP Attempt Logs</span>
            </div>
            <button onClick={() => setShowAddLog(!showAddLog)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: '#4338CA', cursor: 'pointer' }}>
              <Plus size={13} /> Add Attempt
            </button>
          </div>

          {/* Add Log Form */}
          {showAddLog && (
            <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '16px', marginBottom: '16px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={labelStyle}>PSP Name *</label>
                  <input value={logForm.psp_name} onChange={e => setLogForm(f => ({ ...f, psp_name: e.target.value }))} placeholder="e.g. Stripe" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Attempt #</label>
                  <input type="number" value={logForm.attempt_number} onChange={e => setLogForm(f => ({ ...f, attempt_number: e.target.value }))} min="1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={logForm.status} onChange={e => setLogForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                    <option value="failed">Failed</option>
                    <option value="success">Success</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Reason</label>
                  <input value={logForm.reason} onChange={e => setLogForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Insufficient funds" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Request Payload (JSON)</label>
                  <textarea value={logForm.request_payload} onChange={e => setLogForm(f => ({ ...f, request_payload: e.target.value }))} placeholder='{"amount": 100, "currency": "EUR"}' rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
                </div>
                <div>
                  <label style={labelStyle}>Response Payload (JSON)</label>
                  <textarea value={logForm.response_payload} onChange={e => setLogForm(f => ({ ...f, response_payload: e.target.value }))} placeholder='{"status": "declined", "code": "do_not_honor"}' rows={2} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '11px' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddLog(false)} style={{ padding: '7px 16px', border: '1px solid #E2E8F0', borderRadius: '7px', background: 'white', fontSize: '12px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveLog} disabled={!logForm.psp_name || savingLog}
                  style={{ padding: '7px 16px', background: !logForm.psp_name ? '#E2E8F0' : 'linear-gradient(135deg, #6366F1, #8B5CF6)', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '600', color: !logForm.psp_name ? '#94A3B8' : 'white', cursor: !logForm.psp_name ? 'not-allowed' : 'pointer' }}>
                  {savingLog ? 'Saving...' : 'Save Attempt'}
                </button>
              </div>
            </div>
          )}

          {/* Log Entries */}
          {logs.length === 0 ? (
            <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              No PSP attempts logged yet. Click <strong>Add Attempt</strong> to add one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {logs.map((log, i) => (
                <div key={log.id} style={{ display: 'flex', gap: '14px', paddingBottom: i < logs.length - 1 ? '16px' : '0', marginBottom: i < logs.length - 1 ? '16px' : '0', borderBottom: i < logs.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: log.status === 'success' ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {log.status === 'success' ? <CheckCircle size={14} color="#166634" /> : <XCircle size={14} color="#991B1B" />}
                    </div>
                    {i < logs.length - 1 && <div style={{ width: '2px', flex: 1, background: '#E2E8F0', minHeight: '20px' }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>#{log.attempt_number} — {log.psp_name}</span>
                        <span style={{ background: log.status === 'success' ? '#DCFCE7' : '#FEE2E2', color: log.status === 'success' ? '#166534' : '#991B1B', padding: '2px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '600' }}>
                          {log.status === 'success' ? 'Approved' : 'Failed'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => exportSingleLog(tx, log)}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#475569', cursor: 'pointer' }}>
                          <Download size={11} /> Export
                        </button>
                        <button onClick={() => deleteLog(log.id)}
                          style={{ padding: '4px 6px', border: '1px solid #FEE2E2', borderRadius: '6px', background: '#FFF5F5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={11} color="#EF4444" />
                        </button>
                      </div>
                    </div>
                    {log.reason && <div style={{ fontSize: '12px', color: '#64748B' }}>{log.reason}</div>}
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{formatDate(log.created_at)}</div>
                    {(log.request_payload || log.response_payload) && (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                        {log.request_payload && (
                          <div style={{ background: '#F1F5F9', borderRadius: '6px', padding: '6px 10px', fontSize: '10px', fontFamily: 'monospace', color: '#475569', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            REQ: {JSON.stringify(log.request_payload)}
                          </div>
                        )}
                        {log.response_payload && (
                          <div style={{ background: '#FEF9C3', borderRadius: '6px', padding: '6px 10px', fontSize: '10px', fontFamily: 'monospace', color: '#854D0E', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            RES: {JSON.stringify(log.response_payload)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Related Transactions */}
      {relatedTx.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={16} color="#6366F1" />
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>Other Transactions — Account {tx.account_no}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Date', 'Transaction ID', 'Type', 'Amount', 'PSP', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#94A3B8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relatedTx.map(r => (
                <tr key={r.id} onClick={() => navigate(`/transactions/${r.id}`)} style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <td style={{ padding: '11px 16px', color: '#64748B', fontSize: '12px' }}>{formatDate(r.created_date)}</td>
                  <td style={{ padding: '11px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600', fontFamily: 'monospace' }}>{r.transaction_id}</td>
                  <td style={{ padding: '11px 16px' }}>{r.type && <span style={{ ...typeStyle(r.type), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{r.type}</span>}</td>
                  <td style={{ padding: '11px 16px', color: '#0F172A', fontSize: '12px', fontWeight: '600' }}>{formatAmount(r.amount, r.account_currency)}</td>
                  <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>{r.psp_actual || '-'}</td>
                  <td style={{ padding: '11px 16px' }}>{r.transaction_approval && <span style={{ ...statusStyle(r.transaction_approval), padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>{r.transaction_approval}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
