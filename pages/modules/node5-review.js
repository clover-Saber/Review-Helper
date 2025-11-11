// 节点5：综述撰写模块
window.Node5Review = {
    // 自动执行综述撰写
    async execute(apiKey, selectedLiterature, requirementData, apiProvider = 'deepseek') {
        const language = requirementData.language || 'zh';
        
        let literatureInfo;
        if (language === 'en') {
            literatureInfo = selectedLiterature.map((lit, index) => {
                return `[${index + 1}] ${lit.title}\nAuthors: ${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : 'Unknown'}\nYear: ${lit.year || 'Unknown'}\nAbstract: ${lit.abstract || 'No abstract'}`;
            }).join('\n\n');
        } else {
            literatureInfo = selectedLiterature.map((lit, index) => {
                return `[${index + 1}] ${lit.title}\n作者：${lit.authors ? (Array.isArray(lit.authors) ? lit.authors.join(', ') : lit.authors) : '未知'}\n年份：${lit.year || '未知'}\n摘要：${lit.abstract || '无摘要'}`;
            }).join('\n\n');
        }

        let prompt;
        if (language === 'en') {
            prompt = `Please write a literature review in SCI paper format based on the following literature information and review outline.

Review Outline:
${requirementData.outline}

Requirement Description:
${requirementData.requirement}

Literature Information:
${literatureInfo}

Requirements:
1. Strictly follow the provided outline structure - write content only for the sections listed in the outline
2. Do not add introduction or conclusion sections unless they are explicitly included in the outline
3. Accurately cite literature using [literature number] format
4. Rigorous logic and clear viewpoints
5. Comply with SCI paper writing standards
6. Word count should be between 3000-5000 words

CRITICAL LANGUAGE REQUIREMENT:
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
${requirementData.requirement}

文献信息：
${literatureInfo}

要求：
1. 严格按照提供的大纲结构撰写 - 只撰写大纲中列出的章节内容
2. 不要添加引言或结论部分，除非大纲中明确包含这些部分
3. 准确引用文献，使用[文献序号]格式标注
4. 逻辑严密，观点明确
5. 符合SCI论文写作规范
6. 字数控制在3000-5000字

重要语言要求：
- 整篇文献综述必须使用中文撰写
- 所有内容都必须使用中文
- 不要使用英文或其他语言
- 如果大纲是英文的，在撰写时将其翻译为中文，同时保持结构不变
- 直接输出中文的综述内容，不要添加任何其他文字说明或翻译`;
        }

        const reviewContent = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7);
        
        return reviewContent;
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

