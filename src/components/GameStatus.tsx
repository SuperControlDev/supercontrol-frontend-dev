import React from 'react';
import { Session, GameState, SessionStatus } from '@/types/session';
import './GameStatus.css';

interface GameStatusProps {
  session: Session | null;
  gameState: GameState | null;
}

const GameStatus: React.FC<GameStatusProps> = ({ session, gameState }) => {
  const getStatusText = () => {
    if (!session) return '연결 대기 중...';
    switch (session.status) {
      case SessionStatus.ACTIVE:
        return '게임 중';
      case SessionStatus.ENDED:
        return '종료됨';
      case SessionStatus.EXPIRED:
        return '만료됨';
      case SessionStatus.FAILED:
        return '실패';
      default:
        return '알 수 없음';
    }
  };

  const getStatusColor = () => {
    if (!session) return '#999';
    switch (session.status) {
      case SessionStatus.ACTIVE:
        return '#4CAF50';
      case SessionStatus.ENDED:
        return '#999';
      case SessionStatus.EXPIRED:
        return '#FF9800';
      case SessionStatus.FAILED:
        return '#f44336';
      default:
        return '#2196F3';
    }
  };

  return (
    <div className="game-status">
      <h3>게임 상태</h3>
      
      <div className="status-info">
        <div className="status-item">
          <span className="status-label">상태:</span>
          <span className="status-value" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </span>
        </div>

        {session && (
          <>
            <div className="status-item">
              <span className="status-label">세션 ID:</span>
              <span className="status-value">{session.sessionId}</span>
            </div>

            <div className="status-item">
              <span className="status-label">사용자 ID:</span>
              <span className="status-value">{session.userId}</span>
            </div>
            
            <div className="status-item">
              <span className="status-label">기계 ID:</span>
              <span className="status-value">{session.machineId}</span>
            </div>
            
            <div className="status-item">
              <span className="status-label">남은 시간:</span>
              <span className="status-value">
                {session.expiresAt > Date.now() 
                  ? `${Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))}초`
                  : '만료됨'}
              </span>
            </div>
            
            {session.result && (
              <div className="status-item">
                <span className="status-label">그랩 결과:</span>
                <span className="status-value">
                  {session.result.success ? '성공' : '실패'}
                  {session.result.reason && ` (${session.result.reason})`}
                </span>
              </div>
            )}
          </>
        )}

        {gameState && (
          <div className="game-state-info">
            <h4>집게 위치</h4>
            <div className="position-info">
              <div className="position-item">
                <span>X:</span>
                <span>{gameState.position.x.toFixed(2)}</span>
              </div>
              <div className="position-item">
                <span>Y:</span>
                <span>{gameState.position.y.toFixed(2)}</span>
              </div>
              <div className="position-item">
                <span>Z:</span>
                <span>{gameState.position.z.toFixed(2)}</span>
              </div>
            </div>
            <div className="claw-state">
              <span>집게 상태:</span>
              <span>{gameState.clawState}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameStatus;

