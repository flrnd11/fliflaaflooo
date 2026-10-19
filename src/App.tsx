import React, { useState, useEffect } from 'react';
import { Header, NavTab } from './components/Header';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { SurveyCreator } from './components/creator/SurveyCreator';
import { InterviewRunner } from './components/interview/InterviewRunner';
import { QuestionBankView } from './components/bank/QuestionBankView';
import { ReportsView } from './components/reports/ReportsView';
import { OfflineSyncView } from './components/sync/OfflineSyncView';
import { InterviewerCopilotModal, CopilotContext } from './components/copilot/InterviewerCopilotModal';
import { storageService } from './services/storageService';
import { Survey, InterviewSession } from './types/survey';
import { Sparkles, MessageSquare } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('surveys');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<string>('en');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [interviewLaunchSurveyId, setInterviewLaunchSurveyId] = useState<string | undefined>(undefined);

  // AI Copilot Chatbot State
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [copilotContext, setCopilotContext] = useState<CopilotContext>({
    surveyTitle: '',
    interviewType: 'structured',
    activeLanguage: 'en',
    isQuestionnaireCreation: false,
  });
  const [externalNoteToAdd, setExternalNoteToAdd] = useState<string | null>(null);

  // Initialize data on mount
  useEffect(() => {
    const loadedSurveys = storageService.getSurveys();
    setSurveys(loadedSurveys);
    setSessions(storageService.getSessions());
    const lang = storageService.getActiveLanguage();
    setActiveLanguage(lang);

    if (loadedSurveys.length > 0) {
      setCopilotContext({
        surveyTitle: loadedSurveys[0].title,
        interviewType: loadedSurveys[0].interviewType,
        activeLanguage: lang,
        activeQuestion: loadedSurveys[0].questions[0]?.text,
        isQuestionnaireCreation: true,
      });
    }
  }, []);

  const handleLanguageChange = (lang: string) => {
    setActiveLanguage(lang);
    storageService.setActiveLanguage(lang);
    setCopilotContext((prev) => ({ ...prev, activeLanguage: lang }));
  };

  const handleSaveSurvey = (survey: Survey) => {
    storageService.saveSurvey(survey);
    setSurveys(storageService.getSurveys());
    setCopilotContext((prev) => ({
      ...prev,
      surveyTitle: survey.title,
      interviewType: survey.interviewType,
    }));
  };

  const handleDeleteSurvey = (id: string) => {
    storageService.deleteSurvey(id);
    setSurveys(storageService.getSurveys());
  };

  const handleLaunchInterview = (surveyId?: string) => {
    const sId = surveyId || surveys[0]?.id;
    setInterviewLaunchSurveyId(sId);
    const targetSurvey = surveys.find((s) => s.id === sId) || surveys[0];
    if (targetSurvey) {
      setCopilotContext({
        surveyTitle: targetSurvey.title,
        interviewType: targetSurvey.interviewType,
        activeLanguage,
        activeQuestion: targetSurvey.questions[0]?.text,
        isQuestionnaireCreation: false,
      });
    }
    setActiveTab('interview');
  };

  const handleSessionComplete = (session: InterviewSession) => {
    setSessions(storageService.getSessions());
    setActiveTab('analytics');
  };

  const handleQuickSync = async () => {
    if (storageService.isOfflineMode()) {
      alert('Currently in Offline Simulation Mode. Toggle to Online first to synchronize.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await storageService.syncPendingData('merge_latest');
      setSessions(storageService.getSessions());
      alert(
        `Synchronized ${result.syncedCount} item(s)! (${result.resolvedCount} conflicts evaluated & merged).`
      );
    } catch (err) {
      console.error('Quick sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Open Copilot Chatbot with optional initial question/query
  const handleOpenCopilot = (initialQuery?: string, activeQuestionText?: string) => {
    if (activeQuestionText) {
      setCopilotContext((prev) => ({ ...prev, activeQuestion: activeQuestionText }));
    }
    setIsCopilotOpen(true);
  };

  const handleInsertCopilotNote = (noteText: string) => {
    setExternalNoteToAdd(noteText);
    alert('Note added! Viewable in Interview Field Notes drawer.');
  };

  const handleApplyQuestionWording = (wording: string) => {
    navigator.clipboard.writeText(wording);
    alert(`UGNAYai wording ready: "${wording}"\n(Copied to clipboard for immediate questionnaire/interview use!)`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab !== 'interview') {
            setInterviewLaunchSurveyId(undefined);
          }
          setCopilotContext((prev) => ({
            ...prev,
            isQuestionnaireCreation: tab === 'surveys' || tab === 'bank',
          }));
        }}
        activeLanguage={activeLanguage}
        onLanguageChange={handleLanguageChange}
        onQuickSync={handleQuickSync}
        isSyncing={isSyncing}
        onOpenCopilot={() => handleOpenCopilot()}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'surveys' && (
          <SurveyCreator
            surveys={surveys}
            onSaveSurvey={handleSaveSurvey}
            onDeleteSurvey={handleDeleteSurvey}
            onLaunchInterview={handleLaunchInterview}
            onOpenCopilot={handleOpenCopilot}
          />
        )}

        {activeTab === 'interview' && (
          <InterviewRunner
            surveys={surveys}
            initialSurveyId={interviewLaunchSurveyId}
            onSessionComplete={handleSessionComplete}
            onOpenCopilot={handleOpenCopilot}
            externalNoteToAdd={externalNoteToAdd}
            onClearExternalNote={() => setExternalNoteToAdd(null)}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsDashboard
            surveys={surveys}
            sessions={sessions}
            onOpenInterview={handleLaunchInterview}
            onOpenCreator={() => setActiveTab('surveys')}
          />
        )}

        {activeTab === 'reports' && <ReportsView surveys={surveys} sessions={sessions} />}

        {activeTab === 'bank' && <QuestionBankView surveys={surveys} />}

        {activeTab === 'sync' && <OfflineSyncView />}
      </main>

      {/* Persistent Floating UGNAYai Trigger Button (Visible everywhere) */}
      {!isCopilotOpen && (
        <button
          onClick={() => handleOpenCopilot()}
          className="fixed bottom-5 right-5 z-40 flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm rounded-full shadow-2xl shadow-indigo-600/40 border border-white/20 transition-all duration-300 transform hover:scale-105 group"
          title="Open UGNAYai Field Interview Copilot"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-amber-300 animate-spin-slow group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950 animate-pulse" />
          </div>
          <span>UGNAYai</span>
          <span className="text-[10px] bg-white/20 text-white font-semibold px-1.5 py-0.5 rounded-full hidden sm:inline">
            Direct Interview Copilot
          </span>
        </button>
      )}

      {/* UGNAYai Chatbot Modal */}
      <InterviewerCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        context={copilotContext}
        onInsertNote={handleInsertCopilotNote}
        onApplyQuestionWording={handleApplyQuestionWording}
      />

      {/* Footer */}
      <footer className="print:hidden border-t border-slate-900 bg-slate-950 text-slate-400 py-6 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-200">AI Survey Instrument</span>
            <span>·</span>
            <span>Easy Mode for Field Interviewers & Questionnaire Designers</span>
          </div>

          <div className="flex items-center space-x-4 text-slate-400">
            <span>UGNAYai Field Copilot</span>
            <span>·</span>
            <span>Tagalog & Philippine Dialects</span>
            <span>·</span>
            <span>AES-256 Offline Vault</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
