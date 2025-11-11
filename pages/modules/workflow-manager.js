// 工作流管理器：协调各个节点和主页面功能
window.WorkflowManager = {
    // 状态管理
    state: {
        currentProject: null,
        projectData: {},
        currentNode: null,
        nodeStates: {
            1: 'pending',
            2: 'pending',
            3: 'pending',
            4: 'pending',
            5: 'pending'
        },
        globalApiKey: '', // 当前使用的API Key（根据选择的供应商动态更新）
        apiKeys: {}, // 按供应商存储的API Keys: { deepseek: 'xxx', openai: 'yyy', ... }
        apiProvider: 'deepseek', // 默认使用DeepSeek
        requirementData: {
            requirement: '',
            targetCount: 50,
            outline: '',
            keywordsPlan: [],
            language: 'zh' // 默认中文
        },
        keywords: [],
        searchResults: {},
        allLiterature: [],
        selectedLiterature: [],
        reviewContent: '',
        isAutoGenerating: false,
        currentAutoNode: 0,
        shouldStop: false,
        googleScholarVerified: false
    },

    // 初始化
    async init() {
        // 检查依赖模块
        if (!window.DataManager) {
            console.error('DataManager模块未加载');
            return;
        }
        if (!window.UIUtils) {
            console.error('UIUtils模块未加载');
            return;
        }
        if (!window.RequirementManager) {
            console.error('RequirementManager模块未加载');
            return;
        }

        // 初始化目标数量提示
        window.RequirementManager.updateTargetHint();

        await this.loadCurrentProject();
        this.bindEvents();
        this.checkRequirementStatus();
        
        // 初始化API供应商UI
        this.updateApiProviderUI();
        
        // 初始化按钮显示状态
        this.updateGenerateButtonState();
        
        // 如果有项目，自动显示总览
        if (this.state.currentProject) {
            this.updateOverview();
            this.showOverview();
        }
    },

    // 更新生成按钮的显示状态
    updateGenerateButtonState() {
        const startBtn = document.getElementById('start-auto-generate-btn');
        const stopBtn = document.getElementById('stop-auto-generate-btn');
        
        if (this.state.requirementData.outline) {
            // 有大纲时，根据生成状态显示对应按钮
            if (this.state.isAutoGenerating) {
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'block';
            } else {
                if (startBtn) startBtn.style.display = 'block';
                if (stopBtn) stopBtn.style.display = 'none';
            }
        } else {
            // 没有大纲时，隐藏两个按钮
            if (startBtn) startBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'none';
        }
    },

    // 加载当前项目
    async loadCurrentProject() {
        try {
            // 先重置验证状态
            this.state.googleScholarVerified = false;
            
            const result = await window.electronAPI.getCurrentProject();
            console.log('getCurrentProject 返回:', result);
            
            // 兼容两种返回格式：projectName 或 currentProject
            const projectName = result?.projectName || result?.currentProject;
            if (result && result.success && projectName) {
                this.state.currentProject = projectName;
                
                // 更新项目名称显示
                const projectNameEl = document.getElementById('current-project-name');
                if (projectNameEl) {
                    projectNameEl.textContent = projectName;
                }
                
                const data = await window.DataManager.loadProjectData(this.state.currentProject);
                console.log('加载的项目数据:', data);
                this.state.projectData = data;
                
                // 加载数据到状态
                if (data.requirementData) {
                    this.state.requirementData = { ...this.state.requirementData, ...data.requirementData };
                }
                
                // 加载Google Scholar验证状态
                if (data.config) {
                    if (data.config.googleScholarVerified) {
                        this.state.googleScholarVerified = data.config.googleScholarVerified;
                    }
                    // 确保projectData.config也被更新，以便后续保存时能正确合并
                    if (!this.state.projectData.config) {
                        this.state.projectData.config = {};
                    }
                    this.state.projectData.config = { ...this.state.projectData.config, ...data.config };
                }
                
                // 如果没有requirementData但有其他数据，尝试从旧格式恢复
                if (!data.requirementData && data.config) {
                    // 尝试从旧格式恢复requirementData
                    if (data.projectDescription) {
                        this.state.requirementData.requirement = data.projectDescription;
                    }
                    // 兼容旧格式：如果存在apiKey，迁移到新格式apiKeys
                    if (data.config.apiKey) {
                        const oldProvider = data.config.apiProvider || 'deepseek';
                        if (!this.state.apiKeys) {
                            this.state.apiKeys = {};
                        }
                        this.state.apiKeys[oldProvider] = data.config.apiKey;
                        this.state.globalApiKey = data.config.apiKey;
                    }
                    if (data.config.apiProvider) {
                        this.state.apiProvider = data.config.apiProvider;
                    }
                }
                
                // 加载新格式的apiKeys
                if (data.config && data.config.apiKeys && typeof data.config.apiKeys === 'object') {
                    this.state.apiKeys = { ...this.state.apiKeys, ...data.config.apiKeys };
                }
                
                // 优先使用keywordsPlan中的关键词，确保keywords和keywordsPlan同步
                if (this.state.requirementData.keywordsPlan && this.state.requirementData.keywordsPlan.length > 0) {
                    this.state.keywords = this.state.requirementData.keywordsPlan.map(item => item.keyword);
                } else if (data.keywords && Array.isArray(data.keywords)) {
                    // 如果只有keywords数组，尝试重建keywordsPlan（兼容旧数据）
                    this.state.keywords = data.keywords;
                    if (data.keywords.length > 0 && (!this.state.requirementData.keywordsPlan || this.state.requirementData.keywordsPlan.length === 0)) {
                        // 尝试从keywords重建keywordsPlan（如果可能）
                        this.state.requirementData.keywordsPlan = data.keywords.map(kw => ({ keyword: kw, count: 0 }));
                    }
                } else {
                    this.state.keywords = [];
                    if (!this.state.requirementData.keywordsPlan) {
                        this.state.requirementData.keywordsPlan = [];
                    }
                }
                
                this.state.searchResults = (data.search && data.search.results) || {};
                
                // 加载文献数据（兼容多种字段名）
                if (data.finalResults && Array.isArray(data.finalResults)) {
                    this.state.allLiterature = data.finalResults;
                } else {
                    this.state.allLiterature = [];
                }
                
                // 加载选中的文献（优先使用selectedLiterature，兼容organizedData）
                if (data.selectedLiterature && Array.isArray(data.selectedLiterature)) {
                    this.state.selectedLiterature = data.selectedLiterature;
                } else if (data.organizedData && Array.isArray(data.organizedData)) {
                    this.state.selectedLiterature = data.organizedData;
                } else {
                    this.state.selectedLiterature = [];
                }
                
                // 加载综述内容（优先使用reviewContent，兼容review）
                this.state.reviewContent = data.reviewContent || data.review || '';
                
                console.log('加载后的状态:', {
                    keywords: this.state.keywords.length,
                    allLiterature: this.state.allLiterature.length,
                    selectedLiterature: this.state.selectedLiterature.length,
                    hasReview: !!this.state.reviewContent,
                    requirementData: this.state.requirementData
                });
                
                // 更新节点状态
                if (this.state.keywords.length > 0 || (this.state.requirementData.keywordsPlan && this.state.requirementData.keywordsPlan.length > 0)) {
                    this.state.nodeStates[1] = 'completed';
                }
                if (this.state.allLiterature.length > 0) {
                    this.state.nodeStates[2] = 'completed';
                    const hasAbstracts = this.state.allLiterature.some(lit => lit.abstract && lit.abstract.trim());
                    if (hasAbstracts) {
                        this.state.nodeStates[3] = 'completed';
                    }
                }
                if (this.state.selectedLiterature.length > 0) {
                    this.state.nodeStates[4] = 'completed';
                }
                if (this.state.reviewContent) {
                    this.state.nodeStates[5] = 'completed';
                }
            } else {
                // 没有项目时显示提示
                const projectNameEl = document.getElementById('current-project-name');
                if (projectNameEl) {
                    projectNameEl.textContent = '未选择项目';
                }
                console.warn('未找到当前项目:', result);
            }
        } catch (error) {
            console.error('加载项目失败:', error);
            window.UIUtils.showToast('加载项目失败: ' + error.message, 'error');
        }
    },

    // 更新API供应商UI（根据选择的供应商更新文档链接等）
    updateApiProviderUI() {
        const providerSelect = document.getElementById('main-api-provider-select');
        const docsLink = document.getElementById('main-api-docs-link');
        const apiKeyLabel = document.getElementById('main-api-key-label');
        const apiKeyInput = document.getElementById('main-api-key-input');
        
        if (!providerSelect) return;
        
        const provider = providerSelect.value || 'deepseek';
        const oldProvider = this.state.apiProvider || 'deepseek';
        
        // 切换供应商时，保存当前供应商的Key，并加载新供应商的Key
        if (oldProvider !== provider && apiKeyInput) {
            // 保存旧供应商的Key
            if (!this.state.apiKeys) {
                this.state.apiKeys = {};
            }
            const currentKey = apiKeyInput.value || this.state.globalApiKey;
            if (currentKey) {
                this.state.apiKeys[oldProvider] = currentKey;
            }
            
            // 加载新供应商的Key
            if (this.state.apiKeys[provider]) {
                apiKeyInput.value = this.state.apiKeys[provider];
                this.state.globalApiKey = this.state.apiKeys[provider];
            } else {
                // 如果新供应商没有保存的Key，清空输入框
                apiKeyInput.value = '';
                this.state.globalApiKey = '';
            }
        }
        
        // 更新当前供应商
        this.state.apiProvider = provider;
        
        // 更新文档链接
        const docsText = document.getElementById('main-api-docs-text');
        if (docsLink && window.API && window.API.providers[provider]) {
            const providerConfig = window.API.providers[provider];
            docsLink.href = providerConfig.docsUrl;
            if (docsText) {
                docsText.textContent = `${providerConfig.name} API 申请地址`;
            }
        }
        
        // 更新API Key输入框的placeholder
        if (apiKeyInput && window.API && window.API.providers[provider]) {
            const providerConfig = window.API.providers[provider];
            apiKeyInput.placeholder = `请输入您的${providerConfig.name} API Key`;
        }
    },

    // 获取当前选择的API供应商
    getCurrentApiProvider() {
        const providerSelect = document.getElementById('main-api-provider-select');
        return providerSelect ? (providerSelect.value || 'deepseek') : (this.state.apiProvider || 'deepseek');
    },

    // 检查需求状态
    checkRequirementStatus() {
        // 确保UI元素存在
        if (!document.getElementById('main-api-key-input')) {
            console.warn('主页面元素未找到，可能页面未完全加载');
            // 延迟重试
            setTimeout(() => this.checkRequirementStatus(), 100);
            return;
        }

        console.log('检查需求状态，当前数据:', {
            hasConfig: !!this.state.projectData.config,
            hasApiKey: !!(this.state.projectData.config && this.state.projectData.config.apiKey),
            requirement: this.state.requirementData.requirement,
            targetCount: this.state.requirementData.targetCount,
            outline: this.state.requirementData.outline
        });

        // 加载API供应商
        if (this.state.projectData.config && this.state.projectData.config.apiProvider) {
            window.UIUtils.setValue('main-api-provider-select', this.state.projectData.config.apiProvider);
            this.state.apiProvider = this.state.projectData.config.apiProvider;
        } else if (this.state.apiProvider) {
            window.UIUtils.setValue('main-api-provider-select', this.state.apiProvider);
        }
        this.updateApiProviderUI();

        // 加载API Key（根据当前选择的供应商）
        const currentProvider = this.getCurrentApiProvider();
        if (this.state.apiKeys && this.state.apiKeys[currentProvider]) {
            // 从apiKeys对象中加载当前供应商的Key
            const apiKey = this.state.apiKeys[currentProvider];
            window.UIUtils.setValue('main-api-key-input', apiKey);
            this.state.globalApiKey = apiKey;
        } else if (this.state.projectData.config && this.state.projectData.config.apiKey) {
            // 兼容旧格式：如果存在旧的apiKey，迁移到新格式
            if (!this.state.apiKeys) {
                this.state.apiKeys = {};
            }
            const oldProvider = this.state.projectData.config.apiProvider || 'deepseek';
            this.state.apiKeys[oldProvider] = this.state.projectData.config.apiKey;
            if (currentProvider === oldProvider) {
                window.UIUtils.setValue('main-api-key-input', this.state.projectData.config.apiKey);
                this.state.globalApiKey = this.state.projectData.config.apiKey;
            }
        } else if (this.state.globalApiKey && this.state.apiKeys && this.state.apiKeys[currentProvider]) {
            // 如果state中有但输入框没有，也设置
            window.UIUtils.setValue('main-api-key-input', this.state.apiKeys[currentProvider]);
        }
        
        // 加载需求描述
        if (this.state.requirementData.requirement) {
            window.UIUtils.setValue('main-requirement-input', this.state.requirementData.requirement);
        }
        
        // 加载目标数量
        if (this.state.requirementData.targetCount) {
            window.UIUtils.setValue('main-target-count', this.state.requirementData.targetCount);
            window.RequirementManager.updateTargetHint();
        }
        
        // 加载语言选择
        if (this.state.requirementData.language) {
            window.UIUtils.setValue('main-language-select', this.state.requirementData.language);
        }
        
        // 加载Google Scholar验证状态
        const verifyBtn = document.getElementById('verify-google-scholar-btn');
        const statusEl = document.getElementById('google-scholar-verify-status');
        if (this.state.googleScholarVerified) {
            if (verifyBtn) {
                verifyBtn.innerHTML = '✓ 已验证（点击重新验证）';
                verifyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                verifyBtn.disabled = false;
                verifyBtn.style.opacity = '1';
                // 移除所有旧的事件监听器
                const newBtn = verifyBtn.cloneNode(true);
                verifyBtn.parentNode.replaceChild(newBtn, verifyBtn);
                // 添加重新验证监听器
                const newVerifyBtn = document.getElementById('verify-google-scholar-btn');
                if (newVerifyBtn) {
                    newVerifyBtn.addEventListener('click', () => this.reverifyGoogleScholar());
                }
            }
            if (statusEl) {
                statusEl.style.display = 'inline';
            }
        } else {
            // 如果未验证，确保UI是未验证状态
            if (verifyBtn) {
                verifyBtn.innerHTML = '🔐 进行Google Scholar验证';
                verifyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                verifyBtn.disabled = false;
                verifyBtn.style.opacity = '1';
                // 移除所有旧的事件监听器
                const newBtn = verifyBtn.cloneNode(true);
                verifyBtn.parentNode.replaceChild(newBtn, verifyBtn);
                // 添加验证监听器
                const newVerifyBtn = document.getElementById('verify-google-scholar-btn');
                if (newVerifyBtn) {
                    newVerifyBtn.addEventListener('click', () => this.verifyGoogleScholar(false));
                }
            }
            if (statusEl) {
                statusEl.style.display = 'none';
            }
        }
        
        // 加载大纲
        if (this.state.requirementData.outline) {
            window.UIUtils.setValue('main-outline-editor', this.state.requirementData.outline);
            window.UIUtils.showElement('main-outline-result');
        }
        
        this.updateNodeStates();
        
        // 初始化总览
        this.updateOverview();
    },

    // 更新节点状态
    updateNodeState(nodeNum, status) {
        this.state.nodeStates[nodeNum] = status;
        const node = document.getElementById(`node-${nodeNum}`);
        if (!node) return;
        
        node.setAttribute('data-status', status);
        const badge = node.querySelector('.node-status-badge');
        
        // 在自动执行时，隐藏未开始的节点（未来节点，包括工作流可视化区域）
        if (this.state.isAutoGenerating && status === 'pending') {
            node.style.display = 'none';
            // 同时确保节点内容也被隐藏
            const nodeContent = document.getElementById(`content-node-${nodeNum}`);
            if (nodeContent) {
                nodeContent.style.display = 'none';
                nodeContent.classList.remove('active');
                const nodeBody = document.getElementById(`node-body-${nodeNum}`);
                if (nodeBody) {
                    nodeBody.style.display = 'none';
                }
            }
        } else {
            node.style.display = 'block';
        }
        
        if (status === 'completed') {
            node.classList.add('completed');
            if (badge) badge.textContent = '已完成';
        } else if (status === 'active') {
            node.classList.add('active');
            if (badge) badge.textContent = '进行中';
        } else {
            node.classList.remove('completed', 'active');
            if (badge) badge.textContent = '待开始';
        }
        
        // 同时更新总览中的状态
        this.updateOverview();
    },

    updateNodeStates() {
        Object.keys(this.state.nodeStates).forEach(key => {
            this.updateNodeState(parseInt(key), this.state.nodeStates[key]);
        });
    },

    // 打开节点（编辑模式）
    openNode(nodeNum) {
        // 如果正在自动生成，不允许手动打开节点
        if (this.state.isAutoGenerating) {
            window.UIUtils.showToast('流程正在进行中，请等待完成后再编辑', 'info');
            return;
        }
        
        // 隐藏总览，显示节点详情
        this.hideOverview();
        
        // 隐藏其他节点内容，只显示当前节点
        for (let i = 1; i <= 5; i++) {
            const nodeContent = document.getElementById(`content-node-${i}`);
            if (nodeContent) {
                if (i === nodeNum) {
                    // 当前节点：显示
                    nodeContent.style.display = 'block';
                    nodeContent.classList.add('active');
                } else {
                    // 其他节点：隐藏
                    nodeContent.style.display = 'none';
                    nodeContent.classList.remove('active');
                }
            }
        }
        
        if (this.state.nodeStates[nodeNum] === 'completed') {
            this.closeNodeContent();
            this.state.currentNode = nodeNum;
            const content = document.getElementById(`content-node-${nodeNum}`);
            const emptyPanel = document.getElementById('node-content-empty');
            if (content) {
                content.classList.add('active');
                if (emptyPanel) emptyPanel.style.display = 'none';
                // 确保节点内容展开
                const nodeBody = document.getElementById(`node-body-${nodeNum}`);
                const toggleBtn = document.querySelector(`.toggle-node-btn[data-node="${nodeNum}"]`);
                const toggleText = toggleBtn ? toggleBtn.querySelector('.toggle-text') : null;
                if (nodeBody) nodeBody.classList.remove('collapsed');
                if (toggleBtn && toggleText) {
                    toggleText.textContent = '隐藏'; // 节点显示时，按钮文字为"隐藏"
                }
                this.loadNodeData(nodeNum);
            }
            return;
        }

        if (nodeNum > 1) {
            const prevNode = nodeNum - 1;
            if (this.state.nodeStates[prevNode] !== 'completed') {
                window.UIUtils.showToast(`请先完成节点${prevNode}`, 'error');
                return;
            }
        }

        this.closeNodeContent();
        this.state.currentNode = nodeNum;
        const content = document.getElementById(`content-node-${nodeNum}`);
        const emptyPanel = document.getElementById('node-content-empty');
        if (content) {
            content.classList.add('active');
            if (emptyPanel) emptyPanel.style.display = 'none';
            // 确保节点内容展开
            const nodeBody = document.getElementById(`node-body-${nodeNum}`);
            const toggleBtn = document.querySelector(`.toggle-node-btn[data-node="${nodeNum}"]`);
            const toggleText = toggleBtn ? toggleBtn.querySelector('.toggle-text') : null;
            if (nodeBody) nodeBody.classList.remove('collapsed');
            if (toggleBtn && toggleText) {
                toggleText.textContent = '隐藏'; // 节点显示时，按钮文字为"隐藏"
            }
            this.updateNodeState(nodeNum, 'active');
            this.loadNodeData(nodeNum);
        }
    },

    // 显示总览
    showOverview() {
        // 如果正在自动生成，不允许切换到总览
        if (this.state.isAutoGenerating) {
            window.UIUtils.showToast('流程正在进行中，请等待完成后再查看总览', 'info');
            return;
        }
        
        const overviewContainer = document.getElementById('overview-container');
        const nodeContentContainer = document.getElementById('node-content-container');
        const emptyPanel = document.getElementById('node-content-empty');
        
        if (overviewContainer) {
            overviewContainer.style.display = 'block';
        }
        if (nodeContentContainer) {
            nodeContentContainer.style.display = 'none';
        }
        if (emptyPanel) {
            emptyPanel.style.display = 'none';
        }
        
        // 更新总览内容（非自动生成时，显示所有节点）
        this.updateOverview();
    },

    // 隐藏总览，显示节点详情
    hideOverview() {
        const overviewContainer = document.getElementById('overview-container');
        const nodeContentContainer = document.getElementById('node-content-container');
        
        if (overviewContainer) {
            overviewContainer.style.display = 'none';
        }
        if (nodeContentContainer) {
            nodeContentContainer.style.display = 'block';
        }
    },

    // 显示节点内容（用于自动执行时实时展示，保留所有已完成的节点）
    showNodeContent(nodeNum) {
        // 隐藏总览和空面板
        const overviewContainer = document.getElementById('overview-container');
        const nodeContentContainer = document.getElementById('node-content-container');
        const emptyPanel = document.getElementById('node-content-empty');
        
        if (overviewContainer) {
            overviewContainer.style.display = 'none';
        }
        if (nodeContentContainer) {
            nodeContentContainer.style.display = 'block';
        }
        if (emptyPanel) {
            emptyPanel.style.display = 'none';
        }
        
        // 在自动执行时，只显示已完成的节点和当前节点，隐藏未开始的节点
        // 显示当前节点内容
        const content = document.getElementById(`content-node-${nodeNum}`);
        if (content) {
            content.classList.add('active');
            content.style.display = 'block'; // 确保当前节点显示
            // 确保节点内容展开（节点内部不设置展开/隐藏）
            const nodeBody = document.getElementById(`node-body-${nodeNum}`);
            const toggleBtn = document.querySelector(`.toggle-node-btn[data-node="${nodeNum}"]`);
            const toggleText = toggleBtn ? toggleBtn.querySelector('.toggle-text') : null;
            if (nodeBody) {
                nodeBody.classList.remove('collapsed');
                nodeBody.style.display = 'block'; // 强制显示，不允许折叠
            }
            if (toggleBtn && toggleText) {
                toggleText.textContent = '隐藏'; // 节点显示时，按钮文字为"隐藏"
            }
        }
        
        // 处理其他节点：只显示已完成的，隐藏未开始的（未来节点）
        for (let i = 1; i <= 5; i++) {
            if (i === nodeNum) continue; // 当前节点已处理
            
            const nodeContent = document.getElementById(`content-node-${i}`);
            const nodeStatus = this.state.nodeStates[i];
            
            if (!nodeContent) continue;
            
            // 如果正在自动生成，只显示已完成的节点，隐藏所有未来节点
            if (this.state.isAutoGenerating) {
                if (nodeStatus === 'completed') {
                    // 已完成的节点：显示
                    nodeContent.classList.add('active');
                    nodeContent.style.display = 'block';
                    // 确保已完成的节点内容展开（节点内部不设置展开/隐藏）
                    const nodeBody = document.getElementById(`node-body-${i}`);
                    const toggleBtn = document.querySelector(`.toggle-node-btn[data-node="${i}"]`);
                    const toggleText = toggleBtn ? toggleBtn.querySelector('.toggle-text') : null;
                    if (nodeBody) {
                        nodeBody.classList.remove('collapsed');
                        nodeBody.style.display = 'block'; // 强制显示，不允许折叠
                    }
                    if (toggleBtn && toggleText) {
                        toggleText.textContent = '隐藏'; // 节点显示时，按钮文字为"隐藏"
                    }
                } else {
                    // 未来节点（pending状态）：完全隐藏，不显示任何信息
                    nodeContent.style.display = 'none';
                    nodeContent.classList.remove('active');
                    // 同时隐藏节点内容体，确保不显示任何内容
                    const nodeBody = document.getElementById(`node-body-${i}`);
                    if (nodeBody) {
                        nodeBody.style.display = 'none';
                    }
                }
            } else {
                // 非自动生成时，保持原有逻辑（所有节点都可以显示）
                if (nodeStatus === 'completed') {
                    nodeContent.classList.add('active');
                    nodeContent.style.display = 'block';
                }
            }
        }
    },

    // 从总览跳转到节点详情
    showNodeDetail(nodeNum) {
        // 如果正在自动生成，不允许从总览跳转
        if (this.state.isAutoGenerating) {
            window.UIUtils.showToast('流程正在进行中，请等待完成后再编辑', 'info');
            return;
        }
        this.hideOverview();
        this.openNode(nodeNum);
    },

    // 更新总览内容
    updateOverview() {
        // 更新节点状态
        for (let i = 1; i <= 5; i++) {
            const statusEl = document.getElementById(`overview-status-${i}`);
            const contentEl = document.getElementById(`overview-content-${i}`);
            const overviewCard = document.querySelector(`.overview-node-card[data-node="${i}"]`);
            const status = this.state.nodeStates[i] || 'pending';
            
            // 如果正在自动生成，隐藏未开始的节点（未来节点）
            if (this.state.isAutoGenerating && status === 'pending') {
                // 隐藏未来节点的总览卡片
                if (overviewCard) {
                    overviewCard.style.display = 'none';
                }
                continue; // 跳过未开始的节点
            } else {
                // 显示当前节点和已完成的节点
                if (overviewCard) {
                    overviewCard.style.display = 'block';
                }
            }
            
            if (statusEl) {
                statusEl.textContent = status === 'pending' ? '未开始' : 
                                      status === 'active' ? '进行中' : '已完成';
                statusEl.className = `overview-node-status ${status}`;
            }
            
            if (contentEl) {
                contentEl.innerHTML = this.getOverviewContent(i);
            }
        }
    },

    // 获取节点总览内容（只读）
    getOverviewContent(nodeNum) {
        // 如果正在自动生成，且该节点未开始（未来节点），返回空内容
        const nodeStatus = this.state.nodeStates[nodeNum] || 'pending';
        if (this.state.isAutoGenerating && nodeStatus === 'pending') {
            return ''; // 未来节点不显示任何信息
        }
        
        switch(nodeNum) {
            case 1:
                if (this.state.requirementData.keywordsPlan && this.state.requirementData.keywordsPlan.length > 0) {
                    const totalCount = this.state.requirementData.keywordsPlan.reduce((sum, item) => sum + (item.count || 0), 0);
                    let html = `<p><strong>关键词数量：</strong>${this.state.requirementData.keywordsPlan.length}个</p>`;
                    html += `<p><strong>总查询数量：</strong>${totalCount}篇</p>`;
                    return html;
                }
                return '<p style="color: #999;">尚未开始</p>';
                
            case 2:
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    return `<p><strong>搜索到文献：</strong>${this.state.allLiterature.length}篇</p>`;
                }
                return '<p style="color: #999;">尚未开始</p>';
                
            case 3:
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    const completedCount = this.state.allLiterature.filter(lit => lit.abstract && lit.abstract.trim()).length;
                    let html = `<p><strong>总文献数：</strong>${this.state.allLiterature.length}篇</p>`;
                    html += `<p><strong>已补全摘要：</strong>${completedCount}篇</p>`;
                    html += `<p><strong>补全率：</strong>${Math.round(completedCount / this.state.allLiterature.length * 100)}%</p>`;
                    return html;
                }
                return '<p style="color: #999;">尚未开始</p>';
                
            case 4:
                if (this.state.selectedLiterature && this.state.selectedLiterature.length > 0) {
                    let html = `<p><strong>总文献数：</strong>${this.state.allLiterature.length || 0}篇</p>`;
                    html += `<p><strong>已选文献：</strong>${this.state.selectedLiterature.length}篇</p>`;
                    html += `<p><strong>选择率：</strong>${Math.round(this.state.selectedLiterature.length / (this.state.allLiterature.length || 1) * 100)}%</p>`;
                    return html;
                }
                return '<p style="color: #999;">尚未开始</p>';
                
            case 5:
                if (this.state.reviewContent && this.state.reviewContent.trim()) {
                    const preview = this.state.reviewContent.substring(0, 500);
                    let html = `<p><strong>综述状态：</strong>已生成</p>`;
                    html += `<p><strong>综述长度：</strong>${this.state.reviewContent.length}字</p>`;
                    html += `<p><strong>已选文献：</strong>${this.state.selectedLiterature.length || 0}篇</p>`;
                    html += '<h4>综述预览：</h4>';
                    html += `<div style="padding: 15px; background: #f8f9fa; border-radius: 4px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">${this.escapeHtml(preview)}${this.state.reviewContent.length > 500 ? '...' : ''}</div>`;
                    return html;
                }
                return '<p style="color: #999;">尚未开始</p>';
                
            default:
                return '<p style="color: #999;">尚未开始</p>';
        }
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 关闭节点内容（已废弃，改为展开/隐藏）
    closeNodeContent() {
        // 此方法保留用于兼容，但不再使用
        // 现在使用 toggleNodeContent 来控制展开/隐藏
    },

    // 切换节点内容的展开/隐藏（只隐藏内容，保留标题和按钮）
    toggleNodeContent(nodeNum) {
        const nodeBody = document.getElementById(`node-body-${nodeNum}`);
        const btn = document.querySelector(`.toggle-node-btn[data-node="${nodeNum}"]`);
        const toggleText = btn ? btn.querySelector('.toggle-text') : null;
        
        if (nodeBody && btn) {
            const isVisible = nodeBody.style.display !== 'none';
            if (isVisible) {
                // 隐藏节点内容（保留标题和按钮）
                nodeBody.style.display = 'none';
                if (toggleText) toggleText.textContent = '展开';
            } else {
                // 显示节点内容
                nodeBody.style.display = 'block';
                if (toggleText) toggleText.textContent = '隐藏';
            }
        }
    },

    // 加载节点数据
    loadNodeData(nodeNum) {
        switch(nodeNum) {
            case 1:
                // 确保节点内容展开
                const nodeBody1 = document.getElementById('node-body-1');
                if (nodeBody1) {
                    nodeBody1.classList.remove('collapsed');
                    nodeBody1.style.display = 'block';
                }
                
                // 调试信息：检查数据状态
                console.log('[Node 1] Loading node data. Checking keywordsPlan:', {
                    hasKeywordsPlan: !!this.state.requirementData.keywordsPlan,
                    keywordsPlanLength: this.state.requirementData.keywordsPlan ? this.state.requirementData.keywordsPlan.length : 0,
                    keywordsPlan: this.state.requirementData.keywordsPlan,
                    keywordsLength: this.state.keywords ? this.state.keywords.length : 0,
                    requirementData: this.state.requirementData
                });
                
                if (this.state.requirementData.keywordsPlan && this.state.requirementData.keywordsPlan.length > 0) {
                    // 用户点击节点进入时使用编辑模式（editable=true）
                    console.log('[Node 1] Displaying keywords in edit mode:', {
                        keywordsPlanLength: this.state.requirementData.keywordsPlan.length,
                        keywordsPlan: this.state.requirementData.keywordsPlan
                    });
                    window.Node1Keywords.display(this.state.requirementData.keywordsPlan, true);
                    window.UIUtils.showElement('keywords-result');
                    window.UIUtils.hideElement('keywords-auto-progress');
                    // 显示关键词分析按钮
                    const regenerateBtn = document.getElementById('regenerate-keywords-btn');
                    if (regenerateBtn) {
                        regenerateBtn.style.display = 'inline-block';
                    }
                    console.log('[Node 1] Keywords displayed in edit mode');
                } else {
                    // 如果没有关键词数据，显示提示
                    console.warn('[Node 1] WARNING: No keywords data found in state');
                    const keywordsList = document.getElementById('keywords-list');
                    if (keywordsList) {
                        keywordsList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无关键词数据，请先执行关键词分析</p>';
                    }
                    window.UIUtils.showElement('keywords-result');
                    window.UIUtils.hideElement('keywords-auto-progress');
                }
                break;
            case 2:
                // 用户点击节点进入编辑模式时，使用编辑模式显示（可删除）
                window.UIUtils.showElement('search-results');
                window.UIUtils.hideElement('search-progress');
                
                // 显示保存修改按钮（如果节点2已完成）
                const saveSearchBtn = document.getElementById('save-search-results-btn');
                if (saveSearchBtn && this.state.nodeStates[2] === 'completed') {
                    saveSearchBtn.style.display = 'inline-block';
                }
                
                // 显示重新搜索文献按钮（如果节点2已完成）
                const regenerateBtn2 = document.getElementById('regenerate-node2-btn');
                if (regenerateBtn2 && this.state.nodeStates[2] === 'completed') {
                    regenerateBtn2.style.display = 'block';
                }
                
                if (this.state.allLiterature.length > 0) {
                    // 编辑模式：editable=true，支持删除
                    window.Node2Search.display(this.state.allLiterature, true);
                }
                break;
            case 3:
                window.UIUtils.showElement('complete-results');
                window.UIUtils.hideElement('complete-progress');
                if (this.state.allLiterature.length > 0) {
                    window.Node3Complete.display(this.state.allLiterature);
                }
                // 如果节点3已完成，显示保存修改和重新补全文献按钮
                if (this.state.nodeStates[3] === 'completed') {
                    const saveBtn = document.getElementById('save-completion-btn');
                    const regenerateBtn = document.getElementById('regenerate-completion-btn');
                    if (saveBtn) saveBtn.style.display = 'inline-block';
                    if (regenerateBtn) regenerateBtn.style.display = 'block';
                }
                break;
            case 4:
                window.UIUtils.hideElement('filter-progress');
                // 显示统计卡片和导出按钮（用户编辑时）
                window.UIUtils.showElement('filter-statistics-container');
                const exportBtn = document.getElementById('export-excel-btn');
                if (exportBtn) {
                    exportBtn.style.display = 'inline-block';
                }
                if (this.state.allLiterature.length > 0) {
                    // 用户点击节点进入时使用编辑模式（editable=true）
                    window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
                }
                // 如果节点4已完成，显示保存修改和重新精选文献按钮
                if (this.state.nodeStates[4] === 'completed') {
                    const saveBtn = document.getElementById('save-filter-btn');
                    const regenerateBtn = document.getElementById('regenerate-filter-btn');
                    if (saveBtn) saveBtn.style.display = 'inline-block';
                    if (regenerateBtn) regenerateBtn.style.display = 'block';
                }
                break;
            case 5:
                // 显示已选文献摘要和生成综述按钮（用户编辑时）
                window.UIUtils.showElement('selected-literature-summary');
                const generateBtn = document.getElementById('generate-review-btn');
                if (generateBtn) {
                    generateBtn.style.display = 'inline-block';
                }
                // 始终显示已选文献列表
                if (this.state.selectedLiterature && this.state.selectedLiterature.length > 0) {
                    window.Node5Review.displaySelectedLiterature(this.state.selectedLiterature);
                } else {
                    window.Node5Review.displaySelectedLiterature([]);
                }
                // 如果有综述内容，显示综述
                if (this.state.reviewContent) {
                    window.Node5Review.display(this.state.reviewContent, this.state.selectedLiterature);
                    window.UIUtils.showElement('review-result');
                }
                break;
        }
    },

    // 切换文献选择
    toggleLiterature(index, selected) {
        if (index >= 0 && index < this.state.allLiterature.length) {
            this.state.allLiterature[index].selected = selected;
            if (selected && !this.state.selectedLiterature.find(lit => lit.title === this.state.allLiterature[index].title)) {
                this.state.selectedLiterature.push(this.state.allLiterature[index]);
            } else if (!selected) {
                this.state.selectedLiterature = this.state.selectedLiterature.filter(lit => lit.title !== this.state.allLiterature[index].title);
            }
            // 用户手动操作时使用编辑模式（editable=true）
            window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
            
            // 保存数据（确保保存所有相关字段）
            this.saveProjectData({
                finalResults: this.state.allLiterature,
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature
            });
        }
    },

    // 更新文献内容
    updateLiterature(index, field, value) {
        if (index >= 0 && index < this.state.allLiterature.length) {
            const lit = this.state.allLiterature[index];
            if (field === 'title') {
                lit.title = value;
            } else if (field === 'authors') {
                lit.authors = value;
            } else if (field === 'year') {
                lit.year = value;
            } else if (field === 'abstract') {
                lit.abstract = value;
            } else if (field === 'journal') {
                lit.journal = value;
            } else if (field === 'cited') {
                lit.cited = parseInt(value) || 0;
            } else if (field === 'url') {
                lit.url = value;
            }
            // 重新显示（用户手动操作时使用编辑模式）
            window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
            // 保存数据
            this.saveProjectData({ finalResults: this.state.allLiterature });
        }
    },

    // 编辑文献（弹出编辑框）
    editLiterature(index) {
        if (index < 0 || index >= this.state.allLiterature.length) {
            window.UIUtils.showToast('文献索引无效', 'error');
            return;
        }

        const lit = this.state.allLiterature[index];
        const modal = document.getElementById('literature-edit-modal');
        const content = document.getElementById('edit-modal-content');
        
        if (!modal || !content) {
            window.UIUtils.showToast('编辑框未找到', 'error');
            return;
        }

        // 填充编辑表单
        const titleValue = this.escapeHtml(lit.title || '');
        const authorsValue = this.escapeHtml(lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '');
        const yearValue = this.escapeHtml(lit.year || '');
        const abstractValue = this.escapeHtml(lit.abstract || '');
        const journalValue = this.escapeHtml(lit.journal || '');
        const citedValue = lit.cited !== undefined ? lit.cited : '';
        const urlValue = this.escapeHtml(lit.url || '');

        content.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">标题：</label>
                <input type="text" id="edit-title" value="${titleValue}" 
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">作者：</label>
                    <input type="text" id="edit-authors" value="${authorsValue}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                </div>
                <div>
                    <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">年份：</label>
                    <input type="text" id="edit-year" value="${yearValue}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                </div>
                <div>
                    <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">被引：</label>
                    <input type="number" id="edit-cited" value="${citedValue}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">期刊：</label>
                    <input type="text" id="edit-journal" value="${journalValue}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                </div>
                <div>
                    <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">链接：</label>
                    <input type="text" id="edit-url" value="${urlValue}" 
                           style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
                </div>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; font-size: 14px; color: #333; margin-bottom: 6px; font-weight: 500;">摘要：</label>
                <textarea id="edit-abstract" 
                          style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; min-height: 120px; resize: vertical; box-sizing: border-box; font-family: inherit;">${abstractValue}</textarea>
            </div>
        `;

        // 保存当前编辑的索引
        modal.setAttribute('data-edit-index', index);

        // 显示模态框
        modal.style.display = 'block';
    },

    // HTML转义（用于编辑框）
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // 关闭编辑模态框
    closeEditModal() {
        const modal = document.getElementById('literature-edit-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.removeAttribute('data-edit-index');
        }
    },

    // 保存编辑的文献
    saveEditedLiterature() {
        const modal = document.getElementById('literature-edit-modal');
        if (!modal) return;

        const indexStr = modal.getAttribute('data-edit-index');
        if (indexStr === null) return;

        const index = parseInt(indexStr);
        if (index < 0 || index >= this.state.allLiterature.length) {
            window.UIUtils.showToast('文献索引无效', 'error');
            return;
        }

        const lit = this.state.allLiterature[index];

        // 获取编辑后的值
        const titleInput = document.getElementById('edit-title');
        const authorsInput = document.getElementById('edit-authors');
        const yearInput = document.getElementById('edit-year');
        const citedInput = document.getElementById('edit-cited');
        const journalInput = document.getElementById('edit-journal');
        const urlInput = document.getElementById('edit-url');
        const abstractInput = document.getElementById('edit-abstract');

        if (!titleInput || !authorsInput || !yearInput || !citedInput || !journalInput || !urlInput || !abstractInput) {
            window.UIUtils.showToast('编辑表单元素未找到', 'error');
            return;
        }

        // 更新文献信息
        lit.title = titleInput.value.trim();
        lit.authors = authorsInput.value.trim();
        lit.year = yearInput.value.trim();
        lit.cited = parseInt(citedInput.value) || 0;
        lit.journal = journalInput.value.trim();
        lit.url = urlInput.value.trim();
        lit.abstract = abstractInput.value.trim();

        // 重新显示（用户手动操作时使用编辑模式）
        window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
        
        // 保存数据（确保保存所有相关字段）
        this.saveProjectData({ 
            finalResults: this.state.allLiterature,
            selectedLiterature: this.state.selectedLiterature,
            organizedData: this.state.selectedLiterature
        });
        
        // 关闭模态框
        this.closeEditModal();
        
        window.UIUtils.showToast('文献信息已保存', 'success');
    },

    // 删除文献
    deleteLiterature(index) {
        if (index >= 0 && index < this.state.allLiterature.length) {
            const lit = this.state.allLiterature[index];
            if (!confirm(`确定要删除文献 "${lit.title || '无标题'}" 吗？`)) {
                return;
            }
            
            // 从列表中删除
            this.state.allLiterature.splice(index, 1);
            
            // 从已选列表中删除
            this.state.selectedLiterature = this.state.selectedLiterature.filter(
                selected => selected.title !== lit.title && selected.url !== lit.url
            );
            
            // 重新显示（用户手动操作时使用编辑模式）
            window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
            
            // 保存数据（确保保存所有相关字段）
            this.saveProjectData({ 
                finalResults: this.state.allLiterature,
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature
            });
            
            window.UIUtils.showToast('文献已删除', 'success');
        }
    },

    // AI重新判断文献
    async aiRecommendLiterature(index) {
        if (index < 0 || index >= this.state.allLiterature.length) {
            window.UIUtils.showToast('文献索引无效', 'error');
            return;
        }

        const lit = this.state.allLiterature[index];
        if (!this.state.globalApiKey) {
            window.UIUtils.showToast('请先设置API Key', 'error');
            return;
        }

        if (!this.state.requirementData || !this.state.requirementData.requirement) {
            window.UIUtils.showToast('请先完成需求分析', 'error');
            return;
        }

        window.UIUtils.showToast('正在重新判断...', 'info');

        try {
            const prompt = `请判断以下文献是否与研究主题相关，并给出推荐理由。

研究主题：${this.state.requirementData.requirement}

文献标题：${lit.title}
作者：${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知'}
年份：${lit.year || '未知'}
摘要：${lit.abstract || '无摘要'}

请以JSON格式返回结果：
{
  "relevant": true/false,
  "reason": "推荐理由（如果相关）或为什么不相关（如果不相关）"
}

如果相关，请给出推荐理由；如果不相关，请简要说明原因。`;

            const apiProvider = this.getCurrentApiProvider();
            const answer = await window.API.callAPI(apiProvider, this.state.globalApiKey, [{ role: 'user', content: prompt }], 0.3);
            
            // 尝试解析JSON
            let isRelevant = false;
            let reason = '';
            
            try {
                const jsonMatch = answer.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const data = JSON.parse(jsonMatch[0]);
                    isRelevant = data.relevant === true || data.relevant === 'true';
                    reason = data.reason || '';
                } else {
                    // 如果不是JSON，尝试从文本中提取
                    if (answer.includes('相关') || answer.includes('relevant') || answer.toLowerCase().includes('true')) {
                        isRelevant = true;
                        reason = answer.replace(/相关|relevant|true|false|不相关/gi, '').trim();
                    } else {
                        isRelevant = false;
                        reason = answer.trim();
                    }
                }
            } catch (parseError) {
                console.log('解析AI返回结果失败，尝试文本匹配:', parseError);
                // 如果解析失败，使用简单的文本匹配
                if (answer.includes('相关') || answer.includes('relevant')) {
                    isRelevant = true;
                    reason = answer.replace(/相关|relevant/gi, '').trim();
                } else {
                    isRelevant = false;
                    reason = answer.trim();
                }
            }
            
            // 更新文献的AI判断结果
            lit.aiRecommendReason = reason;
            lit.selected = isRelevant;
            
            // 更新selectedLiterature列表
            if (isRelevant) {
                // 如果相关，添加到已选列表（如果还没有）
                if (!this.state.selectedLiterature.find(selected => selected.title === lit.title && selected.url === lit.url)) {
                    this.state.selectedLiterature.push(lit);
                }
            } else {
                // 如果不相关，从已选列表中移除
                this.state.selectedLiterature = this.state.selectedLiterature.filter(
                    selected => !(selected.title === lit.title && selected.url === lit.url)
                );
            }
            
            // 重新显示（用户手动操作时使用编辑模式）
            window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
            
            // 保存数据
            this.saveProjectData({ 
                finalResults: this.state.allLiterature,
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature
            });
            
            window.UIUtils.showToast(isRelevant ? 'AI判断：相关' : 'AI判断：不相关', isRelevant ? 'success' : 'info');
        } catch (error) {
            console.error('AI重新判断失败:', error);
            window.UIUtils.showToast(`AI判断失败: ${error.message || '未知错误'}`, 'error');
        }
    },


    // 导出Excel
    exportToExcel() {
        if (this.state.selectedLiterature.length === 0) {
            window.UIUtils.showToast('没有选中的文献，无法导出', 'error');
            return;
        }
        
        // 构建CSV内容
        let csvContent = '\uFEFF'; // BOM for Excel UTF-8
        csvContent += '标题,作者,年份,期刊,被引次数,链接,摘要,AI推荐理由\n';
        
        for (const lit of this.state.selectedLiterature) {
            const title = (lit.title || '').replace(/"/g, '""');
            const authors = (lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join('; ') : lit.authors) : '').replace(/"/g, '""');
            const year = lit.year || '';
            const journal = (lit.journal || lit.source || '').replace(/"/g, '""');
            const cited = lit.cited || 0;
            const url = lit.url || '';
            const abstract = (lit.abstract || '').replace(/"/g, '""').replace(/\n/g, ' ');
            const reason = (lit.aiRecommendReason || '').replace(/"/g, '""');
            
            csvContent += `"${title}","${authors}","${year}","${journal}","${cited}","${url}","${abstract}","${reason}"\n`;
        }
        
        // 创建下载链接
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `文献列表_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        window.UIUtils.showToast(`已导出 ${this.state.selectedLiterature.length} 篇文献到Excel`, 'success');
    },

    // 保存项目数据
    async saveProjectData(patch) {
        if (!this.state.currentProject) {
            throw new Error('未选择项目');
        }
        return await window.DataManager.saveProjectData(this.state.currentProject, patch);
    },

    // 保存当前项目的所有数据
    async saveCurrentProjectData() {
        if (!this.state.currentProject) {
            console.warn('没有当前项目，跳过保存');
            return;
        }

        try {
            // 从输入框获取最新数据（确保保存的是用户当前输入的内容）
            const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
            const apiProvider = this.getCurrentApiProvider();
            const requirement = window.UIUtils.getValue('main-requirement-input') || this.state.requirementData.requirement;
            const targetCount = parseInt(window.UIUtils.getValue('main-target-count')) || this.state.requirementData.targetCount || 50;
            const outline = window.UIUtils.getValue('main-outline-editor') || this.state.requirementData.outline;

            // 更新状态
            if (apiKey) {
                this.state.globalApiKey = apiKey;
                // 保存到apiKeys对象中
                if (!this.state.apiKeys) {
                    this.state.apiKeys = {};
                }
                this.state.apiKeys[apiProvider] = apiKey;
            }
            this.state.apiProvider = apiProvider;
            if (requirement) {
                this.state.requirementData.requirement = requirement;
            }
            if (targetCount) {
                this.state.requirementData.targetCount = targetCount;
            }
            if (outline) {
                this.state.requirementData.outline = outline;
            }

            // 收集当前所有状态数据
            const dataToSave = {
                config: {
                    apiKeys: this.state.apiKeys || {}, // 保存所有供应商的Keys
                    apiProvider: this.state.apiProvider
                },
                requirementData: this.state.requirementData,
                keywords: this.state.keywords,
                search: {
                    results: this.state.searchResults
                },
                finalResults: this.state.allLiterature,
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature,
                reviewContent: this.state.reviewContent,
                review: this.state.reviewContent
            };

            const result = await this.saveProjectData(dataToSave);
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

        // 绑定事件
    bindEvents() {
        // 节点点击事件
        for (let i = 1; i <= 5; i++) {
            const node = document.getElementById(`node-${i}`);
            if (node) {
                node.addEventListener('click', () => this.openNode(i));
            }
        }

        // 展开/隐藏按钮事件
        for (let i = 1; i <= 5; i++) {
            const toggleBtn = document.querySelector(`.toggle-node-btn[data-node="${i}"]`);
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡，避免触发节点点击
                    this.toggleNodeContent(i);
                });
            }
        }

        // 总览按钮事件
        const overviewBtn = document.getElementById('overview-btn');
        if (overviewBtn) {
            overviewBtn.addEventListener('click', () => {
                this.showOverview();
            });
        }

        // 总览中点击节点卡片跳转到编辑视图
        for (let i = 1; i <= 5; i++) {
            const overviewCard = document.querySelector(`.overview-node-card[data-node="${i}"]`);
            if (overviewCard) {
                overviewCard.addEventListener('click', () => {
                    this.showNodeDetail(i);
                });
            }
        }

        // 一键生成按钮事件
        const startAutoGenerateBtn = document.getElementById('start-auto-generate-btn');
        if (startAutoGenerateBtn) {
            startAutoGenerateBtn.addEventListener('click', () => {
                this.startAutoGenerate();
            });
        }

        // 停止生成按钮事件
        const stopAutoGenerateBtn = document.getElementById('stop-auto-generate-btn');
        if (stopAutoGenerateBtn) {
            stopAutoGenerateBtn.addEventListener('click', () => {
                this.stopAutoGenerate();
            });
        }

        // 节点2保存修改按钮事件
        const saveSearchResultsBtn = document.getElementById('save-search-results-btn');
        if (saveSearchResultsBtn) {
            saveSearchResultsBtn.addEventListener('click', () => {
                this.saveSearchResults();
            });
        }

        // 节点2重新搜索文献按钮事件
        const regenerateNode2Btn = document.getElementById('regenerate-node2-btn');
        if (regenerateNode2Btn) {
            regenerateNode2Btn.addEventListener('click', () => {
                this.regenerateNode(2);
            });
        }

        // 节点3保存修改按钮事件
        const saveCompletionBtn = document.getElementById('save-completion-btn');
        if (saveCompletionBtn) {
            saveCompletionBtn.addEventListener('click', () => {
                this.saveCompletionResults();
            });
        }

        // 节点3重新补全文献按钮事件
        const regenerateCompletionBtn = document.getElementById('regenerate-completion-btn');
        if (regenerateCompletionBtn) {
            regenerateCompletionBtn.addEventListener('click', () => {
                this.regenerateCompletion();
            });
        }

        // 节点4保存修改按钮事件
        const saveFilterBtn = document.getElementById('save-filter-btn');
        if (saveFilterBtn) {
            saveFilterBtn.addEventListener('click', () => {
                this.saveFilterResults();
            });
        }

        // 节点4重新精选文献按钮事件
        const regenerateFilterBtn = document.getElementById('regenerate-filter-btn');
        if (regenerateFilterBtn) {
            regenerateFilterBtn.addEventListener('click', () => {
                this.regenerateFilter();
            });
        }

        // 节点4操作按钮事件
        const exportExcelBtn = document.getElementById('export-excel-btn');
        if (exportExcelBtn) {
            exportExcelBtn.addEventListener('click', () => {
                this.exportToExcel();
            });
        }

        // 编辑模态框事件
        const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
        if (closeEditModalBtn) {
            closeEditModalBtn.addEventListener('click', () => {
                this.closeEditModal();
            });
        }

        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.closeEditModal();
            });
        }

        const saveEditBtn = document.getElementById('save-edit-btn');
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => {
                this.saveEditedLiterature();
            });
        }

        // 点击模态框背景关闭
        const editModal = document.getElementById('literature-edit-modal');
        if (editModal) {
            editModal.addEventListener('click', (e) => {
                if (e.target === editModal) {
                    this.closeEditModal();
                }
            });
        }

        // 返回项目管理（返回前先保存项目数据）
        const backBtn = document.getElementById('back-to-index-btn');
        if (backBtn) {
            backBtn.addEventListener('click', async () => {
                console.log('点击返回项目管理按钮');
                
                try {
                    // 先保存当前项目数据
                    if (this.state.currentProject) {
                        console.log('开始保存项目数据，项目名:', this.state.currentProject);
                        try {
                            await this.saveCurrentProjectData();
                            console.log('项目数据保存成功');
                        } catch (saveError) {
                            console.error('保存数据失败:', saveError);
                            // 保存失败时询问用户是否继续返回
                            const shouldContinue = confirm('保存项目数据失败，是否仍要返回项目管理界面？\n\n如果返回，未保存的更改可能会丢失。');
                            if (!shouldContinue) {
                                console.log('用户选择不返回');
                                return; // 用户选择不返回
                            }
                            console.log('用户选择继续返回');
                        }
                    } else {
                        console.warn('没有当前项目，跳过保存');
                    }
                    
                    // 清除当前项目（避免index.html自动切换回工作流）
                    console.log('清除当前项目状态');
                    if (window.electronAPI && window.electronAPI.setCurrentProject) {
                        await window.electronAPI.setCurrentProject(null);
                        console.log('当前项目已清除');
                    }
                    
                    // 返回到项目管理界面
                    console.log('准备返回到项目管理界面');
                    console.log('electronAPI 存在:', !!window.electronAPI);
                    console.log('switchToIndex 存在:', !!(window.electronAPI && window.electronAPI.switchToIndex));
                    
                    if (window.electronAPI && window.electronAPI.switchToIndex) {
                        const result = await window.electronAPI.switchToIndex();
                        console.log('switchToIndex 返回结果:', result);
                        if (result && result.success) {
                            console.log('成功返回到项目管理界面');
                        } else {
                            const errorMsg = result?.error || '未知错误';
                            console.error('返回失败:', errorMsg);
                            window.UIUtils.showToast('返回项目管理界面失败: ' + errorMsg, 'error');
                        }
                    } else {
                        console.error('electronAPI.switchToIndex 不存在');
                        window.UIUtils.showToast('无法返回项目管理界面（API不存在）', 'error');
                    }
                } catch (error) {
                    console.error('返回过程出错:', error);
                    window.UIUtils.showToast('返回失败: ' + error.message, 'error');
                }
            });
        } else {
            console.warn('返回按钮未找到: back-to-index-btn');
        }

        // 需求分析
        const analyzeBtn = document.getElementById('analyze-main-requirement-btn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.analyzeRequirement());
        }

        // 一键生成
        const startBtn = document.getElementById('start-auto-generate-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startAutoGenerate());
        }

        // 保存项目需求设置
        const saveRequirementBtn = document.getElementById('save-requirement-btn');
        if (saveRequirementBtn) {
            saveRequirementBtn.addEventListener('click', () => this.saveRequirementSettings());
        }

        // 目标数量提示
        const targetCountInput = document.getElementById('main-target-count');
        if (targetCountInput) {
            targetCountInput.addEventListener('input', () => {
                window.RequirementManager.updateTargetHint();
            });
        }

        // API供应商选择变化事件
        const apiProviderSelect = document.getElementById('main-api-provider-select');
        if (apiProviderSelect) {
            apiProviderSelect.addEventListener('change', () => {
                this.updateApiProviderUI();
            });
        }

        // Google Scholar验证按钮（在checkRequirementStatus中动态绑定，这里不绑定）
        // 验证按钮的事件绑定在checkRequirementStatus中根据验证状态动态设置

        // 生成综述按钮事件
        const generateReviewBtn = document.getElementById('generate-review-btn');
        if (generateReviewBtn) {
            generateReviewBtn.addEventListener('click', () => this.generateReview());
        }

        // 复制综述内容按钮事件
        const copyReviewBtn = document.getElementById('copy-review-btn');
        if (copyReviewBtn) {
            copyReviewBtn.addEventListener('click', () => this.copyReviewContent());
        }

        // 导出Word按钮事件
        const exportWordBtn = document.getElementById('export-word-btn');
        if (exportWordBtn) {
            exportWordBtn.addEventListener('click', () => this.exportReviewToWord());
        }

        // 节点1关键词分析按钮事件
        const regenerateKeywordsBtn = document.getElementById('regenerate-keywords-btn');
        if (regenerateKeywordsBtn) {
            regenerateKeywordsBtn.addEventListener('click', () => this.regenerateKeywords());
        }
    },

    // Google Scholar验证
    async verifyGoogleScholar(isReverify = false) {
        const verifyBtn = document.getElementById('verify-google-scholar-btn');
        const statusEl = document.getElementById('google-scholar-verify-status');
        
        if (!window.electronAPI || !window.electronAPI.openScholarLogin) {
            window.UIUtils.showToast('无法打开验证窗口（API不可用）', 'error');
            return false;
        }

        // 如果已验证且不是重新验证，直接返回
        if (!isReverify && this.state.googleScholarVerified) {
            window.UIUtils.showToast('当前项目已验证，如需重新验证请点击"重新验证"', 'info');
            return true;
        }

        try {
            // 更新按钮状态
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '⏳ 正在打开验证窗口...';
                verifyBtn.style.opacity = '0.7';
            }

            window.UIUtils.showToast('正在打开Google Scholar验证窗口...', 'info');

            // 调用主进程打开验证窗口（传入自动搜索参数）
            const result = await window.electronAPI.openScholarLogin('Machine learning', 50);
            
            if (result && result.success) {
                // 验证完成
                this.state.googleScholarVerified = true;
                
                // 保存验证状态到项目数据
                if (this.state.currentProject) {
                    // 更新projectData.config以便后续保存时能正确合并
                    if (!this.state.projectData.config) {
                        this.state.projectData.config = {};
                    }
                    this.state.projectData.config.googleScholarVerified = true;
                    
                    await this.saveProjectData({
                        config: {
                            ...this.state.projectData.config,
                            googleScholarVerified: true
                        }
                    });
                }
                
                // 更新UI（通过重新绑定事件）
                if (verifyBtn) {
                    verifyBtn.innerHTML = '✓ 已验证（点击重新验证）';
                    verifyBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                    verifyBtn.disabled = false;
                    verifyBtn.style.opacity = '1';
                    // 移除旧的事件监听器，添加新的重新验证监听器
                    const newBtn = verifyBtn.cloneNode(true);
                    verifyBtn.parentNode.replaceChild(newBtn, verifyBtn);
                    const newVerifyBtn = document.getElementById('verify-google-scholar-btn');
                    if (newVerifyBtn) {
                        newVerifyBtn.addEventListener('click', () => this.reverifyGoogleScholar());
                    }
                }
                
                if (statusEl) {
                    statusEl.style.display = 'inline';
                }
                
                window.UIUtils.showToast('Google Scholar验证完成！', 'success');
                return true;
            } else {
                // 验证失败或取消
                const errorMsg = result?.error || '验证失败或已取消';
                window.UIUtils.showToast(`验证失败: ${errorMsg}`, 'error');
                
                // 恢复按钮状态
                if (verifyBtn) {
                    verifyBtn.disabled = false;
                    verifyBtn.innerHTML = '🔐 进行Google Scholar验证';
                    verifyBtn.style.opacity = '1';
                }
                return false;
            }
        } catch (error) {
            console.error('Google Scholar验证失败:', error);
            window.UIUtils.showToast(`验证失败: ${error.message || '未知错误'}`, 'error');
            
            // 恢复按钮状态
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '🔐 进行Google Scholar验证';
                verifyBtn.style.opacity = '1';
            }
            return false;
        }
    },

    // 重新验证Google Scholar（允许用户因为更换网络环境重新验证）
    async reverifyGoogleScholar() {
        const confirmed = confirm('确定要重新验证Google Scholar吗？\n\n重新验证将清除当前验证状态，适用于更换网络环境等情况。');
        if (!confirmed) {
            return;
        }

        // 清除当前验证状态
        this.state.googleScholarVerified = false;
        if (this.state.projectData.config) {
            this.state.projectData.config.googleScholarVerified = false;
        }

        // 执行验证
        await this.verifyGoogleScholar(true);
    },

    // 保存项目需求设置
    async saveRequirementSettings() {
        if (!this.state.currentProject) {
            window.UIUtils.showToast('未选择项目，无法保存', 'error');
            return;
        }

        try {
            // 从输入框获取最新数据
            const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
            const apiProvider = this.getCurrentApiProvider();
            const requirement = window.UIUtils.getValue('main-requirement-input') || '';
            const targetCount = parseInt(window.UIUtils.getValue('main-target-count')) || 50;
            const outline = window.UIUtils.getValue('main-outline-editor') || '';
            const language = window.UIUtils.getValue('main-language-select') || 'zh';

            // 更新状态
            if (apiKey) {
                this.state.globalApiKey = apiKey;
                // 保存到apiKeys对象中
                if (!this.state.apiKeys) {
                    this.state.apiKeys = {};
                }
                this.state.apiKeys[apiProvider] = apiKey;
            }
            this.state.apiProvider = apiProvider;
            this.state.requirementData.requirement = requirement;
            this.state.requirementData.targetCount = targetCount;
            this.state.requirementData.outline = outline;
            this.state.requirementData.language = language;

            // 保存到JSON文件
            await this.saveProjectData({
                config: {
                    apiKeys: this.state.apiKeys || {}, // 保存所有供应商的Keys
                    apiProvider: apiProvider
                },
                requirementData: {
                    requirement: requirement,
                    targetCount: targetCount,
                    outline: outline,
                    language: language,
                    keywordsPlan: this.state.requirementData.keywordsPlan || [] // 保留已有的关键词计划
                }
            });

            window.UIUtils.showToast('项目需求设置已保存', 'success');
        } catch (error) {
            console.error('保存项目需求设置失败:', error);
            window.UIUtils.showToast('保存失败: ' + (error.message || '未知错误'), 'error');
        }
    },

    // 分析需求
    async analyzeRequirement() {
        const apiKey = window.UIUtils.getValue('main-api-key-input');
        const requirement = window.UIUtils.getValue('main-requirement-input');
        const targetCount = parseInt(window.UIUtils.getValue('main-target-count')) || 50;
        const language = window.UIUtils.getValue('main-language-select') || 'zh';

        if (!apiKey) {
            window.UIUtils.showToast('请先输入API Key', 'error');
            return;
        }
        if (!requirement) {
            window.UIUtils.showToast('请先输入需求描述', 'error');
            return;
        }

        try {
            window.UIUtils.showElement('main-requirement-progress');
            window.UIUtils.updateProgress('main-requirement-progress', 'main-progress-fill', 'main-progress-text', 50, '正在分析需求...');

            this.state.globalApiKey = apiKey;
            this.state.requirementData.requirement = requirement;
            this.state.requirementData.targetCount = targetCount;
            this.state.requirementData.language = language;

            const apiProvider = this.getCurrentApiProvider();
            const result = await window.RequirementManager.analyzeRequirement(apiKey, requirement, targetCount, apiProvider);
            
            this.state.requirementData.outline = result.outline;
            // 需求分析不再生成关键词，关键词将在节点1中生成

            window.UIUtils.updateProgress('main-requirement-progress', 'main-progress-fill', 'main-progress-text', 100, '分析完成！');
            
            window.UIUtils.setValue('main-outline-editor', result.outline);
            window.UIUtils.showElement('main-outline-result');
            window.UIUtils.hideElement('main-requirement-progress');

            // 保存当前供应商的Key到apiKeys对象
            if (apiKey) {
                if (!this.state.apiKeys) {
                    this.state.apiKeys = {};
                }
                this.state.apiKeys[apiProvider] = apiKey;
            }
            
            await this.saveProjectData({
                config: { 
                    apiKeys: this.state.apiKeys || {},
                    apiProvider: apiProvider
                },
                requirementData: this.state.requirementData
            });

            // 更新生成按钮显示状态
            this.updateGenerateButtonState();

            window.UIUtils.showToast('需求分析完成', 'success');
        } catch (error) {
            console.error('分析需求失败:', error);
            window.UIUtils.hideElement('main-requirement-progress');
            window.UIUtils.showToast('分析失败: ' + error.message, 'error');
        }
    },

    // 重新生成指定节点
    async regenerateNode(nodeNum) {
        // 检查前置条件
        if (nodeNum === 2) {
            // 节点2需要节点1完成
            if (!this.state.requirementData.keywordsPlan || this.state.requirementData.keywordsPlan.length === 0) {
                window.UIUtils.showToast('请先完成节点1：关键词分析', 'error');
                return;
            }
        } else if (nodeNum === 3) {
            // 节点3需要节点2完成
            if (!this.state.allLiterature || this.state.allLiterature.length === 0) {
                window.UIUtils.showToast('请先完成节点2：文献搜索', 'error');
                return;
            }
        } else if (nodeNum === 4) {
            // 节点4需要节点3完成
            if (!this.state.allLiterature || this.state.allLiterature.length === 0) {
                window.UIUtils.showToast('请先完成节点3：文献补全', 'error');
                return;
            }
        }

        // 检查是否已有数据
        let hasExistingData = false;
        let confirmMessage = '';
        if (nodeNum === 2) {
            hasExistingData = this.state.allLiterature && this.state.allLiterature.length > 0;
            confirmMessage = '当前已存在搜索结果，重新搜索将覆盖现有搜索结果。\n\n是否继续？';
        } else if (nodeNum === 3) {
            hasExistingData = this.state.allLiterature && this.state.allLiterature.some(lit => lit.abstract && lit.abstract.trim());
            confirmMessage = '当前已存在补全的文献，重新生成将覆盖现有补全结果。\n\n是否继续？';
        } else if (nodeNum === 4) {
            hasExistingData = this.state.selectedLiterature && this.state.selectedLiterature.length > 0;
            confirmMessage = '当前已存在筛选结果，重新生成将覆盖现有筛选结果。\n\n是否继续？';
        }

        if (hasExistingData) {
            const confirmed = confirm(confirmMessage);
            if (!confirmed) {
                return;
            }
        }

        // 检查API Key
        const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
        if (!apiKey) {
            window.UIUtils.showToast('请先设置API Key', 'error');
            return;
        }

        this.state.globalApiKey = apiKey;

        try {
            // 执行对应节点的重新生成
            if (nodeNum === 2) {
                // 节点2重新搜索时，隐藏多余的内容，只显示进度条（与一键生成一致）
                window.UIUtils.hideElement('search-results');
                const saveSearchBtn = document.getElementById('save-search-results-btn');
                const regenerateBtn2 = document.getElementById('regenerate-node2-btn');
                if (saveSearchBtn) {
                    saveSearchBtn.style.display = 'none';
                }
                if (regenerateBtn2) {
                    regenerateBtn2.style.display = 'none';
                }
                await this.autoExecuteNode2();
            } else if (nodeNum === 3) {
                // 节点3重新补全时，隐藏多余的内容，只显示进度条（与一键生成一致）
                window.UIUtils.hideElement('complete-results');
                const saveBtn = document.getElementById('save-completion-btn');
                const regenerateBtn = document.getElementById('regenerate-completion-btn');
                if (saveBtn) {
                    saveBtn.style.display = 'none';
                }
                if (regenerateBtn) {
                    regenerateBtn.style.display = 'none';
                }
                await this.autoExecuteNode3();
            } else if (nodeNum === 4) {
                // 节点4重新精选时，隐藏多余的内容，只显示进度条（与一键生成一致）
                window.UIUtils.hideElement('filter-results');
                window.UIUtils.hideElement('filter-statistics-container');
                const exportBtn = document.getElementById('export-excel-btn');
                const saveBtn = document.getElementById('save-filter-btn');
                const regenerateBtn = document.getElementById('regenerate-filter-btn');
                if (exportBtn) {
                    exportBtn.style.display = 'none';
                }
                if (saveBtn) {
                    saveBtn.style.display = 'none';
                }
                if (regenerateBtn) {
                    regenerateBtn.style.display = 'none';
                }
                await this.autoExecuteNode4();
            }

            window.UIUtils.showToast(`节点${nodeNum}重新生成完成`, 'success');
        } catch (error) {
            console.error(`节点${nodeNum}重新生成失败:`, error);
            window.UIUtils.showToast(`节点${nodeNum}重新生成失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 从指定节点继续生成（跳过当前节点，从下一个节点开始）
    async continueGenerateFromNode(startNode) {
        if (!this.state.requirementData.outline) {
            window.UIUtils.showToast('请先完成需求分析', 'error');
            return;
        }

        const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
        if (!apiKey) {
            window.UIUtils.showToast('请先输入API Key', 'error');
            return;
        }

        // 检查当前节点是否完成
        if (this.state.nodeStates[startNode] !== 'completed') {
            window.UIUtils.showToast(`请先完成节点${startNode}`, 'error');
            return;
        }

        // 检查前置节点是否完成
        for (let i = 1; i < startNode; i++) {
            if (this.state.nodeStates[i] !== 'completed') {
                window.UIUtils.showToast(`请先完成节点${i}`, 'error');
                return;
            }
        }

        // 确定下一个要执行的节点
        const nextNode = startNode + 1;
        if (nextNode > 5) {
            window.UIUtils.showToast('所有节点已完成', 'info');
            return;
        }

        this.state.globalApiKey = apiKey;
        this.state.isAutoGenerating = true;
        this.state.currentAutoNode = nextNode; // 从下一个节点开始
        this.state.shouldStop = false; // 重置停止标志

        // 更新按钮显示状态
        const startBtn = document.getElementById('start-auto-generate-btn');
        const stopBtn = document.getElementById('stop-auto-generate-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';

        // 保存当前供应商的Key到apiKeys对象
        const apiProvider = this.getCurrentApiProvider();
        if (apiKey) {
            if (!this.state.apiKeys) {
                this.state.apiKeys = {};
            }
            this.state.apiKeys[apiProvider] = apiKey;
        }
        
        await this.saveProjectData({
            config: { 
                apiKeys: this.state.apiKeys || {},
                apiProvider: apiProvider
            },
            requirementData: this.state.requirementData
        });

        this.updateNodeStates();
        
        // 在开始执行前，先隐藏所有未开始的节点内容（未来节点）
        for (let i = 1; i <= 5; i++) {
            const nodeContent = document.getElementById(`content-node-${i}`);
            const nodeStatus = this.state.nodeStates[i];
            if (nodeContent) {
                if (nodeStatus === 'pending') {
                    // 未来节点：完全隐藏，不显示任何信息
                    nodeContent.style.display = 'none';
                    nodeContent.classList.remove('active');
                    // 同时隐藏节点内容体
                    const nodeBody = document.getElementById(`node-body-${i}`);
                    if (nodeBody) {
                        nodeBody.style.display = 'none';
                    }
                } else {
                    // 已完成的节点：显示
                    nodeContent.style.display = 'block';
                    nodeContent.classList.add('active');
                }
            }
        }
        
        // 显示下一个节点的内容（动态展示，会自动处理已完成节点的显示和未开始节点的隐藏）
        this.showNodeContent(nextNode);
        
        window.UIUtils.showToast(`开始执行节点${nextNode}...`, 'info');
        await this.executeNextNode();
    },

    // 一键生成
    async startAutoGenerate() {
        console.log('[startAutoGenerate] ========== START AUTO GENERATE CALLED ==========');
        console.log('[startAutoGenerate] Checking prerequisites...');
        
        if (!this.state.requirementData.outline) {
            console.warn('[startAutoGenerate] No outline found, returning');
            window.UIUtils.showToast('请先完成需求分析', 'error');
            return;
        }
        console.log('[startAutoGenerate] Outline exists:', this.state.requirementData.outline.substring(0, 100));

        const apiKey = window.UIUtils.getValue('main-api-key-input');
        if (!apiKey) {
            console.warn('[startAutoGenerate] No API key found, returning');
            window.UIUtils.showToast('请先输入API Key', 'error');
            return;
        }
        console.log('[startAutoGenerate] API key exists, length:', apiKey.length);

        // 检查Google Scholar验证状态（每个项目必须验证）
        if (!this.state.currentProject) {
            window.UIUtils.showToast('请先选择或创建项目', 'error');
            return;
        }

        // 检查当前项目的验证状态
        const isVerified = this.state.googleScholarVerified || 
                          (this.state.projectData.config && this.state.projectData.config.googleScholarVerified);
        
        if (!isVerified) {
            const confirmed = confirm('⚠️ 检测到当前项目尚未完成Google Scholar验证。\n\n每个项目必须完成验证后才能进行一键生成。\n\n是否现在进行验证？');
            if (!confirmed) {
                window.UIUtils.showToast('已取消一键生成，请先完成Google Scholar验证', 'info');
                return;
            }
            
            // 打开验证窗口
            const verifyResult = await this.verifyGoogleScholar();
            if (!verifyResult || !this.state.googleScholarVerified) {
                window.UIUtils.showToast('验证未完成，无法进行一键生成', 'error');
                return;
            }
        }

        // 检查当前是否有已保存的内容
        const hasKeywords = this.state.keywords && this.state.keywords.length > 0;
        const hasLiterature = this.state.allLiterature && this.state.allLiterature.length > 0;
        const hasSelectedLiterature = this.state.selectedLiterature && this.state.selectedLiterature.length > 0;
        const hasReview = this.state.reviewContent && this.state.reviewContent.trim().length > 0;
        
        // 如果有任何已保存的内容，显示确认对话框
        if (hasKeywords || hasLiterature || hasSelectedLiterature || hasReview) {
            const contentList = [];
            if (hasKeywords) {
                contentList.push(`• 关键词 (${this.state.keywords.length}个)`);
            }
            if (hasLiterature) {
                contentList.push(`• 搜索到的文献 (${this.state.allLiterature.length}篇)`);
            }
            if (hasSelectedLiterature) {
                contentList.push(`• 已筛选的文献 (${this.state.selectedLiterature.length}篇)`);
            }
            if (hasReview) {
                contentList.push(`• 已生成的综述内容 (${Math.round(this.state.reviewContent.length / 100)}百字)`);
            }
            
            const contentText = contentList.join('\n');
            const confirmMessage = `⚠️ 警告：检测到当前项目已有以下内容：\n\n${contentText}\n\n⚠️ 一键生成将清空所有现有内容并重新开始！\n\n此操作不可撤销，确定要继续吗？`;
            
            const confirmed = confirm(confirmMessage);
            if (!confirmed) {
                window.UIUtils.showToast('已取消一键生成', 'info');
                return;
            }
        }

        // 用户确认后，先清除JSON文件中的节点信息
        console.log('[startAutoGenerate] Clearing node data from JSON file...');
        await this.saveProjectData({
            keywords: [],
            search: { results: {} },
            finalResults: [],
            selectedLiterature: [],
            organizedData: [],
            reviewContent: '',
            review: '',
            requirementData: {
                ...this.state.requirementData,
                keywordsPlan: [] // 清空关键词计划，重新生成
            }
        });
        console.log('[startAutoGenerate] Node data cleared from JSON file');

        // 然后清空state中的所有现有内容
        // 注意：保留需求分析相关数据（requirement、outline），只清空执行结果
        this.state.keywords = [];
        this.state.searchResults = {};
        this.state.allLiterature = [];
        this.state.selectedLiterature = [];
        this.state.reviewContent = '';
        // 在一键生成时，应该重新生成关键词，所以清空它
        this.state.requirementData.keywordsPlan = [];
        
        // 重置所有节点状态为pending
        for (let i = 1; i <= 5; i++) {
            this.state.nodeStates[i] = 'pending';
        }
        
        // 清空节点显示内容
        const node1Result = document.getElementById('keywords-result');
        const node2Result = document.getElementById('search-results-list');
        const node3Result = document.getElementById('complete-results-list');
        const node4Result = document.getElementById('filter-results-list');
        const node5Result = document.getElementById('review-content');
        
        if (node1Result) node1Result.innerHTML = '';
        if (node2Result) node2Result.innerHTML = '';
        if (node3Result) node3Result.innerHTML = '';
        if (node4Result) node4Result.innerHTML = '';
        if (node5Result) node5Result.innerHTML = '';
        
        console.log('[startAutoGenerate] Setting up state...');
        this.state.globalApiKey = apiKey;
        this.state.apiProvider = this.getCurrentApiProvider();
        this.state.isAutoGenerating = true;
        this.state.currentAutoNode = 1;
        this.state.shouldStop = false; // 重置停止标志
        console.log('[startAutoGenerate] State initialized:', {
            isAutoGenerating: this.state.isAutoGenerating,
            currentAutoNode: this.state.currentAutoNode,
            shouldStop: this.state.shouldStop
        });

        // 更新按钮显示状态
        const startBtn = document.getElementById('start-auto-generate-btn');
        const stopBtn = document.getElementById('stop-auto-generate-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';
        console.log('[startAutoGenerate] Buttons updated');
        
        // 更新总览显示（清空后重新显示）
        this.updateOverview();
        console.log('[startAutoGenerate] Overview updated');

        // 在开始执行前，先隐藏所有未开始的节点内容（未来节点）
        for (let i = 1; i <= 5; i++) {
            const nodeContent = document.getElementById(`content-node-${i}`);
            const nodeStatus = this.state.nodeStates[i];
            if (nodeContent) {
                if (nodeStatus === 'pending') {
                    // 未来节点：完全隐藏，不显示任何信息
                    nodeContent.style.display = 'none';
                    nodeContent.classList.remove('active');
                    // 同时隐藏节点内容体
                    const nodeBody = document.getElementById(`node-body-${i}`);
                    if (nodeBody) {
                        nodeBody.style.display = 'none';
                    }
                } else {
                    // 已完成的节点：显示
                    nodeContent.style.display = 'block';
                    nodeContent.classList.add('active');
                }
            }
        }
        console.log('[startAutoGenerate] Node visibility updated');

        // 保存当前供应商的Key到apiKeys对象
        if (apiKey) {
            if (!this.state.apiKeys) {
                this.state.apiKeys = {};
            }
            this.state.apiKeys[this.state.apiProvider] = apiKey;
        }
        
        console.log('[startAutoGenerate] Saving project data...');
        await this.saveProjectData({
            config: { 
                apiKeys: this.state.apiKeys || {},
                apiProvider: this.state.apiProvider
            },
            requirementData: this.state.requirementData
        });
        console.log('[startAutoGenerate] Project data saved');

        this.updateNodeStates();
        console.log('[startAutoGenerate] Node states updated');
        
        console.log('[startAutoGenerate] About to call executeNextNode...');
        console.log('[startAutoGenerate] Current state before executeNextNode:', {
            currentAutoNode: this.state.currentAutoNode,
            isAutoGenerating: this.state.isAutoGenerating,
            shouldStop: this.state.shouldStop
        });
        
        window.UIUtils.showToast('开始执行节点1：关键词分析...', 'info');
        await this.executeNextNode();
        console.log('[startAutoGenerate] executeNextNode completed');
    },

    // 停止生成
    stopAutoGenerate() {
        if (!this.state.isAutoGenerating) {
            return;
        }

        this.state.shouldStop = true;
        this.state.isAutoGenerating = false;
        this.state.currentAutoNode = 0;

        // 更新按钮显示状态
        const startBtn = document.getElementById('start-auto-generate-btn');
        const stopBtn = document.getElementById('stop-auto-generate-btn');
        if (startBtn) startBtn.style.display = 'block';
        if (stopBtn) stopBtn.style.display = 'none';

        // 更新当前节点的状态为pending（如果正在执行）
        for (let i = 1; i <= 5; i++) {
            if (this.state.nodeStates[i] === 'active') {
                this.updateNodeState(i, 'pending');
            }
        }

        // 恢复所有节点的显示（停止后显示所有节点）
        for (let i = 1; i <= 5; i++) {
            const node = document.getElementById(`node-${i}`);
            if (node) {
                node.style.display = 'block';
            }
        }

        window.UIUtils.showToast('已停止生成', 'info');
    },

    // 执行下一个节点
    async executeNextNode() {
        console.log('[executeNextNode] ========== EXECUTE NEXT NODE CALLED ==========');
        console.log('[executeNextNode] Current state:', {
            currentAutoNode: this.state.currentAutoNode,
            shouldStop: this.state.shouldStop,
            isAutoGenerating: this.state.isAutoGenerating
        });
        
        // 检查是否应该停止
        if (this.state.shouldStop) {
            console.log('[executeNextNode] Should stop flag is true, exiting');
            this.state.isAutoGenerating = false;
            this.state.currentAutoNode = 0;
            const startBtn = document.getElementById('start-auto-generate-btn');
            const stopBtn = document.getElementById('stop-auto-generate-btn');
            if (startBtn) startBtn.style.display = 'block';
            if (stopBtn) stopBtn.style.display = 'none';
            return;
        }

        try {
            console.log('[executeNextNode] Entering switch statement, currentAutoNode:', this.state.currentAutoNode);
            switch(this.state.currentAutoNode) {
                case 1:
                    console.log('[executeNextNode] Case 1: Calling autoExecuteNode1...');
                    await this.autoExecuteNode1();
                    console.log('[executeNextNode] autoExecuteNode1 completed');
                    if (this.state.shouldStop) {
                        console.log('[executeNextNode] Should stop after node 1, returning');
                        return;
                    }
                    this.state.currentAutoNode = 2;
                    console.log('[executeNextNode] Moving to node 2');
                    window.UIUtils.showToast('节点1完成，2秒后自动开始文献搜索...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            window.UIUtils.showToast('开始执行节点2：文献搜索...', 'info');
                            this.executeNextNode();
                        }
                    }, 2000);
                    break;
                case 2:
                    await this.autoExecuteNode2();
                    if (this.state.shouldStop) return;
                    this.state.currentAutoNode = 3;
                    window.UIUtils.showToast('节点2完成，开始执行节点3：文献补全...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            this.executeNextNode();
                        }
                    }, 1000);
                    break;
                case 3:
                    await this.autoExecuteNode3();
                    if (this.state.shouldStop) return;
                    this.state.currentAutoNode = 4;
                    window.UIUtils.showToast('节点3完成，2秒后自动开始精选文献...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            window.UIUtils.showToast('开始执行节点4：精选文献...', 'info');
                            this.executeNextNode();
                        }
                    }, 2000);
                    break;
                case 4:
                    await this.autoExecuteNode4();
                    if (this.state.shouldStop) return;
                    this.state.currentAutoNode = 5;
                    window.UIUtils.showToast('节点4完成，2秒后自动开始综述撰写...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            window.UIUtils.showToast('开始执行节点5：综述撰写...', 'info');
                            this.executeNextNode();
                        }
                    }, 2000);
                    break;
                case 5:
                    await this.autoExecuteNode5();
                    window.UIUtils.showToast('所有节点执行完成！', 'success');
                    this.state.isAutoGenerating = false;
                    this.state.currentAutoNode = 0;
                    // 更新按钮显示状态
                    const startBtn = document.getElementById('start-auto-generate-btn');
                    const stopBtn = document.getElementById('stop-auto-generate-btn');
                    if (startBtn) startBtn.style.display = 'block';
                    if (stopBtn) stopBtn.style.display = 'none';
                    // 恢复所有节点的显示（完成后显示所有节点）
                    for (let i = 1; i <= 5; i++) {
                        const node = document.getElementById(`node-${i}`);
                        if (node) {
                            node.style.display = 'block';
                        }
                        // 恢复所有节点内容的显示
                        const nodeContent = document.getElementById(`content-node-${i}`);
                        if (nodeContent) {
                            nodeContent.style.display = 'block';
                        }
                    }
                    break;
                default:
                    this.state.isAutoGenerating = false;
                    this.state.currentAutoNode = 0;
                    const startBtn2 = document.getElementById('start-auto-generate-btn');
                    const stopBtn2 = document.getElementById('stop-auto-generate-btn');
                    if (startBtn2) startBtn2.style.display = 'block';
                    if (stopBtn2) stopBtn2.style.display = 'none';
                    // 恢复所有节点的显示
                    for (let i = 1; i <= 5; i++) {
                        const node = document.getElementById(`node-${i}`);
                        if (node) {
                            node.style.display = 'block';
                        }
                        // 恢复所有节点内容的显示
                        const nodeContent = document.getElementById(`content-node-${i}`);
                        if (nodeContent) {
                            nodeContent.style.display = 'block';
                        }
                    }
            }
        } catch (error) {
            console.error(`节点${this.state.currentAutoNode}执行失败:`, error);
            window.UIUtils.showToast(`节点${this.state.currentAutoNode}执行失败: ${error.message}`, 'error');
            this.state.isAutoGenerating = false;
            this.state.currentAutoNode = 0;
            // 更新按钮显示状态
            const startBtn3 = document.getElementById('start-auto-generate-btn');
            const stopBtn3 = document.getElementById('stop-auto-generate-btn');
            if (startBtn3) startBtn3.style.display = 'block';
            if (stopBtn3) stopBtn3.style.display = 'none';
            // 恢复所有节点的显示（失败后显示所有节点）
            for (let i = 1; i <= 5; i++) {
                const node = document.getElementById(`node-${i}`);
                if (node) {
                    node.style.display = 'block';
                }
                // 恢复所有节点内容的显示
                const nodeContent = document.getElementById(`content-node-${i}`);
                if (nodeContent) {
                    nodeContent.style.display = 'block';
                }
            }
        }
    },

    // 自动执行各个节点（简化版本，实际执行逻辑在各自的模块中）
    async autoExecuteNode1() {
        try {
            console.log('[Node 1] ========== STARTING NODE 1 EXECUTION ==========');
            console.log('[Node 1] Starting keyword analysis...');
            console.log('[Node 1] State before execution:', {
                hasRequirementData: !!this.state.requirementData,
                requirement: this.state.requirementData.requirement,
                targetCount: this.state.requirementData.targetCount,
                outline: this.state.requirementData.outline,
                hasApiKey: !!this.state.globalApiKey,
                globalApiKeyLength: this.state.globalApiKey ? this.state.globalApiKey.length : 0
            });
            
            console.log('[Node 1] Updating node state to active...');
            this.updateNodeState(1, 'active');
            console.log('[Node 1] Node state updated');
            
            // 自动执行时实时显示节点内容
            console.log('[Node 1] Calling showNodeContent(1)...');
            this.showNodeContent(1);
            console.log('[Node 1] showNodeContent(1) called');

            console.log('[Node 1] Showing progress bar, hiding result...');
            window.UIUtils.showElement('keywords-auto-progress');
            window.UIUtils.hideElement('keywords-result');
            window.UIUtils.updateProgress('keywords-auto-progress', 'keywords-progress-fill', 'keywords-progress-text', 20, '正在分析关键词...');
            console.log('[Node 1] Progress bar shown');

            console.log('[Node 1] Calling Node1Keywords.execute...');
            console.log('[Node 1] Parameters:', {
                apiKeyExists: !!this.state.globalApiKey,
                apiKeyLength: this.state.globalApiKey ? this.state.globalApiKey.length : 0,
                requirementData: this.state.requirementData
            });
            
            const apiProvider = this.getCurrentApiProvider();
            const keywordsPlan = await window.Node1Keywords.execute(this.state.globalApiKey, this.state.requirementData, apiProvider);
            console.log('[Node 1] Node1Keywords.execute returned:', {
                hasResult: !!keywordsPlan,
                isArray: Array.isArray(keywordsPlan),
                length: keywordsPlan ? keywordsPlan.length : 0
            });
            
            // 验证返回结果
            if (!keywordsPlan || !Array.isArray(keywordsPlan) || keywordsPlan.length === 0) {
                console.error('[Node 1] ERROR: Keywords analysis returned empty or invalid result');
                throw new Error('关键词分析返回结果为空或格式错误');
            }
            
            console.log('[Node 1] Keywords analysis completed. Received keywords:', {
                count: keywordsPlan.length,
                keywords: keywordsPlan.map(item => `${item.keyword} (${item.count} papers)`)
            });
            
            // 更新状态数据
            this.state.requirementData.keywordsPlan = keywordsPlan;
            this.state.keywords = keywordsPlan.map(item => item.keyword);
            
            console.log('[Node 1] State updated:', {
                keywordsPlanLength: keywordsPlan.length,
                stateKeywordsPlanLength: this.state.requirementData.keywordsPlan.length,
                keywordsLength: this.state.keywords.length,
                keywordsPlan: this.state.requirementData.keywordsPlan
            });

            // 完成时更新进度条，不显示结果
            window.UIUtils.updateProgress('keywords-auto-progress', 'keywords-progress-fill', 'keywords-progress-text', 100, '关键词分析完成！');
            
            // 更新节点状态为已完成
            this.updateNodeState(1, 'completed');
            
            console.log('[Node 1] Saving project data...');
            await this.saveProjectData({ 
                keywords: this.state.keywords, 
                requirementData: this.state.requirementData 
            });
            console.log('[Node 1] Project data saved successfully');
            console.log('[Node 1] Final state:', {
                keywordsPlanLength: this.state.requirementData.keywordsPlan.length,
                keywordsLength: this.state.keywords.length,
                keywordsPlan: this.state.requirementData.keywordsPlan
            });
            console.log('[Node 1] ========== NODE 1 EXECUTION COMPLETED ==========');
        } catch (error) {
            console.error('[Node 1] ========== ERROR IN NODE 1 EXECUTION ==========');
            console.error('[Node 1] Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            console.error('[Node 1] State at error:', {
                hasRequirementData: !!this.state.requirementData,
                hasKeywordsPlan: !!this.state.requirementData.keywordsPlan,
                keywordsPlanLength: this.state.requirementData.keywordsPlan ? this.state.requirementData.keywordsPlan.length : 0
            });
            throw error; // 重新抛出错误，让上层处理
        }
    },

    async autoExecuteNode2() {
        this.updateNodeState(2, 'active');
        // 自动执行时实时显示节点内容
        this.showNodeContent(2);

        // 隐藏搜索参数设置部分和按钮（自动执行时只显示文献列表）
        const searchParamsSection = document.getElementById('search-params-section');
        if (searchParamsSection) {
            searchParamsSection.style.display = 'none';
        }
        const searchBtn = document.getElementById('search-literature-btn');
        if (searchBtn) {
            searchBtn.style.display = 'none';
        }

        window.UIUtils.showElement('search-progress');
        window.UIUtils.hideElement('search-results');

        // 初始化进度条
        window.UIUtils.updateProgress(
            'search-progress',
            'search-progress-fill',
            'search-progress-text',
            0,
            '准备开始搜索...'
        );

        // 定义进度回调函数
        const onProgress = (current, total, keyword, status) => {
            const percentage = Math.round((current / total) * 100);
            const progressText = `正在搜索关键词 "${keyword}" (${current}/${total}) - ${status}`;
            window.UIUtils.updateProgress(
                'search-progress',
                'search-progress-fill',
                'search-progress-text',
                percentage,
                progressText
            );
        };

        const result = await window.Node2Search.execute(
            this.state.keywords,
            this.state.requirementData.keywordsPlan,
            this.state.requirementData.targetCount,
            onProgress
        );

        this.state.searchResults = result.searchResults;
        this.state.allLiterature = result.allLiterature;

        // 完成时更新进度条，不显示结果
        window.UIUtils.updateProgress(
            'search-progress',
            'search-progress-fill',
            'search-progress-text',
            100,
            `搜索完成！共找到 ${result.allLiterature.length} 篇文献`
        );

        this.updateNodeState(2, 'completed');
        await this.saveProjectData({
            search: { 
                results: this.state.searchResults 
            },
            finalResults: this.state.allLiterature
        });
    },

    async autoExecuteNode3() {
        this.updateNodeState(3, 'active');
        // 自动执行时实时显示节点内容
        this.showNodeContent(3);

        window.UIUtils.showElement('complete-progress');
        window.UIUtils.hideElement('complete-results');

        // 初始化进度条
        window.UIUtils.updateProgress(
            'complete-progress',
            'complete-progress-fill',
            'complete-progress-text',
            0,
            '准备开始补全文献...'
        );

        // 定义进度回调函数
        const onProgress = (current, total, title, status) => {
            const percentage = Math.round((current / total) * 100);
            const progressText = `正在处理: "${title}" (${current}/${total}) - ${status}`;
            window.UIUtils.updateProgress(
                'complete-progress',
                'complete-progress-fill',
                'complete-progress-text',
                percentage,
                progressText
            );
        };

        const { completed, total, successCount, failCount } = await window.Node3Complete.execute(
            this.state.globalApiKey, 
            this.state.allLiterature,
            onProgress
        );

        // 完成时更新进度条，不显示结果
        window.UIUtils.updateProgress(
            'complete-progress',
            'complete-progress-fill',
            'complete-progress-text',
            100,
            `补全完成！成功: ${successCount}篇, 失败: ${failCount}篇`
        );

        this.updateNodeState(3, 'completed');
        await this.saveProjectData({ 
            finalResults: this.state.allLiterature 
        });
        window.UIUtils.showToast(`文献补全完成，成功: ${successCount}篇, 失败: ${failCount}篇`, 'success');
    },

    async autoExecuteNode4() {
        this.updateNodeState(4, 'active');
        // 自动执行时实时显示节点内容
        this.showNodeContent(4);

        window.UIUtils.showElement('filter-progress');
        window.UIUtils.hideElement('filter-results-list');
        // 隐藏统计卡片和导出按钮
        window.UIUtils.hideElement('filter-statistics-container');
        const exportBtn = document.getElementById('export-excel-btn');
        if (exportBtn) {
            exportBtn.style.display = 'none';
        }

        // 初始化进度条
        window.UIUtils.updateProgress(
            'filter-progress',
            'filter-progress-fill',
            'filter-progress-text',
            0,
            '准备开始AI筛选文献...'
        );

        // 定义进度回调函数
        const onProgress = (current, total, title, status) => {
            const percentage = Math.round((current / total) * 100);
            const progressText = `正在筛选: "${title}" (${current}/${total}) - ${status}`;
            window.UIUtils.updateProgress(
                'filter-progress',
                'filter-progress-fill',
                'filter-progress-text',
                percentage,
                progressText
            );
        };

        try {
            const apiProvider = this.getCurrentApiProvider();
            const result = await window.Node4Filter.execute(
                this.state.globalApiKey,
                this.state.allLiterature,
                this.state.requirementData.requirement,
                this.state.requirementData.targetCount,
                onProgress,
                apiProvider
            );

            // 验证返回结果
            if (!result || typeof result !== 'object') {
                throw new Error('节点4执行返回结果格式错误');
            }

            // 确保selectedLiterature是数组
            if (!Array.isArray(result.selectedLiterature)) {
                console.warn('节点4返回的selectedLiterature不是数组，使用空数组');
                result.selectedLiterature = [];
            }

            this.state.selectedLiterature = result.selectedLiterature || [];

            // 完成时更新进度条，显示筛选结果数量
            const selectedCount = this.state.selectedLiterature.length;
            const totalCount = this.state.allLiterature.length;
            window.UIUtils.updateProgress(
                'filter-progress',
                'filter-progress-fill',
                'filter-progress-text',
                100,
                `筛选完成：已选 ${selectedCount} 篇，共 ${totalCount} 篇`
            );

            this.updateNodeState(4, 'completed');
            await this.saveProjectData({
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature,
                finalResults: this.state.allLiterature  // 同时保存所有文献，确保数据同步
            });
        } catch (error) {
            console.error('节点4执行失败:', error);
            // 更新进度条显示错误
            window.UIUtils.updateProgress(
                'filter-progress',
                'filter-progress-fill',
                'filter-progress-text',
                0,
                `筛选失败: ${error.message || '未知错误'}`
            );
            // 显示错误信息
            window.UIUtils.showToast(`节点4执行失败: ${error.message || '未知错误'}`, 'error');
            // 重新抛出错误，让上层catch处理
            throw error;
        }
    },

    // 保存搜索结果（节点2）
    async saveSearchResults() {
        try {
            // 保存当前的搜索结果
            await this.saveProjectData({
                finalResults: this.state.allLiterature,
                search: {
                    results: this.state.searchResults || {}
                }
            });
            window.UIUtils.showToast('搜索结果已保存', 'success');
        } catch (error) {
            console.error('保存搜索结果失败:', error);
            window.UIUtils.showToast(`保存失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 保存补全结果（节点3）
    async saveCompletionResults() {
        try {
            // 保存当前的补全结果
            await this.saveProjectData({
                finalResults: this.state.allLiterature
            });
            window.UIUtils.showToast('补全结果已保存', 'success');
        } catch (error) {
            console.error('保存补全结果失败:', error);
            window.UIUtils.showToast(`保存失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 保存筛选结果（节点4）
    async saveFilterResults() {
        try {
            // 保存当前的筛选结果
            await this.saveProjectData({
                finalResults: this.state.allLiterature,
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature
            });
            window.UIUtils.showToast('筛选结果已保存', 'success');
        } catch (error) {
            console.error('保存筛选结果失败:', error);
            window.UIUtils.showToast(`保存失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 重新精选文献（节点4）
    async regenerateFilter() {
        // 检查是否有文献
        if (!this.state.allLiterature || this.state.allLiterature.length === 0) {
            window.UIUtils.showToast('请先完成节点3：文献补全', 'error');
            return;
        }

        // 检查是否已有筛选结果
        const hasSelected = this.state.selectedLiterature && this.state.selectedLiterature.length > 0;
        if (hasSelected) {
            const confirmed = confirm('当前已存在筛选结果，重新精选将覆盖现有筛选结果。\n\n是否继续？');
            if (!confirmed) {
                return;
            }
        }

        // 检查API Key
        const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
        if (!apiKey) {
            window.UIUtils.showToast('请先设置API Key', 'error');
            return;
        }

        this.state.globalApiKey = apiKey;

        try {
            // 清空已选文献列表
            this.state.selectedLiterature = [];

            // 清空所有文献的AI判断状态
            for (const lit of this.state.allLiterature) {
                if (lit.aiRecommendReason) {
                    delete lit.aiRecommendReason;
                }
                lit.selected = false;
            }

            // 保存清空后的状态
            await this.saveProjectData({
                finalResults: this.state.allLiterature,
                selectedLiterature: [],
                organizedData: []
            });

            // 隐藏多余的内容，只显示进度条（与一键生成一致）
            window.UIUtils.hideElement('filter-results');
            window.UIUtils.hideElement('filter-statistics-container');
            const exportBtn = document.getElementById('export-excel-btn');
            const saveBtn = document.getElementById('save-filter-btn');
            const regenerateBtn = document.getElementById('regenerate-filter-btn');
            if (exportBtn) {
                exportBtn.style.display = 'none';
            }
            if (saveBtn) {
                saveBtn.style.display = 'none';
            }
            if (regenerateBtn) {
                regenerateBtn.style.display = 'none';
            }

            // 重新执行节点4
            await this.autoExecuteNode4();

            window.UIUtils.showToast('文献精选完成', 'success');
        } catch (error) {
            console.error('重新精选文献失败:', error);
            window.UIUtils.showToast(`重新精选失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 重新补全文献（节点3）
    async regenerateCompletion() {
        // 检查是否有文献
        if (!this.state.allLiterature || this.state.allLiterature.length === 0) {
            window.UIUtils.showToast('请先完成节点2：文献搜索', 'error');
            return;
        }

        // 检查是否已有补全的文献
        const hasCompleted = this.state.allLiterature.some(lit => lit.abstract && lit.abstract.trim());
        if (hasCompleted) {
            const confirmed = confirm('当前已存在补全的文献，重新补全将清空现有补全状态并重新补全。\n\n是否继续？');
            if (!confirmed) {
                return;
            }
        }

        // 检查API Key
        const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
        if (!apiKey) {
            window.UIUtils.showToast('请先设置API Key', 'error');
            return;
        }

        this.state.globalApiKey = apiKey;

        try {
            // 先清空补全状态（不显示确认对话框，因为已经确认过了）
            let clearedCount = 0;
            for (const lit of this.state.allLiterature) {
                if (lit.completionStatus) {
                    delete lit.completionStatus;
                    if (lit.journal) {
                        delete lit.journal;
                    }
                    if (lit.cited !== undefined) {
                        delete lit.cited;
                    }
                    // 清空摘要（如果是从节点3补全的）
                    if (lit.abstract && lit.abstractSource === 'completion') {
                        lit.abstract = '';
                        delete lit.abstractSource;
                    }
                    clearedCount++;
                }
            }

            // 保存清空后的状态
            await this.saveProjectData({
                finalResults: this.state.allLiterature
            });

            // 隐藏多余的内容，只显示进度条（与一键生成一致）
            window.UIUtils.hideElement('complete-results');
            const saveBtn = document.getElementById('save-completion-btn');
            const regenerateBtn = document.getElementById('regenerate-completion-btn');
            if (saveBtn) {
                saveBtn.style.display = 'none';
            }
            if (regenerateBtn) {
                regenerateBtn.style.display = 'none';
            }

            // 重新执行节点3
            await this.autoExecuteNode3();

            window.UIUtils.showToast('文献补全完成', 'success');
        } catch (error) {
            console.error('重新补全文献失败:', error);
            window.UIUtils.showToast(`重新补全失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 重新生成关键词（节点1）
    async regenerateKeywords() {
        // 检查是否有大纲
        if (!this.state.requirementData.outline) {
            window.UIUtils.showToast('请先完成需求分析', 'error');
            return;
        }

        // 检查是否已有关键词
        const hasExistingKeywords = this.state.requirementData.keywordsPlan && 
                                    this.state.requirementData.keywordsPlan.length > 0;
        if (hasExistingKeywords) {
            const confirmed = confirm('当前已存在关键词，重新分析将覆盖现有关键词。\n\n是否继续？');
            if (!confirmed) {
                return;
            }
        }

        // 检查API Key
        const apiKey = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey;
        if (!apiKey) {
            window.UIUtils.showToast('请先设置API Key', 'error');
            return;
        }

        try {
            // 禁用按钮
            const regenerateBtn = document.getElementById('regenerate-keywords-btn');
            if (regenerateBtn) {
                regenerateBtn.disabled = true;
                regenerateBtn.textContent = '正在分析...';
            }

            // 显示进度条，隐藏结果
            window.UIUtils.showElement('keywords-auto-progress');
            window.UIUtils.hideElement('keywords-result');

            // 初始化进度条
            window.UIUtils.updateProgress(
                'keywords-auto-progress',
                'keywords-progress-fill',
                'keywords-progress-text',
                0,
                '正在分析关键词...'
            );

            // 执行关键词分析
            const keywordsPlan = await window.Node1Keywords.execute(apiKey, this.state.requirementData);

            // 验证返回结果
            if (!keywordsPlan || !Array.isArray(keywordsPlan) || keywordsPlan.length === 0) {
                throw new Error('关键词分析返回结果为空或格式错误');
            }

            // 更新状态数据
            this.state.requirementData.keywordsPlan = keywordsPlan;
            this.state.keywords = keywordsPlan.map(item => item.keyword);
            this.state.globalApiKey = apiKey;

            // 更新进度条
            window.UIUtils.updateProgress(
                'keywords-auto-progress',
                'keywords-progress-fill',
                'keywords-progress-text',
                100,
                '关键词分析完成！'
            );

            // 更新节点状态
            this.updateNodeState(1, 'completed');

            // 保存数据
            await this.saveProjectData({
                keywords: this.state.keywords,
                requirementData: this.state.requirementData
            });

            // 显示结果（编辑模式）
            window.Node1Keywords.display(this.state.requirementData.keywordsPlan, true);
            window.UIUtils.showElement('keywords-result');
            window.UIUtils.hideElement('keywords-auto-progress');

            // 显示按钮
            if (regenerateBtn) {
                regenerateBtn.style.display = 'inline-block';
            }

            window.UIUtils.showToast('关键词分析完成', 'success');
        } catch (error) {
            console.error('关键词分析失败:', error);
            window.UIUtils.showToast(`关键词分析失败: ${error.message || '未知错误'}`, 'error');
        } finally {
            // 恢复按钮状态
            const regenerateBtn = document.getElementById('regenerate-keywords-btn');
            if (regenerateBtn) {
                regenerateBtn.disabled = false;
                regenerateBtn.textContent = '关键词分析';
            }
        }
    },

    // 手动生成综述（用户点击按钮）
    async generateReview() {
        // 检查是否有已选文献
        if (!this.state.selectedLiterature || this.state.selectedLiterature.length === 0) {
            window.UIUtils.showToast('请先选择文献', 'error');
            return;
        }

        // 检查是否已有综述内容
        const hasExistingContent = this.state.reviewContent && this.state.reviewContent.trim().length > 0;
        if (hasExistingContent) {
            const confirmed = confirm('当前已存在综述内容，重新生成将覆盖现有内容。\n\n是否继续？');
            if (!confirmed) {
                return;
            }
        }

        // 检查API Key
        if (!this.state.globalApiKey) {
            window.UIUtils.showToast('请先设置API Key', 'error');
            return;
        }

        try {
            // 隐藏生成按钮，显示进度条
            const generateBtn = document.getElementById('generate-review-btn');
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = '正在生成...';
            }

            window.UIUtils.showElement('generate-progress');
            window.UIUtils.hideElement('review-result');

            // 初始化进度条
            window.UIUtils.updateProgress(
                'generate-progress',
                'generate-progress-fill',
                'generate-progress-text',
                0,
                '正在生成综述...'
            );

            // 执行生成
            const apiProvider = this.getCurrentApiProvider();
            this.state.reviewContent = await window.Node5Review.execute(
                this.state.globalApiKey,
                this.state.selectedLiterature,
                this.state.requirementData,
                apiProvider
            );

            // 更新进度条
            window.UIUtils.updateProgress(
                'generate-progress',
                'generate-progress-fill',
                'generate-progress-text',
                100,
                '综述生成完成'
            );

            // 显示结果
            window.Node5Review.display(this.state.reviewContent, this.state.selectedLiterature);
            window.UIUtils.showElement('review-result');

            // 更新节点状态
            this.updateNodeState(5, 'completed');

            // 保存数据
            await this.saveProjectData({
                reviewContent: this.state.reviewContent,
                review: this.state.reviewContent,
                selectedLiterature: this.state.selectedLiterature,
                organizedData: this.state.selectedLiterature,
                finalResults: this.state.allLiterature
            });

            window.UIUtils.showToast('综述生成完成', 'success');
        } catch (error) {
            console.error('生成综述失败:', error);
            window.UIUtils.showToast(`生成综述失败: ${error.message || '未知错误'}`, 'error');
        } finally {
            // 恢复按钮状态
            const generateBtn = document.getElementById('generate-review-btn');
            if (generateBtn) {
                generateBtn.disabled = false;
                generateBtn.textContent = '生成综述';
            }
        }
    },

    // 复制综述内容到剪贴板
    async copyReviewContent() {
        try {
            const reviewContentEl = document.getElementById('review-content');
            if (!reviewContentEl) {
                window.UIUtils.showToast('未找到综述内容', 'error');
                return;
            }

            const content = reviewContentEl.value || this.state.reviewContent || '';
            if (!content || content.trim().length === 0) {
                window.UIUtils.showToast('综述内容为空，无法复制', 'error');
                return;
            }

            // 使用Clipboard API复制
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(content);
                window.UIUtils.showToast('综述内容已复制到剪贴板', 'success');
            } else {
                // 降级方案：使用传统的execCommand方法
                const textArea = document.createElement('textarea');
                textArea.value = content;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    const successful = document.execCommand('copy');
                    if (successful) {
                        window.UIUtils.showToast('综述内容已复制到剪贴板', 'success');
                    } else {
                        throw new Error('复制命令执行失败');
                    }
                } catch (err) {
                    window.UIUtils.showToast('复制失败，请手动复制', 'error');
                } finally {
                    document.body.removeChild(textArea);
                }
            }
        } catch (error) {
            console.error('复制综述内容失败:', error);
            window.UIUtils.showToast(`复制失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // 导出综述为Word文档
    async exportReviewToWord() {
        try {
            const reviewContentEl = document.getElementById('review-content');
            if (!reviewContentEl) {
                window.UIUtils.showToast('未找到综述内容', 'error');
                return;
            }

            const content = reviewContentEl.value || this.state.reviewContent || '';
            if (!content || content.trim().length === 0) {
                window.UIUtils.showToast('综述内容为空，无法导出', 'error');
                return;
            }

            // 获取项目名称作为默认文件名
            const projectName = this.state.currentProject || '文献综述';
            const fileName = `${projectName}_${new Date().toISOString().split('T')[0]}.doc`;

            // 将文本内容转换为HTML格式（保留换行）
            const htmlContent = content
                .split('\n')
                .map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.length === 0) {
                        return '<p class="empty-line"><br></p>';
                    }
                    // 检测标题（以数字开头或包含特定标记）
                    if (/^[一二三四五六七八九十\d]+[、\.]/.test(trimmedLine) || 
                        /^第[一二三四五六七八九十\d]+[章节部分]/.test(trimmedLine) ||
                        trimmedLine.length < 50 && !trimmedLine.includes('。')) {
                        return `<h2>${this.escapeHtml(trimmedLine)}</h2>`;
                    }
                    return `<p class="paragraph">${this.escapeHtml(trimmedLine)}</p>`;
                })
                .join('\n');

            // 创建完整的HTML文档
            const fullHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
    <meta charset="UTF-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word">
    <meta name="Originator" content="Microsoft Word">
    <title>${this.escapeHtml(projectName)}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        @page {
            size: A4;
            margin: 2.54cm 3.17cm 2.54cm 3.17cm;
            mso-header-margin: 1.27cm;
            mso-footer-margin: 1.27cm;
        }
        body {
            font-family: "Dengxian", "等线", "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", Arial, sans-serif;
            font-size: 10.5pt;
            line-height: 1.5;
            margin: 0;
            padding: 0;
            color: #000000;
            text-align: justify;
        }
        h1 {
            font-family: "Dengxian", "等线", "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", Arial, sans-serif;
            font-size: 16pt;
            font-weight: bold;
            text-align: center;
            margin-top: 0;
            margin-bottom: 20pt;
            line-height: 1.5;
            page-break-after: avoid;
        }
        h2 {
            font-family: "Dengxian", "等线", "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", Arial, sans-serif;
            font-size: 12pt;
            font-weight: bold;
            margin-top: 12pt;
            margin-bottom: 6pt;
            margin-left: 0;
            margin-right: 0;
            line-height: 1.5;
            text-align: left;
            page-break-after: avoid;
        }
        p.paragraph {
            font-family: "Dengxian", "等线", "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", Arial, sans-serif;
            font-size: 10.5pt;
            text-indent: 21pt;
            line-height: 1.5;
            margin-top: 0;
            margin-bottom: 0;
            margin-left: 0;
            margin-right: 0;
            text-align: justify;
            orphans: 2;
            widows: 2;
        }
        p.empty-line {
            font-family: "Dengxian", "等线", "Microsoft YaHei UI", "Microsoft YaHei", "SimSun", Arial, sans-serif;
            font-size: 10.5pt;
            margin-top: 0;
            margin-bottom: 0;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(projectName)}</h1>
    ${htmlContent}
</body>
</html>`;

            // 通过Electron API保存文件
            if (window.electronAPI && window.electronAPI.saveWordFile) {
                const result = await window.electronAPI.saveWordFile(fileName, fullHtml);
                if (result && result.success) {
                    window.UIUtils.showToast(`Word文档已保存: ${result.filePath || fileName}`, 'success');
                } else {
                    window.UIUtils.showToast(`保存失败: ${result?.error || '未知错误'}`, 'error');
                }
            } else {
                // 降级方案：使用Blob和下载链接
                const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                window.UIUtils.showToast(`Word文档已下载: ${fileName}`, 'success');
            }
        } catch (error) {
            console.error('导出Word文档失败:', error);
            window.UIUtils.showToast(`导出失败: ${error.message || '未知错误'}`, 'error');
        }
    },

    // HTML转义辅助函数
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    async autoExecuteNode5() {
        this.updateNodeState(5, 'active');
        
        // 先隐藏不需要的元素
        window.UIUtils.hideElement('selected-literature-summary');
        const generateBtn = document.getElementById('generate-review-btn');
        if (generateBtn) {
            generateBtn.style.display = 'none';
        }
        
        // 自动执行时实时显示节点内容
        this.showNodeContent(5);

        window.UIUtils.showElement('generate-progress');
        window.UIUtils.hideElement('review-result');
        
        // 再次确保隐藏（防止showNodeContent重新显示）
        window.UIUtils.hideElement('selected-literature-summary');
        if (generateBtn) {
            generateBtn.style.display = 'none';
        }

        // 初始化进度条，显示"正在生成"
        window.UIUtils.updateProgress(
            'generate-progress',
            'generate-progress-fill',
            'generate-progress-text',
            0,
            '正在生成综述...'
        );

        const apiProvider = this.getCurrentApiProvider();
        this.state.reviewContent = await window.Node5Review.execute(
            this.state.globalApiKey,
            this.state.selectedLiterature,
            this.state.requirementData,
            apiProvider
        );

        // 完成时更新进度条，不显示结果
        window.UIUtils.updateProgress(
            'generate-progress',
            'generate-progress-fill',
            'generate-progress-text',
            100,
            '综述生成完成'
        );

        this.updateNodeState(5, 'completed');
        await this.saveProjectData({
            reviewContent: this.state.reviewContent,
            review: this.state.reviewContent,
            selectedLiterature: this.state.selectedLiterature,  // 确保保存筛选结果
            organizedData: this.state.selectedLiterature,
            finalResults: this.state.allLiterature  // 确保保存所有文献
        });
        
        // 完成后显示已选文献列表（即使是在自动执行模式下）
        if (this.state.selectedLiterature && this.state.selectedLiterature.length > 0) {
            window.Node5Review.displaySelectedLiterature(this.state.selectedLiterature);
        }
    }
};

// 导出closeNodeContent供HTML调用
window.closeNodeContent = () => window.WorkflowManager.closeNodeContent();

