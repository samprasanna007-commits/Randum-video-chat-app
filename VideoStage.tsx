import React, { useEffect, useRef, useState } from 'react';
import { MicOff, Radio, Shield, Video, VideoOff, Wifi } from 'lucide-react';
import type { IceConnectionStatus, MatchState, PeerInfo } from '../types';

interface VideoStageProps {
  matchState: MatchState;
  iceState: IceConnectionStatus;
  endReasonLabel: string | null;
  currentPeer: PeerInfo | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCameraOn: boolean;
  isMicMuted: boolean;
  onlineCount: number;
  waitingCount: number;
  onStartVideoChat: () => void;
}

export const VideoStage: React.FC<VideoStageProps> = ({
  matchState,
  iceState,
  endReasonLabel,
  currentPeer,
  localStream,
  remoteStream,
  isCameraOn,
  isMicMuted,
  onlineCount,
  waitingCount,
  onStartVideoChat,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const [remoteHasVideo, setRemoteHasVideo] = useState<boolean>(false);

  useEffect(() => {
    const videoEl = localVideoRef.current;
    if (!videoEl) return;
    if (localStream) {
      videoEl.srcObject = localStream;
    } else {
      videoEl.srcObject = null;
    }
  }, [localStream]);

  useEffect(() => {
    const videoEl = remoteVideoRef.current;
    if (!videoEl) return;
    if (remoteStream) {
      videoEl.srcObject = remoteStream;
      const checkTracks = () => {
        const videoTracks = remoteStream.getVideoTracks();
        setRemoteHasVideo(videoTracks.some((t) => t.readyState === 'live' && t.enabled));
      };
      checkTracks();
      remoteStream.addEventListener('addtrack', checkTracks);
      remoteStream.addEventListener('removetrack', checkTracks);
      return () => {
        remoteStream.removeEventListener('addtrack', checkTracks);
        remoteStream.removeEventListener('removetrack', checkTracks);
      };
    } else {
      videoEl.srcObject = null;
      setRemoteHasVideo(false);
    }
  }, [remoteStream]);

  const showRemoteVideo =
    (matchState === 'connected' || matchState === 'connecting') && remoteStream !== null;

  const statusText = (() => {
    if (matchState === 'connected') return 'Live Video · India 18+';
    if (matchState === 'connecting') return `Connecting WebRTC (${iceState})`;
    if (matchState === 'searching') return 'Searching India Queue';
    if (matchState === 'ended') return 'Session Ended';
    return 'Ready to Match · India 18+';
  })();

  return (
    <div className="relative flex-1 w-full h-full min-h-[340px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#11151E] border border-white/10">
      {/* Remote Stream Video Element */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          showRemoteVideo && remoteHasVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Top Scrim & Honest State Label */}
      <div className="absolute inset-x-0 top-0 z-10 p-3 sm:p-4 bg-gradient-to-b from-black/75 via-black/35 to-transparent flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-white/95">
          <Wifi
            className={`w-4 h-4 shrink-0 ${
              matchState === 'connected'
                ? 'text-[#34D399]'
                : matchState === 'searching' || matchState === 'connecting'
                  ? 'text-[#60A5FA]'
                  : 'text-[#94A3B8]'
            }`}
          />
          <span className="truncate">{statusText}</span>
          {currentPeer && (
            <>
              <span className="text-white/40" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-xs text-white/75 tabular-nums">
                {currentPeer.region} · {currentPeer.role === 'caller' ? 'Initiator' : 'Receiver'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Honest Stage Overlays when no active remote video */}
      {!showRemoteVideo || !remoteHasVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
          {matchState === 'searching' && (
            <div className="max-w-sm space-y-4">
              <div className="mx-auto h-16 w-16 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/35 flex items-center justify-center text-[#60A5FA]">
                <Radio className="w-7 h-7 motion-safe:animate-pulse" />
              </div>
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-white">
                  Looking for a partner in India
                </h2>
                <p className="mt-2 text-sm text-[#94A3B8] leading-relaxed">
                  Matching randomly with another verified 18+ user in India regardless of gender.
                </p>
              </div>
              <p className="font-mono text-xs text-[#CBD5E1] tabular-nums">
                {onlineCount} online · {waitingCount} in queue
              </p>
              <p className="text-xs text-[#64748B]">
                Real WebRTC peer matching only — open a second tab or wait for another person to join.
              </p>
            </div>
          )}

          {matchState === 'connecting' && (
            <div className="max-w-sm space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-[#10B981]/15 border border-[#10B981]/35 flex items-center justify-center text-[#34D399]">
                <Wifi className="w-6 h-6" />
              </div>
              <h2 className="font-display text-xl font-semibold text-white">
                Partner Found — Connecting Video
              </h2>
              <p className="text-sm text-[#94A3B8]">
                Exchanging WebRTC session keys and ICE candidates ({iceState}).
              </p>
            </div>
          )}

          {matchState === 'connected' && !remoteHasVideo && (
            <div className="max-w-sm space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-white/8 border border-white/15 flex items-center justify-center text-[#CBD5E1]">
                <VideoOff className="w-6 h-6" />
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                Connected — Partner Video Off
              </h2>
              <p className="text-sm text-[#94A3B8]">
                Your partner is connected via audio or text chat without an active camera feed.
              </p>
            </div>
          )}

          {(matchState === 'idle' || matchState === 'ended') && (
            <div className="max-w-md space-y-5">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#34D399]">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {matchState === 'ended' && endReasonLabel
                    ? endReasonLabel
                    : 'Meet someone new across India'}
                </h2>
                <p className="mt-2.5 text-sm text-[#94A3B8] leading-relaxed">
                  Consenting adults 18+ only. Random 1-on-1 WebRTC video and text chat across all genders with instant Next, End Call, Report, and Block controls.
                </p>
              </div>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onStartVideoChat}
                  className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 rounded-xl bg-[#10B981] hover:bg-[#059669] active:scale-[0.98] text-[#052E16] font-semibold text-sm sm:text-base transition-all cursor-pointer"
                >
                  <Video className="w-5 h-5" />
                  <span>Start Video Chat</span>
                </button>
              </div>
              <p className="font-mono text-xs text-[#64748B] tabular-nums">
                {onlineCount} {onlineCount === 1 ? 'user' : 'users'} online in India right now
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Local Picture-in-Picture Camera Preview */}
      <div className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 z-20 w-24 h-32 sm:w-36 sm:h-24 md:w-44 md:h-28 rounded-2xl overflow-hidden bg-[#0B0D11] border border-white/20 shadow-xl">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover -scale-x-100 ${
            localStream && isCameraOn ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {(!localStream || !isCameraOn) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[#141821] text-[#94A3B8] p-2 text-center">
            <VideoOff className="w-4 h-4" />
            <span className="text-[11px] font-medium leading-tight">
              {localStream ? 'Cam Off' : 'Preview Off'}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-[10px] text-white/90">
          <span>You</span>
          {isMicMuted && <MicOff className="w-3 h-3 text-red-400" aria-label="Microphone muted" />}
        </div>
      </div>
    </div>
  );
};
