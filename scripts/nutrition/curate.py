"""Freeze reviewed food-to-USDA mappings; unresolved foods remain pending."""
import json,re
from pathlib import Path
from source_data import ROOT,food_catalog
catalog=food_catalog(); mappings=[];pending=[]
def add(key,name,category,state,selector,aliases='',pack='sr_legacy'):
    key=key.strip().lower()
    matches=[f for f in catalog if f['pack']==pack and (f['fdcId']==selector if isinstance(selector,int) else re.search(selector,f['description'],re.I))]
    if len(matches)!=1:
        pending.append({'id':key,'name':name,'selector':selector,'reason':'No unique reviewed source match','candidates':[f['description'] for f in matches[:5]]});return
    f=matches[0]
    values=[a.strip() for a in aliases.split(';') if a.strip()]
    mappings.append({'id':key,'name':name,'nameEn':f['description'],'category':category,'foodKind':'single_food','cookingState':state,'aliases':values,'dataSet':pack,'fdcId':f['fdcId'],'ndbId':f['ndb'],'sourceDescription':f['description'],'sourcePublishedAt':f['published']})
def block(category,text):
    for line in text.strip().splitlines():
        key,name,state,selector,*alias=line.split('|')
        if selector.startswith('@'):add(key,name,category,state,int(selector[1:]),';'.join(alias),'foundation')
        elif selector.isdigit():add(key,name,category,state,int(selector),';'.join(alias))
        else:add(key,name,category,state,selector,';'.join(alias))
block('staple',r'''
rice-raw|大米（生）|raw|@2512381|大米;生大米;raw white rice
rice-cooked|米饭（熟）|cooked|169757|米饭;白米饭;熟米饭;大米饭;rice cooked;cooked rice;cooked white rice
rice-brown-raw|糙米（生）|raw|@2512380|糙米;生糙米
rice-brown-cooked|糙米饭（熟）|cooked|169704|糙米饭;熟糙米
rice-glutinous-raw|糯米（生）|raw|168883|糯米;生糯米
rice-glutinous-cooked|糯米饭（熟）|cooked|169711|糯米饭;熟糯米
millet-raw|小米（生）|raw|169702|小米;生小米
millet-cooked|小米（煮熟，不含额外粥水）|cooked|168871|熟小米
millet-flour|小米粉|dried|172023|millet flour
oats|燕麦片（干）|dried|@2346396|燕麦片;干燕麦片;rolled oats
steel-cut-oats|钢切燕麦（干）|dried|@2346397|钢切燕麦;steel cut oats
oat-bran|燕麦麸（生）|raw|168872|燕麦麸
oat-bran-cooked|燕麦麸（煮熟）|cooked|168873|熟燕麦麸
flour-white|小麦粉（白面粉）|dried|169761|小麦粉;面粉;白面粉;普通面粉;wheat flour
flour-whole|全麦粉|dried|168893|全麦面粉;whole wheat flour
bread-white|白面包|processed|^Bread, white, commercially prepared \(includes soft bread crumbs\)$|白吐司;white bread
bread-whole|全麦面包|processed|^Bread, whole-wheat, commercially prepared$|全麦吐司;whole wheat bread
noodles-egg-dry|鸡蛋面（干）|dried|169755|干鸡蛋面;dry egg noodles
noodles-egg-cooked|鸡蛋面（煮熟，无盐）|cooked|168926|熟鸡蛋面;cooked egg noodles
soba-dry|荞麦面（干）|dried|168906|干荞麦面
soba-cooked|荞麦面（煮熟）|cooked|168907|熟荞麦面
somen-dry|素面（干，小麦面条）|dried|168908|干素面
somen-cooked|素面（煮熟，小麦面条）|cooked|168909|熟素面
mung-noodles|绿豆粉丝（干）|dried|174258|干绿豆粉丝;绿豆粉丝
corn-raw|甜玉米（生，可食部）|raw|^Corn, sweet, yellow, raw$|甜玉米;生玉米;raw sweet corn
corn-cooked|甜玉米（煮熟，无盐）|cooked|^Corn, sweet, yellow, cooked, boiled, drained, without salt$|熟玉米;煮玉米
cornmeal|玉米粉（全谷）|dried|^Cornmeal, whole-grain, yellow$|全谷玉米粉
buckwheat|荞麦（生）|raw|^Buckwheat$|荞麦
quinoa-raw|藜麦（生）|raw|168874|藜麦;生藜麦
quinoa-cooked|藜麦（煮熟）|cooked|168917|熟藜麦
barley|大麦（珍珠麦，干）|dried|^Barley, pearled, raw$|珍珠麦
barley-cooked|大麦（珍珠麦，煮熟）|cooked|^Barley, pearled, cooked$|熟珍珠麦
potato-raw|土豆（生，含皮）|raw|^Potatoes, flesh and skin, raw$|土豆;马铃薯;生土豆;raw potato
potato-boiled|土豆（水煮，去皮）|cooked|^Potatoes, boiled, cooked without skin, flesh, without salt$|水煮土豆;煮土豆
sweet-potato-raw|红薯（生）|raw|168482|红薯;番薯;生红薯
sweet-potato-boiled|红薯（水煮，去皮）|cooked|^Sweet potato, cooked, boiled, without skin$|水煮红薯
sweet-potato-baked|红薯（烤熟，无盐）|cooked|^Sweet potato, cooked, baked in skin, flesh, without salt$|烤红薯
yam|薯蓣（Yam，生）|raw|^Yam, raw$|yam raw
taro|芋头（生）|raw|^Taro, raw$|芋头;生芋头
''')
block('legume',r'''
soybean-dry|黄豆（干）|dried|174270|黄豆;干黄豆
soybean-cooked|黄豆（煮熟，无盐）|cooked|174271|熟黄豆
edamame-raw|毛豆（生，可食部）|raw|169282|毛豆;生毛豆;edamame raw
edamame-cooked|毛豆（煮熟，无盐）|cooked|169283|熟毛豆
soybean-sprouts|黄豆芽（生）|raw|169284|黄豆芽
mung-dry|绿豆（干）|dried|174256|绿豆;干绿豆
mung-cooked|绿豆（煮熟，无盐）|cooked|174257|熟绿豆
mung-sprouts|绿豆芽（生）|raw|169957|绿豆芽;豆芽
adzuki-dry|红豆（干）|dried|173727|红豆;赤小豆
adzuki-cooked|红豆（煮熟，无盐）|cooked|173728|熟红豆
black-bean-dry|黑芸豆（干）|dried|173734|黑芸豆
black-bean-cooked|黑芸豆（煮熟，无盐）|cooked|173735|熟黑芸豆
chickpea-dry|鹰嘴豆（干）|dried|^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, raw$|鹰嘴豆
chickpea-cooked|鹰嘴豆（煮熟，无盐）|cooked|^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt$|熟鹰嘴豆
lentil-dry|扁豆（小扁豆，干）|dried|^Lentils, raw$|小扁豆;lentils raw
lentil-cooked|扁豆（小扁豆，煮熟）|cooked|^Lentils, mature seeds, cooked, boiled, without salt$|熟小扁豆
peas-raw|豌豆（鲜）|raw|170419|鲜豌豆;豌豆
peas-cooked|豌豆（煮熟，无盐）|cooked|170420|熟豌豆
tofu-firm|豆腐（硬，钙盐和卤水凝固）|processed|172448|硬豆腐;firm tofu
tofu-soft|豆腐（软，钙盐和卤水凝固）|processed|172449|软豆腐;嫩豆腐;soft tofu
tofu-regular|豆腐（常规，钙盐凝固）|processed|172476|豆腐;常规豆腐;tofu
tofu-hard|豆腐（硬，卤水凝固）|processed|174291|卤水硬豆腐
soy-milk|豆奶（无糖，强化钙及维生素）|processed|175215|无糖强化豆奶
''')
block('meat',r'''
chicken-breast-raw|鸡胸肉（去皮，生）|raw|@2646170|生鸡胸肉;鸡胸肉生;鸡胸肉（生）;raw chicken breast;鸡胸肉
chicken-breast-cooked|鸡胸肉（去皮，烤熟）|cooked|171477|熟鸡胸肉;鸡胸肉熟;鸡胸肉（熟）;烤鸡胸肉;cooked chicken breast;鸡胸肉
chicken-breast-stewed|鸡胸肉（去皮，炖熟）|cooked|171478|炖鸡胸肉
chicken-whole-raw|鸡肉（综合去皮，生）|raw|171052|生鸡肉;raw chicken meat;鸡肉
chicken-whole-roast|鸡肉（综合去皮，烤熟）|cooked|171054|烤熟鸡肉;鸡肉
chicken-thigh-skin-raw|鸡腿肉（带皮，生）|raw|172385|带皮生鸡腿肉
chicken-thigh-cooked|鸡腿肉（去皮，烤熟）|cooked|172388|去皮熟鸡腿肉
chicken-wing-raw|鸡翅（带皮，可食部，生）|raw|172390|生鸡翅;鸡翅
chicken-liver|鸡肝（生）|raw|^Chicken, liver, all classes, raw$|鸡肝;生鸡肝
duck-meat|鸭肉（家鸭，去皮，生）|raw|172410|生鸭肉;去皮鸭肉
duck-skin|鸭肉（家鸭，带皮，生）|raw|172408|带皮鸭肉
goose|鹅肉（家鹅，去皮，生）|raw|172413|去皮鹅肉;鹅肉
 turkey-breast|火鸡胸肉（去皮，生）|raw|171098|生火鸡胸肉
beef-tenderloin|牛里脊（去外部脂肪，生）|raw|171767|牛里脊;生牛里脊
beef-brisket|牛胸肉（瘦肉，生）|raw|168607|瘦牛胸肉;生牛胸肉
beef-brisket-fat|牛胸肉（肥瘦，生）|raw|168664|肥瘦牛胸肉
beef-minced|牛肉末（90%瘦，生）|raw|^Beef, ground, 90% lean meat / 10% fat, raw$|生牛肉末;90%瘦牛肉末
beef-liver|牛肝（生）|raw|^Beef, variety meats and by-products, liver, raw$|牛肝
pork-tenderloin|猪里脊（瘦，生）|raw|168249|猪里脊;生猪里脊;里脊肉
pork-tenderloin-roast|猪里脊（瘦，烤熟）|cooked|168250|熟猪里脊;烤猪里脊
pork-belly|猪五花肉（生）|raw|^Pork, fresh, belly, raw$|五花肉;猪五花肉;生五花肉
pork-liver|猪肝（生）|raw|^Pork, fresh, variety meats and by-products, liver, raw$|猪肝
rabbit|兔肉（家兔，生）|raw|^Game meat, rabbit, domesticated, composite of cuts, raw$|兔肉;生兔肉
''')
block('seafood',r'''
salmon-raw|三文鱼（养殖大西洋鲑，生）|raw|^Fish, salmon, Atlantic, farmed, raw$|生三文鱼;生大西洋鲑
salmon-cooked|三文鱼（养殖大西洋鲑，熟）|cooked|^Fish, salmon, Atlantic, farmed, cooked, dry heat$|熟三文鱼;烤三文鱼
tuna|黄鳍金枪鱼（生）|raw|^Fish, tuna, fresh, yellowfin, raw$|生黄鳍金枪鱼
cod|大西洋鳕鱼（生）|raw|^Fish, cod, Atlantic, raw$|生大西洋鳕鱼
tilapia|罗非鱼（生）|raw|^Fish, tilapia, raw$|罗非鱼;生罗非鱼
carp|鲤鱼（生）|raw|171952|鲤鱼;生鲤鱼
sea-bass|海鲈鱼（混合种，生）|raw|^Fish, sea bass, mixed species, raw$|海鲈鱼;生海鲈鱼
sardine|沙丁鱼（油浸罐头，沥干）|processed|^Fish, sardine, Atlantic, canned in oil, drained solids with bone$|油浸沙丁鱼罐头
trout|虹鳟鱼（养殖，生）|raw|^Fish, trout, rainbow, farmed, raw$|生虹鳟鱼
mackerel|大西洋鲭鱼（生）|raw|^Fish, mackerel, Atlantic, raw$|生大西洋鲭鱼
eel|鳗鱼（混合种，生）|raw|^Fish, eel, mixed species, raw$|鳗鱼;生鳗鱼
shrimp-raw|虾仁（生）|raw|175179|虾仁;生虾仁;raw shrimp
shrimp-cooked|虾仁（熟）|cooked|175180|熟虾仁;cooked shrimp
crab|蓝蟹肉（生）|raw|^Crustaceans, crab, blue, raw$|生蓝蟹肉
lobster|美洲龙虾肉（生）|raw|^Crustaceans, lobster, northern, raw$|生美洲龙虾肉
squid|鱿鱼（生）|raw|174223|鱿鱼;生鱿鱼
cuttlefish|墨鱼（生）|raw|^Mollusks, cuttlefish, mixed species, raw$|墨鱼;生墨鱼
octopus|章鱼（生）|raw|174218|章鱼;生章鱼
scallop|扇贝肉（生）|raw|174220|扇贝;生扇贝肉
clam|蛤蜊肉（混合种，生）|raw|174214|蛤蜊;蛤蜊肉
mussel|贻贝肉（蓝贻贝，生）|raw|^Mollusks, mussel, blue, raw$|蓝贻贝肉
''')
block('egg_dairy',r'''
egg-raw|鸡蛋（生，可食部）|raw|171287|生鸡蛋;raw egg
egg-boiled|鸡蛋（水煮，可食部）|cooked|173424|水煮蛋;煮鸡蛋;白煮蛋;boiled egg
egg-white|鸡蛋白（生）|raw|^Egg, white, raw, fresh$|生蛋白;鸡蛋白
egg-yolk|鸡蛋黄（生）|raw|^Egg, yolk, raw, fresh$|生蛋黄;鸡蛋黄
quail-egg|鹌鹑蛋（生，可食部）|raw|^Egg, quail, whole, fresh, raw$|生鹌鹑蛋
duck-egg|鸭蛋（生，可食部）|raw|^Egg, duck, whole, fresh, raw$|生鸭蛋
milk-whole|全脂牛奶|processed|^Milk, whole, 3.25% milkfat, with added vitamin D$|全脂奶;whole milk
milk-lowfat|低脂牛奶（1%乳脂）|processed|^Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D$|低脂牛奶;lowfat milk
milk-skim|脱脂牛奶|processed|^Milk, nonfat, fluid, with added vitamin A and vitamin D \(fat free or skim\)$|脱脂奶;skim milk
yogurt-plain|原味全脂酸奶（无添加糖）|processed|@2259793|原味全脂酸奶
Greek-yogurt|希腊酸奶（原味，脱脂）|processed|@330137|原味脱脂希腊酸奶
cheddar|切达奶酪|processed|@328637|切达芝士
mozzarella|马苏里拉奶酪（全脂）|processed|^Cheese, mozzarella, whole milk$|全脂马苏里拉芝士
butter|黄油（无盐）|processed|^Butter, without salt$|无盐黄油
cream|淡奶油（稀奶油）|processed|^Cream, fluid, light whipping$|稀奶油
''')
# Vegetables: exact raw-food descriptions, not arbitrary cooked variants.
for key,name,description,alias in [
('napa','大白菜','Cabbage, chinese (pe-tsai), raw','白菜;大白菜'),('bok-choy','小白菜（青梗菜）','Cabbage, chinese (pak-choi), raw','小白菜;青梗菜;bok choy'),
('spinach','菠菜','Spinach, raw','菠菜'),('water-spinach','空心菜','Swamp cabbage, raw','空心菜;蕹菜'),('lettuce','生菜（绿叶）','Lettuce, green leaf, raw','绿叶生菜'),
('amaranth','苋菜','Amaranth leaves, raw','苋菜'),('gai-lan','芥蓝','Broccoli, chinese, raw','芥蓝'),('crown-daisy','茼蒿','Chrysanthemum, garland, raw','茼蒿'),
('celery','芹菜','Celery, raw','芹菜'),('cilantro','香菜','Coriander (cilantro) leaves, raw','香菜'),('chives','细香葱（Chives，生）','Chives, raw','chives raw'),
('broccoli','西兰花','Broccoli, raw','西兰花;broccoli'),('cauliflower','菜花','Cauliflower, raw','菜花;花菜'),('tomato','番茄（生）','Tomatoes, red, ripe, raw, year round average','番茄;西红柿;生番茄;tomato;tomatoes'),
('cucumber','黄瓜（含皮）','Cucumber, with peel, raw','黄瓜;cucumber'),('eggplant','茄子','Eggplant, raw','茄子;eggplant'),('carrot','胡萝卜','Carrots, raw','胡萝卜;carrot'),
('daikon','白萝卜（东方萝卜）','Radishes, oriental, raw','白萝卜;daikon'),('pumpkin','南瓜','Pumpkin, raw','南瓜'),('winter-melon','冬瓜','Waxgourd, (chinese preserving melon), raw','冬瓜'),
('bitter-melon','苦瓜','Balsam-pear (bitter gourd), pods, raw','苦瓜'),('luffa','丝瓜','Gourd, dishcloth (towelgourd), raw','丝瓜'),
('zucchini','西葫芦（含皮）','Squash, summer, zucchini, includes skin, raw','西葫芦;zucchini'),('green-pepper','青甜椒','Peppers, sweet, green, raw','青椒;青甜椒'),
('red-pepper','红甜椒','Peppers, sweet, red, raw','红椒;红甜椒'),('chili','红辣椒','Peppers, hot chili, red, raw','红辣椒;辣椒'),
('onion','洋葱','Onions, raw','洋葱;onion'),('garlic','大蒜','Garlic, raw','大蒜;蒜;garlic'),('ginger','生姜','Ginger root, raw','生姜;姜;ginger'),
('lotus','莲藕','Lotus root, raw','莲藕;藕'),('bamboo','竹笋','Bamboo shoots, raw','竹笋'),('green-bean','四季豆','Beans, snap, green, raw','四季豆'),
('yardlong-bean','豇豆（长豆角）','Yardlong bean, raw','豇豆;长豆角'),('snow-peas','荷兰豆','Peas, edible-podded, raw','荷兰豆'),('okra','秋葵','Okra, raw','秋葵'),
('celtuce','莴笋','Celtuce, raw','莴笋'),('red-cabbage','紫甘蓝','Cabbage, red, raw','紫甘蓝'),('cabbage','包菜（圆白菜）','Cabbage, raw','包菜;圆白菜;卷心菜'),
('beet','甜菜根','Beets, raw','甜菜根'),('spring-onion','小葱（含葱绿）','Onions, spring or scallions (includes tops and bulb), raw','小葱;香葱;葱花'),
('mustard-green','芥菜','Mustard greens, raw','芥菜'),('asparagus','芦笋','Asparagus, raw','芦笋'),('leek','韭葱（Leek，生）','Leeks, (bulb and lower leaf-portion), raw','leek raw')]:
    add(key,name,'vegetable','raw','^'+re.escape(description)+'$',alias)
block('mushroom_algae',r'''
mushroom|双孢蘑菇（白蘑菇，鲜）|raw|^Mushrooms, white, raw$|白蘑菇;双孢蘑菇;white mushroom
shiitake-fresh|香菇（鲜）|raw|^Mushrooms, shiitake, raw$|鲜香菇;香菇
shiitake-dry|香菇（干）|dried|^Mushrooms, shiitake, dried$|干香菇
enoki|金针菇（鲜）|raw|^Mushrooms, enoki, raw$|金针菇
oyster-mushroom|平菇（鲜）|raw|^Mushrooms, oyster, raw$|平菇
wood-ear-dry|黑木耳（云耳，干）|dried|168581|干黑木耳;干木耳
kelp|海带（鲜）|raw|^Seaweed, kelp, raw$|鲜海带
wakame|裙带菜（鲜）|raw|^Seaweed, wakame, raw$|鲜裙带菜
nori|紫菜（Laver，鲜）|raw|^Seaweed, laver, raw$|鲜紫菜
''')
for key,name,pattern,alias in [
('apple','苹果（含皮）',"Apples, raw, with skin (Includes foods for USDA's Food Distribution Program)",'苹果;apple'),('banana','香蕉（去皮）','Bananas, raw','香蕉;banana'),('pear','梨','Pears, raw','梨;pear'),
('grape','葡萄（红或绿）','Grapes, red or green (European type, such as Thompson seedless), raw','葡萄;grapes'),
('orange','橙子','Oranges, raw, all commercial varieties','橙子;橙;orange'),('tangerine','橘子','Tangerines, (mandarin oranges), raw','橘子;桔子'),
('pomelo','柚子','Pummelo, raw','柚子;pomelo'),('grapefruit','西柚（粉红或红肉）','Grapefruit, raw, pink and red, all areas','西柚;葡萄柚'),
('lemon','柠檬（去皮）','Lemons, raw, without peel','柠檬'),('peach','桃','Peaches, yellow, raw','桃;桃子'),('nectarine','油桃','Nectarines, raw','油桃'),
('plum','李子','Plums, raw','李子'),('apricot','杏','Apricots, raw','杏'),('strawberry','草莓','Strawberries, raw','草莓;strawberry'),
('blueberry','蓝莓','Blueberries, raw','蓝莓;blueberry'),('raspberry','树莓','Raspberries, raw','树莓'),('mulberry','桑葚','Mulberries, raw','桑葚'),
('watermelon','西瓜','Watermelon, raw','西瓜'),('cantaloupe','哈密瓜（Cantaloupe）','Melons, cantaloupe, raw','cantaloupe'),
('honeydew','蜜瓜（Honeydew）','Melons, honeydew, raw','蜜瓜;honeydew'),('mango','芒果','Mangos, raw','芒果;mango'),
('pineapple','菠萝','Pineapple, raw, all varieties','菠萝;pineapple'),('papaya','木瓜','Papayas, raw','木瓜'),('kiwi','猕猴桃（绿肉）','Kiwifruit, green, raw','猕猴桃;奇异果;kiwi'),
('lychee','荔枝','Litchis, raw','荔枝'),('longan','龙眼','Longans, raw','龙眼;桂圆鲜果'),('cherry','樱桃','Cherries, sweet, raw','樱桃;车厘子'),
('jujube','鲜枣','Jujube, raw','鲜枣'),('raisin','葡萄干（深色，无籽）',"Raisins, dark, seedless (Includes foods for USDA's Food Distribution Program)",'葡萄干'),('avocado','牛油果','Avocados, raw, all commercial varieties','牛油果;avocado')]:
    add(key,name,'fruit','dried' if key=='raisin' else 'raw','^'+re.escape(pattern)+'$',alias)
block('nuts_seeds',r'''
peanut|花生（生）|raw|^Peanuts, all types, raw$|生花生;花生
peanut-roast|花生（干烤，无盐）|cooked|^Peanuts, all types, dry-roasted, without salt$|无盐熟花生
almond|杏仁（巴旦木）|raw|^Nuts, almonds$|巴旦木;almond
walnut|核桃仁|raw|^Nuts, walnuts, english$|核桃;核桃仁
cashew|腰果（生）|raw|^Nuts, cashew nuts, raw$|生腰果;腰果
pistachio|开心果（生）|raw|^Nuts, pistachio nuts, raw$|生开心果
hazelnut|榛子|raw|^Nuts, hazelnuts or filberts$|榛子
chestnut|板栗（生）|raw|^Nuts, chestnuts, chinese, raw$|生板栗;板栗
pumpkin-seed|南瓜籽仁（干）|dried|^Seeds, pumpkin and squash seed kernels, dried$|南瓜籽仁
sunflower-seed|葵花籽仁（干）|dried|^Seeds, sunflower seed kernels, dried$|葵花籽仁
chia|奇亚籽（干）|dried|^Seeds, chia seeds, dried$|奇亚籽
flax|亚麻籽|raw|^Seeds, flaxseed$|亚麻籽
sesame|芝麻（全籽，干）|dried|^Seeds, sesame seeds, whole, dried$|干芝麻
''')
block('oil_condiment',r'''
oil-canola|菜籽油（Canola）|processed|172336|菜籽油;canola oil
oil-soybean|大豆油|processed|171411|豆油;大豆油
oil-olive|橄榄油（烹调用）|processed|171413|橄榄油;olive oil
oil-peanut|花生油|processed|^Oil, peanut, salad or cooking$|花生油
oil-corn|玉米油|processed|^Oil, corn, industrial and retail, all purpose salad or cooking$|玉米油
oil-sesame|芝麻油|processed|^Oil, sesame, salad or cooking$|芝麻油;香油
lard|猪油|processed|^Lard$|猪油
sugar|白砂糖|processed|^Sugars, granulated$|白砂糖;白糖;sugar
brown-sugar|红糖（Brown sugar）|processed|^Sugars, brown$|brown sugar
honey|蜂蜜|processed|^Honey$|蜂蜜
salt|食盐|processed|^Salt, table$|盐;食盐
soy-sauce|酱油（酿造，小麦及大豆）|processed|174277|酱油;soy sauce
vinegar|白醋（蒸馏醋）|processed|172237|白醋;蒸馏醋;distilled vinegar
corn-starch|玉米淀粉|dried|^Cornstarch$|玉米淀粉
potato-flour|马铃薯粉|dried|^Potato flour$|土豆粉;potato flour
Oyster-sauce|蚝油|processed|174529|蚝油;oyster sauce
ketchup|番茄酱（Ketchup）|processed|^Catsup$|番茄沙司;ketchup
chili-sauce|辣椒酱（瓶装热辣酱）|processed|^Sauce, hot chile, sriracha$|sriracha
yeast|干酵母|dried|175043|干酵母
water|饮用水|raw|^Beverages, water, tap, drinking$|水;饮用水
''')
# Known gaps stay explicit instead of borrowing a different species or process.
for name in ['米醋','紫薯','中国山药','北豆腐（特定中国制作工艺）','南豆腐（特定中国制作工艺）','内酯豆腐','豆腐干','豆腐皮','腐竹（干）','腐竹（泡发）','黑大豆','无糖豆浆（非强化）','鸡腿肉（去皮，生）','鸭胸肉（家鸭，去皮）','鸭腿肉','牛腩（中国分割定义）','猪后腿瘦肉','猪排骨（生，可食部）','羊腿肉','瘦羊肉','鲫鱼','草鱼','鲅鱼（中国常见品种）','带鱼','黄鱼','河虾','中国韭菜','油麦菜','上海青（具体栽培种）','娃娃菜（具体栽培种）','杏鲍菇','银耳','海带（干）','紫菜（干）','火龙果','黑芝麻（单独品种）','豆瓣酱']:
    pending.append({'name':name,'reason':'No reviewed matching species/cut/preparation record selected; not enabled'})
Path(ROOT/'scripts/nutrition/food-mappings.json').write_text(json.dumps({'version':1,'mappings':mappings,'pending':pending},ensure_ascii=False,indent=2)+'\n')
print('MAPPED',len(mappings),'PENDING',len(pending))
for p in pending:
    if 'selector' in p:print('UNRESOLVED',p['id'],p['name'],p['selector'],'candidates:',p['candidates'])
