// 节点3：文献补全模块
window.Node3Complete = {
    // 自动执行文献补全（使用谷歌学术逐个搜索）
    async execute(apiKey, allLiterature, onProgress) {
        const total = allLiterature.length;
        let completed = 0;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < allLiterature.length; i++) {
            const lit = allLiterature[i];
            
            // 更新进度
            if (onProgress) {
                onProgress(i + 1, total, lit.title, '搜索中...');
            }

            // 标记为处理中
            lit.completionStatus = 'processing';
            
            // 检查是否需要补全（如果所有信息都已完整，跳过）
            const hasAbstract = lit.abstract && lit.abstract.trim();
            const hasJournal = lit.journal && lit.journal.trim();
            const hasCited = lit.cited !== undefined;
            
            // 如果所有信息都已完整，标记为已完成并跳过
            if (hasAbstract && hasJournal && hasCited) {
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

                // 使用标题搜索谷歌学术（限制返回5个结果，找到最匹配的）
                const searchResults = await window.API.searchGoogleScholar(searchTitle, 5, null);
                
                if (!searchResults || searchResults.length === 0) {
                    // 没有找到结果
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, '未找到匹配结果');
                    }
                    continue;
                }

                // 从搜索结果中找到最匹配的文献（通过标题相似度）
                let bestMatch = null;
                let bestScore = 0;
                
                const normalizeTitle = (title) => {
                    if (!title) return '';
                    return title.toLowerCase().trim().replace(/[^\w\s]/g, '');
                };
                
                const targetTitleNormalized = normalizeTitle(searchTitle);
                
                for (const result of searchResults) {
                    if (!result.title) continue;
                    
                    const resultTitleNormalized = normalizeTitle(result.title);
                    
                    // 计算相似度（简单的字符串匹配）
                    let score = 0;
                    if (resultTitleNormalized === targetTitleNormalized) {
                        score = 100; // 完全匹配
                    } else if (resultTitleNormalized.includes(targetTitleNormalized) || 
                               targetTitleNormalized.includes(resultTitleNormalized)) {
                        // 包含关系
                        const longer = resultTitleNormalized.length > targetTitleNormalized.length 
                            ? resultTitleNormalized 
                            : targetTitleNormalized;
                        const shorter = resultTitleNormalized.length > targetTitleNormalized.length 
                            ? targetTitleNormalized 
                            : resultTitleNormalized;
                        score = (shorter.length / longer.length) * 80;
                    } else {
                        // 计算共同词汇
                        const targetWords = targetTitleNormalized.split(/\s+/).filter(w => w.length > 2);
                        const resultWords = resultTitleNormalized.split(/\s+/).filter(w => w.length > 2);
                        const commonWords = targetWords.filter(w => resultWords.includes(w));
                        if (commonWords.length > 0) {
                            score = (commonWords.length / Math.max(targetWords.length, resultWords.length)) * 60;
                        }
                    }
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = result;
                    }
                }

                // 如果找到匹配度较高的结果（相似度>30），使用它来补全信息
                if (bestMatch && bestScore > 30) {
                    let hasUpdate = false; // 标记是否有任何更新
                    
                    // 补全摘要（如果原文献没有摘要，或摘要很短，则使用搜索结果的摘要）
                    const currentAbstract = lit.abstract ? lit.abstract.trim() : '';
                    let matchAbstract = bestMatch.abstract ? bestMatch.abstract.trim() : '';
                    
                    // 如果搜索结果中没有摘要或摘要很短，尝试访问详情页获取完整摘要
                    if ((!matchAbstract || matchAbstract.length < 100) && bestMatch.url) {
                        try {
                            if (onProgress) {
                                onProgress(i + 1, total, lit.title, '正在访问详情页获取完整摘要...');
                            }
                            
                            // 调用主进程的摘要提取功能
                            if (window.electronAPI && window.electronAPI.extractAbstractFromUrl) {
                                const abstractResult = await window.electronAPI.extractAbstractFromUrl(bestMatch.url);
                                if (abstractResult && abstractResult.success && abstractResult.abstract) {
                                    const fullAbstract = abstractResult.abstract.trim();
                                    if (fullAbstract.length > matchAbstract.length) {
                                        matchAbstract = fullAbstract;
                                        console.log(`从详情页获取到完整摘要，长度: ${fullAbstract.length}`);
                                    }
                                }
                            }
                        } catch (abstractError) {
                            console.warn(`访问详情页获取摘要失败: ${abstractError.message}`);
                            // 继续使用搜索结果中的摘要（如果有）
                        }
                    }
                    
                    if (matchAbstract && (!currentAbstract || currentAbstract.length < 50)) {
                        lit.abstract = matchAbstract;
                        hasUpdate = true;
                    }
                    
                    // 补全期刊（从source字段获取）
                    if (bestMatch.source && bestMatch.source.trim() && !lit.journal) {
                        lit.journal = bestMatch.source.trim();
                        hasUpdate = true;
                    }
                    
                    // 补全被引次数
                    if (bestMatch.cited !== undefined && lit.cited === undefined) {
                        lit.cited = bestMatch.cited || 0;
                        hasUpdate = true;
                    }
                    
                    // 如果原文献没有URL，使用搜索结果的URL
                    if (!lit.url && bestMatch.url) {
                        lit.url = bestMatch.url;
                        hasUpdate = true;
                    }
                    
                    // 判断是否成功补全（只有补全了摘要才算成功）
                    if (hasUpdate) {
                        // 检查最终状态：必须要有摘要才算成功
                        const finalHasAbstract = lit.abstract && lit.abstract.trim();
                        if (finalHasAbstract) {
                            // 只有补全了摘要才算成功
                            lit.completionStatus = 'completed';
                            successCount++;
                            const updatedFields = [];
                            if (finalHasAbstract && !currentAbstract) updatedFields.push('摘要');
                            if (lit.journal && !hasJournal) updatedFields.push('期刊');
                            if (lit.cited !== undefined && !hasCited) updatedFields.push('被引次数');
                            const fieldsText = updatedFields.length > 0 ? `（已补全: ${updatedFields.join('、')}）` : '';
                            if (onProgress) {
                                onProgress(i + 1, total, lit.title, `补全成功${fieldsText}（匹配度: ${Math.round(bestScore)}%）`);
                            }
                        } else {
                            // 补全了其他信息但没有摘要，标记为失败
                            lit.completionStatus = 'failed';
                            failCount++;
                            if (onProgress) {
                                onProgress(i + 1, total, lit.title, `补全失败：未找到摘要（匹配度: ${Math.round(bestScore)}%）`);
                            }
                        }
                    } else {
                        // 没有更新任何信息
                        lit.completionStatus = 'failed';
                        failCount++;
                        if (onProgress) {
                            onProgress(i + 1, total, lit.title, '未找到可补全的信息');
                        }
                    }
                } else {
                    // 没有找到匹配的结果
                    lit.completionStatus = 'failed';
                    failCount++;
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, `未找到匹配的文献（最高匹配度: ${bestScore ? Math.round(bestScore) : 0}%）`);
                    }
                }
                
                completed++;
                
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
                const item = this.createLiteratureItem(lit, 'completed');
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
                const item = this.createLiteratureItem(lit, 'failed');
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
                const item = this.createLiteratureItem(lit, 'pending');
                container.appendChild(item);
            });
        }
    },

    // 创建文献项
    createLiteratureItem(lit, status) {
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
        
        item.style.cssText = `margin-bottom: 20px; padding: 15px; background: ${bgColor}; border-radius: 8px; border: 2px solid ${borderColor};`;
        
        const hasAbstract = lit.abstract && lit.abstract.trim();
        const authorsText = lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知作者';
        const yearText = lit.year ? `(${lit.year})` : '';
        const journalText = lit.journal ? ` | <strong>期刊：</strong>${lit.journal}` : '';
        const citedText = lit.cited !== undefined ? ` | <strong>被引：</strong>${lit.cited}` : '';
        const urlText = lit.url ? `<a href="${lit.url}" target="_blank" style="color: #007bff; text-decoration: none; margin-left: 10px;">查看原文</a>` : '';
        
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
        `;
        
        return item;
    }
};

