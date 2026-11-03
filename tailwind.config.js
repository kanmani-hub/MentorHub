export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    colors: {
      navy: { 50:'#eef2fb',100:'#d9e1f4',200:'#b3c2e6',600:'#1e3a8a',700:'#172f6e',800:'#12244f',900:'#0b1733',950:'#070f22' },
      royal: { 50:'#eef3ff',100:'#dbe6ff',500:'#3b6cf6',600:'#2552e0',700:'#1d42b5' },
      violet2: { 50:'#f4f0ff',100:'#e8e0ff',500:'#7c5cf0',600:'#6941db' },
      ink: { 50:'#f6f7fa',100:'#eceef3',200:'#dde1ea',300:'#c3c9d6',400:'#8d95a8',500:'#667085',600:'#4a5468',700:'#343c4e',800:'#1f2533',900:'#141924' },
    },
    fontFamily: { sans: ['"IBM Plex Sans"','system-ui','sans-serif'], display: ['"Manrope"','"IBM Plex Sans"','system-ui','sans-serif'], mono: ['"IBM Plex Mono"','ui-monospace','monospace'] },
  } },
  plugins: [],
};
