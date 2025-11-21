import React, { useEffect, useRef } from 'react';
import './GameVideo.css';

interface GameVideoProps {
  machineId: string;
}

const GameVideo: React.FC<GameVideoProps> = ({ machineId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // TODO: 백엔드에서 비디오 스트림 URL을 가져와 video 요소에 설정
    // 여기서는 먼저 플레이스홀더 사용
    if (videoRef.current) {
      // 실제로는 백엔드에서 비디오 스트림 URL을 가져와야 함
      // const streamUrl = `ws://localhost:8080/stream/${machineId}`;
      // 또는 HLS/DASH 등의 스트리밍 프로토콜 사용
    }
  }, [machineId]);

  return (
    <div className="game-video">
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-stream"
          autoPlay
          playsInline
          muted
          controls={false}
        >
          <source src="" type="video/mp4" />
          브라우저가 비디오 재생을 지원하지 않습니다
        </video>
        <div className="video-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">📹</div>
            <p>비디오 스트림 로딩 중...</p>
            <p className="machine-id">기계 ID: {machineId}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameVideo;

