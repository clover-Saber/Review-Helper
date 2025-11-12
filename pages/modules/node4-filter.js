// 节点4：精选文献模块
window.Node4Filter = {
    // 自动执行文献筛选
    async execute(apiKey, allLiterature, requirement, targetCount, onProgress, apiProvider = 'deepseek', modelName = null) {
        // 数据验证
        if (!allLiterature || !Array.isArray(allLiterature)) {
            console.error('节点4执行失败: allLiterature不是数组或为空');
            return {
                selectedLiterature: [],
                relevantCount: 0,
                irrelevantCount: 0,
                total: 0
            };
        }
        
        if (!requirement || !requirement.trim()) {
            console.error('节点4执行失败: requirement为空');
            return {
                selectedLiterature: [],
                relevantCount: 0,
                irrelevantCount: 0,
                total: allLiterature.length
            };
        }
        
        let selectedLiterature = [];
        const total = allLiterature.length;
        let relevantCount = 0;
        let irrelevantCount = 0;

        for (let i = 0; i < allLiterature.length; i++) {
            // 检查是否应该停止
            if (window.WorkflowManager && window.WorkflowManager.state && window.WorkflowManager.state.shouldStop) {
                console.log('[节点4筛选] 检测到停止信号，中断筛选');
                break;
            }
            
            const lit = allLiterature[i];
            
            // 更新进度
            if (onProgress) {
                onProgress(i + 1, total, lit.title || '未知标题', 'AI判断中...');
            }
            
            // 再次检查停止标志
            if (window.WorkflowManager && window.WorkflowManager.state && window.WorkflowManager.state.shouldStop) {
                console.log('[节点4筛选] 检测到停止信号，中断筛选');
                break;
            }
            
            try {
                const prompt = `请判断以下文献是否与研究主题相关，并给出推荐理由。

研究主题：${requirement}

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

                const answer = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.3, modelName);
                
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
                
                if (isRelevant) {
                    lit.selected = true;
                    lit.aiRecommendReason = reason; // 保存AI推荐理由
                    selectedLiterature.push(lit);
                    relevantCount++;
                    // 更新进度
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title || '未知标题', 'AI推荐');
                    }
                } else {
                    lit.selected = false;
                    lit.aiRecommendReason = reason; // 保存AI不推荐的理由
                    irrelevantCount++;
                    // 更新进度
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title || '未知标题', '不推荐');
                    }
                }
            } catch (error) {
                console.error(`筛选文献 "${lit.title}" 失败:`, error);
                // 筛选失败时，默认选中
                lit.selected = true;
                lit.aiRecommendReason = 'AI筛选失败，默认选中';
                selectedLiterature.push(lit);
                relevantCount++;
                // 更新进度
                if (onProgress) {
                    onProgress(i + 1, total, lit.title || '未知标题', '筛选失败，默认选中');
                }
            }
        }

        // 确保所有选中的文献都有AI推荐理由，并且selected状态正确
        // 过滤掉没有推荐理由或selected为false的文献
        selectedLiterature = selectedLiterature.filter(lit => {
            return lit && lit.aiRecommendReason && lit.selected === true;
        });
        
        // 更新allLiterature中的selected状态，确保只有AI推荐的被选中
        for (const lit of allLiterature) {
            // 如果文献在selectedLiterature中，确保selected为true
            const isSelected = selectedLiterature.some(selected => 
                selected.title === lit.title && selected.url === lit.url
            );
            lit.selected = isSelected;
        }
        
        console.log('筛选完成:', {
            total: allLiterature.length,
            selected: selectedLiterature.length,
            relevantCount,
            irrelevantCount
        });

        return {
            selectedLiterature,
            relevantCount,
            irrelevantCount,
            total
        };
    },

    // 显示筛选结果（美观展示，编辑通过弹窗实现）
    // editable: true=编辑模式（用户点击节点进入），false=只读模式（自动执行时）
    display(allLiterature, selectedLiterature, editable = false) {
        const container = document.getElementById('filter-results-list');
        
        if (!container) {
            console.error('filter-results-list 容器未找到');
            return;
        }
        
        // 确保selectedLiterature是数组
        if (!Array.isArray(selectedLiterature)) {
            selectedLiterature = [];
        }
        
        // 更新顶部统计信息
        try {
            const statsContainer = document.querySelector('#node-body-4 > div:first-child');
            if (statsContainer) {
                // 查找统计卡片中的strong元素（按顺序：总计、已选用、未选用）
                const statCards = statsContainer.querySelectorAll('div[style*="flex-direction: column"]');
                if (statCards.length >= 3) {
                    // 总计
                    const totalStrong = statCards[0].querySelector('strong');
                    if (totalStrong) totalStrong.textContent = allLiterature.length;
                    
                    // 已选用
                    const selectedStrong = statCards[1].querySelector('strong');
                    if (selectedStrong) selectedStrong.textContent = selectedLiterature.length;
                    
                    // 未选用
                    const unselectedStrong = statCards[2].querySelector('strong');
                    if (unselectedStrong) unselectedStrong.textContent = allLiterature.length - selectedLiterature.length;
                } else {
                    // 备用方案：直接查找所有strong元素
                    const strongElements = statsContainer.querySelectorAll('strong');
                    if (strongElements.length >= 3) {
                        strongElements[0].textContent = allLiterature.length;
                        strongElements[1].textContent = selectedLiterature.length;
                        strongElements[2].textContent = allLiterature.length - selectedLiterature.length;
                    }
                }
            }
        } catch (e) {
            console.warn('更新统计信息失败:', e);
        }
        
        container.innerHTML = '';

        // 如果没有文献，显示提示
        if (!allLiterature || allLiterature.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">暂无文献数据</p>';
            return;
        }

        allLiterature.forEach((lit, index) => {
            const item = document.createElement('div');
            item.className = 'literature-item';
            
            // 根据是否被选中设置不同的背景色和边框
            const isSelected = lit.selected && lit.aiRecommendReason;
            const bgColor = isSelected ? '#f0f9ff' : '#ffffff';
            const borderColor = isSelected ? '#3b82f6' : '#e5e7eb';
            const borderWidth = isSelected ? '2px' : '1px';
            
            item.style.cssText = `
                margin-bottom: 20px; 
                padding: 0; 
                background: ${bgColor}; 
                border-radius: 12px; 
                border: ${borderWidth} solid ${borderColor};
                box-shadow: 0 2px 8px rgba(0,0,0,0.08); 
                overflow: hidden;
                transition: all 0.3s ease;
                position: relative;
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
            
            // 作者信息格式化
            const authorsText = lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知作者';
            const yearText = lit.year ? lit.year : '';
            const journalText = lit.journal || lit.source || '';
            const citedText = lit.cited !== undefined ? lit.cited : '';
            
            // AI判断文本
            const aiJudgmentText = lit.aiRecommendReason || '';
            
            // 根据editable参数决定是否显示编辑按钮
            const checkboxHtml = editable ? `
                <div style="padding: 15px 15px 0 15px; display: flex; align-items: center; gap: 10px;">
                    <input type="checkbox" ${lit.selected ? 'checked' : ''} 
                           onchange="window.WorkflowManager.toggleLiterature(${index}, this.checked)"
                           style="width: 20px; height: 20px; cursor: pointer; accent-color: #3b82f6;">
                    <span style="font-size: 13px; color: #64748b; font-weight: 500;">选择此文献</span>
                </div>
            ` : '';
            
            const editButtonsHtml = editable ? `
                <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 10; background: ${bgColor}; padding: 4px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                    <button onclick="window.WorkflowManager.toggleLiterature(${index}, true)" 
                            style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                                   color: white; 
                                   border: none; 
                                   padding: 6px 12px; 
                                   border-radius: 6px; 
                                   font-size: 12px; 
                                   font-weight: 500;
                                   cursor: pointer;
                                   box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                                   transition: all 0.2s;
                                   white-space: nowrap;">
                        ✓ 推荐
                    </button>
                    <button onclick="window.WorkflowManager.editLiterature(${index})" 
                            style="background: white; 
                                   border: 1px solid #e5e7eb; 
                                   padding: 6px 10px; 
                                   border-radius: 6px; 
                                   cursor: pointer; 
                                   font-size: 14px;
                                   transition: all 0.2s;
                                   display: flex;
                                   align-items: center;
                                   justify-content: center;
                                   min-width: 32px;
                                   min-height: 32px;">
                        ✏️
                    </button>
                    <button onclick="window.WorkflowManager.aiRecommendLiterature(${index})" 
                            title="AI重新判断"
                            style="background: white; 
                                   border: 1px solid #e5e7eb; 
                                   padding: 6px 10px; 
                                   border-radius: 6px; 
                                   cursor: pointer; 
                                   font-size: 14px;
                                   transition: all 0.2s;
                                   display: flex;
                                   align-items: center;
                                   justify-content: center;
                                   min-width: 32px;
                                   min-height: 32px;
                                   font-weight: bold;
                                   color: #3b82f6;">
                        A
                    </button>
                    <button onclick="window.WorkflowManager.deleteLiterature(${index})" 
                            style="background: white; 
                                   border: 1px solid #e5e7eb; 
                                   padding: 6px 10px; 
                                   border-radius: 6px; 
                                   cursor: pointer; 
                                   font-size: 14px;
                                   transition: all 0.2s;
                                   display: flex;
                                   align-items: center;
                                   justify-content: center;
                                   min-width: 32px;
                                   min-height: 32px;">
                        🗑️
                    </button>
                </div>
            ` : '';
            
            // AI推荐徽章
            const aiRecommendedBadge = isSelected ? `
                <div style="display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                           color: white; 
                           padding: 4px 12px; 
                           border-radius: 20px; 
                           font-size: 11px; 
                           font-weight: 600;
                           box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                           margin-left: 12px;">
                    <span>✓</span>
                    <span>AI推荐</span>
                </div>
            ` : '';
            
            // 查看原文链接
            const urlText = lit.url ? `
                <a href="${lit.url}" target="_blank" 
                   style="display: inline-flex; align-items: center; gap: 6px; color: #3b82f6; text-decoration: none; font-size: 13px; font-weight: 500;
                          padding: 6px 12px; border-radius: 6px; background: #eff6ff; transition: all 0.2s;">
                    <span>🔗</span>
                    <span>查看原文</span>
                </a>
            ` : '';
            
            item.innerHTML = `
                ${checkboxHtml}
                ${editButtonsHtml}
                <div style="padding: 20px; position: relative;">
                    <!-- 标题区域 -->
                    <div style="margin-bottom: 12px;">
                        <h4 style="margin: 0 0 8px 0; color: #1e293b; font-size: 16px; font-weight: 700; line-height: 1.5; 
                                   display: flex; align-items: flex-start; gap: 10px; flex-wrap: wrap;">
                            <span style="flex: 1; min-width: 200px;">${this.escapeHtml(lit.title || '无标题')}</span>
                        </h4>
                    </div>
                    
                    <!-- 元信息区域 -->
                    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; padding: 12px; 
                                background: #f8fafc; border-radius: 8px;">
                        ${authorsText ? `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="color: #64748b; font-size: 12px;">👤</span>
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">${this.escapeHtml(authorsText)}</span>
                            </div>
                        ` : ''}
                        ${yearText ? `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="color: #64748b; font-size: 12px;">📅</span>
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">${yearText}</span>
                            </div>
                        ` : ''}
                        ${journalText ? `
                            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 150px;">
                                <span style="color: #64748b; font-size: 12px;">📚</span>
                                <span style="color: #475569; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.escapeHtml(journalText)}</span>
                            </div>
                        ` : ''}
                        ${citedText !== '' ? `
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="color: #64748b; font-size: 12px;">📊</span>
                                <span style="color: #475569; font-size: 13px; font-weight: 500;">被引 ${citedText}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- AI判断区域 -->
                    ${aiJudgmentText ? `
                        <div style="background: linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%); 
                                   padding: 16px; 
                                   border-radius: 10px; 
                                   margin-bottom: 16px; 
                                   border-left: 5px solid #f59e0b;
                                   box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                                <span style="font-size: 18px;">🤖</span>
                                <strong style="color: #92400e; font-size: 14px; font-weight: 700;">AI判断</strong>
                            </div>
                            <p style="font-size: 13px; color: #78350f; line-height: 1.7; margin: 0; text-align: justify;">
                                ${this.escapeHtml(aiJudgmentText)}
                            </p>
                        </div>
                    ` : ''}
                    
                    <!-- 操作区域 -->
                    ${urlText ? `
                        <div style="display: flex; align-items: center; gap: 10px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
                            ${urlText}
                        </div>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(item);
        });
    },

    // HTML转义
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

