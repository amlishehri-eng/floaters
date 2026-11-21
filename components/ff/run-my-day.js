"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RUNS from "@/data/runs.json";

// "Run my day" (stage demo): a scan replay of the engine's last full run, then the list of previous runs.
// It does not start anything in n8n. Esc or the close button ends it; reduced motion skips the scan.
const STEP_MS = 520;
const fmt = (n) => n.toLocaleString("en-US");
const when = (iso) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export default function RunMyDay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(-1);
  const [counts, setCounts] = useState([]);
  const closeRef = useRef(null);
  const runsRef = useRef(null);
  const stages = RUNS.replay.stages;
  const done = step >= stages.length;

  const start = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStep(reduce ? stages.length : 0);
    setCounts(stages.map((s) => (reduce ? s.value : 0)));
    setOpen(true);
  };

  useEffect(() => {
    if (!open || step >= stages.length) return;
    const timer = setTimeout(() => setStep((i) => i + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [open, step, stages]);

  // count the active stage up to its value
  useEffect(() => {
    if (!open || step < 0 || step >= stages.length) return;
    const target = stages[step].value;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / (STEP_MS * 0.8));
      setCounts((c) => { const n = [...c]; n[step] = Math.round(target * (1 - Math.pow(1 - p, 3))); return n; });
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, step, stages]);

  // on narrow screens the runs sit under the scan: bring them into view when it ends
  useEffect(() => {
    if (!done || !runsRef.current) return;
    const r = runsRef.current.getBoundingClientRect();
    if (r.top > window.innerHeight - 120) runsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [done]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="rmd-btn" onClick={start}>Run my day</button>
      {open && (
        <div className="rmd-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="rmd-panel" role="dialog" aria-modal="true" aria-labelledby="rmd-title">
            <header className="rmd-head">
              <div>
                <p className="rmd-eyebrow">{done ? "Scan complete" : "Scanning…"}</p>
                <h2 id="rmd-title" className="rmd-title">Run my day</h2>
                <p className="rmd-sub">{RUNS.replay.label}: from public traces to today’s calls.</p>
              </div>
              <button ref={closeRef} type="button" className="rmd-close" onClick={() => setOpen(false)} aria-label="Close">Close</button>
            </header>

            <div className="rmd-body">
            <div className="rmd-scan">
            <div className="rmd-progress" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, (step + 1) / stages.length)})` }} /></div>

            <ol className="rmd-stages">
              {stages.map((s, i) => {
                const state = i < step ? "done" : i === step ? "active" : "wait";
                return (
                  <li key={s.label} className={`rmd-stage rmd-stage--${state}${s.call ? " rmd-stage--call" : ""}`}>
                    <span className="rmd-dot" aria-hidden="true" />
                    <span className="rmd-label">{s.label}<em>{s.note}</em></span>
                    <span className="rmd-value">{state === "wait" ? "–" : fmt(counts[i] ?? 0)}</span>
                  </li>
                );
              })}
            </ol>
            </div>

            <div ref={runsRef} className={`rmd-runs${done ? " is-in" : ""}`} aria-hidden={!done}>
              <h3 className="rmd-runs-title">Previous runs</h3>
              <ul>
                {RUNS.runs.map((r) => (
                  <li key={r.id} className="rmd-run">
                    <span className="rmd-run-dot" aria-hidden="true" />
                    <span className="rmd-run-main"><b>{r.title}</b><em>{when(r.started)} · {r.duration} · run #{r.id}</em></span>
                    <span className="rmd-run-result">{r.result}</span>
                  </li>
                ))}
              </ul>
              <Link href="/proof/live" className="rmd-cta" onClick={() => setOpen(false)}>Open today’s call list</Link>
            </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
