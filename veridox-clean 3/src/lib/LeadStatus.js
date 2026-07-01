// Shared lead call-disposition model (used by Sales CRM + agent/manager dashboards).
// New defaults on assignment and is GREEN; Callback lets the agent set a date/time.
export const DISPOSITIONS = [
  { value: 'new',            label: 'New',            color: '#15803D', border: '#BBF7D0', bg: '#F0FDF4' },
  { value: 'no_answer',      label: 'No Answer',      color: '#6B7280', border: '#E5E7EB', bg: '#F9FAFB' },
  { value: 'not_interested', label: 'Not Interested', color: '#DC2626', border: '#FECACA', bg: '#FEF2F2' },
  { value: 'invalid',        label: 'Invalid',        color: '#9CA3AF', border: '#E5E7EB', bg: '#F9FAFB' },
  { value: 'reshuffle',      label: 'Reshuffle',      color: '#7C3AED', border: '#DDD6FE', bg: '#F5F3FF' },
  { value: 'declined',       label: 'Declined',       color: '#B91C1C', border: '#FECACA', bg: '#FEF2F2' },
  { value: 'converted',      label: 'Converted',      color: '#16A34A', border: '#BBF7D0', bg: '#F0FDF4' },
  { value: 'callback',       label: 'Callback',       color: '#D97706', border: '#FDE68A', bg: '#FFFBEB' },
];

export const dispMap = Object.fromEntries(DISPOSITIONS.map(d => [d.value, d]));

// ISO ⇄ <input type="datetime-local"> value
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
