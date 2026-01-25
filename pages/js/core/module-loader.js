// 模块加载器：统一管理模块加载顺序和依赖关系

window.ModuleLoader = {
    // 模块定义：定义所有模块及其依赖关系
    modules: {
        // 核心模块（无依赖）
        'core/electron-api': {
            path: 'js/core/electron-api.js',
            dependencies: []
        },
        'core/api': {
            path: 'js/core/api.js',
            dependencies: ['core/electron-api']
        },
        'core/data-manager': {
            path: 'js/core/data-manager.js',
            dependencies: ['core/electron-api']
        },
        
        // 工具模块
        'utils/ui-utils': {
            path: 'js/utils/ui-utils.js',
            dependencies: []
        },
        'utils/dom-utils': {
            path: 'js/utils/dom-utils.js',
            dependencies: []
        },
        'utils/format-utils': {
            path: 'js/utils/format-utils.js',
            dependencies: []
        },
        
        // 管理器模块
        'managers/subproject-manager': {
            path: 'js/managers/subproject-manager.js',
            dependencies: ['core/electron-api', 'core/data-manager']
        },
        'managers/requirement-manager': {
            path: 'js/managers/requirement-manager.js',
            dependencies: ['core/api', 'core/data-manager']
        },
        
        // 节点模块
        'nodes/node1-keywords': {
            path: 'js/nodes/node1-keywords.js',
            dependencies: ['core/api', 'core/data-manager', 'utils/ui-utils']
        },
        'nodes/node2-search': {
            path: 'js/nodes/node2-search.js',
            dependencies: ['core/api', 'core/electron-api', 'core/data-manager', 'utils/ui-utils']
        },
        'nodes/node3-complete': {
            path: 'js/nodes/node3-complete.js',
            dependencies: ['core/api', 'core/data-manager', 'utils/ui-utils']
        },
        'nodes/node4-filter': {
            path: 'js/nodes/node4-filter.js',
            dependencies: ['core/api', 'core/data-manager', 'utils/ui-utils']
        },
        'nodes/node5-review': {
            path: 'js/nodes/node5-review.js',
            dependencies: ['core/api', 'core/data-manager', 'utils/ui-utils']
        },
        
        // 工作流模块
        'workflows/workflow-state-manager': {
            path: 'js/workflows/workflow-state-manager.js',
            dependencies: []
        },
        'workflows/workflow-data-loader': {
            path: 'js/workflows/workflow-data-loader.js',
            dependencies: ['core/electron-api', 'core/data-manager', 'managers/subproject-manager']
        },
        'workflows/literature-search-workflow': {
            path: 'js/workflows/literature-search-workflow.js',
            dependencies: ['workflows/workflow-manager', 'workflows/workflow-data-loader']
        },
        'workflows/review-writing-workflow': {
            path: 'js/workflows/review-writing-workflow.js',
            dependencies: ['workflows/workflow-manager', 'workflows/workflow-data-loader', 'managers/requirement-manager']
        },
        'workflows/workflow-manager': {
            path: 'js/workflows/workflow-manager.js',
            dependencies: [
                'core/electron-api',
                'core/api',
                'core/data-manager',
                'utils/ui-utils',
                'managers/subproject-manager',
                'workflows/workflow-state-manager',
                'workflows/workflow-data-loader',
                'nodes/node1-keywords',
                'nodes/node2-search',
                'nodes/node3-complete',
                'nodes/node4-filter',
                'nodes/node5-review'
            ]
        },
        
        // 页面模块
        'pages/index': {
            path: 'js/pages/index.js',
            dependencies: ['core/electron-api', 'utils/ui-utils', 'core/data-manager', 'managers/subproject-manager']
        },
        'pages/project-detail': {
            path: 'js/pages/project-detail.js',
            dependencies: ['core/electron-api', 'core/api', 'utils/ui-utils', 'core/data-manager', 'managers/subproject-manager']
        },
        'pages/literature-search-workflow': {
            path: 'js/pages/literature-search-workflow.js',
            dependencies: ['workflows/workflow-manager']
        },
        'pages/review-writing-workflow': {
            path: 'js/pages/review-writing-workflow.js',
            dependencies: ['workflows/workflow-manager']
        }
    },
    
    // 已加载的模块
    loadedModules: new Set(),
    
    // 正在加载的模块
    loadingModules: new Set(),
    
    /**
     * 加载单个模块
     * @param {string} moduleId - 模块ID
     * @returns {Promise<void>}
     */
    async loadModule(moduleId) {
        // 如果已经加载，直接返回
        if (this.loadedModules.has(moduleId)) {
            return Promise.resolve();
        }
        
        // 如果正在加载，等待加载完成
        if (this.loadingModules.has(moduleId)) {
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (this.loadedModules.has(moduleId)) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 10);
            });
        }
        
        const module = this.modules[moduleId];
        if (!module) {
            console.warn(`[ModuleLoader] 模块未定义: ${moduleId}`);
            return Promise.resolve();
        }
        
        // 标记为正在加载
        this.loadingModules.add(moduleId);
        
        try {
            // 先加载所有依赖
            if (module.dependencies && module.dependencies.length > 0) {
                await Promise.all(
                    module.dependencies.map(dep => this.loadModule(dep))
                );
            }
            
            // 加载模块脚本
            await this.loadScript(module.path);
            
            // 标记为已加载
            this.loadedModules.add(moduleId);
            this.loadingModules.delete(moduleId);
            
            console.log(`[ModuleLoader] 模块加载成功: ${moduleId}`);
        } catch (error) {
            this.loadingModules.delete(moduleId);
            console.error(`[ModuleLoader] 模块加载失败: ${moduleId}`, error);
            throw error;
        }
    },
    
    /**
     * 动态加载脚本
     * @param {string} src - 脚本路径
     * @returns {Promise<void>}
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查脚本是否已经加载
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.async = false; // 保持同步加载顺序
            
            script.onload = () => {
                resolve();
            };
            
            script.onerror = () => {
                reject(new Error(`Failed to load script: ${src}`));
            };
            
            document.head.appendChild(script);
        });
    },
    
    /**
     * 批量加载模块
     * @param {string[]} moduleIds - 模块ID数组
     * @returns {Promise<void>}
     */
    async loadModules(moduleIds) {
        try {
            await Promise.all(
                moduleIds.map(moduleId => this.loadModule(moduleId))
            );
            console.log(`[ModuleLoader] 所有模块加载完成: ${moduleIds.join(', ')}`);
        } catch (error) {
            console.error('[ModuleLoader] 模块加载失败', error);
            throw error;
        }
    },
    
    /**
     * 检查模块是否已加载
     * @param {string} moduleId - 模块ID
     * @returns {boolean}
     */
    isLoaded(moduleId) {
        return this.loadedModules.has(moduleId);
    },
    
    /**
     * 获取模块的加载状态
     * @param {string} moduleId - 模块ID
     * @returns {string} 'loaded' | 'loading' | 'not-loaded'
     */
    getStatus(moduleId) {
        if (this.loadedModules.has(moduleId)) {
            return 'loaded';
        }
        if (this.loadingModules.has(moduleId)) {
            return 'loading';
        }
        return 'not-loaded';
    },
    
    /**
     * 预定义模块组合（用于不同页面）
     */
    presets: {
        // 项目列表页面
        'index': [
            'core/electron-api',
            'utils/ui-utils',
            'utils/dom-utils',
            'utils/format-utils',
            'core/data-manager',
            'managers/subproject-manager',
            'pages/index'
        ],
        
        // 项目详情页面
        'project-detail': [
            'core/electron-api',
            'core/api',
            'utils/ui-utils',
            'utils/dom-utils',
            'utils/format-utils',
            'core/data-manager',
            'managers/subproject-manager',
            'pages/project-detail'
        ],
        
        // 文献查找工作流页面
        'literature-search-workflow': [
            'core/electron-api',
            'core/api',
            'core/data-manager',
            'utils/ui-utils',
            'utils/dom-utils',
            'utils/format-utils',
            'nodes/node1-keywords',
            'nodes/node2-search',
            'nodes/node3-complete',
            'nodes/node4-filter',
            'managers/subproject-manager',
            'workflows/workflow-state-manager',
            'workflows/workflow-data-loader',
            'workflows/workflow-manager',
            'workflows/literature-search-workflow',
            'pages/literature-search-workflow'
        ],
        
        // 综述撰写工作流页面
        'review-writing-workflow': [
            'core/electron-api',
            'core/api',
            'core/data-manager',
            'utils/ui-utils',
            'utils/dom-utils',
            'utils/format-utils',
            'managers/requirement-manager',
            'nodes/node5-review',
            'managers/subproject-manager',
            'workflows/workflow-state-manager',
            'workflows/workflow-data-loader',
            'workflows/workflow-manager',
            'workflows/review-writing-workflow',
            'pages/review-writing-workflow'
        ]
    },
    
    /**
     * 使用预设加载模块
     * @param {string} presetName - 预设名称
     * @returns {Promise<void>}
     */
    async loadPreset(presetName) {
        const preset = this.presets[presetName];
        if (!preset) {
            throw new Error(`[ModuleLoader] 预设不存在: ${presetName}`);
        }
        
        console.log(`[ModuleLoader] 开始加载预设: ${presetName}`);
        await this.loadModules(preset);
        console.log(`[ModuleLoader] 预设加载完成: ${presetName}`);
    },
    
    /**
     * 重置加载状态（用于测试或重新加载）
     */
    reset() {
        this.loadedModules.clear();
        this.loadingModules.clear();
    }
};
