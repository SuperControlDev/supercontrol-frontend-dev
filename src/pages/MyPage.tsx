import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import './MyPage.css';

const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const { disconnect } = useSocket();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [freeTickets, setFreeTickets] = useState<number>(0);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      // localStorage에서 userId 읽기
      const savedUserId = localStorage.getItem('userId');
      
      if (!savedUserId) {
        // 로그인 정보가 없으면 로그인 페이지로 이동
        console.log('[MyPage] 로그인 정보를 찾을 수 없습니다. 로그인 페이지로 이동합니다');
        navigate('/login');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const backendApiUrl = import.meta.env.VITE_API_URL || '';

        // 1. 사용자 정보 API 호출하여 기본 정보 가져오기
        // GET /api/user/profile?userId=player_1
        const profileApiUrl = backendApiUrl 
          ? `${backendApiUrl}/api/user/profile?userId=${encodeURIComponent(savedUserId)}`
          : `/api/user/profile?userId=${encodeURIComponent(savedUserId)}`;
        
        console.log('[MyPage] 사용자 정보 API 호출:', profileApiUrl);
        
        const profileResponse = await fetch(profileApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!profileResponse.ok) {
          const errorText = await profileResponse.text();
          let errorMessage = `사용자 정보 가져오기 실패 (${profileResponse.status})`;
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }

        const userData = await profileResponse.json();
        console.log('[MyPage] 사용자 정보 API 응답:', userData);

        // localStorage에서 Google 프로필 사진 읽기 (있는 경우)
        const savedAvatar = localStorage.getItem('userAvatar');

        // 사용자 기본 정보 업데이트
        setUserId(userData.userId || userData.id || savedUserId);
        // 백엔드에서 반환된 username 우선 사용
        setUsername(userData.userName || userData.username || userData.name || '');
        setUserEmail(userData.email || userData.userEmail || '');
        // localStorage의 Google 프로필 사진 우선 사용, 없으면 백엔드 반환 값 사용
        setUserAvatar(savedAvatar || userData.avatar || userData.picture || userData.userAvatar || null);
        
        // profile API에서 잔액 가져오기
        if (userData.balance !== undefined) {
          setBalance(userData.balance);
          // localStorage의 잔액 업데이트
          localStorage.setItem('balance', String(userData.balance));
        } else {
          console.warn('[MyPage] Profile API가 balance를 반환하지 않았습니다. 기본값 0 사용');
          setBalance(0);
        }
        
        // profile API에서 무료 티켓 가져오기
        if (userData.free_tickets !== undefined) {
          setFreeTickets(userData.free_tickets);
          // localStorage에 티켓 수 저장 (GamePage에서 사용)
          localStorage.setItem('tickets', String(userData.free_tickets));
          console.log('[MyPage] 티켓 수 저장:', userData.free_tickets);
        } else {
          console.warn('[MyPage] Profile API가 free_tickets를 반환하지 않았습니다. 기본값 0 사용');
          setFreeTickets(0);
          localStorage.setItem('tickets', '0');
        }
      } catch (err) {
        console.error('[MyPage] 사용자 정보 가져오기 실패:', err);
        setError(err instanceof Error ? err.message : '사용자 정보 가져오기 실패, 다시 시도해주세요');
        
        // API 호출 실패 시 localStorage에서 읽기 시도 (fallback)
        const savedUsername = localStorage.getItem('username');
        const savedEmail = localStorage.getItem('userEmail');
        const savedBalance = localStorage.getItem('balance');
        const savedAvatar = localStorage.getItem('userAvatar');

        setUserId(savedUserId);
        setUsername(savedUsername);
        setUserEmail(savedEmail);
        setBalance(savedBalance ? parseInt(savedBalance, 10) : 0);
        setUserAvatar(savedAvatar);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const handleLogout = () => {
    // 로그아웃 확인
    if (window.confirm('로그아웃 하시겠습니까?')) {
      console.log('[MyPage] 사용자 로그아웃');
      
      // localStorage의 사용자 정보 삭제
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('balance');
      localStorage.removeItem('provider');
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('authToken');
      localStorage.removeItem('mockLogin');
      
      // Socket 연결 해제
      disconnect();
      
      // 홈으로 이동
      navigate('/');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (isLoading) {
    // 사용자 정보 로딩 중
    return (
      <div className="my-page">
        <div className="loading-container">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    // 로딩 실패 및 사용자 정보 없음
    return (
      <div className="my-page">
        <div className="loading-container">
          <p style={{ color: '#ff4444' }}>오류: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              marginTop: '16px', 
              padding: '8px 16px', 
              background: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-page">
      <div className="my-page-mobile-frame">
        {/* 상태 바 */}
        <div className="my-page-status-bar">
          <span className="my-page-status-time">
            {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="my-page-status-icons">
            <span className="my-page-status-icon">📶</span>
            <span className="my-page-status-icon">🔋</span>
          </div>
        </div>

        {/* 헤더 */}
        <div className="my-page-header">
          <button className="my-page-back-button" onClick={handleBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 className="my-page-title">My Page</h1>
          <div style={{ width: '24px' }}></div> {/* 플레이스홀더, 제목 중앙 정렬 유지 */}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="my-page-content">
          {/* 사용자 프로필 사진 및 정보 */}
          <div className="my-page-profile-section">
            <div className="my-page-avatar-container">
              {userAvatar ? (
                <img src={userAvatar} alt="User Avatar" className="my-page-avatar" />
              ) : (
                <div className="my-page-avatar-placeholder">
                  <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M12 14c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4z"/>
                  </svg>
                </div>
              )}
            </div>
            {username && (
              <h2 className="my-page-username">{username}</h2>
            )}
            {userEmail && (
              <p className="my-page-email">{userEmail}</p>
            )}
          </div>

          {/* 사용자 정보 카드 */}
          <div className="my-page-info-card">
            <div className="my-page-info-item">
              <span className="my-page-info-label">User ID</span>
              <span className="my-page-info-value">{userId}</span>
            </div>
            <div className="my-page-info-item">
              <span className="my-page-info-label">Ticket</span>
              <span className="my-page-info-value">
                <span className="coin-icon">🎫</span>
                {freeTickets}
              </span>
            </div>
            <div className="my-page-info-item">
              <span className="my-page-info-label">Balance</span>
              <span className="my-page-info-value">
                <span className="coin-icon">🪙</span>
                {balance}
              </span>
            </div>
          </div>

          {/* 로그아웃 버튼 */}
          <div className="my-page-actions">
            <button className="my-page-logout-button" onClick={handleLogout}>
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyPage;

