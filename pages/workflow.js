// Electron IPC API (需要在DOMContentLoaded之前定义)
window.electronAPI = {
    saveProjectData: (projectName, data) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('save-project-data', projectName, data);
        }
    },
    loadProjectData: (projectName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('load-project-data', projectName);
        }
    },
    listProjects: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('list-projects');
        }
    },
    getCurrentProject: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('get-current-project');
        }
    },
    setCurrentProject: (projectName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('set-current-project', projectName);
        }
    },
    searchGoogleScholar: (keyword, limit, minYear) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('search-google-scholar', keyword, limit, minYear);
        }
    },
    openScholarLogin: (autoSearchKeyword = null, autoSearchLimit = 50) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('open-scholar-login', autoSearchKeyword, autoSearchLimit);
        }
    },
    extractAbstractFromUrl: (url) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('extract-abstract-from-url', url);
        }
    },
    selectDirectory: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('select-directory');
        }
    },
    switchToWorkflow: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-workflow');
        }
    },
    switchToIndex: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-index');
        }
    }
};

// 主入口：初始化工作流
document.addEventListener('DOMContentLoaded', function() {
    // 检查所有模块是否已加载
    if (!window.WorkflowManager) {
        console.error('WorkflowManager模块未加载');
        return;
    }

    // 初始化工作流管理器
    window.WorkflowManager.init();
});
