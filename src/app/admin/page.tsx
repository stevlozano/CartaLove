'use client';

import { useState, useEffect } from "react";

interface LoginLog {
  id: number;
  user_id: string;
  display_name: string;
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
            accesos
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
                  <span style={styles.name}>{log.display_name}</span>
                  <span style={styles.badge}>
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
                        ? { background: "#000", color: "#fff" }
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
    background: "#fff",
    color: "#000",
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
    borderBottom: "1px solid #000",
    flexShrink: 0,
  },
  brand: {
    fontWeight: 700,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.2em",
  },
  navRight: {
    display: "flex",
    gap: 4,
  },
  navBtn: {
    border: "1px solid #000",
    borderRadius: 30,
    background: "transparent",
    color: "#000",
    padding: "6px 18px",
    fontSize: "0.75rem",
    fontWeight: 600,
    cursor: "pointer",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    transition: "all 0.15s",
  },
  navBtnActive: {
    background: "#000",
    color: "#fff",
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
    border: "1px solid #000",
    borderRadius: 30,
    padding: "16px 20px",
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
  badge: {
    fontSize: "0.65rem",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    border: "1px solid #000",
    borderRadius: 30,
    padding: "2px 10px",
  },
  time: {
    fontSize: "0.8rem",
    color: "#666",
  },
  meta: {
    fontSize: "0.75rem",
    color: "#666",
    marginBottom: 6,
  },
  desc: {
    fontSize: "0.8rem",
    color: "#333",
    marginTop: 4,
  },
  empty: {
    textAlign: "center",
    color: "#999",
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: "0.15em",
    marginTop: 60,
  },
};
