"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The briefing follows the call list (DESIGN.md, "Briefing player"): /api/briefing?format=segments gives an intro, one
// segment per call-now lead in call-list order and a close; each segment's audio comes from
// /api/briefing?format=audio&segment=<i> (flow 45, cached per text hash on the server). The next segment is fetched
// while one plays, so there is no gap. When a lead's segment starts, onLead(key) selects it like a click.
// If a segment has no audio (text to speech down), the browser speaks its text instead.

export function useBriefingPlayer({ onLead }) {
  const [segs, setSegs] = useState([]);
  const [idx, setIdx] = useState(-1);
  const [status, setStatus] = useState("idle"); // idle | loading | playing | paused
  const [note, setNote] = useState("");
  const audio = useRef(null);
  const blobs = useRef(new Map());
  const token = useRef(0);
  const segsRef = useRef([]);
  const onLeadRef = useRef(onLead);
  const playRef = useRef(null); // playIndex calls itself for the next segment through this ref
  useEffect(() => { onLeadRef.current = onLead; }, [onLead]);

  const fetchSegment = useCallback((i) => {
    if (!blobs.current.has(i)) {
      blobs.current.set(i, fetch(`/api/briefing?format=audio&segment=${i}`).then(async (res) => {
        const type = res.headers.get("content-type") || "";
        if (type.includes("audio/")) return { url: URL.createObjectURL(await res.blob()), cache: res.headers.get("x-cache") };
        const j = await res.json().catch(() => ({}));
        return { speak: j.text || segsRef.current[i]?.text || "", error: j.error || `briefing answered ${res.status}` };
      }));
    }
    return blobs.current.get(i);
  }, []);

  const stopAudio = () => {
    if (audio.current) { audio.current.onended = null; audio.current.pause(); }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const playIndex = useCallback(async (i) => {
    const list = segsRef.current;
    const my = ++token.current;
    stopAudio();
    if (i < 0 || i >= list.length) { setStatus("idle"); setIdx(-1); return; }
    setIdx(i);
    setStatus("loading");
    if (list[i].lead_key) onLeadRef.current?.(list[i].lead_key);
    const seg = await fetchSegment(i).catch((err) => ({ speak: list[i].text, error: err.message }));
    if (my !== token.current) return; // the user jumped elsewhere meanwhile
    if (i + 1 < list.length) fetchSegment(i + 1).catch(() => {}); // prefetch: no gap at the next segment
    const advance = () => { if (my === token.current) playRef.current?.(i + 1); };
    if (seg.url) {
      audio.current ||= new Audio();
      audio.current.src = seg.url;
      audio.current.onended = advance;
      try {
        await audio.current.play();
        setStatus("playing");
      } catch (err) {
        setStatus("paused");
        setNote(`The audio could not start: ${err.message}. Press play.`);
      }
    } else if (seg.speak && window.speechSynthesis) {
      setNote("No audio for this part, so your browser reads it aloud.");
      const u = new SpeechSynthesisUtterance(seg.speak);
      u.onend = advance;
      window.speechSynthesis.speak(u);
      setStatus("playing");
    } else {
      setNote(`This part could not play: ${seg.error || "no audio"}.`);
      advance();
    }
  }, [fetchSegment]);
  useEffect(() => { playRef.current = playIndex; }, [playIndex]);

  const start = useCallback(async () => {
    setNote("");
    setStatus("loading");
    try {
      const res = await fetch("/api/briefing?format=segments");
      const j = await res.json();
      if (!res.ok || !Array.isArray(j.segments) || !j.segments.length) throw new Error(j.error || `briefing answered ${res.status}`);
      blobs.current = new Map();
      segsRef.current = j.segments;
      setSegs(j.segments);
      playIndex(0);
    } catch (err) {
      setStatus("idle");
      setNote(`The briefing could not start: ${err.message}.`);
    }
  }, [playIndex]);

  const pause = useCallback(() => {
    if (status !== "playing") return;
    audio.current?.pause();
    window.speechSynthesis?.pause();
    setStatus("paused");
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused") return;
    if (audio.current?.src && !audio.current.ended && audio.current.paused && audio.current.currentTime > 0) audio.current.play();
    else if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
    else { playIndex(idx); return; }
    setStatus("playing");
  }, [status, idx, playIndex]);

  const stop = useCallback(() => { token.current += 1; stopAudio(); setStatus("idle"); setIdx(-1); }, []);
  const leadAt = (from, step) => {
    for (let i = from + step; i >= 0 && i < segsRef.current.length; i += step) if (segsRef.current[i].lead_key) return i;
    return step > 0 ? segsRef.current.length - 1 : -1;
  };
  const next = useCallback(() => playIndex(leadAt(idx, 1)), [idx, playIndex]);
  const prev = useCallback(() => { const p = leadAt(idx, -1); playIndex(p < 0 ? 0 : p); }, [idx, playIndex]);

  // Esc stops the briefing.
  useEffect(() => {
    if (status === "idle") return undefined;
    const onKey = (e) => e.key === "Escape" && stop();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, stop]);
  useEffect(() => () => { token.current += 1; stopAudio(); }, []);

  return { segs, idx, status, note, active: status !== "idle", seg: segs[idx] || null, start, pause, resume, stop, next, prev };
}

export function PlayerBar({ p }) {
  if (!p.active) return null;
  const playing = p.status === "playing";
  const leads = p.segs.filter((s) => s.lead_key).length;
  const n = p.segs.slice(0, p.idx + 1).filter((s) => s.lead_key).length;
  return (
    <div className="bp-bar" role="region" aria-label="Briefing player">
      <div className="bp-inner">
        <div className="bp-text">
          <span className="bp-name">{p.seg?.lead_key ? `${p.seg.name}, ${n} of ${leads}` : p.idx === 0 ? "Briefing" : "End of the call list"}</span>
          <span className="bp-caption" aria-live="polite">{p.status === "loading" ? "Loading…" : p.seg?.text}</span>
        </div>
        <div className="bp-controls">
          <button type="button" className="bp-btn" onClick={p.prev}>Previous lead</button>
          {playing ? (
            <button type="button" className="ff-btn bp-main" onClick={p.pause}>Pause</button>
          ) : (
            <button type="button" className="ff-btn bp-main" onClick={p.resume} disabled={p.status === "loading"}>Play</button>
          )}
          <button type="button" className="bp-btn" onClick={p.next}>Next lead</button>
          <button type="button" className="bp-btn" onClick={p.stop}>Stop</button>
        </div>
      </div>
    </div>
  );
}
