# Google OAuth 配置指南

## 重定向 URI 配置

应用程序使用自定义的重定向 URI：`https://app.supercontrol.com/oauth/callback/google`

## 在 Google Cloud Console 中配置

### 1. 访问 Google Cloud Console

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择你的项目（或创建新项目）
3. 导航到 **API 和服务** > **凭据**
4. 找到你的 OAuth 2.0 客户端 ID（Client ID: `642659304177-el9f99rv2rbnt9lslt3q8eqk7mpnp9jc.apps.googleusercontent.com`）
5. 点击客户端 ID 名称进入编辑页面

### 2. 配置已授权的 JavaScript 源

在 **已授权的 JavaScript 源** 部分，添加：
- `https://app.supercontrol.com`（生产环境）
- `http://localhost:3000`（开发环境，如果需要）

### 3. 配置已授权的重定向 URI

在 **已授权的重定向 URI** 部分，添加：
- `https://app.supercontrol.com/oauth/callback/google`（生产环境）
- `http://localhost:3000/oauth/callback/google`（开发环境，**必须添加**）
- `http://127.0.0.1:3000/oauth/callback/google`（开发环境备选，如果需要）

> **重要**：应用程序会根据当前访问的域名自动选择 redirect_uri：
> - 如果访问 `http://localhost:3000`，会自动使用 `http://localhost:3000/oauth/callback/google`
> - 如果访问生产域名，会自动使用 `https://app.supercontrol.com/oauth/callback/google`
> 
> 因此，**必须**在 Google Cloud Console 中同时配置开发和生产环境的 redirect_uri。

### 4. 保存配置

点击 **保存** 按钮保存配置。

## 错误：redirect_uri_mismatch

如果遇到 `错误 400：redirect_uri_mismatch`，请检查：

1. 重定向 URI 是否完全匹配（包括协议、域名、路径）
2. 配置是否已保存并生效（可能需要几分钟）
3. 环境变量 `VITE_GOOGLE_REDIRECT_URI` 是否设置正确（可选，默认为 `https://app.supercontrol.com/oauth/callback/google`）

### 5. 重要提示

- URI 必须**完全匹配**，包括：
  - 协议（`http` vs `https`）
  - 域名（`localhost` vs `127.0.0.1`）
  - 端口号（`:3000`）
  - 路径和结尾斜杠
  
- `https://app.supercontrol.com/oauth/callback/google` 和 `https://app.supercontrol.com/oauth/callback/google/` 被视为**不同的 URI**

- 配置更改可能需要几分钟才能生效

### 6. 验证配置

配置完成后，重新启动开发服务器并测试 Google 登录：

```bash
npm run dev
```

访问登录页面并点击 "Continue with Google" 按钮。登录成功后会自动跳转到回调页面处理 OAuth 响应。

## 当前配置

- **Client ID**: `642659304177-el9f99rv2rbnt9lslt3q8eqk7mpnp9jc.apps.googleusercontent.com`
- **Redirect URI（自动选择）**:
  - 开发环境：`http://localhost:3000/oauth/callback/google`（自动检测）
  - 生产环境：`https://app.supercontrol.com/oauth/callback/google`（自动检测）
- **OAuth Flow**: `implicit` (纯前端实现)
- **回调路由**: `/oauth/callback/google`

## 环境变量配置（可选）

如果需要手动指定 redirect_uri，可以在 `.env` 文件中设置：

```bash
VITE_GOOGLE_CLIENT_ID=642659304177-el9f99rv2rbnt9lslt3q8eqk7mpnp9jc.apps.googleusercontent.com
VITE_GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback/google  # 可选，不设置则自动检测
```

如果不设置 `VITE_GOOGLE_REDIRECT_URI`，应用程序会根据当前访问的域名自动选择正确的 redirect_uri。

## 参考链接

- [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
- [@react-oauth/google 文档](https://www.npmjs.com/package/@react-oauth/google)

