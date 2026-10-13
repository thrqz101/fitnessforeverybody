"""Reproducible selected USDA import + explicit recipe calculation + CSV export.

Usage: python3 scripts/nutrition/build.py [--check]
Official archives must be downloaded to output/nutrition-sources first.
--check compares all artifacts without rewriting them.
"""
import csv,hashlib,io,json,math,sys
from collections import Counter,defaultdict
from source_data import ROOT,PACKS,rows

DATE='2026-10-13'
NUTRIENTS={'protein':'1003','carbs':'1005','fat':'1004','fiber':'1079'}
ENERGY=['1008','2048','2047','1062']
VERSIONS={'sr_legacy':'SR Legacy 2018-04','foundation':'Foundation Foods 2026-04-30'}
URLS={
    'sr_legacy':'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip',
    'foundation':'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip'
}
def encode(value):return json.dumps(value,ensure_ascii=False,indent=2)+'\n'
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def run():
    mappings=json.loads((ROOT/'scripts/nutrition/food-mappings.json').read_text())
    recipe_data=json.loads((ROOT/'data/nutrition-recipes.json').read_text())
    selected=defaultdict(set)
    for f in mappings['mappings']:selected[f['dataSet']].add(str(f['fdcId']))
    amounts=defaultdict(dict)
    for pack,ids in selected.items():
        units={r['id']:r['unit_name'].lower() for r in rows(pack,'nutrient.csv')}
        for nutrient_id in list(NUTRIENTS.values())+ENERGY:
            assert units[nutrient_id]==('kj' if nutrient_id=='1062' else 'kcal' if nutrient_id in ENERGY else 'g'), (pack,nutrient_id)
        for r in rows(pack,'food_nutrient.csv'):
            if r['fdc_id'] not in ids or r['nutrient_id'] not in list(NUTRIENTS.values())+ENERGY:continue
            if not r['amount']:continue
            amount=float(r['amount'])
            assert math.isfinite(amount) and amount>=0,r
            # Duplicate authoritative amounts must agree rather than silently overwrite.
            key=(pack,int(r['fdc_id'])); nid=r['nutrient_id']
            assert nid not in amounts[key] or amounts[key][nid]==amount,(key,nid)
            amounts[key][nid]=amount
    foods=[]
    for f in mappings['mappings']:
        raw=amounts[(f['dataSet'],f['fdcId'])]; missing=[]; per={}; provenance={}
        for metric,nid in NUTRIENTS.items():
            per[metric]=raw.get(nid,0)
            if nid not in raw:missing.append(metric)
            else:provenance[metric]={'nutrientId':int(nid),'sourceAmount':raw[nid],'sourceUnit':'g'}
        energy=next((nid for nid in ENERGY if nid in raw),None)
        per['calories']=round(raw[energy]/4.184 if energy=='1062' else raw.get(energy,0),6)
        if energy:provenance['calories']={'nutrientId':int(energy),'sourceAmount':raw[energy],'sourceUnit':'kJ' if energy=='1062' else 'kcal'}
        else:missing.append('calories')
        food={k:v for k,v in f.items() if k not in ['dataSet','fdcId','ndbId','sourceDescription','sourcePublishedAt']}
        food.update(basisGrams=100,per100g=per,missingNutrients=missing,
            qualityFlags=['reference_population_and_variety_may_differ']+(['missing_source_nutrients_zero_filled'] if missing else []),
            source={'name':'USDA FoodData Central','method':'reference','dataset':f['dataSet'],'datasetVersion':VERSIONS[f['dataSet']],
                'fdcId':f['fdcId'],'ndbId':f['ndbId'],'description':f['sourceDescription'],
                'url':f"https://fdc.nal.usda.gov/food-details/{f['fdcId']}/nutrients",'publishedAt':f['sourcePublishedAt'],
                'nutrients':provenance},updatedAt=DATE)
        foods.append(food)
    index={f['id']:f for f in foods}
    for r in recipe_data['recipes']:
        assert r['cookedYieldGrams']>0 and r['nutrientRetention']==1,r['id']
        per={k:0.0 for k in ['protein','carbs','fat','calories','fiber']}; missing=set()
        for ing in r['ingredients']:
            f=index[ing['foodId']]; grams=ing['edibleGrams']; assert grams>0
            missing.update(f['missingNutrients'])
            for metric in per:per[metric]+=f['per100g'][metric]*grams/100
        per={k:round(v/r['cookedYieldGrams']*100,6) for k,v in per.items()}
        # A partially missing recipe nutrient cannot be presented as a complete total.
        for metric in missing:per[metric]=0
        foods.append({'id':'recipe-'+r['id'],'name':r['name'],'category':'home_dish' if r['id'] not in ['plain-congee','millet-congee','oat-porridge','steamed-bun','whole-bun','rehydrated-woodear'] else 'prepared_staple',
            'foodKind':'dish','cookingState':'cooked','aliases':r['aliases'],'basisGrams':100,'per100g':per,
            'recipeId':r['id'],'source':{'name':'项目家常参考配方 + USDA 食材数据','method':'recipe_calculation',
                'recipeId':r['id'],'url':'','description':r['note'],'ingredientFoodIds':[i['foodId'] for i in r['ingredients']]},
            'missingNutrients':sorted(missing),'qualityFlags':['recipe_calculated_not_measured','assumed_finished_yield','assumed_macro_retention','assumed_oil_retention']+(['missing_source_nutrients_zero_filled'] if missing else []),'updatedAt':DATE})
    assert len({f['id'] for f in foods})==len(foods)
    for f in foods:
        assert f['basisGrams']==100
        for metric,n in f['per100g'].items():
            assert math.isfinite(n) and 0<=n<=(950 if metric=='calories' else 100),(f['id'],metric,n)
        assert all(f['per100g'][m]==0 for m in f['missingNutrients'])
    db={'version':'2.0.0','source':'USDA_FDC_CC0_and_project_reference_recipes','unit':'per_100g','basis':'edible_portion',
        'units':{'protein':'g','carbs':'g','fat':'g','calories':'kcal','fiber':'g'},
        'note':'每100g该状态可食部。中文为项目映射；家常菜为有明确假设的配方计算参考，非实测。来源缺项置0并标记。碳水含膳食纤维，不重复加总。',
        'sourceArchives':[{'dataset':p,'version':VERSIONS[p],'url':URLS[p],'sha256':digest(PACKS[p]),'license':'CC0','importedAt':DATE} for p in PACKS],
        'foods':foods}
    columns=['food_id','name_zh','name_en','category','food_kind','cooking_state','basis_g','protein_g','carbs_g','fat_g','energy_kcal','fiber_g','aliases','source_name','source_id','source_url','source_dataset','source_version','data_method','missing_nutrients','quality_flags','recipe_id','updated_at']
    buf=io.StringIO(newline=''); writer=csv.DictWriter(buf,fieldnames=columns);writer.writeheader()
    for f in foods:
        s=f['source'];m=f['per100g']
        writer.writerow(dict(zip(columns,[f['id'],f['name'],f.get('nameEn',''),f['category'],f['foodKind'],f['cookingState'],100,m['protein'],m['carbs'],m['fat'],m['calories'],m['fiber'],'|'.join(f['aliases']),s['name'],s.get('fdcId',s.get('recipeId','')),s['url'],s.get('dataset',''),s.get('datasetVersion',''),s['method'],'|'.join(f['missingNutrients']),'|'.join(f['qualityFlags']),f.get('recipeId',''),f['updatedAt']])))
    exported=list(csv.DictReader(io.StringIO(buf.getvalue())))
    assert len(exported)==len(foods)
    for f,r in zip(foods,exported):
        assert r['food_id']==f['id'] and float(r['basis_g'])==100
        for metric,column in [('protein','protein_g'),('carbs','carbs_g'),('fat','fat_g'),('calories','energy_kcal'),('fiber','fiber_g')]:
            assert float(r[column])==f['per100g'][metric],(f['id'],metric)
    aliases=defaultdict(set)
    for f in foods:
        for a in [f['name'],f.get('nameEn','')]+f['aliases']:
            if a:aliases[a.casefold()].add(f['id'])
    pending=mappings['pending']+[
        {'name':n,'reason':'缺少同品种/部位/调料的核验来源；不以其他菜名顶替'} for n in ['回锅肉','咖喱鸡','可乐鸡翅','清蒸淡水鲈鱼','红烧鲫鱼','酸菜鱼','水煮鱼','糖醋排骨','冬瓜排骨汤','玉米排骨汤','紫菜蛋汤','清炒油麦菜','西芹炒香干','韭菜炒鸡蛋','蒜薹炒肉','番茄牛腩','豆角焖面','扬州炒饭']]
    report={'generatedAt':DATE,'counts':{'total':len(foods),'referenceSingleFoods':len(mappings['mappings']),'calculatedRecipes':len(recipe_data['recipes']),'pending':len(pending),'foodsWithMissingNutrients':sum(bool(f['missingNutrients']) for f in foods)},
        'categories':dict(Counter(f['category'] for f in foods)),
        'missingNutrients':[{'id':f['id'],'missing':f['missingNutrients']} for f in foods if f['missingNutrients']],
        'ambiguousAliases':{a:sorted(ids) for a,ids in aliases.items() if len(ids)>1},'pending':pending}
    artifacts={'data/nutrition-100g.json':encode(db).encode(),'data/nutrition-100g.csv':('\ufeff'+buf.getvalue()).encode(),
        'data/nutrition-100g.example.json':encode({**db,'foods':[f for f in foods if f['id'] in ['rice-raw','rice-cooked','chicken-breast-raw','chicken-breast-cooked','tomato','egg-raw','recipe-tomato-eggs','recipe-yuxiang-pork']]}).encode(),
        'output/nutrition-audit.json':encode(report).encode()}
    for relative,content in artifacts.items():
        file=ROOT/relative
        if '--check' in sys.argv:assert file.read_bytes()==content,f'Artifact mismatch: {relative}'
        else:file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(content)
    print(json.dumps(report['counts'],ensure_ascii=False))
    print('MISSING',json.dumps(report['missingNutrients'],ensure_ascii=False))
if __name__=='__main__':run()
