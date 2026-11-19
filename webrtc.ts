export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
  iceCandidatePoolSize: 4,
};

export interface LocalMediaResult {
  stream: MediaStream | null;
  hasVideo: boolean;
  hasAudio: boolean;
  error: string | null;
}

export async function requestLocalMedia(
  wantVideo = true,
  wantAudio = true
): Promise<LocalMediaResult> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      stream: null,
      hasVideo: false,
      hasAudio: false,
      error: 'Camera and microphone access require a secure HTTPS context or supported browser.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: wantVideo
        ? {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : false,
      audio: wantAudio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : false,
    });

    return {
      stream,
      hasVideo: stream.getVideoTracks().length > 0,
      hasAudio: stream.getAudioTracks().length > 0,
      error: null,
    };
  } catch (err) {
    // Fallback to audio-only if camera failed or is absent
    if (wantVideo && wantAudio) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        return {
          stream: audioStream,
          hasVideo: false,
          hasAudio: audioStream.getAudioTracks().length > 0,
          error: 'Camera unavailable — joined with microphone audio only.',
        };
      } catch {
        // Ignore and fall through to permission error
      }
    }

    const message =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Camera or microphone permission was denied. You can still connect via text chat or allow permissions in browser settings.'
        : err instanceof DOMException && err.name === 'NotFoundError'
          ? 'No camera or microphone device found. Text chat remains available.'
          : 'Could not access camera or microphone. Text chat remains available.';

    return {
      stream: null,
      hasVideo: false,
      hasAudio: false,
      error: message,
    };
  }
}

export class WebRTCPeerSession {
  public readonly pc: RTCPeerConnection;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescriptionSet = false;
  private closed = false;

  constructor(options: {
    localStream: MediaStream | null;
    onIceCandidate: (candidate: RTCIceCandidateInit) => void;
    onRemoteStream: (stream: MediaStream) => void;
    onIceStateChange: (state: RTCIceConnectionState) => void;
  }) {
    this.pc = new RTCPeerConnection(RTC_CONFIG);

    const inboundStream = new MediaStream();

    if (options.localStream) {
      for (const track of options.localStream.getTracks()) {
        this.pc.addTrack(track, options.localStream);
      }
    } else {
      // Ensure SDP negotiation still succeeds even if local user has no media devices
      this.pc.addTransceiver('video', { direction: 'recvonly' });
      this.pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    this.pc.onicecandidate = (event) => {
      if (event.candidate && !this.closed) {
        options.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.ontrack = (event) => {
      if (this.closed) return;
      if (event.streams && event.streams[0]) {
        options.onRemoteStream(event.streams[0]);
      } else {
        inboundStream.addTrack(event.track);
        options.onRemoteStream(inboundStream);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.closed) {
        options.onIceStateChange(this.pc.iceConnectionState);
      }
    };
  }

  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  public async handleOfferAndCreateAnswer(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;
    await this.flushPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (this.pc.signalingState === 'closed') return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.remoteDescriptionSet = true;
    await this.flushPendingCandidates();
  }

  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.closed) return;
    if (!this.remoteDescriptionSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Ignore benign late/duplicate candidate errors
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    const queued = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        // Ignore invalid candidate
      }
    }
  }

  public replaceOrAddTrack(track: MediaStreamTrack, stream: MediaStream): void {
    if (this.closed) return;
    const sender = this.pc.getSenders().find((s) => s.track?.kind === track.kind);
    if (sender) {
      void sender.replaceTrack(track);
    } else {
      this.pc.addTrack(track, stream);
    }
  }

  public close(): void {
    if (this.closed) return;
    this.closed = true;
    this.pendingCandidates = [];
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.close();
  }
}
