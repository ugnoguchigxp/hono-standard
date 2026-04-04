import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // ============================================================
      // Design Tokens — CSS 変数へのマッピング
      //
      // 使い方:
      //   font-size-base を変える → text-base-token 等が自動追従
      //   spacing-unit を変える  → gap-density-* が自動追従
      //   radius-factor を変える → rounded-token-* が自動追従
      //   shadow-*          → shadow-token-* として利用可能
      // ============================================================

      // === Font Size (CSS変数ベース) ===
      fontSize: {
        'token-sm':  'var(--font-size-sm)',
        'token-md':  'var(--font-size-md)',
        'token-base':'var(--font-size-base)',
        'token-lg':  'var(--font-size-lg)',
        'token-xl':  'var(--font-size-xl)',
        'token-2xl': 'var(--font-size-2xl)',
        'token-3xl': 'var(--font-size-3xl)',
      },

      // === UI Density / Spacing (CSS変数ベース) ===
      spacing: {
        'density-xs':  'var(--spacing-xs)',
        'density-sm':  'var(--spacing-sm)',
        'density-md':  'var(--spacing-md)',
        'density-lg':  'var(--spacing-lg)',
        'density-xl':  'var(--spacing-xl)',
        'density-2xl': 'var(--spacing-2xl)',
      },

      // === Border Radius (CSS変数ベース) ===
      borderRadius: {
        'token-none': 'var(--radius-none)',
        'token-sm':   'var(--radius-sm)',
        'token':      'var(--radius)',
        'token-md':   'var(--radius-md)',
        'token-lg':   'var(--radius-lg)',
        'token-xl':   'var(--radius-xl)',
        'token-full': 'var(--radius-full)',
      },

      // === Drop Shadows (CSS変数ベース) ===
      boxShadow: {
        'token-none':  'var(--shadow-none)',
        'token-xs':    'var(--shadow-xs)',
        'token-sm':    'var(--shadow-sm)',
        'token-md':    'var(--shadow-md)',
        'token-lg':    'var(--shadow-lg)',
        'token-xl':    'var(--shadow-xl)',
        'token-inner': 'var(--shadow-inner)',
      },

      // === Semantic Colors (CSS変数ベース) ===
      colors: {
        background:  'var(--background)',
        foreground:  'var(--foreground)',
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT:    'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT:    'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT:    'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT:    'var(--destructive)',
        },
        border:  'var(--border)',
        input:   'var(--input)',
        ring:    'var(--ring)',
        sidebar: {
          DEFAULT:             'var(--sidebar)',
          foreground:          'var(--sidebar-foreground)',
          primary:             'var(--sidebar-primary)',
          'primary-foreground':'var(--sidebar-primary-foreground)',
          accent:              'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border:              'var(--sidebar-border)',
          ring:                'var(--sidebar-ring)',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
