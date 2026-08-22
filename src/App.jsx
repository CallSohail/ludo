import { useCallback, useEffect, useMemo, useState } from 'react';
import { config, emojis, isSupabaseConfigured, palette, recognition } from './config';
import {
  addPoints,
  createPlayer,
  fetchEvents,
  fetchPlayers,
  getAdminProfile,
  getCurrentSession,
  signIn,
  signOut,
  watchForAuth,
  watchForChanges,
} from './dataService';

const initialPlayerForm = { name: '', accent: palette[0], emoji: emojis[0] };
const initialPointForm = { playerId: '', points: 1, reason: '' };

function sortPlayers(players) {
  return [...players].sort((a, b) => {
    const pointsDifference = Number(b.points_total || 0) - Number(a.points_total || 0);
    if (pointsDifference !== 0) return pointsDifference;
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
}

function formatDate(date, withSeconds = false) {
  if (!date || Number.isNaN(new Date(date).getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  }).format(new Date(date));
}

function getBadge(index, points) {
  if (index < 3) return recognition[index];
  if (points >= 8) return recognition[3];
  return recognition[index % recognition.length];
}

function Fireworks({ burstKey }) {
  const sparks = useMemo(() => Array.from({ length: 34 }, (_, index) => ({
    id: `${burstKey}-${index}`,
    left: `${12 + ((index * 37) % 76)}%`,
    top: `${10 + ((index * 61) % 54)}%`,
    hue: ['#ffca3a', '#ff5b3d', '#63e6be', '#8f7bff', '#fff8dc'][index % 5],
    delay: `${(index % 9) * 0.08}s`,
    distance: `${35 + (index % 5) * 10}px`,
    angle: `${index * 31}deg`,
  })), [burstKey]);
  return (
    <div className="fireworks" aria-hidden="true" key={burstKey}>
      {sparks.map((spark) => <i key={spark.id} className="spark" style={{ '--left': spark.left, '--top': spark.top, '--hue': spark.hue, '--delay': spark.delay, '--distance': spark.distance, '--angle': spark.angle }} />)}
    </div>
  );
}

function Header({ onOpenAdmin, adminUser, online }) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="Ludo Super League home">
        <span className="brand-die">⚄</span>
        <span>
          <strong>LUDO</strong>
          <small>SUPER LEAGUE</small>
        </span>
      </a>
      <div className="header-actions">
        <span className={`live-pill ${online ? '' : 'offline'}`}><span className="live-dot" /> {online ? 'Live board' : 'Offline'}</span>
        <button className="admin-trigger" onClick={onOpenAdmin} type="button">
          <span>{adminUser ? '⚙️ Admin deck' : '🔐 Admin deck'}</span>
        </button>
      </div>
    </header>
  );
}

function Hero({ players, events, onOpenAdmin }) {
  const leader = players[0];
  const totalPoints = players.reduce((sum, player) => sum + Number(player.points_total || 0), 0);
  const lastMove = events[0];
  return (
    <section className="hero" id="top">
      <div className="hero-copy">
        <p className="eyebrow"><span>EVRY</span> 2026 season • Live standings</p>
        <h1>Lose a round.<br /><em>Earn the drama.</em></h1>
        <p className="hero-text">The official home of friendly defeats. Every loss adds penalty points, every point leaves a signed trace, and the highest score earns the crown nobody asked for.</p>
        <div className="hero-buttons">
          <a className="primary-button" href="#leaderboard">See the leaderboard <span>↓</span></a>
          <button className="text-button" type="button" onClick={onOpenAdmin}>I am the scorekeeper <span>↗</span></button>
        </div>
        <div className="hero-stats">
          <div><strong>{players.length}</strong><span>players in<br />the arena</span></div>
          <div><strong>{totalPoints}</strong><span>points, allegedly<br />earned fairly</span></div>
          <div><strong>{lastMove ? formatDate(lastMove.created_at).split(',')[0] : '—'}</strong><span>latest signed<br />move</span></div>
        </div>
      </div>
      <div className="hero-art" aria-label={leader ? `${leader.name} is currently leading` : 'The board is waiting for its first player'}>
        <div className="burst-label">Current headline<br /><strong>{leader ? `${leader.name} leads` : 'Seats available'}</strong> {leader?.emoji || '🎲'}</div>
        <div className="game-board">
          <div className="board-center"><span>⚡</span><small>LUDO<br />LEAGUE</small></div>
          <span className="board-piece piece-a">{leader?.emoji || '🎲'}</span>
          <span className="board-piece piece-b">🕺</span>
          <span className="board-piece piece-c">🔥</span>
          <span className="board-piece piece-d">🍀</span>
          <span className="board-dot dot-1" /><span className="board-dot dot-2" /><span className="board-dot dot-3" /><span className="board-dot dot-4" />
        </div>
        <div className="hero-sticker sticker-one">No mercy<br />just points</div>
        <div className="hero-sticker sticker-two">#1<br />energy</div>
      </div>
    </section>
  );
}

function LeagueSnapshot({ players, events }) {
  const leader = players[0];
  const total = players.reduce((sum, player) => sum + Number(player.points_total || 0), 0);
  const tiedLeaders = leader ? players.filter((player) => Number(player.points_total) === Number(leader.points_total)).length : 0;
  const latest = events[0];
  return (
    <section className="snapshot" aria-label="League snapshot">
      <article><span className="snapshot-icon">♛</span><div><small>Penalty leader</small><strong title={leader?.name}>{leader?.name || 'No leader yet'}</strong><p>{leader ? `${leader.points_total} point${Number(leader.points_total) === 1 ? '' : 's'}${tiedLeaders > 1 ? `, ${tiedLeaders}-way tie` : ''}` : 'Add the first player'}</p></div></article>
      <article><span className="snapshot-icon">⚡</span><div><small>League pressure</small><strong>{total} total points</strong><p>Across {players.length} active player{players.length === 1 ? '' : 's'}</p></div></article>
      <article><span className="snapshot-icon">⛓</span><div><small>Latest receipt</small><strong>{latest ? `Move #${latest.event_number || '—'}` : 'Ledger ready'}</strong><p>{latest ? formatDate(latest.created_at, true) : 'Waiting for first point'}</p></div></article>
    </section>
  );
}

function Podium({ players }) {
  const podiumPlayers = [players[1], players[0], players[2]].filter(Boolean);
  const slots = [1, 0, 2];
  return (
    <div className="podium" aria-label="Top three players">
      {slots.map((index) => {
        const player = players[index];
        if (!player) return <div className={`podium-card empty podium-${index + 1}`} key={`empty-${index}`}><span>?</span><small>waiting for<br />a challenger</small></div>;
        const badge = getBadge(index, player.points_total);
        return (
          <article className={`podium-card podium-${index + 1}`} key={player.id}>
            <div className="podium-rank">{index === 0 ? '01' : index === 1 ? '02' : '03'}</div>
            <div className="podium-avatar" style={{ '--accent': player.accent }}>{player.emoji}</div>
            <div className="podium-medal">{badge.icon}</div>
            <h3 title={player.name}>{player.name}</h3>
            <span className="badge-label">{badge.label}</span>
            <strong className="podium-score">{player.points_total}<small> pts</small></strong>
            {index === 0 && <span className="crown">♛</span>}
          </article>
        );
      })}
    </div>
  );
}

function PlayerRow({ player, index, leaderPoints }) {
  const badge = getBadge(index, player.points_total);
  const progress = leaderPoints > 0 ? Math.round((Number(player.points_total || 0) / leaderPoints) * 100) : 0;
  return (
    <article className={`player-row ${index < 3 ? 'top-row' : ''}`}>
      <div className="row-rank"><span>{String(index + 1).padStart(2, '0')}</span>{index < 3 && <b>{badge.icon}</b>}</div>
      <div className="row-avatar" style={{ '--accent': player.accent }}>{player.emoji}</div>
      <div className="row-name"><strong title={player.name}>{player.name}</strong><span>{badge.label}</span></div>
      <div className="row-progress"><div><span style={{ width: `${progress}%`, background: player.accent }} /></div><small>{leaderPoints > 0 ? `${progress}% of leader` : 'No penalties yet'}</small></div>
      <div className="row-points"><strong>{player.points_total}</strong><span>points</span></div>
      <div className="row-reaction" aria-label={`${player.name} recognition`}>{index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : badge.icon}</div>
    </article>
  );
}

function Leaderboard({ players, loading }) {
  const leaderPoints = players[0]?.points_total || 0;
  return (
    <section className="leaderboard-section" id="leaderboard">
      <div className="section-heading">
        <div><p className="eyebrow">The official-ish standings</p><h2>Who is <em>winning?</em></h2></div>
        <div className="heading-note">More losses, more points.<br /><strong>Highest total ranks first.</strong></div>
      </div>
      {loading ? <div className="loading-board"><span className="spinner" />Rolling the scoreboard...</div> : players.length === 0 ? <div className="empty-board"><span>🎲</span><h3>The board is suspiciously empty.</h3><p>Open the admin deck and add your first player.</p></div> : (
        <>
          <Podium players={players} />
          <div className="list-heading"><span>Full league table</span><span>Recognition is very serious business</span></div>
          <div className="player-list">{players.map((player, index) => <PlayerRow key={player.id} player={player} index={index} leaderPoints={leaderPoints} />)}</div>
        </>
      )}
    </section>
  );
}

function RulesStrip() {
  return (
    <section className="rules-strip" aria-labelledby="rules-title">
      <div><p className="eyebrow">Thirty-second rulebook</p><h2 id="rules-title">Simple rules.<br /><em>Maximum debate.</em></h2></div>
      <ol>
        <li><span>01</span><div><strong>Lose the moment</strong><p>A player loses or misses a cut. The room takes note.</p></div></li>
        <li><span>02</span><div><strong>Add 1 to 9</strong><p>The scorekeeper adds penalty points to the existing total.</p></div></li>
        <li><span>03</span><div><strong>Sign the receipt</strong><p>Time, reason, admin and previous hash make an audit trail.</p></div></li>
      </ol>
    </section>
  );
}

function Footer({ onOpenAdmin, eventCount }) {
  return (
    <footer className="site-footer">
      <div><span className="footer-die">⚄</span><strong>Ludo Super League</strong><small>Evry 2026, where the dice have opinions.</small></div>
      <div className="footer-ledger"><span className="chain-icon">⛓</span><span><strong>{eventCount} signed events</strong><small>Every score leaves a little trace.</small></span></div>
      <button className="footer-admin" type="button" onClick={onOpenAdmin}>Open scorekeeper deck <span>↗</span></button>
    </footer>
  );
}

function AccessLoading() {
  return <main className="access-shell"><section className="access-card access-loading"><span className="spinner" /><p>Rolling the leaderboard...</p></section></main>;
}

function LoginPanel({ onLogin, busy, error }) {
  const [form, setForm] = useState({ username: '', password: '', remembered: true });
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event) => { event.preventDefault(); onLogin(form); };
  return (
    <div className="login-screen">
      <div className="login-icon">🔐</div>
      <p className="eyebrow">Restricted to people who know the scores</p>
      <h2>Enter the <em>admin deck</em></h2>
      <p className="login-copy">The players can watch. Only the scorekeeper can make the numbers move.</p>
      <form onSubmit={submit} className="login-form">
        <label>Username or email<input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="scorekeeper@example.com" required /></label>
        <label>Password<div className="password-field"><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Your secret dice password" required /><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
        <label className="check-label"><input type="checkbox" checked={form.remembered} onChange={(event) => setForm({ ...form, remembered: event.target.checked })} /><span>Remember this scorekeeper on this device, no suspicious dice rolling.</span></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="primary-button full-width" disabled={busy} type="submit">{busy ? 'Checking the ledger...' : 'Unlock the scorebook'} <span>↗</span></button>
      </form>
      <p className="demo-hint">{isSupabaseConfigured ? 'Production mode, protected by Supabase Auth.' : `Preview mode, try ${config.demoUsername} / ${config.demoPassword}.`}</p>
    </div>
  );
}

function AdminPanel({ onClose, players, events, adminUser, onLogin, onRefresh, onBurst, onLogout }) {
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [playerForm, setPlayerForm] = useState(initialPlayerForm);
  const [pointForm, setPointForm] = useState(initialPointForm);
  const [playerBusy, setPlayerBusy] = useState(false);
  const [pointBusy, setPointBusy] = useState(false);
  const [consent, setConsent] = useState(true);
  const [formMessage, setFormMessage] = useState(null);

  useEffect(() => {
    if (!pointForm.playerId && players.length > 0) {
      setPointForm((current) => ({ ...current, playerId: players[0].id }));
    }
  }, [players, pointForm.playerId]);

  const handleLogin = async (form) => {
    setLoginBusy(true); setLoginError('');
    try { await onLogin(form); } catch (error) { setLoginError(error.message || 'Could not open the scorebook.'); } finally { setLoginBusy(false); }
  };

  const handlePlayer = async (event) => {
    event.preventDefault();
    if (playerForm.name.trim().length < 2) return setFormMessage({ type: 'error', text: 'Give the player at least two letters. Even legends need a name.' });
    setPlayerBusy(true); setFormMessage(null);
    try {
      await createPlayer(playerForm);
      setPlayerForm({ ...initialPlayerForm, accent: palette[(players.length + 1) % palette.length], emoji: emojis[(players.length + 1) % emojis.length] });
      await onRefresh();
      setFormMessage({ type: 'success', text: 'Player added. The arena has a new suspect.' });
      onBurst();
    } catch (error) { setFormMessage({ type: 'error', text: error.message || 'Player could not be added.' }); }
    finally { setPlayerBusy(false); }
  };

  const handlePoints = async (event) => {
    event.preventDefault();
    if (!pointForm.playerId) return setFormMessage({ type: 'error', text: 'Choose a player first. The points need an address.' });
    if (pointForm.reason.trim().length < 3) return setFormMessage({ type: 'error', text: 'Write at least 3 characters for the reason.' });
    if (!consent) return setFormMessage({ type: 'error', text: 'Confirm the signed receipt before publishing this point.' });
    setPointBusy(true); setFormMessage(null);
    try {
      await addPoints({ ...pointForm, points: Number(pointForm.points), consent });
      setPointForm({ ...initialPointForm, playerId: pointForm.playerId });
      await onRefresh();
      setFormMessage({ type: 'success', text: `+${pointForm.points} point signed, witnessed, and released into the wild.` });
      onBurst();
    } catch (error) {
      const rawMessage = error.message || 'The point refused to enter the ledger.';
      const friendlyMessage = rawMessage.includes('digest')
        ? 'The database scoring function needs the included SQL repair. Run supabase/fix-point-scoring.sql once in Supabase.'
        : rawMessage;
      setFormMessage({ type: 'error', text: friendlyMessage });
    }
    finally { setPointBusy(false); }
  };

  if (!adminUser) return <div className="modal-backdrop"><div className="admin-modal login-modal"><button className="close-button" type="button" onClick={onClose} aria-label="Close admin panel">×</button><LoginPanel onLogin={handleLogin} busy={loginBusy} error={loginError} /></div></div>;

  const selectedPlayer = players.find((player) => player.id === pointForm.playerId);
  const projectedTotal = Number(selectedPlayer?.points_total || 0) + Number(pointForm.points || 0);

  return (
    <div className="modal-backdrop"><div className="admin-modal admin-console">
      <div className="admin-topbar"><div><p className="eyebrow">Scorekeeper deck</p><h2>Make the board <em>move.</em></h2></div><div className="admin-top-actions"><span className="signed-in">● Signed in as {adminUser.email || 'scorekeeper'}</span><button className="close-button" type="button" onClick={onClose} aria-label="Close admin panel">×</button></div></div>
      <div className="admin-grid">
        <div className="admin-forms">
          <form className="admin-card" onSubmit={handlePlayer}>
            <div className="card-title"><span className="card-number">01</span><div><h3>Add a player</h3><p>Give a future champion a seat at the table.</p></div></div>
            <label>Player name<input maxLength="28" value={playerForm.name} onChange={(event) => setPlayerForm({ ...playerForm, name: event.target.value })} placeholder="e.g. The Dice Whisperer" /></label>
            <div className="mini-fields"><label>Piece color<div className="color-picker">{palette.slice(0, 8).map((color) => <button key={color} type="button" className={playerForm.accent === color ? 'selected' : ''} style={{ background: color }} onClick={() => setPlayerForm({ ...playerForm, accent: color })} aria-label={`Choose ${color} player color`} />)}</div></label><label>Spirit emoji<div className="emoji-picker">{emojis.slice(0, 8).map((emoji) => <button key={emoji} type="button" className={playerForm.emoji === emoji ? 'selected' : ''} onClick={() => setPlayerForm({ ...playerForm, emoji })} aria-label={`Choose ${emoji} player emoji`}>{emoji}</button>)}</div></label></div>
            <button className="dark-button full-width" disabled={playerBusy} type="submit">{playerBusy ? 'Adding...' : 'Add to the arena'} <span>+</span></button>
          </form>
          <form className="admin-card points-card" onSubmit={handlePoints}>
            <div className="card-title"><span className="card-number">02</span><div><h3>Drop a point</h3><p>One to nine, because chaos needs boundaries.</p></div></div>
            <label>Who earned it?<select value={pointForm.playerId} onChange={(event) => setPointForm({ ...pointForm, playerId: event.target.value })}><option value="">Choose a player...</option>{players.map((player) => <option value={player.id} key={player.id}>{player.emoji} {player.name}, currently {player.points_total} pts</option>)}</select></label>
            <label>How many points?<div className="point-picker">{Array.from({ length: 9 }, (_, index) => index + 1).map((point) => <button key={point} type="button" className={Number(pointForm.points) === point ? 'selected' : ''} onClick={() => setPointForm({ ...pointForm, points: point })}>{point}</button>)}</div></label>
            <div className={`score-preview ${selectedPlayer ? 'ready' : ''}`}><span>{selectedPlayer?.emoji || '🎯'}</span><div><small>Score impact preview</small><strong>{selectedPlayer ? `${selectedPlayer.name}: ${selectedPlayer.points_total} → ${projectedTotal}` : 'Choose a player to preview the new total'}</strong></div><b>{selectedPlayer ? `+${pointForm.points}` : '—'}</b></div>
            <label>Official-ish reason<input minLength="3" maxLength="180" value={pointForm.reason} onChange={(event) => setPointForm({ ...pointForm, reason: event.target.value })} placeholder="Lost the round" /><span className="field-help">{pointForm.reason.length}/180 characters</span></label>
            <div className="reason-shortcuts" aria-label="Quick reasons">{['Lost the round', 'Missed the cut', 'Dice betrayal'].map((reason) => <button type="button" key={reason} onClick={() => setPointForm({ ...pointForm, reason })}>{reason}</button>)}</div>
            <label className="consent-box"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><strong>Witnessed and approved.</strong><small>This point will be signed with the current time, admin identity, and previous event hash.</small></span><span className="stamp">{consent ? '✓' : '!'}</span></label>
            {formMessage && <div className={`form-message inline-message ${formMessage.type}`} role="status">{formMessage.type === 'success' ? '✓' : '!' } {formMessage.text}</div>}
            <button className="primary-button full-width" disabled={pointBusy || players.length === 0 || !consent} type="submit">{pointBusy ? 'Signing the point...' : 'Sign and publish point'} <span>✦</span></button>
          </form>
        </div>
        <div className="ledger-card">
          <div className="ledger-heading"><div><p className="eyebrow">Tamper-evident-ish ledger</p><h3>Recent moves</h3></div><span className="chain-mark">⛓</span></div>
          <div className="ledger-list">{events.length === 0 ? <div className="ledger-empty">No signed moves yet.<br />The first point is waiting for its dramatic entrance.</div> : events.slice(0, 10).map((event) => { const player = players.find((item) => item.id === event.player_id); return <div className="ledger-row" key={event.id}><span className="ledger-points">+{event.points}</span><div><strong>{player?.name || 'Unknown player'}</strong><p>{event.reason}</p><small>{formatDate(event.created_at, true)} • #{event.event_number || '—'}</small></div><span className="ledger-hash" title={event.event_hash}>✓ {event.event_hash?.slice(0, 7)}</span></div>; })}</div>
          <div className="ledger-footer"><span>Chain status</span><strong><i /> Connected</strong></div>
          <button className="logout-button" type="button" onClick={onLogout}>Lock the scorekeeper deck <span>↗</span></button>
        </div>
      </div>
      {formMessage && <div className={`form-message desktop-message ${formMessage.type}`} role="status">{formMessage.type === 'success' ? '✓' : '!' } {formMessage.text}</div>}
    </div></div>
  );
}

export default function App() {
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [burstKey, setBurstKey] = useState(0);
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(() => navigator.onLine);

  const refresh = useCallback(async () => {
    try {
      const [nextPlayers, nextEvents] = await Promise.all([fetchPlayers(), fetchEvents()]);
      setPlayers(sortPlayers(nextPlayers)); setEvents(nextEvents); setError('');
    } catch (loadError) { setError(loadError.message || 'The scoreboard is taking a suspiciously long coffee break.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const applySession = (session) => {
      if (cancelled) return;
      const user = session?.user || null;
      setAdminUser(null);
      setAuthReady(true);
      if (!user) {
        setAdminOpen(false);
        return;
      }
      getAdminProfile(user.id)
        .then((profile) => { if (!cancelled && profile) setAdminUser(user); })
        .catch(() => {});
    };
    getCurrentSession().then(applySession).catch(() => setAuthReady(true));
    const stopWatching = watchForAuth(applySession);
    return () => { cancelled = true; stopWatching(); };
  }, []);

  useEffect(() => {
    setLoading(true); refresh();
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => { window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline); };
  }, []);

  useEffect(() => {
    return watchForChanges(() => { refresh(); setBurstKey((key) => key + 1); });
  }, [refresh]);
  const handleLogin = async ({ username, password }) => {
    const result = await signIn(username, password);
    setAdminUser(result.user);
    await refresh();
  };
  const handleLogout = async () => {
    await signOut();
    setAdminUser(null); setAdminOpen(false);
    await refresh();
  };
  const openAdmin = () => setAdminOpen(true);
  const leader = players[0];

  if (!authReady) return <AccessLoading />;

  return (
    <div className="app-shell">
      <Fireworks burstKey={burstKey} />
      <Header onOpenAdmin={openAdmin} adminUser={adminUser} online={online} />
      <main>
        <Hero players={players} events={events} onOpenAdmin={openAdmin} />
        <LeagueSnapshot players={players} events={events} />
        <section className="ticker" aria-label="League status"><span className="ticker-label">NEWS FLASH</span><span className="ticker-copy">{leader ? `${leader.name} is currently holding the crown with ${leader.points_total} point${leader.points_total === 1 ? '' : 's'}.` : 'The dice are warming up. The first point is still available.'}</span><span className="ticker-time">{clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></section>
        <Leaderboard players={players} loading={loading} />
        <RulesStrip />
        {!online && <div className="offline-banner" role="status">You are offline. The last loaded scores are still visible, but new updates will wait for a connection.</div>}
        {error && <div className="global-error" role="alert">⚠️ {error} <button onClick={refresh} type="button">Try again</button></div>}
      </main>
      <Footer onOpenAdmin={openAdmin} eventCount={events.length} />
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} players={players} events={events} adminUser={adminUser} onLogin={handleLogin} onRefresh={refresh} onBurst={() => setBurstKey((key) => key + 1)} onLogout={handleLogout} />}
    </div>
  );
}
