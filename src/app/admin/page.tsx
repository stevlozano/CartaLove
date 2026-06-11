'use client';

import { useState, useEffect } from "react";

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

export default function AdminPage() {
  const [logins, setLogins] = useState<LoginLog[]>([]);
  const [outings, setOutings] = useState<OutingEntry[]>([]);
  const [tab, setTab] = useState<"logins" | "outings">("logins");

  useEffect(() => {
    fetch("/api/admin/data")
      .then((r) => r.json())
      .then((d) => {
        setLogins(d.logins || []);
        setOutings(d.outings || []);
      })
      .catch(console.error);
  }, []);

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

  const icon = (t: string) => t === "login" ? "◀" : "▶";

  return (
    <div style={styles.wrapper}>
      <nav style={styles.nav}>
        <span style={styles.brand}>admin</span>
        <div style={styles.navRight}>
          <button
            onClick={() => setTab("logins")}
            style={{
              ...styles.navBtn,
              ...(tab === "logins" ? styles.navBtnActive : {}),
            }}
          >
            entradas / salidas
          </button>
          <button
            onClick={() => setTab("outings")}
            style={{
              ...styles.navBtn,
              ...(tab === "outings" ? styles.navBtnActive : {}),
            }}
          >
            salidas
          </button>
        </div>
      </nav>

      <main style={styles.main}>
        {tab === "logins" ? (
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
                  <span style={{
                    ...styles.badge,
                    ...(log.user_id === "ella" ? styles.badgeElla : {}),
                  }}>
                    {log.user_id === "él" ? "él" : "ella"}
                  </span>
                </div>
                <div style={styles.time}>{formatDate(log.created_at)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={styles.list}>
            {outings.length === 0 && <p style={styles.empty}>sin salidas</p>}
            {outings.map((o) => (
              <div key={o.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <span style={styles.name}>{o.title}</span>
                  <span
                    style={{
                      ...styles.badge,
                      ...(o.status === "chosen"
                        ? { borderColor: "#e53e3e", color: "#e53e3e" }
                        : {}),
                    }}
                  >
                    {o.status === "chosen" ? "elegida" : "pendiente"}
                  </span>
                </div>
                <div style={styles.meta}>
                  {o.proposer_name} &middot; {o.date}
                </div>
                {o.description && (
                  <div style={styles.desc}>{o.description}</div>
                )}
                {o.location && <div style={styles.desc}>📍 {o.location}</div>}
                {o.when_field && <div style={styles.desc}>📅 {o.when_field}</div>}
              </div>
            ))}
          </div>
        )}
      </main>
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
  },
  nav: {
    height: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    borderBottom: "1px solid rgba(229, 62, 62, 0.3)",
    flexShrink: 0,
  },
  brand: {
    fontWeight: 700,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    color: "#e53e3e",
  },
  navRight: {
    display: "flex",
    gap: 4,
  },
  navBtn: {
    border: "1px solid #e53e3e",
    borderRadius: 30,
    background: "transparent",
    color: "#f5d6d6",
    padding: "6px 18px",
    fontSize: "0.7rem",
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    transition: "all 0.15s",
  },
  navBtnActive: {
    background: "rgba(229, 62, 62, 0.2)",
    color: "#fff",
    borderColor: "#fff",
  },
  main: {
    flex: 1,
    padding: "32px 24px",
    maxWidth: 600,
    margin: "0 auto",
    width: "100%",
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
    marginTop: 60,
  },
};
