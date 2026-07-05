export const SHARED_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Inter:wght@400;500;600;700&display=swap');

:root {
  --bg-dark: #111827;
  --bg-card: #1F2937;
  --border-subtle: #374151;
  --neon-green: #22C55E;
  --neon-green-hover: #16A34A;
  --neon-purple: #7C3AED;
  --neon-red: #FF3B30;
  --text-muted: #9CA3AF;
  --text-light: #F9FAFB;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background-color: var(--bg-dark);
  color: var(--text-light);
  font-family: 'Inter', sans-serif;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header, h1, h2, h3, h4, .outfit-font {
  font-family: 'Outfit', sans-serif;
}

/* Cards */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

.glass-card {
  background: rgba(31, 41, 55, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

/* Typography */
.text-green { color: var(--neon-green); }
.text-purple { color: var(--neon-purple); }
.text-muted { color: var(--text-muted); }
.text-xs { font-size: 12px; }
.text-sm { font-size: 14px; }
.text-lg { font-size: 18px; }
.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }

/* Buttons */
.btn-primary {
  background: var(--neon-green);
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: inline-block;
}

.btn-primary:hover {
  background: var(--neon-green-hover);
}

.btn-secondary {
  background: transparent;
  color: var(--text-light);
  border: 1px solid var(--border-subtle);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  text-align: center;
  text-decoration: none;
  display: inline-block;
}

/* Layout */
.app-container {
  max-width: 480px; /* Mobile focused */
  margin: 0 auto;
  padding: 16px 16px 80px 16px;
  width: 100%;
  position: relative;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flex-col {
  display: flex;
  flex-direction: column;
}

.gap-2 { gap: 8px; }
.gap-4 { gap: 16px; }

/* Tab Bar */
.tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  background: var(--bg-dark);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  justify-content: space-around;
  padding: 12px 0 24px 0;
  z-index: 100;
}

.tab-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 10px;
  font-weight: 600;
  gap: 4px;
}

.tab-item.active {
  color: var(--text-light);
}

.tab-item svg {
  width: 24px;
  height: 24px;
}
`;
