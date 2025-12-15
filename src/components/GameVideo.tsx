import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import './GameVideo.css';

interface GameVideoProps {
  machineId: string;
  streamName?: string; // Red5 스트림 이름 (기본값: 'test')
  red5Port?: number; // Red5 HTTP 포트 (기본값: 5080)
}

const GameVideo: React.FC<GameVideoProps> = ({ 
  machineId, 
  streamName = 'test',
  red5Port = 5080 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Red5 HLS 스트림 URL 구성
    // RTMP: rtmp://localhost:1935/live/test
    // HLS: http://localhost:5080/live/test/playlist.m3u8
    const hlsUrl = `http://localhost:${red5Port}/live/${streamName}/playlist.m3u8`;
    
    console.log('[HLS Player] 스트림 URL:', hlsUrl);

    // HLS.js를 사용하여 스트림 재생
    if (Hls.isSupported()) {
      // HLS.js 지원 브라우저
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS Player] 매니페스트 파싱 완료, 재생 시작');
        setIsLoading(false);
        setError(null);
        video.play().catch((err) => {
          console.error('[HLS Player] 자동 재생 실패:', err);
          setError('자동 재생이 차단되었습니다. 비디오를 클릭하여 재생하세요.');
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[HLS Player] HLS 오류:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS Player] 네트워크 오류, 재시도 중...');
              setError(`네트워크 오류: ${hlsUrl}에 연결할 수 없습니다. Red5 서버가 실행 중인지 확인하세요.`);
              // 3초 후 재시도
              setTimeout(() => {
                console.log('[HLS Player] 재시도 중...');
                hls.startLoad();
              }, 3000);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS Player] 미디어 오류, 복구 시도 중...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HLS Player] 치명적 오류, 재생 중단');
              setError('스트림 재생 실패. 스트림이 시작되었는지 확인하세요.');
              setIsLoading(false);
              hls.destroy();
              break;
          }
        }
      });

      // 비디오 이벤트 리스너
      video.addEventListener('play', () => {
        setIsPlaying(true);
        setIsLoading(false);
        setError(null);
      });

      video.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      video.addEventListener('error', () => {
        const videoError = video.error;
        console.error('[HLS Player] 비디오 오류');
        if (videoError) {
          console.error('[HLS Player] 비디오 오류 코드:', videoError.code);
          console.error('[HLS Player] 비디오 오류 메시지:', videoError.message);
          const errorMessages: { [key: number]: string } = {
            1: 'MEDIA_ERR_ABORTED - 사용자가 중단',
            2: 'MEDIA_ERR_NETWORK - 네트워크 오류',
            3: 'MEDIA_ERR_DECODE - 디코딩 오류',
            4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 미디어 형식 미지원',
          };
          setError(`비디오 재생 오류: ${errorMessages[videoError.code] || videoError.message}`);
        } else {
          setError('비디오 재생 오류가 발생했습니다.');
        }
        setIsLoading(false);
      });

      // 클린업
      return () => {
        if (hls) {
          hls.destroy();
          hlsRef.current = null;
        }
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 등 네이티브 HLS 지원 브라우저
      console.log('[HLS Player] 네이티브 HLS 지원 사용');
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        setError(null);
        video.play().catch((err) => {
          console.error('[HLS Player] 자동 재생 실패:', err);
          setError('자동 재생이 차단되었습니다. 비디오를 클릭하여 재생하세요.');
        });
      });
      video.addEventListener('play', () => {
        setIsPlaying(true);
        setIsLoading(false);
      });
      video.addEventListener('error', () => {
        const videoError = video.error;
        console.error('[HLS Player] 비디오 오류 (네이티브 HLS)');
        if (videoError) {
          console.error('[HLS Player] 비디오 오류 코드:', videoError.code);
          console.error('[HLS Player] 비디오 오류 메시지:', videoError.message);
          const errorMessages: { [key: number]: string } = {
            1: 'MEDIA_ERR_ABORTED - 사용자가 중단',
            2: 'MEDIA_ERR_NETWORK - 네트워크 오류',
            3: 'MEDIA_ERR_DECODE - 디코딩 오류',
            4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - 미디어 형식 미지원',
          };
          setError(`비디오 재생 오류: ${errorMessages[videoError.code] || videoError.message}`);
        } else {
          setError('비디오 재생 오류가 발생했습니다.');
        }
        setIsLoading(false);
      });
    } else {
      // HLS 미지원
      console.error('[HLS Player] HLS를 지원하지 않는 브라우저입니다.');
      setError('이 브라우저는 HLS 스트리밍을 지원하지 않습니다.');
      setIsLoading(false);
    }
  }, [machineId, streamName, red5Port]);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;

    if (error && error.includes('자동 재생')) {
      video.play().catch((err) => {
        console.error('[HLS Player] 수동 재생 실패:', err);
      });
    }
  };

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
          onClick={handleVideoClick}
        />
        {(isLoading || error) && (
          <div className="video-placeholder">
            <div className="placeholder-content">
              <div className="placeholder-icon">📹</div>
              {isLoading && <p>비디오 스트림 로딩 중...</p>}
              {error && (
                <div>
                  <p className="error-text">{error}</p>
                  <p className="stream-info">스트림: {streamName}</p>
                  <p className="stream-info">URL: http://localhost:{red5Port}/live/{streamName}/playlist.m3u8</p>
                </div>
              )}
              {!error && <p className="machine-id">기계 ID: {machineId}</p>}
            </div>
          </div>
        )}
        {isPlaying && !error && (
          <div className="connection-indicator">
            <span className="indicator-dot"></span>
            <span>LIVE</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameVideo;
