# Fitness for Everybody

面向日常健身人群的 **AI 饮食记录与推荐 Web 应用**，中英双语。用户用一句话描述“今天吃了什么”，应用会把它拆成可记录的食物条目，估算每项的蛋白质、碳水、脂肪、热量和膳食纤维；再把当天总量与按身体信息、训练和饮食计划算出的个性化目标对比，告诉你还差多少，并推荐下一餐。

目标：不称重、不查表，也能知道自己今天吃够没有、吃多没有。

线上地址：<https://fitnessforeverybody.vercel.app>

## 核心能力

- **自然语言识别**：品牌优先联网检索（Tavily），其次匹配本地食品库（固定份量套餐 + 每 100g 可食部数据库），都不确定时由 LLM 按中国餐饮常见份量估算；识别过程实时流式显示。
- **可溯源**：只有真实联网检索并成功整理出食物时，才附上实际来源与已核验的品牌官网。
- **个性化目标**：按 BMR、目标、训练结构、训练日和饮食日状态计算每日宏量目标，可手动调整倍数。
- **下一餐推荐**：按当天缺口排序本地推荐池，可让 AI 补充候选，也可以“摇一摇”随机挑选。
- **云端同步**：Supabase 邮箱验证码登录，记录跨设备同步；未配置后端时以本地模式运行。

## 技术栈

Next.js 14（App Router）· React 18 · TypeScript（strict）· Tailwind CSS · Supabase（Postgres + Auth + RLS）· Vercel · 1Password CLI 管理密钥。

## 快速开始

```bash
npm install
cp .env.example .env      # 只填 op://<vault>/<item>/<field> 形式的 1Password 引用，不要写真实密钥
npm run dev               # 通过 op run 注入密钥后启动 Next.js
npm run typecheck
npm test
npm run build
```

多个 1Password 账户时，在 shell 配置里设置 `OP_ACCOUNT`。完整步骤见 [docs/setup.md](docs/setup.md)。

## 目录结构

```text
src/
  app/          路由：页面与 API（只做鉴权、读参数、调用功能模块、返回）
  features/     按功能划分：recognition、recommendation、profile、daily-log、account、feedback、agent
                每个功能内再分 domain（纯逻辑）、server（调外部服务）、ui（组件）
  shared/       跨功能共用：领域类型与营养计算、食品库、API 客户端、Supabase、登录、多语言、通用组件
data/           品牌库、每 100g 食品库示例（完整库只在本地 / 构建时生成）
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
| [docs/](docs/) | 专题文档：识别、推荐、营养目标、Supabase、多语言、测试、错误、日期、UI、CSS、Git、环境配置 |
| [data/README.md](data/README.md) | 食品库来源与口径 |
| [CHANGELOG.md](CHANGELOG.md) | 更新记录 |

## 开源与安全

本仓库公开。真实密钥只保存在 1Password，`.env` 只放引用且不提交；完整食品库、本地笔记和工具状态都在 `.gitignore` 中。发布前检查清单见 [docs/setup.md](docs/setup.md#open-source-release-checklist)。

## 许可

见 [LICENSE](LICENSE)。
