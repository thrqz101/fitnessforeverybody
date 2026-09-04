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
- **后端**：EdgeSpark（Cloudflare D1 + Drizzle + 内置 auth）负责用户登录、本地库与用户录入的持久化，脚手架在 `server/`。
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
│  │  └─ llm-fallback.ts      # ask_llm_fallback（LLM 估算）
│  ├─ nutrition-db.ts         # 本地库加载 + 模糊匹配 + 克数换算
│  ├─ food-catalog.ts         # 整份套餐知识库（召回 / 推荐）
│  ├─ brand-catalog.ts        # 品牌 / 门店匹配 + 搜索词构造
│  ├─ sample-data.ts          # 前端示例种子数据
│  ├─ nutrition.ts            # BMR / 目标 / 宏量换算 / 推荐排序
│  ├─ types.ts                # 领域共享类型
│  └─ i18n*.ts                # 中英双语 + 生成文案
├─ data/
│  ├─ nutrition-100g.example.json  # 已提交的示例库（8 条）
│  ├─ nutrition-100g.json          # 本地全量库（gitignore，不进 GitHub，500+ 条）
│  └─ README.md                    # 本地库策略说明
└─ server/                         # EdgeSpark 后端（D1 + auth + 用户录入）
```

---

## 入口文件

| 入口 | 作用 |
| --- | --- |
| `app/layout.tsx` | 根布局，挂载语言 Provider |
| `app/page.tsx` | 渲染主应用 `FitnessApp` |
| `app/api/food-ai/route.ts` | `POST` 食物识别（文本 / 图片），`GET` 健康探测 |
| `app/api/recommend-ai/route.ts` | `POST` 饮食推荐 |
| `app/api/nutrition-agent/route.ts` | `POST` function-calling 营养 agent |
| `components/FitnessApp.tsx` | 页面组装（Onboarding → Dashboard / FoodCapture / Recommendations / Calendar） |

模块边界约定：`app/api` 只做 HTTP 边界；业务与领域逻辑放 `lib`；agent / 工具 / 本地库只被 API 路由引用，不进入客户端包。

---

## 核心 Workflow

### 1. 设置与目标
Onboarding 收集身高、体重、性别、年龄、BMR、目标、训练结构、饮食结构、体脂率。`lib/nutrition.ts` 据此计算当日宏量目标，并随训练日 / 饮食状态（高碳、低碳、高蛋白、放纵日等）动态调整。

### 2. 食物记录 → 营养估算
`FoodCapture` 把文字描述（或图片）POST 到 `/api/food-ai`：
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
- `ask_llm_fallback` → 用 LLM 估算罕见菜、自制菜、组合餐等场景。

`run-agent.ts` 循环最多 5 轮：发 `tools` 定义 → 若返回 `tool_calls` 就执行并把结果回填为 `role:"tool"` 消息 → 直到模型给出最终回答。返回值带 `provenance`（`local_db` / `exa_search` / `llm_fallback`）与 `dbMeta`（版本 / 条目数），前端据此显示“已查询本地食品库（共 N 条）”。

---

## 关键技术实现

### 本地「每 100g」营养库 + 可溯源
- 全量库 `data/nutrition-100g.json`（500+ 条）**只存本地**，已在 `.gitignore` 忽略；仓库只提交示例 `nutrition-100g.example.json`，开箱可跑。
- `lib/nutrition-db.ts` 运行时先读磁盘全量库，缺失则回退示例库。
- 每个工具结果带 `source`，agent 汇总进 `provenance` 与 `dbMeta`，可证明“agent 查过本地库”，但数据文件不进 GitHub。
- 匹配采用 CJK 友好算法：归一化 + exact / alias / 字符重叠评分（中文无空格，按字符重叠）。

### EdgeSpark 后端（登录 / 本地库 / 用户录入）
- 后端基于 EdgeSpark（Cloudflare D1 + Drizzle + 内置 auth），脚手架在 `server/`：
  - `server/src/defs/db_schema.ts`：`users` / `foods` / `user_entries` 三张表；`foods` 存每 100g 营养素并带 `embedding` 向量列。
  - `server/src/routes/api.ts`（Hono）：`/api/auth/me`（登录态）、`/api/foods`（本地库检索）、`/api/entries`（用户录入写进 `user_entries`，用 `auth.user.id` 归属用户）、联表查询。
  - `server/src/lib/search.ts`：D1 关键词检索第一层 + `embedding` 向量余弦召回（混合检索）。
- 前端提供快速的本地体验；用户与每日记录的持久化由该 EdgeSpark 后端承载；`server/` 独立于 Next 应用（`tsconfig` 已排除，不影响 Next 构建）。

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
