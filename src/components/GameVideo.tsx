import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import './GameVideo.css';

interface GameVideoProps {
  machineId: string;
  streamName?: string; // Red5 스트림 이름 (기본값: 'test')
  red5Host?: string; // Red5 호스트 (기본값: localhost)
  red5Port?: number; // Red5 HTTP 포트 (기본값: 5080)
}

const GameVideo: React.FC<GameVideoProps> = ({ 
  machineId, 
  streamName = 'test',
  red5Host = 'localhost',
  red5Port = 5080 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // HTTP 상태 코드 확인 함수
  const checkStreamAvailability = async (url: string): Promise<{ available: boolean; status?: number; message?: string }> => {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      console.log('[HLS Player] HTTP 상태 코드:', response.status, response.statusText);
      
      if (response.status === 200 || response.status === 206) {
        return { available: true, status: response.status };
      } else if (response.status === 503) {
        return { 
          available: false, 
          status: 503, 
          message: 'Red5 서버가 일시적으로 사용할 수 없습니다 (503). 서버가 실행 중인지 확인하세요.' 
        };
      } else if (response.status === 404) {
        return { 
          available: false, 
          status: 404, 
          message: '스트림을 찾을 수 없습니다 (404). OBS가 올바른 스트림 이름으로推流 중인지 확인하세요.' 
        };
      } else if (response.status === 403) {
        return { 
          available: false, 
          status: 403, 
          message: '스트림 접근이 거부되었습니다 (403). Red5 권한 설정을 확인하세요.' 
        };
      } else {
        return { 
          available: false, 
          status: response.status, 
          message: `HTTP 오류: ${response.status} ${response.statusText}` 
        };
      }
    } catch (err) {
      console.error('[HLS Player] URL 확인 실패:', err);
      return { 
        available: false, 
        message: `연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}` 
      };
    }
  };

  // 가능한 HLS URL 패턴 생성
  const generatePossibleUrls = (host: string, port: number, name: string): string[] => {
    return [
      `http://${host}:${port}/live/${name}/playlist.m3u8`,  // 표준 형식
      `http://${host}:${port}/live/${name}.m3u8`,            // 간단한 형식
      `http://${host}:${port}/hls/${name}/playlist.m3u8`,    // HLS 폴더 형식
      `http://${host}:${port}/hls/${name}.m3u8`,             // HLS 직접 형식
      `http://${host}:${port}/${name}/playlist.m3u8`,        // 루트 직접 형식
      `http://${host}:${port}/${name}.m3u8`,                 // 루트 간단 형식
      `http://${host}:${port}/live/${name}/index.m3u8`,      // index 형식
      `http://${host}:${port}/streams/${name}/playlist.m3u8`, // streams 폴더 형식
    ];
  };

  // 여러 URL 패턴 중 사용 가능한 URL 찾기
  const findAvailableUrl = async (urls: string[]): Promise<{ url: string | null; status?: number; message?: string }> => {
    for (const url of urls) {
      console.log('[HLS Player] URL 테스트:', url);
      const availability = await checkStreamAvailability(url);
      if (availability.available) {
        console.log('[HLS Player] 사용 가능한 URL 발견:', url);
        return { url };
      }
      // 404가 아닌 다른 오류는 즉시 반환
      if (availability.status && availability.status !== 404) {
        return { url: null, status: availability.status, message: availability.message };
      }
    }
    return { url: null, status: 404, message: '모든 URL 패턴을 시도했지만 스트림을 찾을 수 없습니다.' };
  };

  // 네트워크 오류 처리 함수
  const handleNetworkError = (hls: Hls) => {
    console.error('[HLS Player] 네트워크 오류, 재시도 중...');
    // 不显示错误，保持加载状态
    setError(null);
    setIsLoading(true);
    
    setTimeout(() => {
      if (hlsRef.current && hlsRef.current === hls) {
        try {
          hls.startLoad();
        } catch (err) {
          console.error('[HLS Player] 재시도 실패:', err);
          connectStream();
        }
      } else {
        connectStream();
      }
    }, 2000);
  };

  // 스트림 연결 함수
  const connectStream = async () => {
    const video = videoRef.current;
    if (!video) return;

    console.log('[HLS Player] Red5 설정:', { red5Host, red5Port, streamName });
    setIsLoading(true);
    setError(null);

    // 가능한 모든 URL 패턴 생성
    const possibleUrls = generatePossibleUrls(red5Host, red5Port, streamName);
    console.log('[HLS Player] 테스트할 URL 목록:', possibleUrls);

    // 사용 가능한 URL 찾기
    const result = await findAvailableUrl(possibleUrls);
    
    if (!result.url) {
      // 不显示错误，保持加载状态并继续重试
      setIsLoading(true);
      setError(null);
      // 延迟后重试
      setTimeout(() => {
        connectStream();
      }, 3000);
      return;
    }

    const hlsUrl = result.url;
    console.log('[HLS Player] 사용할 URL:', hlsUrl);

    // HLS.js를 사용하여 스트림 재생
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS Player] 매니페스트 파싱 완료');
        setIsLoading(false);
        setError(null);
        
        video.play().catch((err) => {
          console.error('[HLS Player] 자동 재생 실패:', err);
          // 不显示错误，保持加载状态
          setError(null);
          setIsLoading(true);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[HLS Player] HLS 오류:', data);
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS Player] 네트워크 오류:', data);
              handleNetworkError(hls);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS Player] 미디어 오류:', data);
              hls.recoverMediaError();
              break;
            default:
              console.error('[HLS Player] 치명적 오류, 재생 중단');
              // 不显示错误，保持加载状态并重试
              setError(null);
              setIsLoading(true);
              // 延迟后重试
              setTimeout(() => {
                connectStream();
              }, 3000);
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

      video.addEventListener('waiting', () => {
        setIsLoading(true);
      });

      video.addEventListener('playing', () => {
        setIsLoading(false);
        setError(null);
      });

      video.addEventListener('error', () => {
        const videoError = video.error;
        console.error('[HLS Player] 비디오 오류');
        if (videoError) {
          console.error('[HLS Player] 비디오 오류 코드:', videoError.code);
          console.error('[HLS Player] 비디오 오류 메시지:', videoError.message);
        }
        // 不显示错误，保持加载状态并重试
        setError(null);
        setIsLoading(true);
        // 延迟后重试
        setTimeout(() => {
          connectStream();
        }, 3000);
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari 등 네이티브 HLS 지원 브라우저
      console.log('[HLS Player] 네이티브 HLS 지원 사용');
      video.src = hlsUrl;
      video.addEventListener('loadedmetadata', () => {
        setIsLoading(false);
        setError(null);
        video.play().catch((err) => {
          console.error('[HLS Player] 자동 재생 실패:', err);
          // 不显示错误，保持加载状态
          setError(null);
          setIsLoading(true);
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
        }
        // 不显示错误，保持加载状态并重试
        setError(null);
        setIsLoading(true);
        // 延迟后重试
        setTimeout(() => {
          connectStream();
        }, 3000);
      });
    } else {
      // HLS 미지원
      console.error('[HLS Player] HLS를 지원하지 않는 브라우저입니다.');
      // 不显示错误，保持加载状态
      setError(null);
      setIsLoading(true);
    }
  };

  useEffect(() => {
    connectStream();
    
    // 클린업 함수
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [machineId, streamName, red5Host, red5Port]);

  const handleVideoClick = () => {
    const video = videoRef.current;
    if (!video) return;

    // 尝试播放
    video.play().catch((err) => {
      console.error('[HLS Player] 수동 재생 실패:', err);
    });
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
        {isLoading && (
          <div className="video-placeholder">
            <div className="placeholder-content">
              <div className="placeholder-icon">📹</div>
              <p>비디오 스트림 로딩 중...</p>
              <p className="machine-id">기계 ID: {machineId}</p>
            </div>
          </div>
        )}
        {isPlaying && (
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
