import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGamesStatus } from '../api/gameApi';

// Read eligibility only. Mount/refresh never starts or consumes a game attempt.
export default function GameSelectionPanel() {
  const [state, setState] = useState({ loading: true, error: '', games: [] });
  const [reload, setReload] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setState({ loading: true, error: '', games: [] });
    getGamesStatus().then(response => {
      const games = response?.data?.games;
      if (!Array.isArray(games)) throw new Error('Invalid eligibility response');
      const supported = games.filter(game => ['monkey', 'perfect-shot'].includes(game?.id));
      if (supported.some(game => typeof game.label !== 'string' || game.label.length > 100 || typeof game.locked !== 'boolean' || !Number.isInteger(game.attemptsLeft) || game.attemptsLeft < 0 || game.attemptsLeft > (game.id === 'perfect-shot' ? 5 : 3) || (game.lockReason != null && typeof game.lockReason !== 'string'))) throw new Error('Invalid eligibility response');
      if (active) setState({ loading: false, error: '', games: supported });
    }).catch(() => { if (active) setState({ loading: false, error: 'Unable to check eligibility. Please retry.', games: [] }); });
    return () => { active = false; };
  }, [reload]);
  return <section aria-label="Game eligibility">
    <h2>Choose a game</h2>
    {state.loading && <p role="status">Checking eligibility...</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {state.games.map(game => <div key={game.id}>
      <p>{game.label} — Attempts remaining: {game.attemptsLeft}</p>
      {game.lockReason && <p>{game.lockReason}</p>}
      <button type="button" disabled={game.locked !== false || !Number.isInteger(game.attemptsLeft) || game.attemptsLeft <= 0} onClick={() => navigate(game.id === 'monkey' ? '/monkey-game' : '/user/perfect-shot')}>Play {game.label}</button>
    </div>)}
    <button type="button" disabled={state.loading} onClick={() => setReload(value => value + 1)}>Refresh eligibility</button>
  </section>;
}
