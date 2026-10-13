# Fitness for Everybody

**一句话记录一餐，AI 帮你算营养、看缺口、推荐下一餐。** 不用称重，也不用查表。

Fitness for Everybody 是一个免费、中英双语的饮食记录 Web 应用，面向想增肌、减脂、减重或只是想吃得更健康的人。你像发消息一样写下“吃了一碗牛肉麻辣烫，加宽粉、豆腐皮和青菜”，它会把这一餐拆成具体食物，估算蛋白质、碳水、脂肪、热量和膳食纤维，计入今天的进度，再根据还差多少推荐下一餐吃什么。

线上体验：<https://fitnessforeverybody.vercel.app>

## 功能

### 1. 设定身体资料与目标

- 填写身高、体重、年龄、性别；不记得基础代谢（BMR）时可以一键估算（Mifflin-St Jeor 公式）。
- 选择目标（增肌、减脂、减肥/减重、健康管理）、训练结构和饮食结构；附体脂率参考图。
- 保存前确认每日营养倍数（每公斤体重的蛋白质、碳水、脂肪克数）和膳食纤维，可以手动微调；热量按 蛋白质×4 + 碳水×4 + 脂肪×9 同步计算。

### 2. 一句话识别一餐

- 输入食物、品牌和份量，识别过程实时显示进度：检查品牌 → 匹配本地食品库 → 联网查资料或 AI 估算。
- 识别顺序：写了品牌就优先联网查找公开营养资料；没有品牌时先查本地食品库（常见套餐份量，以及来自 USDA 的每 100g 数据，写了克数会直接按克换算）；都对不上时，由 AI 按中国餐饮常见份量估算。
- 结果先进入“待确认”，可以调整份量，确认后才计入今天。
- 只有真正联网查到并整理出食物时，才会附上实际来源和已核验的品牌官网。
- 每条食物附一句可执行的小建议，例如去皮少油、换无糖饮料。单次最多识别 6 种食物。

### 3. 今日营养进度

- 蛋白质、碳水、脂肪、热量、膳食纤维五项进度都显示具体数字，并汇总成一个今日达标率。
- 按北京时间 0:00–24:00 分天。

### 4. 训练和饮食日历

- 记录今天是否训练、练了哪里、几组、多久，以及饮食状态（日常、高碳、低碳、高蛋白、放纵日）；当天目标会随之调整。
- 切换日期可以回看每天吃了什么和完成度。

### 5. 推荐下一餐

- 根据今天的营养缺口、训练状态和已有记录给推荐方案排序，可按餐饮地域、餐次和风格筛选。
- 当天完成度达到 80% 后自动切换为轻补模式，优先推荐水果、酸奶等轻量加餐。
- 可以让 AI 再生成 30 个候选；拿不定主意时用“随机推荐”摇一个。

### 6. 账号与数据

- 用邮箱验证码登录，无需密码；记录保存在账号里，换设备也能看到。
- 首次登录可以导入这台设备上的旧本地记录。
- 可以随时删除账号和全部数据。
- 也可以不配置后端，以本地模式运行，数据只保存在当前浏览器。

### 7. 意见反馈

在应用里直接提交使用感受或功能建议，反馈只有你和开发者能看到。

> 营养数值是估算结果，用于日常参考，不构成医疗或营养诊断。首页的体验评价是示例文案，不是真实用户评价。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端与服务端 | Next.js 14（App Router）、React 18、TypeScript（strict）、Tailwind CSS |
| 后端 | Supabase：Postgres、邮箱验证码登录、行级安全（RLS）、定时任务 |
| AI 与检索 | 兼容 OpenAI 接口的大模型（MiniMax / DeepSeek / DashScope 等，可切换）、Tavily 联网检索 |
| 数据 | USDA FoodData Central（CC0）构建的每 100g 食品库、164 个品牌的品牌库 |
| 部署与密钥 | Vercel、1Password CLI（`op run`） |

## 快速开始

需要 Node.js 22.6 或更高版本，以及已登录的 1Password CLI。

```bash
git clone https://github.com/thrqz101/fitnessforeverybody.git
cd fitnessforeverybody
npm install
cp .env.example .env
```

在 `.env` 里为每个密钥填写 1Password 引用（`op://<vault>/<item>/<field>`），不要写真实密钥。不配置 Supabase 也能以本地模式运行。然后：

```bash
npm run dev
```

打开 <http://localhost:3000>。环境变量说明、多 1Password 账户的设置和常见问题见 [docs/setup.md](docs/setup.md)。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 通过 `op run` 注入密钥并启动开发服务器 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm test` | 单元测试与接口测试 |
| `npm run build` | 生产构建 |
| `npm run auth:smoke` / `npm run api:smoke` | 对真实 Supabase 项目做端到端冒烟测试（会创建并删除临时测试用户，属于生产写入） |

## 目录结构

```text
src/
  app/          页面与 API 路由（只做鉴权、读参数、调用功能模块、返回结果）
  features/     按功能划分：recognition、recommendation、profile、daily-log、account、feedback、agent
                每个功能内再分 domain（纯逻辑）、server（调用外部服务）、ui（组件）
  shared/       跨功能共用：营养计算与领域类型、食品库、API 客户端、Supabase、登录、多语言、通用组件
data/           品牌库与食品库示例（完整的每 100g 库在本地或构建时生成，不提交）
supabase/       数据库迁移与 SQL 场景测试
scripts/        食品库构建脚本、真实后端冒烟测试
tests/          单元与接口测试
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统结构、目录职责、分层规则、一次识别请求的完整流程 |
| [CODE.md](CODE.md) | 代码规范：命名、模块划分、API 路由写法、TypeScript 约定 |
| [AGENTS.md](AGENTS.md) | AI 编程助手的工作规则（`CLAUDE.md` 指向它），含密钥与生产数据安全规则 |
| [docs/](docs/) | 专题文档：[识别](docs/recognition.md)、[推荐](docs/recommendation.md)、[营养目标](docs/nutrition.md)、[Supabase](docs/supabase.md)、[多语言](docs/i18n.md)、[测试](docs/testing.md)、[环境配置](docs/setup.md) 等 |
| [data/README.md](data/README.md) | 食品库的数据来源与口径 |
| [CHANGELOG.md](CHANGELOG.md) | 更新记录 |

## 开源与安全

本仓库公开。真实密钥只存放在 1Password；`.env` 只保存引用，并且不提交。完整食品库、本地笔记和工具状态都已写进 `.gitignore`。贡献代码前请阅读 [AGENTS.md](AGENTS.md) 中的安全规则；发布前检查清单见 [docs/setup.md](docs/setup.md#open-source-release-checklist)。

## 许可

[MIT](LICENSE)
