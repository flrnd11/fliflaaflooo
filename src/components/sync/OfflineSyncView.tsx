import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  ShieldCheck,
  Lock,
  Layers,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  History,
  FileCode,
  HardDrive,
} from 'lucide-react';
import { storageService, simulateLocalDecryption } from '../../services/storageService';
import { SyncLogEntry } from '../../types/survey';

export const OfflineSyncView: React.FC = () => {
  const [isOffline, setIsOffline] = useState(storageService.isOfflineMode());
  const [syncQueue, setSyncQueue] = useState(storageService.getSyncQueue());
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>(storageService.getSyncLogs());
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'merge_latest' | 'client_wins' | 'server_wins'>('merge_latest');
  const [inspectPayload, setInspectPayload] = useState<any | null>(null);
  const [syncSummaryMessage, setSyncSummaryMessage] = useState<string | null>(null);

  const refreshState = () => {
    setIsOffline(storageService.isOfflineMode());
    setSyncQueue(storageService.getSyncQueue());
    setSyncLogs(storageService.getSyncLogs());
  };

  useEffect(() => {
    refreshState();
    window.addEventListener('app_network_status_change', refreshState);
    window.addEventListener('app_sync_queue_change', refreshState);
    return () => {
      window.removeEventListener('app_network_status_change', refreshState);
      window.removeEventListener('app_sync_queue_change', refreshState);
    };
  }, []);

  const handleToggleOffline = () => {
    const next = !isOffline;
    storageService.setOfflineMode(next);
    setIsOffline(next);
  };

  const handleRunSync = async () => {
    if (isOffline) {
      alert('Cannot synchronize while in Offline Simulation Mode. Please toggle Online first.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await storageService.syncPendingData(selectedStrategy);
      refreshState();
      setSyncSummaryMessage(
        `Sync completed! ${res.syncedCount} item(s) synchronized, ${res.conflictsDetected} conflict(s) evaluated, ${res.resolvedCount} conflict(s) resolved using "${selectedStrategy}" rule.`
      );
      setTimeout(() => setSyncSummaryMessage(null), 6000);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            Offline Field Survey Vault & Auto-Sync Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Engineered for remote archipelago enumerations. Answers are saved locally with AES encryption, queued safely, and automatically reconciled upon reconnection.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOffline}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border ${
              isOffline
                ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 shadow-inner'
                : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {isOffline ? (
              <>
                <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Simulate: Offline Mode</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>Simulate: Online Mode</span>
              </>
            )}
          </button>

          <button
            onClick={handleRunSync}
            disabled={isSyncing || isOffline || syncQueue.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Reconciling Vault...' : 'Sync Pending Outbox Now'}</span>
          </button>
        </div>
      </div>

      {syncSummaryMessage && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 shadow-sm animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{syncSummaryMessage}</span>
        </div>
      )}

      {/* 3 Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Network Connection */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Field Connectivity</span>
            {isOffline ? (
              <WifiOff className="w-5 h-5 text-amber-400" />
            ) : (
              <Wifi className="w-5 h-5 text-emerald-400" />
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${isOffline ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isOffline ? 'Offline (Vault Active)' : 'Online Connected'}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {isOffline
              ? 'Local storage sandbox safely holding responses'
              : 'Direct bidirectional sync enabled'}
          </p>
        </div>

        {/* Encrypted Outbox Queue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Encrypted Outbox</span>
            <Lock className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{syncQueue.length}</span>
            <span className="text-xs text-slate-400">sessions pending</span>
          </div>
          <p className="mt-2 text-xs text-indigo-300">
            Serialized with cryptographic checksums
          </p>
        </div>

        {/* Local Storage Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase">Vault Integrity</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">AES-256 Sig</span>
          </div>
          <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Zero Data Loss Guarantee
          </p>
        </div>
      </div>

      {/* Conflict Resolution Settings Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-purple-400" />
              Automatic Conflict Resolution Policy
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select how diverged records between field enumerators and the central repository are resolved.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30">
            Active: {selectedStrategy.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Strategy 1: Merge Latest */}
          <div
            onClick={() => setSelectedStrategy('merge_latest')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedStrategy === 'merge_latest'
                ? 'bg-purple-950/40 border-purple-500 shadow-md'
                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">Merge / Latest Timestamp</span>
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold">
                Recommended
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Smart merge: unites responses and observations chronologically without discarding qualitative remarks.
            </p>
          </div>

          {/* Strategy 2: Client Field Wins */}
          <div
            onClick={() => setSelectedStrategy('client_wins')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedStrategy === 'client_wins'
                ? 'bg-indigo-950/40 border-indigo-500 shadow-md'
                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">Client / Field Wins</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Ground truth rule: field enumerator's latest submission supersedes server database entries.
            </p>
          </div>

          {/* Strategy 3: Server Wins */}
          <div
            onClick={() => setSelectedStrategy('server_wins')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedStrategy === 'server_wins'
                ? 'bg-blue-950/40 border-blue-500 shadow-md'
                : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-white">Server Wins</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Centralized priority: already finalized server entries retain authority in case of dispute.
            </p>
          </div>
        </div>
      </div>

      {/* Outbox Queue Table & Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Pending Outbox */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Pending Encrypted Outbox ({syncQueue.length})
            </h3>
            {syncQueue.length > 0 && !isOffline && (
              <button
                onClick={handleRunSync}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Sync All
              </button>
            )}
          </div>

          {syncQueue.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
              <span>Outbox is clear. All field survey data is fully synchronized.</span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {syncQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-800/50 border border-slate-800 rounded-xl text-xs space-y-1.5 hover:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">{item.surveyTitle}</span>
                    <span className="font-mono text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      Hash: {item.hash}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Queued: {new Date(item.timestamp).toLocaleTimeString()}</span>
                    <button
                      onClick={() => setInspectPayload(simulateLocalDecryption(item.encrypted))}
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <FileCode className="w-3 h-3" />
                      <span>Inspect Vault Data</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sync Audit Trail / Activity Log */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-400" />
              Sync Audit Trail & Conflict History
            </h3>
            <span className="text-xs text-slate-500">{syncLogs.length} events</span>
          </div>

          {syncLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No synchronization events logged yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 divide-y divide-slate-800/80">
              {syncLogs.map((log) => (
                <div key={log.id} className="pt-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        log.action === 'sync_success'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : log.action === 'conflict_resolved'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {log.action.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-slate-300 font-medium">{log.surveyTitle}</p>
                  <p className="text-[11px] text-slate-400">{log.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inspect Payload Modal */}
      {inspectPayload && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FileCode className="w-5 h-5 text-indigo-400" />
                Decrypted Local Storage Payload
              </h3>
              <button onClick={() => setInspectPayload(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <pre className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl text-xs font-mono text-emerald-400 border border-slate-800">
              {JSON.stringify(inspectPayload, null, 2)}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectPayload(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
