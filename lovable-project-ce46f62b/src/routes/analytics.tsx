import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Empty } from "@/components/AppShell";
import { useStore, dayKey, secondsOn, plannedStudyMin, streak, fmtHM, subjectProgress, chapterProgress, resetAll } from "@/lib/store";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Progress Analytics — GATE.plan" },
      { name: "description", content: "Daily, weekly and monthly study hours, planned vs actual, subject distribution and PYQ stats." },
      { property: "og:title", content: "Progress Analytics — GATE.plan" },
      { property: "og:description", content: "Track your GATE preparation progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analytics,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" } };

function Analytics() {
  const s = useStore((x) => x);
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(today.getDate() - 6 + i); return d; });
  const weekData = week.map((d) => ({ day: d.toLocaleDateString(undefined, { weekday: "short" }), Actual: +(secondsOn(s.sessions, dayKey(d)) / 3600).toFixed(2), Planned: +(plannedStudyMin(s.slots, d.getDay()) / 60).toFixed(2) }));
  const since = (days: number) => s.sessions.filter((x) => x.start >= Date.now() - days * 86400000).reduce((a, x) => a + x.durationSec, 0);
  const bySubject = s.subjects.map((sub) => ({ name: sub.name, value: +(s.sessions.filter((x) => x.subjectId === sub.id).reduce((a, x) => a + x.durationSec, 0) / 3600).toFixed(2) })).filter((x) => x.value > 0);
  const goalDays = week.filter((d) => secondsOn(s.sessions, dayKey(d)) >= s.settings.dailyTargetHours * 3600).length;
  const pyqDone = s.chapters.reduce((a, c) => a + c.pyqDone, 0); const pyqTotal = s.chapters.reduce((a, c) => a + c.pyqTotal, 0);
  const revs = s.chapters.reduce((a, c) => a + c.revisions.length, 0);
  const done = s.chapters.filter((c) => chapterProgress(c) === 100).length;
  const plannedWeek = weekData.reduce((a, x) => a + x.Planned, 0); const actualWeek = weekData.reduce((a, x) => a + x.Actual, 0);

  const stats = [
    ["Today", fmtHM(secondsOn(s.sessions, dayKey()))], ["Last 7 days", fmtHM(since(7))], ["Last 30 days", fmtHM(since(30))],
    ["Streak", `${streak(s.sessions)} days`], ["Goal hit (7d)", `${goalDays}/7 days`], ["Planned vs actual (7d)", `${actualWeek.toFixed(1)} / ${plannedWeek.toFixed(1)}h`],
    ["Chapters done", `${done}/${s.chapters.length}`], ["PYQs solved", `${pyqDone}/${pyqTotal}`], ["Revisions logged", String(revs)],
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Progress analytics" sub="Every completed timer session feeds these numbers.">
        <Button variant="outline" onClick={() => confirm("Reset ALL data back to the sample plan? This cannot be undone.") && resetAll()}>Reset data</Button>
      </PageHeader>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
        {stats.map(([l, v]) => <div key={l} className="panel"><div className="text-xs text-muted-foreground">{l}</div><div className="text-xl font-bold mt-1">{v}</div></div>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel"><h2 className="font-semibold mb-4">Weekly hours: planned vs actual</h2>
          <div className="h-64"><ResponsiveContainer><BarChart data={weekData}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} /><YAxis stroke="var(--muted-foreground)" fontSize={12} /><Tooltip {...tip} cursor={{ fill: "var(--muted)" }} /><Legend /><Bar dataKey="Planned" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /><Bar dataKey="Actual" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="panel"><h2 className="font-semibold mb-4">Subject-wise time</h2>
          {bySubject.length === 0 ? <Empty text="No sessions yet. Start the timer to see your distribution." /> :
            <div className="h-64"><ResponsiveContainer><PieChart><Pie data={bySubject} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>{bySubject.map((_, i) => <Cell key={i} fill={COLORS[i % 5]} stroke="var(--card)" />)}</Pie><Tooltip {...tip} formatter={(v: number) => `${v}h`} /></PieChart></ResponsiveContainer></div>}
        </section>
      </div>
      <section className="panel"><h2 className="font-semibold mb-4">Chapter completion by subject</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {s.subjects.map((sub) => { const chs = s.chapters.filter((c) => c.subjectId === sub.id); const p = subjectProgress(chs); return (
            <div key={sub.id}><div className="flex justify-between text-sm mb-1"><span className="truncate">{sub.name}</span><span className="text-muted-foreground">{p}%</span></div><Progress value={p} className="h-2" /></div>); })}
        </div>
      </section>
    </div>
  );
}
