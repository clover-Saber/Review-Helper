// Electron API 已在 workflow.html 中通过 modules/electron-api.js 加载

// 主入口：初始化工作流
document.addEventListener('DOMContentLoaded', function() {
    // 检查所有模块是否已加载
    if (!window.WorkflowManager) {
        console.error('WorkflowManager模块未加载');
        return;
    }

    // 初始化工作流管理器
    window.WorkflowManager.init();
});
