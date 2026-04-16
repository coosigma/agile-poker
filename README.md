# Agile Poker

一个适合 Scrum 团队做 ticket sizing 的单页应用：

- 前端：TypeScript + React + Vite
- 通信：WebSocket
- 后端：Node.js + Express + ws
- 特点：无需登录，通过分享房间链接即可协作

## 功能

- 无房间 ID 时，首页提供“大按钮”模式选择：新建房间 / 加入已有房间
- URL 中已有房间 ID 时，会先落在昵称输入页，再进入房间
- 新建房间的人自动成为主持人，可编辑议题、开启倒计时新一轮、翻牌 review
- 加入已有房间前会先校验房间是否存在
- 房间中央是椭圆会议桌，成员会沿桌边平均排开
- 开启新一轮时展示 `3 / 2 / 1` 倒计时，步进间隔约 `0.6s`
- 支持标准斐波那契估算卡，以及 `♭ / 标准 / ♯` 细粒度偏移
- 翻牌后显示票型分布，并按 `♭ / ♯` 修正值计算算术平均

## 本地开发

当前环境未安装 `node` / `npm`，所以下面是标准启动方式：

```bash
npm install
npm run dev
```

默认会启动：

- 前端开发服务器：`http://localhost:5173`
- HTTP / WebSocket 服务：`http://localhost:8787` / `ws://localhost:8787/ws`

`vite` 已配置为监听 `0.0.0.0`，所以在同一局域网内也可以直接访问并共享链接。

## 生产构建

```bash
npm install
npm run build
npm start
```

生产模式下，后端会同时托管前端静态资源。

## 共享方式

应用会生成形如下面的链接：

```text
http://your-host:5173/?room=ABC123
```

把这个链接发给团队成员即可进入同一个 sizing 房间。

## 后续可扩展方向

- 增加主持人权限
- 增加 observer 模式
- 持久化房间历史
- 增加 Jira / Linear ticket 导入
