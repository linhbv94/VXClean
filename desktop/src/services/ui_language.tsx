import {createContext, useContext, useCallback, useRef} from 'react';
import {commonText} from './common_copy';
type Language = 'vi' | 'en';
const CleanLanguage = createContext<Language>('vi');
export const CleanLanguageProvider = CleanLanguage.Provider;
type Copy = ((text: string) => string) & {language: Language};
export function useCleanText(): Copy {
  const language = useContext(CleanLanguage);
  const current = useRef(language);
  current.current = language;
  // Stable callbacks read current copy without restarting scans or operations.
  const translate = useCallback((text: string) => commonText(text, current.current), []) as Copy;
  translate.language = language;
  return translate;
}
