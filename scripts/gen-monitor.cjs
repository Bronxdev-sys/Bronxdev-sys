const fs = require('fs');
const path = require('path');

const LOGIN = 'Bronxdev-sys';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error('GITHUB_TOKEN ausente'); process.exit(1); }

async function gql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': LOGIN },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (!json.data) { console.error(JSON.stringify(json)); process.exit(1); }
  return json.data;
}

async function main() {
  const base = await gql(`query { user(login:"${LOGIN}"){
    pullRequests{ totalCount }
    followers{ totalCount }
    repositories(first:100, ownerAffiliations:OWNER, privacy:PUBLIC){ totalCount nodes{ stargazerCount } }
    contributionsCollection{
      contributionYears
      contributionCalendar{ weeks{ contributionDays{ contributionCount } } }
    }
  } }`);

  const u = base.user;
  const years = u.contributionsCollection.contributionYears.slice().sort();
  const firstYear = years[0];

  const aliases = years.map(y =>
    `y${y}: contributionsCollection(from:"${y}-01-01T00:00:00Z", to:"${y}-12-31T23:59:59Z"){ totalCommitContributions contributionCalendar{ totalContributions } }`
  ).join('\n    ');
  const yearly = await gql(`query { user(login:"${LOGIN}"){\n    ${aliases}\n  } }`);

  let allContrib = 0, allCommits = 0;
  for (const y of years) {
    const c = yearly.user[`y${y}`];
    allContrib += c.contributionCalendar.totalContributions;
    allCommits += c.totalCommitContributions;
  }

  const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap(w => w.contributionDays);
  const last35 = days.slice(-35).map(d => d.contributionCount);
  const max = Math.max(1, ...last35);

  const cells = [
    { x: 60,  label: 'CONTRIBUTIONS', value: allContrib,               color: '#c98a5a', row: 0 },
    { x: 320, label: 'COMMITS',       value: allCommits,               color: '#6ab9ff', row: 0 },
    { x: 580, label: 'PULL REQUESTS', value: u.pullRequests.totalCount, color: '#3fb950', row: 0 },
    { x: 60,  label: 'STARS EARNED',  value: stars,                    color: '#d29922', row: 1 },
    { x: 320, label: 'FOLLOWERS',     value: u.followers.totalCount,   color: '#79c0ff', row: 1 },
    { x: 580, label: 'PUBLIC REPOS',  value: u.repositories.totalCount, color: '#a9c2d8', row: 1 },
  ];

  const cellSvg = cells.map(c => {
    const ly = c.row === 0 ? 108 : 196;
    const vy = c.row === 0 ? 142 : 230;
    return `  <rect x="${c.x - 14}" y="${vy - 22}" width="3.5" height="26" rx="1.7" fill="${c.color}" opacity="0.9"/>
  <text x="${c.x}" y="${ly}" font-size="10" letter-spacing="3" fill="#7d8590">${c.label}</text>
  <text x="${c.x}" y="${vy}" font-size="30" font-weight="700" fill="${c.color}">${c.value}</text>`;
  }).join('\n');

  const bars = last35.map((v, i) => {
    const x = (60 + i * 20.57).toFixed(1);
    const h = v === 0 ? 3 : Math.max(6, Math.round((v / max) * 66));
    const fill = v === 0 ? '#1b2430' : 'url(#barg)';
    return `  <rect x="${x}" y="${358 - h}" width="15" height="${h}" rx="2" fill="${fill}"/>`;
  }).join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 400" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">
  <defs>
    <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3c4454"/>
      <stop offset="0.12" stop-color="#232a36"/>
      <stop offset="1" stop-color="#12161d"/>
    </linearGradient>
    <linearGradient id="barg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c98a5a"/>
      <stop offset="1" stop-color="#6ab9ff"/>
    </linearGradient>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#ffffff" opacity="0.022"/>
    </pattern>
  </defs>
  <rect x="1" y="1" width="838" height="398" rx="20" fill="url(#bezel)" stroke="#4a5260" stroke-width="1.4"/>
  <rect x="14" y="14" width="812" height="372" rx="12" fill="#0a0e16" stroke="#1b2129" stroke-width="1.2"/>
  <rect x="14" y="14" width="812" height="372" rx="12" fill="url(#scan)"/>
  <path d="M34 30 h-8 v8" stroke="#2a3542" stroke-width="1.4" fill="none"/>
  <path d="M806 30 h8 v8" stroke="#2a3542" stroke-width="1.4" fill="none"/>
  <path d="M34 370 h-8 v-8" stroke="#2a3542" stroke-width="1.4" fill="none"/>
  <path d="M806 370 h8 v-8" stroke="#2a3542" stroke-width="1.4" fill="none"/>
  <circle cx="46" cy="47" r="4" fill="#3fb950">
    <animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite"/>
  </circle>
  <text x="60" y="52" font-size="13" letter-spacing="6" fill="#6ab9ff">SYS://MONITOR</text>
  <text x="248" y="52" font-size="10" letter-spacing="3" fill="#7d8590">[ ALL-TIME &#183; SINCE ${firstYear} ]</text>
  <text x="800" y="52" text-anchor="end" font-size="11" letter-spacing="2" fill="#7d8590">user: bronxdev-sys</text>
  <line x1="36" y1="68" x2="804" y2="68" stroke="#1f2630" stroke-width="1"/>
${cellSvg}
  <text x="60" y="280" font-size="10" letter-spacing="3" fill="#7d8590">CONTRIBUTION FEED &#183; LAST 35 DAYS</text>
${bars}
  <line x1="56" y1="358" x2="784" y2="358" stroke="#1f2630" stroke-width="1.2"/>
  <rect x="0" y="282" width="3" height="76" fill="#6ab9ff" opacity="0.18">
    <animateTransform attributeName="transform" type="translate" values="60 0; 770 0" dur="7s" repeatCount="indefinite"/>
  </rect>
</svg>
`;

  const out = path.join(__dirname, '..', 'assets', 'monitor.svg');
  fs.writeFileSync(out, svg);
  console.log('monitor.svg ALL-TIME:', JSON.stringify({ years, allContrib, allCommits, prs: u.pullRequests.totalCount, stars }));
}

main().catch(e => { console.error(e.message); process.exit(1); });
