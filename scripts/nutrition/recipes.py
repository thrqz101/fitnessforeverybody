"""Project-authored reference recipes, not measured restaurant/dish records.

Weights are edible input grams. Final weights and 100% macro retention are
explicit assumptions. Oil means oil retained in the finished dish; no discarded
frying oil is included. These recipes may differ from a user's actual cooking.
"""
import json
from source_data import ROOT

recipes=[]
def add(key,name,yield_g,ingredients,aliases='',note=''):
    recipes.append({
        'id':key,'name':name,'aliases':[a for a in aliases.split(';') if a],
        'ingredients':[{'foodId':k,'edibleGrams':g} for k,g in ingredients.items()],
        'cookedYieldGrams':yield_g,'yieldMethod':'assumed_not_measured',
        'nutrientRetention':1,'retentionMethod':'assumed_macros_retained',
        'oilBasis':'retained_in_finished_dish',
        'note':note or '家常参考配方；成菜重量为假设值，不是实测。实际用油及含水量会改变每100g营养。'
    })

add('tomato-eggs','番茄炒蛋',600,{'tomato':400,'egg-raw':200,'oil-canola':20,'sugar':5,'salt':3},'西红柿炒鸡蛋;番茄炒鸡蛋;西红柿炒蛋')
add('yuxiang-pork','鱼香肉丝（白醋家常配方）',650,{'pork-tenderloin':250,'carrot':100,'green-pepper':100,'wood-ear-dry':10,'water':100,'oil-canola':25,'sugar':20,'vinegar':25,'soy-sauce':20,'corn-starch':10,'garlic':10,'ginger':5,'chili':10,'salt':2},'鱼香肉丝')
add('kungpao-chicken','宫保鸡丁（家常配方）',530,{'chicken-breast-raw':300,'peanut-roast':50,'cucumber':100,'oil-canola':20,'sugar':15,'vinegar':15,'soy-sauce':20,'corn-starch':8,'chili':10,'garlic':10,'ginger':5},'宫保鸡丁')
add('mapo-tofu','麻婆豆腐（辣椒酱家常配方）',650,{'tofu-soft':500,'beef-minced':80,'oil-canola':20,'chili-sauce':20,'soy-sauce':15,'corn-starch':8,'water':80,'garlic':10,'chili':10},'麻婆豆腐', '以瓶装辣椒酱代替豆瓣酱的参考配方，不代表传统配方；成菜重量及宏量营养保留为假设。')
add('braised-pork','红烧肉（家常配方）',450,{'pork-belly':500,'soy-sauce':35,'sugar':25,'ginger':10,'water':150},'红烧肉', '假设焖煮后保留全部原料脂肪和酱汁；如撇油或弃汁，每100g数值会变化。')
add('pepper-pork','青椒肉丝',470,{'pork-tenderloin':250,'green-pepper':250,'oil-canola':20,'soy-sauce':15,'corn-starch':8,'garlic':8,'salt':2})
add('potato-beef','土豆炖牛肉（瘦牛胸肉）',900,{'beef-brisket':400,'potato-raw':400,'carrot':150,'onion':100,'oil-canola':15,'soy-sauce':25,'water':200,'salt':3},'土豆炖牛肉')
add('braised-beef','红烧牛肉（瘦牛胸肉）',550,{'beef-brisket':500,'soy-sauce':35,'sugar':10,'oil-canola':15,'ginger':15,'water':200},'红烧牛肉')
add('shiitake-chicken','香菇滑鸡（去皮鸡胸肉）',560,{'chicken-breast-raw':300,'shiitake-fresh':200,'oil-canola':15,'soy-sauce':20,'corn-starch':10,'ginger':8,'water':80},'香菇滑鸡')
add('braised-wings','红烧鸡翅（可食部）',380,{'chicken-wing-raw':400,'soy-sauce':25,'sugar':15,'ginger':10,'water':100},'红烧鸡翅', '所有鸡翅克数均为去骨可食部重量；不能将带骨重量直接代入。')
add('steamed-seabass','清蒸海鲈鱼（可食部）',430,{'sea-bass':500,'soy-sauce':20,'oil-canola':10,'ginger':15,'spring-onion':15},'清蒸海鲈鱼', '海鲈鱼混合种的去骨可食部参考配方，不映射为中国淡水鲈鱼；成菜重量假设。')
add('braised-carp','红烧鲤鱼（可食部）',520,{'carp':500,'soy-sauce':25,'sugar':12,'oil-canola':20,'ginger':15,'water':100},'红烧鲤鱼')
add('sweet-sour-pork','糖醋里脊（白醋家常配方）',450,{'pork-tenderloin':300,'corn-starch':35,'egg-raw':30,'oil-canola':30,'sugar':35,'vinegar':30,'ketchup':40,'soy-sauce':10},'糖醋里脊', '油量为假设的成菜留存油量，未把整锅炸油计入；成菜重量假设。')
add('tomato-egg-soup','番茄蛋汤',1050,{'tomato':250,'egg-raw':100,'water':750,'oil-sesame':5,'salt':3},'番茄鸡蛋汤;西红柿蛋汤')
add('cabbage-tofu','白菜炖豆腐',900,{'napa':400,'tofu-regular':300,'oil-canola':15,'water':250,'salt':3})
add('homestyle-tofu','家常豆腐（常规豆腐配方）',650,{'tofu-regular':400,'carrot':100,'green-pepper':100,'oil-canola':25,'soy-sauce':20,'corn-starch':8,'water':50},'家常豆腐')
add('pork-eggplant','肉末茄子',600,{'eggplant':400,'pork-tenderloin':150,'oil-canola':25,'soy-sauce':20,'garlic':10,'water':50})
add('garlic-broccoli','蒜蓉西兰花',400,{'broccoli':450,'oil-canola':15,'garlic':15,'salt':2},'蒜香西兰花')
add('stir-spinach','清炒菠菜',350,{'spinach':450,'oil-canola':15,'garlic':10,'salt':2})
add('torn-cabbage','手撕包菜',420,{'cabbage':500,'oil-canola':20,'chili':10,'garlic':10,'soy-sauce':10,'vinegar':10})
add('sour-potato','酸辣土豆丝（白醋配方）',460,{'potato-raw':450,'green-pepper':50,'oil-canola':20,'vinegar':20,'chili':10,'salt':3},'酸辣土豆丝')
add('disanxian','地三鲜',650,{'potato-raw':250,'eggplant':300,'green-pepper':150,'oil-canola':40,'soy-sauce':20,'sugar':5,'corn-starch':8,'garlic':10},'', '油量为成菜留存油量假设；成菜重量假设，实际油炸吸油量差异较大。')
add('dry-greenbeans','干煸四季豆',400,{'green-bean':450,'pork-tenderloin':80,'oil-canola':25,'soy-sauce':15,'garlic':10,'chili':10})
add('bitter-eggs','苦瓜炒鸡蛋',480,{'bitter-melon':300,'egg-raw':200,'oil-canola':20,'salt':3},'苦瓜炒蛋')
add('woodear-pork','木耳炒肉（里脊配方）',450,{'wood-ear-dry':15,'water':130,'pork-tenderloin':250,'carrot':80,'oil-canola':20,'soy-sauce':15,'garlic':8},'木耳炒肉', '干木耳15g加130g泡发留存水；泡发后沥干重量及成菜重量均为假设。')
add('zucchini-eggs','西葫芦炒鸡蛋',540,{'zucchini':400,'egg-raw':200,'oil-canola':20,'salt':3},'西葫芦炒蛋')
add('celery-beef','芹菜炒牛肉（里脊配方）',470,{'celery':250,'beef-tenderloin':250,'oil-canola':20,'soy-sauce':20,'corn-starch':8,'ginger':8},'芹菜炒牛肉')
add('onion-beef','洋葱炒牛肉（里脊配方）',460,{'onion':250,'beef-tenderloin':250,'oil-canola':20,'soy-sauce':20,'corn-starch':8},'洋葱炒牛肉')
add('shrimp-eggs','虾仁炒鸡蛋',360,{'shrimp-raw':200,'egg-raw':200,'oil-canola':15,'salt':2},'虾仁炒蛋;滑蛋虾仁')
add('garlic-shrimp','蒜蓉虾仁',290,{'shrimp-raw':300,'garlic':30,'oil-canola':15,'soy-sauce':10})
add('cucumber-salad','凉拌黄瓜',450,{'cucumber':400,'garlic':15,'vinegar':20,'soy-sauce':15,'oil-sesame':8,'sugar':5},'拍黄瓜')
add('three-salad','凉拌三丝（黄瓜胡萝卜土豆）',520,{'cucumber':150,'carrot':150,'potato-boiled':150,'vinegar':20,'soy-sauce':15,'oil-sesame':10,'sugar':5},'凉拌三丝')
add('woodear-salad','凉拌木耳（泡发）',230,{'wood-ear-dry':20,'water':170,'vinegar':20,'soy-sauce':15,'oil-sesame':8,'garlic':10},'凉拌木耳')
add('tomato-beef','番茄炖牛肉（瘦牛胸肉）',900,{'beef-brisket':400,'tomato':400,'onion':100,'oil-canola':15,'water':200,'salt':3},'番茄炖牛肉')
add('egg-fried-rice','蛋炒饭',620,{'rice-cooked':450,'egg-raw':100,'carrot':50,'peas-raw':50,'oil-canola':20,'soy-sauce':15,'spring-onion':10,'salt':2})
add('shrimp-fried-rice','虾仁蛋炒饭',690,{'rice-cooked':450,'egg-raw':100,'shrimp-raw':100,'carrot':50,'peas-raw':50,'oil-canola':20,'soy-sauce':15,'salt':2})
add('steamed-eggs','鸡蛋羹',390,{'egg-raw':150,'water':250,'soy-sauce':10,'oil-sesame':3},'蒸蛋;蒸鸡蛋羹')
add('pepper-eggs','青椒炒鸡蛋',400,{'green-pepper':250,'egg-raw':200,'oil-canola':20,'salt':3},'青椒炒蛋')
add('cauliflower-pork','菜花炒肉',490,{'cauliflower':350,'pork-tenderloin':200,'oil-canola':20,'soy-sauce':15,'garlic':10},'花菜炒肉')
add('garlic-bokchoy','蒜蓉小白菜',350,{'bok-choy':450,'oil-canola':15,'garlic':15,'salt':2},'清炒小白菜')
add('stir-napa','清炒大白菜',420,{'napa':500,'oil-canola':15,'garlic':10,'salt':2})
add('saute-sprouts','清炒绿豆芽',400,{'mung-sprouts':450,'oil-canola':15,'spring-onion':10,'salt':2},'炒绿豆芽')
add('wintermelon-soup','冬瓜虾仁汤',1100,{'winter-melon':400,'shrimp-raw':100,'water':700,'oil-sesame':5,'salt':3})
add('mushroom-tofu-soup','鲜香菇豆腐汤',1050,{'shiitake-fresh':150,'tofu-soft':250,'water':700,'oil-sesame':5,'salt':3},'香菇豆腐汤')
add('carrot-eggs','胡萝卜炒鸡蛋',420,{'carrot':250,'egg-raw':200,'oil-canola':20,'salt':3})
add('celery-pork','芹菜炒肉丝',450,{'celery':300,'pork-tenderloin':200,'oil-canola':20,'soy-sauce':15,'corn-starch':8,'salt':2})
add('plain-congee','白粥（参考稠度）',1000,{'rice-raw':100,'water':1100},'白粥;大米粥', '100g生米煮至1000g成粥，水蒸发量假设；稠度不同每100g数值不同。')
add('millet-congee','小米粥（参考稠度）',1000,{'millet-raw':100,'water':1100},'小米粥')
add('oat-porridge','燕麦粥（清水，无糖）',500,{'oats':100,'water':500},'清水燕麦粥;无糖燕麦粥')
add('steamed-bun','馒头（无糖参考配方）',760,{'flour-white':500,'water':300,'yeast':5},'白馒头;馒头')
add('whole-bun','全麦馒头（混合面粉）',760,{'flour-whole':350,'flour-white':150,'water':310,'yeast':5},'全麦馒头')
add('rehydrated-woodear','黑木耳（泡发沥干，参考吸水率）',200,{'wood-ear-dry':20,'water':180},'泡发黑木耳;泡发木耳', '干木耳20g泡发沥干至200g为假设吸水率；不等于实测湿木耳记录。')

if __name__=='__main__':
    (ROOT/'data/nutrition-recipes.json').write_text(json.dumps({
        'version':'1.0.0','author':'project_reference_recipes',
        'basis':'edible_input_and_finished_dish_grams',
        'formula':'sum(ingredient.per100g * edibleGrams / 100) * nutrientRetention / cookedYieldGrams * 100',
        'recipes':recipes
    },ensure_ascii=False,indent=2)+'\n')
    print('REFERENCE RECIPES',len(recipes))
