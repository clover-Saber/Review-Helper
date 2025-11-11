// API模块：处理所有API调用
window.API = {
    // API供应商配置
    providers: {
        'deepseek': {
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com/v1/chat/completions',
            defaultModel: 'deepseek-chat',
            docsUrl: 'https://api-docs.deepseek.com/zh-cn/api/deepseek-api/'
        },
        'gemini': {
            name: 'Google Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
            defaultModel: 'gemini-2.0-flash-exp', // 使用更新的模型，也支持 gemini-pro, gemini-1.5-flash 等
            docsUrl: 'https://ai.google.dev/'
        }
    },

    // 通用API调用函数
    async callAPI(provider, apiKey, messages, temperature = 0.7) {
        if (!this.providers[provider]) {
            throw new Error(`不支持的API供应商: ${provider}`);
        }

        const providerConfig = this.providers[provider];
        
        // 根据不同的供应商使用不同的调用方式
        if (provider === 'gemini') {
            // Gemini API使用不同的格式
            return await this.callGemini(apiKey, messages, temperature, providerConfig);
        } else {
            // OpenAI兼容格式（DeepSeek等）
            return await this.callOpenAIFormat(apiKey, messages, temperature, providerConfig);
        }
    },

    // OpenAI兼容格式的API调用（DeepSeek, OpenAI, Moonshot等）
    async callOpenAIFormat(apiKey, messages, temperature, providerConfig) {
        const response = await fetch(providerConfig.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: providerConfig.defaultModel,
                messages: messages,
                temperature: temperature
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || `API调用失败: ${response.status}`);
        }

        if (data.choices && data.choices[0]) {
            return data.choices[0].message.content.trim();
        }
        throw new Error('API返回格式错误');
    },

    // Gemini API调用
    async callGemini(apiKey, messages, temperature, providerConfig) {
        // 将OpenAI格式的消息转换为Gemini格式
        // Gemini使用contents数组，每个元素包含role和parts
        const contents = messages.map(msg => {
            const role = msg.role === 'assistant' ? 'model' : 'user';
            return {
                role: role,
                parts: [{ text: msg.content }]
            };
        });

        // Gemini API URL格式: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={API_KEY}
        const model = providerConfig.defaultModel;
        const url = `${providerConfig.baseUrl}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    temperature: temperature,
                    topP: 0.95,
                    topK: 40
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            const errorMsg = data.error?.message || data.error || `API调用失败: ${response.status}`;
            throw new Error(errorMsg);
        }

        // 解析Gemini API响应
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
            const text = data.candidates[0].content.parts[0].text;
            if (text) {
                return text.trim();
            }
        }
        throw new Error('API返回格式错误：未找到有效的内容');
    },


    // DeepSeek API调用（保持向后兼容）
    async callDeepSeek(apiKey, messages, temperature = 0.7) {
        return await this.callAPI('deepseek', apiKey, messages, temperature);
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

