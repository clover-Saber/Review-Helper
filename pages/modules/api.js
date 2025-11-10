// API模块：处理所有API调用
window.API = {
    // DeepSeek API调用
    async callDeepSeek(apiKey, messages, temperature = 0.7) {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                temperature: temperature
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'API调用失败');
        }

        if (data.choices && data.choices[0]) {
            return data.choices[0].message.content.trim();
        }
        throw new Error('API返回格式错误');
    },

    // Google Scholar搜索
    async searchGoogleScholar(keyword, limit, minYear) {
        const response = await window.electronAPI.searchGoogleScholar(keyword, limit, minYear);
        
        // 处理返回格式
        if (response && typeof response === 'object') {
            if (Array.isArray(response)) {
                return response;
            } else if (response.results && Array.isArray(response.results)) {
                return response.results;
            } else if (response.success && response.results) {
                return response.results;
            }
        }
        return [];
    }
};

