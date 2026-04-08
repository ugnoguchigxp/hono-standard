import { type ClassValue, clsx } from 'clsx';

import { extendTailwindMerge } from 'tailwind-merge';

const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['ui'] }],
    },
  },
});

/**
 * クラス名を条件に応じて結合し、Tailwind CSSのクラス衝突を解決するユーティリティ。
 */
export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}
