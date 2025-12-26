/**
 * Kakao OAuth 回调页面
 * 
 * 实现方案 2: 前端也获取用户信息并发送 providerUserId
 * 
 * 流程:
 * 1. 从 URL 中获取 authorization code
 * 2. 调用后端 API 获取 Kakao 用户信息（尝试多个 API 端点）
 * 3. 从响应中提取 Kakao 用户 ID
 * 4. 构造 providerUserId = "kakao_{kakao_user_id}"
 * 5. 像 Google OAuth 一样，发送 providerUserId 和 username 给后端
 * 6. 处理登录成功后的逻辑
 * 
 * 注意:
 * - 前端无法直接用 code 换取 access_token（需要 client_secret）
 * - 需要后端提供一个中间 API 来获取用户信息
 * - 或者，后端在错误响应中也返回用户信息
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import './KakaoOAuthCallbackPage.css';

const KakaoOAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { connect } = useSocket();
  const [searchParams] = useSearchParams();
  const hasProcessedRef = useRef(false); // 중복 실행 방지 플래그

  useEffect(() => {
    // 이미 처리된 경우 즉시 반환 (React StrictMode 및 중복 실행 방지)
    if (hasProcessedRef.current) {
      console.log('[Kakao OAuth Callback] 이미 콜백 처리 완료, 중복 실행 건너뛰기');
      return;
    }

    const handleKakaoCallback = async () => {
      try {
        // 즉시 플래그 설정하여 중복 실행 방지
        hasProcessedRef.current = true;
        
        console.log('[Kakao OAuth Callback] 콜백 처리 시작...');
        console.log('[Kakao OAuth Callback] 현재 URL:', window.location.href);
        
        // Kakao는 Authorization Code Flow 사용
        // code와 error는 query string에 있음
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        console.log('[Kakao OAuth Callback] 파싱된 파라미터:', { 
          code: code ? '찾음' : '없음', 
          error: error || '없음' 
        });

        if (error) {
          console.error('[Kakao OAuth Callback] Kakao에서 오류 반환:', error);
          // 오류 시 플래그 초기화하여 재시도 허용
          hasProcessedRef.current = false;
          alert(`Kakao 로그인 실패: ${error}${errorDescription ? '\n' + errorDescription : ''}`);
          navigate('/login');
          return;
        }

        if (!code) {
          console.error('[Kakao OAuth Callback] ❌ authorization code를 찾을 수 없음');
          // 오류 시 플래그 초기화하여 재시도 허용
          hasProcessedRef.current = false;
          alert('Kakao OAuth 콜백 파라미터가 유효하지 않습니다. URL을 확인하세요');
          navigate('/login');
          return;
        }

        // Authorization code를 받았으므로 로그인 처리
        console.log('[Kakao OAuth Callback] ✅ authorization code 받음');
        await handleKakaoLoginSuccess(code);
        
      } catch (err) {
        // 오류 시 플래그 초기화하여 재시도 허용
        hasProcessedRef.current = false;
        console.error('[Kakao OAuth Callback] ❌ 처리 오류:', err);
        if (err instanceof Error) {
          console.error('[Kakao OAuth Callback] 오류 상세:', err.message, err.stack);
          alert(`Kakao 로그인 처리 실패: ${err.message}`);
        } else {
          alert('Kakao 로그인 처리 실패, 다시 시도하세요');
        }
        navigate('/login');
      }
    };

    handleKakaoCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  const handleKakaoLoginSuccess = async (code: string) => {
    try {
      console.log('[Kakao OAuth Callback] Kakao 로그인 처리 시작...');
      
      const backendApiUrl = import.meta.env.VITE_API_URL || '';
      const redirectUri = import.meta.env.VITE_KAKAO_REDIRECT_URI || 
        `${window.location.origin}/oauth/callback/kakao`;
      
      // 说明：Kakao OAuth 使用 Authorization Code Flow
      // 前端无法直接用 code 换取 access_token（需要 client_secret）
      // 所以前端无法获取用户信息，无法构造 providerUserId
      // 
      // 解决方案：让后端处理所有逻辑
      // 后端应该：
      // 1. 接收 code 和 redirectUri
      // 2. 用 code + client_secret 换取 access_token
      // 3. 用 access_token 调用 Kakao API 获取用户信息
      // 4. 构造 providerUserId = "kakao_" + id
      // 5. 处理登录逻辑
      //
      // 如果后端期望接收 providerUserId（就像 Google 那样），
      // 需要后端提供一个中间 API 来获取用户信息
      
      // 尝试方案 1: 后端提供中间 API（如果后端支持）
      const userInfoApiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/kakao/userinfo` : '/api/auth/kakao/userinfo';
      let kakaoUserId: string | number | null = null;
      let kakaoUsername: string = '';
      
      console.log('[Kakao OAuth Callback] 尝试方案 1: 调用后端中间 API 获取用户信息...');
      console.log('[Kakao OAuth Callback] 用户信息 API:', userInfoApiUrl);
      
      try {
        const userInfoResponse = await fetch(userInfoApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            redirectUri: redirectUri,
          }),
        });
        
        if (userInfoResponse.ok) {
          const userInfoData = await userInfoResponse.json();
          console.log('[Kakao OAuth Callback] ✅ 用户信息 API 响应:', userInfoData);
          
          // 从响应中提取 Kakao 用户 ID
          kakaoUserId = userInfoData.id || userInfoData.kakaoId || userInfoData.userId;
          kakaoUsername = userInfoData.nickname || userInfoData.username || userInfoData.name || '';
          
          console.log('[Kakao OAuth Callback] 提取的 Kakao 用户 ID:', kakaoUserId);
          console.log('[Kakao OAuth Callback] 提取的 Kakao 用户名:', kakaoUsername);
        } else {
          console.warn('[Kakao OAuth Callback] ⚠️ 用户信息 API 调用失败，尝试从登录 API 获取...');
        }
      } catch (err) {
        console.warn('[Kakao OAuth Callback] ⚠️ 用户信息 API 不存在或调用失败，尝试从登录 API 获取:', err);
      }
      
      // 步骤 2: 如果用户信息 API 不存在或失败，尝试从登录 API 获取
      // 即使登录失败，后端可能也会返回部分用户信息
      if (!kakaoUserId) {
        console.log('[Kakao OAuth Callback] 步骤 2: 从登录 API 获取用户信息...');
        const loginApiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/kakao` : '/api/auth/kakao';
        
        try {
          const loginResponse = await fetch(loginApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: code,
              redirectUri: redirectUri,
            }),
          });
          
          // 即使失败，也尝试从响应中提取信息
          const responseText = await loginResponse.text();
          let responseData: any = null;
          
          try {
            responseData = JSON.parse(responseText);
          } catch {
            // 如果不是 JSON，可能是错误文本
          }
          
          if (responseData) {
            // 尝试从响应中提取用户信息
            kakaoUserId = responseData.id || responseData.kakaoId || responseData.userId;
            kakaoUsername = responseData.nickname || responseData.username || responseData.name || '';
            
            if (kakaoUserId) {
              console.log('[Kakao OAuth Callback] ✅ 从登录 API 响应中提取到用户 ID:', kakaoUserId);
            }
          }
        } catch (err) {
          console.warn('[Kakao OAuth Callback] ⚠️ 登录 API 调用失败:', err);
        }
      }
      
      // 步骤 3: 如果仍然没有用户 ID，尝试从错误响应中提取
      // 或者，直接调用登录 API，即使失败也可能返回部分信息
      if (!kakaoUserId) {
        console.log('[Kakao OAuth Callback] 步骤 3: 尝试从登录 API 错误响应中提取用户信息...');
        
        // 直接调用登录 API，即使失败也尝试从响应中提取信息
        const loginApiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/kakao` : '/api/auth/kakao';
        
        try {
          const testResponse = await fetch(loginApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: code,
              redirectUri: redirectUri,
            }),
          });
          
          const responseText = await testResponse.text();
          console.log('[Kakao OAuth Callback] 登录 API 响应文本:', responseText.substring(0, 500));
          
          // 尝试从响应中提取用户信息（即使失败也可能包含）
          try {
            const responseData = JSON.parse(responseText);
            kakaoUserId = responseData.id || responseData.kakaoId || responseData.userId || responseData.kakaoUserId;
            kakaoUsername = responseData.nickname || responseData.username || responseData.name || kakaoUsername;
            
            if (kakaoUserId) {
              console.log('[Kakao OAuth Callback] ✅ 从错误响应中提取到用户 ID:', kakaoUserId);
            }
          } catch {
            // 如果不是 JSON，尝试从错误文本中提取（如果后端在错误中也返回了信息）
            console.warn('[Kakao OAuth Callback] ⚠️ 响应不是 JSON 格式');
          }
        } catch (err) {
          console.warn('[Kakao OAuth Callback] ⚠️ 测试调用失败:', err);
        }
      }
      
      // 如果仍然没有用户 ID，使用备用方案：直接发送 code 给后端
      // 让后端自己处理所有逻辑（虽然这不是最优方案，但至少可以工作）
      if (!kakaoUserId) {
        console.warn('[Kakao OAuth Callback] ⚠️ 无法获取 Kakao 用户信息');
        console.warn('[Kakao OAuth Callback] 使用备用方案: 直接发送 code 给后端，让后端处理所有逻辑');
        console.warn('[Kakao OAuth Callback] 注意: 这需要后端能够从 code 中获取用户信息并构造 providerUserId');
        console.warn('[Kakao OAuth Callback] 如果后端仍然报错 providerUserId null，请检查后端代码');
        
        // 备用方案：直接发送 code，让后端处理
        const fallbackApiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/kakao` : '/api/auth/kakao';
        console.log('[Kakao OAuth Callback] 备用方案: 调用后端 API，只发送 code 和 redirectUri');
        
        const fallbackResponse = await fetch(fallbackApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code,
            redirectUri: redirectUri,
          }),
        });
        
        if (!fallbackResponse.ok) {
          const errorText = await fallbackResponse.text();
          console.error('[Kakao OAuth Callback] ❌ 备用方案也失败了:', errorText);
          
          let errorMessage = `백엔드 로그인 실패 (${fallbackResponse.status})`;
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          
          // 提供更详细的错误信息和解决方案
          throw new Error(
            `Kakao 로그인 실패:\n\n` +
            `문제: 前端无法获取用户信息，后端也无法处理 code\n\n` +
            `해결 방법 (2가지 중 선택):\n\n` +
            `방법 1 (권장): 백엔드 수정\n` +
            `- 백엔드가 code를 받아서:\n` +
            `  1. access_token 교환\n` +
            `  2. Kakao API로 사용자 정보 가져오기\n` +
            `  3. providerUserId = "kakao_{id}" 구성\n` +
            `  4. 로그인 처리\n\n` +
            `방법 2: 백엔드에 중간 API 추가\n` +
            `- POST /api/auth/kakao/userinfo\n` +
            `- code를 받아서 사용자 정보만 반환\n` +
            `- 프론트엔드가 providerUserId 구성 후 다시 전송\n\n` +
            `상세 오류: ${errorMessage}`
          );
        }
        
        // 备用方案成功，直接使用响应并继续处理
        const backendData = await fallbackResponse.json();
        console.log('[Kakao OAuth Callback] ✅ 备用方案成功，后端处理完成');
        
        // 继续执行后续的登录成功处理逻辑（跳转到下面的代码）
        // 注意：这里不 return，让代码继续执行到步骤 6
        // 但我们需要跳过步骤 4 和 5，直接使用 backendData
        // 所以我们需要重构代码结构，或者在这里直接处理
        
        // 临时方案：直接在这里处理登录成功逻辑
        const userId = backendData.userId || backendData.id;
        if (!userId) {
          throw new Error('백엔드에서 사용자 ID를 반환하지 않았습니다.');
        }
        
        const username = backendData.username || backendData.nickname || backendData.name || 'Kakao User';
        const email = backendData.email || '';
        const balance = backendData.balance || 0;
        const provider = backendData.provider || 'kakao';
        const kakaoProfileImage = backendData.profileImage || backendData.profile_image || '';
        
        // 保存用户信息
        localStorage.setItem('userId', String(userId));
        localStorage.setItem('username', username);
        if (email) localStorage.setItem('userEmail', email);
        localStorage.setItem('balance', String(balance));
        localStorage.setItem('provider', provider);
        if (kakaoProfileImage) localStorage.setItem('userAvatar', kakaoProfileImage);
        if (backendData.token || backendData.accessToken) {
          localStorage.setItem('authToken', backendData.token || backendData.accessToken);
        }
        localStorage.removeItem('mockLogin');
        
        // Socket 연결
        connect(String(userId));
        
        // 导航
        const savedRedirectTarget = localStorage.getItem('oauth_redirect_target');
        const savedMachineId = localStorage.getItem('oauth_redirect_machineId');
        localStorage.removeItem('oauth_redirect_target');
        localStorage.removeItem('oauth_redirect_machineId');
        
        let targetPath = '/mypage';
        if (savedRedirectTarget === 'game' && savedMachineId) {
          targetPath = `/game/${savedMachineId}`;
        } else if (savedRedirectTarget === 'mypage') {
          targetPath = '/mypage';
        }
        
        console.log('[Kakao OAuth Callback] 이동:', targetPath);
        navigate(targetPath);
        return; // 备用方案完成，直接返回
      }
      
      // 步骤 4: 构造 providerUserId（格式: kakao_{kakao_user_id}）
      const providerUserId = `kakao_${kakaoUserId}`;
      const requestUsername = kakaoUsername || 'Kakao User'; // 用于发送给后端的用户名
      
      console.log('[Kakao OAuth Callback] ✅ 构造 providerUserId:', providerUserId);
      console.log('[Kakao OAuth Callback] ✅ requestUsername:', requestUsername);
      
      // 步骤 5: 像 Google OAuth 一样，发送 providerUserId 和 username 给后端
      console.log('[Kakao OAuth Callback] 步骤 5: 发送 providerUserId 和 username 给后端...');
      const finalApiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/kakao` : '/api/auth/kakao';
      
      const finalResponse = await fetch(finalApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerUserId: providerUserId,
          username: requestUsername, // 使用 requestUsername
          code: code, // code 也一起发送（后端可能需要）
          redirectUri: redirectUri,
        }),
      });
      
      console.log('[Kakao OAuth Callback] 最终 API 响应状态:', finalResponse.status);
      
      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error('[Kakao OAuth Callback] ❌ 最终 API 调用失败:', errorText);
        
        let errorMessage = `백엔드 로그인 실패 (${finalResponse.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      // 步骤 6: 解析最终响应
      const backendData = await finalResponse.json();
      console.log('[Kakao OAuth Callback] ✅ 백엔드에서 반환된 사용자 정보:', backendData);
      console.log('[Kakao OAuth Callback] 응답 데이터 구조:', {
        userId: backendData.userId,
        id: backendData.id,
        kakaoId: backendData.kakaoId,
        providerUserId: backendData.providerUserId,
        username: backendData.username,
        nickname: backendData.nickname,
        email: backendData.email,
        provider: backendData.provider,
        profileImage: backendData.profileImage,
        profile_image: backendData.profile_image,
        balance: backendData.balance,
      });

      // 백엔드에서 반환된 사용자 정보 사용
      const userId = backendData.userId || backendData.id;
      if (!userId) {
        console.error('[Kakao OAuth Callback] ❌ userId가 없습니다. 백엔드 응답:', backendData);
        throw new Error('백엔드에서 사용자 ID를 반환하지 않았습니다. 백엔드 로그를 확인하세요.');
      }
      
      const username = backendData.username || backendData.nickname || backendData.name || 'Kakao User';
      if (!username || username === 'null') {
        console.warn('[Kakao OAuth Callback] ⚠️ username이 null이거나 없습니다. 기본값 사용:', username);
      }
      
      const email = backendData.email || '';
      const balance = backendData.balance || 0;
      const provider = backendData.provider || 'kakao';
      const kakaoProfileImage = backendData.profileImage || backendData.profile_image || '';
      
      console.log('[Kakao OAuth Callback] 파싱된 사용자 정보:', {
        userId,
        username,
        email: email || '없음',
        balance,
        provider,
        profileImage: kakaoProfileImage || '없음',
      });

      // localStorage에 사용자 정보 저장
      localStorage.setItem('userId', String(userId));
      localStorage.setItem('username', username);
      if (email) {
        localStorage.setItem('userEmail', email);
      }
      localStorage.setItem('balance', String(balance));
      localStorage.setItem('provider', provider);
      // Kakao 프로필 사진 저장
      if (kakaoProfileImage) {
        localStorage.setItem('userAvatar', kakaoProfileImage);
      }
      // 백엔드에서 반환한 토큰 저장 (있는 경우)
      if (backendData.token || backendData.accessToken) {
        localStorage.setItem('authToken', backendData.token || backendData.accessToken);
      }
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
      console.log('[Kakao OAuth Callback] 이동:', targetPath);
      navigate(targetPath);
      
    } catch (err) {
      console.error('[Kakao OAuth Callback] ❌ 로그인 처리 오류:', err);
      if (err instanceof Error) {
        console.error('[Kakao OAuth Callback] 오류 상세:', err.message);
        console.error('[Kakao OAuth Callback] 오류 스택:', err.stack);
        alert(`Kakao 로그인 실패: ${err.message}`);
      } else {
        console.error('[Kakao OAuth Callback] 알 수 없는 오류:', err);
        alert('Kakao 로그인 실패, 다시 시도하세요');
      }
      navigate('/login');
    }
  };

  return (
    <div className="oauth-callback-page">
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Kakao 로그인 처리 중...</p>
      </div>
    </div>
  );
};

export default KakaoOAuthCallbackPage;

