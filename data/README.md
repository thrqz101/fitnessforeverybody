# 本地每100g食品库

JSON是运行主库，CSV从同一数据导出，含UTF-8 BOM，可用Excel打开。
当前共287条：235条单食品、52条配方食品（46道家常菜、6条粥/馒头/泡发参考配方）。不含品牌套餐。
每条都是该生熟/干湿状态的100g可食部，五项为蛋白质、碳水、脂肪、热量、膳食纤维，单位g/g/g/kcal/g。

## 文件

- `nutrition-100g.json`：完整主库，本地保存，不提交Git。
- `nutrition-100g.csv`：与JSON逐行、逐项数值一致的导出，本地保存。
- `nutrition-recipes.json`：明确的食材ID、食材克数、留存油量、成菜重量及假设，本地保存。
- `nutrition-100g.example.json`：提交Git的8条可追溯示例，完整库不存在时使用。
- `../scripts/nutrition/food-mappings.json`：人工确认的中文名称与USDA记录映射、待补清单。
- `../output/nutrition-audit.json`：本次数量、缺失项、歧义别名和未启用候选。
- `../output/nutrition-db-report.md`：交付说明及页面实测记录。

## 来源与口径

单食品数值来自[USDA FoodData Central官方数据包](https://fdc.nal.usda.gov/download-datasets/)，
包括SR Legacy 2018-04和Foundation Foods 2026-04-30。
[官方许可说明](https://fdc.nal.usda.gov/api-guide/)为CC0。
每条保留FDC ID、原始食品描述、数据集版本、营养字段ID/原始数值/单位和官方链接；主库保留下载包SHA-256。
中文名称和别名是本项目的映射，不代表USDA发布了同名中国菜品。

22条食品记录存在缺失膳食纤维指标，按需求填0，保留`missingNutrients`标记。
真实0不会标为缺失。菜品某项有食材缺失时，整项填0并标记，避免把不完整小计当完整结果。
碳水是来源提供的碳水口径，通常包括膳食纤维，不能重复加总。
保留来源热量，不强行用4/4/9覆盖官方值。

家常菜由项目参考配方计算：

`每100g成菜营养 = Σ(食材每100g营养 × 可食克数 / 100) × 保留系数 / 成菜可食克数 × 100`

这批配方的成菜重量、宏量营养保留系数1和成菜留存油量是明确记录的假设，**不是实测菜品值**。
油、糖、酱料均计入。未把整锅炸油计入成菜。实际做法会改变结果。
中国韭菜、空心菜、腐竹、排骨、特定鱼种等未取得适用来源的候选保留待补，不用近似物种冒充。

## 路由接入

`/api/food-ai`保留品牌优先：品牌命中先联网；无品牌时匹配食品库。
明确输入“米饭150g”“熟鸡胸肉100g”“番茄炒蛋200g”会强匹配并程序换算。
多项完整命中直接返回；部分命中只分析剩余输入。泛称、生熟歧义、毫升、复杂剩余/分食描述不会盲选记录。
既有无克数标准份模板保留原有行为；需要明确重量时继续食物营养分析。
不得把用户省略的重量默认成100g。
`lib/nutrition-db.ts`校验v2结构并按文件时间/大小缓存索引；模糊结果只作候选建议。

**用户界面只在联网搜索成功且解析出食物后显示实际网页来源。**
本地/模型渠道字段仅为内部诊断，不显示本地数据库名称或LLM来源。
本次不改写历史饮食记录；完整旧库和旧加载器/工具备份于`../output/nutrition-backup/20261013-111236/`。

## 重建与验证

Vercel 使用 `vercel.json` 中的构建命令先运行 `scripts/nutrition/prepare.py`：下载公开 USDA 数据包并核对固定 SHA-256，再重建完整库并核对本次已审核库的 SHA-256。完整 JSON/CSV/配方仍不进入 Git；Next.js 文件追踪配置将生成的 JSON 带入两个营养 API 的运行包。修改配方或映射后，需要同步审核并更新 `prepare.py` 的预期库校验值。

将以下官方包保存至`../output/nutrition-sources/`（不需要API key）：

- [sr-legacy-2018.zip](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip)
- [foundation-2026.zip](https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2026-04-30.zip)

在项目根目录依次运行：

```sh
python3 scripts/nutrition/curate.py
python3 scripts/nutrition/recipes.py
python3 scripts/nutrition/build.py
python3 scripts/nutrition/build.py --check
op run --env-file=.env -- node --test tests/*.test.mjs
op run --env-file=.env -- npm run typecheck
```

生成器检查单位、唯一ID、数值边界、缺失标记、每100g口径和CSV/JSON数值往返。
`--check`从官方CSV重新计算并比对全部导出，不改文件。只编辑CSV不会改变运行库；应修改映射/配方后重建。

## Brand recognition catalog

`food-brands.json` is a separate, committed brand-name catalog, not a nutrition database. `brands` contains 164 active records (63 baseline + 101 verified additions); `pendingBrands` contains 22 excluded candidates. `lib/brand-catalog.ts` reads only `brands`.

Each active record has an ID, canonical name, aliases, category, context-sensitive names, scope, market metadata, provenance, and origin. Newly added records require `sourceStatus=verified`, a source URL and verification date. A `legacy` baseline record has not been reverified. Market metadata is not a complete list of store locations and must not substitute one country's nutrition values for another's. This release has 229 distinct aliases after normalization.

Sources are brand/group websites and exchange disclosures; `verifiedAt` records review date, not the original publication date or an ongoing operating-status guarantee. No menu nutrition values or secrets are stored here. Candidate brands with insufficient provenance remain pending. `tests/brand-catalog.test.mjs` checks schema assumptions, names and aliases, collisions, exclusions, and ambiguity handling.

`officialWebsite` is optional and only populated for reviewed brand homepages. A verified group brand-directory URL is an official page, not automatically the brand homepage. Search references are classified using reviewed brand/group domains with exact hostname or subdomain matching; a lookalike suffix is not official. None of these links are displayed merely because a brand name matched: the API must have completed a successful search and food extraction first.
