# Fitness for Everybody

**一句话记录一餐，AI 帮你算营养、看缺口、推荐下一餐。**

👉 立即体验：**<https://fitnessforeverybody.app>**

免费 · 中英双语 · 手机和电脑都能用

## 为什么做这个

想增肌、减脂或者吃得更健康，最难坚持的往往不是训练，而是饮食记录：传统的记录方式要称重、查表、手动算宏量营养素，几天就放弃了。而真实的日常饮食大多是外卖、食堂、连锁品牌和家常菜，很难在国外的食品数据库里找到对应条目。

Fitness for Everybody 想让记录饮食像发一条消息一样简单：你只需要用自己的话说出吃了什么，剩下的交给 AI。它会告诉你今天吃够了没有、哪里还差一点，以及下一餐怎么吃更合适。

适合这些人：

- 正在增肌、减脂或减重，需要控制每天的蛋白质和热量；
- 有训练习惯，希望饮食跟着训练日和休息日调整；
- 没有时间称重算数，只想大致知道自己吃得对不对。

## 核心功能

### AI 识别每一餐

用自然语言描述你吃的东西，AI Agent 通过自主 function calling 把这一餐拆成具体食物，并估算每一项的营养。

- 外卖、连锁品牌套餐、麻辣烫、盖饭和家常菜都能识别，可以带上品牌、份量和克数；
- 识别过程实时显示，结果先放进待确认列表，你可以调整份量，确认后才计入当天；
- 查到公开资料时，会附上参考来源和品牌官网；
- 每种食物附一句简短的饮食小建议。

### 今日营养进度

- 蛋白质、碳水、脂肪、热量、膳食纤维五项进度，都显示具体数字；
- 汇总成一个今日达标率，一眼看出今天完成得怎么样；
- 每日目标根据你的身体资料、目标、训练日和饮食日状态自动计算。

### 智能推荐下一餐

- 根据当日营养预算和剩余缺口，智能推荐下一餐；
- 可按餐饮地域、餐次和风格筛选；
- 当天快要达标时自动切换为轻补模式，优先推荐水果、酸奶等轻量加餐；
- 不满意可以让 AI 再推荐一批，拿不定主意时用“随机推荐”摇一个。

### 日历与设置

- 训练和饮食日历：记录每天练了什么、吃了什么，随时回看以往的记录和完成度；
- 身体资料和目标只需设置一次，之后会记住；也可以随时调整每日营养目标。

### 账号与数据

- 邮箱 + 验证码登录，无需密码；
- 记录保存在账号中，换设备也能继续使用；
- 可以随时删除账号和全部数据。

> 营养数值为估算结果，仅供日常参考，不构成医疗或营养诊断。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | Next.js 14（App Router）、React 18、TypeScript、Tailwind CSS |
| 后端 | Next.js API Routes（Node.js） |
| 数据库 | Supabase（PostgreSQL） |

## 项目结构

```text
fitnessforeverybody/
├── src/
│   ├── app/                  # 页面与 API 路由
│   ├── features/             # 按功能划分的业务模块
│   │   ├── recognition/      # 食物识别
│   │   ├── recommendation/   # 下一餐推荐
│   │   ├── profile/          # 身体资料与目标设置
│   │   ├── daily-log/        # 今日进度与日历
│   │   ├── account/          # 登录与账号
│   │   ├── feedback/         # 意见反馈
│   │   └── agent/            # AI Agent
│   └── shared/               # 跨功能共用的逻辑、组件与类型
├── data/                     # 静态数据
├── supabase/                 # 数据库迁移与测试
├── scripts/                  # 构建与测试脚本
├── tests/                    # 自动化测试
├── docs/                     # 专题文档
├── ARCHITECTURE.md
├── CODE.md
├── AGENTS.md
└── CHANGELOG.md
```

每个功能模块内部再分为 `domain`（纯业务逻辑）、`server`（服务端调用）和 `ui`（界面组件）三层。

## 本地开发

如果你克隆了这个仓库，可以按以下步骤在本地运行。需要 Node.js 22.6 或更高版本。

```bash
git clone https://github.com/thrqz101/fitnessforeverybody.git
cd fitnessforeverybody
npm install
cp .env.example .env    # 按 .env.example 中的说明填写配置
npm run dev
```

然后打开 <http://localhost:3000>。

常用命令：

```bash
npm run typecheck   # 类型检查
npm test            # 运行测试
npm run build       # 生产构建
```

详细的环境配置说明见 [docs/setup.md](docs/setup.md)。

## 文档

| 文档 | 说明 |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 系统架构：目录职责、分层规则和主要请求流程 |
| [CODE.md](CODE.md) | 代码规范：命名、模块划分、接口写法和 TypeScript 约定 |
| [AGENTS.md](AGENTS.md) | 给 AI 编程助手的协作规则，也适合人类贡献者阅读 |
| [docs/](docs/) | 专题文档：识别、推荐、营养目标、数据库、多语言、测试、界面规范、环境配置等 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新记录 |

## 许可

[MIT](LICENSE)
