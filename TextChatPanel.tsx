import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import type { ChatMessage, MatchState, PeerInfo } from '../types';

interface TextChatPanelProps {
  messages: ChatMessage[];
  matchState: MatchState;
  currentPeer: PeerInfo | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onSendMessage: (text: string) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const TextChatPanel: React.FC<TextChatPanelProps> = ({
  messages,
  matchState,
  currentPeer,
  isMobileOpen,
  onCloseMobile,
  onSendMessage,
}) => {
  const [draft, setDraft] = useState<string>('');
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend =
    currentPeer !== null && (matchState === 'connecting' || matchState === 'connected');

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isMobileOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend || !draft.trim()) return;
    onSendMessage(draft);
    setDraft('');
  };

  const chatBody = (
    <div className="flex flex-col h-full bg-[#141821] text-[#F4F6F9]">
      <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="font-display text-base font-semibold text-white">Text Chat</h2>
          <p className="text-xs text-[#94A3B8]">
            {canSend
              ? 'Matched in India · 18+ Random Session'
              : matchState === 'searching'
                ? 'Waiting for a live partner to join'
                : 'Start a video chat to message a partner'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close text chat"
          className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-[#CBD5E1] cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center px-4">
            <p className="text-sm font-medium text-[#CBD5E1]">No messages yet</p>
            <p className="mt-1 text-xs text-[#64748B] max-w-[240px] leading-relaxed">
              Live peer messages appear here once you are paired with another verified 18+ user in India.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="py-1 text-center">
                  <span className="text-xs text-[#94A3B8]">{msg.text}</span>
                </div>
              );
            }
            const isSelf = msg.sender === 'self';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words ${
                    isSelf
                      ? 'bg-[#3B82F6] text-white rounded-br-sm'
                      : 'bg-[#1B212D] border border-white/10 text-[#F4F6F9] rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="mt-1 text-[11px] text-[#64748B] font-mono tabular-nums">
                  {isSelf ? 'You' : 'Partner'} · {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-white/10 bg-[#11151E] flex items-center gap-2 shrink-0 pb-safe"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!canSend}
          maxLength={1000}
          placeholder={canSend ? 'Send a message...' : 'Waiting for a match...'}
          className="flex-1 min-h-[44px] rounded-xl bg-[#0B0D11] border border-white/12 px-3.5 text-sm text-white placeholder:text-[#64748B] focus:outline-none focus:border-[#3B82F6] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend || !draft.trim()}
          aria-label="Send message"
          className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop Side Panel */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[360px] xl:w-[390px] h-full rounded-3xl overflow-hidden border border-white/10 shrink-0">
        {chatBody}
      </aside>

      {/* Mobile Bottom Sheet Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Text Chat"
        >
          <div className="w-full h-[76vh] rounded-t-3xl overflow-hidden border-t border-white/15 bg-[#141821] flex flex-col shadow-2xl">
            <div className="pt-2.5 pb-1 flex justify-center bg-[#141821] shrink-0">
              <span className="w-10 h-1.5 rounded-full bg-white/20" />
            </div>
            <div className="flex-1 min-h-0">{chatBody}</div>
          </div>
        </div>
      )}
    </>
  );
};
