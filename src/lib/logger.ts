/**
 * @fileoverview Frontend context logger
 */

export const createContextLogger = (context: string) => {
  return {
    info: (message: string, data?: any) => {
      console.log(`[${context}] INFO: ${message}`, data || '');
    },
    warn: (message: string, data?: any) => {
      console.warn(`[${context}] WARN: ${message}`, data || '');
    },
    error: (message: string, data?: any) => {
      console.error(`[${context}] ERROR: ${message}`, data || '');
    },
    debug: (message: string, data?: any) => {
      console.debug(`[${context}] DEBUG: ${message}`, data || '');
    },
  };
};
