// Google Scholar 抓取测试脚本
// 使用方法：npm run test:scholar

const { app, BrowserWindow } = require('electron');

// 测试配置
const TEST_KEYWORD = '"A deep learning-based hybrid framework for object detection and recognition in autonomous driving"';  // 测试关键词（使用引号进行精确匹配）
const TEST_LIMIT = 1;  // 测试数量

let testWindow = null;

// 提取测试结果
function extractTestResults(keyword, limit) {
  return new Promise((resolve, reject) => {
    const extractScript = `
      (function() {
        console.log('[test] Starting extraction...');
        
        const results = [];
        const limit = ${limit};
        
        // Find result blocks
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
        
        console.log('[test] Found result blocks:', resultBlocks.length);
        
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
          
          // 提取标题
          let titleElement = block.querySelector('.gs_rt a');
          if (!titleElement) {
            titleElement = block.querySelector('h3.gs_rt a');
          }
          if (!titleElement) {
            titleElement = block.querySelector('h3 a');
          }
          if (titleElement) {
            let titleText = titleElement.textContent.trim();
            // Clean up special characters
            titleText = titleText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
            titleText = titleText.replace(/[\u200B-\u200D\uFEFF]/g, '');
            titleText = titleText.replace(/[\u2028\u2029]/g, ' ');
            titleText = titleText.replace(/\s+/g, ' ').trim();
            result.title = titleText;
            result.url = titleElement.href || '';
          }
          
          // Extract authors and source
          const authorElement = block.querySelector('.gs_a');
          if (authorElement) {
            let authorText = authorElement.textContent.trim();
            
            // Clean up special characters and control characters
            authorText = authorText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, ''); // Remove control characters
            authorText = authorText.replace(/[\\u200B-\\u200D\\uFEFF]/g, ''); // Remove zero-width characters
            authorText = authorText.replace(/[\\u2028\\u2029]/g, ' '); // Replace line/paragraph separators with space
            authorText = authorText.replace(/\\s+/g, ' ').trim(); // Normalize whitespace
            
            result.authors = authorText;
            
            // Extract year
            const yearMatch = authorText.match(/\\b(19|20)\\d{2}\\b/);
            if (yearMatch) {
              result.year = yearMatch[0];
            }
            
            // Extract journal (source)
            const parts = authorText.split(/[-–—•]/);
            if (parts.length > 1) {
              let sourcePart = parts[1].trim();
              // Clean up source part
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
          
          // 提取摘要（不依赖展开，直接从DOM读取）
          let abstractText = '';
          
          // 方法1: 从 .gs_fma_snp 获取（即使被隐藏，textContent也能获取）
          const fmaSnp = block.querySelector('.gs_fma_snp');
          if (fmaSnp) {
            abstractText = fmaSnp.textContent.trim();
            // 如果文本为空或很短，尝试查找内部的div
            if (!abstractText || abstractText.length < 50) {
              const divElement = fmaSnp.querySelector('div');
              if (divElement) {
                abstractText = divElement.textContent.trim();
              }
            }
          }
          
          // 方法2: 如果方法1没找到，尝试从 .gs_fma_abs 获取
          if (!abstractText || abstractText.length < 50) {
            const fmaAbs = block.querySelector('.gs_fma_abs');
            if (fmaAbs) {
              abstractText = fmaAbs.textContent.trim();
              // 也尝试查找内部的 .gs_fma_snp
              const snpInAbs = fmaAbs.querySelector('.gs_fma_snp');
              if (snpInAbs) {
                const snpText = snpInAbs.textContent.trim();
                if (snpText && snpText.length > abstractText.length) {
                  abstractText = snpText;
                }
              }
            }
          }
          
          // 方法3: 尝试从 .gsh_csp 获取
          if (!abstractText || abstractText.length < 50) {
            const cspElement = block.querySelector('.gsh_csp');
            if (cspElement) {
              abstractText = cspElement.textContent.trim();
            }
          }
          
          // 方法4: 尝试从 .gs_rs 获取
          if (!abstractText || abstractText.length < 50) {
            const gsRs = block.querySelector('.gs_rs');
            if (gsRs) {
              abstractText = gsRs.textContent.trim();
            }
          }
          
          // Clean up abstract text
          if (abstractText) {
            abstractText = abstractText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, ''); // Remove control characters
            abstractText = abstractText.replace(/[\\u200B-\\u200D\\uFEFF]/g, ''); // Remove zero-width characters
            abstractText = abstractText.replace(/[\\u2028\\u2029]/g, ' '); // Replace line/paragraph separators
            abstractText = abstractText.replace(/\\s+/g, ' ').trim(); // Normalize whitespace
          }
          
          // Check if abstract is complete (strict check)
          // An abstract is considered complete if:
          // 1. Length >= 150 characters (minimum reasonable length)
          // 2. Does not end with ellipsis or truncation markers
          // 3. Contains at least one sentence ending (., !, ?)
          // 4. Does not look truncated (doesn't end mid-word or mid-sentence)
          let isComplete = false;
          if (abstractText && abstractText.length >= 150) {
            const trimmed = abstractText.trim();
            // Check if it ends with ellipsis or truncation
            const endsWithTruncation = /[.][.][.]?$|…$|…$|\\s*…\\s*$/.test(trimmed);
            // Check if it ends with proper sentence ending
            const endsWithSentence = /[.!?]\\s*$/.test(trimmed);
            // Check if it contains at least one sentence
            const hasSentence = /[.!?]/.test(trimmed);
            // Check if it doesn't end mid-word (ends with space, punctuation, or letter)
            const endsProperly = /[\\s.!?\\w]$/.test(trimmed);
            
            isComplete = !endsWithTruncation && (endsWithSentence || hasSentence) && endsProperly;
          }
          
          result.abstract = abstractText;
          result.abstractComplete = isComplete;
          
          // 提取被引次数
          const citedLink = block.querySelector('a[href*="cites="]') || 
                           block.querySelector('a[href*="cites"]') ||
                           block.querySelector('a[href*="cited"]');
          if (citedLink) {
            const citedText = citedLink.textContent.trim();
            const citedMatch = citedText.match(/\\d+/);
            if (citedMatch) {
              result.cited = parseInt(citedMatch[0], 10);
            }
          }
          
          // Debug info
          console.log('[test] Result ' + (i + 1) + ':');
          console.log('  - Title:', result.title.substring(0, 50) + (result.title.length > 50 ? '...' : ''));
          console.log('  - Abstract length:', abstractText.length, 'chars');
          console.log('  - Abstract complete:', isComplete ? 'YES' : 'NO');
          console.log('  - Abstract preview:', abstractText.substring(0, 100) + (abstractText.length > 100 ? '...' : ''));
          
          if (result.title && result.title.length > 0) {
            results.push({
              id: 'test_' + i + '_' + Date.now(),
              title: result.title,
              authors: result.authors,
              year: result.year,
              source: result.source,
              abstract: result.abstract,
              abstractComplete: result.abstractComplete || false,
              cited: result.cited,
              url: result.url || ('https://scholar.google.com/scholar?q=' + encodeURIComponent(result.title))
            });
          }
          
          if (results.length >= limit) break;
        }
        
        console.log('[test] Extraction complete, total:', results.length, 'result(s)');
        return results;
      })();
    `;
    
    testWindow.webContents.executeJavaScript(extractScript)
      .then((results) => {
        if (Array.isArray(results)) {
          resolve(results);
        } else {
          reject(new Error('提取结果格式错误'));
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// Main function
console.log('========================================');
console.log('Google Scholar Extraction Test');
console.log('========================================\n');
console.log('Test Configuration:');
console.log(`  - Keyword: ${TEST_KEYWORD}`);
console.log(`  - Limit: ${TEST_LIMIT}`);
console.log('\nNote: Test window will open automatically, extraction starts after 3 seconds');
console.log('If you encounter CAPTCHA, please complete it manually');
console.log('Test will timeout after 60 seconds\n');

app.whenReady().then(() => {
  console.log('✓ Electron app is ready, starting test...\n');
  
  // Create test window
  testWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    title: `Google Scholar Test: ${TEST_KEYWORD}`,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });
  
  console.log('✓ Test window created');
  console.log('Window ID:', testWindow.id);
  
  // Encode keyword
  const encodedKeyword = encodeURIComponent(TEST_KEYWORD);
  const url = `https://scholar.google.com/scholar?hl=zh-CN&as_sdt=0%2C5&q=${encodedKeyword}&num=${TEST_LIMIT}`;
  
  console.log(`\nLoading: ${url}`);
  
  // Set timeout (60 seconds)
  const timeout = setTimeout(() => {
    console.error('\n❌ Test timeout (60 seconds)');
    if (testWindow && !testWindow.isDestroyed()) {
      testWindow.close();
    }
    app.quit();
  }, 60000);
  
  // Listen for page load failure
  testWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
    clearTimeout(timeout);
    console.error(`\n❌ Page load failed: ${errorCode} - ${errorDescription}`);
    if (testWindow && !testWindow.isDestroyed()) {
      testWindow.close();
    }
    app.quit();
  });
  
  testWindow.loadURL(url);
  
  // Handle page load completion
  testWindow.webContents.once('did-finish-load', () => {
    console.log('\n✓ Page loaded, waiting 3 seconds before extraction...');
    
    setTimeout(() => {
      clearTimeout(timeout); // Clear timeout
      console.log('Starting extraction...');
      
      extractTestResults(TEST_KEYWORD, TEST_LIMIT)
        .then((results) => {
          console.log('\n========== Extraction Complete ==========');
          console.log(`Successfully extracted ${results.length} result(s)\n`);
          
          // Print detailed results
          results.forEach((result, index) => {
            console.log(`\n--- Result ${index + 1} ---`);
            console.log(`Title: ${result.title}`);
            console.log(`Authors: ${result.authors || '(none)'}`);
            console.log(`Year: ${result.year || '(none)'}`);
            console.log(`Journal: ${result.source || '(none)'}`);
            console.log(`Cited: ${result.cited || 0}`);
            console.log(`Abstract Length: ${result.abstract ? result.abstract.length : 0} characters`);
            console.log(`Abstract Complete: ${result.abstractComplete ? 'YES' : 'NO'}`);
            if (result.abstract) {
              // Print full abstract
              console.log(`\nAbstract (Full):`);
              console.log(result.abstract);
              if (!result.abstractComplete) {
                console.log(`\n⚠️  WARNING: Abstract may be incomplete or truncated`);
              }
            } else {
              console.log(`Abstract: (none)`);
            }
            console.log(`\nURL: ${result.url || '(none)'}`);
          });
          
          // Statistics
          const withAbstract = results.filter(r => r.abstract && r.abstract.length >= 150).length;
          const withCompleteAbstract = results.filter(r => r.abstractComplete === true).length;
          const withJournal = results.filter(r => r.source && r.source.trim()).length;
          const withYear = results.filter(r => r.year && r.year.trim()).length;
          
          console.log('\nStatistics:');
          console.log(`  - With abstract (>=150 chars): ${withAbstract}/${results.length}`);
          console.log(`  - With COMPLETE abstract (strict check): ${withCompleteAbstract}/${results.length}`);
          console.log(`  - With journal info: ${withJournal}/${results.length}`);
          console.log(`  - With year info: ${withYear}/${results.length}`);
          
          // Close window
          setTimeout(() => {
            if (testWindow && !testWindow.isDestroyed()) {
              testWindow.close();
            }
            app.quit();
          }, 2000);
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.error('\n❌ Extraction failed:', error);
          if (testWindow && !testWindow.isDestroyed()) {
            testWindow.close();
          }
          setTimeout(() => {
            app.quit();
          }, 2000);
        });
    }, 3000);
  });
  
  // Listen for window close
  testWindow.on('closed', () => {
    testWindow = null;
  });
  
  // Listen for console messages
  testWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('[test]') || message.includes('[测试]')) {
      console.log(message);
    }
  });
});

app.on('window-all-closed', () => {
  console.log('All windows closed, quitting app...');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 导出函数供其他模块使用
module.exports = {
  extractTestResults
};
