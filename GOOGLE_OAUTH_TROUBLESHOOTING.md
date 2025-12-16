# Google OAuth redirect_uri_mismatch 错误排查指南

## 错误说明

如果遇到 `错误 400：redirect_uri_mismatch`，这意味着代码中使用的 redirect_uri 与 Google Cloud Console 中配置的 redirect_uri 不匹配。

## 快速检查步骤

### 1. 查看控制台日志

点击 Google 登录按钮后，打开浏览器开发者工具（F12），查看 Console 标签页。你应该能看到类似以下的日志：

```
[Login] ========== Google OAuth 配置信息 ==========
[Login] Client ID: 642659304177-el9f99...
[Login] Redirect URI: http://localhost:3000/oauth/callback/google
[Login] Scope: openid email profile
[Login] Response Type: token
[Login] ============================================
```

**重要**：记下日志中显示的 `Redirect URI`，这个 URI 必须与 Google Cloud Console 中配置的完全一致。

### 2. 检查 Google Cloud Console 配置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 导航到 **API 和服务** > **凭据**
3. 找到你的 OAuth 2.0 客户端 ID（`642659304177-el9f99rv2rbnt9lslt3q8eqk7mpnp9jc.apps.googleusercontent.com`）
4. 点击客户端 ID 名称进入编辑页面
5. 检查 **已授权的重定向 URI** 部分

### 3. 确保 URI 完全匹配

URI 必须**完全一致**，包括：

- ✅ **协议**：`http` vs `https`（必须一致）
- ✅ **域名**：`localhost` vs `127.0.0.1`（被视为不同的域名）
- ✅ **端口号**：`:3000`（必须包含）
- ✅ **路径**：`/oauth/callback/google`（必须完全一致）
- ✅ **结尾斜杠**：`/oauth/callback/google` vs `/oauth/callback/google/`（被视为不同的 URI）

### 4. 常见配置示例

#### 开发环境（localhost:3000）

在 Google Cloud Console 中，**已授权的重定向 URI** 应该包含：

```
http://localhost:3000/oauth/callback/google
```

**注意**：
- 使用 `http://` 而不是 `https://`
- 使用 `localhost` 而不是 `127.0.0.1`
- 包含端口号 `:3000`
- 路径是 `/oauth/callback/google`（没有结尾斜杠）

#### 生产环境

```
https://app.supercontrol.com/oauth/callback/google
```

### 5. 已授权的 JavaScript 源

同时确保在 **已授权的 JavaScript 源** 部分添加了：

- 开发环境：`http://localhost:3000`
- 生产环境：`https://app.supercontrol.com`

## 常见错误

### 错误 1：缺少端口号

❌ **错误配置**：
```
http://localhost/oauth/callback/google
```

✅ **正确配置**：
```
http://localhost:3000/oauth/callback/google
```

### 错误 2：使用了 https 而不是 http（开发环境）

❌ **错误配置**：
```
https://localhost:3000/oauth/callback/google
```

✅ **正确配置**：
```
http://localhost:3000/oauth/callback/google
```

### 错误 3：路径不匹配

❌ **错误配置**：
```
http://localhost:3000/oauth/callback/google/
http://localhost:3000/callback/google
http://localhost:3000/oauth/google
```

✅ **正确配置**：
```
http://localhost:3000/oauth/callback/google
```

### 错误 4：使用了 127.0.0.1 而不是 localhost

虽然功能上相同，但 Google 将它们视为不同的域名：

❌ **可能不匹配**（如果代码使用 localhost）：
```
http://127.0.0.1:3000/oauth/callback/google
```

✅ **正确配置**（与代码一致）：
```
http://localhost:3000/oauth/callback/google
```

## 验证步骤

1. **保存 Google Cloud Console 配置**
   - 点击"保存"按钮
   - 等待几分钟让配置生效

2. **清除浏览器缓存**
   - 清除浏览器缓存和 Cookie
   - 或者使用无痕模式测试

3. **重新测试**
   - 重新启动开发服务器（如果正在运行）
   - 访问 `http://localhost:3000/login`
   - 点击 "Continue with Google" 按钮
   - 查看控制台日志，确认使用的 redirect_uri

4. **检查错误信息**
   - 如果仍然出错，查看 Google 返回的错误页面
   - 错误页面通常会显示期望的 redirect_uri 和实际使用的 redirect_uri
   - 对比两者，找出差异

## 手动设置 redirect_uri（可选）

如果需要手动指定 redirect_uri，可以在 `.env` 文件中设置：

```bash
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback/google
```

然后重新启动开发服务器。

## 仍然无法解决？

如果按照以上步骤仍然无法解决，请检查：

1. 是否使用了正确的 OAuth 客户端 ID
2. 是否在正确的 Google Cloud 项目中配置
3. 浏览器控制台是否有其他错误信息
4. 网络连接是否正常

## 联系支持

如果问题持续存在，请提供以下信息：
- 浏览器控制台中的完整日志
- Google Cloud Console 中配置的 redirect_uri 列表
- 实际访问的 URL（例如：`http://localhost:3000`）

