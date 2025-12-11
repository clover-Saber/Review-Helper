// 需求管理模块：处理主页面的需求分析功能
window.RequirementManager = {
    // 分析需求并生成大纲
    async analyzeRequirement(apiKey, requirement, targetCount, apiProvider = 'deepseek', modelName = null) {
        const prompt = `你是一位专业的学术文献综述助手。用户需要撰写一篇文献综述。请分析以下需求：

用户需求：
${requirement}

目标文献数量：${targetCount}篇

请根据用户需求生成一篇SCI论文格式的文献综述标准大纲结构。大纲应包括：
- 主要章节：根据研究主题，列出1-3个主要章节，每个章节聚焦一个核心研究方向或技术领域
- 每个章节可包含2-4段落来组织相关文献

注意：大纲应仅列出章节结构和主题方向，不包含详细内容，如引用格式、挑战描述等。

重要：大纲中的所有内容必须使用中文，包括章节标题、子主题和任何描述。

请以JSON格式返回结果：
{
  "outline": "大纲内容（使用 \\n 分隔不同部分）"
}

大纲格式示例：
1. 章节标题1
   段落1.1
   段落1.2
2. 章节标题2
   段落2.1
   段落2.2
3. 章节标题3

注意事项：
- outline字段应为字符串，使用 \\n 分隔不同部分
- 大纲应仅列出章节结构和主题方向，不包含引用格式、挑战描述、研究细节等
- 所有内容必须使用中文
- 仅返回JSON，不要添加任何其他文字说明`;

        const content = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7, modelName);
        
        // 解析JSON
        let jsonStr = content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            const objMatch = content.match(/\{[\s\S]*\}/);
            if (objMatch) jsonStr = objMatch[0];
        }

        const result = JSON.parse(jsonStr);
        
        // 只返回大纲，不返回关键词
        return {
            outline: result.outline || ''
        };
    },

    // 更新目标数量提示
    updateTargetHint() {
        const targetCount = parseInt(window.UIUtils.getValue('main-target-count')) || 50;
        const hintElement = document.getElementById('main-target-hint');
        if (hintElement) {
            hintElement.textContent = `提示：将搜索 ${targetCount} 篇文献`;
        }
    },

    // 为撰写子项目生成大纲（基于文献列表）
    async generateOutlineForReview(apiKey, literatureList, chapterCount, outlineRequirement, apiProvider = 'deepseek', modelName = null, language = 'zh') {
        // 构建文献信息列表（包含题目和年份）
        const literatureInfoList = literatureList.map((lit, index) => {
            const title = lit.title || '';
            const year = lit.year || 'Unknown';
            return `${index + 1}. ${title} (${year})`;
        }).join('\n');
        
        // 根据语言构建不同的提示词
        let prompt;
        if (language === 'en') {
            prompt = `You are a professional academic literature review assistant. The user needs to write a literature review and has collected the following literature:

Literature List:
${literatureInfoList}

Chapter Count Requirement: ${chapterCount} chapters`;

            if (outlineRequirement && outlineRequirement.trim().length > 0) {
                prompt += `\n\nOutline Requirements:\n${outlineRequirement}`;
            }

            prompt += `\n\nPlease generate a standard outline structure for a SCI paper format literature review based on the above literature list. The outline should include:
- Main chapters: Generate ${chapterCount} main chapters based on the literature themes and research directions, each chapter focusing on a core research direction or technical field
- Each chapter can contain 2-4 paragraphs to organize related literature

Notes:
- The outline should only list chapter structure and topic directions, without detailed content such as citation formats, challenge descriptions, etc.
- All content in the outline MUST be written in English, including chapter titles, subtopics, and any descriptions
- Chapters should be able to cover all provided literature themes
- You need to assign each literature to a specific chapter and paragraph based on its content and theme

Please return the result in JSON format:
{
  "outline": "Outline content (use \\n to separate different parts)",
  "literatureMapping": [
    {
      "literatureIndex": 1,
      "chapter": 1,
      "paragraph": 1
    },
    {
      "literatureIndex": 2,
      "chapter": 1,
      "paragraph": 2
    }
  ]
}

Outline format example:
1. Chapter Title 1
   Paragraph 1.1
   Paragraph 1.2
2. Chapter Title 2
   Paragraph 2.1
   Paragraph 2.2
3. Chapter Title 3

Important Notes:
- The outline field should be a string, using \\n to separate different parts
- The outline should only list chapter structure and topic directions, without citation formats, challenge descriptions, research details, etc.
- All content MUST be written in English
- literatureMapping is an array that maps each literature (by its index in the list, starting from 1) to a chapter number and paragraph number
- Each literature must be assigned to exactly one chapter and one paragraph
- Only return JSON, do not add any other text explanations`;
        } else {
            prompt = `你是一位专业的学术文献综述助手。用户需要撰写一篇文献综述，已经收集了以下文献：

文献列表：
${literatureInfoList}

章节数要求：${chapterCount}个章节`;

            if (outlineRequirement && outlineRequirement.trim().length > 0) {
                prompt += `\n\n大纲要求：\n${outlineRequirement}`;
            }

            prompt += `\n\n请根据以上文献列表，生成一篇SCI论文格式的文献综述标准大纲结构。大纲应包括：
- 主要章节：根据文献主题和研究方向，生成${chapterCount}个主要章节，每个章节聚焦一个核心研究方向或技术领域
- 每个章节可包含2-4个段落来组织相关文献

注意：
- 大纲应仅列出章节结构和主题方向，不包含详细内容，如引用格式、挑战描述等
- 大纲中的所有内容必须使用中文，包括章节标题、子主题和任何描述
- 章节应该能够覆盖所有提供的文献主题
- 需要为每篇文献分配到具体的章节和段落，基于文献的内容和主题

请以JSON格式返回结果：
{
  "outline": "大纲内容（使用 \\n 分隔不同部分）",
  "literatureMapping": [
    {
      "literatureIndex": 1,
      "chapter": 1,
      "paragraph": 1
    },
    {
      "literatureIndex": 2,
      "chapter": 1,
      "paragraph": 2
    }
  ]
}

大纲格式示例：
1. 章节标题1
   段落1.1
   段落1.2
2. 章节标题2
   段落2.1
   段落2.2
3. 章节标题3

注意事项：
- outline字段应为字符串，使用 \\n 分隔不同部分
- 大纲应仅列出章节结构和主题方向，不包含引用格式、挑战描述、研究细节等
- 所有内容必须使用中文
- literatureMapping是一个数组，将每篇文献（通过其在列表中的索引，从1开始）映射到章节号和段落号
- 每篇文献必须被分配到唯一的一个章节和一个段落
- 仅返回JSON，不要添加任何其他文字说明`;
        }

        const content = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7, modelName);
        
        // 解析JSON
        let jsonStr = content;
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            const objMatch = content.match(/\{[\s\S]*\}/);
            if (objMatch) jsonStr = objMatch[0];
        }

        const result = JSON.parse(jsonStr);
        
        return {
            outline: result.outline || '',
            literatureMapping: result.literatureMapping || []
        };
    }
};

