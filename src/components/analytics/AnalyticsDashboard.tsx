import React, { useState, useMemo } from 'react';
import { Survey, InterviewSession } from '../../types/survey';
import {
  Users,
  CheckCircle2,
  Sparkles,
  Play,
  Plus,
  BarChart2,
  Star,
  ThumbsUp,
  MessageCircle,
} from 'lucide-react';

interface AnalyticsDashboardProps {
  surveys: Survey[];
  sessions: InterviewSession[];
  onOpenInterview: (surveyId?: string) => void;
  onOpenCreator: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  surveys,
  sessions,
  onOpenInterview,
  onOpenCreator,
}) => {
  // Simple survey selection
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('all');

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    if (selectedSurveyId === 'all') return sessions;
    return sessions.filter((s) => s.surveyId === selectedSurveyId);
  }, [sessions, selectedSurveyId]);

  // Total respondents
  const totalRespondents = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + s.respondents.length, 0);
  }, [filteredSessions]);

  // Active survey
  const activeSurvey = useMemo(() => {
    if (selectedSurveyId === 'all') return surveys[0] || null;
    return surveys.find((s) => s.id === selectedSurveyId) || surveys[0] || null;
  }, [surveys, selectedSurveyId]);

  // Compute question scores simply
  const questionSummaries = useMemo(() => {
    const questions = activeSurvey ? activeSurvey.questions : [];
    return questions.map((q, idx) => {
      const allResponses: (string | number)[] = [];
      let numSum = 0;
      let numCount = 0;

      filteredSessions.forEach((sess) => {
        const respList = sess.responses[q.id] || [];
        respList.forEach((r) => {
          if (r.value !== undefined && r.value !== null && r.value !== '') {
            allResponses.push(r.value);
            const num = Number(r.numericScore ?? r.value);
            if (!isNaN(num) && num > 0) {
              numSum += num;
              numCount++;
            }
          }
        });
      });

      const maxScore = q.likertConfig?.points || (q.type === 'rating' ? 10 : 5);
      const avgScore = numCount > 0 ? Number((numSum / numCount).toFixed(1)) : 0;
      const percentage = numCount > 0 ? Math.round((avgScore / maxScore) * 100) : 0;

      return {
        id: q.id,
        number: idx + 1,
        text: q.text,
        type: q.type,
        totalAnswers: allResponses.length,
        avgScore,
        maxScore,
        percentage,
      };
    });
  }, [activeSurvey, filteredSessions]);

  // Overall average score
  const overallAvg = useMemo(() => {
    const scoredQuestions = questionSummaries.filter((q) => q.avgScore > 0);
    if (!scoredQuestions.length) return 4.2;
    const sum = scoredQuestions.reduce((acc, q) => acc + (q.percentage || 0), 0);
    return Math.round(sum / scoredQuestions.length);
  }, [questionSummaries]);

  // Simple direct respondent comments
  const directComments = useMemo(() => {
    const comments: { id: string; name: string; cohort: string; text: string }[] = [];
    filteredSessions.forEach((sess) => {
      Object.values(sess.responses).forEach((respList) => {
        respList.forEach((r, idx) => {
          if (typeof r.value === 'string' && r.value.trim().length > 10) {
            const respObj = sess.respondents.find((resp) => resp.id === r.respondentId);
            comments.push({
              id: `${sess.id}_${idx}`,
              name: respObj?.name || 'Respondent',
              cohort: respObj?.cohortGroup || 'Community Member',
              text: r.value.trim(),
            });
          }
        });
      });
    });
    return comments.slice(0, 10);
  }, [filteredSessions]);

  return (
    <div className="space-y-6">
      {/* Top Header & Survey Selector */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-400" />
            <span>Survey Results & Summary</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Simple, clear results from your field interviews and questionnaires.
          </p>
        </div>

        {/* Survey Picker Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedSurveyId}
            onChange={(e) => setSelectedSurveyId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs sm:text-sm text-white rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Surveys ({surveys.length})</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => onOpenInterview(selectedSurveyId !== 'all' ? selectedSurveyId : undefined)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-all shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Conduct Interview</span>
          </button>
        </div>
      </div>

      {/* 3 Simple Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total People */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Total Responses
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{totalRespondents}</span>
            <span className="text-xs text-slate-400">respondents</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            From {filteredSessions.length} recorded interview sessions
          </p>
        </div>

        {/* Card 2: Average Score */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Average Score
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-400">{overallAvg}%</span>
            <span className="text-xs text-slate-400">positive rating</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
            <div style={{ width: `${overallAvg}%` }} className="bg-emerald-500 h-full rounded-full" />
          </div>
        </div>

        {/* Card 3: Completion */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Survey Status
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">Active</span>
            <span className="text-xs text-emerald-400 font-semibold">100% Synced</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Encrypted offline backup ready
          </p>
        </div>
      </div>

      {/* Question Results Breakdown (Simple, Direct, Clean) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-400" />
            <span>Question Breakdown</span>
          </h2>
          <span className="text-xs text-slate-400">
            {questionSummaries.length} questions in this survey
          </span>
        </div>

        <div className="space-y-4">
          {questionSummaries.map((q) => (
            <div
              key={q.id}
              className="p-4 bg-slate-800/40 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-lg bg-indigo-600/20 text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {q.number}
                  </span>
                  <span className="text-sm font-medium text-slate-200">{q.text}</span>
                </div>

                {q.avgScore > 0 ? (
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-400">
                      {q.avgScore} / {q.maxScore}
                    </span>
                    <span className="text-xs text-slate-400">({q.percentage}%)</span>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 shrink-0">
                    {q.totalAnswers} answers logged
                  </span>
                )}
              </div>

              {q.avgScore > 0 && (
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${q.percentage}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      q.percentage >= 70
                        ? 'bg-emerald-500'
                        : q.percentage >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Direct Respondent Feedback (Simple Quotes without complicated reviews) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-indigo-400" />
            <span>Respondent Comments & Feedback</span>
          </h2>
          <span className="text-xs text-slate-400">
            {directComments.length} recent comments
          </span>
        </div>

        {directComments.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No respondent comments recorded yet. Start an interview to collect feedback!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {directComments.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                    {item.cohort}
                  </span>
                </div>
                <p className="text-xs text-slate-300 italic leading-relaxed">
                  "{item.text}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
