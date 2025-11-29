// 文献查找工作流：管理文献查找子项目的工作流（节点1-4）
window.LiteratureSearchWorkflow = {
    // 初始化文献查找子项目
    async init(subprojectId) {
        console.log('[LiteratureSearchWorkflow] 初始化文献查找子项目:', subprojectId);
        // 子项目数据已在 WorkflowDataLoader.loadCurrentProject 中加载
        // 这里可以添加额外的初始化逻辑
    },

    // 一键生成（节点1-4）
    async startAutoGenerate() {
        console.log('[LiteratureSearchWorkflow] 开始一键生成文献查找子项目');
        // 委托给 WorkflowManager 的一键生成逻辑
        // 具体实现会在 WorkflowManager 中根据子项目类型调用
    },

    // 保存子项目数据
    async saveSubprojectData(subprojectId, nodeData) {
        // 委托给 WorkflowDataLoader.saveNodeData
        // 具体实现已在 WorkflowDataLoader 中完成
    }
};

