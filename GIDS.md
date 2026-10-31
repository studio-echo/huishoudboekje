# Huishoudboekje: opzetten en gebruiken

Het dashboard is een statische website (de bestanden in de hoofdmap van de repo). Daar staan geen bedragen, rekeningnummers of wachtwoorden in. `data/demo.json` bevat enkel verzonnen cijfers. De gegevens komen live uit jullie privé Google Sheet via een klein Apps Script, en enkel met het wachtwoord.

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
2. Zet de bestanden in de hoofdmap van de repo. `data/fixture.json` staat in `.gitignore` en mag nooit online.
3. Open `config.js` en vul `API_URL` in met je Web-app-URL. Commit.
4. Repo > **Settings > Pages** > Branch `main`, map `/ (root)`. Na een minuutje staat het op `https://JOUWNAAM.github.io/huishoudboekje/`.

### 3. Op het beginscherm
- **iPad / iPhone (Safari)**: open de link, deelknop, **Zet op beginscherm**. Geef het wachtwoord één keer in; het wordt op het toestel onthouden.
- Stuur Sofie de link en het wachtwoord (via een privékanaal).

## B. Elke maand
1. Voeg de nieuwe transacties toe aan het blad zoals je nu al doet. Vul ook **Saldi** aan voor de buffer.
2. Open het dashboard. Het haalt vanzelf de nieuwste data op (menu ... > Gegevens vernieuwen als je net iets wijzigde).
Meer is er niet.

## C. Rekeningen en Sofie
- **Kolom Gebruik (optioneel)** in het tabblad **Rekeningen**: `maandelijks` of `af en toe`. Een rekening op `af en toe` geeft nooit de melding "geen boekingen". Zonder die kolom tellen kredietkaart, Revolut en maaltijdcheques automatisch als `af en toe`.
- Rekeningen met Eigenaar = `Sofie` vullen de weergave SOFIE. Zonder eigen rekeningen tonen de tegels die inkomen nodig hebben een lege toestand in de tegel zelf.

## D. Indeling (widgets)
- Tik op **Bewerk** of druk lang op een tegel. Sleep aan de greep (⠿), of gebruik de pijlen. Met S, M en L kies je de grootte, met − verwijder je een tegel, met **+ Widget** voeg je er een toe. **Standaard herstellen** zet de indeling van die weergave terug. **Klaar** sluit af.
- De indeling wordt per toestel en per weergave bewaard. Naar een ander toestel: menu (de drie puntjes) > **Kopieer layoutcode**, en op het andere toestel > **Plak layoutcode**. De code bevat geen cijfers.

## E. Onderhoud en grenzen
- **Wachtwoord wijzigen**: Script-eigenschap aanpassen; iedereen moet het opnieuw ingeven (menu (de drie puntjes) > Wachtwoord vergeten op dit toestel).
- **Slotje**: na 8 foute pogingen is het 15 minuten geblokkeerd. Dat geldt voor iedereen, ook voor jullie.
- **Wachtwoord in de URL**: het wachtwoord gaat als parameter mee in een versleutelde (https) aanvraag. Gebruik een uniek wachtwoord dat je nergens anders gebruikt.
- **Structuur van het blad**: als kolommen of tabbladen hernoemd worden, toont het dashboard een duidelijke foutmelding. Blijf de kolomnamen van `Transacties` behouden.
- **Offline**: het dashboard toont de laatst opgehaalde gegevens met vermelding "Offline".
- **Nog te doen door jou**: echte iPad/Safari-test, installatie op beginscherm, en een eerste echte aanroep van het Apps Script.

## F. Testen (voor wie aan de code werkt)
- `node dev/test_calc.js`: rekenregels en indeling. Met `data/fixture.json` (lokaal, nooit in git) controleert het ook de echte cijfers.
- `python3 dev/test_ui.py <map met kopie van de site + data/fixture.json>`: schermtest met Playwright op iPad- en gsm-formaat, licht en donker.
- `python3 dev/tools_demo.py data/demo.json`: nieuwe verzonnen demodata.
