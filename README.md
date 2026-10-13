# Fitness for Everybody

面向中国用户的 **AI Agent 驱动的智能饮食管理 Web 应用**。用户只需用一句自然语言描述“今天吃了什么”，内置的营养 Agent 就会把它拆解成可记录的食品条目，估算每项的营养素（蛋白质 / 碳水 / 脂肪 / 热量 / 膳食纤维），并把每日总量与基于身体信息、训练计划、饮食方法计算的**个性化目标**进行对比，给出下一顿的推荐和可执行的营养建议。

核心目标：让用户不称重、不查表，也能低成本地知道自己有没有吃够 / 吃多，以及今天的营养结构是否匹配自己的计划。

---

## 核心能力

- **自然语言食物识别**：任意描述 → 拆成多个食品项 → 逐项估算 → 按份量汇总。
- **AI Agent 三层工具链**：本地食品库 / 联网检索（品牌、门店、包装食品）/ LLM 估算三个工具统一交给 agent 自主选择调用，可解释、可溯源。
- **Function-calling 营养 agent**：模型通过 tool calling 自主决定调用「本地库 / Exa 联网 / LLM 估算」中的哪个，并把调用痕迹（`provenance`）与数据库信息（`dbMeta`）返回给前端。
- **个性化每日目标**：按 BMR、目标、训练结构、饮食结构、训练日 / 饮食状态动态计算宏量目标。
- **食物级即时建议**：每条识别结果带 `warning` 行动建议（去皮少油、换无糖饮料、部分主食换杂粮等），帮用户越用越懂营养。
- **双语（中 / 英）**。

---

## 架构设计

- **Next.js App Router + Server Components**：`app/api` 作为 HTTP 边界，`lib` 承载领域逻辑、agent、工具、换算与 i18n，`components` 只做 UI，`data` 存放数据与本地库。
- **服务端隔离**：LLM 客户端、工具、本地库加载仅被 API 路由（`runtime = "nodejs"`）引用，`node:fs` 等 Node 能力不会进入客户端包。
- **后端**：一个独立的 EdgeSpark 后端模块（Cloudflare D1 + Drizzle + auth），位于 `server/`，单独维护，不进入 Next 构建。
- **类型集中**：`lib/types.ts` 统一 `MacroTotals`、`FoodLogItem`、`UserProfile`、`Recommendation` 等，跨层复用。

---

## 项目结构

```text
fitnessforeverybody/
├─ app/
│  ├─ layout.tsx              # 根布局：i18n Provider、双语
│  ├─ page.tsx                # 主页面：渲染 <FitnessApp/>
│  ├─ globals.css             # 全局样式 + 中英双语主题变量
│  └─ api/
│     ├─ food-ai/route.ts         # 食物识别管线：本地匹配 / Tavily 搜索 / LLM 估算
│     ├─ recommend-ai/route.ts    # 推荐：goal/day 筛选 + LLM 排序
│     └─ nutrition-agent/route.ts # function-calling 营养 agent
├─ components/                # UI 组件（Dashboard、FoodCapture、Recommendations 等）
├─ lib/
│  ├─ agent/                  # function-calling agent
│  │  ├─ llm.ts               # 提供方抽象 + chat/tools 客户端（OpenAI/Anthropic 兼容）
│  │  ├─ tools.ts             # 工具注册表 + 分发执行器
│  │  └─ run-agent.ts         # 循环：LLM 决策 → 执行工具 → 回填 → 收敛
│  ├─ tools/                  # 三个 agent 工具
│  │  ├─ food-nutrition.ts    # query_local_food_db（本地每100g库）
│  │  ├─ web-search.ts        # exa_web_search（Exa 联网）
│  │  └─ llm-estimate.ts      # ask_llm_estimate（LLM 估算）
│  ├─ nutrition-db.ts         # 本地库加载 + 模糊匹配 + 克数换算
│  ├─ food-catalog.ts         # 整份套餐知识库（召回 / 推荐）
│  ├─ brand-catalog.ts        # 品牌 / 门店匹配 + 搜索词构造
│  ├─ sample-data.ts          # 前端示例种子数据
│  ├─ nutrition.ts            # BMR / 目标 / 宏量换算 / 推荐排序
│  ├─ types.ts                # 领域共享类型
│  └─ i18n*.ts                # 中英双语 + 生成文案
├─ data/
│  ├─ nutrition-100g.example.json  # 已提交的示例库（8 条）
│  ├─ nutrition-100g.json          # 本地全量库（gitignore，不进 GitHub，287 条）
│  └─ README.md                    # 本地库策略说明
└─ server/                         # EdgeSpark 后端（D1 + auth + 用户录入）
```

---

## 入口文件

| 入口 | 作用 |
| --- | --- |
| `app/layout.tsx` | 根布局，挂载语言 Provider |
| `app/page.tsx` | 渲染主应用 `FitnessApp` |
| `app/api/food-ai/route.ts` | `POST` 食物识别（文本），`GET` 健康探测 |
| `app/api/recommend-ai/route.ts` | `POST` 饮食推荐 |
| `app/api/nutrition-agent/route.ts` | `POST` function-calling 营养 agent |
| `components/FitnessApp.tsx` | 页面组装（Onboarding → Dashboard / FoodCapture / Recommendations / Calendar） |

模块边界约定：`app/api` 只做 HTTP 边界；业务与领域逻辑放 `lib`；agent / 工具 / 本地库只被 API 路由引用，不进入客户端包。

---

## 核心 Workflow

### 1. 设置与目标
Onboarding 收集身高、体重、性别、年龄、BMR、目标、训练结构、饮食结构、体脂率。`lib/nutrition.ts` 据此计算当日宏量目标，并随训练日 / 饮食状态（高碳、低碳、高蛋白、放纵日等）动态调整。

### 2. 食物记录 → 营养估算
`FoodCapture` 把文字描述 POST 到 `/api/food-ai`：
- 路由 LLM 先分类：`local_exact`（本地组合完整覆盖）/ `brand_search`（品牌 + 产品 → 联网）/ `ai_estimate`（自然语言 → LLM）/ `not_food`。
- `local_exact` 命中时用 `lib/food-catalog.ts` 整份套餐数值；品牌命中用 Tavily 搜官方营养来源；都不能确定时用 LLM 按中国餐饮常见份量估算。
- 服务端做严格本地候选复核与合并，避免重复或漏算。
- 返回多个食品条目，用户可微调品牌 / 份量 / 营养素，作为草稿，保存到日历成为正式记录。

### 3. 推荐
`Recommendations` 从 `lib/food-catalog.ts` 按场景与 goal 过滤，再由 `/api/recommend-ai` 结合训练日、饮食状态、目标排序与调整。

### 4. AI Agent 营养助手（`/api/nutrition-agent`）
这是本产品的 **AI Agent 核心**。模型依据用户输入，通过 tool calling 自主选择调用哪个工具，每次调用都回填结果并继续推理，直到给出最终回答：
- `query_local_food_db` → 查本地「每 100g → 营养素」库。
- `exa_web_search` → 联网检索品牌 / 门店 / 包装食品的官方营养来源。
- `ask_llm_estimate` → 用 LLM 估算罕见菜、自制菜、组合餐等场景。

`run-agent.ts` 循环最多 5 轮：发 `tools` 定义 → 若返回 `tool_calls` 就执行并把结果回填为 `role:"tool"` 消息 → 直到模型给出最终回答。返回值带 `provenance`（`local_db` / `exa_search` / `llm_estimate`）与 `dbMeta`（版本 / 条目数），这些字段仅用于内部诊断；用户界面只在联网检索且食品解析成功后显示实际网页来源。

---

## 关键技术实现

### 本地「每 100g」营养库 + 可溯源
- 全量库 `data/nutrition-100g.json`（287 条：235 条单食品、52 条参考配方）**只存本地**，已在 `.gitignore` 忽略；仓库只提交示例 `nutrition-100g.example.json`，开箱可跑。
- `lib/nutrition-db.ts` 运行时先读磁盘全量库，缺失则回退示例库。
- 每个工具结果带 `source`，agent 汇总进 `provenance` 与 `dbMeta`，可证明“agent 查过本地库”，但数据文件不进 GitHub。
- 匹配采用 CJK 友好算法：归一化 + exact / alias / 字符重叠评分（中文无空格，按字符重叠）。

### EdgeSpark 后端模块（登录 / 本地库 / 用户录入）
- 独立的 EdgeSpark 后端（Cloudflare D1 + Drizzle + Hono + auth）在 `server/`，与 Next 应用分开维护：
  - `server/src/defs/db_schema.ts`：`users` / `foods` / `user_entries` 三张表；`foods` 存每 100g 营养素并带 `embedding` 向量列。
  - `server/src/routes/api.ts`（Hono）：`/api/auth/me`（当前用户）、`/api/foods`（本地库检索）、`/api/entries`（用户录入写进 `user_entries`）、联表查询。
  - `server/src/lib/search.ts`：D1 关键词检索第一层 + `embedding` 向量余弦召回（混合检索）。
- `server/` 是独立 package（`server/package.json`），需在目录内安装依赖后运行；`tsconfig` 已排除，不影响 Next 构建。

### 提供方抽象 + function calling
- `lib/agent/llm.ts` 统一 provider（`ccswitch` / `deepseek` / `minimax` / `dashscope`）由环境变量驱动，兼容 OpenAI 与 Anthropic 请求格式。
- `buildChatCompletionBody` 支持 `tools` / `tool_choice`；`requestChatCompletion` 处理多 endpoint 回退与超时；能解析 OpenAI `tool_calls` 与 Anthropic `tool_use`。
- 工具以 JSON Schema 注册在 `lib/agent/tools.ts`，`executeTool` 按名分发到 `lib/tools/*`。

### 主食物识别管线
- `lib/food-catalog.ts`（整份套餐库）+ `lib/brand-catalog.ts`（品牌 / 门店匹配）+ Tavily 搜索 + LLM，构成 agent 可自主调用的「本地库 / 联网 / LLM」多工具链路。
- 严格本地匹配（`strictLocalMatches`）与 AI 结果合并、去重，并对热量做一致性校验（`calories ≈ P*4 + C*4 + F*9`）。

### 双语
`lib/i18n.tsx` + `lib/translations.ts` + 生成的 `translations-generated.json`，中英互译，页面文案按 `lang` 切换。

---

## 技术栈

- **前端 / 服务端**：Next.js 14（App Router）、React 18、TypeScript（strict）、Tailwind CSS
- **AI**：OpenAI / Anthropic 兼容的 chat 客户端，支持 function calling；内置 Exa / Tavily 联网检索
- **后端**：EdgeSpark（Cloudflare D1 + Drizzle + Hono + auth）
- **部署**：Vercel-ready；EdgeSpark 后端独立部署

---

## 快速开始

```bash
npm install
npm run dev        # 本地开发（前端）
npm run typecheck  # 类型检查
npm run build      # 生产构建
```

## 环境变量

在 `.env.local`（或 Vercel Project Environment Variables）配置，**不要写进 git**：

```bash
AI_PROVIDER=ccswitch        # ccswitch | deepseek | minimax | dashscope
CCSWITCH_API_KEY=...
MINIMAX_API_KEY=...
DEEPSEEK_API_KEY=...
TAVILY_API_KEY=...
EXA_API_KEY=...             # /api/nutrition-agent 的 exa_web_search
```

完整变量名见 `.env.example`。

## 食物路由与耗时诊断

当前 `/api/food-ai` 默认 `FOOD_ROUTER=rules`：先匹配本地品牌名，有品牌及具体食品就联网；没有品牌时查页面现有的套餐库与单食品规则，完整匹配直接返回，部分匹配由 LLM 补全，未匹配直接估算。单独品牌名提示补充食品。目录外品牌可能进入估算；不保证品牌词典覆盖所有门店。

品牌目录现有 164 条（中国优先 110 条、国际连锁 54 条），通用食品别名（牛肉饭、炸串等）已清理，英文别名增加词边界，“全家”等歧义名称需要上下文。本批没有爬取网站或引入缓存。品牌输入、半份、多份和明确克数不会被固定套餐营养覆盖；每 100g 库现已同时接入页面 `/api/food-ai` 与独立 Agent：无品牌且食物/克数完整命中时直接换算，部分命中只分析剩余食物；不明确生熟或份量时继续分析。

搜索使用聚焦的原始描述及营养关键词，保留份量和排除条件；最多返回 3 条资料，每条 1 个片段。`FOOD_SEARCH_DEPTH=basic` 是本机实测可用配置；虽然官方文档提供 `fast`，本次实际请求返回 `search_depth` 参数错误，因此不作为默认。搜索失败或整理失败会进入估算，`routing.fallbackReason` 标明原因。品牌来自词典并不证明营养数值精确，估算结果保留 `industry-average` 标记。

规则模式下模型仅输出当前语言必需字段，现有标准化逻辑补齐镜像字段；未覆盖的动态文案翻译仍可能有限。前端响应格式兼容原流程。`diagnostics.timingsMs` 包含 brandMatch、localLookup、routing、search、searchLlm、estimateLlm、repairLlm、normalize、total，单位毫秒；同时返回逻辑 `llmCalls`（不含底层 endpoint 重试次数）、搜索模式、资料条数、状态和可用时的服务侧耗时。`Server-Timing` 响应头提供同样分段值。总耗时包含其他处理，不应要求各阶段之和完全相等。

本地 `.env` 只保存非敏感开关和 1Password 引用：

```dotenv
FOOD_ROUTER=rules
FOOD_SEARCH_DEPTH=basic
TYPESAFE_MODEL=jev-latest
TYPESAFE_API_KEY="op://<vault>/<item>/<field>"
```

可切回 `FOOD_ROUTER=jev`（Jev 选路，低于 0.8 置信度、2 秒超时或异常时回退原 LLM）或 `FOOD_ROUTER=llm`，修改后重启。独立 `/api/nutrition-agent` 不受影响。代码只读取环境变量，不添加 dotenv 加载器；启动、测试一律通过 `op run --env-file=.env -- <cmd>`。

离线验证：`op run --env-file=.env -- node --test tests/jev-router.test.mjs`、`op run --env-file=.env -- npm run typecheck`。页面测试只生成待确认记录，不计入日历。比较端到端耗时需使用相同输入并重复采样，搜索缓存和网络波动可能影响结果。

如果机器上有多个 1Password 账户，用 `OP_ACCOUNT` 环境变量选择存放这些条目的账户。当前终端还继承了另一个账户的 `GITHUB_PACKAGES_TOKEN_OP_REF`；`op run` 会解析继承的引用，因此本项目命令可使用以下形式，仅在子进程移除无关引用：

```bash
env -u GITHUB_PACKAGES_TOKEN_OP_REF op run --env-file=.env -- npm run dev
```

无需 GitHub 包认证的测试命令同样适用；不要在安装私有包的命令中移除它。

## 品牌数据库与设置页同步

`data/food-brands.json` 是独立品牌名称库：164 个启用品牌、229 个可靠别名，其中 101 个为本次新增，均记录官方品牌/集团或交易所来源及核验日期。原有 63 条保留兼容，`origin=baseline`；未重新核验的旧条目使用 `sourceStatus=legacy`，不冒充已核验。另有 22 个 `pendingBrands` 未取得足够可靠来源，不参与匹配。该库不包含营养数值，不宣称列出的品牌全部在中国经营。

新增来源参考百胜中国、九毛九、RBI、Inspire、Jollibee 官方品牌目录，以及各品牌官网。数据字段保留中英文名称、歧义名称、来源、官方域名、总部市场与已核验市场；未知信息留空。总部市场不是菜单营养适用地区。匹配支持重音、全角、弯引号、空格和连字符，较长完整名称优先；“一点点盐”“全家一起吃饭”“subway train”等不会仅凭通用词触发品牌搜索。

首次设置的营养素确认弹窗现在显示当前蛋白质、碳水和脂肪折算的热量，而不是独立的系统预算。热量按页面取整后的克数计算（P×4 + C×4 + F×9）；调整倍数后，弹窗、保存摘要和 `calculateTargets` 使用同一结果。系统预算保留为参考。膳食纤维单独设置，不重复折算热量。已有自定义倍数的资料也会按该规则重新计算热量，无需改写存储结构。

回归验证：`op run --env-file=.env -- node --test tests/*.test.mjs`。页面样本中蛋白倍数 2.04→0.80 时，热量 2221→1881 kcal，保存、刷新后仍一致。品牌抽样为太二酸菜鱼、一点点和 Chipotle，均命中品牌并完成搜索输出。

回滚时保留本批之前的修改，仅撤销设置页、热量计算及其新增翻译；品牌扩充可移除 `origin=expansion-2026-10-13` 的记录，保留原有条目。移除时同时更新对应完整性测试的数量断言。没有部署、Git 写操作或定时采集任务。

## 实时识别进度与联网来源

页面使用同一 `/api/food-ai` POST，通过 `Accept: application/x-ndjson` 接收流式进度。后端只报告实际发生的输入检查、品牌匹配、本地检索、路由、搜索、整理、估算和格式修复步骤，不发送模型内部推理。事件为 `{type:"progress",step:{id,status,labelZh,labelEn}}`，最后只有一个 `{type:"result",status,result}`。错误的逻辑状态码保留在终态事件中；未请求流式响应的调用方仍收到原 JSON 和 HTTP 状态码。

共享客户端处理分块 UTF-8、半条 JSON、断流、超时及取消；未收到终态不能视为成功。页面离开时中止请求，旧请求不能更新新请求的步骤。步骤区域自动滚动到最新一项，完成后折叠，支持展开查看及减少动态效果的系统设置。进度记录不写入本地存储。

只有真实搜索取得资料且成功整理出食品，才由服务端生成 `FoodLogItem.searchEvidence`。本地命中、直接估算、仅识别品牌、搜索失败及搜索整理失败后回退估算均不附来源。来源 URL 来自真实搜索结果；官网/官方页面来自已核验品牌记录，不接受模型生成的链接。仅接受不带凭据的 HTTP(S) 链接，官方来源按完整域名及其子域判断，普通页面标为公开参考。

来源区位于食品结果下方，按查询 ID 合并同一批食品的重复资料，并展示品牌、已核验的官网或官方页面及最多三条实际搜索来源。保存到日历后来源随该食品记录保留，刷新后仍可查看。搜索成功不代表存在匹配的官方营养表，结果仍会注明可能包含估算。

相关实现：`components/RecognitionProgress.tsx`、`components/RecognitionSources.tsx`、`lib/recognition-client.ts`、`lib/recognition-events.ts`、`lib/search-evidence.ts` 和 `lib/agent/search-evidence.ts`。模拟测试覆盖流中断、错误状态、取消、链接校验及来源显示边界；页面验证真实联网、本地及估算路径，另用模拟响应检查搜索失败的显示。回滚仅撤销本批流式/来源改动，保留此前品牌库和热量同步修复。
