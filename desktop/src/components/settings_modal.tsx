import {Shield,History} from 'lucide-react';
import {SettingsShell,GeneralSettings,UpdatesSettings,AboutSettings,SupportSettings,commonSettingsTabs} from './shared/settings_ui';
import {useEffect,useState} from 'react';

import {ScanAccessPanel} from './scan_access_dialog';
import {OperationHistory} from './operation_history';
import {UpdatePanel} from './update_panel';
import {isTauriEnvironment} from '../services/tauri_bridge';
import packageInfo from '../../package.json';
import qrImage from '../assets/qr.png';
export type ThemeMode = 'system' | 'light' | 'dark';
type Language = 'vi' | 'en';
interface Props {
  isOpen: boolean; updateFocusRequest?: number; onClose: () => void;
  themeMode: ThemeMode; onChangeThemeMode: (mode: ThemeMode) => void;
  language: Language; onChangeLanguage: (language: Language) => void;
}
export function SettingsModal({isOpen, updateFocusRequest = 0, onClose, themeMode, onChangeThemeMode, language, onChangeLanguage}: Props) {

  const vi = language === 'vi';
  const [tab, setTab] = useState('general');
  const [version, setVersion] = useState(packageInfo.version);
  useEffect(() => {if(updateFocusRequest) setTab('updates');}, [updateFocusRequest]);
  useEffect(() => {if(isTauriEnvironment()) void import('@tauri-apps/api/app').then(m => m.getVersion()).then(setVersion).catch(console.error);}, []);

  if(!isOpen) return null;

  const heading = 'text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-400 mb-3';
return (<SettingsShell theme={themeMode} appName="VXClean" language={language} tabs={[commonSettingsTabs(language)[0], {id:'system',label:vi?'Quyền truy cập':'Access permissions',icon:<Shield size={16}/>} ,{id:'history',label:vi?'Lịch sử thao tác':'Operation history',icon:<History size={16}/>} , ...commonSettingsTabs(language).slice(1)]} activeTab={tab} onTabChange={id=>setTab(id as string)} onClose={onClose} onReset={() => onChangeThemeMode('system')}   >{tab === 'system' && (<><h4 className={heading}>{vi?'Quyền truy cập dữ liệu':'Data access permissions'}</h4><ScanAccessPanel language={language}/></>)}
{tab === 'history' && (<OperationHistory mode="history" language={language}/>)}
{tab === 'general' && <GeneralSettings language={language} theme={themeMode} themes={['system','dark','light']} onThemeChange={onChangeThemeMode} onLanguageChange={onChangeLanguage} />}
{tab === 'updates' && <UpdatesSettings language={language} version={version}><UpdatePanel language={language}/></UpdatesSettings>}
{tab === 'about' && <AboutSettings language={language} appName="VXClean" version={version}  description={vi ? 'Theo dõi tài nguyên hệ thống, kiểm tra dung lượng và dọn dữ liệu không cần thiết. Xem lại các mục đã chọn trước khi thực hiện thao tác.' : 'Monitor system resources, inspect storage and clean unnecessary data. Review selected items before performing an operation.'} repository="https://github.com/linhbv94/VXClean" icon={<Shield/>}  />}
{tab === 'support' && <SupportSettings language={language} qrSource={qrImage}/>}</SettingsShell>);
}
