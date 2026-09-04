# Fitness for Everybody

面向中国用户的健身饮食 MVP（Next.js 14 / React / TypeScript）。用户用文字描述“今天吃了什么”，系统估算蛋白质 / 碳水 / 脂肪 / 热量 / 膳食纤维，并与 BMR 目标对比，给出更合适的饮食推荐和训练日建议。产品方向：不是让本地食物库硬套所有输入，而是让 AI 优先解析自然语言，本地库作为可靠兜底，并在需要时联网搜索（Exa）或交给 LLM 估算。

---

## 项目结构

```text
fitnessforeverybody/
├─ app/
│  ├─ layout.tsx              # 根布局：i18n Provider、双语
│  ├─ page.tsx                # 主页面：渲染 <FitnessApp/>
│  ├─ globals.css             # 全局样式 + 中英双语主题变量
│  └─ api/
│     ├─ food-ai/route.ts     # 食物识别管线：本地匹配 / Tavily 搜索 / LLM 估算
│     ├─ recommend-ai/route.ts# 推荐：goal/day 筛选 + LLM 排序
│     └─ nutrition-agent/route.ts # 新增：function-calling 营养 agent
├─ components/                # UI 组件（Dashboard、FoodCapture、Recommendations 等）
├─ lib/
│  ├─ agent/                  # function-calling agent
│  │  ├─ llm.ts               # 提供方抽象 + chat/tools 客户端（OpenAI/Anthropic 兼容）
│  │  ├─ tools.ts             # 工具注册表 + 分发执行器
│  │  └─ run-agent.ts         # 循环：LLM 决策 → 执行工具 → 回填 → 收敛
│  ├─ tools/                  # 三个 agent 工具
│  │  ├─ food-nutrition.ts    # query_local_food_db（本地每100g库）
│  │  ├─ web-search.ts        # exa_web_search（Exa 联网）
│  │  └─ llm-fallback.ts      # ask_llm_fallback（提示工程 LLM 估算）
│  ├─ nutrition-db.ts         # 本地库加载 + 模糊匹配 + 克数换算
│  ├─ food-catalog.ts         # 本地“整份套餐”知识库（召回/推荐）
│  ├─ brand-catalog.ts        # 品牌/门店匹配 + 搜索词构造
│  ├─ mock-data.ts            # 兜底样例食物
│  ├─ nutrition.ts            # BMR / 目标 / 宏量换算 / 推荐排序
│  ├─ types.ts                # 领域共享类型
│  └─ i18n*.ts                # 中英双语 + 生成文案
└─ data/
   ├─ nutrition-100g.example.json  # 已提交的示例库（8 条）
   ├─ nutrition-100g.json          # 本地全量库（gitignore，不进 GitHub，39 条）
   └─ README.md                    # 本地库策略说明
└─ server/                         # EdgeSpark 后端（D1 + auth + 用户录入）
```

---

## 入口文件

| 入口 | 作用 |
| --- | --- |
| `app/layout.tsx` | 根布局，挂载语言 Provider |
| `app/page.tsx` | 渲染主应用 `FitnessApp` |
| `app/api/food-ai/route.ts` | `POST` 食物识别（文本/图片），`GET` 健康探测 |
| `app/api/recommend-ai/route.ts` | `POST` 饮食推荐 |
| `app/api/nutrition-agent/route.ts` | `POST` function-calling 营养 agent |
| `components/FitnessApp.tsx` | 页面组装（Onboarding → Dashboard/FoodCapture/Recommendations/Calendar） |

模块边界约定：`app/api` 只做 HTTP 边界；业务/领域逻辑放 `lib`；工具与 agent 只被 API 路由（nodejs runtime）引用，不进入客户端包。

---

## 核心 Workflow

### 1. 设置与目标
Onboarding 收集身高、体重、性别、年龄、BMR、目标、训练结构、饮食结构、体脂率。`lib/nutrition.ts` 据此计算当日宏量目标（可随训练日/饮食状态调整：高碳、低碳、高蛋白、放纵日等）。

### 2. 食物记录 → 营养估算
`FoodCapture` 把文字描述（或图片）POST 到 `/api/food-ai`：
- 路由 LLM 先分类：`local_exact`（本地组合完整覆盖）/ `brand_search`（品牌+产品 → 联网）/ `ai_estimate`（自然语言 → LLM）/ `not_food`。
- `local_exact` 命中时用 `lib/food-catalog.ts` 整份套餐数值；品牌命中用 Tavily 搜官方营养来源；都不能确定时，`ai_estimate` 用提示工程 LLM 按中国餐饮常见份量估算。
- 服务端还做「严格本地候选」复核与合并，避免 AI 重复或漏算。
- 返回多个食品条目，用户可手动微调品牌/份量/营养素，作为草稿，保存到日历成为正式记录。

### 3. 推荐
`Recommendations` 从 `lib/food-catalog.ts` 按场景（早餐/午晚餐/夜宵/轻补等）与 goal 过滤，再由 `/api/recommend-ai` 结合训练日、饮食状态、目标做排序与调整。

### 4. 新增：function-calling 营养 agent（`/api/nutrition-agent`）
一个 LLM 通过 tool calling 自主决定调用哪个工具：
1. `query_local_food_db` → 查本地「每100g→营养素」库（优先，数值可靠）。
2. `exa_web_search` → 本地库没有，或用户点名品牌/门店/包装食品时联网搜索。
3. `ask_llm_fallback` → 前两者都不足（罕见菜、自制菜、组合餐）时用提示工程 LLM 估算。

`run-agent.ts` 循环最多 5 轮：发 `tools` 定义 → 若返回 `tool_calls` 就执行并把结果回填为 `role:"tool"` 消息 → 直到模型给出最终回答。返回值带 `provenance`（用过的 `source`：`local_db`/`exa_search`/`llm_fallback`）和 `dbMeta`（版本/条目数），便于前端显示“已查询本地食品库（共 N 条）”。

---

## 关键技术实现

### 本地「每100g」营养库 + “不开放但可追踪”
- 全量库 `data/nutrition-100g.json`（39 条）**只存本地**，已在 `.gitignore` 忽略；仓库只提交示例 `nutrition-100g.example.json`。
- `lib/nutrition-db.ts` 运行时先读磁盘上的全量库，缺失才回退示例库，保证开箱可跑。
- 每个工具结果带 `source`，agent 汇总进 `provenance` 与 `dbMeta`，从结果里即可证明“agent 查过本地库”，但数据文件不进 GitHub。
- 匹配用 CJK 友好算法：归一化 + exact/alias/字符重叠评分（中文无空格，按字符重叠）。

### EdgeSpark 后端（登录 / 本地库 / 用户录入）
- 后端基于 EdgeSpark（Cloudflare D1 + Drizzle + 内置 auth），脚手架在 `server/`：
  - `db_schema.ts`：`users` / `foods` / `user_entries` 三张表；`foods` 存每 100g 营养素并带 `embedding` 向量列。
  - `routes/api.ts`（Hono）：`/api/auth/me`（登录态）、`/api/foods`（本地库检索）、`/api/entries`（把用户录入写进 `user_entries`，用 `auth.user.id` 归属用户）。
  - `lib/search.ts`：D1 关键词检索第一层 + `embedding` 向量余弦召回（混合检索）。
- 前端 MVP 以浏览器本地存储为主，用户/每日记录等持久化由该 EdgeSpark 后端承载；`server/` 独立于 Next 应用（`tsconfig` 已排除，不影响 `npm run typecheck`）。

### 提供方抽象 + function calling
- `lib/agent/llm.ts` 统一 provider（`ccswitch`/`deepseek`/`minimax`/`dashscope`）由环境变量驱动，兼容 OpenAI 与 Anthropic 请求格式。
- `buildChatCompletionBody` 支持 `tools`/`tool_choice`；`requestChatCompletion` 处理多 endpoint 回退、超时；能解析 OpenAI `tool_calls` 与 Anthropic `tool_use`。
- 工具以 JSON Schema 注册在 `lib/agent/tools.ts`，`executeTool` 按名分发到 `lib/tools/*`。

### 主食物识别管线
- `lib/food-catalog.ts`（整份套餐库）+ `lib/brand-catalog.ts`（品牌/门店匹配）+ Tavily 搜索 + 提示工程 LLM，形成可解释的「本地→联网→LLM」降级链路。
- 严格本地匹配（`strictLocalMatches`）与 AI 结果合并、去重、自检（`calories ≈ P*4+C*4+F*9`）。

### 双语
`lib/i18n.tsx` + `lib/translations.ts` + 生成的 `translations-generated.json`，中英互译，页面文案按 `lang` 切换。

### 持久化
当前使用浏览器本地存储（草稿 / 日历 / 用户设置），按北京时间 0:00–24:00 记录。Auth / Supabase 持久化留待后续。

---

## 代码质量 / Architecture

### 架构原则
- **App Router + Server Components**，`runtime = "nodejs"` 的 API 路由处理 AI/文件/网络。
- **分层清晰**：`app/api`（HTTP 边界）→ `lib`（领域逻辑、agent、工具、换算、i18n）→ `components`（UI）→ `data`（数据 + 本地库）。
- **领域类型集中**：`lib/types.ts` 统一 `MacroTotals`、`FoodLogItem`、`UserProfile`、`Recommendation` 等，组件与路由共用。
- **可复用的领域函数**：BMR/目标/宏量换算集中在 `lib/nutrition.ts`，避免 UI 散落计算。

### 质量保障
- **TypeScript strict**：`strict: true`，`npm run typecheck`（`tsc --noEmit`）通过。
- **新增代码边界感**：agent / LLM / nutrition-db 仅被服务端路由引用，`node:fs` 等只在服务端出现，避免打包进客户端。
- **密钥与数据隔离**：`.gitignore` 忽略 `.env*.local`、`.env`、`.env.*` 与 `data/nutrition-100g.json`；`.env.example` 只存变量名占位符。
- **风险可控**：本地库缺失时回退示例库；Exa 无 key 时工具明确报错并走本地库/LLM 兜底。

### 已知边界 / 待办
- 图片识别当前标记为“测试中”，未接入真实视觉模型。
- Auth / Supabase 未接入。
- `nutrition-100g.json` 为参考近似值，生产建议替换为权威来源（USDA FoodData Central / 中国食物成分表）。

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
EXA_API_KEY=...             # 供 /api/nutrition-agent 的 exa_web_search 使用
```

完整变量名见 `.env.example`。
