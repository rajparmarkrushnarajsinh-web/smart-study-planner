import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Flame, Plus, Play, CalendarClock, Target, BookCheck, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Empty } from "@/components/AppShell";
import { useNow } from "@/lib/useNow";
import { useStore, setState, uid, dayKey, secondsOn, streak, fmtHM, chapterProgress, nextRevision, pad } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — GATE.plan" },
      { name: "description", content: "Your daily GATE CSE command center: study hours, streak, tasks and upcoming exams." },
      { property: "og:title", content: "Dashboard — GATE.plan" },
      { property: "og:description", content: "Your daily GATE CSE command center." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const now = useNow();
  const s = useStore((x) => x);
  const today = dayKey(now ?? undefined);
  const secs = secondsOn(s.sessions, today);
  const pct = Math.min(100, Math.round((secs / 3600 / s.settings.dailyTargetHours) * 100));
  const doneCh = s.chapters.filter((c) => chapterProgress(c) === 100).length;
  const doneSub = s.subjects.filter((sub) => { const cs = s.chapters.filter((c) => c.subjectId === sub.id); return cs.length && cs.every((c) => chapterProgress(c) === 100); }).length;
  const upcomingExams = s.exams.filter((e) => new Date(e.datetime).getTime() > (now ?? 0)).sort((a, b) => a.datetime.localeCompare(b.datetime)).slice(0, 3);
  const tasks = s.tasks.filter((t) => !t.done).sort((a, b) => (a.due || "9").localeCompare(b.due || "9"));
  const dueRev = s.chapters.filter((c) => { const n = nextRevision(c); return n && n <= today; });
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const d = now ? new Date(now) : null;

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return toast.error("Task title is required");
    setState((x) => ({ tasks: [...x.tasks, { id: uid(), title: title.trim(), due, done: false, subjectId: "" }] }));
    setTitle(""); setDue("");
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Today's command center" sub={d ? d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : " "}>
        <Button asChild><Link to="/timer"><Play />Start studying</Link></Button>
        <Button variant="outline" onClick={() => document.getElementById("task-input")?.focus()}><Plus />Add task</Button>
        <Button variant="outline" asChild><Link to="/timetable"><CalendarClock />Edit timetable</Link></Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel glow md:col-span-1 flex flex-col justify-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Local time</div>
          <div className="digits text-5xl font-bold mt-2" aria-live="off">{d ? `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : "--:--:--"}</div>
        </div>
        <div className="panel">
          <div className="flex items-center justify-between text-sm text-muted-foreground"><span className="flex items-center gap-2"><Target className="size-4" />Studied today</span>
            <label className="flex items-center gap-1 text-xs">Target
              <input type="number" min={1} max={16} aria-label="Daily target hours" value={s.settings.dailyTargetHours} onChange={(e) => { const v = Math.max(1, Math.min(16, Number(e.target.value) || 1)); setState((x) => ({ settings: { ...x.settings, dailyTargetHours: v } })); }} className="field h-7 w-14 px-2" />h</label>
          </div>
          <div className="text-3xl font-bold mt-2">{fmtHM(secs)}</div>
          <Progress value={pct} className="mt-3" />
          <div className="text-xs text-muted-foreground mt-2">{pct}% of {s.settings.dailyTargetHours}h goal</div>
        </div>
        <div className="panel">
          <div className="text-sm text-muted-foreground flex items-center gap-2"><Flame className="size-4 text-warning" />Study streak</div>
          <div className="text-3xl font-bold mt-2">{streak(s.sessions)} days</div>
          <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2"><BookCheck className="size-4" />{doneCh}/{s.chapters.length} chapters · {doneSub}/{s.subjects.length} subjects done</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel" aria-labelledby="tasks-h">
          <h2 id="tasks-h" className="font-semibold mb-3">Upcoming tasks</h2>
          <form onSubmit={addTask} className="flex gap-2 mb-3">
            <input id="task-input" className="field" placeholder="New task…" aria-label="Task title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input type="date" className="field w-40" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} />
            <Button type="submit" size="icon" aria-label="Add task"><Plus /></Button>
          </form>
          {tasks.length === 0 ? <Empty text="No pending tasks. Nice!" /> : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                  <input type="checkbox" aria-label={`Complete ${t.title}`} className="size-4 accent-[var(--primary)]" onChange={() => setState((x) => ({ tasks: x.tasks.map((y) => y.id === t.id ? { ...y, done: true } : y) }))} />
                  <span className="flex-1 text-sm">{t.title}</span>
                  {t.due && <span className={`text-xs ${t.due < today ? "text-destructive" : "text-muted-foreground"}`}>{t.due}</span>}
                  <button aria-label="Delete task" onClick={() => setState((x) => ({ tasks: x.tasks.filter((y) => y.id !== t.id) }))} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="space-y-4">
          <section className="panel">
            <div className="flex justify-between mb-3"><h2 className="font-semibold">Upcoming exams</h2><Link to="/exams" className="text-sm text-primary">Manage</Link></div>
            {upcomingExams.length === 0 ? <Empty text="No exams yet — add your GATE / semester dates on the Exams page." /> : upcomingExams.map((e) => {
              const days = Math.ceil((new Date(e.datetime).getTime() - (now ?? 0)) / 86400000);
              return <div key={e.id} className="flex justify-between py-2 border-b last:border-0 text-sm"><span>{e.name} <span className="text-muted-foreground">· {e.type}</span></span><span className="font-semibold text-primary">{days}d</span></div>;
            })}
          </section>
          <section className="panel">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><RotateCcw className="size-4" />Revisions due</h2>
            {dueRev.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due. Mark chapters as revised on the Reading page to start spaced repetition.</p> :
              dueRev.slice(0, 5).map((c) => <div key={c.id} className="text-sm py-1">{c.name} <span className="text-muted-foreground">· {s.subjects.find((x) => x.id === c.subjectId)?.name}</span></div>)}
          </section>
        </div>
      </div>
    </div>
  );
}
