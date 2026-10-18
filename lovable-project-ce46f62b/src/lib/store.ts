import { useSyncExternalStore } from "react";

export type Priority = "High" | "Medium" | "Low";
export type SlotKind = "study" | "break" | "meal" | "college" | "sleep" | "other";
export type ExamType = "GATE CSE" | "Semester" | "Internal Test" | "Backlog" | "Other";
export type TimerMode = "stopwatch" | "countdown" | "pomodoro";

export interface Subject { id: string; name: string; color: number }
export interface Chapter {
  id: string; subjectId: string; name: string;
  lectures: number; lecturesDone: number; lectureMins: number;
  priority: Priority; target: string;
  reading: boolean; notes: boolean; revision: boolean; practice: boolean;
  pyqTotal: number; pyqDone: number;
  revisions: string[];
}
export interface Exam { id: string; name: string; type: ExamType; datetime: string; notes: string; subjectIds: string[] }
export interface Slot { id: string; day: number; start: string; end: string; kind: SlotKind; subjectId: string; chapter: string; task: string; doneDates: string[] }
export interface Task { id: string; title: string; due: string; done: boolean; subjectId: string }
export interface Session { id: string; subjectId: string; chapterId: string; start: number; durationSec: number; mode: TimerMode }
export interface TimerState {
  mode: TimerMode; running: boolean; startedAt: number | null; accMs: number; targetMs: number;
  phase: "work" | "break" | "long"; pomoCount: number; subjectId: string; chapterId: string;
}
export interface Settings { dailyTargetHours: number; pomoWork: number; pomoBreak: number; pomoLong: number; theme: "dark" | "light"; sound: boolean }

export interface State {
  subjects: Subject[]; chapters: Chapter[]; exams: Exam[]; slots: Slot[]; tasks: Task[];
  sessions: Session[]; timer: TimerState; settings: Settings; focus: boolean;
}

export const uid = () => Math.random().toString(36).slice(2, 10);
export const dayKey = (d: Date | number = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const SUBJECTS: [string, string[]][] = [
  ["Data Structures and Algorithms", ["Arrays & Linked Lists", "Trees & BST", "Graphs", "Sorting & Searching", "Dynamic Programming"]],
  ["Operating Systems", ["Processes & Threads", "CPU Scheduling", "Synchronization", "Deadlocks", "Memory Management"]],
  ["Computer Networks", ["OSI & TCP/IP", "Data Link Layer", "IP Addressing & Routing", "Transport Layer"]],
  ["DBMS", ["ER Model", "Relational Algebra & SQL", "Normalization", "Transactions & Concurrency", "Indexing & B+ Trees"]],
  ["Theory of Computation", ["Regular Languages", "Context-Free Languages", "Turing Machines", "Decidability"]],
  ["Compiler Design", ["Lexical Analysis", "Parsing", "Syntax-Directed Translation", "Intermediate Code"]],
  ["Computer Organization and Architecture", ["Machine Instructions", "Pipelining", "Cache Memory", "I/O & DMA"]],
  ["Digital Logic", ["Boolean Algebra", "Combinational Circuits", "Sequential Circuits", "Number Systems"]],
  ["Discrete Mathematics", ["Propositional Logic", "Sets & Relations", "Graph Theory", "Combinatorics"]],
  ["Engineering Mathematics", ["Linear Algebra", "Calculus", "Probability & Statistics"]],
  ["Aptitude", ["Verbal Ability", "Quantitative Aptitude", "Analytical Reasoning"]],
  ["Programming in C", ["Pointers", "Recursion", "Structures & Unions", "Storage Classes"]],
];

function seed(): State {
  const subjects: Subject[] = [];
  const chapters: Chapter[] = [];
  SUBJECTS.forEach(([name, chs], i) => {
    const sid = `s${i}`;
    subjects.push({ id: sid, name, color: i % 5 });
    chs.forEach((c, j) => {
      const done = i < 3 && j < 2;
      chapters.push({
        id: `c${i}_${j}`, subjectId: sid, name: c, lectures: 6, lecturesDone: done ? 6 : i < 4 && j === 2 ? 3 : 0,
        lectureMins: 60, priority: j === 0 ? "High" : j % 2 ? "Medium" : "Low", target: "",
        reading: done, notes: done, revision: false, practice: done && j === 0, pyqTotal: 30, pyqDone: done ? 18 : 0, revisions: [],
      });
    });
  });
  const slots: Slot[] = [];
  for (let d = 0; d < 7; d++) {
    const base = (s: string, e: string, kind: SlotKind, task: string, subjectId = "", chapter = "") =>
      slots.push({ id: uid(), day: d, start: s, end: e, kind, subjectId, chapter, task, doneDates: [] });
    base("06:30", "08:00", "study", "Morning concept study", `s${d % 12}`, "");
    base("08:00", "08:30", "meal", "Breakfast");
    if (d >= 1 && d <= 5) base("09:00", "16:00", "college", "College hours");
    base("17:00", "18:30", "study", "PYQ practice", `s${(d + 3) % 12}`, "");
    base("20:00", "20:45", "meal", "Dinner");
    base("21:00", "22:30", "study", "Revision & notes", `s${(d + 6) % 12}`, "");
    base("23:00", "06:00", "sleep", "Sleep");
  }
  const now = Date.now();
  const sessions: Session[] = [];
  for (let k = 1; k <= 6; k++) {
    sessions.push({ id: uid(), subjectId: `s${k % 4}`, chapterId: "", start: now - k * 86400000, durationSec: (60 + k * 20) * 60, mode: "pomodoro" });
  }
  return {
    subjects, chapters, slots, sessions, exams: [],
    tasks: [
      { id: uid(), title: "Solve 10 GATE PYQs on Graphs", due: dayKey(), done: false, subjectId: "s0" },
      { id: uid(), title: "Make short notes: CPU Scheduling", due: dayKey(now + 86400000), done: false, subjectId: "s1" },
      { id: uid(), title: "Revise Normalization (1NF–BCNF)", due: dayKey(now + 2 * 86400000), done: false, subjectId: "s3" },
    ],
    timer: { mode: "pomodoro", running: false, startedAt: null, accMs: 0, targetMs: 25 * 60000, phase: "work", pomoCount: 0, subjectId: "s0", chapterId: "" },
    settings: { dailyTargetHours: 6, pomoWork: 25, pomoBreak: 5, pomoLong: 15, theme: "dark", sound: true },
    focus: false,
  };
}

const KEY = "gate-planner-v1";
const initial = seed();
let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw), focus: false };
  } catch { /* corrupted storage: keep seed */ }
}

export function setState(fn: (s: State) => Partial<State>) {
  load();
  state = { ...state, ...fn(state) };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota */ }
  listeners.forEach((l) => l());
}
export const getState = () => { load(); return state; };

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => sel(getState()),
    () => sel(initial),
  );
}

export function resetAll() { localStorage.removeItem(KEY); state = seed(); setState(() => ({})); }

/* ---------- derived helpers ---------- */
export function chapterProgress(c: Chapter) {
  const lec = c.lectures > 0 ? Math.min(1, c.lecturesDone / c.lectures) : 0;
  const flags = [c.reading, c.notes, c.revision, c.practice].filter(Boolean).length / 4;
  return Math.round((lec * 0.4 + flags * 0.6) * 100);
}
export function subjectProgress(chs: Chapter[]) {
  if (!chs.length) return 0;
  return Math.round(chs.reduce((a, c) => a + chapterProgress(c), 0) / chs.length);
}
const SR = [1, 3, 7, 14, 30];
export function nextRevision(c: Chapter): string | null {
  if (!c.revisions.length) return null;
  const last = new Date(c.revisions[c.revisions.length - 1] + "T00:00");
  last.setDate(last.getDate() + SR[Math.min(c.revisions.length - 1, SR.length - 1)]);
  return dayKey(last);
}
export function secondsOn(sessions: Session[], key: string) {
  return sessions.filter((s) => dayKey(s.start) === key).reduce((a, s) => a + s.durationSec, 0);
}
export function streak(sessions: Session[]) {
  const days = new Set(sessions.filter((s) => s.durationSec >= 60).map((s) => dayKey(s.start)));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export function slotMinutes(s: Slot) { let d = toMin(s.end) - toMin(s.start); if (d < 0) d += 1440; return d; }
export function plannedStudyMin(slots: Slot[], day: number) {
  return slots.filter((s) => s.day === day && s.kind === "study").reduce((a, s) => a + slotMinutes(s), 0);
}
export const fmtHM = (sec: number) => { const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return `${h}h ${m}m`; };
export const pad = (n: number) => String(n).padStart(2, "0");
export function fmtClock(ms: number) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(t / 3600))}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

/* ---------- timer ---------- */
export const elapsedMs = (t: TimerState, now = Date.now()) => t.accMs + (t.running && t.startedAt ? now - t.startedAt : 0);

export function recordSession(sec: number) {
  if (sec < 60) return false;
  const t = getState().timer;
  setState((s) => ({ sessions: [...s.sessions, { id: uid(), subjectId: t.subjectId, chapterId: t.chapterId, start: Date.now() - sec * 1000, durationSec: Math.round(sec), mode: t.mode }] }));
  return true;
}
export function patchTimer(p: Partial<TimerState>) { setState((s) => ({ timer: { ...s.timer, ...p } })); }
export function phaseTarget(phase: TimerState["phase"], st: Settings) {
  return (phase === "work" ? st.pomoWork : phase === "break" ? st.pomoBreak : st.pomoLong) * 60000;
}
