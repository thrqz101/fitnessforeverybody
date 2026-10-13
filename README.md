# Fitness for Everybody

**一句话记录一餐，AI 帮你算营养、看缺口、推荐下一餐。** 不用称重，也不用查表。

👉 立即体验：**<https://fitnessforeverybody.vercel.app>**

免费、中英双语，适合想增肌、减脂、减重，或只是想吃得更健康的人。

## 功能

- **AI 识别每一餐**：像发消息一样写下吃了什么，AI Agent 通过自主 function calling 拆解食物并估算营养，确认后计入今天。
- **今日营养进度**：蛋白质、碳水、脂肪、热量、膳食纤维一目了然，随时知道还差多少。
- **智能推荐下一餐**：根据当日营养预算和剩余缺口，智能推荐下一餐吃什么。
- **日历与设置**：记录每天的饮食和训练，身体资料与目标设置一次即可，随时回看以往记录。
- **账号**：邮箱 + 验证码登录，无需密码。

> 营养数值为估算结果，仅供日常参考。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 前端 | Next.js 14、React 18、TypeScript、Tailwind CSS |
| 后端 | Next.js API Routes（Node.js） |
| 数据库 | Supabase（PostgreSQL） |

## 本地开发

如果你克隆了这个仓库，可以这样在本地运行：

```bash
git clone https://github.com/thrqz101/fitnessforeverybody.git
cd fitnessforeverybody
npm install
cp .env.example .env    # 按 .env.example 填写配置
npm run dev
```

打开 <http://localhost:3000>。更多配置说明见 [docs/setup.md](docs/setup.md)。

## 项目结构

```text
fitnessforeverybody/
├── src/
│   ├── app/
│   ├── features/
│   │   ├── recognition/
│   │   ├── recommendation/
│   │   ├── profile/
│   │   ├── daily-log/
│   │   ├── account/
│   │   ├── feedback/
│   │   └── agent/
│   └── shared/
├── data/
├── docs/
├── scripts/
├── supabase/
├── tests/
├── AGENTS.md
├── ARCHITECTURE.md
├── CODE.md
├── CHANGELOG.md
└── README.md
```

关键文档：[ARCHITECTURE.md](ARCHITECTURE.md)、[CODE.md](CODE.md)、[AGENTS.md](AGENTS.md)、[docs/](docs/)。

## 许可

[MIT](LICENSE)
