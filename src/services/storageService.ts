import {
  Survey,
  InterviewSession,
  QuestionBankItem,
  SyncLogEntry,
} from '../types/survey';
import {
  INITIAL_SURVEYS,
  INITIAL_SESSIONS,
  INITIAL_QUESTION_BANK,
} from '../data/surveyDefaults';

const KEYS = {
  SURVEYS: 'ai_survey_instruments_list',
  SESSIONS: 'ai_survey_sessions_list',
  QUESTION_BANK: 'ai_survey_question_bank',
  SYNC_QUEUE: 'ai_survey_sync_outbox_queue',
  SYNC_LOGS: 'ai_survey_sync_audit_logs',
  OFFLINE_SIM: 'ai_survey_offline_simulation_mode',
  ACTIVE_LANG: 'ai_survey_active_app_language',
};

// Simple robust checksum and reversible base64 encryption simulation for local storage vault
export function simulateLocalEncryption(payload: any): { hash: string; encrypted: string } {
  const jsonStr = JSON.stringify(payload);
  let hashNum = 0;
  for (let i = 0; i < jsonStr.length; i++) {
    hashNum = (hashNum << 5) - hashNum + jsonStr.charCodeAt(i);
    hashNum |= 0;
  }
  const hashHex = Math.abs(hashNum).toString(16).padStart(8, '0');
  // Obfuscate / simulate AES block payload
  const b64 = btoa(encodeURIComponent(jsonStr));
  const encrypted = `ENC_AES256_${hashHex}::${b64}`;
  return { hash: hashHex, encrypted };
}

export function simulateLocalDecryption<T>(encryptedPayload: string): T | null {
  try {
    if (!encryptedPayload.startsWith('ENC_AES256_')) {
      return JSON.parse(encryptedPayload);
    }
    const parts = encryptedPayload.split('::');
    if (parts.length < 2) return null;
    const decoded = decodeURIComponent(atob(parts[1]));
    return JSON.parse(decoded) as T;
  } catch (err) {
    console.error('Decryption failed:', err);
    return null;
  }
}

class StorageService {
  // Offline Simulation
  isOfflineMode(): boolean {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(KEYS.OFFLINE_SIM);
    if (stored !== null) {
      return stored === 'true';
    }
    return !navigator.onLine;
  }

  setOfflineMode(offline: boolean) {
    localStorage.setItem(KEYS.OFFLINE_SIM, String(offline));
    window.dispatchEvent(new Event('app_network_status_change'));
  }

  // Surveys
  getSurveys(): Survey[] {
    const raw = localStorage.getItem(KEYS.SURVEYS);
    if (!raw) {
      this.saveSurveys(INITIAL_SURVEYS);
      return INITIAL_SURVEYS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SURVEYS;
    }
  }

  saveSurveys(surveys: Survey[]) {
    localStorage.setItem(KEYS.SURVEYS, JSON.stringify(surveys));
  }

  getSurveyById(id: string): Survey | undefined {
    return this.getSurveys().find((s) => s.id === id);
  }

  saveSurvey(survey: Survey): Survey {
    const surveys = this.getSurveys();
    const index = surveys.findIndex((s) => s.id === survey.id);
    const updatedSurvey = {
      ...survey,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      surveys[index] = updatedSurvey;
    } else {
      surveys.unshift(updatedSurvey);
    }
    this.saveSurveys(surveys);
    return updatedSurvey;
  }

  deleteSurvey(id: string): boolean {
    const surveys = this.getSurveys().filter((s) => s.id !== id);
    this.saveSurveys(surveys);
    return true;
  }

  // Question Bank
  getQuestionBank(): QuestionBankItem[] {
    const raw = localStorage.getItem(KEYS.QUESTION_BANK);
    if (!raw) {
      this.saveQuestionBank(INITIAL_QUESTION_BANK);
      return INITIAL_QUESTION_BANK;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_QUESTION_BANK;
    }
  }

  saveQuestionBank(items: QuestionBankItem[]) {
    localStorage.setItem(KEYS.QUESTION_BANK, JSON.stringify(items));
  }

  addQuestionToBank(question: Omit<QuestionBankItem, 'usageCount' | 'dateAdded'>): QuestionBankItem {
    const bank = this.getQuestionBank();
    const item: QuestionBankItem = {
      ...question,
      usageCount: 1,
      dateAdded: new Date().toISOString().split('T')[0],
    };
    bank.unshift(item);
    this.saveQuestionBank(bank);
    return item;
  }

  // Sessions
  getSessions(): InterviewSession[] {
    const raw = localStorage.getItem(KEYS.SESSIONS);
    if (!raw) {
      this.saveSessions(INITIAL_SESSIONS);
      return INITIAL_SESSIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_SESSIONS;
    }
  }

  saveSessions(sessions: InterviewSession[]) {
    localStorage.setItem(KEYS.SESSIONS, JSON.stringify(sessions));
  }

  saveSession(session: InterviewSession): { session: InterviewSession; queuedOffline: boolean } {
    const isOffline = this.isOfflineMode();
    const { hash, encrypted } = simulateLocalEncryption(session);

    const sessionToSave: InterviewSession = {
      ...session,
      encryptedHash: hash,
      syncStatus: isOffline ? 'pending' : 'synced',
      offlineSavedAt: isOffline ? new Date().toISOString() : undefined,
    };

    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = sessionToSave;
    } else {
      sessions.unshift(sessionToSave);
    }
    this.saveSessions(sessions);

    if (isOffline) {
      this.queueForSync(sessionToSave, encrypted, hash);
      this.addSyncLog({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: 'enqueue',
        sessionId: sessionToSave.id,
        surveyTitle: sessionToSave.surveyTitle,
        details: `Saved locally in encrypted offline vault (${hash}). Awaiting network sync.`,
      });
      return { session: sessionToSave, queuedOffline: true };
    }

    return { session: sessionToSave, queuedOffline: false };
  }

  // Outbox & Sync Queue
  getSyncQueue(): { id: string; sessionId: string; surveyTitle: string; encrypted: string; hash: string; timestamp: string }[] {
    const raw = localStorage.getItem(KEYS.SYNC_QUEUE);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveSyncQueue(queue: any[]) {
    localStorage.setItem(KEYS.SYNC_QUEUE, JSON.stringify(queue));
    window.dispatchEvent(new Event('app_sync_queue_change'));
  }

  queueForSync(session: InterviewSession, encrypted: string, hash: string) {
    const queue = this.getSyncQueue().filter((q) => q.sessionId !== session.id);
    queue.push({
      id: `outbox_${Date.now()}`,
      sessionId: session.id,
      surveyTitle: session.surveyTitle,
      encrypted,
      hash,
      timestamp: new Date().toISOString(),
    });
    this.saveSyncQueue(queue);
  }

  getSyncLogs(): SyncLogEntry[] {
    const raw = localStorage.getItem(KEYS.SYNC_LOGS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  addSyncLog(entry: SyncLogEntry) {
    const logs = this.getSyncLogs();
    logs.unshift(entry);
    // keep last 50 logs
    localStorage.setItem(KEYS.SYNC_LOGS, JSON.stringify(logs.slice(0, 50)));
  }

  // Automatic Sync with Conflict Resolution
  async syncPendingData(strategy: 'merge_latest' | 'client_wins' | 'server_wins' = 'merge_latest'): Promise<{
    syncedCount: number;
    conflictsDetected: number;
    resolvedCount: number;
  }> {
    const queue = this.getSyncQueue();
    if (queue.length === 0) {
      return { syncedCount: 0, conflictsDetected: 0, resolvedCount: 0 };
    }

    const sessions = this.getSessions();
    let syncedCount = 0;
    let conflictsDetected = 0;
    let resolvedCount = 0;

    for (const item of queue) {
      const decrypted = simulateLocalDecryption<InterviewSession>(item.encrypted);
      if (!decrypted) continue;

      const existingIndex = sessions.findIndex((s) => s.id === item.sessionId);

      if (existingIndex >= 0) {
        const serverSession = sessions[existingIndex];
        // Check if there is potential divergence
        const serverResponsesCount = Object.keys(serverSession.responses || {}).length;
        const clientResponsesCount = Object.keys(decrypted.responses || {}).length;

        if (serverSession.syncStatus === 'synced' && serverResponsesCount > clientResponsesCount) {
          conflictsDetected++;

          if (strategy === 'client_wins') {
            sessions[existingIndex] = { ...decrypted, syncStatus: 'synced' };
            resolvedCount++;
            this.addSyncLog({
              id: `log_${Date.now()}_${item.id}`,
              timestamp: new Date().toISOString(),
              action: 'conflict_resolved',
              sessionId: item.sessionId,
              surveyTitle: item.surveyTitle,
              strategyApplied: 'client_wins',
              details: `Conflict resolved: Client field submission overwrote existing server entry.`,
            });
          } else if (strategy === 'server_wins') {
            resolvedCount++;
            this.addSyncLog({
              id: `log_${Date.now()}_${item.id}`,
              timestamp: new Date().toISOString(),
              action: 'conflict_resolved',
              sessionId: item.sessionId,
              surveyTitle: item.surveyTitle,
              strategyApplied: 'server_wins',
              details: `Conflict resolved: Server copy retained; local changes archived.`,
            });
          } else {
            // merge_latest: union of responses
            const mergedResponses = { ...serverSession.responses, ...decrypted.responses };
            const mergedNotes = [...(serverSession.notes || []), ...(decrypted.notes || [])];
            sessions[existingIndex] = {
              ...decrypted,
              responses: mergedResponses,
              notes: mergedNotes,
              syncStatus: 'synced',
            };
            resolvedCount++;
            this.addSyncLog({
              id: `log_${Date.now()}_${item.id}`,
              timestamp: new Date().toISOString(),
              action: 'conflict_resolved',
              sessionId: item.sessionId,
              surveyTitle: item.surveyTitle,
              strategyApplied: 'merge_latest',
              details: `Conflict resolved: Merged responses and observations chronologically.`,
            });
          }
        } else {
          // Normal clean update
          sessions[existingIndex] = { ...decrypted, syncStatus: 'synced' };
          syncedCount++;
          this.addSyncLog({
            id: `log_${Date.now()}_${item.id}`,
            timestamp: new Date().toISOString(),
            action: 'sync_success',
            sessionId: item.sessionId,
            surveyTitle: item.surveyTitle,
            details: `Encrypted session (${item.hash}) successfully synced with cloud repository.`,
          });
        }
      } else {
        sessions.unshift({ ...decrypted, syncStatus: 'synced' });
        syncedCount++;
        this.addSyncLog({
          id: `log_${Date.now()}_${item.id}`,
          timestamp: new Date().toISOString(),
          action: 'sync_success',
          sessionId: item.sessionId,
          surveyTitle: item.surveyTitle,
          details: `New offline session (${item.hash}) created and synchronized.`,
        });
      }
    }

    this.saveSessions(sessions);
    this.saveSyncQueue([]);
    return { syncedCount, conflictsDetected, resolvedCount };
  }

  // Language Preference
  getActiveLanguage(): string {
    return localStorage.getItem(KEYS.ACTIVE_LANG) || 'en';
  }

  setActiveLanguage(lang: string) {
    localStorage.setItem(KEYS.ACTIVE_LANG, lang);
  }
}

export const storageService = new StorageService();
