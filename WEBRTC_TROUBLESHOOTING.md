# WebRTC 连接问题排查指南

## 错误信息
```
Scope resolver failed for the playback name and / or scope
```

这个错误表示 Red5 服务器无法解析应用名称（app）或流名称（streamName）。

## 排查步骤

### 步骤 1: 验证应用是否存在

**检查应用路径是否可以访问：**

在浏览器中访问：
```
http://192.168.45.48:5080/live
```

**预期结果：**
- 如果应用存在，应该返回 200 或显示应用信息
- 如果返回 404，说明应用名称不正确

**解决方案：**
- 检查 Red5 服务器配置，确认应用名称是否为 `live`
- 如果应用名称不同，修改 `GamePage.tsx` 中的 `app` 参数

---

### 步骤 2: 验证流是否存在

**检查流是否正在推流：**

在浏览器中访问：
```
http://192.168.45.48:5080/live/mystream/playlist.m3u8
```

**预期结果：**
- 如果流存在，应该返回 HLS 播放列表（.m3u8 文件）
- 如果返回 404，说明流不存在或名称不正确

**解决方案：**
1. 确认 OBS 正在推流到：`rtmp://192.168.45.48:1935/live/mystream`
2. 确认流名称完全匹配（区分大小写）
3. 等待几秒钟让流完全启动后再测试

---

### 步骤 3: 检查浏览器控制台日志

**打开浏览器开发者工具（F12），查看控制台输出：**

查找以下日志：
```
[Red5 Pro SDK] ========== 连接前验证 ==========
[Red5 Pro SDK] 配置参数: {...}
[Red5 Pro SDK] 测试应用路径: http://192.168.45.48:5080/live
[Red5 Pro SDK] 应用路径响应: 200 OK
[Red5 Pro SDK] 测试流路径: http://192.168.45.48:5080/live/mystream/playlist.m3u8
[Red5 Pro SDK] 流路径响应: 200 OK
```

**检查点：**
- 应用路径响应状态码（应该是 200）
- 流路径响应状态码（应该是 200，如果是 404 说明流不存在）

---

### 步骤 4: 验证 WHEP 端点

**检查 WHEP 端点是否可用：**

在浏览器中访问以下 URL（使用 POST 请求，可能需要使用 Postman 或 curl）：

```bash
# 使用 curl 测试 WHEP 端点
curl -X POST http://192.168.45.48:5080/live/whep/mystream \
  -H "Content-Type: application/sdp" \
  -d "v=0..."
```

**或者尝试其他可能的端点：**
- `http://192.168.45.48:5080/live/subscribe/mystream`
- `http://192.168.45.48:5080/whep/live/mystream`

**预期结果：**
- 如果端点存在，应该返回 SDP answer
- 如果返回 404，说明 WHEP 端点路径不正确

---

### 步骤 5: 检查 Red5 服务器配置

**确认以下配置：**

1. **应用配置：**
   - 应用名称：`live`
   - 应用路径：`/live`

2. **WHEP 插件：**
   - WHEP 插件已启用
   - WHEP 端点路径配置正确

3. **流配置：**
   - 流名称：`mystream`
   - 流正在推流中

**查看 Red5 服务器日志：**
- 检查服务器日志中是否有相关错误信息
- 查看是否有 "Scope resolver failed" 相关错误

---

### 步骤 6: 尝试使用 iframe 模式

如果 SDK 模式无法工作，可以尝试使用 iframe 模式：

在 `GamePage.tsx` 中修改：
```typescript
<WebRTCPlayer 
  // ... 其他属性
  useSDKPlayer={false} // 改为 false，使用 iframe 模式
/>
```

iframe 模式会直接加载 `viewer.jsp` 页面，如果这个页面可以播放，说明服务器配置正常，问题在于 SDK 的连接配置。

---

### 步骤 7: 检查网络连接

**确认网络连接：**

1. 从浏览器访问 Red5 服务器：
   ```
   http://192.168.45.48:5080
   ```

2. 检查是否有 CORS 错误：
   - 打开浏览器开发者工具
   - 查看 Network 标签页
   - 检查是否有 CORS 相关错误

---

### 步骤 8: 验证配置参数

**确认以下参数是否正确：**

在 `GamePage.tsx` 中：
- `red5Host`: `192.168.45.48`
- `red5Port`: `5080`
- `app`: `live`
- `streamName`: `mystream`

**在浏览器控制台中检查：**
```javascript
// 在控制台中运行
console.log('配置检查:', {
  host: '192.168.45.48',
  port: 5080,
  app: 'live',
  streamName: 'mystream'
});
```

---

## 常见问题解决方案

### 问题 1: 应用不存在

**症状：** 应用路径返回 404

**解决方案：**
- 检查 Red5 服务器配置
- 确认应用名称是否正确
- 如果应用名称不同，修改代码中的 `app` 参数

### 问题 2: 流不存在

**症状：** 流路径返回 404

**解决方案：**
1. 确认 OBS 正在推流
2. 检查推流 URL 是否正确：`rtmp://192.168.45.48:1935/live/mystream`
3. 等待几秒钟让流完全启动
4. 确认流名称完全匹配（区分大小写）

### 问题 3: WHEP 端点不正确

**症状：** WHEP 端点返回 404

**解决方案：**
1. 检查 Red5 服务器 WHEP 插件配置
2. 确认 WHEP 端点路径格式
3. 尝试不同的端点路径格式

### 问题 4: 许可证问题

**症状：** 许可证相关错误

**解决方案：**
- 如果使用商业版 Red5 Pro，确认许可证密钥正确
- 如果使用开源版本，可能不需要许可证

---

## 调试命令

### 在浏览器控制台中运行：

```javascript
// 测试应用路径
fetch('http://192.168.45.48:5080/live', { method: 'HEAD' })
  .then(r => console.log('应用路径:', r.status, r.statusText))
  .catch(e => console.error('应用路径错误:', e));

// 测试流路径
fetch('http://192.168.45.48:5080/live/mystream/playlist.m3u8', { method: 'HEAD' })
  .then(r => console.log('流路径:', r.status, r.statusText))
  .catch(e => console.error('流路径错误:', e));

// 检查 SDK 是否加载
console.log('Red5 Pro SDK:', window.red5prosdk ? '已加载' : '未加载');
if (window.red5prosdk) {
  console.log('SDK 属性:', Object.keys(window.red5prosdk));
  console.log('WHEPClient:', window.red5prosdk.WHEPClient ? '可用' : '不可用');
}
```

---

## 下一步

如果以上步骤都无法解决问题，请：

1. 收集以下信息：
   - 浏览器控制台的完整日志
   - Red5 服务器日志
   - 网络请求详情（Network 标签页）

2. 检查 Red5 服务器文档：
   - WHEP 端点配置
   - 应用和流的配置要求

3. 考虑使用 iframe 模式作为临时解决方案

