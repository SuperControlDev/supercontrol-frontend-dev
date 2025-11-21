/**
 * Session 데이터 구조 정의
 */

// 세션 상태 열거형
export enum SessionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

// 그랩 결과 인터페이스
export interface GrabResult {
  success: boolean;
  reason?: string;
  timestamp: number;
}

// 기계 하드웨어 상태 인터페이스
export interface MachineState {
  [key: string]: any; // 기계별 상태 정보가 다양할 수 있으므로 유연한 구조
}

// Session 인터페이스
export interface Session {
  // 필수 필드
  sessionId: string; // 세션 고유 ID
  machineId: number; // 인형뽑기 기계 식별자
  userId: string; // 플레이 중인 사용자 ID
  startAt: number; // 세션 시작 시각 (timestamp, ms)
  expiresAt: number; // 세션 만료 시각 (timestamp, ms)
  status: SessionStatus; // 세션 상태 (active, ended, expired, failed)
  durationSec: number; // 게임 제한 시간 (초단위)
  result: GrabResult; // 그랩 결과
  
  // 선택 필드
  requestId?: string; // 요청 트래킹용 ID
  trigger?: 'user' | 'auto'; // 그랩 발생 원인 (user 또는 auto)
  machineState?: MachineState; // 기계 하드웨어 상태 정보
  roomId?: string; // 실시간 소켓 추적용 (roomId 또는 socketId)
  socketId?: string; // 실시간 소켓 추적용 (roomId 또는 socketId)
  createdAt?: number; // 세션 생성 타임스탬프
  updatedAt?: number; // 세션 수정 타임스탬프
}

export interface GameState {
  position: {
    x: number;
    y: number;
    z: number;
  };
  clawState: ClawState;
  target?: {
    x: number;
    y: number;
  };
}

export enum ClawState {
  IDLE = 'idle',
  MOVING = 'moving',
  DROPPING = 'dropping',
  GRABBING = 'grabbing',
  RETURNING = 'returning',
}

export interface User {
  userId: string;
  username: string;
  balance: number;
  avatar?: string;
}

export interface Machine {
  machineId: string;
  name: string;
  status: MachineStatus;
  videoStreamUrl?: string;
}

export enum MachineStatus {
  AVAILABLE = 'available',
  BUSY = 'busy',
  MAINTENANCE = 'maintenance',
}

