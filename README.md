# FSIDNB Crypto Dashboard

A comprehensive dashboard for monitoring cryptocurrency projects across various categories (CEX, DEX, DeFi, Layer 1/2, Stablecoins, etc.) with AI-powered analysis.

## Architecture

### Two-Layer Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Layer 1: Information Layer                       │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐     ┌─────────────────────────────┐   │
│  │   ProjectInfo            │     │    MarketInfo               │   │
│  │   (Low-frequency)        │     │    (High-frequency)         │   │
│  │   • CoinGecko            │     │    • RSS News               │   │
│  │   • DefiLlama            │     │    • Twitter (planned)      │   │
│  └───────────┬──────────────┘     └──────────────┬──────────────┘   │
│              └────────────────┬──────────────────┘                  │
│                               ▼                                      │
│                    ┌─────────────────────┐                          │
│                    │    DynamoDB         │                          │
│                    │  ProjectInfoTable   │                          │
│                    │  MarketInfoTable    │                          │
│                    └──────────┬──────────┘                          │
└───────────────────────────────┼──────────────────────────────────────┘
                                │ SQS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     AI Agent Processing Layer                        │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │            AI Agent Lambda (Bedrock Claude + Tool Use)       │   │
│  │  • Entity identification    • Sentiment analysis             │   │
│  │  • Risk detection           • Opportunity detection          │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────┘
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Layer 2: Entity Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Project Entities                            │   │
│  │  Static: id, name, logo, category, website                  │   │
│  │  Dynamic: healthScore, status, riskFlags, recentEvents      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                        ProjectsTable                                │
└─────────────────────────────────────────────────────────────────────┘
```

### AWS Infrastructure

```
┌─────────────────────────────────────────────────────────────────────┐
│   [CloudFront] ─── [S3] (Next.js Static Site)                       │
│        │                                                             │
│        └── [Cognito] (Authentication)                               │
│                                                                      │
│   [EventBridge] ─── [Lambda Collector] ─── Every 15 min             │
│                          │                                           │
│                          ├─── [DynamoDB] (Info Tables)              │
│                          │                                           │
│                          └─── [SQS] ─── [Lambda AI Agent]           │
│                                              │                       │
│                                              └─── [Bedrock Claude]  │
│                                              │                       │
│                                              └─── [DynamoDB]        │
│                                                   (Projects Table)  │
│                                                                      │
│   [API Gateway] ─── [Lambda API] ─── [DynamoDB]                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
crypto-dashboard/
├── apps/
│   └── web/                    # Next.js frontend application
│       ├── src/
│       │   ├── app/            # App Router pages
│       │   ├── components/     # UI components
│       │   └── lib/            # Utilities and mock data
│       └── package.json
├── packages/
│   ├── api/                    # Lambda API handlers
│   │   └── src/
│   │       ├── handlers/       # API route handlers
│   │       └── services/       # DynamoDB service
│   ├── collector/              # Data collection Lambda
│   │   └── src/
│   │       └── sources/        # CoinGecko, DefiLlama, RSS
│   ├── ai-agent/               # AI Agent Lambda (NEW)
│   │   └── src/
│   │       └── services/       # Bedrock, DynamoDB, Processor
│   └── shared/                 # Shared types and utilities
│       └── src/
│           ├── types/          # TypeScript type definitions
│           │   ├── index.ts    # Entity layer types
│           │   └── information.ts  # Information layer types
│           └── utils/          # Helper functions
├── infra/                      # SST v3 infrastructure modules
│   ├── api.ts                  # API Gateway + Lambda
│   ├── database.ts             # DynamoDB tables (4 tables)
│   ├── queue.ts                # SQS queues
│   └── web.ts                  # Static site hosting
├── package.json                # Monorepo root
└── turbo.json                  # Turborepo config
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- AWS CLI configured (for deployment)
- AWS CDK CLI (`npm install -g aws-cdk`)

### Installation

```bash
# Clone the repository
cd crypto-dashboard

# Install dependencies
npm install

# Build all packages
npm run build
```

### Development

```bash
# Start development server (frontend + watch mode for packages)
npm run dev

# Visit http://localhost:3000
```

## Features

### Dashboard
- Overview of all tracked projects with optimized data fetching
- Statistics by category and status
- Recent events and watch list side by side
- Each category displays top 4 projects (sorted by status priority and health score)

### Category Pages
- List view (sortable table) and grid view toggle
- Filter by status
- Search by project name
- Responsive design with sidebar-aware breakpoints

### AI-Powered Analysis
- Automatic entity identification from news
- Sentiment analysis for market events
- Risk and opportunity flag detection
- Event classification (funding, security, regulatory, etc.)

### Admin Features
- **Data Sources**: View and manage data source configurations
- **Raw Data Browser**: Browse collected ProjectInfo and MarketInfo with pagination, filtering, and AI analysis display

### Project Categories

| Category | Description |
|----------|-------------|
| **CEX** | Centralized Exchanges (Binance, Coinbase, etc.) |
| **DEX** | Decentralized Exchanges (Uniswap, dYdX, etc.) |
| **Market Maker** | Quantitative Trading & Market Making |
| **Payment** | Crypto Payment Solutions |
| **Wallet** | Cryptocurrency Wallets |
| **Stablecoin** | Stablecoins (USDT, USDC, etc.) |
| **DeFi** | DeFi Protocols (Aave, Compound, etc.) |
| **Layer 1** | Base Layer Blockchains (Ethereum, Solana, etc.) |
| **Layer 2** | Scaling Solutions (Arbitrum, Optimism, etc.) |
| **Infrastructure** | Blockchain Infrastructure |

### Health Score System

```
Health Score = 0.3 × Base Metrics + 0.3 × Sentiment + 0.2 × Fund Safety + 0.2 × Development Trend
```

### Status Indicators

| Status | Description |
|--------|-------------|
| **Normal** | Operating normally, no issues |
| **Watch** | Worth monitoring, opportunities available |
| **Warning** | Potential issues detected |
| **Danger** | Critical issues requiring attention |

## Data Sources

### Project Information (Low-frequency)
- **CoinGecko**: Exchange data, coin prices, market caps
- **DefiLlama**: TVL, DeFi protocol data

### Market Information (High-frequency)
- **RSS Feeds**: CoinDesk, Cointelegraph, The Block, Decrypt
- **Twitter/X**: (Planned)

### Data Flow
1. Collector Lambda runs every 15 minutes
2. Raw information stored in Info tables (DynamoDB)
3. SQS triggers AI Agent Lambda
4. AI Agent analyzes with Claude and updates Project entities

## AWS Deployment

### Deploy Infrastructure

```bash
# Deploy to dev environment (SST v3)
npx sst dev

# Deploy to production
npx sst deploy --stage prod
```

### Stack Outputs

After deployment, you'll receive:

- **API Endpoint**: REST API URL
- **CloudFront URL**: Frontend website URL
- **Cognito User Pool ID**: For authentication
- **DynamoDB Table Names**: ProjectInfo, MarketInfo, Projects, Events
- **SQS Queue URL**: Info processing queue
- **AI Agent ARN**: Lambda function ARN

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://your-api-gateway-url
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
```

### Lambda (set via CDK)

| Lambda | Environment Variables |
|--------|----------------------|
| API | PROJECTS_TABLE_NAME, EVENTS_TABLE_NAME |
| Collector | PROJECT_INFO_TABLE_NAME, MARKET_INFO_TABLE_NAME, INFO_QUEUE_URL |
| AI Agent | PROJECTS_TABLE_NAME, PROJECT_INFO_TABLE_NAME, MARKET_INFO_TABLE_NAME, BEDROCK_MODEL_ID |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build all packages |
| `npm run lint` | Run linting |
| `npm run deploy` | Deploy to AWS |
| `npm run clean` | Clean build artifacts |

## Tech Stack

- **Frontend**: Next.js 16, React 18, Tailwind CSS, shadcn/ui
- **Backend**: AWS Lambda (Node.js 20), API Gateway
- **Database**: DynamoDB (4 tables)
- **AI**: AWS Bedrock Claude with Tool Use
- **Queue**: Amazon SQS
- **Auth**: AWS Cognito (planned)
- **Infrastructure**: SST v3 (Ion) with AWS
- **Monorepo**: Turborepo

## Documentation

Detailed specifications available in `.claude/specs/`:

- `00-overview.md` - Project overview and architecture
- `02-shared-types.md` - TypeScript type definitions
- `03-dashboard-ui.md` - Dashboard homepage UI
- `04-category-page.md` - Category page with table/grid views
- `06-aws-infrastructure.md` - SST v3 infrastructure
- `08-data-collector.md` - Data collection flow
- `19-ai-agent.md` - AI Agent with Tool Use
- `20-data-sources.md` - Admin data sources page
- `21-data-browser.md` - Admin raw data browser
- `architecture.md` - Two-layer architecture design

## License

MIT
