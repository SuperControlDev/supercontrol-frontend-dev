import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import { SessionStatus } from '@/types/session';
import GameVideo from '@/components/GameVideo';
import './GamePage.css';

const GamePage: React.FC = () => {
  const { machineId } = useParams<{ machineId: string }>();
  const navigate = useNavigate();
  const {
    isConnected,
    session,
    socket,
    createSession,
    leaveSession,
    moveClaw,
    dropClaw,
    grabClaw,
  } = useSocket();
  const [userId] = useState(() => {
    return localStorage.getItem('userId') || 'user-001';
  });
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chat' | 'prize'>('chat');
  const [viewers, setViewers] = useState(25);
  const [remainingTime, setRemainingTime] = useState(23);
  const [myCoins, setMyCoins] = useState(200);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameSuccess, setGameSuccess] = useState(false);

  // 시스템 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // 타이머 업데이트 - 게임 시작 후에만 작동
  useEffect(() => {
    if (!gameStarted) {
      return;
    }
    
    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev > 0) {
          return prev - 1;
        }
        return 0;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameStarted]);

  useEffect(() => {
    if (isConnected && machineId && !session) {
      createSession(userId, machineId);
    }
  }, [machineId, isConnected, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (session) {
        leaveSession();
      }
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    if (session) {
      leaveSession();
    }
    navigate('/');
  };

  const handleStartGame = () => {
    if (myCoins < 10) {
      alert('코인이 부족합니다');
      return;
    }
    // 코인 차감 및 게임 시작
    setMyCoins((prev) => prev - 10);
    setRemainingTime(23); // 타이머 초기화
    setGameStarted(true);
    // TODO: 실제 게임 시작 API 호출
  };

  const handleMove = (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => {
    if (gameStarted && session?.status === SessionStatus.ACTIVE && moveClaw) {
      moveClaw(direction);
    }
  };

  const handleDrop = () => {
    if (gameStarted && session?.status === SessionStatus.ACTIVE && dropClaw) {
      dropClaw();
    }
  };

  const handleGrab = () => {
    if (gameStarted && session?.status === SessionStatus.ACTIVE && grabClaw) {
      grabClaw();
      // 서버에서 game:result 이벤트를 받으면 결과를 표시
    }
  };

  // 게임 결과 리스너 - 서버에서 game:result 이벤트를 받으면 처리
  useEffect(() => {
    if (!socket) return;

    const handleGameResult = (data: { result: { success: boolean; reason?: string; timestamp: number } }) => {
      console.log('게임 결과 수신:', data.result);
      if (data.result.success) {
        setGameSuccess(true);
        setGameStarted(false);
      } else {
        // 실패 시 처리 (필요에 따라 추가)
        alert(`게임 실패: ${data.result.reason || '알 수 없는 오류'}`);
        setGameStarted(false);
      }
    };

    socket.on('game:result', handleGameResult);

    return () => {
      socket.off('game:result', handleGameResult);
    };
  }, [socket]);

  const handlePlayAgain = () => {
    if (myCoins < 10) {
      alert('코인이 부족합니다');
      return;
    }
    // 코인 차감 및 게임 재시작
    setMyCoins((prev) => prev - 10);
    setRemainingTime(23); // 타이머 초기화
    setGameSuccess(false);
    setGameStarted(true);
  };

  return (
    <div className="game-page">
      <div className="game-mobile-frame">
        {/* 상태 바 */}
        <div className="game-status-bar">
          <span className="game-status-time">{currentTime || '00:00'}</span>
          <div className="game-status-icons">
            <span className="game-status-icon">📶</span>
            <span className="game-status-icon">🔋</span>
          </div>
        </div>

        {/* 헤더 */}
        <div className="game-header">
          <h1 className="game-app-logo">SuperControl</h1>
          <div className="game-header-right">
            <button className="game-action-icon" title="Share">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            <button className="game-action-icon" title="Mute">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            </button>
            <button className="game-action-icon" onClick={handleBack} title="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="game-viewers">
              <span className="game-eye-icon">👁</span>
              <span>{viewers}</span>
            </div>
          </div>
        </div>

        {/* 게임 제목 및 참가자 */}
        <div className="game-title-section">
          <h2 className="game-title">블랙핑크 굿즈 뽑기</h2>
          <div className="game-participants">
            <div className="participant-avatar">👤</div>
            <div className="participant-avatar">👩</div>
            <div className="participant-avatar">🧑</div>
            <div className="participant-avatar participant-more">+1</div>
          </div>
        </div>

        {/* 메인 콘텐츠 영역 */}
        <div className="game-main-content">
          <div className="game-video-container">
            {machineId && (
              <GameVideo 
                machineId={machineId}
                streamName="test"
                red5Port={5080}
              />
            )}
          </div>
          
          {/* 보상 정보 */}
          <div className="game-reward-box">
            <div className="reward-image">☕</div>
            <div className="reward-content">
              <div className="reward-header">
                <span className="gift-icon">🎁</span>
                <span className="reward-label">Reward</span>
              </div>
              <div className="reward-text">에스프레소 기프티콘</div>
            </div>
          </div>

          {/* 타이머 */}
          <div className="game-timer">
            <span className="clock-icon">🕐</span>
            <span>{remainingTime}</span>
          </div>
        </div>

        {/* 네비게이션 탭 */}
        <div className="game-nav-tabs">
          <button
            className={`game-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            채팅창
          </button>
          <div className="game-tab-separator"></div>
          <button
            className={`game-tab ${activeTab === 'prize' ? 'active' : ''}`}
            onClick={() => setActiveTab('prize')}
          >
            경품정보
          </button>
        </div>

        {/* 게임 시작 섹션 */}
        <div className="game-start-section">
          {gameSuccess ? (
            <div className="game-success-section">
              <div className="game-success-message">
                유재석석이님 미션 성공!
              </div>
              <div className="game-success-gift">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    {/* 선물 상자 그라데이션 */}
                    <linearGradient id="giftBoxGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FF6B9D" />
                      <stop offset="50%" stopColor="#C44569" />
                      <stop offset="100%" stopColor="#8B3A5C" />
                    </linearGradient>
                    
                    {/* 뚜껑 그라데이션 */}
                    <linearGradient id="giftLidGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FFB6C1" />
                      <stop offset="100%" stopColor="#FF8FA3" />
                    </linearGradient>
                    
                    {/* 리본 그라데이션 */}
                    <linearGradient id="ribbonGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FFD700" />
                      <stop offset="50%" stopColor="#FFA500" />
                      <stop offset="100%" stopColor="#FF8C00" />
                    </linearGradient>
                  </defs>
                  
                  {/* 선물 상자 본체 */}
                  <rect x="5" y="8" width="14" height="12" rx="1.5" fill="url(#giftBoxGradient)" opacity="0.9"/>
                  <rect x="5" y="8" width="14" height="12" rx="1.5" stroke="#8B3A5C" strokeWidth="1.5"/>
                  
                  {/* 선물 상자 뚜껑 */}
                  <path d="M5 8 L12 4 L19 8" fill="url(#giftLidGradient)" stroke="#FF8FA3" strokeWidth="1.5"/>
                  
                  {/* 리본 (세로) - 금색 */}
                  <line x1="12" y1="4" x2="12" y2="20" stroke="url(#ribbonGradient)" strokeWidth="2.5"/>
                  
                  {/* 리본 (가로) - 금색 */}
                  <line x1="5" y1="14" x2="19" y2="14" stroke="url(#ribbonGradient)" strokeWidth="2.5"/>
                  
                  {/* 리본 장식 - 위쪽 - 금색 */}
                  <path d="M10 14 L8 11 L10 9 L12 11 Z" fill="url(#ribbonGradient)"/>
                  <path d="M14 14 L12 11 L14 9 L16 11 Z" fill="url(#ribbonGradient)"/>
                  
                  {/* 리본 장식 - 아래쪽 - 금색 */}
                  <path d="M10 14 L8 17 L10 19 L12 17 Z" fill="url(#ribbonGradient)"/>
                  <path d="M14 14 L12 17 L14 19 L16 17 Z" fill="url(#ribbonGradient)"/>
                  
                  {/* 리본 중앙 장식 - 금색 */}
                  <circle cx="12" cy="14" r="2" fill="url(#ribbonGradient)"/>
                  <circle cx="12" cy="14" r="1" fill="#FFD700"/>
                  
                  {/* 반짝이 효과 */}
                  <circle cx="8" cy="11" r="0.8" fill="#FFFFFF" opacity="0.8"/>
                  <circle cx="16" cy="17" r="0.8" fill="#FFFFFF" opacity="0.8"/>
                </svg>
              </div>
              
              <div className="game-start-container">
                <button className="game-start-button" onClick={handlePlayAgain}>
                  <span className="game-controller-icon">🎮</span>
                  <span className="game-start-text">컨트롤 게임 START</span>
                  <span className="game-start-separator"></span>
                  <span className="game-cost">10 코인</span>
                </button>
                
                <div className="game-my-coin">
                  <div className="my-coin-label">MY COIN</div>
                  <div className="my-coin-value">
                    <span className="coin-icon">🪙</span>
                    <span>{myCoins}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !gameStarted ? (
            <>
              <div className="game-promo-text">
                <p className="game-promo-english">PLAY THE REAL</p>
                <p className="game-promo-korean">지금 도전해보세요!</p>
              </div>
              
              <div className="game-start-container">
                <button className="game-start-button" onClick={handleStartGame}>
                  <span className="game-controller-icon">🎮</span>
                  <span className="game-start-text">컨트롤 게임 START</span>
                  <span className="game-start-separator"></span>
                  <span className="game-cost">10 코인</span>
                </button>
                
                <div className="game-my-coin">
                  <div className="my-coin-label">MY COIN</div>
                  <div className="my-coin-value">
                    <span className="coin-icon">🪙</span>
                    <span>{myCoins}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="game-control-section">
              <div className="game-control-wrapper">
                {/* 상하좌우 방향 제어 */}
                <div className="game-direction-control">
                  <button
                    className="game-control-btn game-control-up"
                    onClick={() => handleMove('forward')}
                    title="위"
                  >
                    ↑
                  </button>
                  <div className="game-control-horizontal">
                    <button
                      className="game-control-btn game-control-left"
                      onClick={() => handleMove('left')}
                      title="왼쪽"
                    >
                      ←
                    </button>
                    <button
                      className="game-control-btn game-control-right"
                      onClick={() => handleMove('right')}
                      title="오른쪽"
                    >
                      →
                    </button>
                  </div>
                  <button
                    className="game-control-btn game-control-down"
                    onClick={() => handleMove('backward')}
                    title="아래"
                  >
                    ↓
                  </button>
                </div>

                {/* 나가기 버튼 - 왼쪽 하단 원형 */}
                <button
                  className="game-exit-button-circle"
                  onClick={handleBack}
                  title="나가기"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* 왼쪽 대괄호 [ */}
                    <path d="M9 4 L5 8 L5 16 L9 20" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                    {/* 왼쪽 화살표 ← */}
                    <line x1="14" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5"/>
                    <line x1="19" y1="12" x2="15" y2="8" stroke="currentColor" strokeWidth="2.5"/>
                    <line x1="19" y1="12" x2="15" y2="16" stroke="currentColor" strokeWidth="2.5"/>
                  </svg>
                </button>

                {/* 잡기 버튼 - 오른쪽 하단 원형 */}
                <button
                  className="game-grab-button-circle"
                  onClick={handleGrab}
                  title="잡기"
                >
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor">
                    {/* 상단 연결부 */}
                    <circle cx="12" cy="4" r="2"/>
                    <line x1="12" y1="6" x2="12" y2="10" stroke="currentColor" strokeWidth="2"/>
                    
                    {/* 왼쪽 클로우 */}
                    <path d="M8 10 L5 16 L7 20 L9 18 L7 16 Z"/>
                    
                    {/* 중앙 클로우 */}
                    <path d="M10 10 L12 16 L10 20 L12 18 L12 16 Z"/>
                    
                    {/* 오른쪽 클로우 */}
                    <path d="M16 10 L19 16 L17 20 L15 18 L17 16 Z"/>
                    
                    {/* 클로우 끝 (날카로운 부분) */}
                    <line x1="5" y1="16" x2="4" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="12" y1="16" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1="19" y1="16" x2="20" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamePage;
