import React, { useEffect, useRef, useState } from 'react';
import './WebRTCPlayer.css';
import type { RTCSubscriber, Red5ProSubscriberConfig } from '@/types/red5pro';

interface WebRTCPlayerProps {
  machineId: string;
  sessionId?: number; // long 类型
  streamUrl?: string; // WebRTC流URL (예: http://localhost:5080/live/webrtc.html?app=live&streamName=mystream)
  app?: string; // Red5应用名称 (기본값: live)
  streamName?: string; // 流名称 (기본값: mystream)
  red5Host?: string; // Red5 호스트 (기본값: localhost)
  red5Port?: number; // Red5 WebRTC 포트 (기본값: 8081)
  useRed5ProSDK?: boolean; // Red5 Pro SDK 사용 여부 (기본값: true)
  useSDKPlayer?: boolean; // 强制使用 SDK 播放器而不是 iframe (기본값: true)
  licenseKey?: string; // Red5 Pro SDK 许可证密钥 (如果需要)
  onFallbackToHLS?: () => void; // WebRTC 실패 시 HLS로 전환 콜백
  onReady?: () => void; // WebRTC 准备好时的回调（用于无缝切换）
  hidden?: boolean; // 是否隐藏但保持连接（用于预加载）
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ 
  machineId, 
  sessionId, 
  streamUrl,
  app = import.meta.env.VITE_RED5PRO_APP || 'live',
  streamName = 'mystream',
  red5Host = import.meta.env.VITE_RED5PRO_HOST || 'localhost',
  red5Port = parseInt(import.meta.env.VITE_RED5PRO_WEBRTC_PORT || '8081', 10),
  useRed5ProSDK = true,
  useSDKPlayer = true, // 默认使用 SDK 播放器
  licenseKey = import.meta.env.VITE_RED5PRO_LICENSE_KEY, // 从环境变量读取
  onFallbackToHLS,
  onReady, // WebRTC 准备好时的回调
  hidden = false // 是否隐藏但保持连接
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const subscriberRef = useRef<RTCSubscriber | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null); // Fallback용
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStateRef = useRef<ConnectionState>('connecting'); // 用于超时回调检查当前状态（避免闭包问题）
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting'); // 初始状态改为 'connecting'，显示加载页面
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('WebRTC 연결 초기화 중...');
  const [useIframe, setUseIframe] = useState(false); // iframe 모드 사용 여부
  
  // 辅助函数：同时更新状态和 ref（用于超时回调检查）
  const updateConnectionState = (newState: ConnectionState) => {
    connectionStateRef.current = newState;
    setConnectionState(newState);
  };
  
  // 确保视频持续播放（像测试页面一样）
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;
    
    // 如果视频已连接且有流，确保持续播放
    if (connectionState === 'connected' && video.srcObject) {
      // 如果视频暂停了，自动恢复播放
      if (video.paused) {
        video.play().catch((err) => {
          console.warn('[WebRTC] 自动播放失败:', err);
        });
        console.log('[WebRTC] 视频暂停，自动恢复播放');
      }
    }
  }, [connectionState]);
  
  // WebRTC 连接成功时调用 onReady 回调（用于无缝切换）
  const onReadyCalledRef = useRef(false); // 防止重复调用
  useEffect(() => {
    if (connectionState === 'connected' && onReady && !onReadyCalledRef.current) {
      console.log('[WebRTC] ✅ WebRTC 연결 완료, onReady 콜백 호출');
      onReadyCalledRef.current = true;
      onReady();
    }
    // 连接断开时重置，以便下次连接时可以再次调用
    if (connectionState === 'disconnected' || connectionState === 'failed') {
      onReadyCalledRef.current = false;
    }
  }, [connectionState, onReady]);
  
  // 定期检查视频播放状态，确保持续播放
  useEffect(() => {
    if (connectionState !== 'connected') return;
    
    const checkInterval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.srcObject && video.paused) {
        console.log('[WebRTC] 检测到视频暂停，自动恢复播放');
        video.play().catch((err) => {
          console.warn('[WebRTC] 恢复播放失败:', err);
        });
      }
    }, 1000); // 每秒检查一次
    
    return () => clearInterval(checkInterval);
  }, [connectionState]);

  // WebRTC 配置
  const rtcConfiguration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // 비디오 요소 마운트 상태 추적 및 이벤트 리스너 설정
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      console.log('[WebRTC] 비디오 요소 마운트됨:', {
        tagName: video.tagName,
        id: video.id || '없음',
        className: video.className,
        inDOM: document.contains(video),
        parent: video.parentElement?.className || '없음',
        offsetParent: video.offsetParent !== null,
        offsetWidth: video.offsetWidth,
        offsetHeight: video.offsetHeight
      });
      
      // 监听视频元素的事件
      const handleLoadedMetadata = () => {
        console.log('[WebRTC] ✅ 비디오 메타데이터 로드됨');
      };
      
      const handleLoadedData = () => {
        console.log('[WebRTC] ✅ 비디오 데이터 로드됨');
      };
      
      const handleCanPlay = () => {
        console.log('[WebRTC] ✅ 비디오 재생 가능');
        updateConnectionState('connected');
        setError(null);
        // 连接成功，清除 30 秒超时
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
          console.log('[WebRTC] ✅ 연결 성공 (canplay), 30초 타임아웃 클리어');
        }
      };
      
      const handlePlaying = () => {
        console.log('[WebRTC] ✅ 비디오 재생 중');
        updateConnectionState('connected');
        setError(null);
        setDebugInfo('비디오 스트림 재생 중');
        // 连接成功，清除 30 秒超时
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
          console.log('[WebRTC] ✅ 연결 성공 (playing), 30초 타임아웃 클리어');
        }
      };
      
      const handleWaiting = () => {
        console.log('[WebRTC] 비디오 버퍼링 중...');
        setDebugInfo('비디오 버퍼링 중...');
      };
      
      const handleError = () => {
        console.error('[WebRTC] 비디오 요소 오류');
        const videoError = video.error;
        if (videoError) {
          console.error('[WebRTC] 비디오 오류 코드:', videoError.code, videoError.message);
          // 不显示错误，只记录到控制台
          setError(null);
        }
      };
      
      // 添加事件监听器
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('error', handleError);
      
      // 清理函数
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('error', handleError);
      };
    } else {
      console.warn('[WebRTC] 비디오 요소가 아직 마운트되지 않았습니다.');
    }
  }, []); // 컴포넌트 마운트 시 한 번만 실행

  // Red5 Pro SDK 로드 대기 함수
  const waitForSDK = (timeout = 10000): Promise<typeof window.red5prosdk> => {
    return new Promise((resolve, reject) => {
      // 이미 로드되어 있으면 즉시 반환
      if (window.red5prosdk) {
        console.log('[Red5 Pro SDK] SDK가 이미 로드되어 있습니다.');
        resolve(window.red5prosdk);
        return;
      }

      // 스크립트 로드 오류 확인
      if ((window as any).red5proSDKError) {
        reject(new Error((window as any).red5proSDKError));
        return;
      }

      // SDK 로드 대기
      let attempts = 0;
      const maxAttempts = timeout / 100; // 100ms마다 체크
      
      const checkSDK = () => {
        attempts++;
        
        // 스크립트 로드 오류 확인
        if ((window as any).red5proSDKError) {
          reject(new Error((window as any).red5proSDKError));
          return;
        }
        
        if (window.red5prosdk) {
          console.log('[Red5 Pro SDK] SDK 로드 완료');
          console.log('[Red5 Pro SDK] SDK 구조:', Object.keys(window.red5prosdk));
          resolve(window.red5prosdk);
          return;
        }
        
        if (attempts >= maxAttempts) {
          const errorMsg = (window as any).red5proSDKLoaded 
            ? 'SDK 스크립트는 로드되었지만 window.red5prosdk가 정의되지 않았습니다. SDK 버전이나 CDN 경로를 확인하세요.'
            : 'SDK 로드 타임아웃: Red5 Pro SDK 스크립트가 로드되지 않았습니다. 네트워크 연결과 CDN 접근을 확인하세요.';
          reject(new Error(errorMsg));
          return;
        }
        
        setTimeout(checkSDK, 100);
      };
      
      checkSDK();
    });
  };

  // Red5 Pro SDK를 사용한 WebRTC 연결
  const initializeWebRTCWithRed5Pro = async () => {
    const video = videoRef.current;
    if (!video) {
      const errorMsg = '비디오 요소가 준비되지 않았습니다.';
      console.error('[Red5 Pro SDK]', errorMsg);
      // 不显示错误，保持连接中状态
      setError(null);
      setConnectionState('connecting');
      setDebugInfo('비디오 요소 준비 중...');
      return;
    }

    // Red5 Pro SDK 로드 대기
    let sdk: typeof window.red5prosdk;
    try {
      setDebugInfo('Red5 Pro SDK 로드 대기 중...');
      sdk = await waitForSDK(10000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'SDK 로드 실패';
      console.error('[Red5 Pro SDK] SDK 로드 실패:', errorMsg);
      // 不显示错误，保持连接中状态
      setError(null);
      setConnectionState('connecting');
      setDebugInfo('SDK 로드 중...');
      return;
    }
    
    // SDK 객체의 구조 확인
    console.log('[Red5 Pro SDK] SDK 객체:', sdk);
    console.log('[Red5 Pro SDK] SDK 버전:', (sdk as any).version || '버전 정보 없음');
    const sdkKeys = Object.keys(sdk || {});
    console.log('[Red5 Pro SDK] SDK 사용 가능한 속성:', sdkKeys);
    
    // 设置许可证密钥（如果需要）
    if (licenseKey) {
      console.log('[Red5 Pro SDK] 许可证密钥设置中...');
      try {
        // 尝试不同的许可证设置方法
        if (typeof (sdk as any).setLicenseKey === 'function') {
          (sdk as any).setLicenseKey(licenseKey);
          console.log('[Red5 Pro SDK] ✅ 许可证密钥已设置 (setLicenseKey)');
        } else if (typeof (sdk as any).setLicense === 'function') {
          (sdk as any).setLicense(licenseKey);
          console.log('[Red5 Pro SDK] ✅ 许可证密钥已设置 (setLicense)');
        } else if ((sdk as any).LicenseKey) {
          (sdk as any).LicenseKey = licenseKey;
          console.log('[Red5 Pro SDK] ✅ 许可证密钥已设置 (LicenseKey属性)');
        } else if ((sdk as any).licenseKey) {
          (sdk as any).licenseKey = licenseKey;
          console.log('[Red5 Pro SDK] ✅ 许可证密钥已设置 (licenseKey属性)');
        } else {
          console.warn('[Red5 Pro SDK] ⚠️ 未找到许可证设置方法，SDK可能不需要许可证或使用开源版本');
          console.log('[Red5 Pro SDK] 可用的SDK方法:', sdkKeys.filter(key => 
            typeof (sdk as any)[key] === 'function' && 
            (key.toLowerCase().includes('license') || key.toLowerCase().includes('key'))
          ));
        }
      } catch (err) {
        console.error('[Red5 Pro SDK] 许可证密钥设置失败:', err);
      }
    } else {
      console.log('[Red5 Pro SDK] 未提供许可证密钥');
      console.log('[Red5 Pro SDK] 提示: 如果使用商业版 Red5 Pro SDK，可能需要设置 licenseKey 属性');
      console.log('[Red5 Pro SDK] 如果服务器端 viewer.jsp 可以播放，说明服务器可能已配置许可证');
    }
    
    // SDK의 실제 구조 확인 (다양한 가능한 경로 체크)
    // 优先级：WHEPClient (15.0.0+) > RTCSubscriber > Red5ProSubscriber
    let SubscriberClass: any = null;
    let sdkPath = '';
    let useWHEP = false; // WHEPClient 사용 여부
    
    // 가능한 SDK 경로들 확인 (우선순위 순)
    // 1. WHEPClient (Red5 Pro SDK 15.0.0+ 推荐方式)
    if ((sdk as any).WHEPClient) {
      SubscriberClass = (sdk as any).WHEPClient;
      sdkPath = 'red5prosdk.WHEPClient';
      useWHEP = true;
      console.log('[Red5 Pro SDK] WHEPClient 발견 (15.0.0+ 新API)');
    } else if ((sdk as any).default && (sdk as any).default.WHEPClient) {
      SubscriberClass = (sdk as any).default.WHEPClient;
      sdkPath = 'red5prosdk.default.WHEPClient';
      useWHEP = true;
      console.log('[Red5 Pro SDK] red5prosdk.default.WHEPClient 발견');
    } else {
      // 2. 旧版 API (向后兼容)
      const checkPaths = [
        { path: 'RTCSubscriber', key: 'RTCSubscriber' },
        { path: 'Red5ProSubscriber', key: 'Red5ProSubscriber' },
        { path: 'default.RTCSubscriber', key: 'default', subKey: 'RTCSubscriber' },
        { path: 'default.Red5ProSubscriber', key: 'default', subKey: 'Red5ProSubscriber' },
      ];
      
      for (const checkPath of checkPaths) {
        if (checkPath.subKey) {
          // default.RTCSubscriber 같은 경우
          if ((sdk as any)[checkPath.key] && (sdk as any)[checkPath.key][checkPath.subKey]) {
            SubscriberClass = (sdk as any)[checkPath.key][checkPath.subKey];
            sdkPath = `red5prosdk.${checkPath.path}`;
            console.log(`[Red5 Pro SDK] ${checkPath.path} 발견 (旧版API)`);
            break;
          }
        } else {
          // 직접 속성인 경우
          if ((sdk as any)[checkPath.key]) {
            SubscriberClass = (sdk as any)[checkPath.key];
            sdkPath = `red5prosdk.${checkPath.path}`;
            console.log(`[Red5 Pro SDK] ${checkPath.path} 발견 (旧版API)`);
            break;
          }
        }
      }
    }
    
    // 추가 진단: SDK에 언급된 타입들이 있는지 확인
    const mentionedTypes = [
      'SubscriberEventTypes', 'RTCSubscriberEventTypes', 'HLSSubscriber',
      'WHEPClient', 'WHIPClient', 'getVersion', 'setLogLevel'
    ];
    const foundTypes = mentionedTypes.filter(type => (sdk as any)[type] !== undefined);
    if (foundTypes.length > 0) {
      console.log('[Red5 Pro SDK] 발견된 언급된 타입들:', foundTypes);
    }
    
    if (!SubscriberClass) {
      const availableKeys = Object.keys(sdk || {}).join(', ');
      const foundTypes = mentionedTypes.filter(type => (sdk as any)[type] !== undefined);
      
      console.error('[Red5 Pro SDK] WHEPClient, RTCSubscriber 또는 Red5ProSubscriber를 찾을 수 없습니다.');
      console.error('[Red5 Pro SDK] 전체 SDK 구조:', JSON.stringify(sdk, null, 2).substring(0, 1000));
      
      let errorDetails = `Red5 Pro SDK에서 WebRTC Subscriber를 찾을 수 없습니다.\n\n`;
      errorDetails += `사용 가능한 속성: ${availableKeys}\n\n`;
      
      if (foundTypes.length > 0) {
        errorDetails += `발견된 타입들: ${foundTypes.join(', ')}\n\n`;
      }
      
      // WHEPClient 优先提示
      if (!foundTypes.includes('WHEPClient')) {
        errorDetails += `⚠️ WHEPClient를 찾을 수 없습니다. Red5 Pro SDK 15.0.0+ 버전을 사용하는 경우 WHEPClient가 있어야 합니다.\n\n`;
      }
      
      errorDetails += `SDK가 올바르게 로드되었는지 확인하세요.\n\n`;
      errorDetails += `권장 사항:\n`;
      errorDetails += `1. Red5 Pro SDK 15.0.0+ 버전 사용 시 WHEPClient를 사용하세요 (권장)\n`;
      errorDetails += `2. 구버전 SDK 사용 시 RTCSubscriber 또는 Red5ProSubscriber를 사용하세요\n\n`;
      errorDetails += `에러 메시지에 언급된 타입들:\n`;
      errorDetails += `WHEPClient (15.0.0+ 권장), WHIPClient, RTCSubscriber, Red5ProSubscriber, HLSSubscriber, SubscriberEventTypes, RTCSubscriberEventTypes, MessageTransportStateEventTypes, Event, EventEmitter, LOG_LEVELS, LiveSeekClient, MessageTransportStateEvent, PlaybackController, PlaybackControls, PlaybackStateReadableMap, PublisherEvent, SourceHandler, SourceHandlerImpl, SubscriberEvent, default, defaultHLSSubscriberConfig, defaultLiveSeekConfig, defaultStatsConfig, defaultWhepSubscriberConfig, defaultWhipPublisherConfig, getLogger, getRecordedLogs, getVersion, setLogLevel\n\n`;
      errorDetails += `브라우저 콘솔에서 다음 명령어로 SDK 구조를 확인하세요:\n`;
      errorDetails += `console.log(window.red5prosdk);\n`;
      errorDetails += `console.log(Object.keys(window.red5prosdk));\n`;
      errorDetails += `console.log(window.red5prosdk.WHEPClient);`;
      
      // 不显示错误，保持连接中状态
      setError(null);
      setConnectionState('connecting');
      setDebugInfo('SDK 초기화 중...');
      return;
    }

    try {
      console.log('[Red5 Pro SDK] WebRTC 연결 초기화 시작', { machineId, sessionId, app, streamName });
      setConnectionState('connecting');
      setError(null);
      setDebugInfo(`Red5 Pro SDK WebRTC 연결 초기화 중... (${sdkPath} 사용)`);

      // 기존 subscriber 정리
      if (subscriberRef.current) {
        try {
          await subscriberRef.current.unsubscribe();
        } catch (err) {
          console.warn('[Red5 Pro SDK] 기존 subscriber 정리 실패:', err);
        }
        subscriberRef.current = null;
      }
      
      if (!SubscriberClass || typeof SubscriberClass !== 'function') {
        throw new Error(`Subscriber 클래스가 생성자가 아닙니다. 타입: ${typeof SubscriberClass}, 경로: ${sdkPath}`);
      }
      
      // 설정 구성
      const protocol = red5Port === 443 ? 'wss' : 'ws';
      let subscriber: any;
      let config: any;
      
      // WHEPClient 사용 (15.0.0+ 新API)
      if (useWHEP) {
        // 确保视频元素存在且已添加到 DOM
        if (!video) {
          throw new Error('비디오 요소가 없습니다');
        }
        if (!document.contains(video)) {
          throw new Error('비디오 요소가 DOM에 없습니다');
        }

        // 确保视频元素有 ID（某些 SDK 版本可能需要）
        if (!video.id) {
          video.id = 'red5pro-subscriber-video';
          console.log('[Red5 Pro SDK] 비디오 요소에 ID 설정:', video.id);
        }

        console.log('[Red5 Pro SDK] 비디오 요소 확인:', {
          tagName: video.tagName,
          id: video.id,
          inDOM: document.contains(video),
          parent: video.parentElement ? video.parentElement.className : '없음'
        });

        // 创建 subscriber（完全按照测试页面）
        console.log('[Red5 Pro SDK] 创建 Subscriber 实例...', 'info');
        
        // 某些 SDK 版本可能需要视频元素作为构造函数参数（完全按照测试页面）
        try {
          subscriber = new SubscriberClass();
        } catch (e) {
          console.log('[Red5 Pro SDK] 使用无参数构造函数失败，尝试使用视频元素作为参数...', 'warn');
          subscriber = new SubscriberClass(video);
        }
        
        // 配置（完全按照测试页面）
        const httpProtocol = red5Port === 5443 || red5Port === 443 ? 'https' : 'http';
        const whepPort = red5Port === 8081 ? 5080 : red5Port;
        
        config = {
          protocol: httpProtocol,
          host: red5Host,
          port: whepPort,
          app: app,
          streamName: streamName,
          rtcConfiguration: rtcConfiguration,
          // 重要：确保视频元素正确传递（完全按照测试页面）
          mediaElement: video,
          element: video,
          videoElement: video,
        };
        
        if (licenseKey) {
          config.licenseKey = licenseKey;
        }
        
        // 如果 SDK 需要通过 ID 查找，也提供 ID（完全按照测试页面）
        if (video.id) {
          config.mediaElementId = video.id;
        }
      } else if (sdkPath.includes('Red5ProSubscriber')) {
        // Red5ProSubscriber는 setPlaybackOrder와 함께 사용
        subscriber = new SubscriberClass();
        if (typeof subscriber.setPlaybackOrder === 'function') {
        subscriber.setPlaybackOrder(['rtc']); // RTC만 사용
        }
        config = {
          rtc: {
            protocol,
            host: red5Host,
            port: red5Port,
            app: app,
            streamName: streamName,
            rtcConfiguration: rtcConfiguration,
            // 重要：视频元素必须传递给 SDK
            mediaElement: video,
            element: video,
            // 许可证密钥（如果提供）
            ...(licenseKey ? { licenseKey: licenseKey } : {}),
          }
        };
        console.log('[Red5 Pro SDK] Red5ProSubscriber 초기화 (旧版API):', config);
        console.log('[Red5 Pro SDK] 비디오 요소 확인:', { 
          video: video ? '존재' : 'null', 
          videoId: video?.id || '없음'
        });
      } else {
        // RTCSubscriber 직접 사용
        subscriber = new SubscriberClass();
        config = {
          protocol,
          host: red5Host,
          port: red5Port,
          app: app,
          streamName: streamName,
          rtcConfiguration: rtcConfiguration,
          // 重要：视频元素必须传递给 SDK
          mediaElement: video,
          element: video,
          // 许可证密钥（如果提供）
          ...(licenseKey ? { licenseKey: licenseKey } : {}),
        };
        console.log('[Red5 Pro SDK] RTCSubscriber 초기화 (旧版API):', config);
        console.log('[Red5 Pro SDK] 비디오 요소 확인:', { 
          video: video ? '존재' : 'null', 
          videoId: video?.id || '없음'
        });
      }
      
      subscriberRef.current = subscriber;

      // 视频流连接函数
      const connectVideoStream = () => {
        const currentVideo = videoRef.current;
        if (!currentVideo) {
          console.warn('[Red5 Pro SDK] 비디오 요소가 없습니다.');
          return;
        }

        // 尝试多种方式获取视频流
        const view = subscriber.getView();
        console.log('[Red5 Pro SDK] getView() 결과:', {
          view: view ? view.constructor.name : 'null',
          isVideoElement: view instanceof HTMLVideoElement,
          hasSrcObject: view?.srcObject ? '있음' : '없음',
          srcObjectType: view?.srcObject?.constructor?.name || '없음'
        });

        if (view instanceof HTMLVideoElement) {
          // view 是视频元素
          if (view !== currentVideo && view.srcObject) {
            console.log('[Red5 Pro SDK] view에서 srcObject 복사');
            currentVideo.srcObject = view.srcObject;
          } else if (view === currentVideo) {
            console.log('[Red5 Pro SDK] view가 현재 비디오 요소와 동일');
          }
        } else if (view && view.srcObject) {
          // view 有 srcObject
          console.log('[Red5 Pro SDK] view.srcObject 설정');
          currentVideo.srcObject = view.srcObject;
        } else {
          // 尝试直接使用 subscriber 的流
          console.log('[Red5 Pro SDK] getView()가 null이거나 srcObject가 없음, 다른 방법 시도');
          
          // 检查 subscriber 是否有其他方法获取流
          if (subscriber.getStream && typeof subscriber.getStream === 'function') {
            try {
              const stream = subscriber.getStream();
              if (stream) {
                console.log('[Red5 Pro SDK] subscriber.getStream() 사용');
                currentVideo.srcObject = stream;
              }
            } catch (e) {
              console.warn('[Red5 Pro SDK] getStream() 실패:', e);
            }
          }
        }

        // 检查视频元素是否有流
        if (currentVideo.srcObject) {
          const stream = currentVideo.srcObject as MediaStream;
          console.log('[Red5 Pro SDK] 비디오 요소 스트림 확인:', {
            tracks: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            active: stream.active,
            videoTrackState: stream.getVideoTracks()[0]?.readyState || '없음'
          });

          // 尝试播放
          currentVideo.play().then(() => {
            console.log('[Red5 Pro SDK] ✅ 비디오 재생 성공');
            updateConnectionState('connected');
            setError(null);
            setDebugInfo('비디오 스트림 재생 중');
            // 连接成功，清除 30 秒超时
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
              console.log('[Red5 Pro SDK] ✅ 연결 성공, 30초 타임아웃 클리어');
            }
          }).catch((err) => {
            console.error('[Red5 Pro SDK] 자동 재생 실패:', err);
            // 即使自动播放失败，如果视频流已连接，也设置为 connected
            // 用户可以手动点击播放
            if (currentVideo.srcObject) {
              updateConnectionState('connected');
              setError(null);
              setDebugInfo('비디오 스트림 준비 완료 (클릭하여 재생)');
              // 连接成功，清除 30 秒超时
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
                console.log('[Red5 Pro SDK] ✅ 연결 성공 (재생 실패지만 스트림 있음), 30초 타임아웃 클리어');
              }
            } else {
              setError(null);
              updateConnectionState('connecting');
              setDebugInfo('비디오 재생 준비 중...');
            }
          });
        } else {
          console.warn('[Red5 Pro SDK] 비디오 요소에 srcObject가 설정되지 않았습니다.');
          setDebugInfo('비디오 스트림을 받지 못했습니다. 잠시 후 다시 시도합니다...');
          
          // 延迟重试
          setTimeout(() => {
            console.log('[Red5 Pro SDK] 비디오 스트림 연결 재시도');
            connectVideoStream();
          }, 1000);
        }
      };

      // 이벤트 리스너 설정
      // WHEPClient와 기존 API 모두 동일한 이벤트 이름 사용 가능
      subscriber.on('Subscribe.Start', () => {
        console.log(`[Red5 Pro SDK] WebRTC 구독 시작 (${useWHEP ? 'WHEP' : 'RTC'})`);
        setDebugInfo(`WebRTC 스트림 수신 중... (${useWHEP ? 'WHEP' : 'RTC'})`);
        setError(null);
        // 先保持 connecting 状态，等视频流连接后再设置为 connected
        
        // 延迟连接视频流，确保流已准备好
        setTimeout(() => {
          connectVideoStream();
        }, 500);
      });

      subscriber.on('Subscribe.Fail', (event: any) => {
        console.error('[Red5 Pro SDK] WebRTC 구독 실패:', event);
        console.error('[Red5 Pro SDK] 실패 이벤트 전체:', JSON.stringify(event, null, 2));
        // 不显示错误，保持连接中状态
        setConnectionState('connecting');
        setError(null);
        setDebugInfo('WebRTC 연결 시도 중...');
        
        // WebRTC 실패 시 HLS로 자동 전환
        if (onFallbackToHLS) {
          console.log('[Red5 Pro SDK] WebRTC 실패, HLS로 전환');
          setTimeout(() => {
            onFallbackToHLS();
          }, 2000);
        }
      });

      subscriber.on('Subscribe.InvalidName', () => {
        console.error('[Red5 Pro SDK] 잘못된 스트림 이름');
        // 不显示错误，保持连接中状态
        setConnectionState('connecting');
        setError(null);
        setDebugInfo('스트림 연결 중...');
      });

      // 添加更多事件监听以处理视频流
      subscriber.on('Subscribe.VideoDimensionsChange', (event: any) => {
        console.log('[Red5 Pro SDK] 비디오 크기 변경:', event);
        connectVideoStream();
      });

      subscriber.on('Subscribe.PlaybackStart', () => {
        console.log('[Red5 Pro SDK] 재생 시작');
        connectVideoStream();
      });

      subscriber.on('Subscribe.StreamMetaData', (event: any) => {
        console.log('[Red5 Pro SDK] 스트림 메타데이터:', event);
        connectVideoStream();
      });

      // WHEPClient 특정 이벤트 (있는 경우)
      if (useWHEP) {
        subscriber.on('WHEP.Subscribe.Start', () => {
          console.log('[Red5 Pro SDK] WHEP 구독 시작');
          setTimeout(() => {
            connectVideoStream();
          }, 500);
        });
        
        subscriber.on('WHEP.Subscribe.Fail', (event: any) => {
          console.error('[Red5 Pro SDK] WHEP 구독 실패:', event);
          // 不显示错误，保持连接中状态
          setConnectionState('connecting');
          setError(null);
          setDebugInfo('WHEP 연결 시도 중...');
        });
      }

      subscriber.on('Unsubscribe.Stop', () => {
        console.log('[Red5 Pro SDK] WebRTC 구독 중지');
        // 订阅停止时，如果组件仍然挂载，保持连接状态以便重新连接
        // 只有在组件卸载时才设置为 disconnected
        // setConnectionState('disconnected');
      });

      // 연결 타임아웃 설정
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      connectionTimeoutRef.current = setTimeout(() => {
        // 使用 ref 检查当前状态，避免闭包问题
        if (connectionStateRef.current === 'connecting') {
          console.error('[Red5 Pro SDK] 연결 타임아웃 (30초) - 연결이 아직 완료되지 않음');
          // 不显示错误，保持连接中状态
          setError(null);
          updateConnectionState('connecting');
          setDebugInfo('연결 시도 중...');
          // WebRTC 타임아웃 시 HLS로 자동 전환하지 않음
        } else {
          console.log('[Red5 Pro SDK] 타임아웃 발생했지만 이미 연결됨, 무시:', connectionStateRef.current);
        }
      }, 30000);

      // 초기화 및 구독 시작（完全按照测试页面的逻辑）
      try {
        // 完全按照测试页面的逻辑（参考 test-webrtc-sdk.html）
        const currentVideo = videoRef.current;
        if (!currentVideo) {
          throw new Error('비디오 요소가 null입니다. ref가 올바르게 설정되었는지 확인하세요.');
        }
        
        if (!document.contains(currentVideo)) {
          throw new Error('비디오 요소가 DOM에 없습니다. 컴포넌트가 마운트되었는지 확인하세요.');
        }
        
        // 确保视频元素有 ID（某些 SDK 版本可能需要）
          if (!currentVideo.id) {
            currentVideo.id = 'red5pro-subscriber-video';
            console.log('[Red5 Pro SDK] 비디오 요소에 ID 설정:', currentVideo.id);
          }
          
        console.log('[Red5 Pro SDK] 视频元素检查:', 'info');
        console.log(`[Red5 Pro SDK] - 标签名: ${currentVideo.tagName}`, 'info');
        console.log(`[Red5 Pro SDK] - ID: ${currentVideo.id || '无'}`, 'info');
        console.log(`[Red5 Pro SDK] - 在 DOM 中: ${document.contains(currentVideo)}`, 'info');
        console.log(`[Red5 Pro SDK] - 父元素: ${currentVideo.parentElement ? currentVideo.parentElement.className : '无'}`, 'info');
        
        // 更新 config 中的视频元素引用（完全按照测试页面）
          config.mediaElement = currentVideo;
          config.element = currentVideo;
          config.videoElement = currentVideo;
          if (currentVideo.id) {
            config.mediaElementId = currentVideo.id;
          }
          
        console.log('[Red5 Pro SDK] 配置参数:', 'info');
        console.log(`[Red5 Pro SDK] - 协议: ${config.protocol}`, 'info');
        console.log(`[Red5 Pro SDK] - 主机: ${config.host}`, 'info');
        console.log(`[Red5 Pro SDK] - 端口: ${config.port}`, 'info');
        console.log(`[Red5 Pro SDK] - 应用: ${config.app}`, 'info');
        console.log(`[Red5 Pro SDK] - 流名称: ${config.streamName}`, 'info');
        console.log(`[Red5 Pro SDK] - 视频元素: ${currentVideo.tagName}#${currentVideo.id}`, 'info');
        console.log(`[Red5 Pro SDK] 预期 WHEP 端点: ${config.protocol}://${config.host}:${config.port}/${config.app}/whep/${config.streamName}`, 'info');
        
        // 初始化前再次确认视频元素（完全按照测试页面）
        console.log('[Red5 Pro SDK] 初始化前视频元素最终检查...', 'info');
        const finalVideoCheck = document.getElementById(currentVideo.id);
        if (!finalVideoCheck || finalVideoCheck !== currentVideo) {
          throw new Error('视频元素检查失败');
        }
        console.log('[Red5 Pro SDK] ✅ 视频元素检查通过', 'info');
        
        // 如果 SDK 有 setMediaElement 方法，先调用（完全按照测试页面）
          if (subscriber && typeof subscriber.setMediaElement === 'function') {
          console.log('[Red5 Pro SDK] 调用 subscriber.setMediaElement()...', 'info');
            try {
              subscriber.setMediaElement(currentVideo);
            console.log('[Red5 Pro SDK] ✅ setMediaElement() 完成', 'info');
          } catch (e: any) {
            console.log('[Red5 Pro SDK] setMediaElement() 失败: ' + e.message, 'warn');
            }
          }
          
        // 如果 SDK 有 attach 方法，先调用（完全按照测试页面）
          if (subscriber && typeof subscriber.attach === 'function') {
          console.log('[Red5 Pro SDK] 调用 subscriber.attach()...', 'info');
            try {
              subscriber.attach(currentVideo);
            console.log('[Red5 Pro SDK] ✅ attach() 完成', 'info');
          } catch (e: any) {
            console.log('[Red5 Pro SDK] attach() 失败: ' + e.message, 'warn');
          }
        }
        
        // 初始化（完全按照测试页面）
        console.log('[Red5 Pro SDK] 调用 subscriber.init()...', 'info');
        console.log('[Red5 Pro SDK] ⚠️ 注意：如果出现 hasAttribute 错误，说明视频元素未正确传递', 'warn');
        await subscriber.init(config);
        console.log('[Red5 Pro SDK] ✅ subscriber.init() 完成', 'info');
        
        // 订阅（完全按照测试页面）
        console.log('[Red5 Pro SDK] 调用 subscriber.subscribe()...', 'info');
        console.log('[Red5 Pro SDK] ⚠️ 注意：请在 Network 标签页中查找 WHEP 端点请求', 'warn');
      await subscriber.subscribe();
        console.log('[Red5 Pro SDK] ✅ subscriber.subscribe() 完成', 'info');
        
        // 获取视频流（完全按照测试页面，延迟 1 秒）
        setTimeout(() => {
          try {
            const view = subscriber.getView();
            if (view) {
              if (view instanceof HTMLVideoElement) {
                if (view !== currentVideo && view.srcObject) {
                  currentVideo.srcObject = view.srcObject;
                  console.log('[Red5 Pro SDK] ✅ 从 view 复制视频流', 'info');
                  // 设置视频流后尝试播放并更新状态
                  currentVideo.play().then(() => {
                    updateConnectionState('connected');
                    // 连接成功，清除 30 秒超时
                    if (connectionTimeoutRef.current) {
                      clearTimeout(connectionTimeoutRef.current);
                      connectionTimeoutRef.current = null;
                      console.log('[Red5 Pro SDK] ✅ 연결 성공 (getView 후 재생), 30초 타임아웃 클리어');
                    }
                  }).catch((err) => {
                    console.warn('[Red5 Pro SDK] 自动播放失败:', err);
                    // 即使播放失败，如果流已设置，也设置为 connected
                    if (currentVideo.srcObject) {
                      updateConnectionState('connected');
                      // 连接成功，清除 30 秒超时
                      if (connectionTimeoutRef.current) {
                        clearTimeout(connectionTimeoutRef.current);
                        connectionTimeoutRef.current = null;
                        console.log('[Red5 Pro SDK] ✅ 연결 성공 (getView 후 재생 실패지만 스트림 있음), 30초 타임아웃 클리어');
                      }
                    }
                  });
                } else if (view === currentVideo) {
                  console.log('[Red5 Pro SDK] ✅ view 就是当前视频元素', 'info');
                  updateConnectionState('connected');
                  // 连接成功，清除 30 秒超时
                  if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                    console.log('[Red5 Pro SDK] ✅ 연결 성공 (view가 현재 비디오 요소), 30초 타임아웃 클리어');
                  }
                }
              } else if (view && view.srcObject) {
                currentVideo.srcObject = view.srcObject;
                console.log('[Red5 Pro SDK] ✅ 从 view.srcObject 设置视频流', 'info');
                // 设置视频流后尝试播放并更新状态
                currentVideo.play().then(() => {
                  updateConnectionState('connected');
                  // 连接成功，清除 30 秒超时
                  if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                    console.log('[Red5 Pro SDK] ✅ 연결 성공 (view.srcObject 후 재생), 30초 타임아웃 클리어');
                  }
                }).catch((err) => {
                  console.warn('[Red5 Pro SDK] 自动播放失败:', err);
                  // 即使播放失败，如果流已设置，也设置为 connected
                  if (currentVideo.srcObject) {
                    updateConnectionState('connected');
                    // 连接成功，清除 30 秒超时
                    if (connectionTimeoutRef.current) {
                      clearTimeout(connectionTimeoutRef.current);
                      connectionTimeoutRef.current = null;
                      console.log('[Red5 Pro SDK] ✅ 연결 성공 (view.srcObject 후 재생 실패지만 스트림 있음), 30초 타임아웃 클리어');
                    }
                  }
                });
              }
            } else {
              console.log('[Red5 Pro SDK] ⚠️ getView() 返回 null，等待流准备...', 'warn');
            }
          } catch (e: any) {
            console.log('[Red5 Pro SDK] 获取视频流时出错: ' + e.message, 'warn');
          }
        }, 1000);
      } catch (initError: any) {
        console.error('[Red5 Pro SDK] 초기화 또는 구독 오류:', initError);
        // 더 자세한 오류 정보 출력
        if (initError?.message) {
          console.error('[Red5 Pro SDK] 오류 메시지:', initError.message);
        }
        if (initError?.stack) {
          console.error('[Red5 Pro SDK] 오류 스택:', initError.stack);
        }
        
        // 비디오 요소 상태도 함께 출력
        const currentVideo = videoRef.current;
        console.error('[Red5 Pro SDK] 오류 발생 시 비디오 요소 상태:', {
          videoExists: !!currentVideo,
          videoInDOM: currentVideo ? document.contains(currentVideo) : false,
          videoTagName: currentVideo?.tagName || '없음'
        });
        
        throw initError;
      }

    } catch (err) {
      console.error('[Red5 Pro SDK] 초기화 오류:', err);
      
      // SDK 播放器失败时，如果 useSDKPlayer 为 false 且有 streamUrl，可以回退到 iframe
      // 但默认 useSDKPlayer 为 true，所以不会自动回退
      if (!useSDKPlayer && streamUrl && (streamUrl.endsWith('.html') || streamUrl.endsWith('.jsp') || streamUrl.includes('viewer.jsp'))) {
        console.warn('[Red5 Pro SDK] SDK播放器失败, 回退到 iframe 模式');
        setUseIframe(true);
        setConnectionState('connecting');
        setError(null);
        setDebugInfo('SDK播放器失败, 使用 iframe 模式');
        return;
      }
      
      // 不显示错误，保持连接中状态
      setConnectionState('connecting');
      setError(null);
      setDebugInfo('WebRTC 연결 시도 중...');
      // WebRTC 초기화 실패 시 HLS로 자동 전환하지 않음
    }
  };

  // WebRTC 연결 초기화 (Socket 없이 직접 연결 - Fallback)
  const initializeWebRTC = async () => {
    if (!videoRef.current) {
      const errorMsg = '비디오 요소가 준비되지 않았습니다.';
      console.error('[WebRTC]', errorMsg);
      // 不显示错误，保持连接中状态
      setError(null);
      setConnectionState('connecting');
      setDebugInfo('비디오 요소 준비 중...');
      return;
    }

    try {
      console.log('[WebRTC] WebRTC 연결 초기화 시작', { machineId, sessionId });
      setConnectionState('connecting');
      setError(null);
      setDebugInfo('WebRTC 연결 초기화 중...');

      // 기존 연결 정리
      if (peerConnectionRef.current) {
        console.log('[WebRTC] 기존 연결 정리');
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // 연결 타임아웃 설정 (30초)
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      connectionTimeoutRef.current = setTimeout(() => {
        // 使用 ref 检查当前状态，避免闭包问题
        if (connectionStateRef.current === 'connecting') {
          console.error('[WebRTC] 연결 타임아웃 (30초) - 연결이 아직 완료되지 않음');
          // 不显示错误，保持连接中状态
          setError(null);
          updateConnectionState('connecting');
          setDebugInfo('연결 시도 중...');
        } else {
          console.log('[WebRTC] 타임아웃 발생했지만 이미 연결됨, 무시:', connectionStateRef.current);
        }
      }, 30000);

      // RTCPeerConnection 생성
      const pc = new RTCPeerConnection(rtcConfiguration);
      peerConnectionRef.current = pc;
      console.log('[WebRTC] RTCPeerConnection 생성 완료');

      // ICE candidate 이벤트 처리
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('[WebRTC] ICE candidate 생성:', event.candidate);
          setDebugInfo(`ICE candidate 생성: ${event.candidate.candidate?.substring(0, 50)}...`);
          // HTTP API 方式使用，不需要通过 Socket 发送 ICE candidate
        } else if (!event.candidate) {
          console.log('[WebRTC] ICE candidate 수집 완료');
          setDebugInfo('ICE candidate 수집 완료');
        }
      };

      // ICE 연결 상태 변경
      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        console.log('[WebRTC] ICE 연결 상태:', state);
        setDebugInfo(`ICE 상태: ${state}`);
        
        if (state === 'connected' || state === 'completed') {
          updateConnectionState('connected');
          setError(null);
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
            console.log('[WebRTC] ✅ ICE 연결 성공, 30초 타임아웃 클리어');
          }
          setDebugInfo('WebRTC 연결 성공');
        } else if (state === 'disconnected') {
          console.warn('[WebRTC] ICE 연결 끊김');
          updateConnectionState('connecting');
          setError(null);
          setDebugInfo('연결 재시도 중...');
        } else if (state === 'failed') {
          console.error('[WebRTC] ICE 연결 실패');
          // 不显示错误，保持连接中状态
          updateConnectionState('connecting');
          setError(null);
          setDebugInfo('연결 시도 중...');
          // 재연결 시도
          setTimeout(() => {
            if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
              console.log('[WebRTC] 재연결 시도');
              initializeWebRTC();
            }
          }, 3000);
        } else if (state === 'checking') {
          setDebugInfo('ICE 연결 확인 중...');
        }
      };

      // 연결 상태 변경
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log('[WebRTC] 연결 상태:', state);
        setDebugInfo(`연결 상태: ${state}`);
        
        if (state === 'failed') {
          // 不显示错误，保持连接中状态
          setConnectionState('connecting');
          setError(null);
          setDebugInfo('연결 시도 중...');
        }
      };

      // 원격 스트림 수신
      pc.ontrack = (event) => {
        console.log('[WebRTC] 원격 스트림 수신:', event.streams);
        console.log('[WebRTC] 트랙 정보:', event.track);
        
        if (videoRef.current && event.streams[0]) {
          const stream = event.streams[0];
          console.log('[WebRTC] 스트림 정보:', {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState,
            })),
          });
          
          videoRef.current.srcObject = stream;
          updateConnectionState('connected');
          setError(null);
          setDebugInfo('비디오 스트림 수신 완료');
          // 连接成功，清除 30 秒超时
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
            console.log('[WebRTC] ✅ 연결 성공 (ontrack), 30초 타임아웃 클리어');
          }
          
          // 비디오 재생 시도
          videoRef.current.play().catch((err) => {
            console.error('[WebRTC] 비디오 재생 실패:', err);
            // 不显示错误，保持连接中状态
            setError(null);
            updateConnectionState('connecting');
            setDebugInfo('비디오 재생 준비 중...');
          });
        } else {
          console.warn('[WebRTC] 스트림이 없거나 비디오 요소가 없습니다');
          // 不显示错误，保持连接中状态
          setError(null);
          setConnectionState('connecting');
          setDebugInfo('스트림 연결 중...');
        }
      };

      // SDP offer 생성 및 전송
      setDebugInfo('SDP offer 생성 중...');
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false, // 비디오만 필요
      });
      
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] SDP offer 생성 완료:', {
        type: offer.type,
        sdp: offer.sdp?.substring(0, 100) + '...',
      });

      // WebRTC流URL이 제공된 경우 HTTP API를 통해 연결
      if (streamUrl) {
        setDebugInfo(`WebRTC流URL로 연결 시도: ${streamUrl}`);
        console.log('[WebRTC] WebRTC流URL로 연결:', streamUrl, { app, streamName });
        
        try {
          // URL에서 파라미터 추출
          const urlObj = new URL(streamUrl);
          const urlApp = urlObj.searchParams.get('app') || app;
          const urlStreamName = urlObj.searchParams.get('streamName') || streamName;
          const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          
          console.log('[WebRTC] 파싱된 파라미터:', { urlApp, urlStreamName, baseUrl });
          
          // Red5 WebRTC API 엔드포인트 시도
          // 여러 가능한 API 경로 시도
          const possibleApiUrls = [
            `${baseUrl}/${urlApp}/webrtc`, // /live/webrtc
            `${baseUrl}/${urlApp}/api/webrtc`, // /live/api/webrtc
            `${baseUrl}/api/webrtc/${urlApp}/${urlStreamName}`, // /api/webrtc/live/mystream
            `${baseUrl}/api/webrtc`, // /api/webrtc
            streamUrl.replace('.html', ''), // 원본 URL에서 .html 제거
          ];

          let lastError: Error | null = null;
          
          for (const apiUrl of possibleApiUrls) {
            try {
              console.log('[WebRTC] API 엔드포인트 시도:', apiUrl);
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  offer: offer,
                  app: urlApp,
                  streamName: urlStreamName,
                  machineId: machineId,
                  sessionId: sessionId,
                }),
              });

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }

              const data = await response.json();
              console.log('[WebRTC] Answer 수신:', data);

              if (data.answer) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
                setDebugInfo('Answer 설정 완료, ICE 연결 대기 중...');
                
                // ICE candidates 처리
                if (data.iceCandidates && Array.isArray(data.iceCandidates)) {
                  for (const candidate of data.iceCandidates) {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  }
                }
                
                // 성공적으로 연결됨
                return;
              } else {
                throw new Error('Answer가 응답에 없습니다.');
              }
            } catch (err) {
              console.warn(`[WebRTC] ${apiUrl} 시도 실패:`, err);
              lastError = err instanceof Error ? err : new Error(String(err));
              continue; // 다음 URL 시도
            }
          }
          
          // 모든 API URL 실패 시 iframe 모드로 전환
          console.warn('[WebRTC] 모든 API 엔드포인트 실패, iframe 모드로 전환');
          setUseIframe(true);
          setDebugInfo('API 연결 실패, HTML 페이지를 iframe으로 로드합니다.');
          return; // iframe 모드로 전환하므로 WebRTC 연결 중단
        } catch (err) {
          console.error('[WebRTC] HTTP API 연결 오류:', err);
          setDebugInfo(`HTTP API 연결 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
          
          // HTTP API 실패 시 iframe 모드로 전환
          setUseIframe(true);
          setDebugInfo('API 연결 실패, HTML 페이지를 iframe으로 로드합니다.');
          return;
        }
      } else {
        // streamUrl이 없으면 iframe 모드로 전환
        console.warn('[WebRTC] streamUrl이 없습니다, iframe 모드로 전환');
        setUseIframe(true);
        setDebugInfo('streamUrl이 없어 iframe 모드로 전환합니다.');
        return;
      }

    } catch (err) {
      console.error('[WebRTC] 초기화 오류:', err);
      // 不显示错误，保持连接中状态
      setConnectionState('connecting');
      setError(null);
      setDebugInfo('WebRTC 연결 시도 중...');
      
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    }
  };

  // WebRTC 초기화 (HTTP API 方式，不需要 Socket)
  useEffect(() => {
    console.log('[WebRTC] 컴포넌트 마운트/업데이트', { 
      machineId, 
      sessionId,
      streamUrl,
      videoElementReady: !!videoRef.current,
      videoInDOM: videoRef.current ? document.contains(videoRef.current) : false
    });
    
    // 비디오 요소가 DOM에 렌더링될 때까지 대기
    const waitForVideoElement = (callback: () => void, maxAttempts = 100) => {
      let attempts = 0;
      const checkVideo = () => {
        attempts++;
        const video = videoRef.current;
        const videoInDOM = video ? document.contains(video) : false;
        const videoParent = video?.parentElement;
        
        console.log(`[WebRTC] 비디오 요소 확인 시도 ${attempts}/${maxAttempts}:`, {
          videoExists: !!video,
          videoInDOM: videoInDOM,
          videoTagName: video?.tagName || '없음',
          videoId: video?.id || '없음',
          videoParent: videoParent ? videoParent.className || '있음' : '없음',
          videoOffsetParent: video?.offsetParent ? '있음' : '없음'
        });
        
        // 비디오 요소가 존재하고 DOM에 있는지 확인
        // offsetParent는 CSS로 숨겨진 경우 null일 수 있으므로, DOM 포함 여부만 확인
        if (video && videoInDOM) {
          console.log('[WebRTC] ✅ 비디오 요소가 DOM에 준비되었습니다:', {
            tagName: video.tagName,
            id: video.id || '없음',
            className: video.className,
            parent: video.parentElement?.className || '없음',
            offsetParent: video.offsetParent !== null,
            offsetWidth: video.offsetWidth,
            offsetHeight: video.offsetHeight,
            clientWidth: video.clientWidth,
            clientHeight: video.clientHeight
          });
          callback();
        } else if (attempts < maxAttempts) {
          setTimeout(checkVideo, 50); // 50ms마다 체크 (더 빠른 반응)
        } else {
          console.error('[WebRTC] ❌ 비디오 요소 대기 타임아웃:', {
            videoExists: !!video,
            videoInDOM: videoInDOM,
            videoOffsetParent: video?.offsetParent !== null,
            videoParent: video?.parentElement ? '있음' : '없음'
          });
          // 타임아웃이어도 시도 (일부 경우 작동할 수 있음)
          if (video && videoInDOM) {
            console.warn('[WebRTC] 비디오 요소가 DOM에 있지만 일부 검사 실패, 계속 진행합니다.');
            callback();
          } else if (video) {
            console.warn('[WebRTC] 비디오 요소가 있지만 DOM에 없음, 계속 진행합니다.');
            callback();
          } else {
            console.error('[WebRTC] 비디오 요소를 찾을 수 없습니다. 초기화를 중단합니다.');
            // 不显示错误，保持连接中状态
            setError(null);
            setConnectionState('connecting');
            setDebugInfo('비디오 요소 준비 중...');
            }
        }
      };
      
      // 즉시 한 번 체크
      checkVideo();
    };
    
    // streamUrl이 HTML/JSP 페이지인 경우 처리
    // useSDKPlayer가 true면 SDK播放器优先，false면 iframe模式
    if (streamUrl && (streamUrl.endsWith('.html') || streamUrl.endsWith('.jsp') || streamUrl.includes('viewer.jsp'))) {
      if (!useSDKPlayer) {
        // 使用 iframe 模式（向后兼容）
        console.log('[WebRTC] 서버 웹페이지 감지, iframe 모드로 전환 (服务器网页直接加载)');
        console.log('[WebRTC] 서버 웹페이지 URL:', streamUrl);
        setUseIframe(true);
        setConnectionState('connecting');
        setDebugInfo(`iframe으로 서버 웹페이지 로드: ${streamUrl}`);
        setError(null);
        
        // iframe 로드 완료는 onLoad 이벤트에서 처리
        // 타임아웃 설정 (10초)
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        connectionTimeoutRef.current = setTimeout(() => {
          if (connectionState === 'connecting') {
            console.warn('[WebRTC] iframe 로드 타임아웃 (10초)');
            // 不显示错误，保持连接中状态
            setError(null);
            setConnectionState('connecting');
            setDebugInfo('페이지 로드 중...');
          }
        }, 10000);
        
        return;
      } else {
        // 使用 SDK 播放器模式
        console.log('[WebRTC] 서버 웹페이지 URL 감지, SDK播放器模式 사용');
        console.log('[WebRTC] streamUrl:', streamUrl, '- 将使用 SDK 播放器而不是 iframe');
        // 继续执行下面的 SDK 初始化逻辑
      }
    }
    
    // machineId만 있으면 바로 초기화
    if (machineId) {
      // 비디오 요소가 준비될 때까지 대기 후 초기화
      waitForVideoElement(() => {
        // 额外的延迟，确保 React 完全渲染完成（参考测试页面的成功经验）
        setTimeout(() => {
      // Red5 Pro SDK 사용 여부에 따라 선택
        if (useRed5ProSDK) {
          // SDK 로드를 기다린 후 초기화
          waitForSDK(5000)
            .then(() => {
        console.log('[Red5 Pro SDK] WebRTC 초기화 시작');
                // 비디오 요소 다시 확인（参考测试页面）
                const currentVideo = videoRef.current;
                if (!currentVideo) {
                console.error('[Red5 Pro SDK] 비디오 요소가 없습니다.');
                  // 不显示错误，保持连接中状态
                  setError(null);
                  setConnectionState('connecting');
                  setDebugInfo('비디오 요소 준비 중...');
                return;
              }
                
                // 确保视频元素在 DOM 中（参考测试页面）
                if (!document.contains(currentVideo)) {
                  console.error('[Red5 Pro SDK] 비디오 요소가 DOM에 없습니다.');
                  // 不显示错误，保持连接中状态
                  setError(null);
                  setConnectionState('connecting');
                  setDebugInfo('비디오 요소 준비 중...');
                  return;
                }
                
                // 确保视频元素有 ID（参考测试页面）
                if (!currentVideo.id) {
                  currentVideo.id = 'red5pro-subscriber-video';
                  console.log('[Red5 Pro SDK] 비디오 요소에 ID 설정:', currentVideo.id);
                }
                
                console.log('[Red5 Pro SDK] ✅ 비디오 요소 준비 완료:', {
                  tagName: currentVideo.tagName,
                  id: currentVideo.id,
                  inDOM: document.contains(currentVideo)
                });
                
                // 确保在初始化前显示连接中状态（不显示错误）
                setConnectionState('connecting');
                setError(null);
                setDebugInfo('WebRTC 연결 초기화 중...');
                
                // 延迟一小段时间，确保 UI 更新为加载状态
                setTimeout(() => {
        initializeWebRTCWithRed5Pro();
                }, 100);
            })
            .catch((err) => {
              console.warn('[WebRTC] Red5 Pro SDK 로드 실패, 네이티브 WebRTC로 fallback:', err);
                // 保持连接中状态，不显示错误
                setConnectionState('connecting');
                setError(null);
                setDebugInfo('네이티브 WebRTC 연결 시도 중...');
              initializeWebRTC();
            });
      } else {
        // Fallback to native WebRTC
          console.log('[WebRTC] Red5 Pro SDK 비활성화, 네이티브 WebRTC 사용');
            // 保持连接中状态
            setConnectionState('connecting');
            setError(null);
            setDebugInfo('네이티브 WebRTC 연결 시도 중...');
      initializeWebRTC();
      }
        }, 200); // 200ms 延迟，确保 React 渲染完成
      });
    } else {
      // machineId가 없어도 연결 중 상태 유지（不显示错误，只显示加载）
      setConnectionState('connecting');
      setError(null);
      setDebugInfo('machineId 확인 중...');
    }

    // 클린업: 연결 종료
    return () => {
      console.log('[WebRTC] 컴포넌트 언마운트, 연결 정리');
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      // Red5 Pro Subscriber 정리
      if (subscriberRef.current) {
        subscriberRef.current.unsubscribe().catch((err) => {
          console.warn('[Red5 Pro SDK] 구독 해제 실패:', err);
        });
        subscriberRef.current = null;
      }
      // 네이티브 WebRTC 연결 정리 (fallback용)
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setConnectionState('disconnected');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId, sessionId, streamUrl, app, streamName, red5Host, red5Port, useRed5ProSDK, useSDKPlayer]);


  const getStatusText = () => {
    // 只显示"로딩 중..."（加载中），不显示其他状态
    return '로딩 중...';
  };

  // iframe 모드인 경우 서버 웹페이지 (viewer.jsp) 직접 표시
  if (useIframe && streamUrl) {
    // URL 파라미터 구성
    let finalUrl = streamUrl;
    
    try {
      const urlObj = new URL(streamUrl);
      
      // viewer.jsp의 경우 host와 stream 파라미터 사용
      if (streamUrl.includes('viewer.jsp')) {
        const urlHost = urlObj.searchParams.get('host') || red5Host;
        const urlStream = urlObj.searchParams.get('stream') || streamName;
        
        // 파라미터가 없거나 변경이 필요한 경우 업데이트
        if (!urlObj.searchParams.has('host') || !urlObj.searchParams.has('stream')) {
          urlObj.searchParams.set('host', urlHost);
          urlObj.searchParams.set('stream', urlStream);
          finalUrl = urlObj.toString();
        }
        
        console.log('[WebRTC] viewer.jsp 모드로 로드:', finalUrl, {
          host: urlHost,
          stream: urlStream
        });
      } else {
        // 기존 webrtc.html 형식 지원 (하위 호환)
        const finalApp = urlObj.searchParams.get('app') || app;
        const finalStreamName = urlObj.searchParams.get('streamName') || streamName;
        
        // URL에 파라미터가 없으면 추가
        if (!streamUrl.includes('?')) {
          finalUrl = `${streamUrl}?app=${finalApp}&streamName=${finalStreamName}`;
        }
        
        console.log('[WebRTC] webrtc.html 모드로 로드:', finalUrl);
      }
    } catch (err) {
      console.error('[WebRTC] URL 파싱 오류:', err);
      // URL 파싱 실패 시 원본 URL 사용
      console.log('[WebRTC] 원본 URL 사용:', streamUrl);
    }
    
    return (
      <div className="webrtc-player" style={{ 
        width: '100%', 
        height: '100%',
        display: hidden ? 'none' : 'block' // hidden 为 true 时隐藏但保持连接
      }}>
        <div className="video-container" style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative', 
          backgroundColor: '#000', 
          overflow: 'hidden'
        }}>
          <iframe
            src={finalUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            allow="camera; microphone; autoplay; fullscreen"
            allowFullScreen
            title="WebRTC Stream"
            onLoad={() => {
              console.log('[WebRTC] ✅ iframe 로드 완료 - 서버 웹페이지가 성공적으로 로드되었습니다');
              
              // 타임아웃 클리어
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
                console.log('[WebRTC] ✅ iframe 로드 완료, 30초 타임아웃 클리어');
              }
              
              // iframe이 로드되었으므로 연결 성공으로 간주
              updateConnectionState('connected');
              setError(null);
              setDebugInfo('서버 웹페이지 로드 완료 - WebRTC 스트림이 재생 중입니다');
              
              // iframe 내부의 상태는 CORS 때문에 직접 확인할 수 없지만,
              // onLoad 이벤트가 발생했다는 것은 페이지가 로드되었다는 의미
              console.log('[WebRTC] iframe 상태:', {
                src: finalUrl,
                loaded: true,
                note: 'CORS 때문에 iframe 내부 내용은 확인할 수 없지만, 페이지는 로드되었습니다'
              });
            }}
            onError={() => {
              console.error('[WebRTC] ❌ iframe 로드 실패');
              // 不显示错误，保持连接中状态
              setConnectionState('connecting');
              setError(null);
              setDebugInfo('페이지 로드 중...');
              
              if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
              }
            }}
          />
          {/* 로딩 오버레이 */}
          {connectionState !== 'connected' && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              zIndex: 10,
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: '20px',
              borderRadius: '8px',
              color: 'white',
            }}>
              <div className="loading-spinner" style={{ margin: '0 auto 10px' }}></div>
              <p>WebRTC 페이지 로딩 중...</p>
              <p style={{ fontSize: '12px', marginTop: '10px', color: '#999' }}>URL: {finalUrl}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="webrtc-player" style={{ 
      width: '100%', 
      height: '100%',
      display: hidden ? 'none' : 'block' // hidden 为 true 时隐藏但保持连接
    }}>
      <div className="video-container" style={{ width: '100%', height: '100%' }}>
        <video
          id="red5pro-subscriber-video"
          ref={(el) => {
            // ref 설정 시 로그 출력
            if (el) {
              // 确保 ID 设置
              if (!el.id) {
                el.id = 'red5pro-subscriber-video';
              }
              console.log('[WebRTC] 비디오 요소 ref 설정됨:', {
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                inDOM: document.contains(el),
                parent: el.parentElement?.className || '없음',
                offsetWidth: el.offsetWidth,
                offsetHeight: el.offsetHeight,
                srcObject: el.srcObject ? '있음' : '없음'
              });
              videoRef.current = el;
            } else {
              console.warn('[WebRTC] 비디오 요소 ref가 null로 설정됨');
              videoRef.current = null;
            }
          }}
          className="video-stream"
          autoPlay
          playsInline
          muted
          controls={false}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <div className={`video-overlay ${connectionState === 'connected' ? 'hidden' : ''}`}>
          <div className="placeholder-content">
            <div className="placeholder-icon">📹</div>
            {/* 未连接时始终显示加载状态，不显示错误 */}
            {connectionState !== 'connected' && (
              <>
            <p className="status-text">{getStatusText()}</p>
                <div className="loading-spinner" style={{ margin: '20px auto' }}></div>
              </>
            )}
            <div style={{ fontSize: '11px', color: '#999', marginTop: '10px' }}>
              <div>Machine ID: {machineId}</div>
              {sessionId && <div>Session ID: {sessionId}</div>}
              <div>연결 모드: HTTP API (Red5 Pro SDK)</div>
            </div>
          </div>
        </div>
        {connectionState === 'connected' && (
          <div className="connection-indicator">
            <span className="indicator-dot"></span>
            <span>LIVE</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebRTCPlayer;

