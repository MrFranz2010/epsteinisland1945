# Racing Zone
[![Netlify Status](https://api.netlify.com/api/v1/badges/ffcd07d1-888b-40a4-a8e8-cf572b77745a/deploy-status)](https://app.netlify.com/projects/epsteinisland1945/deploys)
Sito statico multigioco ospitato su Netlify, senza framework o passaggi di build. La home presenta il catalogo; ogni gioco ha una pagina dedicata e viene eseguito in un iframe locale, senza redirect verso altri siti.

## Struttura

- `public/index.html`: home con ricerca e filtro per categoria.
- `public/assets/games.js`: definizioni dei giochi, parte del codice del sito.
- `public/assets/player.js`: player condiviso, caricamento, riprova e crediti.
- `public/assets/fullscreen.js`: schermo intero con fallback per browser non compatibili.
- `public/giochi/polytrack/index.html`: pagina di PolyTrack e modello per nuove pagine.
- `public/builds/polytrack-0.5.2/`: build di PolyTrack usata dalla pagina; include un evento minimo per inviare alla lobby il tempo di arrivo.
- `public/builds/classic-games.css`: stile condiviso dei classici originali Snake, Pong, Breakout, 2048 e Campo minato, ospitati localmente.
- `public/builds/`: build autorizzate dei giochi open source APEX FORMULA, Voxel Musou, K8s Games, VIM Master e Racing JS. Ogni build conserva le proprie licenze e attribuzioni.
- `netlify.toml`: pubblicazione della sola cartella `public`, per escludere upload originali e documentazione.

Il catalogo si modifica nei file del progetto: non ci sono pannelli admin o registrazioni. Le sole funzioni serverless aggiunte gestiscono lobby e tempi di PolyTrack tramite Netlify Blobs; il resto del catalogo rimane statico.

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

Installa le dipendenze con `npm install`, avvia Netlify Dev dalla root con `netlify dev --port 8889` e apri `http://localhost:8889/`. Verifica catalogo, ricerca, pagina gioco, avvio della build, ricaricamento, schermo intero e lobby multiplayer. Non è necessario eseguire comandi di build.

La build di PolyTrack è una versione non ufficiale: le classifiche e i ghost originali non sono disponibili. Il supporto mobile e ai controller dipende dalla build. Conserva i crediti e i collegamenti degli autori e pubblica soltanto giochi per cui hai i necessari diritti.

Snake, Pong, Breakout, 2048 e Campo minato sono implementazioni originali delle regole dei rispettivi classici. Le build sono incluse nel sito, non caricano risorse di terze parti e funzionano senza connessione esterna.

APEX FORMULA, Voxel Musou, K8s Games, VIM Master e Racing JS sono giochi di altri autori, integrati da build locali secondo le licenze incluse nelle rispettive cartelle `public/builds/`. K8s Games carica Three.js, Tailwind e i font da CDN. Racing JS include sorgenti e risorse con licenza AGPL-3.0-or-later e le licenze dei componenti terzi; la classifica online originale non è inclusa. APEX FORMULA, Voxel Musou e Racing JS richiedono WebGL.

## Lobby multiplayer di PolyTrack

La pagina di PolyTrack usa una Netlify Function e Netlify Blobs per creare lobby condivise tramite codice. Le lobby accettano fino a 8 piloti, conservano il miglior tempo per 7 giorni e vengono eliminate logicamente quando l'ultimo pilota esce. Il browser registra automaticamente il tempo di arrivo della build 0.5.2; per confrontare i risultati, tutti i partecipanti devono correre sulla stessa pista. I tempi si basano sul gioco eseguito nel browser e non sono verificati contro trucchi o modifiche locali.

La stessa pagina permette di creare e cambiare profili locali. Record, livree e lobby vengono conservati separatamente nel `localStorage` del browser; il profilo iniziale importa i salvataggi PolyTrack già presenti. I profili non sono account e non si sincronizzano tra browser o dispositivi.

Netlify installa `@netlify/blobs` dal `package.json` durante la pubblicazione. Per provare in locale, installa le dipendenze con `npm install` e avvia `netlify dev --port 8889`; Blobs e le funzioni richiedono Netlify Dev o un deploy Netlify e non funzionano servendo `public/` direttamente.
