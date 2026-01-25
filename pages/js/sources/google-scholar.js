// Google Scholar 和烂番薯学术的文献补全模块
// 注意：烂番薯学术是Google Scholar的国内镜像，逻辑相同
window.LiteratureSourceGoogleScholar = {
    /**
     * 补全单篇文献信息（通过URL提取）
     * @param {Object} lit - 文献对象
     * @param {string} url - 文献URL
     * @param {string} apiKey - API Key
     * @param {string} apiProvider - API提供商
     * @param {string} modelName - 模型名称
     * @param {Object} extractOptions - 提取选项
     * @returns {Promise<Object>} 补全结果
     */
    async completeLiterature(lit, url, apiKey, apiProvider, modelName, extractOptions) {
        const { needAuthors = true, needYear = true, needJournal = true, needAbstract = true, currentTitle = '' } = extractOptions;
        
        console.log(`[Google Scholar补全] 开始补全文献: "${lit.title}"`);
        console.log(`[Google Scholar补全] URL: ${url}`);
        
        // 调用主进程的URL提取函数
        if (!window.electronAPI || !window.electronAPI.extractLiteratureInfoFromUrl) {
            throw new Error('extractLiteratureInfoFromUrl方法不可用');
        }
        
        const urlExtractedInfo = await window.electronAPI.extractLiteratureInfoFromUrl(
            url,
            apiKey,
            apiProvider,
            modelName,
            extractOptions
        );
        
        if (!urlExtractedInfo || !urlExtractedInfo.success) {
            const errorMsg = urlExtractedInfo?.error || '未知错误';
            console.error(`[Google Scholar补全] 从URL提取信息失败: ${errorMsg}`);
            return {
                success: false,
                error: errorMsg,
                prompt: urlExtractedInfo?.prompt,
                rawResponse: urlExtractedInfo?.rawResponse
            };
        }
        
        // 补全文献字段
        const extractedData = {
            authors: urlExtractedInfo.authors,
            year: urlExtractedInfo.year,
            journal: urlExtractedInfo.journal,
            abstract: urlExtractedInfo.abstract
        };
        
        let hasUpdate = false;
        
        // 补全摘要
        const currentAbstract = lit.abstract ? lit.abstract.trim() : '';
        const extractedAbstract = extractedData.abstract ? extractedData.abstract.trim() : '';
        const currentAbstractComplete = window.Node3Complete.isAbstractComplete(currentAbstract);
        const extractedAbstractComplete = window.Node3Complete.isAbstractComplete(extractedAbstract);
        
        if (extractedAbstract && extractedAbstract.length > 0 && extractedAbstract !== 'null' && 
            (!currentAbstract || !currentAbstractComplete || (extractedAbstractComplete && extractedAbstract.length > currentAbstract.length))) {
            lit.abstract = extractedAbstract;
            hasUpdate = true;
            console.log(`[Google Scholar补全] ✓ 摘要已补全 (长度: ${extractedAbstract.length})`);
        }
        
        // 补全期刊
        const currentJournal = lit.journal && typeof lit.journal === 'string' ? lit.journal.trim() : '';
        const extractedJournal = extractedData.journal && extractedData.journal !== 'null' ? extractedData.journal.trim() : '';
        
        if (extractedJournal && extractedJournal.length > 0 && (!currentJournal || currentJournal.length === 0)) {
            lit.journal = extractedJournal;
            hasUpdate = true;
            console.log(`[Google Scholar补全] ✓ 期刊已补全: ${lit.journal}`);
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
                hasUpdate = true;
                console.log(`[Google Scholar补全] ✓ 作者已补全: ${lit.authors}`);
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
        
        if (!hasCurrentYear && extractedData.year && extractedData.year !== null && extractedData.year !== 'null') {
            const extractedYear = extractedData.year;
            if (typeof extractedYear === 'number' && extractedYear > 1900 && extractedYear < 2100) {
                lit.year = extractedYear;
                hasUpdate = true;
                console.log(`[Google Scholar补全] ✓ 年份已补全: ${lit.year}`);
            } else if (typeof extractedYear === 'string') {
                const yearStr = extractedYear.trim();
                if (yearStr !== 'null' && yearStr.length > 0) {
                    const yearNum = parseInt(yearStr, 10);
                    if (!isNaN(yearNum) && yearNum > 1900 && yearNum < 2100) {
                        lit.year = yearNum;
                        hasUpdate = true;
                        console.log(`[Google Scholar补全] ✓ 年份已补全: ${lit.year}`);
                    }
                }
            }
        }
        
        // 清理可能的无效值
        if (lit.authors === 'null' || lit.authors === null) {
            lit.authors = null;
        }
        if (lit.year === 'null' || lit.year === null) {
            lit.year = null;
        }
        if (lit.journal === 'null' || lit.journal === null) {
            lit.journal = null;
        }
        if (lit.abstract === 'null' || lit.abstract === null) {
            lit.abstract = null;
        }
        
        return {
            success: true,
            hasUpdate: hasUpdate,
            prompt: urlExtractedInfo.prompt,
            rawResponse: urlExtractedInfo.rawResponse
        };
    }
};

