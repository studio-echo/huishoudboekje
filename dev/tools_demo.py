# Genereert volledig verzonnen demodata (geen echte gegevens) in hetzelfde formaat als het blad.
import json,random,datetime
random.seed(7)
cats=json.load(open('data/fixture.json'))['categorieen']
rek=[{"Rekening_ID":"MATS-FINTRO-BE86","Naam":"Persoonlijk (demo)","Eigenaar":"Mats","Type":"Zichtrekening","Actief":"JA"},
{"Rekening_ID":"GEZ-BE57","Naam":"Gezamenlijk (demo)","Eigenaar":"Gezamenlijk","Type":"Zichtrekening","Actief":"JA"}]
T=[];n=0
def add(d,acc,cat,amt,m,s,once,tp,om="",nota=""):
    global n;n+=1
    T.append(dict(Datum=d,Rekening_ID=acc,Categorie=cat,Bedrag=round(amt,2),Aandeel_Mats=m,Aandeel_Sofie=s,Eenmalig=once,Tegenpartij=tp,Omschrijving=om,Nota=nota,Transactie_ID="DEMO-%04d"%n))
for mo in range(3,10):
    p="2026-%02d-"%mo
    add(p+"25","MATS-FINTRO-BE86","Loon",3300,1,0,0,"Voorbeeld NV","Loon")
    add(p+"02","MATS-FINTRO-BE86","Woonkost",-680,.5,.5,0,"Voorbeeld woonkrediet","Lening")
    add(p+"03","MATS-FINTRO-BE86","Abonnementen",-12.99,1,0,0,"Streamify")
    add(p+"03","MATS-FINTRO-BE86","Abonnementen",-9.99,1,0,0,"Muziekdienst")
    add(p+"04","MATS-FINTRO-BE86","Sport & hobby",-29,1,0,0,"Sportclub")
    add(p+"26","MATS-FINTRO-BE86","Sparen & investeren",-300 if mo<8 else -400,1,0,0,"Spaarrekening")
    add(p+"10","MATS-FINTRO-BE86","Overdracht gezamenlijke rekening",-1500,1,0,0,"Gezamenlijke rekening")
    add(p+"10","GEZ-BE57","Overdracht gezamenlijke rekening",1500,0,0,0,"Mats (demo)")
    add(p+"11","GEZ-BE57","Overdracht gezamenlijke rekening",1400,0,0,0,"Partner (demo)")
    for i in range(6):
        add(p+"%02d"%random.randint(1,27),"GEZ-BE57","Boodschappen",-random.uniform(30,110),.5,.5,0,random.choice(["Supermarkt A","Supermarkt B","Bakker"]))
    add(p+"15","GEZ-BE57","Woonkost",-random.uniform(90,140),.5,.5,0,"Energieleverancier")
    for i in range(random.randint(3,6)):
        add(p+"%02d"%random.randint(1,27),"MATS-FINTRO-BE86",random.choice(["Horeca & delivery","Vrije tijd & events","Shopping & aankopen","Mobiliteit & parking"]),-random.uniform(8,90),1,0,0,random.choice(["Cafe Demo","Resto Voorbeeld","Tankstation","Kledingwinkel"]))
add("2026-06-12","MATS-FINTRO-BE86","Reizen",-640,.5,.5,1,"Reisbureau Demo","Citytrip")
add("2026-05-20","MATS-FINTRO-BE86","Shopping & aankopen",-420,1,0,1,"Elektro Demo","Nieuwe laptop")
S=[{"Rekening_ID":"MATS-FINTRO-BE86","Datum":"2026-09-28","Saldo":2400.0},{"Rekening_ID":"GEZ-BE57","Datum":"2026-09-28","Saldo":1100.0}]
json.dump(dict(transacties=T,rekeningen=rek,categorieen=cats,saldi=S),open('site/data/demo.json','w'))
print(len(T))
