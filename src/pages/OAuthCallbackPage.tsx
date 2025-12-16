import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '@/contexts/SocketContext';
import './OAuthCallbackPage.css';

const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { connect } = useSocket();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('[OAuth Callback] 开始处理回调...');
        console.log('[OAuth Callback] 当前 URL:', window.location.href);
        console.log('[OAuth Callback] URL Hash:', window.location.hash);
        console.log('[OAuth Callback] URL Search:', window.location.search);
        
        // Implicit flow: access_token 在 URL hash (#) 中，而不是 query string (?)
        // 需要从 hash 中解析参数
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);
        
        // 优先从 hash 中获取（implicit flow），如果没有则从 query string 获取
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token') || searchParams.get('access_token');
        const error = hashParams.get('error') || queryParams.get('error') || searchParams.get('error');
        const code = hashParams.get('code') || queryParams.get('code') || searchParams.get('code');
        
        console.log('[OAuth Callback] 解析的参数:', { accessToken: accessToken ? '已找到' : '未找到', error, code: code ? '已找到' : '未找到' });

        if (error) {
          console.error('[OAuth Callback] Google 返回错误:', error);
          const errorDescription = hashParams.get('error_description') || queryParams.get('error_description') || '';
          alert(`Google 登录失败: ${error}${errorDescription ? '\n' + errorDescription : ''}`);
          navigate('/login');
          return;
        }

        if (accessToken) {
          // Implicit flow: 直接有 access_token
          console.log('[OAuth Callback] ✅ 收到 access_token');
          await handleGoogleLoginSuccess(accessToken);
        } else if (code) {
          // Authorization code flow: 需要交换 token
          console.log('[OAuth Callback] 收到 authorization code');
          alert('Authorization code flow 暂未实现，请使用 implicit flow');
          navigate('/login');
        } else {
          console.error('[OAuth Callback] ❌ 未找到 token 或 code');
          console.error('[OAuth Callback] Hash 参数:', Object.fromEntries(hashParams));
          console.error('[OAuth Callback] Query 参数:', Object.fromEntries(queryParams));
          alert('OAuth 回调参数无效，请检查 URL 是否正确');
          navigate('/login');
        }
      } catch (err) {
        console.error('[OAuth Callback] ❌ 处理错误:', err);
        if (err instanceof Error) {
          console.error('[OAuth Callback] 错误详情:', err.message, err.stack);
          alert(`登录处理失败: ${err.message}`);
        } else {
          alert('登录处理失败，请重试');
        }
        navigate('/login');
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  const handleGoogleLoginSuccess = async (accessToken: string) => {
    try {
      console.log('[OAuth Callback] 开始获取用户信息...');
      console.log('[OAuth Callback] Access Token:', accessToken.substring(0, 20) + '...');
      
      // 使用 Vite 代理调用 Google API（避免 CORS 问题）
      console.log('[OAuth Callback] 通过代理调用 Google API 获取用户信息...');
      let userInfoResponse;
      try {
        // 使用本地代理路径，Vite 会转发到 Google API
        userInfoResponse = await fetch('/google-api/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        console.log('[OAuth Callback] Google API 响应状态:', userInfoResponse.status);
      } catch (fetchError) {
        console.error('[OAuth Callback] Google API 请求失败:', fetchError);
        // 改进错误处理：检查是否是网络错误或 CORS 错误
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          throw new Error('网络连接失败，请检查网络连接或尝试刷新页面');
        }
        if (fetchError instanceof Error && (fetchError.message.includes('CORS') || fetchError.message.includes('cors'))) {
          throw new Error('获取用户信息时发生 CORS 错误，请检查网络连接');
        }
        throw fetchError;
      }

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        console.error('[OAuth Callback] Google API 错误响应:', errorText);
        
        // 检查是否是 "Invalid CORS request" 错误
        if (errorText.includes('Invalid CORS request') || errorText.includes('CORS')) {
          throw new Error('Invalid CORS request: 请检查 Google Cloud Console 中的 "Authorized JavaScript origins" 配置，确保包含当前域名');
        }
        
        // 尝试解析 JSON 错误响应
        let errorMessage = `获取用户信息失败 (${userInfoResponse.status})`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorData.error_description || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const userInfo = await userInfoResponse.json();
      console.log('[OAuth Callback] Google 用户信息:', userInfo);

      // 构建 providerUserId (格式: google_{google_user_id})
      const providerUserId = `google_${userInfo.id}`;
      console.log('[OAuth Callback] Provider User ID:', providerUserId);

      // 调用后端 OAuth 登录 API
      // POST /api/auth/google
      // Request Body: { "providerUserId": "google_12345" }
      const backendApiUrl = import.meta.env.VITE_API_URL || '';
      const apiUrl = backendApiUrl ? `${backendApiUrl}/api/auth/google` : '/api/auth/google';
      
      console.log('[OAuth Callback] 调用后端 API:', apiUrl);
      console.log('[OAuth Callback] 请求体:', { providerUserId });
      
      let backendResponse;
      try {
        backendResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            providerUserId: providerUserId,
          }),
        });
        console.log('[OAuth Callback] 后端 API 响应状态:', backendResponse.status);
      } catch (fetchError) {
        console.error('[OAuth Callback] 后端 API 请求失败:', fetchError);
        // 改进错误处理
        if (fetchError instanceof TypeError && fetchError.message.includes('Failed to fetch')) {
          throw new Error('网络连接失败，无法连接到后端服务器，请检查网络连接');
        }
        if (fetchError instanceof Error && (fetchError.message.includes('CORS') || fetchError.message.includes('cors'))) {
          throw new Error('调用后端 API 时发生 CORS 错误，请检查后端 CORS 配置');
        }
        throw fetchError;
      }

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text();
        console.error('[OAuth Callback] 后端 API 错误响应:', errorText);
        let errorMessage = `后端登录失败 (${backendResponse.status})`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('[OAuth Callback] 后端错误详情:', errorData);
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        // 检查是否是数据库配置错误
        if (errorText.includes("Field 'user_id' doesn't have a default value") || 
            errorText.includes("user_id") && errorText.includes("default value")) {
          errorMessage = '数据库配置错误：user_id 字段需要设置为 AUTO_INCREMENT。\n\n' +
            '请后端开发人员检查数据库表 t_l_users 的 user_id 字段配置：\n' +
            '1. 确保 user_id 字段设置为 AUTO_INCREMENT\n' +
            '2. 或者确保 user_id 字段有默认值\n' +
            '3. 或者修改后端代码，在插入时提供 user_id 值';
        }
        
        throw new Error(errorMessage);
      }

      // 解析后端返回的用户信息
      const backendData = await backendResponse.json();
      console.log('[OAuth Callback] 后端返回的用户信息:', backendData);

      // 使用后端返回的用户信息（如果后端没有返回完整信息，使用 Google API 返回的信息）
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
      localStorage.setItem('authToken', accessToken);
      localStorage.removeItem('mockLogin'); // 移除模拟登录标记

      // Socket 连接
      connect(String(userId));

      // 跳转到游戏页面
      const defaultMachine = '1'; // 默认机器 ID
      console.log('[OAuth Callback] 跳转到游戏页面:', `/game/${defaultMachine}`);
      navigate(`/game/${defaultMachine}`);
    } catch (err) {
      console.error('[OAuth Callback] ❌ 登录处理错误:', err);
      if (err instanceof Error) {
        console.error('[OAuth Callback] 错误详情:', err.message);
        console.error('[OAuth Callback] 错误堆栈:', err.stack);
        
        // 改进错误消息显示
        let errorMessage = err.message;
        if (err.message.includes('Invalid CORS request')) {
          errorMessage = 'Invalid CORS request: 请检查 Google Cloud Console 配置\n\n' +
            '1. 打开 Google Cloud Console (https://console.cloud.google.com)\n' +
            '2. 进入 "APIs & Services" > "Credentials"\n' +
            '3. 找到您的 OAuth 2.0 Client ID\n' +
            '4. 在 "Authorized JavaScript origins" 中添加: http://localhost:3000\n' +
            '5. 在 "Authorized redirect URIs" 中添加: http://localhost:3000/oauth/callback/google\n' +
            '6. 保存更改后等待几分钟生效';
        }
        
        alert(`Google 登录失败: ${errorMessage}`);
      } else {
        console.error('[OAuth Callback] 未知错误:', err);
        alert('Google 登录失败，请重试');
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

