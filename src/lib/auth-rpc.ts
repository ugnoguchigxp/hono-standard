import { client } from './api';

/**
 * `hc<AppType>` の型に auth の OpenAPI ルートが載り切らないため、
 * 実行時クライアントを別名で取り出す。
 */
// biome-ignore lint/suspicious/noExplicitAny: auth router の型が hc に反映されないため
export const authRpc: any = (client as any).auth;
