// 节点5：综述撰写模块
window.Node5Review = {
    // 解析大纲结构，提取章节和段落信息
    parseOutlineStructure(outline) {
        if (!outline) return [];
        
        const lines = outline.split('\n');
        const chapters = [];
        let currentChapter = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // 匹配章节标题：以数字开头，如 "1. 章节标题" 或 "1 章节标题"
            const chapterMatch = trimmed.match(/^(\d+)\.?\s+(.+)$/);
            if (chapterMatch) {
                const chapterNum = parseInt(chapterMatch[1]);
                const chapterTitle = chapterMatch[2].trim();
                
                if (currentChapter) {
                    chapters.push(currentChapter);
                }
                
                currentChapter = {
                    chapter: chapterNum,
                    title: chapterTitle,
                    paragraphs: []
                };
            } else if (currentChapter && trimmed.match(/^\s+/)) {
                // 段落（有缩进的行）
                const paragraphTitle = trimmed.trim();
                if (paragraphTitle) {
                    currentChapter.paragraphs.push(paragraphTitle);
                }
            }
        }
        
        if (currentChapter) {
            chapters.push(currentChapter);
        }
        
        return chapters;
    },

    // 根据文献映射获取某个章节的文献列表
    getLiteratureForChapter(literatureList, literatureMapping, chapterNum) {
        if (!literatureMapping || literatureMapping.length === 0) {
            // 如果没有映射，按照 actualIndex 或 initialIndex 排序
            return [...literatureList].sort((a, b) => {
                const aIndex = a.actualIndex !== null && a.actualIndex !== undefined ? a.actualIndex : (a.initialIndex || 0);
                const bIndex = b.actualIndex !== null && b.actualIndex !== undefined ? b.actualIndex : (b.initialIndex || 0);
                return aIndex - bIndex;
            });
        }
        
        // 创建索引映射：使用 initialIndex 作为键
        const indexMap = new Map();
        literatureList.forEach((lit) => {
            const litIndex = lit.initialIndex !== null && lit.initialIndex !== undefined 
                ? lit.initialIndex 
                : (lit.actualIndex || 0);
            if (litIndex > 0) {
                indexMap.set(litIndex, lit);
            }
        });
        
        // 获取该章节的文献索引（literatureIndex 对应 initialIndex）
        const chapterLiteratureIndices = literatureMapping
            .filter(m => m.chapter === chapterNum)
            .map(m => m.literatureIndex);
        
        // 获取对应的文献对象
        const chapterLiterature = chapterLiteratureIndices
            .map(idx => indexMap.get(idx))
            .filter(lit => lit !== undefined);
        
        // 按照章节、段落、年份排序（与 reorderLiteratureByOutline 的逻辑一致）
        return chapterLiterature.sort((a, b) => {
            const aChapter = a.chapter || 999;
            const bChapter = b.chapter || 999;
            const aParagraph = a.paragraph || 999;
            const bParagraph = b.paragraph || 999;
            const aYear = parseInt(a.year) || 0;
            const bYear = parseInt(b.year) || 0;
            
            // 先按章节，再按段落，最后按年份（年份越大越靠前）
            if (aChapter !== bChapter) {
                return aChapter - bChapter;
            }
            if (aParagraph !== bParagraph) {
                return aParagraph - bParagraph;
            }
            return bYear - aYear; // 年份降序
        });
    },

    // 自动执行综述撰写（按章节分别生成）
    async execute(apiKey, selectedLiterature, requirementData, apiProvider = 'deepseek', modelName = null) {
        const language = requirementData.language || 'zh';
        const outline = requirementData.outline || '';
        const literatureMapping = requirementData.literatureMapping || [];
        
        // 解析大纲结构
        const chapters = this.parseOutlineStructure(outline);
        
        if (chapters.length === 0) {
            // 如果没有解析到章节，使用原来的方法（一次性生成）
            return await this.executeSingle(apiKey, selectedLiterature, requirementData, apiProvider, modelName);
        }
        
        // 按章节分别生成
        const chapterContents = [];
        
        for (let i = 0; i < chapters.length; i++) {
            const chapter = chapters[i];
            const chapterNum = chapter.chapter;
            
            console.log(`[Node5Review] 正在生成第 ${chapterNum} 章: ${chapter.title}`);
            
            // 获取该章节的文献
            const chapterLiterature = this.getLiteratureForChapter(selectedLiterature, literatureMapping, chapterNum);
            
            // 生成该章节的内容
            const chapterContent = await this.generateChapter(
                apiKey,
                chapterLiterature,
                chapter,
                requirementData,
                apiProvider,
                modelName
            );
            
            chapterContents.push({
                chapter: chapterNum,
                title: chapter.title,
                content: chapterContent
            });
        }
        
        // 整合所有章节内容
        const fullReview = chapterContents
            .sort((a, b) => a.chapter - b.chapter)
            .map(item => {
                if (language === 'en') {
                    return `## ${item.chapter}. ${item.title}\n\n${item.content}`;
                } else {
                    return `## ${item.chapter}. ${item.title}\n\n${item.content}`;
                }
            })
            .join('\n\n');
        
        return fullReview;
    },

    // 生成单个章节的内容
    async generateChapter(apiKey, chapterLiterature, chapter, requirementData, apiProvider, modelName) {
        const language = requirementData.language || 'zh';
        
        // 确保文献按照 actualIndex 或 initialIndex 排序（getLiteratureForChapter 已经排序，但这里再次确保）
        const sortedChapterLiterature = [...chapterLiterature].sort((a, b) => {
            const aIndex = a.actualIndex !== null && a.actualIndex !== undefined ? a.actualIndex : (a.initialIndex || 0);
            const bIndex = b.actualIndex !== null && b.actualIndex !== undefined ? b.actualIndex : (b.initialIndex || 0);
            return aIndex - bIndex;
        });
        
        // 构建该章节的文献信息，使用 actualIndex 作为编号
        let literatureInfo;
        if (language === 'en') {
            literatureInfo = sortedChapterLiterature.map((lit) => {
                // 使用 actualIndex，如果为 null 则使用 initialIndex
                const litIndex = lit.actualIndex !== null && lit.actualIndex !== undefined 
                    ? lit.actualIndex 
                    : (lit.initialIndex || 0);
                return `[${litIndex}] ${lit.title}\nAuthors: ${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : 'Unknown'}\nYear: ${lit.year || 'Unknown'}\nAbstract: ${lit.abstract || 'No abstract'}`;
            }).join('\n\n');
        } else {
            literatureInfo = sortedChapterLiterature.map((lit) => {
                // 使用 actualIndex，如果为 null 则使用 initialIndex
                const litIndex = lit.actualIndex !== null && lit.actualIndex !== undefined 
                    ? lit.actualIndex 
                    : (lit.initialIndex || 0);
                return `[${litIndex}] ${lit.title}\n作者：${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知'}\n年份：${lit.year || '未知'}\n摘要：${lit.abstract || '无摘要'}`;
            }).join('\n\n');
        }
        
        // 构建章节大纲
        const chapterOutline = `${chapter.chapter}. ${chapter.title}\n${chapter.paragraphs.map((p, idx) => `   ${p}`).join('\n')}`;
        
        // 获取综述要求（可选）
        const reviewRequirement = requirementData.reviewRequirement || '';
        
        // 获取每章字数要求（可选）
        const chapterWordCount = requirementData.chapterWordCount || null;
        
        let prompt;
        if (language === 'en') {
            prompt = `Please write the content for Chapter ${chapter.chapter} of a literature review in SCI paper format.

Chapter Outline:
${chapterOutline}

Overall Review Outline:
${requirementData.outline || ''}

Requirement Description:
${requirementData.requirement || ''}`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n\nAdditional Review Requirements:
${reviewRequirement}`;
            }

            prompt += `\n\nLiterature Information for This Chapter (IN ORDER):
${literatureInfo}

CRITICAL CITATION REQUIREMENTS:
- You MUST cite ALL literature listed above in the order they appear (from [${sortedChapterLiterature.length > 0 ? (sortedChapterLiterature[0].actualIndex !== null && sortedChapterLiterature[0].actualIndex !== undefined ? sortedChapterLiterature[0].actualIndex : sortedChapterLiterature[0].initialIndex) : 1}] to [${sortedChapterLiterature.length > 0 ? (sortedChapterLiterature[sortedChapterLiterature.length - 1].actualIndex !== null && sortedChapterLiterature[sortedChapterLiterature.length - 1].actualIndex !== undefined ? sortedChapterLiterature[sortedChapterLiterature.length - 1].actualIndex : sortedChapterLiterature[sortedChapterLiterature.length - 1].initialIndex) : 1}])
- Citations MUST follow the exact order: [${sortedChapterLiterature.length > 0 ? (sortedChapterLiterature[0].actualIndex !== null && sortedChapterLiterature[0].actualIndex !== undefined ? sortedChapterLiterature[0].actualIndex : sortedChapterLiterature[0].initialIndex) : 1}], [${sortedChapterLiterature.length > 1 ? (sortedChapterLiterature[1].actualIndex !== null && sortedChapterLiterature[1].actualIndex !== undefined ? sortedChapterLiterature[1].actualIndex : sortedChapterLiterature[1].initialIndex) : 2}], [${sortedChapterLiterature.length > 2 ? (sortedChapterLiterature[2].actualIndex !== null && sortedChapterLiterature[2].actualIndex !== undefined ? sortedChapterLiterature[2].actualIndex : sortedChapterLiterature[2].initialIndex) : 3}], etc.
- Do NOT skip any literature numbers
- Do NOT cite literature in a different order
- Each literature must be cited exactly once (no more, no less)

Requirements:
1. Write ONLY the content for Chapter ${chapter.chapter}: ${chapter.title}
2. Follow the paragraph structure specified in the chapter outline
3. Accurately cite literature using [literature number] format in the EXACT order listed above
4. Rigorous logic and clear viewpoints
5. Comply with SCI paper writing standards
6. Do NOT include chapter title or section headers - only write the content${chapterWordCount ? `\n7. Word count for this chapter MUST be approximately ${chapterWordCount} words (strictly follow this requirement)` : '\n7. Word count should be appropriate for this chapter (typically 500-1500 words)'}`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n8. Pay special attention to the additional review requirements mentioned above`;
            }

            prompt += `\n\nCRITICAL LANGUAGE REQUIREMENT:
- The content MUST be written in English
- All content must be in English
- Do not use Chinese or any other language
- Directly output the chapter content in English, do not add any other text explanations or translations`;
        } else {
            prompt = `请撰写文献综述第${chapter.chapter}章的内容，格式为SCI论文格式。

章节大纲：
${chapterOutline}

整体综述大纲：
${requirementData.outline || ''}

需求描述：
${requirementData.requirement || ''}`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n\n综述要求：
${reviewRequirement}`;
            }

            prompt += `\n\n该章节的文献信息（按顺序）：
${literatureInfo}

重要引用要求：
- 必须按照上述文献列表的顺序引用所有文献（从[${sortedChapterLiterature.length > 0 ? (sortedChapterLiterature[0].actualIndex !== null && sortedChapterLiterature[0].actualIndex !== undefined ? sortedChapterLiterature[0].actualIndex : sortedChapterLiterature[0].initialIndex) : 1}]到[${sortedChapterLiterature.length > 0 ? (sortedChapterLiterature[sortedChapterLiterature.length - 1].actualIndex !== null && sortedChapterLiterature[sortedChapterLiterature.length - 1].actualIndex !== undefined ? sortedChapterLiterature[sortedChapterLiterature.length - 1].actualIndex : sortedChapterLiterature[sortedChapterLiterature.length - 1].initialIndex) : 1}]）
- 引用必须严格按照顺序：[${sortedChapterLiterature.length > 0 ? (sortedChapterLiterature[0].actualIndex !== null && sortedChapterLiterature[0].actualIndex !== undefined ? sortedChapterLiterature[0].actualIndex : sortedChapterLiterature[0].initialIndex) : 1}]、[${sortedChapterLiterature.length > 1 ? (sortedChapterLiterature[1].actualIndex !== null && sortedChapterLiterature[1].actualIndex !== undefined ? sortedChapterLiterature[1].actualIndex : sortedChapterLiterature[1].initialIndex) : 2}]、[${sortedChapterLiterature.length > 2 ? (sortedChapterLiterature[2].actualIndex !== null && sortedChapterLiterature[2].actualIndex !== undefined ? sortedChapterLiterature[2].actualIndex : sortedChapterLiterature[2].initialIndex) : 3}]等
- 不能跳过任何文献编号
- 不能以不同顺序引用文献
- 每篇文献必须被引用一次，且只能引用一次（不能多引，不能少引）

要求：
1. 只撰写第${chapter.chapter}章"${chapter.title}"的内容
2. 严格按照章节大纲中指定的段落结构撰写
3. 准确引用文献，使用[文献序号]格式标注，严格按照上述顺序引用
4. 逻辑严密，观点明确
5. 符合SCI论文写作规范
6. 不要包含章节标题或小节标题，只输出内容${chapterWordCount ? `\n7. 本章字数必须控制在约${chapterWordCount}字左右（请严格遵守此要求）` : '\n7. 字数应适合该章节（通常500-1500字）'}`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n8. 请特别注意上述综述要求`;
            }

            prompt += `\n\n重要语言要求：
- 内容必须使用中文撰写
- 所有内容都必须使用中文
- 不要使用英文或其他语言
- 直接输出中文的章节内容，不要添加任何其他文字说明或翻译`;
        }

        const chapterContent = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7, modelName);
        
        return chapterContent;
    },

    // 单次生成（用于没有章节结构的情况）
    async executeSingle(apiKey, selectedLiterature, requirementData, apiProvider = 'deepseek', modelName = null) {
        const language = requirementData.language || 'zh';
        
        // 先按照 actualIndex 或 initialIndex 排序
        const sortedLiterature = [...selectedLiterature].sort((a, b) => {
            const aIndex = a.actualIndex !== null && a.actualIndex !== undefined ? a.actualIndex : (a.initialIndex || 0);
            const bIndex = b.actualIndex !== null && b.actualIndex !== undefined ? b.actualIndex : (b.initialIndex || 0);
            return aIndex - bIndex;
        });
        
        // 构建文献信息，使用 actualIndex 作为编号
        let literatureInfo;
        if (language === 'en') {
            literatureInfo = sortedLiterature.map((lit) => {
                // 使用 actualIndex，如果为 null 则使用 initialIndex
                const litIndex = lit.actualIndex !== null && lit.actualIndex !== undefined 
                    ? lit.actualIndex 
                    : (lit.initialIndex || 0);
                return `[${litIndex}] ${lit.title}\nAuthors: ${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : 'Unknown'}\nYear: ${lit.year || 'Unknown'}\nAbstract: ${lit.abstract || 'No abstract'}`;
            }).join('\n\n');
        } else {
            literatureInfo = sortedLiterature.map((lit) => {
                // 使用 actualIndex，如果为 null 则使用 initialIndex
                const litIndex = lit.actualIndex !== null && lit.actualIndex !== undefined 
                    ? lit.actualIndex 
                    : (lit.initialIndex || 0);
                return `[${litIndex}] ${lit.title}\n作者：${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知'}\n年份：${lit.year || '未知'}\n摘要：${lit.abstract || '无摘要'}`;
            }).join('\n\n');
        }

        // 获取综述要求（可选）
        const reviewRequirement = requirementData.reviewRequirement || '';
        
        let prompt;
        if (language === 'en') {
            prompt = `Please write a literature review in SCI paper format based on the following literature information and review outline.

Review Outline:
${requirementData.outline}

Requirement Description:
${requirementData.requirement || ''}`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n\nAdditional Review Requirements:
${reviewRequirement}`;
            }

            prompt += `\n\nLiterature Information (IN ORDER):
${literatureInfo}

CRITICAL CITATION REQUIREMENTS:
- You MUST cite ALL literature listed above in the order they appear (from [${sortedLiterature.length > 0 ? (sortedLiterature[0].actualIndex !== null && sortedLiterature[0].actualIndex !== undefined ? sortedLiterature[0].actualIndex : sortedLiterature[0].initialIndex) : 1}] to [${sortedLiterature.length > 0 ? (sortedLiterature[sortedLiterature.length - 1].actualIndex !== null && sortedLiterature[sortedLiterature.length - 1].actualIndex !== undefined ? sortedLiterature[sortedLiterature.length - 1].actualIndex : sortedLiterature[sortedLiterature.length - 1].initialIndex) : 1}])
- Citations MUST follow the exact order: [${sortedLiterature.length > 0 ? (sortedLiterature[0].actualIndex !== null && sortedLiterature[0].actualIndex !== undefined ? sortedLiterature[0].actualIndex : sortedLiterature[0].initialIndex) : 1}], [${sortedLiterature.length > 1 ? (sortedLiterature[1].actualIndex !== null && sortedLiterature[1].actualIndex !== undefined ? sortedLiterature[1].actualIndex : sortedLiterature[1].initialIndex) : 2}], [${sortedLiterature.length > 2 ? (sortedLiterature[2].actualIndex !== null && sortedLiterature[2].actualIndex !== undefined ? sortedLiterature[2].actualIndex : sortedLiterature[2].initialIndex) : 3}], etc.
- Do NOT skip any literature numbers
- Do NOT cite literature in a different order
- Each literature must be cited exactly once (no more, no less)

Requirements:
1. Strictly follow the provided outline structure - write content only for the sections listed in the outline
2. Do not add introduction or conclusion sections unless they are explicitly included in the outline
3. Accurately cite literature using [literature number] format in the EXACT order listed above
4. Rigorous logic and clear viewpoints
5. Comply with SCI paper writing standards
6. Word count should be between 3000-5000 words`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n7. Pay special attention to the additional review requirements mentioned above`;
            }

            prompt += `\n\nCRITICAL LANGUAGE REQUIREMENT:
- The entire literature review MUST be written in English
- All content must be in English
- Do not use Chinese or any other language
- If the outline is in Chinese, translate it to English in your writing while maintaining the structure
- Directly output the review content in English, do not add any other text explanations or translations`;
        } else {
            prompt = `请基于以下文献信息和综述大纲，撰写一篇SCI论文格式的文献综述。

综述大纲：
${requirementData.outline}

需求描述：
${requirementData.requirement || ''}`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n\n综述要求：
${reviewRequirement}`;
            }

            prompt += `\n\n文献信息（按顺序）：
${literatureInfo}

重要引用要求：
- 必须按照上述文献列表的顺序引用所有文献（从[${sortedLiterature.length > 0 ? (sortedLiterature[0].actualIndex !== null && sortedLiterature[0].actualIndex !== undefined ? sortedLiterature[0].actualIndex : sortedLiterature[0].initialIndex) : 1}]到[${sortedLiterature.length > 0 ? (sortedLiterature[sortedLiterature.length - 1].actualIndex !== null && sortedLiterature[sortedLiterature.length - 1].actualIndex !== undefined ? sortedLiterature[sortedLiterature.length - 1].actualIndex : sortedLiterature[sortedLiterature.length - 1].initialIndex) : 1}]）
- 引用必须严格按照顺序：[${sortedLiterature.length > 0 ? (sortedLiterature[0].actualIndex !== null && sortedLiterature[0].actualIndex !== undefined ? sortedLiterature[0].actualIndex : sortedLiterature[0].initialIndex) : 1}]、[${sortedLiterature.length > 1 ? (sortedLiterature[1].actualIndex !== null && sortedLiterature[1].actualIndex !== undefined ? sortedLiterature[1].actualIndex : sortedLiterature[1].initialIndex) : 2}]、[${sortedLiterature.length > 2 ? (sortedLiterature[2].actualIndex !== null && sortedLiterature[2].actualIndex !== undefined ? sortedLiterature[2].actualIndex : sortedLiterature[2].initialIndex) : 3}]等
- 不能跳过任何文献编号
- 不能以不同顺序引用文献
- 每篇文献必须被引用一次，且只能引用一次（不能多引，不能少引）

要求：
1. 严格按照提供的大纲结构撰写 - 只撰写大纲中列出的章节内容
2. 不要添加引言或结论部分，除非大纲中明确包含这些部分
3. 准确引用文献，使用[文献序号]格式标注，严格按照上述顺序引用
4. 逻辑严密，观点明确
5. 符合SCI论文写作规范
6. 字数控制在3000-5000字`;

            if (reviewRequirement && reviewRequirement.trim().length > 0) {
                prompt += `\n7. 请特别注意上述综述要求`;
            }

            prompt += `\n\n重要语言要求：
- 整篇文献综述必须使用中文撰写
- 所有内容都必须使用中文
- 不要使用英文或其他语言
- 如果大纲是英文的，在撰写时将其翻译为中文，同时保持结构不变
- 直接输出中文的综述内容，不要添加任何其他文字说明或翻译`;
        }

        const reviewContent = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7, modelName);
        
        return reviewContent;
    },

    // 解析综述中的文献引用顺序
    parseCitationOrder(reviewContent, literatureList) {
        if (!reviewContent || !literatureList || literatureList.length === 0) {
            return literatureList;
        }

        // 提取所有引用标记 [1], [2], [1,2], [1-3] 等
        const citationPattern = /\[(\d+(?:[-,]\d+)*)\]/g;
        const citations = [];
        let match;
        
        while ((match = citationPattern.exec(reviewContent)) !== null) {
            const citationStr = match[1];
            // 处理多种格式：[1], [1,2], [1-3], [1,2,3] 等
            if (citationStr.includes('-')) {
                // 处理范围：[1-3] -> [1,2,3]
                const [start, end] = citationStr.split('-').map(n => parseInt(n.trim(), 10));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let i = start; i <= end; i++) {
                        citations.push(i);
                    }
                }
            } else {
                // 处理逗号分隔：[1,2,3]
                const numbers = citationStr.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0);
                citations.push(...numbers);
            }
        }

        // 获取首次出现的顺序（去重，保留第一次出现的顺序）
        const firstOccurrence = new Map();
        citations.forEach((num) => {
            if (num > 0 && num <= literatureList.length && !firstOccurrence.has(num)) {
                firstOccurrence.set(num, firstOccurrence.size);
            }
        });

        // 按照首次出现的顺序排序，得到引用顺序
        const sortedCitations = Array.from(firstOccurrence.entries())
            .sort((a, b) => a[1] - b[1])
            .map(entry => entry[0]);

        // 为每篇文献确保有初始编号（如果还没有）
        const literatureWithIndex = literatureList.map((lit, index) => {
            const litCopy = { ...lit };
            if (litCopy.initialIndex === undefined || litCopy.initialIndex === null) {
                litCopy.initialIndex = index + 1;
            }
            return litCopy;
        });

        // 创建索引映射：初始编号 -> 文献对象
        const indexMap = new Map();
        literatureWithIndex.forEach((lit) => {
            const originalIndex = lit.initialIndex;
            if (originalIndex) {
                indexMap.set(originalIndex, lit);
            }
        });

        // 根据引用顺序重新排序文献
        const reorderedLiterature = [];
        const usedIndices = new Set();

        // 先添加在综述中被引用的文献（按引用顺序）
        sortedCitations.forEach(citationNum => {
            if (citationNum > 0 && citationNum <= literatureList.length && !usedIndices.has(citationNum)) {
                const lit = indexMap.get(citationNum);
                if (lit) {
                    const litCopy = { ...lit };
                    litCopy.actualIndex = reorderedLiterature.length + 1;
                    reorderedLiterature.push(litCopy);
                    usedIndices.add(citationNum);
                }
            }
        });

        // 再添加未被引用的文献（按初始编号排序）
        literatureWithIndex
            .filter(lit => !usedIndices.has(lit.initialIndex))
            .sort((a, b) => (a.initialIndex || 0) - (b.initialIndex || 0))
            .forEach((lit) => {
                const litCopy = { ...lit };
                // 未被引用的文献，actualIndex 为 null
                litCopy.actualIndex = null;
                reorderedLiterature.push(litCopy);
                usedIndices.add(lit.initialIndex);
            });

        return reorderedLiterature;
    },

    // 显示综述内容
    display(reviewContent, selectedLiterature) {
        const reviewEl = document.getElementById('review-content');
        if (reviewEl) {
            reviewEl.value = reviewContent;
        }

        // 显示选中的文献
        this.displaySelectedLiterature(selectedLiterature);
    },

    // 显示选中的文献
    displaySelectedLiterature(selectedLiterature) {
        const container = document.getElementById('selected-list');
        const countElement = document.getElementById('selected-count');
        
        if (!container) {
            console.error('[Node5Review] selected-list container not found');
            return;
        }
        
        // 更新数量显示
        if (countElement) {
            countElement.textContent = selectedLiterature ? selectedLiterature.length : 0;
        }
        
        container.innerHTML = '';

        if (!selectedLiterature || selectedLiterature.length === 0) {
            container.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无已选文献</p>';
            return;
        }

        selectedLiterature.forEach((lit, index) => {
            const item = document.createElement('div');
            item.className = 'literature-item';
            item.style.cssText = 'margin-bottom: 10px; padding: 12px; background: #f8f9fa; border-radius: 6px; border-left: 3px solid #4a90e2;';
            
            const authorsText = lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知作者';
            
            item.innerHTML = `
                <p style="margin: 0; font-size: 14px; font-weight: 500; color: #333;">
                    <strong>[${index + 1}]</strong> ${lit.title || '无标题'}
                </p>
                <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                    ${authorsText}${lit.year ? ` (${lit.year})` : ''}
                </p>
            `;
            container.appendChild(item);
        });
    }
};

