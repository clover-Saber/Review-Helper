// 节点3：文献补全模块
window.Node3Complete = {
    // 检查摘要是否完整的辅助函数
    isAbstractComplete(abstract) {
        if (!abstract || typeof abstract !== 'string') {
            return false;
        }
        const trimmed = abstract.trim();
        if (trimmed.length < 150) {
            return false;
        }
        const endsWithTruncation = /[.][.][.]?$|…$|\s*…\s*$/.test(trimmed);
        const endsWithSentence = /[.!?]\s*$/.test(trimmed);
        const hasSentence = /[.!?]/.test(trimmed);
        const endsProperly = /[\s.!?\w]$/.test(trimmed);
        return !endsWithTruncation && (endsWithSentence || hasSentence) && endsProperly;
    },

    // 计算标题相似度的辅助函数
    calculateTitleSimilarity(title1, title2) {
        if (!title1 || !title2) {
            return 0;
        }
        
        const normalizeTitle = (title) => {
            if (!title) return '';
            return title.toLowerCase().trim().replace(/[^\w\s]/g, '');
        };
        
        const normalized1 = normalizeTitle(title1);
        const normalized2 = normalizeTitle(title2);
        
        // 完全匹配
        if (normalized1 === normalized2) {
            return 100;
        }
        
        // 包含关系
        if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
            const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
            const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
            return (shorter.length / longer.length) * 80;
        }
        
        // 计算共同词汇
        const words1 = normalized1.split(/\s+/).filter(w => w.length > 2);
        const words2 = normalized2.split(/\s+/).filter(w => w.length > 2);
        const commonWords = words1.filter(w => words2.includes(w));
        
        if (commonWords.length > 0) {
            return (commonWords.length / Math.max(words1.length, words2.length)) * 60;
        }
        
        return 0;
    },

    // 自动执行文献补全（使用谷歌学术逐个搜索）
    async execute(apiKey, allLiterature, onProgress) {
        const total = allLiterature.length;
        let completed = 0;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < allLiterature.length; i++) {
            // 检查是否应该停止
            if (window.WorkflowManager && window.WorkflowManager.state && window.WorkflowManager.state.shouldStop) {
                console.log('[节点3补全] 检测到停止信号，中断补全');
                break;
            }
            
            const lit = allLiterature[i];
            
            // 更新进度
            if (onProgress) {
                onProgress(i + 1, total, lit.title, '检查中...');
            }
            
            // 再次检查停止标志
            if (window.WorkflowManager && window.WorkflowManager.state && window.WorkflowManager.state.shouldStop) {
                console.log('[节点3补全] 检测到停止信号，中断补全');
                break;
            }

            // 标记为处理中
            lit.completionStatus = 'processing';
            
            // 检查是否需要补全（使用更严格的标准）
            // 摘要必须>=150字符且完整（不以省略号结尾，包含句子等）
            const hasAbstract = lit.abstract && typeof lit.abstract === 'string' && lit.abstract.trim();
            const hasJournal = lit.journal && typeof lit.journal === 'string' && lit.journal.trim();
            
            // 检查摘要是否完整（使用辅助函数）
            const abstractComplete = this.isAbstractComplete(lit.abstract);
            
            // 如果摘要完整且期刊已完整，标记为已完成并跳过
            if (abstractComplete && hasJournal) {
                lit.completionStatus = 'completed';
                completed++;
                successCount++;
                if (onProgress) {
                    onProgress(i + 1, total, lit.title, '信息已完整');
                }
                continue;
            }

            try {
                // 使用文献标题在谷歌学术中搜索
                const searchTitle = lit.title || '';
                if (!searchTitle || !searchTitle.trim()) {
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    if (onProgress) {
                        onProgress(i + 1, total, '无标题', '搜索失败：缺少标题');
                    }
                    continue;
                }

                // 更新进度：正在搜索
                if (onProgress) {
                    onProgress(i + 1, total, lit.title, '正在搜索谷歌学术...');
                }

                // 使用标题进行单篇精准搜索（限制返回1个结果，精确匹配）
                // 使用引号包裹标题，进行精确匹配搜索
                const exactSearchTitle = `"${searchTitle}"`;
                console.log(`[节点3补全] 正在单篇精准搜索文献: "${exactSearchTitle}"`);
                const searchResults = await window.API.searchGoogleScholar(exactSearchTitle, 1, null);
                
                if (!searchResults || searchResults.length === 0) {
                    // 没有找到结果
                    console.log(`[节点3补全] ⚠ 未找到搜索结果`);
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, '未找到匹配结果');
                    }
                    continue;
                }
                
                console.log(`[节点3补全] 找到 ${searchResults.length} 个搜索结果`);

                // 单篇精准搜索：直接使用第一个结果（因为已经用引号精确匹配了）
                let bestMatch = null;
                let bestScore = 0;
                
                if (searchResults && searchResults.length > 0) {
                    // 使用第一个结果（最匹配的）
                    bestMatch = searchResults[0];
                    
                    // 使用辅助函数计算相似度
                    bestScore = this.calculateTitleSimilarity(searchTitle, bestMatch.title || '');
                }

                // 如果找到结果且匹配度较高（相似度>50），使用它来补全信息
                if (bestMatch && bestScore > 50) {
                    console.log(`[节点3补全] 找到最佳匹配: "${bestMatch.title}" (匹配度: ${Math.round(bestScore)}%)`);
                    console.log(`[节点3补全] 最佳匹配的完整信息:`, {
                        title: bestMatch.title,
                        authors: bestMatch.authors,
                        year: bestMatch.year,
                        source: bestMatch.source,
                        abstract: bestMatch.abstract ? `${bestMatch.abstract.substring(0, 200)}...` : '(无)',
                        abstractLength: bestMatch.abstract ? bestMatch.abstract.length : 0,
                        url: bestMatch.url
                    });
                    
                    let hasUpdate = false; // 标记是否有任何更新
                    
                    // 补全摘要（如果原文献没有摘要，或摘要不完整，则使用搜索结果的摘要）
                    const currentAbstract = lit.abstract ? lit.abstract.trim() : '';
                    let matchAbstract = bestMatch.abstract ? bestMatch.abstract.trim() : '';
                    
                    // 检查当前摘要是否完整（使用辅助函数）
                    const currentAbstractComplete = this.isAbstractComplete(currentAbstract);
                    
                    // 检查搜索结果中的摘要是否完整（使用辅助函数）
                    const matchAbstractComplete = this.isAbstractComplete(matchAbstract);
                    
                    console.log(`[节点3补全] 搜索结果中的摘要: ${matchAbstract || '(无)'} (长度: ${matchAbstract.length}, 完整: ${matchAbstractComplete ? 'YES' : 'NO'})`);
                    
                    // 如果搜索结果中没有完整摘要，尝试访问详情页获取完整摘要
                    if ((!matchAbstract || !matchAbstractComplete) && bestMatch.url) {
                        try {
                            if (onProgress) {
                                onProgress(i + 1, total, lit.title, '正在访问详情页获取完整摘要...');
                            }
                            
                            console.log(`[节点3补全] 摘要太短，尝试从详情页获取: ${bestMatch.url}`);
                            
                            // 调用主进程的摘要提取功能
                            if (window.electronAPI && window.electronAPI.extractAbstractFromUrl) {
                                const abstractResult = await window.electronAPI.extractAbstractFromUrl(bestMatch.url);
                                if (abstractResult && abstractResult.success && abstractResult.abstract) {
                                    const fullAbstract = abstractResult.abstract.trim();
                                    console.log(`[节点3补全] 从详情页获取到完整摘要，长度: ${fullAbstract.length}`);
                                    console.log(`[节点3补全] 完整摘要内容: ${fullAbstract}`);
                                    if (fullAbstract.length > matchAbstract.length) {
                                        matchAbstract = fullAbstract;
                                    }
                                } else {
                                    console.log(`[节点3补全] ⚠ 从详情页获取摘要失败:`, abstractResult);
                                }
                            }
                        } catch (abstractError) {
                            console.warn(`[节点3补全] 访问详情页获取摘要失败: ${abstractError.message}`);
                            // 继续使用搜索结果中的摘要（如果有）
                        }
                    }
                    
                    // 补全摘要（覆盖原文献的缺失或不完整的摘要）
                    // 如果当前摘要不完整，或者搜索到的摘要更完整，则使用搜索结果的摘要
                    if (matchAbstract && (!currentAbstract || !currentAbstractComplete || (matchAbstractComplete && matchAbstract.length > currentAbstract.length))) {
                        console.log(`[节点3补全] 文献: "${lit.title}"`);
                        console.log(`[节点3补全] 原摘要: ${currentAbstract || '(无)'} (长度: ${currentAbstract.length}, 完整: ${currentAbstractComplete ? 'YES' : 'NO'})`);
                        console.log(`[节点3补全] 搜索到的摘要: ${matchAbstract.substring(0, 200)}... (长度: ${matchAbstract.length}, 完整: ${matchAbstractComplete ? 'YES' : 'NO'})`);
                        console.log(`[节点3补全] 匹配度: ${Math.round(bestScore)}%`);
                        lit.abstract = matchAbstract;
                        hasUpdate = true;
                        console.log(`[节点3补全] ✓ 摘要已覆盖`);
                    } else if (matchAbstract) {
                        console.log(`[节点3补全] 文献: "${lit.title}"`);
                        console.log(`[节点3补全] 原摘要已存在且完整 (长度: ${currentAbstract.length}, 完整: ${currentAbstractComplete ? 'YES' : 'NO'})，跳过补全`);
                        console.log(`[节点3补全] 搜索到的摘要: ${matchAbstract.substring(0, 100)}... (长度: ${matchAbstract.length}, 完整: ${matchAbstractComplete ? 'YES' : 'NO'})`);
                    } else {
                        console.log(`[节点3补全] 文献: "${lit.title}"`);
                        console.log(`[节点3补全] ⚠ 未搜索到摘要`);
                    }
                    
                    // 补全期刊（覆盖原文献的缺失期刊）
                    const currentJournal = lit.journal && typeof lit.journal === 'string' ? lit.journal.trim() : '';
                    const matchSource = bestMatch.source && typeof bestMatch.source === 'string' ? bestMatch.source.trim() : '';
                    if (matchSource && !currentJournal) {
                        console.log(`[节点3补全] 原期刊: ${currentJournal || '(无)'}`);
                        console.log(`[节点3补全] 搜索到的期刊: ${matchSource}`);
                        lit.journal = matchSource;
                        hasUpdate = true;
                        console.log(`[节点3补全] ✓ 期刊已覆盖`);
                    } else if (matchSource) {
                        console.log(`[节点3补全] 原期刊已存在: ${currentJournal}，跳过补全`);
                        console.log(`[节点3补全] 搜索到的期刊: ${matchSource}`);
                    } else {
                        console.log(`[节点3补全] ⚠ 未搜索到期刊`);
                    }
                    
                    // 补全其他缺失信息（如果原文献缺失，用搜索结果覆盖）
                    // 补全作者（如果原文献没有作者）
                    const currentAuthors = lit.authors;
                    const hasCurrentAuthors = currentAuthors && (
                        (Array.isArray(currentAuthors) && currentAuthors.length > 0) ||
                        (typeof currentAuthors === 'string' && currentAuthors.trim())
                    );
                    if (!hasCurrentAuthors) {
                        if (bestMatch.authors) {
                            // 处理authors可能是数组或字符串的情况
                            if (Array.isArray(bestMatch.authors)) {
                                lit.authors = bestMatch.authors.length > 0 ? bestMatch.authors : null;
                            } else if (typeof bestMatch.authors === 'string' && bestMatch.authors.trim()) {
                                lit.authors = bestMatch.authors.trim();
                            }
                            if (lit.authors) {
                                hasUpdate = true;
                            }
                        }
                    }
                    
                    // 补全年份（如果原文献没有年份）
                    const currentYear = lit.year;
                    const hasCurrentYear = currentYear && (
                        (typeof currentYear === 'number' && currentYear > 0) ||
                        (typeof currentYear === 'string' && currentYear.trim())
                    );
                    if (!hasCurrentYear) {
                        if (bestMatch.year) {
                            // 处理year可能是数字或字符串的情况
                            if (typeof bestMatch.year === 'number') {
                                lit.year = bestMatch.year;
                                hasUpdate = true;
                            } else if (typeof bestMatch.year === 'string' && bestMatch.year.trim()) {
                                const yearNum = parseInt(bestMatch.year.trim(), 10);
                                if (!isNaN(yearNum) && yearNum > 0) {
                                    lit.year = yearNum;
                                    hasUpdate = true;
                                }
                            }
                        }
                    }
                    
                    // 补全URL（如果原文献没有URL）
                    const currentUrl = lit.url && typeof lit.url === 'string' ? lit.url.trim() : '';
                    if (!currentUrl) {
                        if (bestMatch.url && typeof bestMatch.url === 'string' && bestMatch.url.trim()) {
                            lit.url = bestMatch.url.trim();
                            hasUpdate = true;
                        }
                    }
                    
                    // 判断是否成功补全（必须要有完整摘要才算成功）
                    if (hasUpdate) {
                        // 检查最终状态：必须要有完整摘要才算成功（使用辅助函数）
                        const finalAbstractComplete = this.isAbstractComplete(lit.abstract);
                        const finalAbstract = lit.abstract ? lit.abstract.trim() : '';
                        
                        if (finalAbstractComplete) {
                            // 只有补全了完整摘要才算成功
                            lit.completionStatus = 'completed';
                            successCount++;
                            completed++;
                            const updatedFields = [];
                            if (finalAbstractComplete && !currentAbstractComplete) updatedFields.push('摘要');
                            if (lit.journal && !currentJournal) updatedFields.push('期刊');
                            const fieldsText = updatedFields.length > 0 ? `（已补全: ${updatedFields.join('、')}）` : '';
                            if (onProgress) {
                                onProgress(i + 1, total, lit.title, `补全成功${fieldsText}（匹配度: ${Math.round(bestScore)}%）`);
                            }
                        } else {
                            // 补全了摘要但不完整，标记为失败
                            lit.completionStatus = 'failed';
                            failCount++;
                            completed++;
                            if (onProgress) {
                                onProgress(i + 1, total, lit.title, `补全失败：摘要不完整（长度: ${finalAbstract.length}, 匹配度: ${Math.round(bestScore)}%）`);
                            }
                        }
                    } else {
                        // 没有更新任何信息
                        lit.completionStatus = 'failed';
                        failCount++;
                        completed++;
                        if (onProgress) {
                            onProgress(i + 1, total, lit.title, '未找到可补全的信息');
                        }
                    }
                } else {
                    // 没有找到匹配的结果
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, `未找到匹配的文献（最高匹配度: ${bestScore ? Math.round(bestScore) : 0}%）`);
                    }
                }
                
            } catch (error) {
                console.error(`补全文献 "${lit.title}" 失败:`, error);
                lit.completionStatus = 'failed';
                failCount++;
                completed++;
                
                if (onProgress) {
                    onProgress(i + 1, total, lit.title, '处理失败: ' + error.message);
                }
            }
        }

        return { completed, total, successCount, failCount };
    },

    // 显示补全结果
    display(allLiterature) {
        const container = document.getElementById('complete-results-list');
        const count = document.getElementById('complete-count');
        const successList = allLiterature.filter(lit => lit.completionStatus === 'completed');
        const failedList = allLiterature.filter(lit => lit.completionStatus === 'failed');
        const pendingList = allLiterature.filter(lit => !lit.completionStatus || lit.completionStatus === 'processing');
        
        if (!container) return;
        
        if (count) {
            count.textContent = `${successList.length}/${allLiterature.length}`;
        }
        
        container.innerHTML = '';

        // 先显示成功补全的文献
        if (successList.length > 0) {
            const successHeader = document.createElement('div');
            successHeader.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #d1fae5; border-radius: 6px;';
            successHeader.innerHTML = `<strong style="color: #065f46;">✓ 成功补全 (${successList.length}篇)</strong>`;
            container.appendChild(successHeader);

            successList.forEach((lit) => {
                const litIndex = allLiterature.findIndex(l => l === lit || (l.title === lit.title && l.url === lit.url));
                const item = this.createLiteratureItem(lit, 'completed', litIndex);
                container.appendChild(item);
            });
        }

        // 再显示补全失败的文献
        if (failedList.length > 0) {
            const failedHeader = document.createElement('div');
            failedHeader.style.cssText = 'margin-top: 20px; margin-bottom: 15px; padding: 10px; background: #fee2e2; border-radius: 6px;';
            failedHeader.innerHTML = `<strong style="color: #991b1b;">✗ 补全失败 (${failedList.length}篇)</strong>`;
            container.appendChild(failedHeader);

            failedList.forEach((lit) => {
                const litIndex = allLiterature.findIndex(l => l === lit || (l.title === lit.title && l.url === lit.url));
                const item = this.createLiteratureItem(lit, 'failed', litIndex);
                container.appendChild(item);
            });
        }

        // 最后显示未处理的文献
        if (pendingList.length > 0) {
            const pendingHeader = document.createElement('div');
            pendingHeader.style.cssText = 'margin-top: 20px; margin-bottom: 15px; padding: 10px; background: #f3f4f6; border-radius: 6px;';
            pendingHeader.innerHTML = `<strong style="color: #6b7280;">○ 未处理 (${pendingList.length}篇)</strong>`;
            container.appendChild(pendingHeader);

            pendingList.forEach((lit) => {
                const litIndex = allLiterature.findIndex(l => l === lit || (l.title === lit.title && l.url === lit.url));
                const item = this.createLiteratureItem(lit, 'pending', litIndex);
                container.appendChild(item);
            });
        }
    },

    // 创建文献项
    createLiteratureItem(lit, status, litIndex = -1) {
        const item = document.createElement('div');
        item.className = 'literature-item';
        
        // 根据状态设置不同的样式
        let borderColor = '#e9ecef';
        let bgColor = 'white';
        let statusBadge = '';
        
        if (status === 'completed') {
            borderColor = '#10b981';
            bgColor = '#f0fdf4';
            statusBadge = '<span style="background: #10b981; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px;">✓ 已补全</span>';
        } else if (status === 'failed') {
            borderColor = '#ef4444';
            bgColor = '#fef2f2';
            statusBadge = '<span style="background: #ef4444; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px;">✗ 补全失败</span>';
        } else {
            statusBadge = '<span style="background: #6b7280; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 10px;">○ 未处理</span>';
        }
        
        item.style.cssText = `margin-bottom: 20px; padding: 15px; background: ${bgColor}; border-radius: 8px; border: 2px solid ${borderColor}; position: relative;`;
        
        const hasAbstract = lit.abstract && lit.abstract.trim();
        const authorsText = lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知作者';
        const yearText = lit.year ? `(${lit.year})` : '';
        const journalText = lit.journal ? ` | <strong>期刊：</strong>${lit.journal}` : '';
        const citedText = lit.cited !== undefined ? ` | <strong>被引：</strong>${lit.cited}` : '';
        const urlText = lit.url ? `<a href="${lit.url}" target="_blank" style="color: #007bff; text-decoration: none; margin-left: 10px;">查看原文</a>` : '';
        
        // 对于补全失败的文献，添加手动补全按钮
        const manualEditButton = (status === 'failed' && litIndex >= 0) ? `
            <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid ${borderColor};">
                <button onclick="window.Node3Complete.manualComplete(${litIndex})" 
                        style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); 
                               color: white; 
                               border: none; 
                               padding: 8px 16px; 
                               border-radius: 6px; 
                               font-size: 13px; 
                               font-weight: 500;
                               cursor: pointer;
                               box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
                               transition: all 0.2s;">
                    ✏️ 手动补全
                </button>
            </div>
        ` : '';
        
        item.innerHTML = `
            <h4 style="margin-bottom: 8px; color: #333; font-size: 16px;">
                ${lit.title || '无标题'}${statusBadge}
            </h4>
            <p style="color: #666; font-size: 13px; margin-bottom: 8px;">
                <strong>作者：</strong>${authorsText} ${yearText}${journalText}${citedText}
                ${urlText}
            </p>
            ${hasAbstract ? `
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 10px;">
                    <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0;">
                        <strong style="color: #333;">摘要：</strong>${lit.abstract}
                    </p>
                </div>
            ` : `
                <p style="font-size: 12px; color: #999; font-style: italic; margin-top: 8px;">暂无摘要</p>
            `}
            ${manualEditButton}
        `;
        
        return item;
    },
    
    // 手动补全文献（打开编辑框）
    manualComplete(litIndex) {
        if (!window.WorkflowManager) {
            window.UIUtils.showToast('WorkflowManager未初始化', 'error');
            return;
        }
        
        // 使用WorkflowManager的编辑功能
        window.WorkflowManager.editLiterature(litIndex);
    }
};

