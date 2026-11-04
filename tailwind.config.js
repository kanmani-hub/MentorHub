/**
 * MentorHub design tokens.
 * Light: off-white page, white cards, muted blue primary, soft slate neutrals.
 * Dark: deep slate page (#151a22), lighter slate surfaces (ink-900), off-white text — never pure black.
 * Status colours are softened versions of green / amber / red so nothing reads as neon in either theme.
 */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // neutrals: light-mode text/borders at the dark end double as dark-mode surfaces
        ink: { 50: '#f5f6f8', 100: '#eef0f3', 200: '#e1e5ea', 300: '#cbd1da', 400: '#8e97a7', 500: '#626d7f', 600: '#4b5566', 700: '#3a4352', 800: '#2b323e', 900: '#1d222b', 950: '#151a22' },
        // primary: muted blue
        royal: { 50: '#eff3fa', 100: '#dfe6f4', 200: '#c3d0ea', 300: '#a3b6de', 400: '#7f98d0', 500: '#5f7cc4', 600: '#4a67b1', 700: '#3c5596', 800: '#31467a' },
        // former deep navy: now soft slate-blue (secondary)
        navy: { 50: '#eff2f7', 100: '#dde3ee', 200: '#bcc8dc', 600: '#465a7e', 700: '#3a4c6c', 800: '#2f3e58', 900: '#1f2a3d', 950: '#171f2e' },
        violet2: { 50: '#f3f2fa', 100: '#e6e3f4', 500: '#8578c4', 600: '#6f63ad' },
        // gentle status colours (override Tailwind defaults used across pages)
        emerald: { 50: '#eef7f2', 100: '#d6ede0', 200: '#b5dcc5', 300: '#8fc7a6', 400: '#6cb48a', 500: '#4f9c72', 600: '#3f865f', 700: '#336d4e', 800: '#2a5740', 900: '#213f30' },
        green: { 50: '#eef7f2', 500: '#4f9c72', 600: '#3f865f', 700: '#336d4e' },
        teal: { 400: '#6cb3aa', 500: '#4f9a91', 600: '#3f8178', 700: '#336961' },
        amber: { 50: '#fcf6ea', 100: '#f8eacb', 200: '#f0d79f', 300: '#e4c27a', 400: '#d6ab5a', 500: '#c99741', 600: '#ad7d32', 700: '#8c632a', 800: '#714f24', 900: '#573d1e' },
        orange: { 50: '#fcf3ec', 300: '#e6b18c', 400: '#d9976a', 500: '#c97f50', 600: '#ad6a40', 700: '#8c5634' },
        yellow: { 400: '#d6ab5a', 500: '#c99741' },
        red: { 50: '#fbf1f0', 100: '#f5dfdc', 200: '#ebc3be', 300: '#dfa39c', 400: '#d0857c', 500: '#bf6a61', 600: '#a8574f', 700: '#8b4842', 800: '#713b37', 900: '#552e2b' },
        rose: { 400: '#d0857c', 500: '#bf6a61', 600: '#a8574f', 700: '#8b4842' },
        blue: { 50: '#eff3fa', 100: '#dfe6f4', 200: '#c3d0ea', 300: '#a8bbe0', 400: '#8aa3d6', 500: '#5f7cc4', 600: '#4a67b1' },
        sky: { 400: '#7fa9cf', 500: '#5f8fbc' },
        violet: { 50: '#f3f2fa', 300: '#bfb6e3', 400: '#a397d6', 500: '#8578c4', 700: '#5d5296' },
        purple: { 500: '#8578c4', 600: '#6f63ad' },
        fuchsia: { 500: '#a678b8' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // readable minimums: nothing in the app renders below 12.5px
      fontSize: {
        xs: ['0.78125rem', { lineHeight: '1.15rem' }],
        sm: ['0.875rem', { lineHeight: '1.35rem' }],
      },
      // calmer headings: "extrabold" renders as bold, "bold" as semibold
      fontWeight: { bold: '600', extrabold: '650' },
      boxShadow: {
        sm: '0 1px 2px rgba(20, 28, 40, 0.04)',
        DEFAULT: '0 1px 3px rgba(20, 28, 40, 0.06)',
        md: '0 4px 12px -2px rgba(20, 28, 40, 0.08)',
        lg: '0 10px 24px -6px rgba(20, 28, 40, 0.12)',
        xl: '0 16px 32px -8px rgba(20, 28, 40, 0.14)',
        '2xl': '0 20px 40px -10px rgba(20, 28, 40, 0.18)',
      },
    },
  },
  plugins: [],
};
