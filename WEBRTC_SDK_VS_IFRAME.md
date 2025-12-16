# WebRTC SDK 模式 vs iframe 模式分析

## 问题现象

- ✅ **iframe 模式可以正常播放**
- ❌ **SDK 模式无法播放**（错误：Scope resolver failed for the playback name and / or scope）

## 原因分析

既然 iframe 可以播放，说明：
1. ✅ 流存在且正常推流
2. ✅ 服务器配置正常
3. ✅ 应用名称和流名称正确
4. ❌ **问题在于 SDK 的连接配置**

## 可能的原因

### 1. WHEP 端点路径不正确

**iframe 模式：**
- 使用 `viewer.jsp` 页面，服务器端处理所有连接逻辑
- 不依赖特定的 WHEP 端点路径

**SDK 模式：**
- 需要直接连接到 WHEP 端点
- SDK 默认构建的路径可能是：`/{app}/whep/{streamName}`
- 但服务器可能使用不同的路径格式

**可能的端点格式：**
- `/live/whep/mystream` (标准格式)
- `/live/subscribe/mystream` (替代格式)
- `/whep/live/mystream` (另一种格式)
- `/live/webrtc/mystream` (WebRTC 格式)

### 2. 协议或端口配置问题

**当前配置：**
- 协议：`http`
- 端口：`5080`
- 主机：`192.168.45.48`

**可能的问题：**
- WHEP 可能需要使用 WebSocket 协议（`ws://` 或 `wss://`）
- 可能需要使用不同的端口（如 `8081` 用于 WebSocket）
- 某些服务器可能需要 HTTPS

### 3. SDK 配置参数不完整

**当前配置：**
```javascript
{
  protocol: 'http',
  host: '192.168.45.48',
  port: 5080,
  app: 'live',
  streamName: 'mystream',
  rtcConfiguration: {...},
  mediaElement: video,
  licenseKey: '...'
}
```

**可能缺少的参数：**
- `connectionParams` - 额外的连接参数
- `endpoint` - 自定义端点路径
- 其他服务器特定的配置

### 4. SDK 版本兼容性问题

- Red5 Pro SDK 15.0.0+ 使用 WHEPClient
- 但服务器可能使用旧版本的 API
- 可能需要使用 `RTCSubscriber` 而不是 `WHEPClient`

## 解决方案

### 方案 1: 检查 WHEP 端点路径

在浏览器 Network 标签页中查看 SDK 实际请求的 URL：
1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签页
3. 点击开始游戏，触发 SDK 连接
4. 查找失败的请求，查看请求 URL

**预期看到的请求：**
- `POST http://192.168.45.48:5080/live/whep/mystream`
- 或其他类似的端点

**如果返回 404：**
- 说明端点路径不正确
- 需要检查服务器配置，确认正确的 WHEP 端点路径

### 方案 2: 尝试使用 WebSocket 协议

修改配置使用 WebSocket：
```javascript
{
  protocol: 'ws',  // 或 'wss' (如果使用 HTTPS)
  host: '192.168.45.48',
  port: 8081,  // WebSocket 端口
  app: 'live',
  streamName: 'mystream',
  // ...
}
```

### 方案 3: 使用旧版 API (RTCSubscriber)

如果 WHEPClient 不工作，尝试使用 RTCSubscriber：
- 修改代码使用 `RTCSubscriber` 而不是 `WHEPClient`
- 使用 WebSocket 协议连接

### 方案 4: 检查服务器日志

查看 Red5 服务器日志：
- 查看服务器收到的请求
- 查看错误信息
- 确认服务器期望的端点格式

### 方案 5: 继续使用 iframe 模式

如果 SDK 模式无法修复：
- iframe 模式已经可以正常工作
- 可以继续使用 iframe 模式
- 或者联系服务器管理员配置正确的 WHEP 端点

## 调试步骤

1. **查看 Network 请求：**
   - 打开浏览器开发者工具
   - 切换到 Network 标签页
   - 触发 SDK 连接
   - 查看实际请求的 URL 和响应

2. **检查控制台日志：**
   - 查看 `[Red5 Pro SDK]` 相关的日志
   - 查看错误堆栈信息
   - 确认 SDK 使用的端点路径

3. **测试 WHEP 端点：**
   ```bash
   # 使用 curl 测试不同的端点
   curl -X POST http://192.168.45.48:5080/live/whep/mystream
   curl -X POST http://192.168.45.48:5080/live/subscribe/mystream
   curl -X POST http://192.168.45.48:5080/whep/live/mystream
   ```

4. **检查服务器配置：**
   - 查看 Red5 服务器配置文件
   - 确认 WHEP 插件配置
   - 确认端点路径格式

## 建议

由于 iframe 模式已经可以正常工作，建议：
1. **优先使用 iframe 模式**（当前已配置）
2. 如果需要 SDK 模式，需要：
   - 确认服务器 WHEP 端点路径
   - 调整 SDK 配置以匹配服务器
   - 或者联系服务器管理员配置正确的端点

