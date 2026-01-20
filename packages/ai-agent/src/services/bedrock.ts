import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import {
  ProjectInfo,
  MarketInfo,
  AIAgentOutput,
  EntityOperation,
  BaseProject,
  MarketEventType,
} from '@crypto-dashboard/shared';

const client = new BedrockRuntimeClient({});

const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-sonnet-4-5-20250929-v1:0';

/**
 * Tool definitions for EntityOperations
 */
const TOOLS = [
  {
    name: 'create_project',
    description: '创建新的项目实体。当发现一个全新的项目且在现有项目列表中不存在时使用。',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '项目唯一标识符，使用小写字母和连字符，例如 "binance", "uniswap-v3"',
        },
        name: {
          type: 'string',
          description: '项目名称',
        },
        category: {
          type: 'string',
          enum: ['cex', 'dex', 'market_maker', 'payment', 'layer1', 'layer2', 'defi', 'wallet', 'infrastructure', 'stablecoin'],
          description: '项目分类',
        },
        description: {
          type: 'string',
          description: '项目描述',
        },
        logo: {
          type: 'string',
          description: 'Logo URL',
        },
        website: {
          type: 'string',
          description: '官网 URL',
        },
        twitter: {
          type: 'string',
          description: 'Twitter 账号',
        },
      },
      required: ['id', 'name', 'category'],
    },
  },
  {
    name: 'update_project',
    description: '更新现有项目实体的属性。用于更新健康度、状态、情绪等动态属性。',
    input_schema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: '要更新的项目 ID',
        },
        healthScore: {
          type: 'number',
          description: '健康度评分 (0-100)',
          minimum: 0,
          maximum: 100,
        },
        status: {
          type: 'string',
          enum: ['normal', 'watch', 'warning', 'danger'],
          description: '项目状态',
        },
        newsSentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
          description: '新闻情绪',
        },
        reason: {
          type: 'string',
          description: '更新原因说明',
        },
      },
      required: ['entityId', 'reason'],
    },
  },
  {
    name: 'add_event',
    description: '为项目添加事件记录。用于记录重要新闻、公告、发布等事件。',
    input_schema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: '项目 ID',
        },
        title: {
          type: 'string',
          description: '事件标题',
        },
        description: {
          type: 'string',
          description: '事件描述',
        },
        date: {
          type: 'string',
          description: '事件日期 (ISO 格式)',
        },
        source: {
          type: 'string',
          description: '信息来源',
        },
        sourceUrl: {
          type: 'string',
          description: '来源 URL',
        },
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
          description: '事件情绪',
        },
        eventType: {
          type: 'string',
          enum: ['funding', 'product', 'security', 'regulatory', 'partnership', 'listing', 'airdrop', 'governance', 'technical', 'legal', 'personnel', 'general'],
          description: '事件类型',
        },
      },
      required: ['entityId', 'title', 'description', 'date', 'source', 'sentiment', 'eventType'],
    },
  },
  {
    name: 'add_risk_flag',
    description: '为项目添加风险标签。用于标记潜在的风险信号。',
    input_schema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: '项目 ID',
        },
        flagType: {
          type: 'string',
          enum: ['regulatory_risk', 'security_breach', 'liquidity_crisis', 'team_departure', 'legal_issues', 'fund_issues', 'layoffs', 'audit_failed'],
          description: '风险类型',
        },
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: '严重程度',
        },
        description: {
          type: 'string',
          description: '风险描述',
        },
        source: {
          type: 'string',
          description: '信息来源',
        },
      },
      required: ['entityId', 'flagType', 'severity', 'description'],
    },
  },
  {
    name: 'add_opportunity_flag',
    description: '为项目添加机会标签。用于标记潜在的投资机会或正面信号。',
    input_schema: {
      type: 'object',
      properties: {
        entityId: {
          type: 'string',
          description: '项目 ID',
        },
        flagType: {
          type: 'string',
          enum: ['new_funding', 'product_launch', 'partnership', 'ecosystem_growth', 'regulatory_approval', 'major_upgrade'],
          description: '机会类型',
        },
        importance: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: '重要程度',
        },
        description: {
          type: 'string',
          description: '机会描述',
        },
        source: {
          type: 'string',
          description: '信息来源',
        },
      },
      required: ['entityId', 'flagType', 'importance', 'description'],
    },
  },
  {
    name: 'report_analysis',
    description: '报告分析结果。在完成所有操作后调用此工具提交最终分析结果。',
    input_schema: {
      type: 'object',
      properties: {
        sentiment: {
          type: 'string',
          enum: ['positive', 'neutral', 'negative'],
          description: '整体情绪',
        },
        eventType: {
          type: 'string',
          enum: ['funding', 'product', 'security', 'regulatory', 'partnership', 'listing', 'airdrop', 'governance', 'technical', 'legal', 'personnel', 'general'],
          description: '事件类型',
        },
        identifiedProjects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              entityId: { type: 'string', description: '已存在的项目 ID (如果匹配到)' },
              name: { type: 'string', description: '项目名称' },
              confidence: { type: 'number', description: '置信度 0-1' },
            },
            required: ['name', 'confidence'],
          },
          description: '识别到的相关项目',
        },
        keyInsights: {
          type: 'array',
          items: { type: 'string' },
          description: '关键洞察',
        },
        reasoning: {
          type: 'string',
          description: '分析推理过程',
        },
      },
      required: ['sentiment', 'reasoning'],
    },
  },
];

/**
 * System prompt for the AI Agent
 */
const SYSTEM_PROMPT = `你是一个专业的 Crypto/Web3 行业分析助手。你的任务是分析输入的项目信息或市场新闻，并使用工具执行相应的操作。

## 工作流程

1. 仔细阅读输入的信息
2. 识别涉及的项目实体
3. 分析情绪、事件类型、风险和机会
4. 使用相应工具执行操作:
   - create_project: 创建新项目 (仅当项目不存在时)
   - update_project: 更新现有项目属性
   - add_event: 添加事件记录
   - add_risk_flag: 添加风险标签
   - add_opportunity_flag: 添加机会标签
5. 最后调用 report_analysis 提交分析结果

## 重要规则

- 对于项目信息 (ProjectInfo): 主要判断是否需要创建新实体或更新已有实体
- 对于市场信息 (MarketInfo): 识别相关项目，分析情绪和事件类型，添加事件/标签
- 只有当项目明确不在已有列表中时才创建新项目
- 必须在最后调用 report_analysis 工具
- 保持简洁准确，避免过度解读
- 所有输出（包括 reasoning 和 description）必须使用中文，不要使用英文或双语输出`;

/**
 * Convert tool call to EntityOperation
 */
function toolCallToOperation(toolName: string, input: Record<string, unknown>): EntityOperation | null {
  switch (toolName) {
    case 'create_project':
      return {
        type: 'create',
        entity: {
          id: input.id as string,
          name: input.name as string,
          category: input.category as string,
          description: input.description as string | undefined,
          logo: input.logo as string | undefined,
          website: input.website as string | undefined,
          twitter: input.twitter as string | undefined,
        },
      };

    case 'update_project':
      return {
        type: 'update',
        entityId: input.entityId as string,
        updates: {
          healthScore: input.healthScore as number | undefined,
          status: input.status as string | undefined,
          newsSentiment: input.newsSentiment as string | undefined,
        },
        reason: input.reason as string,
      };

    case 'add_event':
      return {
        type: 'add_event',
        entityId: input.entityId as string,
        event: {
          title: input.title as string,
          description: input.description as string,
          date: input.date as string,
          source: input.source as string,
          sourceUrl: input.sourceUrl as string | undefined,
          sentiment: input.sentiment as 'positive' | 'neutral' | 'negative',
          eventType: input.eventType as MarketEventType,
        },
      };

    case 'add_risk_flag':
      return {
        type: 'add_risk_flag',
        entityId: input.entityId as string,
        flag: {
          type: input.flagType as string,
          severity: input.severity as 'low' | 'medium' | 'high' | 'critical',
          description: input.description as string,
          source: input.source as string | undefined,
        },
      };

    case 'add_opportunity_flag':
      return {
        type: 'add_opportunity_flag',
        entityId: input.entityId as string,
        flag: {
          type: input.flagType as string,
          importance: input.importance as 'low' | 'medium' | 'high',
          description: input.description as string,
          source: input.source as string | undefined,
        },
      };

    default:
      return null;
  }
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface BedrockResponse {
  content: (ToolUseBlock | TextBlock)[];
  stop_reason: string;
}

/**
 * Analyze information using Claude with Tool Use
 */
export async function analyzeWithTools(
  infoType: 'project_info' | 'market_info',
  info: ProjectInfo | MarketInfo,
  existingProjects: BaseProject[]
): Promise<AIAgentOutput> {
  const operations: EntityOperation[] = [];
  let analysis: AIAgentOutput['analysis'] = {};
  let reasoning = '';

  // Build user prompt based on info type
  const userPrompt = buildUserPrompt(infoType, info, existingProjects);

  // Initial message
  const messages: Array<{ role: string; content: unknown }> = [
    { role: 'user', content: userPrompt },
  ];

  // Tool use loop (max 5 iterations to prevent infinite loops)
  for (let i = 0; i < 5; i++) {
    const response = await invokeModelWithTools(messages);

    // Process response content
    const toolUseBlocks: ToolUseBlock[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        // Capture any text output
        console.log('Claude text:', block.text);
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
      }
    }

    // If no tool calls, we're done
    if (toolUseBlocks.length === 0) {
      break;
    }

    // Process tool calls
    const toolResults: Array<{ type: string; tool_use_id: string; content: string }> = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`Tool call: ${toolUse.name}`, JSON.stringify(toolUse.input));

      if (toolUse.name === 'report_analysis') {
        // Final analysis report
        const input = toolUse.input;
        analysis = {
          sentiment: input.sentiment as 'positive' | 'neutral' | 'negative' | undefined,
          eventType: input.eventType as MarketEventType | undefined,
          identifiedProjects: input.identifiedProjects as Array<{
            entityId?: string;
            name: string;
            confidence: number;
          }> | undefined,
          keyInsights: input.keyInsights as string[] | undefined,
        };
        reasoning = input.reasoning as string || '';

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ success: true, message: '分析报告已接收' }),
        });
      } else {
        // Convert to operation
        const operation = toolCallToOperation(toolUse.name, toolUse.input);
        if (operation) {
          operations.push(operation);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ success: true, message: `操作已记录: ${toolUse.name}` }),
          });
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ success: false, error: '未知工具' }),
          });
        }
      }
    }

    // Add assistant response and tool results to messages
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    // If stop reason is end_turn, we're done
    if (response.stop_reason === 'end_turn') {
      break;
    }
  }

  return {
    operations,
    analysis,
    reasoning,
  };
}

/**
 * Build user prompt based on info type
 */
function buildUserPrompt(
  infoType: 'project_info' | 'market_info',
  info: ProjectInfo | MarketInfo,
  existingProjects: BaseProject[]
): string {
  const projectList = existingProjects.length > 0
    ? existingProjects.map(p => `- ${p.id}: ${p.name} (${p.category})`).join('\n')
    : '暂无已存在的项目';

  if (infoType === 'project_info') {
    const projectInfo = info as ProjectInfo;
    return `
## 任务
分析以下项目信息，判断是否需要创建新实体或更新已有实体。

## 项目信息
- ID: ${projectInfo.id}
- 来源: ${projectInfo.source}
- 名称: ${projectInfo.name}
- 描述: ${projectInfo.description || '无'}
- 官网: ${projectInfo.website || '无'}
- 分类: ${projectInfo.sourceCategory || '未知'}
- 支持的链: ${projectInfo.chains?.join(', ') || '无'}
- 代币: ${projectInfo.tokenSymbol || '无'}
- Twitter: ${projectInfo.twitter || '无'}

## 原始数据 (部分)
${JSON.stringify(projectInfo.rawData, null, 2).slice(0, 1500)}

## 已存在的项目实体
${projectList}

请分析这个项目信息，使用工具执行必要的操作，最后调用 report_analysis 提交分析结果。
`;
  } else {
    const marketInfo = info as MarketInfo;
    return `
## 任务
分析以下市场新闻/动态，识别相关项目并生成分析结果。

## 新闻信息
- 标题: ${marketInfo.title}
- 来源: ${marketInfo.source}
- 发布时间: ${marketInfo.publishedAt}
- 内容: ${marketInfo.content}
${marketInfo.fullContent ? `- 完整内容: ${marketInfo.fullContent.slice(0, 2000)}` : ''}
- 原文链接: ${marketInfo.url || '无'}
- 标签: ${marketInfo.tags?.join(', ') || '无'}

## 已存在的项目实体
${projectList}

请分析这条新闻:
1. 识别涉及的项目实体 (使用已有项目 ID)
2. 判断新闻情绪
3. 分类事件类型
4. 识别风险信号或机会信号
5. 使用工具执行必要操作
6. 最后调用 report_analysis 提交分析结果
`;
  }
}

/**
 * Invoke Bedrock Claude model with tools
 */
async function invokeModelWithTools(
  messages: Array<{ role: string; content: unknown }>
): Promise<BedrockResponse> {
  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages,
    tools: TOOLS,
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body)) as BedrockResponse;

  return responseBody;
}

// Legacy exports for backward compatibility
export async function analyzeProjectInfo(
  info: ProjectInfo,
  existingProjects: BaseProject[]
): Promise<AIAgentOutput> {
  return analyzeWithTools('project_info', info, existingProjects);
}

export async function analyzeMarketInfo(
  info: MarketInfo,
  existingProjects: BaseProject[]
): Promise<AIAgentOutput> {
  return analyzeWithTools('market_info', info, existingProjects);
}
