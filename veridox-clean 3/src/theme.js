// Veridox design tokens — single source of truth.
// Identity: monochrome (gray) UI + indigo→purple brand accent (logo, login, primary CTAs).
// Use these instead of hard-coding hex values so the platform stays visually consistent.

export const colors = {
  // Neutrals (gray scale — the canonical UI palette)
  ink:        '#111827', // headings / strong text / monochrome accent
  body:       '#374151', // body text
  muted:      '#6B7280', // secondary text
  faint:      '#9CA3AF', // labels / captions
  disabled:   '#D1D5DB', // empty states / placeholders
  border:     '#E5E7EB', // default borders
  borderSoft: '#F3F4F6', // hairline dividers / inner borders
  bg:         '#FFFFFF', // surfaces
  bgSubtle:   '#F9FAFB', // page / hover background

  // Brand (indigo → purple) — logo, login, primary CTAs, avatars only
  brand:         '#6366F1',
  brand2:        '#8B5CF6',
  brandGradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
  brandSoft:     '#EEF2FF',
};

// Status colors (used sparingly for state — kept across both identities)
export const status = {
  success: { fg: '#16A34A', soft: '#DCFCE7', border: '#BBF7D0' },
  danger:  { fg: '#DC2626', soft: '#FEE2E2', border: '#FECACA' },
  warning: { fg: '#D97706', soft: '#FEF9C3', border: '#FDE68A' },
  info:    { fg: '#2563EB', soft: '#EFF6FF', border: '#BFDBFE' },
};

export const font = "'Inter', system-ui, sans-serif";

export const radius = { sm: '4px', md: '6px', lg: '10px', xl: '12px', pill: '9999px' };

// Common composable style fragments
export const page = {
  padding: '40px 44px',
  fontFamily: font,
  background: colors.bg,
  minHeight: '100vh',
};

export const card = {
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.md,
};

export const sectionLabelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: colors.faint,
  textTransform: 'uppercase',
  letterSpacing: '0.8px',
  marginBottom: '12px',
};

export const buttonPrimary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '9px 18px',
  background: colors.brandGradient,
  border: 'none',
  borderRadius: radius.sm,
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: font,
};

export const buttonSecondary = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '8px 16px',
  background: colors.bg,
  border: `1px solid ${colors.border}`,
  borderRadius: radius.sm,
  color: colors.body,
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: font,
};

export default { colors, status, font, radius, page, card, sectionLabelStyle, buttonPrimary, buttonSecondary };
