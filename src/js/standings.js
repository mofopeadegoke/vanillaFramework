// Computes Swiss standings for one section from its pairings.
// A pairing with `black: null` is a full-point bye; `result: null` means not yet played.

const POINTS = {
  '1-0': [1, 0],
  '0-1': [0, 1],
  '½-½': [0.5, 0.5],
};

/** Starting numbers: seeded by rating (unrated last), then name. */
export function startingNumbers(players) {
  const seeded = [...players].sort(
    (a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.name.localeCompare(b.name),
  );
  return new Map(seeded.map((p, i) => [p.id, i + 1]));
}

/** Rounds in which every pairing has a result. */
export function completedRounds(section) {
  return section.rounds.filter((r) => r.pairings.length > 0 && r.pairings.every((p) => p.result || p.black === null));
}

export function computeStandings(section) {
  const startNo = startingNumbers(section.players);
  const rows = new Map(
    section.players.map((p) => [
      p.id,
      { player: p, startNo: startNo.get(p.id), points: 0, games: [], buchholzCut1: 0, sonnebornBerger: 0 },
    ]),
  );

  for (const round of section.rounds) {
    for (const { white, black, result } of round.pairings) {
      if (black === null) {
        rows.get(white).points += 1;
        rows.get(white).games[round.round - 1] = { outcome: 'bye', score: 1 };
        continue;
      }
      if (!result) continue;
      const [ws, bs] = POINTS[result];
      rows.get(white).points += ws;
      rows.get(black).points += bs;
      rows.get(white).games[round.round - 1] = { outcome: outcome(ws), score: ws, opponent: black, colour: 'white' };
      rows.get(black).games[round.round - 1] = { outcome: outcome(bs), score: bs, opponent: white, colour: 'black' };
    }
  }

  for (const row of rows.values()) {
    const played = row.games.filter((g) => g?.opponent);
    const oppScores = played.map((g) => rows.get(g.opponent).points);
    const total = oppScores.reduce((sum, s) => sum + s, 0);
    row.buchholzCut1 = oppScores.length > 1 ? total - Math.min(...oppScores) : total;
    row.sonnebornBerger = played.reduce((sum, g) => sum + g.score * rows.get(g.opponent).points, 0);
  }

  const ranked = [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.buchholzCut1 - a.buchholzCut1 ||
      b.sonnebornBerger - a.sonnebornBerger ||
      a.startNo - b.startNo,
  );

  // Shared rank when every tiebreak is equal.
  ranked.forEach((row, i) => {
    const prev = ranked[i - 1];
    const tied =
      prev &&
      prev.points === row.points &&
      prev.buchholzCut1 === row.buchholzCut1 &&
      prev.sonnebornBerger === row.sonnebornBerger;
    row.rank = tied ? prev.rank : i + 1;
  });

  return ranked;
}

function outcome(score) {
  return score === 1 ? 'win' : score === 0 ? 'loss' : 'draw';
}

/** Formats 2.5 as "2½". */
export function formatScore(n) {
  const whole = Math.floor(n);
  const half = n - whole === 0.5;
  if (!half) return String(whole);
  return whole === 0 ? '½' : `${whole}½`;
}
