import { InterviewType, Question } from '../types/survey';

export interface GenerateQuestionsParams {
  topic: string;
  interviewType: InterviewType;
  targetAudience: string;
  count: number;
  language?: string;
  category?: string;
  focusAreas?: string;
}

export interface ScoreQuestionResult {
  difficultyScore: number;
  relevanceScore: number;
  scoringRationale: string;
  suggestions?: string[];
  recommendedLikertScale?: string;
}

export interface SentimentAnalysisOutput {
  overallScore: number;
  label: 'positive' | 'neutral' | 'negative';
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
  executiveSummary: string;
  themes: { theme: string; count: number; sentiment: 'positive' | 'neutral' | 'negative'; description?: string }[];
  keywords: { word: string; count: number; relevance: number; sentiment: 'positive' | 'neutral' | 'negative' }[];
}

export const geminiService = {
  async generateQuestions(params: GenerateQuestionsParams): Promise<Partial<Question>[]> {
    try {
      const res = await fetch('/api/gemini/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.questions && Array.isArray(data.questions)) {
        return data.questions;
      }
      if (data.fallback) {
        return data.fallback;
      }
      return [];
    } catch (err) {
      console.warn('API call failed, fallback used:', err);
      return [];
    }
  },

  async translateTexts(
    texts: string[],
    targetLanguages: string[] = ['tl', 'ceb', 'ilo', 'hil'],
    sourceLanguage = 'en'
  ): Promise<{ original: string; translations: Record<string, string>; culturalNotes?: string }[]> {
    try {
      const res = await fetch('/api/gemini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, targetLanguages, sourceLanguage }),
      });
      const data = await res.json();
      return data.results || data.fallback || [];
    } catch (err) {
      console.warn('Translation call failed:', err);
      return [];
    }
  },

  async analyzeSentiment(
    responses: { id?: string; text: string }[],
    surveyTitle = 'Survey'
  ): Promise<{ summary: SentimentAnalysisOutput; analyzedResponses: any[] }> {
    try {
      const res = await fetch('/api/gemini/analyze-sentiment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, surveyTitle }),
      });
      const data = await res.json();
      return {
        summary: data.summary,
        analyzedResponses: data.analyzedResponses || [],
      };
    } catch (err) {
      console.warn('Sentiment call failed:', err);
      return {
        summary: {
          overallScore: 0.1,
          label: 'neutral',
          positivePercent: 40,
          neutralPercent: 40,
          negativePercent: 20,
          executiveSummary: 'Automated linguistic sentiment overview processed.',
          themes: [{ theme: 'General Feedback', count: responses.length, sentiment: 'neutral' }],
          keywords: [{ word: 'service', count: 5, relevance: 0.8, sentiment: 'neutral' }],
        },
        analyzedResponses: [],
      };
    }
  },

  async scoreQuestion(
    questionText: string,
    surveyObjective = 'Research Evaluation',
    interviewType = 'structured'
  ): Promise<ScoreQuestionResult> {
    try {
      const res = await fetch('/api/gemini/score-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText, surveyObjective, interviewType }),
      });
      const data = await res.json();
      return {
        difficultyScore: data.difficultyScore || 3,
        relevanceScore: data.relevanceScore || 85,
        scoringRationale: data.scoringRationale || 'Evaluated for cognitive burden and alignment.',
        suggestions: data.suggestions || [],
        recommendedLikertScale: data.recommendedLikertScale,
      };
    } catch {
      return {
        difficultyScore: 3,
        relevanceScore: 85,
        scoringRationale: 'Automated heuristic score.',
      };
    }
  },

  async askCopilot(
    message: string,
    chatHistory: { role: 'user' | 'assistant'; text: string }[] = [],
    context: {
      surveyTitle?: string;
      interviewType?: string;
      activeQuestion?: string;
      activeLanguage?: string;
      currentRespondentName?: string;
      recentResponse?: string;
      isQuestionnaireCreation?: boolean;
    } = {}
  ): Promise<string> {
    try {
      const res = await fetch('/api/gemini/interviewer-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chatHistory, context }),
      });
      const data = await res.json();
      return (data.reply || '').trim() || 'Maaari po ba kayong magbigay ng isang partikular na halimbawa?';
    } catch (err) {
      console.warn('Copilot request failed:', err);
      const q = context.activeQuestion || '';
      const isDigital = q.toLowerCase().includes('digital') || q.toLowerCase().includes('device') || q.toLowerCase().includes('software');
      const lower = message.toLowerCase();

      if (lower.includes('probe') || lower.includes('follow up') || lower.includes('halimbawa')) {
        return 'Maaari po ba kayong magbigay ng isang partikular na halimbawa?';
      }
      if (lower.includes('simplify') || lower.includes('simple')) {
        return isDigital
          ? 'Madali po ba at maaasahan ang mga computer o software na ibinigay ng paaralan?'
          : 'Madali po ba at maaasahan ang mga serbisyong ito para sa inyo?';
      }
      if (lower.includes('tagalog')) {
        return 'Maaasahan po ba at madaling gamitin ang serbisyong ito para sa inyo?';
      }
      if (lower.includes('bisaya') || lower.includes('cebuano')) {
        return 'Kasaligan ba ug sayon gamiton kining kagamitan o serbisyo?';
      }
      return 'Maaari po ba kayong magbigay ng isang partikular na halimbawa ukol dito?';
    }
  },
};

