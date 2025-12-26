import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import './OAuthCallbackPage.css';

const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { connect } = useSocket();
  const hasProcessedRef = useRef(false); // 중복 실행 방지 플래그

  useEffect(() => {
    // 이미 처리된 경우 즉시 반환 (React StrictMode 및 중복 실행 방지)
    if (hasProcessedRef.current) {
      console.log('[OAuth Callback] 이미 콜백 처리 완료, 중복 실행 건너뛰기');
      return;
    }

    const handleOAuthCallback = async () => {
      try {
        // 즉시 플래그 설정하여 중복 실행 방지
        hasProcessedRef.current = true;
        
        console.log('[OAuth Callback] 콜백 처리 시작...');
        console.log('[OAuth Callback] 현재 URL:', window.location.href);
        console.log('[OAuth Callback] URL Hash:', window.location.hash);
        console.log('[OAuth Callback] URL Search:', window.location.search);
        
        // Implicit flow: access_token은 URL hash (#)에 있으며 query string (?)이 아닙니다
        // hash에서 파라미터 파싱 필요
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        // hash에서 우선 가져오기 (implicit flow), 없으면 query string에서 가져오기
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const error = hashParams.get('error') || queryParams.get('error');
        const code = hashParams.get('code') || queryParams.get('code');
        
        console.log('[OAuth Callback] 파싱된 파라미터:', { accessToken: accessToken ? '찾음' : '없음', error, code: code ? '찾음' : '없음' });

        if (error) {
          console.error('[OAuth Callback] Google에서 오류 반환:', error);
          const errorDescription = hashParams.get('error_description') || queryParams.get('error_description') || '';
          // 오류 시 플래그 초기화하여 재시도 허용
          hasProcessedRef.current = false;
          alert(`Google 로그인 실패: ${error}${errorDescription ? '\n' + errorDescription : ''}`);
          navigate('/login');
          return;
        }

        if (accessToken) {
          // Implicit flow: access_token 직접 보유
          console.log('[OAuth Callback] ✅ access_token 받음');
          await handleGoogleLoginSuccess(accessToken);
        } else if (code) {
          // Authorization code flow: 토큰 교환 필요
          console.log('[OAuth Callback] authorization code 받음');
          // 오류 시 플래그 초기화하여 재시도 허용
          hasProcessedRef.current = false;
          alert('Authorization code flow 아직 구현되지 않음, implicit flow를 사용하세요');
          navigate('/login');
        } else {
          console.error('[OAuth Callback] ❌ token 또는 code를 찾을 수 없음');
          console.error('[OAuth Callback] Hash 파라미터:', Object.fromEntries(hashParams));
          console.error('[OAuth Callback] Query 파라미터:', Object.fromEntries(queryParams));
          // 오류 시 플래그 초기화하여 재시도 허용
          hasProcessedRef.current = false;
          alert('OAuth 콜백 파라미터가 유효하지 않습니다. URL을 확인하세요');
          navigate('/login');
        }
      } catch (err) {
        // 오류 시 플래그 초기화하여 재시도 허용
        hasProcessedRef.current = false;
        console.error('[OAuth Callback] ❌ 처리 오류:', err);
        if (err instanceof Error) {
          console.error('[OAuth Callback] 오류 상세:', err.message, err.stack);
          alert(`로그인 처리 실패: ${err.message}`);
        } else {
          alert('로그인 처리 실패, 다시 시도하세요');
        }
        navigate('/login');
      }
    };

    handleOAuthCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 마운트 시 한 번만 실행, searchParams 및 navigate 의존성 제거

  const handleGoogleLoginSuccess = async (accessToken: string) => {
    try {
      console.log('[OAuth Callback] 사용자 정보 가져오기 시작...');
      console.log('[OAuth Callback] Access Token:', accessToken.substring(0, 20) + '...');
      
      // Vite 프록시를 사용하여 Google API 호출 (CORS 문제 방지)
      console.log('[OAuth Callback] 프록시를 통해 Google API에서 사용자 정보 가져오기...');
      let userInfoResponse;
      try {
        // 로컬 프록시 경로 사용, Vite가 Google API로 전달
        userInfoResponse = await fetch('/google-api/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        console.log('[OAuth Callback] Google API 응답 상태:', userInfoResponse.status);
      } catch (fetchError) {
        console.error('[OAuth Callback] Google API 요청 실패:', fetchError);
        // 오류 처리 개선: 네트워크 오류 또는 CORS 오류 확인
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          throw new Error('네트워크 연결 실패, 네트워크 연결을 확인하거나 페이지를 새로고침하세요');
        }
        if (fetchError instanceof Error && (fetchError.message.includes('CORS') || fetchError.message.includes('cors'))) {
          throw new Error('사용자 정보 가져오기 시 CORS 오류 발생, 네트워크 연결을 확인하세요');
        }
        throw fetchError;
      }

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('[OAuth Callback] Google API 오류 응답:', errorText);
        
        // "Invalid CORS request" 오류 확인
        if (errorText.includes('Invalid CORS request') || errorText.includes('CORS')) {
          throw new Error('Invalid CORS request: Google Cloud Console의 "Authorized JavaScript origins" 설정을 확인하여 현재 도메인이 포함되어 있는지 확인하세요');
        }
        
        // JSON 오류 응답 파싱 시도
        let errorMessage = `사용자 정보 가져오기 실패 (${userInfoResponse.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.error_description || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const userInfo = await userInfoResponse.json();
      console.log('[OAuth Callback] Google 사용자 정보:', userInfo);

      // providerUserId 구성 (형식: google_{google_user_id})
      const providerUserId = `google_${userInfo.id}`;
      console.log('[OAuth Callback] Provider User ID:', providerUserId);

      // username (Google Name) 및 프로필 사진 추출
      const googleName = userInfo.name || userInfo.email || 'Google User';
      const googlePicture = userInfo.picture || '';
      console.log('[OAuth Callback] Google Name:', googleName);
      console.log('[OAuth Callback] Google Picture:', googlePicture);

      // 백엔드 OAuth 로그인 API 호출
      // POST /api/auth/google
      // Request Body: { "providerUserId": "google_12345", "username": "John Doe" }
      const backendApiUrl = import.meta.env.VITE_API_URL || '';
      const apiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/google` : '/api/auth/google';
      
      console.log('[OAuth Callback] 백엔드 API 호출:', apiUrl);
      console.log('[OAuth Callback] 요청 본문:', { providerUserId, username: googleName });
      
      let backendResponse;
      try {
        backendResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            providerUserId: providerUserId,
            username: googleName,
          }),
        });
        console.log('[OAuth Callback] 백엔드 API 응답 상태:', backendResponse.status);
      } catch (fetchError) {
        console.error('[OAuth Callback] 백엔드 API 요청 실패:', fetchError);
        // 오류 처리 개선
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          throw new Error('네트워크 연결 실패, 백엔드 서버에 연결할 수 없습니다. 네트워크 연결을 확인하세요');
        }
        if (fetchError instanceof Error && (fetchError.message.includes('CORS') || fetchError.message.includes('cors'))) {
          throw new Error('백엔드 API 호출 시 CORS 오류 발생, 백엔드 CORS 설정을 확인하세요');
        }
        throw fetchError;
      }

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error('[OAuth Callback] 백엔드 API 오류 응답:', errorText);
        let errorMessage = `백엔드 로그인 실패 (${backendResponse.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('[OAuth Callback] 백엔드 오류 상세:', errorData);
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      // 백엔드에서 반환된 사용자 정보 파싱
      const backendData = await backendResponse.json();
      console.log('[OAuth Callback] 백엔드에서 반환된 사용자 정보:', backendData);

      // 백엔드에서 반환된 사용자 정보 사용
      const userId = backendData.userId || backendData.id;
      // 백엔드에서 반환된 username 우선 사용, 없으면 Google Name 사용
      const username = backendData.username || googleName;
      const email = userInfo.email || '';
      const balance = backendData.balance || 0;
      const provider = backendData.provider || 'google';

      // localStorage에 사용자 정보 저장
      localStorage.setItem('userId', String(userId));
      localStorage.setItem('username', username);
      localStorage.setItem('userEmail', email);
      localStorage.setItem('balance', String(balance));
      localStorage.setItem('provider', provider);
      // Google 프로필 사진 저장
      if (googlePicture) {
        localStorage.setItem('userAvatar', googlePicture);
      }
      localStorage.setItem('authToken', accessToken);
      localStorage.removeItem('mockLogin'); // 모의 로그인 표시 제거

      // Socket 연결
      connect(String(userId));

      // 저장된 이동 파라미터 읽기
      const savedRedirectTarget = localStorage.getItem('oauth_redirect_target');
      const savedMachineId = localStorage.getItem('oauth_redirect_machineId');
      
      // 저장된 파라미터 삭제
      localStorage.removeItem('oauth_redirect_target');
      localStorage.removeItem('oauth_redirect_machineId');

      // 저장된 파라미터에 따라 이동 대상 결정
      let targetPath = '/mypage'; // 기본값은 My Page로 이동
      if (savedRedirectTarget === 'game' && savedMachineId) {
        targetPath = `/game/${savedMachineId}`;
      } else if (savedRedirectTarget === 'mypage') {
        targetPath = '/mypage';
      }

      // 대상 페이지로 이동
      console.log('[OAuth Callback] 이동:', targetPath);
      navigate(targetPath);
    } catch (err) {
      console.error('[OAuth Callback] ❌ 로그인 처리 오류:', err);
      if (err instanceof Error) {
        console.error('[OAuth Callback] 오류 상세:', err.message);
        console.error('[OAuth Callback] 오류 스택:', err.stack);
        
        // 오류 메시지 표시 개선
        let errorMessage = err.message;
        if (err.message.includes('Invalid CORS request')) {
          errorMessage = 'Invalid CORS request: Google Cloud Console 설정을 확인하세요\n\n' +
            '1. Google Cloud Console (https://console.cloud.google.com) 열기\n' +
            '2. "APIs & Services" > "Credentials"로 이동\n' +
            '3. OAuth 2.0 Client ID 찾기\n' +
            '4. "Authorized JavaScript origins"에 추가: http://localhost:3000\n' +
            '5. "Authorized redirect URIs"에 추가: http://localhost:3000/oauth/callback/google\n' +
            '6. 변경사항 저장 후 몇 분 기다리기';
        }
        
        alert(`Google 로그인 실패: ${errorMessage}`);
      } else {
        console.error('[OAuth Callback] 알 수 없는 오류:', err);
        alert('Google 로그인 실패, 다시 시도하세요');
      }
      navigate('/login');
    }
  };

  return (
    <div className="oauth-callback-page">
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>正在处理登录...</p>
      </div>
    </div>
  );
};

export default OAuthCallbackPage;

