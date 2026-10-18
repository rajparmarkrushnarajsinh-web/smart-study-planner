import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Empty } from "@/components/AppShell";
import { useStore, setState, uid, dayKey, plannedStudyMin, secondsOn, fmtHM, slotMinutes, type Slot, type SlotKind } from "@/lib/store";

export const Route = createFileRoute("/timetable")({
  head: () => ({
    meta: [
      { title: "Timetable — GATE.plan" },
      { name: "description", content: "Plan your daily and weekly study timetable with college hours, meals, breaks and sleep." },
      { property: "og:title", content: "Timetable — GATE.plan" },
      { property: "og:description", content: "Editable daily and weekly study timetable." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Timetable,
});

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const KINDS: SlotKind[] = ["study", "break", "meal", "college", "sleep", "other"];
const KIND_STYLE: Record<SlotKind, string> = {
  study: "border-l-primary", break: "border-l-chart-5", meal: "border-l-warning", college: "border-l-chart-3", sleep: "border-l-muted-foreground", other: "border-l-chart-4",
};

function dateForDay(day: number) { const d = new Date(); d.setDate(d.getDate() + (day - d.getDay())); return dayKey(d); }

function Timetable() {
  const slots = useStore((s) => s.slots);
  const subjects = useStore((s) => s.subjects);
  const sessions = useStore((s) => s.sessions);
  const [day, setDay] = useState(() => new Date().getDay());
  const [view, setView] = useState<"day" | "week">("day");
  const [edit, setEdit] = useState<Slot | null>(null);

  const daySlots = (d: number) => slots.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start));
  const key = dateForDay(day);
  const planned = plannedStudyMin(slots, day);
  const actual = secondsOn(sessions, key);

  const save = () => {
    if (!edit) return;
    if (!edit.start || !edit.end) return toast.error("Start and end time are required");
    if (edit.start === edit.end) return toast.error("End time must differ from start time");
    if (edit.kind === "study" && !edit.subjectId) return toast.error("Choose a subject for study sessions");
    setState((s) => ({ slots: s.slots.some((x) => x.id === edit.id) ? s.slots.map((x) => x.id === edit.id ? edit : x) : [...s.slots, edit] }));
    setEdit(null); toast.success("Timetable saved");
  };
  const toggleDone = (sl: Slot) => setState((s) => ({ slots: s.slots.map((x) => x.id === sl.id ? { ...x, doneDates: x.doneDates.includes(key) ? x.doneDates.filter((d) => d !== key) : [...x.doneDates, key] } : x) }));
  const newSlot = (): Slot => ({ id: uid(), day, start: "10:00", end: "11:00", kind: "study", subjectId: subjects[0]?.id ?? "", chapter: "", task: "", doneDates: [] });

  const Row = ({ sl, compact }: { sl: Slot; compact?: boolean }) => {
    const done = sl.doneDates.includes(dateForDay(sl.day));
    return (
      <li className={`rounded-lg border border-l-4 ${KIND_STYLE[sl.kind]} bg-card px-3 py-2 flex items-center gap-3 ${done ? "opacity-60" : ""}`}>
        <div className="flex-1 min-w-0">
          <div className="digits text-xs text-muted-foreground">{sl.start}–{sl.end} · {slotMinutes(sl)}m</div>
          <div className={`text-sm font-medium truncate ${done ? "line-through" : ""}`}>{sl.task || sl.kind}</div>
          {!compact && sl.kind === "study" && <div className="text-xs text-muted-foreground truncate">{subjects.find((s) => s.id === sl.subjectId)?.name}{sl.chapter && ` — ${sl.chapter}`}</div>}
        </div>
        {!compact && <>
          <button aria-label="Mark complete" onClick={() => toggleDone(sl)} className={`p-1.5 rounded-md ${done ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><Check className="size-4" /></button>
          <button aria-label="Edit" onClick={() => setEdit(sl)} className="p-1.5 rounded-md hover:bg-muted"><Pencil className="size-4" /></button>
          <button aria-label="Delete" onClick={() => setState((s) => ({ slots: s.slots.filter((x) => x.id !== sl.id) }))} className="p-1.5 rounded-md hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>
        </>}
      </li>
    );
  };

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title="Timetable" sub="Plan sessions, college, meals and sleep. Reminders fire 5 minutes before study blocks.">
        <div className="flex rounded-lg bg-muted p-1">
          {(["day", "week"] as const).map((v) => <button key={v} onClick={() => setView(v)} aria-pressed={view === v} className={`px-3 py-1.5 rounded-md text-sm capitalize ${view === v ? "bg-card font-semibold" : "text-muted-foreground"}`}>{v}</button>)}
        </div>
        <Button onClick={() => setEdit(newSlot())}><Plus />Add entry</Button>
      </PageHeader>

      {view === "day" ? (<>
        <div className="flex gap-1 overflow-x-auto">
          {DAYS.map((d, i) => <button key={d} onClick={() => setDay(i)} className={`px-4 py-2 rounded-lg text-sm ${day === i ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"}`}>{d}{i === new Date().getDay() && " •"}</button>)}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel"><div className="text-sm text-muted-foreground">Planned study</div><div className="text-2xl font-bold">{fmtHM(planned * 60)}</div></div>
          <div className="panel"><div className="text-sm text-muted-foreground">Actual study ({key})</div><div className="text-2xl font-bold">{fmtHM(actual)}</div></div>
          <div className="panel"><div className="text-sm text-muted-foreground">Achievement</div><div className="text-2xl font-bold text-primary">{planned ? Math.round((actual / 60 / planned) * 100) : 0}%</div></div>
        </div>
        {daySlots(day).length === 0 ? <Empty text="No entries for this day. Add one to start planning." /> : <ul className="space-y-2">{daySlots(day).map((sl) => <Row key={sl.id} sl={sl} />)}</ul>}
      </>) : (
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {DAYS.map((d, i) => (
            <div key={d} className="space-y-2">
              <button onClick={() => { setDay(i); setView("day"); }} className="w-full text-left font-semibold text-sm">{d} <span className="text-muted-foreground font-normal">{fmtHM(plannedStudyMin(slots, i) * 60)}</span></button>
              <ul className="space-y-2">{daySlots(i).map((sl) => <Row key={sl.id} sl={sl} compact />)}</ul>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{slots.some((s) => s.id === edit?.id) ? "Edit entry" : "New entry"}</DialogTitle></DialogHeader>
          {edit && <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Day<select className="field mt-1" value={edit.day} onChange={(e) => setEdit({ ...edit, day: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
            <label className="text-sm">Type<select className="field mt-1" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as SlotKind })}>{KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
            <label className="text-sm">Start<input type="time" className="field mt-1" value={edit.start} onChange={(e) => setEdit({ ...edit, start: e.target.value })} /></label>
            <label className="text-sm">End<input type="time" className="field mt-1" value={edit.end} onChange={(e) => setEdit({ ...edit, end: e.target.value })} /></label>
            {edit.kind === "study" && <>
              <label className="text-sm col-span-2">Subject<select className="field mt-1" value={edit.subjectId} onChange={(e) => setEdit({ ...edit, subjectId: e.target.value })}><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              <label className="text-sm col-span-2">Chapter<input className="field mt-1" value={edit.chapter} onChange={(e) => setEdit({ ...edit, chapter: e.target.value })} /></label>
            </>}
            <label className="text-sm col-span-2">Task / label<input className="field mt-1" value={edit.task} maxLength={80} onChange={(e) => setEdit({ ...edit, task: e.target.value })} /></label>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
