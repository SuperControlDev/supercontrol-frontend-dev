import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { Session, GameState, SessionStatus, GrabResult } from '@/types/session';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  session: Session | null;
  gameState: GameState | null;
  connect: (userId: string) => void;
  disconnect: () => void;
  createSession: (userId: string, machineId: string | number) => void;
  joinSession: (sessionId: string) => void;
  leaveSession: () => void;
  moveClaw: (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => void;
  dropClaw: () => void;
  grabClaw: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Socket 서버 주소, 환경 변수로 설정 가능
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8080';

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  const connect = (userId: string) => {
    if (socket?.connected) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      query: {
        userId,
      },
      transports: ['websocket'],
    });

    // 연결 성공
    newSocket.on('connect', () => {
      console.log('Socket 연결 성공');
      setIsConnected(true);
    });

    // 연결 끊김
    newSocket.on('disconnect', () => {
      console.log('Socket 연결 끊김');
      setIsConnected(false);
      setSession(null);
      setGameState(null);
    });

    // 연결 오류
    newSocket.on('connect_error', (error) => {
      console.error('Socket 연결 오류:', error);
      setIsConnected(false);
    });

    // Session 이벤트 리스너
    newSocket.on('session:created', (data: { session: Session }) => {
      console.log('Session 생성 성공:', data.session);
      setSession(data.session);
    });

    newSocket.on('session:joined', (data: { session: Session }) => {
      console.log('Session 참가 성공:', data.session);
      setSession(data.session);
    });

    newSocket.on('session:updated', (data: { session: Session }) => {
      console.log('Session 업데이트:', data.session);
      setSession(data.session);
    });

    newSocket.on('session:ended', (data: { session: Session }) => {
      console.log('Session 종료:', data.session);
      setSession(data.session);
      setGameState(null);
    });

    newSocket.on('session:expired', (data: { session: Session }) => {
      console.log('Session 만료:', data.session);
      setSession(data.session);
      setGameState(null);
      alert('세션이 만료되었습니다');
    });

    newSocket.on('session:failed', (data: { session: Session; reason?: string }) => {
      console.log('Session 실패:', data.session, data.reason);
      setSession(data.session);
      setGameState(null);
      alert(`세션 실패: ${data.reason || '알 수 없는 오류'}`);
    });

    // 게임 상태 업데이트 리스너
    newSocket.on('game:state', (data: { gameState: GameState }) => {
      setGameState(data.gameState);
    });

    // 게임 결과 리스너 (GrabResult 타입 사용)
    // GamePage에서 직접 처리하므로 여기서는 로그만 기록
    newSocket.on('game:result', (data: { result: GrabResult }) => {
      console.log('게임 결과 수신:', data.result);
      // GamePage에서 상태 업데이트 및 사용자 피드백 처리
    });

    // 오류 이벤트 리스너
    newSocket.on('error', (data: { message: string; code?: string }) => {
      console.error('Socket 오류:', data);
      alert(`오류: ${data.message}`);
    });

    setSocket(newSocket);
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setSession(null);
      setGameState(null);
    }
  };

  const createSession = (userId: string, machineId: string | number) => {
    if (socket?.connected) {
      // machineId를 number로 변환 (Session 구조에 맞춤)
      const machineIdNum = typeof machineId === 'string' ? parseInt(machineId.replace(/\D/g, '')) || 0 : machineId;
      socket.emit('session:create', { userId, machineId: machineIdNum });
    } else {
      console.error('Socket이 연결되지 않음');
    }
  };

  const joinSession = (sessionId: string) => {
    if (socket?.connected) {
      socket.emit('session:join', { sessionId });
    } else {
      console.error('Socket이 연결되지 않음');
    }
  };

  const leaveSession = () => {
    if (socket?.connected && session) {
      socket.emit('session:leave', { sessionId: session.sessionId });
    }
  };

  const moveClaw = (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => {
    if (socket?.connected && session?.status === SessionStatus.ACTIVE) {
      socket.emit('game:move', { direction });
    }
  };

  const dropClaw = () => {
    if (socket?.connected && session?.status === SessionStatus.ACTIVE) {
      socket.emit('game:drop');
    }
  };

  const grabClaw = () => {
    if (socket?.connected && session?.status === SessionStatus.ACTIVE) {
      socket.emit('game:grab');
    }
  };

  // 컴포넌트 언마운트 시 연결 해제
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  const value: SocketContextType = {
    socket,
    isConnected,
    session,
    gameState,
    connect,
    disconnect,
    createSession,
    joinSession,
    leaveSession,
    moveClaw,
    dropClaw,
    grabClaw,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket은 SocketProvider 내부에서 사용해야 합니다');
  }
  return context;
};


