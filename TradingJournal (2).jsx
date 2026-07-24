import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, ListOrdered, CalendarDays, ShieldCheck, Settings2,
  Plus, X, Trash2, Pencil, TrendingUp, TrendingDown, Flame, Target,
  AlertTriangle, ChevronLeft, ChevronRight, Wallet, Percent, CheckCircle2,
  XCircle, Minus
} from "lucide-react";

/* ---------------------------------- THEME ---------------------------------- */
const T = {
  bg: "#0B0E14",
  bgSoft: "#0E1219",
  surface: "#12161F",
  surfaceAlt: "#181D28",
  border: "#232935",
  borderSoft: "#1A2029",
  text: "#E9E7E1",
  textMuted: "#8C93A3",
  textFaint: "#5C6472",
  accent: "#C9A227",
  accentSoft: "rgba(201,162,39,0.14)",
  positive: "#3FB68B",
  positiveSoft: "rgba(63,182,139,0.14)",
  negative: "#E5484D",
  negativeSoft: "rgba(229,72,77,0.14)",
};

const FONT_IMPORT_ID = "tj-font-import";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_IMPORT_ID)) return;
    const link = document.createElement("style");
    link.id = FONT_IMPORT_ID;
    link.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
    `;
    document.head.appendChild(link);
  }, []);
}

/* -------------------------------- HELPERS ---------------------------------- */
const todayISO = () => new Date().toISOString().slice(0, 10);

const fmtMoney = (n, opts = {}) => {
  const sign = n < 0 ? "-" : opts.forceSign && n > 0 ? "+" : "";
  const abs = Math.abs(n);
  return sign + "$" + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtPct = (n, d = 1) => `${n.toFixed(d)}%`;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const SYMBOLS = ["ES", "NQ", "EURUSD", "GBPUSD", "AAPL", "TSLA", "NVDA", "CL", "GC", "BTCUSD"];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function generateDemoTrades() {
  const trades = [];
  const days = 32;
  let balance = 0;
  for (let d = days; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const iso = date.toISOString().slice(0, 10);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends
    const numTrades = Math.random() < 0.75 ? Math.floor(Math.random() * 3) + 1 : 0;
    for (let i = 0; i < numTrades; i++) {
      const win = Math.random() < 0.56;
      const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      const direction = Math.random() < 0.5 ? "long" : "short";
      const entry = +(Math.random() * 400 + 50).toFixed(2);
      const moveP = win ? (Math.random() * 0.018 + 0.003) : -(Math.random() * 0.014 + 0.002);
      const exit = +(entry * (1 + (direction === "long" ? moveP : -moveP))).toFixed(2);
      const size = Math.floor(Math.random() * 8 + 1);
      const fees = +(Math.random() * 4 + 1).toFixed(2);
      const gross = (exit - entry) * size * (direction === "long" ? 1 : -1);
      const pnl = +(gross - fees).toFixed(2);
      balance += pnl;
      trades.push({
        id: uid(),
        date: iso,
        symbol,
        direction,
        entry,
        exit,
        size,
        fees,
        pnl,
        tags: win ? ["plan-a"] : Math.random() < 0.5 ? ["revenge"] : ["plan-a"],
        notes: "",
      });
    }
  }
  return trades;
}

const DEFAULT_SETTINGS = {
  accountName: "Funded Challenge",
  accountSize: 100000,
  startingBalance: 100000,
  profitTargetPct: 10,
  dailyLossLimitPct: 5,
  maxDrawdownPct: 10,
  minTradingDays: 10,
  consistencyRulePct: 30,
};

function computeStats(trades, settings) {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || 0);
  const total = sorted.length;
  const totalPnl = sorted.reduce((s, t) => s + t.pnl, 0);
  const wins = sorted.filter((t) => t.pnl > 0);
  const losses = sorted.filter((t) => t.pnl < 0);
  const winRate = total ? (wins.length / total) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLoss ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
  const best = sorted.reduce((m, t) => (t.pnl > m ? t.pnl : m), -Infinity);
  const worst = sorted.reduce((m, t) => (t.pnl < m ? t.pnl : m), Infinity);

  // current streak (most recent consecutive wins or losses)
  let streak = 0;
  let streakType = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const isWin = sorted[i].pnl > 0;
    if (streakType === null) {
      streakType = isWin;
      streak = 1;
    } else if (isWin === streakType) {
      streak++;
    } else break;
  }

  // daily pnl map
  const dailyPnl = {};
  sorted.forEach((t) => {
    dailyPnl[t.date] = (dailyPnl[t.date] || 0) + t.pnl;
  });
  const tradingDays = Object.keys(dailyPnl).length;

  // equity curve
  let bal = settings.startingBalance;
  const equity = [{ date: "start", balance: bal }];
  sorted.forEach((t) => {
    bal += t.pnl;
    equity.push({ date: t.date, balance: bal });
  });

  // drawdown
  let peak = settings.startingBalance;
  let maxDD = 0;
  equity.forEach((p) => {
    if (p.balance > peak) peak = p.balance;
    const dd = peak - p.balance;
    if (dd > maxDD) maxDD = dd;
  });
  const currentBalance = settings.startingBalance + totalPnl;
  const overallPeak = Math.max(settings.startingBalance, ...equity.map((p) => p.balance));
  const currentDrawdown = Math.max(0, overallPeak - currentBalance);

  // today
  const today = todayISO();
  const todayPnl = dailyPnl[today] || 0;

  // consistency
  const dailyVals = Object.values(dailyPnl);
  const bestDay = dailyVals.length ? Math.max(...dailyVals) : 0;
  const totalProfitSum = dailyVals.filter((v) => v > 0).reduce((s, v) => s + v, 0);
  const consistencyPct = totalProfitSum > 0 ? (bestDay / totalProfitSum) * 100 : 0;

  return {
    total, totalPnl, winRate, avgWin, avgLoss, profitFactor, best, worst,
    streak, streakType, dailyPnl, tradingDays, equity, maxDD, currentDrawdown,
    currentBalance, todayPnl, consistencyPct, bestDay,
  };
}

/* --------------------------------- GAUGE ------------------------------------ */
function Gauge({ percent, status, size = 128, thickness = 10, centerLabel, centerSub }) {
  const clamped = clamp(percent, 0, 100);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const color = status === "breach" ? T.negative : status === "warning" ? T.accent : T.positive;

  const ticks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
        {ticks.map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const outer = size / 2 - 2;
          const inner = size / 2 - 7;
          const cx = size / 2, cy = size / 2;
          return (
            <line
              key={i}
              x1={cx + inner * Math.sin(rad)}
              y1={cy - inner * Math.cos(rad)}
              x2={cx + outer * Math.sin(rad)}
              y2={cy - outer * Math.cos(rad)}
              stroke={T.borderSoft}
              strokeWidth={1.5}
            />
          );
        })}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.surfaceAlt} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div
        style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: size * 0.15, fontWeight: 600, color: T.text }}>
          {centerLabel}
        </div>
        {centerSub && (
          <div style={{ fontSize: size * 0.075, color: T.textMuted, marginTop: 2, textAlign: "center", padding: "0 8px" }}>
            {centerSub}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- SPARK CHART -------------------------------- */
function EquityChart({ data, height = 240 }) {
  const [hover, setHover] = useState(null);
  if (!data || data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: T.textFaint, fontSize: 13 }}>
        Log trades to build your equity curve
      </div>
    );
  }
  const width = 100; // percent-based viewbox
  const vbW = 1000, vbH = 300;
  const balances = data.map((d) => d.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const range = max - min || 1;
  const pad = 20;
  const xStep = (vbW - pad * 2) / (data.length - 1);
  const points = data.map((d, i) => {
    const x = pad + i * xStep;
    const y = pad + (1 - (d.balance - min) / range) * (vbH - pad * 2);
    return [x, y];
  });
  const linePath = points.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1][0]},${vbH - pad} L${points[0][0]},${vbH - pad} Z`;
  const startBal = data[0].balance;
  const endBal = data[data.length - 1].balance;
  const up = endBal >= startBal;
  const lineColor = up ? T.positive : T.negative;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" height={height} preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * vbW;
          let idx = Math.round((relX - pad) / xStep);
          idx = clamp(idx, 0, data.length - 1);
          setHover(idx);
        }}
      >
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={pad} x2={vbW - pad} y1={pad + f * (vbH - pad * 2)} y2={pad + f * (vbH - pad * 2)}
            stroke={T.borderSoft} strokeWidth={1} />
        ))}
        <path d={areaPath} fill="url(#eqFill)" />
        <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2.5} />
        {hover !== null && (
          <>
            <line x1={points[hover][0]} x2={points[hover][0]} y1={pad} y2={vbH - pad} stroke={T.borderSoft} strokeWidth={1} />
            <circle cx={points[hover][0]} cy={points[hover][1]} r={5} fill={lineColor} stroke={T.bg} strokeWidth={2} />
          </>
        )}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute", top: 4, left: 8, background: T.surfaceAlt, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: T.text,
        }}>
          {data[hover].date === "start" ? "Start" : data[hover].date} · {fmtMoney(data[hover].balance)}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- UI ATOMS ---------------------------------- */
function Card({ children, style, className = "" }) {
  return (
    <div className={className} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, ...style }}>
      {children}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, valueColor, sub }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12, color: T.textMuted, letterSpacing: 0.3 }}>{label}</span>
        <Icon size={15} color={T.textFaint} />
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 22, fontWeight: 600, color: valueColor || T.text }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: T.textFaint, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

function Pill({ children, tone = "neutral" }) {
  const map = {
    neutral: { bg: T.surfaceAlt, color: T.textMuted },
    good: { bg: T.positiveSoft, color: T.positive },
    warn: { bg: T.accentSoft, color: T.accent },
    bad: { bg: T.negativeSoft, color: T.negative },
  };
  const s = map[tone];
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, letterSpacing: 0.2 }}>
      {children}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span style={{ fontSize: 12, color: T.textMuted }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  background: T.bgSoft,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: "9px 10px",
  color: T.text,
  fontSize: 13.5,
  outline: "none",
  fontFamily: "'Inter', sans-serif",
  width: "100%",
};

/* -------------------------------- NAV CONFIG --------------------------------- */
const NAV = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "trades", label: "Trades", icon: ListOrdered },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "rules", label: "Rules", icon: ShieldCheck },
  { key: "settings", label: "Settings", icon: Settings2 },
];

/* ================================ MAIN APP =================================== */
export default function TradingJournal() {
  useFonts();
  const [trades, setTrades] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tab, setTab] = useState("overview");
  const [loaded, setLoaded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [selectedDay, setSelectedDay] = useState(null);
  const [symbolFilter, setSymbolFilter] = useState("all");
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const t = await window.storage.get("trades").catch(() => null);
        const s = await window.storage.get("settings").catch(() => null);
        let initTrades = t ? JSON.parse(t.value) : null;
        let initSettings = s ? JSON.parse(s.value) : null;
        if (!initTrades) {
          initTrades = generateDemoTrades();
        }
        if (!initSettings) initSettings = DEFAULT_SETTINGS;
        setTrades(initTrades);
        setSettings(initSettings);
      } catch (e) {
        setStorageError(true);
        setTrades(generateDemoTrades());
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("trades", JSON.stringify(trades)).catch(() => setStorageError(true));
  }, [trades, loaded]);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set("settings", JSON.stringify(settings)).catch(() => setStorageError(true));
  }, [settings, loaded]);

  const stats = useMemo(() => computeStats(trades, settings), [trades, settings]);

  const dailyLossLimitAmt = settings.accountSize * (settings.dailyLossLimitPct / 100);
  const dailyLossUsedPct = stats.todayPnl < 0 ? (Math.abs(stats.todayPnl) / dailyLossLimitAmt) * 100 : 0;
  const dailyLossStatus = dailyLossUsedPct >= 100 ? "breach" : dailyLossUsedPct >= 70 ? "warning" : "good";

  const maxDDAmt = settings.accountSize * (settings.maxDrawdownPct / 100);
  const maxDDUsedPct = (stats.currentDrawdown / maxDDAmt) * 100;
  const maxDDStatus = maxDDUsedPct >= 100 ? "breach" : maxDDUsedPct >= 70 ? "warning" : "good";

  const profitTargetAmt = settings.startingBalance * (settings.profitTargetPct / 100);
  const profitProgressPct = profitTargetAmt ? (stats.totalPnl / profitTargetAmt) * 100 : 0;
  const profitStatus = profitProgressPct >= 100 ? "good" : profitProgressPct >= 60 ? "warning" : "neutral";

  const daysProgressPct = (stats.tradingDays / settings.minTradingDays) * 100;
  const daysStatus = daysProgressPct >= 100 ? "good" : daysProgressPct >= 50 ? "warning" : "neutral";

  const consistencyStatus = stats.consistencyPct > settings.consistencyRulePct ? "breach" : stats.consistencyPct > settings.consistencyRulePct * 0.75 ? "warning" : "good";

  function upsertTrade(trade) {
    setTrades((prev) => {
      const exists = prev.some((t) => t.id === trade.id);
      if (exists) return prev.map((t) => (t.id === trade.id ? trade : t));
      return [...prev, trade];
    });
  }
  function deleteTrade(id) {
    setTrades((prev) => prev.filter((t) => t.id !== id));
  }

  const symbols = useMemo(() => ["all", ...Array.from(new Set(trades.map((t) => t.symbol)))], [trades]);
  const filteredTrades = useMemo(() => {
    const list = symbolFilter === "all" ? trades : trades.filter((t) => t.symbol === symbolFilter);
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [trades, symbolFilter]);

  if (!loaded) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMuted, fontFamily: "'Inter',sans-serif" }}>
        Loading journal…
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "'Inter', sans-serif" }}>
      <div className="flex" style={{ minHeight: "100vh" }}>
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col" style={{ width: 220, borderRight: `1px solid ${T.border}`, padding: "20px 14px", flexShrink: 0 }}>
          <div className="flex items-center gap-2 px-2 mb-8">
            <div style={{ width: 28, height: 28, borderRadius: 7, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: T.bg, fontFamily: "'Space Grotesk', sans-serif" }}>
              Δ
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15.5, letterSpacing: 0.2 }}>Ledgerline</span>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className="flex items-center gap-2.5"
                  style={{
                    padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", textAlign: "left",
                    background: active ? T.surfaceAlt : "transparent",
                    color: active ? T.text : T.textMuted,
                    fontSize: 13.5, fontWeight: active ? 600 : 500,
                  }}
                >
                  <Icon size={16} color={active ? T.accent : T.textFaint} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div style={{ marginTop: "auto", paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: T.textFaint, padding: "0 4px" }}>{settings.accountName}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15, fontWeight: 600, padding: "2px 4px", color: stats.totalPnl >= 0 ? T.positive : T.negative }}>
              {fmtMoney(stats.currentBalance)}
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-col flex-1" style={{ minWidth: 0 }}>
          {/* Top bar */}
          <header className="flex items-center justify-between" style={{ padding: "16px 22px", borderBottom: `1px solid ${T.border}` }}>
            <div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 600 }}>
                {NAV.find((n) => n.key === tab)?.label}
              </h1>
              <div style={{ fontSize: 12, color: T.textFaint, marginTop: 2 }}>
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>
            <button
              onClick={() => { setEditingTrade(null); setModalOpen(true); }}
              className="flex items-center gap-1.5"
              style={{ background: T.accent, color: "#1A1400", border: "none", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={15} /> Add Trade
            </button>
          </header>

          {storageError && (
            <div style={{ background: T.negativeSoft, color: T.negative, fontSize: 12.5, padding: "8px 22px" }}>
              Couldn't reach persistent storage — your data will only last this session.
            </div>
          )}

          <main style={{ padding: "20px 22px 90px", flex: 1, overflowY: "auto" }}>
            {tab === "overview" && (
              <OverviewTab stats={stats} settings={settings}
                dailyLossUsedPct={dailyLossUsedPct} dailyLossStatus={dailyLossStatus}
                maxDDUsedPct={maxDDUsedPct} maxDDStatus={maxDDStatus}
                profitProgressPct={profitProgressPct} profitStatus={profitStatus}
                trades={filteredTrades}
              />
            )}
            {tab === "trades" && (
              <TradesTab
                trades={filteredTrades} symbols={symbols} symbolFilter={symbolFilter} setSymbolFilter={setSymbolFilter}
                onEdit={(t) => { setEditingTrade(t); setModalOpen(true); }} onDelete={deleteTrade}
              />
            )}
            {tab === "calendar" && (
              <CalendarTab trades={trades} month={calendarMonth} setMonth={setCalendarMonth}
                selectedDay={selectedDay} setSelectedDay={setSelectedDay} dailyPnl={stats.dailyPnl} />
            )}
            {tab === "rules" && (
              <RulesTab settings={settings} stats={stats}
                dailyLossUsedPct={dailyLossUsedPct} dailyLossStatus={dailyLossStatus} dailyLossLimitAmt={dailyLossLimitAmt}
                maxDDUsedPct={maxDDUsedPct} maxDDStatus={maxDDStatus} maxDDAmt={maxDDAmt}
                profitProgressPct={profitProgressPct} profitStatus={profitStatus} profitTargetAmt={profitTargetAmt}
                daysProgressPct={daysProgressPct} daysStatus={daysStatus}
                consistencyStatus={consistencyStatus}
              />
            )}
            {tab === "settings" && (
              <SettingsTab settings={settings} setSettings={setSettings}
                onResetDemo={() => setTrades(generateDemoTrades())}
                onClearAll={() => setTrades([])}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden flex" style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.surface, borderTop: `1px solid ${T.border}`, padding: "6px 4px" }}>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <button key={item.key} onClick={() => setTab(item.key)} className="flex flex-col items-center flex-1 gap-1"
              style={{ background: "none", border: "none", padding: "6px 2px", cursor: "pointer" }}>
              <Icon size={18} color={active ? T.accent : T.textFaint} />
              <span style={{ fontSize: 9.5, color: active ? T.text : T.textFaint, fontWeight: active ? 600 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {modalOpen && (
        <TradeModal
          trade={editingTrade}
          onClose={() => setModalOpen(false)}
          onSave={(t) => { upsertTrade(t); setModalOpen(false); }}
        />
      )}
    </div>
  );
}

/* ================================ OVERVIEW TAB ================================ */
function OverviewTab({ stats, settings, dailyLossUsedPct, dailyLossStatus, maxDDUsedPct, maxDDStatus, profitProgressPct, profitStatus, trades }) {
  const streakLabel = stats.streak ? `${stats.streak} ${stats.streakType ? "win" : "loss"}${stats.streak > 1 ? "s" : ""}` : "—";
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <StatCard icon={Wallet} label="Net P&L" value={fmtMoney(stats.totalPnl, { forceSign: true })} valueColor={stats.totalPnl >= 0 ? T.positive : T.negative} />
        <StatCard icon={Percent} label="Win Rate" value={fmtPct(stats.winRate)} sub={`${stats.total} trades`} />
        <StatCard icon={TrendingUp} label="Profit Factor" value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} />
        <StatCard icon={Flame} label="Current Streak" value={streakLabel} valueColor={stats.streak ? (stats.streakType ? T.positive : T.negative) : T.text} />
        <StatCard icon={TrendingUp} label="Best Trade" value={fmtMoney(stats.best === -Infinity ? 0 : stats.best)} valueColor={T.positive} />
        <StatCard icon={TrendingDown} label="Worst Trade" value={fmtMoney(stats.worst === Infinity ? 0 : stats.worst)} valueColor={T.negative} />
      </div>

      <Card style={{ padding: "18px 20px" }}>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600 }}>Equity Curve</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: T.textMuted }}>{fmtMoney(stats.currentBalance)}</span>
        </div>
        <EquityChart data={stats.equity} />
      </Card>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, marginBottom: 14 }}>Prop Firm Rules</div>
          <div className="flex justify-around flex-wrap gap-4">
            <div className="flex flex-col items-center gap-2">
              <Gauge percent={dailyLossUsedPct} status={dailyLossStatus} size={104} thickness={9}
                centerLabel={`${Math.min(999, dailyLossUsedPct).toFixed(0)}%`} centerSub="Daily Loss" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Gauge percent={maxDDUsedPct} status={maxDDStatus} size={104} thickness={9}
                centerLabel={`${Math.min(999, maxDDUsedPct).toFixed(0)}%`} centerSub="Max Drawdown" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Gauge percent={profitProgressPct} status={profitStatus === "neutral" ? "warning" : "good"} size={104} thickness={9}
                centerLabel={`${Math.max(0, profitProgressPct).toFixed(0)}%`} centerSub="Profit Target" />
            </div>
          </div>
        </Card>

        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, marginBottom: 12 }}>Recent Trades</div>
          <div className="flex flex-col gap-2">
            {trades.slice(0, 5).length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No trades logged yet.</div>}
            {trades.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center justify-between" style={{ padding: "7px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600 }}>{t.symbol}</span>
                  <Pill tone="neutral">{t.direction}</Pill>
                  <span style={{ fontSize: 11.5, color: T.textFaint }}>{t.date}</span>
                </div>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 600, color: t.pnl >= 0 ? T.positive : T.negative }}>
                  {fmtMoney(t.pnl, { forceSign: true })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================================= TRADES TAB ================================= */
function TradesTab({ trades, symbols, symbolFilter, setSymbolFilter, onEdit, onDelete }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 12.5, color: T.textMuted }}>Symbol</span>
        <select value={symbolFilter} onChange={(e) => setSymbolFilter(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          {symbols.map((s) => <option key={s} value={s}>{s === "all" ? "All symbols" : s}</option>)}
        </select>
        <span style={{ fontSize: 12, color: T.textFaint, marginLeft: "auto" }}>{trades.length} trades</span>
      </div>
      <Card style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["Date", "Symbol", "Side", "Entry", "Exit", "Size", "P&L", "Tags", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: T.textFaint, fontWeight: 500, fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trades.length === 0 && (
                <tr><td colSpan={9} style={{ padding: "28px", textAlign: "center", color: T.textFaint }}>No trades yet — add your first one.</td></tr>
              )}
              {trades.map((t) => (
                <tr key={t.id} style={{ borderBottom: `1px solid ${T.borderSoft}` }}>
                  <td style={{ padding: "9px 14px", color: T.textMuted, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>{t.date}</td>
                  <td style={{ padding: "9px 14px", fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace" }}>{t.symbol}</td>
                  <td style={{ padding: "9px 14px" }}><Pill tone="neutral">{t.direction}</Pill></td>
                  <td style={{ padding: "9px 14px", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>{t.entry}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>{t.exit}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "'IBM Plex Mono', monospace", color: T.textMuted }}>{t.size}</td>
                  <td style={{ padding: "9px 14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: t.pnl >= 0 ? T.positive : T.negative }}>{fmtMoney(t.pnl, { forceSign: true })}</td>
                  <td style={{ padding: "9px 14px" }}>
                    <div className="flex gap-1 flex-wrap">
                      {(t.tags || []).map((tag) => <Pill key={tag} tone="neutral">{tag}</Pill>)}
                    </div>
                  </td>
                  <td style={{ padding: "9px 14px" }}>
                    <div className="flex gap-1.5">
                      <button onClick={() => onEdit(t)} style={{ background: "none", border: "none", cursor: "pointer" }}><Pencil size={14} color={T.textFaint} /></button>
                      <button onClick={() => onDelete(t.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={T.textFaint} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================================ CALENDAR TAB ================================ */
function CalendarTab({ trades, month, setMonth, selectedDay, setSelectedDay, dailyPnl }) {
  const year = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(year, m, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const maxAbs = Math.max(1, ...Object.values(dailyPnl).map((v) => Math.abs(v)));

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const iso = (d) => `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dayTrades = selectedDay ? trades.filter((t) => t.date === selectedDay) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card style={{ padding: "16px 18px" }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setMonth(new Date(year, m - 1, 1))} style={{ background: "none", border: "none", cursor: "pointer" }}><ChevronLeft size={18} color={T.textMuted} /></button>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15 }}>
            {month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setMonth(new Date(year, m + 1, 1))} style={{ background: "none", border: "none", cursor: "pointer" }}><ChevronRight size={18} color={T.textMuted} /></button>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i} style={{ textAlign: "center", fontSize: 11, color: T.textFaint, paddingBottom: 4 }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateStr = iso(d);
            const pnl = dailyPnl[dateStr];
            const has = pnl !== undefined;
            const intensity = has ? clamp(Math.abs(pnl) / maxAbs, 0.15, 1) : 0;
            const bg = !has ? T.surfaceAlt : pnl >= 0 ? `rgba(63,182,139,${0.12 + intensity * 0.55})` : `rgba(229,72,77,${0.12 + intensity * 0.55})`;
            const isSelected = selectedDay === dateStr;
            return (
              <button key={i} onClick={() => setSelectedDay(dateStr)}
                style={{
                  background: bg, border: isSelected ? `1.5px solid ${T.accent}` : `1px solid ${T.borderSoft}`,
                  borderRadius: 8, padding: "6px 4px", cursor: "pointer", minHeight: 52,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                }}>
                <span style={{ fontSize: 11, color: T.textMuted }}>{d}</span>
                {has && <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, fontWeight: 600, color: pnl >= 0 ? T.positive : T.negative }}>{pnl >= 0 ? "+" : ""}{Math.round(pnl)}</span>}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card style={{ padding: "16px 18px" }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14 }}>{selectedDay}</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: (dailyPnl[selectedDay] || 0) >= 0 ? T.positive : T.negative }}>
              {fmtMoney(dailyPnl[selectedDay] || 0, { forceSign: true })}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {dayTrades.length === 0 && <div style={{ color: T.textFaint, fontSize: 13 }}>No trades this day.</div>}
            {dayTrades.map((t) => (
              <div key={t.id} className="flex items-center justify-between" style={{ padding: "6px 0", borderBottom: `1px solid ${T.borderSoft}` }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13 }}>{t.symbol} · {t.direction}</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: t.pnl >= 0 ? T.positive : T.negative }}>{fmtMoney(t.pnl, { forceSign: true })}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================== RULES TAB ================================== */
function RuleRow({ title, icon: Icon, status, percent, description, right }) {
  const statusMap = {
    good: { label: "On track", tone: "good", Icon: CheckCircle2 },
    warning: { label: "Approaching limit", tone: "warn", Icon: AlertTriangle },
    breach: { label: "Breached", tone: "bad", Icon: XCircle },
    neutral: { label: "In progress", tone: "neutral", Icon: Minus },
  };
  const s = statusMap[status] || statusMap.neutral;
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div className="flex items-center gap-4 flex-wrap">
        <Gauge percent={percent} status={status === "neutral" ? "warning" : status} size={90} thickness={8} centerLabel={`${clamp(percent,0,999).toFixed(0)}%`} />
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="flex items-center gap-2 mb-1">
            <Icon size={15} color={T.textFaint} />
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5 }}>{title}</span>
            <Pill tone={s.tone}>{s.label}</Pill>
          </div>
          <div style={{ fontSize: 12.5, color: T.textMuted }}>{description}</div>
        </div>
        {right && <div style={{ textAlign: "right" }}>{right}</div>}
      </div>
    </Card>
  );
}

function RulesTab({ settings, stats, dailyLossUsedPct, dailyLossStatus, dailyLossLimitAmt, maxDDUsedPct, maxDDStatus, maxDDAmt, profitProgressPct, profitStatus, profitTargetAmt, daysProgressPct, daysStatus, consistencyStatus }) {
  return (
    <div className="flex flex-col gap-3.5">
      <RuleRow
        title="Daily Loss Limit" icon={ShieldCheck} status={dailyLossStatus} percent={dailyLossUsedPct}
        description={`Today's P&L: ${fmtMoney(stats.todayPnl, { forceSign: true })} of ${fmtMoney(-dailyLossLimitAmt)} allowed`}
      />
      <RuleRow
        title="Max Drawdown" icon={ShieldCheck} status={maxDDStatus} percent={maxDDUsedPct}
        description={`Current drawdown ${fmtMoney(stats.currentDrawdown)} of ${fmtMoney(maxDDAmt)} max allowed`}
      />
      <RuleRow
        title="Profit Target" icon={Target} status={profitStatus === "neutral" ? "warning" : "good"} percent={profitProgressPct}
        description={`${fmtMoney(stats.totalPnl)} earned toward ${fmtMoney(profitTargetAmt)} target`}
      />
      <RuleRow
        title="Minimum Trading Days" icon={CalendarDays} status={daysStatus === "neutral" ? "warning" : "good"} percent={daysProgressPct}
        description={`${stats.tradingDays} of ${settings.minTradingDays} required trading days completed`}
      />
      <RuleRow
        title="Consistency Rule" icon={AlertTriangle} status={consistencyStatus} percent={stats.consistencyPct}
        description={`Best day is ${stats.consistencyPct.toFixed(0)}% of total profit — stay under ${settings.consistencyRulePct}%`}
      />
    </div>
  );
}

/* ================================= SETTINGS TAB ================================= */
function SettingsTab({ settings, setSettings, onResetDemo, onClearAll }) {
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);

  function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

  return (
    <div className="flex flex-col gap-5" style={{ maxWidth: 560 }}>
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Account</div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Account name">
            <input style={inputStyle} value={local.accountName} onChange={(e) => setLocal({ ...local, accountName: e.target.value })} />
          </Field>
          <Field label="Account size ($)">
            <input style={inputStyle} type="number" value={local.accountSize} onChange={(e) => setLocal({ ...local, accountSize: num(e.target.value) })} />
          </Field>
          <Field label="Starting balance ($)">
            <input style={inputStyle} type="number" value={local.startingBalance} onChange={(e) => setLocal({ ...local, startingBalance: num(e.target.value) })} />
          </Field>
        </div>
      </Card>

      <Card style={{ padding: "18px 20px" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Prop Firm Rules</div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <Field label="Profit target (%)">
            <input style={inputStyle} type="number" value={local.profitTargetPct} onChange={(e) => setLocal({ ...local, profitTargetPct: num(e.target.value) })} />
          </Field>
          <Field label="Daily loss limit (%)">
            <input style={inputStyle} type="number" value={local.dailyLossLimitPct} onChange={(e) => setLocal({ ...local, dailyLossLimitPct: num(e.target.value) })} />
          </Field>
          <Field label="Max drawdown (%)">
            <input style={inputStyle} type="number" value={local.maxDrawdownPct} onChange={(e) => setLocal({ ...local, maxDrawdownPct: num(e.target.value) })} />
          </Field>
          <Field label="Min trading days">
            <input style={inputStyle} type="number" value={local.minTradingDays} onChange={(e) => setLocal({ ...local, minTradingDays: num(e.target.value) })} />
          </Field>
          <Field label="Consistency rule (%)">
            <input style={inputStyle} type="number" value={local.consistencyRulePct} onChange={(e) => setLocal({ ...local, consistencyRulePct: num(e.target.value) })} />
          </Field>
        </div>
        <button onClick={() => setSettings(local)} style={{ marginTop: 16, background: T.accent, color: "#1A1400", border: "none", borderRadius: 8, padding: "9px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Save settings
        </button>
      </Card>

      <Card style={{ padding: "18px 20px" }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Data</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onResetDemo} style={{ background: T.surfaceAlt, color: T.text, border: `1px solid ${T.border}`, borderRadius: 8, padding: "9px 14px", fontSize: 12.5, cursor: "pointer" }}>
            Load demo trades
          </button>
          <button onClick={onClearAll} style={{ background: T.negativeSoft, color: T.negative, border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, cursor: "pointer" }}>
            Clear all trades
          </button>
        </div>
      </Card>
    </div>
  );
}

/* ================================= TRADE MODAL ================================= */
function TradeModal({ trade, onClose, onSave }) {
  const [form, setForm] = useState(() => trade || {
    id: uid(), date: todayISO(), symbol: "", direction: "long",
    entry: "", exit: "", size: 1, fees: 0, tags: "", notes: "",
  });
  const isEdit = !!trade;

  const entryN = parseFloat(form.entry) || 0;
  const exitN = parseFloat(form.exit) || 0;
  const sizeN = parseFloat(form.size) || 0;
  const feesN = parseFloat(form.fees) || 0;
  const gross = (exitN - entryN) * sizeN * (form.direction === "long" ? 1 : -1);
  const pnlPreview = gross - feesN;

  function submit() {
    if (!form.symbol || !form.entry || !form.exit) return;
    const tags = typeof form.tags === "string" ? form.tags.split(",").map((s) => s.trim()).filter(Boolean) : form.tags;
    onSave({
      id: form.id, date: form.date, symbol: form.symbol.toUpperCase(), direction: form.direction,
      entry: entryN, exit: exitN, size: sizeN, fees: feesN, pnl: +pnlPreview.toFixed(2), tags, notes: form.notes,
    });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, width: 460, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: 22 }}>
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 16 }}>{isEdit ? "Edit trade" : "Add trade"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} color={T.textMuted} /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="Date">
              <input style={inputStyle} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Symbol">
              <input style={inputStyle} placeholder="ES, AAPL…" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} />
            </Field>
          </div>
          <Field label="Direction">
            <div className="flex gap-2">
              {["long", "short"].map((d) => (
                <button key={d} onClick={() => setForm({ ...form, direction: d })}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                    border: `1px solid ${form.direction === d ? T.accent : T.border}`,
                    background: form.direction === d ? T.accentSoft : T.bgSoft,
                    color: form.direction === d ? T.accent : T.textMuted, fontWeight: 600, fontSize: 13, textTransform: "capitalize",
                  }}>{d}</button>
              ))}
            </div>
          </Field>
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <Field label="Entry"><input style={inputStyle} type="number" value={form.entry} onChange={(e) => setForm({ ...form, entry: e.target.value })} /></Field>
            <Field label="Exit"><input style={inputStyle} type="number" value={form.exit} onChange={(e) => setForm({ ...form, exit: e.target.value })} /></Field>
            <Field label="Size"><input style={inputStyle} type="number" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
          </div>
          <Field label="Fees ($)">
            <input style={inputStyle} type="number" value={form.fees} onChange={(e) => setForm({ ...form, fees: e.target.value })} />
          </Field>
          <Field label="Tags (comma separated)">
            <input style={inputStyle} placeholder="plan-a, breakout" value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>

          <div className="flex items-center justify-between" style={{ background: T.bgSoft, borderRadius: 8, padding: "10px 14px", border: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12.5, color: T.textMuted }}>Calculated P&L</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, color: pnlPreview >= 0 ? T.positive : T.negative }}>
              {fmtMoney(pnlPreview, { forceSign: true })}
            </span>
          </div>

          <button onClick={submit} style={{ background: T.accent, color: "#1A1400", border: "none", borderRadius: 8, padding: "11px 0", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 4 }}>
            {isEdit ? "Save changes" : "Add trade"}
          </button>
        </div>
      </div>
    </div>
  );
}
