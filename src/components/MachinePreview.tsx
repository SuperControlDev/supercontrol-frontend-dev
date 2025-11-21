import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Machine, MachineStatus } from '@/types/session';
import './MachinePreview.css';

interface MachinePreviewProps {
  machine: Machine;
  onClick?: () => void;
}

const MachinePreview: React.FC<MachinePreviewProps> = ({ machine, onClick }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // TODO: 백엔드에서 비디오 스트림 URL을 가져와 video 요소에 설정
    // 실제로는 백엔드에서 비디오 스트림 URL을 가져와야 함
    // const streamUrl = `ws://localhost:8080/stream/${machine.machineId}`;
  }, [machine.machineId]);

  const handleClick = () => {
    if (machine.status === MachineStatus.AVAILABLE) {
      if (onClick) {
        onClick();
      } else {
        navigate(`/game/${machine.machineId}`);
      }
    }
  };

  return (
    <div
      className={`machine-preview ${machine.status === MachineStatus.AVAILABLE ? 'available' : 'busy'}`}
      onClick={handleClick}
    >
      <div className="preview-video-container">
        <video
          ref={videoRef}
          className="preview-video"
          autoPlay
          playsInline
          muted
          controls={false}
        >
          <source src="" type="video/mp4" />
        </video>
        <div className="preview-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">📹</div>
            <p className="machine-name">{machine.name}</p>
            <div className="machine-status-badge">
              {machine.status === MachineStatus.AVAILABLE ? '🟢 대기 중' : '🔴 사용 중'}
            </div>
          </div>
        </div>
      </div>
      <div className="preview-overlay">
        <div className="preview-info">
          <h3>{machine.name}</h3>
          <span className={`status-indicator ${machine.status === MachineStatus.AVAILABLE ? 'available' : 'busy'}`}>
            {machine.status === MachineStatus.AVAILABLE ? '대기 중' : '사용 중'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MachinePreview;

