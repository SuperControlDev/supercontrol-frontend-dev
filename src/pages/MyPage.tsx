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
      // 从 localStorage 读取 userId
      const savedUserId = localStorage.getItem('userId');
      
      if (!savedUserId) {
        // 如果没有登录信息，跳转到登录页面
        console.log('[MyPage] 未找到登录信息，跳转到登录页面');
        navigate('/login');
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const backendApiUrl = import.meta.env.VITE_API_URL || '';

        // 1. 调用用户信息 API 获取基本信息
        // GET /api/user/profile?userId=player_1
        const profileApiUrl = backendApiUrl 
          ? `${backendApiUrl}/api/user/profile?userId=${encodeURIComponent(savedUserId)}`
          : `/api/user/profile?userId=${encodeURIComponent(savedUserId)}`;
        
        console.log('[MyPage] 调用用户信息 API:', profileApiUrl);
        
        const profileResponse = await fetch(profileApiUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!profileResponse.ok) {
          const errorText = await profileResponse.text();
          let errorMessage = `获取用户信息失败 (${profileResponse.status})`;
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          
          throw new Error(errorMessage);
        }

        const userData = await profileResponse.json();
        console.log('[MyPage] 用户信息 API 响应:', userData);

        // 从 localStorage 读取 Google 头像（如果有）
        const savedAvatar = localStorage.getItem('userAvatar');

        // 更新用户基本信息
        setUserId(userData.userId || userData.id || savedUserId);
        // 优先使用后端返回的 username
        setUsername(userData.userName || userData.username || userData.name || '');
        setUserEmail(userData.email || userData.userEmail || '');
        // 优先使用 localStorage 中的 Google 头像，如果没有则使用后端返回的头像
        setUserAvatar(savedAvatar || userData.avatar || userData.picture || userData.userAvatar || null);
        
        // 从 profile API 获取余额
        if (userData.balance !== undefined) {
          setBalance(userData.balance);
          // 更新 localStorage 中的余额
          localStorage.setItem('balance', String(userData.balance));
        } else {
          console.warn('[MyPage] Profile API 未返回 balance，使用默认值 0');
          setBalance(0);
        }
        
        // 从 profile API 获取免费票券
        if (userData.free_tickets !== undefined) {
          setFreeTickets(userData.free_tickets);
        } else {
          console.warn('[MyPage] Profile API 未返回 free_tickets，使用默认值 0');
          setFreeTickets(0);
        }
      } catch (err) {
        console.error('[MyPage] 获取用户信息失败:', err);
        setError(err instanceof Error ? err.message : '获取用户信息失败，请重试');
        
        // 如果 API 调用失败，尝试从 localStorage 读取（作为 fallback）
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
    // 确认登出
    if (window.confirm('로그아웃 하시겠습니까?')) {
      console.log('[MyPage] 用户登出');
      
      // 清除 localStorage 中的用户信息
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('balance');
      localStorage.removeItem('provider');
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('authToken');
      localStorage.removeItem('mockLogin');
      
      // 断开 Socket 连接
      disconnect();
      
      // 跳转到首页
      navigate('/');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  if (isLoading) {
    // 正在加载用户信息
    return (
      <div className="my-page">
        <div className="loading-container">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error && !userId) {
    // 加载失败且没有用户信息
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
          <div style={{ width: '24px' }}></div> {/* 占位符，保持标题居中 */}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="my-page-content">
          {/* 用户头像和信息 */}
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

          {/* 用户信息卡片 */}
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

          {/* 登出按钮 */}
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

