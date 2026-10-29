# Firebase 框架说明（拼图游戏）

状态：**项目已创建并接通配置**（尚未接入主游戏 `index.html`，未发布游戏侧）。
- 账号：**amycai1973@gmail.com**
- 项目：**Family Photo Puzzle** / ID `amycai-photo-puzzle-1`
- Firestore 区域：**northamerica-northeast2（多伦多）**
- 计划：**Spark 免费**；不用 Cloud Functions；不开启 Blaze
- Web 应用：Family Photo Puzzle Web（配置已写入 `firebase-config.js`）

## 文件
| 文件 | 作用 |
|---|---|
| firebase-config.js | 已填入的 Web SDK 配置 |
| firebase-app.js | 初始化；getDb()、isFirebaseConfigured()；登录预留 |
| firestore-api.js | 集合 users / progress / levels |
| firestore.rules | 安全规则（默认拒绝；只能读写自己的；levels 公开只读；smoke 测试例外） |
| test-firestore.html | 中文读写测试页（smoke/_smoke_test） |

## 已完成
1. Firebase 项目创建（Console；原 ID `amycai-photo-puzzle` 被占用，故用 `-1`）
2. Firestore（多伦多）+ 规则已部署
3. Web 应用注册 + 本地配置已写入
4. Auth：Google + Email/Password（Console 启用中）
5. 授权域名需含 `amycai1973mia.github.io`（Console）

## 本地打开测试页
```
cd /workspace/puzzle-project/v1 && python3 -m http.server 8080
# 浏览器打开 http://localhost:8080/firebase/test-firestore.html
```

## 以后接入主游戏
`index.html` 目前**未引入** Firebase。准备好后再改。
