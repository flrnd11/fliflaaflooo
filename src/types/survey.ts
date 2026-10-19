export type InterviewType = 'structured' | 'semi-structured' | 'unstructured';

export type QuestionType = 'likert' | 'multiple_choice' | 'open_ended' | 'rating' | 'boolean';

export type LikertTemplateId =
  | '5_point_agreement'
  | '5_point_satisfaction'
  | '7_point_satisfaction'
  | '5_point_frequency'
  | '5_point_importance'
  | '5_point_quality'
  | 'custom';

export interface LikertOption {
  value: number;
  label: string;
  tagalog?: string;
  bisaya?: string;
  ilocano?: string;
}

export interface LikertScaleConfig {
  templateId: LikertTemplateId;
  points: number;
  labels: string[];
  reverseScored?: boolean;
  weightMap?: number[];
}

export interface Question {
  id: string;
  order: number;
  text: string;
  type: QuestionType;
  category: string;
  tags: string[];
  difficultyScore: number; // 1 to 5
  relevanceScore: number; // 0 to 100%
  scoringRationale?: string;
  likertConfig?: LikertScaleConfig;
  options?: string[];
  probes?: string[];
  translations?: Record<string, string>; // langCode -> text
  translationsOptions?: Record<string, string[]>;
  translationsProbes?: Record<string, string[]>;
  required: boolean;
  guidanceNotes?: string;
}

export interface SurveySettings {
  maxQuestionsLimit: number; // default 50
  allowRandomQuestionOrder: boolean;
  randomSubsetCount?: number;
  defaultLikertTemplate?: LikertTemplateId;
  supportedLanguages: string[];
  offlineEncrypted: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  interviewType: InterviewType;
  targetAudience: string;
  primaryLanguage: string;
  supportedLanguages: string[];
  category: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'draft' | 'archived';
  settings: SurveySettings;
}

export interface Respondent {
  id: string;
  name: string;
  cohortGroup: string;
  demographics: {
    age?: string;
    gender?: string;
    location?: string;
    role?: string;
  };
  languagePreference: string;
  attendanceStatus: 'completed' | 'in_progress' | 'scheduled' | 'absent';
}

export interface SentimentAnalysisResult {
  score: number; // -1.0 to 1.0
  label: 'positive' | 'neutral' | 'negative';
  keywords: string[];
  emotion: string;
}

export interface QuestionResponse {
  respondentId: string;
  questionId: string;
  value: string | number | string[];
  numericScore?: number;
  sentiment?: SentimentAnalysisResult;
  interviewerObservation?: string;
  answeredAt: string;
}

export interface InterviewNote {
  id: string;
  timestamp: string;
  author: string;
  content: string;
  type: 'observation' | 'quote' | 'flag' | 'consensus';
}

export interface InterviewSession {
  id: string;
  surveyId: string;
  surveyTitle: string;
  interviewMode: 'individual' | 'group' | 'random';
  interviewType: InterviewType;
  startedAt: string;
  completedAt?: string;
  respondents: Respondent[];
  groupDetails?: {
    groupName: string;
    facilitator: string;
    consensusNotes: string;
    dissentNotes: string;
  };
  randomConfig?: {
    isRandomizedOrder: boolean;
    drawnQuestionIds: string[];
    totalPoolCount: number;
  };
  responses: Record<string, QuestionResponse[]>; // questionId -> array of responses
  notes: InterviewNote[];
  audioRecording?: {
    durationSeconds: number;
    isRecording: boolean;
    transcript?: string;
  };
  syncStatus: 'synced' | 'pending' | 'conflict';
  encryptedHash?: string;
  deviceInfo?: string;
  offlineSavedAt?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  action: 'enqueue' | 'sync_success' | 'conflict_detected' | 'conflict_resolved';
  sessionId: string;
  surveyTitle: string;
  details: string;
  strategyApplied?: 'server_wins' | 'client_wins' | 'merge_latest';
}

export interface QuestionBankItem extends Question {
  domain: string;
  usageCount: number;
  dateAdded: string;
}
