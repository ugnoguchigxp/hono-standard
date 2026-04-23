/**
 * Print Utilities
 */

/**
 * Executes browser print command
 */
export const executePrint = (): void => {
  if (typeof window !== 'undefined') {
    window.print();
  }
};

/**
 * Opens print window (alias for executePrint to support existing usages)
 */
export const openPrintWindow = (_data?: any): void => {
  executePrint();
};
