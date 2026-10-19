import React, { useState } from 'react';
import { QuestionBankItem, Survey, LikertTemplateId } from '../../types/survey';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Tag,
  Copy,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { storageService } from '../../services/storageService';
import { LIKERT_TEMPLATES } from '../../data/surveyDefaults';

interface QuestionBankViewProps {
  surveys: Survey[];
  onInsertQuestionToSurvey?: (question: QuestionBankItem, surveyId: string) => void;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  surveys,
  onInsertQuestionToSurvey,
}) => {
  const [items, setItems] = useState<QuestionBankItem[]>(storageService.getQuestionBank());
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // New Question Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newText, setNewText] = useState('');
  const [newDomain, setNewDomain] = useState('Public Service & Governance');
  const [newType, setNewType] = useState<'likert' | 'multiple_choice' | 'open_ended' | 'rating'>('likert');
  const [newTags, setNewTags] = useState('Community, Frontline');
  const [newDiff, setNewDiff] = useState(2);
  const [newRel, setNewRel] = useState(92);
  const [newTagalog, setNewTagalog] = useState('');
  const [newBisaya, setNewBisaya] = useState('');

  // Target Survey for one-click insertion
  const [targetSurveyId, setTargetSurveyId] = useState<string>(surveys[0]?.id || '');
  const [insertedNotice, setInsertedNotice] = useState<string | null>(null);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedDomain !== 'all' && item.domain !== selectedDomain) return false;
    if (selectedDifficulty !== 'all' && item.difficultyScore !== Number(selectedDifficulty)) return false;
    if (selectedType !== 'all' && item.type !== selectedType) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchText = item.text.toLowerCase().includes(q);
      const matchTags = item.tags.some((t) => t.toLowerCase().includes(q));
      const matchDomain = item.domain.toLowerCase().includes(q);
      if (!matchText && !matchTags && !matchDomain) return false;
    }
    return true;
  });

  const domains = Array.from(new Set(items.map((i) => i.domain)));

  const handleCreateBankItem = () => {
    if (!newText.trim()) return;
    const added = storageService.addQuestionToBank({
      id: `qb_${Date.now()}`,
      order: items.length + 1,
      text: newText.trim(),
      type: newType,
      category: newDomain,
      domain: newDomain,
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
      difficultyScore: newDiff,
      relevanceScore: newRel,
      likertConfig:
        newType === 'likert'
          ? {
              templateId: '5_point_agreement',
              points: 5,
              labels: LIKERT_TEMPLATES['5_point_agreement'].options.map((o) => o.label),
            }
          : undefined,
      translations: {
        ...(newTagalog ? { tl: newTagalog } : {}),
        ...(newBisaya ? { ceb: newBisaya } : {}),
      },
      required: true,
    });

    setItems(storageService.getQuestionBank());
    setShowAddModal(false);
    setNewText('');
    setNewTagalog('');
    setNewBisaya('');
  };

  const handleInsertToSurvey = (item: QuestionBankItem) => {
    if (!targetSurveyId) return;
    const survey = storageService.getSurveyById(targetSurveyId);
    if (!survey) return;

    if (survey.questions.length >= 50) {
      alert(`Survey "${survey.title}" has reached the 50 questions limit.`);
      return;
    }

    const updatedSurvey: Survey = {
      ...survey,
      questions: [
        ...survey.questions,
        {
          ...item,
          id: `q_${Date.now()}_bank_insert`,
          order: survey.questions.length + 1,
        },
      ],
    };

    storageService.saveSurvey(updatedSurvey);

    // Update usage count in bank
    const updatedBank = items.map((b) => (b.id === item.id ? { ...b, usageCount: b.usageCount + 1 } : b));
    storageService.saveQuestionBank(updatedBank);
    setItems(updatedBank);

    setInsertedNotice(`Inserted into "${survey.title}"!`);
    setTimeout(() => setInsertedNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            Standardized Question Bank & Taxonomy
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Categorized questions with tags, difficulty and relevance ratings, Philippine translations, and one-click reuse across surveys.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Question to Bank</span>
          </button>
        </div>
      </div>

      {/* Target Survey Bar & Notification */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300">Quick-Insert Target Survey:</span>
          <select
            value={targetSurveyId}
            onChange={(e) => setTargetSurveyId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
          >
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title} ({s.questions.length}/50)
              </option>
            ))}
          </select>
        </div>

        {insertedNotice && (
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-3 py-1 rounded-lg animate-pulse">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{insertedNotice}</span>
          </div>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Search className="w-3.5 h-3.5" /> Search Items
          </label>
          <input
            type="text"
            placeholder="Search by keyword, tag, or text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Domain Category
          </label>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All Domains ({items.length})</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Question Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All Question Types</option>
            <option value="likert">Likert Scale</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="open_ended">Open-Ended (Qualitative)</option>
            <option value="rating">Numeric Rating</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5" /> Cognitive Difficulty
          </label>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All Levels (1 to 5)</option>
            <option value="1">Level 1 (Elementary / Recall)</option>
            <option value="2">Level 2 (Standard Perception)</option>
            <option value="3">Level 3 (Evaluative Assessment)</option>
            <option value="4">Level 4 (Complex Reflexive)</option>
            <option value="5">Level 5 (Deep Introspective)</option>
          </select>
        </div>
      </div>

      {/* Question Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredItems.map((item) => {
          return (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3 flex flex-col justify-between transition-all"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {item.domain}
                  </span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-semibold">
                      Diff: {item.difficultyScore}/5
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                      Rel: {item.relevanceScore}%
                    </span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white leading-snug">{item.text}</h3>

                {/* Dialect Translations */}
                {item.translations?.tl && (
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500 font-semibold">Tagalog: </span>
                    {item.translations.tl}
                  </p>
                )}
                {item.translations?.ceb && (
                  <p className="text-xs text-slate-400">
                    <span className="text-slate-500 font-semibold">Cebuano: </span>
                    {item.translations.ceb}
                  </p>
                )}

                {/* Probes if present */}
                {item.probes && item.probes.length > 0 && (
                  <div className="text-[11px] text-purple-300 bg-purple-950/20 p-2 rounded-lg border border-purple-500/20">
                    <span className="font-bold">Follow-up Probes: </span>
                    {item.probes.join(' • ')}
                  </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {item.tags.map((t, tIdx) => (
                    <span
                      key={tIdx}
                      className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Reused in {item.usageCount} studies
                </span>
                <button
                  onClick={() => handleInsertToSurvey(item)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Insert to Active Survey</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-white text-base">Add New Question to Taxonomy Bank</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Question Text</label>
                <textarea
                  rows={2}
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Enter standardized survey inquiry..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Domain Category</label>
                  <input
                    type="text"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Question Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="likert">Likert Scale</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="open_ended">Open-Ended</option>
                    <option value="rating">Rating</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Tagalog Translation (Optional)
                  </label>
                  <input
                    type="text"
                    value={newTagalog}
                    onChange={(e) => setNewTagalog(e.target.value)}
                    placeholder="Salin sa Tagalog..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Cebuano / Bisaya (Optional)
                  </label>
                  <input
                    type="text"
                    value={newBisaya}
                    onChange={(e) => setNewBisaya(e.target.value)}
                    placeholder="Hubad sa Binisaya..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBankItem}
                disabled={!newText.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
              >
                Save to Bank
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
