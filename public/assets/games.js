export const games = [
  {
    slug: 'polytrack',
    title: 'PolyTrack',
    category: 'Racing',
    version: '0.4.1',
    description: 'Curve strette, salti e velocità. Prova a battere il tuo record, direttamente qui.',
    entry: '/builds/polytrack/index.html',
    cover: '/builds/polytrack/images/logo.svg',
    coverAlt: 'Logo PolyTrack',
    controls: [
      'Guida: WASD oppure frecce direzionali.',
      'Ricomincia: R oppure Invio.',
      'Pausa: Esc. Clicca nel gioco per attivare i comandi.',
      'Consulta le impostazioni del gioco per personalizzare i tasti.',
    ],
    notes: 'Questa è la build 0.4.1 fornita per il sito, non la versione ufficiale più recente. È consigliata una tastiera; touch e controller dipendono dal supporto della build. I servizi online dipendono dai server originali e potrebbero non essere disponibili.',
    credits: 'PolyTrack è sviluppato da Kodub. Hosting non ufficiale della build fornita; tutti i diritti appartengono ai rispettivi autori.',
    authorUrl: 'https://www.kodub.com/apps/polytrack',
  },
];

export function gamePage(game) {
  return `/giochi/${game.slug}/`;
}
