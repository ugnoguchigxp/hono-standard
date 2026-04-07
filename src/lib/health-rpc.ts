import { client } from './api';

/**
 * `hc<AppType>` が `/v1/health` のネストを型に出さない場合の実行時クライアント。
 * 厳密な型は `pnpm openapi:types` で生成した型と併用する。
 */
// biome-ignore lint/suspicious/noExplicitAny: RPC ネストが AppType に載らないため
export const healthRpc: any = (client as any).v1.health;
