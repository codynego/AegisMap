"use client";

import { useState, useEffect, useRef } from "react";

const howItWorks = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    title: "Live Community Map",
    desc: "See real-time updates from people around you — shared safely and anonymously when needed. Your neighborhood, in the moment.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l7 4-7 4-7-4 7-4zM5 10v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Awareness Zones",
    desc: "Understand areas with unusual activity or repeated reports. Dynamic risk shading that updates as the community contributes.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    ),
    title: "Instant Alerts",
    desc: "Get notified when something important is happening near you or in places you care about — before it's too late.",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 3l8 5-8 5-8-5 8-5zM4 13v6h16v-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Shared Reporting",
    desc: "Quickly report what you see so others can stay informed. One tap, one report — community awareness starts with you.",
  },
];

const audience = [
  { icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2l9 5-9 5-9-5 9-5zM3 10v6a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ), label: "Students", desc: "Moving around cities and campuses safely." },
  { icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 11l9-6 9 6v6a2 2 0 0 1-2 2h-2v-6H7v6H5a2 2 0 0 1-2-2v-6z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ), label: "Families", desc: "Staying connected and aware in your neighborhood." },
  { icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="7" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="7.5" cy="17.5" r="1.5" fill="currentColor" />
        <circle cx="16.5" cy="17.5" r="1.5" fill="currentColor" />
      </svg>
    ), label: "Riders & Drivers", desc: "Real-time awareness on the road." },
  { icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="6" width="6" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
        <rect x="9.5" y="3" width="11.5" height="15" rx="1" stroke="currentColor" strokeWidth="1.2" />
      </svg>
    ), label: "Urban Communities", desc: "High-traffic areas that need shared situational awareness." },
];

const perks = [
  "Beta access before public launch",
  "Shape features that matter to your community",
  "Early community contributor status",
  "First updates as the platform evolves",
];

export default function GeoPulseLanding() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSubmit = async () => {
    setSubmitError("");
    if (!email.trim() || !email.includes("@")) {
      setSubmitError("Please enter a valid email.");
      return;
    }

    setLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !anonKey) {
        throw new Error("Supabase URL or anon key not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      }

      const payload = [{ email: email.trim(), role: role || null, created_at: new Date().toISOString() }];

      const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Supabase insert failed: ${res.status} ${text}`);
      }

      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      fontFamily: "var(--font-display), 'Space Grotesk', sans-serif",
      background: "transparent",
      color: "var(--on-surface)",
      minHeight: "100vh",
      overflowX: "hidden",
      width: "100%",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --sage: var(--primary);
          --sage-light: rgba(76,215,246,0.08);
          --sage-dark: var(--primary-container);
          --earth: var(--primary);
          --earth-light: rgba(14,165,233,0.12);
          --earth-dark: var(--primary-strong);
          --ink: var(--on-surface);
          --ink-muted: var(--on-surface-variant);
          --ink-faint: var(--outline);
          --cream: transparent;
          --cream-dark: rgba(255,255,255,0.02);
          --white: rgba(255,255,255,0.02);
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .fade-up { animation: fadeUp 0.6s ease both; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.2s; }
        .d3 { animation-delay: 0.35s; }
        .d4 { animation-delay: 0.5s; }

        .card {
          background: var(--white);
          border: 1px solid rgba(26,24,20,0.08);
          border-radius: 20px;
          padding: 28px 24px;
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }
        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(26,24,20,0.08);
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: var(--cream-dark);
          border: 1px solid rgba(26,24,20,0.1);
          border-radius: 9999px;
          padding: 6px 16px;
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.05em;
          color: var(--ink-muted);
          text-transform: uppercase;
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px 28px;
          background: var(--ink);
          color: #060910;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 15px;
          font-weight: 500;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s, transform 0.15s;
          text-decoration: none;
          width: 100%;
        }
        .btn-primary:hover { background: #2d2a24; transform: translateY(-1px); }

        .email-input {
          width: 100%;
          background: rgba(6,10,20,0.85);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 13px 16px;
          font-size: 15px;
          font-family: 'Space Grotesk', sans-serif;
          color: #e8edf2;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .email-input:focus {
          border-color: var(--sage);
          box-shadow: 0 0 0 4px rgba(56,189,248,0.08);
        }
        .email-input::placeholder { color: #64748b; }

        /* Ensure selects match dark input styling and options are readable */
        select.email-input {
          -webkit-appearance: none;
          appearance: none;
          background: rgba(6,10,20,0.85);
          border: 1px solid rgba(255,255,255,0.06);
          color: #e8edf2;
        }
        select.email-input:focus {
          border-color: var(--sage);
          box-shadow: 0 0 0 4px rgba(56,189,248,0.06);
          outline: none;
        }
        select.email-input option {
          background: var(--surface-panel);
          color: var(--on-surface);
        }

        .dot-live {
          width: 8px; height: 8px; border-radius: 50%;
          background: #4ade80;
          animation: pulse 2s ease-in-out infinite;
          display: inline-block;
        }

        .ripple-wrap {
          position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .ripple {
          position: absolute;
          width: 60px; height: 60px;
          border-radius: 50%;
          border: 2px solid var(--sage);
          animation: ripple 2.4s ease-out infinite;
        }
        .ripple:nth-child(2) { animation-delay: 0.8s; }
        .ripple:nth-child(3) { animation-delay: 1.6s; }

        .section-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--sage-dark);
        }

        .serif { font-family: 'Space Grotesk', sans-serif; font-weight: 700; }
        .hero-title { font-weight: 500; }
        @media (min-width: 1024px) { .hero-title { font-weight: 800; } }

        .map-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px clamp(16px, 5vw, 48px)",
        background: "transparent",
        backdropFilter: "none",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink)" }}>
          <span style={{ color: "var(--sage-dark)" }}>Geo</span>Pulse AI
        </span>
        <a href="#waitlist" style={{
          padding: "9px 20px",
          background: "linear-gradient(135deg,#0ea5e9,#06b6d4)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 9999,
          textDecoration: "none",
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
        >
          Join Waitlist
        </a>
      </nav>

      {/* ── HERO ── */}
      <section ref={heroRef} style={{
        position: "relative",
        padding: "clamp(56px, 14vw, 112px) clamp(16px, 5vw, 48px) clamp(48px, 10vw, 80px)",
        textAlign: "center",
        overflow: "hidden",
      }}>
        {/* Background texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(143,175,138,0.18) 0%, transparent 70%)",
        }} />
        <div className="map-blob" style={{ width: 400, height: 400, background: "rgba(143,175,138,0.12)", top: -80, left: "30%", transform: "translateX(-50%)" }} />

        <div style={{ position: "relative", maxWidth: 1100, margin: "0 auto" }}>
          <div className="fade-up d1" style={{ marginBottom: 28 }}>
            <span className="pill">
              <span className="dot-live" />
              Coming Soon — Join the Waitlist
            </span>
          </div>

          <h1 className="fade-up d2 serif hero-title" style={{
            fontSize: "clamp(38px, 8vw, 80px)",
            fontWeight: 400,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            marginBottom: 12,
          }}>
            Community Safety,
            <br />
            <em style={{ color: "var(--sage-dark)", fontStyle: "italic" }}>Powered by Awareness.</em>
          </h1>

          <p className="fade-up d3" style={{
            marginTop: 24,
            fontSize: "clamp(16px, 2.2vw, 19px)",
            lineHeight: 1.75,
            color: "var(--ink-muted)",
            maxWidth: 1000,
            margin: "24px auto 0",
          }}>
            GeoPulse AI is a real-time community awareness platform that helps people stay informed about what's happening around them — so they can make safer decisions, together.
          </p>

          <div className="fade-up d4" style={{ marginTop: 40, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#waitlist" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 28px",
              background: "linear-gradient(135deg,#0ea5e9,#06b6d4)",
              color: "#fff",
              fontSize: 15, fontWeight: 500,
              borderRadius: 12, textDecoration: "none",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.82"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Join the Waitlist →
            </a>
            <a href="#how-it-works" style={{
              display: "inline-flex", alignItems: "center",
              padding: "13px 24px",
              background: "transparent",
              border: "1px solid rgba(26,24,20,0.18)",
              color: "var(--ink-muted)",
              fontSize: 15, fontWeight: 500,
              borderRadius: 12, textDecoration: "none",
            }}>
              See how it works ↓
            </a>
          </div>
        </div>

        {/* Animated map preview */}
        <div style={{
          position: "relative",
          maxWidth: 640,
          margin: "clamp(48px, 8vw, 72px) auto 0",
          height: 320,
          background: "var(--white)",
          borderRadius: 24,
          border: "1px solid rgba(26,24,20,0.08)",
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(26,24,20,0.1)",
        }}>
          {/* Fake map grid */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.06 }}>
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1a1814" strokeWidth="0.7"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
          {/* Road lines */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <line x1="0" y1="110" x2="440" y2="110" stroke="rgba(143,175,138,0.3)" strokeWidth="8"/>
            <line x1="220" y1="0" x2="220" y2="220" stroke="rgba(143,175,138,0.3)" strokeWidth="5"/>
            <line x1="0" y1="55" x2="440" y2="55" stroke="rgba(143,175,138,0.15)" strokeWidth="3"/>
            <line x1="0" y1="170" x2="440" y2="170" stroke="rgba(143,175,138,0.15)" strokeWidth="3"/>
            <line x1="110" y1="0" x2="110" y2="220" stroke="rgba(143,175,138,0.15)" strokeWidth="3"/>
            <line x1="330" y1="0" x2="330" y2="220" stroke="rgba(143,175,138,0.15)" strokeWidth="3"/>
          </svg>
          {/* Risk zone */}
          <div style={{
            position: "absolute",
            width: 90, height: 90,
            borderRadius: "50%",
            background: "rgba(196,168,130,0.22)",
            border: "1.5px dashed rgba(196,168,130,0.6)",
            top: 65, left: 120,
          }} />
          {/* Dots */}
          {[
            { x: 80, y: 55, color: "#4ade80", size: 10 },
            { x: 185, y: 115, color: "#4ade80", size: 8 },
            { x: 310, y: 80, color: "#4ade80", size: 10 },
            { x: 155, y: 155, color: "#f59e0b", size: 8 },
            { x: 360, y: 155, color: "#4ade80", size: 7 },
            { x: 240, y: 45, color: "#4ade80", size: 7 },
          ].map((d, i) => (
            <div key={i} style={{
              position: "absolute",
              left: d.x, top: d.y,
              width: d.size, height: d.size,
              borderRadius: "50%",
              background: d.color,
              transform: "translate(-50%,-50%)",
              boxShadow: `0 0 0 3px ${d.color}30`,
              animation: `pulse ${1.5 + i * 0.3}s ease-in-out infinite`,
            }} />
          ))}
          {/* Alert chip */}
          <div style={{
            position: "absolute", bottom: 14, left: 14,
            background: "var(--white)",
            border: "1px solid rgba(26,24,20,0.1)",
            borderRadius: 9999,
            padding: "6px 12px",
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 12, fontWeight: 500, color: "var(--ink)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <span className="dot-live" style={{ width: 6, height: 6 }} />
            3 new reports nearby
          </div>
          {/* Label */}
          <div style={{
            position: "absolute", top: 12, right: 12,
            background: "rgba(247,245,240,0.92)",
            borderRadius: 8, padding: "4px 10px",
            fontSize: 11, fontWeight: 600, color: "var(--sage-dark)",
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            Live
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section style={{
        padding: "clamp(56px, 10vw, 88px) clamp(16px, 5vw, 48px)",
        background: "var(--cream-dark)",
        borderTop: "1px solid rgba(26,24,20,0.06)",
        borderBottom: "1px solid rgba(26,24,20,0.06)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="section-label">Why GeoPulse Exists</span>
          <h2 className="serif" style={{
            marginTop: 16,
            fontSize: "clamp(26px, 4vw, 42px)",
            fontWeight: 400,
            lineHeight: 1.15,
            color: "var(--ink)",
            marginBottom: 24,
          }}>
            In many communities, safety information spreads too late.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--ink-muted)", marginBottom: 16 }}>
            People only find out after something has already happened. A robbery two streets away. An accident blocking a route. A situation that had been building for hours.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--ink-muted)", marginBottom: 32 }}>
            GeoPulse AI changes that. We're building a living awareness layer for communities — where local knowledge flows freely, risks surface early, and people look out for each other automatically.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
            {[
              { icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.2"/></svg>
                ), text: "Share what you see in real time" },
              { icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l7 4-7 4-7-4 7-4zM5 10v6a2 2 0 0 0 2 2h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ), text: "Stay aware of developing situations" },
              { icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3l8 5-8 5-8-5 8-5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ), text: "Understand safer and risky areas dynamically" },
              { icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ), text: "Look out for each other through shared intelligence" },
            ].map((item) => (
              <div key={item.text} style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: "var(--white)",
                border: "1px solid rgba(26,24,20,0.07)",
                borderRadius: 14, padding: "16px 18px",
              }}>
                <span style={{ color: "var(--sage-dark)", fontSize: 16, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                <span style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ink-muted)", fontWeight: 400 }}>{item.text}</span>
              </div>
            ))}
          </div>

          <p style={{ marginTop: 28, fontSize: 15, color: "var(--ink-faint)", fontStyle: "italic" }}>
            Because safety should not depend on luck or late information.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" style={{ padding: "clamp(56px, 10vw, 88px) clamp(16px, 5vw, 48px)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="section-label">How It Works</span>
          <h2 className="serif" style={{
            marginTop: 16,
            fontSize: "clamp(26px, 4vw, 42px)",
            fontWeight: 400,
            lineHeight: 1.15,
            color: "var(--ink)",
            marginBottom: 40,
          }}>
            Four simple pillars of shared awareness.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {howItWorks.map((f, i) => (
              <div key={f.title} className="card">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: "var(--earth-light)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, color: "var(--earth-dark)",
                    flexShrink: 0,
                  }}>
                    {f.icon}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.12em",
                    textTransform: "uppercase", color: "var(--ink-faint)",
                  }}>
                    0{i + 1}
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 9 }}>{f.title}</div>
                <div style={{ fontSize: 13.5, color: "var(--ink-muted)", lineHeight: 1.7 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ── */}
      <section style={{
        padding: "clamp(56px, 10vw, 88px) clamp(16px, 5vw, 48px)",
        background: "var(--cream-dark)",
        borderTop: "1px solid rgba(26,24,20,0.06)",
        borderBottom: "1px solid rgba(26,24,20,0.06)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <span className="section-label">Built for Everyday Life</span>
          <h2 className="serif" style={{
            marginTop: 16,
            fontSize: "clamp(26px, 4vw, 42px)",
            fontWeight: 400,
            lineHeight: 1.15,
            color: "var(--ink)",
            marginBottom: 12,
          }}>
            For real people in real environments.
          </h2>
          <p style={{ fontSize: 16, color: "var(--ink-muted)", marginBottom: 36, lineHeight: 1.7 }}>
            GeoPulse AI is designed for anyone who moves through a city and wants to stay a step ahead.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {audience.map((a) => (
              <div key={a.label} style={{
                background: "var(--white)",
                border: "1px solid rgba(26,24,20,0.08)",
                borderRadius: 16, padding: "20px 18px",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                <span style={{ fontSize: 24 }}>{a.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{a.label}</span>
                <span style={{ fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.6 }}>{a.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PHILOSOPHY ── */}
      <section style={{
        padding: "clamp(56px, 10vw, 88px) clamp(16px, 5vw, 48px)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: "var(--sage-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px",
            fontSize: 22, color: "var(--sage-dark)",
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>
          </div>
          <h2 className="serif" style={{
            fontSize: "clamp(24px, 4vw, 40px)",
            fontWeight: 400,
            color: "var(--ink)",
            lineHeight: 1.2,
            marginBottom: 20,
          }}>
            Not About Fear.{" "}
            <em style={{ color: "var(--sage-dark)" }}>About Awareness.</em>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--ink-muted)" }}>
            This is not about panic or surveillance. It's about giving people better awareness of their surroundings — so decisions like <em>"when to move"</em>, <em>"where to avoid"</em>, or <em>"what's happening nearby"</em> become easier and safer.
          </p>
        </div>
      </section>

      {/* ── WAITLIST ── */}
      <section id="waitlist" style={{
        padding: "clamp(56px, 10vw, 88px) clamp(16px, 5vw, 48px)",
        background: "transparent",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Ripple icon */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
            <div className="ripple-wrap" style={{ width: 60, height: 60 }}>
              <div className="ripple" />
              <div className="ripple" />
              <div className="ripple" />
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--sage)",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", zIndex: 1,
                fontSize: 16, color: "#fff",
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "var(--sage)",
            }}>Early Access</span>
            <h2 className="serif" style={{
              marginTop: 14,
              fontSize: "clamp(28px, 5vw, 44px)",
              fontWeight: 400, lineHeight: 1.1,
              color: "#FEFCF8",
            }}>
              Be among the first to experience it.
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.8, color: "rgba(254,252,248,0.55)" }}>
              We're building GeoPulse AI with the community, not just for the community. Join the waitlist and help shape how it works.
            </p>
          </div>

          <div style={{
            background: "rgba(254,252,248,0.05)",
            border: "1px solid rgba(254,252,248,0.1)",
            borderRadius: 20,
            padding: "clamp(24px, 5vw, 36px)",
          }}>
            {!submitted ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: 11, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "rgba(254,252,248,0.4)",
                    marginBottom: 9,
                  }}>
                    How do you see yourself using GeoPulse AI?
                  </label>
                  <select
                    className="email-input"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    style={{ background: "rgba(6,10,20,0.85)", borderColor: "rgba(255,255,255,0.06)", color: "#e8edf2" }}
                  >
                    <option value="" disabled>Select an option</option>
                    <option value="Community Member">Community Member</option>
                    <option value="Student / Youth">Student / Youth</option>
                    <option value="Driver / Rider">Driver / Rider</option>
                    <option value="Security Professional">Security Professional</option>
                    <option value="Potential Partner / Organization">Potential Partner / Organization</option>
                  </select>

                  <label style={{
                    display: "block",
                    fontSize: 11, fontWeight: 600,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "rgba(254,252,248,0.4)",
                    margin: "12px 0 9px",
                  }}>
                    Your Email
                  </label>
                  <input
                    type="email"
                    className="email-input"
                    style={{ background: "rgba(254,252,248,0.06)", borderColor: "rgba(254,252,248,0.12)", color: "#FEFCF8" }}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSubmit()}
                    placeholder="you@example.com"
                  />
                </div>
                {submitError && (
                  <div style={{ color: "#ffb4b4", fontSize: 13, marginBottom: 6 }}>{submitError}</div>
                )}
                <button className="btn-primary" style={{ background: "var(--sage-dark)", color: "#fff" }} onClick={handleSubmit} disabled={loading}>
                  {loading ? "Saving..." : "Join the Waitlist →"}
                </button>
                <p style={{ fontSize: 12, color: "rgba(254,252,248,0.28)", textAlign: "center" }}>
                  No spam. Only access updates and news.
                </p>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#4ade80", marginBottom: 10 }}>You're on the list.</div>
                {role && (
                  <div style={{ fontSize: 14, color: "rgba(254,252,248,0.65)", marginBottom: 10 }}>
                    Signed up as: {role}
                  </div>
                )}
                <div style={{ fontSize: 14, color: "rgba(254,252,248,0.5)", lineHeight: 1.7 }}>
                  We'll reach out as soon as access opens. Watch your inbox.
                </div>
              </div>
            )}

            <div style={{
              marginTop: 28,
              paddingTop: 24,
              borderTop: "1px solid rgba(254,252,248,0.08)",
              display: "flex", flexDirection: "column", gap: 12,
            }}>
              {perks.map(p => (
                <div key={p} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "rgba(254,252,248,0.5)" }}>
                  <span style={{ color: "var(--sage)", flexShrink: 0, marginTop: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="5" fill="currentColor" />
                    </svg>
                  </span>
                  {p}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        padding: "20px clamp(16px, 5vw, 48px)",
        background: "#111009",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "rgba(254,252,248,0.5)", letterSpacing: "-0.01em" }}>
          <span style={{ color: "var(--sage)" }}>Geo</span>Pulse AI
        </span>
        <p style={{ fontSize: 11, color: "rgba(254,252,248,0.2)", letterSpacing: "0.06em", fontFamily: "monospace" }}>
          © 2025 GeoPulse AI — Private Beta
        </p>
      </footer>
    </div>
  );
}