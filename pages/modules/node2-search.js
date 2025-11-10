// 节点2：文献搜索模块
window.Node2Search = {
    // 自动执行文献搜索
    async execute(keywords, keywordsPlan, targetCount, onProgress) {
        const searchParams = {};
        if (keywordsPlan && keywordsPlan.length > 0) {
            keywordsPlan.forEach(plan => {
                searchParams[plan.keyword] = plan.count;
            });
        } else {
            const avgCount = Math.ceil(targetCount / keywords.length);
            keywords.forEach(keyword => {
                searchParams[keyword] = avgCount;
            });
        }

        // 过滤掉文献数量为0的关键词
        const validKeywords = keywords.filter(keyword => {
            const count = searchParams[keyword] || 0;
            return count > 0;
        });

        const searchResults = {};
        const allLiterature = [];
        const totalKeywords = validKeywords.length;

        for (let i = 0; i < validKeywords.length; i++) {
            const keyword = validKeywords[i];
            const maxPerKeyword = searchParams[keyword] || 10;
            
            try {
                // 更新进度：开始搜索当前关键词
                if (onProgress) {
                    onProgress(i + 1, totalKeywords, keyword, '搜索中...');
                }
                
                const results = await window.API.searchGoogleScholar(keyword, maxPerKeyword, null);
                searchResults[keyword] = results;
                
                // 合并结果并去重
                if (results && results.length > 0) {
                    results.forEach(result => {
                        const exists = allLiterature.find(lit => 
                            lit.title === result.title || 
                            (lit.url && result.url && lit.url === result.url)
                        );
                        if (!exists) {
                            allLiterature.push(result);
                        }
                    });
                }
                
                // 更新进度：完成当前关键词搜索
                if (onProgress) {
                    onProgress(i + 1, totalKeywords, keyword, `完成，找到 ${results ? results.length : 0} 篇`);
                }
            } catch (error) {
                console.error(`搜索关键词 "${keyword}" 失败:`, error);
                // 更新进度：搜索失败
                if (onProgress) {
                    onProgress(i + 1, totalKeywords, keyword, '搜索失败');
                }
            }
        }

        return {
            searchResults,
            allLiterature
        };
    },

    // 显示搜索结果（支持编辑模式，可删除）
    display(allLiterature, editable = false) {
        const container = document.getElementById('search-results-list');
        const count = document.getElementById('search-count');
        
        if (!container) return;
        
        if (count) {
            count.textContent = allLiterature.length;
        }
        
        container.innerHTML = '';

        if (allLiterature.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">暂无搜索结果</p>';
            return;
        }

        allLiterature.forEach((lit, index) => {
            const item = document.createElement('div');
            item.className = 'literature-item';
            item.setAttribute('data-index', index);
            item.style.cssText = 'margin-bottom: 15px; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e9ecef; position: relative;';
            
            const authorsText = lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知作者';
            
            // 编辑模式下显示删除按钮
            const deleteBtn = editable ? `
                <button class="delete-literature-btn" data-index="${index}" 
                        style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    删除
                </button>
            ` : '';
            
            item.innerHTML = `
                ${deleteBtn}
                <h4 style="margin-bottom: 5px; padding-right: ${editable ? '60px' : '0'};">${lit.title || '无标题'}</h4>
                <p style="color: #666; font-size: 12px; margin-bottom: 5px;">
                    ${authorsText} 
                    ${lit.year ? `(${lit.year})` : ''}
                </p>
                ${lit.abstract ? `<p style="font-size: 12px; color: #888;">${lit.abstract.substring(0, 200)}...</p>` : '<p style="color: #999; font-size: 12px;">暂无摘要</p>'}
            `;
            container.appendChild(item);
        });

        // 如果是编辑模式，绑定删除按钮事件
        if (editable) {
            container.querySelectorAll('.delete-literature-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.getAttribute('data-index'));
                    this.deleteLiterature(index, allLiterature);
                });
            });
        }
    },

    // 删除文献
    deleteLiterature(index, allLiterature) {
        if (index >= 0 && index < allLiterature.length) {
            // 确认删除
            const lit = allLiterature[index];
            const confirmMsg = `确定要删除文献 "${lit.title || '无标题'}" 吗？`;
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // 从数组中删除
            allLiterature.splice(index, 1);
            
            // 更新 WorkflowManager 的状态
            if (window.WorkflowManager) {
                window.WorkflowManager.state.allLiterature = allLiterature;
                // 同时更新 selectedLiterature（如果该文献被选中，也要删除）
                window.WorkflowManager.state.selectedLiterature = window.WorkflowManager.state.selectedLiterature.filter(
                    selected => selected.title !== lit.title && selected.url !== lit.url
                );
                // 重新显示
                this.display(allLiterature, true);
                // 更新计数
                const count = document.getElementById('search-count');
                if (count) {
                    count.textContent = allLiterature.length;
                }
                // 保存数据
                window.WorkflowManager.saveProjectData({ 
                    finalResults: allLiterature,
                    selectedLiterature: window.WorkflowManager.state.selectedLiterature
                });
                window.UIUtils.showToast('文献已删除', 'success');
            }
        }
    }
};

