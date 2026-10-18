import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Empty } from "@/components/AppShell";
import { useStore, setState, uid, chapterProgress, subjectProgress, nextRevision, dayKey, type Chapter, type Priority } from "@/lib/store";

export const Route = createFileRoute("/subjects")({
  head: () => ({
    meta: [
      { title: "Reading Schedule — GATE.plan" },
      { name: "description", content: "Chapter-wise GATE CSE planner with lectures, notes, revision, PYQ tracking and spaced repetition." },
      { property: "og:title", content: "Reading Schedule — GATE.plan" },
      { property: "og:description", content: "Chapter-wise GATE CSE reading planner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Subjects,
});

const PRI: Record<Priority, string> = { High: "bg-destructive/15 text-destructive", Medium: "bg-warning/20 text-warning", Low: "bg-muted text-muted-foreground" };

function Subjects() {
  const subjects = useStore((s) => s.subjects);
  const chapters = useStore((s) => s.chapters);
  const [open, setOpen] = useState<string | null>(subjects[0]?.id ?? null);
  const [newSub, setNewSub] = useState("");
  const [newCh, setNewCh] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | Priority>("all");
  const today = dayKey();

  const upd = (id: string, p: Partial<Chapter>) => setState((s) => ({ chapters: s.chapters.map((c) => c.id === id ? { ...c, ...p } : c) }));
  const addSubject = (e: React.FormEvent) => {
    e.preventDefault();
    const n = newSub.trim();
    if (!n) return toast.error("Subject name is required");
    if (subjects.some((s) => s.name.toLowerCase() === n.toLowerCase())) return toast.error("Subject already exists");
    const id = uid();
    setState((s) => ({ subjects: [...s.subjects, { id, name: n, color: s.subjects.length % 5 }] }));
    setNewSub(""); setOpen(id);
  };
  const addChapter = (sid: string) => {
    const n = (newCh[sid] || "").trim();
    if (!n) return toast.error("Chapter name is required");
    setState((s) => ({ chapters: [...s.chapters, { id: uid(), subjectId: sid, name: n, lectures: 5, lecturesDone: 0, lectureMins: 60, priority: "Medium", target: "", reading: false, notes: false, revision: false, practice: false, pyqTotal: 20, pyqDone: 0, revisions: [] }] }));
    setNewCh({ ...newCh, [sid]: "" });
  };
  const delSubject = (sid: string) => {
    if (!confirm("Delete this subject and all its chapters?")) return;
    setState((s) => ({ subjects: s.subjects.filter((x) => x.id !== sid), chapters: s.chapters.filter((c) => c.subjectId !== sid) }));
  };
  const revise = (c: Chapter) => { if (c.revisions.includes(today)) return toast("Already revised today"); upd(c.id, { revisions: [...c.revisions, today], revision: true }); toast.success("Revision logged. Next: " + nextRevision({ ...c, revisions: [...c.revisions, today] })); };

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Reading schedule" sub="Chapter-wise plan with spaced-repetition revisions (1 → 3 → 7 → 14 → 30 days).">
        <select className="field w-36" aria-label="Filter priority" value={filter} onChange={(e) => setFilter(e.target.value as "all" | Priority)}>
          <option value="all">All priorities</option><option>High</option><option>Medium</option><option>Low</option>
        </select>
      </PageHeader>
      <form onSubmit={addSubject} className="flex gap-2 max-w-md">
        <input className="field" placeholder="Add custom subject…" aria-label="New subject name" value={newSub} onChange={(e) => setNewSub(e.target.value)} />
        <Button type="submit"><Plus />Add</Button>
      </form>
      {subjects.length === 0 && <Empty text="No subjects. Add one above." />}
      <div className="space-y-3">
        {subjects.map((sub) => {
          const chs = chapters.filter((c) => c.subjectId === sub.id);
          const shown = chs.filter((c) => filter === "all" || c.priority === filter);
          const pct = subjectProgress(chs);
          const isOpen = open === sub.id;
          return (
            <section key={sub.id} className="panel p-0 overflow-hidden">
              <button onClick={() => setOpen(isOpen ? null : sub.id)} aria-expanded={isOpen} className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/40">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{sub.name}</div>
                  <div className="flex items-center gap-3 mt-2"><Progress value={pct} className="h-2" /><span className="text-xs text-muted-foreground w-24 shrink-0">{pct}% · {chs.length} ch</span></div>
                </div>
                <ChevronDown className={`size-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <div className="border-t p-4 space-y-3">
                  {shown.length === 0 && <Empty text="No chapters match." />}
                  {shown.map((c) => {
                    const p = chapterProgress(c); const nr = nextRevision(c);
                    return (
                      <div key={c.id} className="rounded-lg border p-3 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <input className="field h-8 flex-1 min-w-40 font-medium" aria-label="Chapter name" value={c.name} onChange={(e) => upd(c.id, { name: e.target.value })} />
                          <select aria-label="Priority" className={`h-8 rounded-md px-2 text-xs font-semibold ${PRI[c.priority]}`} value={c.priority} onChange={(e) => upd(c.id, { priority: e.target.value as Priority })}><option>High</option><option>Medium</option><option>Low</option></select>
                          <span className="text-sm font-bold text-primary w-12 text-right">{p}%</span>
                          <button aria-label="Delete chapter" onClick={() => setState((s) => ({ chapters: s.chapters.filter((x) => x.id !== c.id) }))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                          <label>Lectures done<input type="number" min={0} max={c.lectures} className="field h-8 mt-1" value={c.lecturesDone} onChange={(e) => upd(c.id, { lecturesDone: Math.max(0, Math.min(c.lectures, Number(e.target.value) || 0)) })} /></label>
                          <label>Total lectures<input type="number" min={0} className="field h-8 mt-1" value={c.lectures} onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); upd(c.id, { lectures: v, lecturesDone: Math.min(c.lecturesDone, v) }); }} /></label>
                          <label>Lecture mins<input type="number" min={1} className="field h-8 mt-1" value={c.lectureMins} onChange={(e) => upd(c.id, { lectureMins: Math.max(1, Number(e.target.value) || 1) })} /></label>
                          <label>PYQs solved / total<div className="flex gap-1 mt-1"><input type="number" min={0} className="field h-8" value={c.pyqDone} onChange={(e) => upd(c.id, { pyqDone: Math.max(0, Math.min(c.pyqTotal, Number(e.target.value) || 0)) })} /><input type="number" min={0} className="field h-8" value={c.pyqTotal} onChange={(e) => upd(c.id, { pyqTotal: Math.max(0, Number(e.target.value) || 0) })} /></div></label>
                          <label>Target date<input type="date" className="field h-8 mt-1" value={c.target} onChange={(e) => upd(c.id, { target: e.target.value })} /></label>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          {(["reading", "notes", "revision", "practice"] as const).map((k) => (
                            <label key={k} className="flex items-center gap-1.5 capitalize"><input type="checkbox" checked={c[k]} onChange={(e) => upd(c.id, { [k]: e.target.checked })} />{k === "notes" ? "Note-making" : k === "practice" ? "Practice Qs" : k}</label>
                          ))}
                          <Button size="sm" variant="outline" className="ml-auto" onClick={() => revise(c)}><RotateCcw />Revised today</Button>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                          <span>{c.lectures * c.lectureMins} min of lectures</span>
                          <span>Revisions: {c.revisions.length}</span>
                          {nr && <span className={nr <= today ? "text-warning font-semibold" : ""}>Next revision: {nr}{nr <= today && " (due)"}</span>}
                          {c.target && p < 100 && c.target < today && <span className="text-destructive">Target date passed</span>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex gap-2">
                    <input className="field" placeholder="Add chapter…" aria-label="New chapter name" value={newCh[sub.id] || ""} onChange={(e) => setNewCh({ ...newCh, [sub.id]: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addChapter(sub.id)} />
                    <Button onClick={() => addChapter(sub.id)}><Plus />Chapter</Button>
                    <Button variant="ghost" onClick={() => delSubject(sub.id)} aria-label="Delete subject"><Trash2 /></Button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
