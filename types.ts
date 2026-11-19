export type MatchState = 'idle' | 'searching' | 'connecting' | 'connected' | 'ended';

export type SocketConnectionState = 'disconnected' | 'connecting' | 'online';

export type IceConnectionStatus =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface ChatMessage {
  id: string;
  sender: 'self' | 'peer' | 'system';
  text: string;
  timestamp: string;
}

export interface PeerInfo {
  peerId: string;
  region: 'IN';
  role: 'caller' | 'callee';
  roomId: string;
}

export interface RegionCheckResponse {
  allowed: boolean;
  countryCode: string;
  source: 'header' | 'development-fallback';
  message: string;
}

export type ReportReason =
  | 'underage'
  | 'inappropriate-nudity'
  | 'harassment'
  | 'spam-scam'
  | 'other';

export interface VerificationConsent {
  confirmed18Plus: boolean;
  confirmedIndiaOnly: boolean;
  acceptedGuidelines: boolean;
  birthYear?: number;
  verifiedAt: string;
}

// Client -> Server WebSocket Events
export type ClientWsEvent =
  | {
      type: 'session:register';
      clientId: string;
      ageConfirmed: boolean;
      indiaConfirmed: boolean;
      blockedIds: string[];
    }
  | {
      type: 'queue:join';
    }
  | {
      type: 'queue:leave';
    }
  | {
      type: 'call:next';
    }
  | {
      type: 'call:end';
    }
  | {
      type: 'rtc:offer';
      roomId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'rtc:answer';
      roomId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'rtc:ice-candidate';
      roomId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: 'chat:send';
      roomId: string;
      id: string;
      text: string;
      timestamp: string;
    }
  | {
      type: 'peer:block';
      targetClientId: string;
    }
  | {
      type: 'peer:report';
      targetClientId: string;
      roomId?: string;
      reason: ReportReason;
      details?: string;
    };

// Server -> Client WebSocket Events
export type ServerWsEvent =
  | {
      type: 'presence:update';
      onlineCount: number;
      waitingCount: number;
      activeCallsCount: number;
      regionScope: 'IN';
    }
  | {
      type: 'session:ready';
      clientId: string;
      regionAllowed: boolean;
      countryCode: string;
    }
  | {
      type: 'session:rejected';
      reason: string;
      code: 'AGE_REQUIRED' | 'INDIA_ONLY';
    }
  | {
      type: 'queue:searching';
      waitingCount: number;
    }
  | {
      type: 'match:found';
      roomId: string;
      peerId: string;
      role: 'caller' | 'callee';
      region: 'IN';
    }
  | {
      type: 'rtc:offer';
      roomId: string;
      fromPeerId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'rtc:answer';
      roomId: string;
      fromPeerId: string;
      sdp: RTCSessionDescriptionInit;
    }
  | {
      type: 'rtc:ice-candidate';
      roomId: string;
      fromPeerId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: 'chat:message';
      roomId: string;
      id: string;
      fromPeerId: string;
      text: string;
      timestamp: string;
    }
  | {
      type: 'match:ended';
      roomId: string;
      reason: 'partner-left' | 'partner-next' | 'ended-by-you' | 'blocked' | 'reported';
    }
  | {
      type: 'safety:ack';
      action: 'blocked' | 'reported';
      message: string;
    }
  | {
      type: 'error';
      message: string;
    };
