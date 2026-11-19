import { useCallback, useEffect, useRef, useState } from 'react';
import { requestLocalMedia, WebRTCPeerSession } from '../lib/webrtc';
import type {
  ChatMessage,
  ClientWsEvent,
  IceConnectionStatus,
  MatchState,
  PeerInfo,
  RegionCheckResponse,
  ReportReason,
  ServerWsEvent,
  SocketConnectionState,
  VerificationConsent,
} from '../types';

const CLIENT_ID_STORAGE_KEY = 'delulu_client_id';
const CONSENT_STORAGE_KEY = 'delulu_consent_v1';
const BLOCKED_STORAGE_KEY = 'delulu_blocked_ids_v1';

function getOrCreateClientId(): string {
  try {
    const existing = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated = `in-${crypto.randomUUID()}`;
    sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
    return generated;
  } catch {
    return `in-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function loadBlockedIds(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function loadStoredConsent(): VerificationConsent | null {
  try {
    const raw = sessionStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VerificationConsent;
    if (parsed.confirmed18Plus && parsed.confirmedIndiaOnly && parsed.acceptedGuidelines) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function useSamRandomChat() {
  const [clientId] = useState<string>(() => getOrCreateClientId());
  const [consent, setConsent] = useState<VerificationConsent | null>(() => loadStoredConsent());
  const [blockedIds, setBlockedIds] = useState<string[]>(() => loadBlockedIds());

  const [regionCheck, setRegionCheck] = useState<RegionCheckResponse | null>(null);
  const [socketState, setSocketState] = useState<SocketConnectionState>('connecting');
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [activeCallsCount, setActiveCallsCount] = useState<number>(0);

  const [matchState, setMatchState] = useState<MatchState>('idle');
  const [endReasonLabel, setEndReasonLabel] = useState<string | null>(null);
  const [iceState, setIceState] = useState<IceConnectionStatus>('new');
  const [currentPeer, setCurrentPeer] = useState<PeerInfo | null>(null);
  const [lastPartnerId, setLastPartnerId] = useState<string | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [mediaNotice, setMediaNotice] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isChatOpenMobile, setIsChatOpenMobile] = useState<boolean>(false);
  const [safetyBanner, setSafetyBanner] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const rtcRef = useRef<WebRTCPeerSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const currentPeerRef = useRef<PeerInfo | null>(null);
  const consentRef = useRef<VerificationConsent | null>(consent);
  const blockedIdsRef = useRef<string[]>(blockedIds);
  const isChatOpenMobileRef = useRef<boolean>(isChatOpenMobile);
  const reconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    currentPeerRef.current = currentPeer;
  }, [currentPeer]);

  useEffect(() => {
    consentRef.current = consent;
  }, [consent]);

  useEffect(() => {
    blockedIdsRef.current = blockedIds;
    try {
      localStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(blockedIds));
    } catch {
      // Ignore storage error
    }
  }, [blockedIds]);

  useEffect(() => {
    isChatOpenMobileRef.current = isChatOpenMobile;
    if (isChatOpenMobile) {
      setUnreadCount(0);
    }
  }, [isChatOpenMobile]);

  const sendWs = useCallback((event: ClientWsEvent) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }, []);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((existing) => existing.id === msg.id)) {
        return prev;
      }
      return [...prev, msg];
    });
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (rtcRef.current) {
      rtcRef.current.close();
      rtcRef.current = null;
    }
    setRemoteStream(null);
    setIceState('closed');
  }, []);

  const handleServerEvent = useCallback(
    async (event: ServerWsEvent) => {
      switch (event.type) {
        case 'presence:update': {
          setOnlineCount(event.onlineCount);
          setWaitingCount(event.waitingCount);
          setActiveCallsCount(event.activeCallsCount);
          break;
        }

        case 'session:ready': {
          setSocketState('online');
          break;
        }

        case 'session:rejected': {
          setSafetyBanner(event.reason);
          setMatchState('idle');
          break;
        }

        case 'queue:searching': {
          cleanupPeerConnection();
          setCurrentPeer(null);
          setEndReasonLabel(null);
          setMessages([]);
          setUnreadCount(0);
          setMatchState('searching');
          setWaitingCount(event.waitingCount);
          break;
        }

        case 'match:found': {
          cleanupPeerConnection();
          const peer: PeerInfo = {
            peerId: event.peerId,
            region: event.region,
            role: event.role,
            roomId: event.roomId,
          };
          setCurrentPeer(peer);
          setLastPartnerId(event.peerId);
          setEndReasonLabel(null);
          setMatchState('connecting');
          setIceState('new');
          setMessages([
            {
              id: `sys-match-${event.roomId}`,
              sender: 'system',
              text: 'Matched with a consenting adult (18+) in India. Say hello.',
              timestamp: new Date().toISOString(),
            },
          ]);

          const session = new WebRTCPeerSession({
            localStream: localStreamRef.current,
            onIceCandidate: (candidate) => {
              sendWs({
                type: 'rtc:ice-candidate',
                roomId: event.roomId,
                candidate,
              });
            },
            onRemoteStream: (stream) => {
              setRemoteStream(stream);
            },
            onIceStateChange: (state) => {
              setIceState(state);
              if (state === 'connected' || state === 'completed') {
                setMatchState('connected');
              } else if (state === 'failed') {
                setMediaNotice('WebRTC connection failed across NAT. You can tap Next to rematch.');
              }
            },
          });

          rtcRef.current = session;

          if (event.role === 'caller') {
            try {
              const offer = await session.createOffer();
              sendWs({
                type: 'rtc:offer',
                roomId: event.roomId,
                sdp: offer,
              });
            } catch {
              setMediaNotice('Failed to initialize WebRTC offer.');
            }
          }
          break;
        }

        case 'rtc:offer': {
          const peer = currentPeerRef.current;
          const session = rtcRef.current;
          if (!peer || !session || peer.roomId !== event.roomId) return;
          try {
            const answer = await session.handleOfferAndCreateAnswer(event.sdp);
            sendWs({
              type: 'rtc:answer',
              roomId: event.roomId,
              sdp: answer,
            });
            setMatchState('connected');
          } catch {
            setMediaNotice('Failed to process incoming WebRTC offer.');
          }
          break;
        }

        case 'rtc:answer': {
          const peer = currentPeerRef.current;
          const session = rtcRef.current;
          if (!peer || !session || peer.roomId !== event.roomId) return;
          try {
            await session.handleAnswer(event.sdp);
            setMatchState('connected');
          } catch {
            setMediaNotice('Failed to finalize WebRTC answer.');
          }
          break;
        }

        case 'rtc:ice-candidate': {
          const peer = currentPeerRef.current;
          const session = rtcRef.current;
          if (!peer || !session || peer.roomId !== event.roomId) return;
          await session.addIceCandidate(event.candidate);
          break;
        }

        case 'chat:message': {
          const peer = currentPeerRef.current;
          if (!peer || peer.roomId !== event.roomId) return;
          appendMessage({
            id: event.id,
            sender: 'peer',
            text: event.text,
            timestamp: event.timestamp,
          });
          if (!isChatOpenMobileRef.current) {
            setUnreadCount((count) => count + 1);
          }
          break;
        }

        case 'match:ended': {
          cleanupPeerConnection();
          setCurrentPeer(null);
          setMatchState('ended');
          const reasonMap: Record<typeof event.reason, string> = {
            'partner-left': 'Your partner ended the video chat.',
            'partner-next': 'Your partner moved to the next match.',
            'ended-by-you': 'You ended the video chat.',
            blocked: 'Partner blocked. This session has ended.',
            reported: 'Report submitted and partner blocked.',
          };
          setEndReasonLabel(reasonMap[event.reason]);
          appendMessage({
            id: `sys-end-${event.roomId}-${event.reason}`,
            sender: 'system',
            text: reasonMap[event.reason],
            timestamp: new Date().toISOString(),
          });
          break;
        }

        case 'safety:ack': {
          setSafetyBanner(event.message);
          break;
        }

        case 'error': {
          setSafetyBanner(event.message);
          break;
        }
      }
    },
    [appendMessage, cleanupPeerConnection, sendWs]
  );

  // Check India-only region status on mount
  useEffect(() => {
    let active = true;
    fetch('/api/session/region')
      .then((res) => res.json())
      .then((data: RegionCheckResponse) => {
        if (active) setRegionCheck(data);
      })
      .catch(() => {
        if (active) {
          setRegionCheck({
            allowed: true,
            countryCode: 'IN',
            source: 'development-fallback',
            message: 'India-only session check ready.',
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Connect WebSocket signaling server
  useEffect(() => {
    let disposed = false;

    function connectSocket() {
      if (disposed) return;
      setSocketState('connecting');
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) {
          ws.close();
          return;
        }
        setSocketState('online');
        const activeConsent = consentRef.current;
        if (activeConsent) {
          ws.send(
            JSON.stringify({
              type: 'session:register',
              clientId,
              ageConfirmed: activeConsent.confirmed18Plus,
              indiaConfirmed: activeConsent.confirmedIndiaOnly,
              blockedIds: blockedIdsRef.current,
            } satisfies ClientWsEvent)
          );
        }
      };

      ws.onmessage = (msgEvent) => {
        try {
          const parsed = JSON.parse(String(msgEvent.data)) as ServerWsEvent;
          void handleServerEvent(parsed);
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setSocketState('disconnected');
        reconnectTimerRef.current = window.setTimeout(() => {
          connectSocket();
        }, 2000);
      };

      ws.onerror = () => {
        // Closed handler handles reconnect cleanly
      };
    }

    connectSocket();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      cleanupPeerConnection();
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, [cleanupPeerConnection, clientId, handleServerEvent]);

  const verifyAdultAccess = useCallback(
    (nextConsent: VerificationConsent) => {
      setConsent(nextConsent);
      try {
        sessionStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(nextConsent));
      } catch {
        // Ignore storage error
      }
      sendWs({
        type: 'session:register',
        clientId,
        ageConfirmed: nextConsent.confirmed18Plus,
        indiaConfirmed: nextConsent.confirmedIndiaOnly,
        blockedIds: blockedIdsRef.current,
      });
    },
    [clientId, sendWs]
  );

  const ensureLocalMedia = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    const result = await requestLocalMedia(isCameraOn, !isMicMuted);
    if (result.error) {
      setMediaNotice(result.error);
    } else {
      setMediaNotice(null);
    }
    if (result.stream) {
      setLocalStream(result.stream);
      setIsCameraOn(result.hasVideo);
      setIsMicMuted(!result.hasAudio);
      localStreamRef.current = result.stream;
      return result.stream;
    }
    return null;
  }, [isCameraOn, isMicMuted]);

  const startVideoChat = useCallback(async () => {
    if (!consentRef.current) return;
    setSafetyBanner(null);
    setEndReasonLabel(null);
    await ensureLocalMedia();
    sendWs({ type: 'queue:join' });
  }, [ensureLocalMedia, sendWs]);

  const nextPartner = useCallback(async () => {
    if (!consentRef.current) return;
    setSafetyBanner(null);
    cleanupPeerConnection();
    setCurrentPeer(null);
    setMessages([]);
    setUnreadCount(0);
    await ensureLocalMedia();
    sendWs({ type: 'call:next' });
  }, [cleanupPeerConnection, ensureLocalMedia, sendWs]);

  const endCall = useCallback(() => {
    cleanupPeerConnection();
    setCurrentPeer(null);
    setMatchState('idle');
    setEndReasonLabel('Call ended.');
    sendWs({ type: 'call:end' });
  }, [cleanupPeerConnection, sendWs]);

  const toggleCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) {
      const result = await requestLocalMedia(true, !isMicMuted);
      if (result.error) setMediaNotice(result.error);
      if (result.stream) {
        setLocalStream(result.stream);
        localStreamRef.current = result.stream;
        setIsCameraOn(result.hasVideo);
        setIsMicMuted(!result.hasAudio);
        const videoTrack = result.stream.getVideoTracks()[0];
        if (videoTrack && rtcRef.current) {
          rtcRef.current.replaceOrAddTrack(videoTrack, result.stream);
        }
      }
      return;
    }

    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      const result = await requestLocalMedia(true, false);
      if (result.error) {
        setMediaNotice(result.error);
        return;
      }
      const newTrack = result.stream?.getVideoTracks()[0];
      if (newTrack) {
        stream.addTrack(newTrack);
        setIsCameraOn(true);
        if (rtcRef.current) {
          rtcRef.current.replaceOrAddTrack(newTrack, stream);
        }
      }
      return;
    }

    const nextEnabled = !isCameraOn;
    for (const track of videoTracks) {
      track.enabled = nextEnabled;
    }
    setIsCameraOn(nextEnabled);
  }, [isCameraOn, isMicMuted]);

  const toggleMic = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) {
      const result = await requestLocalMedia(isCameraOn, true);
      if (result.error) setMediaNotice(result.error);
      if (result.stream) {
        setLocalStream(result.stream);
        localStreamRef.current = result.stream;
        setIsCameraOn(result.hasVideo);
        setIsMicMuted(!result.hasAudio);
        const audioTrack = result.stream.getAudioTracks()[0];
        if (audioTrack && rtcRef.current) {
          rtcRef.current.replaceOrAddTrack(audioTrack, result.stream);
        }
      }
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      const result = await requestLocalMedia(false, true);
      if (result.error) {
        setMediaNotice(result.error);
        return;
      }
      const newTrack = result.stream?.getAudioTracks()[0];
      if (newTrack) {
        stream.addTrack(newTrack);
        setIsMicMuted(false);
        if (rtcRef.current) {
          rtcRef.current.replaceOrAddTrack(newTrack, stream);
        }
      }
      return;
    }

    const nextMuted = !isMicMuted;
    for (const track of audioTracks) {
      track.enabled = !nextMuted;
    }
    setIsMicMuted(nextMuted);
  }, [isCameraOn, isMicMuted]);

  const sendMessage = useCallback(
    (text: string) => {
      const peer = currentPeerRef.current;
      const trimmed = text.trim();
      if (!peer || !trimmed) return;

      const msg: ChatMessage = {
        id: `msg-${crypto.randomUUID()}`,
        sender: 'self',
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      appendMessage(msg);
      sendWs({
        type: 'chat:send',
        roomId: peer.roomId,
        id: msg.id,
        text: trimmed,
        timestamp: msg.timestamp,
      });
    },
    [appendMessage, sendWs]
  );

  const blockPartner = useCallback(
    (targetId?: string | null) => {
      const partnerId = targetId ?? currentPeerRef.current?.peerId ?? lastPartnerId;
      if (!partnerId) return;

      setBlockedIds((prev) => (prev.includes(partnerId) ? prev : [...prev, partnerId]));
      cleanupPeerConnection();
      setCurrentPeer(null);
      setMatchState('idle');
      setEndReasonLabel('User blocked. They will not be matched with you again.');
      sendWs({ type: 'peer:block', targetClientId: partnerId });
    },
    [cleanupPeerConnection, lastPartnerId, sendWs]
  );

  const reportPartner = useCallback(
    async (reason: ReportReason, details: string, targetId?: string | null) => {
      const partnerId = targetId ?? currentPeerRef.current?.peerId ?? lastPartnerId;
      if (!partnerId) return;
      const roomId = currentPeerRef.current?.roomId;

      setBlockedIds((prev) => (prev.includes(partnerId) ? prev : [...prev, partnerId]));
      cleanupPeerConnection();
      setCurrentPeer(null);
      setMatchState('idle');
      setEndReasonLabel('Report submitted and user blocked.');

      sendWs({
        type: 'peer:report',
        targetClientId: partnerId,
        roomId,
        reason,
        details,
      });

      try {
        await fetch('/api/moderation/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reporterId: clientId,
            targetClientId: partnerId,
            roomId,
            reason,
            details,
          }),
        });
      } catch {
        // WebSocket report already sent
      }
    },
    [cleanupPeerConnection, clientId, lastPartnerId, sendWs]
  );

  const clearBlocklist = useCallback(() => {
    setBlockedIds([]);
    if (consentRef.current) {
      sendWs({
        type: 'session:register',
        clientId,
        ageConfirmed: consentRef.current.confirmed18Plus,
        indiaConfirmed: consentRef.current.confirmedIndiaOnly,
        blockedIds: [],
      });
    }
    setSafetyBanner('Session blocklist cleared.');
  }, [clientId, sendWs]);

  return {
    clientId,
    consent,
    regionCheck,
    socketState,
    onlineCount,
    waitingCount,
    activeCallsCount,
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
    blockedCount: blockedIds.length,
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
  };
}
