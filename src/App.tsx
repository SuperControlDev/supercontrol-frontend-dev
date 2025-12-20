import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { SocketProvider } from './contexts/SocketContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import MyPage from './pages/MyPage';
import './App.css';

// Google OAuth Client ID (从环境变量读取)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const App: React.FC = () => {
  // 如果没有设置 Google Client ID，显示警告但继续运行（使用模拟登录）
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.trim() === '') {
    console.warn('[App] VITE_GOOGLE_CLIENT_ID 未设置，Google 登录将使用模拟模式');
  } else {
    console.log('[App] Google OAuth Client ID 已配置:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'dummy-client-id'}>
      <SocketProvider>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/oauth/callback/google" element={<OAuthCallbackPage />} />
            <Route path="/game/:machineId" element={<GamePage />} />
            <Route path="/mypage" element={<MyPage />} />
          </Routes>
        </div>
      </SocketProvider>
    </GoogleOAuthProvider>
  );
};

export default App;

