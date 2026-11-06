/**
 * Fuse Design System Tokens (Locked 4 Nov 2026 - Option A: Switchgear Panel / Copper Busbar & Warm Stone)
 *
 * Single source of truth for all colours, semantic status pairs, typography roles,
 * spacing, radii, borders, and motion rules defined in DESIGN_SYSTEM.md.
 * All text and control pairs satisfy WCAG 2.2 AA contrast minimums.
 */

export const FUSE_TOKENS = {
  colors: {
    bgCanvas: "#F6F4EE", // Warm Stone page background across Hub and default widget shell
    bgSurface: "#FFFFFF", // Interactive widget ticket, form inputs, and receipt panels
    bgSubtle: "#ECE8DF", // Quiet metadata strips, table headers, code blocks, and inactive tabs
    bgInverse: "#141619", // Carbon Ink top testnet strip

    textPrimary: "#141619", // 16.48:1 on canvas, 18.13:1 on surface
    textSecondary: "#4E535A", // 7.05:1 on canvas, 7.75:1 on surface, 6.34:1 on subtle
    textMuted: "#656B73", // 5.38:1 on white surface only
    textInverse: "#F6F4EE", // 16.48:1 on Carbon Ink inverse surfaces
    textOnAction: "#FFFFFF", // 4.82:1 on Logo Copper #C24D08, 6.81:1 on Copper Oxide #9E3B0E

    borderRule: "#DAD5C9", // 1px structural grid lines, receipt dividers, and leader dots
    borderControl: "#747980", // 1px input, select, and secondary button borders (4.38:1 on white, 3.99:1 on canvas)
    borderStrong: "#141619", // 2px active widget frame, featured receipt box, and primary CTA border

    actionPrimary: "#C24D08", // Logo Copper: primary CTA fill, active tab bar, builder fee split branch and wiring lines
    actionHover: "#9E3B0E", // Copper Oxide on hover and press (6.81:1 with white text)
    accentText: "#9E3B0E", // Copper Oxide for copper text and links (6.19:1 on stone, 6.81:1 on white)

    focusRing: "#1B4394", // 2px solid Cobalt focus outline with 2px offset (8.39:1 on canvas)
    focusRingInverse: "#F6F4EE", // 2px solid Warm Stone outline with 2px offset on Carbon Ink surfaces

    logoInk: "#131216",
    logoCopper: "#C24D08",
    logoCanvas: "#FBF7EC",
    footerSilhouette: "#CFC9BC",
  },

  status: {
    approved: {
      fg: "#1D6340", // 6.38:1 on #E7F4ED
      bg: "#E7F4ED",
      rule: "#1D6340",
    },
    zeroFee: {
      fg: "#141619", // 14.82:1 on #ECE8DF
      bg: "#ECE8DF",
      rule: "#747980",
    },
    attention: {
      fg: "#7C4D07", // 6.53:1 on #FFF3D9
      bg: "#FFF3D9",
      rule: "#7C4D07",
    },
    blocked: {
      fg: "#A0174A", // Crimson: 6.60:1 on #FCE8EE, 7.03:1 on canvas, 7.73:1 on white (dE 41.7 vs Copper Oxide)
      bg: "#FCE8EE",
      rule: "#A0174A",
    },
    environment: {
      fg: "#28468C", // 7.84:1 on #EBF0FA
      bg: "#EBF0FA",
      rule: "#28468C",
    },
  },

  fonts: {
    display:
      'var(--font-big-shoulders-stencil), "Big Shoulders Stencil Display", "Big Shoulders Stencil Text", "Big Shoulders Stencil", system-ui, sans-serif',
    sans: 'var(--font-b612), "B612", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'var(--font-b612-mono), "B612 Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },

  typography: {
    heroDisplay: {
      desktopSize: "68px",
      desktopLineHeight: "72px",
      mobileSize: "42px",
      mobileLineHeight: "46px",
      weight: 800,
      tracking: "0.04em",
      transform: "uppercase",
    },
    pageTitle: {
      desktopSize: "36px",
      desktopLineHeight: "42px",
      mobileSize: "28px",
      mobileLineHeight: "34px",
      weight: 800,
      tracking: "0.04em",
      transform: "uppercase",
    },
    plateTitle: {
      desktopSize: "20px",
      desktopLineHeight: "20px",
      mobileSize: "20px",
      mobileLineHeight: "20px",
      weight: 800,
      tracking: "0.08em",
      transform: "uppercase",
    },
    sectionTitle: {
      desktopSize: "22px",
      desktopLineHeight: "28px",
      mobileSize: "18px",
      mobileLineHeight: "24px",
      weight: 700,
      tracking: "0em",
      transform: "none",
    },
    metricLarge: {
      desktopSize: "32px",
      desktopLineHeight: "36px",
      mobileSize: "22px",
      mobileLineHeight: "28px",
      weight: 700,
      tabularNums: true,
    },
    body: {
      desktopSize: "16px",
      desktopLineHeight: "24px",
      mobileSize: "15px",
      mobileLineHeight: "22px",
      weight: 400,
    },
    widgetControl: {
      desktopSize: "14px",
      desktopLineHeight: "20px",
      mobileSize: "14px",
      mobileLineHeight: "20px",
      weight: 400,
      tabularNums: true,
    },
    eyebrowLabel: {
      desktopSize: "11px",
      desktopLineHeight: "16px",
      mobileSize: "11px",
      mobileLineHeight: "16px",
      weight: 400,
      tracking: "0.08em",
      transform: "uppercase",
    },
    monoProvenance: {
      desktopSize: "13px",
      desktopLineHeight: "18px",
      mobileSize: "12px",
      mobileLineHeight: "18px",
      weight: 400,
    },
  },

  spacing: {
    s1: "4px",
    s2: "8px",
    s3: "12px",
    s4: "16px",
    s5: "20px",
    s6: "24px",
    s8: "32px",
    s12: "48px",
    s16: "64px",
    s24: "96px",
    s32: "128px",
  },

  layout: {
    hubMaxWidth: "1240px",
    hubGutterDesktop: "32px",
    hubGutterMobile: "16px",
    widgetMinWidth: "320px",
    widgetMaxWidth: "440px",
    widgetPaddingDesktop: "20px",
    widgetPaddingCompact: "14px",
    minHitTarget: "44px",
    docsNavWidth: "220px",
    docsProseMaxWidth: "720px",
  },

  radii: {
    receipt: "0px",
    panel: "2px",
    control: "4px",
  },

  shadows: {
    none: "none",
    hardOffset: "3px 3px 0 #141619",
  },

  motion: {
    transitionFast: "160ms cubic-bezier(0.2, 0, 0, 1)",
    activePressTranslate: "translate(1.5px, 1.5px)",
  },
} as const;

export const FUSE_CSS_VARIABLES: Record<string, string> = {
  "--bg-canvas": FUSE_TOKENS.colors.bgCanvas,
  "--bg-surface": FUSE_TOKENS.colors.bgSurface,
  "--bg-subtle": FUSE_TOKENS.colors.bgSubtle,
  "--bg-inverse": FUSE_TOKENS.colors.bgInverse,
  "--text-primary": FUSE_TOKENS.colors.textPrimary,
  "--text-secondary": FUSE_TOKENS.colors.textSecondary,
  "--text-muted": FUSE_TOKENS.colors.textMuted,
  "--text-inverse": FUSE_TOKENS.colors.textInverse,
  "--text-on-action": FUSE_TOKENS.colors.textOnAction,
  "--border-rule": FUSE_TOKENS.colors.borderRule,
  "--border-control": FUSE_TOKENS.colors.borderControl,
  "--border-strong": FUSE_TOKENS.colors.borderStrong,
  "--action-primary": FUSE_TOKENS.colors.actionPrimary,
  "--action-hover": FUSE_TOKENS.colors.actionHover,
  "--accent-text": FUSE_TOKENS.colors.accentText,
  "--focus-ring": FUSE_TOKENS.colors.focusRing,
  "--focus-ring-inverse": FUSE_TOKENS.colors.focusRingInverse,
  "--logo-ink": FUSE_TOKENS.colors.logoInk,
  "--logo-copper": FUSE_TOKENS.colors.logoCopper,
  "--logo-canvas": FUSE_TOKENS.colors.logoCanvas,
  "--footer-silhouette": FUSE_TOKENS.colors.footerSilhouette,

  "--status-approved-fg": FUSE_TOKENS.status.approved.fg,
  "--status-approved-bg": FUSE_TOKENS.status.approved.bg,
  "--status-approved-rule": FUSE_TOKENS.status.approved.rule,
  "--status-zerofee-fg": FUSE_TOKENS.status.zeroFee.fg,
  "--status-zerofee-bg": FUSE_TOKENS.status.zeroFee.bg,
  "--status-zerofee-rule": FUSE_TOKENS.status.zeroFee.rule,
  "--status-attention-fg": FUSE_TOKENS.status.attention.fg,
  "--status-attention-bg": FUSE_TOKENS.status.attention.bg,
  "--status-attention-rule": FUSE_TOKENS.status.attention.rule,
  "--status-blocked-fg": FUSE_TOKENS.status.blocked.fg,
  "--status-blocked-bg": FUSE_TOKENS.status.blocked.bg,
  "--status-blocked-rule": FUSE_TOKENS.status.blocked.rule,
  "--status-env-fg": FUSE_TOKENS.status.environment.fg,
  "--status-env-bg": FUSE_TOKENS.status.environment.bg,
  "--status-env-rule": FUSE_TOKENS.status.environment.rule,

  "--font-display": FUSE_TOKENS.fonts.display,
  "--font-sans": FUSE_TOKENS.fonts.sans,
  "--font-mono": FUSE_TOKENS.fonts.mono,

  "--radius-receipt": FUSE_TOKENS.radii.receipt,
  "--radius-panel": FUSE_TOKENS.radii.panel,
  "--radius-control": FUSE_TOKENS.radii.control,
  "--shadow-hard": FUSE_TOKENS.shadows.hardOffset,
  "--transition-fast": FUSE_TOKENS.motion.transitionFast,
};
