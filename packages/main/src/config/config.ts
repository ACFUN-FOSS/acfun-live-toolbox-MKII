export default {
    port: 12590,
    applications: [],
    // 弹幕服务配置
    debug: false,
    connectionMode: 'tcp',
    logLevel: 'info',
    // 直播管理配置
    rtmpServer: 'rtmp://push.acfun.cn/live',
    defaultCoverUrl: '',
    roomId: '',
    streamKey: '',
    // OBS连接配置
    obsIp: 'localhost',
    obsPort: 4455,
    obsPassword: '',
    // 安全配置
    security: {
        autoScan: true,
        permissionAudit: true,
        runtimeMonitoring: true
    },
    // 快捷键配置
    shortcuts: {},
    // 通知配置
    notification: {
        enabled: true,
        sound: true,
        displayDuration: 5000
    },
    // 认证配置
    auth: {
        autoLogin: false,
        lastLoginUser: null
    }
}