/**
 * LocalStorage utility
 */

export const STORAGE_KEYS = {
  AI_TEXT_PROOFREADING_SETTINGS: 'ai_text_proofreading_settings',
  SPEECH_CHARACTER: 'speechCharacter',
} as const;

export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading localStorage key "${key}":`, error);
    return defaultValue;
  }
};

export const setToStorage = <T>(key: string, value: T): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing localStorage key "${key}":`, error);
    return false;
  }
};

export const removeFromStorage = (key: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
};

// Aliases for compatibility
export const getLocalStorage = getFromStorage;
export const setLocalStorage = setToStorage;
export const removeLocalStorage = removeFromStorage;
