# 快速修复 redirect_uri_mismatch 错误

## 步骤 1：查看实际使用的 Redirect URI

1. 打开浏览器开发者工具（按 `F12` 或右键点击页面选择"检查"）
2. 切换到 **Console（控制台）** 标签页
3. 访问登录页面：`http://localhost:3000/login`
4. 点击 **"Continue with Google"** 按钮
5. 在控制台中查找以下信息：

```
========== Google OAuth 配置信息 ==========
Redirect URI: http://localhost:3000/oauth/callback/google
```

**重要**：复制这个 URI（应该类似 `http://localhost:3000/oauth/callback/google`）

## 步骤 2：在 Google Cloud Console 中配置

1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 确保选择了正确的项目
3. 在左侧菜单中，点击 **API 和服务** > **凭据**
4. 找到你的 OAuth 2.0 客户端 ID（Client ID 以 `642659304177-` 开头）
5. 点击客户端 ID 名称进入编辑页面
6. 滚动到 **已授权的重定向 URI** 部分
7. 点击 **+ 添加 URI** 按钮
8. 粘贴步骤 1 中复制的 URI（例如：`http://localhost:3000/oauth/callback/google`）
9. **确保 URI 完全一致**，包括：
   - ✅ 协议：`http://`（不是 `https://`）
   - ✅ 域名：`localhost`（不是 `127.0.0.1`）
   - ✅ 端口：`:3000`
   - ✅ 路径：`/oauth/callback/google`（没有结尾斜杠）
10. 点击 **保存** 按钮

## 步骤 3：配置已授权的 JavaScript 源（如果还没有）

在同一个编辑页面中，找到 **已授权的 JavaScript 源** 部分：

1. 点击 **+ 添加 URI** 按钮
2. 添加：`http://localhost:3000`（注意：这里没有路径，只有域名和端口）
3. 点击 **保存** 按钮

## 步骤 4：等待并测试

1. **等待 1-2 分钟**让 Google 的配置生效
2. 清除浏览器缓存或使用**无痕模式**（推荐）
3. 重新访问 `http://localhost:3000/login`
4. 点击 **"Continue with Google"** 按钮
5. 应该能够正常跳转到 Google 登录页面了

## 常见错误

### ❌ 错误示例 1：缺少端口号
```
http://localhost/oauth/callback/google  ← 错误！缺少 :3000
```

### ❌ 错误示例 2：使用了 https
```
https://localhost:3000/oauth/callback/google  ← 错误！应该用 http
```

### ❌ 错误示例 3：路径不对
```
http://localhost:3000/callback/google  ← 错误！应该是 /oauth/callback/google
```

### ✅ 正确配置
```
http://localhost:3000/oauth/callback/google  ← 正确！
```

## 如果仍然无法解决

1. **检查控制台日志**：确保复制的 URI 与 Google Cloud Console 中的完全一致
2. **检查多个配置**：确保没有配置了错误的 URI（比如 `https://` 版本）
3. **清除浏览器数据**：清除所有 Cookie 和缓存
4. **使用无痕模式**：排除浏览器扩展的干扰
5. **等待更长时间**：Google 配置可能需要几分钟才能生效

## 需要帮助？

如果按照以上步骤仍然无法解决，请提供：
1. 浏览器控制台中显示的完整配置信息（包括 Redirect URI）
2. Google Cloud Console 中配置的所有 Redirect URI 列表
3. 任何错误消息的截图

