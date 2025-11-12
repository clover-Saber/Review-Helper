// 节点4：精选文献模块
window.Node4Filter = {
    // 高质量期刊列表（用于提示词）
    highQualityJournals: [
        'Nature', 'Science', 'Cell', 'Nature Machine Intelligence', 'Nature Communications',
        'IEEE Transactions on', 'IEEE Journal of', 'IEEE Transactions on Intelligent Transportation Systems',
        'IEEE Transactions on Vehicular Technology', 'IEEE Transactions on Robotics',
        'ACM Transactions on', 'Journal of Machine Learning Research', 'Neural Information Processing Systems',
        'International Journal of Computer Vision', 'IEEE Transactions on Pattern Analysis',
        'Transportation Research Part', 'Transportation Science', 'IEEE Intelligent Transportation Systems',
        'Autonomous Robots', 'Robotics and Autonomous Systems', 'IEEE Robotics and Automation',
        'Computer Vision and Pattern Recognition', 'International Conference on Robotics and Automation'
    ],
    
    // 生成文献质量评估信息（用于提示词）
    generateQualityAssessment(lit) {
        const assessments = [];
        
        // 1. 评估补全完整性
        let completenessInfo = '补全完整性：';
        if (window.Node3Complete && window.Node3Complete.isAbstractComplete) {
            const abstractComplete = window.Node3Complete.isAbstractComplete(lit.abstract);
            if (abstractComplete) {
                completenessInfo += '摘要完整（信息完整）';
            } else if (lit.abstract && lit.abstract.trim().length >= 100) {
                completenessInfo += '摘要部分完整（信息基本完整）';
            } else {
                completenessInfo += '摘要缺失或不完整（信息不完整，可能影响判断）';
            }
        } else {
            if (lit.abstract && lit.abstract.trim().length >= 150) {
                completenessInfo += '摘要存在';
            } else {
                completenessInfo += '摘要缺失或过短（信息不完整）';
            }
        }
        
        // 检查其他信息完整性
        const hasJournal = lit.journal && typeof lit.journal === 'string' && lit.journal.trim();
        const hasAuthors = lit.authors && (
            (Array.isArray(lit.authors) && lit.authors.length > 0) ||
            (typeof lit.authors === 'string' && lit.authors.trim())
        );
        const hasYear = lit.year && (
            (typeof lit.year === 'number' && lit.year > 1900) ||
            (typeof lit.year === 'string' && lit.year.trim())
        );
        
        if (!hasJournal) completenessInfo += '；缺少期刊信息';
        if (!hasAuthors) completenessInfo += '；缺少作者信息';
        if (!hasYear) completenessInfo += '；缺少年份信息';
        
        assessments.push(completenessInfo);
        
        // 2. 评估期刊质量
        let journalInfo = '期刊质量：';
        const journal = (lit.journal || lit.source || '').trim();
        if (!journal) {
            journalInfo += '无期刊信息（无法评估期刊质量）';
        } else {
            // 检查是否是高质量期刊
            const isHighQuality = this.highQualityJournals.some(highQuality => 
                journal.toLowerCase().includes(highQuality.toLowerCase())
            );
            
            if (isHighQuality) {
                journalInfo += `高质量期刊（${journal}，属于顶级期刊）`;
            } else {
                journalInfo += `中等质量期刊（${journal}，请谨慎评估其学术价值）`;
            }
            
            // 注意：onhold期刊的判断也交给AI，在提示词中说明
        }
        assessments.push(journalInfo);
        
        // 3. 评估发表时间和引用数量
        let timeCitationInfo = '发表时间与引用：';
        const currentYear = new Date().getFullYear();
        const year = lit.year ? (typeof lit.year === 'number' ? lit.year : parseInt(lit.year, 10)) : null;
        const cited = lit.cited !== undefined && lit.cited !== null ? (typeof lit.cited === 'number' ? lit.cited : parseInt(lit.cited, 10)) : 0;
        
        if (!year || isNaN(year) || year < 1900 || year > currentYear) {
            timeCitationInfo += '年份信息无效，无法评估时效性';
        } else {
            const yearsSincePublication = currentYear - year;
            timeCitationInfo += `${year}年发表（距今${yearsSincePublication}年）`;
            
            if (cited !== undefined && cited !== null) {
                timeCitationInfo += `，被引${cited}次`;
                
                // 给出评估建议
                if (yearsSincePublication > 20) {
                    timeCitationInfo += '。注意：发表时间较久远（超过20年），请评估其时效性和当前研究价值';
                } else if (yearsSincePublication > 10) {
                    if (cited >= 100) {
                        timeCitationInfo += '。这是经典文献，引用数很高，具有重要参考价值';
                    } else if (cited >= 50) {
                        timeCitationInfo += '。较老文献但引用数尚可';
                    } else {
                        timeCitationInfo += '。较老文献且引用较少，可能质量不高或影响力有限';
                    }
                } else {
                    if (cited >= 50) {
                        timeCitationInfo += '。近期高质量文献，引用数很高';
                    } else if (cited >= 20) {
                        timeCitationInfo += '。近期文献，引用数较高';
                    } else if (cited >= 5) {
                        timeCitationInfo += '。近期文献，引用数一般';
                    } else {
                        if (yearsSincePublication > 5) {
                            timeCitationInfo += '。发表较久但引用很少，可能质量不高或影响力有限';
                        } else {
                            timeCitationInfo += '。新文献，引用数较少（可能因为发表时间较短）';
                        }
                    }
                }
            } else {
                timeCitationInfo += '。无法获取引用数，请谨慎评估';
            }
        }
        assessments.push(timeCitationInfo);
        
        return assessments.join('\n');
    },
    
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
                // 生成质量评估信息
                const qualityAssessment = this.generateQualityAssessment(lit);
                
                // 处理作者信息（清理格式）
                let authorsText = '未知';
                if (lit.authors) {
                    if (Array.isArray(lit.authors)) {
                        authorsText = lit.authors.join(', ');
                    } else if (typeof lit.authors === 'string') {
                        // 如果authors字符串包含年份和来源，只提取作者部分
                        const authorsStr = lit.authors.trim();
                        const dashIndex = authorsStr.indexOf(' - ');
                        if (dashIndex > 0) {
                            authorsText = authorsStr.substring(0, dashIndex).trim();
                        } else {
                            authorsText = authorsStr;
                        }
                    }
                }
                
                // 处理年份
                let yearText = '未知';
                if (lit.year) {
                    yearText = typeof lit.year === 'number' ? lit.year.toString() : lit.year.toString().trim();
                }
                
                // 处理期刊
                const journalText = lit.journal || lit.source || '未知';
                
                // 处理引用数
                const citedText = lit.cited !== undefined && lit.cited !== null ? lit.cited.toString() : '未知';
                
                const prompt = `请综合判断以下文献是否与研究主题相关，并给出推荐理由。

研究主题：${requirement}

文献信息：
标题：${lit.title || '无标题'}
作者：${authorsText}
年份：${yearText}
期刊：${journalText}
被引次数：${citedText}
摘要：${lit.abstract || '无摘要'}

质量评估信息：
${qualityAssessment}

请综合考虑以下因素进行判断：
1. **文献相关性**（最重要）：文献是否与研究主题相关？是否对研究有参考价值？
2. **补全完整性**：摘要是否完整？如果摘要缺失或不完整，可能影响对文献内容的理解和判断。
3. **期刊质量档次**：
   - 高质量期刊（如Nature、Science、IEEE Transactions系列等）通常具有更高的学术价值和可信度
   - 中等质量期刊需要谨慎评估其学术价值
   - Onhold期刊（质量较低或声誉不佳的期刊）应不予考虑
4. **发表时间和引用数量**：
   - 发表很久但引用很少的文献，可能质量不高或影响力有限
   - 过于久远的文献（超过20年）需要评估其时效性和当前研究价值
   - 近期高质量文献（引用数高）通常更有参考价值
   - 经典文献（发表较久但引用数很高）仍然具有重要参考价值

请以JSON格式返回结果：
{
  "relevant": true/false,
  "reason": "综合推荐理由（如果相关）或为什么不相关（如果不相关）。请简要说明你如何综合考虑相关性、补全完整性、期刊质量、发表时间和引用数量等因素。"
}

如果相关，请给出综合推荐理由；如果不相关，请简要说明原因。`;

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

