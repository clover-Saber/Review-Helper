// 初始化页面
document.addEventListener('DOMContentLoaded', async () => {
    // 确保 WorkflowManager 已加载
    if (window.WorkflowManager) {
        await window.WorkflowManager.init();
    }
});
