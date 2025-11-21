/**
 * Socket 통신 이벤트 타입 정의
 */

import { Session, GameState, GrabResult } from './session';

export interface SocketEvents {
  // 클라이언트에서 전송하는 이벤트
  'session:create': (data: { userId: string; machineId: number }) => void;
  'session:join': (data: { sessionId: string }) => void;
  'session:leave': (data: { sessionId: string }) => void;
  'game:move': (data: { direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward' }) => void;
  'game:drop': () => void;
  'game:grab': () => void;
  
  // WebRTC 관련 이벤트 - 클라이언트에서 전송
  'webrtc:offer': (data: { machineId: string; sessionId?: string; offer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { machineId: string; sessionId?: string; candidate: RTCIceCandidateInit }) => void;
  
  // 서버에서 전송하는 이벤트
  'session:created': (data: { session: Session }) => void;
  'session:joined': (data: { session: Session }) => void;
  'session:updated': (data: { session: Session }) => void;
  'session:ended': (data: { session: Session }) => void;
  'session:expired': (data: { session: Session }) => void; // 세션 만료 이벤트 추가
  'session:failed': (data: { session: Session; reason?: string }) => void; // 세션 실패 이벤트 추가
  'game:state': (data: { gameState: GameState }) => void;
  'game:result': (data: { result: GrabResult }) => void; // GrabResult 타입 사용
  'error': (data: { message: string; code?: string }) => void;
  
  // WebRTC 관련 이벤트 - 서버에서 전송
  'webrtc:answer': (data: { answer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { candidate: RTCIceCandidateInit }) => void;
  'webrtc:error': (data: { message: string }) => void;
}

