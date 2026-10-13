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
