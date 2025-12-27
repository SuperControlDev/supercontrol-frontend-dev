import React, { useEffect } from 'react';
import './GameResultModal.css';

interface GameResultModalProps {
  isOpen: boolean;
  result: 'SUCCESS' | 'FAIL';
  onClose: () => void;
}

const GameResultModal: React.FC<GameResultModalProps> = ({ isOpen, result, onClose }) => {
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

  const isSuccess = result === 'SUCCESS';

  return (
    <div className="game-result-modal-overlay" onClick={onClose}>
      <div className="game-result-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`game-result-modal-content ${isSuccess ? 'success' : 'fail'}`}>
          {/* 图标区域 */}
          <div className="game-result-icon">
            {isSuccess ? (
              <div className="success-icon">
                <svg viewBox="0 0 100 100" className="checkmark">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                  <path
                    d="M 30 50 L 45 65 L 70 35"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            ) : (
              <div className="fail-icon">
                <svg viewBox="0 0 100 100" className="cross">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" />
                  <path
                    d="M 35 35 L 65 65 M 65 35 L 35 65"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* 标题 */}
          <h2 className="game-result-title">
            {isSuccess ? '🎉 게임 성공! 🎉' : '게임 실패'}
          </h2>

          {/* 消息 */}
          <p className="game-result-message">
            {isSuccess
              ? '축하합니다! 게임을 성공적으로 완료했습니다.'
              : (
                <>
                  아쉽게도 게임에 실패했습니다.
                  <br />
                  다시 시도해보세요~
                </>
              )}
          </p>

          {/* 按钮 */}
          <button className="game-result-button" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameResultModal;

