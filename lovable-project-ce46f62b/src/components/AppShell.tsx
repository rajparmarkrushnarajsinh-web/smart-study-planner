import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { BarChart3, BookOpen, CalendarClock, Hourglass, LayoutDashboard, Moon, Sun, Timer } from "lucide-react";
import { toast } from "sonner";
import { getState, patchTimer, phaseTarget, recordSession, setState, elapsedMs, useStore, dayKey, toMin } from "@/lib/store";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/timer", label: "Timer", icon: Timer },
  { to: "/timetable", label: "Timetable", icon: CalendarClock },
  { to: "/subjects", label: "Reading", icon: BookOpen },
  { to: "/exams", label: "Exams", icon: Hourglass },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* audio blocked */ }
}
function notify(title: string, body: string) {
  toast.success(title, { description: body });
  if (getState().settings.sound) beep();
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
}

/** Global ticker: finishes timers & fires reminders even when the timer page isn't open. */
function useTicker() {
  const reminded = useRef(new Set<string>());
  useEffect(() => {
    const id = setInterval(() => {
      const { timer: t, settings, slots } = getState();
      if (t.running && t.mode !== "stopwatch" && elapsedMs(t) >= t.targetMs) {
        if (t.mode === "countdown") {
          recordSession(t.targetMs / 1000);
          patchTimer({ running: false, startedAt: null, accMs: 0 });
          notify("Countdown finished", "Session saved to your log.");
        } else if (t.phase === "work") {
          recordSession(t.targetMs / 1000);
          const count = t.pomoCount + 1;
          const phase = count % 4 === 0 ? "long" : "break";
          patchTimer({ phase, pomoCount: count, accMs: 0, startedAt: Date.now(), targetMs: phaseTarget(phase, settings) });
          notify("Focus session done!", phase === "long" ? "Take a long break." : "Take a short break.");
        } else {
          patchTimer({ phase: "work", accMs: 0, startedAt: null, running: false, targetMs: phaseTarget("work", settings) });
          notify("Break over", "Ready for the next focus session.");
        }
      }
      const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
      slots.filter((s) => s.day === now.getDay() && s.kind === "study").forEach((s) => {
        const diff = toMin(s.start) - nowMin; const key = `${dayKey()}-${s.id}`;
        if (diff >= 0 && diff <= 5 && !reminded.current.has(key)) {
          reminded.current.add(key);
          notify("Upcoming study session", `${s.task || "Study"} starts at ${s.start}`);
        }
      });
    }, 500);
    return () => clearInterval(id);
  }, []);
}

export function AppShell({ children }: { children: ReactNode }) {
  useTicker();
  const theme = useStore((s) => s.settings.theme);
  const focus = useStore((s) => s.focus);
  const path = useLocation({ select: (l) => l.pathname });
  useEffect(() => { document.documentElement.classList.toggle("dark", theme === "dark"); }, [theme]);
  const toggle = () => setState((s) => ({ settings: { ...s.settings, theme: s.settings.theme === "dark" ? "light" : "dark" } }));

  if (focus) return <main className="min-h-screen">{children}</main>;
  return (
    <div className="min-h-screen md:flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar p-4 sticky top-0 h-screen">
        <div className="px-2 py-3 mb-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Command center</div>
          <div className="text-xl font-bold">GATE<span className="text-primary">.</span>plan</div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${path === n.to ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}>
              <n.icon className="size-4" />{n.label}
            </Link>
          ))}
        </nav>
        <button onClick={toggle} className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}{theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </aside>
      <header className="md:hidden flex items-center justify-between border-b px-4 py-3 sticky top-0 bg-background/90 backdrop-blur z-20">
        <div className="text-lg font-bold">GATE<span className="text-primary">.</span>plan</div>
        <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-md hover:bg-muted">{theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
      </header>
      <main className="flex-1 min-w-0 p-4 md:p-8 pb-24 md:pb-8">{children}</main>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-6 border-t bg-background/95 backdrop-blur" aria-label="Mobile">
        {NAV.map((n) => (
          <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-1 py-2 text-[10px] ${path === n.to ? "text-primary" : "text-muted-foreground"}`}>
            <n.icon className="size-5" />{n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>{sub && <p className="text-muted-foreground text-sm mt-1">{sub}</p>}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
export function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
