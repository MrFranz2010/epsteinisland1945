# Epstein Island
Catalogo statico di giochi web, anime e musica, pubblicato su GitHub Pages senza framework o passaggi di build. La home presenta il catalogo; ogni gioco ha una pagina dedicata e viene eseguito in un iframe locale, senza redirect verso altri siti.

## Struttura

- `public/index.html`: home con giochi aperti di recente, preferiti e filtri in una barra laterale adattiva.
- `public/assets/games.js`: definizioni dei giochi, parte del codice del sito.
- `public/assets/player.js`: player condiviso, caricamento, riprova e crediti.
- `public/assets/fullscreen.js`: schermo intero con fallback per browser non compatibili.
- `public/giochi/polytrack/index.html`: pagina di PolyTrack e modello per nuove pagine.
- `public/builds/polytrack-0.5.2/`: build di PolyTrack usata dalla pagina; include un evento minimo per registrare il tempo di arrivo nella classifica per pista.
- `public/builds/hexgl/`: build HexGL con licenza MIT; conserva licenze e attribuzioni della build, inclusi i crediti audio.
- `public/builds/magic-maze-web/`: port HTML5 di Magic Maze Web con licenza MIT; conserva la licenza del port e quella del font Fraktur Modern. Gli archivi DOS originali non sono inclusi.
- `public/builds/classic-games.css`: stile condiviso dei classici originali Snake, Pong, Breakout, 2048 e Campo minato, ospitati localmente.
- `public/builds/`: build autorizzate dei giochi open source APEX FORMULA, Voxel Musou, K8s Games, VIM Master e Racing JS. Ogni build conserva le proprie licenze e attribuzioni.
- `public/builds/railway-miner/`: gioco incrementale originale Railway Miner, con salvataggio locale e senza dipendenze esterne.
- `public/builds/plants-vs-zombies/`: pagina wrapper per incorporare il port PvZ Portable ospitato da Retro Games Center; il catalogo non include file del gioco.
- `public/builds/candy-crush-clone/`: wrapper per la demo web di Candy Crush Clone ospitata dall’autore su GitHub Pages.
- `public/builds/tiger-ball/`: wrapper per l’iframe Tiger Ball Online fornito da 4j.com.
- `.github/workflows/pages.yml`: pubblicazione automatica della cartella statica su GitHub Pages quando si aggiorna `main`.

Il catalogo si modifica nei file del progetto: non ci sono pannelli admin o registrazioni. Il sito è statico; preferiti, cronologia e profili sono conservati nel browser. Alcuni giochi e servizi informativi usano risorse esterne e richiedono una connessione.

## Funzioni del catalogo

La home permette di filtrare i giochi per categoria, modalità di comando (touch, tastiera, mouse o controller) e requisiti WebGL/connessione; i filtri sono in una barra laterale stretta su desktop e in un pannello compatto sopra i risultati su tablet e telefoni. Ogni scheda mostra la categoria assegnata, i comandi e i requisiti dichiarati per quel gioco. Le etichette descrivono il supporto verificato del singolo gioco: non tutti i giochi supportano tutti i dispositivi o controller.

Puoi salvare i preferiti con il pulsante a stella e ritrovare gli ultimi sei giochi aperti. Preferiti e cronologia sono salvati nel `localStorage` del browser, restano su quel dispositivo e non richiedono account; cancellando i dati del sito vengono rimossi.

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
  author: 'Nome autore',
  inputs: ['keyboard', 'touch'],
  requirements: ['webgl', 'internet'],
  controls: ['Frecce: movimento.', 'Spazio: azione.'],
  notes: 'Requisiti e consigli specifici per questa build.',
  credits: 'Nome dell’autore e condizioni di utilizzo.',
  authorUrl: 'https://example.com',
},
```

4. Copia `public/giochi/polytrack/index.html` in `public/giochi/nuovo-gioco/index.html`. Cambia `data-game="polytrack"` in `data-game="nuovo-gioco"`. Aggiorna anche il titolo HTML, la descrizione e i testi iniziali di categoria, titolo e introduzione, che vengono poi valorizzati dal player condiviso.
5. Pubblica le modifiche. Il nuovo gioco compare automaticamente nel catalogo, nel filtro categorie e nei collegamenti alle altre pagine di gioco. Il suo indirizzo è `<percorso-del-sito>/giochi/nuovo-gioco/`.

`cover`, `coverAlt`, `version`, `notes`, `credits`, `author` e `authorUrl` sono facoltativi. `inputs` elenca solo i comandi supportati (`touch`, `keyboard`, `mouse`, `controller`); `requirements` usa `webgl` e/o `internet` quando necessari. Mantieni queste indicazioni accurate per la build incorporata. `entry` deve puntare a un documento HTML sotto `/builds/` sullo stesso sito. Non aggiungere URL di giochi esterni come destinazione del player.

Per un gioco distribuito tramite un embed esterno autorizzato, aggiungi comunque la voce a `games.js` e crea una pagina dedicata con il codice embed fornito dalla piattaforma. Mantieni attribuzione e collegamento all’autore; non presentare l’embed come una build ospitata localmente.

## Pubblicare su GitHub Pages

Il workflow in `.github/workflows/pages.yml` pubblica automaticamente il contenuto di `public/` quando viene aggiornato il branch `main` o quando il workflow viene avviato manualmente. Nelle impostazioni del repository, imposta **Settings → Pages → Build and deployment → Source** su **GitHub Actions**. Il workflow gestisce sia i siti utente (`<utente>.github.io`) sia i siti di progetto (`<utente>.github.io/<repository>/`); `.nojekyll` disattiva l'elaborazione Jekyll e preserva i file statici così come sono.

Non serve compilare o installare dipendenze.

## Verificare il sito

Per testare il sito in locale, servi `public/` con un server HTTP statico (per esempio `python3 -m http.server 8889 --directory public`) e verifica catalogo, ricerca, pagine gioco, avvio delle build e schermo intero. Non è necessario installare dipendenze o eseguire comandi di build.

La build di PolyTrack è una versione non ufficiale: le classifiche e i ghost originali non sono disponibili. Il supporto mobile e ai controller dipende dalla build. Conserva i crediti e i collegamenti degli autori e pubblica soltanto giochi per cui hai i necessari diritti.

Snake, Pong, Breakout, 2048 e Campo minato sono implementazioni originali delle regole dei rispettivi classici. Le build sono incluse nel sito, non caricano risorse di terze parti e funzionano senza connessione esterna.

Railway Miner è un gioco incrementale originale per giocatore singolo: il treno raccoglie minerali in automatico, vende il carico in stazione e usa i ricavi per acquistare potenziamenti. La build usa grafica Canvas e salva i progressi nel browser; non richiede connessione.

Plants vs. Zombies — PvZ Portable viene caricato tramite iframe da Retro Games Center e richiede una connessione. Il catalogo non ospita né fornisce le risorse di Plants vs. Zombies; il port può chiedere all'utente di importare un archivio ZIP dal proprio dispositivo. Usa soltanto file che possiedi e che sei autorizzato a utilizzare.

Candy Crush Clone di Tobse Fritz e Tiger Ball Online di 4j.com sono incorporati da host esterni; il sito non copia né ospita le loro build. Il repository di Candy Crush Clone dichiara una licenza MIT per il codice, ma elenca anche musica, immagini, pulsanti e font con licenze separate, che restano soggetti ai termini dei rispettivi titolari. Candy Crush Clone non è affiliato a King.

APEX FORMULA, Voxel Musou, K8s Games, VIM Master e Racing JS sono giochi di altri autori, integrati da build locali secondo le licenze incluse nelle rispettive cartelle `public/builds/`. K8s Games carica Three.js, Tailwind e i font da CDN. Racing JS include sorgenti e risorse con licenza AGPL-3.0-or-later e le licenze dei componenti terzi; la classifica online originale non è inclusa. APEX FORMULA, Voxel Musou e Racing JS richiedono WebGL.

HexGL di Thibaut Despoulain e Magic Maze Web di Daniel Dahl sono port HTML5 open source ospitati localmente; mantieni le licenze e le attribuzioni incluse nelle rispettive cartelle. Magic Maze Web usa il font Fraktur Modern, distribuito con la propria licenza.

## PolyTrack

La pagina di PolyTrack permette di creare profili locali; record e livree vengono conservati separatamente nel `localStorage` del browser. I profili non sono account e non si sincronizzano tra dispositivi. La classifica per pista usa Supabase e richiede una connessione; i tempi sono inviati dal gioco eseguito nel browser e non sono verificati contro trucchi o modifiche locali.

## Anime

La pagina anime cerca informazioni nel catalogo pubblico Jikan/MyAnimeList e salva i preferiti nel browser. Il link JustWatch aiuta a trovare i servizi legali disponibili in Italia; per riprodurre episodi completi nel sito serve una sorgente autorizzata che consenta l’embed.
