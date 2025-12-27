/**
 * 게임 API 서비스
 * 게임 관련 API 요청을 처리합니다
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface GameStartRequest {
  userId: number | string; // 支持数字或字符串格式的 userId
  machineId: number;
  startToken: string;
}

interface GameStartResponse {
  success: boolean;
  status?: 'reserved' | 'available';
  reason?: string;
  startToken?: string;
  remainingCoins?: number;
  durationSec?: number;
  sessionId?: number; // long 类型
  gameStartTime?: string;
  reservedNumber?: number;
}

interface ReservedCheckResponse {
  position: number | null; // 대기 순서 (null이면 대기열에 없음)
  state: 'waiting' | 'ready' | 'playing'; // 대기열 상태
  canStart: boolean; // 게임 시작 가능 여부
  startToken: string | null; // 게임 시작 토큰
  readyExpiresAt: number | null; // ready 상태 만료 시간 (timestamp)
}

interface GameEndRequest {
  sessionId: number; // long 类型，真实生成的 sessionId，必须传递
  reason: string; // 游戏结束原因，例如 "USER_END"
}

interface GameEndResponse {
  sessionId: number; // long 类型
  machineId: number; // long 类型
  result: 'SUCCESS' | 'FAIL';
  endedAt: number; // timestamp
}

interface GameEnterRequest {
  userId: number | string; // 支持数字或字符串格式的 userId
  machineId: number;
}

interface GameEnterResponse {
  success: boolean;
  position?: number; // 대기 순서
  message?: string;
}

interface GameHeartbeatRequest {
  sessionId: number; // long 类型
}

interface GameHeartbeatResponse {
  success: boolean;
  message?: string;
}

/**
 * 게임 시작 API 호출
 * @param request 요청 파라미터
 * @returns 게임 시작 응답
 */
export async function startGame(request: GameStartRequest): Promise<GameStartResponse> {
  const url = API_BASE_URL ? `${API_BASE_URL}/api/game/start` : '/api/game/start';
  
  console.log('[Game API] ========== /api/game/start 호출 ==========');
  console.log('[Game API] URL:', url);
  console.log('[Game API] API_BASE_URL:', API_BASE_URL);
  console.log('[Game API] 요청 데이터:', request);
  console.log('[Game API] 요청 본문:', JSON.stringify(request));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  console.log('[Game API] 응답 상태:', response.status, response.statusText);
  console.log('[Game API] 응답 URL:', response.url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Game API] 오류 응답 본문:', errorText);
    console.error('[Game API] 응답 상태 코드:', response.status);
    console.error('[Game API] 요청 URL:', url);
    
    let errorMessage = `게임 시작 실패 (${response.status})`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
      console.error('[Game API] 파싱된 오류 응답:', errorData);
    } catch {
      errorMessage = errorText || errorMessage;
      console.error('[Game API] 오류 응답 파싱 실패, 원본 텍스트:', errorText);
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('[Game API] /api/game/start 응답:', data);
  
  return data;
}

/**
 * 대기열 확인 API 호출 (폴링)
 * @param userId 사용자 ID
 * @param machineId 기계 ID
 * @returns 대기열 상태
 */
export async function checkReservedStatus(
  userId: number | string,
  machineId: number
): Promise<ReservedCheckResponse> {
  // GET 요청으로 변경, query 파라미터 사용
  const baseUrl = API_BASE_URL || '';
  const url = baseUrl 
    ? `${baseUrl}/api/queue/reserved_check?userId=${userId}&machineId=${machineId}`
    : `/api/queue/reserved_check?userId=${userId}&machineId=${machineId}`;
  
  console.log('[Game API] ========== /api/queue/reserved_check 호출 ==========');
  console.log('[Game API] URL:', url);
  console.log('[Game API] API_BASE_URL:', API_BASE_URL);
  console.log('[Game API] 요청 파라미터:', { userId, machineId });
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('[Game API] 응답 상태:', response.status, response.statusText);
  console.log('[Game API] 응답 URL:', response.url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Game API] 오류 응답 본문:', errorText);
    console.error('[Game API] 응답 상태 코드:', response.status);
    console.error('[Game API] 요청 URL:', url);
    
    let errorMessage = `대기열 확인 실패 (${response.status})`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
      console.error('[Game API] 파싱된 오류 응답:', errorData);
    } catch {
      errorMessage = errorText || errorMessage;
      console.error('[Game API] 오류 응답 파싱 실패, 원본 텍스트:', errorText);
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('[Game API] /api/queue/reserved_check 응답:', data);
  console.log('[Game API] ========================================');
  console.log('[Game API] 📊 대기열 상태 상세:');
  console.log('[Game API] - position:', data.position);
  console.log('[Game API] - state:', data.state);
  console.log('[Game API] - canStart:', data.canStart);
  console.log('[Game API] - startToken:', data.startToken);
  console.log('[Game API] - readyExpireAt:', data.readyExpireAt);
  console.log('[Game API] ========================================');
  
  return data;
}

/**
 * 게임 종료 API 호출
 * @param request 요청 파라미터
 * @returns 게임 종료 응답
 */
export async function endGame(request: GameEndRequest): Promise<GameEndResponse> {
  const url = API_BASE_URL ? `${API_BASE_URL}/api/game/end` : '/api/game/end';
  
  console.log('[Game API] ========== /api/game/end 호출 ==========');
  console.log('[Game API] URL:', url);
  console.log('[Game API] API_BASE_URL:', API_BASE_URL);
  console.log('[Game API] 요청 데이터:', request);
  console.log('[Game API] sessionId 값:', request.sessionId, '타입:', typeof request.sessionId);
  console.log('[Game API] reason 값:', request.reason, '타입:', typeof request.reason);
  console.log('[Game API] 요청 본문 (JSON):', JSON.stringify(request));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  console.log('[Game API] 응답 상태:', response.status, response.statusText);
  console.log('[Game API] 응답 URL:', response.url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Game API] 오류 응답 본문:', errorText);
    console.error('[Game API] 응답 상태 코드:', response.status);
    console.error('[Game API] 요청 URL:', url);
    
    let errorMessage = `게임 종료 실패 (${response.status})`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
      console.error('[Game API] 파싱된 오류 응답:', errorData);
    } catch {
      errorMessage = errorText || errorMessage;
      console.error('[Game API] 오류 응답 파싱 실패, 원본 텍스트:', errorText);
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('[Game API] /api/game/end 응답:', data);
  
  return data;
}

/**
 * 게임 입장 API 호출 (큐에 진입)
 * @param request 요청 파라미터
 * @returns 게임 입장 응답
 */
export async function enterGame(request: GameEnterRequest): Promise<GameEnterResponse> {
  // POST 요청이지만 query 파라미터 사용 (백엔드 API 스펙에 맞춤)
  const baseUrl = API_BASE_URL || '';
  const url = baseUrl 
    ? `${baseUrl}/api/queue/enter?userId=${request.userId}&machineId=${request.machineId}`
    : `/api/queue/enter?userId=${request.userId}&machineId=${request.machineId}`;
  
  console.log('[Game API] ========== /api/queue/enter 호출 ==========');
  console.log('[Game API] URL:', url);
  console.log('[Game API] API_BASE_URL:', API_BASE_URL);
  console.log('[Game API] 요청 파라미터:', request);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  console.log('[Game API] 응답 상태:', response.status, response.statusText);
  console.log('[Game API] 응답 URL:', response.url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Game API] 오류 응답 본문:', errorText);
    console.error('[Game API] 응답 상태 코드:', response.status);
    console.error('[Game API] 요청 URL:', url);
    
    let errorMessage = `게임 입장 실패 (${response.status})`;
    let errorCode = null;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code || errorData.errorCode;
      console.error('[Game API] 파싱된 오류 응답:', errorData);
      console.error('[Game API] 에러 코드:', errorCode);
    } catch {
      errorMessage = errorText || errorMessage;
      console.error('[Game API] 오류 응답 파싱 실패, 원본 텍스트:', errorText);
    }
    
    // 创建包含错误代码的错误对象
    const error: any = new Error(errorMessage);
    error.code = errorCode;
    throw error;
  }

  const data = await response.json();
  console.log('[Game API] /api/queue/enter 응답:', data);
  console.log('[Game API] 응답 데이터 상세:', JSON.stringify(data, null, 2));
  
  // 检查业务逻辑错误的多种情况
  const isError = 
    data.success === false || 
    (data.message && (data.message === 'QUEUE_ENTERED' || data.message.includes('QUEUE_ENTERED'))) ||
    (data.error && data.error.includes('QUEUE_ENTERED'));
  
  if (isError) {
    console.warn('[Game API] ⚠️ 业务逻辑错误 감지');
    console.warn('[Game API] data:', data);
    console.warn('[Game API] data.success:', data.success);
    console.warn('[Game API] data.message:', data.message);
    console.warn('[Game API] data.error:', data.error);
    console.warn('[Game API] data.code:', data.code);
    console.warn('[Game API] data.errorCode:', data.errorCode);
    console.warn('[Game API] data.queueEntryId:', data.queueEntryId);
    
    // QUEUE_ENTERED 可能在 message 字段中
    const errorMessage = data.message || data.error || '게임 입장 실패';
    const errorCode = data.code || data.errorCode || (errorMessage === 'QUEUE_ENTERED' ? 'QUEUE_ENTERED' : null);
    
    console.warn('[Game API] 최종 에러 메시지:', errorMessage);
    console.warn('[Game API] 최종 에러 코드:', errorCode);
    
    const error: any = new Error(errorMessage);
    error.code = errorCode;
    error.rawData = data; // 保存原始数据用于调试
    
    console.warn('[Game API] 🚨 던질 에러 객체:', {
      message: error.message,
      code: error.code,
      rawData: error.rawData
    });
    
    throw error;
  }
  
  return data;
}

/**
 * 게임 하트비트 API 호출 (게임 진행 중 세션 유지)
 * @param request 요청 파라미터
 * @returns 하트비트 응답
 */
export async function sendHeartbeat(request: GameHeartbeatRequest): Promise<GameHeartbeatResponse> {
  const url = API_BASE_URL ? `${API_BASE_URL}/api/game/heartbeat` : '/api/game/heartbeat';
  
  console.log('[Game API] ========== /api/game/heartbeat 호출 ==========');
  console.log('[Game API] URL:', url);
  console.log('[Game API] API_BASE_URL:', API_BASE_URL);
  console.log('[Game API] 요청 데이터:', request);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  console.log('[Game API] 응답 상태:', response.status, response.statusText);
  console.log('[Game API] 응답 URL:', response.url);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Game API] 오류 응답 본문:', errorText);
    console.error('[Game API] 응답 상태 코드:', response.status);
    console.error('[Game API] 요청 URL:', url);
    
    let errorMessage = `하트비트 실패 (${response.status})`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
      console.error('[Game API] 파싱된 오류 응답:', errorData);
    } catch {
      errorMessage = errorText || errorMessage;
      console.error('[Game API] 오류 응답 파싱 실패, 원본 텍스트:', errorText);
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  console.log('[Game API] /api/game/heartbeat 응답:', data);
  
  return data;
}

