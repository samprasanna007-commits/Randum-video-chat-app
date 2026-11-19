import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, ShieldCheck, X } from 'lucide-react';
import { AgeGateModal } from './components/AgeGateModal';
import { ControlDock } from './components/ControlDock';
import { ReportBlockModal } from './components/ReportBlockModal';
import { TextChatPanel } from './components/TextChatPanel';
import { VideoStage } from './components/VideoStage';
import { useSamRandomChat } from './hooks/useSamRandomChat';

export default function App() {
  const {
    consent,
    regionCheck,
    socketState,
    onlineCount,
    waitingCount,
    matchState,
    endReasonLabel,
    iceState,
    currentPeer,
    lastPartnerId,
    localStream,
    remoteStream,
    isCameraOn,
    isMicMuted,
    mediaNotice,
    messages,
    unreadCount,
    isChatOpenMobile,
    setIsChatOpenMobile,
    safetyBanner,
    setSafetyBanner,
    setMediaNotice,
    blockedCount,
    verifyAdultAccess,
    startVideoChat,
    nextPartner,
    endCall,
    toggleCamera,
    toggleMic,
    sendMessage,
    blockPartner,
    reportPartner,
    clearBlocklist,
  } = useSamRandomChat();

  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  if (!consent || (regionCheck !== null && !regionCheck.allowed)) {
    return <AgeGateModal regionCheck={regionCheck} onConfirm={verifyAdultAccess} />;
  }

  const canModeratePeer = currentPeer !== null || lastPartnerId !== null;

  const onlineStatusLabel =
    socketState === 'online'
      ? `${onlineCount} online · India 18+`
      : socketState === 'connecting'
        ? 'Connecting to server...'
        : 'Offline · Reconnecting...';

  return (
    <div className="h-[100dvh] w-full bg-[#0B0D11] text-[#F4F6F9] flex flex-col overflow-hidden">
      {/* Compact Top App Bar (<= 56px on mobile) */}
      <header className="h-14 shrink-0 border-b border-white/10 bg-[#0B0D11]/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
        <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
          Delulu
        </span>

        <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm text-[#CBD5E1] whitespace-nowrap shrink-0">
          <Globe
            className={`w-4 h-4 shrink-0 ${
              socketState === 'online' ? 'text-[#34D399]' : 'text-amber-400'
            }`}
          />
          <span className="font-mono tabular-nums">{onlineStatusLabel}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="min-h-[40px] px-3 rounded-xl bg-[#141821] hover:bg-[#1B212D] border border-white/12 text-xs sm:text-sm font-medium text-[#E2E8F0] flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ShieldCheck className="w-4 h-4 text-[#34D399]" />
          <span>Safety</span>
        </button>
      </header>

      {/* Mobile Compact Online Status Strip */}
      <div className="sm:hidden px-4 py-1.5 border-b border-white/8 bg-[#11151E] flex items-center justify-between text-xs text-[#CBD5E1] shrink-0">
        <div className="flex items-center gap-1.5">
          <Globe
            className={`w-3.5 h-3.5 shrink-0 ${
              socketState === 'online' ? 'text-[#34D399]' : 'text-amber-400'
            }`}
          />
          <span className="font-mono tabular-nums">{onlineStatusLabel}</span>
        </div>
        <span className="text-[#94A3B8]">Random · All Genders</span>
      </div>

      {/* Main Studio Content */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 flex flex-col lg:flex-row gap-3 lg:gap-5">
        <section className="flex-1 min-h-0 flex flex-col gap-3">
          {/* Real Feedback Notices (Media Permissions or Safety Actions) */}
          {(mediaNotice || safetyBanner) && (
            <div className="shrink-0 flex flex-col gap-2">
              {mediaNotice && (
                <div
                  role="status"
                  className="rounded-xl bg-amber-500/10 border border-amber-400/25 px-3.5 py-2.5 text-xs sm:text-sm text-amber-100 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate sm:whitespace-normal">{mediaNotice}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaNotice(null)}
                    aria-label="Dismiss media notice"
                    className="p-1 text-amber-200/80 hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {safetyBanner && (
                <div
                  role="status"
                  className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/25 px-3.5 py-2.5 text-xs sm:text-sm text-[#D1FAE5] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                    <span className="truncate sm:whitespace-normal">{safetyBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSafetyBanner(null)}
                    aria-label="Dismiss safety notice"
                    className="p-1 text-[#A7F3D0] hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Video Stage */}
          <div className="flex-1 min-h-0">
            <VideoStage
              matchState={matchState}
              iceState={iceState}
              endReasonLabel={endReasonLabel}
              currentPeer={currentPeer}
              localStream={localStream}
              remoteStream={remoteStream}
              isCameraOn={isCameraOn}
              isMicMuted={isMicMuted}
              onlineCount={onlineCount}
              waitingCount={waitingCount}
              onStartVideoChat={startVideoChat}
            />
          </div>

          {/* Thumb-Zone Call Controls */}
          <div className="shrink-0">
            <ControlDock
              matchState={matchState}
              isCameraOn={isCameraOn}
              isMicMuted={isMicMuted}
              unreadCount={unreadCount}
              canModeratePeer={canModeratePeer}
              onStartVideoChat={startVideoChat}
              onNext={nextPartner}
              onEndCall={endCall}
              onToggleCamera={toggleCamera}
              onToggleMic={toggleMic}
              onOpenChatMobile={() => setIsChatOpenMobile(true)}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onBlockPartner={() => blockPartner()}
            />
          </div>
        </section>

        {/* Live Text Chat (Desktop Sidebar + Mobile Bottom Sheet) */}
        <TextChatPanel
          messages={messages}
          matchState={matchState}
          currentPeer={currentPeer}
          isMobileOpen={isChatOpenMobile}
          onCloseMobile={() => setIsChatOpenMobile(false)}
          onSendMessage={sendMessage}
        />
      </main>

      <ReportBlockModal
        isOpen={isReportModalOpen}
        hasTargetPartner={canModeratePeer}
        blockedCount={blockedCount}
        onClose={() => setIsReportModalOpen(false)}
        onSubmitReport={(reason, details) => void reportPartner(reason, details)}
        onBlockOnly={() => blockPartner()}
        onClearBlocklist={clearBlocklist}
      />
    </div>
  );
}
