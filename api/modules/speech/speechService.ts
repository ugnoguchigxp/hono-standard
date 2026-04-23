/**
 * Azure AI Speech Service (Refactored)
 * Server-side integration for Azure Speech Services
 */

import { logger } from '@api/lib/logger';

// Azure Speech SDK types - conditional import for build compatibility
let _SpeechSDK: any;
try {
  _SpeechSDK = require('microsoft-cognitiveservices-speech-sdk');
} catch {
  _SpeechSDK = {
    SpeechConfig: { fromSubscription: () => ({}) },
    AudioConfig: { fromWavFileInput: () => ({}) },
    SpeechRecognizer: class {
      recognizeOnceAsync() {}
      close() {}
    },
    SpeechSynthesizer: class {
      speakTextAsync() {}
      close() {}
    },
    ResultReason: { RecognizedSpeech: 3, NoMatch: 2, SynthesizingAudioCompleted: 3 },
    CancellationReason: { Error: 1 },
  };
}

export interface ISpeechConfig {
  subscriptionKey: string;
  region: string;
  language?: string;
  voiceName?: string;
  rate?: number;
  pitch?: number;
}

export interface ISpeechRecognitionResult {
  text: string;
  confidence: number;
  isPartial: boolean;
}

export interface ISpeechSynthesisResult {
  audioData: Buffer;
  duration: number;
  format: string;
}

export class SpeechService {
  private config: ISpeechConfig | null = null;

  constructor() {
    this.initializeFromEnvironment();
  }

  private initializeFromEnvironment(): void {
    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'japaneast';
    const language = process.env.AZURE_SPEECH_LANGUAGE || 'ja-JP';

    if (subscriptionKey && region) {
      this.config = { subscriptionKey, region, language };
      logger.info({ region, language }, 'Azure Speech Service initialized');
    } else {
      logger.error('Azure Speech Service not configured correctly in .env');
    }
  }

  public isAvailable(): boolean {
    return !!(this.config?.subscriptionKey && this.config?.region);
  }

  public async getAuthToken(): Promise<string> {
    if (!this.config) throw new Error('Speech service not configured');

    try {
      const response = await fetch(
        `https://${this.config.region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
        {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
            'Content-Length': '0',
          },
        }
      );

      if (!response.ok) throw new Error(`Failed to get auth token: ${response.status}`);
      return await response.text();
    } catch (error) {
      logger.error({ error }, 'Failed to generate Azure Speech token');
      throw error;
    }
  }

  public getRegion(): string | undefined {
    return this.config?.region;
  }
}
