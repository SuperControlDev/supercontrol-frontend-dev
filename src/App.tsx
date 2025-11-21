import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';
import './App.css';

const App: React.FC = () => {
  return (
    <SocketProvider>
      <div className="app">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/game/:machineId" element={<GamePage />} />
        </Routes>
      </div>
    </SocketProvider>
  );
};

export default App;

