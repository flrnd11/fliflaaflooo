import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  FileQuestion,
  Mic,
  BookOpen,
  FileDown,
  Wifi,
  WifiOff,
  RefreshCw,
  Globe,
  Layers,
  Sparkles,
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../data/surveyDefaults';

export type NavTab = 'analytics' | 'surveys' | 'interview' | 'bank' | 'reports' | 'sync';

interface HeaderProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeLanguage: string;
  onLanguageChange: (lang: string) => void;
  onQuickSync: () => void;
  isSyncing: boolean;
  onOpenCopilot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  activeLanguage,
  onLanguageChange,
  onQuickSync,
  isSyncing,
  onOpenCopilot,
}) => {
  const [isOffline, setIsOffline] = useState(storageService.isOfflineMode());
  const [pendingCount, setPendingCount] = useState(storageService.getSyncQueue().length);

  useEffect(() => {
    const handleNetworkChange = () => {
      setIsOffline(storageService.isOfflineMode());
      setPendingCount(storageService.getSyncQueue().length);
    };

    window.addEventListener('app_network_status_change', handleNetworkChange);
    window.addEventListener('app_sync_queue_change', handleNetworkChange);

    return () => {
      window.removeEventListener('app_network_status_change', handleNetworkChange);
      window.removeEventListener('app_sync_queue_change', handleNetworkChange);
    };
  }, []);

  const toggleOffline = () => {
    const nextState = !isOffline;
    storageService.setOfflineMode(nextState);
    setIsOffline(nextState);
  };

  const navItems = [
    { id: 'surveys' as NavTab, label: '1. Questioner & Surveys', icon: FileQuestion, badge: null },
    { id: 'interview' as NavTab, label: '2. Conduct Interview', icon: Mic, badge: 'Live' },
    { id: 'analytics' as NavTab, label: '3. Data Analytics', icon: BarChart3, badge: null },
    { id: 'reports' as NavTab, label: '4. Export & Reports', icon: FileDown, badge: null },
    { id: 'bank' as NavTab, label: 'Question Bank', icon: BookOpen, badge: null },
    {
      id: 'sync' as NavTab,
      label: 'Sync Vault',
      icon: Layers,
      badge: pendingCount > 0 ? `${pendingCount}` : null,
      badgeColor: 'bg-amber-500',
    },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Identity */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectTab('surveys')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white">
                  AI Survey Instrument
                </span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Easy Mode
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Simple Field Interviews · Question Assistance · Philippine Dialects
              </p>
            </div>
          </div>

          {/* Quick Controls: Copilot Assistant, Offline Toggle, Language Switcher, Sync Indicator */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* UGNAYai Chatbot Button */}
            <button
              onClick={onOpenCopilot}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-indigo-500/25 transition-all transform hover:scale-[1.02]"
              title="Open UGNAYai Field Interview Copilot"
            >
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>UGNAYai</span>
            </button>

            {/* Offline Simulator Switch */}
            <button
              onClick={toggleOffline}
              title={isOffline ? 'Currently simulating Offline Field Mode' : 'Connected Online'}
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                isOffline
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/80 shadow-inner'
                  : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60'
              }`}
            >
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Online</span>
                </>
              )}
            </button>

            {/* Sync Pulse / Action */}
            <button
              onClick={onQuickSync}
              disabled={isSyncing || pendingCount === 0}
              title={
                pendingCount > 0
                  ? `${pendingCount} survey session(s) pending encrypted sync`
                  : 'All field submissions synced'
              }
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                pendingCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-400 cursor-default'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-white' : ''}`} />
              <span className="hidden md:inline">Sync</span>
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-900 rounded-full text-[10px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Language Selector Dropdown */}
            <div className="relative flex items-center bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1">
              <Globe className="w-3.5 h-3.5 text-slate-400 mr-1.5 hidden sm:inline" />
              <select
                value={activeLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1"
                aria-label="Active Language Toggle"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-200">
                    {lang.name} {lang.isPhilippine ? '🇵🇭' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors relative ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      item.badgeColor
                        ? `${item.badgeColor} text-white`
                        : 'bg-indigo-500/30 text-indigo-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                {isActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
