# Racing Zone

Sito statico multigioco ospitato su Netlify, senza framework o passaggi di build. La home presenta il catalogo; ogni gioco ha una pagina dedicata e viene eseguito in un iframe locale, senza redirect verso altri siti.

## Struttura

- `public/index.html`: home con ricerca e filtro per categoria.
- `public/assets/games.js`: definizioni dei giochi, parte del codice del sito.
- `public/assets/player.js`: player condiviso, caricamento, riprova e crediti.
- `public/assets/fullscreen.js`: schermo intero con fallback per browser non compatibili.
- `public/giochi/polytrack/index.html`: pagina di PolyTrack e modello per nuove pagine.
- `public/builds/polytrack/`: build 0.4.1 estratta dall'archivio fornito, mantenuta senza modifiche.
- `netlify.toml`: pubblicazione della sola cartella `public`, per escludere upload originali e documentazione.

Il catalogo si modifica nei file del progetto: non sono presenti pannelli admin, registrazioni, database o caricamenti dal browser. Non sono stati aggiunti sistemi di salvataggio; quelli interni alla build fornita restano invariati.

## Aggiungere un gioco

1. Scegli uno slug univoco composto da lettere minuscole, numeri e trattini, ad esempio `nuovo-gioco`.
2. Inserisci una build web che sei autorizzato a pubblicare in `public/builds/nuovo-gioco/`, con il suo `index.html` e tutte le risorse. I percorsi della build devono essere relativi o puntare alla sua cartella, non alla root del sito.
3. Aggiungi un oggetto all'array `games` di `public/assets/games.js`:

```js
{
  slug: 'nuovo-gioco',
  title: 'Nuovo Gioco',
  category: 'Arcade',
  version: '1.0',
  description: 'Una breve descrizione del gioco.',
  entry: '/builds/nuovo-gioco/index.html',
  cover: '/builds/nuovo-gioco/copertina.png',
  coverAlt: 'Copertina di Nuovo Gioco',
  controls: ['Frecce: movimento.', 'Spazio: azione.'],
  notes: 'Requisiti e consigli specifici per questa build.',
  credits: 'Nome dell’autore e condizioni di utilizzo.',
  authorUrl: 'https://example.com',
},
```

4. Copia `public/giochi/polytrack/index.html` in `public/giochi/nuovo-gioco/index.html`. Cambia `data-game="polytrack"` in `data-game="nuovo-gioco"`. Aggiorna anche il titolo HTML, la descrizione e i testi iniziali di categoria, titolo e introduzione, che vengono poi valorizzati dal player condiviso.
5. Pubblica le modifiche. Il nuovo gioco compare automaticamente nel catalogo, nel filtro categorie e nei collegamenti alle altre pagine di gioco. Il suo indirizzo è `/giochi/nuovo-gioco/`.

`cover`, `coverAlt`, `version`, `notes`, `credits` e `authorUrl` sono facoltativi. `entry` deve puntare a un documento HTML sotto `/builds/` sullo stesso sito. Non aggiungere URL di giochi esterni come destinazione del player.

## Verificare il sito

Avvia Netlify Dev dalla root con `netlify dev --port 8889` e apri `http://localhost:8889/`. Verifica catalogo, ricerca, pagina gioco, avvio della build, ricaricamento e schermo intero. Non è necessario eseguire comandi di build.

La build fornita di PolyTrack indica la versione 0.4.1 nel menu del gioco, non una versione aggiornata. I suoi servizi online fanno riferimento ai server originali: l'integrazione locale non garantisce classifiche, account o servizi remoti. Il supporto mobile e ai controller dipende dalla build. Conserva i crediti e i collegamenti degli autori e pubblica soltanto giochi per cui hai i necessari diritti.
