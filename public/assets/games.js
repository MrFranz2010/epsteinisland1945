export const games = [
  {
    slug: 'polytrack',
    title: 'PolyTrack',
    category: 'Racing',
    version: '0.5.2',
    description: 'Curve strette, salti e velocità. Batti i record online e sfida i ghost degli altri piloti.',
    entry: '/builds/polytrack-0.5.2/index.html',
    cover: '/builds/polytrack-0.5.2/images/logo.svg',
    coverAlt: 'Logo PolyTrack',
    controls: [
      'Guida: WASD oppure frecce direzionali.',
      'Ricomincia: T. Torna all’ultimo checkpoint: R.',
      'Vista in prima persona: C. Pausa: Spazio.',
      'Consulta le impostazioni del gioco per personalizzare i tasti.',
    ],
    notes: 'Classifiche e ghost online richiedono una connessione. I tracciati personalizzati non partecipano alle classifiche.',
    credits: 'PolyTrack è sviluppato da Kodub. Build 0.5.2 autorizzata da StaticQuasar931; hosting non ufficiale.',
    authorUrl: 'https://www.kodub.com/apps/polytrack',
  },
  {
    slug: 'fpv-freestyle',
    title: 'FPV Freestyle',
    category: 'Simulazione',
    description: 'Volo FPV libero con controller, registrazione dei voli e multiplayer.',
    externalUrl: 'https://lightning8113.itch.io/fpv-freestyle',
    cover: 'https://img.itch.zone/aW1nLzE5NDcwOTQ3LnBuZw==/original/TOb1PK.png',
    coverAlt: 'Drone FPV in volo verso una struttura nel paesaggio',
    controls: [
      'Supporta tastiera e controller.',
      'Controller: thrust, yaw, pitch e roll.',
      'Premi Q per attivare o disattivare il multiplayer.',
    ],
    notes: 'Gioco HTML5 ospitato su itch.io. Supporta tastiera, controller e multiplayer; la mappa mostrata è un’area aperta con strutture, non una città densa.',
    credits: 'FPV Freestyle è sviluppato da Lightning e viene eseguito su itch.io; la build non è ospitata localmente.',
    authorUrl: 'https://lightning8113.itch.io/fpv-freestyle',
  },
  {
    slug: 'urban-fpv',
    title: 'Urban FPV',
    category: 'Simulazione',
    description: 'Volo libero tra palazzi con collisioni, visuale FPV e controller.',
    entry: '/builds/urban-fpv/index.html',
    cover: '/builds/urban-fpv/demo.png',
    coverAlt: 'Città 3D del simulatore Urban FPV',
    controls: [
      'Tastiera: WASD per volare, Q/E per ruotare, Spazio/Shift per salire e scendere.',
      'Controller acro: stick sinistro per imbardata e throttle; destro per rollio e beccheggio. Throttle centrato = hover.',
      'Premi V per alternare visuale FPV, inseguimento e orbitale.',
    ],
    notes: 'Volo libero in una città generata proceduralmente, con collisioni e minimappa. La camera FPV è montata sul drone; il controller usa controlli acro con rate e throttle analogico.',
    credits: 'Urban FPV Drone Simulator di evangel2022, distribuito con licenza MIT. Three.js è caricato dalla CDN ufficiale.',
    authorUrl: 'https://github.com/evangel2022/Urban-FPV-Drone-Simulator',
  },
  {
    slug: 'snake',
    title: 'Snake',
    category: 'Arcade',
    version: '1.0',
    description: 'Guida il serpente, raccogli le mele e fai più punti possibile.',
    entry: '/builds/snake/index.html',
    controls: ['Frecce o WASD: cambia direzione.', 'Touch: usa i pulsanti direzionali.', 'R: ricomincia la partita.'],
    credits: 'Gioco originale realizzato per questo sito, senza risorse esterne.',
  },
  {
    slug: 'pong',
    title: 'Pong',
    category: 'Arcade',
    version: '1.0',
    description: 'La sfida arcade per eccellenza: respingi la pallina e arriva per primo a cinque punti.',
    entry: '/builds/pong/index.html',
    controls: ['Frecce su/giù o W/S: muovi la racchetta.', 'Touch o mouse: trascina la racchetta.', 'Spazio: avvia o riprendi la partita.'],
    credits: 'Gioco originale ispirato al classico Pong, realizzato per questo sito.',
  },
  {
    slug: 'breakout',
    title: 'Breakout',
    category: 'Arcade',
    version: '1.0',
    description: 'Rompi tutti i mattoni, controlla il rimbalzo e non lasciar cadere la pallina.',
    entry: '/builds/breakout/index.html',
    controls: ['Frecce o A/D: muovi la racchetta.', 'Touch o mouse: posiziona la racchetta.', 'Spazio: avvia o riprendi la partita.'],
    credits: 'Gioco originale ispirato al classico Breakout, realizzato per questo sito.',
  },
  {
    slug: '2048',
    title: '2048',
    category: 'Puzzle',
    version: '1.0',
    description: 'Unisci le tessere uguali, pianifica ogni mossa e raggiungi la tessera 2048.',
    entry: '/builds/2048/index.html',
    controls: ['Frecce o WASD: sposta le tessere.', 'Touch: scorri nella direzione desiderata.', 'Nuova partita: ricomincia da zero.'],
    credits: 'Implementazione originale del puzzle numerico 2048, realizzata per questo sito.',
  },
  {
    slug: 'campo-minato',
    title: 'Campo minato',
    category: 'Puzzle',
    version: '1.0',
    description: 'Scopri le caselle sicure, usa gli indizi numerici e individua tutte le mine.',
    entry: '/builds/campo-minato/index.html',
    controls: ['Clic o tap: scopri una casella.', 'Tasto destro o modalità bandierina: segna una mina.', 'Scopri tutte le caselle sicure per vincere.'],
    credits: 'Gioco originale basato sulle regole del classico Campo minato, realizzato per questo sito.',
  },
];

export const siteRoot = new URL('../', import.meta.url);

export function siteUrl(path) {
  try {
    const absoluteUrl = new URL(path);
    if (absoluteUrl.protocol === 'https:' || absoluteUrl.protocol === 'http:') return absoluteUrl.href;
  } catch {
    // Relative paths are resolved from the site root below.
  }
  return new URL(path.replace(/^\/+/, ''), siteRoot).href;
}

export function gamePage(game) {
  return siteUrl(`/giochi/${game.slug}/`);
}
