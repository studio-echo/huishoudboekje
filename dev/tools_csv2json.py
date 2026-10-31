import csv,json,sys
def rd(p): return list(csv.DictReader(open(p,encoding='utf-8')))
T=rd('data/transacties.csv')
for r in T:
    for k in ('Bedrag','Aandeel_Mats','Aandeel_Sofie'): r[k]=float(str(r[k]).replace(',',''))
    r['Eenmalig']=int(float(r['Eenmalig'] or 0))
keep=['Datum','Rekening_ID','Categorie','Bedrag','Aandeel_Mats','Aandeel_Sofie','Eenmalig','Tegenpartij','Omschrijving','Nota','Transactie_ID']
T=[{k:r[k] for k in keep} for r in T]
S=rd('data/saldi.csv')
for r in S: r['Saldo']=float(r['Saldo'].replace(',',''))
S=[{k:r[k] for k in ('Rekening_ID','Datum','Saldo')} for r in S]
out={'transacties':T,'rekeningen':rd('data/rekeningen.csv'),'categorieen':rd('data/categorieen.csv'),'saldi':S}
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False)
