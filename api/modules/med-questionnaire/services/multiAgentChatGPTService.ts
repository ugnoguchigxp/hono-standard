import { logger } from '@api/lib/logger';
import { ChatGPTService } from './chatGPTService';

/**
 * エージェント設定インターフェース
 */
interface AgentConfig {
  id: string;
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
  priority: number;
  timeout: number;
}

/**
 * マルチエージェント設定
 */
interface MultiAgentConfig {
  agents: AgentConfig[];
  strategy: 'race' | 'priority' | 'fallback';
  maxConcurrent: number;
  globalTimeout: number;
}

/**
 * エージェント実行結果
 */
interface AgentResult {
  agentId: string;
  success: boolean;
  response?: string;
  error?: string;
  responseTime: number;
}

/**
 * マルチエージェント型ChatGPTサービス
 */
export class MultiAgentChatGPTService {
  private config: MultiAgentConfig;
  private agents: Map<string, ChatGPTService> = new Map();

  constructor() {
    this.config = this.loadConfiguration();
    this.initializeAgents();
  }

  /**
   * 設定を読み込み
   * 同一のEndpoint・APIKeyを使用して3つのエージェントを作成
   */
  private loadConfiguration(): MultiAgentConfig {
    const baseEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    const baseApiKey = process.env.AZURE_OPENAI_API_KEY || '';
    const baseDeploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4-1-mini';
    const baseApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview';

    return {
      strategy: (process.env.MULTI_AGENT_STRATEGY as any) || 'race',
      maxConcurrent: parseInt(process.env.MULTI_AGENT_CONCURRENT || '3', 10),
      globalTimeout: parseInt(process.env.MULTI_AGENT_TIMEOUT || '30000', 10),
      agents: [
        {
          id: 'agent-1',
          endpoint: baseEndpoint,
          apiKey: baseApiKey,
          deploymentName: baseDeploymentName,
          apiVersion: baseApiVersion,
          priority: 1,
          timeout: 25000,
        },
        {
          id: 'agent-2',
          endpoint: baseEndpoint,
          apiKey: baseApiKey,
          deploymentName: baseDeploymentName,
          apiVersion: baseApiVersion,
          priority: 2,
          timeout: 25000,
        },
        {
          id: 'agent-3',
          endpoint: baseEndpoint,
          apiKey: baseApiKey,
          deploymentName: baseDeploymentName,
          apiVersion: baseApiVersion,
          priority: 3,
          timeout: 25000,
        },
      ],
    };
  }

  /**
   * エージェントを初期化
   * 同一エンドポイント・APIKeyで複数のChatGPTサービスインスタンスを作成
   */
  private initializeAgents(): void {
    for (const agentConfig of this.config.agents) {
      // 安全なコンストラクタパターンを使用（危険なリフレクション操作を回避）
      const agent = ChatGPTService.createAgentInstance({
        apiKey: agentConfig.apiKey,
        endpoint: agentConfig.endpoint,
        deployment: agentConfig.deploymentName,
        apiVersion: agentConfig.apiVersion,
        timeout: agentConfig.timeout,
      });

      this.agents.set(agentConfig.id, agent);
    }

    logger.info(
      {
        strategy: this.config.strategy,
        agentCount: this.config.agents.length,
        maxConcurrent: this.config.maxConcurrent,
        endpoint: this.config.agents[0]?.endpoint,
        sameEndpointMode: true,
      },
      'Multi-agent ChatGPT service initialized with same endpoint'
    );
  }

  /**
   * マルチエージェント型レスポンス生成
   */
  async generateResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    const startTime = Date.now();

    logger.info(
      {
        strategy: this.config.strategy,
        messageCount: messages.length,
        activeAgents: this.config.agents.length,
        endpoint: this.config.agents[0]?.endpoint,
      },
      'Starting multi-agent response generation (same endpoint)'
    );

    try {
      switch (this.config.strategy) {
        case 'race':
          return await this.raceStrategy(messages, temperature, maxTokens);
        case 'priority':
          return await this.priorityStrategy(messages, temperature, maxTokens);
        case 'fallback':
          return await this.fallbackStrategy(messages, temperature, maxTokens);
        default:
          return await this.raceStrategy(messages, temperature, maxTokens);
      }
    } catch (error) {
      const elapsed = Date.now() - startTime;
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          elapsed,
          strategy: this.config.strategy,
        },
        'All multi-agent strategies failed'
      );
      throw error;
    }
  }

  /**
   * Race戦略: 全エージェント並列実行、最初の成功者を採用
   */
  private async raceStrategy(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    const agents = Array.from(this.agents.entries());
    const startTime = Date.now();

    // 全エージェントを並列実行
    const promises = agents.map(async ([agentId, agent]) => {
      const agentStartTime = Date.now();
      try {
        logger.debug(`Agent ${agentId} starting execution`);
        const response = await agent.generateResponse(messages, temperature, maxTokens);
        const responseTime = Date.now() - agentStartTime;

        logger.info(
          {
            responseTime,
            responseLength: response.length,
          },
          `Agent ${agentId} succeeded`
        );

        return {
          agentId,
          success: true,
          response,
          responseTime,
        } as AgentResult;
      } catch (error) {
        const responseTime = Date.now() - agentStartTime;
        logger.warn(
          {
            error: error instanceof Error ? error.message : String(error),
            responseTime,
          },
          `Agent ${agentId} failed`
        );

        return {
          agentId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          responseTime,
        } as AgentResult;
      }
    });

    // Promise.raceで最初の成功を待つ
    const results = await Promise.allSettled(promises);
    const successfulResults = results
      .filter((r): r is PromiseFulfilledResult<AgentResult> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((result) => result.success);

    if (successfulResults.length > 0) {
      // 最も速い成功結果を選択
      const winner = successfulResults.reduce((fastest, current) =>
        current.responseTime < fastest.responseTime ? current : fastest
      );

      const totalTime = Date.now() - startTime;
      logger.info(
        {
          winnerAgent: winner.agentId,
          winnerTime: winner.responseTime,
          totalTime,
          successfulAgents: successfulResults.length,
          totalAgents: agents.length,
        },
        'Multi-agent race strategy completed'
      );

      return winner.response!;
    }

    // 全エージェント失敗の場合
    const allResults = await Promise.allSettled(promises);
    const errors = allResults
      .filter((r): r is PromiseFulfilledResult<AgentResult> => r.status === 'fulfilled')
      .map((r) => `${r.value.agentId}: ${r.value.error}`)
      .join('; ');

    throw new Error(`All agents failed: ${errors}`);
  }

  /**
   * Priority戦略: 優先度順に実行、成功したら即座に返す
   */
  private async priorityStrategy(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    const sortedAgents = this.config.agents
      .sort((a, b) => a.priority - b.priority)
      .map((config) => ({ config, agent: this.agents.get(config.id)! }));

    for (const { config, agent } of sortedAgents) {
      try {
        logger.debug(`Trying priority agent: ${config.id}`);
        const startTime = Date.now();
        const response = await agent.generateResponse(messages, temperature, maxTokens);
        const responseTime = Date.now() - startTime;

        logger.info(
          {
            priority: config.priority,
            responseTime,
          },
          `Priority agent ${config.id} succeeded`
        );

        return response;
      } catch (error) {
        logger.warn(
          {
            priority: config.priority,
            error: error instanceof Error ? error.message : String(error),
          },
          `Priority agent ${config.id} failed, trying next`
        );
      }
    }

    throw new Error('All priority agents failed');
  }

  /**
   * Fallback戦略: 主エージェント失敗時のみ他を試行
   */
  private async fallbackStrategy(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    // 現在はpriorityStrategyと同じ実装
    return this.priorityStrategy(messages, temperature, maxTokens);
  }

  /**
   * エージェント状態の取得
   */
  getAgentStatus(): Array<{ id: string; healthy: boolean; lastError?: string }> {
    return this.config.agents.map((config) => ({
      id: config.id,
      healthy: this.agents.has(config.id),
      // 実際の実装では各エージェントのヘルスチェック結果を返す
    }));
  }

  /**
   * 設定情報の取得
   */
  getConfiguration() {
    return {
      strategy: this.config.strategy,
      agentCount: this.config.agents.length,
      maxConcurrent: this.config.maxConcurrent,
      globalTimeout: this.config.globalTimeout,
      agents: this.config.agents.map((a) => ({
        id: a.id,
        priority: a.priority,
        timeout: a.timeout,
        hasEndpoint: !!a.endpoint,
        hasApiKey: !!a.apiKey,
      })),
    };
  }
}
