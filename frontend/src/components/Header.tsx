import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-border/60 bg-card/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="brand-gradient flex size-8 items-center justify-center rounded-xl text-[13px] font-bold text-white shadow-lg shadow-indigo-500/30 ring-1 ring-white/10 ring-inset">
            D
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-tight text-foreground">DWG→PNG</span>
            <span className="hidden font-mono text-[11px] font-medium tracking-wide text-muted-foreground sm:inline">
              converter
            </span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
