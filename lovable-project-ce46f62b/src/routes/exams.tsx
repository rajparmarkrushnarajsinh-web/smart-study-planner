import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Empty } from "@/components/AppShell";
import { useNow } from "@/lib/useNow";
import { useStore, setState, uid, subjectProgress, pad, type Exam, type ExamType } from "@/lib/store";

export const Route = createFileRoute("/exams")({
  head: () => ({
    meta: [
      { title: "Exam Countdown — GATE.plan" },
      { name: "description", content: "Live countdowns to GATE CSE, semester, internal and backlog exams with syllabus progress." },
      { property: "og:title", content: "Exam Countdown — GATE.plan" },
      { property: "og:description", content: "Live exam countdowns with syllabus progress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Exams,
});

const TYPES: ExamType[] = ["GATE CSE", "Semester", "Internal Test", "Backlog", "Other"];

function split(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

function Exams() {
  const now = useNow();
  const exams = useStore((s) => s.exams);
  const subjects = useStore((s) => s.subjects);
  const chapters = useStore((s) => s.chapters);
  const [edit, setEdit] = useState<(Exam & { date: string; time: string }) | null>(null);

  const sorted = [...exams].sort((a, b) => a.datetime.localeCompare(b.datetime));
  const nearest = now ? sorted.find((e) => new Date(e.datetime).getTime() > now) : undefined;
  const syllabus = (e: Exam) => subjectProgress(chapters.filter((c) => (e.subjectIds.length ? e.subjectIds : subjects.map((s) => s.id)).includes(c.subjectId)));

  const openNew = () => setEdit({ id: uid(), name: "", type: "GATE CSE", datetime: "", notes: "", subjectIds: [], date: "", time: "09:30" });
  const openEdit = (e: Exam) => setEdit({ ...e, date: e.datetime.slice(0, 10), time: e.datetime.slice(11, 16) });
  const save = () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast.error("Exam name is required");
    if (!edit.date) return toast.error("Please enter the exam date");
    const datetime = `${edit.date}T${edit.time || "09:00"}`;
    if (isNaN(new Date(datetime).getTime())) return toast.error("Invalid date/time");
    const { date: _d, time: _t, ...rest } = edit;
    const ex: Exam = { ...rest, name: edit.name.trim(), datetime };
    setState((s) => ({ exams: s.exams.some((x) => x.id === ex.id) ? s.exams.map((x) => x.id === ex.id ? ex : x) : [...s.exams, ex] }));
    setEdit(null); toast.success("Exam saved");
  };

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Exam countdown" sub="Enter your official exam dates — countdowns update live."><Button onClick={openNew}><Plus />Add exam</Button></PageHeader>
      {exams.length === 0 && <Empty text="No exams added yet. Click “Add exam” and enter the official date for GATE CSE or your semester exams." />}
      {nearest && (() => { const r = split(new Date(nearest.datetime).getTime() - (now ?? 0)); return (
        <section className="panel glow text-center py-10" aria-label="Nearest exam">
          <div className="text-xs uppercase tracking-[0.3em] text-primary">Next up · {nearest.type}</div>
          <h2 className="text-2xl font-bold mt-2">{nearest.name}</h2>
          <div className="flex justify-center gap-3 sm:gap-6 mt-6">
            {([["d", "Days"], ["h", "Hours"], ["m", "Minutes"], ["s", "Seconds"]] as const).map(([k, l]) => (
              <div key={k} className="rounded-xl bg-muted px-3 sm:px-6 py-4 min-w-16"><div className="digits text-4xl sm:text-6xl font-bold">{pad(r[k])}</div><div className="text-xs text-muted-foreground mt-1">{l}</div></div>
            ))}
          </div>
          <div className="max-w-sm mx-auto mt-6"><Progress value={syllabus(nearest)} /><div className="text-xs text-muted-foreground mt-2">Syllabus {syllabus(nearest)}% complete</div></div>
        </section>); })()}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((e) => {
          const ms = new Date(e.datetime).getTime() - (now ?? 0); const r = split(ms); const past = now !== null && ms <= 0; const sp = syllabus(e);
          return (
            <article key={e.id} className={`panel space-y-3 ${nearest?.id === e.id ? "border-primary" : ""} ${past ? "opacity-60" : ""}`}>
              <div className="flex justify-between gap-2">
                <div><div className="text-xs text-primary font-semibold">{e.type}</div><h3 className="font-semibold">{e.name}</h3><div className="text-xs text-muted-foreground">{new Date(e.datetime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</div></div>
                <div className="flex gap-1 h-fit"><button aria-label="Edit exam" onClick={() => openEdit(e)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="size-4" /></button><button aria-label="Delete exam" onClick={() => confirm(`Delete ${e.name}?`) && setState((s) => ({ exams: s.exams.filter((x) => x.id !== e.id) }))} className="p-1.5 rounded-md hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button></div>
              </div>
              <div className="digits text-xl font-bold">{past ? "Completed" : `${r.d}d ${pad(r.h)}h ${pad(r.m)}m ${pad(r.s)}s`}</div>
              <div><Progress value={sp} className="h-2" /><div className="text-xs text-muted-foreground mt-1">Syllabus {sp}%</div></div>
              {e.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{e.notes}</p>}
            </article>
          );
        })}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{exams.some((x) => x.id === edit?.id) ? "Edit exam" : "Add exam"}</DialogTitle></DialogHeader>
          {edit && <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">Name<input className="field mt-1" maxLength={60} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. GATE CSE 2027" /></label>
            <label className="text-sm col-span-2">Type<select className="field mt-1" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as ExamType })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
            <label className="text-sm">Date<input type="date" className="field mt-1" value={edit.date} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></label>
            <label className="text-sm">Time<input type="time" className="field mt-1" value={edit.time} onChange={(e) => setEdit({ ...edit, time: e.target.value })} /></label>
            <fieldset className="col-span-2 text-sm"><legend>Syllabus subjects (none = all)</legend>
              <div className="grid grid-cols-2 gap-1 mt-1 max-h-40 overflow-y-auto">{subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={edit.subjectIds.includes(s.id)} onChange={(e) => setEdit({ ...edit, subjectIds: e.target.checked ? [...edit.subjectIds, s.id] : edit.subjectIds.filter((x) => x !== s.id) })} />{s.name}</label>
              ))}</div></fieldset>
            <label className="text-sm col-span-2">Notes<textarea className="field mt-1 h-20 py-2" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
