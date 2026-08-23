import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Clock3,
  Command,
  Globe2,
  LifeBuoy,
  PlusCircle,
  Search,
  Sparkles,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const routeMeta = [
  {
    match: (path) => path === "/",
    title: "Global Complaint Resolution Portal",
    description:
      "Designed for distributed teams with transparent workflows and SLA-focused execution.",
    badge: "Public Access",
  },
  {
    match: (path) => path.startsWith("/dashboard"),
    title: "Operations Dashboard",
    description:
      "Monitor workload, escalation health, and throughput in one operational view.",
    badge: "Live Data",
  },
  {
    match: (path) => path.startsWith("/complaints"),
    title: "Complaint Workspace",
    description:
      "Capture complete issue context, track lifecycle, and keep every stakeholder informed.",
    badge: "Case Management",
  },
  {
    match: (path) => path.startsWith("/staff"),
    title: "Staff Command Center",
    description:
      "Prioritize assigned work, collaborate with notes, and resolve cases with accountability.",
    badge: "Team Workspace",
  },
  {
    match: (path) => path.startsWith("/admin"),
    title: "Administration Hub",
    description:
      "Manage categories, staff performance, assignment rules, and compliance-level reporting.",
    badge: "Governance",
  },
  {
    match: (path) => path.startsWith("/profile"),
    title: "Account & Preferences",
    description:
      "Keep your identity details up to date and maintain a reliable security profile.",
    badge: "Personal Settings",
  },
  {
    match: (path) => path.startsWith("/support"),
    title: "Support Center",
    description:
      "Find quick answers, contact specialists, and reduce operational friction fast.",
    badge: "24/7 Help",
  },
  {
    match: (path) => path.startsWith("/about") || path.startsWith("/features"),
    title: "Platform Overview",
    description:
      "Understand platform capabilities built for multi-role organizations and modern service teams.",
    badge: "Product Tour",
  },
  {
    match: (path) => path.startsWith("/privacy") || path.startsWith("/terms"),
    title: "Policy & Compliance",
    description:
      "Review legal and data handling commitments supporting enterprise adoption.",
    badge: "Compliance Ready",
  },
];

const commandGroups = {
  guest: [
    { label: "Open Home", path: "/" },
    { label: "View Features", path: "/features" },
    { label: "Go to Support", path: "/support" },
    { label: "Sign In", path: "/login" },
    { label: "Create Account", path: "/register" },
  ],
  user: [
    { label: "My Dashboard", path: "/dashboard" },
    { label: "New Complaint", path: "/complaints/new" },
    { label: "My Complaints", path: "/complaints" },
    { label: "Profile Settings", path: "/profile" },
    { label: "Support Center", path: "/support" },
  ],
  staff: [
    { label: "Staff Dashboard", path: "/staff/dashboard" },
    { label: "Assigned Complaints", path: "/staff/complaints" },
    { label: "Support Center", path: "/support" },
    { label: "Profile Settings", path: "/profile" },
  ],
  admin: [
    { label: "Admin Dashboard", path: "/admin/dashboard" },
    { label: "Manage Complaints", path: "/admin/complaints" },
    { label: "Manage Staff", path: "/admin/staff" },
    { label: "Analytics", path: "/admin/analytics" },
    { label: "Escalation Rules", path: "/admin/escalation-rules" },
    { label: "Reports", path: "/admin/reports" },
    { label: "Support Center", path: "/support" },
  ],
};

const GlobalExperienceLayer = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [localTime, setLocalTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const timer = setInterval(() => setLocalTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setLocalTime(new Date());
  }, [pathname]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }

      if (event.key === "Escape") {
        setCommandOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const meta = useMemo(() => {
    const found = routeMeta.find((item) => item.match(pathname));
    return (
      found || {
        title: "Complaint Resolution System",
        description:
          "Operate reliably with role-based workflows, smart escalations, and full resolution traceability.",
        badge: "Operational",
      }
    );
  }, [pathname]);

  const crumbPaths = useMemo(() => {
    if (pathname === "/") return [{ label: "Home", path: "/" }];

    const segments = pathname.split("/").filter(Boolean);
    return [
      { label: "Home", path: "/" },
      ...segments.map((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        const clean = segment.replace(/-/g, " ");
        const label = clean.charAt(0).toUpperCase() + clean.slice(1);
        return { label, path };
      }),
    ];
  }, [pathname]);

  const commandItems = useMemo(() => {
    if (!user?.role) return commandGroups.guest;
    if (user.role === "user") return commandGroups.user;
    if (user.role === "staff") return commandGroups.staff;
    return commandGroups.admin;
  }, [user]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commandItems;
    const normalized = query.toLowerCase();
    return commandItems.filter((item) => item.label.toLowerCase().includes(normalized));
  }, [commandItems, query]);

  const timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const openSupport = () => {
    navigate("/support");
  };

  return (
    <>
      <div className="rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-r from-blue-50 via-white to-cyan-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 px-4 sm:px-6 py-4 shadow-sm animate-fade-in">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center flex-wrap gap-2 text-xs mb-2">
              {crumbPaths.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center text-gray-500 dark:text-gray-400">
                  {index > 0 && <ChevronRight className="h-3.5 w-3.5 mx-1" />}
                  <Link to={crumb.path} className="hover:text-primary transition-colors">
                    {crumb.label}
                  </Link>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                {meta.title}
              </h1>
              <span className="inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800 px-2.5 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40">
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                {meta.badge}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-3xl">{meta.description}</p>
          </div>

          <div className="flex flex-wrap gap-2.5 items-center">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/80 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:border-primary/40 hover:text-primary transition-colors"
              aria-label="Open command menu"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Quick Find
              <span className="ml-2 rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px]">
                Ctrl + K
              </span>
            </button>
            <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/80 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
              <Clock3 className="h-3.5 w-3.5 mr-1.5 text-primary" />
              {localTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="inline-flex items-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/80 px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
              <Globe2 className="h-3.5 w-3.5 mr-1.5 text-primary" />
              {timezoneLabel}
            </div>
            <div
              className={`inline-flex items-center rounded-xl border px-3 py-2 text-xs ${
                isOnline
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
              }`}
            >
              {isOnline ? (
                <Wifi className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 mr-1.5" />
              )}
              {isOnline ? "Connected" : "Offline mode"}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={openSupport}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center rounded-full bg-primary text-white px-4 py-3 shadow-lg shadow-blue-300/40 hover:scale-[1.02] hover:shadow-xl transition-all"
        aria-label="Open support center"
      >
        <LifeBuoy className="h-4 w-4 mr-2" />
        Support
      </button>

      {user?.role === "user" && (
        <Link
          to="/complaints/new"
          className="fixed bottom-20 right-5 z-40 inline-flex items-center rounded-full border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-primary dark:text-blue-300 px-4 py-3 shadow-md hover:scale-[1.02] transition-all"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Issue
        </Link>
      )}

      {commandOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm p-4 sm:p-8" onClick={() => setCommandOpen(false)}>
          <div
            className="mx-auto mt-10 max-w-xl rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2 text-primary dark:text-blue-300">
                  <Command className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search destinations..."
                    className="w-full bg-transparent text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {filteredCommands.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">No matching destination found.</p>
              ) : (
                filteredCommands.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      navigate(item.path);
                      setCommandOpen(false);
                      setQuery("");
                    }}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-800"
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalExperienceLayer;