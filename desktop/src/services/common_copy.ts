import copy from './ui_copy.json';
const index = copy.index as Record<string, string>;
const english = copy.en as Record<string, string>;
// Legacy source literals map to stable catalog IDs; user data is never an ID.
export function commonText(text: string, language: 'vi' | 'en'): string {
  const key = index[text];
  const value = language === 'en' && key ? english[key] ?? text : text;
  return value.replace(/&amp;/g, '&');
}
