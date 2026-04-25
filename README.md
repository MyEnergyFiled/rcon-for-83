# 83 RCON Tool

一个运行在 Windows 上的 Electron 桌面小工具，用于连接 83 的 RCON 服务器并执行基础管理操作。

## 当前进度

- 已完成: 连接管理
- 已完成: 玩家管理首版
- 预留: 服务器管理、地图管理

当前玩家管理支持:
- 获取玩家列表
- 踢出玩家
- 解除封禁
- 移除玩家角色

## 开发

```powershell
npm install
npm start
```

## 打包

```powershell
npm run build
```

打包完成后，可执行文件位于 `dist\83 RCON Tool-win32-x64\83 RCON Tool.exe`。
