// 需求管理模块：处理主页面的需求分析功能
window.RequirementManager = {
    // 分析需求并生成大纲
    async analyzeRequirement(apiKey, requirement, targetCount, apiProvider = 'deepseek') {
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

        const content = await window.API.callAPI(apiProvider, apiKey, [{ role: 'user', content: prompt }], 0.7);
        
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
    }
};

