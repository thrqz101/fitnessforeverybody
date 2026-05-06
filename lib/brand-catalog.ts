export type FoodBrandCategory =
  | "western_fast_food"
  | "chinese_fast_food"
  | "noodles_rice"
  | "hotpot"
  | "malatang"
  | "tea_coffee"
  | "snack_bakery"
  | "convenience"
  | "casual_dining";

export type FoodBrandEntry = {
  brand: string;
  aliases: string[];
  category: FoodBrandCategory;
  commonProducts: string[];
  searchTerms: string[];
  estimateHint: string;
};

export const foodBrandCatalog: FoodBrandEntry[] = [
  {
    brand: "肯德基",
    aliases: ["kfc", "KFC", "开封菜"],
    category: "western_fast_food",
    commonProducts: ["香辣鸡腿堡", "新奥尔良烤翅", "原味鸡", "薯条", "可乐"],
    searchTerms: ["官方菜单", "营养成分", "汉堡", "炸鸡", "套餐"],
    estimateHint: "搜不到营养表时按西式快餐汉堡/炸鸡套餐估算，炸物脂肪偏高。"
  },
  {
    brand: "麦当劳",
    aliases: ["mcdonald", "mcdonalds", "麦记", "金拱门"],
    category: "western_fast_food",
    commonProducts: ["巨无霸", "麦辣鸡腿堡", "板烧鸡腿堡", "薯条", "麦旋风"],
    searchTerms: ["官方营养", "菜单", "汉堡", "套餐", "热量"],
    estimateHint: "优先用官方营养表；套餐要拆汉堡、薯条、饮料。"
  },
  {
    brand: "汉堡王",
    aliases: ["burger king", "BK", "皇堡"],
    category: "western_fast_food",
    commonProducts: ["皇堡", "天椒皇堡", "薯条", "洋葱圈", "烤鸡块"],
    searchTerms: ["官方菜单", "营养成分", "皇堡", "套餐"],
    estimateHint: "牛肉汉堡脂肪通常高于鸡肉汉堡，套餐要拆分。"
  },
  {
    brand: "塔斯汀",
    aliases: ["塔斯汀中国汉堡", "中国汉堡"],
    category: "western_fast_food",
    commonProducts: ["中国汉堡", "鸡腿中国汉堡", "烤翅", "薯条"],
    searchTerms: ["官方菜单", "热量", "中国汉堡", "营养成分"],
    estimateHint: "按中式汉堡和炸鸡小食估算，酱料和炸物上调脂肪。"
  },
  {
    brand: "华莱士",
    aliases: ["华莱士炸鸡汉堡", "wallace"],
    category: "western_fast_food",
    commonProducts: ["香辣鸡腿堡", "鸡肉卷", "炸鸡", "薯条"],
    searchTerms: ["菜单", "热量", "炸鸡汉堡", "套餐"],
    estimateHint: "搜不到营养表时按平价炸鸡汉堡行业平均估算。"
  },
  {
    brand: "德克士",
    aliases: ["dicos"],
    category: "western_fast_food",
    commonProducts: ["脆皮炸鸡", "鸡腿饭", "汉堡", "薯条"],
    searchTerms: ["官方菜单", "营养成分", "鸡腿饭", "炸鸡"],
    estimateHint: "鸡腿饭要按米饭和炸鸡/烤鸡拆分。"
  },
  {
    brand: "必胜客",
    aliases: ["pizza hut", "Pizza Hut"],
    category: "western_fast_food",
    commonProducts: ["披萨", "意面", "鸡翅", "沙拉"],
    searchTerms: ["官方菜单", "营养成分", "披萨", "意面"],
    estimateHint: "披萨按片数估算，芝士和肉类会显著增加脂肪。"
  },
  {
    brand: "达美乐",
    aliases: ["domino", "Domino's", "达美乐披萨"],
    category: "western_fast_food",
    commonProducts: ["披萨", "鸡翅", "芝士面包", "意面"],
    searchTerms: ["菜单", "披萨", "热量", "营养成分"],
    estimateHint: "披萨按尺寸和片数估算，默认一人 2-4 片。"
  },
  {
    brand: "赛百味",
    aliases: ["subway", "Subway"],
    category: "western_fast_food",
    commonProducts: ["6 寸三明治", "金枪鱼三明治", "火鸡胸三明治", "沙拉"],
    searchTerms: ["官方营养", "三明治", "热量", "菜单"],
    estimateHint: "酱料和芝士会明显改变脂肪，没写酱料时按常规酱估。"
  },
  {
    brand: "吉野家",
    aliases: ["yoshinoya", "牛肉饭"],
    category: "chinese_fast_food",
    commonProducts: ["牛肉饭", "双拼饭", "鸡肉饭", "味噌汤"],
    searchTerms: ["官方菜单", "牛肉饭", "营养成分", "热量"],
    estimateHint: "牛肉饭按米饭 250-320g 加牛肉浇头估算。"
  },
  {
    brand: "老乡鸡",
    aliases: ["老乡鸡快餐"],
    category: "chinese_fast_food",
    commonProducts: ["鸡汤", "鸡腿饭", "蒸蛋", "农家小炒肉", "米饭"],
    searchTerms: ["官方菜单", "营养成分", "中式快餐", "米饭"],
    estimateHint: "按中式快餐一荤一素一饭估算，汤类单独拆分。"
  },
  {
    brand: "乡村基",
    aliases: ["乡村基快餐", "csc"],
    category: "chinese_fast_food",
    commonProducts: ["双拼饭", "鸡腿饭", "小炒肉饭", "汤"],
    searchTerms: ["官方菜单", "营养成分", "中式快餐", "盖饭"],
    estimateHint: "按中式快餐盖饭或套餐估算，米饭默认 250-320g。"
  },
  {
    brand: "真功夫",
    aliases: ["真功夫快餐"],
    category: "chinese_fast_food",
    commonProducts: ["蒸饭", "排骨饭", "鸡腿饭", "蒸蛋", "汤"],
    searchTerms: ["官方菜单", "营养成分", "蒸饭", "套餐"],
    estimateHint: "蒸饭类脂肪相对可控，但酱汁和肉皮要计入。"
  },
  {
    brand: "永和大王",
    aliases: ["永和", "豆浆油条"],
    category: "chinese_fast_food",
    commonProducts: ["豆浆", "油条", "卤肉饭", "饭团", "面"],
    searchTerms: ["官方菜单", "营养成分", "豆浆", "油条", "卤肉饭"],
    estimateHint: "早餐要拆豆浆、油条、饭团；油条脂肪偏高。"
  },
  {
    brand: "南城香",
    aliases: ["南城香快餐"],
    category: "chinese_fast_food",
    commonProducts: ["早餐", "馄饨", "盖饭", "小碗菜", "羊肉串"],
    searchTerms: ["菜单", "热量", "小碗菜", "早餐", "盖饭"],
    estimateHint: "按北京快餐/早餐店份量估算，小碗菜多人分享时要按食用比例。"
  },
  {
    brand: "大米先生",
    aliases: ["大米先生快餐"],
    category: "chinese_fast_food",
    commonProducts: ["小碗菜", "米饭", "红烧肉", "青菜", "汤"],
    searchTerms: ["菜单", "小碗菜", "营养成分", "米饭"],
    estimateHint: "小碗菜要按单份菜和米饭拆分，默认米饭 200-300g。"
  },
  {
    brand: "小菜园",
    aliases: ["小菜园新徽菜", "小菜园徽菜"],
    category: "casual_dining",
    commonProducts: ["徽菜", "臭鳜鱼", "小炒肉", "米饭", "汤"],
    searchTerms: ["菜单", "徽菜", "热量", "营养成分"],
    estimateHint: "正餐点菜默认多人分享，用户没写份量时按个人实际食用比例估。"
  },
  {
    brand: "西贝",
    aliases: ["西贝莜面村"],
    category: "casual_dining",
    commonProducts: ["莜面", "羊肉串", "牛大骨", "黄米凉糕"],
    searchTerms: ["菜单", "莜面", "热量", "营养成分"],
    estimateHint: "西北菜面食和肉类较多，主食和肉类要拆分。"
  },
  {
    brand: "紫光园",
    aliases: ["紫光园清真", "紫光园快餐"],
    category: "casual_dining",
    commonProducts: ["小吃", "炒菜", "牛肉面", "烤鸭", "米饭"],
    searchTerms: ["菜单", "热量", "清真", "小吃"],
    estimateHint: "按清真中式正餐/快餐估算，点菜需按个人食用量。"
  },
  {
    brand: "和府捞面",
    aliases: ["和府", "和府面"],
    category: "noodles_rice",
    commonProducts: ["草本汤面", "牛肉面", "拌面", "小食"],
    searchTerms: ["官方菜单", "营养成分", "面", "热量"],
    estimateHint: "一碗面默认主食熟重 250-350g，浇头另算。"
  },
  {
    brand: "陈香贵",
    aliases: ["陈香贵兰州牛肉面"],
    category: "noodles_rice",
    commonProducts: ["兰州牛肉面", "牛肉", "小菜", "鸡蛋"],
    searchTerms: ["菜单", "牛肉面", "营养成分", "热量"],
    estimateHint: "按兰州牛肉面估算，面条碳水为主，牛肉提供蛋白。"
  },
  {
    brand: "马记永",
    aliases: ["马记永兰州牛肉面"],
    category: "noodles_rice",
    commonProducts: ["兰州牛肉面", "牛肉", "小菜", "卤蛋"],
    searchTerms: ["菜单", "牛肉面", "营养成分", "热量"],
    estimateHint: "按兰州牛肉面行业平均估算，面量大时碳水上调。"
  },
  {
    brand: "李先生",
    aliases: ["李先生牛肉面", "加州牛肉面"],
    category: "noodles_rice",
    commonProducts: ["牛肉面", "牛肉饭", "小菜", "卤蛋"],
    searchTerms: ["菜单", "牛肉面", "营养成分", "热量"],
    estimateHint: "面饭类按主食、牛肉、小菜拆分。"
  },
  {
    brand: "遇见小面",
    aliases: ["遇见小面重庆小面"],
    category: "noodles_rice",
    commonProducts: ["重庆小面", "豌杂面", "酸辣粉", "小食"],
    searchTerms: ["菜单", "重庆小面", "热量", "营养成分"],
    estimateHint: "小面油辣子会增加脂肪，豌杂面蛋白和脂肪都更高。"
  },
  {
    brand: "五爷拌面",
    aliases: ["五爷", "拌面"],
    category: "noodles_rice",
    commonProducts: ["拌面", "牛肉拌面", "鸡排", "小菜"],
    searchTerms: ["菜单", "拌面", "热量", "营养成分"],
    estimateHint: "拌面默认碳水较高，酱料和炸物另算。"
  },
  {
    brand: "魏家凉皮",
    aliases: ["魏家", "魏家凉皮肉夹馍", "魏家肉夹馍"],
    category: "noodles_rice",
    commonProducts: ["凉皮", "米皮", "肉夹馍", "擀面皮", "冰峰"],
    searchTerms: ["官网", "菜单", "公众号", "小程序", "凉皮", "肉夹馍", "热量"],
    estimateHint: "凉皮/米皮按一份 350-450g、碳水 70-100g 估；肉夹馍单独拆分。"
  },
  {
    brand: "阿香米线",
    aliases: ["阿香", "阿香米线过桥米线"],
    category: "noodles_rice",
    commonProducts: ["米线", "番茄米线", "麻辣米线", "肥牛米线"],
    searchTerms: ["菜单", "米线", "热量", "营养成分"],
    estimateHint: "米线默认主食熟重 250-350g，汤底和肥牛另算。"
  },
  {
    brand: "蒙自源",
    aliases: ["蒙自源过桥米线"],
    category: "noodles_rice",
    commonProducts: ["过桥米线", "番茄米线", "酸辣米线"],
    searchTerms: ["菜单", "过桥米线", "热量", "营养成分"],
    estimateHint: "米线按主食、肉片、汤底、小料拆分。"
  },
  {
    brand: "袁记云饺",
    aliases: ["袁记", "袁记饺子", "袁记水饺"],
    category: "noodles_rice",
    commonProducts: ["云饺", "水饺", "馄饨", "饺子"],
    searchTerms: ["菜单", "云饺", "水饺", "热量", "营养成分"],
    estimateHint: "按数量估算，普通饺子 20-25g/个，10-15 个是一人份。"
  },
  {
    brand: "喜家德",
    aliases: ["喜家德水饺", "喜家德虾仁水饺"],
    category: "noodles_rice",
    commonProducts: ["水饺", "虾仁水饺", "凉菜", "汤"],
    searchTerms: ["菜单", "水饺", "热量", "营养成分"],
    estimateHint: "水饺按个数和馅料估算，虾仁水饺蛋白略高。"
  },
  {
    brand: "吉祥馄饨",
    aliases: ["吉祥馄饨面"],
    category: "noodles_rice",
    commonProducts: ["馄饨", "大馄饨", "小馄饨", "面"],
    searchTerms: ["菜单", "馄饨", "热量", "营养成分"],
    estimateHint: "馄饨按大小和数量估算，汤底热量通常较低。"
  },
  {
    brand: "海底捞",
    aliases: ["海底捞火锅", "捞派"],
    category: "hotpot",
    commonProducts: ["番茄锅", "毛肚", "肥牛", "虾滑", "捞面"],
    searchTerms: ["官方菜单", "营养成分", "火锅", "菜品热量"],
    estimateHint: "火锅要按锅底、蘸料、肉类、主食和蔬菜拆分。"
  },
  {
    brand: "巴奴",
    aliases: ["巴奴毛肚火锅"],
    category: "hotpot",
    commonProducts: ["毛肚", "牛肉", "菌汤锅", "蔬菜"],
    searchTerms: ["菜单", "毛肚火锅", "热量", "营养成分"],
    estimateHint: "毛肚热量不高，油碟/麻酱/牛肉才是热量大头。"
  },
  {
    brand: "呷哺呷哺",
    aliases: ["呷哺", "xiabu"],
    category: "hotpot",
    commonProducts: ["单人锅", "肥牛", "蔬菜", "麻酱"],
    searchTerms: ["菜单", "单人火锅", "热量", "营养成分"],
    estimateHint: "单人火锅按套餐菜量估算，蘸料要单独计。"
  },
  {
    brand: "凑凑",
    aliases: ["凑凑火锅", "凑凑茶憩"],
    category: "hotpot",
    commonProducts: ["火锅", "肥牛", "虾滑", "奶茶"],
    searchTerms: ["菜单", "火锅", "热量", "营养成分"],
    estimateHint: "火锅和茶饮要拆开，茶饮按糖度估。"
  },
  {
    brand: "小龙坎",
    aliases: ["小龙坎火锅"],
    category: "hotpot",
    commonProducts: ["牛油锅", "毛肚", "肥牛", "酥肉"],
    searchTerms: ["菜单", "火锅", "热量", "营养成分"],
    estimateHint: "川渝牛油锅底和酥肉会显著提高脂肪。"
  },
  {
    brand: "朱光玉",
    aliases: ["朱光玉火锅馆"],
    category: "hotpot",
    commonProducts: ["火锅", "毛肚", "牛肉", "小吃"],
    searchTerms: ["菜单", "火锅", "热量", "营养成分"],
    estimateHint: "按川渝火锅估算，油碟和小吃另算。"
  },
  {
    brand: "杨国福麻辣烫",
    aliases: ["杨国福", "杨国福麻辣烫麻辣拌"],
    category: "malatang",
    commonProducts: ["麻辣烫", "麻辣拌", "宽粉", "丸子", "蔬菜"],
    searchTerms: ["官方菜单", "麻辣烫", "热量", "营养成分"],
    estimateHint: "按称重食材估算，有宽粉/丸子/麻酱时热量上调。"
  },
  {
    brand: "张亮麻辣烫",
    aliases: ["张亮", "张亮麻辣烫麻辣拌"],
    category: "malatang",
    commonProducts: ["麻辣烫", "麻辣拌", "宽粉", "豆制品", "蔬菜"],
    searchTerms: ["菜单", "麻辣烫", "热量", "营养成分"],
    estimateHint: "按一碗 350-550g 固体食材估算，主食类另加碳水。"
  },
  {
    brand: "觅姐麻辣烫",
    aliases: ["觅姐", "觅姐麻辣拌"],
    category: "malatang",
    commonProducts: ["麻辣烫", "麻辣拌", "冒菜", "宽粉"],
    searchTerms: ["菜单", "麻辣烫", "热量", "营养成分"],
    estimateHint: "按麻辣烫行业平均估算，称重份量越大热量越高。"
  },
  {
    brand: "蜜雪冰城",
    aliases: ["蜜雪", "mxbc"],
    category: "tea_coffee",
    commonProducts: ["冰鲜柠檬水", "雪王大圣代", "珍珠奶茶", "冰淇淋"],
    searchTerms: ["官方菜单", "热量", "营养成分", "奶茶", "冰淇淋"],
    estimateHint: "茶饮按杯型、糖度、奶盖、小料拆分。"
  },
  {
    brand: "瑞幸咖啡",
    aliases: ["瑞幸", "luckin"],
    category: "tea_coffee",
    commonProducts: ["拿铁", "生椰拿铁", "美式", "厚乳拿铁"],
    searchTerms: ["官方营养", "菜单", "咖啡", "热量"],
    estimateHint: "咖啡按奶、糖浆、奶油和杯型估算。"
  },
  {
    brand: "库迪咖啡",
    aliases: ["库迪", "cotti"],
    category: "tea_coffee",
    commonProducts: ["拿铁", "生椰拿铁", "美式", "燕麦拿铁"],
    searchTerms: ["菜单", "咖啡", "热量", "营养成分"],
    estimateHint: "咖啡按奶量和糖浆估算，没写糖度按正常糖。"
  },
  {
    brand: "星巴克",
    aliases: ["starbucks", "星爸爸"],
    category: "tea_coffee",
    commonProducts: ["拿铁", "星冰乐", "美式", "蛋糕", "三明治"],
    searchTerms: ["官方营养", "菜单", "咖啡", "热量"],
    estimateHint: "优先用官方营养；星冰乐和蛋糕糖脂较高。"
  },
  {
    brand: "幸运咖",
    aliases: ["幸运咖啡", "Lucky Cup"],
    category: "tea_coffee",
    commonProducts: ["拿铁", "美式", "柠檬茶", "冰淇淋"],
    searchTerms: ["菜单", "咖啡", "热量", "营养成分"],
    estimateHint: "按平价咖啡/茶饮估算，糖浆和奶油另计。"
  },
  {
    brand: "古茗",
    aliases: ["古茗茶饮"],
    category: "tea_coffee",
    commonProducts: ["云岭茉莉白", "水果茶", "奶茶", "芝士茶"],
    searchTerms: ["官方菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "奶茶按杯型、糖度、奶盖、小料拆分。"
  },
  {
    brand: "茶百道",
    aliases: ["茶百道茶饮", "ChaPanda"],
    category: "tea_coffee",
    commonProducts: ["豆乳玉麒麟", "杨枝甘露", "水果茶", "奶茶"],
    searchTerms: ["官方菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "水果茶糖分和小料要计入，奶茶按正常糖估。"
  },
  {
    brand: "霸王茶姬",
    aliases: ["茶姬", "伯牙绝弦", "CHAGEE"],
    category: "tea_coffee",
    commonProducts: ["伯牙绝弦", "桂馥兰香", "青青糯山", "奶茶"],
    searchTerms: ["官方菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "原叶鲜奶茶按奶量和糖度估算，没写糖度按标准糖。"
  },
  {
    brand: "沪上阿姨",
    aliases: ["沪上阿姨鲜果茶"],
    category: "tea_coffee",
    commonProducts: ["血糯米奶茶", "水果茶", "杨枝甘露", "奶茶"],
    searchTerms: ["官方菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "血糯米、芋泥、椰果等小料要单独增加碳水。"
  },
  {
    brand: "益禾堂",
    aliases: ["益禾堂奶茶"],
    category: "tea_coffee",
    commonProducts: ["烤奶", "奶茶", "柠檬茶", "水果茶"],
    searchTerms: ["菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "烤奶类糖脂较高，按正常糖估并提醒可微调。"
  },
  {
    brand: "甜啦啦",
    aliases: ["甜啦啦奶茶"],
    category: "tea_coffee",
    commonProducts: ["水果茶", "奶茶", "柠檬水", "冰淇淋"],
    searchTerms: ["菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "按平价茶饮估算，糖度和小料决定主要波动。"
  },
  {
    brand: "喜茶",
    aliases: ["HEYTEA", "heytea"],
    category: "tea_coffee",
    commonProducts: ["多肉葡萄", "芝芝莓莓", "轻乳茶", "果茶"],
    searchTerms: ["官方营养", "菜单", "奶茶", "热量"],
    estimateHint: "水果茶和芝士奶盖要拆分，没写糖度按标准糖。"
  },
  {
    brand: "奈雪",
    aliases: ["奈雪的茶", "nayuki"],
    category: "tea_coffee",
    commonProducts: ["霸气水果茶", "奶茶", "欧包", "蛋糕"],
    searchTerms: ["官方菜单", "奶茶", "欧包", "热量"],
    estimateHint: "茶饮和烘焙要拆开，欧包按重量估算。"
  },
  {
    brand: "书亦烧仙草",
    aliases: ["书亦", "烧仙草"],
    category: "tea_coffee",
    commonProducts: ["烧仙草", "奶茶", "芋圆", "珍珠"],
    searchTerms: ["菜单", "烧仙草", "热量", "营养成分"],
    estimateHint: "烧仙草小料较多，碳水按小料数量上调。"
  },
  {
    brand: "茶颜悦色",
    aliases: ["茶颜", "幽兰拿铁"],
    category: "tea_coffee",
    commonProducts: ["幽兰拿铁", "声声乌龙", "奶茶"],
    searchTerms: ["菜单", "奶茶", "热量", "营养成分"],
    estimateHint: "按原叶奶茶估算，奶油顶和坚果碎要单独计。"
  },
  {
    brand: "正新鸡排",
    aliases: ["正新", "正新鸡排炸串"],
    category: "snack_bakery",
    commonProducts: ["鸡排", "鸡柳", "烤肠", "炸串"],
    searchTerms: ["菜单", "鸡排", "热量", "营养成分"],
    estimateHint: "油炸小吃脂肪偏高，按份量和裹粉估算。"
  },
  {
    brand: "绝味鸭脖",
    aliases: ["绝味", "绝味卤味"],
    category: "snack_bakery",
    commonProducts: ["鸭脖", "鸭锁骨", "鸭翅", "藕片", "豆干"],
    searchTerms: ["菜单", "卤味", "热量", "营养成分"],
    estimateHint: "卤味按重量估算，鸭脖骨头多可食部分低。"
  },
  {
    brand: "周黑鸭",
    aliases: ["周黑鸭卤味"],
    category: "snack_bakery",
    commonProducts: ["鸭脖", "鸭翅", "鸭锁骨", "藕片", "豆干"],
    searchTerms: ["菜单", "卤味", "热量", "营养成分"],
    estimateHint: "甜辣卤味糖和钠偏高，按可食重量估算。"
  },
  {
    brand: "紫燕百味鸡",
    aliases: ["紫燕", "百味鸡"],
    category: "snack_bakery",
    commonProducts: ["夫妻肺片", "百味鸡", "凉菜", "卤味"],
    searchTerms: ["菜单", "卤味", "凉菜", "热量"],
    estimateHint: "凉拌卤味按重量估算，油拌菜脂肪上调。"
  },
  {
    brand: "夸父炸串",
    aliases: ["夸父", "炸串"],
    category: "snack_bakery",
    commonProducts: ["炸串", "鸡肉串", "里脊串", "蔬菜串"],
    searchTerms: ["菜单", "炸串", "热量", "营养成分"],
    estimateHint: "炸串按串数和食材估算，裹粉和油炸显著增加脂肪。"
  },
  {
    brand: "全家",
    aliases: ["全家便利店", "familymart", "FamilyMart"],
    category: "convenience",
    commonProducts: ["饭团", "便当", "关东煮", "三明治", "咖啡"],
    searchTerms: ["便利店", "便当", "饭团", "营养成分", "热量"],
    estimateHint: "便利店包装食品优先按包装营养表，否则按同品类估。"
  },
  {
    brand: "罗森",
    aliases: ["罗森便利店", "lawson", "Lawson"],
    category: "convenience",
    commonProducts: ["饭团", "便当", "关东煮", "甜品", "三明治"],
    searchTerms: ["便利店", "便当", "饭团", "营养成分", "热量"],
    estimateHint: "包装食品优先按营养表；甜品糖脂较高。"
  },
  {
    brand: "7-Eleven",
    aliases: ["711", "7eleven", "七十一便利店"],
    category: "convenience",
    commonProducts: ["饭团", "便当", "关东煮", "三明治", "咖啡"],
    searchTerms: ["便利店", "便当", "饭团", "营养成分", "热量"],
    estimateHint: "便利店食品按包装标识优先，没有则按行业平均估。"
  }
];

export function findFoodBrandMatches(description: string, limit = 3) {
  const text = normalizeBrandText(description);
  if (!text) return [];

  return foodBrandCatalog
    .map((entry, index) => ({ entry, index, score: scoreBrandMatch(entry, text) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.entry);
}

export function hasFoodBrandMatch(description: string) {
  return findFoodBrandMatches(description, 1).length > 0;
}

export function buildFoodBrandSearchQuery(description: string) {
  const matches = findFoodBrandMatches(description, 2);
  const brandContext = matches
    .map((entry) => `${entry.brand} ${entry.aliases.join(" ")} ${entry.commonProducts.join(" ")} ${entry.searchTerms.join(" ")}`)
    .join(" ");

  return [
    description,
    brandContext,
    "营养成分 热量 蛋白质 碳水 脂肪",
    "官方 官网 菜单 小程序 公众号 外卖 点单",
    "每100克 每份 kcal protein carbs fat"
  ].filter(Boolean).join(" ");
}

export function getBrandCatalogPrompt(description: string) {
  const matches = findFoodBrandMatches(description, 3);
  if (!matches.length) return "";

  const lines = matches.map((entry) => {
    return `- ${entry.brand}：品类=${entry.category}；别名=${entry.aliases.join("、") || "无"}；常见产品=${entry.commonProducts.join("、")}；估算提示=${entry.estimateHint}`;
  });

  return [
    "品牌库命中：",
    ...lines,
    "规则：用户文本命中品牌库时，brand 优先填品牌库品牌或用户原文品牌；如果公开搜索没有营养表，也要保留品牌名，并按该品牌品类与常见产品估算。"
  ].join("\n");
}

function scoreBrandMatch(entry: FoodBrandEntry, text: string) {
  const names = [entry.brand, ...entry.aliases].map(normalizeBrandText).filter(Boolean);
  let score = 0;

  for (const name of names) {
    if (name.length >= 2 && text.includes(name)) {
      score = Math.max(score, name.length + (name === normalizeBrandText(entry.brand) ? 4 : 2));
    }
  }

  if (!score) return 0;

  const productText = [...entry.commonProducts, ...entry.searchTerms].map(normalizeBrandText).join(" ");
  for (const token of splitBrandTokens(productText)) {
    if (token.length >= 2 && text.includes(token)) score += 1;
  }

  return score;
}

function splitBrandTokens(value: string) {
  return value.split(/[/／+＋、，,;；:：|｜\s]+/).filter(Boolean);
}

function normalizeBrandText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}
