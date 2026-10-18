import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Maximize2, Minimize2, Pause, Play, RotateCcw, Save, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/AppShell";
import { useNow } from "@/lib/useNow";
import { useStore, setState, patchTimer, getState, elapsedMs, fmtClock, recordSession, phaseTarget, secondsOn, dayKey, fmtHM, type TimerMode } from "@/lib/store";

export const Route = createFileRoute("/timer")({
  head: () => ({
    meta: [
      { title: "Study Timer — GATE.plan" },
      { name: "description", content: "Stopwatch, countdown and Pomodoro timer that logs your focused GATE study time." },
      { property: "og:title", content: "Study Timer — GATE.plan" },
      { property: "og:description", content: "Focus with Pomodoro and log every session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimerPage,
});

function TimerPage() {
  useNow(250);
  const t = useStore((s) => s.timer);
  const st = useStore((s) => s.settings);
  const subjects = useStore((s) => s.subjects);
  const chapters = useStore((s) => s.chapters);
  const sessions = useStore((s) => s.sessions);
  const focus = useStore((s) => s.focus);
  const [cd, setCd] = useState({ h: 0, m: 45, s: 0 });

  const el = elapsedMs(t);
  const display = t.mode === "stopwatch" ? el : t.targetMs - el;
  const pristine = !t.running && t.accMs === 0;

  const setMode = (mode: TimerMode) => {
    if (!pristine) return toast.error("Reset the current timer before switching mode");
    patchTimer({ mode, phase: "work", targetMs: mode === "pomodoro" ? phaseTarget("work", st) : (cd.h * 3600 + cd.m * 60 + cd.s) * 1000 });
  };
  const start = () => {
    if (t.mode === "countdown" && pristine) {
      const ms = (cd.h * 3600 + cd.m * 60 + cd.s) * 1000;
      if (ms <= 0) return toast.error("Set a duration greater than zero");
      patchTimer({ targetMs: ms });
    }
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
    patchTimer({ running: true, startedAt: Date.now() });
  };
  const pause = () => { const e = elapsedMs(getState().timer); patchTimer({ running: false, startedAt: null, accMs: e }); };
  const reset = () => {
    if (t.mode === "stopwatch" || (t.mode !== "pomodoro" || t.phase === "work")) {
      if (el >= 60000 && t.mode === "stopwatch") { recordSession(el / 1000); toast.success(`Saved ${fmtHM(el / 1000)} session`); }
    }
    patchTimer({ running: false, startedAt: null, accMs: 0, phase: "work", targetMs: t.mode === "pomodoro" ? phaseTarget("work", st) : t.targetMs });
  };
  const saveStop = () => {
    const sec = el / 1000;
    if (!recordSession(sec)) return toast.error("Sessions under 1 minute aren't saved");
    toast.success(`Saved ${fmtHM(sec)} session`);
    patchTimer({ running: false, startedAt: null, accMs: 0, phase: "work", targetMs: t.mode === "pomodoro" ? phaseTarget("work", st) : t.targetMs });
  };
  const setPomo = (k: "pomoWork" | "pomoBreak" | "pomoLong", v: number) => {
    const val = Math.max(1, Math.min(180, v || 1));
    setState((s) => ({ settings: { ...s.settings, [k]: val } }));
    if (pristine && t.mode === "pomodoro") patchTimer({ targetMs: phaseTarget(t.phase, { ...st, [k]: val }) });
  };
  const subjectChapters = chapters.filter((c) => c.subjectId === t.subjectId);
  const todaySec = secondsOn(sessions, dayKey());
  const totalSec = sessions.reduce((a, s) => a + s.durationSec, 0);
  const phaseLabel = t.mode === "pomodoro" ? (t.phase === "work" ? "Focus" : t.phase === "break" ? "Short break" : "Long break") : t.mode === "stopwatch" ? "Stopwatch" : "Countdown";
  const subjName = subjects.find((s) => s.id === t.subjectId)?.name;

  const clock = (
    <div className="text-center">
      <div className="text-sm uppercase tracking-[0.3em] text-muted-foreground">{phaseLabel}{t.mode === "pomodoro" && ` · #${t.pomoCount % 4 + (t.phase === "work" ? 1 : 0)}/4`}</div>
      <div className="digits font-bold text-6xl sm:text-8xl md:text-9xl my-4 text-primary" role="timer" aria-live="off">{fmtClock(display)}</div>
      <div className="text-muted-foreground text-sm">{subjName}{t.chapterId && ` — ${chapters.find((c) => c.id === t.chapterId)?.name}`}</div>
      <div className="flex justify-center gap-3 mt-6">
        {t.running ? <Button size="lg" onClick={pause}><Pause />Pause</Button> : <Button size="lg" onClick={start}><Play />{pristine ? "Start" : "Resume"}</Button>}
        <Button size="lg" variant="outline" onClick={reset}><RotateCcw />Reset</Button>
        {!pristine && (t.mode !== "pomodoro" || t.phase === "work") && <Button size="lg" variant="outline" onClick={saveStop}><Save />Save</Button>}
      </div>
    </div>
  );

  if (focus) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {clock}
      <Button variant="ghost" className="mt-10" onClick={() => setState(() => ({ focus: false }))}><Minimize2 />Exit study mode</Button>
    </div>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Study timer" sub={`Today ${fmtHM(todaySec)} · All-time focused ${fmtHM(totalSec)}`}>
        <Button variant="outline" onClick={() => Notification?.requestPermission?.().then((p) => toast(p === "granted" ? "Notifications enabled" : "Notifications blocked"))}><Bell />Notifications</Button>
        <Button onClick={() => setState(() => ({ focus: true }))}><Maximize2 />Distraction-free mode</Button>
      </PageHeader>
      <div className="flex gap-2 rounded-xl bg-muted p-1 w-fit" role="tablist">
        {(["pomodoro", "stopwatch", "countdown"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={t.mode === m} onClick={() => setMode(m)} className={`px-4 py-2 rounded-lg text-sm capitalize ${t.mode === m ? "bg-card font-semibold shadow" : "text-muted-foreground"}`}>{m}</button>
        ))}
      </div>
      <div className="panel glow py-12">{clock}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="panel space-y-3">
          <h2 className="font-semibold">Session subject</h2>
          <label className="block text-sm">Subject
            <select className="field mt-1" value={t.subjectId} disabled={t.running} onChange={(e) => patchTimer({ subjectId: e.target.value, chapterId: "" })}>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></label>
          <label className="block text-sm">Chapter (optional)
            <select className="field mt-1" value={t.chapterId} disabled={t.running} onChange={(e) => patchTimer({ chapterId: e.target.value })}>
              <option value="">—</option>
              {subjectChapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
        </div>
        <div className="panel space-y-3">
          {t.mode === "countdown" ? (<>
            <h2 className="font-semibold">Countdown duration</h2>
            <div className="grid grid-cols-3 gap-2">
              {(["h", "m", "s"] as const).map((k) => (
                <label key={k} className="text-sm">{k === "h" ? "Hours" : k === "m" ? "Minutes" : "Seconds"}
                  <input type="number" min={0} max={k === "h" ? 23 : 59} className="field mt-1" disabled={!pristine} value={cd[k]} onChange={(e) => setCd({ ...cd, [k]: Math.max(0, Math.min(k === "h" ? 23 : 59, Number(e.target.value) || 0)) })} /></label>
              ))}
            </div>
          </>) : t.mode === "pomodoro" ? (<>
            <h2 className="font-semibold">Pomodoro settings (minutes)</h2>
            <div className="grid grid-cols-3 gap-2">
              {([["pomoWork", "Focus"], ["pomoBreak", "Break"], ["pomoLong", "Long break"]] as const).map(([k, l]) => (
                <label key={k} className="text-sm">{l}<input type="number" min={1} max={180} className="field mt-1" value={st[k]} onChange={(e) => setPomo(k, Number(e.target.value))} /></label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Long break after every 4 focus sessions. Completed: {t.pomoCount}</p>
          </>) : (<>
            <h2 className="font-semibold">Stopwatch</h2>
            <p className="text-sm text-muted-foreground">Press Save (or Reset) to log the session. Sessions of 1 minute or more are recorded.</p>
          </>)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={st.sound} onChange={(e) => setState((s) => ({ settings: { ...s.settings, sound: e.target.checked } }))} />Play sound when timer finishes</label>
        </div>
      </div>
    </div>
  );
}
