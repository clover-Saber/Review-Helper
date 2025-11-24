// 工作流数据加载器：负责项目数据的加载和保存（仅支持新格式）
window.WorkflowDataLoader = {
    // 获取状态管理器引用
    getState() {
        return window.WorkflowStateManager.state;
    },

    // 加载当前项目
    async loadCurrentProject() {
        try {
            const state = this.getState();
            // 先重置验证状态
            state.googleScholarVerified = false;
            
            const result = await window.electronAPI.getCurrentProject();
            console.log('getCurrentProject 返回:', result);
            
            // 兼容两种返回格式：projectName 或 currentProject
            const projectName = result?.projectName || result?.currentProject;
            if (result && result.success && projectName) {
                state.currentProject = projectName;
                
                // 更新项目名称显示
                const projectNameEl = document.getElementById('current-project-name');
                if (projectNameEl) {
                    projectNameEl.textContent = projectName;
                }
                
                const data = await window.DataManager.loadProjectData(state.currentProject);
                console.log('加载的项目数据:', data);
                state.projectData = data;
                
                // 加载配置数据
                if (data.config) {
                    if (data.config.googleScholarVerified) {
                        state.googleScholarVerified = data.config.googleScholarVerified;
                    }
                    // 确保projectData.config也被更新，以便后续保存时能正确合并
                    if (!state.projectData.config) {
                        state.projectData.config = {};
                    }
                    state.projectData.config = { ...state.projectData.config, ...data.config };
                    
                    // 加载API Keys
                    if (data.config.apiKeys && typeof data.config.apiKeys === 'object') {
                        state.apiKeys = { ...state.apiKeys, ...data.config.apiKeys };
                    }
                    // 兼容旧格式：如果存在apiKey，迁移到新格式apiKeys
                    if (data.config.apiKey && !data.config.apiKeys) {
                        const oldProvider = data.config.apiProvider || 'deepseek';
                        if (!state.apiKeys) {
                            state.apiKeys = {};
                        }
                        state.apiKeys[oldProvider] = data.config.apiKey;
                        state.globalApiKey = data.config.apiKey;
                    }
                    if (data.config.apiProvider) {
                        state.apiProvider = data.config.apiProvider;
                    }
                    // 加载 Gemini 模型
                    if (data.config.geminiModel) {
                        state.geminiModel = data.config.geminiModel;
                    }
                    // 加载硅基流动模型
                    if (data.config.siliconflowModel) {
                        state.siliconflowModel = data.config.siliconflowModel;
                    }
                    // 加载 Poe 模型
                    if (data.config.poeModel) {
                        state.poeModel = data.config.poeModel;
                    }
                }
                
                // 加载需求数据（排除 keywordsPlan，因为它应该从 node1 中加载）
                if (data.requirementData) {
                    const { keywordsPlan, ...requirementDataWithoutKeywordsPlan } = data.requirementData;
                    state.requirementData = { ...state.requirementData, ...requirementDataWithoutKeywordsPlan };
                }
                
                // 加载节点数据（仅支持新格式：node1, node2, node3, node4, node5）
                this.loadNodeData(1, data);
                this.loadNodeData(2, data);
                this.loadNodeData(3, data);
                this.loadNodeData(4, data);
                this.loadNodeData(5, data);
                
                // 如果节点2有 searchResults 但没有 allLiterature，从 searchResults 重新生成
                if (state.searchResults && Object.keys(state.searchResults).length > 0 && 
                    (!state.allLiterature || state.allLiterature.length === 0)) {
                    // 从 searchResults 合并生成 allLiterature
                    const allLit = [];
                    for (const keyword in state.searchResults) {
                        const results = state.searchResults[keyword];
                        if (Array.isArray(results)) {
                            results.forEach(result => {
                                const exists = allLit.find(lit => 
                                    lit.title === result.title || 
                                    (lit.url && result.url && lit.url === result.url)
                                );
                                if (!exists) {
                                    allLit.push(result);
                                }
                            });
                        }
                    }
                    state.allLiterature = allLit;
                }
                
                // 根据JSON数据检查并更新节点状态
                this.checkNodeStatesFromData(data);
                
                console.log('加载后的状态:', {
                    keywords: state.keywords.length,
                    allLiterature: state.allLiterature.length,
                    selectedLiterature: state.selectedLiterature.length,
                    hasReview: !!state.reviewContent,
                    nodeStates: state.nodeStates
                });
            } else {
                // 如果 electronAPI.getCurrentProject() 返回失败，但 state 中已有项目名，尝试直接加载
                const state = this.getState();
                if (state.currentProject) {
                    console.warn('[loadCurrentProject] electronAPI.getCurrentProject() 失败，但 state 中有项目名，尝试直接加载:', state.currentProject);
                    try {
                        const data = await window.DataManager.loadProjectData(state.currentProject);
                        console.log('直接加载的项目数据:', data);
                        state.projectData = data;
                        
                        // 加载配置数据
                        if (data.config) {
                            if (data.config.googleScholarVerified) {
                                state.googleScholarVerified = data.config.googleScholarVerified;
                            }
                            if (!state.projectData.config) {
                                state.projectData.config = {};
                            }
                            state.projectData.config = { ...state.projectData.config, ...data.config };
                            
                            // 加载API Keys
                            if (data.config.apiKeys && typeof data.config.apiKeys === 'object') {
                                state.apiKeys = { ...state.apiKeys, ...data.config.apiKeys };
                            }
                            if (data.config.apiProvider) {
                                state.apiProvider = data.config.apiProvider;
                            }
                            if (data.config.geminiModel) {
                                state.geminiModel = data.config.geminiModel;
                            }
                            if (data.config.siliconflowModel) {
                                state.siliconflowModel = data.config.siliconflowModel;
                            }
                            if (data.config.poeModel) {
                                state.poeModel = data.config.poeModel;
                            }
                        }
                        
                        // 加载需求数据
                        if (data.requirementData) {
                            const { keywordsPlan, ...requirementDataWithoutKeywordsPlan } = data.requirementData;
                            state.requirementData = { ...state.requirementData, ...requirementDataWithoutKeywordsPlan };
                        }
                        
                        // 加载节点数据
                        this.loadNodeData(1, data);
                        this.loadNodeData(2, data);
                        this.loadNodeData(3, data);
                        this.loadNodeData(4, data);
                        this.loadNodeData(5, data);
                        
                        // 从 searchResults 重新生成 allLiterature（如果需要）
                        if (state.searchResults && Object.keys(state.searchResults).length > 0 && 
                            (!state.allLiterature || state.allLiterature.length === 0)) {
                            const allLit = [];
                            for (const keyword in state.searchResults) {
                                const results = state.searchResults[keyword];
                                if (Array.isArray(results)) {
                                    results.forEach(result => {
                                        const exists = allLit.find(lit => 
                                            lit.title === result.title || 
                                            (lit.url && result.url && lit.url === result.url)
                                        );
                                        if (!exists) {
                                            allLit.push(result);
                                        }
                                    });
                                }
                            }
                            state.allLiterature = allLit;
                        }
                        
                        // 检查节点状态
                        this.checkNodeStatesFromData(data);
                        
                        // 更新项目名称显示
                        const projectNameEl = document.getElementById('current-project-name');
                        if (projectNameEl) {
                            projectNameEl.textContent = state.currentProject;
                        }
                        
                        console.log('直接加载后的状态:', {
                            keywords: state.keywords.length,
                            allLiterature: state.allLiterature.length,
                            selectedLiterature: state.selectedLiterature.length,
                            hasReview: !!state.reviewContent,
                            nodeStates: state.nodeStates
                        });
                        return; // 成功加载，直接返回
                    } catch (directLoadError) {
                        console.error('[loadCurrentProject] 直接加载也失败:', directLoadError);
                        throw directLoadError;
                    }
                }
                
                // 没有项目时显示提示
                const projectNameEl = document.getElementById('current-project-name');
                if (projectNameEl) {
                    projectNameEl.textContent = '未选择项目';
                }
                console.warn('未找到当前项目:', result);
            }
        } catch (error) {
            console.error('加载项目失败:', error);
            // 只有在没有项目名的情况下才显示错误提示（避免在 reloadProject 时显示错误）
            const state = this.getState();
            if (!state.currentProject) {
                window.UIUtils.showToast('加载项目失败: ' + error.message, 'error');
            } else {
                // 如果有项目名但加载失败，只记录错误，不显示提示（因为可能是 reloadProject 调用）
                console.warn('[loadCurrentProject] 加载失败但已有项目名，可能是在 reloadProject 中:', error.message);
            }
            throw error; // 重新抛出错误，让调用者处理
        }
    },

    // 加载单个节点数据（仅支持新格式）
    loadNodeData(nodeNum, data) {
        const state = this.getState();
        const nodeKey = `node${nodeNum}`;
        const nodeData = data[nodeKey];
        
        if (!nodeData) {
            // 新格式不存在，设置为默认值
            return;
        }
        
        switch(nodeNum) {
            case 1:
                if (nodeData.keywords && Array.isArray(nodeData.keywords)) {
                    state.keywords = nodeData.keywords;
                }
                if (nodeData.keywordsPlan !== undefined && Array.isArray(nodeData.keywordsPlan)) {
                    state.requirementData.keywordsPlan = nodeData.keywordsPlan;
                } else {
                    state.requirementData.keywordsPlan = [];
                }
                if (nodeData.status) {
                    state.nodeStates[1] = nodeData.status;
                }
                break;
            case 2:
                if (nodeData.searchResults) {
                    state.searchResults = nodeData.searchResults;
                }
                // 节点2不再保存 allLiterature，如果存在（旧数据兼容），只在没有节点3数据时临时使用
                if (nodeData.allLiterature && Array.isArray(nodeData.allLiterature)) {
                    if (!data.node3 || !data.node3.allLiterature) {
                        state.allLiterature = nodeData.allLiterature;
                    }
                }
                if (nodeData.status) {
                    state.nodeStates[2] = nodeData.status;
                }
                break;
            case 3:
                if (nodeData.allLiterature && Array.isArray(nodeData.allLiterature)) {
                    state.allLiterature = nodeData.allLiterature;
                }
                if (nodeData.status) {
                    state.nodeStates[3] = nodeData.status;
                }
                break;
            case 4:
                if (nodeData.selectedLiterature && Array.isArray(nodeData.selectedLiterature)) {
                    state.selectedLiterature = nodeData.selectedLiterature;
                }
                if (nodeData.status) {
                    state.nodeStates[4] = nodeData.status;
                }
                break;
            case 5:
                if (nodeData.reviewContent) {
                    state.reviewContent = nodeData.reviewContent;
                }
                if (nodeData.status) {
                    state.nodeStates[5] = nodeData.status;
                }
                break;
        }
    },

    // 根据JSON数据检查节点状态
    checkNodeStatesFromData(data) {
        const state = this.getState();
        
        // 节点1：关键词分析
        if (data.node1) {
            if (data.node1.status) {
                state.nodeStates[1] = data.node1.status;
            } else {
                const hasKeywordsPlan = data.node1.keywordsPlan && Array.isArray(data.node1.keywordsPlan) && data.node1.keywordsPlan.length > 0;
                const hasKeywords = data.node1.keywords && Array.isArray(data.node1.keywords) && data.node1.keywords.length > 0;
                state.nodeStates[1] = (hasKeywordsPlan || hasKeywords) ? 'completed' : 'pending';
            }
        }
        
        // 节点2：文献搜索
        if (data.node2) {
            if (data.node2.status) {
                state.nodeStates[2] = data.node2.status;
            } else {
                const hasSearchResults = data.node2.searchResults && Object.keys(data.node2.searchResults).length > 0;
                state.nodeStates[2] = hasSearchResults ? 'completed' : 'pending';
            }
        }
        
        // 节点3：文献补全
        if (data.node3) {
            if (data.node3.status) {
                state.nodeStates[3] = data.node3.status;
            } else {
                const hasAllLiterature = data.node3.allLiterature && Array.isArray(data.node3.allLiterature) && data.node3.allLiterature.length > 0;
                state.nodeStates[3] = hasAllLiterature ? 'completed' : 'pending';
            }
        }
        
        // 节点4：精选文献
        if (data.node4) {
            if (data.node4.status) {
                state.nodeStates[4] = data.node4.status;
            } else {
                const hasSelected = data.node4.selectedLiterature && Array.isArray(data.node4.selectedLiterature) && data.node4.selectedLiterature.length > 0;
                state.nodeStates[4] = hasSelected ? 'completed' : 'pending';
            }
        }
        
        // 节点5：综述撰写
        if (data.node5) {
            if (data.node5.status) {
                state.nodeStates[5] = data.node5.status;
            } else {
                const hasReview = data.node5.reviewContent && data.node5.reviewContent.trim().length > 0;
                state.nodeStates[5] = hasReview ? 'completed' : 'pending';
            }
        }
    },

    // 保存节点数据
    async saveNodeData(nodeNum, nodeData) {
        const state = this.getState();
        if (!state.currentProject) {
            throw new Error('未选择项目');
        }
        
        // 数据验证
        if (!this.validateNodeData(nodeNum, nodeData)) {
            console.warn(`[saveNodeData] 节点${nodeNum}数据验证失败，但继续保存`);
        }
        
        const nodeKey = `node${nodeNum}`;
        
        // 节点2不应该包含 allLiterature（那是节点3的数据）
        if (nodeNum === 2 && nodeData.allLiterature !== undefined) {
            const { allLiterature, ...restData } = nodeData;
            nodeData = restData;
        }
        
        const patch = {
            [nodeKey]: {
                ...nodeData,
                status: state.nodeStates[nodeNum] || 'pending'
            }
        };
        
        // 如果节点2存在，确保删除其中的 allLiterature 字段
        if (nodeNum === 2) {
            // 加载现有数据，删除 allLiterature
            const existing = await window.DataManager.loadProjectData(state.currentProject);
            if (existing && existing.node2 && existing.node2.allLiterature !== undefined) {
                patch[nodeKey].allLiterature = undefined; // 设置为 undefined 以便删除
            }
        }
        
        return await window.DataManager.saveProjectData(state.currentProject, patch);
    },

    // 数据验证：验证节点数据格式
    validateNodeData(nodeNum, data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        switch(nodeNum) {
            case 1:
                // 节点1：验证 keywordsPlan 格式
                if (data.keywordsPlan !== undefined) {
                    if (!Array.isArray(data.keywordsPlan)) return false;
                    return data.keywordsPlan.every(item => 
                        item && typeof item === 'object' &&
                        typeof item.keyword === 'string' &&
                        typeof item.count === 'number' &&
                        item.count > 0
                    );
                }
                return true;
            case 2:
                // 节点2：验证 searchResults 格式
                if (data.searchResults !== undefined) {
                    return typeof data.searchResults === 'object' && !Array.isArray(data.searchResults);
                }
                return true;
            case 3:
                // 节点3：验证 allLiterature 格式
                if (data.allLiterature !== undefined) {
                    return Array.isArray(data.allLiterature);
                }
                return true;
            case 4:
                // 节点4：验证 selectedLiterature 格式
                if (data.selectedLiterature !== undefined) {
                    return Array.isArray(data.selectedLiterature);
                }
                return true;
            case 5:
                // 节点5：验证 reviewContent 格式
                if (data.reviewContent !== undefined) {
                    return typeof data.reviewContent === 'string';
                }
                return true;
            default:
                return true;
        }
    },

    // 保存当前项目的所有数据
    async saveCurrentProjectData() {
        const state = this.getState();
        try {
            if (!state.currentProject) {
                throw new Error('未选择项目');
            }

            const requirement = window.UIUtils.getValue('main-requirement-input');
            const targetCount = parseInt(window.UIUtils.getValue('main-target-count')) || 50;
            const outline = window.UIUtils.getValue('main-outline-editor');
            const language = window.UIUtils.getValue('main-language-select') || 'zh';

            if (requirement) {
                state.requirementData.requirement = requirement;
            }
            if (targetCount) {
                state.requirementData.targetCount = targetCount;
            }
            if (outline) {
                state.requirementData.outline = outline;
            }

            // 收集当前所有状态数据（按节点组织）
            // 从 requirementData 中排除 keywordsPlan（它应该只保存在 node1.keywordsPlan 中）
            const { keywordsPlan, ...requirementDataWithoutKeywordsPlan } = state.requirementData;
            const dataToSave = {
                config: {
                    apiKeys: state.apiKeys || {},
                    apiProvider: state.apiProvider,
                    geminiModel: state.apiProvider === 'gemini' ? (window.WorkflowManager ? window.WorkflowManager.getGeminiModel() : state.geminiModel) : undefined,
                    siliconflowModel: state.apiProvider === 'siliconflow' ? (window.WorkflowManager ? window.WorkflowManager.getSiliconFlowModel() : state.siliconflowModel) : undefined,
                    poeModel: state.apiProvider === 'poe' ? (window.WorkflowManager ? window.WorkflowManager.getPoeModel() : state.poeModel) : undefined
                },
                requirementData: requirementDataWithoutKeywordsPlan,
                node1: {
                    keywords: state.keywords,
                    keywordsPlan: keywordsPlan || [],
                    status: state.nodeStates[1] || 'pending'
                },
                node2: {
                    searchResults: state.searchResults,
                    status: state.nodeStates[2] || 'pending'
                },
                node3: {
                    allLiterature: state.allLiterature,
                    status: state.nodeStates[3] || 'pending'
                },
                node4: {
                    selectedLiterature: state.selectedLiterature,
                    status: state.nodeStates[4] || 'pending'
                },
                node5: {
                    reviewContent: state.reviewContent,
                    status: state.nodeStates[5] || 'pending'
                }
            };

            const result = await window.DataManager.saveProjectData(state.currentProject, dataToSave);
            console.log('保存项目数据结果:', result);
            
            // 检查保存结果
            if (result && result.success === false) {
                throw new Error(result.error || '保存失败');
            }
            
            window.UIUtils.showToast('项目数据已保存', 'success');
            return result;
        } catch (error) {
            console.error('保存项目数据失败:', error);
            window.UIUtils.showToast('保存项目数据失败: ' + error.message, 'error');
            throw error;
        }
    },

    // 获取当前选择的 Gemini 模型
    getGeminiModel() {
        const state = this.getState();
        return state.geminiModel || 'gemini-2.5-flash';
    },

    // 获取当前选择的硅基流动模型
    getSiliconFlowModel() {
        const state = this.getState();
        return state.siliconflowModel || 'Qwen/QwQ-32B';
    },

    // 获取当前选择的 Poe 模型
    getPoeModel() {
        const state = this.getState();
        return state.poeModel || 'Claude-Sonnet-4';
    }
};

