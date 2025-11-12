// 节点1：关键词分析模块
window.Node1Keywords = {
    // 自动执行关键词分析
    async execute(apiKey, requirementData, apiProvider = 'deepseek', modelName = null) {
        console.log('[Node1Keywords.execute] ========== STARTING EXECUTE ==========');
        console.log('[Node1Keywords.execute] Parameters:', {
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0,
            hasRequirementData: !!requirementData,
            requirement: requirementData ? requirementData.requirement : 'N/A',
            targetCount: requirementData ? requirementData.targetCount : 'N/A',
            outline: requirementData ? requirementData.outline : 'N/A'
        });
        
        const targetCount = requirementData.targetCount;
        console.log('[Node1Keywords.execute] Target count:', targetCount);
        
        const prompt = `根据以下文献综述大纲和文献数量要求，提取用于搜索文献的关键词，并为每个关键词分配文献查询数量。

大纲：
${requirementData.outline}

目标文献数量：${targetCount}篇

要求：
1. 根据大纲中的章节和主题，提取关键词。每个关键词必须是英文的专业术语或短语，适合在Google Scholar中搜索
2. 为每个关键词分配文献查询数量，所有关键词的查询数量总和必须等于${targetCount}篇
3. 根据关键词的重要性和覆盖面合理分配数量
4. 关键词应该覆盖大纲中的各个主要研究方向
5. 所有关键词必须是英文，不要使用中文

请以JSON格式返回结果：
{
  "keywords": [
    {"keyword": "关键词1", "count": 10},
    {"keyword": "关键词2", "count": 15}
  ]
}

注意：
- 所有count的总和必须等于${targetCount}
- 只返回JSON，不要添加任何其他文字说明`;

        console.log('[Node1Keywords.execute] Calling API.callAPI...');
        const content = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7, modelName);
        console.log('[Node1Keywords.execute] API returned, content length:', content ? content.length : 0);
        console.log('[Node1Keywords.execute] Content preview:', content ? content.substring(0, 200) : 'N/A');
        
        // 解析JSON
        console.log('[Node1Keywords.execute] Parsing JSON...');
        let jsonStr = content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            const objMatch = content.match(/\{[\s\S]*\}/);
            if (objMatch) jsonStr = objMatch[0];
        }

        const result = JSON.parse(jsonStr);
        console.log('[Node1Keywords.execute] JSON parsed successfully:', {
            hasKeywords: !!result.keywords,
            keywordsLength: result.keywords ? result.keywords.length : 0
        });
        
        // 验证和调整数量
        console.log('[Node1Keywords.execute] Validating and adjusting counts...');
        if (result.keywords && Array.isArray(result.keywords)) {
            const totalCount = result.keywords.reduce((sum, item) => sum + (item.count || 0), 0);
            if (Math.abs(totalCount - targetCount) > 2) {
                const ratio = targetCount / totalCount;
                result.keywords.forEach(item => {
                    item.count = Math.round(item.count * ratio);
                });
                const newTotal = result.keywords.reduce((sum, item) => sum + item.count, 0);
                const diff = targetCount - newTotal;
                if (diff !== 0 && result.keywords.length > 0) {
                    result.keywords[0].count += diff;
                }
            }
            return result.keywords;
        }
        
        throw new Error('AI返回格式不正确');
    },

    // 显示关键词计划
    // editable: true=编辑模式（用户点击节点进入），false=只读模式（自动执行时）
    display(keywordsPlan, editable = false) {
        console.log('[Node1Keywords.display] Called with:', {
            keywordsPlanLength: keywordsPlan ? keywordsPlan.length : 0,
            keywordsPlan: keywordsPlan,
            editable: editable
        });
        
        const container = document.getElementById('keywords-list');
        console.log('[Node1Keywords.display] Container element:', {
            exists: !!container,
            id: container ? container.id : 'N/A',
            currentDisplay: container ? window.getComputedStyle(container).display : 'N/A',
            currentVisibility: container ? window.getComputedStyle(container).visibility : 'N/A',
            currentInnerHTML: container ? container.innerHTML.substring(0, 100) : 'N/A'
        });
        
        if (!container) {
            console.error('[Node1Keywords.display] ERROR: keywords-list container not found!');
            return;
        }
        
        container.innerHTML = '';
        console.log('[Node1Keywords.display] Container cleared');
        
        if (editable) {
            // 编辑模式：显示可编辑表格和编辑按钮
            console.log('[Node1Keywords.display] Calling displayEditable...');
            this.displayEditable(keywordsPlan);
        } else {
            // 只读模式：显示纯文本表格，支持折叠/展开
            console.log('[Node1Keywords.display] Calling displayReadOnly...');
            this.displayReadOnly(keywordsPlan);
        }
        
        // 检查显示后的状态
        setTimeout(() => {
            const finalContent = container.innerHTML;
            console.log('[Node1Keywords.display] After display, container content:', {
                hasContent: finalContent.trim().length > 0,
                contentLength: finalContent.length,
                contentPreview: finalContent.substring(0, 300),
                containerDisplay: window.getComputedStyle(container).display,
                containerVisibility: window.getComputedStyle(container).visibility
            });
        }, 50);
    },

    // 只读模式显示（自动执行时，只展示结果，无展开/隐藏功能）
    displayReadOnly(keywordsPlan) {
        console.log('[Node1Keywords.displayReadOnly] Called with:', {
            keywordsPlanLength: keywordsPlan ? keywordsPlan.length : 0,
            keywordsPlan: keywordsPlan
        });
        
        const container = document.getElementById('keywords-list');
        if (!container) {
            console.error('[Node1Keywords.displayReadOnly] ERROR: Container not found!');
            return;
        }
        
        console.log('[Node1Keywords.displayReadOnly] Building HTML table...');
        // 直接显示完整表格，不设置展开/隐藏
        let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
        html += '<thead><tr style="background: #f0f0f0;">';
        html += '<th style="padding: 10px; text-align: left; border: 1px solid #ddd;">关键词</th>';
        html += '<th style="padding: 10px; text-align: center; border: 1px solid #ddd;">查询数量</th>';
        html += '</tr></thead>';
        html += '<tbody>';
        
        keywordsPlan.forEach((item) => {
            html += `<tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; border: 1px solid #ddd;">${this.escapeHtml(item.keyword || '')}</td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${item.count || 0}篇</td>
            </tr>`;
        });
        
        const totalCount = keywordsPlan.reduce((sum, item) => sum + (item.count || 0), 0);
        html += `<tr style="background: #f8f9fa; font-weight: bold;">
            <td style="padding: 10px; border: 1px solid #ddd;">总计</td>
            <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">${totalCount}篇</td>
        </tr>`;
        html += '</tbody></table>';
        
        // 摘要信息
        html += '<div id="keywords-summary" style="padding: 10px; background: #f8f9fa; border-radius: 4px; margin-top: 10px;">';
        html += `<p style="margin: 0;"><strong>关键词数量：</strong>${keywordsPlan.length}个</p>`;
        html += `<p style="margin: 5px 0 0 0;"><strong>总查询数量：</strong>${totalCount}篇</p>`;
        html += '</div>';
        
        console.log('[Node1Keywords.displayReadOnly] HTML generated, length:', html.length);
        console.log('[Node1Keywords.displayReadOnly] Setting container.innerHTML...');
        container.innerHTML = html;
        console.log('[Node1Keywords.displayReadOnly] Container innerHTML set. Verifying...');
        
        // 验证设置是否成功
        setTimeout(() => {
            const verifyContent = container.innerHTML;
            console.log('[Node1Keywords.displayReadOnly] Verification:', {
                hasContent: verifyContent.trim().length > 0,
                contentLength: verifyContent.length,
                matchesGenerated: verifyContent.length === html.length,
                containerDisplay: window.getComputedStyle(container).display,
                containerVisibility: window.getComputedStyle(container).visibility,
                containerParent: container.parentElement ? {
                    id: container.parentElement.id,
                    display: window.getComputedStyle(container.parentElement).display,
                    visibility: window.getComputedStyle(container.parentElement).visibility
                } : 'No parent'
            });
        }, 10);
    },

    // 编辑模式显示（用户点击节点进入）
    displayEditable(keywordsPlan) {
        const container = document.getElementById('keywords-list');
        if (!container) return;
        
        // 创建可编辑表格
        let html = '<div style="margin-bottom: 15px;">';
        html += '<button id="add-keyword-btn" class="btn btn-primary" style="margin-right: 10px;">+ 添加关键词</button>';
        html += '<button id="save-keywords-btn" class="btn btn-success" style="margin-right: 10px;">保存修改</button>';
        html += '</div>';
        
        html += '<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">';
        html += '<thead><tr style="background: #f0f0f0;">';
        html += '<th style="padding: 10px; text-align: left; border: 1px solid #ddd;">关键词</th>';
        html += '<th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 150px;">查询数量</th>';
        html += '<th style="padding: 10px; text-align: center; border: 1px solid #ddd; width: 80px;">操作</th>';
        html += '</tr></thead>';
        html += '<tbody id="keywords-table-body">';
        
        keywordsPlan.forEach((item, index) => {
            html += `<tr data-index="${index}" style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px; border: 1px solid #ddd;">
                    <input type="text" class="keyword-input" value="${this.escapeHtml(item.keyword || '')}" 
                           style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;" 
                           data-index="${index}">
                </td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
                    <input type="number" class="count-input" value="${item.count || 0}" min="1" 
                           style="width: 80px; padding: 5px; border: 1px solid #ccc; border-radius: 4px; text-align: center;" 
                           data-index="${index}">
                    <span>篇</span>
                </td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
                    <button class="delete-keyword-btn" data-index="${index}" 
                            style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">删除</button>
                </td>
            </tr>`;
        });
        
        html += '</tbody>';
        
        // 总计行
        const totalCount = keywordsPlan.reduce((sum, item) => sum + (item.count || 0), 0);
        html += `<tfoot><tr style="background: #f8f9fa; font-weight: bold;">
            <td style="padding: 10px; border: 1px solid #ddd;">总计</td>
            <td style="padding: 10px; text-align: center; border: 1px solid #ddd;" id="keywords-total">${totalCount}篇</td>
            <td style="padding: 10px; border: 1px solid #ddd;"></td>
        </tfoot>`;
        html += '</table>';
        
        container.innerHTML = html;
        
        // 绑定事件
        this.bindEditEvents(keywordsPlan);
    },

    // 绑定编辑事件
    bindEditEvents(originalPlan) {
        // 添加关键词按钮
        const addBtn = document.getElementById('add-keyword-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const tbody = document.getElementById('keywords-table-body');
                if (!tbody) return;
                
                const newIndex = tbody.children.length;
                const newRow = document.createElement('tr');
                newRow.setAttribute('data-index', newIndex);
                newRow.style.borderBottom = '1px solid #eee';
                newRow.innerHTML = `
                    <td style="padding: 10px; border: 1px solid #ddd;">
                        <input type="text" class="keyword-input" value="" 
                               style="width: 100%; padding: 5px; border: 1px solid #ccc; border-radius: 4px;" 
                               data-index="${newIndex}">
                    </td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
                        <input type="number" class="count-input" value="5" min="1" 
                               style="width: 80px; padding: 5px; border: 1px solid #ccc; border-radius: 4px; text-align: center;" 
                               data-index="${newIndex}">
                        <span>篇</span>
                    </td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
                        <button class="delete-keyword-btn" data-index="${newIndex}" 
                                style="background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">删除</button>
                    </td>
                `;
                tbody.appendChild(newRow);
                
                // 重新绑定删除按钮事件
                const deleteBtn = newRow.querySelector('.delete-keyword-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        newRow.remove();
                        this.updateTotal();
                    });
                }
                
                // 重新绑定输入框事件
                const countInput = newRow.querySelector('.count-input');
                if (countInput) {
                    countInput.addEventListener('input', () => this.updateTotal());
                }
            });
        }
        
        // 删除按钮
        document.querySelectorAll('.delete-keyword-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.getAttribute('data-index');
                const row = document.querySelector(`tr[data-index="${index}"]`);
                if (row) {
                    row.remove();
                    this.updateTotal();
                }
            });
        });
        
        // 数量输入框变化时更新总计
        document.querySelectorAll('.count-input').forEach(input => {
            input.addEventListener('input', () => this.updateTotal());
        });
        
        // 保存按钮
        const saveBtn = document.getElementById('save-keywords-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveKeywords();
            });
        }
        
    },

    // 更新总计
    updateTotal() {
        const totalEl = document.getElementById('keywords-total');
        if (!totalEl) return;
        
        let total = 0;
        document.querySelectorAll('.count-input').forEach(input => {
            const value = parseInt(input.value) || 0;
            total += value;
        });
        
        totalEl.textContent = `${total}篇`;
    },

    // 保存关键词
    saveKeywords() {
        const keywordsPlan = [];
        const rows = document.querySelectorAll('#keywords-table-body tr');
        
        rows.forEach(row => {
            const keywordInput = row.querySelector('.keyword-input');
            const countInput = row.querySelector('.count-input');
            
            if (keywordInput && countInput) {
                const keyword = keywordInput.value.trim();
                const count = parseInt(countInput.value) || 0;
                
                if (keyword && count > 0) {
                    keywordsPlan.push({ keyword, count });
                }
            }
        });
        
        if (keywordsPlan.length === 0) {
            window.UIUtils.showToast('至少需要添加一个关键词', 'error');
            return;
        }
        
        // 更新状态（确保keywords和keywordsPlan同步）
        if (window.WorkflowManager) {
            window.WorkflowManager.state.requirementData.keywordsPlan = keywordsPlan;
            // keywords应该是字符串数组，从keywordsPlan中提取
            window.WorkflowManager.state.keywords = keywordsPlan.map(item => item.keyword);
            
            // 保存到节点1数据（使用标准节点格式）
            window.WorkflowManager.saveNodeData(1, {
                keywords: window.WorkflowManager.state.keywords,
                keywordsPlan: keywordsPlan
            }).then(() => {
                window.UIUtils.showToast('关键词已保存', 'success');
            }).catch(error => {
                console.error('保存关键词失败:', error);
                window.UIUtils.showToast('保存失败: ' + error.message, 'error');
            });
        }
    },

    // HTML转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

