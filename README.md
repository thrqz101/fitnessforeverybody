<p align="center">
  <a href="https://fitnessforeverybody.app"><img alt="Fitness for Everybody logo" src="docs/images/logo.png" width="112"></a>
</p>

<h1 align="center">Fitness for Everybody</h1>

<h3 align="center">
  Log a meal in one sentence.<br>
  AI tracks your nutrition, shows your gaps, and plans your next meal.
</h3>

<p align="center">
  <a href="https://fitnessforeverybody.app"><img alt="website" src="https://img.shields.io/badge/website-fitnessforeverybody.app-315b46"></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-14-1d2a22">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3f7354">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-7fae8a"></a>
</p>

<p align="center">
  <a href="https://fitnessforeverybody.app">
    <img alt="Fitness for Everybody: Record life, make sense of every meal." src="docs/images/landing.webp" width="100%">
  </a>
</p>

<p align="center">
  <b>Try it now → <a href="https://fitnessforeverybody.app">fitnessforeverybody.app</a></b><br>
  Free · English and Chinese · Works on phone and desktop
</p>

## Table of Contents

1. 💡 [Why Fitness for Everybody?](#why-fitness-for-everybody)
2. ✨ [Features](#features)
3. 🧱 [Tech Stack](#tech-stack)
4. 🗂️ [Project Structure](#project-structure)
5. 🚀 [Getting Started](#getting-started)
6. 📚 [Documentation](#documentation)
7. 🤝 [Contributing](#contributing)
8. 📄 [License](#license)

## Why Fitness for Everybody?

Whether you are building muscle, losing fat or simply trying to eat better, the hardest habit to keep is usually not the training. It is the food log. Traditional trackers ask you to weigh every portion, search long food databases and add up macros by hand, and most people give up within a week. Real meals are also messy: takeaway, canteen lunches, chain-restaurant combos and home cooking rarely match a database entry.

Fitness for Everybody makes logging food as easy as sending a message. Describe what you ate in your own words and let AI do the rest. It tells you whether you have eaten enough today, what is still missing, and what your next meal could be.

It is built for people who:

- are building muscle, losing fat or losing weight and need to watch protein and calories;
- train regularly and want their diet to follow training and rest days;
- have no time to weigh food, but want to know they are roughly on track.

## Features

### 🥗 AI meal recognition

Describe a meal in plain language. An AI agent with autonomous function calling breaks it into individual foods and estimates the nutrition of each one.

- Handles takeaway, chain-restaurant meals, mixed dishes and home cooking, including brands, portions and grams.
- Shows its progress live. Results land in a review list where you can adjust portions before they count toward today.
- Links the public sources and official brand pages it used when it looked something up.
- Adds a short, practical tip to each food.

### 📊 Daily nutrition progress

- Live progress for protein, carbs, fat, calories and fiber, always shown as numbers.
- One daily score that tells you at a glance how today is going.
- Daily targets adapt to your body, your goal, and whether today is a training or rest day.

### 🍽️ Smart next-meal recommendations

- Recommendations follow today's nutrition budget and what is still missing.
- Filter by cuisine, meal slot and style.
- Switches to light top-ups such as fruit or yogurt when you are close to your targets.
- Ask AI for more ideas, or let the shuffle pick one for you.

### 📅 Calendar and settings

- A training and food calendar to look back at what you ate and trained on any day.
- Set up your body profile and goal once; it is remembered, and you can fine-tune daily targets at any time.

### 🔐 Account

- Sign in with your email and a one-time code. No password.
- Your records follow you across devices, and you can delete your account and all data at any time.

> Nutrition values are estimates for everyday guidance, not medical or dietary advice.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Backend | Next.js API Routes (Node.js) |
| Database | Supabase (PostgreSQL) |

## Project Structure

```text
fitnessforeverybody/
├── src/
│   ├── app/                  # Pages and API routes
│   ├── features/             # Feature modules
│   │   ├── recognition/      # Meal recognition
│   │   ├── recommendation/   # Next-meal recommendations
│   │   ├── profile/          # Body profile and goals
│   │   ├── daily-log/        # Daily progress and calendar
│   │   ├── account/          # Sign-in and account
│   │   ├── feedback/         # In-app feedback
│   │   └── agent/            # AI agent
│   └── shared/               # Shared logic, components and types
├── data/                     # Static data
├── supabase/                 # Database migrations and tests
├── scripts/                  # Build and test scripts
├── tests/                    # Automated tests
└── docs/                     # Topic guides
```

Each feature module is split into `domain` (pure business logic), `server` (server-side calls) and `ui` (components).

## Getting Started

If you have cloned this repository, you can run it locally. You need Node.js 22.6 or later.

```bash
git clone https://github.com/thrqz101/fitnessforeverybody.git
cd fitnessforeverybody
npm install
cp .env.example .env    # fill in the values described in .env.example
npm run dev
```

Then open <http://localhost:3000>.

Useful commands:

```bash
npm run typecheck   # type checking
npm test            # tests
npm run build       # production build
```

See [docs/setup.md](docs/setup.md) for the full environment setup.

## Documentation

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, directory ownership, layering rules and the main request flow |
| [CODE.md](CODE.md) | Coding conventions: naming, modules, API routes and TypeScript |
| [AGENTS.md](AGENTS.md) | Working rules for AI coding assistants, also useful for human contributors |
| [docs/](docs/) | Topic guides: recognition, recommendations, nutrition targets, database, i18n, testing, UI, setup and more |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |

## Contributing

Issues and pull requests are welcome. Please read [CODE.md](CODE.md) and [AGENTS.md](AGENTS.md) first.

1. Create a branch from `main`, for example `feat/your-feature`.
2. Run `npm run typecheck` and `npm test` before committing.
3. Use Conventional Commits, for example `feat(recommendation): ...`.
4. Push your branch and open a pull request describing the change and how you verified it.

## License

[MIT](LICENSE)
