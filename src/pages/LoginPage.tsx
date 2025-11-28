import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import { MachineStatus } from '@/types/session';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();
  const { connect, isConnected } = useSocket();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 기본 사용 가능한 기계 가져오기
  const getDefaultMachine = (): string => {
    const mockMachines = [
      { machineId: 'machine-001', status: MachineStatus.AVAILABLE },
      { machineId: 'machine-002', status: MachineStatus.AVAILABLE },
      { machineId: 'machine-003', status: MachineStatus.BUSY },
      { machineId: 'machine-004', status: MachineStatus.AVAILABLE },
    ];
    
    const availableMachine = mockMachines.find(
      (m) => m.status === MachineStatus.AVAILABLE
    );
    
    return availableMachine ? availableMachine.machineId : mockMachines[0].machineId;
  };

  // 연결 상태 감시, 연결 성공 후 게임 화면으로 이동
  useEffect(() => {
    if (isConnected && isConnecting) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setIsConnecting(false);
      const defaultMachine = getDefaultMachine();
      navigate(`/game/${defaultMachine}`);
    }
  }, [isConnected, isConnecting, navigate]);

  // 타이머 정리
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  const handleSocialLogin = async (provider: 'google' | 'kakao' | 'apple') => {
    setIsConnecting(true);

    try {
      console.log(`[OAuth] ${provider} 로그인 시도 중...`);
      
      // 백엔드 OAuth API 호출
      const response = await fetch(`/api/auth/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // TODO: 백엔드가 요구하는 경우 request body 추가
        // body: JSON.stringify({
        //   token: '...', // OAuth token
        //   code: '...',  // OAuth authorization code
        // }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `로그인 실패 (${response.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // API 응답 파싱
      const data = await response.json();
      console.log(`[OAuth] ${provider} 로그인 성공:`, data);

      // 백엔드 응답 형식에 따라 사용자 정보 추출
      // 예상 응답 형식: { userId, username, token?, ... }
      const userId = data.userId || data.id || data.user?.id || `user-${provider}-${Date.now()}`;
      const username = data.username || data.name || data.user?.name || `${provider} User`;
      const token = data.token || data.accessToken || data.access_token;

      // 사용자 정보 저장
      localStorage.setItem('userId', String(userId));
      localStorage.setItem('username', username);
      if (token) {
        localStorage.setItem('authToken', token);
      }

      // Socket 연결
      connect(String(userId));

      // Socket 연결 성공 대기 (useEffect에서 처리)
      // 타임아웃 설정: 5초 후에도 연결되지 않으면 경고
      timeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          console.warn('[OAuth] Socket 연결이 지연되고 있습니다. 계속 진행합니다.');
          setIsConnecting(false);
          const defaultMachine = getDefaultMachine();
          navigate(`/game/${defaultMachine}`);
        }
      }, 5000);

    } catch (err) {
      console.error(`[OAuth] ${provider} 로그인 오류:`, err);
      setIsConnecting(false);
      
      let errorMessage = '로그인 실패. 다시 시도해주세요.';
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className="login-page">
      <div className="mobile-frame">
        <div className="login-container">
          {/* Back Button */}
          <button onClick={handleBack} className="back-to-home-button">
            ← 홈으로
          </button>
          
          {/* Logo */}
          <div className="logo-container">
          <div className="logo-icon">
            <div className="logo-square">
              <div className="logo-circle">
                <div className="logo-play-button"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="brand-name">SuperControl</h1>

        {/* Tagline */}
        <p className="tagline">We Play The Real</p>

        {/* Social Login Buttons */}
        <div className="social-login-section">
          <button
            className="social-button social-button-google"
            onClick={() => handleSocialLogin('google')}
            disabled={isConnecting}
          >
            <span className="google-icon">G</span>
            <span>Continue with Google</span>
          </button>

          <button
            className="social-button social-button-kakao"
            onClick={() => handleSocialLogin('kakao')}
            disabled={isConnecting}
          >
            <svg className="social-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Continue with Kakao</span>
          </button>

          <button
            className="social-button social-button-apple"
            onClick={() => handleSocialLogin('apple')}
            disabled={isConnecting}
          >
            <svg className="social-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            <span>Continue with Apple</span>
          </button>
        </div>

          {isConnecting && (
            <div className="loading-indicator">
              <span>로그인 중...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
