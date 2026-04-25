# 83 RCON Tool

一个基于 Electron 的 Windows 桌面工具，用来连接和管理 `83` 服务器的 RCON。

当前版本重点覆盖这几块：

- 连接管理：连接、断开、保存配置、状态显示、日志输出
- 玩家管理：`help`、`listPlayers`、`kickPlayer`、`unbanPlayer`、`removePlayerRole`
- 地图管理：`listMaps`、`loadMap`、`setNextMap`、`listMapRotations`、`setMapRotation`
- 广播消息：`sendMessage`
- 界面体验：白天/夜间主题切换、本地图标、自动刷新玩家列表

## 当前功能

### 连接管理

- 输入服务器 IP、RCON 端口、RCON 密码
- 支持连接、断开、保存配置
- 本地保存最近一次配置，重启程序后自动回填
- 日志区显示连接过程、执行结果和错误信息

### 玩家管理

- 查看 `help`
- 查看玩家列表 `listPlayers`
- 踢出并封禁玩家 `kickPlayer`
- 解除封禁 `unbanPlayer`
- 移除玩家当前角色 `removePlayerRole`
- 连接成功后自动刷新一次玩家列表，之后每 30 秒自动刷新
- 保留手动刷新按钮

说明：

- `kickPlayer` 在 83 当前帮助信息中的语义是“踢出并封禁”
- 当前没有发现“查询已封禁玩家列表”的公开 RCON 命令

### 地图管理

- 查询地图列表 `listMaps`
- 立即加载地图 `loadMap`
- 设置下一张地图 `setNextMap`
- 查询地图池 `listMapRotations`
- 设置地图池 `setMapRotation`

说明：

- “立即加载地图”和“设置下一张地图”从地图列表中选择
- “设置地图池”从 `listMapRotations` 返回结果中选择

### 广播消息

- 向全服发送消息 `sendMessage`
- 广播输入区域位于左侧日志上方

## 技术栈

- Electron
- Node.js
- `rcon-client`

## 本地运行

先安装依赖：

```powershell
npm install
```

启动开发版：

```powershell
npm start
```

## 打包

### 1. 便携版

当前最稳定的打包方式是：

```powershell
npm run build
```

输出目录：

`dist\83 RCON Tool-win32-x64\`

主程序：

`dist\83 RCON Tool-win32-x64\83 RCON Tool.exe`

### 2. electron-builder 便携版

```powershell
npm run build:portable
```

### 3. 安装包

```powershell
npm run build:installer
```

说明：

- `build:portable` 和 `build:installer` 都依赖 `electron-builder`
- 在部分 Windows 10 环境下，如果系统没有开启开发者模式，可能会因为符号链接权限导致打包失败
- 遇到这类问题时，优先使用 `npm run build`

## 图标

项目图标资源位于：

- `assets/icon.ico`
- `assets/icon.png`

当前已经接入：

- 应用窗口图标
- 便携版 exe 图标
- NSIS 安装包图标

## 配置说明

服务器 IP、RCON 端口和密码没有写死在代码里。

程序会：

- 从界面读取当前输入
- 在你点击“保存配置”后写入本地配置文件
- 下次启动时再自动加载

## 仓库

GitHub：

[https://github.com/MyEnergyFiled/rcon-for-83.git](https://github.com/MyEnergyFiled/rcon-for-83.git)
