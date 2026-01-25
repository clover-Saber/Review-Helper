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
            console.log('[electronAPI.searchGoogleScholar] 调用 IPC，参数:', { keyword, limit, minYear });
            return ipcRenderer.invoke('search-google-scholar', keyword, limit, minYear).then(response => {
                console.log('[electronAPI.searchGoogleScholar] IPC 响应:', {
                    type: typeof response,
                    isArray: Array.isArray(response),
                    hasSuccess: response?.success !== undefined,
                    hasResults: response?.results !== undefined,
                    error: response?.error
                });
                return response;
            }).catch(error => {
                console.error('[electronAPI.searchGoogleScholar] IPC 调用失败:', error);
                throw error;
            });
        } else {
            console.error('[electronAPI.searchGoogleScholar] window.require 不存在，无法调用 IPC');
            return Promise.reject(new Error('Electron环境未初始化'));
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
    // 引用格式抓取（GB/T、APA、BibTeX等）
    fetchCitationFormats: (citeUrl) => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            return ipcRenderer.invoke('fetch-citation-formats', citeUrl);
        } else {
            console.error('[electronAPI.fetchCitationFormats] window.require 不存在，无法调用 IPC');
            return Promise.resolve({ success: false, error: 'Electron环境未初始化', formats: null });
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
    // 从URL提取文献信息：打开URL获取HTML源代码，然后将HTML源代码发送给大模型提取信息
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
    // 注意：switchToWorkflow 已移除，请使用 switchToLiteratureSearchWorkflow 或 switchToReviewWritingWorkflow
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
            console.log('showInputDialog 被调用，options:', options);
            
            const modal = document.getElementById('input-dialog-modal');
            const titleEl = document.getElementById('input-dialog-title');
            const labelEl = document.getElementById('input-dialog-label');
            const inputEl = document.getElementById('input-dialog-input');
            const okBtn = document.getElementById('input-dialog-ok');
            const cancelBtn = document.getElementById('input-dialog-cancel');
            
            console.log('模态框元素检查:', {
                modal: !!modal,
                titleEl: !!titleEl,
                labelEl: !!labelEl,
                inputEl: !!inputEl,
                okBtn: !!okBtn,
                cancelBtn: !!cancelBtn
            });
            
            if (!modal || !inputEl) {
                console.error('输入对话框元素未找到', { modal: !!modal, inputEl: !!inputEl });
                resolve(null);
                return;
            }
            
            // 清理之前的事件监听器（如果存在）
            if (modal._inputDialogHandlers) {
                console.log('清理之前的事件监听器');
                const handlers = modal._inputDialogHandlers;
                if (okBtn && handlers.handleOk) okBtn.removeEventListener('click', handlers.handleOk);
                if (cancelBtn && handlers.handleCancel) cancelBtn.removeEventListener('click', handlers.handleCancel);
                if (inputEl && handlers.handleKeyDown) inputEl.removeEventListener('keydown', handlers.handleKeyDown);
                if (handlers.handleBackgroundClick) modal.removeEventListener('click', handlers.handleBackgroundClick);
            }
            
            // 设置标题和标签
            if (titleEl) titleEl.textContent = options?.title || '输入';
            if (labelEl) labelEl.textContent = options?.message || '请输入:';
            if (inputEl) {
                inputEl.value = options?.defaultValue || '';
                inputEl.placeholder = options?.placeholder || '请输入...';
            }
            
            // 显示模态框 - 移除hidden类并设置display
            modal.classList.remove('hidden');
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';
            
            console.log('显示输入对话框，模态框状态:', {
                display: modal.style.display,
                hasHidden: modal.classList.contains('hidden'),
                hasShow: modal.classList.contains('show'),
                computedDisplay: window.getComputedStyle(modal).display,
                computedVisibility: window.getComputedStyle(modal).visibility,
                computedOpacity: window.getComputedStyle(modal).opacity,
                zIndex: window.getComputedStyle(modal).zIndex
            });
            
            // 延迟focus确保模态框已显示
            setTimeout(() => {
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                }
            }, 100);
            
            // 确定按钮处理
            const handleOk = () => {
                console.log('确定按钮被点击');
                const value = inputEl ? inputEl.value.trim() : '';
                console.log('输入的值:', value);
                modal.classList.add('hidden');
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                if (okBtn) okBtn.removeEventListener('click', handleOk);
                if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                if (inputEl) inputEl.removeEventListener('keydown', handleKeyDown);
                if (modal._inputDialogHandlers && modal._inputDialogHandlers.handleBackgroundClick) {
                    modal.removeEventListener('click', modal._inputDialogHandlers.handleBackgroundClick);
                }
                console.log('resolve 值:', value || null);
                resolve(value || null);
            };
            
            // 取消按钮处理
            const handleCancel = () => {
                console.log('取消按钮被点击');
                modal.classList.add('hidden');
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
                modal.style.display = 'none';
                if (okBtn) okBtn.removeEventListener('click', handleOk);
                if (cancelBtn) cancelBtn.removeEventListener('click', handleCancel);
                if (inputEl) inputEl.removeEventListener('keydown', handleKeyDown);
                if (modal._inputDialogHandlers && modal._inputDialogHandlers.handleBackgroundClick) {
                    modal.removeEventListener('click', modal._inputDialogHandlers.handleBackgroundClick);
                }
                console.log('resolve null');
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
            console.log('绑定模态框事件监听器');
            if (okBtn) {
                okBtn.addEventListener('click', handleOk);
                console.log('确定按钮事件已绑定');
            } else {
                console.error('确定按钮未找到！');
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', handleCancel);
                console.log('取消按钮事件已绑定');
            } else {
                console.error('取消按钮未找到！');
            }
            
            if (inputEl) {
                inputEl.addEventListener('keydown', handleKeyDown);
                console.log('输入框键盘事件已绑定');
            } else {
                console.error('输入框未找到！');
            }
            
            // 点击背景关闭
            const handleBackgroundClick = (e) => {
                if (e.target === modal) {
                    console.log('点击背景，关闭模态框');
                    handleCancel();
                }
            };
            modal.addEventListener('click', handleBackgroundClick);
            
            // 保存事件处理器以便清理
            modal._inputDialogHandlers = {
                handleOk,
                handleCancel,
                handleKeyDown,
                handleBackgroundClick
            };
            
            console.log('模态框已显示，等待用户输入');
        });
    }
};

