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
            
            if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
                out[key] = this.deepMerge(tgtVal && typeof tgtVal === 'object' ? tgtVal : {}, srcVal);
            } else {
                out[key] = srcVal;
            }
        });
        return out;
    }
};

