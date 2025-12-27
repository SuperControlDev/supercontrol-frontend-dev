import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameVideo from '@/components/GameVideo';
import WebRTCPlayer from '@/components/WebRTCPlayer';
import GameResultModal from '@/components/GameResultModal';
import { startGame, checkReservedStatus, endGame, enterGame, sendHeartbeat } from '@/services/gameApi';
import './GamePage.css';

const GamePage: React.FC = () => {
  const { machineId } = useParams<{ machineId: string }>();
  // localStorage에서 게임 테마 및 제목 읽기
  const [gameTheme, setGameTheme] = useState<string>(() => {
    const savedTheme = localStorage.getItem(`game_theme_${machineId}`);
    return savedTheme || 'default';
  });
  const [gameTitle, setGameTitle] = useState<string>(() => {
    const savedTitle = localStorage.getItem(`game_title_${machineId}`);
    return savedTitle || '블랙핑크 굿즈 뽑기'; // 기본 제목
  });
  
  // Red5 Pro 配置 - 从环境变量读取
  const red5Host = import.meta.env.VITE_RED5PRO_HOST || 'localhost';
  const red5Port = parseInt(import.meta.env.VITE_RED5PRO_HTTP_PORT || '5080', 10); // HLS/HTTP 端口
  // 以下配置为未来功能预留
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const red5WebRTCPort = parseInt(import.meta.env.VITE_RED5PRO_WEBRTC_PORT || '8081', 10); // WebRTC 端口
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const red5App = import.meta.env.VITE_RED5PRO_APP || 'live';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const red5Protocol = import.meta.env.VITE_RED5PRO_PROTOCOL || 'http';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const red5WSProtocol = import.meta.env.VITE_RED5PRO_WS_PROTOCOL || 'ws';
  const streamName = 'mystream'; // OBS에서 푸시한 스트림 이름
  
  // Red5 Pro SDK 라이선스 키 - 从环境变量读取
  const licenseKey = import.meta.env.VITE_RED5PRO_LICENSE_KEY || undefined;
  const navigate = useNavigate();
  const [userId] = useState(() => {
    return localStorage.getItem('userId') || 'user-001';
  });
  // 모의 로그인 여부 확인
  const [isMockLogin] = useState(() => {
    return localStorage.getItem('mockLogin') === 'true';
  });
  const [currentTime, setCurrentTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chat' | 'prize'>('chat');
  const [viewers, setViewers] = useState(25);
  const [remainingTime, setRemainingTime] = useState(45);
  const [myCoins, setMyCoins] = useState(() => {
    // localStorage에서 잔액 읽기, 없으면 기본값 사용
    const balance = localStorage.getItem('balance');
    const coins = balance ? parseInt(balance, 10) : 200;
    // 如果余额为0或无效，设置为200（测试用）
    return coins > 0 ? coins : 200;
  });
  const [gameStarted, setGameStarted] = useState(false);
  const [gameSuccess, setGameSuccess] = useState(false);
  const [useWebRTC, setUseWebRTC] = useState(false); // WebRTC 사용 여부 (기본값: false, HLS 사용)
  const [isStartingGame, setIsStartingGame] = useState(false); // 게임 시작 중 상태
  const [gameResult, setGameResult] = useState<'SUCCESS' | 'FAIL' | null>(null); // 게임 결과 (null이면 모달 숨김)
  
  // WebRTC 상태
  const [webrtcReady, setWebrtcReady] = useState(false); // WebRTC 是否准备好
  
  // 대기열 관리 상태 (새로운 API 형식에 맞춰 수정)
  const [position, setPosition] = useState<number | null>(null); // 대기 순서 (null이면 대기열에 없음)
  const [queueState, setQueueState] = useState<'waiting' | 'ready' | 'playing' | null>(null); // 대기열 상태
  const [canStart, setCanStart] = useState(false); // 게임 시작 가능 여부
  const [startToken, setStartToken] = useState<string | null>(null); // 게임 시작 토큰
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null); // 폴링 타이머
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null); // 하트비트 타이머
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null); // 게임 타이머 (倒计时定时器)
  const isEndingGameRef = useRef<boolean>(false); // 게임 종료 중 플래그 (동기 플래그, 중복 호출 방지용)
  const gameStartTimeRef = useRef<number>(0); // 游戏开始时间戳（用于调试 30 秒问题）
  const [sessionId, setSessionId] = useState<number | null>(null); // 게임 세션 ID (long 类型)
  
  // 하위 호환성을 위한 계산된 값
  const isReserved = position !== null && queueState === 'waiting'; // 대기 중인지 여부
  const reservedNumber = position ?? 0; // UI 표시용 (null이면 0)
  
  // WebRTC 실패 시 HLS로 전환하는 콜백
  const handleWebRTCFallback = () => {
    console.log('[GamePage] WebRTC 실패, HLS로 전환');
    setUseWebRTC(false);
    setWebrtcReady(false);
  };
  
  // WebRTC 准备好时的回调
  const handleWebRTCReady = () => {
    console.log('[GamePage] ✅ WebRTC 연결 완료, 준비 완료');
    setWebrtcReady(true);
  };
  
  // 游戏结束时重置 WebRTC 状态
  useEffect(() => {
    if (!gameStarted) {
      // 游戏结束后，重置 WebRTC 状态
      setWebrtcReady(false);
      setUseWebRTC(false);
      console.log('[GamePage] 게임 종료, WebRTC 상태 리셋');
    }
  }, [gameStarted]);
  
  // 游戏开始时，如果 WebRTC 已经准备好，立即切换到 WebRTC
  useEffect(() => {
    if (gameStarted && useWebRTC && webrtcReady) {
      console.log('[GamePage] ✅ 게임 시작 + WebRTC 준비 완료, 즉시 WebRTC로 전환');
    } else if (gameStarted && useWebRTC && !webrtcReady) {
      console.log('[GamePage] ⏳ 게임 시작했지만 WebRTC 아직 준비 중, 준비되면 자동 전환');
    }
  }, [gameStarted, useWebRTC, webrtcReady]);
  
  // 游戏开始且有 sessionId 时，自动启动 heartbeat
  useEffect(() => {
    if (gameStarted && sessionId && !isMockLogin) {
      console.log('[GamePage] 게임 시작 + sessionId 설정됨, 하트비트 자동 시작');
      startHeartbeat();
    } else if (!gameStarted) {
      // 游戏结束时清除 heartbeat
      clearHeartbeat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, sessionId]);

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

  // machineId 변경 감지, 테마 및 제목 업데이트
  useEffect(() => {
    if (machineId) {
      // 테마 업데이트
      const savedTheme = localStorage.getItem(`game_theme_${machineId}`);
      const theme = savedTheme || `theme-${machineId}`;
      setGameTheme(theme);
      console.log('[GamePage] 게임 테마 적용:', theme, '기계:', machineId);
      
      // 제목 업데이트
      const savedTitle = localStorage.getItem(`game_title_${machineId}`);
      const title = savedTitle || '블랙핑크 굿즈 뽑기';
      setGameTitle(title);
      console.log('[GamePage] 게임 제목 적용:', title, '기계:', machineId);
      
      // 페이지 루트 요소에 테마 적용
      const gamePageElement = document.querySelector('.game-page');
      if (gamePageElement) {
        // 모든 기존 테마 클래스 제거
        gamePageElement.className = gamePageElement.className
          .split(' ')
          .filter(cls => !cls.startsWith('theme-'))
          .join(' ');
        // 새 테마 클래스 추가
        gamePageElement.classList.add(theme);
      }
    }
  }, [machineId]);

  // 타이머 업데이트 - 게임 시작 후에만 작동
  useEffect(() => {
    if (!gameStarted) {
      // 游戏结束时清除定时器
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
        gameTimerRef.current = null;
        console.log('[GamePage] ⏰ 게임 종료, 타이머 정리');
      }
      return;
    }
    
    console.log('[GamePage] ⏰ 게임 타이머 시작, 초기 시간:', remainingTime, '초');
    
    // 清除之前的定时器（如果存在）
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
    }
    
    gameTimerRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev > 0) {
          return prev - 1;
        } else {
          // 시간 종료, 게임 자동 종료, 게임 시작 전 페이지로 돌아가기
          console.log('[GamePage] 게임 시간 종료, 자동 종료');
          setGameStarted(false);
          setUseWebRTC(false); // HLS로 전환
          setGameSuccess(false); // 게임 성공 상태 초기화
          
          // 게임 종료 API 호출
          handleEndGame();
          
          // 45을 직접 반환, 0을 반환하지 않아 카운트다운이 45으로 표시됩니다
          return 45;
        }
      });
    }, 1000);
    
    return () => {
      console.log('[GamePage] ⏰ 게임 타이머 정리');
      if (gameTimerRef.current) {
        clearInterval(gameTimerRef.current);
        gameTimerRef.current = null;
      }
    };
  }, [gameStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      // 清除轮询定时器
      clearPolling();
      // 清除 하트비트
      clearHeartbeat();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    // 게임이 시작된 상태에서 나가기 버튼을 클릭하면 관전 페이지로 돌아감
    if (gameStarted) {
      console.log('[GamePage] 게임 중 나가기, 관전 페이지로 전환');
      setGameStarted(false);
      setGameSuccess(false);
      setUseWebRTC(false); // HLS로 전환
      setRemainingTime(45); // 타이머 리셋
      
      // 调用游戏结束 API
      handleEndGame();
      
      return;
    }
    
    // 如果在队列中，清除轮询
    if (position !== null) {
      clearPolling();
      setPosition(null);
      setQueueState(null);
      setCanStart(false);
      setStartToken(null);
    }
    
    // 게임이 시작되지 않은 상태에서는 홈으로 이동
    navigate('/');
  };

  // 处理游戏结束
  const handleEndGame = async () => {
    // 防止重复调用：使用同步的 ref 标志（不依赖异步状态更新）
    if (isEndingGameRef.current) {
      console.log('[GamePage] 게임 종료 이미 처리 중, 중복 호출 방지');
      return;
    }
    
    // 立即设置标志，防止在异步执行期间被重复调用
    isEndingGameRef.current = true;
    
    // 记录游戏总时长（用于调试 30 秒问题）
    const totalGameTime = gameStartTimeRef.current > 0 
      ? ((Date.now() - gameStartTimeRef.current) / 1000).toFixed(1) 
      : '未知';
    
    console.log('[GamePage] 게임 종료 시작, 중복 호출 방지 플래그 설정');
    console.log(`[GamePage] ⏱️  游戏总时长: ${totalGameTime}초`);
    
    // 立即停止倒计时（确保倒计时立即停止）
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
      console.log('[GamePage] ⏰ 게임 종료 시 타이머 정리');
    }
    
    // 清除 하트비트
    clearHeartbeat();
    
    if (isMockLogin) {
      console.log('[GamePage] 모의 로그인 모드, /api/game/end 호출 건너뛰기');
      // 模拟游戏结果
      setGameResult('FAIL');
      // 清除 sessionId
      setSessionId(null);
      // 重置标志（在下次游戏时可以再次调用）
      // 不要在这里立即重置，因为可能在游戏结束后的状态清理中再次触发
      return;
    }

    try {
      console.log('[GamePage] 게임 종료 API 호출 (/api/game/end)');
      
      // sessionId 必须传递（真实生成的 sessionId）
      if (!sessionId) {
        throw new Error('세션 ID가 없습니다.');
      }
      
      console.log('[GamePage] sessionId:', sessionId, '타입:', typeof sessionId);
      
      const requestBody: { sessionId: number; reason: string } = {
        sessionId: sessionId, // long 类型，真实生成的 sessionId，必须传递
        reason: 'USER_END', // 游戏结束原因
      };
      
      console.log('[GamePage] 요청 body:', requestBody);
      console.log('[GamePage] 요청 body (JSON):', JSON.stringify(requestBody));

      const data = await endGame(requestBody);
      
      console.log('[GamePage] 게임 종료 성공:', data);
      
      // 根据 result 显示不同的弹窗
      if (data.result === 'SUCCESS' || data.result === 'FAIL') {
        // 显示游戏结果弹窗
        setGameResult(data.result);
      } else {
        // 未知结果
        console.warn('[GamePage] 알 수 없는 게임 결과:', data.result);
        setGameResult('FAIL'); // 默认显示失败
      }
    } catch (error) {
      console.error('[GamePage] 게임 종료 실패:', error);
      // 即使失败也显示一个提示
      setGameResult('FAIL');
    } finally {
      // 清除 sessionId
      setSessionId(null);
      console.log('[GamePage] 게임 종료 처리 완료');
      // 不要在这里重置 isEndingGameRef.current，让它在游戏重新开始时重置
    }
  };

  // 清除轮询
  const clearPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log('[GamePage] 대기열 확인 중지');
    }
  };
  
  // 清除 하트비트
  const clearHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
      console.log('[GamePage] 하트비트 중지');
    }
  };
  
  // 开始轮询队列状态（统一30秒间隔）
  const startPolling = () => {
    // 清除已有的轮询
    clearPolling();
    
    const pollingInterval = 30000; // 统一30초
    
    console.log('[GamePage] ========================================');
    console.log(`[GamePage] 🔄 대기열 상태 확인 시작`);
    console.log(`[GamePage] - 간격: ${pollingInterval / 1000}초마다`);
    console.log(`[GamePage] - API: GET /api/queue/reserved_check`);
    console.log('[GamePage] ========================================');
    
    // 立即执行一次
    console.log('[GamePage] 📞 즉시 첫 번째 확인 실행...');
    pollReservedStatus();
    
    // 30초마다轮询
    pollingIntervalRef.current = setInterval(() => {
      console.log('[GamePage] 📞 정기 확인 (30초마다)...');
      pollReservedStatus();
    }, pollingInterval);
  };
  
  // 开始 하트비트 (게임 진행 중 3-5초마다)
  const startHeartbeat = () => {
    clearHeartbeat();
    
    if (!sessionId) {
      console.warn('[GamePage] sessionId가 없어 하트비트를 시작할 수 없습니다');
      return;
    }
    
    const heartbeatInterval = 4000; // 4초 (3-5초 사이)
    
    console.log(`[GamePage] 하트비트 시작 (${heartbeatInterval / 1000}초마다)`);
    
    // 立即执行一次
    sendHeartbeatRequest(sessionId);
    
    // 定期发送 하트비트
    heartbeatIntervalRef.current = setInterval(() => {
      if (sessionId) {
        sendHeartbeatRequest(sessionId);
      }
    }, heartbeatInterval);
  };
  
  // 发送 하트비트请求
  const sendHeartbeatRequest = async (currentSessionId: number) => {
    if (!currentSessionId || isMockLogin) {
      return;
    }
    
    // 计算经过的时间（用于调试 30 秒问题）
    const elapsedSeconds = gameStartTimeRef.current > 0 
      ? ((Date.now() - gameStartTimeRef.current) / 1000).toFixed(1) 
      : '未知';
    
    try {
      await sendHeartbeat({ sessionId: currentSessionId });
      console.log(`[GamePage] 하트비트 전송 성공 (게임 경과: ${elapsedSeconds}초)`);
    } catch (error) {
      console.error(`[GamePage] 하트비트 전송 실패 (게임 경과: ${elapsedSeconds}초):`, error);
      // 하트비트 실패해도 게임은 계속 진행
    }
  };

  // 轮询队列状态
  const pollReservedStatus = async () => {
    if (!machineId || isMockLogin) {
      return;
    }

    try {
      const numericMachineId = parseInt(machineId, 10);
      
      // userId는 숫자 또는 문자열 모두 가능 (백엔드 API가 문자열도 받음)
      console.log('[GamePage] 🔄 轮询队列状态:', { userId, machineId: numericMachineId });
      
      const data = await checkReservedStatus(userId, numericMachineId);
      
      console.log('[GamePage] ========================================');
      console.log('[GamePage] 📋 队列状态详情:');
      console.log('[GamePage] - position (위치):', data.position);
      console.log('[GamePage] - state (상태):', data.state);
      console.log('[GamePage] - canStart (시작 가능):', data.canStart);
      console.log('[GamePage] - startToken:', data.startToken ? '✅ 있음' : '❌ 없음');
      if (data.startToken) {
        console.log('[GamePage] - startToken 값:', data.startToken);
      }
      console.log('[GamePage] ========================================');
      
      // 更新队列状态 (새로운 API 형식)
      const newPosition = data.position;
      const newState = data.state;
      const newCanStart = data.canStart;
      const newStartToken = data.startToken;
      
      const oldPosition = position;
      
      setPosition(newPosition);
      setQueueState(newState);
      setCanStart(newCanStart);
      setStartToken(newStartToken);
      
      // 根据新的状态处理逻辑
      // 游戏开始条件：position === 1 && state === "ready" && canStart === true && startToken存在
      if (newPosition === 1 && newState === 'ready' && newCanStart && newStartToken) {
        // 可以开始游戏
        console.log('[GamePage] ========================================');
        console.log('[GamePage] ✅✅✅ 게임 시작 가능 조건 만족! ✅✅✅');
        console.log('[GamePage] - position:', newPosition, '(1번째)');
        console.log('[GamePage] - state:', newState, '(준비됨)');
        console.log('[GamePage] - canStart:', newCanStart, '(가능)');
        console.log('[GamePage] - startToken:', newStartToken);
        console.log('[GamePage] 🛑 轮询 중지');
        console.log('[GamePage] 🎮 자동으로 게임 시작!');
        console.log('[GamePage] ========================================');
        clearPolling();
        
        // 自动开始游戏
        if (oldPosition !== null && oldPosition > 1) {
          console.log('[GamePage] 💚 대기가 완료되었습니다! 자동으로 게임을 시작합니다.');
        }
        
        // 调用游戏开始函数
        handleGameStart(newStartToken); // 直接传递 token
      } else if (newState === 'playing') {
        // 游戏进行中
        console.log('[GamePage] ========================================');
        console.log('[GamePage] ⚠️ 게임 진행 중');
        console.log('[GamePage] state=playing, 이미 게임이 시작됨');
        console.log('[GamePage] 🛑 轮询 중지');
        console.log('[GamePage] ========================================');
        clearPolling();
      } else if (newPosition === null) {
        // 不在队列中
        console.log('[GamePage] ========================================');
        console.log('[GamePage] ⚠️ 대기열에 없음');
        console.log('[GamePage] position === null, 队列에서 제거됨');
        console.log('[GamePage] 🛑 轮询 중지');
        console.log('[GamePage] ========================================');
        clearPolling();
      } else if (newState === 'waiting') {
        // 还在队列中等待
        console.log('[GamePage] ⏳ 대기 중...');
        console.log('[GamePage] - 현재 위치:', newPosition);
        console.log('[GamePage] - 앞에 대기:', newPosition > 1 ? `${newPosition - 1}명` : '없음');
        console.log('[GamePage] - 다음 확인: 30초 후');
      }
    } catch (error) {
      console.error('[GamePage] 轮询队列状态失败:', error);
      // 不中断轮询，继续尝试
    }
  };

  // 处理按钮点击 - 检查所有条件并决定下一步操作
  const handleStartButtonClick = async () => {
    console.log('[GamePage] 🎮 게임 시작 버튼 클릭', {
      isStartingGame,
      machineId,
      userId,
      myCoins,
      position,
      queueState,
      canStart,
      hasStartToken: !!startToken
    });

    if (isStartingGame) {
      console.log('[GamePage] 이미 게임 시작 중...');
      alert('게임 시작 중입니다. 잠시만 기다려주세요.');
      return;
    }

    if (!machineId) {
      console.error('[GamePage] ❌ 기계 ID가 없습니다');
      alert('기계 ID가 없습니다');
      return;
    }

    // 模拟登录时，允许游戏开始，不检查 userId
    if (!isMockLogin && !userId) {
      console.error('[GamePage] ❌ 사용자 ID가 없습니다. 다시 로그인해주세요.');
      alert('사용자 ID가 없습니다. 다시 로그인해주세요.');
      navigate('/login');
      return;
    }

    // MVP 단계: 코인 확인 생략
    // 게임 시작 조건: position=1, state=ready, canStart=true, startToken 존재만 확인
    console.log('[GamePage] 💡 MVP 모드: 코인 확인 생략, 대기열 조건만 확인');

    // 1. 如果满足所有游戏开始条件，直接开始游戏
    if (startToken && position === 1 && queueState === 'ready' && canStart) {
      console.log('[GamePage] ✅ 게임 시작 조건 만족, 게임 시작!');
      await handleGameStart(startToken); // 显式传递 token
      return;
    }

    // 2. 如果还没有进入队列，自动进入队列
    if (position === null) {
      console.log('[GamePage] 대기열에 없음, 자동으로 대기열 진입');
      await handleGameEnter();
      return;
    }

    // 3. 如果已经在队列中但还没轮到，提示用户
    if (position !== null && position > 1) {
      console.log('[GamePage] ⏳ 대기 중, position:', position);
      alert(`현재 대기 중입니다.\n앞에 ${position - 1}명이 대기 중입니다.`);
      return;
    }

    // 4. 如果 position === 1 但其他条件不满足，显示具体原因
    if (position === 1) {
      console.error('[GamePage] ❌ position === 1이지만 시작 조건 불만족');
      
      let errorMessage = '게임을 시작할 수 없습니다.\n\n';
      
      if (queueState !== 'ready') {
        errorMessage += `❌ 상태: ${queueState ?? '없음'} (ready여야 함)\n`;
      }
      if (!canStart) {
        errorMessage += '❌ 시작 불가능 상태\n';
      }
      if (!startToken) {
        errorMessage += '❌ 시작 토큰이 없습니다.\n';
      }
      
      errorMessage += '\n잠시 후 다시 시도해주세요.';
      
      alert(errorMessage);
      return;
    }

    // 5. 其他未预期的情况
    console.error('[GamePage] ❌ 예상치 못한 상태');
    alert('게임 시작 조건을 확인할 수 없습니다.\n잠시 후 다시 시도해주세요.');
  };

  // 处理游戏入场 (/game/enter) - 自动完成整个流程
  const handleGameEnter = async () => {
    setIsStartingGame(true);

    try {
      // 模拟登录时，跳过 API 调用
      if (isMockLogin) {
        console.log('[GamePage] 모의 로그인 모드, API 호출 건너뛰기');
        setRemainingTime(45);
        setGameStarted(true);
        setUseWebRTC(true);
        setIsStartingGame(false);
        return;
      }

      console.log('[GamePage] 🎯 게임 시작 프로세스 시작');
      console.log('[GamePage] 1️⃣ 대기열 진입 시도 (/api/queue/enter)');
      console.log('[GamePage] userId 원본 값:', userId, '타입:', typeof userId);
      
      // userId 验证
      if (!userId || userId === 'null' || userId === 'undefined') {
        throw new Error('사용자 ID가 없습니다. 다시 로그인해주세요.');
      }
      
      if (!machineId) {
        throw new Error('기계 ID가 없습니다.');
      }
      
      const numericMachineId = parseInt(machineId, 10);
      if (isNaN(numericMachineId)) {
        throw new Error('기계 ID가 유효하지 않습니다.');
      }
      
      // userId 可以是数字或字符串格式，直接使用
      const requestBody = {
        userId: userId, // 直接使用原始 userId（可以是数字或字符串）
        machineId: numericMachineId,
      };

      console.log('[GamePage] /api/queue/enter 요청:', requestBody);

      const data = await enterGame(requestBody);

      console.log('[GamePage] /api/queue/enter 응답:', data);

      if (data.success) {
        // 进入队列成功
        const initialPosition = data.position || 1;
        console.log('[GamePage] ✅ 대기열 진입 성공, 위치:', initialPosition);
        
        setPosition(initialPosition);
        setQueueState('waiting');
        setCanStart(false);
        
        // 立即检查状态，看是否可以直接开始
        console.log('[GamePage] 2️⃣ 즉시 상태 확인 (/api/queue/reserved_check)');
        const statusData = await checkReservedStatus(userId, numericMachineId);
        
        console.log('[GamePage] 상태 확인 결과:', {
          position: statusData.position,
          state: statusData.state,
          canStart: statusData.canStart,
          hasStartToken: !!statusData.startToken
        });
        
        // 更新状态
        setPosition(statusData.position);
        setQueueState(statusData.state);
        setCanStart(statusData.canStart);
        setStartToken(statusData.startToken);
        
        // 如果可以开始，直接开始游戏
        if (statusData.position === 1 && statusData.state === 'ready' && statusData.canStart && statusData.startToken) {
          console.log('[GamePage] 3️⃣ ✅ 조건 충족! 즉시 게임 시작');
          await handleGameStart(statusData.startToken); // 直接传递 token
        } else {
          console.log('[GamePage] 3️⃣ ⏳ 아직 조건 불충족, 대기 중...');
          if (statusData.position && statusData.position > 1) {
            console.log(`[GamePage] 📝 앞에 ${statusData.position - 1}명 대기 중`);
          }
          // 开始轮询
          startPolling();
        }
      } else {
        console.error(`[GamePage] ❌ 게임 입장 실패: ${data.message || '알 수 없는 오류'}`);
        alert(`게임 입장 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('[GamePage] ========== 게임 입장 오류 ==========');
      console.error('[GamePage] 에러 객체:', error);
      console.error('[GamePage] 에러 타입:', typeof error);
      console.error('[GamePage] error instanceof Error:', error instanceof Error);
      
      if (error instanceof Error) {
        const errorMessage = error.message;
        const errorCode = (error as any).code;
        const rawData = (error as any).rawData;
        
        console.error('[GamePage] 📋 에러 상세 정보:');
        console.error('[GamePage] - 에러 코드 (errorCode):', errorCode);
        console.error('[GamePage] - 에러 메시지 (errorMessage):', errorMessage);
        console.error('[GamePage] - 원본 데이터 (rawData):', rawData);
        console.error('[GamePage] - errorCode 타입:', typeof errorCode);
        console.error('[GamePage] - errorMessage 타입:', typeof errorMessage);
        
        // 检查各种可能的 QUEUE_ENTERED 格式
        const isQueueEnteredError = 
          errorCode === 'QUEUE_ENTERED' ||
          (typeof errorMessage === 'string' && errorMessage.includes('QUEUE_ENTERED')) ||
          (typeof errorMessage === 'string' && errorMessage.includes('이미 대기열에')) ||
          (rawData && rawData.code === 'QUEUE_ENTERED') ||
          (rawData && rawData.message && rawData.message.includes('QUEUE_ENTERED'));
        
        console.error('[GamePage] 🔍 QUEUE_ENTERED 검사:');
        console.error('[GamePage] - errorCode === "QUEUE_ENTERED":', errorCode === 'QUEUE_ENTERED');
        console.error('[GamePage] - errorMessage.includes("QUEUE_ENTERED"):', typeof errorMessage === 'string' && errorMessage.includes('QUEUE_ENTERED'));
        console.error('[GamePage] - errorMessage.includes("이미 대기열에"):', typeof errorMessage === 'string' && errorMessage.includes('이미 대기열에'));
        console.error('[GamePage] - rawData.code === "QUEUE_ENTERED":', rawData && rawData.code === 'QUEUE_ENTERED');
        console.error('[GamePage] - 최종 판단 (isQueueEnteredError):', isQueueEnteredError);
        
        // 如果错误是 QUEUE_ENTERED（已在队列中），直接检查状态
        if (isQueueEnteredError) {
          console.log('[GamePage] ========================================');
          console.log('[GamePage] ✅✅✅ QUEUE_ENTERED 에러 감지됨! ✅✅✅');
          console.log('[GamePage] 이미 대기열에 있음 → /queue/reserved_check 호출');
          console.log('[GamePage] ========================================');
          
          // 直接调用 reserved_check 获取当前状态
          try {
            const numericMachineId = parseInt(machineId!, 10);
            const statusData = await checkReservedStatus(userId, numericMachineId);
            
            console.log('[GamePage] 🎯 대기열 상태 확인 완료:');
            console.log('[GamePage] - position:', statusData.position);
            console.log('[GamePage] - state:', statusData.state);
            console.log('[GamePage] - canStart:', statusData.canStart);
            console.log('[GamePage] - startToken:', statusData.startToken ? '✅ 있음' : '❌ 없음');
            
            // 更新状态
            setPosition(statusData.position);
            setQueueState(statusData.state);
            setCanStart(statusData.canStart);
            setStartToken(statusData.startToken);
            
            // 如果可以开始游戏，自动开始
            if (statusData.position === 1 && statusData.state === 'ready' && statusData.canStart && statusData.startToken) {
              console.log('[GamePage] ========================================');
              console.log('[GamePage] ✅ 게임 시작 가능!');
              console.log('[GamePage] 💚 position=1, state=ready, startToken 있음');
              console.log('[GamePage] 🎮 자동으로 게임 시작!');
              console.log('[GamePage] ========================================');
              
              // 自动开始游戏
              await handleGameStart(statusData.startToken); // 直接传递 token
              
            } else if (statusData.state === 'playing') {
              console.log('[GamePage] ========================================');
              console.log('[GamePage] ⚠️ 이미 게임 진행 중');
              console.log('[GamePage] state=playing, 게임이 이미 시작됨');
              console.log('[GamePage] ========================================');
            } else {
              console.log('[GamePage] ========================================');
              console.log('[GamePage] ⏳ 아직 대기 중');
              console.log('[GamePage] 30초마다 자동으로 /queue/reserved_check 호출 시작');
              console.log('[GamePage] ========================================');
              
              // 开始轮询
              startPolling();
              
              if (statusData.position && statusData.position > 1) {
                console.log(`[GamePage] 📝 현재 위치: ${statusData.position}번 (앞에 ${statusData.position - 1}명)`);
              } else {
                console.log('[GamePage] 대기 중, 곧 시작 가능');
              }
            }
            
            return;
          } catch (statusError) {
            console.error('[GamePage] 상태 확인 실패:', statusError);
            // 如果状态检查也失败，显示原始错误
          }
        }
        
        // 其他错误正常显示
        console.error(`[GamePage] ❌ 게임 입장 중 오류가 발생했습니다: ${errorMessage}`);
      } else {
        console.error('[GamePage] ❌ 게임 입장 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsStartingGame(false);
    }
  };

  // 处理游戏开始 (/game/start)
  const handleGameStart = async (token?: string) => {
    // 使用传入的 token 或状态中的 startToken
    const gameStartToken = token || startToken;
    
    if (!gameStartToken) {
      console.error('[GamePage] ❌ 게임 시작 토큰이 없습니다. 대기열을 확인해주세요.');
      return;
    }

    setIsStartingGame(true);

    try {
      console.log('[GamePage] 게임 시작 API 호출 (/game/start)');
      console.log('[GamePage] userId 원본 값:', userId, '타입:', typeof userId);
      console.log('[GamePage] startToken:', gameStartToken);
      
      // userId 验证
      if (!userId || userId === 'null' || userId === 'undefined') {
        throw new Error('사용자 ID가 없습니다. 다시 로그인해주세요.');
      }
      
      if (!machineId) {
        throw new Error('기계 ID가 없습니다.');
      }
      
      const numericMachineId = parseInt(machineId, 10);
      if (isNaN(numericMachineId)) {
        throw new Error('기계 ID가 유효하지 않습니다.');
      }
      
      // userId 可以是数字或字符串格式，直接使用
      const requestBody = {
        userId: userId, // 直接使用原始 userId（可以是数字或字符串）
        machineId: numericMachineId,
        startToken: gameStartToken, // 使用 gameStartToken 而不是 startToken
      };

      console.log('[GamePage] ========================================');
      console.log('[GamePage] 🚀 /game/start 요청 상세:');
      console.log('[GamePage] - userId:', userId, '(타입:', typeof userId, ')');
      console.log('[GamePage] - machineId:', numericMachineId);
      console.log('[GamePage] - startToken:', startToken);
      console.log('[GamePage] - 완전한 요청 body:', JSON.stringify(requestBody, null, 2));
      console.log('[GamePage] ========================================');

      const data = await startGame(requestBody);

      console.log('[GamePage] /game/start 응답:', data);

      if (data.success) {
        // 游戏开始成功
        gameStartTimeRef.current = Date.now(); // 记录游戏开始时间
        console.log('[GamePage] 게임 시작 성공');
        console.log('[GamePage] ⏱️  游戏开始时间:', new Date(gameStartTimeRef.current).toISOString());

        // 更新余额
        if (data.remainingCoins !== undefined) {
          setMyCoins(data.remainingCoins);
          localStorage.setItem('balance', String(data.remainingCoins));
        }

        // 更新游戏时间
        const durationSec = data.durationSec || 45;
        setRemainingTime(durationSec);

        // 保存 sessionId（必须从后端获取）
        if (!data.sessionId) {
          console.error('[GamePage] ❌ /api/game/start 응답에 sessionId가 없습니다');
          throw new Error('게임 시작 응답에 세션 ID가 없습니다. 다시 시도해주세요.');
        }
        setSessionId(data.sessionId);
        console.log('[GamePage] ✅ sessionId 저장됨:', data.sessionId);

        // 游戏开始
        setGameStarted(true);
        setUseWebRTC(true);
        
        // 重置游戏结束标志（允许在新游戏结束时再次调用）
        isEndingGameRef.current = false;
        
        console.log('[GamePage] ========================================');
        console.log('[GamePage] 🎮 게임 상태 업데이트:');
        console.log('[GamePage] - gameStarted: true');
        console.log('[GamePage] - useWebRTC: true');
        console.log('[GamePage] - durationSec:', durationSec, '초');
        console.log('[GamePage] - sessionId:', data.sessionId);
        console.log('[GamePage] - 게임 종료 플래그 리셋: false');
        console.log('[GamePage] ========================================');
        
        // 清除队列状态
        setPosition(null);
        setQueueState(null);
        setCanStart(false);
        setStartToken(null);
        clearPolling();

        // sessionId 设置后，useEffect 会自动启动 heartbeat

        console.log('[GamePage] 게임 시작 완료:', {
          sessionId: data.sessionId,
          durationSec,
          remainingCoins: data.remainingCoins,
        });
      } else {
        const reason = data.reason || '알 수 없는 오류';
        console.error(`[GamePage] ❌ 게임 시작 실패: ${reason}`);
        
        // 如果是因为余额不足，更新余额
        if (data.remainingCoins !== undefined) {
          setMyCoins(data.remainingCoins);
          localStorage.setItem('balance', String(data.remainingCoins));
        }
      }
    } catch (error) {
      console.error('[GamePage] 게임 시작 오류:', error);
      if (error instanceof Error) {
        console.error(`[GamePage] ❌ 게임 시작 중 오류가 발생했습니다: ${error.message}`);
      } else {
        console.error('[GamePage] ❌ 게임 시작 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsStartingGame(false);
    }
  };

  // 游戏控制函数 - 通过 API 实现（需要后端提供相应的 API）
  const handleMove = (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => {
    if (!gameStarted || !sessionId) {
      console.warn('[GamePage] 게임이 시작되지 않았거나 sessionId가 없습니다');
      return;
    }
    
    // TODO: 通过 API 调用控制抓娃娃机移动
    // 例如: await moveClawAPI({ sessionId, direction });
    console.log('[GamePage] 이동 명령:', direction);
  };

  const handleDrop = () => {
    if (!gameStarted || !sessionId) {
      console.warn('[GamePage] 게임이 시작되지 않았거나 sessionId가 없습니다');
      return;
    }
    
    // TODO: 通过 API 调用控制抓娃娃机下降
    // 例如: await dropClawAPI({ sessionId });
    console.log('[GamePage] 하강 명령');
  };

  const handleGrab = () => {
    if (!gameStarted || !sessionId) {
      console.warn('[GamePage] 게임이 시작되지 않았거나 sessionId가 없습니다');
      return;
    }
    
    console.log('[GamePage] 🎯 잡기 버튼 클릭, 게임 즉시 종료');
    
    // 立即停止倒计时
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current);
      gameTimerRef.current = null;
      console.log('[GamePage] ⏰ 잡기 버튼 클릭으로 타이머 즉시 중지');
    }
    
    // 立即停止游戏并调用结束 API
    setGameStarted(false);
    setUseWebRTC(false); // HLS로 전환
    setGameSuccess(false); // 게임 성공 상태 초기화
    
    // 调用游戏结束 API
    handleEndGame();
  };

  const handlePlayAgain = () => {
    // MVP 단계: 코인 확인 및 차감 생략
    console.log('[GamePage] 💡 MVP 모드: 코인 차감 없이 게임 재시작');
    
    // 게임 재시작
    setRemainingTime(45); // 타이머 초기화
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
          <h2 className="game-title">{gameTitle}</h2>
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
                {/* HLS 播放器 - 始终加载，根据状态显示/隐藏 */}
                <div style={{ 
                  display: (gameStarted && useWebRTC && webrtcReady) ? 'none' : 'block',
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  opacity: (gameStarted && useWebRTC && webrtcReady) ? 0 : 1,
                  transition: 'opacity 0.3s ease-in-out', // 淡入淡出效果
                  pointerEvents: (gameStarted && useWebRTC && webrtcReady) ? 'none' : 'auto'
                }}>
                  <GameVideo 
                    machineId={machineId}
                    streamName={streamName}
                    red5Host={red5Host}
                    red5Port={red5Port}
                  />
                </div>
                
                {/* WebRTC 播放器 - 游戏开始时显示 */}
                {(gameStarted && useWebRTC) && (
                  <div style={{ 
                    display: 'block', // 始终显示（WebRTCPlayer内部会处理加载状态）
                    width: '100%',
                    height: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 1,
                    opacity: webrtcReady ? 1 : 0.5, // 未就绪时半透明
                    transition: 'opacity 0.3s ease-in-out',
                    pointerEvents: 'auto'
                  }}>
                    <WebRTCPlayer 
                      machineId={machineId}
                      sessionId={sessionId || undefined}
                      streamUrl={`http://${red5Host}:${red5Port}/live/viewer.jsp?host=${red5Host}&stream=${streamName}`}
                      app="live"
                      streamName={streamName}
                      red5Host={red5Host}
                      red5Port={red5Port} // HTTP 端口 5080 使用 (WHEP 使用 HTTP)
                      useRed5ProSDK={true}
                      useSDKPlayer={true} // 使用 SDK 播放器模式
                      licenseKey={licenseKey} // Red5 Pro SDK 许可证密钥 (如果需要)
                      onFallbackToHLS={handleWebRTCFallback} // WebRTC 실패 시 HLS로 전환
                      onReady={handleWebRTCReady} // WebRTC 准备好时的回调
                      hidden={false} // 不隐藏，让组件正常显示加载状态
                    />
                  </div>
                )}
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
            <span>{gameStarted ? remainingTime : 45}</span>
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
                  <span className="game-cost">1000 코인</span>
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
              
              {/* 队列状态显示 (새로운 API 형식에 맞춰 수정) */}
              {position !== null && queueState === 'waiting' && (
                <div className="game-queue-status">
                  <div className="queue-waiting">
                    <span className="queue-icon">⏳</span>
                    <p className="queue-text">대기 중...</p>
                    <p className="queue-number">앞에 {position}명 대기 중</p>
                  </div>
                </div>
              )}
              
              <div className="game-start-container">
                <button 
                  className="game-start-button" 
                  type="button"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    console.log('[GamePage] ========== 버튼 클릭 이벤트 발생 ==========');
                    await handleStartButtonClick();
                  }}
                  disabled={isStartingGame}
                  style={{
                    pointerEvents: 'auto',
                    cursor: isStartingGame ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    zIndex: 1000,
                    opacity: isStartingGame ? 0.6 : 1
                  }}
                >
                  <span className="game-controller-icon">🎮</span>
                  <span className="game-start-text">
                    {isStartingGame ? '게임 시작 중...' : '컨트롤 게임 START'}
                  </span>
                  <span className="game-start-separator"></span>
                  <span className="game-cost">1000 코인</span>
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

      {/* 游戏结果弹窗 */}
      {gameResult && (
        <GameResultModal
          isOpen={true}
          result={gameResult}
          onClose={() => setGameResult(null)}
        />
      )}
    </div>
  );
};

export default GamePage;
