import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import { MachineStatus } from '@/types/session';
import './MobileAppSection.css';

interface GameCard {
  id: string;
  title: string;
  description: string;
  price: number;
  viewers: number;
  isLive: boolean;
  tags: string[];
  imageUrl?: string;
  machineId: string | number; // API에서 받은 실제 machineId
  theme?: string; // 테마 색상 또는 테마 이름
}

// API에서 받은 기계 데이터 타입
interface ApiMachine {
  id?: number;
  machineId?: number;
  publicId?: string;
  name: string;
  status?: string; // "AVAILABLE" | "BUSY" | "MAINTENANCE"
  price?: number;
  thumbnailUrl?: string;
  description?: string;
  viewers?: number;
  tags?: string[];
  theme?: string; // 테마 정보
  createdAt?: string | null;
  updatedAt?: string | null;
}

const MobileAppSection: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, connect } = useSocket();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [gameCards, setGameCards] = useState<GameCard[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 시스템 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };

    // 초기 시간 설정
    updateTime();

    // 1분마다 시간 업데이트
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, []);

  // API에서 기계 목록 가져오기
  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/machines', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API 요청 실패 (${response.status}): ${errorText || response.statusText}`);
        }
        
        const machines: ApiMachine[] = await response.json();
        
        // API 데이터를 GameCard 형식으로 변환
        const cards: GameCard[] = machines.map((machine) => {
          // machineId 추출 (machineId는 숫자)
          const machineId = machine.machineId || machine.id;
          if (!machineId) {
            console.warn('machineId가 없는 기계 데이터:', machine);
            return null;
          }
          const machineIdStr = String(machineId);
          
          // 상태 확인 (백엔드는 대문자 "AVAILABLE", "BUSY", "MAINTENANCE" 반환)
          const statusUpper = machine.status?.toUpperCase() || 'AVAILABLE';
          const statusLower = statusUpper.toLowerCase();
          const isLive = statusLower === MachineStatus.AVAILABLE;
          
          return {
            id: `game-${machineIdStr}`,
            machineId: machineIdStr,
            title: machine.name || `기계 ${machineIdStr}`,
            description: machine.description || `${machine.name}에서 인형을 뽑아보세요!`,
            price: machine.price || 10,
            viewers: machine.viewers || Math.floor(Math.random() * 20) + 1,
            isLive,
            tags: machine.tags || ['인형뽑기'],
            imageUrl: machine.thumbnailUrl || machine.imageUrl,
            theme: machine.theme || `theme-${machineIdStr}`, // 백엔드에서 제공한 테마 사용, 또는 기본 테마 생성
          };
        }).filter((card): card is GameCard => card !== null);
        
        setGameCards(cards);
      } catch (err) {
        console.error('기계 목록 가져오기 실패:', err);
        let errorMessage = '기계 목록을 불러오는데 실패했습니다.';
        
        if (err instanceof TypeError && err.message.includes('fetch')) {
          errorMessage = '네트워크 오류: 백엔드 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
        // 에러 발생 시 빈 배열 설정
        setGameCards([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMachines();
  }, []);

  const handleLogin = () => {
    navigate('/login');
  };

  const handlePlayGame = () => {
    // 로그인 상태 확인 (localStorage)
    const savedUserId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');
    const mockLogin = localStorage.getItem('mockLogin') === 'true';
    
    // 이미 로그인한 경우 게임 페이지로 바로 이동 (Socket 연결은 GamePage에서 자동 복원)
    if (savedUserId && (authToken || mockLogin)) {
      console.log('[MobileAppSection] 로그인 상태 감지, 게임 페이지로 이동');
      // Socket이 연결되지 않은 경우 연결 시도 (선택사항, GamePage에서도 처리)
      if (!isConnected) {
        connect(savedUserId);
      }
      // 첫 번째 사용 가능한 기계로 게임 시작
      const availableMachine = gameCards.find(card => card.isLive);
      const targetCard = availableMachine || gameCards[0];
      if (targetCard) {
        // 게임 테마 및 제목 저장
        if (targetCard.theme) {
          localStorage.setItem(`game_theme_${targetCard.machineId}`, targetCard.theme);
        }
        if (targetCard.title) {
          localStorage.setItem(`game_title_${targetCard.machineId}`, targetCard.title);
        }
        navigate(`/game/${targetCard.machineId}`);
      } else {
        alert('사용 가능한 기계가 없습니다');
      }
      return;
    }
    
    // 로그인하지 않은 경우 로그인 페이지로 이동하고 대상 게임 정보 전달
    if (!isConnected) {
      alert('먼저 로그인해주세요');
      const availableMachine = gameCards.find(card => card.isLive);
      const targetCard = availableMachine || gameCards[0];
      const targetMachineId = targetCard?.machineId || '1';
      // 게임 테마 및 제목 저장
      if (targetCard?.theme) {
        localStorage.setItem(`game_theme_${targetMachineId}`, targetCard.theme);
      }
      if (targetCard?.title) {
        localStorage.setItem(`game_title_${targetMachineId}`, targetCard.title);
      }
      navigate(`/login?redirect=game&machineId=${targetMachineId}`);
      return;
    }
    // 첫 번째 사용 가능한 기계로 게임 시작
    const availableMachine = gameCards.find(card => card.isLive);
    const targetCard = availableMachine || gameCards[0];
    if (targetCard) {
      // 게임 테마 및 제목 저장
      if (targetCard.theme) {
        localStorage.setItem(`game_theme_${targetCard.machineId}`, targetCard.theme);
      }
      if (targetCard.title) {
        localStorage.setItem(`game_title_${targetCard.machineId}`, targetCard.title);
      }
      navigate(`/game/${targetCard.machineId}`);
    } else {
      alert('사용 가능한 기계가 없습니다');
    }
  };

  const handleCardClick = (card: GameCard) => {
    // 로그인 상태 확인 (localStorage)
    const savedUserId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');
    const mockLogin = localStorage.getItem('mockLogin') === 'true';
    
    // localStorage에 게임 테마 및 제목 저장
    if (card.theme) {
      localStorage.setItem(`game_theme_${card.machineId}`, card.theme);
      console.log('[MobileAppSection] 게임 테마 저장:', card.theme, '기계:', card.machineId);
    }
    if (card.title) {
      localStorage.setItem(`game_title_${card.machineId}`, card.title);
      console.log('[MobileAppSection] 게임 제목 저장:', card.title, '기계:', card.machineId);
    }
    
    // 이미 로그인한 경우 게임 페이지로 바로 이동 (Socket 연결은 GamePage에서 자동 복원)
    if (savedUserId && (authToken || mockLogin)) {
      console.log('[MobileAppSection] 로그인 상태 감지, 게임 페이지로 이동');
      // Socket이 연결되지 않은 경우 연결 시도 (선택사항, GamePage에서도 처리)
      if (!isConnected) {
        connect(savedUserId);
      }
      // 카드 클릭 시 해당 게임으로 이동
      navigate(`/game/${card.machineId}`);
      return;
    }
    
    // 로그인하지 않은 경우 로그인 페이지로 이동하고 대상 게임 machineId 전달
    if (!isConnected) {
      alert('먼저 로그인해주세요');
      navigate(`/login?redirect=game&machineId=${card.machineId}`);
      return;
    }
    // 카드 클릭 시 해당 게임으로 이동
    navigate(`/game/${card.machineId}`);
  };

  const handleMyPageClick = () => {
    // 로그인 상태 확인
    const savedUserId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');
    const mockLogin = localStorage.getItem('mockLogin') === 'true';
    
    // 이미 로그인한 경우 MyPage로 이동
    if (savedUserId && (authToken || mockLogin)) {
      navigate('/mypage');
    } else {
      // 로그인하지 않은 경우 로그인 페이지로 이동하고 출처를 mypage로 표시
      alert('먼저 로그인해주세요');
      navigate('/login?redirect=mypage');
    }
  };

  return (
    <div className="mobile-app-section">
      <div className="mobile-frame">
        {/* 상태 바 */}
        <div className="status-bar">
          <span className="status-time">{currentTime || '00:00'}</span>
          <div className="status-icons">
            <span className="status-icon">📶</span>
            <span className="status-icon">🔋</span>
          </div>
        </div>

        {/* 헤더 */}
        <div className="mobile-header">
          <h1 className="app-logo">SuperControl</h1>
          <button className="user-profile-button" onClick={handleMyPageClick}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="8" r="4"/>
              <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
            </svg>
          </button>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="mobile-content">
          {isLoading && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p>기계 목록을 불러오는 중...</p>
            </div>
          )}
          {error && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
              <p>오류: {error}</p>
            </div>
          )}
          {!isLoading && !error && gameCards.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p>사용 가능한 기계가 없습니다</p>
            </div>
          )}
          {gameCards.map((card) => (
            <div
              key={card.id}
              className="game-card"
              onClick={() => handleCardClick(card)}
            >
              {card.isLive && (
                <div className="live-badge">
                  <span className="live-dot"></span>
                  LIVE
                </div>
              )}
              <div className="card-viewers">
                <span className="eye-icon">👁</span>
                <span>{card.viewers}</span>
              </div>
              
              <div className="card-image">
                <div className="image-placeholder">
                  <span className="mountain-icon">⛰</span>
                </div>
              </div>
              
              <div className="card-profile">
                <div className="profile-avatar"></div>
              </div>
              
              <div className="card-content">
                <h3 className="card-title">{card.title}</h3>
                <p className="card-description">{card.description}</p>
                <div className="card-price">$ {card.price}</div>
                <div className="card-tags">
                  {card.tags.map((tag, index) => (
                    <span key={index} className="card-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 게임하기 버튼 - 고정 버튼 */}
        <div className="play-game-button-container">
          <button className="play-game-button" onClick={handlePlayGame}>
            <span className="gamepad-icon">🎮</span>
            <span>컨트롤 게임하기</span>
          </button>
        </div>

        {/* 하단 네비게이션 */}
        <div className="mobile-nav">
          <div className="nav-item active">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
            <span>Home</span>
          </div>
          <div className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
            <span>Live</span>
          </div>
          <div className="nav-item">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M12 2v20M8 6h8"/>
            </svg>
            <span>Ranking</span>
          </div>
          <div className="nav-item" onClick={handleMyPageClick}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>My Page</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAppSection;

