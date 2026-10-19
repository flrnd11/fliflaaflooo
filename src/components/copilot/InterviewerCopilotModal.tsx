import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  X,
  Send,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  MessageSquare,
  BookOpen,
  HelpCircle,
  Volume2,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { geminiService } from '../../services/geminiService';

export interface CopilotContext {
  surveyTitle?: string;
  interviewType?: string;
  activeQuestion?: string;
  activeLanguage?: string;
  currentRespondentName?: string;
  recentResponse?: string;
  isQuestionnaireCreation?: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface InterviewerCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: CopilotContext;
  onInsertNote?: (text: string) => void;
  onApplyQuestionWording?: (text: string) => void;
}

export const InterviewerCopilotModal: React.FC<InterviewerCopilotModalProps> = ({
  isOpen,
  onClose,
  context,
  onInsertNote,
  onApplyQuestionWording,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'UGNAYai ready. Direct answers only — simplified phrasing, probing questions, and dialect translations ready to speak.',
      timestamp: 'Just now',
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map((m) => ({ role: m.role, text: m.text }));
      const replyText = await geminiService.askCopilot(query, chatHistory, context);

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.error('Copilot send error:', err);
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: 'UGNAYai is ready. You can ask for simpler wording, probes, or Tagalog/Bisaya delivery.',
        timestamp: 'Just now',
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized
          ? 'bottom-5 right-5 w-72'
          : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[460px] max-h-[88vh]'
      }`}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                <span>UGNAYai</span>
                <span className="text-[10px] bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded-full font-bold">
                  Direct Field Copilot
                </span>
              </h3>
              <p className="text-[10px] text-indigo-100 line-clamp-1">
                {context.activeQuestion ? `Item: "${context.activeQuestion}"` : 'Direct Question & Interview Assistance'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-white/10 rounded-lg text-white transition-colors"
              title={isMinimized ? 'Expand' : 'Minimize'}
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-lg text-white transition-colors"
              title="Close UGNAYai"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body (Hidden if minimized) */}
        {!isMinimized && (
          <>
            {/* Active Context Banner */}
            {context.activeQuestion && (
              <div className="bg-slate-800/80 border-b border-slate-700/80 px-3.5 py-2 text-[11px] flex items-center justify-between gap-2">
                <span className="text-slate-400 truncate">
                  <strong className="text-indigo-300">Active Question:</strong> {context.activeQuestion}
                </span>
                <span className="shrink-0 text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono uppercase">
                  {context.activeLanguage || 'EN'}
                </span>
              </div>
            )}

            {/* Quick Action Prompt Chips */}
            <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[11px]">
              <button
                onClick={() =>
                  handleSend(
                    `Give the direct simplified question only (no preamble or tips) for: "${context.activeQuestion || 'current question'}"`
                  )
                }
                className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-indigo-600/30 text-indigo-300 border border-slate-700 hover:border-indigo-500 rounded-lg transition-colors flex items-center gap-1 font-medium"
              >
                💡 Simplify question
              </button>

              <button
                onClick={() =>
                  handleSend(
                    `Give 2-3 direct follow-up probing questions only (no preamble or tips) for: "${context.activeQuestion || 'current question'}"`
                  )
                }
                className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-purple-600/30 text-purple-300 border border-slate-700 hover:border-purple-500 rounded-lg transition-colors flex items-center gap-1 font-medium"
              >
                🔍 Probing cues
              </button>

              <button
                onClick={() =>
                  handleSend(
                    `Give the direct polite Tagalog translation with 'po/opo' only (no preamble) for: "${context.activeQuestion || 'current question'}"`
                  )
                }
                className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-emerald-600/30 text-emerald-300 border border-slate-700 hover:border-emerald-500 rounded-lg transition-colors flex items-center gap-1 font-medium"
              >
                🇵🇭 Tagalog with 'po'
              </button>

              <button
                onClick={() =>
                  handleSend(
                    `Give the direct conversational Cebuano/Bisaya question only (no preamble) for: "${context.activeQuestion || 'current question'}"`
                  )
                }
                className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-amber-600/30 text-amber-300 border border-slate-700 hover:border-amber-500 rounded-lg transition-colors flex items-center gap-1 font-medium"
              >
                🌴 Cebuano / Bisaya
              </button>

              <button
                onClick={() =>
                  handleSend(
                    `Give a 1-sentence polite greeting/icebreaker for the respondent before asking: "${context.activeQuestion || 'current question'}"`
                  )
                }
                className="shrink-0 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-colors flex items-center gap-1 font-medium"
              >
                🤝 Icebreaker
              </button>
            </div>

            {/* Chat Messages Scrollable */}
            <div className="p-4 space-y-3.5 overflow-y-auto max-h-[380px] min-h-[220px] text-xs">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] p-3 rounded-2xl leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-sm'
                        : 'bg-slate-800/90 text-slate-200 border border-slate-700 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {m.text}
                  </div>

                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500">
                    <span>{m.timestamp}</span>
                    {m.role === 'assistant' && (
                      <>
                        <span>·</span>
                        <button
                          onClick={() => handleCopy(m.id, m.text)}
                          className="hover:text-slate-300 flex items-center gap-0.5"
                          title="Copy advice text"
                        >
                          {copiedId === m.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {onApplyQuestionWording && (
                          <>
                            <span>·</span>
                            <button
                              onClick={() => onApplyQuestionWording(m.text)}
                              className="hover:text-emerald-300 text-emerald-400 font-semibold"
                              title="Apply this text to the active question"
                            >
                              ✓ Use in Question
                            </button>
                          </>
                        )}
                        {onInsertNote && (
                          <>
                            <span>·</span>
                            <button
                              onClick={() => onInsertNote(m.text)}
                              className="hover:text-indigo-300 text-indigo-400 font-semibold"
                              title="Add to Interviewer Notes"
                            >
                              + Add to Notes
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center space-x-2 text-xs text-indigo-400 bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 w-fit">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  <span>Copilot is formulating advice...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-slate-900 border-t border-slate-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask UGNAYai: 'Simplify', 'Probes', 'Tagalog'..."
                  disabled={isLoading}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-xl shadow-md transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
