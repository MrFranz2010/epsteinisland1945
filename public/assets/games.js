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
];

export const siteRoot = new URL('../', import.meta.url);

export function siteUrl(path) {
  return new URL(path.replace(/^\/+/, ''), siteRoot).href;
}

export function gamePage(game) {
  return siteUrl(`/giochi/${game.slug}/`);
}
