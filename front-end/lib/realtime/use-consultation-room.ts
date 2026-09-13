"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  IceServerDto,
  ParticipantDto,
  UserRole,
} from "@telemed/service-contracts";
import { useSession } from "@/lib/auth";
import type {
  RealtimeConnectionState,
  RealtimeEventPayload,
  RoomParticipant,
} from "./types";
import { useRealtime } from "./socket-context";

interface IceEntry {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

const ROOM_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente para acessar a sala.",
  FORBIDDEN: "Você não tem acesso a este atendimento.",
  VALIDATION_FAILED: "Os dados do atendimento são inválidos.",
  NOT_FOUND: "Atendimento não encontrado.",
  INTERNAL_ERROR: "Não foi possível entrar na sala. Tente novamente.",
};

export interface UseConsultationRoomOptions {
  consultationId: string;
  appointmentId: string;
  role: UserRole;
}

export interface UseConsultationRoomResult {
  start: () => Promise<void>;
  retry: () => Promise<void>;
  stop: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  hasStarted: boolean;
  isStarting: boolean;
  connectionState: RealtimeConnectionState;
  participants: RoomParticipant[];
  error: string | null;
}

function isPolite(role: UserRole): boolean {
  return role !== "doctor";
}

function toIceCandidate(entry: IceEntry): RTCIceCandidateInit {
  return {
    candidate: entry.candidate,
    sdpMid: entry.sdpMid,
    sdpMLineIndex: entry.sdpMLineIndex,
  };
}

function toIceConfiguration(iceServers: IceServerDto[]): RTCIceServer[] {
  return iceServers.map((server) => ({
    urls: server.urls,
    username: server.username,
    credential: server.credential,
  }));
}

export function mediaErrorMessage(error: unknown): string {
  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "Permissão de câmera e microfone negada. Libere o acesso nas configurações do navegador e tente novamente.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "Nenhuma câmera ou microfone foi encontrado neste dispositivo.";
      case "NotReadableError":
        return "Não foi possível usar a câmera ou o microfone. Feche outros aplicativos e tente novamente.";
      default:
        return "Não foi possível iniciar a captura de vídeo e áudio. Tente novamente.";
    }
  }
  if (error instanceof Error) {
    if (error.message === "SOCKET_UNAVAILABLE") {
      return "Sem conexão com o servidor de atendimento. Verifique sua rede e tente novamente.";
    }
    if (error.message === "MEDIA_UNSUPPORTED") {
      return "Este navegador não oferece suporte a chamadas de vídeo.";
    }
  }
  return "Não foi possível iniciar o atendimento. Tente novamente.";
}

export function useConsultationRoom({
  consultationId,
  appointmentId,
  role,
}: UseConsultationRoomOptions): UseConsultationRoomResult {
  void consultationId;

  const { socket } = useRealtime();
  const { user } = useSession();
  const selfId = user?.id ?? null;

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<RoomParticipant[]>(
    [],
  );
  const [selfJoinedAt, setSelfJoinedAt] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [pcConnectionState, setPcConnectionState] =
    useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceRef = useRef<IceEntry[]>([]);
  const remoteParticipantsRef = useRef<Map<string, RoomParticipant>>(new Map());
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const startedRef = useRef(false);
  const micRef = useRef(true);
  const cameraRef = useRef(true);
  const polite = isPolite(role);

  const syncParticipants = useCallback(() => {
    setRemoteParticipants([...remoteParticipantsRef.current.values()]);
  }, []);

  const flushPendingIce = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const entry of pending) {
      try {
        await pc.addIceCandidate(toIceCandidate(entry));
      } catch {
        return;
      }
    }
  }, []);

  useEffect(() => {
    if (!socket || !selfId) {
      return;
    }

    const negotiate = async (pc: RTCPeerConnection): Promise<void> => {
      if (makingOfferRef.current) {
        return;
      }
      makingOfferRef.current = true;
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState === "closed") {
          return;
        }
        await pc.setLocalDescription(offer);
        const sdp = pc.localDescription?.sdp ?? offer.sdp;
        if (sdp) {
          socket.emit("webrtc.offer", { appointmentId, sdp });
        }
      } catch {
        setError("Não foi possível negociar a conexão de vídeo. Tente novamente.");
      } finally {
        makingOfferRef.current = false;
      }
    };

    const ensurePeerConnection = (
      iceServers: IceServerDto[],
    ): RTCPeerConnection => {
      if (pcRef.current) {
        return pcRef.current;
      }

      const pc = new RTCPeerConnection({
        iceServers: toIceConfiguration(iceServers),
      });

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          return;
        }
        socket.emit("webrtc.ice", {
          appointmentId,
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
        });
      };

      pc.ontrack = (event) => {
        const incoming = event.streams[0];
        if (incoming) {
          remoteStreamRef.current = incoming;
        } else {
          const current = remoteStreamRef.current ?? new MediaStream();
          if (!current.getTracks().some((track) => track.id === event.track.id)) {
            current.addTrack(event.track);
          }
          remoteStreamRef.current = current;
        }
        setRemoteStream(remoteStreamRef.current);
      };

      pc.onconnectionstatechange = () => {
        setPcConnectionState(pc.connectionState);
        if (pc.connectionState === "failed") {
          setError(
            "A conexão de vídeo falhou. Verifique sua rede e tente novamente.",
          );
        }
      };

      pc.onnegotiationneeded = () => {
        void negotiate(pc);
      };

      pcRef.current = pc;
      setPcConnectionState(pc.connectionState);
      return pc;
    };

    const onRoomJoined = (
      payload: RealtimeEventPayload<"room.joined">,
    ): void => {
      if (payload.appointmentId !== appointmentId) {
        return;
      }

      const self = payload.participants.find(
        (participant: ParticipantDto) => participant.userId === selfId,
      );
      if (self) {
        setSelfJoinedAt(self.joinedAt);
      }

      remoteParticipantsRef.current.clear();
      for (const participant of payload.participants) {
        if (participant.userId === selfId) {
          continue;
        }
        remoteParticipantsRef.current.set(participant.userId, {
          userId: participant.userId,
          role: participant.role,
          joinedAt: participant.joinedAt,
          mic: true,
          camera: true,
          isSelf: false,
        });
      }
      syncParticipants();

      const stream = localStreamRef.current;
      if (!stream) {
        return;
      }

      const pc = ensurePeerConnection(payload.iceServers);
      for (const track of stream.getTracks()) {
        const alreadyAdded = pc
          .getSenders()
          .some((sender) => sender.track?.id === track.id);
        if (!alreadyAdded) {
          pc.addTrack(track, stream);
        }
      }

      socket.emit("media.state", {
        appointmentId,
        mic: micRef.current,
        camera: cameraRef.current,
      });
    };

    const onRoomError = (
      payload: RealtimeEventPayload<"room.error">,
    ): void => {
      setError(
        ROOM_ERROR_MESSAGES[payload.code] ??
          "Não foi possível entrar na sala do atendimento.",
      );
    };

    const onOffer = async (
      payload: RealtimeEventPayload<"webrtc.offer">,
    ): Promise<void> => {
      if (
        payload.appointmentId !== appointmentId ||
        payload.fromUserId === selfId
      ) {
        return;
      }
      const pc = pcRef.current;
      if (!pc) {
        return;
      }
      try {
        const offerCollision =
          makingOfferRef.current || pc.signalingState !== "stable";
        ignoreOfferRef.current = !polite && offerCollision;
        if (ignoreOfferRef.current) {
          return;
        }
        await pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
        await flushPendingIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const sdp = pc.localDescription?.sdp ?? answer.sdp;
        if (sdp) {
          socket.emit("webrtc.answer", { appointmentId, sdp });
        }
      } catch {
        setError("Não foi possível responder à negociação de vídeo.");
      }
    };

    const onAnswer = async (
      payload: RealtimeEventPayload<"webrtc.answer">,
    ): Promise<void> => {
      if (
        payload.appointmentId !== appointmentId ||
        payload.fromUserId === selfId
      ) {
        return;
      }
      const pc = pcRef.current;
      if (!pc || pc.signalingState !== "have-local-offer") {
        return;
      }
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
        await flushPendingIce(pc);
      } catch {
        setError("Não foi possível concluir a negociação de vídeo.");
      }
    };

    const onIce = async (
      payload: RealtimeEventPayload<"webrtc.ice">,
    ): Promise<void> => {
      if (
        payload.appointmentId !== appointmentId ||
        payload.fromUserId === selfId
      ) {
        return;
      }
      const entry: IceEntry = {
        candidate: payload.candidate,
        sdpMid: payload.sdpMid,
        sdpMLineIndex: payload.sdpMLineIndex,
      };
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current.push(entry);
        return;
      }
      try {
        await pc.addIceCandidate(toIceCandidate(entry));
      } catch {
        if (!ignoreOfferRef.current) {
          setError("Falha ao processar candidato de rede.");
        }
      }
    };

    const onMediaState = (
      payload: RealtimeEventPayload<"media.state">,
    ): void => {
      if (payload.appointmentId !== appointmentId || payload.userId === selfId) {
        return;
      }
      const existing = remoteParticipantsRef.current.get(payload.userId);
      remoteParticipantsRef.current.set(payload.userId, {
        userId: payload.userId,
        role: existing?.role ?? "patient",
        joinedAt: existing?.joinedAt ?? null,
        mic: payload.mic,
        camera: payload.camera,
        isSelf: false,
      });
      syncParticipants();
    };

    const onParticipantJoined = (
      payload: RealtimeEventPayload<"participant.joined">,
    ): void => {
      if (payload.appointmentId !== appointmentId || payload.userId === selfId) {
        return;
      }
      const existing = remoteParticipantsRef.current.get(payload.userId);
      remoteParticipantsRef.current.set(payload.userId, {
        userId: payload.userId,
        role: payload.role,
        joinedAt: payload.joinedAt,
        mic: existing?.mic ?? true,
        camera: existing?.camera ?? true,
        isSelf: false,
      });
      syncParticipants();

      socket.emit("media.state", {
        appointmentId,
        mic: micRef.current,
        camera: cameraRef.current,
      });

      const pc = pcRef.current;
      if (role === "doctor" && pc) {
        void negotiate(pc);
      }
    };

    const onParticipantLeft = (
      payload: RealtimeEventPayload<"participant.left">,
    ): void => {
      if (payload.appointmentId !== appointmentId || payload.userId === selfId) {
        return;
      }
      remoteParticipantsRef.current.delete(payload.userId);
      syncParticipants();
    };

    const onSocketConnect = (): void => {
      if (startedRef.current) {
        socket.emit("room.join", { appointmentId });
      }
    };

    socket.on("room.joined", onRoomJoined);
    socket.on("room.error", onRoomError);
    socket.on("webrtc.offer", onOffer);
    socket.on("webrtc.answer", onAnswer);
    socket.on("webrtc.ice", onIce);
    socket.on("media.state", onMediaState);
    socket.on("participant.joined", onParticipantJoined);
    socket.on("participant.left", onParticipantLeft);
    socket.on("connect", onSocketConnect);

    return () => {
      socket.off("room.joined", onRoomJoined);
      socket.off("room.error", onRoomError);
      socket.off("webrtc.offer", onOffer);
      socket.off("webrtc.answer", onAnswer);
      socket.off("webrtc.ice", onIce);
      socket.off("media.state", onMediaState);
      socket.off("participant.joined", onParticipantJoined);
      socket.off("participant.left", onParticipantLeft);
      socket.off("connect", onSocketConnect);
    };
  }, [
    socket,
    selfId,
    appointmentId,
    role,
    polite,
    flushPendingIce,
    syncParticipants,
  ]);

  const start = useCallback(async (): Promise<void> => {
    if (startedRef.current || isStarting) {
      return;
    }
    setError(null);
    setIsStarting(true);
    try {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !== "function"
      ) {
        throw new Error("MEDIA_UNSUPPORTED");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      const audioEnabled = stream
        .getAudioTracks()
        .every((track) => track.enabled);
      const videoEnabled = stream
        .getVideoTracks()
        .every((track) => track.enabled);
      micRef.current = audioEnabled;
      cameraRef.current = videoEnabled;
      setMicOn(audioEnabled);
      setCameraOn(videoEnabled);
      setLocalStream(stream);

      if (!socket) {
        throw new Error("SOCKET_UNAVAILABLE");
      }

      startedRef.current = true;
      setHasStarted(true);
      socket.emit("room.join", { appointmentId });
    } catch (caught) {
      const stream = localStreamRef.current;
      stream?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      startedRef.current = false;
      setHasStarted(false);
      setError(mediaErrorMessage(caught));
    } finally {
      setIsStarting(false);
    }
  }, [appointmentId, isStarting, socket]);

  const stop = useCallback((): void => {
    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    const pc = pcRef.current;
    pc?.close();
    pcRef.current = null;
    setPcConnectionState("new");

    remoteStreamRef.current = null;
    setRemoteStream(null);
    pendingIceRef.current = [];
    remoteParticipantsRef.current.clear();
    setRemoteParticipants([]);
    startedRef.current = false;
    setHasStarted(false);

    if (socket) {
      socket.emit("room.leave", { appointmentId });
    }
  }, [appointmentId, socket]);

  const toggleMic = useCallback((): void => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const next = !micRef.current;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    micRef.current = next;
    setMicOn(next);
    socket?.emit("media.state", {
      appointmentId,
      mic: next,
      camera: cameraRef.current,
    });
  }, [appointmentId, socket]);

  const toggleCamera = useCallback((): void => {
    const stream = localStreamRef.current;
    if (!stream) {
      return;
    }
    const next = !cameraRef.current;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next;
    });
    cameraRef.current = next;
    setCameraOn(next);
    socket?.emit("media.state", {
      appointmentId,
      mic: micRef.current,
      camera: next,
    });
  }, [appointmentId, socket]);

  useEffect(() => {
    return () => {
      const stream = localStreamRef.current;
      stream?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      const pc = pcRef.current;
      pc?.close();
      pcRef.current = null;
      if (socket && startedRef.current) {
        socket.emit("room.leave", { appointmentId });
      }
      startedRef.current = false;
    };
  }, [socket, appointmentId]);

  const connectionState = useMemo<RealtimeConnectionState>(() => {
    if (!hasStarted) {
      return "idle";
    }
    switch (pcConnectionState) {
      case "connected":
        return "connected";
      case "failed":
        return "failed";
      case "disconnected":
        return "reconnecting";
      default:
        return "connecting";
    }
  }, [hasStarted, pcConnectionState]);

  const participants = useMemo<RoomParticipant[]>(() => {
    if (!selfId) {
      return remoteParticipants;
    }
    const self: RoomParticipant = {
      userId: selfId,
      role,
      joinedAt: selfJoinedAt,
      mic: micOn,
      camera: cameraOn,
      isSelf: true,
    };
    return [self, ...remoteParticipants];
  }, [remoteParticipants, selfId, role, selfJoinedAt, micOn, cameraOn]);

  return {
    start,
    retry: start,
    stop,
    toggleMic,
    toggleCamera,
    localStream,
    remoteStream,
    micOn,
    cameraOn,
    hasStarted,
    isStarting,
    connectionState,
    participants,
    error,
  };
}
