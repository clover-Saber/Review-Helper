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
            defaultModel: 'gemini-2.5-flash', // 默认模型
            models: {
                'gemini-2.5-flash': {
                    name: 'Gemini 2.5 Flash',
                    description: '快速响应，适合大多数任务'
                },
                'gemini-2.5-pro': {
                    name: 'Gemini 2.5 Pro',
                    description: '更强大的性能，适合复杂任务'
                }
            },
            docsUrl: 'https://ai.google.dev/'
        },
        'siliconflow': {
            name: '硅基流动',
            baseUrl: 'https://api.siliconflow.cn/v1/chat/completions',
            defaultModel: 'Qwen/QwQ-32B',
            docsUrl: 'https://siliconflow.cn/',
            // 硅基流动支持用户自定义模型，模型列表在UI中提供
            supportsCustomModel: true
        },
        'poe': {
            name: 'Poe',
            baseUrl: 'https://api.poe.com/v1/chat/completions',
            defaultModel: 'Claude-Sonnet-4',
            docsUrl: 'https://poe.com/api_key',
            // Poe 支持用户自定义模型，模型列表在UI中提供
            supportsCustomModel: true
        }
    },

    // 通用API调用函数
    async callAPI(provider, apiKey, messages, temperature = 0.7, modelName = null) {
        if (!this.providers[provider]) {
            throw new Error(`不支持的API供应商: ${provider}`);
        }

        const providerConfig = this.providers[provider];
        
        // 根据不同的供应商使用不同的调用方式
        if (provider === 'gemini') {
            // Gemini API使用不同的格式
            // 如果指定了 modelName，使用指定的模型，否则使用默认模型
            const geminiModel = modelName || providerConfig.defaultModel;
            return await this.callGemini(apiKey, messages, temperature, providerConfig, geminiModel);
        } else if (provider === 'siliconflow') {
            // 硅基流动使用OpenAI兼容格式，但支持自定义模型
            const model = modelName || providerConfig.defaultModel;
            return await this.callSiliconFlow(apiKey, messages, temperature, providerConfig, model);
        } else if (provider === 'poe') {
            // Poe 使用OpenAI兼容格式，但支持自定义模型
            const model = modelName || providerConfig.defaultModel;
            return await this.callPoe(apiKey, messages, temperature, providerConfig, model);
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

    // 硅基流动API调用（OpenAI兼容格式，支持自定义模型）
    async callSiliconFlow(apiKey, messages, temperature, providerConfig, modelName) {
        const model = modelName || providerConfig.defaultModel;
        const response = await fetch(providerConfig.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
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

    // Poe API调用（OpenAI兼容格式，支持自定义模型）
    async callPoe(apiKey, messages, temperature, providerConfig, modelName) {
        const model = modelName || providerConfig.defaultModel;
        const response = await fetch(providerConfig.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
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
    async callGemini(apiKey, messages, temperature, providerConfig, modelName = null) {
        // 将OpenAI格式的消息转换为Gemini格式
        // Gemini使用contents数组，每个元素包含parts数组
        // 注意：Gemini API 的 contents 格式是 [{ parts: [{ text: "..." }] }]
        // 对于多轮对话，需要将历史消息合并
        const contents = messages.map(msg => {
            return {
                parts: [{ text: msg.content }]
            };
        });

        // Gemini API URL格式: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
        // API Key 通过 x-goog-api-key header 传递，而不是查询参数
        // 如果指定了 modelName，使用指定的模型，否则使用默认模型
        const model = modelName || providerConfig.defaultModel;
        const url = `${providerConfig.baseUrl}/${model}:generateContent`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
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
            // 处理 Gemini API 错误响应
            let errorMsg = '';
            
            if (data.error) {
                // Gemini API 标准错误格式
                if (data.error.message) {
                    errorMsg = data.error.message;
                } else if (typeof data.error === 'string') {
                    errorMsg = data.error;
                } else {
                    errorMsg = JSON.stringify(data.error);
                }
                
                // 检查是否是配额错误
                if (errorMsg.includes('quota') || errorMsg.includes('Quota exceeded') || errorMsg.includes('配额')) {
                    errorMsg = `Gemini API 配额已用完或未启用。\n\n` +
                              `错误详情：${errorMsg}\n\n` +
                              `解决方案：\n` +
                              `1. 检查您的 Google AI Studio 账户配额设置\n` +
                              `2. 确认 API Key 已启用 Gemini API 服务\n` +
                              `3. 访问 https://ai.google.dev/ 查看配额详情\n` +
                              `4. 如果使用免费层，可能需要等待配额重置或升级到付费计划`;
                }
                // 检查是否是模型不存在错误
                else if (errorMsg.includes('not found') || errorMsg.includes('is not supported')) {
                    errorMsg = `Gemini API 模型不存在或不受支持。\n\n` +
                              `错误详情：${errorMsg}\n\n` +
                              `当前使用的模型：${model}\n\n` +
                              `解决方案：\n` +
                              `1. 确认模型名称正确（v1beta API 支持：gemini-pro, gemini-1.5-pro 等）\n` +
                              `2. 访问 https://ai.google.dev/models 查看可用模型列表\n` +
                              `3. 检查 API Key 是否有权限访问该模型`;
                }
            } else {
                errorMsg = `API调用失败: HTTP ${response.status}`;
            }
            
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
    },
    
    // 烂番薯学术搜索
    // showWindowOnCaptcha: 如果为false，检测到验证码时不显示窗口，直接返回错误（用于测速等后台操作）
    async searchLanfanshu(keyword, limit, minYear, showWindowOnCaptcha = true) {
        const response = await window.electronAPI.searchLanfanshu(keyword, limit, minYear, showWindowOnCaptcha);
        
        // 打印原始响应（用于调试）
        console.log('[API.searchLanfanshu] 原始响应:', response);
        console.log('[API.searchLanfanshu] 响应类型:', typeof response);
        console.log('[API.searchLanfanshu] 是否为数组:', Array.isArray(response));
        if (response && typeof response === 'object') {
            console.log('[API.searchLanfanshu] 响应键:', Object.keys(response));
            if (response.results) {
                console.log('[API.searchLanfanshu] response.results:', response.results);
                console.log('[API.searchLanfanshu] response.results类型:', typeof response.results);
                console.log('[API.searchLanfanshu] response.results是否为数组:', Array.isArray(response.results));
                if (Array.isArray(response.results)) {
                    console.log('[API.searchLanfanshu] response.results长度:', response.results.length);
                    if (response.results.length > 0) {
                        console.log('[API.searchLanfanshu] 第一个结果:', response.results[0]);
                    }
                }
            }
        }
        
        // 处理返回格式
        if (response && typeof response === 'object') {
            if (Array.isArray(response)) {
                console.log('[API.searchLanfanshu] 返回数组格式，长度:', response.length);
                return response;
            } else if (response.results && Array.isArray(response.results)) {
                console.log('[API.searchLanfanshu] 返回response.results，长度:', response.results.length);
                return response.results;
            } else if (response.success && response.results) {
                console.log('[API.searchLanfanshu] 返回response.results (success格式)，长度:', Array.isArray(response.results) ? response.results.length : '不是数组');
                return response.results;
            }
        }
        console.warn('[API.searchLanfanshu] 无法解析响应格式，返回空数组');
        return [];
    },
    
    // 通用文献搜索（根据来源选择）
    async searchLiterature(keyword, limit, minYear, source = 'google-scholar') {
        if (source === 'lanfanshu') {
            return await this.searchLanfanshu(keyword, limit, minYear);
        } else {
            // 默认使用Google Scholar
            return await this.searchGoogleScholar(keyword, limit, minYear);
        }
    }
};

