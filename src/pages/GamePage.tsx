import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import { SessionStatus } from '@/types/session';
import GameVideo from '@/components/GameVideo';
import WebRTCPlayer from '@/components/WebRTCPlayer';
import './GamePage.css';

const GamePage: React.FC = () => {
  const { machineId } = useParams<{ machineId: string }>();
  // Red5 스트림 설정 (RTMP -> HLS)
  // RTMP: rtmp://192.168.45.48:1935/live/mystream
  // HLS: http://192.168.45.48:5080/live/mystream/playlist.m3u8
  const red5Host = '192.168.45.48'; // Red5 HTTP 호스트 (HLS 접근용)
  const red5Port = 5080; // Red5 HTTP 포트 (HLS)
  const streamName = 'mystream'; // OBS에서 푸시한 스트림 이름 (RTMP: rtmp://192.168.45.48:1935/live/mystream)
  
  // Red5 Pro SDK 许可证密钥 (如果需要)
  // 如果使用商业版 Red5 Pro SDK，请在此处设置许可证密钥
  // 可以从环境变量读取: const licenseKey = import.meta.env.VITE_RED5PRO_LICENSE_KEY;
  // 如果服务器端 viewer.jsp 可以播放，可能不需要客户端许可证密钥
  const licenseKey = '6G7F-FH9J-3D7M-1QP2';
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
  const [myCoins, setMyCoins] = useState(() => {
    // 从 localStorage 读取余额，如果没有则使用默认值
    const balance = localStorage.getItem('balance');
    return balance ? parseInt(balance, 10) : 200;
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameSuccess, setGameSuccess] = useState(false);
  const [useWebRTC, setUseWebRTC] = useState(false); // WebRTC 사용 여부 (기본값: false, HLS 사용)
  const [isStartingGame, setIsStartingGame] = useState(false); // 게임 시작 중 상태
  
  // WebRTC 실패 시 HLS로 전환하는 콜백
  const handleWebRTCFallback = () => {
    console.log('[GamePage] WebRTC 실패, HLS로 전환');
    setUseWebRTC(false);
  };

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
    // 게임이 시작된 상태에서 나가기 버튼을 클릭하면 관전 페이지로 돌아감
    if (gameStarted) {
      console.log('[GamePage] 게임 중 나가기, 관전 페이지로 전환');
      setGameStarted(false);
      setGameSuccess(false);
      setUseWebRTC(false); // HLS로 전환
      setRemainingTime(23); // 타이머 리셋
      // TODO: 서버에 게임 종료 알림 (필요한 경우)
      return;
    }
    
    // 게임이 시작되지 않은 상태에서는 홈으로 이동
    if (session) {
      leaveSession();
    }
    navigate('/');
  };

  const handleStartGame = async () => {
    if (isStartingGame) {
      return; // 防止重复点击
    }

    if (!machineId) {
      alert('기계 ID가 없습니다');
      return;
    }

    if (!userId) {
      alert('사용자 ID가 없습니다. 다시 로그인해주세요.');
      navigate('/login');
      return;
    }

    // 코인 확인（API 响应中会返回实际余额）
    if (myCoins < 10) {
      alert('코인이 부족합니다');
      return;
    }

    setIsStartingGame(true);

    try {
      console.log('[GamePage] 게임 시작 API 호출');
      
      // 调用游戏开始 API
      // POST /api/game/start
      const backendApiUrl = import.meta.env.VITE_API_URL || '';
      const apiUrl = backendApiUrl ? `${backendApiUrl}/api/game/start` : '/api/game/start';
      
      const requestBody = {
        machineId: parseInt(machineId, 10),
        userId: parseInt(userId, 10),
      };

      console.log('[GamePage] API 요청:', apiUrl);
      console.log('[GamePage] 요청 본문:', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[GamePage] API 응답 상태:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `게임 시작 실패 (${response.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('[GamePage] API 오류 응답:', errorData);
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        alert(errorMessage);
        setIsStartingGame(false);
        return;
      }

      const data = await response.json();
      console.log('[GamePage] API 응답 데이터:', data);

      // API 响应处理
      if (data.success) {
        // 更新余额
        const remainingCoins = data.remainingCoins || myCoins;
        setMyCoins(remainingCoins);
        localStorage.setItem('balance', String(remainingCoins));

        // 更新游戏时间（durationSec 秒）
        const durationSec = data.durationSec || 45;
        setRemainingTime(durationSec);

        // 如果有 sessionId，更新 session（如果需要）
        if (data.sessionId) {
          console.log('[GamePage] 게임 세션 ID:', data.sessionId);
          // 注意：这里可能需要更新 SocketContext 中的 session
        }

        // 游戏开始
    setGameStarted(true);
        setUseWebRTC(true); // 게임 시작 시 WebRTC로 전환

        console.log('[GamePage] 게임 시작 성공:', {
          remainingCoins,
          durationSec,
          sessionId: data.sessionId,
          gameStartTime: data.gameStartTime,
        });
      } else {
        // 游戏开始失败
        const reason = data.reason || '알 수 없는 오류';
        alert(`게임 시작 실패: ${reason}`);
        
        // 如果是因为余额不足，更新余额
        if (data.remainingCoins !== undefined) {
          setMyCoins(data.remainingCoins);
          localStorage.setItem('balance', String(data.remainingCoins));
        }
      }
    } catch (error) {
      console.error('[GamePage] 게임 시작 오류:', error);
      if (error instanceof Error) {
        alert(`게임 시작 중 오류가 발생했습니다: ${error.message}`);
      } else {
        alert('게임 시작 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsStartingGame(false);
    }
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
        setUseWebRTC(false); // 게임 종료 시 HLS로 전환
      } else {
        // 실패 시 처리 (필요에 따라 추가)
        alert(`게임 실패: ${data.result.reason || '알 수 없는 오류'}`);
        setGameStarted(false);
        setUseWebRTC(false); // 게임 종료 시 HLS로 전환
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
    setUseWebRTC(true); // 게임 재시작 시 WebRTC로 전환
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
              <>
                {/* HLS 播放器 - 游戏开始前显示，开始后隐藏 */}
                <div style={{ 
                  display: gameStarted && useWebRTC ? 'none' : 'block',
                  width: '100%',
                  height: '100%',
                  position: 'relative'
                }}>
                  <GameVideo 
                    machineId={machineId}
                    streamName={streamName}
                    red5Host={red5Host}
                    red5Port={red5Port}
                  />
                </div>
                
                {/* WebRTC 播放器 - 后台预加载，游戏开始时显示 */}
                <div style={{ 
                  display: gameStarted && useWebRTC ? 'block' : 'none',
                  width: '100%',
                  height: '100%',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  zIndex: gameStarted && useWebRTC ? 1 : 0
                }}>
                  <WebRTCPlayer 
                    machineId={machineId}
                    sessionId={session?.sessionId}
                    streamUrl={`http://${red5Host}:${red5Port}/live/viewer.jsp?host=${red5Host}&stream=${streamName}`}
                    app="live"
                    streamName={streamName}
                    red5Host={red5Host}
                    red5Port={red5Port} // HTTP 端口 5080 使用 (WHEP 使用 HTTP)
                    useRed5ProSDK={true}
                    useSDKPlayer={true} // 使用 SDK 播放器模式
                    licenseKey={licenseKey} // Red5 Pro SDK 许可证密钥 (如果需要)
                    onFallbackToHLS={handleWebRTCFallback} // WebRTC 실패 시 HLS로 전환
                  />
                </div>
              </>
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
                <button 
                  className="game-start-button" 
                  onClick={handleStartGame}
                  disabled={isStartingGame || myCoins < 10}
                >
                  <span className="game-controller-icon">🎮</span>
                  <span className="game-start-text">
                    {isStartingGame ? '게임 시작 중...' : '컨트롤 게임 START'}
                  </span>
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
