import React, { useState, useEffect, useRef } from 'react';
import {
  Survey,
  Question,
  InterviewSession,
  Respondent,
  InterviewNote,
  InterviewType,
} from '../../types/survey';
import {
  Play,
  Square,
  Mic,
  MicOff,
  Users,
  User,
  Shuffle,
  Clock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Volume2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ArrowRight,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { LIKERT_TEMPLATES, SUPPORTED_LANGUAGES } from '../../data/surveyDefaults';
import { storageService } from '../../services/storageService';
import { geminiService } from '../../services/geminiService';

interface InterviewRunnerProps {
  surveys: Survey[];
  initialSurveyId?: string;
  onSessionComplete: (session: InterviewSession) => void;
  onOpenCopilot?: (initialQuery?: string) => void;
  externalNoteToAdd?: string | null;
  onClearExternalNote?: () => void;
}

export const InterviewRunner: React.FC<InterviewRunnerProps> = ({
  surveys,
  initialSurveyId,
  onSessionComplete,
  onOpenCopilot,
  externalNoteToAdd,
  onClearExternalNote,
}) => {
  // Session Configuration State
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>(
    initialSurveyId || surveys[0]?.id || ''
  );
  const [interviewMode, setInterviewMode] = useState<'individual' | 'group' | 'random'>('individual');
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);

  // Respondents Setup State
  const [individualRespondent, setIndividualRespondent] = useState<Respondent>({
    id: `resp_${Date.now()}`,
    name: 'Juan Dela Cruz',
    cohortGroup: 'Community Members',
    demographics: { age: '35', gender: 'Male', location: 'Barangay Central', role: 'Resident' },
    languagePreference: 'en',
    attendanceStatus: 'in_progress',
  });

  const [groupRespondents, setGroupRespondents] = useState<Respondent[]>([
    {
      id: `resp_g1_${Date.now()}`,
      name: 'Maria Santos',
      cohortGroup: 'Parents Association',
      demographics: { age: '42', gender: 'Female', location: 'Purok 1', role: 'Member' },
      languagePreference: 'tl',
      attendanceStatus: 'in_progress',
    },
    {
      id: `resp_g2_${Date.now()}`,
      name: 'Elena Ramos',
      cohortGroup: 'Parents Association',
      demographics: { age: '38', gender: 'Female', location: 'Purok 2', role: 'Treasurer' },
      languagePreference: 'tl',
      attendanceStatus: 'completed',
    },
  ]);

  const [groupName, setGroupName] = useState('Focus Group Cluster A');
  const [groupFacilitator, setGroupFacilitator] = useState('Research Field Lead');
  const [groupConsensus, setGroupConsensus] = useState('');
  const [groupDissent, setGroupDissent] = useState('');

  // Random Mode Config
  const [randomizeOrder, setRandomizeOrder] = useState<boolean>(true);
  const [randomSubsetCount, setRandomSubsetCount] = useState<number>(5);

  // Active Running Session State
  const [activeSession, setActiveSession] = useState<InterviewSession | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(0);
  const [activeLanguage, setActiveLanguage] = useState<string>('en');

  // Audio Recording Simulation State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Notes state
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState<'observation' | 'quote' | 'flag' | 'consensus'>('observation');

  // UGNAYai Inline Direct Answer state
  const [directUgnayTip, setDirectUgnayTip] = useState<string | null>(null);
  const [isLoadingDirectTip, setIsLoadingDirectTip] = useState<boolean>(false);

  useEffect(() => {
    setDirectUgnayTip(null);
  }, [activeQuestionIndex]);

  // Current survey object
  const activeSurvey = surveys.find((s) => s.id === selectedSurveyId) || surveys[0];

  // Prepared Questions for this session (shuffled or subset if random mode)
  const [sessionQuestions, setSessionQuestions] = useState<Question[]>([]);

  // Direct Answer Query
  const handleRequestDirectAnswer = async (type: 'simplify' | 'probe' | 'tagalog' | 'bisaya') => {
    const curQ = sessionQuestions[activeQuestionIndex];
    if (!curQ) return;
    setIsLoadingDirectTip(true);
    try {
      const qText = getLocalizedQuestionText(curQ);
      let query = '';
      if (type === 'simplify') {
        query = `Give the direct simplified question only (no preamble or tips) for: "${qText}"`;
      } else if (type === 'probe') {
        query = `Give a direct probing question only (no preamble or tips) for: "${qText}"`;
      } else if (type === 'tagalog') {
        query = `Give the direct polite Tagalog question with 'po/opo' only (no preamble) for: "${curQ.text}"`;
      } else if (type === 'bisaya') {
        query = `Give the direct conversational Cebuano/Bisaya question only (no preamble) for: "${curQ.text}"`;
      }

      const answer = await geminiService.askCopilot(query, [], {
        activeQuestion: curQ.text,
        activeLanguage,
        surveyTitle: activeSurvey?.title,
        interviewType: activeSurvey?.interviewType,
      });
      setDirectUgnayTip(answer);
    } catch {
      setDirectUgnayTip('Maaari po ba kayong magbigay ng isang partikular na halimbawa?');
    } finally {
      setIsLoadingDirectTip(false);
    }
  };

  // Start Session
  const handleStartInterview = () => {
    if (!activeSurvey) return;

    let questionsPool = [...activeSurvey.questions];
    let drawnIds: string[] = [];

    if (interviewMode === 'random') {
      if (randomizeOrder) {
        // Fisher-Yates shuffle
        for (let i = questionsPool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questionsPool[i], questionsPool[j]] = [questionsPool[j], questionsPool[i]];
        }
      }
      if (randomSubsetCount > 0 && randomSubsetCount < questionsPool.length) {
        questionsPool = questionsPool.slice(0, randomSubsetCount);
      }
      drawnIds = questionsPool.map((q) => q.id);
    }

    setSessionQuestions(questionsPool);

    const respondentsList =
      interviewMode === 'group' ? groupRespondents : [individualRespondent];

    const session: InterviewSession = {
      id: `sess_${Date.now()}`,
      surveyId: activeSurvey.id,
      surveyTitle: activeSurvey.title,
      interviewMode,
      interviewType: activeSurvey.interviewType,
      startedAt: new Date().toISOString(),
      respondents: respondentsList,
      groupDetails:
        interviewMode === 'group'
          ? {
              groupName,
              facilitator: groupFacilitator,
              consensusNotes: '',
              dissentNotes: '',
            }
          : undefined,
      randomConfig:
        interviewMode === 'random'
          ? {
              isRandomizedOrder: randomizeOrder,
              drawnQuestionIds: drawnIds,
              totalPoolCount: activeSurvey.questions.length,
            }
          : undefined,
      responses: {},
      notes: [],
      syncStatus: 'synced',
    };

    setActiveSession(session);
    setActiveQuestionIndex(0);
    setActiveLanguage(activeSurvey.primaryLanguage || 'en');
    setNotes([]);
    setRecordingSeconds(0);
    setIsRecording(true);
    setIsSessionActive(true);
  };

  // Timer effect for recording simulation
  useEffect(() => {
    let interval: any;
    if (isSessionActive && isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isSessionActive, isRecording]);

  // Audio Waveform Canvas Animation Effect
  useEffect(() => {
    if (!isRecording || !waveformCanvasRef.current) return;
    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let step = 0;

    const render = () => {
      step++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 28;
      const width = canvas.width / bars;

      for (let i = 0; i < bars; i++) {
        const height = Math.abs(Math.sin((step + i * 15) * 0.08) * (canvas.height * 0.75)) + 4;
        const x = i * width;
        const y = (canvas.height - height) / 2;

        ctx.fillStyle = '#6366f1';
        ctx.fillRect(x + 1, y, width - 2, height);
      }
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isRecording]);

  // Answer Logging
  const handleLogAnswer = (
    questionId: string,
    respondentId: string,
    value: string | number,
    numericScore?: number
  ) => {
    if (!activeSession) return;
    const currentResponses = { ...(activeSession.responses || {}) };
    const qRespList = [...(currentResponses[questionId] || [])];

    // Simple heuristic sentiment for text
    let sentimentObj = undefined;
    if (typeof value === 'string' && value.length > 5) {
      const lower = value.toLowerCase();
      if (lower.includes('good') || lower.includes('salamat') || lower.includes('ayos') || lower.includes('maayo')) {
        sentimentObj = { score: 0.8, label: 'positive' as const, keywords: ['positive feedback'], emotion: 'Hopeful' };
      } else if (lower.includes('hirap') || lower.includes('kulang') || lower.includes('problema') || lower.includes('delay')) {
        sentimentObj = { score: -0.7, label: 'negative' as const, keywords: ['barrier', 'delay'], emotion: 'Frustrated' };
      }
    }

    const newResponse = {
      respondentId,
      questionId,
      value,
      numericScore: numericScore ?? (typeof value === 'number' ? value : undefined),
      answeredAt: new Date().toISOString(),
      sentiment: sentimentObj,
    };

    const existingIndex = qRespList.findIndex((r) => r.respondentId === respondentId);
    if (existingIndex >= 0) {
      qRespList[existingIndex] = newResponse;
    } else {
      qRespList.push(newResponse);
    }

    currentResponses[questionId] = qRespList;
    setActiveSession({ ...activeSession, responses: currentResponses });
  };

  // Add Note
  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const note: InterviewNote = {
      id: `note_${Date.now()}`,
      timestamp: formatTime(recordingSeconds),
      author: 'Interviewer',
      content: newNoteText.trim(),
      type: newNoteType,
    };
    setNotes([note, ...notes]);
    setNewNoteText('');
  };

  // Sync incoming note from Copilot Chatbot
  useEffect(() => {
    if (externalNoteToAdd) {
      const note: InterviewNote = {
        id: `note_copilot_${Date.now()}`,
        timestamp: formatTime(recordingSeconds),
        author: 'Copilot Advice',
        content: externalNoteToAdd,
        type: 'observation',
      };
      setNotes((prev) => [note, ...prev]);
      onClearExternalNote?.();
    }
  }, [externalNoteToAdd]);

  // Complete & Save Session
  const handleFinishInterview = () => {
    if (!activeSession) return;
    const completedSession: InterviewSession = {
      ...activeSession,
      completedAt: new Date().toISOString(),
      notes,
      groupDetails:
        interviewMode === 'group'
          ? {
              groupName,
              facilitator: groupFacilitator,
              consensusNotes: groupConsensus,
              dissentNotes: groupDissent,
            }
          : undefined,
      audioRecording: {
        durationSeconds: recordingSeconds,
        isRecording: false,
        transcript: `[00:00] Session commenced for ${activeSession.surveyTitle}... [${formatTime(
          recordingSeconds
        )}] Session concluded with ${activeSession.respondents.length} participant(s).`,
      },
    };

    const { session, queuedOffline } = storageService.saveSession(completedSession);
    onSessionComplete(session);
    setIsSessionActive(false);
    setActiveSession(null);

    alert(
      queuedOffline
        ? `Session saved to Encrypted Offline Vault! (${session.encryptedHash}). It will sync automatically when online.`
        : `Interview Session successfully completed and recorded!`
    );
  };

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQ = sessionQuestions[activeQuestionIndex];

  // Helper to get translated question text
  const getLocalizedQuestionText = (q: Question) => {
    if (activeLanguage === 'en' || !q.translations) return q.text;
    return q.translations[activeLanguage] || q.text;
  };

  // Helper to get localized Likert label
  const getLocalizedLikertLabel = (option: any) => {
    if (activeLanguage === 'tl' && option.tagalog) return option.tagalog;
    if (activeLanguage === 'ceb' && option.bisaya) return option.bisaya;
    if (activeLanguage === 'ilo' && option.ilocano) return option.ilocano;
    return option.label;
  };

  // 1. SETUP VIEW (Before starting)
  if (!isSessionActive) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Mic className="w-6 h-6 text-indigo-400" />
            Interview Session Dispatch & Execution
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Choose an interview mode: Individual (1-on-1), Group (Focus Group Discussion), or Random (unbiased sampling/shuffling). Supports audio recording, note-taking, and live dialect toggling.
          </p>
        </div>

        {/* Step 1: Select Survey & Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Mode Selector Cards */}
          <div
            onClick={() => setInterviewMode('individual')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              interviewMode === 'individual'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
              <User className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Individual Interview</h3>
            <p className="text-xs text-slate-400 mt-1">
              One-on-one session with focused respondent attention, probe cues, and detailed transcript notes.
            </p>
          </div>

          <div
            onClick={() => setInterviewMode('group')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              interviewMode === 'group'
                ? 'bg-purple-950/40 border-purple-500 shadow-lg shadow-purple-500/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Group Interview</h3>
            <p className="text-xs text-slate-400 mt-1">
              Focus group session with multiple participants, live response matrix, and consensus/dissent tracking.
            </p>
          </div>

          <div
            onClick={() => setInterviewMode('random')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              interviewMode === 'random'
                ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
              <Shuffle className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-white text-base">Random Interview</h3>
            <p className="text-xs text-slate-400 mt-1">
              Randomized question order or sampling subset to eliminate ordering and priming bias in field surveys.
            </p>
          </div>
        </div>

        {/* Step 2: Configuration & Participant Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <h2 className="text-base font-bold text-white">Session Configuration & Roster</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Select Survey Instrument
              </label>
              <select
                value={selectedSurveyId}
                onChange={(e) => setSelectedSurveyId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.questions.length} questions — {s.interviewType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Default Primary Language
              </label>
              <select
                value={activeLanguage}
                onChange={(e) => setActiveLanguage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} {l.isPhilippine ? '🇵🇭' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Random mode specifics */}
          {interviewMode === 'random' && (
            <div className="p-4 bg-slate-800/60 rounded-xl border border-emerald-500/30 space-y-3">
              <h3 className="text-xs font-bold text-emerald-300 uppercase">Randomization Settings</h3>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={randomizeOrder}
                    onChange={(e) => setRandomizeOrder(e.target.checked)}
                    className="rounded bg-slate-900 text-emerald-500 focus:ring-0"
                  />
                  <span>Randomize question presentation order</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Draw random subset:</span>
                  <input
                    type="number"
                    min={1}
                    max={activeSurvey.questions.length || 10}
                    value={randomSubsetCount}
                    onChange={(e) => setRandomSubsetCount(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1"
                  />
                  <span className="text-xs text-slate-400">
                    out of {activeSurvey.questions.length} questions in pool
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Individual respondent details */}
          {interviewMode !== 'group' && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase">Respondent Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Full Name</label>
                  <input
                    type="text"
                    value={individualRespondent.name}
                    onChange={(e) =>
                      setIndividualRespondent({ ...individualRespondent, name: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Cohort / Demographic Group</label>
                  <input
                    type="text"
                    value={individualRespondent.cohortGroup}
                    onChange={(e) =>
                      setIndividualRespondent({ ...individualRespondent, cohortGroup: e.target.value })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Location / Barangay</label>
                  <input
                    type="text"
                    value={individualRespondent.demographics.location}
                    onChange={(e) =>
                      setIndividualRespondent({
                        ...individualRespondent,
                        demographics: { ...individualRespondent.demographics, location: e.target.value },
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Group details */}
          {interviewMode === 'group' && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Group / Cluster Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-0.5">Facilitator Name</label>
                  <input
                    type="text"
                    value={groupFacilitator}
                    onChange={(e) => setGroupFacilitator(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-300">
                    Participants Roster ({groupRespondents.length})
                  </span>
                  <button
                    onClick={() => {
                      const newResp: Respondent = {
                        id: `resp_g_${Date.now()}`,
                        name: `Participant ${groupRespondents.length + 1}`,
                        cohortGroup: groupName,
                        demographics: { location: 'Local Area' },
                        languagePreference: 'tl',
                        attendanceStatus: 'in_progress',
                      };
                      setGroupRespondents([...groupRespondents, newResp]);
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                  >
                    + Add Participant
                  </button>
                </div>

                <div className="space-y-2">
                  {groupRespondents.map((resp, rIdx) => (
                    <div key={resp.id} className="flex items-center gap-2 bg-slate-800/40 p-2 rounded-lg text-xs">
                      <span className="w-5 text-center text-slate-500 font-bold">{rIdx + 1}</span>
                      <input
                        type="text"
                        value={resp.name}
                        onChange={(e) => {
                          const updated = [...groupRespondents];
                          updated[rIdx] = { ...resp, name: e.target.value };
                          setGroupRespondents(updated);
                        }}
                        placeholder="Respondent name"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                      />
                      <input
                        type="text"
                        value={resp.cohortGroup}
                        onChange={(e) => {
                          const updated = [...groupRespondents];
                          updated[rIdx] = { ...resp, cohortGroup: e.target.value };
                          setGroupRespondents(updated);
                        }}
                        placeholder="Role / Cohort"
                        className="w-40 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-300"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Launch Button */}
          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              onClick={handleStartInterview}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Begin Live Interview Session</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. LIVE INTERVIEW EXECUTION VIEW
  return (
    <div className="space-y-6">
      {/* Session Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                interviewMode === 'individual'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : interviewMode === 'group'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {interviewMode} Mode
            </span>
            <span className="text-xs text-slate-400">
              {activeSession?.surveyTitle}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1.5 text-rose-400 font-mono text-sm font-bold bg-rose-950/40 border border-rose-500/30 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>REC {formatTime(recordingSeconds)}</span>
            </div>

            {/* Audio Waveform visualization */}
            <canvas
              ref={waveformCanvasRef}
              width={120}
              height={26}
              className="bg-slate-950 rounded-lg border border-slate-800"
            />
          </div>
        </div>

        {/* Dialect / Language Switcher on the Fly */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1.5">
            <Globe className="w-4 h-4 text-indigo-400 mr-2" />
            <select
              value={activeLanguage}
              onChange={(e) => setActiveLanguage(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-900">
                  {l.name} {l.isPhilippine ? '🇵🇭' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleFinishInterview}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish & Save</span>
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
          <span>
            Question {activeQuestionIndex + 1} of {sessionQuestions.length}
          </span>
          <span className="text-indigo-400">
            {Math.round(((activeQuestionIndex + 1) / sessionQuestions.length) * 100)}% Complete
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <div
            style={{ width: `${((activeQuestionIndex + 1) / sessionQuestions.length) * 100}%` }}
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
          />
        </div>
      </div>

      {/* Main Execution Split View: Left (Question & Inputs), Right (Interviewer Notes) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Active Question Prompt & Interactive Response Inputs */}
        <div className="lg:col-span-2 space-y-6">
          {currentQ && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              {/* Question Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded">
                    {currentQ.type}
                  </span>
                  <span className="text-xs text-slate-400">
                    Question {activeQuestionIndex + 1} of {sessionQuestions.length}
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white leading-relaxed">
                  {getLocalizedQuestionText(currentQ)}
                </h2>

                {/* Show English original if dialect is active */}
                {activeLanguage !== 'en' && currentQ.text && (
                  <p className="text-xs text-slate-400 italic mt-1">
                    [EN]: {currentQ.text}
                  </p>
                )}

                {currentQ.guidanceNotes && (
                  <div className="mt-3 p-3 bg-slate-800/60 rounded-xl border border-indigo-500/20 text-xs text-slate-300">
                    <span className="font-semibold text-indigo-300">Enumerator Guidance: </span>
                    {currentQ.guidanceNotes}
                  </div>
                )}

                {/* UGNAYai In-Place Interview Assistant */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1 mr-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>UGNAYai Direct:</span>
                    </span>
                    <button
                      type="button"
                      disabled={isLoadingDirectTip}
                      onClick={() => handleRequestDirectAnswer('simplify')}
                      className="px-2.5 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      💡 Simplify
                    </button>
                    <button
                      type="button"
                      disabled={isLoadingDirectTip}
                      onClick={() => handleRequestDirectAnswer('probe')}
                      className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      🔍 Direct Probe
                    </button>
                    <button
                      type="button"
                      disabled={isLoadingDirectTip}
                      onClick={() => handleRequestDirectAnswer('tagalog')}
                      className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      🇵🇭 Tagalog with 'po'
                    </button>
                    <button
                      type="button"
                      disabled={isLoadingDirectTip}
                      onClick={() => handleRequestDirectAnswer('bisaya')}
                      className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      🌴 Bisaya
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenCopilot?.(
                          `Direct help for question: "${getLocalizedQuestionText(currentQ)}"`
                        )
                      }
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
                    >
                      💬 Chatbot
                    </button>
                  </div>

                  {/* Inline Direct Answer Banner */}
                  {isLoadingDirectTip && (
                    <div className="p-2.5 bg-slate-800/60 rounded-xl text-xs text-indigo-400 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>UGNAYai is generating direct answer...</span>
                    </div>
                  )}

                  {directUgnayTip && !isLoadingDirectTip && (
                    <div className="p-3 bg-indigo-950/50 border border-indigo-500/40 rounded-xl space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase font-bold text-indigo-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>UGNAYai Direct Answer (Ready to speak):</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(directUgnayTip);
                              alert('Direct answer copied to clipboard!');
                            }}
                            className="text-[11px] px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium transition-colors"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirectUgnayTip(null)}
                            className="text-slate-400 hover:text-white p-0.5"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-xs sm:text-sm font-semibold text-white leading-relaxed">
                        "{directUgnayTip}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Follow-up Probes Checklist if Semi-Structured */}
              {currentQ.probes && currentQ.probes.length > 0 && (
                <div className="p-4 bg-slate-800/40 rounded-xl border border-purple-500/30 space-y-2">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Follow-up Probing Checklist (Ask when relevant)
                  </span>
                  <div className="space-y-1.5">
                    {currentQ.probes.map((probe, pIdx) => (
                      <label key={pIdx} className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                        <input type="checkbox" className="mt-0.5 rounded bg-slate-900 text-purple-500" />
                        <span>{probe}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Inputs */}
              <div className="pt-2 border-t border-slate-800 space-y-4">
                <span className="text-xs font-bold text-slate-300 uppercase">
                  {interviewMode === 'group' ? 'Multi-Respondent Response Roster' : 'Record Respondent Answer'}
                </span>

                {/* Likert Scale Buttons if Likert */}
                {currentQ.type === 'likert' && (
                  <div className="space-y-4">
                    {activeSession?.respondents.map((resp) => {
                      const curAnswer = activeSession.responses[currentQ.id]?.find(
                        (r) => r.respondentId === resp.id
                      )?.value;

                      const templateId = currentQ.likertConfig?.templateId || '5_point_agreement';
                      const templ = LIKERT_TEMPLATES[templateId] || LIKERT_TEMPLATES['5_point_agreement'];

                      return (
                        <div key={resp.id} className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-xs font-semibold text-slate-300">{resp.name}</span>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {templ.options.map((opt) => {
                              const isSelected = curAnswer === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  onClick={() => handleLogAnswer(currentQ.id, resp.id, opt.value, opt.value)}
                                  className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                                    isSelected
                                      ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                  }`}
                                >
                                  <span className="text-base font-bold">{opt.value}</span>
                                  <span className="text-[10px] mt-0.5 font-medium leading-tight line-clamp-2">
                                    {getLocalizedLikertLabel(opt)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multiple Choice Radio Buttons */}
                {currentQ.type === 'multiple_choice' && (
                  <div className="space-y-4">
                    {activeSession?.respondents.map((resp) => {
                      const curAnswer = activeSession.responses[currentQ.id]?.find(
                        (r) => r.respondentId === resp.id
                      )?.value;

                      return (
                        <div key={resp.id} className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-xs font-semibold text-slate-300">{resp.name}</span>
                          <div className="space-y-2">
                            {(currentQ.options || ['Option A', 'Option B', 'Option C']).map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                onClick={() => handleLogAnswer(currentQ.id, resp.id, opt)}
                                className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center justify-between ${
                                  curAnswer === opt
                                    ? 'bg-indigo-600/30 border-indigo-500 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                }`}
                              >
                                <span>{opt}</span>
                                {curAnswer === opt && <CheckCircle2 className="w-4 h-4 text-indigo-400" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Open-Ended Narrative Inputs */}
                {currentQ.type === 'open_ended' && (
                  <div className="space-y-4">
                    {activeSession?.respondents.map((resp) => {
                      const curAnswer =
                        activeSession.responses[currentQ.id]?.find((r) => r.respondentId === resp.id)
                          ?.value || '';

                      return (
                        <div key={resp.id} className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-300">{resp.name}</span>
                            <span className="text-[10px] text-slate-400">Qualitative Response / Verbatim</span>
                          </div>
                          <textarea
                            rows={3}
                            value={String(curAnswer)}
                            onChange={(e) => handleLogAnswer(currentQ.id, resp.id, e.target.value)}
                            placeholder="Type respondent's response or dictated remarks..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Rating 1-10 Buttons */}
                {currentQ.type === 'rating' && (
                  <div className="space-y-4">
                    {activeSession?.respondents.map((resp) => {
                      const curAnswer = Number(
                        activeSession.responses[currentQ.id]?.find((r) => r.respondentId === resp.id)?.value
                      );

                      return (
                        <div key={resp.id} className="p-3 bg-slate-800/40 rounded-xl border border-slate-800 space-y-2">
                          <span className="text-xs font-semibold text-slate-300">{resp.name}</span>
                          <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                            {Array.from({ length: 10 }, (_, i) => i + 1).map((val) => (
                              <button
                                key={val}
                                onClick={() => handleLogAnswer(currentQ.id, resp.id, val, val)}
                                className={`py-2 rounded-lg border text-center font-bold text-xs ${
                                  curAnswer === val
                                    ? 'bg-emerald-600 border-emerald-400 text-white'
                                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
                                }`}
                              >
                                {val}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Group Consensus Notes if in Group Mode */}
                {interviewMode === 'group' && (
                  <div className="p-4 bg-slate-800/60 rounded-xl border border-purple-500/20 space-y-3">
                    <span className="text-xs font-bold text-purple-300 uppercase">
                      Group Facilitator Synthesis
                    </span>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Consensus Summary for this Topic
                      </label>
                      <textarea
                        rows={2}
                        value={groupConsensus}
                        onChange={(e) => setGroupConsensus(e.target.value)}
                        placeholder="Key points agreed upon by the majority..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400 block mb-1">
                        Dissenting Remarks or Outlier Opinions
                      </label>
                      <textarea
                        rows={2}
                        value={groupDissent}
                        onChange={(e) => setGroupDissent(e.target.value)}
                        placeholder="Minority perspectives or unresolved points..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Buttons: Previous / Next */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={() => setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1))}
                  disabled={activeQuestionIndex === 0}
                  className="flex items-center gap-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Question</span>
                </button>

                <div className="flex items-center gap-2">
                  {activeQuestionIndex < sessionQuestions.length - 1 ? (
                    <button
                      onClick={() => setActiveQuestionIndex(activeQuestionIndex + 1)}
                      className="flex items-center gap-1 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md transition-colors"
                    >
                      <span>Next Question</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinishInterview}
                      className="flex items-center gap-1.5 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Session</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Live Notes & Transcript Drawer */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Live Interviewer Field Notes
            </h3>

            {/* Note input box */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select
                  value={newNoteType}
                  onChange={(e) => setNewNoteType(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-white px-2 py-1"
                >
                  <option value="observation">Observation</option>
                  <option value="quote">Verbatim Quote</option>
                  <option value="flag">Flag / Follow-up</option>
                  <option value="consensus">Consensus Point</option>
                </select>
                <span className="text-[10px] text-slate-500 font-mono">
                  Timestamp: {formatTime(recordingSeconds)}
                </span>
              </div>

              <textarea
                rows={2}
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                placeholder="Log non-verbal cues, verbatim quotes, or flags..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />

              <button
                onClick={handleAddNote}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                + Add Timestamped Note
              </button>
            </div>

            {/* Notes List */}
            <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto pr-1">
              {notes.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No notes logged yet for this session.
                </div>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-indigo-400">[{n.timestamp}]</span>
                      <span className="uppercase font-bold text-slate-400">{n.type}</span>
                    </div>
                    <p className="text-slate-200">{n.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Security & Offline Vault Status Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>Offline Encrypted Storage Active</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Responses are serialized with local cryptographic signatures. If internet connectivity drops, submissions queue automatically without data loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
