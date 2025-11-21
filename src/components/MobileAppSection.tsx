import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
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
}

const MobileAppSection: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected } = useSocket();
  const [currentTime, setCurrentTime] = useState<string>('');

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

  // 게임 카드 데이터 (실제로는 백엔드에서 가져와야 함)
  const gameCards: GameCard[] = [
    {
      id: 'game-001',
      title: '블랙핑크 굿즈 뽑기',
      description: '블랙핑크 굿즈를 뽑으면 응원봉을 배송',
      price: 10,
      viewers: 5,
      isLive: true,
      tags: ['인형뽑기', '응원봉 경품'],
    },
    {
      id: 'game-002',
      title: '케데헌 호랑이 뽑기',
      description: '케데헌 호랑이를 뽑기 챌린지에 도전!',
      price: 10,
      viewers: 5,
      isLive: true,
      tags: ['인형뽑기', '응원봉 경품'],
    },
    {
      id: 'game-003',
      title: '프리미엄 인형 뽑기',
      description: '특별한 프리미엄 인형을 뽑아보세요!',
      price: 15,
      viewers: 12,
      isLive: true,
      tags: ['인형뽑기', '프리미엄'],
    },
    {
      id: 'game-004',
      title: '한정판 굿즈 뽑기',
      description: '한정판 굿즈를 뽑을 수 있는 특별한 기회!',
      price: 20,
      viewers: 8,
      isLive: true,
      tags: ['인형뽑기', '한정판'],
    },
  ];

  const handleLogin = () => {
    navigate('/login');
  };

  const handlePlayGame = () => {
    if (!isConnected) {
      alert('먼저 로그인해주세요');
      navigate('/login');
      return;
    }
    // 기본 기계로 게임 시작
    navigate('/game/machine-001');
  };

  const handleCardClick = (cardId: string) => {
    if (!isConnected) {
      alert('먼저 로그인해주세요');
      navigate('/login');
      return;
    }
    // 카드 클릭 시 해당 게임으로 이동 (cardId를 machineId로 변환)
    const machineId = cardId.replace('game-', 'machine-');
    navigate(`/game/${machineId}`);
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
          <button className="user-profile-button" onClick={handleLogin}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="8" r="4"/>
              <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
            </svg>
          </button>
        </div>

        {/* 콘텐츠 영역 */}
        <div className="mobile-content">
          {gameCards.map((card) => (
            <div
              key={card.id}
              className="game-card"
              onClick={() => handleCardClick(card.id)}
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
          <div className="nav-item">
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

