// 综述撰写工作流：管理综述撰写子项目的工作流（节点5）
window.ReviewWritingWorkflow = {
    // 初始化综述撰写子项目
    async init(subprojectId) {
        console.log('[ReviewWritingWorkflow] 初始化综述撰写子项目:', subprojectId);
        // 子项目数据已在 WorkflowDataLoader.loadCurrentProject 中加载
        // 这里可以添加额外的初始化逻辑，如加载关联的文献查找子项目的文献数据
    },

    // 从文献查找子项目导入文献
    async importLiteratureFromSubprojects(sourceSubprojectIds) {
        console.log('[ReviewWritingWorkflow] 从文献查找子项目导入文献:', sourceSubprojectIds);
        const state = window.WorkflowStateManager.state;
        if (!state.currentProject) {
            throw new Error('未选择项目');
        }

        const allSelectedLiterature = [];
        
        // 从每个源子项目中导入 selectedLiterature
        for (const sourceSubprojectId of sourceSubprojectIds) {
            const sourceSubproject = await window.SubprojectManager.getSubprojectData(
                state.currentProject,
                sourceSubprojectId
            );
            
            if (sourceSubproject && sourceSubproject.type === 'literatureSearch') {
                const selectedLit = sourceSubproject.node4?.selectedLiterature || [];
                allSelectedLiterature.push(...selectedLit);
            }
        }

        // 去重（基于文献ID或标题+URL）
        const uniqueLiterature = [];
        const seen = new Set();
        for (const lit of allSelectedLiterature) {
            const key = lit.id || `${lit.title}_${lit.url || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                // 添加初始编号（创建时的顺序）
                const literatureWithIndex = {
                    ...lit,
                    initialIndex: uniqueLiterature.length + 1,
                    actualIndex: null // 真正编号在生成综述后设置
                };
                uniqueLiterature.push(literatureWithIndex);
            }
        }

        // 更新当前子项目的 sourceSubprojectIds
        if (state.currentSubprojectId) {
            await window.SubprojectManager.updateSubproject(
                state.currentProject,
                state.currentSubprojectId,
                {
                    sourceSubprojectIds: sourceSubprojectIds
                }
            );
        }

        return uniqueLiterature;
    },

    // 生成综述
    async generateReview() {
        console.log('[ReviewWritingWorkflow] 生成综述');
        // 委托给 WorkflowManager 的节点5生成逻辑
        // 具体实现会在 WorkflowManager 中根据子项目类型调用
    }
};
