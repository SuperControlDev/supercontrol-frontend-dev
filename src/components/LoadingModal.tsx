import React, { useEffect } from 'react';
import './LoadingModal.css';

interface LoadingModalProps {
  isOpen: boolean;
  title?: string; // 自定义标题
  message?: string;
  onClose?: () => void; // 关闭回调
}

const LoadingModal: React.FC<LoadingModalProps> = ({ 
  isOpen, 
  title,
  message,
  onClose
}) => {
  useEffect(() => {
    if (isOpen) {
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="loading-modal-overlay">
      <div className="loading-modal">
        {/* 关闭按钮 */}
        {onClose && (
          <button 
            className="loading-modal-close" 
            onClick={onClose}
            aria-label="关闭"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path 
                d="M18 6L6 18M6 6L18 18" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        
        {/* Logo/Icon 区域 */}
        <div className="loading-modal-logo">
          <div className="loading-logo-container">
            <div className="loading-logo-square loading-logo-square-1"></div>
            <div className="loading-logo-square loading-logo-square-2"></div>
            <div className="loading-logo-square loading-logo-square-3"></div>
            <div className="loading-logo-square loading-logo-square-4"></div>
            <div className="loading-logo-square loading-logo-square-5"></div>
          </div>
        </div>

        {/* 标题 */}
        <h2 className="loading-modal-title">{title || '게임 준비 중'}</h2>

        {/* 消息 */}
        {message && <p className="loading-modal-message">{message}</p>}

        {/* 加载动画 */}
        <div className="loading-spinner">
          <div className="spinner-circle"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingModal;

