import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useSocket } from '@/contexts/SocketContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connect, isConnected } = useSocket();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedRef = useRef(false); // 跳转 상태 추적

  // 获取跳转目标参数
  const redirectTarget = searchParams.get('redirect'); // 'game' 或 'mypage'
  const machineId = searchParams.get('machineId'); // 目标机器 ID

  // 根据参数决定登录后跳转的目标
  const getRedirectPath = (): string => {
    // 优先读取 URL 参数
    if (redirectTarget === 'game' && machineId) {
      return `/game/${machineId}`;
    } else if (redirectTarget === 'mypage') {
      return '/mypage';
    }
    
    // 如果 URL 没有参数，尝试从 localStorage 读取（用于 OAuth 回调）
    const savedRedirectTarget = localStorage.getItem('oauth_redirect_target');
    const savedMachineId = localStorage.getItem('oauth_redirect_machineId');
    
    if (savedRedirectTarget === 'game' && savedMachineId) {
      return `/game/${savedMachineId}`;
    } else if (savedRedirectTarget === 'mypage') {
      return '/mypage';
    }
    
    // 默认跳转到 My Page
    return '/mypage';
  };

  // 연결 상태 감시, 연결 성공 후 목적지로 이동
  useEffect(() => {
    if (isConnected && isConnecting && !hasNavigatedRef.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      hasNavigatedRef.current = true;
      setIsConnecting(false);
      const targetPath = getRedirectPath();
      // 清除保存的 OAuth 跳转参数
      localStorage.removeItem('oauth_redirect_target');
      localStorage.removeItem('oauth_redirect_machineId');
      console.log('[Login] Socket 연결 성공, 跳转到:', targetPath);
      navigate(targetPath);
    }
  }, [isConnected, isConnecting, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 컴포넌트 마운트 시 상태 초기화 및登录状态检查
  useEffect(() => {
    hasNavigatedRef.current = false;
    setIsConnecting(false);
    
    // 检查是否有登录状态（localStorage）
    const savedUserId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');
    const mockLogin = localStorage.getItem('mockLogin') === 'true';
    
    // 如果已登录，根据参数跳转
    if (savedUserId && (authToken || mockLogin)) {
      const targetPath = getRedirectPath();
      console.log('[LoginPage] 检测到登录状态，自动跳转到:', targetPath);
      // 如果 Socket 未连接，先尝试连接
      if (!isConnected) {
        connect(savedUserId);
      }
      // 跳转到目标页面
      navigate(targetPath);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBack = () => {
    navigate('/');
  };

  // 모의 로그인 함수 (테스트용)
  const handleMockLogin = (provider: 'google' | 'kakao' | 'apple') => {
    // 이미跳转중이면 무시
    if (hasNavigatedRef.current) {
      return;
    }
    
    setIsConnecting(true);
    hasNavigatedRef.current = false; // 跳转状态重置
    
    console.log(`[Mock Login] ${provider} 모의 로그인 시작`);
    
    // 모의 사용자 정보 생성
    const socialUserMap: { [key: string]: { userId: string; username: string } } = {
      'google': { userId: 'user-google-001', username: 'Google Test User' },
      'kakao': { userId: 'user-kakao-001', username: 'Kakao Test User' },
      'apple': { userId: 'user-apple-001', username: 'Apple Test User' },
    };

    const userInfo = socialUserMap[provider];
    
    // 사용자 정보 저장
    localStorage.setItem('userId', userInfo.userId);
    localStorage.setItem('username', userInfo.username);
    localStorage.setItem('mockLogin', 'true'); // 모의 로그인 표시

    // Socket 연결 시도
    connect(userInfo.userId);

    // 타임아웃 설정: 1초 후 목적지로 이동 (Socket 연결을 기다리지 않음)
    timeoutRef.current = setTimeout(() => {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        setIsConnecting(false);
        const targetPath = getRedirectPath();
        // 清除保存的 OAuth 跳转参数
        localStorage.removeItem('oauth_redirect_target');
        localStorage.removeItem('oauth_redirect_machineId');
        console.log('[Mock Login] 타임아웃, 跳转到:', targetPath);
        navigate(targetPath);
      }
    }, 1000);
  };

  // 실제 OAuth 로그인 함수 (백엔드 API 호출)
  const handleRealOAuthLogin = async (provider: 'google' | 'kakao' | 'apple') => {
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
      localStorage.removeItem('mockLogin'); // 실제 로그인 시 모의 로그인 플래그 제거

      // Socket 연결
      connect(String(userId));

      // Socket 연결 성공 대기 (useEffect에서 처리)
      // 타임아웃 설정: 5초 후에도 연결되지 않으면 경고
      timeoutRef.current = setTimeout(() => {
        if (isConnecting) {
          console.warn('[OAuth] Socket 연결이 지연되고 있습니다. 계속 진행합니다.');
          setIsConnecting(false);
          const targetPath = getRedirectPath();
          navigate(targetPath);
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

  // Google OAuth 登录处理
  const handleGoogleLoginSuccess = async (tokenResponse: any) => {
    setIsConnecting(true);
    hasNavigatedRef.current = false;

    // 保存跳转参数到 localStorage，以便后续使用
    if (redirectTarget) {
      localStorage.setItem('oauth_redirect_target', redirectTarget);
    }
    if (machineId) {
      localStorage.setItem('oauth_redirect_machineId', machineId);
    }
    console.log('[Google OAuth] 保存跳转参数:', { redirectTarget, machineId });

    try {
      console.log('[Google OAuth] 登录成功，获取用户信息...');
      
      // 使用 access_token 获取用户信息
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('获取用户信息失败');
      }

      const userInfo = await userInfoResponse.json();
      console.log('[Google OAuth] Google 用户信息:', userInfo);

      // 构建 providerUserId (格式: google_{google_user_id})
      const providerUserId = `google_${userInfo.id}`;
      console.log('[Google OAuth] Provider User ID:', providerUserId);

      // 调用后端 OAuth 登录 API
      // POST /api/auth/google
      // Request Body: { "providerUserId": "google_12345" }
      const backendApiUrl = import.meta.env.VITE_API_URL || '';
      const apiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/google` : '/api/auth/google';
      
      console.log('[Google OAuth] 调用后端 API:', apiUrl);
      
      const backendResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerUserId: providerUserId,
        }),
      });

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        let errorMessage = `后端登录失败 (${backendResponse.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // 解析后端返回的用户信息
      const backendData = await backendResponse.json();
      console.log('[Google OAuth] 后端返回的用户信息:', backendData);

      // 使用后端返回的用户信息
      const userId = backendData.userId || backendData.id;
      const username = backendData.username || userInfo.name || userInfo.email || 'Google User';
      const email = userInfo.email || '';
      const picture = userInfo.picture || '';
      const balance = backendData.balance || 0;
      const provider = backendData.provider || 'google';

      // 保存用户信息到 localStorage
      localStorage.setItem('userId', String(userId));
      localStorage.setItem('username', username);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('balance', String(balance));
      localStorage.setItem('provider', provider);
      if (picture) {
        localStorage.setItem('userAvatar', picture);
      }
      localStorage.setItem('authToken', tokenResponse.access_token);
      localStorage.removeItem('mockLogin'); // 移除模拟登录标记

      // Socket 连接
      connect(String(userId));

      // 设置超时：1秒后跳转到目标页面
      timeoutRef.current = setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          setIsConnecting(false);
          const targetPath = getRedirectPath();
          // 清除保存的 OAuth 跳转参数
          localStorage.removeItem('oauth_redirect_target');
          localStorage.removeItem('oauth_redirect_machineId');
          console.log('[Google OAuth] 跳转到:', targetPath);
          navigate(targetPath);
        }
      }, 1000);

    } catch (err) {
      console.error('[Google OAuth] 登录处理错误:', err);
      setIsConnecting(false);
      alert('Google 登录失败，请重试');
    }
  };

  const handleGoogleLoginError = () => {
    console.error('[Google OAuth] 登录失败或取消');
    setIsConnecting(false);
    alert('Google 登录已取消');
  };

  // Google OAuth Client ID 检查
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const hasGoogleClientId = !!googleClientId && googleClientId !== 'dummy-client-id' && googleClientId.trim() !== '';

  // 手动实现 Google OAuth 登录（根据环境自动选择 redirect_uri）
  const handleManualGoogleLogin = () => {
    if (!hasGoogleClientId) {
      console.warn('[Login] Google Client ID 未配置，使用模拟登录');
      handleMockLogin('google');
      return;
    }

    // 保存跳转参数到 localStorage，以便 OAuth 回调后使用
    if (redirectTarget) {
      localStorage.setItem('oauth_redirect_target', redirectTarget);
    }
    if (machineId) {
      localStorage.setItem('oauth_redirect_machineId', machineId);
    }
    console.log('[Login] 保存 OAuth 跳转参数:', { redirectTarget, machineId });

    // 获取 redirect_uri
    const getRedirectUri = () => {
      // 如果设置了环境变量，优先使用环境变量
      if (import.meta.env.VITE_GOOGLE_REDIRECT_URI) {
        return import.meta.env.VITE_GOOGLE_REDIRECT_URI;
      }
      
      // 默认使用本地开发环境的重定向 URL（前端处理 OAuth 回调，然后调用后端 POST API）
      return 'http://localhost:3000/oauth/callback/google';
    };

    const redirectUri = getRedirectUri();
    const scope = 'openid email profile';
    const responseType = 'token'; // implicit flow
    
    // 详细的配置信息输出
    console.log('%c========== Google OAuth 配置信息 ==========', 'color: blue; font-weight: bold; font-size: 14px;');
    console.log('%c当前访问的 Origin:', 'color: green; font-weight: bold;', window.location.origin);
    console.log('%c当前访问的 Hostname:', 'color: green; font-weight: bold;', window.location.hostname);
    console.log('%c使用的 Redirect URI:', 'color: red; font-weight: bold; font-size: 16px;', redirectUri);
    console.log('%c============================================', 'color: blue; font-weight: bold; font-size: 14px;');
    
    // 重要提示：显示需要在 Google Cloud Console 中配置的 URI
    console.warn('%c⚠️  重要：请在 Google Cloud Console 中配置以下 Redirect URI:', 'color: orange; font-weight: bold; font-size: 14px;');
    console.warn('%c' + redirectUri, 'color: red; font-weight: bold; font-size: 16px; background: yellow; padding: 5px;');
    console.log('%c配置路径：Google Cloud Console > API 和服务 > 凭据 > OAuth 2.0 客户端 ID > 已授权的重定向 URI', 'color: gray; font-style: italic;');
    
    // 构建 Google OAuth URL
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(googleClientId)}&` +
      `redirect_uri=${encodedRedirectUri}&` +
      `response_type=${responseType}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `include_granted_scopes=true&` +
      `prompt=consent`; // 强制用户重新授权，即使浏览器中保持 Google 账户登录状态
    
    console.log('[Login] ========== OAuth URL 详细信息 ==========');
    console.log('[Login] 原始 Redirect URI:', redirectUri);
    console.log('[Login] 编码后的 Redirect URI:', encodedRedirectUri);
    console.log('[Login] 当前访问的 Origin:', window.location.origin);
    console.log('[Login] Redirect URI 是否匹配当前 Origin:', redirectUri.startsWith(window.location.origin));
    console.log('[Login] 完整的 OAuth URL:', authUrl);
    console.log('[Login] ==========================================');
    
    // 检查 CORS 问题
    const redirectUriMatchesOrigin = redirectUri.startsWith(window.location.origin);
    console.log('[Login] Redirect URI 是否匹配当前 Origin:', redirectUriMatchesOrigin);
    
    if (!redirectUriMatchesOrigin) {
      console.error('%c❌ CORS 错误：Redirect URI 与当前访问的域名不匹配！', 'color: red; font-weight: bold; font-size: 16px; background: yellow; padding: 5px;');
      console.error('%c当前 Origin: ' + window.location.origin, 'color: red; font-weight: bold;');
      console.error('%cRedirect URI: ' + redirectUri, 'color: red; font-weight: bold;');
      console.error('%c这会导致 "Invalid CORS request" 错误！', 'color: red; font-weight: bold;');
      console.error('%c解决方案：确保 redirect_uri 以当前 origin 开头', 'color: orange; font-weight: bold;');
    } else {
      console.log('%c✅ Redirect URI 匹配当前 Origin，CORS 应该正常', 'color: green; font-weight: bold;');
    }
    
    console.log('[Login] 打开 Google OAuth 登录页面');
    
    // 打开 OAuth 登录窗口
    window.location.href = authUrl;
  };

  // Google OAuth 登录配置（使用库的默认实现作为备选）
  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleLoginSuccess,
    onError: handleGoogleLoginError,
    flow: 'implicit', // 使用 implicit flow (纯前端，直接获取 access_token)
    prompt: 'consent', // 强制用户重新授权，即使浏览器中保持 Google 账户登录状态
  });

  // 社交登录处理函数
  const handleSocialLogin = (provider: 'google' | 'kakao' | 'apple') => {
    if (provider === 'google') {
      // Google 使用真实的 OAuth 登录（如果配置了 clientId）
      if (hasGoogleClientId) {
        console.log('[Login] Google OAuth 登录开始，使用 redirect_uri: https://app.supercontrol.com/oauth/callback/google');
        // 使用手动实现的 OAuth 登录以支持自定义 redirect_uri
        handleManualGoogleLogin();
      } else {
        // 如果没有配置 clientId，使用模拟登录
        console.warn('[Login] Google Client ID 未配置，使用模拟登录');
        handleMockLogin('google');
      }
    } else {
      // Kakao 和 Apple 暂时使用模拟登录
      handleMockLogin(provider);
      // 实际 API 使用时可取消注释
      // handleRealOAuthLogin(provider);
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
            title={hasGoogleClientId ? '使用 Google OAuth 登录' : 'Google Client ID 未配置，将使用模拟登录'}
          >
            <span className="google-icon">G</span>
            <span>Continue with Google</span>
            {!hasGoogleClientId && (
              <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '8px' }}>
                (模拟)
              </span>
            )}
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
