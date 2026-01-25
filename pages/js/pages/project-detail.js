console.log('[project-detail.js] 脚本开始加载');

document.addEventListener('DOMContentLoaded', function() {
    console.log('[project-detail.js] DOMContentLoaded 事件触发');
    
    // 绑定返回按钮
    const backBtn = document.getElementById('back-to-list-btn');
    if (backBtn) {
        backBtn.addEventListener('click', async function() {
            try {
                console.log('点击返回项目列表按钮');
                // 清除当前项目状态，避免自动重新打开
                if (window.electronAPI && window.electronAPI.setCurrentProject) {
                    await window.electronAPI.setCurrentProject(null);
                    console.log('已清除当前项目状态');
                }
                // 清除子项目ID
                sessionStorage.removeItem('currentSubprojectId');
                
                if (window.electronAPI && window.electronAPI.switchToProjectList) {
                    const result = await window.electronAPI.switchToProjectList();
                    console.log('switchToProjectList 返回结果:', result);
                    if (result && !result.success) {
                        const errorMsg = result?.error || '未知错误';
                        console.error('返回项目列表失败:', errorMsg);
                        if (window.UIUtils && window.UIUtils.showToast) {
                            window.UIUtils.showToast('返回项目列表失败: ' + errorMsg, 'error');
                        } else {
                            alert('返回项目列表失败: ' + errorMsg);
                        }
                    }
                } else {
                    console.error('electronAPI.switchToProjectList 不存在');
                    if (window.UIUtils && window.UIUtils.showToast) {
                        window.UIUtils.showToast('无法返回项目列表（API不存在）', 'error');
                    } else {
                        alert('无法返回项目列表（API不存在）');
                    }
                }
            } catch (error) {
                console.error('返回项目列表过程出错:', error);
                if (window.UIUtils && window.UIUtils.showToast) {
                    window.UIUtils.showToast('返回项目列表失败: ' + error.message, 'error');
                } else {
                    alert('返回项目列表失败: ' + error.message);
                }
            }
        });
    }
    
    // 页面加载时显示项目详情
    console.log('[project-detail.js] 准备加载项目详情');
    loadProjectDetail();
    
    // 加载项目详情
    async function loadProjectDetail() {
        console.log('[loadProjectDetail] 开始加载项目详情');
        if (!window.electronAPI) {
            console.error('[loadProjectDetail] electronAPI 不存在');
            return;
        }
        try {
            console.log('[loadProjectDetail] 获取当前项目...');
            const { success, currentProject: cp } = await window.electronAPI.getCurrentProject();
            console.log('[loadProjectDetail] 当前项目结果:', { success, currentProject: cp });
            if (success && cp) {
                console.log('[loadProjectDetail] 显示项目详情:', cp);
                await showProjectDetail(cp);
            } else {
                console.log('[loadProjectDetail] 没有当前项目，返回项目列表');
                // 没有当前项目，返回项目列表
                if (window.electronAPI.switchToProjectList) {
                    await window.electronAPI.switchToProjectList();
                }
            }
        } catch (e) {
            console.error('[loadProjectDetail] 加载项目详情失败:', e);
            console.error('[loadProjectDetail] 错误堆栈:', e.stack);
            alert('加载项目详情失败: ' + e.message);
        }
    }
    
    // 显示项目详情页面（项目主页）
    async function showProjectDetail(projectName) {
        console.log('[showProjectDetail] ========== 开始显示项目详情 ==========');
        console.log('[showProjectDetail] projectName:', projectName);
        if (!window.electronAPI) {
            console.error('[showProjectDetail] electronAPI 不存在');
            return;
        }
        try {
            const result = await window.electronAPI.loadProjectData(projectName);
            if (!result.success || !result.data) {
                alert('加载项目失败: ' + (result.error || '未知错误'));
                return;
            }
            
            const data = result.data;
            // 从独立文件加载子项目数据
            let literatureSubprojects = [];
            let reviewSubprojects = [];
            
            if (window.SubprojectManager) {
                try {
                    literatureSubprojects = await window.SubprojectManager.getSubprojectsByType(projectName, 'literatureSearch');
                    reviewSubprojects = await window.SubprojectManager.getSubprojectsByType(projectName, 'reviewWriting');
                    
                    // 更新每个子项目的状态（根据节点状态自动计算）
                    for (const sp of literatureSubprojects) {
                        await window.SubprojectManager.updateSubprojectStatus(projectName, sp.id);
                    }
                    for (const sp of reviewSubprojects) {
                        await window.SubprojectManager.updateSubprojectStatus(projectName, sp.id);
                    }
                    
                    // 重新加载更新后的子项目数据
                    literatureSubprojects = await window.SubprojectManager.getSubprojectsByType(projectName, 'literatureSearch');
                    reviewSubprojects = await window.SubprojectManager.getSubprojectsByType(projectName, 'reviewWriting');
                } catch (error) {
                    console.error('加载子项目列表失败:', error);
                    // 如果加载失败，使用空数组
                    literatureSubprojects = [];
                    reviewSubprojects = [];
                }
            }
            
            // 获取项目配置信息
            const config = data.config || {};
            const apiKeys = config.apiKeys || {};
            const googleScholarVerified = config.googleScholarVerified || false;
            const lanfanshuVerified = config.lanfanshuVerified || false;
            const description = data.description || '';
            const requirementData = data.requirementData || {};
            const requirement = requirementData.requirement || '未设置';
            const targetCount = requirementData.targetCount || 50;
            const outline = requirementData.outline || '未设置';
            const language = requirementData.language || 'zh';
            const createdAt = window.FormatUtils ? window.FormatUtils.formatDate(data.createdAt) : (data.createdAt ? new Date(data.createdAt).toLocaleDateString('zh-CN') : '未知');
            const updatedAt = window.FormatUtils ? window.FormatUtils.formatDate(data.updatedAt) : (data.updatedAt ? new Date(data.updatedAt).toLocaleDateString('zh-CN') : '未知');
            
            // 更新项目详情页面标题
            const projectNameElement = document.getElementById('project-detail-name');
            if (projectNameElement) {
                projectNameElement.textContent = projectName;
                console.log('[showProjectDetail] 项目名称已更新:', projectName);
            } else {
                console.error('[showProjectDetail] project-detail-name 元素不存在');
            }
            
            // 生成项目配置信息HTML（支持编辑）
            const configHtml = `
                <div class="project-config-section">
                    <div class="config-header">
                        <h3>项目配置</h3>
                        <button id="edit-config-btn" class="btn-edit">编辑</button>
                        <button id="save-config-btn" class="btn-save" style="display: none;">保存</button>
                        <button id="cancel-config-btn" class="btn-cancel" style="display: none;">取消</button>
                    </div>
                    <div class="config-content">
                        <div class="config-item">
                            <label>项目简介：</label>
                            <div class="config-value" id="config-description-display">${escapeHtml(description) || '未设置'}</div>
                            <textarea id="config-description-edit" class="config-input" style="display: none;" rows="3" placeholder="请输入项目简介...">${escapeHtml(description)}</textarea>
                        </div>
                        <div class="config-item">
                            <label>创建时间：</label>
                            <div class="config-value">${createdAt}</div>
                        </div>
                        <div class="config-item">
                            <label>更新时间：</label>
                            <div class="config-value">${updatedAt}</div>
                        </div>
                    </div>
                    
                    <!-- 网络环境检查 -->
                    <div class="config-section-divider"></div>
                    <div class="config-subsection">
                        <h4>网络环境检查</h4>
                        <div class="config-item">
                            <label>Google Scholar：</label>
                            <div class="config-value">
                                <span id="scholar-status" class="status-badge ${googleScholarVerified ? 'status-verified' : 'status-unverified'}">
                                    ${googleScholarVerified ? '✓ 已验证' : '✗ 未验证'}
                                </span>
                                <button id="verify-scholar-btn" class="btn-verify" style="margin-left: 10px;">${googleScholarVerified ? '重新验证' : '验证登录'}</button>
                                <button id="speed-test-scholar-btn" class="btn-verify" style="margin-left: 10px; background: #10b981; color: white;">⚡ 测速</button>
                                <span id="scholar-speed-result" style="margin-left: 10px; color: #666; font-size: 12px;"></span>
                            </div>
                        </div>
                        <div class="config-item" style="margin-top: 15px;">
                            <label>烂番薯学术（Google Scholar国内镜像）：</label>
                            <div class="config-value">
                                <span id="lanfanshu-status" class="status-badge ${lanfanshuVerified ? 'status-verified' : 'status-unverified'}">
                                    ${lanfanshuVerified ? '✓ 已验证' : '✗ 未验证'}
                                </span>
                                <button id="verify-lanfanshu-btn" class="btn-verify" style="margin-left: 10px;">${lanfanshuVerified ? '重新验证' : '验证登录'}</button>
                                <button id="speed-test-lanfanshu-btn" class="btn-verify" style="margin-left: 10px; background: #10b981; color: white;">⚡ 测速</button>
                                <span id="lanfanshu-speed-result" style="margin-left: 10px; color: #666; font-size: 12px;"></span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- API Key管理 -->
                    <div class="config-section-divider"></div>
                    <div class="config-subsection">
                        <h4>大模型API Key管理</h4>
                        <div class="api-keys-list">
                            <div class="api-key-item">
                                <div class="api-key-label-row">
                                    <label>DeepSeek API Key：</label>
                                    <a href="https://api-docs.deepseek.com/zh-cn/api/deepseek-api/" target="_blank" class="api-docs-link">
                                        🔗 API 申请地址
                                    </a>
                                </div>
                                <div class="api-key-input-wrapper">
                                    <input type="password" id="api-key-deepseek" class="api-key-input" placeholder="请输入DeepSeek API Key" value="${apiKeys.deepseek || ''}">
                                    <button class="btn-save-key" data-provider="deepseek">保存</button>
                                </div>
                            </div>
                            <div class="api-key-item">
                                <div class="api-key-label-row">
                                    <label>Google Gemini API Key：</label>
                                    <a href="https://ai.google.dev/" target="_blank" class="api-docs-link">
                                        🔗 API 申请地址
                                    </a>
                                </div>
                                <div class="api-key-input-wrapper">
                                    <input type="password" id="api-key-gemini" class="api-key-input" placeholder="请输入Google Gemini API Key" value="${apiKeys.gemini || ''}">
                                    <button class="btn-save-key" data-provider="gemini">保存</button>
                                </div>
                            </div>
                            <div class="api-key-item">
                                <div class="api-key-label-row">
                                    <label>硅基流动 API Key：</label>
                                    <a href="https://siliconflow.cn/" target="_blank" class="api-docs-link">
                                        🔗 API 申请地址
                                    </a>
                                </div>
                                <div class="api-key-input-wrapper">
                                    <input type="password" id="api-key-siliconflow" class="api-key-input" placeholder="请输入硅基流动 API Key" value="${apiKeys.siliconflow || ''}">
                                    <button class="btn-save-key" data-provider="siliconflow">保存</button>
                                </div>
                            </div>
                            <div class="api-key-item">
                                <div class="api-key-label-row">
                                    <label>Poe API Key：</label>
                                    <a href="https://poe.com/api_key" target="_blank" class="api-docs-link">
                                        🔗 API 申请地址
                                    </a>
                                </div>
                                <div class="api-key-input-wrapper">
                                    <input type="password" id="api-key-poe" class="api-key-input" placeholder="请输入Poe API Key" value="${apiKeys.poe || ''}">
                                    <button class="btn-save-key" data-provider="poe">保存</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // 为综述撰写子项目准备来源子项目信息
            const reviewSubprojectsWithSourceInfo = await Promise.all(reviewSubprojects.map(async (sp) => {
                const sourceSubprojectIds = sp.sourceSubprojectIds || [];
                let sourceInfo = '未关联';
                if (sourceSubprojectIds.length > 0) {
                    // 获取来源子项目名称
                    const sourceNames = [];
                    for (const sourceId of sourceSubprojectIds) {
                        try {
                            const sourceSp = await window.SubprojectManager.getSubprojectData(projectName, sourceId);
                            if (sourceSp && sourceSp.name) {
                                sourceNames.push(sourceSp.name);
                            }
                        } catch (e) {
                            // 忽略错误
                        }
                    }
                    if (sourceNames.length > 0) {
                        sourceInfo = `来源: ${sourceNames.join('、')}`;
                    } else {
                        sourceInfo = `来源: ${sourceSubprojectIds.length} 个子项目`;
                    }
                }
                return { ...sp, sourceInfo };
            }));
            
            // 生成子项目列表HTML
            const subprojectsHtml = `
                <div class="subprojects-container">
                    <div class="subprojects-type-section">
                        <h3 class="subprojects-type-title">📚 文献查找子项目</h3>
                        <div class="subprojects-list" data-project-name="${projectName}" data-type="literatureSearch">
                            ${literatureSubprojects.length > 0 ? 
                                literatureSubprojects.map(sp => {
                                    const spStatus = sp.status || 'pending';
                                    const spStatusText = {
                                        'pending': '待开始',
                                        'active': '进行中',
                                        'completed': '已完成'
                                    }[spStatus] || '未知';
                                    const spStatusClass = {
                                        'pending': 'status-pending',
                                        'active': 'status-progress',
                                        'completed': 'status-completed'
                                    }[spStatus] || 'status-pending';
                                    
                                    // 获取配置信息
                                    const config = sp.config || {};
                                    const literatureSource = config.literatureSource || 'google-scholar';
                                    const language = config.language || 'zh';
                                    
                                    // 文献库显示名称
                                    const sourceName = literatureSource === 'lanfanshu' ? '烂番薯学术' : 'Google Scholar';
                                    
                                    // 语言显示名称
                                    const languageName = language === 'en' ? '英文' : '中文';
                                    
                                    // 获取找到的文献数量
                                    let literatureCount = '未完成';
                                    if (sp.node4 && sp.node4.status === 'completed' && sp.node4.selectedLiterature && Array.isArray(sp.node4.selectedLiterature)) {
                                        literatureCount = `${sp.node4.selectedLiterature.length} 篇`;
                                    } else if (sp.node3 && sp.node3.status === 'completed' && sp.node3.allLiterature && Array.isArray(sp.node3.allLiterature)) {
                                        literatureCount = `补全中 (${sp.node3.allLiterature.length} 篇)`;
                                    } else if (sp.node2 && sp.node2.status === 'completed' && sp.node2.searchResults) {
                                        const totalCount = Object.values(sp.node2.searchResults).reduce((sum, results) => sum + (Array.isArray(results) ? results.length : 0), 0);
                                        if (totalCount > 0) {
                                            literatureCount = `搜索中 (${totalCount} 篇)`;
                                        }
                                    }
                                    
                                    return `
                                        <div class="subproject-item" data-subproject-id="${sp.id}">
                                            <div class="subproject-info">
                                                <div class="subproject-main-info">
                                                    <span class="subproject-name">${escapeHtml(sp.name || '未命名')}</span>
                                                    <span class="subproject-status ${spStatusClass}">${spStatusText}</span>
                                                </div>
                                                <div class="subproject-details">
                                                    <span class="subproject-detail-item">文献库: ${sourceName}</span>
                                                    <span class="subproject-detail-item">语言: ${languageName}</span>
                                                    <span class="subproject-detail-item">文献数: ${literatureCount}</span>
                                                </div>
                                            </div>
                                            <div class="subproject-actions">
                                                <button class="subproject-open-btn" data-project-name="${projectName}" data-subproject-id="${sp.id}">进入</button>
                                                <button class="subproject-delete-btn" data-project-name="${projectName}" data-subproject-id="${sp.id}" title="删除子项目">删除</button>
                                            </div>
                                        </div>
                                    `;
                                }).join('') : 
                                '<div class="empty-subprojects">暂无文献查找子项目</div>'
                            }
                            <button class="subproject-create-btn btn-primary" data-project-name="${projectName}" data-type="literatureSearch">+ 新建文献查找子项目</button>
                        </div>
                    </div>
                    <div class="subprojects-type-section">
                        <h3 class="subprojects-type-title">✍️ 综述撰写子项目</h3>
                        <div class="subprojects-list" data-project-name="${projectName}" data-type="reviewWriting">
                            ${reviewSubprojectsWithSourceInfo.length > 0 ? 
                                reviewSubprojectsWithSourceInfo.map(sp => {
                                    const spStatus = sp.status || 'pending';
                                    const spStatusText = {
                                        'pending': '待开始',
                                        'active': '进行中',
                                        'completed': '已完成'
                                    }[spStatus] || '未知';
                                    const spStatusClass = {
                                        'pending': 'status-pending',
                                        'active': 'status-progress',
                                        'completed': 'status-completed'
                                    }[spStatus] || 'status-pending';
                                    
                                    // 获取描述信息
                                    const description = sp.description || '';
                                    const descriptionText = description ? (description.length > 50 ? description.substring(0, 50) + '...' : description) : '未设置描述';
                                    
                                    // 获取文献数量
                                    let literatureCount = '未导入';
                                    if (sp.node5 && sp.node5.literature && Array.isArray(sp.node5.literature)) {
                                        literatureCount = `${sp.node5.literature.length} 篇`;
                                    }
                                    
                                    // 获取节点5状态
                                    const node5Status = sp.node5?.status || 'pending';
                                    const node5StatusText = {
                                        'pending': '未开始',
                                        'active': '撰写中',
                                        'completed': '已完成'
                                    }[node5Status] || '未知';
                                    
                                    return `
                                        <div class="subproject-item" data-subproject-id="${sp.id}">
                                            <div class="subproject-info">
                                                <div class="subproject-main-info">
                                                    <span class="subproject-name">${escapeHtml(sp.name || '未命名')}</span>
                                                    <span class="subproject-status ${spStatusClass}">${spStatusText}</span>
                                                </div>
                                                <div class="subproject-details">
                                                    <span class="subproject-detail-item">描述: ${escapeHtml(descriptionText)}</span>
                                                    <span class="subproject-detail-item">${sp.sourceInfo}</span>
                                                    <span class="subproject-detail-item">文献数: ${literatureCount}</span>
                                                    <span class="subproject-detail-item">节点5: ${node5StatusText}</span>
                                                </div>
                                            </div>
                                            <div class="subproject-actions">
                                                <button class="subproject-open-btn" data-project-name="${projectName}" data-subproject-id="${sp.id}">进入</button>
                                                <button class="subproject-delete-btn" data-project-name="${projectName}" data-subproject-id="${sp.id}" title="删除子项目">删除</button>
                                            </div>
                                        </div>
                                    `;
                                }).join('') : 
                                '<div class="empty-subprojects">暂无综述撰写子项目</div>'
                            }
                            <button class="subproject-create-btn btn-primary" data-project-name="${projectName}" data-type="reviewWriting">+ 新建综述撰写子项目</button>
                        </div>
                    </div>
                </div>
            `;
            
            // 更新项目详情页面内容
            console.log('[showProjectDetail] 准备更新页面内容');
            const projectDetailBody = document.getElementById('project-detail-body');
            if (!projectDetailBody) {
                console.error('[showProjectDetail] project-detail-body 元素不存在');
                return;
            }
            projectDetailBody.innerHTML = configHtml + subprojectsHtml;
            console.log('[showProjectDetail] 页面内容已更新');
            
            // 绑定配置编辑事件
            console.log('[showProjectDetail] 准备绑定配置事件');
            bindConfigEvents(projectName);
            console.log('[showProjectDetail] 配置事件已绑定');
            
            // 绑定子项目相关事件
            console.log('[showProjectDetail] 准备绑定子项目事件');
            try {
                bindSubprojectEvents(projectName);
                console.log('[showProjectDetail] 子项目事件已绑定');
            } catch (e) {
                console.error('[showProjectDetail] 绑定子项目事件失败:', e);
                console.error('[showProjectDetail] 错误堆栈:', e.stack);
            }
            
        } catch (e) {
            console.error('显示项目详情失败:', e);
            console.error('错误堆栈:', e.stack);
            alert('显示项目详情失败: ' + e.message);
        }
    }
    
    // 绑定配置编辑事件
    function bindConfigEvents(projectName) {
        const editBtn = document.getElementById('edit-config-btn');
        const saveBtn = document.getElementById('save-config-btn');
        const cancelBtn = document.getElementById('cancel-config-btn');
        
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                // 切换到编辑模式
                const descDisplay = document.getElementById('config-description-display');
                const descEdit = document.getElementById('config-description-edit');
                if (descDisplay && descEdit) {
                    descDisplay.style.display = 'none';
                    descEdit.style.display = 'block';
                }
                
                editBtn.style.display = 'none';
                saveBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', async function() {
                await saveProjectConfig(projectName);
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                // 取消编辑，重新加载项目详情
                showProjectDetail(projectName);
            });
        }
        
        // 绑定API Key保存按钮
        document.querySelectorAll('.btn-save-key').forEach(btn => {
            btn.addEventListener('click', async function() {
                const provider = this.getAttribute('data-provider');
                const input = document.getElementById(`api-key-${provider}`);
                if (input) {
                    await saveApiKey(projectName, provider, input.value);
                }
            });
        });
        
        // 绑定Google Scholar验证按钮
        const verifyScholarBtn = document.getElementById('verify-scholar-btn');
        if (verifyScholarBtn) {
            verifyScholarBtn.addEventListener('click', async function() {
                await verifyGoogleScholar(projectName);
            });
        }
        
        // 绑定烂番薯学术验证按钮
        const verifyLanfanshuBtn = document.getElementById('verify-lanfanshu-btn');
        if (verifyLanfanshuBtn) {
            verifyLanfanshuBtn.addEventListener('click', async function() {
                await verifyLanfanshu(projectName);
            });
        }
        
        // 测速功能（后台运行，不打开窗口）
        async function speedTest(source, keyword = 'machine learning', limit = 5) {
            const resultElementId = {
                'google-scholar': 'scholar-speed-result',
                'lanfanshu': 'lanfanshu-speed-result'
            }[source];
            
            const resultElement = document.getElementById(resultElementId);
            if (!resultElement) return;
            
            // 检查API是否可用
            if (!window.API) {
                resultElement.textContent = '✗ API未加载';
                resultElement.style.color = '#ef4444';
                return;
            }
            
            // 显示测试中
            resultElement.textContent = '测试中...';
            resultElement.style.color = '#666';
            
            const startTime = Date.now();
            try {
                let results = [];
                
                // 调用搜索API（后台运行，使用隐藏窗口）
                if (source === 'google-scholar') {
                    if (!window.API.searchGoogleScholar) {
                        throw new Error('searchGoogleScholar方法不存在');
                    }
                    results = await window.API.searchGoogleScholar(keyword, limit);
                } else if (source === 'lanfanshu') {
                    if (!window.API.searchLanfanshu) {
                        throw new Error('searchLanfanshu方法不存在');
                    }
                    // 测速时不显示验证码窗口，后台运行
                    results = await window.API.searchLanfanshu(keyword, limit, null, false);
                } else {
                    throw new Error('未知的搜索来源: ' + source);
                }
                
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                // 打印原始结果到console（用于调试）
                console.log(`[测速 ${source}] 原始结果:`, results);
                console.log(`[测速 ${source}] 结果类型:`, typeof results);
                console.log(`[测速 ${source}] 是否为数组:`, Array.isArray(results));
                if (results && Array.isArray(results)) {
                    console.log(`[测速 ${source}] 结果数量:`, results.length);
                    if (results.length > 0) {
                        console.log(`[测速 ${source}] 第一个结果:`, results[0]);
                    }
                }
                
                // 处理结果
                if (results && Array.isArray(results) && results.length > 0) {
                    resultElement.textContent = `✓ 成功 (${duration}ms, 找到${results.length}篇)`;
                    resultElement.style.color = '#10b981';
                } else {
                    resultElement.textContent = `✗ 失败 (${duration}ms, 未找到结果)`;
                    resultElement.style.color = '#ef4444';
                }
            } catch (error) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                const errorMsg = error.message || '未知错误';
                resultElement.textContent = `✗ 错误 (${duration}ms, ${errorMsg})`;
                resultElement.style.color = '#ef4444';
                console.error(`测速失败 (${source}):`, error);
            }
        }
        
        // 绑定Google Scholar测速按钮
        const speedTestScholarBtn = document.getElementById('speed-test-scholar-btn');
        if (speedTestScholarBtn) {
            speedTestScholarBtn.addEventListener('click', async function() {
                this.disabled = true;
                this.textContent = '测速中...';
                await speedTest('google-scholar');
                this.disabled = false;
                this.textContent = '⚡ 测速';
            });
        }
        
        // 绑定烂番薯学术测速按钮
        const speedTestLanfanshuBtn = document.getElementById('speed-test-lanfanshu-btn');
        if (speedTestLanfanshuBtn) {
            speedTestLanfanshuBtn.addEventListener('click', async function() {
                this.disabled = true;
                this.textContent = '测速中...';
                await speedTest('lanfanshu');
                this.disabled = false;
                this.textContent = '⚡ 测速';
            });
        }
        
    }
    
    // 保存项目配置
    async function saveProjectConfig(projectName) {
        if (!window.electronAPI || !window.DataManager) return;
        
        try {
            const descEdit = document.getElementById('config-description-edit');
            const description = descEdit ? descEdit.value.trim() : '';
            
            // 获取当前项目数据以保留config中的apiKeys和googleScholarVerified
            const currentData = await window.electronAPI.loadProjectData(projectName);
            const currentConfig = (currentData.success && currentData.data && currentData.data.config) || {};
            const currentApiKeys = currentConfig.apiKeys || {};
            const currentRequirementData = (currentData.success && currentData.data && currentData.data.requirementData) || {};
            
            // 保存到项目数据（保留requirementData，只更新description）
            await window.DataManager.saveProjectData(projectName, {
                description: description,
                requirementData: currentRequirementData, // 保留原有的requirementData
                config: {
                    ...currentConfig,
                    apiKeys: currentApiKeys // 保留已有的API Keys
                },
                updatedAt: new Date().toISOString()
            });
            
            showToast('项目配置已保存', 'success');
            
            // 重新加载项目详情
            await showProjectDetail(projectName);
        } catch (e) {
            console.error('保存项目配置失败:', e);
            showToast('保存项目配置失败: ' + e.message, 'error');
        }
    }
    
    // 保存单个API Key
    async function saveApiKey(projectName, provider, apiKey) {
        if (!window.electronAPI || !window.DataManager) return;
        
        try {
            // 获取当前项目数据
            const currentData = await window.electronAPI.loadProjectData(projectName);
            const currentConfig = (currentData.success && currentData.data && currentData.data.config) || {};
            const currentApiKeys = currentConfig.apiKeys || {};
            
            // 更新对应provider的API Key
            currentApiKeys[provider] = apiKey.trim();
            
            // 保存到项目数据
            await window.DataManager.saveProjectData(projectName, {
                config: {
                    ...currentConfig,
                    apiKeys: currentApiKeys
                },
                updatedAt: new Date().toISOString()
            });
            
            showToast(`${provider} API Key 已保存`, 'success');
        } catch (e) {
            console.error('保存API Key失败:', e);
            showToast('保存API Key失败: ' + e.message, 'error');
        }
    }
    
    // 验证Google Scholar
    async function verifyGoogleScholar(projectName) {
        if (!window.electronAPI || !window.DataManager) return;
        
        try {
            showToast('正在打开Google Scholar验证窗口...', 'info');
            
            // 打开Google Scholar登录窗口，并自动发起一个较大的搜索来触发人机交互界面
            // 使用通用的学术关键词和较大的搜索数量
            const result = await window.electronAPI.openScholarLogin('machine learning', 50);
            
            if (result && result.success) {
                // 验证成功，更新项目配置
                const currentData = await window.electronAPI.loadProjectData(projectName);
                const currentConfig = (currentData.success && currentData.data && currentData.data.config) || {};
                
                await window.DataManager.saveProjectData(projectName, {
                    config: {
                        ...currentConfig,
                        googleScholarVerified: true
                    },
                    updatedAt: new Date().toISOString()
                });
                
                showToast('Google Scholar 验证成功', 'success');
                
                // 重新加载项目详情
                await showProjectDetail(projectName);
            } else {
                showToast('Google Scholar 验证失败: ' + (result?.error || '未知错误'), 'error');
            }
        } catch (e) {
            console.error('验证Google Scholar失败:', e);
            showToast('验证Google Scholar失败: ' + e.message, 'error');
        }
    }
    
    // 验证烂番薯学术
    async function verifyLanfanshu(projectName) {
        if (!window.electronAPI || !window.DataManager) return;
        
        try {
            showToast('正在打开烂番薯学术验证窗口...', 'info');
            
            // 打开烂番薯学术登录窗口，并自动发起一个较大的搜索来触发人机交互界面
            // 使用通用的学术关键词和较大的搜索数量（50篇，更好地触发验证）
            const result = await window.electronAPI.openLanfanshuLogin('machine learning', 50);
            
            if (result && result.success) {
                // 验证成功，更新项目配置
                const currentData = await window.electronAPI.loadProjectData(projectName);
                const currentConfig = (currentData.success && currentData.data && currentData.data.config) || {};
                
                await window.DataManager.saveProjectData(projectName, {
                    config: {
                        ...currentConfig,
                        lanfanshuVerified: true
                    },
                    updatedAt: new Date().toISOString()
                });
                
                showToast('烂番薯学术验证成功', 'success');
                
                // 重新加载项目详情
                await showProjectDetail(projectName);
            } else {
                showToast('烂番薯学术验证失败: ' + (result?.error || '未知错误'), 'error');
            }
        } catch (e) {
            console.error('验证烂番薯学术失败:', e);
            showToast('验证烂番薯学术失败: ' + e.message, 'error');
        }
    }
    
    
    // 绑定子项目相关事件
    function bindSubprojectEvents(projectName) {
        console.log('[bindSubprojectEvents] ========== 开始绑定子项目事件 ==========');
        console.log('[bindSubprojectEvents] projectName:', projectName);
        
        try {
            // 先移除之前的事件监听器（如果存在），避免重复绑定
            const existingItems = document.querySelectorAll('.subproject-item[data-event-bound]');
            console.log('[bindSubprojectEvents] 找到已绑定事件的项数量:', existingItems.length);
            existingItems.forEach(item => {
                item.removeAttribute('data-event-bound');
            });
            
            // 绑定整个子项目项的点击事件（点击卡片任意位置打开子项目）
            const subprojectItems = document.querySelectorAll('.subproject-item');
            console.log('[bindSubprojectEvents] 找到子项目项数量:', subprojectItems.length);
            
            if (subprojectItems.length === 0) {
                console.warn('[bindSubprojectEvents] 警告：没有找到任何子项目项！');
                console.log('[bindSubprojectEvents] 检查 DOM 结构...');
                const projectDetailBody = document.getElementById('project-detail-body');
                if (projectDetailBody) {
                    console.log('[bindSubprojectEvents] project-detail-body 内容长度:', projectDetailBody.innerHTML.length);
                    // 检查是否有 reviewWriting 类型的子项目
                    const reviewWritingList = document.querySelector('[data-type="reviewWriting"]');
                    console.log('[bindSubprojectEvents] 找到 reviewWriting 列表:', !!reviewWritingList);
                    if (reviewWritingList) {
                        console.log('[bindSubprojectEvents] reviewWriting 列表内容:', reviewWritingList.innerHTML.substring(0, 200));
                    }
                } else {
                    console.error('[bindSubprojectEvents] project-detail-body 元素不存在！');
                }
            }
        subprojectItems.forEach((item, index) => {
            const subprojectId = item.getAttribute('data-subproject-id');
            console.log(`[bindSubprojectEvents] 绑定子项目项 ${index}, subprojectId:`, subprojectId);
            
            // 标记已绑定事件
            item.setAttribute('data-event-bound', 'true');
            item.style.cursor = 'pointer';
            item.style.userSelect = 'none'; // 防止文本选择干扰点击
            
            // 使用 once: false 确保可以多次绑定（如果需要）
            const clickHandler = async function(e) {
                console.log('[subproject-item click] 子项目项被点击');
                console.log('[subproject-item click] target:', e.target);
                console.log('[subproject-item click] currentTarget:', e.currentTarget);
                console.log('[subproject-item click] subprojectId:', subprojectId);
                
                // 如果点击的是按钮或按钮的子元素，不触发卡片点击
                const clickedButton = e.target.closest('button');
                if (clickedButton && (
                    clickedButton.classList.contains('subproject-open-btn') || 
                    clickedButton.classList.contains('subproject-delete-btn')
                )) {
                    console.log('[subproject-item click] 点击的是按钮，忽略卡片点击');
                    return;
                }
                
                // 如果点击的是按钮容器
                if (e.target.closest('.subproject-actions')) {
                    console.log('[subproject-item click] 点击的是按钮容器，忽略卡片点击');
                    return;
                }
                
                const clickedSubprojectId = this.getAttribute('data-subproject-id');
                console.log('[subproject-item click] 准备打开子项目, subprojectId:', clickedSubprojectId);
                if (clickedSubprojectId) {
                    e.preventDefault();
                    e.stopPropagation();
                    await openSubproject(projectName, clickedSubprojectId);
                } else {
                    console.error('[subproject-item click] subprojectId 为空');
                }
            };
            
            item.addEventListener('click', clickHandler, { capture: false, passive: false });
        });
        
        // 绑定打开子项目事件（按钮点击）
        const openButtons = document.querySelectorAll('.subproject-open-btn');
        console.log('[bindSubprojectEvents] 找到打开按钮数量:', openButtons.length);
        openButtons.forEach((btn, index) => {
            const subprojectId = btn.getAttribute('data-subproject-id');
            console.log(`[bindSubprojectEvents] 绑定打开按钮 ${index}, subprojectId:`, subprojectId);
            
            const btnClickHandler = async function(e) {
                console.log('[subproject-open-btn click] 打开按钮被点击');
                console.log('[subproject-open-btn click] subprojectId:', subprojectId);
                e.preventDefault();
                e.stopPropagation();
                const btnSubprojectId = this.getAttribute('data-subproject-id');
                console.log('[subproject-open-btn click] 准备打开子项目, subprojectId:', btnSubprojectId);
                if (btnSubprojectId) {
                    await openSubproject(projectName, btnSubprojectId);
                } else {
                    console.error('[subproject-open-btn click] subprojectId 为空');
                }
            };
            
            btn.addEventListener('click', btnClickHandler, { capture: false, passive: false });
        });
        
        // 绑定删除子项目事件
        document.querySelectorAll('.subproject-delete-btn').forEach(btn => {
            btn.addEventListener('click', async function(e) {
                e.preventDefault();
                e.stopPropagation();
                const subprojectId = this.getAttribute('data-subproject-id');
                await deleteSubproject(projectName, subprojectId);
            }, { capture: false, passive: false });
        });
        
        // 绑定创建子项目事件
        const createButtons = document.querySelectorAll('.subproject-create-btn');
        console.log('[bindSubprojectEvents] 找到创建按钮数量:', createButtons.length);
        createButtons.forEach((btn, index) => {
            const type = btn.getAttribute('data-type');
            const projectNameAttr = btn.getAttribute('data-project-name');
            console.log(`[bindSubprojectEvents] 绑定创建按钮 ${index}, type:`, type, 'projectName:', projectNameAttr);
            
            const createClickHandler = async function(e) {
                console.log('[subproject-create-btn click] ========== 创建按钮被点击 ==========');
                console.log('[subproject-create-btn click] target:', e.target);
                console.log('[subproject-create-btn click] currentTarget:', e.currentTarget);
                console.log('[subproject-create-btn click] type:', type);
                console.log('[subproject-create-btn click] projectName (参数):', projectName);
                console.log('[subproject-create-btn click] projectName (属性):', this.getAttribute('data-project-name'));
                
                e.preventDefault();
                e.stopPropagation();
                
                const btnType = this.getAttribute('data-type');
                const btnProjectName = this.getAttribute('data-project-name');
                console.log('[subproject-create-btn click] 准备创建子项目, type:', btnType, 'projectName:', btnProjectName);
                
                if (!btnType) {
                    console.error('[subproject-create-btn click] type 属性为空！');
                    alert('错误：无法获取子项目类型');
                    return;
                }
                
                if (!btnProjectName) {
                    console.error('[subproject-create-btn click] projectName 属性为空！');
                    alert('错误：无法获取项目名称');
                    return;
                }
                
                try {
                    await createSubproject(btnProjectName, btnType);
                } catch (error) {
                    console.error('[subproject-create-btn click] 创建子项目失败:', error);
                    console.error('[subproject-create-btn click] 错误堆栈:', error.stack);
                    alert('创建子项目失败: ' + (error.message || '未知错误'));
                }
            };
            
            btn.addEventListener('click', createClickHandler, { capture: false, passive: false });
            console.log(`[bindSubprojectEvents] 创建按钮 ${index} 事件已绑定`);
        });
        
        console.log('[bindSubprojectEvents] ========== 子项目事件绑定完成 ==========');
        } catch (e) {
            console.error('[bindSubprojectEvents] 绑定子项目事件时发生错误:', e);
            console.error('[bindSubprojectEvents] 错误堆栈:', e.stack);
            throw e; // 重新抛出错误，让上层处理
        }
    }
    
    // 打开子项目（进入工作流页面）
    async function openSubproject(projectName, subprojectId) {
        console.log('[openSubproject] 开始打开子项目, projectName:', projectName, 'subprojectId:', subprojectId);
        if (!window.electronAPI) {
            console.error('[openSubproject] electronAPI 不存在');
            alert('系统错误：electronAPI 未初始化');
            return;
        }
        try {
            // 设置当前项目
            console.log('[openSubproject] 设置当前项目:', projectName);
            await window.electronAPI.setCurrentProject(projectName);
            
            // 保存子项目ID到sessionStorage，工作流页面会读取
            sessionStorage.setItem('currentSubprojectId', subprojectId);
            console.log('[openSubproject] 已保存子项目ID到sessionStorage:', subprojectId);
            
            // 获取子项目类型，根据类型切换到不同的工作流页面
            console.log('[openSubproject] 获取子项目数据...');
            const subproject = await window.SubprojectManager.getSubprojectData(projectName, subprojectId);
            console.log('[openSubproject] 子项目数据:', subproject);
            console.log('[openSubproject] 子项目类型:', subproject ? subproject.type : 'null');
            
            if (subproject && subproject.type === 'literatureSearch') {
                // 文献查找子项目，切换到专门的文献查找工作流页面
                console.log('[openSubproject] 切换到文献查找工作流');
                if (window.electronAPI.switchToLiteratureSearchWorkflow) {
                    await window.electronAPI.switchToLiteratureSearchWorkflow();
                } else {
                    console.error('[openSubproject] switchToLiteratureSearchWorkflow 方法不存在');
                    alert('无法切换到文献查找工作流界面');
                }
            } else if (subproject && subproject.type === 'reviewWriting') {
                // 综述撰写子项目，切换到专门的文献撰写工作流页面
                console.log('[openSubproject] 切换到综述撰写工作流');
                if (window.electronAPI.switchToReviewWritingWorkflow) {
                    console.log('[openSubproject] 调用 switchToReviewWritingWorkflow');
                    const result = await window.electronAPI.switchToReviewWritingWorkflow();
                    console.log('[openSubproject] switchToReviewWritingWorkflow 返回结果:', result);
                } else {
                    console.error('[openSubproject] switchToReviewWritingWorkflow 方法不存在');
                    console.log('[openSubproject] electronAPI 可用方法:', Object.keys(window.electronAPI));
                    alert('无法切换到文献撰写工作流界面');
                }
            } else {
                // 未知类型，显示错误提示
                console.error('[openSubproject] 未知的子项目类型:', subproject ? subproject.type : 'null');
                alert('未知的子项目类型: ' + (subproject ? subproject.type : 'null'));
            }
        } catch (e) {
            console.error('[openSubproject] 打开子项目失败:', e);
            console.error('[openSubproject] 错误堆栈:', e.stack);
            alert('打开子项目失败: ' + e.message);
        }
    }
    
    // 创建子项目
    async function createSubproject(projectName, type) {
        console.log('[createSubproject] ========== 开始创建子项目 ==========');
        console.log('[createSubproject] projectName:', projectName);
        console.log('[createSubproject] type:', type);
        
        if (!window.electronAPI) {
            console.error('[createSubproject] electronAPI 不存在');
            alert('系统错误：electronAPI 未初始化');
            return;
        }
        try {
            const typeName = type === 'literatureSearch' ? '文献查找' : '综述撰写';
            console.log('[createSubproject] typeName:', typeName);
            
            // 如果是综述撰写子项目，先选择文献查找子项目
            let selectedSourceSubprojectIds = [];
            if (type === 'reviewWriting') {
                console.log('[createSubproject] 开始获取文献查找子项目...');
                // 获取所有文献查找子项目
                const literatureSubprojects = await window.SubprojectManager.getSubprojectsByType(projectName, 'literatureSearch');
                console.log('[createSubproject] 找到文献查找子项目数量:', literatureSubprojects.length);
                
                if (literatureSubprojects.length === 0) {
                    console.log('[createSubproject] 没有文献查找子项目，显示提示');
                    alert('当前项目中没有文献查找子项目，请先创建文献查找子项目！');
                    return;
                }
                
                // 显示选择对话框
                console.log('[createSubproject] 准备显示选择对话框...');
                const selectedIds = await showSelectLiteratureSubprojectsDialog(literatureSubprojects);
                console.log('[createSubproject] 选择对话框返回结果:', selectedIds);
                if (!selectedIds || selectedIds.length === 0) {
                    console.log('[createSubproject] 用户取消或未选择，退出');
                    return; // 用户取消或未选择
                }
                selectedSourceSubprojectIds = selectedIds;
                console.log('[createSubproject] 已选择文献查找子项目:', selectedSourceSubprojectIds);
            }
            
            // 使用模态对话框获取子项目名称
            const name = await window.electronAPI.showInputDialog({
                title: `新建${typeName}子项目`,
                message: `请输入${typeName}子项目的名称:`,
                defaultValue: `${typeName}子项目`
            });
            if (!name || !name.trim()) {
                return;
            }
            
            const trimmedName = name.trim();
            
            // 检查名称是否重复（仅针对文献查找子项目）
            if (type === 'literatureSearch' && window.SubprojectManager) {
                const existingSubprojects = await window.SubprojectManager.getSubprojectsByType(projectName, type);
                const duplicate = existingSubprojects.find(sp => sp.name === trimmedName);
                if (duplicate) {
                    alert(`子项目名称"${trimmedName}"已存在，不能重复！\n\n请使用其他名称。`);
                    return;
                }
            }
            
            // 文献查找子项目不需要描述，综述撰写子项目需要描述
            let description = '';
            if (type === 'reviewWriting') {
                // 使用模态对话框获取子项目描述（可选）
                const desc = await window.electronAPI.showInputDialog({
                    title: `新建${typeName}子项目`,
                    message: `请输入${typeName}子项目的描述（可选，直接点击确定跳过）:`,
                    defaultValue: ''
                });
                description = desc ? desc.trim() : '';
            }
            
            // 调用子项目管理器创建子项目
            if (window.SubprojectManager) {
                const subproject = await window.SubprojectManager.createSubproject(
                    projectName, 
                    type, 
                    trimmedName, 
                    description
                );
                
                // 如果是综述撰写子项目，整理并保存文献
                if (type === 'reviewWriting' && selectedSourceSubprojectIds.length > 0) {
                    // 从关联的文献查找子项目中获取并整理文献
                    const allSelectedLiterature = [];
                    
                    for (const sourceSubprojectId of selectedSourceSubprojectIds) {
                        const sourceSubproject = await window.SubprojectManager.getSubprojectData(
                            projectName,
                            sourceSubprojectId
                        );
                        
                        if (sourceSubproject && sourceSubproject.type === 'literatureSearch') {
                            const selectedLit = sourceSubproject.node4?.selectedLiterature || [];
                            if (selectedLit.length > 0) {
                                allSelectedLiterature.push(...selectedLit);
                            }
                        }
                    }
                    
                    // 去重（基于文献ID或标题+URL），并添加初始编号
                    const uniqueLiterature = [];
                    const seen = new Set();
                    for (const lit of allSelectedLiterature) {
                        const key = lit.id || `${lit.title}_${lit.url || ''}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            // 添加初始编号（创建时的顺序）
                            const literatureWithIndex = {
                                ...lit,
                                initialIndex: uniqueLiterature.length + 1,
                                actualIndex: null // 真正编号在生成综述后设置
                            };
                            uniqueLiterature.push(literatureWithIndex);
                        }
                    }
                    
                    // 保存选中的文献查找子项目ID和整理后的文献
                    await window.SubprojectManager.updateSubproject(projectName, subproject.id, {
                        sourceSubprojectIds: selectedSourceSubprojectIds,
                        literature: uniqueLiterature  // 保存整理后的文献列表
                    });
                    
                    if (uniqueLiterature.length > 0) {
                        showToast(`${typeName}子项目"${trimmedName}"创建成功，已导入 ${uniqueLiterature.length} 篇文献`);
                    } else {
                        showToast(`${typeName}子项目"${trimmedName}"创建成功（关联的文献查找子项目暂无已选文献）`);
                    }
                } else {
                    showToast(`${typeName}子项目"${trimmedName}"创建成功`);
                }
                
                // 刷新项目详情
                await showProjectDetail(projectName);
            } else {
                alert('子项目管理器未加载，请刷新页面重试');
            }
        } catch (e) {
            console.error('创建子项目失败:', e);
            alert('创建子项目失败: ' + e.message);
        }
    }
    
    // 显示选择文献查找子项目的对话框
    function showSelectLiteratureSubprojectsDialog(literatureSubprojects) {
        console.log('[showSelectLiteratureSubprojectsDialog] ========== 开始显示选择对话框 ==========');
        console.log('[showSelectLiteratureSubprojectsDialog] 文献查找子项目数量:', literatureSubprojects.length);
        
        return new Promise((resolve) => {
            const modal = document.getElementById('select-literature-subprojects-modal');
            const listContainer = document.getElementById('literature-subprojects-list');
            const errorMsg = document.getElementById('select-subprojects-error');
            const okBtn = document.getElementById('select-subprojects-ok');
            const cancelBtn = document.getElementById('select-subprojects-cancel');
            
            console.log('[showSelectLiteratureSubprojectsDialog] 查找DOM元素:');
            console.log('[showSelectLiteratureSubprojectsDialog] modal:', !!modal);
            console.log('[showSelectLiteratureSubprojectsDialog] listContainer:', !!listContainer);
            console.log('[showSelectLiteratureSubprojectsDialog] errorMsg:', !!errorMsg);
            console.log('[showSelectLiteratureSubprojectsDialog] okBtn:', !!okBtn);
            console.log('[showSelectLiteratureSubprojectsDialog] cancelBtn:', !!cancelBtn);
            
            if (!modal || !listContainer || !okBtn || !cancelBtn) {
                console.error('[showSelectLiteratureSubprojectsDialog] 必需的DOM元素不存在！');
                resolve([]);
                return;
            }
            
            // 清空列表
            listContainer.innerHTML = '';
            console.log('[showSelectLiteratureSubprojectsDialog] 列表已清空');
            
            // 存储选中的ID
            const selectedIds = new Set();
            
            // 生成子项目列表
            literatureSubprojects.forEach(subproject => {
                const item = document.createElement('div');
                item.style.cssText = 'padding: 10px; margin-bottom: 8px; border: 1px solid #e0e0e0; border-radius: 4px; cursor: pointer; transition: all 0.2s;';
                
                // 获取子项目状态信息
                const status = subproject.status || 'pending';
                const statusText = {
                    'pending': '待开始',
                    'active': '进行中',
                    'completed': '已完成'
                }[status] || '未知';
                
                // 获取文献数量
                let literatureCount = '未完成';
                if (subproject.node4 && subproject.node4.status === 'completed' && subproject.node4.selectedLiterature && Array.isArray(subproject.node4.selectedLiterature)) {
                    literatureCount = `${subproject.node4.selectedLiterature.length} 篇`;
                } else if (subproject.node3 && subproject.node3.status === 'completed' && subproject.node3.allLiterature && Array.isArray(subproject.node3.allLiterature)) {
                    literatureCount = `补全中 (${subproject.node3.allLiterature.length} 篇)`;
                } else if (subproject.node2 && subproject.node2.status === 'completed' && subproject.node2.searchResults) {
                    const totalCount = Object.values(subproject.node2.searchResults).reduce((sum, results) => sum + (Array.isArray(results) ? results.length : 0), 0);
                    if (totalCount > 0) {
                        literatureCount = `搜索中 (${totalCount} 篇)`;
                    }
                }
                
                item.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input type="checkbox" id="subproject-${subproject.id}" value="${subproject.id}" style="width: 18px; height: 18px; cursor: pointer;">
                        <label for="subproject-${subproject.id}" style="flex: 1; cursor: pointer; margin: 0;">
                            <div style="font-weight: 600; color: #333; margin-bottom: 4px;">${escapeHtml(subproject.name || '未命名')}</div>
                            <div style="font-size: 12px; color: #666;">
                                <span>状态: ${statusText}</span>
                                <span style="margin-left: 15px;">文献数: ${literatureCount}</span>
                            </div>
                        </label>
                    </div>
                `;
                
                // 点击整个项目区域也可以切换选中状态
                item.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        const checkbox = item.querySelector('input[type="checkbox"]');
                        checkbox.checked = !checkbox.checked;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                });
                
                // 复选框变化事件
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedIds.add(subproject.id);
                        item.style.background = '#f0f9ff';
                        item.style.borderColor = '#3b82f6';
                    } else {
                        selectedIds.delete(subproject.id);
                        item.style.background = '';
                        item.style.borderColor = '#e0e0e0';
                    }
                    
                    // 更新错误提示
                    errorMsg.style.display = 'none';
                });
                
                listContainer.appendChild(item);
            });
            
            // 显示模态框
            console.log('[showSelectLiteratureSubprojectsDialog] 准备显示模态框');
            modal.classList.remove('hidden');
            modal.classList.add('show');
            modal.setAttribute('aria-hidden', 'false');
            console.log('[showSelectLiteratureSubprojectsDialog] 模态框已显示，类名:', modal.className);
            
            // 确定按钮
            const handleOk = () => {
                console.log('[showSelectLiteratureSubprojectsDialog] 确定按钮被点击');
                console.log('[showSelectLiteratureSubprojectsDialog] 已选择的数量:', selectedIds.size);
                if (selectedIds.size === 0) {
                    console.log('[showSelectLiteratureSubprojectsDialog] 未选择任何项目，显示错误提示');
                    if (errorMsg) {
                        errorMsg.style.display = 'block';
                        errorMsg.classList.remove('hidden');
                    }
                    return;
                }
                
                const selectedArray = Array.from(selectedIds);
                console.log('[showSelectLiteratureSubprojectsDialog] 返回选中的ID:', selectedArray);
                modal.classList.remove('show');
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
                resolve(selectedArray);
                
                // 清理事件监听
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
            };
            
            // 取消按钮
            const handleCancel = () => {
                console.log('[showSelectLiteratureSubprojectsDialog] 取消按钮被点击');
                modal.classList.remove('show');
                modal.classList.add('hidden');
                modal.setAttribute('aria-hidden', 'true');
                resolve([]);
                
                // 清理事件监听
                okBtn.removeEventListener('click', handleOk);
                cancelBtn.removeEventListener('click', handleCancel);
            };
            
            console.log('[showSelectLiteratureSubprojectsDialog] 绑定按钮事件监听器');
            okBtn.addEventListener('click', handleOk);
            cancelBtn.addEventListener('click', handleCancel);
            console.log('[showSelectLiteratureSubprojectsDialog] 事件监听器已绑定，等待用户操作...');
        });
    }
    
    // 删除子项目
    async function deleteSubproject(projectName, subprojectId) {
        if (!window.electronAPI) return;
        try {
            // 获取子项目信息
            let subprojectName = '该子项目';
            if (window.SubprojectManager) {
                const subproject = await window.SubprojectManager.getSubprojectData(projectName, subprojectId);
                if (subproject) {
                    subprojectName = subproject.name || subprojectName;
                }
            }
            
            const confirmed = confirm(`确定要删除子项目"${subprojectName}"吗？\n\n此操作不可恢复。`);
            if (!confirmed) {
                return;
            }
            
            // 调用子项目管理器删除子项目
            if (window.SubprojectManager) {
                await window.SubprojectManager.deleteSubproject(projectName, subprojectId);
                showToast(`子项目"${subprojectName}"已删除`);
                
                // 刷新项目详情
                await showProjectDetail(projectName);
            } else {
                alert('子项目管理器未加载，请刷新页面重试');
            }
        } catch (e) {
            console.error('删除子项目失败:', e);
            alert('删除子项目失败: ' + e.message);
        }
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
