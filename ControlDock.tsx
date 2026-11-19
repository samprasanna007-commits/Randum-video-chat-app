import React from 'react';
import {
  Ban,
  Flag,
  MessageSquare,
  Mic,
  MicOff,
  PhoneOff,
  SkipForward,
  Video,
  VideoOff,
} from 'lucide-react';
import type { MatchState } from '../types';

interface ControlDockProps {
  matchState: MatchState;
  isCameraOn: boolean;
  isMicMuted: boolean;
  unreadCount: number;
  canModeratePeer: boolean;
  onStartVideoChat: () => void;
  onNext: () => void;
  onEndCall: () => void;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onOpenChatMobile: () => void;
  onOpenReportModal: () => void;
  onBlockPartner: () => void;
}

export const ControlDock: React.FC<ControlDockProps> = ({
  matchState,
  isCameraOn,
  isMicMuted,
  unreadCount,
  canModeratePeer,
  onStartVideoChat,
  onNext,
  onEndCall,
  onToggleCamera,
  onToggleMic,
  onOpenChatMobile,
  onOpenReportModal,
  onBlockPartner,
}) => {
  const isInSession =
    matchState === 'searching' || matchState === 'connecting' || matchState === 'connected';

  return (
    <div className="w-full rounded-2xl bg-[#141821]/95 backdrop-blur-md border border-white/10 p-2.5 sm:p-3 pb-safe">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Media Controls: Camera & Mic */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCamera}
            aria-label={isCameraOn ? 'Turn camera off' : 'Turn camera on'}
            className={`min-h-[48px] min-w-[48px] px-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              isCameraOn
                ? 'bg-[#1B212D] border-white/12 text-white hover:bg-[#232B3A]'
                : 'bg-red-500/15 border-red-500/35 text-red-200 hover:bg-red-500/25'
            }`}
          >
            {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            <span className="hidden sm:inline">{isCameraOn ? 'Cam On' : 'Cam Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleMic}
            aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            className={`min-h-[48px] min-w-[48px] px-3 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              !isMicMuted
                ? 'bg-[#1B212D] border-white/12 text-white hover:bg-[#232B3A]'
                : 'bg-red-500/15 border-red-500/35 text-red-200 hover:bg-red-500/25'
            }`}
          >
            {!isMicMuted ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            <span className="hidden sm:inline">{isMicMuted ? 'Muted' : 'Mic On'}</span>
          </button>
        </div>

        {/* Primary Call Controls: Start Video Chat / Next / End Call */}
        <div className="flex items-center gap-2">
          {!isInSession ? (
            <button
              type="button"
              onClick={onStartVideoChat}
              className="min-h-[48px] px-4 sm:px-5 rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-[0.98] text-[#052E16] font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Start Video Chat</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onNext}
                className="min-h-[48px] px-4 sm:px-5 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <SkipForward className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Next</span>
              </button>

              <button
                type="button"
                onClick={onEndCall}
                aria-label="End Call"
                className="min-h-[48px] min-w-[48px] px-3.5 sm:px-4 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] active:scale-[0.98] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">End Call</span>
              </button>
            </>
          )}
        </div>

        {/* Safety & Mobile Text Chat Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenChatMobile}
            aria-label="Open text chat"
            className="lg:hidden relative min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#1B212D] border border-white/12 text-white hover:bg-[#232B3A] text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-[#3B82F6] text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenReportModal}
            disabled={!canModeratePeer}
            aria-label="Report user"
            title={canModeratePeer ? 'Report partner' : 'Available during or right after a match'}
            className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#1B212D] border border-white/12 text-[#CBD5E1] hover:text-white hover:bg-[#232B3A] disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Flag className="w-4 h-4 text-amber-400" />
            <span className="hidden md:inline">Report</span>
          </button>

          <button
            type="button"
            onClick={onBlockPartner}
            disabled={!canModeratePeer}
            aria-label="Block user"
            title={canModeratePeer ? 'Block partner' : 'Available during or right after a match'}
            className="min-h-[48px] min-w-[48px] px-3 rounded-xl bg-[#1B212D] border border-white/12 text-[#CBD5E1] hover:text-red-300 hover:border-red-500/35 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Ban className="w-4 h-4 text-red-400" />
            <span className="hidden md:inline">Block</span>
          </button>
        </div>
      </div>
    </div>
  );
};
