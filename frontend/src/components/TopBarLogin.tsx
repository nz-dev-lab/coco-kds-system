// components/TopBarLogin.tsx
import ThemeToggle from "./ThemeToggle";
import WindowControls from "./WindowControls";

export default function TopBarLogin() {
  return (
    <div 
      className="fixed top-0 left-0 right-0 h-12 bg-slate-50 dark:bg-kds-bg-secondary border-b border-slate-50 dark:border-kds-border z-50 flex items-center justify-end"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <div className="" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <ThemeToggle />
      </div>
      {/* Window Controls - Far Right */}
      <div 
        className="border-l border-kds-border"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <WindowControls />
      </div>
    </div>
  );
}