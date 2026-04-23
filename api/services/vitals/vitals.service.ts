import { connect } from 'node:net';

const SOCKET_PATH = '/tmp/vitals_daemon.sock';

export interface VitalsAnalysisResult {
  heart_rate_bpm: number;
  respiratory_rate: number;
  quality_score: number;
  confidence: number;
  rmssd?: number;
  sdnn?: number;
  lf?: number;
  hf?: number;
  lf_hf_ratio?: number;
  stress_level?: number;
  autonomic_balance?: number;
  dark_circle_index?: number;
  edema_index?: number;
  puffiness_index?: number;
  lip_index?: number;
  sunken_cheek_index?: number;
  drowsiness_index?: number;
  inebriation_level?: number;
  anemia_index?: number;
  fatigue_index?: number;
  status: string;
  message?: string;
}

export class VitalsService {
  /**
   * Pythonデーモンにデータを送信し、解析結果を取得する
   */
  async analyzeVitals(data: {
    forehead: { r: number[]; g: number[]; b: number[] };
    left_cheek: { r: number[]; g: number[]; b: number[] };
    right_cheek: { r: number[]; g: number[]; b: number[] };
  }): Promise<VitalsAnalysisResult> {
    return new Promise((resolve, reject) => {
      const client = connect(SOCKET_PATH);

      let responseData = '';

      client.on('connect', () => {
        const payload = JSON.stringify({
          op: 'ANALYZE_HR',
          data: data,
        });
        client.write(payload);
      });

      client.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      client.on('end', () => {
        try {
          const result = JSON.parse(responseData) as VitalsAnalysisResult;
          resolve(result);
        } catch (_e) {
          reject(new Error('Failed to parse daemon response'));
        }
      });

      client.on('error', (err) => {
        reject(new Error(`Vitals daemon connection error: ${err.message}`));
      });

      // タイムアウト設定 (解析には数秒かかる可能性があるため)
      client.setTimeout(10000, () => {
        client.destroy();
        reject(new Error('Vitals daemon analysis timeout'));
      });
    });
  }
}

export const vitalsService = new VitalsService();
