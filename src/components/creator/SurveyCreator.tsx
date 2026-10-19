import React, { useState } from 'react';
import {
  Survey,
  Question,
  InterviewType,
  QuestionType,
  LikertTemplateId,
  QuestionBankItem,
} from '../../types/survey';
import {
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Sparkles,
  BookOpen,
  Save,
  Globe,
  Sliders,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  ArrowLeft,
  Edit3,
} from 'lucide-react';
import { LIKERT_TEMPLATES, SUPPORTED_LANGUAGES } from '../../data/surveyDefaults';
import { geminiService } from '../../services/geminiService';
import { storageService } from '../../services/storageService';

interface SurveyCreatorProps {
  surveys: Survey[];
  onSaveSurvey: (survey: Survey) => void;
  onDeleteSurvey: (id: string) => void;
  onLaunchInterview: (surveyId: string) => void;
  onOpenCopilot?: (initialQuery?: string, activeQuestionText?: string) => void;
}

export const SurveyCreator: React.FC<SurveyCreatorProps> = ({
  surveys,
  onSaveSurvey,
  onDeleteSurvey,
  onLaunchInterview,
  onOpenCopilot,
}) => {
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);

  // AI Generator Modal State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiInterviewType, setAiInterviewType] = useState<InterviewType>('structured');
  const [aiTargetAudience, setAiTargetAudience] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiFocusAreas, setAiFocusAreas] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Partial<Question>[]>([]);
  const [selectedAiIndices, setSelectedAiIndices] = useState<Set<number>>(new Set());

  // Question Bank Modal State
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankCategory, setBankCategory] = useState('all');

  // Translation in progress
  const [translatingQId, setTranslatingQId] = useState<string | null>(null);
  const [scoringQId, setScoringQId] = useState<string | null>(null);

  // UGNAYai Direct Assistance per question
  const [directUgnayAnswers, setDirectUgnayAnswers] = useState<Record<string, string>>({});
  const [loadingDirectQId, setLoadingDirectQId] = useState<string | null>(null);

  const handleAskUgnayAiDirect = async (
    qIndex: number,
    action: 'simplify' | 'probe' | 'tagalog' | 'bisaya'
  ) => {
    if (!editingSurvey) return;
    const targetQ = editingSurvey.questions[qIndex];
    if (!targetQ) return;

    setLoadingDirectQId(targetQ.id);
    try {
      let prompt = '';
      if (action === 'simplify') {
        prompt = `Give the direct simplified question prompt only (no preamble or tips) for: "${targetQ.text}"`;
      } else if (action === 'probe') {
        prompt = `Give a direct probing question only (no preamble or tips) for: "${targetQ.text}"`;
      } else if (action === 'tagalog') {
        prompt = `Give the direct polite Tagalog question with 'po/opo' only (no preamble) for: "${targetQ.text}"`;
      } else if (action === 'bisaya') {
        prompt = `Give the direct conversational Cebuano/Bisaya question only (no preamble) for: "${targetQ.text}"`;
      }

      const answer = await geminiService.askCopilot(prompt, [], {
        activeQuestion: targetQ.text,
        surveyTitle: editingSurvey.title,
        interviewType: editingSurvey.interviewType,
        isQuestionnaireCreation: true,
      });

      setDirectUgnayAnswers((prev) => ({
        ...prev,
        [targetQ.id]: answer,
      }));
    } catch {
      setDirectUgnayAnswers((prev) => ({
        ...prev,
        [targetQ.id]: 'Maaari po ba kayong magbigay ng isang partikular na halimbawa?',
      }));
    } finally {
      setLoadingDirectQId(null);
    }
  };

  // Start new survey
  const handleCreateNew = () => {
    const newSurvey: Survey = {
      id: `srv_${Date.now()}`,
      title: 'New Community Survey Instrument',
      description: 'Standard research instrument for field data gathering.',
      interviewType: 'structured',
      targetAudience: 'Community Members',
      primaryLanguage: 'en',
      supportedLanguages: ['en', 'tl', 'ceb'],
      category: 'General Assessment',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'draft',
      settings: {
        maxQuestionsLimit: 50,
        allowRandomQuestionOrder: false,
        defaultLikertTemplate: '5_point_agreement',
        supportedLanguages: ['en', 'tl', 'ceb'],
        offlineEncrypted: true,
      },
      questions: [
        {
          id: `q_${Date.now()}_1`,
          order: 1,
          text: 'How satisfied are you with the overall service provided?',
          type: 'likert',
          category: 'Service Satisfaction',
          tags: ['Satisfaction'],
          difficultyScore: 2,
          relevanceScore: 95,
          scoringRationale: 'Standard 5-point satisfaction metric.',
          likertConfig: {
            templateId: '5_point_satisfaction',
            points: 5,
            labels: LIKERT_TEMPLATES['5_point_satisfaction'].options.map((o) => o.label),
          },
          translations: {
            tl: 'Gaano ka nasisiyahan sa pangkalahatang serbisyong ibinigay?',
            ceb: 'Unsa ka kontento ka sa kinatibuk-ang serbisyo nga gihatag?',
          },
          required: true,
        },
      ],
    };
    setEditingSurvey(newSurvey);
  };

  const handleSave = () => {
    if (!editingSurvey) return;
    onSaveSurvey(editingSurvey);
    setEditingSurvey(null);
  };

  // Question manipulation
  const handleAddQuestion = () => {
    if (!editingSurvey) return;
    if (editingSurvey.questions.length >= 50) {
      alert('Maximum limit of 50 questions per survey title reached.');
      return;
    }
    const newQ: Question = {
      id: `q_${Date.now()}_${editingSurvey.questions.length + 1}`,
      order: editingSurvey.questions.length + 1,
      text: 'New survey question text',
      type: editingSurvey.interviewType === 'unstructured' ? 'open_ended' : 'likert',
      category: editingSurvey.category || 'General',
      tags: [],
      difficultyScore: 2,
      relevanceScore: 90,
      likertConfig:
        editingSurvey.interviewType === 'structured'
          ? {
              templateId: '5_point_agreement',
              points: 5,
              labels: LIKERT_TEMPLATES['5_point_agreement'].options.map((o) => o.label),
            }
          : undefined,
      probes: editingSurvey.interviewType !== 'structured' ? ['Can you elaborate on that experience?'] : undefined,
      required: true,
    };
    setEditingSurvey({
      ...editingSurvey,
      questions: [...editingSurvey.questions, newQ],
    });
  };

  const handleUpdateQuestion = (qIndex: number, updates: Partial<Question>) => {
    if (!editingSurvey) return;
    const qList = [...editingSurvey.questions];
    qList[qIndex] = { ...qList[qIndex], ...updates };
    setEditingSurvey({ ...editingSurvey, questions: qList });
  };

  const handleDeleteQuestion = (qIndex: number) => {
    if (!editingSurvey) return;
    const qList = editingSurvey.questions.filter((_, idx) => idx !== qIndex);
    const reordered = qList.map((q, idx) => ({ ...q, order: idx + 1 }));
    setEditingSurvey({ ...editingSurvey, questions: reordered });
  };

  const handleDuplicateQuestion = (qIndex: number) => {
    if (!editingSurvey) return;
    if (editingSurvey.questions.length >= 50) {
      alert('Limit of 50 questions reached.');
      return;
    }
    const target = editingSurvey.questions[qIndex];
    const cloned: Question = {
      ...target,
      id: `q_${Date.now()}_dup`,
      order: qIndex + 2,
      text: `${target.text} (Copy)`,
    };
    const qList = [...editingSurvey.questions];
    qList.splice(qIndex + 1, 0, cloned);
    const reordered = qList.map((q, idx) => ({ ...q, order: idx + 1 }));
    setEditingSurvey({ ...editingSurvey, questions: reordered });
  };

  const handleMoveQuestion = (qIndex: number, direction: 'up' | 'down') => {
    if (!editingSurvey) return;
    const newIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    if (newIndex < 0 || newIndex >= editingSurvey.questions.length) return;
    const qList = [...editingSurvey.questions];
    const [moved] = qList.splice(qIndex, 1);
    qList.splice(newIndex, 0, moved);
    const reordered = qList.map((q, idx) => ({ ...q, order: idx + 1 }));
    setEditingSurvey({ ...editingSurvey, questions: reordered });
  };

  // Run AI Question Generator
  const handleTriggerAiGenerate = async () => {
    if (!aiTopic.trim()) {
      alert('Please enter a survey topic or objective.');
      return;
    }
    setIsGeneratingAi(true);
    setGeneratedQuestions([]);
    setSelectedAiIndices(new Set());

    try {
      const generated = await geminiService.generateQuestions({
        topic: aiTopic,
        interviewType: aiInterviewType,
        targetAudience: aiTargetAudience || 'General respondents',
        count: aiCount,
        category: editingSurvey?.category || 'Field Study',
        focusAreas: aiFocusAreas,
      });

      setGeneratedQuestions(generated);
      // Select all by default
      const allIdx = new Set<number>();
      generated.forEach((_, idx) => allIdx.add(idx));
      setSelectedAiIndices(allIdx);
    } catch (err) {
      console.error('Failed to generate questions:', err);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Import selected AI questions into survey
  const handleImportAiQuestions = () => {
    if (!editingSurvey) return;
    const questionsToAdd: Question[] = [];
    let currentCount = editingSurvey.questions.length;

    generatedQuestions.forEach((gq, idx) => {
      if (selectedAiIndices.has(idx) && currentCount < 50) {
        currentCount++;
        const likertTemplate = (gq as any).likertTemplate as LikertTemplateId;
        const config =
          likertTemplate && LIKERT_TEMPLATES[likertTemplate]
            ? {
                templateId: likertTemplate,
                points: LIKERT_TEMPLATES[likertTemplate].points,
                labels: LIKERT_TEMPLATES[likertTemplate].options.map((o) => o.label),
              }
            : undefined;

        questionsToAdd.push({
          id: `q_${Date.now()}_ai_${idx}`,
          order: currentCount,
          text: gq.text || 'Untitled Question',
          type: gq.type || 'likert',
          category: gq.category || editingSurvey.category || 'General',
          tags: ['AI Generated'],
          difficultyScore: gq.difficultyScore || 2,
          relevanceScore: gq.relevanceScore || 92,
          scoringRationale: gq.scoringRationale,
          likertConfig: config,
          options: gq.options,
          probes: gq.probes,
          translations: gq.translations || {},
          required: true,
          guidanceNotes: gq.guidanceNotes,
        });
      }
    });

    setEditingSurvey({
      ...editingSurvey,
      questions: [...editingSurvey.questions, ...questionsToAdd],
    });
    setShowAiModal(false);
  };

  // AI Multilingual Translation for a Question
  const handleTranslateQuestion = async (qIndex: number) => {
    if (!editingSurvey) return;
    const targetQ = editingSurvey.questions[qIndex];
    setTranslatingQId(targetQ.id);

    try {
      const results = await geminiService.translateTexts(
        [targetQ.text],
        ['tl', 'ceb', 'ilo', 'hil', 'bik', 'war'],
        'en'
      );
      if (results && results.length > 0) {
        const transObj = { ...(targetQ.translations || {}), ...results[0].translations };
        handleUpdateQuestion(qIndex, { translations: transObj });
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingQId(null);
    }
  };

  // AI Score question difficulty & relevance
  const handleScoreQuestion = async (qIndex: number) => {
    if (!editingSurvey) return;
    const targetQ = editingSurvey.questions[qIndex];
    setScoringQId(targetQ.id);

    try {
      const result = await geminiService.scoreQuestion(
        targetQ.text,
        editingSurvey.title,
        editingSurvey.interviewType
      );
      handleUpdateQuestion(qIndex, {
        difficultyScore: result.difficultyScore,
        relevanceScore: result.relevanceScore,
        scoringRationale: result.scoringRationale,
      });
    } catch (err) {
      console.error('Scoring error:', err);
    } finally {
      setScoringQId(null);
    }
  };

  // Save question to Question Bank
  const handleSaveToBank = (q: Question) => {
    storageService.addQuestionToBank({
      ...q,
      domain: editingSurvey?.category || q.category || 'General',
    });
    alert(`Question saved to Question Bank!`);
  };

  // Bank items
  const bankItems = storageService.getQuestionBank().filter((b) => {
    if (bankCategory !== 'all' && b.domain !== bankCategory) return false;
    if (bankSearch && !b.text.toLowerCase().includes(bankSearch.toLowerCase())) return false;
    return true;
  });

  const handleImportBankQuestion = (b: QuestionBankItem) => {
    if (!editingSurvey) return;
    if (editingSurvey.questions.length >= 50) {
      alert('Limit of 50 questions reached.');
      return;
    }
    const newQ: Question = {
      ...b,
      id: `q_${Date.now()}_bank`,
      order: editingSurvey.questions.length + 1,
    };
    setEditingSurvey({
      ...editingSurvey,
      questions: [...editingSurvey.questions, newQ],
    });
    setShowBankModal(false);
  };

  // Render Survey List View if not editing
  if (!editingSurvey) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Sliders className="w-6 h-6 text-indigo-400" />
              Survey Instrument Creation & Question Management
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Supports up to 50 questions, AI question generation tailored to interview type, difficulty/relevance scoring, and question bank reuse.
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Survey</span>
          </button>
        </div>

        {/* Survey Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {surveys.map((survey) => {
            const likertCount = survey.questions.filter((q) => q.type === 'likert').length;
            const openCount = survey.questions.filter((q) => q.type === 'open_ended').length;

            return (
              <div
                key={survey.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        survey.interviewType === 'structured'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : survey.interviewType === 'semi-structured'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {survey.interviewType}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      {survey.questions.length} / 50 Qs
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-1">{survey.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{survey.description}</p>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Audience:</span>
                      <span className="font-medium text-slate-200 line-clamp-1">{survey.targetAudience}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Languages:</span>
                      <span className="font-medium text-indigo-300 uppercase">
                        {survey.supportedLanguages?.join(', ') || 'EN'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Composition:</span>
                      <span>
                        {likertCount} Likert, {openCount} Open/Probes
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingSurvey(survey)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete survey "${survey.title}"?`)) {
                          onDeleteSurvey(survey.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete survey"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => onLaunchInterview(survey.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Interview</span>
                    <Sparkles className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render Survey Editor View
  return (
    <div className="space-y-6">
      {/* Top Header of Editor */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditingSurvey(null)}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Back to surveys"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Editing: <span className="text-indigo-300">{editingSurvey.title}</span>
            </h1>
            <p className="text-xs text-slate-400">
              Capacity: <span className="font-bold text-white">{editingSurvey.questions.length} / 50</span> questions used.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              setAiTopic(editingSurvey.title);
              setAiInterviewType(editingSurvey.interviewType);
              setAiTargetAudience(editingSurvey.targetAudience);
              setShowAiModal(true);
            }}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Generate Questions</span>
          </button>

          <button
            onClick={() => setShowBankModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-all"
          >
            <BookOpen className="w-4 h-4" />
            <span>Question Bank</span>
          </button>

          <button
            onClick={handleSave}
            className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Survey</span>
          </button>
        </div>
      </div>

      {/* Survey Meta Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Survey Instrument Metadata</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Survey Title</label>
            <input
              type="text"
              value={editingSurvey.title}
              onChange={(e) => setEditingSurvey({ ...editingSurvey, title: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Interview Type</label>
            <select
              value={editingSurvey.interviewType}
              onChange={(e) =>
                setEditingSurvey({ ...editingSurvey, interviewType: e.target.value as InterviewType })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="structured">Structured Interview (Standardized / Likert)</option>
              <option value="semi-structured">Semi-Structured Interview (Questions + Probes)</option>
              <option value="unstructured">Unstructured Interview (Qualitative Narrative)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-400 mb-1">Research Description</label>
            <textarea
              rows={2}
              value={editingSurvey.description}
              onChange={(e) => setEditingSurvey({ ...editingSurvey, description: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Target Audience</label>
            <input
              type="text"
              value={editingSurvey.targetAudience}
              onChange={(e) => setEditingSurvey({ ...editingSurvey, targetAudience: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Questions List Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span>Questions</span>
          <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
            {editingSurvey.questions.length} / 50 Maximum
          </span>
        </h2>

        <button
          onClick={handleAddQuestion}
          disabled={editingSurvey.questions.length >= 50}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Question</span>
        </button>
      </div>

      {/* Questions Stack */}
      <div className="space-y-4">
        {editingSurvey.questions.map((q, idx) => {
          return (
            <div
              key={q.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all shadow-sm space-y-4"
            >
              {/* Question Card Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/30 text-indigo-300 font-bold text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <select
                    value={q.type}
                    onChange={(e) =>
                      handleUpdateQuestion(idx, {
                        type: e.target.value as QuestionType,
                        likertConfig:
                          e.target.value === 'likert'
                            ? {
                                templateId: '5_point_agreement',
                                points: 5,
                                labels: LIKERT_TEMPLATES['5_point_agreement'].options.map((o) => o.label),
                              }
                            : undefined,
                      })
                    }
                    className="bg-slate-800 border border-slate-700 text-xs font-semibold text-white rounded-lg px-2.5 py-1"
                  >
                    <option value="likert">Likert Scale</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="open_ended">Open-Ended (Qualitative)</option>
                    <option value="rating">Numeric Rating (1-10)</option>
                  </select>
                </div>

                {/* Actions: Move, Duplicate, Bank, Delete */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMoveQuestion(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                    title="Move question up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleMoveQuestion(idx, 'down')}
                    disabled={idx === editingSurvey.questions.length - 1}
                    className="p-1.5 text-slate-400 hover:text-white disabled:opacity-30"
                    title="Move question down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenCopilot?.(
                        `Give direct suggestions to improve, simplify, or rephrase this question (no preamble): "${q.text}"`,
                        q.text
                      )
                    }
                    className="p-1.5 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-600/20 rounded-lg flex items-center gap-1 text-xs font-semibold"
                    title="Ask UGNAYai to review or improve this question"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Ask UGNAYai</span>
                  </button>
                  <button
                    onClick={() => handleDuplicateQuestion(idx)}
                    className="p-1.5 text-slate-400 hover:text-indigo-300"
                    title="Duplicate question"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleSaveToBank(q)}
                    className="p-1.5 text-slate-400 hover:text-purple-300"
                    title="Save to Question Bank"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteQuestion(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-400"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Question Prompt</label>
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => handleUpdateQuestion(idx, { text: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-medium"
                />

                {/* UGNAYai Direct Assistant on Question */}
                <div className="pt-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-bold text-indigo-400 flex items-center gap-1 text-[11px] mr-1">
                      <Sparkles className="w-3 h-3" />
                      <span>UGNAYai Direct:</span>
                    </span>
                    <button
                      type="button"
                      disabled={loadingDirectQId === q.id}
                      onClick={() => handleAskUgnayAiDirect(idx, 'simplify')}
                      className="px-2 py-0.5 bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-700/60 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                    >
                      ⚡ Simplify
                    </button>
                    <button
                      type="button"
                      disabled={loadingDirectQId === q.id}
                      onClick={() => handleAskUgnayAiDirect(idx, 'probe')}
                      className="px-2 py-0.5 bg-purple-950/70 hover:bg-purple-900/90 text-purple-300 border border-purple-700/60 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                    >
                      🔍 Direct Probe
                    </button>
                    <button
                      type="button"
                      disabled={loadingDirectQId === q.id}
                      onClick={() => handleAskUgnayAiDirect(idx, 'tagalog')}
                      className="px-2 py-0.5 bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                    >
                      🇵🇭 Tagalog with 'po'
                    </button>
                    <button
                      type="button"
                      disabled={loadingDirectQId === q.id}
                      onClick={() => handleAskUgnayAiDirect(idx, 'bisaya')}
                      className="px-2 py-0.5 bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-700/60 rounded-md text-[11px] font-medium transition-colors disabled:opacity-50"
                    >
                      🌴 Bisaya
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenCopilot?.(
                          `Help refine this survey question directly: "${q.text}"`,
                          q.text
                        )
                      }
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-md text-[11px] transition-colors"
                    >
                      💬 Chatbot
                    </button>
                  </div>

                  {loadingDirectQId === q.id && (
                    <div className="p-2 bg-slate-800/60 rounded-lg text-xs text-indigo-400 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 animate-spin" />
                      <span>UGNAYai is formulating direct suggestion...</span>
                    </div>
                  )}

                  {directUgnayAnswers[q.id] && loadingDirectQId !== q.id && (
                    <div className="p-2.5 bg-indigo-950/60 border border-indigo-500/50 rounded-xl space-y-1.5 text-xs animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-indigo-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>UGNAYai Direct Answer:</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateQuestion(idx, { text: directUgnayAnswers[q.id] });
                              setDirectUgnayAnswers((prev) => {
                                const next = { ...prev };
                                delete next[q.id];
                                return next;
                              });
                            }}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded text-[10px] transition-colors"
                          >
                            ✓ Apply as Question Prompt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(directUgnayAnswers[q.id]);
                              alert('Direct answer copied!');
                            }}
                            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[10px]"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDirectUgnayAnswers((prev) => {
                                const next = { ...prev };
                                delete next[q.id];
                                return next;
                              })
                            }
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-white leading-relaxed">
                        "{directUgnayAnswers[q.id]}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Likert Scale Customizer if Likert */}
              {q.type === 'likert' && (
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-300">Likert Scale Template & Anchors</span>
                    <select
                      value={q.likertConfig?.templateId || '5_point_agreement'}
                      onChange={(e) => {
                        const tId = e.target.value as LikertTemplateId;
                        const templ = LIKERT_TEMPLATES[tId];
                        handleUpdateQuestion(idx, {
                          likertConfig: {
                            templateId: tId,
                            points: templ.points,
                            labels: templ.options.map((o) => o.label),
                          },
                        });
                      }}
                      className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1"
                    >
                      <option value="5_point_agreement">5-Point Agreement (Disagree to Agree)</option>
                      <option value="5_point_satisfaction">5-Point Satisfaction (Dissatisfied to Satisfied)</option>
                      <option value="7_point_satisfaction">7-Point Granular Satisfaction</option>
                      <option value="5_point_frequency">5-Point Frequency (Never to Always)</option>
                      <option value="5_point_importance">5-Point Importance (Not Important to Extremely)</option>
                      <option value="5_point_quality">5-Point Quality (Poor to Excellent)</option>
                      <option value="custom">Custom Scale</option>
                    </select>
                  </div>

                  {/* Likert Anchors List */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1">
                    {q.likertConfig?.labels.map((lbl, lIdx) => (
                      <div key={lIdx} className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-center">
                        <span className="text-[10px] text-slate-400 block font-bold">Pt {lIdx + 1}</span>
                        <input
                          type="text"
                          value={lbl}
                          onChange={(e) => {
                            const newLabels = [...(q.likertConfig?.labels || [])];
                            newLabels[lIdx] = e.target.value;
                            handleUpdateQuestion(idx, {
                              likertConfig: {
                                ...(q.likertConfig || { templateId: 'custom', points: 5, labels: [] }),
                                labels: newLabels,
                              },
                            });
                          }}
                          className="w-full bg-transparent text-xs text-center text-slate-200 focus:outline-none focus:border-b border-indigo-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up Probes if Semi-Structured or Unstructured */}
              {(editingSurvey.interviewType === 'semi-structured' ||
                editingSurvey.interviewType === 'unstructured' ||
                q.probes) && (
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-300">
                      Follow-up Probing Cues (Interviewer Prompts)
                    </span>
                    <button
                      onClick={() => {
                        const newProbes = [...(q.probes || []), 'New probe question'];
                        handleUpdateQuestion(idx, { probes: newProbes });
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      + Add Probe
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(q.probes || []).map((probe, pIdx) => (
                      <div key={pIdx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">•</span>
                        <input
                          type="text"
                          value={probe}
                          onChange={(e) => {
                            const newProbes = [...(q.probes || [])];
                            newProbes[pIdx] = e.target.value;
                            handleUpdateQuestion(idx, { probes: newProbes });
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                        />
                        <button
                          onClick={() => {
                            const newProbes = q.probes?.filter((_, i) => i !== pIdx);
                            handleUpdateQuestion(idx, { probes: newProbes });
                          }}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multiple Choice Options if MCQ */}
              {q.type === 'multiple_choice' && (
                <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300">Choice Options</span>
                    <button
                      onClick={() => {
                        const newOpts = [...(q.options || []), `Option ${(q.options || []).length + 1}`];
                        handleUpdateQuestion(idx, { options: newOpts });
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      + Add Option
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {(q.options || []).map((opt, oIdx) => (
                      <div key={oIdx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-bold">{oIdx + 1}.</span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...(q.options || [])];
                            newOpts[oIdx] = e.target.value;
                            handleUpdateQuestion(idx, { options: newOpts });
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                        />
                        <button
                          onClick={() => {
                            const newOpts = q.options?.filter((_, i) => i !== oIdx);
                            handleUpdateQuestion(idx, { options: newOpts });
                          }}
                          className="text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Multilingual Translations Accordion / Section */}
              <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    Multilingual Translations (Philippine Dialects & International)
                  </span>
                  <button
                    onClick={() => handleTranslateQuestion(idx)}
                    disabled={translatingQId === q.id}
                    className="text-xs bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className={`w-3 h-3 ${translatingQId === q.id ? 'animate-spin' : ''}`} />
                    <span>{translatingQId === q.id ? 'Translating...' : 'AI Auto-Translate Dialects'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Tagalog */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">
                      Tagalog (Filipino) 🇵🇭
                    </label>
                    <input
                      type="text"
                      value={q.translations?.tl || ''}
                      placeholder="Salin sa Tagalog..."
                      onChange={(e) =>
                        handleUpdateQuestion(idx, {
                          translations: { ...(q.translations || {}), tl: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs"
                    />
                  </div>

                  {/* Cebuano / Bisaya */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">
                      Cebuano / Bisaya 🇵🇭
                    </label>
                    <input
                      type="text"
                      value={q.translations?.ceb || ''}
                      placeholder="Hubad sa Binisaya..."
                      onChange={(e) =>
                        handleUpdateQuestion(idx, {
                          translations: { ...(q.translations || {}), ceb: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs"
                    />
                  </div>

                  {/* Ilocano */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">
                      Ilocano 🇵🇭
                    </label>
                    <input
                      type="text"
                      value={q.translations?.ilo || ''}
                      placeholder="Patarus iti Ilokano..."
                      onChange={(e) =>
                        handleUpdateQuestion(idx, {
                          translations: { ...(q.translations || {}), ilo: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs"
                    />
                  </div>

                  {/* Hiligaynon */}
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold block mb-0.5">
                      Hiligaynon (Ilonggo) 🇵🇭
                    </label>
                    <input
                      type="text"
                      value={q.translations?.hil || ''}
                      placeholder="Pahito sa Hiligaynon..."
                      onChange={(e) =>
                        handleUpdateQuestion(idx, {
                          translations: { ...(q.translations || {}), hil: e.target.value },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  AI Question Generator tailored to Interview Type
                </h3>
              </div>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Research Topic / Core Objective
                  </label>
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    placeholder="e.g. Public Health Delivery in Remote Municipalities"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Interview Type</label>
                  <select
                    value={aiInterviewType}
                    onChange={(e) => setAiInterviewType(e.target.value as InterviewType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="structured">Structured (Likert / Scales)</option>
                    <option value="semi-structured">Semi-Structured (Questions + Probes)</option>
                    <option value="unstructured">Unstructured (Conversational / Narrative)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Target Audience</label>
                  <input
                    type="text"
                    value={aiTargetAudience}
                    onChange={(e) => setAiTargetAudience(e.target.value)}
                    placeholder="e.g. Barangay Health Workers, Local Fisherfolk"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Number of Questions (1-15)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Specific Focus Areas</label>
                  <input
                    type="text"
                    value={aiFocusAreas}
                    onChange={(e) => setAiFocusAreas(e.target.value)}
                    placeholder="e.g. Emergency response, medicine supplies, costs"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <button
                onClick={handleTriggerAiGenerate}
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition-all"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                <span>{isGeneratingAi ? 'Synthesizing Questions with Gemini...' : 'Generate Questions Now'}</span>
              </button>

              {/* Generated Candidates List */}
              {generatedQuestions.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Generated Suggestions ({generatedQuestions.length})
                    </span>
                    <button
                      onClick={() => {
                        if (selectedAiIndices.size === generatedQuestions.length) {
                          setSelectedAiIndices(new Set());
                        } else {
                          const s = new Set<number>();
                          generatedQuestions.forEach((_, i) => s.add(i));
                          setSelectedAiIndices(s);
                        }
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {selectedAiIndices.size === generatedQuestions.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {generatedQuestions.map((gq, idx) => {
                      const isSelected = selectedAiIndices.has(idx);
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            const next = new Set(selectedAiIndices);
                            if (next.has(idx)) next.delete(idx);
                            else next.add(idx);
                            setSelectedAiIndices(next);
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-950/40 border-indigo-500 text-white'
                              : 'bg-slate-800/40 border-slate-800 text-slate-400'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-slate-200">{gq.text}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                                Diff: {gq.difficultyScore}/5
                              </span>
                              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                                Rel: {gq.relevanceScore}%
                              </span>
                            </div>
                          </div>
                          {gq.probes && gq.probes.length > 0 && (
                            <p className="text-[11px] text-purple-300 mt-1">
                              <em>Probes:</em> {gq.probes.join(' | ')}
                            </p>
                          )}
                          {gq.scoringRationale && (
                            <p className="text-[10px] text-slate-400 mt-1">{gq.scoringRationale}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-900/90">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleImportAiQuestions}
                disabled={selectedAiIndices.size === 0}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md"
              >
                Insert Selected ({selectedAiIndices.size}) Questions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Modal */}
      {showBankModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">Question Bank Explorer</h3>
              </div>
              <button onClick={() => setShowBankModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 flex items-center gap-2">
              <input
                type="text"
                placeholder="Search bank by question text or tag..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
              <select
                value={bankCategory}
                onChange={(e) => setBankCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              >
                <option value="all">All Domains</option>
                <option value="Public Service & Governance">Public Service & Governance</option>
                <option value="Healthcare & Well-being">Healthcare & Well-being</option>
                <option value="Socio-Demographics">Socio-Demographics</option>
                <option value="Community & Culture">Community & Culture</option>
              </select>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {bankItems.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">No bank items match search criteria.</div>
              ) : (
                bankItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-800/40 border border-slate-800 hover:border-slate-700 rounded-xl text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-slate-200">{item.text}</span>
                      <button
                        onClick={() => handleImportBankQuestion(item)}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shrink-0"
                      >
                        + Insert
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-indigo-300">{item.domain}</span>
                      <span>Diff: {item.difficultyScore}/5</span>
                      <span>Rel: {item.relevanceScore}%</span>
                      <span>Used {item.usageCount} times</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
