import { completedRounds, computeStandings, formatScore, startingNumbers } from './standings.js';
import { initRegistration } from './register.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'className') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...[children].flat().filter((c) => c !== null && c !== undefined));
  return node;
}

/* ---------- Navigation ---------- */

function initNavigation() {
  const header = $('#navigation');
  const toggle = $('.js-menu-toggle', header);
  const setOpen = (open) => {
    header.classList.toggle('has-menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close menu' : 'Menu';
  };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('has-menu-open')));
  $$('.p-navigation__nav a', header).forEach((a) => a.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('has-menu-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ---------- Event details ---------- */

function fillEventDetails({ event }) {
  const date = new Date(`${event.date}T00:00:00`);
  const longDate = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const deadline = new Date(`${event.registrationDeadline}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const money = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: event.entryFee.currency, maximumFractionDigits: 0 }).format(n);

  const fields = {
    'hero-eyebrow': `${longDate} · ${event.venue.name}`,
    'event-name': event.name,
    'event-tagline': event.tagline,
    format: event.format,
    'time-control': event.timeControl,
    rated: `${event.rated}.`,
    'entry-fee': `${money(event.entryFee.adult)} · Juniors ${money(event.entryFee.junior)}`,
    deadline: `Entries close ${deadline}.`,
    'deadline-date': deadline,
    'venue-name': event.venue.name,
    'venue-address': event.venue.address,
  };
  for (const [key, text] of Object.entries(fields)) $$(`[data-field="${key}"]`).forEach((n) => (n.textContent = text));
  $$('[data-field="venue-map"]').forEach((a) => (a.href = event.venue.mapUrl));
  $$('[data-field="contact"]').forEach((a) => {
    a.href = `mailto:${event.contactEmail}`;
    a.textContent = event.contactEmail;
  });
}

function renderPrizes({ prizes }) {
  $('#prizes').replaceChildren(
    ...prizes.map(({ section, awards }) =>
      el('div', { className: 'col-3 col-medium-2' }, [
        el('p', { className: 'p-muted-heading', text: section }),
        el('ul', { className: 'p-list' }, awards.map((a) => el('li', { className: 'p-list__item', text: a }))),
      ]),
    ),
  );
}

/* ---------- Countdown ---------- */

function initCountdown({ event, status }) {
  const target = new Date(event.start).getTime();
  const label = $('#countdown-label');
  const units = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
  const tick = () => {
    let remaining = Math.max(0, Math.floor((target - Date.now()) / 1000));
    if (remaining === 0) {
      label.textContent = status === 'finished' ? 'Tournament complete' : 'Tournament under way';
      $('.countdown__units').hidden = true;
      return false;
    }
    for (const [unit, size] of Object.entries(units)) {
      $(`[data-countdown="${unit}"]`).textContent = String(Math.floor(remaining / size)).padStart(2, '0');
      remaining %= size;
    }
    return true;
  };
  if (tick()) {
    const id = setInterval(() => tick() || clearInterval(id), 1000);
  }
}

/* ---------- Schedule & pairings ---------- */

function roundStatus(data, roundNo) {
  const rounds = data.sections.map((s) => s.rounds.find((r) => r.round === roundNo)).filter(Boolean);
  if (rounds.length === 0 || rounds.every((r) => r.pairings.length === 0)) return 'upcoming';
  const done = rounds.every((r) => r.pairings.every((p) => p.result || p.black === null));
  return done ? 'complete' : 'in-progress';
}

const STATUS_LABELS = {
  complete: ['p-status-label--positive', 'Complete'],
  'in-progress': ['p-status-label--information', 'In progress'],
  upcoming: ['p-status-label', 'Upcoming'],
};

function pairingsTable(section, roundNo) {
  const round = section.rounds.find((r) => r.round === roundNo);
  const byId = new Map(section.players.map((p) => [p.id, p]));
  const startNo = startingNumbers(section.players);
  const name = (id) => {
    const p = byId.get(id);
    return `${p.title ? `${p.title} ` : ''}${p.name} (${startNo.get(id)})`;
  };
  return el('table', { className: 'p-table--mobile-card pairings-table', 'aria-label': `${section.name} round ${roundNo} pairings` }, [
    el('thead', {}, el('tr', {}, [
      el('th', { className: 'pairings-table__board', text: 'Board' }),
      el('th', { text: 'White' }),
      el('th', { className: 'u-align--center pairings-table__result', text: 'Result' }),
      el('th', { text: 'Black' }),
    ])),
    el('tbody', {}, round.pairings.map((p) =>
      el('tr', {}, [
        el('td', { 'data-heading': 'Board', text: p.board }),
        el('td', { 'data-heading': 'White', text: name(p.white) }),
        el('td', { 'data-heading': 'Result', className: 'u-align--center', text: p.black === null ? 'bye' : p.result ?? 'in play' }),
        el('td', { 'data-heading': 'Black', text: p.black === null ? '—' : name(p.black) }),
      ]),
    )),
  ]);
}

function renderSchedule(data) {
  const body = $('#schedule-body');
  const rows = [];
  for (const item of data.schedule) {
    const isRound = typeof item.round === 'number';
    const status = isRound ? roundStatus(data, item.round) : null;
    const hasPairings = isRound && status !== 'upcoming';
    const detailId = isRound ? `pairings-round-${item.round}` : null;

    const sessionCell = el('td', { 'data-heading': 'Session' }, [
      el('strong', { text: item.label }),
      item.detail ? el('span', { className: 'schedule-table__detail u-text--muted', text: item.detail }) : null,
      hasPairings
        ? el('button', {
            type: 'button',
            className: 'p-button--base is-small is-dense schedule-table__toggle',
            'aria-expanded': 'false',
            'aria-controls': detailId,
            text: 'View pairings',
          })
        : null,
    ]);

    let statusCell = el('td', { 'data-heading': 'Status', className: 'u-align--right' });
    if (status) {
      const [cls, text] = STATUS_LABELS[status];
      statusCell.append(el('span', { className: cls, text }));
    }

    rows.push(el('tr', { className: isRound ? 'is-round' : undefined }, [
      el('td', { 'data-heading': 'Time', className: 'schedule-table__time u-text--figures', text: item.time }),
      sessionCell,
      statusCell,
    ]));

    if (hasPairings) {
      rows.push(el('tr', { id: detailId, className: 'schedule-table__pairings', hidden: true }, el('td', { colspan: 3 },
        data.sections.map((s) => el('div', { className: 'pairings-block' }, [el('h4', { className: 'p-heading--5', text: s.name }), pairingsTable(s, item.round)])),
      )));
    }
  }
  body.replaceChildren(...rows);

  body.addEventListener('click', (e) => {
    const button = e.target.closest('.schedule-table__toggle');
    if (!button) return;
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    button.textContent = open ? 'Hide pairings' : 'View pairings';
    document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
  });
}

/* ---------- Standings ---------- */

const RESULT_LETTER = { win: 'W', draw: 'D', loss: 'L' };

function standingsColumns(totalRounds, live) {
  if (!live) {
    return [
      { key: 'startNo', label: 'No.', sort: (r) => r.startNo, numeric: true },
      { key: 'player', label: 'Player', sort: (r) => r.player.name },
      { key: 'rating', label: 'Rating', sort: (r) => r.player.rating ?? -1, numeric: true, desc: true },
      { key: 'club', label: 'Club', sort: (r) => r.player.club ?? '' },
    ];
  }
  return [
    { key: 'rank', label: 'Rk', sort: (r) => r.rank, numeric: true },
    { key: 'startNo', label: 'No.', sort: (r) => r.startNo, numeric: true },
    { key: 'player', label: 'Player', sort: (r) => r.player.name },
    { key: 'rating', label: 'Rating', sort: (r) => r.player.rating ?? -1, numeric: true, desc: true },
    { key: 'club', label: 'Club', sort: (r) => r.player.club ?? '' },
    ...Array.from({ length: totalRounds }, (_, i) => ({ key: `r${i + 1}`, label: `R${i + 1}`, round: i + 1 })),
    { key: 'points', label: 'Pts', sort: (r) => r.points, numeric: true, desc: true },
    { key: 'bh', label: 'BH-C1', sort: (r) => r.buchholzCut1, numeric: true, desc: true },
    { key: 'sb', label: 'SB', sort: (r) => r.sonnebornBerger, numeric: true, desc: true },
  ];
}

function cellFor(col, row, byId, startNo) {
  const attrs = { 'data-heading': col.label };
  const p = row.player;
  switch (col.key) {
    case 'rank':
      return el('td', { ...attrs, className: 'u-text--figures', text: row.rank });
    case 'startNo':
      return el('td', { ...attrs, className: 'u-text--figures standings__start-no', text: row.startNo });
    case 'player':
      return el('th', { ...attrs, scope: 'row', className: 'standings__player' }, [
        p.title ? el('abbr', { className: 'standings__title', title: titleName(p.title), text: p.title }) : null,
        p.name,
      ]);
    case 'rating':
      return el('td', { ...attrs, className: 'u-text--figures', text: p.rating ?? 'Unrated' });
    case 'club':
      return el('td', { ...attrs, text: p.club ?? '' });
    case 'points':
      return el('td', { ...attrs, className: 'u-text--figures standings__points', text: formatScore(row.points) });
    case 'bh':
      return el('td', { ...attrs, className: 'u-text--figures', text: formatScore(row.buchholzCut1) });
    case 'sb':
      return el('td', { ...attrs, className: 'u-text--figures', text: row.sonnebornBerger.toFixed(2).replace(/\.?0+$/, '') });
    default: {
      const g = row.games[col.round - 1];
      const cls = 'standings__round u-text--figures';
      if (!g) return el('td', { ...attrs, className: cls, text: '–', title: 'Not played yet' });
      if (g.outcome === 'bye') return el('td', { ...attrs, className: cls, text: '+', title: 'Bye (1 point)' });
      const opp = byId.get(g.opponent);
      return el('td', {
        ...attrs,
        className: `${cls} is-${g.outcome}`,
        text: `${RESULT_LETTER[g.outcome]}${startNo.get(g.opponent)}`,
        title: `${g.outcome === 'win' ? 'Beat' : g.outcome === 'loss' ? 'Lost to' : 'Drew with'} ${opp.name} (${g.colour})`,
      });
    }
  }
}

function titleName(t) {
  return { GM: 'Grandmaster', IM: 'International Master', FM: 'FIDE Master', CM: 'Candidate Master', WGM: 'Woman Grandmaster', WIM: 'Woman International Master', WFM: 'Woman FIDE Master', WCM: 'Woman Candidate Master' }[t] ?? t;
}

function standingsTable(section, totalRounds, live) {
  const rows = computeStandings(section);
  const byId = new Map(section.players.map((p) => [p.id, p]));
  const startNo = startingNumbers(section.players);
  const columns = standingsColumns(totalRounds, live);
  const defaultKey = live ? 'rank' : 'startNo';
  let sortState = { key: defaultKey, dir: 'ascending' };

  const tbody = el('tbody');
  const headers = columns.map((col) => {
    const className = [col.round ? 'standings__round' : '', col.key === 'player' ? '' : 'u-text--figures'].join(' ').trim() || undefined;
    if (!col.sort) return el('th', { className, scope: 'col', title: `Round ${col.round}`, text: col.label });
    return el('th', { className, scope: 'col', 'aria-sort': col.key === defaultKey ? 'ascending' : 'none', 'data-key': col.key }, el('button', { type: 'button', className: 'p-table__sort-button', text: col.label }));
  });

  const draw = () => {
    const col = columns.find((c) => c.key === sortState.key);
    const dir = sortState.dir === 'ascending' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      const av = col.sort(a), bv = col.sort(b);
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
      return cmp * dir || a.rank - b.rank;
    });
    tbody.replaceChildren(...sorted.map((row) => el('tr', {}, columns.map((c) => cellFor(c, row, byId, startNo)))));
    headers.forEach((th) => th.dataset.key && th.setAttribute('aria-sort', th.dataset.key === sortState.key ? sortState.dir : 'none'));
  };

  headers.forEach((th) => {
    if (!th.dataset.key) return;
    th.querySelector('button').addEventListener('click', () => {
      const col = columns.find((c) => c.key === th.dataset.key);
      if (sortState.key === col.key) sortState.dir = sortState.dir === 'ascending' ? 'descending' : 'ascending';
      else sortState = { key: col.key, dir: col.desc ? 'descending' : 'ascending' };
      draw();
    });
  });

  draw();
  return el('div', { className: 'standings__scroll' }, el('table', { className: 'p-table--mobile-card standings', 'aria-label': `${section.name} standings` }, [el('thead', {}, el('tr', {}, headers)), tbody]));
}

function renderStandings(data) {
  const live = data.status !== 'pre-event' && data.sections.some((s) => completedRounds(s).length > 0);
  const roundsDone = Math.min(...data.sections.map((s) => completedRounds(s).length));

  $('#standings-title').textContent = live
    ? data.status === 'finished' ? 'Final standings' : `Standings after round ${roundsDone}`
    : 'Registered players';
  if (!live) $('#standings-intro').textContent = 'Players are listed by starting number (seeded by rating). Standings appear here once round 1 is complete.';
  $('.standings-legend').hidden = !live;

  const tablist = $('#standings-tabs .p-tabs__list');
  const panels = $('#standings-panels');
  const tabs = [];

  data.sections.forEach((section, i) => {
    const tabId = `tab-${section.id}`;
    const panelId = `panel-${section.id}`;
    const tab = el('button', {
      className: 'p-tabs__link',
      role: 'tab',
      id: tabId,
      'aria-controls': panelId,
      'aria-selected': String(i === 0),
      tabindex: i === 0 ? '0' : '-1',
      text: section.name,
    });
    tabs.push(tab);
    tablist.append(el('div', { className: 'p-tabs__item' }, tab));
    panels.append(
      el('div', { role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, tabindex: '0', hidden: i !== 0 }, [
        el('p', { className: 'u-text--muted p-text--small', text: `${section.description} ${section.players.length} players.` }),
        standingsTable(section, data.event.rounds, live),
      ]),
    );
  });

  const select = (tab, focus = true) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab, false));
    tab.addEventListener('keydown', (e) => {
      const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      select(tabs[(next + tabs.length) % tabs.length]);
    });
  });
}

/* ---------- FAQ ---------- */

function renderFaq({ faq }) {
  const list = $('#faq-list');
  list.replaceChildren(
    ...faq.map(({ q, a }, i) =>
      el('li', { className: 'p-accordion__group' }, [
        el('div', { role: 'heading', 'aria-level': '3', className: 'p-accordion__heading' },
          el('button', { type: 'button', className: 'p-accordion__tab', id: `faq-tab-${i}`, 'aria-controls': `faq-panel-${i}`, 'aria-expanded': 'false', text: q }),
        ),
        el('section', { className: 'p-accordion__panel', id: `faq-panel-${i}`, 'aria-hidden': 'true', 'aria-labelledby': `faq-tab-${i}` }, el('p', { text: a })),
      ]),
    ),
  );

  list.addEventListener('click', (e) => {
    const tab = e.target.closest('.p-accordion__tab');
    if (!tab) return;
    const open = tab.getAttribute('aria-expanded') !== 'true';
    // Only one question open at a time.
    $$('.p-accordion__tab', list).forEach((t) => {
      const on = t === tab && open;
      t.setAttribute('aria-expanded', String(on));
      document.getElementById(t.getAttribute('aria-controls')).setAttribute('aria-hidden', String(!on));
    });
  });
}

/* ---------- Boot ---------- */

async function main() {
  initNavigation();
  let data;
  try {
    const res = await fetch('data/tournament.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (error) {
    console.error('Could not load tournament data', error);
    $('#standings-panels').replaceChildren(
      el('div', { className: 'p-notification--negative' }, el('div', { className: 'p-notification__content' }, el('p', { className: 'p-notification__message', text: 'Tournament data could not be loaded. Please refresh the page.' }))),
    );
    return;
  }

  fillEventDetails(data);
  renderPrizes(data);
  initCountdown(data);
  renderSchedule(data);
  renderStandings(data);
  renderFaq(data);
  initRegistration($('#register-form'), $('#register-notification'), data);
}

main();
