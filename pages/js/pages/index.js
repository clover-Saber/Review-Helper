console.log('脚本开始执行');

// 立即检查按钮是否存在（不等待DOMContentLoaded）
console.log('立即检查按钮:', document.getElementById('new-project-btn'));

// 全局函数：处理新建项目点击（用于onclick属性）
window.handleNewProjectClick = async function(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    console.log('handleNewProjectClick 被调用（onclick）');
    console.log('window.electronAPI 存在:', !!window.electronAPI);
    console.log('window.electronAPI:', window.electronAPI);
    console.log('window.electronAPI.createProject 存在:', !!(window.electronAPI && window.electronAPI.createProject));
    
    if (!window.electronAPI) {
        console.error('electronAPI 未定义');
        alert('系统初始化失败：electronAPI 未定义，请刷新页面重试');
        return;
    }
    
    if (!window.electronAPI.createProject) {
        console.error('createProject 方法不存在');
        console.log('electronAPI 的所有方法:', Object.keys(window.electronAPI));
        alert('创建项目功能不可用：createProject 方法不存在');
        return;
    }
    
    console.log('准备调用 showInputDialog 获取项目名称');
    const projectName = await window.electronAPI.showInputDialog({
        title: '新建项目',
        message: '请输入项目名称:',
        defaultValue: ''
    });
    console.log('showInputDialog 返回:', projectName);
    if (!projectName || !projectName.trim()) {
        console.log('用户取消输入项目名称');
        return;
    }
    const trimmedName = projectName.trim();
    console.log('项目名称（trim后）:', trimmedName);
    
    console.log('准备创建项目:', trimmedName);
    
    try {
        // 检查项目是否已存在
        console.log('检查项目是否存在...');
        const result = await window.electronAPI.loadProjectData(trimmedName);
        console.log('检查项目是否存在结果:', result);
        if (result && result.success && result.data) {
            const confirmed = confirm(`项目"${trimmedName}"已存在，是否要打开它？`);
            if (confirmed) {
                await window.electronAPI.setCurrentProject(trimmedName);
                if (window.electronAPI.switchToProjectDetail) {
                    await window.electronAPI.switchToProjectDetail();
                }
            }
            return;
        }
        
        // 创建新项目
        console.log('调用 createProject API...');
        const createResult = await window.electronAPI.createProject(trimmedName);
        console.log('createProject 返回结果:', createResult);
        
        if (createResult && createResult.success) {
            // 创建成功后直接打开项目，不显示确认框
            await window.electronAPI.setCurrentProject(trimmedName);
            if (window.electronAPI.switchToProjectDetail) {
                await window.electronAPI.switchToProjectDetail();
            }
        } else {
            const errorMsg = createResult?.error || '未知错误';
            console.error('创建项目失败:', errorMsg);
            alert('创建项目失败: ' + errorMsg);
        }
    } catch (error) {
        console.error('创建项目异常:', error);
        console.error('错误堆栈:', error.stack);
        alert('创建项目失败: ' + (error.message || '未知错误'));
    }
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded 事件触发');
    
    // DOM元素
    const newProjectBtn = document.getElementById('new-project-btn');
    console.log('按钮元素:', newProjectBtn);
    console.log('按钮类型:', typeof newProjectBtn);
    
    // 检查按钮是否存在
    if (!newProjectBtn) {
        console.error('新建项目按钮未找到！');
        console.log('当前页面HTML:', document.body.innerHTML.substring(0, 500));
        // 尝试用 querySelector
        const btnByQuery = document.querySelector('#new-project-btn');
        console.log('通过 querySelector 查找:', btnByQuery);
        return;
    }
    
    console.log('按钮已找到，准备绑定事件');
    console.log('按钮样式:', window.getComputedStyle(newProjectBtn));
    console.log('按钮是否可见:', newProjectBtn.offsetWidth > 0 && newProjectBtn.offsetHeight > 0);
    
    // 页面加载时自动恢复当前项目和加载项目列表
    // 注意：initCurrentProject 可能会自动切换页面，所以先加载项目列表
    loadProjectsList();
    
    // 延迟执行 initCurrentProject，确保用户能看到页面
    setTimeout(() => {
        initCurrentProject();
    }, 100);
    
    async function initCurrentProject() {
        if (!window.electronAPI) {
            return;
        }
        try {
            const { success, currentProject: cp } = await window.electronAPI.getCurrentProject();
            if (success && cp) {
                // 检查是否有当前子项目ID（从sessionStorage）
                const currentSubprojectId = sessionStorage.getItem('currentSubprojectId');
                if (currentSubprojectId) {
                    // 有当前项目和子项目，根据子项目类型切换到对应的工作流界面
                    try {
                        const subproject = await window.SubprojectManager.getSubprojectData(cp.name, currentSubprojectId);
                        if (subproject) {
                            if (subproject.type === 'literatureSearch') {
                                if (window.electronAPI.switchToLiteratureSearchWorkflow) {
                                    await window.electronAPI.switchToLiteratureSearchWorkflow();
                                }
                            } else if (subproject.type === 'reviewWriting') {
                                if (window.electronAPI.switchToReviewWritingWorkflow) {
                                    await window.electronAPI.switchToReviewWritingWorkflow();
                                }
                            }
                        }
                    } catch (e) {
                        console.error('获取子项目信息失败:', e);
                        // 如果获取失败，切换到项目详情页面
                        if (window.electronAPI.switchToProjectDetail) {
                            await window.electronAPI.switchToProjectDetail();
                        }
                    }
                } else {
                    // 如果没有子项目ID，但有当前项目，切换到项目详情页面
                    if (window.electronAPI.switchToProjectDetail) {
                        await window.electronAPI.switchToProjectDetail();
                    }
                }
            }
        } catch (e) {
            console.error('初始化当前项目失败:', e);
        }
    }

    async function askNewProjectName() {
        const name = await window.electronAPI.showInputDialog({
            title: '新建项目',
            message: '请输入项目名称:',
            defaultValue: ''
        });
        if (!name || !name.trim()) {
            return null;
        }
        return name.trim();
    }
    
    // 新建项目 - 实际处理函数（暴露到全局）
    window.handleNewProjectClickInternal = async function() {
        console.log('handleNewProjectClickInternal 被调用');
        console.log('window.electronAPI 存在:', !!window.electronAPI);
        console.log('window.electronAPI:', window.electronAPI);
        console.log('window.electronAPI.createProject 存在:', !!(window.electronAPI && window.electronAPI.createProject));
        console.log('window.require 存在:', !!window.require);
        
        if (!window.electronAPI) {
            console.error('electronAPI 未定义');
            alert('系统初始化失败：electronAPI 未定义，请刷新页面重试');
            return;
        }
        
        if (!window.electronAPI.createProject) {
            console.error('createProject 方法不存在');
            console.log('electronAPI 的所有方法:', Object.keys(window.electronAPI));
            alert('创建项目功能不可用：createProject 方法不存在');
            return;
        }
        
        console.log('准备调用 askNewProjectName');
        const projectName = await window.electronAPI.showInputDialog({
            title: '新建项目',
            message: '请输入项目名称:',
            defaultValue: ''
        });
        console.log('showInputDialog 返回:', projectName);
        if (!projectName || !projectName.trim()) {
            console.log('用户取消输入项目名称');
            return;
        }
        const trimmedName = projectName.trim();
        console.log('项目名称（trim后）:', trimmedName);
        
        console.log('准备创建项目:', trimmedName);
        
        try {
            // 检查项目是否已存在
            const result = await window.electronAPI.loadProjectData(trimmedName);
            console.log('检查项目是否存在结果:', result);
            if (result && result.success && result.data) {
                const confirmed = confirm(`项目"${trimmedName}"已存在，是否要打开它？`);
                if (confirmed) {
                    await window.electronAPI.setCurrentProject(trimmedName);
                    if (window.electronAPI.switchToProjectDetail) {
                        await window.electronAPI.switchToProjectDetail();
                    }
                }
                return;
            }
            
            // 创建新项目
            console.log('调用 createProject API...');
            const createResult = await window.electronAPI.createProject(trimmedName);
            console.log('createProject 返回结果:', createResult);
            
            if (createResult && createResult.success) {
                // 创建成功后直接打开项目，不显示确认框
                await window.electronAPI.setCurrentProject(trimmedName);
                if (window.electronAPI.switchToProjectDetail) {
                    await window.electronAPI.switchToProjectDetail();
                }
            } else {
                const errorMsg = createResult?.error || '未知错误';
                console.error('创建项目失败:', errorMsg);
                alert('创建项目失败: ' + errorMsg);
            }
        } catch (error) {
            console.error('创建项目异常:', error);
            console.error('错误堆栈:', error.stack);
            alert('创建项目失败: ' + (error.message || '未知错误'));
        }
    };
    
    // 新建项目 - 绑定事件监听器
    console.log('绑定新建项目按钮事件监听器');
    
    // 确保按钮可以点击
    if (newProjectBtn) {
        newProjectBtn.style.pointerEvents = 'auto';
        newProjectBtn.style.cursor = 'pointer';
        newProjectBtn.disabled = false;
        
        // 创建事件处理函数
        const handleNewProjectClick = async function(e) {
            console.log('按钮点击事件触发！', e);
            e.preventDefault();
            e.stopPropagation();
            console.log('addEventListener click 事件触发');
            try {
                await window.handleNewProjectClickInternal();
            } catch (error) {
                console.error('处理新建项目点击时出错:', error);
                alert('创建项目时出错: ' + (error.message || '未知错误'));
            }
        };
        
        // 绑定点击事件（使用capture: false确保在冒泡阶段处理）
        newProjectBtn.addEventListener('click', handleNewProjectClick, { capture: false, passive: false });
        
        // 测试按钮是否可点击
        console.log('按钮可点击性测试:', {
            pointerEvents: window.getComputedStyle(newProjectBtn).pointerEvents,
            cursor: window.getComputedStyle(newProjectBtn).cursor,
            disabled: newProjectBtn.disabled,
            offsetWidth: newProjectBtn.offsetWidth,
            offsetHeight: newProjectBtn.offsetHeight,
            zIndex: window.getComputedStyle(newProjectBtn).zIndex,
            display: window.getComputedStyle(newProjectBtn).display,
            visibility: window.getComputedStyle(newProjectBtn).visibility
        });
        
        console.log('按钮元素:', newProjectBtn);
        console.log('按钮父元素:', newProjectBtn.parentElement);
    } else {
        console.error('新建项目按钮未找到，无法绑定事件！');
    }
    
    // 加载项目列表
    async function loadProjectsList() {
        if (!window.electronAPI) {
            console.error('electronAPI 未定义');
            return;
        }
        try {
            console.log('开始加载项目列表...');
            const result = await window.electronAPI.listProjects();
            console.log('listProjects 返回结果:', result);
            if (result && result.success && result.projects) {
                // result.projects 是字符串数组（项目名称列表）
                displayProjectsList(result.projects);
            } else {
                document.getElementById('projects-grid').innerHTML = '<div class="no-projects">暂无项目</div>';
            }
        } catch (error) {
            console.error('加载项目列表失败:', error);
            document.getElementById('projects-grid').innerHTML = '<div class="error-projects">加载项目列表失败</div>';
        }
    }
    
    // 显示项目列表
    function displayProjectsList(projectNames) {
        // projectNames 是字符串数组（项目名称列表）
        if (!projectNames || projectNames.length === 0) {
            document.getElementById('projects-grid').innerHTML = '<div class="no-projects">暂无项目，点击"新建项目"创建第一个项目</div>';
            return;
        }
        
        const projectsGrid = document.getElementById('projects-grid');
        projectsGrid.innerHTML = '<div class="loading-projects">正在加载项目详情...</div>';
        
        // 等待所有项目数据加载完成
        Promise.all(projectNames.map(async (projectName) => {
            const data = await window.electronAPI.loadProjectData(projectName);
            return { name: projectName, data: data && data.success ? data.data : null };
        })).then(projectsWithData => {
            projectsGrid.innerHTML = projectsWithData.map(({ name, data }) => {
                return createProjectCard(name, data);
            }).join('');
            
            // 绑定项目卡片点击事件（进入项目主页）
            document.querySelectorAll('.project-card').forEach(card => {
                card.style.cursor = 'pointer';
                card.addEventListener('click', async function(e) {
                    // 如果点击的是按钮，不触发卡片点击
                    if (e.target.classList.contains('project-delete-btn')) {
                        return;
                    }
                    const projectName = this.getAttribute('data-project-name');
                    await openProjectDetail(projectName);
                });
            });
            
            // 绑定删除按钮事件
            document.querySelectorAll('.project-delete-btn').forEach(btn => {
                btn.addEventListener('click', async function(e) {
                    e.stopPropagation();
                    const projectName = this.getAttribute('data-project-name');
                    await deleteProject(projectName);
                });
            });
        }).catch(error => {
            console.error('加载项目详情失败:', error);
            projectsGrid.innerHTML = '<div class="error-projects">加载项目详情失败</div>';
        });
    }
    
    // 辅助函数：加载项目数据并创建卡片（用于显示列表）
    async function loadProjectDataForDisplay(projectName) {
        const result = await window.electronAPI.loadProjectData(projectName);
        return createProjectCard(projectName, result.success ? result.data : null);
    }
    
    // 创建项目卡片HTML
    function createProjectCard(projectName, data) {
        if (!data) {
            return `
                <div class="project-card error-card" data-project-name="${projectName}">
                    <h3>${escapeHtml(projectName)}</h3>
                    <p class="status-error">加载失败</p>
                    <button class="project-delete-btn" data-project-name="${projectName}">删除</button>
                </div>
            `;
        }
        
        const status = data.status || 'initial';
        const statusText = {
            'initial': '待开始',
            'active': '进行中',
            'completed': '已完成'
        }[status] || '未知';
        const statusClass = {
            'initial': 'status-pending',
            'active': 'status-progress',
            'completed': 'status-completed'
        }[status] || 'status-pending';
        
        // 优先从 requirementData.requirement 读取，兼容旧格式
        const topic = (data.requirementData && data.requirementData.requirement) || 
                      data.projectDescription || 
                      data.reviewDescription || 
                      data.userNeeds || 
                      data.researchTopic || 
                      '未设置项目需求';
                    const createdAt = window.FormatUtils ? window.FormatUtils.formatDate(data.createdAt) : (data.createdAt ? new Date(data.createdAt).toLocaleDateString('zh-CN') : '未知');
                    const updatedAt = window.FormatUtils ? window.FormatUtils.formatDate(data.updatedAt) : (data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('zh-CN') : '未知');
        
        return `
            <div class="project-card" data-project-name="${projectName}">
                <div class="project-card-header">
                    <h4 class="project-name">${escapeHtml(projectName)}</h4>
                    <span class="project-status ${statusClass}" style="${status === 'initial' ? 'visibility: hidden;' : ''}">${statusText}</span>
                </div>
                <div class="project-card-body">
                                <p class="project-topic">${escapeHtml(window.FormatUtils ? window.FormatUtils.truncate(topic, 100) : (topic.substring(0, 100) + (topic.length > 100 ? '...' : '')))}</p>
                    <div class="project-meta">
                        <span class="project-date">创建: ${createdAt}</span>
                        <span class="project-date">更新: ${updatedAt}</span>
                    </div>
                </div>
                <div class="project-card-footer">
                    <button class="project-delete-btn" data-project-name="${projectName}" title="删除项目">×</button>
                </div>
            </div>
        `;
    }
    
    // HTML转义（使用工具函数）
    function escapeHtml(text) {
        return window.DomUtils ? window.DomUtils.escapeHtml(text) : (() => {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        })();
    }
    
    // 打开项目详情页面
    async function openProjectDetail(projectName) {
        if (!window.electronAPI) return;
        try {
            await window.electronAPI.setCurrentProject(projectName);
            if (window.electronAPI.switchToProjectDetail) {
                await window.electronAPI.switchToProjectDetail();
            }
        } catch (e) {
            console.error('打开项目详情失败:', e);
            alert('打开项目详情失败: ' + e.message);
        }
    }
    
    // 删除项目
    async function deleteProject(projectName) {
        // 确认删除
        const confirmed = confirm(`确定要删除项目"${projectName}"吗？\n\n此操作不可恢复，将删除项目文件夹及其所有数据。`);
        
        if (!confirmed) {
            return;
        }
        
        try {
            // 清除当前项目设置（如果删除的是当前项目）
            const currentProjectResult = await window.electronAPI.getCurrentProject();
            if (currentProjectResult.success && currentProjectResult.currentProject === projectName) {
                await window.electronAPI.setCurrentProject(null);
            }
            
            // 调用主进程删除项目
            const result = await window.electronAPI.deleteProject(projectName);
            
            if (result.success) {
                showToast(`项目"${projectName}"已删除`);
                // 重新加载项目列表
                await loadProjectsList();
            } else {
                showToast('删除项目失败: ' + (result.error || '未知错误'), 'error');
            }
        } catch (error) {
            console.error('删除项目失败:', error);
            showToast('删除项目失败: ' + error.message, 'error');
        }
    }
    
    // 使用 UIUtils.showToast（已在模块中加载）
    function showToast(message, type = 'success') {
        if (window.UIUtils && window.UIUtils.showToast) {
            window.UIUtils.showToast(message, type);
        } else {
            // 降级方案
            alert(message);
        }
    }
});
