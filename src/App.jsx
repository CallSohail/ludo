import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dashboard from "./Dashboard";
import Scorekeeper from "./Scorekeeper";
import {
  fetchScorebook,
  fetchEvents,
  getAdminProfile,
  getCachedLeaderboard,
  getCurrentSession,
  signIn,
  signOut,
  watchForAuth,
  watchForChanges,
} from "./dataService";
import { sortPlayers } from "./scoring";

export default function App() {
  const cachedBoard = useMemo(() => getCachedLeaderboard(), []);
  const [board, setBoard] = useState(() => ({
    players: sortPlayers(cachedBoard?.players || []),
    history: cachedBoard?.history || [],
  }));
  const [events, setEvents] = useState([]);
  const [ledgerError, setLedgerError] = useState("");
  const [loading, setLoading] = useState(() => !cachedBoard);
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const returnToCertificate = useRef(false);
  const [adminUser, setAdminUser] = useState(null);

  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("ludo-theme");
    } catch {
      return null;
    }
  });
  const [systemDark, setSystemDark] = useState(
    () => matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const darkMode = theme ? theme === "stadium" : systemDark;
  useEffect(() => {
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    const update = (event) => setSystemDark(event.matches);
    scheme.addEventListener("change", update);
    return () => scheme.removeEventListener("change", update);
  }, []);
  const [lastUpdated, setLastUpdated] = useState(() =>
    cachedBoard?.savedAt ? new Date(cachedBoard.savedAt) : null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const requestRef = useRef(0);
  const [online, setOnline] = useState(() => navigator.onLine);

  const refresh = useCallback(async () => {
    const request = ++requestRef.current;
    setRefreshing(true);
    const [snapshot, ledger] = await Promise.allSettled([
      fetchScorebook(),
      fetchEvents(),
    ]);
    if (request !== requestRef.current) return;
    if (snapshot.status === "fulfilled") {
      setBoard({
        players: sortPlayers(snapshot.value.players),
        history: snapshot.value.history,
      });
      setLastUpdated(new Date());
    }
    if (ledger.status === "fulfilled") setEvents(ledger.value);
    setLedgerError(
      ledger.status === "rejected"
        ? "The private ledger could not be refreshed."
        : "",
    );
    setError(
      snapshot.status === "rejected"
        ? "The scorebook could not be refreshed."
        : "",
    );
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    const applySession = (session) => {
      if (cancelled) return;
      const version = ++revision;
      if (!session?.user) {
        setAdminUser(null);
        setEvents([]);
        setAuthReady(true);
        return;
      }
      // Defer API calls outside the Supabase auth callback lock.
      setTimeout(async () => {
        try {
          const profile = await getAdminProfile(session.user.id);
          if (!cancelled && version === revision) {
            setAdminUser(profile ? session.user : null);
            setAuthReady(true);
          }
        } catch {
          if (!cancelled && version === revision) {
            setAdminUser(null);
            setAuthReady(true);
          }
        }
      }, 0);
    };
    getCurrentSession()
      .then(applySession)
      .catch(() => setAuthReady(true));
    const stopWatching = watchForAuth(applySession);
    return () => {
      cancelled = true;
      stopWatching();
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const timer = setInterval(() => {
      if (navigator.onLine && !document.hidden) refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const updateOnline = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) refresh();
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "stadium" : "paper";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", darkMode ? "#151c19" : "#edf0ec");
  }, [darkMode]);

  function toggleTheme() {
    const next = darkMode ? "paper" : "stadium";
    setTheme(next);
    try {
      localStorage.setItem("ludo-theme", next);
    } catch {}
  }

  useEffect(() => {
    return watchForChanges(refresh);
  }, [refresh]);
  const handleLogin = async ({ username, password }) => {
    const result = await signIn(username, password);
    setAdminUser(result.user);
    if (returnToCertificate.current) setAdminOpen(false);
    void refresh();
  };
  const handleLogout = async () => {
    await signOut();
    setAdminUser(null);
    setEvents([]);
    setAdminOpen(false);
    await refresh();
  };
  const openAdmin = (context) => {
    returnToCertificate.current = context === "certificate";
    setAdminOpen(true);
  };
  if (!authReady)
    return (
      <main className="access-shell">
        <p role="status">Loading the league…</p>
      </main>
    );
  return (
    <>
      <Dashboard
        adminUser={adminUser}
        players={board.players}
        history={board.history}
        loading={loading}
        error={error}
        online={online}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        onOpenAdmin={openAdmin}
        darkMode={darkMode}
        onToggleTheme={toggleTheme}
      />
      {adminOpen && (
        <Scorekeeper
          admin={adminUser}
          players={board.players}
          history={board.history}
          events={events}
          ledgerError={ledgerError}
          refreshing={refreshing}
          online={online}
          refresh={refresh}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </>
  );
}
