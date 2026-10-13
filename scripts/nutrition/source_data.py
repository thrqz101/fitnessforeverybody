"""Read only selected USDA tables from official ZIPs; never dump large tables."""
import csv,io,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PACKS={'sr_legacy':ROOT/'output/nutrition-sources/sr-legacy-2018.zip','foundation':ROOT/'output/nutrition-sources/foundation-2026.zip'}
def rows(pack,table):
    with zipfile.ZipFile(PACKS[pack]) as archive:
        name=next(n for n in archive.namelist() if n==table or n.endswith('/'+table))
        with archive.open(name) as raw:
            yield from csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig'))
def food_catalog():
    foods=[]
    for pack in PACKS:
        ndb={r['fdc_id']:r.get('NDB_number','') for r in rows(pack,'sr_legacy_food.csv' if pack=='sr_legacy' else 'foundation_food.csv')}
        for r in rows(pack,'food.csv'):
            if r['data_type'] not in ['sr_legacy_food','foundation_food']:continue
            foods.append({'pack':pack,'fdcId':int(r['fdc_id']),'ndb':ndb.get(r['fdc_id'],''),'description':r['description'],'published':r['publication_date']})
    return foods
if __name__=='__main__':
    import re,sys
    catalog=food_catalog()
    for pattern in sys.argv[1:]:
        matches=[f for f in catalog if re.search(pattern,f['description'],re.I)]
        print('\nQUERY',pattern,'TOTAL',len(matches))
        for f in matches[:18]:print(f['pack'],f['fdcId'],f['ndb'],f['description'])
