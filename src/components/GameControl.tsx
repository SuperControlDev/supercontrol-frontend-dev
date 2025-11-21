import React from 'react';
import './GameControl.css';

interface GameControlProps {
  onMove: (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => void;
  onDrop: () => void;
  onGrab: () => void;
  disabled?: boolean;
}

const GameControl: React.FC<GameControlProps> = ({ onMove, onDrop, onGrab, disabled = false }) => {
  const handleMove = (direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward') => {
    if (!disabled) {
      onMove(direction);
    }
  };

  return (
    <div className="game-control">
      <h3>제어판</h3>
      
      <div className="control-grid">
        {/* 방향 제어 - 상하좌우 */}
        <div className="direction-control">
          <button
            className="control-button"
            onClick={() => handleMove('forward')}
            disabled={disabled}
            title="앞으로"
          >
            ↑
          </button>
          <div className="horizontal-controls">
            <button
              className="control-button"
              onClick={() => handleMove('left')}
              disabled={disabled}
              title="왼쪽으로"
            >
              ←
            </button>
            <div className="control-center">방향</div>
            <button
              className="control-button"
              onClick={() => handleMove('right')}
              disabled={disabled}
              title="오른쪽으로"
            >
              →
            </button>
          </div>
          <button
            className="control-button"
            onClick={() => handleMove('backward')}
            disabled={disabled}
            title="뒤로"
          >
            ↓
          </button>
        </div>

        {/* 높이 제어 - 상하 */}
        <div className="height-control">
          <button
            className="control-button large"
            onClick={() => handleMove('up')}
            disabled={disabled}
            title="상승"
          >
            ⬆ 상승
          </button>
          <button
            className="control-button large"
            onClick={() => handleMove('down')}
            disabled={disabled}
            title="하강"
          >
            ⬇ 하강
          </button>
        </div>

        {/* 동작 제어 */}
        <div className="action-control">
          <button
            className="control-button action-button grab"
            onClick={onGrab}
            disabled={disabled}
            title="잡기"
          >
            🦾 잡기
          </button>
          <button
            className="control-button action-button drop"
            onClick={onDrop}
            disabled={disabled}
            title="놓기"
          >
            🎯 놓기
          </button>
        </div>
      </div>

      {disabled && (
        <div className="control-disabled-message">
          <p>게임이 시작되지 않았거나 종료되었습니다</p>
        </div>
      )}
    </div>
  );
};

export default GameControl;

