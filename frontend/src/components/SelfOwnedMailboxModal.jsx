import React, { useState, useEffect } from 'react';
import { Mail, X, RefreshCw, Send, CheckCircle, ShieldCheck, Download, ExternalLink, Clock, User, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';

export default function SelfOwnedMailboxModal({ isOpen, onClose }) {
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendingProbe, setSendingProbe] = useState(false);
  const [alertMsg, setAlertMsg] = useState(null);
  const [fetchError, setFetchError] = useState(null);

  const fetchMailbox = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const data = await api.getAdminEmailDeliveries({ limit: 50 });
      const list = data.items || [];
      setEmails(list);
      if (list.length > 0 && !selectedEmail) {
        setSelectedEmail(list[0]);
      }
    } catch (err) {
      console.error('Failed to load self-owned mailbox:', err);
      setFetchError(err.message || 'Failed to load mailbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMailbox();
    }
  }, [isOpen]);

  const handleSendSelfEmail = async () => {
    try {
      setSendingProbe(true);
      setAlertMsg(null);
      const res = await api.sendAdminTestEmail();
      setAlertMsg({
        type: 'success',
        text: '📧 New email generated and delivered to your self-owned mailbox + macOS desktop notification!'
      });
      await fetchMailbox();
    } catch (err) {
      setAlertMsg({
        type: 'error',
        text: err.message || 'Failed to dispatch email'
      });
    } finally {
      setSendingProbe(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[88vh] bg-[#070b14] border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="p-4 px-6 border-b border-slate-800 bg-[#090f1d] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-display">
                  TrustMesh Self-Owned Mailbox
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Zero Mediators
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Self-contained inbox &bull; 100% autonomous local delivery
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendSelfEmail}
              disabled={sendingProbe}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${sendingProbe ? 'animate-pulse' : ''}`} />
              <span>{sendingProbe ? 'Delivering...' : 'Send Test Mail'}</span>
            </button>
            <button
              onClick={fetchMailbox}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Refresh Inbox"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        {alertMsg && (
          <div className={`px-6 py-2.5 text-xs font-mono flex items-center justify-between ${
            alertMsg.type === 'success' ? 'bg-emerald-950/40 text-emerald-300 border-b border-emerald-500/30' : 'bg-rose-950/40 text-rose-300 border-b border-rose-500/30'
          }`}>
            <span>{alertMsg.text}</span>
            <button onClick={() => setAlertMsg(null)} className="opacity-70 hover:opacity-100">&times;</button>
          </div>
        )}

        {/* Autonomous Engine Badge Explainer */}
        <div className="bg-slate-900/60 px-6 py-2 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Autonomous Mail Engine: Saved to SQLite database + exported to <code className="text-cyan-300 bg-slate-950 px-1 py-0.5 rounded">mailbox/*.eml</code> + macOS Desktop notification.</span>
          </div>
          <span className="font-mono text-slate-500">Total: {emails.length} emails</span>
        </div>

        {/* Modal Body: Split Inbox / Reader */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          
          {/* Left Column: Email List */}
          <div className="md:col-span-5 border-r border-slate-800/80 overflow-y-auto divide-y divide-slate-800/50 bg-[#060a12]">
            {loading && emails.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs animate-pulse">
                Loading notifications...
              </div>
            ) : fetchError && emails.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
                <p className="text-xs text-rose-300 font-medium">{fetchError}</p>
                <button
                  onClick={fetchMailbox}
                  className="px-3 py-1 rounded-lg bg-rose-600/30 text-rose-200 border border-rose-500/30 text-[11px] hover:bg-rose-600/50 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : emails.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No notifications available.
              </div>
            ) : (
              emails.map((eml) => {
                const isSelected = selectedEmail?.id === eml.id;
                return (
                  <button
                    key={eml.id}
                    onClick={() => setSelectedEmail(eml)}
                    className={`w-full text-left p-3.5 transition-all flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-cyan-500/10 border-l-2 border-cyan-400'
                        : 'hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-mono text-cyan-400 font-medium truncate max-w-[170px]">
                        {eml.recipient || 'Admin'}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">
                        {eml.created_at ? new Date(eml.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-white line-clamp-1">
                      {eml.subject || 'TrustMesh Security Alert'}
                    </div>
                    <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-mono">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {eml.status || 'SENT'}
                      </span>
                      <span className="text-slate-500 truncate max-w-[120px]">
                        {eml.resend_id || 'self-owned'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Column: Email Preview Reader */}
          <div className="md:col-span-7 flex flex-col h-full bg-[#0a0f1d] overflow-hidden">
            {selectedEmail ? (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Email Meta Header */}
                <div className="p-4 border-b border-slate-800 bg-[#070c17] space-y-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white font-display line-clamp-2">
                      {selectedEmail.subject}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                      DELIVERED
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 space-y-1 font-mono">
                    <div className="flex items-center justify-between">
                      <span>To: <strong className="text-cyan-300">{selectedEmail.recipient}</strong></span>
                      <span className="text-slate-500">{new Date(selectedEmail.created_at).toLocaleString()}</span>
                    </div>
                    <div>From: <strong className="text-slate-300">TrustMesh Autonomous Engine &lt;alerts@trustmesh.local&gt;</strong></div>
                    <div>Delivery ID: <span className="text-emerald-400">{selectedEmail.resend_id || 'db-auto-verified'}</span></div>
                  </div>
                </div>

                {/* Rendered HTML Body */}
                <div className="flex-1 overflow-y-auto p-4 bg-[#05070a]">
                  {selectedEmail.html_content ? (
                    <div
                      className="bg-transparent text-slate-200"
                      dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}
                    />
                  ) : (
                    <div className="p-8 text-center text-slate-500 text-xs font-mono">
                      [Empty Message Body]
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-slate-500 text-xs">
                Select an email from the left list to read.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-6 border-t border-slate-800 bg-[#090f1d] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-mono">✔ 100% Self-Owned</span>
            <span>&bull;</span>
            <span>No third-party mediators</span>
            <span>&bull;</span>
            <span>No email sending quotas</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

