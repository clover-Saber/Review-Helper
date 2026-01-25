// 节点1：关键词分析模块
window.Node1Keywords = {
    // 自动执行关键词分析
    async execute(apiKey, requirementData, apiProvider = 'deepseek', modelName = null, config = {}) {
        console.log('[Node1Keywords.execute] ========== STARTING EXECUTE ==========');
        console.log('[Node1Keywords.execute] Parameters:', {
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey ? apiKey.length : 0,
            hasRequirementData: !!requirementData,
            requirement: requirementData ? requirementData.requirement : 'N/A',
            targetCount: requirementData ? requirementData.targetCount : 'N/A',
            language: requirementData ? requirementData.language : 'N/A',
            config: config
        });
        
        const targetCount = requirementData.targetCount || 50;
        const language = requirementData.language || 'zh';
        const yearLimit = config.yearLimit || { recentYears: 5, percentage: 60 };
        const literatureSource = config.literatureSource || 'google-scholar';
        const keywordCount = Math.min(Math.max(parseInt(config.initialScreening?.keywordCount || requirementData?.initialScreening?.keywordCount || 10, 10) || 10, 1), 20);
        const perKeywordCount = Math.max(parseInt(config.initialScreening?.perKeywordCount || requirementData?.initialScreening?.perKeywordCount || 20, 10) || 20, 1);
        
        console.log('[Node1Keywords.execute] Config:', {
            targetCount,
            language,
            yearLimit,
            literatureSource,
            initialScreening: { keywordCount, perKeywordCount }
        });
        
        // 根据语言确定关键词语言
        const keywordLanguage = language === 'en' ? '英文' : '中文';
        const keywordLanguageInstruction = language === 'en' 
            ? '所有关键词必须是英文的专业术语或短语，适合在Google Scholar中搜索'
            : '所有关键词必须是中文的专业术语或短语，适合在Google Scholar中搜索中文文献';
        
        // 构建年份限制说明
        const yearLimitText = yearLimit.recentYears && yearLimit.percentage 
            ? `\n年份限制：搜索结果中${yearLimit.percentage}%的文献应该是最近${yearLimit.recentYears}年发表的`
            : '';
        
        const prompt = `你是一个专业的文献检索助手。请根据用户的文献查找需求，生成用于搜索文献的关键词列表。

用户需求描述：
${requirementData.requirement || '未提供'}

查找配置：
- 文献语言：${language === 'en' ? '英文' : '中文'}
- 文献来源库：${literatureSource === 'google-scholar' ? 'Google Scholar（谷歌学术）' : literatureSource === 'lanfanshu' ? '烂番薯学术' : literatureSource}${yearLimitText}

要求：
1. 根据用户需求描述，生成${keywordCount}个不同的关键词。${keywordLanguageInstruction}
2. 每个关键词都应该是一个比较具体的专业短语，而不是多个短语
3. 关键词应该覆盖需求描述中的各个主要研究方向，确保全面性
4. 关键词之间应该有所区别，避免重复或过于相似
5. 如果配置了年份限制，需要考虑时间因素，为每个关键词设置合适的时间限制（minYear字段）

请以JSON格式返回结果：
{
  "keywords": [
    {
      "keyword": "关键词1",
      "minYear": 2020
    },
    {
      "keyword": "关键词2",
      "minYear": 2019
    }
  ]
}

注意：
- 必须返回恰好${keywordCount}个关键词
- 如果配置了年份限制（近${yearLimit.recentYears}年占${yearLimit.percentage}%），则大部分关键词的minYear应该设置为最近${yearLimit.recentYears}年内的年份
- minYear字段表示该关键词搜索时的最小年份限制（可选，如果不设置则使用全局年份限制）
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
        
        // 验证和调整关键词
        console.log('[Node1Keywords.execute] Validating and adjusting keywords...');
        if (result.keywords && Array.isArray(result.keywords)) {
            // 确保每个关键词都有必要的字段
            result.keywords = result.keywords.map(item => {
                if (!item.keyword || item.keyword.trim().length === 0) {
                    return null; // 过滤掉无效的关键词
                }
                return {
                    keyword: item.keyword.trim(),
                    minYear: item.minYear || null, // 时间限制（可选）
                    // 每个关键词搜索数量：与步骤2严格对齐（通过翻页获取）
                    count: perKeywordCount
                };
            }).filter(item => item !== null);
            
            // 确保关键词数量符合配置
            if (result.keywords.length < keywordCount) {
                console.warn(`[Node1Keywords.execute] 关键词数量不足${keywordCount}个（${result.keywords.length}个），将使用现有关键词`);
            } else if (result.keywords.length > keywordCount) {
                console.warn(`[Node1Keywords.execute] 关键词数量超过${keywordCount}个（${result.keywords.length}个），将只使用前${keywordCount}个`);
                result.keywords = result.keywords.slice(0, keywordCount);
            }
            
            // 如果没有设置minYear，根据年份限制配置设置默认值
            if (yearLimit && yearLimit.recentYears && yearLimit.percentage) {
                const currentYear = new Date().getFullYear();
                const recentYearThreshold = currentYear - yearLimit.recentYears;
                const recentCount = Math.ceil(result.keywords.length * yearLimit.percentage / 100);
                
                result.keywords.forEach((item, index) => {
                    if (!item.minYear) {
                        // 前recentCount个关键词设置为最近N年，其他的不设置时间限制
                        if (index < recentCount) {
                            item.minYear = recentYearThreshold;
                        }
                    }
                });
            }
            
            console.log('[Node1Keywords.execute] Final keywords:', result.keywords);
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
        
        console.log('[Node1Keywords.displayReadOnly] Building HTML...');
        // 使用卡片式布局，每个关键词独占一行
        let html = '<div style="margin-top: 10px;">';
        
        keywordsPlan.forEach((item, index) => {
            const minYearText = item.minYear ? `${item.minYear}年及以后` : '无限制';
            const perKeywordCount =
                Math.min(
                    Math.max(
                        parseInt(
                            item.count ??
                            window.WorkflowManager?.state?.requirementData?.initialScreening?.perKeywordCount ??
                            window.WorkflowManager?.state?.currentSubproject?.config?.initialScreening?.perKeywordCount ??
                            20,
                            10
                        ) || 20,
                        1
                    ),
                    20
                );
            html += `<div style="margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 12px;">
                    <div style="font-size: 16px; font-weight: 600; color: #1f2937; line-height: 1.6; word-break: break-word;">
                        <span style="display: inline-block; padding: 6px 12px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px; margin-right: 8px;">${index + 1}</span>
                        <span style="color: #1f2937;">${this.escapeHtml(item.keyword || '')}</span>
                    </div>
                </div>
                <div style="display: flex; gap: 24px; align-items: center; font-size: 14px; color: #6b7280;">
                    <div>
                        <span style="color: #9ca3af; margin-right: 6px;">搜索数量:</span>
                        <span style="color: #1f2937; font-weight: 500;">${perKeywordCount}篇</span>
                    </div>
                    <div>
                        <span style="color: #9ca3af; margin-right: 6px;">时间限制:</span>
                        <span style="color: #1f2937; font-weight: 500;">${minYearText}</span>
                    </div>
                </div>
            </div>`;
        });
        
        html += '</div>';
        
        // 已移除：关键词统计摘要块（用户要求“去掉”）
        
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
        
        // 使用卡片式布局，每个关键词独占一行
        html += '<div style="margin-top: 10px;">';
        html += '<div id="keywords-table-body">';
        
        keywordsPlan.forEach((item, index) => {
            const currentYear = new Date().getFullYear();
            const perKeywordCount =
                Math.min(
                    Math.max(
                        parseInt(
                            item.count ??
                            window.WorkflowManager?.state?.requirementData?.initialScreening?.perKeywordCount ??
                            window.WorkflowManager?.state?.currentSubproject?.config?.initialScreening?.perKeywordCount ??
                            20,
                            10
                        ) || 20,
                        1
                    ),
                    20
                );
            html += `<div data-index="${index}" style="margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 12px;">
                    <input type="text" class="keyword-input" value="${this.escapeHtml(item.keyword || '')}" 
                           style="width: 100%; padding: 10px 14px; border: 2px solid #3b82f6; border-radius: 6px; font-size: 16px; font-weight: 500; color: #1f2937; background: #ffffff; transition: all 0.2s; box-sizing: border-box;" 
                           data-index="${index}"
                           placeholder="请输入关键词">
                </div>
                    <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 14px; color: #6b7280; white-space: nowrap;">搜索数量:</label>
                            <span style="font-size: 14px; color: #1f2937; font-weight: 500;">${perKeywordCount}篇</span>
                        </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-size: 14px; color: #6b7280; white-space: nowrap;">时间限制:</label>
                        <input type="number" class="minyear-input" value="${item.minYear || ''}" min="1900" max="${currentYear}" 
                               placeholder="可选" 
                               style="width: 100px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: 14px;" 
                               data-index="${index}">
                        <span style="font-size: 13px; color: #6b7280;">年及以后</span>
                    </div>
                    <div style="margin-left: auto;">
                        <button class="delete-keyword-btn" data-index="${index}" 
                                style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.2s;"
                                onmouseover="this.style.background='#dc2626'"
                                onmouseout="this.style.background='#ef4444'">删除</button>
                    </div>
                </div>
            </div>`;
        });
        
        html += '</div>';
        
        // 总计行
        html += `<div style="margin-top: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 15px;">
                <span style="font-weight: 600; color: #1f2937;">预计总文献数</span>
                <span style="font-weight: 600; color: #1f2937;">${keywordsPlan.length * Math.max(parseInt(window.WorkflowManager?.state?.requirementData?.initialScreening?.perKeywordCount || window.WorkflowManager?.state?.currentSubproject?.config?.initialScreening?.perKeywordCount || 20, 10) || 20, 1)}篇（去重后可能更少）</span>
            </div>
        </div>`;
        html += '</div>';
        
        container.innerHTML = html;
        
        // 绑定事件
        this.bindEditEvents(keywordsPlan);
        
        // 添加输入框聚焦样式
        setTimeout(() => {
            const keywordInputs = document.querySelectorAll('.keyword-input');
            keywordInputs.forEach(input => {
                input.addEventListener('focus', function() {
                    this.style.borderColor = '#2563eb';
                    this.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                    this.style.background = '#f8fafc';
                });
                input.addEventListener('blur', function() {
                    this.style.borderColor = '#3b82f6';
                    this.style.boxShadow = 'none';
                    this.style.background = '#ffffff';
                });
            });
        }, 100);
    },

    // 绑定编辑事件
    bindEditEvents(originalPlan) {
        // 添加关键词按钮
        const addBtn = document.getElementById('add-keyword-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const container = document.getElementById('keywords-table-body');
                if (!container) return;
                
                const newIndex = container.children.length;
                const newCard = document.createElement('div');
                newCard.setAttribute('data-index', newIndex);
                const currentYear = new Date().getFullYear();
                const perKeywordCount =
                    Math.min(
                        Math.max(
                            parseInt(
                                window.WorkflowManager?.state?.requirementData?.initialScreening?.perKeywordCount ??
                                window.WorkflowManager?.state?.currentSubproject?.config?.initialScreening?.perKeywordCount ??
                                20,
                                10
                            ) || 20,
                            1
                        ),
                        20
                    );
                newCard.style.cssText = 'margin-bottom: 16px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
                newCard.innerHTML = `
                    <div style="margin-bottom: 12px;">
                        <input type="text" class="keyword-input" value="" 
                               style="width: 100%; padding: 10px 14px; border: 2px solid #3b82f6; border-radius: 6px; font-size: 16px; font-weight: 500; color: #1f2937; background: #ffffff; transition: all 0.2s; box-sizing: border-box;" 
                               data-index="${newIndex}"
                               placeholder="请输入关键词">
                    </div>
                    <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 14px; color: #6b7280; white-space: nowrap;">搜索数量:</label>
                            <span style="font-size: 14px; color: #1f2937; font-weight: 500;">${perKeywordCount}篇</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <label style="font-size: 14px; color: #6b7280; white-space: nowrap;">时间限制:</label>
                            <input type="number" class="minyear-input" value="" min="1900" max="${currentYear}" 
                                   placeholder="可选" 
                                   style="width: 100px; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; text-align: center; font-size: 14px;" 
                                   data-index="${newIndex}">
                            <span style="font-size: 13px; color: #6b7280;">年及以后</span>
                        </div>
                        <div style="margin-left: auto;">
                            <button class="delete-keyword-btn" data-index="${newIndex}" 
                                    style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; transition: background 0.2s;"
                                    onmouseover="this.style.background='#dc2626'"
                                    onmouseout="this.style.background='#ef4444'">删除</button>
                        </div>
                    </div>
                `;
                container.appendChild(newCard);
                
                // 重新绑定删除按钮事件
                const deleteBtn = newCard.querySelector('.delete-keyword-btn');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        newCard.remove();
                        this.updateTotal();
                    });
                }
                
                // 重新绑定输入框事件
                const countInput = newCard.querySelector('.count-input');
                if (countInput) {
                    countInput.addEventListener('input', () => this.updateTotal());
                }
                
                // 绑定关键词输入框聚焦样式
                const keywordInput = newCard.querySelector('.keyword-input');
                if (keywordInput) {
                    keywordInput.addEventListener('focus', function() {
                        this.style.borderColor = '#2563eb';
                        this.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        this.style.background = '#f8fafc';
                    });
                    keywordInput.addEventListener('blur', function() {
                        this.style.borderColor = '#3b82f6';
                        this.style.boxShadow = 'none';
                        this.style.background = '#ffffff';
                    });
                }
            });
        }
        
        // 删除按钮
        document.querySelectorAll('.delete-keyword-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.getAttribute('data-index');
                const card = document.querySelector(`div[data-index="${index}"]`);
                if (card) {
                    card.remove();
                    this.updateTotal();
                }
            });
        });
        
        // 不再需要更新总计（因为每个关键词固定搜索100篇）
        
        // 保存按钮
        const saveBtn = document.getElementById('save-keywords-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveKeywords();
            });
        }
        
    },

    // 更新总计（不再需要，因为每个关键词固定搜索100篇）
    updateTotal() {
        // 已废弃：每个关键词固定搜索100篇
    },

    // 保存关键词
    saveKeywords() {
        const keywordsPlan = [];
        const cards = document.querySelectorAll('#keywords-table-body > div[data-index]');
        const perKeywordCount =
            Math.min(
                Math.max(
                    parseInt(
                        window.WorkflowManager?.state?.requirementData?.initialScreening?.perKeywordCount ??
                        window.WorkflowManager?.state?.currentSubproject?.config?.initialScreening?.perKeywordCount ??
                        20,
                        10
                    ) || 20,
                    1
                ),
                20
            );
        
        cards.forEach(card => {
            const keywordInput = card.querySelector('.keyword-input');
            const minYearInput = card.querySelector('.minyear-input');
            
            if (keywordInput) {
                const keyword = keywordInput.value.trim();
                const minYear = minYearInput ? (minYearInput.value.trim() ? parseInt(minYearInput.value) : null) : null;
                
                if (keyword) {
                    keywordsPlan.push({ 
                        keyword,
                        minYear: minYear || null,
                        count: perKeywordCount
                    });
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
