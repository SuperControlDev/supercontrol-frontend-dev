# 远程抓娃娃服务前端

基于 React + TypeScript 开发的远程抓娃娃服务前端应用。

## 技术栈

- **React 18** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **Socket.io Client** - WebSocket通信
- **React Router** - 路由管理

## 项目结构

```
src/
├── components/          # 组件
│   ├── GameControl.tsx  # 游戏控制面板
│   ├── GameStatus.tsx   # 游戏状态显示
│   └── GameVideo.tsx    # 视频流显示
├── contexts/            # Context
│   └── SocketContext.tsx # Socket连接管理
├── pages/               # 页面
│   ├── LoginPage.tsx    # 登录页面
│   ├── HomePage.tsx     # 主页（选择机器）
│   └── GamePage.tsx     # 游戏页面
├── types/               # 类型定义
│   ├── session.ts       # Session数据结构
│   └── socket.ts        # Socket事件类型
├── App.tsx              # 主应用组件
└── main.tsx             # 入口文件
```

## 安装和运行

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

## 环境变量

创建 `.env` 文件配置Socket服务器地址：

```
VITE_SOCKET_URL=http://localhost:8080
```

## 测试账号

开发阶段可以使用以下测试账号登录：

- **用户名**: `admin` / **密码**: `admin123`
- **用户名**: `test` / **密码**: `test123`
- **用户名**: `user` / **密码**: `user123`

> 注意：这些测试账号仅用于开发测试，实际应用中应该连接后端API进行真实的用户认证。

## 功能特性

### 1. Socket通信模块
- 自动连接/重连机制
- Session管理（创建、加入、离开）
- 游戏控制指令发送
- 实时状态更新接收

### 2. 页面功能
- **登录页面**: 用户登录和Socket连接
- **主页**: 机器列表和选择
- **游戏页面**: 实时视频流、游戏控制和状态显示

### 3. 游戏控制
- 方向控制（前后左右）
- 高度控制（上升下降）
- 动作控制（抓取、放下）

## Socket事件

### 客户端发送
- `session:create` - 创建Session
- `session:join` - 加入Session
- `session:leave` - 离开Session
- `game:move` - 移动爪子
- `game:drop` - 放下爪子
- `game:grab` - 抓取

### 服务器发送
- `session:created` - Session创建成功
- `session:joined` - 加入Session成功
- `session:updated` - Session状态更新
- `session:ended` - Session结束
- `game:state` - 游戏状态更新
- `game:result` - 游戏结果
- `error` - 错误信息

## 开发说明

### Session数据结构

参考 `src/types/session.ts` 中的类型定义，包括：
- Session状态（idle, connecting, playing, ended）
- 游戏状态（位置、爪子状态等）
- 用户信息
- 机器信息

### 自定义配置

根据实际后端接口调整：
1. Socket服务器地址（`src/contexts/SocketContext.tsx`）
2. 事件名称和数据结构（`src/types/socket.ts`）
3. 视频流URL获取逻辑（`src/components/GameVideo.tsx`）

## 待完成功能

- [ ] 视频流集成（WebRTC/HLS）
- [ ] 用户认证和授权
- [ ] 余额管理
- [ ] 游戏记录和历史
- [ ] 错误处理和重试机制
- [ ] 响应式设计优化

## License

MIT

