// 数据管理模块：处理项目数据的保存和加载
window.DataManager = {
    // 保存项目数据（合并模式）
    async saveProjectData(projectName, patch) {
        if (!projectName) {
            throw new Error('未选择项目');
        }

        // 合并数据
        const existing = await window.electronAPI.loadProjectData(projectName);
        const base = (existing && existing.success && existing.data) ? existing.data : {};
        const merged = this.deepMerge(base, patch);
        
        // 清理根级别的旧字段（这些字段应该保存在对应的节点中）
        // 确保数据格式统一：所有节点数据都保存在对应的 nodeX 中
        
        // 节点1：清理根级别的 keywords 和 requirementData.keywordsPlan
        if (merged.node1) {
            delete merged.keywords; // 应该保存在 node1.keywords
            if (merged.requirementData && merged.requirementData.keywordsPlan !== undefined) {
                delete merged.requirementData.keywordsPlan; // 应该保存在 node1.keywordsPlan
            }
        }
        
        // 节点2：只保存 searchResults，不保存 allLiterature
        if (merged.node2) {
            // 节点2不应该包含 allLiterature（那是节点3的数据）
            if (merged.node2.allLiterature !== undefined) {
                delete merged.node2.allLiterature;
            }
            // 清理根级别的 search.results（兼容旧格式，但优先使用 node2.searchResults）
            if (merged.search && merged.search.results && merged.node2.searchResults) {
                // 保留 search.results 用于兼容，但优先使用 node2.searchResults
            }
        }
        
        // 节点3：清理根级别的 finalResults
        if (merged.node3) {
            delete merged.finalResults; // 应该保存在 node3.allLiterature
        }
        
        // 节点4：清理根级别的 selectedLiterature 和 organizedData
        if (merged.node4) {
            delete merged.selectedLiterature; // 应该保存在 node4.selectedLiterature
            delete merged.organizedData; // 应该保存在 node4.selectedLiterature
        }
        
        // 节点5：清理根级别的 reviewContent 和 review
        if (merged.node5) {
            delete merged.reviewContent; // 应该保存在 node5.reviewContent
            delete merged.review; // 应该保存在 node5.reviewContent
        }
        
        // 额外清理：如果所有节点都存在，确保根级别没有旧字段
        if (merged.node1 && merged.node2 && merged.node3 && merged.node4 && merged.node5) {
            delete merged.finalResults;
            delete merged.organizedData;
            delete merged.selectedLiterature;
            delete merged.reviewContent;
            delete merged.review;
            delete merged.keywords;
        }
        
        return await window.electronAPI.saveProjectData(projectName, merged);
    },

    // 加载项目数据
    async loadProjectData(projectName) {
        const result = await window.electronAPI.loadProjectData(projectName);
        if (result && result.success && result.data) {
            return result.data;
        }
        return {};
    },

    // 深合并
    deepMerge(target, source) {
        if (!source || typeof source !== 'object') return target;
        const out = Array.isArray(target) ? [...target] : { ...target };
        Object.keys(source).forEach(key => {
            const srcVal = source[key];
            const tgtVal = out[key];
            
            // 特殊处理：如果源值是 undefined，表示要删除该字段
            if (srcVal === undefined) {
                delete out[key];
                return;
            }
            
            if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
                out[key] = this.deepMerge(tgtVal && typeof tgtVal === 'object' ? tgtVal : {}, srcVal);
            } else {
                out[key] = srcVal;
            }
        });
        return out;
    }
};

