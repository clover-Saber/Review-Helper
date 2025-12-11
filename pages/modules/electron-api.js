// Electron API 统一模块
// 所有页面共享的 Electron IPC 通信接口

window.electronAPI = {
    // 项目数据管理
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
        } else {
            console.error('window.require 不存在，无法调用 loadProjectData');
            return Promise.resolve({ success: false, error: 'Electron环境未初始化', data: null });
        }
    },
    
    // 子项目文件管理
    saveSubprojects1: (projectName, subprojects) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('save-subprojects1', projectName, subprojects);
        }
        return Promise.resolve({ success: false, error: 'Electron环境未初始化' });
    },
    
    loadSubprojects1: (projectName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('load-subprojects1', projectName);
        }
        return Promise.resolve({ success: false, error: 'Electron环境未初始化', data: [] });
    },
    
    saveSubprojects2: (projectName, subprojects) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('save-subprojects2', projectName, subprojects);
        }
        return Promise.resolve({ success: false, error: 'Electron环境未初始化' });
    },
    
    loadSubprojects2: (projectName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('load-subprojects2', projectName);
        }
        return Promise.resolve({ success: false, error: 'Electron环境未初始化', data: [] });
    },
    listProjects: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('list-projects');
        } else {
            console.error('window.require 不存在，无法调用 listProjects');
            return Promise.resolve({ success: false, error: 'Electron环境未初始化', projects: [] });
        }
    },
    createProject: (projectName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('create-project', projectName);
        } else {
            console.error('window.require 不存在，无法调用 createProject');
            return Promise.resolve({ success: false, error: 'Electron环境未初始化' });
        }
    },
    deleteProject: (projectName) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('delete-project', projectName);
        }
    },
    
    // 当前项目管理
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
    
    // Google Scholar 相关
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
    // 烂番薯学术 相关
    searchLanfanshu: (keyword, limit, minYear, showWindowOnCaptcha = true) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('search-lanfanshu', keyword, limit, minYear, showWindowOnCaptcha);
        }
    },
    openLanfanshuLogin: (autoSearchKeyword = null, autoSearchLimit = 50) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('open-lanfanshu-login', autoSearchKeyword, autoSearchLimit);
        }
    },
    extractAbstractFromUrl: (url) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('extract-abstract-from-url', url);
        }
    },
    
    // 使用大模型从URL提取文献信息（作者、年份、期刊、摘要）
    extractLiteratureInfoFromUrl: (url, apiKey, apiProvider, modelName, options) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('extract-literature-info-from-url', url, apiKey, apiProvider, modelName, options);
        }
    },
    
    // 文件系统
    selectDirectory: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('select-directory');
        }
    },
    
    // 页面切换
    switchToWorkflow: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-workflow');
        }
    },
    switchToLiteratureSearchWorkflow: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-literature-search-workflow');
        }
    },
    switchToReviewWritingWorkflow: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-review-writing-workflow');
        }
    },
    switchToIndex: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-index');
        }
    },
    switchToProjectDetail: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-project-detail');
        }
    },
    switchToProjectList: () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('switch-to-project-list');
        } else {
            console.error('window.require 不存在，无法调用 switchToProjectList');
            return Promise.resolve({ success: false, error: 'Electron环境未初始化' });
        }
    },
    
    // 显示输入对话框（使用页面内的模态框）
    showInputDialog: (options) => {
        return new Promise((resolve) => {
            const modal = document.getElementById('input-dialog-modal');
            const titleEl = document.getElementById('input-dialog-title');
            const labelEl = document.getElementById('input-dialog-label');
            const inputEl = document.getElementById('input-dialog-input');
            const okBtn = document.getElementById('input-dialog-ok');
            const cancelBtn = document.getElementById('input-dialog-cancel');
            
            if (!modal || !inputEl) {
                console.error('输入对话框元素未找到');
                resolve(null);
                return;
            }
            
            // 设置标题和标签
            titleEl.textContent = options?.title || '输入';
            labelEl.textContent = options?.message || '请输入:';
            inputEl.value = options?.defaultValue || '';
            inputEl.placeholder = options?.placeholder || '请输入...';
            
            // 显示模态框
            modal.style.display = 'flex';
            inputEl.focus();
            inputEl.select();
            
            // 确定按钮处理
            const handleOk = () => {
                const value = inputEl.value.trim();
                modal.style.display = 'none';
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                inputEl.removeEventListener('keydown', handleKeyDown);
                resolve(value || null);
            };
            
            // 取消按钮处理
            const handleCancel = () => {
                modal.style.display = 'none';
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
                inputEl.removeEventListener('keydown', handleKeyDown);
                resolve(null);
            };
            
            // 键盘事件处理
            const handleKeyDown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOk();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancel();
                }
            };
            
            // 绑定事件
            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            inputEl.addEventListener('keydown', handleKeyDown);
            
            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            });
        });
    }
};

