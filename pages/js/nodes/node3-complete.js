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
        // 检查是否以省略号结尾（支持英文和中文省略号）
        const endsWithTruncation = /[.][.][.]?$|…$|\s*…\s*$/.test(trimmed);
        // 检查是否以句子结尾（支持英文和中文标点符号：. ! ? 。 ！ ？）
        const endsWithSentence = /[.!?。！？]\s*$/.test(trimmed);
        // 检查是否包含句子标点（支持英文和中文标点符号）
        const hasSentence = /[.!?。！？]/.test(trimmed);
        // 检查结尾是否合理（支持英文和中文标点、空格、字母、数字、中文字符）
        const endsProperly = /[\s.!?。！？\w\u4e00-\u9fa5\d]$/.test(trimmed);
        return !endsWithTruncation && (endsWithSentence || hasSentence) && endsProperly;
    },

    // 检查文献信息是否完整的辅助函数
    isLiteratureComplete(lit) {
        // 检查作者
        let hasAuthors = false;
        if (lit.authors) {
            if (Array.isArray(lit.authors) && lit.authors.length > 0) {
                hasAuthors = true;
            } else if (typeof lit.authors === 'string') {
                const authorsStr = lit.authors.trim();
                // 如果包含" - "，说明可能包含年份和来源，需要清理后检查
                const dashIndex = authorsStr.indexOf(' - ');
                if (dashIndex > 0) {
                    hasAuthors = authorsStr.substring(0, dashIndex).trim().length > 0;
                } else {
                    hasAuthors = authorsStr.length > 0;
                }
            }
        }
        
        // 检查年份
        let hasYear = false;
        if (lit.year) {
            if (typeof lit.year === 'number' && lit.year > 1900 && lit.year < 2100) {
                hasYear = true;
            } else if (typeof lit.year === 'string') {
                const yearStr = lit.year.trim();
                const yearNum = parseInt(yearStr, 10);
                if (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2100) {
                    hasYear = true;
                }
            }
        }
        
        // 检查期刊
        const hasJournal = lit.journal && typeof lit.journal === 'string' && lit.journal.trim().length > 0;
        
        // 检查引用（cited字段，可选）
        // 引用信息不是必需的，所以不检查
        
        // 检查摘要
        const hasAbstract = this.isAbstractComplete(lit.abstract);
        
        // 所有必需字段都完整才算完整
        return hasAuthors && hasYear && hasJournal && hasAbstract;
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

    // 自动执行文献补全（使用谷歌学术或烂番薯学术逐个搜索）
    async execute(apiKey, allLiterature, onProgress, literatureSource = 'google-scholar') {
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
            
            // 第一步：检查信息完整性（作者、年份、期刊、引用、摘要）
            const isComplete = this.isLiteratureComplete(lit);
            if (isComplete) {
                lit.completionStatus = 'completed';
                completed++;
                successCount++;
                if (onProgress) {
                    onProgress(i + 1, total, lit.title, '信息已完整');
                }
                continue;
            }
            
            // 对于谷歌学术和烂番薯，默认所有信息都需要补全
            // 记录当前字段状态（用于日志显示）
            const needsAuthors = !lit.authors || (typeof lit.authors === 'string' && lit.authors.trim().length === 0) || 
                                 (Array.isArray(lit.authors) && lit.authors.length === 0);
            const needsYear = !lit.year || (typeof lit.year === 'string' && parseInt(lit.year.trim(), 10) < 1900);
            const needsJournal = !lit.journal || typeof lit.journal !== 'string' || lit.journal.trim().length === 0;
            const needsAbstract = !this.isAbstractComplete(lit.abstract);
            
            console.log(`[节点3补全] 文献 "${lit.title}" 当前字段状态:`, {
                authors: needsAuthors ? '缺失' : '完整',
                year: needsYear ? '缺失' : '完整',
                journal: needsJournal ? '缺失' : '完整',
                abstract: needsAbstract ? '缺失' : '完整'
            });
            console.log(`[节点3补全] 对于谷歌学术和烂番薯，默认提取所有字段（无论当前是否完整）`);
            
            // 对于谷歌学术和烂番薯，默认提取所有信息
            const extractAllFields = true;

            try {
                // 获取该文献的来源库（优先使用文献对象中存储的来源库，否则使用传入的默认值）
                const litSource = lit.literatureSource || literatureSource;
                
                console.log('\n');
                console.log('='.repeat(80));
                console.log(`[节点3补全] ========== 开始处理文献 ${i + 1}/${total} ==========`);
                console.log(`[节点3补全] 文献来源库: ${litSource} (${lit.literatureSource ? '从文献对象获取' : '使用默认值'})`);
                console.log(`[节点3补全] 文献标题: "${lit.title}"`);
                
                // 检查该文献是否有URL
                const url = lit.url && typeof lit.url === 'string' ? lit.url.trim() : '';
                
                if (!url || !url.startsWith('http')) {
                    // 没有URL，无法补全
                    console.log(`[节点3补全] ⚠ 文献 "${lit.title}" 没有有效的URL，跳过补全`);
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, '缺少URL，无法补全');
                    }
                    continue;
                }
                
                console.log(`[节点3补全] 文献URL: ${url}`);
                console.log('\n');
                
                // 根据文献来源库选择对应的补全模块
                let completionModule = null;
                if (litSource === 'google-scholar' || litSource === 'lanfanshu') {
                    // Google Scholar 和烂番薯学术使用相同的补全逻辑
                    if (window.LiteratureSourceGoogleScholar) {
                        completionModule = window.LiteratureSourceGoogleScholar;
                        console.log(`[节点3补全] 使用 Google Scholar/Lanfanshu 补全模块`);
                    }
                }
                
                // 获取当前API配置
                const currentApiProvider = window.WorkflowManager?.state?.requirementData?.apiProvider || 'deepseek';
                const currentModelName = window.WorkflowManager?.getCurrentModelName?.() || null;
                
                // 获取API Key
                let apiKeyToUse = apiKey;
                if (!apiKeyToUse && window.WorkflowManager?.state?.apiKeys) {
                    apiKeyToUse = window.WorkflowManager.state.apiKeys[currentApiProvider];
                }
                if (!apiKeyToUse && window.WorkflowManager?.state?.projectData?.config?.apiKeys) {
                    apiKeyToUse = window.WorkflowManager.state.projectData.config.apiKeys[currentApiProvider];
                }
                
                if (!apiKeyToUse) {
                    console.log(`[节点3补全] ❌ API Key不可用，无法补全`);
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, 'API Key不可用');
                    }
                    continue;
                }
                
                // 准备提取选项
                const extractOptions = {
                    needAuthors: true,  // 默认提取作者
                    needYear: true,     // 默认提取年份
                    needJournal: true,  // 默认提取期刊
                    needAbstract: true, // 默认提取摘要
                    currentTitle: lit.title
                };
                
                // 更新进度：正在补全文献信息
                if (onProgress) {
                    onProgress(i + 1, total, lit.title, `正在补全（来源: ${litSource}）...`);
                }
                
                // 再次检查停止标志（在API调用前）
                if (window.WorkflowManager && window.WorkflowManager.state && window.WorkflowManager.state.shouldStop) {
                    console.log('[节点3补全] 检测到停止信号，中断补全');
                    break;
                }
                
                // 根据是否有专用补全模块，选择不同的处理方式
                let completionResult = null;
                
                if (completionModule && completionModule.completeLiterature) {
                    // 使用专用补全模块
                    console.log(`[节点3补全] 使用专用补全模块处理文献`);
                    try {
                        completionResult = await completionModule.completeLiterature(
                            lit,
                            url,
                            apiKeyToUse,
                            currentApiProvider,
                            currentModelName,
                            extractOptions
                        );
                    } catch (moduleError) {
                        console.error(`[节点3补全] 专用补全模块执行失败:`, moduleError);
                        completionResult = {
                            success: false,
                            error: moduleError.message || '补全模块执行失败'
                        };
                    }
                } else {
                    // 使用通用方法（通过URL提取）
                    console.log(`[节点3补全] ⚠ 文献来源库 "${litSource}" 没有专用补全模块，使用通用URL提取方法`);
                    
                    console.log(`[节点3补全] 提取选项（默认提取所有字段）:`, {
                        needAuthors: extractOptions.needAuthors,
                        needYear: extractOptions.needYear,
                        needJournal: extractOptions.needJournal,
                        needAbstract: extractOptions.needAbstract
                    });
                    
                    console.log(`[节点3补全] ✓ API Key已获取`);
                    console.log(`[节点3补全] API提供商: ${currentApiProvider}`);
                    console.log(`[节点3补全] 模型名称: ${currentModelName || '默认模型'}`);
                    console.log(`[节点3补全] 正在调用 extractLiteratureInfoFromUrl...`);
                    console.log('\n');
                    
                    // 从URL提取信息（调用大模型API）
                    try {
                        if (window.electronAPI && window.electronAPI.extractLiteratureInfoFromUrl) {
                            console.log(`[节点3补全] 步骤1: 正在打开URL网页并获取HTML源代码...`);
                            console.log(`[节点3补全] 步骤2: 将HTML源代码发送给大模型API...`);
                            
                            const startTime = Date.now();
                            const urlExtractedInfo = await window.electronAPI.extractLiteratureInfoFromUrl(
                                url,
                                apiKeyToUse,
                                currentApiProvider,
                                currentModelName,
                                extractOptions
                            );
                            const endTime = Date.now();
                            const duration = ((endTime - startTime) / 1000).toFixed(2);
                        
                            console.log(`[节点3补全] 步骤2完成: 已收到大模型API响应（耗时: ${duration}秒）`);
                            console.log('\n');
                            
                            // ========== 打印完整提示词 ==========
                            if (urlExtractedInfo?.prompt) {
                                console.log('█'.repeat(80));
                                console.log('█'.repeat(80));
                                console.log('[节点3补全] ========== 完整提示词（发送给大模型API）==========');
                                console.log('█'.repeat(80));
                                console.log('█'.repeat(80));
                                console.log('\n');
                                console.log(urlExtractedInfo.prompt);
                                console.log('\n');
                                console.log('█'.repeat(80));
                                console.log(`█ 提示词长度: ${urlExtractedInfo.prompt.length} 字符`);
                                console.log('█'.repeat(80));
                                console.log('\n');
                            }
                            
                            // ========== 打印大模型返回的完整原始响应 ==========
                            if (urlExtractedInfo?.rawResponse) {
                                console.log('█'.repeat(80));
                                console.log('█'.repeat(80));
                                console.log('[节点3补全] ========== 大模型返回的完整原始响应 ==========');
                                console.log('█'.repeat(80));
                                console.log('█'.repeat(80));
                                console.log('\n');
                                console.log(urlExtractedInfo.rawResponse);
                                console.log('\n');
                                console.log('█'.repeat(80));
                                console.log(`█ 原始响应长度: ${urlExtractedInfo.rawResponse.length} 字符`);
                                console.log('█'.repeat(80));
                                console.log('\n');
                            }
                            
                            // ========== 打印大模型API响应相关信息 ==========
                            console.log('='.repeat(80));
                            console.log('[节点3补全] ========== 大模型API响应信息 ==========');
                            console.log('='.repeat(80));
                            console.log(`[节点3补全] API调用状态: ${urlExtractedInfo?.success ? '✓ 成功' : '❌ 失败'}`);
                            console.log(`[节点3补全] API调用耗时: ${duration}秒`);
                            console.log(`[节点3补全] API提供商: ${currentApiProvider}`);
                            console.log(`[节点3补全] 模型名称: ${currentModelName || '默认模型'}`);
                            console.log(`[节点3补全] 文献URL: ${url}`);
                            console.log('='.repeat(80));
                            console.log('\n');
                            
                            console.log(`[节点3补全] URL提取结果（解析后）:`, {
                                success: urlExtractedInfo?.success,
                                authors: urlExtractedInfo?.authors,
                                year: urlExtractedInfo?.year,
                                journal: urlExtractedInfo?.journal,
                                abstract: urlExtractedInfo?.abstract ? `${urlExtractedInfo.abstract.substring(0, 100)}...` : '(无)',
                                error: urlExtractedInfo?.error
                            });
                            console.log('\n');
                            
                            if (urlExtractedInfo && urlExtractedInfo.success) {
                                console.log('='.repeat(80));
                                console.log('[节点3补全] ========== 提取到的信息详情 ==========');
                                console.log('='.repeat(80));
                                console.log(`[节点3补全] ✓ 从URL成功提取信息:`);
                                console.log(`  作者 (authors): ${urlExtractedInfo.authors || '(无)'}`);
                                console.log(`  年份 (year): ${urlExtractedInfo.year || '(无)'}`);
                                console.log(`  期刊 (journal): ${urlExtractedInfo.journal || '(无)'}`);
                                console.log(`  摘要 (abstract): ${urlExtractedInfo.abstract ? `${urlExtractedInfo.abstract.substring(0, 200)}${urlExtractedInfo.abstract.length > 200 ? '...' : ''}` : '(无)'}`);
                                console.log(`  摘要长度: ${urlExtractedInfo.abstract ? urlExtractedInfo.abstract.length : 0} 字符`);
                                console.log('='.repeat(80));
                                console.log('\n');
                                
                                // 使用提取的信息补全文献（通用方法）
                                const extractedData = {
                                    authors: urlExtractedInfo.authors,
                                    year: urlExtractedInfo.year,
                                    journal: urlExtractedInfo.journal,
                                    abstract: urlExtractedInfo.abstract
                                };
                                
                                // 补全逻辑（直接处理，与专用模块类似）
                                // 补全摘要
                                const currentAbstract = lit.abstract ? lit.abstract.trim() : '';
                                const extractedAbstract = extractedData.abstract ? extractedData.abstract.trim() : '';
                                const currentAbstractComplete = this.isAbstractComplete(currentAbstract);
                                const extractedAbstractComplete = this.isAbstractComplete(extractedAbstract);
                                
                                if (extractedAbstract && extractedAbstract.length > 0 && extractedAbstract !== 'null' && 
                                    (!currentAbstract || !currentAbstractComplete || (extractedAbstractComplete && extractedAbstract.length > currentAbstract.length))) {
                                    lit.abstract = extractedAbstract;
                                    console.log(`[节点3补全] ✓ 摘要已补全 (长度: ${extractedAbstract.length})`);
                                }
                                
                                // 补全期刊
                                const currentJournal = lit.journal && typeof lit.journal === 'string' ? lit.journal.trim() : '';
                                const extractedJournal = extractedData.journal && extractedData.journal !== 'null' ? extractedData.journal.trim() : '';
                                
                                if (extractedJournal && extractedJournal.length > 0 && (!currentJournal || currentJournal.length === 0)) {
                                    lit.journal = extractedJournal;
                                    console.log(`[节点3补全] ✓ 期刊已补全: ${lit.journal}`);
                                }
                                
                                // 补全作者
                                const currentAuthors = lit.authors;
                                let hasCurrentAuthors = false;
                                if (currentAuthors) {
                                    if (Array.isArray(currentAuthors) && currentAuthors.length > 0) {
                                        hasCurrentAuthors = true;
                                    } else if (typeof currentAuthors === 'string') {
                                        const authorsStr = currentAuthors.trim();
                                        if (authorsStr.indexOf(' - ') < 0 && authorsStr.length > 0) {
                                            hasCurrentAuthors = true;
                                        }
                                    }
                                }
                                
                                if (!hasCurrentAuthors && extractedData.authors && extractedData.authors !== 'null') {
                                    const extractedAuthors = extractedData.authors.trim();
                                    if (extractedAuthors && extractedAuthors.length > 0 && extractedAuthors !== 'null') {
                                        lit.authors = extractedAuthors;
                                        console.log(`[节点3补全] ✓ 作者已补全: ${lit.authors}`);
                                    }
                                }
                                
                                // 补全年份
                                const currentYear = lit.year;
                                let hasCurrentYear = false;
                                if (currentYear) {
                                    if (typeof currentYear === 'number' && currentYear > 1900 && currentYear < 2100) {
                                        hasCurrentYear = true;
                                    } else if (typeof currentYear === 'string') {
                                        const yearStr = currentYear.trim();
                                        const yearNum = parseInt(yearStr, 10);
                                        if (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2100) {
                                            hasCurrentYear = true;
                                        }
                                    }
                                }
                                
                                if (!hasCurrentYear && extractedData.year) {
                                    const extractedYear = extractedData.year;
                                    if (typeof extractedYear === 'number' && extractedYear > 1900 && extractedYear < 2100) {
                                        lit.year = extractedYear;
                                        console.log(`[节点3补全] ✓ 年份已补全: ${lit.year}`);
                                    } else if (typeof extractedYear === 'string') {
                                        const yearNum = parseInt(extractedYear.trim(), 10);
                                        if (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2100) {
                                            lit.year = yearNum;
                                            console.log(`[节点3补全] ✓ 年份已补全: ${lit.year}`);
                                        }
                                    }
                                }
                                
                                completionResult = { success: true };
                            } else {
                                const errorMsg = urlExtractedInfo?.error || '未知错误';
                                console.log('='.repeat(80));
                                console.log('[节点3补全] ========== API调用失败 ==========');
                                console.log('='.repeat(80));
                                console.log(`[节点3补全] ❌ 从URL提取信息失败: ${errorMsg}`);
                                console.log(`[节点3补全] 失败详情:`, urlExtractedInfo);
                                
                                // 如果失败，也打印提示词和原始响应（如果有）
                                if (urlExtractedInfo?.prompt) {
                                    console.log('\n');
                                    console.log('█'.repeat(80));
                                    console.log('[节点3补全] ========== 完整提示词（发送给大模型API）==========');
                                    console.log('█'.repeat(80));
                                    console.log('\n');
                                    console.log(urlExtractedInfo.prompt);
                                    console.log('\n');
                                    console.log('█'.repeat(80));
                                    console.log('\n');
                                }
                                
                                if (urlExtractedInfo?.rawResponse) {
                                    console.log('█'.repeat(80));
                                    console.log('[节点3补全] ========== 大模型返回的完整原始响应 ==========');
                                    console.log('█'.repeat(80));
                                    console.log('\n');
                                    console.log(urlExtractedInfo.rawResponse);
                                    console.log('\n');
                                    console.log('█'.repeat(80));
                                    console.log('\n');
                                }
                                
                                console.log('='.repeat(80));
                                console.log('\n');
                                completionResult = { success: false, error: errorMsg };
                            }
                        } else {
                            console.log(`[节点3补全] ❌ extractLiteratureInfoFromUrl方法不可用`);
                            completionResult = { success: false, error: 'extractLiteratureInfoFromUrl方法不可用' };
                        }
                    } catch (urlError) {
                        console.error('='.repeat(80));
                        console.error('[节点3补全] ========== API调用异常 ==========');
                        console.error('='.repeat(80));
                        console.error(`[节点3补全] ❌ 从URL提取信息时出错:`, urlError);
                        console.error(`[节点3补全] 错误类型: ${urlError.name}`);
                        console.error(`[节点3补全] 错误信息: ${urlError.message}`);
                        console.error(`[节点3补全] 错误堆栈:`, urlError.stack);
                        console.error('='.repeat(80));
                        console.error('\n');
                        completionResult = { success: false, error: urlError.message };
                    }
                }
                
                // API调用后再次检查停止标志
                if (window.WorkflowManager && window.WorkflowManager.state && window.WorkflowManager.state.shouldStop) {
                    console.log('[节点3补全] 检测到停止信号，中断补全');
                    break;
                }
                
                // 处理补全结果（无论是专用模块还是通用方法）
                // 专用模块已经直接修改了 lit 对象，这里只需要检查完整性
                // 通用方法也在上面已经处理了，这里统一检查最终结果
                const finalComplete = this.isLiteratureComplete(lit);
                
                if (finalComplete) {
                    lit.completionStatus = 'completed';
                    successCount++;
                    completed++;
                    console.log(`[节点3补全] ✓✓✓ 补全成功 ✓✓✓`);
                    console.log('='.repeat(80));
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, '补全成功');
                    }
                } else {
                    // 未完全补全
                    lit.completionStatus = 'failed';
                    failCount++;
                    completed++;
                    const missingFields = [];
                    if (!lit.authors || (typeof lit.authors === 'string' && lit.authors.trim().length === 0)) missingFields.push('作者');
                    if (!lit.year) missingFields.push('年份');
                    if (!lit.journal || typeof lit.journal !== 'string' || lit.journal.trim().length === 0) missingFields.push('期刊');
                    if (!this.isAbstractComplete(lit.abstract)) missingFields.push('摘要');
                    console.log(`[节点3补全] ✗✗✗ 补全失败：缺少 ${missingFields.join('、')} ✗✗✗`);
                    console.log('='.repeat(80));
                    if (onProgress) {
                        onProgress(i + 1, total, lit.title, `补全失败：缺少 ${missingFields.join('、')}`);
                    }
                }
                
            } catch (error) {
                console.error('='.repeat(80));
                console.error(`[节点3补全] ✗✗✗ 补全文献 "${lit.title}" 失败 ✗✗✗`);
                console.error(`[节点3补全] 错误类型: ${error.name}`);
                console.error(`[节点3补全] 错误信息: ${error.message}`);
                console.error(`[节点3补全] 错误堆栈:`, error.stack);
                console.error('='.repeat(80));
                lit.completionStatus = 'failed';
                failCount++;
                completed++;
                
                if (onProgress) {
                    onProgress(i + 1, total, lit.title, '处理失败: ' + error.message);
                }
            }
        }

        // 输出补全总结
        console.log('='.repeat(80));
        console.log(`[节点3补全] ========== 补全任务完成 ==========`);
        console.log(`[节点3补全] 总文献数: ${total}`);
        console.log(`[节点3补全] 已完成: ${completed}`);
        console.log(`[节点3补全] 成功补全: ${successCount}`);
        console.log(`[节点3补全] 补全失败: ${failCount}`);
        console.log(`[节点3补全] 成功率: ${total > 0 ? ((successCount / total) * 100).toFixed(1) : 0}%`);
        console.log('='.repeat(80));
        
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
        
        // 处理作者信息：如果authors是字符串且包含年份/来源，需要清理
        let authorsText = '未知作者';
        if (lit.authors) {
            if (Array.isArray(lit.authors)) {
                authorsText = lit.authors.join(', ');
            } else if (typeof lit.authors === 'string') {
                // 如果authors字符串包含年份和来源（格式如："K Grauman, B Leibe - 2011 - books.google.com"）
                // 只提取作者部分（在第一个"-"之前的部分）
                const authorsStr = lit.authors.trim();
                const dashIndex = authorsStr.indexOf(' - ');
                if (dashIndex > 0) {
                    authorsText = authorsStr.substring(0, dashIndex).trim();
                } else {
                    authorsText = authorsStr;
                }
            }
        }
        
        // 处理年份：确保显示年份（优先使用year字段，如果没有则尝试从authors中提取）
        let yearText = '';
        if (lit.year) {
            // year可能是字符串或数字
            const yearValue = typeof lit.year === 'number' ? lit.year : (typeof lit.year === 'string' ? lit.year.trim() : '');
            if (yearValue) {
                yearText = `(${yearValue})`;
            }
        } else if (lit.authors && typeof lit.authors === 'string') {
            // 尝试从authors字符串中提取年份（格式如："... - 2011 - ..."）
            const yearMatch = lit.authors.match(/\s-\s(\d{4})\s-/);
            if (yearMatch && yearMatch[1]) {
                yearText = `(${yearMatch[1]})`;
            }
        }
        
        // 处理期刊信息：优先使用journal字段，如果没有则使用source字段
        let journalText = '';
        if (lit.journal && typeof lit.journal === 'string' && lit.journal.trim()) {
            journalText = ` | <strong>期刊：</strong>${lit.journal.trim()}`;
        } else if (lit.source && typeof lit.source === 'string' && lit.source.trim()) {
            // 如果source不是年份（不是纯数字），则作为期刊显示
            const sourceStr = lit.source.trim();
            if (!/^\d{4}$/.test(sourceStr)) {
                journalText = ` | <strong>期刊：</strong>${sourceStr}`;
            }
        }
        
        const citedText = lit.cited !== undefined && lit.cited !== null ? ` | <strong>被引：</strong>${lit.cited}` : '';
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
