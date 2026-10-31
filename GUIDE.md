# Household Ledger: setup and use

The dashboard is a static website (the files in the repo root). It contains no amounts, account numbers or passwords. `data/demo.json` holds invented numbers only. The data comes live from your private Google Sheet through a small Apps Script, and only when the correct password is supplied.

## A. One-time setup (about 20 minutes)

### 1. Apps Script in the sheet
1. Open the Google Sheet and choose **Extensions > Apps Script**.
2. Replace everything with the contents of `Code.gs`.
3. **Project settings** (gear icon) > **Script properties** > **Add property**: name `PASSWORD`, value = a long passphrase (at least 4 words). You share this with Sofie.
4. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Confirm the permissions.
5. Copy the **Web app URL** (ends in `/exec`).
6. Test: paste the URL with `?p=WRONG` in your browser. You should see `{"error":"unauthorized"}`. With the right password you get JSON with your data.

After any change to `Code.gs`: **Deploy > Manage deployments > edit > New version**. The URL stays the same.

### 2. Website on GitHub Pages
1. Create a **public** repo with a neutral name, e.g. `huishoudboekje`.
2. Put the files in the repo root. `data/fixture.json` is in `.gitignore` and must never go online.
3. Open `config.js` and set `API_URL` to your Web app URL. Commit.
4. Repo > **Settings > Pages** > Branch `main`, folder `/ (root)`. After a minute it is live at `https://YOURNAME.github.io/huishoudboekje/`.

### 3. Home screen
- **iPad / iPhone (Safari)**: open the link, tap Share, then **Add to Home Screen**. Enter the password once; it is remembered on that device.
- Send Sofie the link and the password over a private channel.

## B. Every month
1. Add the new transactions to the sheet as you already do. Also update **Saldi** for the buffer card.
2. Open the dashboard. It fetches the latest data itself (menu "..." > Gegevens vernieuwen if you just changed something).

That is all.

## C. Accounts and Sofie
- **Optional column Gebruik** in the **Rekeningen** tab: `maandelijks` (monthly) or `af en toe` (occasional). An occasional account never triggers the "no bookings" note. Without the column, credit card, Revolut and meal vouchers count as occasional automatically.
- Accounts with Eigenaar = `Sofie` fill the SOFIE view. Without her own accounts, income-based tiles show an empty state inside the tile.

## D. Layout (widgets)
- Tap **Bewerk** or long-press a tile. Drag by the handle (⠿) or use the arrows. S, M and L set the size, − removes a tile, **+ Widget** adds one. **Standaard herstellen** resets that view. **Klaar** finishes.
- The layout is saved per device and per view. To move it: menu (three dots) > **Kopieer layoutcode**, then on the other device > **Plak layoutcode**. The code contains no numbers.

## E. Maintenance and limits
- **Change the password**: edit the script property. Everyone has to re-enter it (menu > "Wachtwoord vergeten op dit toestel").
- **Lockout**: after 8 wrong attempts it is blocked for 15 minutes. This applies to everyone, including you two.
- **Password in the URL**: it travels as a parameter of an encrypted (https) request. Use a unique password you use nowhere else.
- **Sheet structure**: if columns or tabs are renamed, the dashboard shows a clear error message. Keep the column names of `Transacties` as they are.
- **Offline**: the dashboard shows the last fetched data with an "Offline" notice.
- **Still to do on your side**: a real iPad/Safari test, the home-screen install, and a first real call to the Apps Script.

## F. Testing (for whoever works on the code)
- `node dev/test_calc.js`: calculation and layout rules. With `data/fixture.json` (local, never in git) it also checks the real numbers.
- `python3 dev/test_ui.py <folder with a copy of the site + data/fixture.json>`: Playwright screen test at iPad and phone sizes, light and dark.
- `python3 dev/tools_demo.py data/demo.json`: fresh invented demo data.
