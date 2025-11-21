import React, { useEffect, useRef, useState } from 'react';
import { useSocket } from '@/contexts/SocketContext';
import './WebRTCPlayer.css';

interface WebRTCPlayerProps {
  machineId: string;
  sessionId?: string;
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ machineId, sessionId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const { socket } = useSocket();

  // WebRTC 配置
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // WebRTC 연결 초기화
  const initializeWebRTC = async () => {
    if (!socket || !videoRef.current) {
      return;
    }

    try {
      setConnectionState('connecting');
      setError(null);

      // RTCPeerConnection 생성
      const pc = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = pc;

      // ICE candidate 이벤트 처리
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('ICE candidate 생성:', event.candidate);
          socket.emit('webrtc:ice-candidate', {
            machineId,
            sessionId,
            candidate: event.candidate,
          });
        }
      };

      // ICE 연결 상태 변경
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('ICE 연결 상태:', state);
        
        if (state === 'connected' || state === 'completed') {
          setConnectionState('connected');
        } else if (state === 'disconnected' || state === 'failed') {
          setConnectionState('failed');
          setError('WebRTC 연결 실패');
          // 재연결 시도
          setTimeout(() => {
            if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
              initializeWebRTC();
            }
          }, 3000);
        }
      };

      // 연결 상태 변경
      pc.onconnectionstatechange = () => {
        console.log('연결 상태:', pc.connectionState);
      };

      // 원격 스트림 수신
      pc.ontrack = (event) => {
        console.log('원격 스트림 수신:', event.streams);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setConnectionState('connected');
        }
      };

      // SDP offer 생성 및 전송
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false, // 비디오만 필요
      });
      
      await pc.setLocalDescription(offer);
      console.log('SDP offer 생성:', offer);

      // 서버에 offer 전송
      socket.emit('webrtc:offer', {
        machineId,
        sessionId,
        offer: offer,
      });

    } catch (err) {
      console.error('WebRTC 초기화 오류:', err);
      setConnectionState('failed');
      setError(err instanceof Error ? err.message : 'WebRTC 초기화 실패');
    }
  };

  // WebRTC 이벤트 리스너 설정
  useEffect(() => {
    if (!socket) {
      return;
    }

    // SDP answer 수신
    const handleAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
      if (!peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        console.log('SDP answer 수신 및 설정 완료');
      } catch (err) {
        console.error('SDP answer 설정 오류:', err);
        setError('SDP answer 설정 실패');
      }
    };

    // ICE candidate 수신
    const handleIceCandidate = async (data: { candidate: RTCIceCandidateInit }) => {
      if (!peerConnectionRef.current) {
        return;
      }

      try {
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(data.candidate)
        );
        console.log('ICE candidate 추가 완료');
      } catch (err) {
        console.error('ICE candidate 추가 오류:', err);
      }
    };

    // WebRTC 오류 처리
    const handleWebRTCError = (data: { message: string }) => {
      console.error('WebRTC 오류:', data.message);
      setError(data.message);
      setConnectionState('failed');
    };

    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleIceCandidate);
    socket.on('webrtc:error', handleWebRTCError);

    return () => {
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleIceCandidate);
      socket.off('webrtc:error', handleWebRTCError);
    };
  }, [socket]);

  // 컴포넌트 마운트 시 WebRTC 연결 시작
  useEffect(() => {
    if (socket?.connected && machineId) {
      initializeWebRTC();
    }

    // 클린업: 연결 종료
    return () => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setConnectionState('disconnected');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, machineId, sessionId]);

  // Socket 재연결 시 WebRTC 재연결
  useEffect(() => {
    if (socket?.connected && connectionState === 'disconnected' && machineId) {
      initializeWebRTC();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket?.connected, connectionState, machineId]);

  const getStatusText = () => {
    switch (connectionState) {
      case 'connecting':
        return '연결 중...';
      case 'connected':
        return '연결됨';
      case 'failed':
        return '연결 실패';
      default:
        return '대기 중';
    }
  };

  return (
    <div className="webrtc-player">
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-stream"
          autoPlay
          playsInline
          muted
          controls={false}
        />
        <div className={`video-overlay ${connectionState === 'connected' ? 'hidden' : ''}`}>
          <div className="placeholder-content">
            <div className="placeholder-icon">📹</div>
            <p className="status-text">{getStatusText()}</p>
            {error && <p className="error-text">{error}</p>}
            {connectionState === 'connecting' && (
              <div className="loading-spinner"></div>
            )}
          </div>
        </div>
        {connectionState === 'connected' && (
          <div className="connection-indicator">
            <span className="indicator-dot"></span>
            <span>LIVE</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebRTCPlayer;

