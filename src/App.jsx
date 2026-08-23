import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { config, emojis, isSupabaseConfigured, palette, recognition } from './config';
import {
  addPoints,
  adjustScore,
  archivePlayer,
  createPlayer,
  fetchEvents,
  fetchPlayers,
  fetchScoreHistory,
  getCachedLeaderboard,
  getAdminProfile,
  getCurrentSession,
  signIn,
  signOut,
  updatePlayer,
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

function getRankReaction(index, total) {
  const progress = total <= 1 ? 0 : index / (total - 1);
  if (index === 0) return { face: '😭', label: 'Maximum suffering', tone: 'crying' };
  if (progress < .3) return { face: '😤', label: 'Deeply concerned', tone: 'angry' };
  if (progress < .65) return { face: '😐', label: 'Processing events', tone: 'neutral' };
  return { face: '😌', label: 'Living peacefully', tone: 'happy' };
}

function PlayerSparkline({ playerId, history, accent }) {
  const moves = history.filter((event) => event.player_id === playerId).sort((a, b) => Number(a.event_number) - Number(b.event_number));
  let total = 0;
  const values = [0, ...moves.map((event) => (total = Math.max(0, total + Number(event.points || 0))))].slice(-14);
  const max = Math.max(1, ...values);
  const x = (index) => 7 + (index / Math.max(1, values.length - 1)) * 86;
  const y = (value) => 38 - (value / max) * 30;
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  const area = `7,38 ${points} 93,38`;
  const latest = values.at(-1) || 0;
  const previous = values.at(-2) || 0;
  const change = latest - previous;

  return (
    <div className="progress-chart" style={{ '--chart-accent': accent }}>
      <div className="chart-meta"><span>{moves.length ? `${moves.length} signed move${moves.length === 1 ? '' : 's'}` : 'No moves yet'}</span><b>{change > 0 ? `+${change}` : change || '—'} latest</b></div>
      <svg className="sparkline" viewBox="0 0 100 44" role="img" aria-label={`${moves.length} recorded score moves, current total ${latest}`} preserveAspectRatio="none">
        <defs><linearGradient id={`chart-${playerId}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={accent} stopOpacity=".3" /><stop offset="1" stopColor={accent} stopOpacity=".02" /></linearGradient></defs>
        <path className="chart-grid" d="M7 8 H93 M7 23 H93 M7 38 H93" />
        <polygon points={area} fill={`url(#chart-${playerId})`} />
        <polyline className="chart-line" points={points} style={{ stroke: accent }} />
        {values.map((value, index) => <circle className="chart-point" key={`${index}-${value}`} cx={x(index)} cy={y(value)} r={index === values.length - 1 ? 2.7 : 1.25} style={{ fill: accent }} />)}
      </svg>
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
      <nav className="main-nav" aria-label="Main navigation">
        <a href="#top">Overview</a>
        <a href="#leaderboard">Standings</a>
        <span>Evry 2026</span>
      </nav>
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
        <div className="ludo-spinner" aria-hidden="true"><span>⚄</span><i /><i /><i /><i /></div>
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

function Podium({ players, onOpen }) {
  const slots = [0, 1, 2];
  return (
    <ol className="podium" aria-label="Top three players">
      {slots.map((index) => {
        const player = players[index];
        if (!player) return <li className={`podium-card empty podium-${index + 1}`} key={`empty-${index}`}><span>?</span><small>waiting for<br />a challenger</small></li>;
        const badge = getBadge(index, player.points_total);
        const reaction = getRankReaction(index, players.length);
        return (
          <li className={`podium-card podium-${index + 1}`} key={player.id} style={{ '--accent': player.accent }}>
            <div className="podium-rank">{index === 0 ? '01' : index === 1 ? '02' : '03'}</div>
            <div className={`podium-avatar reaction-${reaction.tone}`} style={{ '--accent': player.accent }}><span>{player.emoji}</span><b>{reaction.face}</b></div>
            <div className="podium-medal">{badge.icon}</div>
            <h3 title={player.name}>{player.name}</h3>
            <span className="badge-label">{badge.label}</span>
            <strong className="podium-score">{player.points_total}<small> pts</small></strong>
            {index === 0 && <span className="crown">♛</span>}
            <button type="button" className="podium-open" onClick={() => onOpen(player)} aria-label={`Open profile for ${player.name}`}>View profile <span>→</span></button>
          </li>
        );
      })}
    </ol>
  );
}

function PlayerRow({ player, index, leaderPoints, history, totalPlayers, onOpen }) {
  const badge = getBadge(index, player.points_total);
  const reaction = getRankReaction(index, totalPlayers);
  const progress = leaderPoints > 0 ? Math.round((Number(player.points_total || 0) / leaderPoints) * 100) : 0;
  return (
    <button className={`player-row ${index < 3 ? 'top-row' : ''}`} type="button" onClick={() => onOpen(player)} aria-label={`Open ${player.name} profile, rank ${index + 1}, ${player.points_total} points`}>
      <div className="row-rank"><span>{String(index + 1).padStart(2, '0')}</span>{index < 3 && <b>{badge.icon}</b>}</div>
      <div className="row-avatar" style={{ '--accent': player.accent }}>{player.emoji}</div>
      <div className="row-name"><strong title={player.name}>{player.name}</strong><span>{badge.label}</span></div>
      <div className="row-progress"><PlayerSparkline playerId={player.id} history={history} accent={player.accent} /><span className="leader-meter" aria-label={`${progress}% of leader's score`}><span><i style={{ width: `${Math.min(100, progress)}%` }} /></span><b>{progress}% of leader</b></span></div>
      <div className="row-points"><strong>{player.points_total}</strong><span>points</span></div>
      <div className={`row-reaction reaction-${reaction.tone}`} title={reaction.label} aria-label={`${player.name}: ${reaction.label}`}>{reaction.face}</div>
      <span className="row-open" aria-hidden="true">Profile</span>
    </button>
  );
}

function PlayerProfile({ player, index, players, history, onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const moves = history.filter((event) => event.player_id === player.id).sort((a, b) => Number(b.event_number || 0) - Number(a.event_number || 0));
  const positiveMoves = moves.filter((event) => Number(event.points) > 0);
  const totalAdded = positiveMoves.reduce((sum, event) => sum + Number(event.points || 0), 0);
  const average = positiveMoves.length ? (totalAdded / positiveMoves.length).toFixed(1) : '0.0';
  const leaderPoints = Number(players[0]?.points_total || 0);
  const gap = Math.max(0, leaderPoints - Number(player.points_total || 0));
  const reaction = getRankReaction(index, players.length);
  const badge = getBadge(index, player.points_total);
  const profileCopy = moves.length === 0
    ? 'Hasn’t signed a single loss yet. Untested, or just very good at avoiding the table.'
    : index === 0
    ? 'Currently carrying the league’s heaviest crown. Every new loss adds another chapter to the story.'
    : gap === 0
      ? 'Locked in a points tie at the top. One dramatic round could change everything.'
      : `${gap} point${gap === 1 ? '' : 's'} away from the current leader. The comeback remains mathematically possible.`;

  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((node) => !node.disabled);
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); returnFocusRef?.current?.focus(); };
  }, [onClose, returnFocusRef]);

  return createPortal(
    <div className="profile-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className="player-profile" role="dialog" aria-modal="true" aria-labelledby="profile-name">
        <button ref={closeRef} className="profile-close" type="button" onClick={onClose} aria-label="Close player profile"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg><span>Close</span></button>
        <header className="profile-hero" style={{ '--profile-accent': player.accent }}>
          <div className="profile-avatar" aria-label={`${player.name} avatar`}><span>{player.emoji}</span><b>{reaction.face}</b></div>
          <div className="profile-identity"><p>Player profile • Rank {String(index + 1).padStart(2, '0')}</p><h2 id="profile-name">{player.name}</h2><span>{badge.icon} {badge.label}</span></div>
          <div className="profile-total"><strong>{player.points_total}</strong><span>Penalty points</span></div>
        </header>
        <div className="profile-body">
          <p className="profile-story">{profileCopy}</p>
          <div className="profile-metrics">
            <article><small>Current rank</small><strong>#{index + 1}</strong><span>of {players.length} players</span></article>
            <article><small>Signed moves</small><strong>{moves.length}</strong><span>{moves.length === 1 ? 'ledger entry' : 'ledger entries'}</span></article>
            <article><small>Avg per move</small><strong>{average}</strong><span>points per signed move</span></article>
          </div>
          <section className="profile-chart-card"><div><p>Penalty progress</p><span>Cumulative signed score history</span></div><PlayerSparkline playerId={player.id} history={history} accent={player.accent} /></section>
          <section className="profile-activity"><div className="profile-section-title"><h3>Recent activity</h3><span>{moves.length ? `${moves.length} total` : 'Quiet for now'}</span></div>{moves.length === 0 ? <div className="profile-empty">No signed score events yet. A peaceful record, for now.</div> : <div className="activity-list">{moves.slice(0, 4).map((event) => <article key={event.id || event.event_number}><span className={Number(event.points) >= 0 ? 'positive' : 'negative'}>{Number(event.points) >= 0 ? '+' : ''}{event.points}</span><div><strong>{event.reason || 'Score updated'}</strong><small>{formatDate(event.created_at, true)} • Event #{event.event_number || '—'}</small></div></article>)}</div>}</section>
        </div>
      </section>
    </div>, document.body
  );
}

function Leaderboard({ players, history, loading }) {
  const [profilePlayer, setProfilePlayer] = useState(null);
  const triggerRef = useRef(null);
  const leaderPoints = players[0]?.points_total || 0;
  const profileIndex = profilePlayer ? players.findIndex((player) => player.id === profilePlayer.id) : -1;
  return (
    <section className="leaderboard-section" id="leaderboard">
      <div className="section-heading">
        <div><p className="eyebrow">The official-ish standings</p><h2>Who is <em>winning?</em></h2></div>
        <div className="heading-note">More losses, more points.<br /><strong>Highest total ranks first.</strong></div>
      </div>
      {loading ? <div className="loading-board"><span className="spinner" />Rolling the scoreboard...</div> : players.length === 0 ? <div className="empty-board"><span>🎲</span><h3>The board is suspiciously empty.</h3><p>Open the admin deck and add your first player.</p></div> : (
        <>
          <Podium players={players} onOpen={(player) => { triggerRef.current = document.activeElement; setProfilePlayer(player); }} />
          <div className="list-heading"><h3 id="table-heading">Full league table</h3><span>Higher penalty points rank first</span></div>
          <ol className="player-list" aria-labelledby="table-heading">{players.map((player, index) => <li key={player.id}><PlayerRow player={player} index={index} leaderPoints={leaderPoints} history={history} totalPlayers={players.length} onOpen={(selected) => { triggerRef.current = document.activeElement; setProfilePlayer(selected); }} /></li>)}</ol>
        </>
      )}
      {profilePlayer && profileIndex >= 0 && <PlayerProfile player={players[profileIndex]} index={profileIndex} players={players} history={history} onClose={() => setProfilePlayer(null)} returnFocusRef={triggerRef} />}
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
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [correction, setCorrection] = useState({ playerId: '', points: -1, reason: '' });
  const [manageBusy, setManageBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('score');

  useEffect(() => {
    if (!pointForm.playerId && players.length > 0) {
      setPointForm((current) => ({ ...current, playerId: players[0].id }));
    }
  }, [players, pointForm.playerId]);

  useEffect(() => {
    if (!correction.playerId && players.length > 0) setCorrection((current) => ({ ...current, playerId: players[0].id }));
  }, [players, correction.playerId]);

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

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

  const handleUpdatePlayer = async (event) => {
    event.preventDefault(); setManageBusy(true); setFormMessage(null);
    try { await updatePlayer(editingPlayer); setEditingPlayer(null); await onRefresh(); setFormMessage({ type: 'success', text: 'Player profile updated.' }); }
    catch (error) { setFormMessage({ type: 'error', text: error.message || 'Player could not be updated.' }); }
    finally { setManageBusy(false); }
  };

  const handleArchivePlayer = async (player) => {
    if (!window.confirm(`Archive ${player.name}? Their signed score history will remain in the ledger.`)) return;
    setManageBusy(true); setFormMessage(null);
    try { await archivePlayer(player.id); await onRefresh(); setFormMessage({ type: 'success', text: `${player.name} was archived safely.` }); }
    catch (error) { setFormMessage({ type: 'error', text: error.message || 'Player could not be archived.' }); }
    finally { setManageBusy(false); }
  };

  const handleCorrection = async (event) => {
    event.preventDefault(); setManageBusy(true); setFormMessage(null);
    try { await adjustScore(correction); await onRefresh(); setCorrection({ ...correction, points: -1, reason: '' }); setFormMessage({ type: 'success', text: 'Score correction signed and applied.' }); onBurst(); }
    catch (error) { setFormMessage({ type: 'error', text: error.message || 'Score could not be corrected.' }); }
    finally { setManageBusy(false); }
  };

  if (!adminUser) return <div className="modal-backdrop"><div className="admin-modal login-modal"><button className="close-button" type="button" onClick={onClose} aria-label="Close admin panel">×</button><LoginPanel onLogin={handleLogin} busy={loginBusy} error={loginError} /></div></div>;

  const selectedPlayer = players.find((player) => player.id === pointForm.playerId);
  const projectedTotal = Number(selectedPlayer?.points_total || 0) + Number(pointForm.points || 0);

  return (
    <div className="modal-backdrop" role="presentation"><div className="admin-modal admin-console" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <div className="admin-topbar"><div><p className="eyebrow">Scorekeeper deck</p><h2 id="admin-title">Make the board <em>move.</em></h2></div><div className="admin-top-actions"><span className="signed-in">● Signed in as {adminUser.email || 'scorekeeper'}</span><button className="close-button" type="button" onClick={onClose} aria-label="Close admin panel">×</button></div></div>
      <nav className="admin-tabs" aria-label="Admin sections">
        <button type="button" className={activeTab === 'score' ? 'active' : ''} onClick={() => setActiveTab('score')}><span>01</span><strong>Score</strong><small>Add penalties</small></button>
        <button type="button" className={activeTab === 'players' ? 'active' : ''} onClick={() => setActiveTab('players')}><span>02</span><strong>Players</strong><small>Add and edit</small></button>
        <button type="button" className={activeTab === 'ledger' ? 'active' : ''} onClick={() => setActiveTab('ledger')}><span>03</span><strong>Ledger</strong><small>{events.length} signed moves</small></button>
      </nav>
      <div className={`admin-grid admin-tab-${activeTab}`}>
        <div className="admin-forms">
          {activeTab === 'players' && <form className="admin-card" onSubmit={handlePlayer}>
            <div className="card-title"><span className="card-number">01</span><div><h3>Add a player</h3><p>Give a future champion a seat at the table.</p></div></div>
            <label>Player name<input maxLength="28" value={playerForm.name} onChange={(event) => setPlayerForm({ ...playerForm, name: event.target.value })} placeholder="e.g. The Dice Whisperer" /></label>
            <div className="mini-fields"><label>Piece color<div className="color-picker">{palette.slice(0, 8).map((color) => <button key={color} type="button" className={playerForm.accent === color ? 'selected' : ''} style={{ background: color }} onClick={() => setPlayerForm({ ...playerForm, accent: color })} aria-label={`Choose ${color} player color`} />)}</div></label><label>Spirit emoji<div className="emoji-picker">{emojis.slice(0, 8).map((emoji) => <button key={emoji} type="button" className={playerForm.emoji === emoji ? 'selected' : ''} onClick={() => setPlayerForm({ ...playerForm, emoji })} aria-label={`Choose ${emoji} player emoji`}>{emoji}</button>)}</div></label></div>
            <button className="dark-button full-width" disabled={playerBusy} type="submit">{playerBusy ? 'Adding...' : 'Add to the arena'} <span>+</span></button>
          </form>}
          {activeTab === 'score' && <form className="admin-card points-card" onSubmit={handlePoints}>
            <div className="card-title"><span className="card-number">02</span><div><h3>Drop a point</h3><p>Type any whole number from 1 to 999.</p></div></div>
            <label>Who earned it?<select value={pointForm.playerId} onChange={(event) => setPointForm({ ...pointForm, playerId: event.target.value })}><option value="">Choose a player...</option>{players.map((player) => <option value={player.id} key={player.id}>{player.emoji} {player.name}, currently {player.points_total} pts</option>)}</select></label>
            <label>How many points?<input className="points-number-input" type="number" inputMode="numeric" min="1" max="999" step="1" value={pointForm.points} onChange={(event) => setPointForm({ ...pointForm, points: event.target.value })} /><div className="point-picker compact">{[1,2,3,5,9].map((point) => <button key={point} type="button" className={Number(pointForm.points) === point ? 'selected' : ''} onClick={() => setPointForm({ ...pointForm, points: point })}>+{point}</button>)}</div></label>
            <div className={`score-preview ${selectedPlayer ? 'ready' : ''}`}><span>{selectedPlayer?.emoji || '🎯'}</span><div><small>Score impact preview</small><strong>{selectedPlayer ? `${selectedPlayer.name}: ${selectedPlayer.points_total} → ${projectedTotal}` : 'Choose a player to preview the new total'}</strong></div><b>{selectedPlayer ? `+${pointForm.points}` : '—'}</b></div>
            <label>Official-ish reason<input minLength="3" maxLength="180" value={pointForm.reason} onChange={(event) => setPointForm({ ...pointForm, reason: event.target.value })} placeholder="Lost the round" /><span className="field-help">{pointForm.reason.length}/180 characters</span></label>
            <div className="reason-shortcuts" aria-label="Quick reasons">{['Lost the round', 'Missed the cut', 'Dice betrayal'].map((reason) => <button type="button" key={reason} onClick={() => setPointForm({ ...pointForm, reason })}>{reason}</button>)}</div>
            <label className="consent-box"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span><strong>Witnessed and approved.</strong><small>This point will be signed with the current time, admin identity, and previous event hash.</small></span><span className="stamp">{consent ? '✓' : '!'}</span></label>
            <button className="primary-button full-width" disabled={pointBusy || players.length === 0 || !consent} type="submit">{pointBusy ? 'Signing the point...' : 'Sign and publish point'} <span>✦</span></button>
          </form>}
          {activeTab === 'players' && <section className="admin-card manage-card">
            <div className="card-title"><span className="card-number">03</span><div><h3>Manage players</h3><p>Edit profiles, archive players, or correct totals.</p></div></div>
            <div className="manage-list">{players.map((player) => <div className="manage-player" key={player.id}><span style={{ '--accent': player.accent }}>{player.emoji}</span><div><strong>{player.name}</strong><small>{player.points_total} points</small></div><button type="button" onClick={() => setEditingPlayer({ ...player })}>Edit</button><button className="danger-link" type="button" onClick={() => handleArchivePlayer(player)} disabled={manageBusy}>Archive</button></div>)}</div>
            {editingPlayer && <form className="edit-player-form" onSubmit={handleUpdatePlayer}><strong>Edit player</strong><label>Name<input maxLength="28" value={editingPlayer.name} onChange={(event) => setEditingPlayer({ ...editingPlayer, name: event.target.value })} /></label><div className="mini-fields"><label>Color<div className="color-picker">{palette.slice(0,8).map((color) => <button key={color} type="button" className={editingPlayer.accent === color ? 'selected' : ''} style={{ background: color }} onClick={() => setEditingPlayer({ ...editingPlayer, accent: color })} />)}</div></label><label>Emoji<div className="emoji-picker">{emojis.slice(0,8).map((emoji) => <button key={emoji} type="button" className={editingPlayer.emoji === emoji ? 'selected' : ''} onClick={() => setEditingPlayer({ ...editingPlayer, emoji })}>{emoji}</button>)}</div></label></div><div className="form-actions"><button type="button" onClick={() => setEditingPlayer(null)}>Cancel</button><button className="dark-button" disabled={manageBusy} type="submit">Save player</button></div></form>}
            <form className="correction-form" onSubmit={handleCorrection}><strong>Correct a score</strong><p>Use a negative number to remove incorrect points. This creates a signed adjustment instead of rewriting history.</p><select value={correction.playerId} onChange={(event) => setCorrection({ ...correction, playerId: event.target.value })}>{players.map((player) => <option value={player.id} key={player.id}>{player.name}, {player.points_total} pts</option>)}</select><input type="number" inputMode="numeric" min="-999" max="999" step="1" value={correction.points} onChange={(event) => setCorrection({ ...correction, points: event.target.value })} /><input minLength="3" maxLength="180" placeholder="Reason for correction" value={correction.reason} onChange={(event) => setCorrection({ ...correction, reason: event.target.value })} /><button className="dark-button full-width" disabled={manageBusy} type="submit">Sign correction</button></form>
          </section>}
        </div>
        {activeTab === 'ledger' && <div className="ledger-card">
          <div className="ledger-heading"><div><p className="eyebrow">Tamper-evident-ish ledger</p><h3>Recent moves</h3></div><span className="chain-mark">⛓</span></div>
          <div className="ledger-list">{events.length === 0 ? <div className="ledger-empty">No signed moves yet.<br />The first point is waiting for its dramatic entrance.</div> : events.slice(0, 10).map((event) => { const player = players.find((item) => item.id === event.player_id); return <div className="ledger-row" key={event.id}><span className="ledger-points">+{event.points}</span><div><strong>{player?.name || 'Unknown player'}</strong><p>{event.reason}</p><small>{formatDate(event.created_at, true)} • #{event.event_number || '—'}</small></div><span className="ledger-hash" title={event.event_hash}>✓ {event.event_hash?.slice(0, 7)}</span></div>; })}</div>
          <div className="ledger-footer"><span>Chain status</span><strong><i /> Connected</strong></div>
          <button className="logout-button" type="button" onClick={onLogout}>Lock the scorekeeper deck <span>↗</span></button>
        </div>}
      </div>
      {formMessage && <div className={`admin-toast form-message ${formMessage.type}`} role="status"><span>{formMessage.type === 'success' ? '✓' : '!'}</span><p>{formMessage.text}</p><button type="button" onClick={() => setFormMessage(null)} aria-label="Dismiss message">×</button></div>}
    </div></div>
  );
}

export default function App() {
  const cachedBoard = useMemo(() => getCachedLeaderboard(), []);
  const [players, setPlayers] = useState(() => sortPlayers(cachedBoard?.players || []));
  const [history, setHistory] = useState(() => cachedBoard?.history || []);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(() => !cachedBoard);
  const [error, setError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [burstKey, setBurstKey] = useState(0);
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(() => navigator.onLine);

  const refresh = useCallback(async () => {
    try {
      const [nextPlayers, nextEvents, nextHistory] = await Promise.all([fetchPlayers(), fetchEvents(), fetchScoreHistory()]);
      setPlayers(sortPlayers(nextPlayers)); setEvents(nextEvents); setHistory(nextHistory); setError('');
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
      <a className="skip-link" href="#leaderboard">Skip to leaderboard</a>
      <Header onOpenAdmin={openAdmin} adminUser={adminUser} online={online} />
      <main>
        <Hero players={players} events={events} onOpenAdmin={openAdmin} />
        <LeagueSnapshot players={players} events={events} />
        <section className="ticker" aria-label="League status"><span className="ticker-label">NEWS FLASH</span><span className="ticker-copy">{leader ? `${leader.name} is currently holding the crown with ${leader.points_total} point${leader.points_total === 1 ? '' : 's'}.` : 'The dice are warming up. The first point is still available.'}</span><span className="ticker-time">{clock.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span></section>
        <Leaderboard players={players} history={history} loading={loading} />
        {!online && <div className="offline-banner" role="status">You are offline. The last loaded scores are still visible, but new updates will wait for a connection.</div>}
        {error && <div className="global-error" role="alert">⚠️ {error} <button onClick={refresh} type="button">Try again</button></div>}
      </main>
      <Footer onOpenAdmin={openAdmin} eventCount={events.length} />
      {adminOpen && createPortal(<AdminPanel onClose={() => setAdminOpen(false)} players={players} events={events} adminUser={adminUser} onLogin={handleLogin} onRefresh={refresh} onBurst={() => setBurstKey((key) => key + 1)} onLogout={handleLogout} />, document.body)}
    </div>
  );
}
