// 工作流管理器：协调各个节点和主页面功能
// 注意：状态管理已移至 WorkflowStateManager，数据加载已移至 WorkflowDataLoader
window.WorkflowManager = {
    // 获取状态管理器引用（向后兼容）
    get state() {
        return window.WorkflowStateManager.state;
    },

    // 状态辅助方法（委托给状态管理器）
    isAutoGenerating() {
        return window.WorkflowStateManager.isAutoGenerating();
    },
    
    isManualRunning() {
        return window.WorkflowStateManager.isManualRunning();
    },
    
    isRunning() {
        return window.WorkflowStateManager.isRunning();
    },
    
    getCurrentAutoNode() {
        return window.WorkflowStateManager.getCurrentAutoNode();
    },

    // 统一错误处理：安全执行异步操作
    async safeExecute(operation, errorMessage, showToast = true) {
        try {
            return await operation();
        } catch (error) {
            console.error(`[${operation.name || 'Operation'}] ${errorMessage}:`, error);
            if (showToast) {
                window.UIUtils.showToast(`${errorMessage}: ${error.message || '未知错误'}`, 'error');
            }
            throw error;
        }
    },

    // 初始化
    async init() {
        try {
            // 检查依赖模块
            if (!window.DataManager) {
                console.error('DataManager模块未加载');
                return;
            }
            if (!window.UIUtils) {
                console.error('UIUtils模块未加载');
                return;
            }
            
            // RequirementManager 是可选的（文献查找子项目不需要）
            if (window.RequirementManager) {
                // 初始化目标数量提示
                if (window.RequirementManager) {
                window.RequirementManager.updateTargetHint();
            }
            }

            // 先绑定事件，确保按钮能正常工作
            this.bindEvents();
            
            // 然后加载项目数据
            try {
                await this.loadCurrentProject();
            } catch (error) {
                console.error('加载项目失败，但继续初始化:', error);
            }
            
            // 根据子项目类型初始化UI
            this.initSubprojectUI();
            
            // 检查需求状态
            this.checkRequirementStatus();
            
            // 初始化API供应商UI
            this.updateApiProviderUI();
            
            // 初始化按钮显示状态
            this.updateGenerateButtonState();
            
            // 如果有项目，根据子项目类型显示总览或文献列表
            if (this.state.currentProject) {
                if (this.state.currentSubprojectType === 'reviewWriting') {
                    // 撰写子项目：显示文献列表
                    const emptyPanel = document.getElementById('node-content-empty');
                    const nodeContentContainer = document.getElementById('node-content-container');
                    const overviewContainer = document.getElementById('overview-container');
                    const literatureListContainer = document.getElementById('literature-list-container');
                    
                    // 隐藏空面板和节点内容容器
                    if (emptyPanel) {
                        emptyPanel.style.display = 'none';
                    }
                    if (nodeContentContainer) {
                        nodeContentContainer.style.display = 'none';
                    }
                    
                    // 隐藏总览容器，显示文献列表容器
                    if (overviewContainer) {
                        overviewContainer.style.display = 'none';
                    }
                    if (literatureListContainer) {
                        literatureListContainer.style.display = 'block';
                    }
                    
                    // 加载文献列表
                    this.loadReviewLiteratureList();
                } else {
                    // 其他情况：显示总览
                    this.updateOverview();
                    this.showOverview();
                }
            }
        } catch (error) {
            console.error('初始化失败:', error);
            // 即使出错，也尝试绑定事件
            try {
                this.bindEvents();
            } catch (bindError) {
                console.error('绑定事件失败:', bindError);
            }
        }
    },

    // 根据子项目类型初始化UI
    async initSubprojectUI() {
        const state = this.state;
        const subprojectType = state.currentSubprojectType;
        
        if (!subprojectType) {
            // 如果没有子项目类型，尝试从sessionStorage读取
            const subprojectId = sessionStorage.getItem('currentSubprojectId');
            if (subprojectId && state.currentProject && window.SubprojectManager) {
                // 异步加载子项目信息
                try {
                    const subproject = await window.SubprojectManager.getSubprojectData(state.currentProject, subprojectId);
                    if (subproject) {
                        state.currentSubprojectId = subprojectId;
                        state.currentSubproject = subproject;
                        state.currentSubprojectType = subproject.type;
                        // 加载节点数据
                        if (subproject.type === 'reviewWriting') {
                            // 从子项目的 node5 中加载数据
                            const node5Data = subproject.node5 || {};
                            window.WorkflowDataLoader.loadNodeData(5, { node5: node5Data });
                            // 加载综述内容后，会在 updateUIForSubprojectType 之后通过 loadNodeData(5) 显示
                        }
                        this.updateUIForSubprojectType(subproject.type);
                    }
                } catch (err) {
                    console.error('加载子项目信息失败:', err);
                }
            }
            return;
        }
        
        // 确保子项目数据是最新的（重新从文件加载）
        if (state.currentSubprojectId && state.currentProject && window.SubprojectManager) {
            try {
                const latestSubproject = await window.SubprojectManager.getSubprojectData(state.currentProject, state.currentSubprojectId);
                if (latestSubproject) {
                    state.currentSubproject = latestSubproject;
                    // 重新加载节点数据，确保数据是最新的
                    if (latestSubproject.type === 'reviewWriting') {
                        // 从子项目的 node5 中加载数据
                        const node5Data = latestSubproject.node5 || {};
                        window.WorkflowDataLoader.loadNodeData(5, { node5: node5Data });
                        // 加载综述内容后，需要显示综述
                        if (this.state.reviewContent && this.state.reviewContent.trim()) {
                            // 使用子项目的文献列表来显示综述
                            const literatureToUse = latestSubproject.literature || state.selectedLiterature || [];
                            this.loadNodeData(5); // 这会显示综述内容
                        }
                    }
                }
            } catch (err) {
                console.error('重新加载子项目数据失败:', err);
            }
        }
        
        this.updateUIForSubprojectType(subprojectType);
    },
    
    // 根据子项目类型更新UI显示
    updateUIForSubprojectType(subprojectType) {
        if (subprojectType === 'literatureSearch') {
            // 文献查找子项目：显示节点1-4，隐藏节点5
            for (let i = 1; i <= 4; i++) {
                const node = document.getElementById(`node-${i}`);
                if (node) {
                    node.style.display = 'block';
                }
                // 隐藏节点内容区域
                const nodeContent = document.getElementById(`content-node-${i}`);
                if (nodeContent) {
                    nodeContent.style.display = 'none';
                }
                // 隐藏总览中的节点卡片
                const overviewCard = document.querySelector(`.overview-node-card[data-node="${i}"]`);
                if (overviewCard) {
                    overviewCard.style.display = 'block';
                }
            }
            const node5 = document.getElementById('node-5');
            if (node5) {
                node5.style.display = 'none';
            }
            const node5Content = document.getElementById('content-node-5');
            if (node5Content) {
                node5Content.style.display = 'none';
            }
            const overviewCard5 = document.querySelector('.overview-node-card[data-node="5"]');
            if (overviewCard5) {
                overviewCard5.style.display = 'none';
            }
            
            // 更新子项目名称显示
            const subprojectNameEl = document.getElementById('current-subproject-name');
            if (subprojectNameEl && this.state.currentSubproject) {
                subprojectNameEl.textContent = this.state.currentSubproject.name || '文献查找子项目';
                subprojectNameEl.style.display = 'block';
            }
            
            // 文献查找子项目的配置项已经在HTML中正确显示，不需要移除
            // 加载子项目的配置数据
            this.loadLiteratureSearchConfig();
        } else if (subprojectType === 'reviewWriting') {
            // 综述撰写子项目：显示节点5，隐藏节点1-4
            for (let i = 1; i <= 4; i++) {
                const node = document.getElementById(`node-${i}`);
                if (node) {
                    node.style.display = 'none';
                }
                // 隐藏节点内容区域
                const nodeContent = document.getElementById(`content-node-${i}`);
                if (nodeContent) {
                    nodeContent.style.display = 'none';
                }
                // 隐藏总览中的节点卡片
                const overviewCard = document.querySelector(`.overview-node-card[data-node="${i}"]`);
                if (overviewCard) {
                    overviewCard.style.display = 'none';
                }
            }
            const node5 = document.getElementById('node-5');
            if (node5) {
                node5.style.display = 'block';
            }
            let node5Content = document.getElementById('content-node-5');
            if (node5Content) {
                node5Content.style.display = 'block'; // 撰写子项目中始终显示节点5内容
            }
            let nodeBody5 = document.getElementById('node-body-5');
            if (nodeBody5) {
                nodeBody5.style.display = 'block'; // 确保节点5内容体显示
            }
            const overviewCard5 = document.querySelector('.overview-node-card[data-node="5"]');
            if (overviewCard5) {
                overviewCard5.style.display = 'block';
            }
            
            // 更新子项目名称显示
            const subprojectNameEl = document.getElementById('current-subproject-name');
            if (subprojectNameEl && this.state.currentSubproject) {
                subprojectNameEl.textContent = this.state.currentSubproject.name || '综述撰写子项目';
                subprojectNameEl.style.display = 'block';
            }
            
            // 综述撰写子项目：隐藏总览按钮，显示文献列表
            const overviewBtn = document.getElementById('overview-btn');
            if (overviewBtn) {
                overviewBtn.style.display = 'none';
            }
            
            // 隐藏空面板和节点内容容器
            const emptyPanel = document.getElementById('node-content-empty');
            const nodeContentContainer = document.getElementById('node-content-container');
            if (emptyPanel) {
                emptyPanel.style.display = 'none';
            }
            if (nodeContentContainer) {
                nodeContentContainer.style.display = 'none';
            }
            
            // 隐藏总览容器，显示文献列表容器（在总览位置）
            const overviewContainer = document.getElementById('overview-container');
            const literatureListContainer = document.getElementById('literature-list-container');
            if (overviewContainer) {
                overviewContainer.style.display = 'none';
            }
            if (literatureListContainer) {
                literatureListContainer.style.display = 'block';
            }
            
            // 加载并显示关联的文献查找子项目的文献列表
            this.loadReviewLiteratureList();
            
            // 综述撰写子项目：隐藏API Key、Google验证和目标文献数量
            const apiKeyGroup = document.getElementById('api-key-group');
            if (apiKeyGroup) {
                apiKeyGroup.style.display = 'none';
            }
            const googleScholarGroup = document.getElementById('google-scholar-verify-group');
            if (googleScholarGroup) {
                googleScholarGroup.style.display = 'none';
            }
            const targetCountGroup = document.getElementById('target-count-group');
            if (targetCountGroup) {
                targetCountGroup.style.display = 'none';
            }
            
            // 隐藏API申请地址链接
            const apiDocsContainer = document.getElementById('main-api-docs-container');
            if (apiDocsContainer) {
                apiDocsContainer.style.display = 'none';
            }
            
            // 显示章节数输入框（仅撰写子项目）
            const chapterCountGroup = document.getElementById('chapter-count-group');
            if (chapterCountGroup) {
                chapterCountGroup.style.display = 'block';
            }
            
            // 综述撰写子项目显示这些功能
            const analyzeBtn = document.getElementById('analyze-main-requirement-btn');
            if (analyzeBtn) {
                analyzeBtn.style.display = 'block';
            }
            
            // 显示生成综述按钮
            const generateBtn = document.getElementById('generate-review-btn');
            if (generateBtn) {
                generateBtn.style.display = 'block';
            }
            
            // 如果有综述内容，加载并显示
            if (this.state.reviewContent && this.state.reviewContent.trim()) {
                // 延迟一下，确保UI已经更新完成
                setTimeout(() => {
                    this.loadNodeData(5);
                }, 100);
            }
            
            // 隐藏已选文献区域（撰写子项目中所有文献都会自动使用）
            const selectedLiteratureSummary = document.getElementById('selected-literature-summary');
            if (selectedLiteratureSummary) {
                selectedLiteratureSummary.style.display = 'none';
            }
        }
    },

    // 加载并显示关联的文献查找子项目的文献列表（用于撰写子项目）
    async loadReviewLiteratureList() {
        console.log('[loadReviewLiteratureList] 开始加载文献列表');
        const state = this.state;
        const container = document.getElementById('review-literature-list');
        const literatureListContainer = document.getElementById('literature-list-container');
        
        if (!container) {
            console.warn('[loadReviewLiteratureList] 文献列表容器未找到');
            return;
        }
        
        // 确保文献列表容器是可见的
        if (literatureListContainer) {
            literatureListContainer.style.display = 'block';
            console.log('[loadReviewLiteratureList] 文献列表容器已显示');
        }
        
        // 检查是否为撰写子项目
        if (state.currentSubprojectType !== 'reviewWriting' || !state.currentSubproject) {
            console.warn('[loadReviewLiteratureList] 当前不是撰写子项目', {
                subprojectType: state.currentSubprojectType,
                hasSubproject: !!state.currentSubproject
            });
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">当前不是撰写子项目</p>';
            return;
        }
        
        console.log('[loadReviewLiteratureList] 当前子项目:', {
            id: state.currentSubprojectId,
            name: state.currentSubproject.name,
            sourceSubprojectIds: state.currentSubproject.sourceSubprojectIds,
            hasLiterature: !!(state.currentSubproject.literature && state.currentSubproject.literature.length > 0)
        });
        
        try {
            let literatureList = [];
            
            // 优先使用已保存的文献列表（在创建子项目时已整理）
            if (state.currentSubproject.literature && Array.isArray(state.currentSubproject.literature) && state.currentSubproject.literature.length > 0) {
                literatureList = state.currentSubproject.literature;
                console.log('[loadReviewLiteratureList] 使用已保存的文献列表，共', literatureList.length, '篇');
            } else {
                // 如果没有保存的文献，从关联的文献查找子项目中动态加载
                const sourceSubprojectIds = state.currentSubproject.sourceSubprojectIds || [];
                
                if (sourceSubprojectIds.length === 0) {
                    container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">未关联任何文献查找子项目</p>';
                    return;
                }
                
                // 从每个源子项目中导入文献
                const allSelectedLiterature = [];
                
                for (const sourceSubprojectId of sourceSubprojectIds) {
                    const sourceSubproject = await window.SubprojectManager.getSubprojectData(
                        state.currentProject,
                        sourceSubprojectId
                    );
                    
                    if (sourceSubproject && sourceSubproject.type === 'literatureSearch') {
                        const selectedLit = sourceSubproject.node4?.selectedLiterature || [];
                        if (selectedLit.length > 0) {
                            allSelectedLiterature.push(...selectedLit);
                        }
                    }
                }
                
                // 去重（基于文献ID或标题+URL）
                const seen = new Set();
                for (const lit of allSelectedLiterature) {
                    const key = lit.id || `${lit.title}_${lit.url || ''}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        literatureList.push(lit);
                    }
                }
                
                // 如果动态加载到了文献，更新保存到子项目中
                if (literatureList.length > 0) {
                    await window.SubprojectManager.updateSubproject(
                        state.currentProject,
                        state.currentSubprojectId,
                        { literature: literatureList }
                    );
                    // 更新state中的子项目对象
                    state.currentSubproject.literature = literatureList;
                }
            }
            
            // 显示文献列表
            this.displayReviewLiteratureList(literatureList);
            
        } catch (error) {
            console.error('[loadReviewLiteratureList] 加载文献列表失败:', error);
            container.innerHTML = `<p style="color: #ef4444; text-align: center; padding: 20px;">加载文献列表失败: ${error.message}</p>`;
        }
    },

    // 根据大纲的文献映射重新排序文献（按章节、段落、年份）
    reorderLiteratureByOutline(literatureList, literatureMapping) {
        if (!literatureMapping || literatureMapping.length === 0) {
            // 如果没有映射，保持原顺序
            return literatureList.map((lit, index) => ({
                ...lit,
                chapter: null,
                paragraph: null,
                sortKey: index
            }));
        }

        // 创建映射：文献初始索引 -> 章节和段落信息
        const mappingMap = new Map();
        literatureMapping.forEach(mapping => {
            mappingMap.set(mapping.literatureIndex, {
                chapter: mapping.chapter || 999,
                paragraph: mapping.paragraph || 999
            });
        });

        // 为每篇文献添加章节、段落信息和排序键
        // 使用 initialIndex 来查找映射（如果没有 initialIndex，使用数组索引+1）
        const literatureWithMapping = literatureList.map((lit) => {
            const litIndex = lit.initialIndex !== null && lit.initialIndex !== undefined 
                ? lit.initialIndex 
                : (lit.actualIndex || 0);
            const mapping = mappingMap.get(litIndex);
            const chapter = mapping ? mapping.chapter : 999;
            const paragraph = mapping ? mapping.paragraph : 999;
            const year = parseInt(lit.year) || 0;
            
            return {
                ...lit,
                chapter: mapping ? mapping.chapter : null,
                paragraph: mapping ? mapping.paragraph : null,
                // 排序键：章节 * 10000 + 段落 * 1000 - 年份（年份越大越靠前）
                sortKey: chapter * 10000 + paragraph * 1000 - year
            };
        });

        // 按排序键排序
        literatureWithMapping.sort((a, b) => a.sortKey - b.sortKey);

        // 重新分配 actualIndex（基于新顺序），并确保 chapter 和 paragraph 字段正确
        return literatureWithMapping.map((lit, index) => {
            const newLit = { ...lit };
            newLit.actualIndex = index + 1;
            // 确保 chapter 和 paragraph 字段与 literatureMapping 一致
            const litIndex = lit.initialIndex !== null && lit.initialIndex !== undefined 
                ? lit.initialIndex 
                : (lit.actualIndex || 0);
            const mapping = mappingMap.get(litIndex);
            if (mapping) {
                newLit.chapter = mapping.chapter;
                newLit.paragraph = mapping.paragraph;
            }
            delete newLit.sortKey; // 删除临时排序键
            return newLit;
        });
    },

    // 显示文献列表
    displayReviewLiteratureList(literatureList) {
        const container = document.getElementById('review-literature-list');
        
        if (!container) {
            return;
        }
        
        container.innerHTML = '';
        
        if (!literatureList || literatureList.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无文献</p>';
            return;
        }
        
        // 按照编号排序：
        // - 如果 actualIndex 不为 null，按 actualIndex 排序
        // - 如果 actualIndex 为 null，按 initialIndex 排序
        const sortedList = [...literatureList].sort((a, b) => {
            // 获取 a 的排序索引
            const aIndex = a.actualIndex !== null && a.actualIndex !== undefined 
                ? a.actualIndex 
                : (a.initialIndex || 0);
            
            // 获取 b 的排序索引
            const bIndex = b.actualIndex !== null && b.actualIndex !== undefined 
                ? b.actualIndex 
                : (b.initialIndex || 0);
            
            return aIndex - bIndex;
        });
        
        sortedList.forEach((lit, index) => {
            const item = document.createElement('div');
            item.className = 'literature-item';
            item.style.cssText = `
                margin-bottom: 20px; 
                padding: 15px; 
                background: white; 
                border-radius: 12px; 
                border: 1px solid #e5e7eb;
                box-shadow: 0 2px 8px rgba(0,0,0,0.08); 
                transition: all 0.3s ease;
            `;
            
            // 鼠标悬停效果
            item.addEventListener('mouseenter', function() {
                this.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                this.style.transform = 'translateY(-2px)';
            });
            item.addEventListener('mouseleave', function() {
                this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                this.style.transform = 'translateY(0)';
            });
            
            const authorsText = lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知作者';
            const yearText = lit.year ? ` (${lit.year})` : '';
            const journalText = lit.journal || lit.source || '';
            const abstractText = lit.abstract || '';
            
            // 显示编号：优先显示真正编号，如果没有则显示初始编号
            const displayIndex = lit.actualIndex !== null && lit.actualIndex !== undefined ? lit.actualIndex : (lit.initialIndex || (index + 1));
            // 如果有真正编号，只显示真正编号；如果没有，显示初始编号并标注
            const indexLabel = lit.actualIndex !== null && lit.actualIndex !== undefined ? 
                `[${displayIndex}]` : 
                `[${lit.initialIndex || displayIndex}]`;
            
            item.innerHTML = `
                <div style="margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1e293b; line-height: 1.4;">
                        <strong>${indexLabel}</strong> ${lit.title || '无标题'}
                    </p>
                </div>
                <div style="margin-bottom: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #64748b;">
                        ${authorsText}${yearText}${journalText ? ` - ${journalText}` : ''}
                    </p>
                </div>
                ${abstractText ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
                    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                        ${abstractText.length > 200 ? abstractText.substring(0, 200) + '...' : abstractText}
                    </p>
                </div>
                ` : ''}
                ${lit.url ? `
                <div style="margin-top: 8px;">
                    <a href="${lit.url}" target="_blank" style="color: #3b82f6; text-decoration: none; font-size: 13px;">
                        查看原文 →
                    </a>
                </div>
                ` : ''}
            `;
            
            container.appendChild(item);
        });
    },

    // 更新生成按钮的显示状态
    updateGenerateButtonState() {
        const startBtn = document.getElementById('start-auto-generate-btn');
        const startLiteratureSearchBtn = document.getElementById('start-literature-search-btn');
        const stopBtn = document.getElementById('stop-auto-generate-btn');
        
        const subprojectType = this.state.currentSubprojectType;
        
        if (subprojectType === 'literatureSearch') {
            // 文献查找子项目：显示"生成关键词"和"一键查找"按钮
            const generateKeywordsBtn = document.getElementById('generate-keywords-btn');
            
            if (this.state.runningState !== null) {
                // 正在运行
                if (startLiteratureSearchBtn) startLiteratureSearchBtn.style.display = 'none';
                if (generateKeywordsBtn) generateKeywordsBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'block';
            } else {
                // 未运行
                const hasRequirement = this.state.requirementData.requirement && 
                                     this.state.requirementData.requirement.trim().length > 0;
                const node1Completed = this.state.nodeStates[1] === 'completed' || 
                                      (this.state.keywords && this.state.keywords.length > 0);
                
                // 生成关键词按钮：有需求描述时显示
                if (generateKeywordsBtn) {
                    generateKeywordsBtn.style.display = hasRequirement ? 'block' : 'none';
                }
                
                // 一键查找按钮：节点1完成后才显示
                if (startLiteratureSearchBtn) {
                    startLiteratureSearchBtn.style.display = (hasRequirement && node1Completed) ? 'block' : 'none';
                }
                
                if (stopBtn) stopBtn.style.display = 'none';
            }
            if (startBtn) startBtn.style.display = 'none';
        } else if (subprojectType === 'reviewWriting') {
            // 综述撰写子项目：显示"一键生成"按钮
            if (this.state.requirementData.outline) {
                // 有大纲时，根据运行状态显示对应按钮
                if (this.state.runningState !== null) {
                    // 正在运行（一键生成或手动运行节点）
                    if (startBtn) startBtn.style.display = 'none';
                    if (stopBtn) stopBtn.style.display = 'block';
                } else {
                    // 未运行
                    if (startBtn) startBtn.style.display = 'block';
                    if (stopBtn) stopBtn.style.display = 'none';
                }
            } else {
                // 没有大纲时，隐藏两个按钮
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'none';
            }
            if (startLiteratureSearchBtn) startLiteratureSearchBtn.style.display = 'none';
        } else {
            // 兼容旧格式：显示"一键生成"按钮
            if (this.state.requirementData.outline) {
                if (this.state.runningState !== null) {
                    if (startBtn) startBtn.style.display = 'none';
                    if (stopBtn) stopBtn.style.display = 'block';
                } else {
                    if (startBtn) startBtn.style.display = 'block';
                    if (stopBtn) stopBtn.style.display = 'none';
                }
            } else {
                if (startBtn) startBtn.style.display = 'none';
                if (stopBtn) stopBtn.style.display = 'none';
            }
            if (startLiteratureSearchBtn) startLiteratureSearchBtn.style.display = 'none';
        }
    },

    // 重新打开项目（重置state并重新加载数据）
    async reloadProject() {
        return await this.safeExecute(async () => {
            const currentProjectName = this.state.currentProject;
            if (!currentProjectName) {
                console.warn('[reloadProject] 没有当前项目，跳过重新加载');
                return;
            }
            
            console.log('[reloadProject] 开始重新打开项目:', currentProjectName);
            
            // 保存当前项目名和配置信息（重置后需要恢复）
            const savedProjectName = currentProjectName;
            const savedApiKeys = { ...this.state.apiKeys };
            const savedApiProvider = this.state.apiProvider;
            const savedGeminiModel = this.state.geminiModel;
            const savedSiliconflowModel = this.state.siliconflowModel;
            const savedPoeModel = this.state.poeModel;
            
            // 重置state中的关键数据字段（但保留currentProject和配置）
            window.WorkflowStateManager.resetState();
            
            // 恢复项目名和配置信息（在加载数据前恢复，确保 loadCurrentProject 能正常工作）
            this.state.currentProject = savedProjectName;
            this.state.apiKeys = savedApiKeys;
            this.state.apiProvider = savedApiProvider;
            this.state.geminiModel = savedGeminiModel;
            this.state.siliconflowModel = savedSiliconflowModel;
            this.state.poeModel = savedPoeModel;
            
            // 重新加载项目数据
            // 注意：loadCurrentProject 会调用 electronAPI.getCurrentProject()，但我们已经有了项目名
            // 如果 getCurrentProject() 返回失败，loadCurrentProject 会抛出错误，我们需要捕获并处理
            await window.WorkflowDataLoader.loadCurrentProject();
            
            // 更新UI显示
            this.updateOverview();
            this.showOverview();
            this.updateNodeStates();
            
            console.log('[reloadProject] 项目重新打开完成');
        }, '重新打开项目失败', true);
    },

    // 加载当前项目（委托给数据加载器）
    async loadCurrentProject() {
        return await window.WorkflowDataLoader.loadCurrentProject();
    },

    // 刷新项目数据（轻量级：只重新加载数据并更新UI，不重置state，不改变视图）
    async refreshProjectData() {
        try {
            const currentProjectName = this.state.currentProject;
            if (!currentProjectName) {
                console.warn('[refreshProjectData] 没有当前项目，跳过刷新');
                return;
            }
            
            console.log('[refreshProjectData] 开始刷新项目数据:', currentProjectName);
            
            // 直接从文件加载最新数据（不重置state）
            const data = await window.DataManager.loadProjectData(currentProjectName);
            console.log('[refreshProjectData] 加载的项目数据:', data);
            
            // 更新 projectData
            this.state.projectData = data;
            
            // 加载配置数据
            if (data.config) {
                if (data.config.googleScholarVerified) {
                    this.state.googleScholarVerified = data.config.googleScholarVerified;
                }
                if (!this.state.projectData.config) {
                    this.state.projectData.config = {};
                }
                this.state.projectData.config = { ...this.state.projectData.config, ...data.config };
                
                // 更新API Keys（合并，不覆盖）
                if (data.config.apiKeys && typeof data.config.apiKeys === 'object') {
                    this.state.apiKeys = { ...this.state.apiKeys, ...data.config.apiKeys };
                }
                if (data.config.apiProvider) {
                    this.state.apiProvider = data.config.apiProvider;
                }
                if (data.config.geminiModel) {
                    this.state.geminiModel = data.config.geminiModel;
                }
                if (data.config.siliconflowModel) {
                    this.state.siliconflowModel = data.config.siliconflowModel;
                }
                if (data.config.poeModel) {
                    this.state.poeModel = data.config.poeModel;
                }
            }
            
            // 加载需求数据（合并，不重置）
            if (data.requirementData) {
                const { keywordsPlan, ...requirementDataWithoutKeywordsPlan } = data.requirementData;
                this.state.requirementData = { ...this.state.requirementData, ...requirementDataWithoutKeywordsPlan };
            }
            
            // 加载节点数据（使用数据加载器的方法）
            window.WorkflowDataLoader.loadNodeData(1, data);
            window.WorkflowDataLoader.loadNodeData(2, data);
            window.WorkflowDataLoader.loadNodeData(3, data);
            window.WorkflowDataLoader.loadNodeData(4, data);
            window.WorkflowDataLoader.loadNodeData(5, data);
            
            // 如果节点2有 searchResults 但没有 allLiterature，从 searchResults 重新生成
            if (this.state.searchResults && Object.keys(this.state.searchResults).length > 0 && 
                (!this.state.allLiterature || this.state.allLiterature.length === 0)) {
                const allLit = [];
                for (const keyword in this.state.searchResults) {
                    const results = this.state.searchResults[keyword];
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
                this.state.allLiterature = allLit;
            }
            
            // 检查并更新节点状态
            window.WorkflowDataLoader.checkNodeStatesFromData(data);
            
            // 更新UI显示（不改变当前视图）
            this.updateOverview();
            this.updateNodeStates();
            
            // 如果当前正在查看某个节点，刷新该节点的显示
            // 检查是否在查看节点详情（不在总览页面）
            const overviewContainer = document.getElementById('overview-container');
            const isViewingOverview = overviewContainer && overviewContainer.style.display !== 'none';
            
            if (!isViewingOverview) {
                // 如果不在总览页面，尝试刷新当前显示的节点
                // 通过检查哪个节点内容容器可见来判断
                for (let i = 1; i <= 5; i++) {
                    const nodeContent = document.getElementById(`content-node-${i}`);
                    if (nodeContent && nodeContent.style.display !== 'none') {
                        // 使用 requestAnimationFrame 确保DOM更新完成
                        requestAnimationFrame(() => {
                            this.loadNodeData(i);
                        });
                        break;
                    }
                }
            }
            
            console.log('[refreshProjectData] 项目数据刷新完成');
        } catch (error) {
            console.error('[refreshProjectData] 刷新项目数据失败:', error);
            // 不显示错误提示，避免干扰用户
        }
    },

    // 根据JSON数据检查节点状态（委托给数据加载器）
    checkNodeStatesFromData(data) {
        return window.WorkflowDataLoader.checkNodeStatesFromData(data);
    },

    // 根据JSON数据获取节点状态信息（用于关闭项目时的提示）
    getNodeStatusInfoFromData(data) {
        const activeNodes = [];
        const incompleteNodes = [];
        const completedNodes = [];
        
        // 检查每个节点的状态
        for (let i = 1; i <= 5; i++) {
            const nodeData = data[`node${i}`];
            let status = 'pending';
            
            if (nodeData && nodeData.status) {
                status = nodeData.status;
            } else {
                // 根据数据推断状态
                switch(i) {
                    case 1:
                        const hasKeywordsPlan = nodeData?.keywordsPlan && Array.isArray(nodeData.keywordsPlan) && nodeData.keywordsPlan.length > 0;
                        const hasKeywords = nodeData?.keywords && Array.isArray(nodeData.keywords) && nodeData.keywords.length > 0;
                        status = (hasKeywordsPlan || hasKeywords) ? 'completed' : 'pending';
                        break;
                    case 2:
                        const hasSearchResults = nodeData?.searchResults && typeof nodeData.searchResults === 'object' && Object.keys(nodeData.searchResults).length > 0;
                        status = hasSearchResults ? 'completed' : 'pending';
                        break;
                    case 3:
                        const hasLiterature = nodeData?.allLiterature && Array.isArray(nodeData.allLiterature) && nodeData.allLiterature.length > 0;
                        const hasAbstracts = hasLiterature && nodeData.allLiterature.some(lit => lit.abstract && lit.abstract.trim());
                        status = hasAbstracts ? 'completed' : (hasLiterature ? 'active' : 'pending');
                        break;
                    case 4:
                        const hasSelected = nodeData?.selectedLiterature && Array.isArray(nodeData.selectedLiterature) && nodeData.selectedLiterature.length > 0;
                        status = hasSelected ? 'completed' : 'pending';
                        break;
                    case 5:
                        const hasReview = nodeData?.reviewContent && typeof nodeData.reviewContent === 'string' && nodeData.reviewContent.trim().length > 0;
                        status = hasReview ? 'completed' : 'pending';
                        break;
                }
            }
            
            if (status === 'active') {
                activeNodes.push(`节点${i}`);
            } else if (status === 'pending') {
                incompleteNodes.push(`节点${i}`);
            } else if (status === 'completed') {
                completedNodes.push(`节点${i}`);
            }
        }
        
        return {
            activeNodes,
            incompleteNodes,
            completedNodes
        };
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
        
        // 显示/隐藏 Gemini 模型选择
        const geminiModelGroup = document.getElementById('gemini-model-select-group');
        const geminiModelSelect = document.getElementById('gemini-model-select');
        const geminiModelDesc = document.getElementById('gemini-model-desc');
        
        if (geminiModelGroup && geminiModelSelect) {
            if (provider === 'gemini' && window.API && window.API.providers.gemini && window.API.providers.gemini.models) {
                geminiModelGroup.style.display = 'block';
                
                // 更新模型描述
                const selectedModel = geminiModelSelect.value || this.state.geminiModel || 'gemini-2.5-flash';
                if (geminiModelDesc && window.API.providers.gemini.models[selectedModel]) {
                    geminiModelDesc.textContent = window.API.providers.gemini.models[selectedModel].description;
                }
            } else {
                geminiModelGroup.style.display = 'none';
            }
        }

        // 显示/隐藏硅基流动模型选择
        const siliconflowModelGroup = document.getElementById('siliconflow-model-select-group');
        const siliconflowModelSelect = document.getElementById('siliconflow-model-select');
        
        if (siliconflowModelGroup && siliconflowModelSelect) {
            if (provider === 'siliconflow') {
                siliconflowModelGroup.style.display = 'block';
            } else {
                siliconflowModelGroup.style.display = 'none';
            }
        }

        // 显示/隐藏 Poe 模型选择
        const poeModelGroup = document.getElementById('poe-model-select-group');
        const poeModelSelect = document.getElementById('poe-model-select');
        
        if (poeModelGroup && poeModelSelect) {
            if (provider === 'poe') {
                poeModelGroup.style.display = 'block';
            } else {
                poeModelGroup.style.display = 'none';
            }
        }
    },
    
    // 获取当前选择的 Gemini 模型
    getGeminiModel() {
        const geminiModelSelect = document.getElementById('gemini-model-select');
        if (geminiModelSelect && geminiModelSelect.offsetParent !== null) { // 检查是否可见
            return geminiModelSelect.value || this.state.geminiModel || 'gemini-2.5-flash';
        }
        return this.state.geminiModel || 'gemini-2.5-flash';
    },

    // 获取当前选择的硅基流动模型
    getSiliconFlowModel() {
        const siliconflowModelSelect = document.getElementById('siliconflow-model-select');
        if (siliconflowModelSelect && siliconflowModelSelect.offsetParent !== null) { // 检查是否可见
            return siliconflowModelSelect.value || this.state.siliconflowModel || 'Qwen/QwQ-32B';
        }
        return this.state.siliconflowModel || 'Qwen/QwQ-32B';
    },

    // 获取当前选择的 Poe 模型
    getPoeModel() {
        const poeModelSelect = document.getElementById('poe-model-select');
        if (poeModelSelect && poeModelSelect.offsetParent !== null) { // 检查是否可见
            return poeModelSelect.value || this.state.poeModel || 'Claude-Sonnet-4';
        }
        return this.state.poeModel || 'Claude-Sonnet-4';
    },

    // 获取当前选择的API供应商
    getCurrentApiProvider() {
        const providerSelect = document.getElementById('main-api-provider-select');
        return providerSelect ? (providerSelect.value || 'deepseek') : (this.state.apiProvider || 'deepseek');
    },
    
    // 获取当前使用的模型名称（用于 Gemini、硅基流动和 Poe）
    getCurrentModelName() {
        const provider = this.getCurrentApiProvider();
        if (provider === 'gemini') {
            return this.getGeminiModel();
        } else if (provider === 'siliconflow') {
            return this.getSiliconFlowModel();
        } else if (provider === 'poe') {
            return this.getPoeModel();
        }
        return null; // 其他供应商使用默认模型
    },

    // 检查需求状态
    checkRequirementStatus() {
        // 根据子项目类型检查不同的UI元素
        const state = this.state;
        const subprojectType = state.currentSubprojectType;
        
        let requiredElement = null;
        if (subprojectType === 'literatureSearch') {
            // 文献查找子项目：检查需求输入框或API供应商选择框
            requiredElement = document.getElementById('main-requirement-input') || 
                             document.getElementById('main-api-provider-select');
        } else if (subprojectType === 'reviewWriting') {
            // 综述撰写子项目：检查API供应商选择框或大纲要求输入框（撰写页面没有API Key输入框）
            requiredElement = document.getElementById('main-api-provider-select') || 
                             document.getElementById('main-requirement-input') ||
                             document.getElementById('main-chapter-count');
        } else {
            // 兼容旧格式：检查API Key输入框或API供应商选择框
            requiredElement = document.getElementById('main-api-key-input') || 
                             document.getElementById('main-api-provider-select');
        }
        
        if (!requiredElement) {
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
        
        // 加载 Gemini 模型选择（需要在 updateApiProviderUI 之前设置，以便正确显示）
        if (this.state.projectData.config && this.state.projectData.config.geminiModel) {
            this.state.geminiModel = this.state.projectData.config.geminiModel;
        }
        
        // 加载硅基流动模型选择（需要在 updateApiProviderUI 之前设置，以便正确显示）
        if (this.state.projectData.config && this.state.projectData.config.siliconflowModel) {
            this.state.siliconflowModel = this.state.projectData.config.siliconflowModel;
        }
        
        this.updateApiProviderUI();
        
        // 在 updateApiProviderUI 之后设置模型选择框的值（确保选择框已显示）
        if (this.state.geminiModel) {
            const geminiModelSelect = document.getElementById('gemini-model-select');
            if (geminiModelSelect) {
                window.UIUtils.setValue('gemini-model-select', this.state.geminiModel);
            }
        }
        
        if (this.state.siliconflowModel) {
            const siliconflowModelSelect = document.getElementById('siliconflow-model-select');
            if (siliconflowModelSelect) {
                window.UIUtils.setValue('siliconflow-model-select', this.state.siliconflowModel);
            }
        }

        // 加载API Key（根据当前选择的供应商）- 仅对综述撰写子项目
        if (subprojectType !== 'literatureSearch') {
            const currentProvider = this.getCurrentApiProvider();
            if (this.state.apiKeys && this.state.apiKeys[currentProvider]) {
                // 从apiKeys对象中加载当前供应商的Key
                const apiKey = this.state.apiKeys[currentProvider];
                const apiKeyInput = document.getElementById('main-api-key-input');
                if (apiKeyInput) {
                    window.UIUtils.setValue('main-api-key-input', apiKey);
                    this.state.globalApiKey = apiKey;
                }
            } else if (this.state.projectData.config && this.state.projectData.config.apiKey) {
                // 兼容旧格式：如果存在旧的apiKey，迁移到新格式
                if (!this.state.apiKeys) {
                    this.state.apiKeys = {};
                }
                const oldProvider = this.state.projectData.config.apiProvider || 'deepseek';
                this.state.apiKeys[oldProvider] = this.state.projectData.config.apiKey;
                if (currentProvider === oldProvider) {
                    const apiKeyInput = document.getElementById('main-api-key-input');
                    if (apiKeyInput) {
                        window.UIUtils.setValue('main-api-key-input', this.state.projectData.config.apiKey);
                        this.state.globalApiKey = this.state.projectData.config.apiKey;
                    }
                }
            } else if (this.state.globalApiKey && this.state.apiKeys && this.state.apiKeys[currentProvider]) {
                // 如果state中有但输入框没有，也设置
                const apiKeyInput = document.getElementById('main-api-key-input');
                if (apiKeyInput) {
                    window.UIUtils.setValue('main-api-key-input', this.state.apiKeys[currentProvider]);
                }
            }
        }
        
        // 加载需求描述/大纲要求
        // 对于撰写子项目，优先从 node5 中读取，如果不存在则清空（避免显示其他子项目的数据）
        if (subprojectType === 'reviewWriting') {
            console.log('[checkRequirementStatus] 加载撰写子项目数据:', {
                hasSubproject: !!state.currentSubproject,
                hasNode5: !!state.currentSubproject?.node5,
                outlineRequirement: state.currentSubproject?.node5?.outlineRequirement,
                chapterCount: state.currentSubproject?.node5?.chapterCount,
                hasOutline: !!state.currentSubproject?.node5?.outline,
                outlineLength: state.currentSubproject?.node5?.outline?.length || 0
            });
            
            if (state.currentSubproject?.node5?.outlineRequirement !== undefined) {
                window.UIUtils.setValue('main-requirement-input', state.currentSubproject.node5.outlineRequirement);
            } else {
                window.UIUtils.setValue('main-requirement-input', ''); // 清空，避免显示其他子项目的数据
            }
        } else if (this.state.requirementData.requirement) {
            window.UIUtils.setValue('main-requirement-input', this.state.requirementData.requirement);
        }
        
        // 加载章节数（仅撰写子项目）
        if (subprojectType === 'reviewWriting') {
            if (state.currentSubproject?.node5?.chapterCount !== undefined) {
                window.UIUtils.setValue('main-chapter-count', state.currentSubproject.node5.chapterCount);
            } else {
                window.UIUtils.setValue('main-chapter-count', '3'); // 默认值，避免显示其他子项目的数据
            }
        }
        
        // 加载大纲（仅撰写子项目）
        // 如果子项目没有大纲，应该清空显示，避免显示其他子项目的大纲
        if (subprojectType === 'reviewWriting') {
            if (state.currentSubproject?.node5?.outline) {
                window.UIUtils.setValue('main-outline-editor', state.currentSubproject.node5.outline);
                window.UIUtils.showElement('main-outline-result');
                console.log('[checkRequirementStatus] 大纲已加载到编辑器，长度:', state.currentSubproject.node5.outline.length);
            } else {
                window.UIUtils.setValue('main-outline-editor', ''); // 清空大纲编辑器
                window.UIUtils.hideElement('main-outline-result'); // 隐藏大纲结果区域
                console.log('[checkRequirementStatus] 子项目没有大纲，已清空编辑器');
            }
        }
        
        // 加载目标数量（仅文献查找子项目）
        if (subprojectType === 'literatureSearch' && this.state.requirementData.targetCount) {
            window.UIUtils.setValue('main-target-count', this.state.requirementData.targetCount);
            if (window.RequirementManager) {
                window.RequirementManager.updateTargetHint();
            }
        }
        
        // 加载语言选择
        if (this.state.requirementData.language) {
            window.UIUtils.setValue('main-language-select', this.state.requirementData.language);
        }
        
        // 加载Google Scholar验证状态 - 仅对综述撰写子项目
        if (subprojectType !== 'literatureSearch') {
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
        if (this.isAutoGenerating() && status === 'pending') {
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
        if (this.isAutoGenerating()) {
            window.UIUtils.showToast('流程正在进行中，请等待完成后再编辑', 'info');
            return;
        }
        
        // 检查节点状态，如果是pending则不允许打开
        const nodeStatus = this.state.nodeStates[nodeNum] || 'pending';
        if (nodeStatus === 'pending') {
            window.UIUtils.showToast('该节点尚未开始，无法查看详情', 'info');
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
                // 确保节点内容展开（默认展开，无需按钮）
                const nodeBody = document.getElementById(`node-body-${nodeNum}`);
                if (nodeBody) {
                    nodeBody.classList.remove('collapsed');
                    nodeBody.style.display = 'block';
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
            // 确保节点内容展开（默认展开，无需按钮）
            const nodeBody = document.getElementById(`node-body-${nodeNum}`);
            if (nodeBody) {
                nodeBody.classList.remove('collapsed');
                nodeBody.style.display = 'block';
            }
            this.updateNodeState(nodeNum, 'active');
            this.loadNodeData(nodeNum);
        }
    },

    // 显示总览
    showOverview(force = false) {
        // 如果是撰写子项目，不显示总览，而是显示文献列表
        if (this.state.currentSubprojectType === 'reviewWriting') {
            // 隐藏所有其他容器
            const overviewContainer = document.getElementById('overview-container');
            const literatureListContainer = document.getElementById('literature-list-container');
            const nodeContentContainer = document.getElementById('node-content-container');
            const emptyPanel = document.getElementById('node-content-empty');
            
            if (overviewContainer) {
                overviewContainer.style.display = 'none';
            }
            if (nodeContentContainer) {
                nodeContentContainer.style.display = 'none';
            }
            if (emptyPanel) {
                emptyPanel.style.display = 'none';
            }
            
            // 显示文献列表容器
            if (literatureListContainer) {
                literatureListContainer.style.display = 'block';
            }
            
            // 加载并显示文献列表
            this.loadReviewLiteratureList();
            return;
        }
        
        // 如果正在自动生成且不是强制显示，不允许切换到总览
        if (this.isAutoGenerating() && !force) {
            window.UIUtils.showToast('流程正在进行中，请等待完成后再查看总览', 'info');
            return;
        }
        
        const overviewContainer = document.getElementById('overview-container');
        const literatureListContainer = document.getElementById('literature-list-container');
        const nodeContentContainer = document.getElementById('node-content-container');
        const emptyPanel = document.getElementById('node-content-empty');
        
        if (overviewContainer) {
            overviewContainer.style.display = 'block';
        }
        if (literatureListContainer) {
            literatureListContainer.style.display = 'none';
        }
        if (nodeContentContainer) {
            nodeContentContainer.style.display = 'none';
        }
        if (emptyPanel) {
            emptyPanel.style.display = 'none';
        }
        
        // 更新总览内容
        this.updateOverview();
    },

    // 隐藏总览，显示节点详情
    hideOverview() {
        // 如果是撰写子项目，保持文献列表显示
        if (this.state.currentSubprojectType === 'reviewWriting') {
            const overviewContainer = document.getElementById('overview-container');
            const nodeContentContainer = document.getElementById('node-content-container');
            const emptyPanel = document.getElementById('node-content-empty');
            const literatureListContainer = document.getElementById('literature-list-container');
            
            if (overviewContainer) {
                overviewContainer.style.display = 'none';
            }
            if (nodeContentContainer) {
                nodeContentContainer.style.display = 'block';
            }
            if (emptyPanel) {
                emptyPanel.style.display = 'none';
            }
            // 保持文献列表容器显示
            if (literatureListContainer) {
                literatureListContainer.style.display = 'block';
            }
            return;
        }
        
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
            // 确保节点内容展开（默认展开，无需按钮）
            const nodeBody = document.getElementById(`node-body-${nodeNum}`);
            if (nodeBody) {
                nodeBody.classList.remove('collapsed');
                nodeBody.style.display = 'block';
            }
        }
        
        // 处理其他节点：只显示已完成的，隐藏未开始的（未来节点）
        for (let i = 1; i <= 5; i++) {
            if (i === nodeNum) continue; // 当前节点已处理
            
            const nodeContent = document.getElementById(`content-node-${i}`);
            const nodeStatus = this.state.nodeStates[i];
            
            if (!nodeContent) continue;
            
            // 如果正在自动生成，只显示已完成的节点，隐藏所有未来节点
            if (this.isAutoGenerating()) {
                if (nodeStatus === 'completed') {
                    // 已完成的节点：显示
                    nodeContent.classList.add('active');
                    nodeContent.style.display = 'block';
                    // 确保已完成的节点内容展开（默认展开，无需按钮）
                    const nodeBody = document.getElementById(`node-body-${i}`);
                    if (nodeBody) {
                        nodeBody.classList.remove('collapsed');
                        nodeBody.style.display = 'block';
                    }
                    // 显示已完成节点的统计数据
                    this.displayNodeStatistics(i).catch(err => {
                        console.warn(`[showNodeContent] 显示节点${i}统计数据失败:`, err);
                    });
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
        
        // 在一键生成时，显示已完成节点的统计数据
        if (this.isAutoGenerating()) {
            // 异步显示统计数据，不阻塞主流程
            this.displayCompletedNodesStatistics().catch(err => {
                console.warn('[showNodeContent] 显示统计数据失败:', err);
            });
        }
    },

    // 显示已完成节点的统计数据（一键生成时）
    async displayCompletedNodesStatistics() {
        for (let i = 1; i <= 5; i++) {
            const nodeStatus = this.state.nodeStates[i];
            if (nodeStatus === 'completed') {
                await this.displayNodeStatistics(i);
            }
        }
    },

    // 显示单个节点的统计数据（已禁用进度条显示）
    async displayNodeStatistics(nodeNum) {
        // 不再显示页面上的进度条，统计数据只在总览中显示
        return;
    },

    // 获取节点的统计数据（从当前状态计算或从保存的数据中读取）
    async getNodeStatistics(nodeNum) {
        // 尝试从保存的数据中读取
        if (window.DataManager && this.state.currentProjectName) {
            try {
                const projectData = await window.DataManager.loadProjectData(this.state.currentProjectName);
                if (projectData) {
                    const nodeKey = `node${nodeNum}`;
                    if (projectData[nodeKey] && projectData[nodeKey].statistics) {
                        return projectData[nodeKey].statistics;
                    }
                }
            } catch (error) {
                console.warn(`[getNodeStatistics] 无法从保存的数据中读取节点${nodeNum}的统计数据:`, error);
            }
        }
        
        // 如果保存的数据中没有，从当前状态计算
        switch(nodeNum) {
            case 1:
                if (this.state.requirementData && this.state.requirementData.keywordsPlan) {
                    const keywordsPlan = this.state.requirementData.keywordsPlan;
                    const keywordsCount = keywordsPlan.length;
                    const totalPapers = keywordsPlan.reduce((sum, item) => sum + (item.count || 0), 0);
                    return {
                        keywordsCount: keywordsCount,
                        totalPapers: totalPapers,
                        summary: `共生成 ${keywordsCount} 个关键词，预计搜索 ${totalPapers} 篇文献`
                    };
                }
                break;
            case 2:
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    const foundCount = this.state.allLiterature.length;
                    const uniqueCount = new Set(this.state.allLiterature.map(lit => lit.title?.toLowerCase().trim())).size;
                    const withAbstract = this.state.allLiterature.filter(lit => lit.abstract && lit.abstract.trim()).length;
                    return {
                        foundCount: foundCount,
                        uniqueCount: uniqueCount,
                        withAbstract: withAbstract,
                        summary: `共找到 ${foundCount} 篇文献（去重后 ${uniqueCount} 篇，其中 ${withAbstract} 篇有摘要）`
                    };
                }
                break;
            case 3:
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    const totalCount = this.state.allLiterature.length;
                    const successCount = this.state.allLiterature.filter(lit => 
                        lit.completionStatus === 'completed' || 
                        (lit.abstract && window.Node3Complete && window.Node3Complete.isAbstractComplete && window.Node3Complete.isAbstractComplete(lit.abstract))
                    ).length;
                    const failCount = totalCount - successCount;
                    const completionRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
                    return {
                        totalCount: totalCount,
                        successCount: successCount,
                        failCount: failCount,
                        completionRate: completionRate,
                        summary: `总计 ${totalCount} 篇，成功 ${successCount} 篇，失败 ${failCount} 篇（完成率 ${completionRate}%）`
                    };
                }
                break;
            case 4:
                if (this.state.allLiterature && this.state.selectedLiterature) {
                    const selectedCount = this.state.selectedLiterature.length;
                    const totalCount = this.state.allLiterature.length;
                    const unselectedCount = totalCount - selectedCount;
                    const selectionRate = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;
                    return {
                        totalCount: totalCount,
                        selectedCount: selectedCount,
                        unselectedCount: unselectedCount,
                        selectionRate: selectionRate,
                        summary: `共 ${totalCount} 篇文献，AI推荐 ${selectedCount} 篇，未推荐 ${unselectedCount} 篇（推荐率 ${selectionRate}%）`
                    };
                }
                break;
            case 5:
                if (this.state.reviewContent && this.state.selectedLiterature) {
                    const reviewLength = this.state.reviewContent.length;
                    const selectedLitCount = this.state.selectedLiterature.length;
                    const wordCount = reviewLength > 0 ? Math.round(reviewLength / 2) : 0;
                    return {
                        selectedLitCount: selectedLitCount,
                        wordCount: wordCount,
                        reviewLength: reviewLength,
                        summary: `基于 ${selectedLitCount} 篇精选文献，生成约 ${wordCount} 字综述（${reviewLength} 字符）`
                    };
                }
                break;
        }
        
        return null;
    },

    // 从总览跳转到节点详情
    showNodeDetail(nodeNum) {
        // 如果正在自动生成，不允许从总览跳转
        if (this.isAutoGenerating()) {
            window.UIUtils.showToast('流程正在进行中，请等待完成后再编辑', 'info');
            return;
        }
        
        // 检查节点状态，如果是pending则不允许点击
        const nodeStatus = this.state.nodeStates[nodeNum] || 'pending';
        if (nodeStatus === 'pending') {
            window.UIUtils.showToast('该节点尚未开始，无法查看详情', 'info');
            return;
        }
        
        this.hideOverview();
        this.openNode(nodeNum);
    },

    // 更新总览内容
    updateOverview() {
        // 根据子项目类型决定显示哪些节点
        const subprojectType = this.state.currentSubprojectType;
        const nodesToShow = subprojectType === 'literatureSearch' ? [1, 2, 3, 4] : 
                           subprojectType === 'reviewWriting' ? [5] : 
                           [1, 2, 3, 4, 5]; // 默认显示所有节点
        
        // 更新节点状态
        for (let i = 1; i <= 5; i++) {
            const statusEl = document.getElementById(`overview-status-${i}`);
            const contentEl = document.getElementById(`overview-content-${i}`);
            const overviewCard = document.querySelector(`.overview-node-card[data-node="${i}"]`);
            const status = this.state.nodeStates[i] || 'pending';
            
            // 根据子项目类型决定是否显示该节点的总览卡片
            if (!nodesToShow.includes(i)) {
                // 不属于当前子项目的节点，隐藏
                if (overviewCard) {
                    overviewCard.style.display = 'none';
                }
                continue;
            }
            
            // 如果正在自动生成，隐藏未开始的节点（未来节点）
            if (this.isAutoGenerating() && status === 'pending') {
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
            
            // 为pending状态的节点卡片添加不可点击样式
            if (overviewCard) {
                if (status === 'pending') {
                    overviewCard.style.cursor = 'not-allowed';
                    overviewCard.style.opacity = '0.6';
                    overviewCard.style.pointerEvents = 'none';
                } else {
                    overviewCard.style.cursor = 'pointer';
                    overviewCard.style.opacity = '1';
                    overviewCard.style.pointerEvents = 'auto';
                }
            }
        }
    },

    // 获取节点总览内容（只读）
    getOverviewContent(nodeNum) {
        // 如果正在自动生成，且该节点未开始（未来节点），返回空内容
        const nodeStatus = this.state.nodeStates[nodeNum] || 'pending';
        if (this.isAutoGenerating() && nodeStatus === 'pending') {
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
                    // 计算补全成功的文献数（使用节点3的补全状态判断）
                    // 优先使用 completionStatus === 'completed'，如果没有则检查 abstractComplete 或使用 isAbstractComplete 函数
                    const completedCount = this.state.allLiterature.filter(lit => {
                        // 优先使用 completionStatus（节点3明确标记的补全状态）
                        if (lit.completionStatus === 'completed') {
                            return true;
                        }
                        // 如果没有 completionStatus，检查 abstractComplete 字段
                        if (lit.abstractComplete === true) {
                            return true;
                        }
                        // 如果都没有，使用 isAbstractComplete 函数判断摘要是否完整
                        if (window.Node3Complete && window.Node3Complete.isAbstractComplete) {
                            return window.Node3Complete.isAbstractComplete(lit.abstract);
                        }
                        // 最后回退：检查是否有摘要且长度>=150（简单判断）
                        return lit.abstract && lit.abstract.trim().length >= 150;
                    }).length;
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

    // 关闭节点内容（已废弃，节点内容默认展开）
    // 注意：此方法已废弃，节点内容始终展开
    closeNodeContent() {
        // 空实现，不再使用
    },

    // 切换节点内容的展开/隐藏（已移除，节点内容默认展开）
    // toggleNodeContent函数已废弃，节点内容始终展开

    // 加载节点数据
    async loadNodeData(nodeNum) {
        // 如果数据可能不完整，先尝试重新加载项目数据
        // 对于节点1，总是重新加载以确保数据是最新的（特别是在一键生成完成后）
        if (nodeNum === 1) {
            try {
                await this.loadCurrentProject();
            } catch (error) {
                console.warn('[loadNodeData] 重新加载项目数据失败:', error);
            }
        }
        if (nodeNum === 4 && (!this.state.selectedLiterature || this.state.selectedLiterature.length === 0)) {
            try {
                await this.loadCurrentProject();
            } catch (error) {
                console.warn('[loadNodeData] 重新加载项目数据失败:', error);
            }
        }
        
        switch(nodeNum) {
            case 1:
                // 确保节点内容展开
                const nodeBody1 = document.getElementById('node-body-1');
                if (nodeBody1) {
                    nodeBody1.classList.remove('collapsed');
                    nodeBody1.style.display = 'block';
                }
                
                // 始终显示关键词结果区域
                window.UIUtils.showElement('keywords-result');
                window.UIUtils.hideElement('keywords-auto-progress');
                
                // 始终显示重新生成关键词按钮（无论状态如何）
                const regenerateBtn1 = document.getElementById('regenerate-keywords-btn');
                if (regenerateBtn1) {
                    regenerateBtn1.style.display = 'inline-block';
                }
                
                // 如果有关键词数据，显示数据
                if (this.state.requirementData.keywordsPlan && this.state.requirementData.keywordsPlan.length > 0) {
                    // 使用 requestAnimationFrame 确保 DOM 已更新后再显示
                    requestAnimationFrame(() => {
                        // 用户点击节点进入时使用编辑模式（editable=true）
                        window.Node1Keywords.display(this.state.requirementData.keywordsPlan, true);
                    });
                } else {
                    // 如果没有关键词数据，显示提示
                    requestAnimationFrame(() => {
                        const keywordsList = document.getElementById('keywords-list');
                        if (keywordsList) {
                            keywordsList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无关键词数据，请点击"重新分析关键词"按钮进行分析</p>';
                        }
                    });
                }
                break;
            case 2:
                // 用户点击节点进入编辑模式时，使用编辑模式显示（可删除）
                window.UIUtils.showElement('search-results');
                window.UIUtils.hideElement('search-progress');
                
                // 始终显示保存修改按钮（如果有文献数据）
                const saveSearchBtn = document.getElementById('save-search-results-btn');
                if (saveSearchBtn) {
                    if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                        saveSearchBtn.style.display = 'inline-block';
                    } else {
                        saveSearchBtn.style.display = 'none';
                    }
                }
                
                // 始终显示重新搜索文献按钮（无论状态如何）
                const regenerateBtn2 = document.getElementById('regenerate-node2-btn');
                if (regenerateBtn2) {
                    regenerateBtn2.style.display = 'block';
                }
                
                // 如果有文献数据，显示数据
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    // 编辑模式：editable=true，支持删除
                    window.Node2Search.display(this.state.allLiterature, true);
                } else {
                    // 如果没有文献，显示提示信息
                    const searchResultsList = document.getElementById('search-results-list');
                    if (searchResultsList) {
                        searchResultsList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无搜索结果，请点击"重新搜索文献"按钮进行搜索</p>';
                    }
                }
                break;
            case 3:
                // 始终显示补全结果区域（确保容器可见）
                const completeResults = document.getElementById('complete-results');
                if (completeResults) {
                    completeResults.style.display = 'block';
                }
                window.UIUtils.showElement('complete-results');
                window.UIUtils.hideElement('complete-progress');
                
                // 始终显示重新补全文献按钮（无论状态如何，无论是否有文献）
                const regenerateBtn3 = document.getElementById('regenerate-completion-btn');
                if (regenerateBtn3) {
                    regenerateBtn3.style.display = 'block';
                    regenerateBtn3.style.visibility = 'visible';
                }
                
                // 始终显示保存修改按钮（如果有文献数据）
                const saveBtn3 = document.getElementById('save-completion-btn');
                if (saveBtn3) {
                    if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                        saveBtn3.style.display = 'inline-block';
                    } else {
                        saveBtn3.style.display = 'none';
                    }
                }
                
                // 如果有文献数据，显示数据
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    window.Node3Complete.display(this.state.allLiterature);
                } else {
                    // 如果没有文献，显示提示信息
                    const completeResultsList = document.getElementById('complete-results-list');
                    if (completeResultsList) {
                        completeResultsList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无补全结果，请点击"重新补全文献"按钮进行补全</p>';
                    }
                    // 确保按钮在列表下方可见
                    if (regenerateBtn3) {
                        regenerateBtn3.style.display = 'block';
                        regenerateBtn3.style.visibility = 'visible';
                        regenerateBtn3.style.marginTop = '15px';
                    }
                }
                break;
            case 4:
                // 始终显示筛选结果区域（确保容器可见）
                const filterResults = document.getElementById('filter-results');
                if (filterResults) {
                    filterResults.style.display = 'block';
                }
                // 确保文献列表容器可见
                const filterResultsList = document.getElementById('filter-results-list');
                if (filterResultsList) {
                    filterResultsList.style.display = 'block';
                }
                window.UIUtils.hideElement('filter-progress');
                // 一键生成时，不显示统计卡片
                if (this.isAutoGenerating()) {
                    window.UIUtils.hideElement('filter-statistics-container');
                } else {
                    window.UIUtils.showElement('filter-statistics-container');
                }
                window.UIUtils.showElement('filter-results');
                window.UIUtils.showElement('filter-results-list');
                
                // 始终显示导出按钮（如果有已选文献数据）
                const exportBtn = document.getElementById('export-excel-btn');
                if (exportBtn) {
                    if (this.state.selectedLiterature && this.state.selectedLiterature.length > 0) {
                        exportBtn.style.display = 'inline-block';
                    } else {
                        exportBtn.style.display = 'none';
                    }
                }
                
                // 始终显示保存修改按钮（如果有文献数据）
                const saveBtn4 = document.getElementById('save-filter-btn');
                if (saveBtn4) {
                    if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                        saveBtn4.style.display = 'inline-block';
                    } else {
                        saveBtn4.style.display = 'none';
                    }
                }
                
                // 始终显示重新精选文献按钮（无论状态如何，无论是否有文献）
                const regenerateBtn4 = document.getElementById('regenerate-filter-btn');
                if (regenerateBtn4) {
                    regenerateBtn4.style.display = 'block';
                    regenerateBtn4.style.visibility = 'visible';
                }
                
                // 如果有文献数据，显示数据
                if (this.state.allLiterature && this.state.allLiterature.length > 0) {
                    // 使用 requestAnimationFrame 确保 DOM 已更新后再显示
                    requestAnimationFrame(() => {
                        // 用户点击节点进入时使用编辑模式（editable=true）
                        // 确保selectedLiterature存在（如果为空，使用空数组）
                        const selectedLit = this.state.selectedLiterature || [];
                        window.Node4Filter.display(this.state.allLiterature, selectedLit, true);
                    });
                } else {
                    // 如果没有文献，显示提示信息
                    requestAnimationFrame(() => {
                        const filterResultsList = document.getElementById('filter-results-list');
                        if (filterResultsList) {
                            filterResultsList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无文献数据，请先完成节点3：文献补全，或点击"重新精选文献"按钮进行筛选</p>';
                        }
                        // 确保按钮在列表下方可见
                        if (regenerateBtn4) {
                            regenerateBtn4.style.display = 'block';
                            regenerateBtn4.style.visibility = 'visible';
                            regenerateBtn4.style.marginTop = '15px';
                        }
                    });
                }
                break;
            case 5:
                // 根据子项目类型决定是否显示已选文献摘要区域
                if (this.state.currentSubprojectType === 'reviewWriting') {
                    // 撰写子项目：隐藏已选文献区域，因为所有文献都会自动使用
                    window.UIUtils.hideElement('selected-literature-summary');
                } else {
                    // 文献查找子项目：显示已选文献摘要区域
                    window.UIUtils.showElement('selected-literature-summary');
                    // 显示已选文献列表
                    if (this.state.selectedLiterature && this.state.selectedLiterature.length > 0) {
                        window.Node5Review.displaySelectedLiterature(this.state.selectedLiterature);
                    } else {
                        window.Node5Review.displaySelectedLiterature([]);
                    }
                }
                
                // 始终显示生成综述按钮（无论状态如何）
                const generateBtn = document.getElementById('generate-review-btn');
                if (generateBtn) {
                    generateBtn.style.display = 'inline-block';
                }
                
                // 如果有综述内容，显示综述
                if (this.state.reviewContent && this.state.reviewContent.trim()) {
                    // 对于撰写子项目，使用子项目的文献列表；对于文献查找子项目，使用已选文献
                    const literatureToUse = this.state.currentSubprojectType === 'reviewWriting' 
                        ? (this.state.currentSubproject?.literature || this.state.selectedLiterature || [])
                        : (this.state.selectedLiterature || []);
                    window.Node5Review.display(this.state.reviewContent, literatureToUse);
                    window.UIUtils.showElement('review-result');
                } else {
                    // 如果没有综述内容，显示提示
                    window.UIUtils.hideElement('review-result');
                    const reviewContentEl = document.getElementById('review-content');
                    if (reviewContentEl) {
                        reviewContentEl.value = '';
                    }
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
            // 节点4保存自己的数据
            this.saveNodeData(4, {
                selectedLiterature: this.state.selectedLiterature
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
            // 节点3保存自己的数据（补全后的文献）
            this.saveNodeData(3, {
                allLiterature: this.state.allLiterature
            });
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
        
        // 如果是在节点3中手动补全的，检查摘要是否完整并更新状态
        if (window.Node3Complete && window.Node3Complete.isAbstractComplete) {
            const abstractComplete = window.Node3Complete.isAbstractComplete(lit.abstract);
            lit.abstractComplete = abstractComplete;
            
            // 如果摘要完整且有期刊，标记为补全成功
            if (abstractComplete && lit.journal && lit.journal.trim()) {
                lit.completionStatus = 'completed';
                window.UIUtils.showToast('文献已手动补全成功', 'success');
            } else if (abstractComplete) {
                // 只有摘要完整，也算部分成功
                lit.completionStatus = 'completed';
                window.UIUtils.showToast('摘要已补全，建议补充期刊信息', 'info');
            } else if (lit.abstract && lit.abstract.trim()) {
                // 有摘要但不完整
                lit.completionStatus = 'failed';
            }
        }

        // 重新显示（用户手动操作时使用编辑模式）
        // 如果当前在节点3，更新节点3的显示
        const currentNodeContent = document.querySelector('.node-content.active');
        if (currentNodeContent && currentNodeContent.id === 'content-node-3') {
            window.Node3Complete.display(this.state.allLiterature);
        }
        // 如果当前在节点4，更新节点4的显示
        if (currentNodeContent && currentNodeContent.id === 'content-node-4') {
            window.Node4Filter.display(this.state.allLiterature, this.state.selectedLiterature, true);
        }
        
        // 保存数据（确保保存所有相关字段）
        // 保存节点3和节点4的数据
        this.saveNodeData(3, {
            allLiterature: this.state.allLiterature
        });
        this.saveNodeData(4, {
            selectedLiterature: this.state.selectedLiterature
        });
        
        // 更新总览
        this.updateOverview();
        
        // 关闭模态框
        this.closeEditModal();
        
        if (!lit.completionStatus || lit.completionStatus !== 'completed') {
            window.UIUtils.showToast('文献信息已保存', 'success');
        }
    },

    // 删除文献
    async deleteLiterature(index) {
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
            
            // 保存数据（使用节点数据格式）
            await this.saveNodeData(3, {
                allLiterature: this.state.allLiterature
            });
            await this.saveNodeData(4, {
                selectedLiterature: this.state.selectedLiterature
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
            const modelName = this.getCurrentModelName();
            const answer = await window.API.callAPI(apiProvider, this.state.globalApiKey, [{ role: 'user', content: prompt }], 0.3, modelName);
            
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
            
            // 保存数据（使用节点数据格式）
            await this.saveNodeData(3, {
                allLiterature: this.state.allLiterature
            });
            await this.saveNodeData(4, {
                selectedLiterature: this.state.selectedLiterature
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
    
    // 保存节点数据（委托给数据加载器）
    async saveNodeData(nodeNum, nodeData) {
        return await window.WorkflowDataLoader.saveNodeData(nodeNum, nodeData);
    },

    // 数据验证（委托给数据加载器）
    validateNodeData(nodeNum, data) {
        return window.WorkflowDataLoader.validateNodeData(nodeNum, data);
    },

    // 保存当前项目的所有数据（委托给数据加载器）
    async saveCurrentProjectData() {
        return await window.WorkflowDataLoader.saveCurrentProjectData();
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

        // 展开/隐藏按钮已移除，节点内容默认展开

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

        // 一键查找按钮事件（文献查找子项目）
        const startLiteratureSearchBtn = document.getElementById('start-literature-search-btn');
        if (startLiteratureSearchBtn) {
            startLiteratureSearchBtn.addEventListener('click', () => {
                this.startLiteratureSearch();
            });
        }

        // 生成关键词按钮事件（文献查找子项目）
        const generateKeywordsBtn = document.getElementById('generate-keywords-btn');
        if (generateKeywordsBtn) {
            generateKeywordsBtn.addEventListener('click', () => {
                this.generateKeywordsForLiteratureSearch();
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

        // 文献查找子项目保存配置按钮事件
        const saveConfigBtn = document.getElementById('save-config-btn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                this.saveLiteratureSearchConfig();
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

        // 返回按钮（直接返回，无需确认）
        const backBtn = document.getElementById('back-to-index-btn');
        if (backBtn) {
            backBtn.addEventListener('click', async () => {
                console.log('点击返回按钮');
                
                try {
                    // 如果正在运行，先停止（不询问，直接停止）
                    if (this.isRunning()) {
                        console.log('检测到正在运行的流程，先停止');
                        this.stopAutoGenerate();
                        // 等待一小段时间确保停止完成
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    // 保存当前项目数据（静默保存，失败也不阻止返回）
                    if (this.state.currentProject) {
                        try {
                            await this.saveCurrentProjectData();
                            console.log('项目数据保存成功');
                        } catch (saveError) {
                            console.warn('保存数据失败，继续返回:', saveError);
                            // 保存失败也不阻止返回
                        }
                    }
                    
                    // 清除当前子项目ID（避免index.html自动切换回工作流）
                    console.log('清除当前子项目状态');
                    sessionStorage.removeItem('currentSubprojectId');
                    
                    // 返回到项目详情页面（项目主页）
                    console.log('准备返回到项目详情页面');
                    if (window.electronAPI && window.electronAPI.switchToProjectDetail) {
                        const result = await window.electronAPI.switchToProjectDetail();
                        console.log('switchToProjectDetail 返回结果:', result);
                        if (result && !result.success) {
                            const errorMsg = result?.error || '未知错误';
                            console.error('返回失败:', errorMsg);
                            window.UIUtils.showToast('返回项目详情页面失败: ' + errorMsg, 'error');
                        }
                    } else {
                        console.error('electronAPI.switchToProjectDetail 不存在');
                        window.UIUtils.showToast('无法返回项目详情页面（API不存在）', 'error');
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
                if (window.RequirementManager) {
                window.RequirementManager.updateTargetHint();
            }
            });
        }

        // API供应商选择变化事件
        const apiProviderSelect = document.getElementById('main-api-provider-select');
        if (apiProviderSelect) {
            apiProviderSelect.addEventListener('change', () => {
                this.updateApiProviderUI();
            });
        }
        
        // Gemini 模型选择变化事件
        const geminiModelSelect = document.getElementById('gemini-model-select');
        if (geminiModelSelect) {
            geminiModelSelect.addEventListener('change', () => {
                this.state.geminiModel = geminiModelSelect.value;
                // 更新模型描述
                const geminiModelDesc = document.getElementById('gemini-model-desc');
                if (geminiModelDesc && window.API && window.API.providers.gemini && window.API.providers.gemini.models) {
                    const modelConfig = window.API.providers.gemini.models[geminiModelSelect.value];
                    if (modelConfig) {
                        geminiModelDesc.textContent = modelConfig.description;
                    }
                }
            });
        }

        // 硅基流动模型选择变化事件
        const siliconflowModelSelect = document.getElementById('siliconflow-model-select');
        if (siliconflowModelSelect) {
            siliconflowModelSelect.addEventListener('change', () => {
                this.state.siliconflowModel = siliconflowModelSelect.value;
            });
        }

        // Poe 模型选择变化事件
        const poeModelSelect = document.getElementById('poe-model-select');
        if (poeModelSelect) {
            poeModelSelect.addEventListener('change', () => {
                this.state.poeModel = poeModelSelect.value;
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
            // outline、chapterCount、literatureMapping 只保存在子项目的 node5 中，不保存到 project.json
            // 对于文献查找子项目，outline 可以保存在 requirementData 中
            // 对于撰写子项目，outline 应该只保存在子项目的 node5 中
            if (this.state.currentSubprojectType !== 'reviewWriting') {
                this.state.requirementData.outline = outline;
            }
            this.state.requirementData.language = language;

            // 保存到JSON文件
            // outline、chapterCount、literatureMapping 不保存到 project.json，它们只保存在子项目的 node5 中
            const requirementDataToSave = {
                requirement: requirement,
                targetCount: targetCount,
                language: language
                // keywordsPlan应该保存在node1中，不保存在requirementData中
                // outline、chapterCount、literatureMapping 只保存在子项目的 node5 中
            };
            
            // 对于文献查找子项目，可以保存 outline 到 requirementData
            if (this.state.currentSubprojectType !== 'reviewWriting' && outline) {
                requirementDataToSave.outline = outline;
            }
            
            await this.saveProjectData({
                config: {
                    apiKeys: this.state.apiKeys || {}, // 保存所有供应商的Keys
                    apiProvider: apiProvider,
                    geminiModel: apiProvider === 'gemini' ? this.getGeminiModel() : undefined
                },
                requirementData: requirementDataToSave
            });

            window.UIUtils.showToast('项目需求设置已保存', 'success');
        } catch (error) {
            console.error('保存项目需求设置失败:', error);
            window.UIUtils.showToast('保存失败: ' + (error.message || '未知错误'), 'error');
        }
    },

    // 分析需求
    async analyzeRequirement() {
        const state = this.state;
        
        // 立即显示提示，告知用户已开始生成
        window.UIUtils.showToast('正在生成大纲，请稍候...', 'info');
        
        // 获取API Key（撰写子项目时从项目配置读取，文献查找子项目从输入框读取）
        let apiKey = '';
        if (state.currentSubprojectType === 'reviewWriting') {
            // 撰写子项目：从项目配置中读取API Key
            const apiProvider = this.getCurrentApiProvider();
            apiKey = (state.apiKeys && state.apiKeys[apiProvider]) || 
                     (state.projectData.config && state.projectData.config.apiKeys && state.projectData.config.apiKeys[apiProvider]) ||
                     '';
        } else {
            // 文献查找子项目：从输入框读取
            apiKey = window.UIUtils.getValue('main-api-key-input');
        }
        
        const requirement = window.UIUtils.getValue('main-requirement-input');
        const language = window.UIUtils.getValue('main-language-select') || 'zh';

        if (!apiKey) {
            window.UIUtils.showToast('请先在项目配置中添加API Key', 'error');
            return;
        }

        try {
            this.state.globalApiKey = apiKey;
            this.state.requirementData.language = language;

            // 获取API供应商和模型（生成大纲和生成综述使用相同的）
            const apiProvider = this.getCurrentApiProvider();
            const modelName = this.getCurrentModelName();
            
            // 如果是撰写子项目，使用不同的逻辑
            if (state.currentSubprojectType === 'reviewWriting') {
                // 获取章节数和大纲要求
                const chapterCount = parseInt(window.UIUtils.getValue('main-chapter-count')) || 3;
                const outlineRequirement = requirement || ''; // 大纲要求是可选的
                
                // 获取所有文献列表
                const literatureList = state.currentSubproject?.literature || [];
                const validLiterature = literatureList.filter(lit => lit.title && lit.title.trim().length > 0);
                
                if (validLiterature.length === 0) {
                    window.UIUtils.showToast('没有可用的文献，请先关联文献查找子项目', 'error');
                    return;
                }
                
                // 保存数据
                this.state.requirementData.requirement = outlineRequirement;
                this.state.requirementData.chapterCount = chapterCount;
                
                if (!window.RequirementManager) {
                    throw new Error('RequirementManager模块未加载，无法分析需求');
                }
                
                // 显示正在生成大纲模态框
                const generatingOutlineModal = document.getElementById('generating-outline-modal');
                if (generatingOutlineModal) {
                    generatingOutlineModal.style.display = 'flex';
                }
                
                let result;
                try {
                    // 调用生成大纲，传入完整的文献列表（包含标题和年份）、章节数、大纲要求和语言
                    result = await window.RequirementManager.generateOutlineForReview(
                        apiKey, 
                        validLiterature, 
                        chapterCount, 
                        outlineRequirement,
                        apiProvider, 
                        modelName,
                        language // 传入用户选择的输出语言
                    );
                } finally {
                    // 隐藏正在生成大纲模态框
                    if (generatingOutlineModal) {
                        generatingOutlineModal.style.display = 'none';
                    }
                }
                
                this.state.requirementData.outline = result.outline;
                this.state.requirementData.literatureMapping = result.literatureMapping || [];
                window.UIUtils.setValue('main-outline-editor', result.outline);
                window.UIUtils.showElement('main-outline-result');
                
                // 根据文献映射重新排序文献（按章节、段落、年份）
                const reorderedLiterature = this.reorderLiteratureByOutline(validLiterature, result.literatureMapping);
                
                // 更新子项目中的文献列表
                if (state.currentSubproject) {
                    state.currentSubproject.literature = reorderedLiterature;
                }
                
                // 保存大纲和重新排序后的文献到子项目的JSON文件中
                if (state.currentSubprojectId && state.currentProject) {
                    // 更新node5，保存大纲相关信息
                    const node5Updates = {
                        outline: result.outline,
                        chapterCount: chapterCount,
                        outlineRequirement: outlineRequirement,
                        literatureMapping: result.literatureMapping,
                        status: state.currentSubproject.node5?.status || 'pending'
                    };
                    
                    console.log('[analyzeRequirement] 准备保存大纲到子项目:', {
                        subprojectId: state.currentSubprojectId,
                        node5Updates: node5Updates,
                        hasOutline: !!result.outline,
                        hasMapping: !!(result.literatureMapping && result.literatureMapping.length > 0)
                    });
                    
                    // 保存到 subprojects2.json 对应的子项目中
                    // 确保 node5 的深度合并，保留 reviewContent 等已有字段
                    const node5ToSave = {
                        ...(state.currentSubproject.node5 || {}), // 保留原有的 node5 数据（如 reviewContent）
                        ...node5Updates // 更新大纲相关字段
                    };
                    
                    console.log('[analyzeRequirement] 准备保存的 node5 数据:', {
                        hasReviewContent: !!node5ToSave.reviewContent,
                        hasOutline: !!node5ToSave.outline,
                        hasChapterCount: node5ToSave.chapterCount !== undefined,
                        hasOutlineRequirement: node5ToSave.outlineRequirement !== undefined,
                        hasLiteratureMapping: !!(node5ToSave.literatureMapping && node5ToSave.literatureMapping.length > 0),
                        node5Keys: Object.keys(node5ToSave)
                    });
                    
                    const updatedSubproject = await window.SubprojectManager.updateSubproject(
                        state.currentProject,
                        state.currentSubprojectId,
                        {
                            node5: node5ToSave,
                            literature: reorderedLiterature
                        }
                    );
                    
                    if (updatedSubproject) {
                        console.log('[analyzeRequirement] 大纲已保存到子项目，node5内容:', updatedSubproject.node5);
                    } else {
                        console.error('[analyzeRequirement] 保存大纲失败：未找到子项目或更新失败');
                    }
                    
                    // 更新state中的子项目对象
                    if (state.currentSubproject) {
                        if (!state.currentSubproject.node5) {
                            state.currentSubproject.node5 = {};
                        }
                        state.currentSubproject.node5 = {
                            ...state.currentSubproject.node5,
                            ...node5Updates
                        };
                        // 同时更新文献列表
                        state.currentSubproject.literature = reorderedLiterature;
                    }
                } else {
                    console.error('[analyzeRequirement] 无法保存大纲：缺少子项目ID或项目名称', {
                        hasSubprojectId: !!state.currentSubprojectId,
                        hasProject: !!state.currentProject
                    });
                }
            } else {
                // 文献查找子项目：使用原有逻辑
                const targetCount = parseInt(window.UIUtils.getValue('main-target-count')) || 50;
                
                if (!requirement) {
                    window.UIUtils.showToast('请先输入需求描述', 'error');
                    return;
                }
                
                this.state.requirementData.requirement = requirement;
                this.state.requirementData.targetCount = targetCount;
                
                if (!window.RequirementManager) {
                    throw new Error('RequirementManager模块未加载，无法分析需求');
                }
                
                const result = await window.RequirementManager.analyzeRequirement(apiKey, requirement, targetCount, apiProvider, modelName);
                
                this.state.requirementData.outline = result.outline;
                window.UIUtils.setValue('main-outline-editor', result.outline);
                window.UIUtils.showElement('main-outline-result');
            }

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
                    apiProvider: apiProvider,
                    geminiModel: apiProvider === 'gemini' ? this.getGeminiModel() : undefined
                },
                requirementData: this.state.requirementData
            });

            // 更新生成按钮显示状态
            this.updateGenerateButtonState();

            window.UIUtils.showToast('大纲生成完成', 'success');
        } catch (error) {
            console.error('生成大纲失败:', error);
            window.UIUtils.showToast('生成失败: ' + error.message, 'error');
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
            // 检查节点2、3、4、5是否有数据
            const hasNode2Data = this.state.searchResults && Object.keys(this.state.searchResults).length > 0;
            const hasNode3Data = this.state.allLiterature && this.state.allLiterature.length > 0;
            const hasNode4Data = this.state.selectedLiterature && this.state.selectedLiterature.length > 0;
            const hasNode5Data = this.state.reviewContent && this.state.reviewContent.trim().length > 0;
            hasExistingData = hasNode2Data || hasNode3Data || hasNode4Data || hasNode5Data;
            confirmMessage = '重新搜索节点2将清空以下内容：\n\n' +
                           '• 节点2：搜索结果\n' +
                           '• 节点3：补全的文献\n' +
                           '• 节点4：筛选的文献\n' +
                           '• 节点5：生成的综述\n\n' +
                           '同时会将节点3、4、5的状态重置为"待开始"。\n\n' +
                           '是否继续？';
        } else if (nodeNum === 3) {
            hasExistingData = this.state.allLiterature && this.state.allLiterature.some(lit => lit.abstract && lit.abstract.trim());
            confirmMessage = '重新补全节点3将清空以下内容：\n\n' +
                           '• 节点3：已补全的文献信息（摘要、期刊、被引次数等）\n\n' +
                           '同时会将节点3的状态重置为"进行中"。\n\n' +
                           '是否继续？';
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
                // 先将节点2的状态设置为active（正在重新搜索）
                this.state.nodeStates[2] = 'active';
                // 将节点3、4、5的状态重置为pending（必须在saveNodeData之前设置）
                this.state.nodeStates[3] = 'pending';
                this.state.nodeStates[4] = 'pending';
                this.state.nodeStates[5] = 'pending';
                
                // 节点2重新搜索时，先清空JSON中节点2、3、4、5的数据（status会自动更新）
                await this.saveNodeData(2, {
                    searchResults: undefined, // 明确删除 searchResults 字段
                    allLiterature: undefined // 明确删除 allLiterature 字段
                });
                await this.saveNodeData(3, {
                    allLiterature: undefined // 清空节点3的数据
                });
                await this.saveNodeData(4, {
                    selectedLiterature: undefined // 清空节点4的数据
                });
                await this.saveNodeData(5, {
                    reviewContent: undefined // 清空节点5的数据
                });
                
                // 然后清空state中的数据
                this.state.searchResults = {};
                this.state.allLiterature = [];
                this.state.selectedLiterature = [];
                this.state.reviewContent = '';
                
                // 更新节点状态显示
                this.updateNodeState(2, 'active');
                this.updateNodeState(3, 'pending');
                this.updateNodeState(4, 'pending');
                this.updateNodeState(5, 'pending');
                
                // 清空节点2的UI显示
                const searchResultsList = document.getElementById('search-results-list');
                if (searchResultsList) {
                    searchResultsList.innerHTML = '';
                }
                const searchCount = document.getElementById('search-count');
                if (searchCount) {
                    searchCount.textContent = '0';
                }
                
                // 清空节点3的UI显示
                const completeResultsList = document.getElementById('complete-results-list');
                if (completeResultsList) {
                    completeResultsList.innerHTML = '';
                }
                const completeCount = document.getElementById('complete-count');
                if (completeCount) {
                    completeCount.textContent = '0';
                }
                
                // 清空节点4的UI显示
                const filterResultsList = document.getElementById('filter-results-list');
                if (filterResultsList) {
                    filterResultsList.innerHTML = '';
                }
                const selectedList = document.getElementById('selected-list');
                if (selectedList) {
                    selectedList.innerHTML = '';
                }
                
                // 清空节点5的UI显示
                const reviewContent = document.getElementById('review-content');
                if (reviewContent) {
                    reviewContent.value = '';
                }
                
                // 隐藏节点3、4、5的相关UI元素
                window.UIUtils.hideElement('complete-results');
                window.UIUtils.hideElement('filter-results');
                const saveCompletionBtn = document.getElementById('save-completion-btn');
                const regenerateCompletionBtn = document.getElementById('regenerate-completion-btn');
                const saveFilterBtn = document.getElementById('save-filter-btn');
                const regenerateFilterBtn = document.getElementById('regenerate-filter-btn');
                if (saveCompletionBtn) saveCompletionBtn.style.display = 'none';
                if (regenerateCompletionBtn) regenerateCompletionBtn.style.display = 'none';
                if (saveFilterBtn) saveFilterBtn.style.display = 'none';
                if (regenerateFilterBtn) regenerateFilterBtn.style.display = 'none';
                
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
                
                // 更新总览显示
                this.updateOverview();
                
                // 只显示节点2的内容，隐藏其他所有节点
                this.showNodeContent(2);
                // 手动隐藏其他所有节点（1、3、4、5）
                for (let i = 1; i <= 5; i++) {
                    if (i === 2) continue; // 跳过节点2
                    const nodeContent = document.getElementById(`content-node-${i}`);
                    if (nodeContent) {
                        nodeContent.style.display = 'none';
                        nodeContent.classList.remove('active');
                        const nodeBody = document.getElementById(`node-body-${i}`);
                        if (nodeBody) {
                            nodeBody.style.display = 'none';
                        }
                    }
                }
                
                // 设置手动运行状态
                this.state.runningState = 'manual';
                this.state.currentRunningNode = 2;
                this.state.shouldStop = false;
                this.updateGenerateButtonState();
                
                await this.autoExecuteNode2();
                
                // 清除运行状态
                this.state.runningState = null;
                this.state.currentRunningNode = 0;
                this.state.autoNodeIndex = 0;
                this.updateGenerateButtonState();
            } else if (nodeNum === 3) {
                // 节点3重新补全时，先清空节点3的补全状态
                // 清空 allLiterature 中的补全信息（abstract、journal、completionStatus），保留基本信息
                if (this.state.allLiterature && Array.isArray(this.state.allLiterature)) {
                    this.state.allLiterature.forEach(lit => {
                        delete lit.abstract;
                        delete lit.journal;
                        delete lit.completionStatus;
                    });
                }
                
                // 将节点3的状态设置为active（正在重新补全）
                this.state.nodeStates[3] = 'active';
                
                // 清空JSON中节点3的补全数据（保留文献基本信息）
                await this.saveNodeData(3, {
                    allLiterature: this.state.allLiterature
                });
                
                // 更新节点状态显示
                this.updateNodeState(3, 'active');
                
                // 清空节点3的UI显示
                const completeResultsList = document.getElementById('complete-results-list');
                if (completeResultsList) {
                    completeResultsList.innerHTML = '';
                }
                const completeCount = document.getElementById('complete-count');
                if (completeCount) {
                    completeCount.textContent = '0';
                }
                
                // 隐藏多余的内容，只显示进度条
                window.UIUtils.hideElement('complete-results');
                const saveBtn = document.getElementById('save-completion-btn');
                const regenerateBtn = document.getElementById('regenerate-completion-btn');
                if (saveBtn) {
                    saveBtn.style.display = 'none';
                }
                if (regenerateBtn) {
                    regenerateBtn.style.display = 'none';
                }
                
                // 只显示节点3的内容，隐藏其他所有节点
                this.showNodeContent(3);
                // 手动隐藏其他所有节点（1、2、4、5）
                for (let i = 1; i <= 5; i++) {
                    if (i === 3) continue; // 跳过节点3
                    const nodeContent = document.getElementById(`content-node-${i}`);
                    if (nodeContent) {
                        nodeContent.style.display = 'none';
                        nodeContent.classList.remove('active');
                        const nodeBody = document.getElementById(`node-body-${i}`);
                        if (nodeBody) {
                            nodeBody.style.display = 'none';
                        }
                    }
                }
                
                // 设置手动运行状态
                this.state.runningState = 'manual';
                this.state.currentRunningNode = 3;
                this.state.shouldStop = false;
                this.updateGenerateButtonState();
                
                await this.autoExecuteNode3();
                
                // 清除运行状态
                this.state.runningState = null;
                this.state.currentRunningNode = 0;
                this.state.autoNodeIndex = 0;
                this.updateGenerateButtonState();
                
                // 完成后重新加载节点数据以显示结果
                this.loadNodeData(3);
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
                // 设置手动运行状态
                this.state.runningState = 'manual';
                this.state.currentRunningNode = 4;
                this.state.shouldStop = false;
                this.updateGenerateButtonState();
                
                await this.autoExecuteNode4();
                
                // 清除运行状态
                this.state.runningState = null;
                this.state.currentRunningNode = 0;
                this.state.autoNodeIndex = 0;
                this.updateGenerateButtonState();
                
                // 完成后重新加载节点数据以显示结果
                this.loadNodeData(4);
            }

            window.UIUtils.showToast(`节点${nodeNum}重新生成完成`, 'success');
        } catch (error) {
            console.error(`节点${nodeNum}重新生成失败:`, error);
            window.UIUtils.showToast(`节点${nodeNum}重新生成失败: ${error.message || '未知错误'}`, 'error');
            // 即使出错，也要确保按钮状态正确
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
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
        this.state.runningState = 'auto';
        this.state.autoNodeIndex = nextNode; // 从下一个节点开始
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

        // 用户确认后，先清空所有节点的UI内容
        console.log('[startAutoGenerate] Clearing all node UI content...');
        
        // 清空节点1：关键词列表
        const keywordsList = document.getElementById('keywords-list');
        if (keywordsList) {
            keywordsList.innerHTML = '';
        }
        
        // 清空节点2：搜索结果列表和所有相关内容
        const searchResultsList = document.getElementById('search-results-list');
        if (searchResultsList) {
            searchResultsList.innerHTML = '';
        }
        const searchCount = document.getElementById('search-count');
        if (searchCount) {
            searchCount.textContent = '0';
        }
        // 隐藏搜索结果区域
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
            searchResults.style.display = 'none';
        }
        // 隐藏搜索进度条
        const searchProgress = document.getElementById('search-progress');
        if (searchProgress) {
            searchProgress.style.display = 'none';
        }
        // 隐藏保存按钮
        const saveSearchBtn = document.getElementById('save-search-results-btn');
        if (saveSearchBtn) {
            saveSearchBtn.style.display = 'none';
        }
        // 隐藏重新搜索按钮
        const regenerateNode2Btn = document.getElementById('regenerate-node2-btn');
        if (regenerateNode2Btn) {
            regenerateNode2Btn.style.display = 'none';
        }
        
        // 清空节点3：补全结果列表
        const completeResultsList = document.getElementById('complete-results-list');
        if (completeResultsList) {
            completeResultsList.innerHTML = '';
        }
        const completeCount = document.getElementById('complete-count');
        if (completeCount) {
            completeCount.textContent = '0';
        }
        
        // 清空节点4：筛选结果列表
        const filterResultsList = document.getElementById('filter-results-list');
        if (filterResultsList) {
            filterResultsList.innerHTML = '';
        }
        
        // 清空节点5：综述内容
        const reviewContent = document.getElementById('review-content');
        if (reviewContent) {
            reviewContent.value = '';
        }
        const selectedList = document.getElementById('selected-list');
        if (selectedList) {
            selectedList.innerHTML = '';
        }
        const selectedCount = document.getElementById('selected-count');
        if (selectedCount) {
            selectedCount.textContent = '0';
        }
        
        console.log('[startAutoGenerate] All node UI content cleared');
        
        // 然后清除JSON文件中的节点信息
        console.log('[startAutoGenerate] Clearing node data from JSON file...');
        // 清空所有节点数据
        await this.saveNodeData(1, {
            keywords: [],
            keywordsPlan: []
        });
        await this.saveNodeData(2, {
            searchResults: undefined, // 明确删除 searchResults 字段
            allLiterature: undefined // 明确删除 allLiterature 字段
        });
        await this.saveNodeData(3, {
            allLiterature: []
        });
        await this.saveNodeData(4, {
            selectedLiterature: []
        });
        await this.saveNodeData(5, {
            reviewContent: ''
        });
        
        // 清空关键词计划
        await this.saveProjectData({
            requirementData: {
                ...this.state.requirementData,
                keywordsPlan: []
            }
        });
        console.log('[startAutoGenerate] Node data cleared from JSON file');

        // 然后清空state中的所有现有内容
        // 注意：保留需求分析相关数据（requirement、outline），只清空执行结果
        this.state.keywords = [];
        this.state.searchResults = {}; // 清空节点2的搜索结果
        this.state.allLiterature = []; // 清空节点3的文献列表
        this.state.selectedLiterature = []; // 清空节点4的已选文献
        this.state.reviewContent = ''; // 清空节点5的综述内容
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
        this.state.runningState = 'auto';
        this.state.autoNodeIndex = 1;
        this.state.shouldStop = false; // 重置停止标志
        console.log('[startAutoGenerate] State initialized:', {
            runningState: this.state.runningState,
            autoNodeIndex: this.state.autoNodeIndex,
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
            autoNodeIndex: this.state.autoNodeIndex,
            runningState: this.state.runningState,
            shouldStop: this.state.shouldStop
        });
        
        window.UIUtils.showToast('开始执行节点1：关键词分析...', 'info');
        await this.executeNextNode();
        console.log('[startAutoGenerate] executeNextNode completed');
    },

    // 生成关键词（文献查找子项目：只执行节点1）
    async generateKeywordsForLiteratureSearch() {
        console.log('[generateKeywordsForLiteratureSearch] ========== GENERATE KEYWORDS CALLED ==========');
        
        // 检查是否有需求描述
        const requirement = document.getElementById('main-requirement-input')?.value || 
                           this.state.requirementData.requirement;
        if (!requirement || requirement.trim().length === 0) {
            window.UIUtils.showToast('请先填写查询的文献综述需求', 'error');
            return;
        }
        
        // 从项目配置中读取API Key
        const apiProvider = this.getCurrentApiProvider();
        const apiKey = this.state.apiKeys && this.state.apiKeys[apiProvider] ? 
                      this.state.apiKeys[apiProvider] : 
                      (this.state.projectData.config && this.state.projectData.config.apiKeys && 
                       this.state.projectData.config.apiKeys[apiProvider] ? 
                       this.state.projectData.config.apiKeys[apiProvider] : null);
        
        if (!apiKey) {
            window.UIUtils.showToast('请先在项目配置中添加API Key', 'error');
            return;
        }
        
        // 更新需求数据
        this.state.requirementData.requirement = requirement;
        const targetCount = parseInt(document.getElementById('main-target-count')?.value || '50', 10);
        this.state.requirementData.targetCount = targetCount;
        const language = document.getElementById('main-language-select')?.value || 'zh';
        this.state.requirementData.language = language;
        
        // 保存配置
        await this.saveLiteratureSearchConfig();
        
        // 设置API Key
        this.state.globalApiKey = apiKey;
        this.state.apiProvider = apiProvider;
        
        // 运行中只显示"运行中"三个字
        const overviewContainer = document.getElementById('overview-container');
        const nodeContentContainer = document.getElementById('node-content-container');
        const emptyPanel = document.getElementById('node-content-empty');
        
        if (overviewContainer) {
            overviewContainer.style.display = 'none';
        }
        if (nodeContentContainer) {
            nodeContentContainer.style.display = 'none';
        }
        if (emptyPanel) {
            emptyPanel.style.display = 'block';
            emptyPanel.innerHTML = '<div style="text-align: center; padding: 100px 20px; font-size: 24px; color: #666;">运行中</div>';
        }
        
        // 隐藏页面上的进度条（现在不使用进度条）
        this.hideAllProgressBars(1);
        window.UIUtils.hideElement('keywords-auto-progress');
        window.UIUtils.hideElement('keywords-result');
        
        // 设置手动运行状态
        this.state.runningState = 'manual';
        this.state.currentRunningNode = 1;
        this.state.shouldStop = false;
        this.updateNodeState(1, 'active');
        this.updateGenerateButtonState();
        
        try {
            // 获取查找配置
            const literatureSource = document.getElementById('literature-source-select')?.value || 'google-scholar';
            const recentYears = parseInt(document.getElementById('recent-years-input')?.value || '5', 10);
            const recentYearsPercentage = parseInt(document.getElementById('recent-years-percentage')?.value || '60', 10);
            
            const searchConfig = {
                literatureSource: literatureSource,
                yearLimit: {
                    recentYears: recentYears,
                    percentage: recentYearsPercentage
                }
            };
            
            // 执行关键词分析（传入配置信息）
            const modelName = this.getCurrentModelName();
            const keywordsPlan = await window.Node1Keywords.execute(
                apiKey, 
                this.state.requirementData, 
                apiProvider, 
                modelName,
                searchConfig
            );
            
            // 验证返回结果
            if (!keywordsPlan || !Array.isArray(keywordsPlan) || keywordsPlan.length === 0) {
                throw new Error('关键词分析返回结果为空或格式错误');
            }
            
            // 更新状态数据
            this.state.requirementData.keywordsPlan = keywordsPlan;
            this.state.keywords = keywordsPlan.map(item => item.keyword);
            
            // 关键词分析完成（不显示页面上的进度条）
            
            // 更新节点状态
            this.updateNodeState(1, 'completed');
            
            // 保存数据
            await this.saveNodeData(1, {
                keywords: this.state.keywords,
                keywordsPlan: this.state.requirementData.keywordsPlan || []
            });
            
            // 显示结果（编辑模式，用户可以确认和修改）
            window.Node1Keywords.display(this.state.requirementData.keywordsPlan, true);
            window.UIUtils.showElement('keywords-result');
            window.UIUtils.hideElement('keywords-auto-progress');
            
            // 清除运行状态
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.updateGenerateButtonState();
            
            // 节点完成后显示总览
            this.showOverview(true);
            
            window.UIUtils.showToast('关键词生成完成，请确认后点击"一键查找"继续', 'success');
        } catch (error) {
            console.error('生成关键词失败:', error);
            window.UIUtils.showToast('生成关键词失败: ' + (error.message || '未知错误'), 'error');
            this.updateNodeState(1, 'pending');
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.updateGenerateButtonState();
            window.UIUtils.hideElement('keywords-auto-progress');
        }
    },

    // 一键查找（文献查找子项目：执行节点2-4，跳过节点1）
    async startLiteratureSearch() {
        console.log('[startLiteratureSearch] ========== START LITERATURE SEARCH CALLED ==========');
        
        // 检查节点1是否已完成
        const node1Completed = this.state.nodeStates[1] === 'completed' || 
                              (this.state.keywords && this.state.keywords.length > 0);
        if (!node1Completed) {
            window.UIUtils.showToast('请先点击"生成关键词"并确认关键词', 'error');
            return;
        }
        
        // 从项目配置中读取API Key
        const apiProvider = this.getCurrentApiProvider();
        const apiKey = this.state.apiKeys && this.state.apiKeys[apiProvider] ? 
                      this.state.apiKeys[apiProvider] : 
                      (this.state.projectData.config && this.state.projectData.config.apiKeys && 
                       this.state.projectData.config.apiKeys[apiProvider] ? 
                       this.state.projectData.config.apiKeys[apiProvider] : null);
        
        if (!apiKey) {
            window.UIUtils.showToast('请先在项目配置中添加API Key', 'error');
            return;
        }
        
        // 检查是否有已保存的内容（节点2-4）
        const hasLiterature = this.state.allLiterature && this.state.allLiterature.length > 0;
        const hasSelectedLiterature = this.state.selectedLiterature && this.state.selectedLiterature.length > 0;
        
        if (hasLiterature || hasSelectedLiterature) {
            const contentList = [];
            if (hasLiterature) {
                contentList.push(`• 搜索到的文献 (${this.state.allLiterature.length}篇)`);
            }
            if (hasSelectedLiterature) {
                contentList.push(`• 已筛选的文献 (${this.state.selectedLiterature.length}篇)`);
            }
            
            const contentText = contentList.join('\n');
            const confirmMessage = `⚠️ 警告：检测到当前子项目已有以下内容：\n\n${contentText}\n\n⚠️ 一键查找将清空节点2-4的内容并重新开始！\n\n此操作不可撤销，确定要继续吗？`;
            
            const confirmed = confirm(confirmMessage);
            if (!confirmed) {
                window.UIUtils.showToast('已取消一键查找', 'info');
                return;
            }
        }
        
        // 清空节点2-4的UI内容（保留节点1的关键词）
        console.log('[startLiteratureSearch] Clearing nodes 2-4 UI content...');
        const searchResultsList = document.getElementById('search-results-list');
        if (searchResultsList) searchResultsList.innerHTML = '';
        const searchCount = document.getElementById('search-count');
        if (searchCount) searchCount.textContent = '0';
        const searchResults = document.getElementById('search-results');
        if (searchResults) searchResults.style.display = 'none';
        
        const filterResultsList = document.getElementById('filter-results-list');
        if (filterResultsList) filterResultsList.innerHTML = '';
        
        // 清空节点2-4的数据（保留节点1）
        await this.saveNodeData(2, { searchResults: {} });
        await this.saveNodeData(3, { allLiterature: [] });
        await this.saveNodeData(4, { selectedLiterature: [] });
        
        // 清空state中的节点2-4数据（保留关键词）
        this.state.searchResults = {};
        this.state.allLiterature = [];
        this.state.selectedLiterature = [];
        
        // 设置运行状态（从节点2开始）
        this.state.globalApiKey = apiKey;
        this.state.apiProvider = apiProvider;
        this.state.runningState = 'auto';
        this.state.autoNodeIndex = 2; // 从节点2开始
        this.state.shouldStop = false;
        
        // 更新按钮显示
        const startBtn = document.getElementById('start-literature-search-btn');
        const generateKeywordsBtn = document.getElementById('generate-keywords-btn');
        const stopBtn = document.getElementById('stop-auto-generate-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (generateKeywordsBtn) generateKeywordsBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'block';
        
        // 显示进度对话框
        this.showLiteratureSearchProgressModal();
        
        // 运行中只显示"运行中"三个字
        const overviewContainer = document.getElementById('overview-container');
        const nodeContentContainer = document.getElementById('node-content-container');
        const emptyPanel = document.getElementById('node-content-empty');
        
        if (overviewContainer) {
            overviewContainer.style.display = 'none';
        }
        if (nodeContentContainer) {
            nodeContentContainer.style.display = 'none';
        }
        if (emptyPanel) {
            emptyPanel.style.display = 'block';
            emptyPanel.innerHTML = '<div style="text-align: center; padding: 100px 20px; font-size: 24px; color: #666;">运行中</div>';
        }
        
        this.updateNodeStates();
        
        // 开始执行（从节点2开始）
        this.updateProgressModal(2, 0, '准备开始...', '进行中');
        await this.executeNextNode();
        console.log('[startLiteratureSearch] executeNextNode completed');
    },

    // 显示文献查找进度对话框
    showLiteratureSearchProgressModal() {
        const modal = document.getElementById('literature-search-progress-modal');
        if (modal) {
            // 确保对话框使用flex布局并居中显示
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            
            // 重置所有节点的进度状态
            for (let i = 2; i <= 4; i++) {
                this.updateProgressModal(i, 0, '等待中...', '等待中');
            }
            
            // 绑定关闭按钮事件
            const closeBtn = document.getElementById('close-progress-modal-btn');
            if (closeBtn && !closeBtn.hasAttribute('data-event-bound')) {
                closeBtn.setAttribute('data-event-bound', 'true');
                closeBtn.addEventListener('click', () => {
                    // 只有在没有运行任务时才能关闭
                    if (this.state.runningState === null) {
                        this.hideLiteratureSearchProgressModal();
                    } else {
                        window.UIUtils.showToast('任务正在运行中，无法关闭', 'error');
                    }
                });
            }
            
            // 绑定停止按钮事件
            const stopBtn = document.getElementById('stop-progress-btn');
            if (stopBtn && !stopBtn.hasAttribute('data-event-bound')) {
                stopBtn.setAttribute('data-event-bound', 'true');
                stopBtn.addEventListener('click', () => {
                    this.stopAutoGenerate();
                });
            }
        }
    },

    // 隐藏文献查找进度对话框
    hideLiteratureSearchProgressModal() {
        const modal = document.getElementById('literature-search-progress-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    },

    // 更新进度对话框中的节点进度
    updateProgressModal(nodeNum, percentage, text, status) {
        const fillEl = document.getElementById(`progress-node-${nodeNum}-fill`);
        const textEl = document.getElementById(`progress-node-${nodeNum}-text`);
        const statusEl = document.getElementById(`progress-node-${nodeNum}-status`);
        
        if (fillEl) fillEl.style.width = `${percentage}%`;
        if (textEl) textEl.textContent = text || '';
        if (statusEl) {
            statusEl.textContent = status || '等待中';
            if (status === '进行中') {
                statusEl.style.color = '#3b82f6';
            } else if (status === '已完成') {
                statusEl.style.color = '#10b981';
            } else if (status === '失败') {
                statusEl.style.color = '#ef4444';
            } else {
                statusEl.style.color = '#6b7280';
            }
        }
    },

    // 停止生成（支持停止一键生成和手动运行节点）
    stopAutoGenerate() {
        if (this.state.runningState === null) {
            // 没有正在运行的任务
            return;
        }

        // 设置停止标志（必须在清除状态之前设置，这样节点执行中的检查才能生效）
        this.state.shouldStop = true;
        
        // 获取当前运行的节点编号（在清除状态之前获取）
        const runningNode = this.state.currentRunningNode;
        const runningType = this.state.runningState;
        
        // 更新进度对话框（如果正在运行文献查找）
        if (this.state.currentSubprojectType === 'literatureSearch' && runningNode >= 2 && runningNode <= 4) {
            this.updateProgressModal(runningNode, 0, '正在停止...', '失败');
        }

        // 注意：不要立即清除runningState，让节点执行中的检查能够检测到shouldStop
        // 节点执行完成后会自动清除状态

        // 更新当前节点的状态为pending（如果正在执行）
        if (runningNode > 0 && runningNode <= 5) {
            if (this.state.nodeStates[runningNode] === 'active') {
                this.updateNodeState(runningNode, 'pending');
            }
        } else {
            // 如果没有明确的节点编号，检查所有active状态的节点
            for (let i = 1; i <= 5; i++) {
                if (this.state.nodeStates[i] === 'active') {
                    this.updateNodeState(i, 'pending');
                }
            }
        }

        // 恢复所有节点的显示（停止后显示所有节点）
        for (let i = 1; i <= 5; i++) {
            const node = document.getElementById(`node-${i}`);
            if (node) {
                node.style.display = 'block';
            }
        }

        // 显示停止提示
        if (runningType === 'auto') {
            window.UIUtils.showToast('已停止一键生成', 'info');
        } else if (runningType === 'manual') {
            window.UIUtils.showToast(`已停止节点${runningNode}的运行`, 'info');
        } else {
            window.UIUtils.showToast('已停止运行', 'info');
        }
    },

    // 执行下一个节点
    async executeNextNode() {
        console.log('[executeNextNode] ========== EXECUTE NEXT NODE CALLED ==========');
        console.log('[executeNextNode] Current state:', {
            autoNodeIndex: this.state.autoNodeIndex,
            shouldStop: this.state.shouldStop,
            runningState: this.state.runningState
        });
        
        // 检查是否应该停止
        if (this.state.shouldStop) {
            console.log('[executeNextNode] Should stop flag is true, exiting');
            // 清除运行状态
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.runningState = null;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
            return;
        }

        try {
            console.log('[executeNextNode] Entering switch statement, autoNodeIndex:', this.state.autoNodeIndex);
            switch(this.state.autoNodeIndex) {
                case 1:
                    console.log('[executeNextNode] Case 1: Calling autoExecuteNode1...');
                    this.state.currentRunningNode = 1; // 更新当前运行的节点
                    await this.autoExecuteNode1();
                    console.log('[executeNextNode] autoExecuteNode1 completed');
                    if (this.state.shouldStop) {
                        console.log('[executeNextNode] Should stop after node 1, returning');
                        return;
                    }
                    this.state.autoNodeIndex = 2;
                    this.state.currentRunningNode = 2; // 更新当前运行的节点
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
                    try {
                        this.state.currentRunningNode = 2; // 更新当前运行的节点
                        await this.autoExecuteNode2();
                        // 检查是否搜索到文献（如果autoExecuteNode2抛出错误，这里不会执行）
                        if (!this.state.allLiterature || this.state.allLiterature.length === 0) {
                            console.log('[executeNextNode] 节点2未搜索到文献，停止执行');
                            this.state.runningState = null;
                            this.state.currentRunningNode = 0;
                            this.state.autoNodeIndex = 0;
                            this.updateGenerateButtonState();
                            return;
                        }
                    } catch (error) {
                        // 如果节点2执行失败或未搜索到文献，停止执行
                        console.error('[executeNextNode] 节点2执行失败:', error);
                        // 如果是用户停止，不显示错误提示
                        if (error.message === '用户停止了执行') {
                            console.log('[executeNextNode] 节点2被用户停止');
                            this.state.runningState = null;
                            this.state.currentRunningNode = 0;
                            this.state.autoNodeIndex = 0;
                            this.updateGenerateButtonState();
                            // 关闭进度对话框
                            if (this.state.currentSubprojectType === 'literatureSearch') {
                                setTimeout(() => {
                                    this.hideLiteratureSearchProgressModal();
                                }, 1000);
                            }
                            return;
                        }
                        // 如果是未搜索到文献的错误，更新进度对话框并关闭
                        if (error.message === '节点2未搜索到文献，停止执行') {
                            console.log('[executeNextNode] 节点2未搜索到文献，停止执行');
                            this.updateProgressModal(2, 0, '未搜索到文献，已停止', '失败');
                            this.state.runningState = null;
                            this.state.currentRunningNode = 0;
                            this.state.autoNodeIndex = 0;
                            this.updateGenerateButtonState();
                            // 延迟关闭进度对话框，让用户看到错误信息
                            if (this.state.currentSubprojectType === 'literatureSearch') {
                                setTimeout(() => {
                                    this.hideLiteratureSearchProgressModal();
                                }, 2000);
                            }
                            return;
                        }
                        // 其他错误
                        this.updateProgressModal(2, 0, `搜索失败: ${error.message || '未知错误'}`, '失败');
                        this.state.runningState = null;
                        this.state.currentRunningNode = 0;
                        this.state.autoNodeIndex = 0;
                        this.updateGenerateButtonState();
                        // 延迟关闭进度对话框
                        if (this.state.currentSubprojectType === 'literatureSearch') {
                            setTimeout(() => {
                                this.hideLiteratureSearchProgressModal();
                            }, 2000);
                        }
                        return;
                    }
                    if (this.state.shouldStop) return;
                    this.state.autoNodeIndex = 3;
                    this.state.currentRunningNode = 3; // 更新当前运行的节点
                    this.updateProgressModal(3, 0, '准备开始...', '进行中');
                    window.UIUtils.showToast('节点2完成，开始执行节点3：文献补全...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            this.executeNextNode();
                        }
                    }, 1000);
                    break;
                case 3:
                    try {
                        this.state.currentRunningNode = 3; // 更新当前运行的节点
                        await this.autoExecuteNode3();
                    } catch (error) {
                        if (error.message === '用户停止了执行') {
                            console.log('[executeNextNode] 节点3被用户停止');
                            this.updateProgressModal(3, 0, '已停止', '失败');
                            this.state.runningState = null;
                            this.state.currentRunningNode = 0;
                            this.state.autoNodeIndex = 0;
                            this.updateGenerateButtonState();
                            // 关闭进度对话框
                            if (this.state.currentSubprojectType === 'literatureSearch') {
                                setTimeout(() => {
                                    this.hideLiteratureSearchProgressModal();
                                }, 1000);
                            }
                            return;
                        }
                        throw error;
                    }
                    if (this.state.shouldStop) return;
                    this.state.autoNodeIndex = 4;
                    this.state.currentRunningNode = 4; // 更新当前运行的节点
                    this.updateProgressModal(4, 0, '准备开始...', '进行中');
                    window.UIUtils.showToast('节点3完成，2秒后自动开始精选文献...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            window.UIUtils.showToast('开始执行节点4：精选文献...', 'info');
                            this.executeNextNode();
                        }
                    }, 2000);
                    break;
                case 4:
                    try {
                        this.state.currentRunningNode = 4; // 更新当前运行的节点
                        await this.autoExecuteNode4();
                    } catch (error) {
                        if (error.message === '用户停止了执行') {
                            console.log('[executeNextNode] 节点4被用户停止');
                            this.updateProgressModal(4, 0, '已停止', '失败');
                            this.state.runningState = null;
                            this.state.currentRunningNode = 0;
                            this.state.autoNodeIndex = 0;
                            this.updateGenerateButtonState();
                            // 关闭进度对话框
                            if (this.state.currentSubprojectType === 'literatureSearch') {
                                setTimeout(() => {
                                    this.hideLiteratureSearchProgressModal();
                                }, 1000);
                            }
                            return;
                        }
                        throw error;
                    }
                    if (this.state.shouldStop) return;
                    
                    // 检查是否是文献查找子项目，如果是则停止（只执行节点1-4）
                    const subprojectType = this.state.currentSubprojectType;
                    if (subprojectType === 'literatureSearch') {
                        // 文献查找子项目：节点4完成后结束
                        this.updateProgressModal(4, 100, '所有节点执行完成！', '已完成');
                        window.UIUtils.showToast('所有节点执行完成！', 'success');
                        this.state.runningState = null;
                        this.state.currentRunningNode = 0;
                        this.state.autoNodeIndex = 0;
                        this.updateGenerateButtonState();
                        console.log('[executeNextNode] 文献查找完成，刷新项目数据...');
                        await this.refreshProjectData();
                        console.log('[executeNextNode] 项目数据刷新完成');
                        
                        // 延迟关闭对话框，让用户看到完成状态
                        setTimeout(() => {
                            this.hideLiteratureSearchProgressModal();
                        }, 2000);
                        return;
                    }
                    
                    // 综述撰写子项目：继续执行节点5
                    this.state.autoNodeIndex = 5;
                    this.state.currentRunningNode = 5; // 更新当前运行的节点
                    window.UIUtils.showToast('节点4完成，2秒后自动开始综述撰写...', 'success');
                    setTimeout(() => {
                        if (!this.state.shouldStop) {
                            window.UIUtils.showToast('开始执行节点5：综述撰写...', 'info');
                            this.executeNextNode();
                        }
                    }, 2000);
                    break;
                case 5:
                    this.state.currentRunningNode = 5; // 更新当前运行的节点
                    await this.autoExecuteNode5();
                    window.UIUtils.showToast('所有节点执行完成！', 'success');
                    // 清除运行状态
                    this.state.runningState = null;
                    this.state.currentRunningNode = 0;
                    this.state.autoNodeIndex = 0;
                    // 更新按钮显示状态
                    this.updateGenerateButtonState();
                    // 刷新项目数据，确保state中的数据与文件同步（不重置state，不改变视图）
                    console.log('[executeNextNode] 一键生成完成，刷新项目数据...');
                    await this.refreshProjectData();
                    console.log('[executeNextNode] 项目数据刷新完成');
                    // 根据子项目类型恢复节点显示（不要显示所有节点）
                    const subprojectType2 = this.state.currentSubprojectType;
                    if (subprojectType2) {
                        this.updateUIForSubprojectType(subprojectType2);
                    }
                    break;
                default:
                    this.state.runningState = null;
                    this.state.autoNodeIndex = 0;
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
            const failedNode = this.state.currentRunningNode || this.state.autoNodeIndex;
            console.error(`节点${failedNode}执行失败:`, error);
            window.UIUtils.showToast(`节点${failedNode}执行失败: ${error.message}`, 'error');
            this.state.runningState = null;
            this.state.autoNodeIndex = 0;
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

    // 隐藏所有节点的进度条（除了指定的节点）
    hideAllProgressBars(exceptNodeNum = null) {
        const progressBars = {
            1: 'keywords-auto-progress',
            2: 'search-progress',
            3: 'complete-progress',
            4: 'filter-progress',
            5: 'generate-progress'
        };
        
        for (let nodeNum = 1; nodeNum <= 5; nodeNum++) {
            if (nodeNum !== exceptNodeNum) {
                const progressId = progressBars[nodeNum];
                if (progressId) {
                    window.UIUtils.hideElement(progressId);
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

            // 隐藏页面上的进度条（现在不使用进度条）
            this.hideAllProgressBars(1);
            window.UIUtils.hideElement('keywords-auto-progress');
            window.UIUtils.hideElement('keywords-result');

            console.log('[Node 1] Calling Node1Keywords.execute...');
            console.log('[Node 1] Parameters:', {
                apiKeyExists: !!this.state.globalApiKey,
                apiKeyLength: this.state.globalApiKey ? this.state.globalApiKey.length : 0,
                requirementData: this.state.requirementData
            });
            
            const apiProvider = this.getCurrentApiProvider();
            const modelName = this.getCurrentModelName();
            const keywordsPlan = await window.Node1Keywords.execute(this.state.globalApiKey, this.state.requirementData, apiProvider, modelName);
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

            // 完成时更新进度条，显示统计信息
            const keywordsCount = keywordsPlan.length;
            const totalPapers = keywordsPlan.reduce((sum, item) => sum + (item.count || 0), 0);
            const statistics = {
                keywordsCount: keywordsCount,
                totalPapers: totalPapers,
                summary: `共生成 ${keywordsCount} 个关键词，预计搜索 ${totalPapers} 篇文献`
            };
            // 关键词分析完成（不显示页面上的进度条）
            
            // 先更新状态为 completed，确保保存时状态正确
            this.updateNodeState(1, 'completed');
            
            console.log('[Node 1] Saving project data...');
            // 节点1保存自己的数据（keywordsPlan保存在node1中，保存时状态已经是 completed）
            await this.saveNodeData(1, {
                keywords: this.state.keywords,
                keywordsPlan: this.state.requirementData.keywordsPlan || [],
                statistics: statistics
            });
            console.log('[Node 1] Project data saved successfully');
            console.log('[Node 1] Final state:', {
                keywordsPlanLength: this.state.requirementData.keywordsPlan.length,
                keywordsLength: this.state.keywords.length,
                keywordsPlan: this.state.requirementData.keywordsPlan
            });
            console.log('[Node 1] ========== NODE 1 EXECUTION COMPLETED ==========');
            
            // 节点完成后显示总览
            this.showOverview(true);
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
            // 失败时保持active状态，不改为completed
            this.updateNodeState(1, 'active');
            throw error; // 重新抛出错误，让上层处理
        }
    },

    async autoExecuteNode2() {
        this.updateNodeState(2, 'active');
        // 运行中不显示节点内容，保持显示"运行中"

        // 隐藏搜索参数设置部分和按钮（自动执行时只显示文献列表）
        const searchParamsSection = document.getElementById('search-params-section');
        if (searchParamsSection) {
            searchParamsSection.style.display = 'none';
        }
        const searchBtn = document.getElementById('search-literature-btn');
        if (searchBtn) {
            searchBtn.style.display = 'none';
        }

        // 隐藏页面上的进度条（现在使用独立的进度对话框）
        this.hideAllProgressBars(2);
        window.UIUtils.hideElement('search-progress');
        window.UIUtils.hideElement('search-results');

        // 定义进度回调函数（只更新进度对话框，不更新页面上的进度条）
        const onProgress = (current, total, keyword, status) => {
            const percentage = Math.round((current / total) * 100);
            // 显示具体进度：关键词 1/2
            const progressText = `关键词 ${current}/${total}`;
            
            // 只更新进度对话框
            this.updateProgressModal(2, percentage, progressText, '进行中');
        };

        try {
            // 获取文献来源配置
            const literatureSource = this.state.currentSubproject?.config?.literatureSource || 
                                    document.getElementById('literature-source-select')?.value || 
                                    'google-scholar';
            
            const result = await window.Node2Search.execute(
                this.state.keywords,
                this.state.requirementData.keywordsPlan,
                this.state.requirementData.targetCount,
                onProgress,
                literatureSource
            );

            // 检查是否被停止
            if (this.state.shouldStop) {
                console.log('[autoExecuteNode2] 检测到停止信号，停止节点2执行');
                // 被停止时保持active状态，不改为pending
                this.updateNodeState(2, 'active');
                // 清除运行状态
                this.state.runningState = null;
                this.state.currentRunningNode = 0;
                this.state.autoNodeIndex = 0;
                this.updateGenerateButtonState();
                throw new Error('用户停止了执行');
            }

            this.state.searchResults = result.searchResults;
            this.state.allLiterature = result.allLiterature;

            // 检查是否搜索到文献
            if (!result.allLiterature || result.allLiterature.length === 0) {
                // 没有搜索到文献，保持active状态，允许用户重新尝试
                window.UIUtils.updateProgress(
                    'search-progress',
                    'search-progress-fill',
                    'search-progress-text',
                    100,
                    '搜索完成，但未找到任何文献'
                );
                
                // 保持节点状态为active，而不是completed
                this.updateNodeState(2, 'active');
                // 节点2只保存自己的数据（searchResults），不保存 allLiterature（那是节点3的数据）
                await this.saveNodeData(2, {
                    searchResults: this.state.searchResults,
                    status: 'active' // 明确保存为active状态
                });
                
                // 保存是否为自动生成状态（在停止之前）
                const wasAutoGenerating = this.isAutoGenerating();
                
                // 停止自动生成流程
                this.state.runningState = null;
                this.state.autoNodeIndex = 0;
                this.state.shouldStop = true;
                
                // 更新按钮显示状态
                const startBtn = document.getElementById('start-auto-generate-btn');
                const stopBtn = document.getElementById('stop-auto-generate-btn');
                if (startBtn) startBtn.style.display = 'block';
                if (stopBtn) stopBtn.style.display = 'none';
                
                // 一键生成时，只显示进度条，不显示详细结果
                if (wasAutoGenerating) {
                    // 保持进度条显示，不显示搜索结果区域
                    window.UIUtils.hideElement('search-results');
                } else {
                    // 手动执行时，显示搜索结果区域，让用户可以看到失败信息
                    window.UIUtils.showElement('search-results');
                    const searchResultsList = document.getElementById('search-results-list');
                    if (searchResultsList) {
                        searchResultsList.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">未找到任何文献，请检查关键词或网络连接后点击"重新搜索文献"按钮重试</p>';
                    }
                }
                
                window.UIUtils.showToast('节点2未搜索到文献，已停止后续流程。请检查关键词或网络连接后重试。', 'error');
                throw new Error('节点2未搜索到文献，停止执行');
            }

            // 完成时显示统计信息（只更新进度对话框，不更新页面上的进度条）
            const foundCount = result.allLiterature.length;
            const uniqueCount = new Set(result.allLiterature.map(lit => lit.title?.toLowerCase().trim())).size;
            const withAbstract = result.allLiterature.filter(lit => lit.abstract && lit.abstract.trim()).length;
            const statistics = {
                foundCount: foundCount,
                uniqueCount: uniqueCount,
                withAbstract: withAbstract,
                summary: `共找到 ${foundCount} 篇文献（去重后 ${uniqueCount} 篇，其中 ${withAbstract} 篇有摘要）`
            };

            // 只更新进度对话框
            this.updateProgressModal(2, 100, `搜索完成！${statistics.summary}`, '已完成');

            // 成功完成并保存数据后，才设置为completed
            this.updateNodeState(2, 'completed');
            // 节点2只保存自己的数据（searchResults），不保存 allLiterature（那是节点3的数据）
            await this.saveNodeData(2, {
                searchResults: this.state.searchResults,
                statistics: statistics
            });
            
            // 节点完成后显示总览
            this.showOverview(true);
        } catch (error) {
            // 如果错误不是"未搜索到文献"或"用户停止了执行"，说明是其他错误
            if (error.message !== '节点2未搜索到文献，停止执行' && error.message !== '用户停止了执行') {
                console.error('节点2执行失败:', error);
                // 失败时保持active状态，不改为completed
                this.updateNodeState(2, 'active');
                // 更新进度对话框显示错误
                this.updateProgressModal(2, 0, `搜索失败: ${error.message || '未知错误'}`, '失败');
            }
            throw error; // 重新抛出错误，让上层处理
        }
    },

    async autoExecuteNode3() {
        this.updateNodeState(3, 'active');
        // 运行中不显示节点内容，保持显示"运行中"
        
        // 只显示节点3的内容，隐藏其他所有节点
        for (let i = 1; i <= 5; i++) {
            if (i === 3) continue; // 跳过节点3
            const nodeContent = document.getElementById(`content-node-${i}`);
            if (nodeContent) {
                nodeContent.style.display = 'none';
                nodeContent.classList.remove('active');
                const nodeBody = document.getElementById(`node-body-${i}`);
                if (nodeBody) {
                    nodeBody.style.display = 'none';
                }
            }
        }

        // 隐藏页面上的进度条（现在不使用进度条）
        this.hideAllProgressBars(3);
        window.UIUtils.hideElement('complete-progress');
        window.UIUtils.hideElement('complete-results');

        // 定义进度回调函数（只更新进度对话框，不更新页面上的进度条）
        const onProgress = (current, total, title, status) => {
            const percentage = Math.round((current / total) * 100);
            // 显示具体进度：文献 1/10
            const progressText = `文献 ${current}/${total}`;
            // 只更新进度对话框
            this.updateProgressModal(3, percentage, progressText, '进行中');
        };

        try {
            // 获取文献来源配置
            const literatureSource = this.state.currentSubproject?.config?.literatureSource || 
                                    document.getElementById('literature-source-select')?.value || 
                                    'google-scholar';
            
            const { completed, total, successCount, failCount } = await window.Node3Complete.execute(
                this.state.globalApiKey, 
                this.state.allLiterature,
                onProgress,
                literatureSource
            );

            // 检查是否被停止
            if (this.state.shouldStop) {
                console.log('[autoExecuteNode3] 检测到停止信号，停止节点3执行');
                // 被停止时保持active状态，不改为pending
                this.updateNodeState(3, 'active');
                // 清除运行状态
                this.state.runningState = null;
                this.state.currentRunningNode = 0;
                this.state.autoNodeIndex = 0;
                this.updateGenerateButtonState();
                throw new Error('用户停止了执行');
            }

            // 完成时显示统计信息（只更新进度对话框，不更新页面上的进度条）
            const totalCount = this.state.allLiterature.length;
            const completionRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0;
            const statistics = {
                totalCount: totalCount,
                successCount: successCount,
                failCount: failCount,
                completionRate: completionRate,
                summary: `总计 ${totalCount} 篇，成功 ${successCount} 篇，失败 ${failCount} 篇（完成率 ${completionRate}%）`
            };

            // 只更新进度对话框
            this.updateProgressModal(3, 100, `补全完成！${statistics.summary}`, '已完成');

            // 成功完成并保存数据后，才设置为completed
            this.updateNodeState(3, 'completed');
            // 节点3只保存自己的数据（补全后的文献）
            await this.saveNodeData(3, {
                allLiterature: this.state.allLiterature,
                statistics: statistics
            });
            
            // 完成后处理（一键生成时隐藏结果，手动执行时显示结果）
            if (this.isAutoGenerating()) {
                // 一键生成时，不显示详细结果
                window.UIUtils.hideElement('complete-results');
            } else {
                // 手动执行时，显示完整结果
                window.UIUtils.hideElement('complete-progress');
                window.UIUtils.showElement('complete-results');
                const saveBtn = document.getElementById('save-completion-btn');
                const regenerateBtn = document.getElementById('regenerate-completion-btn');
                if (saveBtn) saveBtn.style.display = 'inline-block';
                if (regenerateBtn) regenerateBtn.style.display = 'block';
                
                // 显示补全结果
                window.Node3Complete.display(this.state.allLiterature);
            }
            
            // 更新总览
            this.updateOverview();
            
            // 节点完成后显示总览
            this.showOverview(true);
            
            window.UIUtils.showToast(`文献补全完成，成功: ${successCount}篇, 失败: ${failCount}篇`, 'success');
        } catch (error) {
            console.error('节点3执行失败:', error);
            // 失败时保持active状态，不改为completed
            this.updateNodeState(3, 'active');
            // 更新进度对话框显示错误
            this.updateProgressModal(3, 0, `补全失败: ${error.message || '未知错误'}`, '失败');
            throw error; // 重新抛出错误，让上层处理
        }
    },

    async autoExecuteNode4() {
        this.updateNodeState(4, 'active');
        // 运行中不显示节点内容，保持显示"运行中"

        // 隐藏页面上的进度条（现在不使用进度条）
        this.hideAllProgressBars(4);
        window.UIUtils.hideElement('filter-progress');
        window.UIUtils.hideElement('filter-results-list');
        // 隐藏统计卡片和导出按钮
        window.UIUtils.hideElement('filter-statistics-container');
        const exportBtn = document.getElementById('export-excel-btn');
        if (exportBtn) {
            exportBtn.style.display = 'none';
        }

        // 定义进度回调函数（只更新进度对话框，不更新页面上的进度条）
        const onProgress = (current, total, title, status) => {
            const percentage = Math.round((current / total) * 100);
            // 显示具体进度：文献 1/10
            const progressText = `文献 ${current}/${total}`;
            
            // 只更新进度对话框
            this.updateProgressModal(4, percentage, progressText, '进行中');
        };

        try {
            const apiProvider = this.getCurrentApiProvider();
            const modelName = this.getCurrentModelName();
            const result = await window.Node4Filter.execute(
                this.state.globalApiKey,
                this.state.allLiterature,
                this.state.requirementData.requirement,
                this.state.requirementData.targetCount,
                onProgress,
                apiProvider,
                modelName
            );

            // 检查是否被停止
            if (this.state.shouldStop) {
                console.log('[autoExecuteNode4] 检测到停止信号，停止节点4执行');
                // 被停止时保持active状态，不改为pending
                this.updateNodeState(4, 'active');
                throw new Error('用户停止了执行');
            }

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

            // 完成时显示筛选结果统计（只更新进度对话框，不更新页面上的进度条）
            const selectedCount = this.state.selectedLiterature.length;
            const totalCount = this.state.allLiterature.length;
            const unselectedCount = totalCount - selectedCount;
            const selectionRate = totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0;
            const statistics = {
                totalCount: totalCount,
                selectedCount: selectedCount,
                unselectedCount: unselectedCount,
                selectionRate: selectionRate,
                summary: `共 ${totalCount} 篇文献，AI推荐 ${selectedCount} 篇，未推荐 ${unselectedCount} 篇（推荐率 ${selectionRate}%）`
            };

            // 只更新进度对话框
            this.updateProgressModal(4, 100, `筛选完成！${statistics.summary}`, '已完成');

            this.updateNodeState(4, 'completed');
            // 节点4只保存自己的数据
            await this.saveNodeData(4, {
                selectedLiterature: this.state.selectedLiterature,
                statistics: statistics
            });
            
            // 节点完成后显示总览
            this.showOverview(true);
            
            // 一键查找完成后，虽然显示总览，但要确保当用户点击节点4时能正常显示文献列表
            // 不在这里隐藏 filter-results-list，让 loadNodeData(4) 来处理显示逻辑
            
            // 更新总览
            this.updateOverview();
            
            window.UIUtils.showToast(`文献筛选完成，已选: ${this.state.selectedLiterature.length}篇`, 'success');
        } catch (error) {
            console.error('节点4执行失败:', error);
            // 失败时保持active状态，不改为completed
            this.updateNodeState(4, 'active');
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
            // 即使失败，也要确保UI正确显示（加载节点数据）
            this.loadNodeData(4);
            // 重新抛出错误，让上层catch处理
            throw error;
        }
    },

    // 保存搜索结果（节点2）
    async saveSearchResults() {
        try {
            // 保存节点2的搜索结果（使用标准节点格式）
            await this.saveNodeData(2, {
                searchResults: this.state.searchResults || {}
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
            // 保存节点3的补全结果（使用标准节点格式）
            await this.saveNodeData(3, {
                allLiterature: this.state.allLiterature
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
            // 保存节点3和节点4的数据（使用标准节点格式）
            await this.saveNodeData(3, {
                allLiterature: this.state.allLiterature
            });
            await this.saveNodeData(4, {
                selectedLiterature: this.state.selectedLiterature
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
            // 清空节点4的数据
            await this.saveNodeData(4, {
                selectedLiterature: []
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

            // 设置手动运行状态
            this.state.runningState = 'manual';
            this.state.currentRunningNode = 4;
            this.state.shouldStop = false;
            this.updateGenerateButtonState();
            
            // 重新执行节点4
            await this.autoExecuteNode4();
            
            // 清除运行状态
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
            
            // 完成后重新加载节点数据以显示结果
            this.loadNodeData(4);
            
            // 更新总览
            this.updateOverview();

            window.UIUtils.showToast('文献精选完成', 'success');
        } catch (error) {
            console.error('重新精选文献失败:', error);
            window.UIUtils.showToast(`重新精选失败: ${error.message || '未知错误'}`, 'error');
            // 即使出错，也要确保按钮状态正确
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
            
            // 出错后重新加载节点数据
            this.loadNodeData(4);
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

            // 保存清空后的状态（使用节点数据格式）
            await this.saveNodeData(3, {
                allLiterature: this.state.allLiterature
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

            // 设置手动运行状态
            this.state.runningState = 'manual';
            this.state.currentRunningNode = 3;
            this.state.shouldStop = false;
            this.updateGenerateButtonState();
            
            // 重新执行节点3
            await this.autoExecuteNode3();
            
            // 清除运行状态
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
            
            // 完成后重新加载节点数据以显示结果
            this.loadNodeData(3);

            window.UIUtils.showToast('文献补全完成', 'success');
        } catch (error) {
            console.error('重新补全文献失败:', error);
            window.UIUtils.showToast(`重新补全失败: ${error.message || '未知错误'}`, 'error');
            // 即使出错，也要确保按钮状态正确
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
        }
    },

    // 重新生成关键词（节点1）
    async regenerateKeywords() {
        // 检查是否有大纲
        if (!this.state.requirementData.outline) {
            window.UIUtils.showToast('请先完成需求分析', 'error');
            return;
        }

        // 检查节点1、2、3、4、5是否有数据
        const hasNode1Data = this.state.requirementData.keywordsPlan && this.state.requirementData.keywordsPlan.length > 0;
        const hasNode2Data = this.state.searchResults && Object.keys(this.state.searchResults).length > 0;
        const hasNode3Data = this.state.allLiterature && this.state.allLiterature.length > 0;
        const hasNode4Data = this.state.selectedLiterature && this.state.selectedLiterature.length > 0;
        const hasNode5Data = this.state.reviewContent && this.state.reviewContent.trim().length > 0;
        const hasExistingData = hasNode1Data || hasNode2Data || hasNode3Data || hasNode4Data || hasNode5Data;
        
        if (hasExistingData) {
            const confirmMessage = '重新分析节点1将清空以下内容：\n\n' +
                                 '• 节点1：关键词列表\n' +
                                 '• 节点2：搜索结果\n' +
                                 '• 节点3：补全的文献\n' +
                                 '• 节点4：筛选的文献\n' +
                                 '• 节点5：生成的综述\n\n' +
                                 '同时会将节点1、2、3、4、5的状态重置为"待开始"（节点1将变为"进行中"）。\n\n' +
                                 '是否继续？';
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

        try {
            // 先将节点1的状态设置为active（正在重新分析）
            this.state.nodeStates[1] = 'active';
            // 将节点2、3、4、5的状态重置为pending（必须在saveNodeData之前设置）
            this.state.nodeStates[2] = 'pending';
            this.state.nodeStates[3] = 'pending';
            this.state.nodeStates[4] = 'pending';
            this.state.nodeStates[5] = 'pending';
            
            // 节点1重新分析时，先清空JSON中节点1、2、3、4、5的数据（status会自动更新）
            await this.saveNodeData(1, {
                keywords: undefined,
                keywordsPlan: undefined
            });
            await this.saveNodeData(2, {
                searchResults: undefined,
                allLiterature: undefined
            });
            await this.saveNodeData(3, {
                allLiterature: undefined
            });
            await this.saveNodeData(4, {
                selectedLiterature: undefined
            });
            await this.saveNodeData(5, {
                reviewContent: undefined
            });
            
            // 然后清空state中的数据
            this.state.requirementData.keywordsPlan = [];
            this.state.keywords = [];
            this.state.searchResults = {};
            this.state.allLiterature = [];
            this.state.selectedLiterature = [];
            this.state.reviewContent = '';
            
            // 更新节点状态显示
            this.updateNodeState(1, 'active');
            this.updateNodeState(2, 'pending');
            this.updateNodeState(3, 'pending');
            this.updateNodeState(4, 'pending');
            this.updateNodeState(5, 'pending');
            
            // 清空节点1的UI显示
            const keywordsList = document.getElementById('keywords-list');
            if (keywordsList) {
                keywordsList.innerHTML = '';
            }
            
            // 清空节点2的UI显示
            const searchResultsList = document.getElementById('search-results-list');
            if (searchResultsList) {
                searchResultsList.innerHTML = '';
            }
            const searchCount = document.getElementById('search-count');
            if (searchCount) {
                searchCount.textContent = '0';
            }
            
            // 清空节点3的UI显示
            const completeResultsList = document.getElementById('complete-results-list');
            if (completeResultsList) {
                completeResultsList.innerHTML = '';
            }
            const completeCount = document.getElementById('complete-count');
            if (completeCount) {
                completeCount.textContent = '0';
            }
            
            // 清空节点4的UI显示
            const filterResultsList = document.getElementById('filter-results-list');
            if (filterResultsList) {
                filterResultsList.innerHTML = '';
            }
            const selectedList = document.getElementById('selected-list');
            if (selectedList) {
                selectedList.innerHTML = '';
            }
            
            // 清空节点5的UI显示
            const reviewContent = document.getElementById('review-content');
            if (reviewContent) {
                reviewContent.value = '';
            }
            
            // 隐藏节点2、3、4、5的相关UI元素
            window.UIUtils.hideElement('search-results');
            window.UIUtils.hideElement('complete-results');
            window.UIUtils.hideElement('filter-results');
            const saveSearchBtn = document.getElementById('save-search-results-btn');
            const regenerateNode2Btn = document.getElementById('regenerate-node2-btn');
            const saveCompletionBtn = document.getElementById('save-completion-btn');
            const regenerateCompletionBtn = document.getElementById('regenerate-completion-btn');
            const saveFilterBtn = document.getElementById('save-filter-btn');
            const regenerateFilterBtn = document.getElementById('regenerate-filter-btn');
            if (saveSearchBtn) saveSearchBtn.style.display = 'none';
            if (regenerateNode2Btn) regenerateNode2Btn.style.display = 'none';
            if (saveCompletionBtn) saveCompletionBtn.style.display = 'none';
            if (regenerateCompletionBtn) regenerateCompletionBtn.style.display = 'none';
            if (saveFilterBtn) saveFilterBtn.style.display = 'none';
            if (regenerateFilterBtn) regenerateFilterBtn.style.display = 'none';
            
            // 更新总览显示
            this.updateOverview();
            
            // 运行中只显示"运行中"三个字
            const overviewContainer = document.getElementById('overview-container');
            const nodeContentContainer = document.getElementById('node-content-container');
            const emptyPanel = document.getElementById('node-content-empty');
            
            if (overviewContainer) {
                overviewContainer.style.display = 'none';
            }
            if (nodeContentContainer) {
                nodeContentContainer.style.display = 'none';
            }
            if (emptyPanel) {
                emptyPanel.style.display = 'block';
                emptyPanel.innerHTML = '<div style="text-align: center; padding: 100px 20px; font-size: 24px; color: #666;">运行中</div>';
            }
            
            // 禁用按钮
            const regenerateBtn = document.getElementById('regenerate-keywords-btn');
            if (regenerateBtn) {
                regenerateBtn.disabled = true;
                regenerateBtn.textContent = '正在分析...';
            }

            // 隐藏页面上的进度条（现在不使用进度条）
            window.UIUtils.hideElement('keywords-auto-progress');
            window.UIUtils.hideElement('keywords-result');

            // 设置手动运行状态
            this.state.runningState = 'manual';
            this.state.currentRunningNode = 1;
            this.state.shouldStop = false;
            this.updateGenerateButtonState();
            
            // 获取查找配置
            let searchConfig = {};
            if (this.state.currentSubproject && this.state.currentSubproject.config) {
                const config = this.state.currentSubproject.config;
                searchConfig = {
                    literatureSource: config.literatureSource || 'google-scholar',
                    yearLimit: config.yearLimit || { recentYears: 5, percentage: 60 }
                };
            } else {
                // 从UI读取
                const literatureSource = document.getElementById('literature-source-select')?.value || 'google-scholar';
                const recentYears = parseInt(document.getElementById('recent-years-input')?.value || '5', 10);
                const recentYearsPercentage = parseInt(document.getElementById('recent-years-percentage')?.value || '60', 10);
                searchConfig = {
                    literatureSource: literatureSource,
                    yearLimit: {
                        recentYears: recentYears,
                        percentage: recentYearsPercentage
                    }
                };
            }
            
            // 执行关键词分析
            const apiProvider = this.getCurrentApiProvider();
            const modelName = this.getCurrentModelName();
            const keywordsPlan = await window.Node1Keywords.execute(
                apiKey, 
                this.state.requirementData, 
                apiProvider, 
                modelName,
                searchConfig
            );

            // 验证返回结果
            if (!keywordsPlan || !Array.isArray(keywordsPlan) || keywordsPlan.length === 0) {
                throw new Error('关键词分析返回结果为空或格式错误');
            }

            // 更新状态数据
            this.state.requirementData.keywordsPlan = keywordsPlan;
            this.state.keywords = keywordsPlan.map(item => item.keyword);
            this.state.globalApiKey = apiKey;

            // 关键词分析完成（不显示页面上的进度条）

            // 更新节点状态
            this.updateNodeState(1, 'completed');

            // 保存数据
            // 节点1保存自己的数据（keywordsPlan保存在node1中）
            await this.saveNodeData(1, {
                keywords: this.state.keywords,
                keywordsPlan: this.state.requirementData.keywordsPlan || []
            });

            // 显示结果（编辑模式）
            window.Node1Keywords.display(this.state.requirementData.keywordsPlan, true);
            window.UIUtils.showElement('keywords-result');
            window.UIUtils.hideElement('keywords-auto-progress');

            // 显示按钮
            if (regenerateBtn) {
                regenerateBtn.style.display = 'inline-block';
            }

            // 清除运行状态
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
            
            // 节点完成后显示总览
            this.showOverview(true);
            
            window.UIUtils.showToast('关键词分析完成', 'success');
        } catch (error) {
            console.error('关键词分析失败:', error);
            window.UIUtils.showToast(`关键词分析失败: ${error.message || '未知错误'}`, 'error');
            // 即使出错，也要确保按钮状态正确
            this.state.runningState = null;
            this.state.currentRunningNode = 0;
            this.state.autoNodeIndex = 0;
            this.updateGenerateButtonState();
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
        const state = this.state;
        
        // 根据子项目类型获取文献列表
        let literatureToUse = [];
        let outlineToUse = '';
        let requirementToUse = '';
        
        if (state.currentSubprojectType === 'reviewWriting') {
            // 撰写子项目：使用子项目中的完整文献列表
            literatureToUse = state.currentSubproject?.literature || [];
            if (literatureToUse.length === 0) {
                window.UIUtils.showToast('没有可用的文献，请先关联文献查找子项目', 'error');
                return;
            }
            
            // 从 node5 中获取大纲和要求（撰写子项目的大纲只从 node5 中读取，不从 project.json 读取）
            outlineToUse = state.currentSubproject?.node5?.outline || '';
            requirementToUse = state.currentSubproject?.node5?.outlineRequirement || '';
            
            if (!outlineToUse || outlineToUse.trim().length === 0) {
                window.UIUtils.showToast('请先生成大纲', 'error');
                return;
            }
        } else {
            // 文献查找子项目：使用已选文献
            literatureToUse = state.selectedLiterature || [];
            if (literatureToUse.length === 0) {
                window.UIUtils.showToast('请先选择文献', 'error');
                return;
            }
            
            outlineToUse = state.requirementData.outline || '';
            requirementToUse = state.requirementData.requirement || '';
        }

        // 检查是否已有综述内容
        const hasExistingContent = this.state.reviewContent && this.state.reviewContent.trim().length > 0;
        if (hasExistingContent) {
            const confirmed = confirm('当前已存在综述内容，重新生成将覆盖现有内容。\n\n是否继续？');
            if (!confirmed) {
                return;
            }
        }

        // 获取API Key（使用和生成大纲相同的逻辑）
        const apiProvider = this.getCurrentApiProvider();
        let apiKeyToUse = '';
        
        if (state.currentSubprojectType === 'reviewWriting') {
            // 撰写子项目：从项目配置中读取API Key
            apiKeyToUse = (state.apiKeys && state.apiKeys[apiProvider]) || 
                         (state.projectData.config && state.projectData.config.apiKeys && state.projectData.config.apiKeys[apiProvider]) ||
                         this.state.globalApiKey ||
                         '';
        } else {
            // 文献查找子项目：从输入框或globalApiKey读取
            apiKeyToUse = window.UIUtils.getValue('main-api-key-input') || this.state.globalApiKey || '';
        }
        
        // 检查API Key
        if (!apiKeyToUse) {
            window.UIUtils.showToast('请先在项目配置中添加API Key', 'error');
            return;
        }

        try {
            // 隐藏生成按钮，显示进度条
            const generateBtn = document.getElementById('generate-review-btn');
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = '正在生成...';
            }

            // 隐藏页面上的进度条（现在不使用进度条）
            window.UIUtils.hideElement('generate-progress');
            window.UIUtils.hideElement('review-result');

            // 获取综述要求（可选）
            const reviewRequirement = window.UIUtils.getValue('review-requirement-input') || '';
            
            // 获取每章字数要求（可选）
            const chapterWordCountInput = document.getElementById('chapter-word-count-input');
            const chapterWordCount = chapterWordCountInput && chapterWordCountInput.value 
                ? parseInt(chapterWordCountInput.value, 10) 
                : null;
            
            // 构建 requirementData 对象
            const requirementDataForReview = {
                outline: outlineToUse,
                requirement: requirementToUse,
                reviewRequirement: reviewRequirement, // 额外的综述要求
                chapterWordCount: chapterWordCount, // 每章字数要求
                language: state.requirementData.language || 'zh',
                literatureMapping: state.currentSubproject?.node5?.literatureMapping || []
            };

            // 显示正在生成模态框
            const generatingModal = document.getElementById('generating-review-modal');
            if (generatingModal) {
                generatingModal.style.display = 'flex';
            }

            // 执行生成（使用和生成大纲相同的API供应商和模型）
            const modelName = this.getCurrentModelName();
            
            try {
                this.state.reviewContent = await window.Node5Review.execute(
                    apiKeyToUse,
                    literatureToUse,
                    requirementDataForReview,
                    apiProvider,
                    modelName
                );
            } finally {
                // 隐藏正在生成模态框
                if (generatingModal) {
                    generatingModal.style.display = 'none';
                }
            }

            // 综述生成完成（不显示页面上的进度条）

            // 解析综述中的文献引用顺序，重新整理文献
            let reorderedLiterature = literatureToUse;
            if (window.Node5Review && window.Node5Review.parseCitationOrder) {
                reorderedLiterature = window.Node5Review.parseCitationOrder(this.state.reviewContent, [...literatureToUse]);
                console.log('[generateReview] 文献重新排序完成，引用顺序:', reorderedLiterature.map(lit => ({
                    title: lit.title,
                    initialIndex: lit.initialIndex,
                    actualIndex: lit.actualIndex
                })));
            }

            // 如果是撰写子项目，更新文献列表和 selectedLiterature
            if (state.currentSubprojectType === 'reviewWriting') {
                this.state.selectedLiterature = reorderedLiterature;
                
                // 更新子项目中的文献列表（按真正编号排序）
                if (state.currentSubproject) {
                    state.currentSubproject.literature = reorderedLiterature;
                    
                    // 保存更新后的文献列表到子项目JSON
                    await window.SubprojectManager.updateSubproject(
                        state.currentProject,
                        state.currentSubprojectId,
                        {
                            literature: reorderedLiterature
                        }
                    );
                }
            }

            // 显示结果
            window.Node5Review.display(this.state.reviewContent, reorderedLiterature);
            window.UIUtils.showElement('review-result');

            // 更新节点状态
            this.updateNodeState(5, 'completed');

            // 保存数据到子项目的 node5 中
            await this.saveNodeData(5, {
                reviewContent: this.state.reviewContent
            });

            // 节点完成后显示总览（仅文献查找子项目）
            if (state.currentSubprojectType !== 'reviewWriting') {
                this.showOverview(true);
            }

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

        // 隐藏页面上的进度条（现在不使用进度条）
        this.hideAllProgressBars(5);
        window.UIUtils.hideElement('generate-progress');
        window.UIUtils.hideElement('review-result');
        
        // 再次确保隐藏（防止showNodeContent重新显示）
        window.UIUtils.hideElement('selected-literature-summary');
        if (generateBtn) {
            generateBtn.style.display = 'none';
        }

        try {
            const apiProvider = this.getCurrentApiProvider();
            const modelName = this.getCurrentModelName();
            this.state.reviewContent = await window.Node5Review.execute(
                this.state.globalApiKey,
                this.state.selectedLiterature,
                this.state.requirementData,
                apiProvider,
                modelName
            );

            // 检查是否被停止
            if (this.state.shouldStop) {
                console.log('[autoExecuteNode5] 检测到停止信号，停止节点5执行');
                // 被停止时保持active状态，不改为pending
                this.updateNodeState(5, 'active');
                throw new Error('用户停止了执行');
            }

            // 完成时计算统计信息（不显示页面上的进度条）
            const reviewLength = this.state.reviewContent ? this.state.reviewContent.length : 0;
            const selectedLitCount = this.state.selectedLiterature ? this.state.selectedLiterature.length : 0;
            const wordCount = reviewLength > 0 ? Math.round(reviewLength / 2) : 0; // 粗略估算字数（中文字符数/2）
            const statistics = {
                selectedLitCount: selectedLitCount,
                wordCount: wordCount,
                reviewLength: reviewLength,
                summary: `基于 ${selectedLitCount} 篇精选文献，生成约 ${wordCount} 字综述（${reviewLength} 字符）`
            };

            // 先更新状态为 completed，确保保存时状态正确
            this.updateNodeState(5, 'completed');
            
            // 节点5只保存自己的数据（保存时状态已经是 completed）
            await this.saveNodeData(5, {
                reviewContent: this.state.reviewContent,
                statistics: statistics
            });
            
            // 完成后只显示进度条和统计信息（一键生成时）
            if (this.isAutoGenerating()) {
                // 一键生成时，只显示进度条，不显示详细结果
                // 进度条已经在上面更新了，保持显示即可
                // 不显示已选文献列表和综述内容
                window.UIUtils.hideElement('selected-literature-summary');
                window.UIUtils.hideElement('review-result');
            } else {
                // 手动执行时，显示完整结果
                // 显示已选文献列表
                if (this.state.selectedLiterature && this.state.selectedLiterature.length > 0) {
                    window.UIUtils.showElement('selected-literature-summary');
                    window.Node5Review.displaySelectedLiterature(this.state.selectedLiterature);
                }
                // 显示综述内容
                if (this.state.reviewContent) {
                    window.UIUtils.showElement('review-result');
                    window.Node5Review.display(this.state.reviewContent, this.state.selectedLiterature);
                }
            }
        } catch (error) {
            console.error('节点5执行失败:', error);
            // 失败时保持active状态，不改为completed
            this.updateNodeState(5, 'active');
            // 生成失败（不显示页面上的进度条）
            throw error; // 重新抛出错误，让上层处理
        }
    },

    // 保存文献查找子项目的配置
    async saveLiteratureSearchConfig() {
        try {
            const state = this.state;
            
            // 检查是否是文献查找子项目
            if (state.currentSubprojectType !== 'literatureSearch') {
                window.UIUtils.showToast('当前不是文献查找子项目', 'error');
                return;
            }

            if (!state.currentProject || !state.currentSubprojectId) {
                window.UIUtils.showToast('未选择项目或子项目', 'error');
                return;
            }

            // 收集配置数据
            const apiProvider = document.getElementById('main-api-provider-select')?.value || state.apiProvider || 'deepseek';
            const requirement = document.getElementById('main-requirement-input')?.value || '';
            const literatureSource = document.getElementById('literature-source-select')?.value || 'google-scholar';
            const targetCount = parseInt(document.getElementById('main-target-count')?.value || '50', 10);
            const recentYears = parseInt(document.getElementById('recent-years-input')?.value || '5', 10);
            const recentYearsPercentage = parseInt(document.getElementById('recent-years-percentage')?.value || '60', 10);
            const language = document.getElementById('main-language-select')?.value || 'zh';

            // 获取模型选择（根据API供应商）
            let modelConfig = {};
            if (apiProvider === 'gemini') {
                modelConfig.geminiModel = this.getGeminiModel();
            } else if (apiProvider === 'siliconflow') {
                modelConfig.siliconflowModel = this.getSiliconFlowModel();
            } else if (apiProvider === 'poe') {
                modelConfig.poeModel = this.getPoeModel();
            }

            // 构建配置对象
            const config = {
                apiProvider: apiProvider,
                ...modelConfig,
                requirement: requirement,
                literatureSource: literatureSource,
                targetCount: targetCount,
                yearLimit: {
                    recentYears: recentYears,
                    percentage: recentYearsPercentage
                },
                language: language
            };

            // 更新state
            state.apiProvider = apiProvider;
            state.requirementData.requirement = requirement;
            state.requirementData.targetCount = targetCount;
            state.requirementData.language = language;
            if (modelConfig.geminiModel) state.geminiModel = modelConfig.geminiModel;
            if (modelConfig.siliconflowModel) state.siliconflowModel = modelConfig.siliconflowModel;
            if (modelConfig.poeModel) state.poeModel = modelConfig.poeModel;

            // 保存到子项目数据中
            const subprojectUpdates = {
                config: config,
                updatedAt: new Date().toISOString()
            };

            await window.SubprojectManager.updateSubproject(
                state.currentProject,
                state.currentSubprojectId,
                subprojectUpdates
            );

            // 更新state中的子项目对象
            state.currentSubproject = {
                ...state.currentSubproject,
                ...subprojectUpdates
            };

            window.UIUtils.showToast('配置已保存', 'success');
        } catch (error) {
            console.error('保存配置失败:', error);
            window.UIUtils.showToast('保存配置失败: ' + (error.message || '未知错误'), 'error');
        }
    },

    // 加载文献查找子项目的配置
    loadLiteratureSearchConfig() {
        try {
            const state = this.state;
            
            // 检查是否是文献查找子项目
            if (state.currentSubprojectType !== 'literatureSearch') {
                return;
            }

            if (!state.currentSubproject) {
                return;
            }

            // 获取配置，如果不存在则使用默认值
            const config = state.currentSubproject.config || {
                apiProvider: 'deepseek',
                requirement: '',
                literatureSource: 'google-scholar',
                targetCount: 50,
                yearLimit: {
                    recentYears: 5,
                    percentage: 60
                },
                language: 'zh'
            };

            // 加载API供应商（使用默认值 'deepseek'）
            const apiProvider = config.apiProvider || 'deepseek';
            const providerSelect = document.getElementById('main-api-provider-select');
            if (providerSelect) {
                providerSelect.value = apiProvider;
                this.state.apiProvider = apiProvider;
                this.updateApiProviderUI();
            }

            // 加载模型选择（根据API供应商）
            if (config.geminiModel) {
                const geminiModelSelect = document.getElementById('gemini-model-select');
                if (geminiModelSelect) {
                    geminiModelSelect.value = config.geminiModel;
                    this.state.geminiModel = config.geminiModel;
                }
            }
            if (config.siliconflowModel) {
                const siliconflowModelSelect = document.getElementById('siliconflow-model-select');
                if (siliconflowModelSelect) {
                    siliconflowModelSelect.value = config.siliconflowModel;
                    this.state.siliconflowModel = config.siliconflowModel;
                }
            }
            if (config.poeModel) {
                const poeModelSelect = document.getElementById('poe-model-select');
                if (poeModelSelect) {
                    poeModelSelect.value = config.poeModel;
                    this.state.poeModel = config.poeModel;
                }
            }

            // 加载需求描述（即使为空字符串也要设置）
            const requirement = config.requirement !== undefined ? config.requirement : '';
            const requirementInput = document.getElementById('main-requirement-input');
            if (requirementInput) {
                requirementInput.value = requirement;
                this.state.requirementData.requirement = requirement;
            }

            // 加载文献来源库（使用默认值 'google-scholar'）
            const literatureSource = config.literatureSource || 'google-scholar';
            const sourceSelect = document.getElementById('literature-source-select');
            if (sourceSelect) {
                sourceSelect.value = literatureSource;
            }

            // 加载文献数量（使用默认值 50）
            const targetCount = config.targetCount !== undefined ? config.targetCount : 50;
            const targetCountInput = document.getElementById('main-target-count');
            if (targetCountInput) {
                targetCountInput.value = targetCount;
                this.state.requirementData.targetCount = targetCount;
            }

            // 加载年份限制（使用默认值）
            const yearLimit = config.yearLimit || { recentYears: 5, percentage: 60 };
            const recentYearsInput = document.getElementById('recent-years-input');
            const recentYearsPercentageInput = document.getElementById('recent-years-percentage');
            if (recentYearsInput) {
                recentYearsInput.value = yearLimit.recentYears !== undefined ? yearLimit.recentYears : 5;
            }
            if (recentYearsPercentageInput) {
                recentYearsPercentageInput.value = yearLimit.percentage !== undefined ? yearLimit.percentage : 60;
            }

            // 加载语言（使用默认值 'zh'）
            const language = config.language || 'zh';
            const languageSelect = document.getElementById('main-language-select');
            if (languageSelect) {
                languageSelect.value = language;
                this.state.requirementData.language = language;
            }
            
            // 加载配置后更新按钮状态
            this.updateGenerateButtonState();
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }
};

// 注意：closeNodeContent 已废弃，不再导出

