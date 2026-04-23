/**
 * @fileoverview OpenAI/Azure OpenAI 設定管理
 * @description GPT-4.1とGPT-5の設定を統合管理し、動的切り替えを可能にする
 */

import { logger } from '@api/lib/logger';

export interface OpenAIModelConfig {
  modelName: string;
  deployment: string;
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  maxTokens: number;
  timeout: number;
  description: string;
}

export enum ModelType {
  GPT_5_MINI = 'gpt-5-mini',
}

export class OpenAIConfigManager {
  private static instance: OpenAIConfigManager;
  private configs: Map<ModelType, OpenAIModelConfig>;
  private currentModel: ModelType;
  private isInitialized: boolean = false;

  private constructor() {
    this.configs = new Map();
    // Key Vault読み込み前の初期化を避けるため、遅延初期化パターンを採用
    this.currentModel = ModelType.GPT_5_MINI;
  }

  public static getInstance(): OpenAIConfigManager {
    if (!OpenAIConfigManager.instance) {
      OpenAIConfigManager.instance = new OpenAIConfigManager();
    }
    return OpenAIConfigManager.instance;
  }

  /**
   * 設定の遅延初期化（Key Vault読み込み後に呼び出し）
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.debug('OpenAI configurations already initialized');
      return;
    }

    this.loadConfigurations();
    this.isInitialized = true;

    logger.info(
      {
        availableModels: Array.from(this.configs.keys()),
        currentModel: this.currentModel,
      },
      'OpenAI configurations initialized'
    );
  }

  private loadConfigurations(): void {
    // GPT-5 Mini 設定
    this.configs.set(ModelType.GPT_5_MINI, {
      modelName: 'gpt-5-mini',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-5-mini',
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-05-01-preview',
      maxTokens: 8000,
      timeout: 60000,
      description: 'Azure OpenAI GPT-5 Mini - 最新モデル',
    });
  }

  /**
   * 初期化状態を確認してから設定を取得
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      logger.warn('OpenAI configurations not initialized yet - auto-initializing');
      this.initialize();
    }
  }

  /**
   * 現在のモデル設定を取得
   */
  public getCurrentConfig(): OpenAIModelConfig {
    this.ensureInitialized();

    const config = this.configs.get(this.currentModel);
    if (!config) {
      throw new Error(`Configuration not found for model: ${this.currentModel}`);
    }
    return config;
  }

  /**
   * 指定されたモデルの設定を取得
   */
  public getConfig(modelType: ModelType): OpenAIModelConfig {
    this.ensureInitialized();

    const config = this.configs.get(modelType);
    if (!config) {
      throw new Error(`Configuration not found for model: ${modelType}`);
    }
    return config;
  }

  /**
   * モデルを切り替え
   */
  public switchModel(modelType: ModelType): void {
    this.ensureInitialized();

    if (!this.configs.has(modelType)) {
      throw new Error(`Model type not supported: ${modelType}`);
    }

    const oldModel = this.currentModel;
    this.currentModel = modelType;

    logger.info(
      {
        from: oldModel,
        to: modelType,
        config: this.getCurrentConfig(),
      },
      'Model switched'
    );
  }

  /**
   * 現在のモデルタイプを取得
   */
  public getCurrentModelType(): ModelType {
    return this.currentModel;
  }

  /**
   * 利用可能なモデル一覧を取得
   */
  public getAvailableModels(): { type: ModelType; config: OpenAIModelConfig }[] {
    this.ensureInitialized();

    return Array.from(this.configs.entries()).map(([type, config]) => ({
      type,
      config,
    }));
  }

  /**
   * モデル設定の健全性チェック（初期化前でも安全）
   */
  public validateConfig(modelType?: ModelType): boolean {
    // 初期化前の場合は環境変数を直接チェック
    if (!this.isInitialized) {
      const hasRequiredEnvVars = !!(
        process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY
      );

      if (!hasRequiredEnvVars) {
        logger.warn(
          {
            hasEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
            hasApiKey: !!process.env.AZURE_OPENAI_API_KEY,
          },
          'OpenAI environment variables not set (before initialization)'
        );
      }

      return hasRequiredEnvVars;
    }

    try {
      const config = modelType ? this.getConfig(modelType) : this.getCurrentConfig();

      const isValid = !!(
        config.endpoint &&
        config.apiKey &&
        config.deployment &&
        config.apiVersion
      );

      if (!isValid) {
        logger.warn(
          {
            modelType: modelType || this.currentModel,
            hasEndpoint: !!config.endpoint,
            hasApiKey: !!config.apiKey,
            hasDeployment: !!config.deployment,
            hasApiVersion: !!config.apiVersion,
          },
          'Invalid OpenAI configuration detected'
        );
      }

      return isValid;
    } catch (error) {
      logger.error({ error }, 'Error validating OpenAI config');
      return false;
    }
  }

  /**
   * 設定情報をログ用に安全にエクスポート
   */
  public getConfigForLogging(modelType?: ModelType): {
    modelName: string;
    deployment: string;
    endpoint: string;
    apiVersion: string;
    maxTokens: number;
    timeout: number;
    description: string;
    hasApiKey: boolean;
  } {
    this.ensureInitialized();

    const config = modelType ? this.getConfig(modelType) : this.getCurrentConfig();

    return {
      modelName: config.modelName,
      deployment: config.deployment,
      endpoint: config.endpoint,
      apiVersion: config.apiVersion,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
      description: config.description,
      hasApiKey: !!config.apiKey,
    };
  }

  /**
   * 初期化状態を取得
   */
  public getInitializationStatus(): boolean {
    return this.isInitialized;
  }
}

// シングルトンインスタンスをエクスポート
export const openaiConfigManager = OpenAIConfigManager.getInstance();
