import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
// import { useGoogleLogin } from '@react-oauth/google'; // 현재 미사용, 수동 구현 사용
import { useSocket } from '@/contexts/SocketContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connect, isConnected } = useSocket();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasNavigatedRef = useRef(false); // 이동 상태 추적

  // 이동 대상 파라미터 가져오기
  const redirectTarget = searchParams.get('redirect'); // 'game' 또는 'mypage'
  const machineId = searchParams.get('machineId'); // 대상 기계 ID

  // 파라미터에 따라 로그인 후 이동할 대상 결정
  const getRedirectPath = (): string => {
    // URL 파라미터 우선 사용
    if (redirectTarget === 'game' && machineId) {
      return `/game/${machineId}`;
    } else if (redirectTarget === 'mypage') {
      return '/mypage';
    }
    
    // URL에 파라미터가 없으면 localStorage에서 읽기 시도 (OAuth 콜백용)
    const savedRedirectTarget = localStorage.getItem('oauth_redirect_target');
    const savedMachineId = localStorage.getItem('oauth_redirect_machineId');
    
    if (savedRedirectTarget === 'game' && savedMachineId) {
      return `/game/${savedMachineId}`;
    } else if (savedRedirectTarget === 'mypage') {
      return '/mypage';
    }
    
    // 기본값은 My Page로 이동
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
      // 저장된 OAuth 이동 파라미터 삭제
      localStorage.removeItem('oauth_redirect_target');
      localStorage.removeItem('oauth_redirect_machineId');
      console.log('[Login] Socket 연결 성공, 이동:', targetPath);
      navigate(targetPath);
    }
  }, [isConnected, isConnecting, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  // 컴포넌트 마운트 시 상태 초기화 및 로그인 상태 확인
  useEffect(() => {
    hasNavigatedRef.current = false;
    setIsConnecting(false);
    
    // 로그인 상태 확인 (localStorage)
    const savedUserId = localStorage.getItem('userId');
    const authToken = localStorage.getItem('authToken');
    const mockLogin = localStorage.getItem('mockLogin') === 'true';
    
    // 이미 로그인한 경우 파라미터에 따라 이동
    if (savedUserId && (authToken || mockLogin)) {
      const targetPath = getRedirectPath();
      console.log('[LoginPage] 로그인 상태 감지, 자동 이동:', targetPath);
      // Socket이 연결되지 않은 경우 연결 시도
      if (!isConnected) {
        connect(savedUserId);
      }
      // 대상 페이지로 이동
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
    // 이미 이동 중이면 무시
    if (hasNavigatedRef.current) {
      return;
    }
    
    setIsConnecting(true);
    hasNavigatedRef.current = false; // 이동 상태 초기화
    
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
        // 저장된 OAuth 이동 파라미터 삭제
        localStorage.removeItem('oauth_redirect_target');
        localStorage.removeItem('oauth_redirect_machineId');
        console.log('[Mock Login] 타임아웃, 이동:', targetPath);
        navigate(targetPath);
      }
    }, 1000);
  };

  // 실제 OAuth 로그인 함수 (백엔드 API 호출) - 현재 미사용 (향후 확장용)
  /*
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
  */

  // Google OAuth 로그인 처리 (라이브러리 콜백용) - 현재 미사용, 수동 구현 사용
  /*
  const handleGoogleLoginSuccess = async (tokenResponse: any) => {
    setIsConnecting(true);
    hasNavigatedRef.current = false;

    // localStorage에 이동 파라미터 저장 (이후 사용)
    if (redirectTarget) {
      localStorage.setItem('oauth_redirect_target', redirectTarget);
    }
    if (machineId) {
      localStorage.setItem('oauth_redirect_machineId', machineId);
    }
    console.log('[Google OAuth] 이동 파라미터 저장:', { redirectTarget, machineId });

    try {
      console.log('[Google OAuth] 로그인 성공, 사용자 정보 가져오기...');
      
      // access_token을 사용하여 사용자 정보 가져오기
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenResponse.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('사용자 정보 가져오기 실패');
      }

      const userInfo = await userInfoResponse.json();
      console.log('[Google OAuth] Google 사용자 정보:', userInfo);

      // providerUserId 구성 (형식: google_{google_user_id})
      const providerUserId = `google_${userInfo.id}`;
      console.log('[Google OAuth] Provider User ID:', providerUserId);

      // 백엔드 OAuth 로그인 API 호출
      // POST /api/auth/google
      // Request Body: { "providerUserId": "google_12345" }
      const backendApiUrl = import.meta.env.VITE_API_URL || '';
      const apiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/google` : '/api/auth/google';
      
      console.log('[Google OAuth] 백엔드 API 호출:', apiUrl);
      
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
        let errorMessage = `백엔드 로그인 실패 (${backendResponse.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // 백엔드에서 반환된 사용자 정보 파싱
      const backendData = await backendResponse.json();
      console.log('[Google OAuth] 백엔드에서 반환된 사용자 정보:', backendData);

      // 백엔드에서 반환된 사용자 정보 사용
      const userId = backendData.userId || backendData.id;
      const username = backendData.username || userInfo.name || userInfo.email || 'Google User';
      const email = userInfo.email || '';
      const picture = userInfo.picture || '';
      const balance = backendData.balance || 0;
      const provider = backendData.provider || 'google';

      // localStorage에 사용자 정보 저장
      localStorage.setItem('userId', String(userId));
      localStorage.setItem('username', username);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('balance', String(balance));
      localStorage.setItem('provider', provider);
      if (picture) {
        localStorage.setItem('userAvatar', picture);
      }
      localStorage.setItem('authToken', tokenResponse.access_token);
      localStorage.removeItem('mockLogin'); // 모의 로그인 표시 제거

      // Socket 연결
      connect(String(userId));

      // 타임아웃 설정: 1초 후 대상 페이지로 이동
      timeoutRef.current = setTimeout(() => {
        if (!hasNavigatedRef.current) {
          hasNavigatedRef.current = true;
          setIsConnecting(false);
          const targetPath = getRedirectPath();
          // 저장된 OAuth 이동 파라미터 삭제
          localStorage.removeItem('oauth_redirect_target');
          localStorage.removeItem('oauth_redirect_machineId');
          console.log('[Google OAuth] 이동:', targetPath);
          navigate(targetPath);
        }
      }, 1000);

    } catch (err) {
      console.error('[Google OAuth] 로그인 처리 오류:', err);
      setIsConnecting(false);
      alert('Google 로그인 실패, 다시 시도해주세요');
    }
  };

  const handleGoogleLoginError = () => {
    console.error('[Google OAuth] 로그인 실패 또는 취소');
    setIsConnecting(false);
    alert('Google 로그인이 취소되었습니다');
  };
  */

  // Google OAuth Client ID 확인
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const hasGoogleClientId = !!googleClientId && googleClientId !== 'dummy-client-id' && googleClientId.trim() !== '';

  // Kakao OAuth REST API Key 확인
  const kakaoRestApiKey = import.meta.env.VITE_KAKAO_REST_API_KEY || '';
  const hasKakaoRestApiKey = !!kakaoRestApiKey && kakaoRestApiKey !== 'dummy-rest-api-key' && kakaoRestApiKey.trim() !== '';

  // 수동으로 Google OAuth 로그인 구현 (환경에 따라 redirect_uri 자동 선택)
  const handleManualGoogleLogin = () => {
    if (!hasGoogleClientId) {
      console.warn('[Login] Google Client ID가 설정되지 않았습니다. 모의 로그인을 사용합니다');
      handleMockLogin('google');
      return;
    }

    // localStorage에 이동 파라미터 저장 (OAuth 콜백 후 사용)
    if (redirectTarget) {
      localStorage.setItem('oauth_redirect_target', redirectTarget);
    }
    if (machineId) {
      localStorage.setItem('oauth_redirect_machineId', machineId);
    }
    console.log('[Login] OAuth 이동 파라미터 저장:', { redirectTarget, machineId });

    // redirect_uri 가져오기
    const getRedirectUri = () => {
      // 환경 변수가 설정되어 있으면 환경 변수 우선 사용
      if (import.meta.env.VITE_GOOGLE_REDIRECT_URI) {
        return import.meta.env.VITE_GOOGLE_REDIRECT_URI;
      }
      
      // 기본값은 로컬 개발 환경의 리다이렉트 URL 사용 (프론트엔드에서 OAuth 콜백 처리 후 백엔드 POST API 호출)
      return 'http://localhost:3000/oauth/callback/google';
    };

    const redirectUri = getRedirectUri();
    const scope = 'openid email profile';
    const responseType = 'token'; // implicit flow
    
    // 자세한 설정 정보 출력
    console.log('%c========== Google OAuth 설정 정보 ==========', 'color: blue; font-weight: bold; font-size: 14px;');
    console.log('%c현재 접속 중인 Origin:', 'color: green; font-weight: bold;', window.location.origin);
    console.log('%c현재 접속 중인 Hostname:', 'color: green; font-weight: bold;', window.location.hostname);
    console.log('%c사용 중인 Redirect URI:', 'color: red; font-weight: bold; font-size: 16px;', redirectUri);
    console.log('%c============================================', 'color: blue; font-weight: bold; font-size: 14px;');
    
    // 중요 알림: Google Cloud Console에서 설정해야 하는 URI 표시
    console.warn('%c⚠️  중요: Google Cloud Console에서 다음 Redirect URI를 설정해주세요:', 'color: orange; font-weight: bold; font-size: 14px;');
    console.warn('%c' + redirectUri, 'color: red; font-weight: bold; font-size: 16px; background: yellow; padding: 5px;');
    console.log('%c설정 경로: Google Cloud Console > API 및 서비스 > 사용자 인증 정보 > OAuth 2.0 클라이언트 ID > 승인된 리디렉션 URI', 'color: gray; font-style: italic;');
    
    // Google OAuth URL 구성
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(googleClientId)}&` +
      `redirect_uri=${encodedRedirectUri}&` +
      `response_type=${responseType}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `include_granted_scopes=true&` +
      `prompt=consent`; // 브라우저에 Google 계정이 로그인되어 있어도 사용자에게 재인증 강제
    
    console.log('[Login] ========== OAuth URL 상세 정보 ==========');
    console.log('[Login] 원본 Redirect URI:', redirectUri);
    console.log('[Login] 인코딩된 Redirect URI:', encodedRedirectUri);
    console.log('[Login] 현재 접속 중인 Origin:', window.location.origin);
    console.log('[Login] Redirect URI가 현재 Origin과 일치:', redirectUri.startsWith(window.location.origin));
    console.log('[Login] 전체 OAuth URL:', authUrl);
    console.log('[Login] ==========================================');
    
    // CORS 문제 확인
    const redirectUriMatchesOrigin = redirectUri.startsWith(window.location.origin);
    console.log('[Login] Redirect URI가 현재 Origin과 일치:', redirectUriMatchesOrigin);
    
    if (!redirectUriMatchesOrigin) {
      console.error('%c❌ CORS 오류: Redirect URI가 현재 접속 중인 도메인과 일치하지 않습니다!', 'color: red; font-weight: bold; font-size: 16px; background: yellow; padding: 5px;');
      console.error('%c현재 Origin: ' + window.location.origin, 'color: red; font-weight: bold;');
      console.error('%cRedirect URI: ' + redirectUri, 'color: red; font-weight: bold;');
      console.error('%c이는 "Invalid CORS request" 오류를 발생시킬 수 있습니다!', 'color: red; font-weight: bold;');
      console.error('%c해결 방법: redirect_uri가 현재 origin으로 시작하는지 확인', 'color: orange; font-weight: bold;');
    } else {
      console.log('%c✅ Redirect URI가 현재 Origin과 일치합니다. CORS가 정상 작동해야 합니다', 'color: green; font-weight: bold;');
    }
    
    console.log('[Login] Google OAuth 로그인 페이지 열기');
    
    // OAuth 로그인 창 열기
    window.location.href = authUrl;
  };

  // Google OAuth 로그인 설정 (라이브러리의 기본 구현) - 현재 미사용, 수동 구현 사용
  // const googleLogin = useGoogleLogin({
  //   onSuccess: handleGoogleLoginSuccess,
  //   onError: handleGoogleLoginError,
  //   flow: 'implicit', // implicit flow 사용 (순수 프론트엔드, access_token 직접 가져오기)
  //   prompt: 'consent', // 브라우저에 Google 계정이 로그인되어 있어도 사용자에게 재인증 강제
  // });

  // Kakao OAuth 로그인 구현
  const handleManualKakaoLogin = () => {
    if (!hasKakaoRestApiKey) {
      console.error('[Login] Kakao REST API Key가 설정되지 않았습니다.');
      alert('Kakao 로그인을 사용하려면 환경 변수 VITE_KAKAO_REST_API_KEY를 설정해주세요.\n\n설정 방법:\n1. .env 파일 생성\n2. VITE_KAKAO_REST_API_KEY=your_key 추가\n3. 개발 서버 재시작');
      return;
    }

    // localStorage에 이동 파라미터 저장 (OAuth 콜백 후 사용)
    if (redirectTarget) {
      localStorage.setItem('oauth_redirect_target', redirectTarget);
    }
    if (machineId) {
      localStorage.setItem('oauth_redirect_machineId', machineId);
    }
    console.log('[Login] Kakao OAuth 이동 파라미터 저장:', { redirectTarget, machineId });

    // redirect_uri 가져오기
    const getKakaoRedirectUri = () => {
      // 환경 변수가 설정되어 있으면 환경 변수 우선 사용
      if (import.meta.env.VITE_KAKAO_REDIRECT_URI) {
        return import.meta.env.VITE_KAKAO_REDIRECT_URI;
      }
      
      // 기본값은 현재 origin + 콜백 경로
      return `${window.location.origin}/oauth/callback/kakao`;
    };

    const redirectUri = getKakaoRedirectUri();
    const responseType = 'code'; // Authorization Code Flow
    
    // 자세한 설정 정보 출력
    console.log('%c========== Kakao OAuth 설정 정보 ==========', 'color: blue; font-weight: bold; font-size: 14px;');
    console.log('%c현재 접속 중인 Origin:', 'color: green; font-weight: bold;', window.location.origin);
    console.log('%c현재 접속 중인 Hostname:', 'color: green; font-weight: bold;', window.location.hostname);
    console.log('%c사용 중인 Redirect URI:', 'color: red; font-weight: bold; font-size: 16px;', redirectUri);
    console.log('%c사용 중인 REST API Key:', 'color: orange; font-weight: bold;', kakaoRestApiKey.substring(0, 10) + '...');
    console.log('%c============================================', 'color: blue; font-weight: bold; font-size: 14px;');
    
    // 중요 알림: Kakao Developers에서 설정해야 하는 URI 표시
    console.warn('%c⚠️  중요: Kakao Developers에서 다음 Redirect URI를 설정해주세요:', 'color: orange; font-weight: bold; font-size: 14px;');
    console.warn('%c' + redirectUri, 'color: red; font-weight: bold; font-size: 16px; background: yellow; padding: 5px;');
    console.log('%c설정 경로: Kakao Developers > 내 애플리케이션 > 제품 설정 > 카카오 로그인 > Redirect URI', 'color: gray; font-style: italic;');
    
    // Kakao OAuth URL 구성
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const authUrl = `https://kauth.kakao.com/oauth/authorize?` +
      `client_id=${encodeURIComponent(kakaoRestApiKey)}&` +
      `redirect_uri=${encodedRedirectUri}&` +
      `response_type=${responseType}`;
    
    console.log('[Login] ========== Kakao OAuth URL 상세 정보 ==========');
    console.log('[Login] 원본 Redirect URI:', redirectUri);
    console.log('[Login] 인코딩된 Redirect URI:', encodedRedirectUri);
    console.log('[Login] 현재 접속 중인 Origin:', window.location.origin);
    console.log('[Login] Redirect URI가 현재 Origin과 일치:', redirectUri.startsWith(window.location.origin));
    console.log('[Login] 전체 OAuth URL:', authUrl);
    console.log('[Login] ==========================================');
    
    // CORS 문제 확인
    const redirectUriMatchesOrigin = redirectUri.startsWith(window.location.origin);
    console.log('[Login] Redirect URI가 현재 Origin과 일치:', redirectUriMatchesOrigin);
    
    if (!redirectUriMatchesOrigin) {
      console.error('%c❌ CORS 오류: Redirect URI가 현재 접속 중인 도메인과 일치하지 않습니다!', 'color: red; font-weight: bold; font-size: 16px; background: yellow; padding: 5px;');
      console.error('%c현재 Origin: ' + window.location.origin, 'color: red; font-weight: bold;');
      console.error('%cRedirect URI: ' + redirectUri, 'color: red; font-weight: bold;');
      console.error('%c해결 방법: redirect_uri가 현재 origin으로 시작하는지 확인', 'color: orange; font-weight: bold;');
    } else {
      console.log('%c✅ Redirect URI가 현재 Origin과 일치합니다. 정상 작동해야 합니다', 'color: green; font-weight: bold;');
    }
    
    console.log('[Login] Kakao OAuth 로그인 페이지 열기');
    
    // OAuth 로그인 창 열기
    window.location.href = authUrl;
  };

  // 소셜 로그인 처리 함수
  const handleSocialLogin = (provider: 'google' | 'kakao' | 'apple') => {
    if (provider === 'google') {
      // Google은 실제 OAuth 로그인 사용 (clientId가 설정되어 있는 경우)
      if (hasGoogleClientId) {
        console.log('[Login] Google OAuth 로그인 시작, redirect_uri 사용: https://app.supercontrol.com/oauth/callback/google');
        // 사용자 정의 redirect_uri를 지원하도록 수동으로 구현한 OAuth 로그인 사용
        handleManualGoogleLogin();
      } else {
        // clientId가 설정되지 않은 경우 모의 로그인 사용
        console.warn('[Login] Google Client ID가 설정되지 않았습니다. 모의 로그인을 사용합니다');
        handleMockLogin('google');
      }
    } else if (provider === 'kakao') {
      // Kakao는 실제 OAuth 로그인만 사용
      console.log('[Login] Kakao OAuth 로그인 시작');
      handleManualKakaoLogin();
    } else {
      // Apple은 일단 모의 로그인 사용
      handleMockLogin(provider);
      // 실제 API 사용 시 주석 해제
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
            title={hasGoogleClientId ? 'Google OAuth를 사용하여 로그인' : 'Google Client ID가 설정되지 않았습니다. 모의 로그인을 사용합니다'}
          >
            <span className="google-icon">G</span>
            <span>Continue with Google</span>
            {!hasGoogleClientId && (
              <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '8px' }}>
                (모의)
              </span>
            )}
          </button>

          <button
            className="social-button social-button-kakao"
            onClick={() => handleSocialLogin('kakao')}
            disabled={isConnecting || !hasKakaoRestApiKey}
            title={hasKakaoRestApiKey ? 'Kakao OAuth를 사용하여 로그인' : 'Kakao REST API Key가 설정되지 않았습니다. 환경 변수를 설정해주세요.'}
          >
            <svg className="social-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Continue with Kakao</span>
            {!hasKakaoRestApiKey && (
              <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '8px', color: '#ff6b6b' }}>
                (미설정)
              </span>
            )}
          </button>

          {/* Apple 登录按钮 - 暂时隐藏，取消注释即可恢复 */}
          {false && (
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
          )}
          
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
