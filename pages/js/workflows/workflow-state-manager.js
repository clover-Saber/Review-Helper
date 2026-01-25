// 工作流状态管理器：管理全局状态和状态辅助方法
window.WorkflowStateManager = {
    // 状态管理
    state: {
        currentProject: null,
        projectData: {},
        currentNode: null,
        // 当前子项目相关状态
        currentSubprojectId: null,  // 当前子项目ID
        currentSubproject: null,    // 当前子项目对象
        currentSubprojectType: null, // 当前子项目类型：literatureSearch | reviewWriting
        nodeStates: {
            1: 'pending',
            2: 'pending',
            3: 'pending',
            4: 'pending',
            5: 'pending'
        },
        globalApiKey: '', // 当前使用的API Key（根据选择的供应商动态更新）
        apiKeys: {}, // 按供应商存储的API Keys: { deepseek: 'xxx', gemini: 'yyy', ... }
        apiProvider: 'deepseek', // 默认使用DeepSeek
        geminiModel: 'gemini-2.5-flash', // Gemini 模型选择
        siliconflowModel: 'Qwen/QwQ-32B', // 硅基流动模型选择
        poeModel: 'Claude-Sonnet-4', // Poe 模型选择
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
        shouldStop: false,
        googleScholarVerified: false,
        // 全局运行状态：null=未运行, 'auto'=一键生成, 'manual'=手动运行单个节点
        runningState: null,
        // 当前正在运行的节点编号（0表示未运行）
        currentRunningNode: 0,
        // 一键生成时的当前节点（仅在 runningState === 'auto' 时使用）
        autoNodeIndex: 0
    },

    // 状态辅助方法
    isAutoGenerating() {
        return this.state.runningState === 'auto';
    },
    
    isManualRunning() {
        return this.state.runningState === 'manual';
    },
    
    isRunning() {
        return this.state.runningState !== null;
    },
    
    getCurrentAutoNode() {
        return this.isAutoGenerating() ? this.state.autoNodeIndex : 0;
    },

    // 重置状态（用于重新打开项目）
    resetState() {
        this.state.requirementData = {
            requirement: '',
            targetCount: 50,
            outline: '',
            language: 'zh'
        };
        this.state.keywords = [];
        this.state.searchResults = {};
        this.state.allLiterature = [];
        this.state.selectedLiterature = [];
        this.state.reviewContent = '';
        this.state.nodeStates = {
            1: 'pending',
            2: 'pending',
            3: 'pending',
            4: 'pending',
            5: 'pending'
        };
        this.state.projectData = {};
        // 重置子项目状态
        this.state.currentSubprojectId = null;
        this.state.currentSubproject = null;
        this.state.currentSubprojectType = null;
    }
};
