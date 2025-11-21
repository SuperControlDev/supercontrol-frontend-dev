# 원격 인형뽑기 서비스 프론트엔드

React + TypeScript로 개발된 원격 인형뽑기 서비스 프론트엔드 애플리케이션입니다.

## 기술 스택

- **React 18** - UI 프레임워크
- **TypeScript** - 타입 안전성
- **Vite** - 빌드 도구
- **Socket.io Client** - WebSocket 통신
- **React Router** - 라우팅 관리

## 프로젝트 구조

```
src/
├── components/          # 컴포넌트
│   ├── GameControl.tsx  # 게임 제어 패널
│   ├── GameStatus.tsx   # 게임 상태 표시
│   └── GameVideo.tsx    # 비디오 스트림 표시
├── contexts/            # Context
│   └── SocketContext.tsx # Socket 연결 관리
├── pages/               # 페이지
│   ├── LoginPage.tsx    # 로그인 페이지
│   ├── HomePage.tsx     # 홈페이지 (기기 선택)
│   └── GamePage.tsx     # 게임 페이지
├── types/               # 타입 정의
│   ├── session.ts       # Session 데이터 구조
│   └── socket.ts        # Socket 이벤트 타입
├── App.tsx              # 메인 애플리케이션 컴포넌트
└── main.tsx             # 진입점 파일
```

## 설치 및 실행

### 의존성 설치

```bash
npm install
```

### 개발 모드

```bash
npm run dev
```

애플리케이션은 http://localhost:3000 에서 시작됩니다.

### 프로덕션 빌드

```bash
npm run build
```

## 환경 변수

`.env` 파일을 생성하여 Socket 서버 주소를 설정합니다:

```
VITE_SOCKET_URL=http://localhost:8080
```

## 테스트 계정

개발 단계에서 다음 테스트 계정을 사용하여 로그인할 수 있습니다:

- **사용자명**: `admin` / **비밀번호**: `admin123`
- **사용자명**: `test` / **비밀번호**: `test123`
- **사용자명**: `user` / **비밀번호**: `user123`

> 참고: 이러한 테스트 계정은 개발 테스트용으로만 사용되며, 실제 애플리케이션에서는 백엔드 API에 연결하여 실제 사용자 인증을 수행해야 합니다.

## 기능 특성

### 1. Socket 통신 모듈
- 자동 연결/재연결 메커니즘
- Session 관리 (생성, 참가, 나가기)
- 게임 제어 명령 전송
- 실시간 상태 업데이트 수신

### 2. 페이지 기능
- **로그인 페이지**: 사용자 로그인 및 Socket 연결
- **홈페이지**: 기기 목록 및 선택
- **게임 페이지**: 실시간 비디오 스트림, 게임 제어 및 상태 표시

### 3. 게임 제어
- 방향 제어 (앞뒤좌우)
- 높이 제어 (상승/하강)
- 동작 제어 (잡기, 놓기)

## Socket 이벤트

### 클라이언트 전송
- `session:create` - Session 생성
- `session:join` - Session 참가
- `session:leave` - Session 나가기
- `game:move` - 클로 이동
- `game:drop` - 클로 내리기
- `game:grab` - 잡기

### 서버 전송
- `session:created` - Session 생성 성공
- `session:joined` - Session 참가 성공
- `session:updated` - Session 상태 업데이트
- `session:ended` - Session 종료
- `game:state` - 게임 상태 업데이트
- `game:result` - 게임 결과
- `error` - 오류 정보

## 개발 설명

### Session 데이터 구조

`src/types/session.ts`의 타입 정의를 참조하세요. 포함 내용:
- Session 상태 (idle, connecting, playing, ended)
- 게임 상태 (위치, 클로 상태 등)
- 사용자 정보
- 기기 정보

### 사용자 정의 설정

실제 백엔드 인터페이스에 따라 조정:
1. Socket 서버 주소 (`src/contexts/SocketContext.tsx`)
2. 이벤트 이름 및 데이터 구조 (`src/types/socket.ts`)
3. 비디오 스트림 URL 가져오기 로직 (`src/components/GameVideo.tsx`)

## 미완성 기능

- [ ] 비디오 스트림 통합 (WebRTC/HLS)
- [ ] 사용자 인증 및 권한 부여
- [ ] 잔액 관리
- [ ] 게임 기록 및 이력
- [ ] 오류 처리 및 재시도 메커니즘
- [ ] 반응형 디자인 최적화

## License

MIT
