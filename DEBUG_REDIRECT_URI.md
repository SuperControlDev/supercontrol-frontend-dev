# 🔍 Redirect URI Mismatch 详细调试步骤

## 步骤 1: 查看实际使用的 Redirect URI

1. **打开浏览器开发者工具**
   - 按 `F12` 或右键点击页面选择"检查"
   - 切换到 **Console（控制台）** 标签页

2. **访问登录页面**
   - 访问：`http://localhost:3000/login`

3. **点击 Google 登录按钮**
   - 点击 "Continue with Google" 按钮

4. **查看控制台输出**
   - 查找以下信息（应该会以红色高亮显示）：
   ```
   ========== Google OAuth 配置信息 ==========
   Redirect URI: http://localhost:3000/oauth/callback/google
   ============================================
   ```

5. **复制显示的 Redirect URI**
   - 应该类似：`http://localhost:3000/oauth/callback/google`
   - **重要**：完全复制这个 URI，包括协议、域名、端口、路径

## 步骤 2: 验证 Google Cloud Console 配置

### 2.1 访问 Google Cloud Console

1. 打开 [Google Cloud Console - 凭据页面](https://console.cloud.google.com/apis/credentials)
2. 确保选择了正确的项目
3. 在左侧菜单点击 **API 和服务** > **凭据**

### 2.2 找到你的 OAuth 客户端 ID

1. 找到 Client ID 为 `642659304177-el9f99rv2rbnt9lslt3q8eqk7mpnp9jc.apps.googleusercontent.com` 的条目
2. 点击客户端 ID 名称（不是编辑图标，而是名称本身）

### 2.3 检查已授权的重定向 URI

在 **已授权的重定向 URI** 部分，**必须包含**：

```
http://localhost:3000/oauth/callback/google
```

**检查要点：**
- ✅ 协议是 `http://`（不是 `https://`）
- ✅ 域名是 `localhost`（不是 `127.0.0.1`）
- ✅ 包含端口号 `:3000`
- ✅ 路径是 `/oauth/callback/google`（没有结尾斜杠 `/`）
- ✅ 没有多余的空格或特殊字符

### 2.4 检查已授权的 JavaScript 源

在 **已授权的 JavaScript 源** 部分，**必须包含**：

```
http://localhost:3000
```

**注意：** 这里只有域名和端口，没有路径。

### 2.5 保存配置

1. 如果 URI 不存在，点击 **+ 添加 URI** 按钮添加
2. 点击页面底部的 **保存** 按钮
3. **等待 1-2 分钟**让配置生效

## 步骤 3: 清除缓存并重新测试

1. **清除浏览器数据**
   - 按 `Ctrl+Shift+Delete` (Windows) 或 `Cmd+Shift+Delete` (Mac)
   - 选择清除 Cookie 和缓存
   - 或者使用**无痕模式**（推荐）

2. **重新测试**
   - 访问 `http://localhost:3000/login`
   - 打开开发者工具 Console
   - 点击 "Continue with Google"
   - 查看是否还有错误

## 步骤 4: 如果仍然失败 - 详细检查

### 4.1 验证实际发送的 URI

在控制台中，查找以下日志：

```
[Login] ========== OAuth URL 详细信息 ==========
[Login] 原始 Redirect URI: http://localhost:3000/oauth/callback/google
[Login] 编码后的 Redirect URI: http%3A%2F%2Flocalhost%3A3000%2Foauth%2Fcallback%2Fgoogle
[Login] 完整的 OAuth URL: https://accounts.google.com/o/oauth2/v2/auth?...
```

**检查：**
- 原始 Redirect URI 是否与 Google Cloud Console 中的完全一致
- 编码后的 URI 是否正确（应该包含 `%3A` 代表 `:`，`%2F` 代表 `/`）

### 4.2 检查 Google Cloud Console 中的所有 URI

在 Google Cloud Console 的编辑页面中，检查 **已授权的重定向 URI** 列表：

**应该包含：**
- `http://localhost:3000/oauth/callback/google` ✅
- `https://app.supercontrol.com/oauth/callback/google` ✅（生产环境）

**不应该包含：**
- `http://localhost/oauth/callback/google` ❌（缺少端口）
- `https://localhost:3000/oauth/callback/google` ❌（错误的协议）
- `http://127.0.0.1:3000/oauth/callback/google` ❌（不同的域名）
- `http://localhost:3000/oauth/callback/google/` ❌（有结尾斜杠）

### 4.3 使用测试工具

1. 在浏览器中打开：`file:///你的项目路径/test-redirect-uri.html`
2. 或者访问：`http://localhost:3000/test-redirect-uri.html`（如果放在 public 目录）
3. 这个工具会显示应该配置的确切 URI

## 步骤 5: 常见问题排查

### 问题 1: 配置已保存但仍有错误

**解决方案：**
- 等待更长时间（Google 配置可能需要几分钟）
- 清除浏览器 Cookie（特别是 Google 相关的）
- 使用无痕模式测试
- 尝试不同的浏览器

### 问题 2: 控制台显示的 URI 与 Google Cloud Console 中的不一致

**解决方案：**
- 确保 Google Cloud Console 中的 URI 与控制台显示的完全一致
- 检查是否有拼写错误
- 确保没有多余的空格

### 问题 3: 多个 OAuth 客户端 ID

**解决方案：**
- 确保使用的是正确的客户端 ID
- 检查 `.env` 文件中的 `VITE_GOOGLE_CLIENT_ID` 是否正确
- 确保 Google Cloud Console 中编辑的是同一个客户端 ID

## 需要帮助？

如果按照以上步骤仍然无法解决，请提供：

1. **浏览器控制台的完整输出**（截图或复制文本）
2. **Google Cloud Console 中配置的所有 Redirect URI 列表**（截图）
3. **当前访问的 URL**（例如：`http://localhost:3000`）
4. **任何错误消息的截图**

