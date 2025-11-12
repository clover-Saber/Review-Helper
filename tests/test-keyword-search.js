// 关键词搜索文献并提取信息测试脚本
// 使用方法：npm run test:keyword
// 或者在package.json中添加脚本：electron tests/test-keyword-search.js

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 测试配置
const TEST_KEYWORDS = [
    'deep learning object detection',
];
const TEST_LIMIT = 5;  // 每个关键词搜索的文献数量
const TEST_MIN_YEAR = null;  // 最小年份限制（null表示不限制）

let testWindow = null;
let searchResults = [];

// 模拟 main.js 中的 searchGoogleScholar 函数
function searchGoogleScholar(keyword, limit = 10, minYear = null) {
    return new Promise((resolve, reject) => {
        console.log(`\n[Test] Starting search for keyword: "${keyword}"`);
        console.log(`[Test] Limit: ${limit}, Min year: ${minYear || 'No limit'}`);
        
        // 构建Google Scholar搜索URL
        const searchUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(keyword)}&hl=en`;
        
        // 创建隐藏的浏览器窗口
        const searchWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            show: false,  // 隐藏窗口
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        
        let extracted = false;
        let timeoutId = null;
        
        // 设置超时
        timeoutId = setTimeout(() => {
            if (!extracted) {
                extracted = true;
                searchWindow.close();
                reject(new Error(`Search timeout: ${keyword}`));
            }
        }, 60000);  // 60秒超时
        
        // 页面加载完成后的处理
        searchWindow.webContents.once('did-finish-load', () => {
            // 等待页面完全加载
            setTimeout(() => {
                if (extracted) return;
                
                // 检查是否有验证码
                searchWindow.webContents.executeJavaScript(`
                    (function() {
                        const bodyText = document.body ? document.body.innerText : '';
                        if (bodyText.includes('Sorry, we have detected unusual traffic') || 
                            bodyText.toLowerCase().includes('captcha') ||
                            document.querySelector('#captcha-form')) {
                            return { error: 'captcha', hasCaptcha: true };
                        }
                        return { hasCaptcha: false };
                    })();
                `).then((checkResult) => {
                    if (checkResult && checkResult.hasCaptcha) {
                        if (!extracted) {
                            extracted = true;
                            clearTimeout(timeoutId);
                            searchWindow.close();
                            reject(new Error(`Captcha detected, please handle manually: ${keyword}`));
                        }
                        return;
                    }
                    
                    // 提取搜索结果
                    extractResults();
                }).catch(() => {
                    extractResults();
                });
            }, 3000);  // 等待3秒让页面完全加载
        });
        
        // 提取结果的函数
        function extractResults() {
            if (extracted) return;
            
            const extractScript = `
                (function() {
                    console.log('[Test] Starting to extract search results...');
                    
                    const results = [];
                    const limit = ${limit};
                    const seenTitles = new Set();  // 用于去重
                    
                    // 查找结果块
                    let resultBlocks = Array.from(document.querySelectorAll('.gs_ri, .gs_r'));
                    if (resultBlocks.length === 0) {
                        resultBlocks = Array.from(document.querySelectorAll('[data-rp], .gs_scl'));
                    }
                    if (resultBlocks.length === 0) {
                        const allDivs = Array.from(document.querySelectorAll('div'));
                        resultBlocks = allDivs.filter(div => {
                            return div.querySelector('h3') && div.querySelector('h3').textContent.trim().length > 0;
                        });
                    }
                    
                    console.log('[Test] Found result blocks:', resultBlocks.length);
                    
                    for (let i = 0; i < Math.min(resultBlocks.length, limit * 3); i++) {
                        const block = resultBlocks[i];
                        const result = {
                            title: '',
                            authors: '',
                            year: '',
                            source: '',
                            abstract: '',
                            cited: 0,
                            url: ''
                        };
                        
                        // 提取标题和URL
                        let titleElement = block.querySelector('.gs_rt a');
                        if (!titleElement) {
                            titleElement = block.querySelector('h3.gs_rt a');
                        }
                        if (!titleElement) {
                            titleElement = block.querySelector('h3 a');
                        }
                        if (titleElement) {
                            let titleText = titleElement.textContent.trim();
                            // 清理特殊字符
                            titleText = titleText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                            titleText = titleText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                            titleText = titleText.replace(/[\\u2028\\u2029]/g, ' ');
                            titleText = titleText.replace(/\\s+/g, ' ').trim();
                            result.title = titleText;
                            result.url = titleElement.href || '';
                            
                            // 处理相对URL
                            if (result.url && !result.url.startsWith('http')) {
                                if (result.url.startsWith('/')) {
                                    result.url = 'https://scholar.google.com' + result.url;
                                } else {
                                    result.url = 'https://scholar.google.com/scholar?q=' + encodeURIComponent(result.title);
                                }
                            }
                        }
                        
                        // 提取作者和来源信息
                        const authorElement = block.querySelector('.gs_a');
                        if (authorElement) {
                            let authorText = authorElement.textContent.trim();
                            
                            // 清理特殊字符
                            authorText = authorText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                            authorText = authorText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                            authorText = authorText.replace(/[\\u2028\\u2029]/g, ' ');
                            authorText = authorText.replace(/\\s+/g, ' ').trim();
                            
                            result.authors = authorText;
                            
                            // 提取年份
                            const yearMatch = authorText.match(/\\b(19|20)\\d{2}\\b/);
                            if (yearMatch) {
                                result.year = yearMatch[0];
                            }
                            
                            // 提取期刊/来源
                            const parts = authorText.split(/[-–—•]/);
                            if (parts.length > 1) {
                                let sourcePart = parts[1].trim();
                                sourcePart = sourcePart.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                                sourcePart = sourcePart.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                                sourcePart = sourcePart.replace(/[\\u2028\\u2029]/g, ' ');
                                sourcePart = sourcePart.replace(/\\s+/g, ' ').trim();
                                
                                const journalMatch = sourcePart.match(/^([^,]+)/);
                                if (journalMatch) {
                                    result.source = journalMatch[1].trim();
                                }
                            }
                        }
                        
                        // 提取摘要
                        const abstractElement = block.querySelector('.gs_rs');
                        if (abstractElement) {
                            let abstractText = abstractElement.textContent.trim();
                            abstractText = abstractText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                            abstractText = abstractText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                            abstractText = abstractText.replace(/[\\u2028\\u2029]/g, ' ');
                            abstractText = abstractText.replace(/\\s+/g, ' ').trim();
                            result.abstract = abstractText;
                        }
                        
                        // 提取被引次数
                        const citedElement = block.querySelector('a[href*="cites="]');
                        if (citedElement) {
                            const citedText = citedElement.textContent.trim();
                            const citedMatch = citedText.match(/\\d+/);
                            if (citedMatch) {
                                result.cited = parseInt(citedMatch[0]) || 0;
                            }
                        }
                        
                        // 只添加有标题且未重复的结果
                        if (result.title) {
                            // 使用标题（小写）作为去重键
                            const titleKey = result.title.toLowerCase().trim();
                            if (!seenTitles.has(titleKey)) {
                                seenTitles.add(titleKey);
                                results.push(result);
                                if (results.length >= limit) break;
                            } else {
                                console.log('[Test] Skipping duplicate paper:', result.title.substring(0, 50));
                            }
                        }
                    }
                    
                    console.log('[Test] Extraction completed, found', results.length, 'papers');
                    return results;
                })();
            `;
            
            searchWindow.webContents.executeJavaScript(extractScript)
                .then((results) => {
                    if (!extracted) {
                        extracted = true;
                        clearTimeout(timeoutId);
                        searchWindow.close();
                        
                        if (results && Array.isArray(results) && results.length > 0) {
                            console.log(`[Test] ✓ Successfully extracted ${results.length} papers`);
                            resolve(results);
                        } else {
                            console.log(`[Test] ⚠ No papers found`);
                            resolve([]);
                        }
                    }
                })
                .catch((error) => {
                    if (!extracted) {
                        extracted = true;
                        clearTimeout(timeoutId);
                        searchWindow.close();
                        reject(error);
                    }
                });
        }
        
        // 加载搜索页面
        searchWindow.loadURL(searchUrl);
        
        // 错误处理
        searchWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
            if (!extracted) {
                extracted = true;
                clearTimeout(timeoutId);
                searchWindow.close();
                reject(new Error(`Page load failed: ${errorDescription}`));
            }
        });
    });
}

// 格式化输出结果
function formatResult(result, index) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Paper ${index + 1}:`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Title: ${result.title || 'No title'}`);
    console.log(`Authors: ${result.authors || 'Unknown authors'}`);
    console.log(`Year: ${result.year || 'Unknown year'}`);
    console.log(`Source: ${result.source || 'Unknown source'}`);
    console.log(`Cited: ${result.cited || 0}`);
    console.log(`URL: ${result.url || 'No URL'}`);
    console.log(`Abstract: ${result.abstract ? (result.abstract.substring(0, 200) + (result.abstract.length > 200 ? '...' : '')) : 'No abstract'}`);
}

// 主测试函数
async function runTest() {
    console.log('\n');
    console.log('='.repeat(80));
    console.log('Keyword Search and Information Extraction Test');
    console.log('='.repeat(80));
    console.log(`Test Keywords: ${TEST_KEYWORDS.join(', ')}`);
    console.log(`Limit per keyword: ${TEST_LIMIT} papers`);
    console.log(`Min year: ${TEST_MIN_YEAR || 'No limit'}`);
    console.log('='.repeat(80));
    
    const allResults = {};
    let totalFound = 0;
    let totalFailed = 0;
    
    for (let i = 0; i < TEST_KEYWORDS.length; i++) {
        const keyword = TEST_KEYWORDS[i];
        
        try {
            console.log(`\n[Progress] Processing keyword ${i + 1}/${TEST_KEYWORDS.length}: "${keyword}"`);
            
            const results = await searchGoogleScholar(keyword, TEST_LIMIT, TEST_MIN_YEAR);
            
            if (results && results.length > 0) {
                allResults[keyword] = results;
                totalFound += results.length;
                
                console.log(`\n[Result] Keyword "${keyword}" found ${results.length} papers:`);
                results.forEach((result, index) => {
                    formatResult(result, index);
                });
            } else {
                console.log(`\n[Result] Keyword "${keyword}" found no papers`);
                allResults[keyword] = [];
            }
            
            // 在关键词之间添加延迟，避免请求过快
            if (i < TEST_KEYWORDS.length - 1) {
                console.log('\n[Wait] Waiting 3 seconds before next keyword...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
            
        } catch (error) {
            console.error(`\n[Error] Keyword "${keyword}" search failed:`, error.message);
            allResults[keyword] = [];
            totalFailed++;
        }
    }
    
    // 输出统计信息
    console.log('\n');
    console.log('='.repeat(80));
    console.log('Test Statistics');
    console.log('='.repeat(80));
    console.log(`Total keywords: ${TEST_KEYWORDS.length}`);
    console.log(`Successful searches: ${TEST_KEYWORDS.length - totalFailed}`);
    console.log(`Failed searches: ${totalFailed}`);
    console.log(`Total papers found: ${totalFound}`);
    console.log('\nResults by keyword:');
    Object.keys(allResults).forEach(keyword => {
        console.log(`  - "${keyword}": ${allResults[keyword].length} papers`);
    });
    console.log('='.repeat(80));
    
    // 保存结果到JSON文件（可选）
    const fs = require('fs');
    const outputPath = path.join(__dirname, 'test-results.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf8');
        console.log(`\n[Save] Test results saved to: ${outputPath}`);
    } catch (error) {
        console.error(`\n[Error] Failed to save results:`, error.message);
    }
    
    console.log('\n[Complete] Test completed!');
    app.quit();
}

// 应用启动
app.whenReady().then(() => {
    console.log('[Init] Electron app is ready');
    runTest().catch((error) => {
        console.error('[Error] Test execution failed:', error);
        app.quit();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        runTest().catch((error) => {
            console.error('[Error] Test execution failed:', error);
            app.quit();
        });
    }
});

