'use client';

import { useState, useEffect, useMemo } from "react";

interface LoginLog {
  id: number;
  user_id: string;
  display_name: string;
  type: string;
  created_at: string;
}

interface OutingEntry {
  id: number;
  proposer: string;
  proposer_name: string;
  title: string;
  description: string;
  location: string;
  when_field: string;
  status: string;
  date: string;
  time: string;
}

const MONTHS_ES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_ES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

export default function AdminPage() {
  const [logins, setLogins] = useState<LoginLog[]>([]);
  const [outings, setOutings] = useState<OutingEntry[]>([]);
  const [tab, setTab] = useState<"calendario" | "actividad" | "salidas">("calendario");
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    fetch("/api/admin/data")
      .then((r) => r.json())
      .then((d) => {
        setLogins(d.logins || []);
        setOutings(d.outings || []);
      })
      .catch(console.error);
  }, []);

  // Admin PWA registration
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" });
    }
  }, []);

  // PWA install prompt for admin
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    (installPrompt as any).prompt();
    const result = await (installPrompt as any).userChoice;
    if (result.outcome === 'accepted') setInstallPrompt(null);
  };

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;

  const currentYear = year + Math.floor(month / 12);
  const currentMonth = ((month % 12) + 12) % 12;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;

  const eventsByDay = useMemo(() => {
    const map: Record<string, LoginLog[]> = {};
    for (const log of logins) {
      const d = new Date(log.created_at);
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(log);
      }
    }
    return map;
  }, [logins, currentYear, currentMonth]);

  const dayEvents = selectedDay ? eventsByDay[selectedDay] || [] : [];

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDay = (day: number) =>
    new Date(currentYear, currentMonth, day).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const icon = (t: string) => t === "login" ? "◀" : "▶";

  return (
    <div style={styles.wrapper}>
      <div style={styles.brandBar}>CARTA ADMIN</div>

      <main style={styles.main}>
        {installPrompt && (
          <div style={styles.installBanner}>
            <span>Instala Admin Carta</span>
            <button onClick={handleInstall} style={styles.installBtn}>Instalar</button>
            <button onClick={() => setInstallPrompt(null)} style={styles.installClose}>✕</button>
          </div>
        )}
        {tab === "calendario" && (
          <>
            <div style={styles.calHeader}>
              <button onClick={() => setMonthOffset(m => m - 1)} style={styles.arrow}>‹</button>
              <span style={styles.calTitle}>
                {MONTHS_ES[currentMonth]} {currentYear}
              </span>
              <button onClick={() => setMonthOffset(m => m + 1)} style={styles.arrow}>›</button>
            </div>

            <div style={styles.calGrid}>
              {DAYS_ES.map((d) => (
                <div key={d} style={styles.dayHeader}>{d}</div>
              ))}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = day.toString();
                const events = eventsByDay[key];
                const hasEl = events?.some((e) => e.user_id === "él");
                const hasElla = events?.some((e) => e.user_id === "ella");
                const isSelected = selectedDay === key;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : key)}
                    style={{
                      ...styles.day,
                      ...(isSelected ? styles.daySelected : {}),
                      ...(events ? styles.dayHasEvents : {}),
                    }}
                  >
                    <span style={styles.dayNum}>{day}</span>
                    {(hasEl || hasElla) && (
                      <div style={styles.dots}>
                        {hasEl && <span style={{ ...styles.dot, background: "#e53e3e" }} />}
                        {hasElla && <span style={{ ...styles.dot, background: "#f5d6d6" }} />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedDay && (
              <div style={styles.dayDetail}>
                <div style={styles.dayDetailTitle}>
                  {formatDay(parseInt(selectedDay))}
                </div>
                {dayEvents.length === 0 && (
                  <p style={styles.empty}>sin actividad</p>
                )}
                {dayEvents.map((log) => (
                  <div key={log.id} style={styles.card}>
                    <div style={styles.cardTop}>
                      <span>
                        <span style={styles.name}>
                          {icon(log.type)} {log.display_name}
                        </span>
                        <span style={styles.type}>
                          {log.type === "login" ? " entró" : " salió"}
                        </span>
                      </span>
                      <span style={{ ...styles.badge, ...(log.user_id === "ella" ? styles.badgeElla : {}) }}>
                        {log.user_id === "él" ? "él" : "ella"}
                      </span>
                    </div>
                    <div style={styles.time}>{formatDate(log.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "actividad" && (
          <div style={styles.list}>
            {logins.length === 0 && <p style={styles.empty}>sin registro</p>}
            {logins.map((log) => (
              <div key={log.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <span>
                    <span style={styles.name}>
                      {icon(log.type)} {log.display_name}
                    </span>
                    <span style={styles.type}>
                      {log.type === "login" ? " entró" : " salió"}
                    </span>
                  </span>
                  <span style={{ ...styles.badge, ...(log.user_id === "ella" ? styles.badgeElla : {}) }}>
                    {log.user_id === "él" ? "él" : "ella"}
                  </span>
                </div>
                <div style={styles.time}>{formatDate(log.created_at)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "salidas" && (
          <div style={styles.list}>
            {outings.length === 0 && <p style={styles.empty}>sin salidas</p>}
            {outings.map((o) => (
              <div key={o.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <span style={styles.name}>{o.title}</span>
                  <span style={{ ...styles.badge, ...(o.status === "chosen" ? { borderColor: "#e53e3e", color: "#e53e3e" } : {}) }}>
                    {o.status === "chosen" ? "elegida" : "pendiente"}
                  </span>
                </div>
                <div style={styles.meta}>{o.proposer_name} &middot; {o.date}</div>
                {o.description && <div style={styles.desc}>{o.description}</div>}
                {o.location && <div style={styles.desc}>📍 {o.location}</div>}
                {o.when_field && <div style={styles.desc}>📅 {o.when_field}</div>}
              </div>
            ))}
          </div>
        )}
      </main>

      <nav style={styles.bottomNav}>
        <button onClick={() => setTab("calendario")} style={{ ...styles.tab, ...(tab === "calendario" ? styles.tabActive : {}) }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </button>
        <button onClick={() => setTab("actividad")} style={{ ...styles.tab, ...(tab === "actividad" ? styles.tabActive : {}) }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        </button>
        <button onClick={() => setTab("salidas")} style={{ ...styles.tab, ...(tab === "salidas" ? styles.tabActive : {}) }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </button>
      </nav>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    background: "#050202",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    paddingBottom: 64,
  },
  brandBar: {
    height: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 24px",
    borderBottom: "1px solid rgba(229, 62, 62, 0.3)",
    flexShrink: 0,
    fontWeight: 800,
    fontSize: "0.7rem",
    textTransform: "uppercase",
    letterSpacing: "0.25em",
    color: "#e53e3e",
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    background: "#0e0707",
    borderTop: "1px solid rgba(229, 62, 62, 0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    zIndex: 100,
  },
  tab: {
    background: "transparent",
    border: "none",
    color: "#c4a8a8",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "8px 20px",
    transition: "color 0.15s",
  },
  tabActive: {
    color: "#e53e3e",
  },
  main: {
    flex: 1,
    padding: "24px 20px",
    maxWidth: 700,
    margin: "0 auto",
    width: "100%",
  },
  calHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginBottom: 24,
  },
  calTitle: {
    fontSize: "1.2rem",
    fontWeight: 600,
    textTransform: "capitalize",
    minWidth: 180,
    textAlign: "center",
  },
  arrow: {
    background: "transparent",
    border: "1px solid #e53e3e",
    borderRadius: 30,
    color: "#fff",
    fontSize: "1.4rem",
    width: 40,
    height: 40,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  calGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    marginBottom: 24,
  },
  dayHeader: {
    textAlign: "center",
    fontSize: "0.65rem",
    color: "#c4a8a8",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    padding: "8px 0",
    fontWeight: 600,
  },
  day: {
    aspectRatio: "1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    cursor: "pointer",
    transition: "all 0.15s",
    gap: 2,
  },
  dayHasEvents: {
    border: "1px solid rgba(229, 62, 62, 0.3)",
  },
  daySelected: {
    background: "rgba(229, 62, 62, 0.25)",
    borderColor: "#e53e3e",
  },
  dayNum: {
    fontSize: "0.85rem",
    fontWeight: 500,
  },
  dots: {
    display: "flex",
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "block",
  },
  dayDetail: {
    border: "1px solid rgba(229, 62, 62, 0.25)",
    borderRadius: 30,
    padding: "20px",
    background: "rgba(14, 7, 7, 0.6)",
  },
  dayDetailTitle: {
    fontSize: "0.9rem",
    fontWeight: 600,
    textTransform: "capitalize",
    marginBottom: 16,
    color: "#f5d6d6",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  card: {
    border: "1px solid rgba(229, 62, 62, 0.25)",
    borderRadius: 30,
    padding: "16px 20px",
    background: "rgba(14, 7, 7, 0.6)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  name: {
    fontWeight: 600,
    fontSize: "0.95rem",
  },
  type: {
    fontSize: "0.8rem",
    color: "#c4a8a8",
    marginLeft: 4,
  },
  badge: {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    border: "1px solid #c4a8a8",
    borderRadius: 30,
    padding: "2px 10px",
    color: "#c4a8a8",
  },
  badgeElla: {
    borderColor: "#f5d6d6",
    color: "#f5d6d6",
  },
  time: {
    fontSize: "0.8rem",
    color: "#c4a8a8",
  },
  meta: {
    fontSize: "0.75rem",
    color: "#c4a8a8",
    marginBottom: 6,
  },
  desc: {
    fontSize: "0.8rem",
    color: "#fff",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    color: "#c4a8a8",
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    marginTop: 20,
  },
  installBanner: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    border: "1px solid rgba(229, 62, 62, 0.3)",
    borderRadius: 30,
    marginBottom: 20,
    fontSize: "0.8rem",
    color: "#f5d6d6",
  },
  installBtn: {
    marginLeft: "auto",
    border: "1px solid #e53e3e",
    borderRadius: 30,
    background: "transparent",
    color: "#fff",
    padding: "6px 16px",
    fontSize: "0.7rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  installClose: {
    border: "none",
    background: "transparent",
    color: "#c4a8a8",
    cursor: "pointer",
    fontSize: "1rem",
    padding: 4,
  },
};
