import { Readable } from 'node:stream';
import { logger } from '@api/lib/logger';
import { ApiClient, ApiClientError } from '../lib/ApiClient';
import { ModelType, openaiConfigManager } from '../lib/openaiConfig';
import type { IChatGPTRequest, IChatGPTResponse } from '../types';

/**
 * ChatGPTサービスクラス
 * @description Azure OpenAI APIとの通信とレスポンス処理を担当
 */
export class ChatGPTService {
  private static isInitialized = false;

  private apiClient: ApiClient;
  private apiKey: string;
  private endpoint: string;
  private deploymentName: string;
  private apiVersion: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;
  private requestTimeOutMs: number;

  constructor(
    customConfig?: Partial<{
      apiKey: string;
      endpoint: string;
      deployment: string;
      apiVersion: string;
      maxTokens: number;
      timeout: number;
    }>
  ) {
    // デフォルト設定で初期化（設定チェックによるサーバー停止を避ける）
    this.apiKey = '';
    this.endpoint = '';
    this.deploymentName = 'gpt-41-mini';
    this.apiVersion = '2024-10-21';
    this.defaultMaxTokens = 4000;
    this.requestTimeOutMs = 60000;
    this.defaultTemperature = 0.3;

    // OpenAI設定の初期化状態を確認してから設定を適用
    try {
      if (openaiConfigManager.getInitializationStatus()) {
        const config = customConfig
          ? { ...openaiConfigManager.getCurrentConfig(), ...customConfig }
          : openaiConfigManager.getCurrentConfig();

        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint;
        this.deploymentName = config.deployment;
        this.apiVersion = config.apiVersion;
        this.defaultMaxTokens = config.maxTokens;
        this.requestTimeOutMs = config.timeout;
      }
    } catch (error) {
      logger.warn(
        { error },
        'Failed to get OpenAI configuration during initialization, using defaults'
      );
    }

    this.apiClient = new ApiClient({
      baseURL: this.endpoint || 'https://dummy.openai.azure.com/',
      headers: {
        'api-key': this.apiKey || 'dummy-key',
      },
      timeout: this.requestTimeOutMs,
    });

    this.setupInterceptors();

    if (!ChatGPTService.isInitialized) {
      logger.info(
        {
          hasApiKey: !!this.apiKey,
          hasEndpoint: !!this.endpoint,
          deployment: this.deploymentName,
          apiVersion: this.apiVersion,
        },
        'ChatGPT service initialized'
      );
      ChatGPTService.isInitialized = true;
    }
  }

  public static getInstance(
    customConfig?: Partial<{
      apiKey: string;
      endpoint: string;
      deployment: string;
      apiVersion: string;
      maxTokens: number;
      timeout: number;
    }>
  ): ChatGPTService {
    return new ChatGPTService(customConfig);
  }

  public static createAgentInstance(
    customConfig: Partial<{
      apiKey: string;
      endpoint: string;
      deployment: string;
      apiVersion: string;
      maxTokens: number;
      timeout: number;
    }>
  ): ChatGPTService {
    const originalInitialized = ChatGPTService.isInitialized;
    ChatGPTService.isInitialized = true;

    const instance = new ChatGPTService(customConfig);
    ChatGPTService.isInitialized = originalInitialized;

    return instance;
  }

  public static resetInstance(): void {
    ChatGPTService.isInitialized = false;
  }

  async generateResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    try {
      if (!openaiConfigManager.getInitializationStatus()) {
        logger.warn('OpenAI configuration not initialized - attempting to initialize now');
        openaiConfigManager.initialize();
        const config = openaiConfigManager.getCurrentConfig();
        this.apiKey = config.apiKey;
        this.endpoint = config.endpoint;
        this.deploymentName = config.deployment;
        this.apiVersion = config.apiVersion;
        this.defaultMaxTokens = config.maxTokens;
        this.requestTimeOutMs = config.timeout;

        this.apiClient = new ApiClient({
          baseURL: this.endpoint,
          headers: {
            'api-key': this.apiKey,
          },
          timeout: this.requestTimeOutMs,
        });
        this.setupInterceptors();
      }

      if (!this.apiKey || !this.endpoint) {
        throw new Error('Azure OpenAI configuration is not properly set');
      }

      const currentModelType = openaiConfigManager.getCurrentModelType();
      const isGPT5 = currentModelType === ModelType.GPT_5_MINI;

      const request: IChatGPTRequest = {
        messages,
        temperature: isGPT5 ? 1.0 : (temperature ?? this.defaultTemperature),
        ...(isGPT5
          ? { max_completion_tokens: maxTokens ?? this.defaultMaxTokens }
          : { max_tokens: maxTokens ?? this.defaultMaxTokens }),
        stream: false,
      };

      const response = await this.apiClient.post<IChatGPTResponse>(
        `/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`,
        request
      );

      const generatedText = response.data.choices[0]?.message?.content;
      if (!generatedText) {
        throw new Error('No response generated from ChatGPT');
      }

      return generatedText.trim();
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.status === 401) {
          throw new Error('Invalid OpenAI API key');
        } else if (error.status === 429) {
          throw new Error(
            `Azure OpenAI APIの利用制限に達しました。しばらく待ってから再度お試しください。`
          );
        } else if (error.status === 404) {
          throw new Error('OpenAI API endpoint not found - check deployment name and endpoint');
        }
      }
      throw error instanceof Error ? error : new Error('Failed to generate response from ChatGPT');
    }
  }

  async generateStreamingResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    onChunk: (chunk: string) => void,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    try {
      if (!this.apiKey || !this.endpoint) {
        throw new Error('Azure OpenAI configuration is not properly set');
      }

      const currentModelType = openaiConfigManager.getCurrentModelType();
      const isGPT5 = currentModelType === ModelType.GPT_5_MINI;

      const request: IChatGPTRequest = {
        messages,
        temperature: isGPT5 ? 1.0 : (temperature ?? this.defaultTemperature),
        ...(isGPT5
          ? { max_completion_tokens: maxTokens ?? this.defaultMaxTokens }
          : { max_tokens: maxTokens ?? this.defaultMaxTokens }),
        stream: true,
      };

      const response = await this.apiClient.post<any>(
        `/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`,
        request,
        {
          responseType: 'stream',
        }
      );

      const stream = Readable.fromWeb(response.data as any);
      let fullResponse = '';

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                resolve(fullResponse);
                return;
              }
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  onChunk(content);
                }
              } catch (_parseError) {}
            }
          }
        });

        stream.on('error', (_error: Error) => {
          reject(new Error('Streaming response failed'));
        });

        stream.on('end', () => {
          resolve(fullResponse);
        });
      });
    } catch (_error) {
      throw new Error('Failed to generate streaming response from ChatGPT');
    }
  }

  async generateMedicalQuestion(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const currentModelType = openaiConfigManager.getCurrentModelType();
    const isGPT5 = currentModelType === ModelType.GPT_5_MINI;
    return this.generateResponse(messages, isGPT5 ? undefined : 0.2, 1000);
  }

  async generateCompletionAnalysis(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const currentModelType = openaiConfigManager.getCurrentModelType();
    const isGPT5 = currentModelType === ModelType.GPT_5_MINI;
    return this.generateResponse(messages, isGPT5 ? undefined : 0.1, 500);
  }

  private setupInterceptors(): void {
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug(
          {
            url: config.url,
            method: config.method?.toUpperCase(),
          },
          'ChatGPT API request'
        );
        return config;
      },
      (error) => {
        logger.error(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          'ChatGPT API request error'
        );
        return Promise.reject(error);
      }
    );

    this.apiClient.interceptors.response.use(
      (response) => {
        logger.debug(
          {
            status: response.status,
          },
          'ChatGPT API response'
        );
        return response;
      },
      (error) => {
        logger.error(
          {
            status: error.status,
            error: error instanceof Error ? error.message : String(error),
          },
          'ChatGPT API response error'
        );
        return Promise.reject(error);
      }
    );
  }

  async testConnection(): Promise<boolean> {
    try {
      const testMessage = [
        {
          role: 'user' as const,
          content: 'Hello, this is a connection test.',
        },
      ];
      const currentModelType = openaiConfigManager.getCurrentModelType();
      const isGPT5 = currentModelType === ModelType.GPT_5_MINI;
      await this.generateResponse(testMessage, isGPT5 ? undefined : 0.1, 50);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async getAvailableModels(): Promise<string[]> {
    return [this.deploymentName];
  }

  getConfiguration(): {
    deployment: string;
    endpoint: string;
    apiVersion: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    hasApiKey: boolean;
    hasEndpoint: boolean;
    currentModel: string;
    availableModels: string[];
  } {
    const availableModels = openaiConfigManager.getAvailableModels().map((m) => m.type);
    return {
      deployment: this.deploymentName,
      endpoint: this.endpoint,
      apiVersion: this.apiVersion,
      temperature: this.defaultTemperature,
      maxTokens: this.defaultMaxTokens,
      timeout: this.requestTimeOutMs,
      hasApiKey: !!this.apiKey,
      hasEndpoint: !!this.endpoint,
      currentModel: openaiConfigManager.getCurrentModelType(),
      availableModels,
    };
  }

  public switchModel(modelType: ModelType): void {
    openaiConfigManager.switchModel(modelType);
    const config = openaiConfigManager.getCurrentConfig();
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.deploymentName = config.deployment;
    this.apiVersion = config.apiVersion;
    this.defaultMaxTokens = config.maxTokens;
    this.requestTimeOutMs = config.timeout;

    this.apiClient = new ApiClient({
      baseURL: this.endpoint,
      headers: {
        'api-key': this.apiKey,
      },
      timeout: this.requestTimeOutMs,
    });
    this.setupInterceptors();
  }

  async generateSimpleResponse(
    prompt: string,
    temperature?: number,
    maxTokens?: number
  ): Promise<string> {
    const messages = [{ role: 'user' as const, content: prompt }];
    return this.generateResponse(messages, temperature, maxTokens);
  }
}
