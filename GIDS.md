# Huishoudboekje: opzetten en gebruiken

Het dashboard is een statische website (map `site/`). Daar staan geen bedragen in. Wel staat er een rekening-ID (`GEZ-BE57`) en een paar naamwoorden in `calc.js`; pas die gerust aan als je de repo liever helemaal neutraal wilt. De gegevens komen live uit jullie privé Google Sheet via een klein Apps Script, en enkel met het wachtwoord.

## A. Eenmalig opzetten (ongeveer 20 minuten)

### 1. Apps Script in het blad
1. Open de Google Sheet, kies **Extensies > Apps Script**.
2. Vervang alles door de inhoud van `Code.gs`.
3. **Projectinstellingen** (tandwiel) > **Script-eigenschappen** > **Eigenschap toevoegen**: naam `PASSWORD`, waarde = een lange wachtwoordzin (minstens 4 woorden). Dit deel je met Sofie.
4. **Implementeren > Nieuwe implementatie > Web-app**. Uitvoeren als: **Ik**. Wie heeft toegang: **Iedereen**. Bevestig de toestemmingen.
5. Kopieer de **Web-app-URL** (eindigt op `/exec`).
6. Test: plak de URL met `?p=FOUT` in je browser. Je moet `{"error":"unauthorized"}` zien. Met het juiste wachtwoord zie je JSON met je data.

Na elke wijziging aan `Code.gs`: **Implementeren > Implementaties beheren > bewerken > Nieuwe versie**. De URL blijft gelijk.

### 2. Website op GitHub Pages
1. Maak een **publieke** repo met een neutrale naam, bv. `huishoudboekje`.
2. Upload de inhoud van de map `site/` (niet de map zelf), zonder `data/fixture.json` (die bestaat niet in `site/`). `data/demo.json` bevat enkel verzonnen cijfers.
3. Open `config.js` en vul `API_URL` in met je Web-app-URL. Commit.
4. Repo > **Settings > Pages** > Branch `main`, map `/ (root)`. Na een minuutje staat het op `https://JOUWNAAM.github.io/huishoudboekje/`.

### 3. Op het beginscherm
- **iPad / iPhone (Safari)**: open de link, deelknop, **Zet op beginscherm**. Geef het wachtwoord één keer in; het wordt op het toestel onthouden.
- Stuur Sofie de link en het wachtwoord (via een privékanaal).

## B. Elke maand
1. Voeg de nieuwe transacties toe aan het blad zoals je nu al doet. Vul ook **Saldi** aan voor de buffer.
2. Open het dashboard. Het haalt vanzelf de nieuwste data op (menu ... > Gegevens vernieuwen als je net iets wijzigde).
Meer is er niet.

## C. Sofie toevoegen
Zet haar rekeningen in **Rekeningen** met Eigenaar = `Sofie`. Zodra die er zijn, verdwijnt de waarschuwing in het dashboard. De weergave SOFIE blijft voorlopig enkel haar uitgaven tonen; vraag om Resultaat en spaarratio er bij te zetten zodra haar inkomen in het blad staat.

## D. Onderhoud en grenzen
- **Wachtwoord wijzigen**: Script-eigenschap aanpassen; iedereen moet het opnieuw ingeven (menu (de drie puntjes) > Wachtwoord vergeten op dit toestel).
- **Slotje**: na 8 foute pogingen is het 15 minuten geblokkeerd. Dat geldt voor iedereen, ook voor jullie.
- **Wachtwoord in de URL**: het wachtwoord gaat als parameter mee in een versleutelde (https) aanvraag. Gebruik een uniek wachtwoord dat je nergens anders gebruikt.
- **Structuur van het blad**: als kolommen of tabbladen hernoemd worden, toont het dashboard een duidelijke foutmelding. Blijf de kolomnamen van `Transacties` behouden.
- **Offline**: het dashboard toont de laatst opgehaalde gegevens met vermelding "Offline".
- **Nog te doen door jou**: echte iPad/Safari-test, installatie op beginscherm, en een eerste echte aanroep van het Apps Script.
