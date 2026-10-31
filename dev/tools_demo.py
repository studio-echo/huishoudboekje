# Genereert volledig verzonnen demodata (geen echte gegevens) in hetzelfde formaat als het blad.
# Gebruik: python3 dev/tools_demo.py data/demo.json
import json, random, sys
random.seed(11)
CATS = [("Loon", "inkomen"), ("Inkomen overig", "inkomen"), ("Woonkost", "uitgave"), ("Mobiliteit & parking", "uitgave"),
        ("Boodschappen", "uitgave"), ("Horeca & delivery", "uitgave"), ("Abonnementen", "uitgave"), ("Gezondheid", "uitgave"),
        ("Sport & hobby", "uitgave"), ("Vrije tijd & events", "uitgave"), ("Persoonlijke verzorging", "uitgave"),
        ("Shopping & aankopen", "uitgave"), ("Reizen", "uitgave"), ("Administratie & overheid", "uitgave"), ("Varia", "uitgave"),
        ("Sparen & investeren", "sparen"), ("Interne overdracht", "neutraal"), ("Overdracht gezamenlijke rekening", "neutraal"),
        ("Voorschot derden", "neutraal")]
REK = [
    {"Rekening_ID": "DEMO-M-ZICHT", "Naam": "Zicht Mats (demo)", "Eigenaar": "Mats", "Type": "Zichtrekening", "Actief": "JA", "Gebruik": "maandelijks"},
    {"Rekening_ID": "DEMO-S-ZICHT", "Naam": "Zicht Sofie (demo)", "Eigenaar": "Sofie", "Type": "Zichtrekening", "Actief": "JA", "Gebruik": "maandelijks"},
    {"Rekening_ID": "DEMO-GEZ", "Naam": "Gezamenlijk (demo)", "Eigenaar": "Gezamenlijk", "Type": "Zichtrekening", "Actief": "JA", "Gebruik": "maandelijks"},
    {"Rekening_ID": "DEMO-M-KAART", "Naam": "Kredietkaart (demo)", "Eigenaar": "Mats", "Type": "Kredietkaart", "Actief": "JA", "Gebruik": "af en toe"},
]
T = []
def add(d, acc, cat, amt, m, s, once=0, tp="", om=""):
    T.append(dict(Datum=d, Rekening_ID=acc, Categorie=cat, Bedrag=round(amt, 2), Aandeel_Mats=m, Aandeel_Sofie=s,
                  Eenmalig=once, Tegenpartij=tp, Omschrijving=om, Nota="", Transactie_ID="DEMO-%04d" % (len(T) + 1)))
def day(p, a=1, b=27): return p + "%02d" % random.randint(a, b)
M, S, G, K = "DEMO-M-ZICHT", "DEMO-S-ZICHT", "DEMO-GEZ", "DEMO-M-KAART"
months = ["2026-%02d" % i for i in range(3, 11)]
for i, mo in enumerate(months):
    p = mo + "-"
    last = mo == "2026-10"
    add(p + "01", M, "Overdracht gezamenlijke rekening", -760, 1, 0, 0, "Gezamenlijk (demo)")
    add(p + "02", G, "Overdracht gezamenlijke rekening", 760, 0, 0, 0, "Mats (demo)")
    add(p + "01", S, "Overdracht gezamenlijke rekening", -680, 0, 1, 0, "Gezamenlijk (demo)")
    add(p + "02", G, "Overdracht gezamenlijke rekening", 680, 0, 0, 0, "Sofie (demo)")
    add(p + "03", G, "Woonkost", -820, .5, .5, 0, "Bank woonkrediet (demo)")
    add(p + "04", G, "Woonkost", -round(random.uniform(95, 125), 2), .5, .5, 0, "Energie (demo)")
    add(p + "05", G, "Abonnementen", -45, .5, .5, 0, "Internet (demo)")
    add(p + "06", M, "Abonnementen", -11.99, 1, 0, 0, "Muziekdienst (demo)")
    add(p + "07", S, "Abonnementen", -8.99, 0, 1, 0, "Streaming (demo)")
    add(p + "08", M, "Mobiliteit & parking", -38, 1, 0, 0, "Verzekering (demo)")
    add(p + "09", S, "Sport & hobby", -32, 0, 1, 0, "Sportclub (demo)")
    if mo <= "2026-07":
        add(p + "06", M, "Mobiliteit & parking", -120, 1, 0, 0, "Rekening vader", "Afbetaling fiets")
    for _ in range(4 if not last else 1):
        add(day(p), G, "Boodschappen", -round(random.uniform(45, 120), 2), .5, .5, 0, random.choice(["Supermarkt A (demo)", "Supermarkt B (demo)", "Bakker (demo)"]))
    if last:
        add(p + "03", M, "Horeca & delivery", -18.5, 1, 0, 0, "Broodjeszaak (demo)")
        continue
    add(p + "25", M, "Loon", round(random.uniform(2950, 3050), 2), 1, 0, 0, "Werkgever A (demo)", "Loon")
    add(p + "26", S, "Loon", round(random.uniform(2550, 2650), 2), 0, 1, 0, "Werkgever B (demo)", "Loon")
    add(p + "28", M, "Sparen & investeren", -300, 1, 0, 0, "Spaarrekening (demo)")
    add(p + "28", S, "Sparen & investeren", -250 if i % 2 else -150, 0, 1, 0, "Spaarrekening (demo)")
    for _ in range(3):
        add(day(p), M, random.choice(["Horeca & delivery", "Shopping & aankopen", "Vrije tijd & events"]), -round(random.uniform(12, 90), 2), 1, 0, 0, random.choice(["Café (demo)", "Webwinkel (demo)", "Bioscoop (demo)", "Restaurant (demo)"]))
        add(day(p), S, random.choice(["Horeca & delivery", "Persoonlijke verzorging", "Shopping & aankopen"]), -round(random.uniform(10, 80), 2), 0, 1, 0, random.choice(["Kapper (demo)", "Boekhandel (demo)", "Lunchbar (demo)", "Kledingzaak (demo)"]))
    add(day(p), G, "Horeca & delivery", -round(random.uniform(40, 95), 2), .5, .5, 0, "Restaurant samen (demo)")
    if mo in ("2026-05", "2026-08"):
        for _ in range(3):
            add(day(p), K, random.choice(["Reizen", "Shopping & aankopen"]), -round(random.uniform(60, 220), 2), .5, .5, 0, random.choice(["Hotel (demo)", "Luchtvaart (demo)", "Elektronica (demo)"]))
    if mo == "2026-06":
        add(p + "14", M, "Shopping & aankopen", -899, 1, 0, 1, "Elektronicazaak (demo)", "Nieuwe laptop")
    if mo == "2026-07":
        add(p + "20", G, "Reizen", -1450, .5, .5, 1, "Reisbureau (demo)", "Zomerreis")
    if mo == "2026-09":
        add(p + "12", S, "Gezondheid", -240, 0, 1, 1, "Tandarts (demo)")
SAL = [{"Rekening_ID": M, "Datum": "2026-09-30", "Saldo": 2850.0}, {"Rekening_ID": S, "Datum": "2026-09-30", "Saldo": 3420.0},
       {"Rekening_ID": G, "Datum": "2026-09-30", "Saldo": 1240.0}]
out = {"transacties": T, "rekeningen": REK, "categorieen": [{"Categorie": c, "Type": t} for c, t in CATS], "saldi": SAL}
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "data/demo.json", "w"), ensure_ascii=False, indent=0)
print(len(T), "rijen")
