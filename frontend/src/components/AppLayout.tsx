import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { loadState, type AppState } from "@/lib/store";

interface AppLayoutProps {
  children: React.ReactNode;
  topbarTitle?: string;
  topbarExtra?: React.ReactNode;
}

const AppLayout = ({ children, topbarTitle, topbarExtra }: AppLayoutProps) => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [state, setState] = useState<AppState | null>(null);

  useEffect(() => {
    setState(loadState());
    try {
      const ui = JSON.parse(localStorage.getItem("adgen_ui") || "{}");
      if (ui.sidebarCollapsed) setCollapsed(true);
    } catch { /* */ }
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        const ui = JSON.parse(localStorage.getItem("adgen_ui") || "{}");
        ui.sidebarCollapsed = next;
        localStorage.setItem("adgen_ui", JSON.stringify(ui));
      } catch { /* */ }
      return next;
    });
  };

  const p = state?.project;
  const pct = p
    ? Math.min(100, Math.round((p.formats.filter((f) => f.status === "done").length / 5) * 100))
    : 0;

  const navItems = [
    { to: "/", label: "Project Hub" },
    { to: "/batch", label: "Batch Studio" },
    { to: "/output", label: "Output" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-border bg-surface shrink-0 transition-all duration-200 ${
          collapsed ? "w-11 min-w-[44px]" : "w-[220px] min-w-[220px]"
        }`}
      >
        {/* Logo */}
        <div
          className={`flex items-center gap-2.5 border-b border-border shrink-0 ${
            collapsed ? "justify-center px-2 py-3.5" : "px-4 py-4"
          }`}
        >
          <div className="w-7 h-7 bg-primary rounded-[7px] flex items-center justify-center text-[13px] font-extrabold text-primary-foreground shrink-0">
            A
          </div>
          {!collapsed && (
            <div className="text-sm font-bold tracking-wider">
              ad<span className="text-primary">gen</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="py-2.5 px-2 border-b border-border shrink-0">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-2.5 py-[7px] rounded-[7px] text-xs font-medium transition-all cursor-pointer select-none ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-surface2 text-primary"
                    : "text-muted-foreground hover:bg-surface2 hover:text-foreground"
                }`}
              >
                <div
                  className={`w-[5px] h-[5px] rounded-full shrink-0 ${
                    isActive ? "bg-primary shadow-[0_0_5px_hsl(var(--primary))]" : "bg-muted-foreground"
                  }`}
                />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Project */}
        {!collapsed && p && (
          <div className="flex-1 overflow-y-auto p-2">
            <div className="p-2.5 rounded-lg border border-border2 bg-surface2">
              <div className="flex items-center gap-[7px] mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))]" />
                <div className="text-xs font-semibold text-primary truncate">{p.name}</div>
              </div>
              <div className="font-mono text-[9px] text-muted-foreground">
                {p.brand.category} · batch {p.batchCount}
              </div>
              <div className="mt-1.5 h-0.5 bg-border rounded-sm overflow-hidden">
                <div className="h-full bg-primary rounded-sm transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Collapse */}
        <button
          onClick={toggleSidebar}
          className={`w-full p-2 flex items-center border-t border-border cursor-pointer shrink-0 transition-colors hover:bg-surface2 ${
            collapsed ? "justify-center" : "justify-end"
          }`}
        >
          <span
            className={`font-mono text-[10px] text-muted-foreground transition-transform ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            ◀
          </span>
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Topbar */}
        <div className="h-[52px] border-b border-border flex items-center px-5 gap-2.5 shrink-0 bg-surface">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))]" />
          <div className="text-sm font-bold">{topbarTitle || p?.name || "—"}</div>
          <div className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 bg-surface2 border border-border rounded">
            {p?.id || "—"}
          </div>
          <div className="flex-1" />
          {topbarExtra}
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
};

export default AppLayout;
