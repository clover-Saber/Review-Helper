const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 尝试加载pdf-parse，如果未安装则使用简化版本
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse is not installed, PDF parsing functionality will be limited. You can install it via: npm install pdf-parse');
}

// 存储窗口引用
let mainWindow;
// 注意：searchWindow 已移除，搜索功能已整合到 workflow.html 中
// searchWindow 变量现在只在 searchGoogleScholar 函数内部使用

// 项目数据存储路径（使用用户数据目录，确保打包后也能正常工作）
// 在开发环境：使用项目目录下的 projects 文件夹
// 在打包环境：使用用户数据目录下的 projects 文件夹
let projectDataPath;
if (app.isPackaged) {
  // 打包后使用用户数据目录
  projectDataPath = path.join(app.getPath('userData'), 'projects');
} else {
  // 开发环境使用项目目录
  projectDataPath = path.join(__dirname, 'projects');
}

// 当前打开的项目名（进程级）
let currentProjectName = null;

// 确保项目根目录存在
async function ensureProjectDirectory() {
  try {
    await fs.access(projectDataPath);
  } catch (error) {
    await fs.mkdir(projectDataPath, { recursive: true });
  }
}

// 获取项目文件夹路径 & 项目数据文件路径
function getProjectFolderPath(projectName) {
  return path.join(projectDataPath, projectName);
}

function getProjectJsonPath(projectName) {
  return path.join(getProjectFolderPath(projectName), 'project.json');
}

// 保存项目数据（每项目一个文件夹，包含 project.json）
async function saveProjectData(projectName, data) {
  await ensureProjectDirectory();
  const folder = getProjectFolderPath(projectName);
  try {
    await fs.access(folder);
  } catch (e) {
    await fs.mkdir(folder, { recursive: true });
  }
  const filePath = getProjectJsonPath(projectName);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// 加载项目数据
async function loadProjectData(projectName) {
  try {
    const filePath = getProjectJsonPath(projectName);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

// 获取所有项目列表
async function listProjects() {
  try {
    await ensureProjectDirectory();
    const entries = await fs.readdir(projectDataPath, { withFileTypes: true });
    return entries.filter(e => e.isDirectory()).map(e => e.name);
  } catch (error) {
    return [];
  }
}

// 创建主窗口
const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载主界面
  mainWindow.loadFile(path.join(__dirname, 'pages/index.html'));

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
};

// 创建文献查询窗口
// 注意：createSearchWindow 已移除，搜索功能已整合到 workflow.html 中
// 注意：organizeWindow和reviewWindow已移除，功能已整合到workflow.html中

// 创建工作流窗口
let workflowWindow = null;
const createWorkflowWindow = () => {
  if (workflowWindow && !workflowWindow.isDestroyed()) {
    workflowWindow.focus();
    return workflowWindow;
  }

  workflowWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载工作流界面
  workflowWindow.loadFile(path.join(__dirname, 'pages/workflow.html'));

  // 窗口关闭时清理引用
  workflowWindow.on('closed', () => {
    workflowWindow = null;
  });

  return workflowWindow;
};

// 应用准备就绪时创建主窗口
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 关闭所有窗口时退出应用 (Windows)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Google Scholar 预登录/验证窗口（让用户先完成登录和验证）
// autoSearchKeyword: 自动搜索的关键词（可选）
// autoSearchLimit: 自动搜索的文献数量（可选）
function openScholarLoginWindow(autoSearchKeyword = null, autoSearchLimit = 50) {
  return new Promise((resolve, reject) => {
    const loginWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true,
      title: 'Google Scholar - 请先登录并完成验证',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    loginWindow.center();
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      reject(new Error('登录超时（5分钟）'));
    }, 300000); // 5分钟超时
    
    // 如果有自动搜索关键词，直接导航到搜索页面
    let initialUrl = 'https://scholar.google.com/';
    if (autoSearchKeyword) {
      initialUrl = `https://scholar.google.com/scholar?hl=zh-CN&as_sdt=0%2C5&q=${encodeURIComponent(autoSearchKeyword)}&num=${autoSearchLimit}`;
      loginWindow.setTitle(`Google Scholar - 正在搜索: ${autoSearchKeyword}`);
    }
    
    // 注入确认按钮（放在左下角，避免遮挡页面元素）
    // 延迟显示按钮，给用户足够时间完成验证
    loginWindow.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        loginWindow.webContents.executeJavaScript(`
          (function() {
            // 创建按钮（如果不存在）
            let btn = document.getElementById('confirm-login-btn');
            if (!btn) {
              // 创建按钮容器
              const container = document.createElement('div');
              container.id = 'confirm-login-container';
              container.style.cssText = \`
                position: fixed;
                bottom: 20px;
                left: 20px;
                z-index: 10000;
                font-family: Arial, sans-serif;
              \`;
              
              btn = document.createElement('button');
              btn.id = 'confirm-login-btn';
              // 按钮文本：已完成登录/验证
              btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成登录/验证</span>';
              btn.style.cssText = \`
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px 32px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                border-radius: 12px;
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
                letter-spacing: 0.3px;
                position: relative;
                overflow: hidden;
              \`;
              
              // 添加悬停光效
              if (!document.getElementById('confirm-login-btn-style')) {
                const btnStyle = document.createElement('style');
                btnStyle.id = 'confirm-login-btn-style';
                btnStyle.textContent = \`
                  #confirm-login-btn::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
                    transition: left 0.5s ease;
                  }
                  #confirm-login-btn:hover::before {
                    left: 100%;
                  }
                \`;
                document.head.appendChild(btnStyle);
              }
              
              // 按钮点击事件
              btn.onclick = function() {
                this.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⏳</span><span>确认中...</span>';
                this.disabled = true;
                this.style.opacity = '0.8';
                this.style.cursor = 'not-allowed';
                // 设置标志
                window.loginConfirmed = true;
                window.dispatchEvent(new CustomEvent('login-confirmed'));
              };
              
              btn.onmouseover = function() {
                if (!this.disabled) {
                  this.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
                  this.style.transform = 'translateY(-2px)';
                  this.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.5)';
                }
              };
              btn.onmouseout = function() {
                if (!this.disabled) {
                  this.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                  this.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.4)';
                  this.style.transform = 'translateY(0)';
                }
              };
              btn.onmousedown = function() {
                if (!this.disabled) {
                  this.style.transform = 'translateY(0) scale(0.98)';
                }
              };
              btn.onmouseup = function() {
                if (!this.disabled) {
                  this.style.transform = 'translateY(-2px)';
                }
              };
              
              container.appendChild(btn);
              document.body.appendChild(container);
            } else {
              // 按钮已存在，检查是否需要恢复状态
              if (btn.disabled && btn.innerHTML.includes('确认中')) {
                // 如果按钮处于确认中状态但被禁用，可能是页面刷新，恢复为"已完成"状态
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成登录/验证</span>';
              }
            }
          })();
        `).catch(() => {});
      }, 3000); // 延迟3秒显示按钮，给用户足够时间完成验证
    });
    
    // 监听确认事件
    let confirmed = false;
    let checkInterval = null;
    let titleCheckInterval = null;
    
    // 清理函数
    const cleanup = () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      if (titleCheckInterval) {
        clearInterval(titleCheckInterval);
        titleCheckInterval = null;
      }
    };
    
    // 立即检查函数
    const checkLoginConfirmed = () => {
      if (loginWindow.isDestroyed() || confirmed) {
        return;
      }
      
      loginWindow.webContents.executeJavaScript('window.loginConfirmed || false')
        .then((ready) => {
          if (ready && !confirmed) {
            confirmed = true;
            cleanup();
            clearTimeout(timeout);
            loginWindow.setTitle('Google Scholar - 验证完成');
            
            // 用户点击完成按钮后，直接关闭窗口
            setTimeout(() => {
              if (!loginWindow.isDestroyed()) {
                loginWindow.close();
              }
              resolve(true);
            }, 500);
          }
        })
        .catch((error) => {
          console.error('Failed to check login confirmation status:', error);
        });
    };
    
    // 使用更频繁的轮询（100ms）以提高响应速度
    checkInterval = setInterval(() => {
      if (loginWindow.isDestroyed()) {
        cleanup();
        clearTimeout(timeout);
        if (!confirmed) {
          reject(new Error('Window has been closed'));
        }
        return;
      }
      
      checkLoginConfirmed();
    }, 100); // 从500ms改为100ms
    
    // 监听页面导航事件，在页面加载完成时也检查一次
    loginWindow.webContents.on('did-finish-load', () => {
      setTimeout(checkLoginConfirmed, 100);
    });
    
    // 监听DOM内容变化，当loginConfirmed被设置时立即检查
    // 通过监听title变化来触发检查（因为按钮点击会修改title）
    let lastTitle = '';
    titleCheckInterval = setInterval(() => {
      if (loginWindow.isDestroyed() || confirmed) {
        cleanup();
        return;
      }
      
      loginWindow.webContents.executeJavaScript('document.title || ""')
        .then((title) => {
          if (title !== lastTitle) {
            lastTitle = title;
            // Title变化时立即检查一次
            checkLoginConfirmed();
          }
        })
        .catch(() => {});
    }, 50); // 每50ms检查一次title变化
    
    // 监听页面中的确认事件
    loginWindow.webContents.executeJavaScript(`
      (function() {
        window.addEventListener('login-confirmed', function() {
          window.loginConfirmed = true;
        });
      })();
    `);
    
    
    // 加载初始URL（如果有自动搜索关键词，直接加载搜索页面）
    loginWindow.loadURL(initialUrl);
    
    // 处理关闭事件
    loginWindow.on('closed', () => {
      cleanup();
      clearTimeout(timeout);
      if (!confirmed) {
        reject(new Error('Window has been closed, login confirmation not completed'));
      }
    });
  });
}

// 全局变量：跟踪当前打开的搜索窗口
let currentSearchWindow = null;
// 全局变量：跟踪正在进行的搜索（防止重复调用）
let activeSearchKey = null;

// Google Scholar 搜索函数（使用BrowserWindow加载页面，自动提取）
function searchGoogleScholar(keyword, limit = 10, minYear = null) {
  return new Promise((resolve, reject) => {
    // 生成搜索的唯一键（关键词+限制+年份）
    const searchKey = `${keyword}_${limit}_${minYear || 'none'}`;
    
    // 如果相同的搜索正在进行，等待它完成
    if (activeSearchKey === searchKey && currentSearchWindow && !currentSearchWindow.isDestroyed()) {
      console.log(`Detected same search in progress: ${keyword}, waiting for previous search to complete...`);
      // 等待前一个窗口关闭
      const checkInterval = setInterval(() => {
        if (!currentSearchWindow || currentSearchWindow.isDestroyed()) {
          clearInterval(checkInterval);
          activeSearchKey = null;
          // 重新调用搜索
          searchGoogleScholar(keyword, limit, minYear).then(resolve).catch(reject);
        }
      }, 500);
      return;
    }
    
    // 如果已有搜索窗口打开，先关闭它
    if (currentSearchWindow && !currentSearchWindow.isDestroyed()) {
      console.log('Detected existing search window open, closing previous window first');
      currentSearchWindow.close();
      currentSearchWindow = null;
      activeSearchKey = null;
      // 等待一小段时间确保窗口完全关闭
      setTimeout(() => {
        startSearch();
      }, 500);
    } else {
      startSearch();
    }
    
    function startSearch() {
      // 标记当前搜索为活跃状态
      activeSearchKey = searchKey;
      
      // 编码关键词
      const encodedKeyword = encodeURIComponent(keyword);
      const actualLimit = Math.min(parseInt(limit), 19);
      
      // 构建搜索URL，添加年份限制
      let url = `https://scholar.google.com/scholar?hl=zh-CN&as_sdt=0%2C5&q=${encodedKeyword}&num=${actualLimit}`;
      
      // 如果指定了起始年份，添加到URL参数中
      if (minYear && !isNaN(minYear) && minYear > 1900) {
        url += `&as_ylo=${minYear}`;
        console.log(`Adding year restriction: from year ${minYear}`);
      }
      
      console.log(`Searching Google Scholar: ${keyword}, limit: ${actualLimit}, year: ${minYear || 'unlimited'}, URL: ${url}`);
      
      // 创建浏览器窗口（隐藏窗口，后台自动提取）
      const searchWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false, // 隐藏窗口，后台运行（参考test-keyword-search.js）
      title: `Google Scholar 搜索中: ${keyword}`,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
      
      // 保存当前搜索窗口引用
      currentSearchWindow = searchWindow;
      
      // 用于跟踪状态和清理资源的变量
      let extractionTriggered = false;
      let autoCheckInterval = null;

      // 设置超时
      const timeout = setTimeout(() => {
      if (!searchWindow.isDestroyed()) {
        searchWindow.setTitle('Google Scholar 搜索超时');
        setTimeout(() => {
          if (!searchWindow.isDestroyed()) {
            searchWindow.close();
          }
          reject(new Error('Google Scholar搜索超时（60秒）'));
        }, 2000);
      } else {
        reject(new Error('Google Scholar搜索超时（60秒）'));
      }
      }, 60000);
      
      // 监听窗口关闭事件，清理资源
      const cleanup = () => {
        clearTimeout(timeout);
        if (autoCheckInterval) {
          clearInterval(autoCheckInterval);
          autoCheckInterval = null;
        }
        // 清除当前搜索窗口引用和活跃搜索标记
        if (currentSearchWindow === searchWindow) {
          currentSearchWindow = null;
          activeSearchKey = null;
        }
      };
      
      searchWindow.on('closed', () => {
        cleanup();
      });

      // 页面加载完成后的处理（自动提取，无需用户确认）
      searchWindow.webContents.once('did-finish-load', () => {
      // 等待页面完全加载后自动提取
      setTimeout(() => {
        // 自动检测页面状态
        autoCheckInterval = setInterval(() => {
          if (extractionTriggered || searchWindow.isDestroyed()) {
            if (autoCheckInterval) {
              clearInterval(autoCheckInterval);
            }
            return;
          }
          
          searchWindow.webContents.executeJavaScript(`
            (function() {
              const resultBlocks = document.querySelectorAll('.gs_ri, .gs_r, .gs_scl, [data-rp]');
              const hasResults = resultBlocks.length > 0;
              const hasCaptcha = document.body.innerHTML.includes('Sorry, we have detected unusual traffic') || 
                                 document.body.innerHTML.toLowerCase().includes('captcha');
              
              return {
                hasResults: hasResults,
                hasCaptcha: hasCaptcha,
                resultCount: resultBlocks.length
              };
            })();
          `).then((status) => {
            if (searchWindow.isDestroyed()) {
              if (autoCheckInterval) {
                clearInterval(autoCheckInterval);
              }
              return;
            }
            
            // 如果检测到验证码，显示窗口并等待用户处理
            if (status && status.hasCaptcha) {
              // 遇到验证码时显示窗口，让用户处理
              searchWindow.show();
              searchWindow.center();
              searchWindow.setTitle(`Google Scholar - 检测到验证码，请完成验证: ${keyword}`);
              // 注入验证完成按钮
              if (!extractionTriggered) {
                searchWindow.webContents.executeJavaScript(`
                  (function() {
                    if (document.getElementById('verification-complete-btn')) {
                      return;
                    }
                    
                    // 创建按钮容器
                    const container = document.createElement('div');
                    container.id = 'verification-complete-container';
                    container.style.cssText = \`
                      position: fixed;
                      bottom: 20px;
                      left: 20px;
                      z-index: 10000;
                      font-family: Arial, sans-serif;
                    \`;
                    
                    const btn = document.createElement('button');
                    btn.id = 'verification-complete-btn';
                    btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成验证，继续搜索</span>';
                    btn.style.cssText = \`
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 16px 32px;
                      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                      color: white;
                      border: none;
                      border-radius: 12px;
                      font-size: 15px;
                      font-weight: 600;
                      cursor: pointer;
                      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
                      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
                      letter-spacing: 0.3px;
                      position: relative;
                      overflow: hidden;
                    \`;
                    
                    btn.onclick = function() {
                      btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⏳</span><span>等待验证完成...</span>';
                      btn.disabled = true;
                      btn.style.opacity = '0.8';
                      btn.style.cursor = 'not-allowed';
                      // 标记验证完成，通知主进程等待窗口关闭
                      window.verificationCompleted = true;
                      // 通知主进程：用户已点击完成验证按钮，等待窗口关闭
                      window.verificationButtonClicked = true;
                      // 刷新页面或重新加载搜索结果（等待用户完成验证后再执行）
                      setTimeout(() => {
                        // 检查是否还有验证码
                        const hasCaptcha = document.body.innerHTML.includes('Sorry, we have detected unusual traffic') || 
                                          document.body.innerHTML.toLowerCase().includes('captcha') ||
                                          document.querySelector('#captcha-form');
                        if (!hasCaptcha) {
                          // 没有验证码了，刷新页面以获取搜索结果
                          window.location.reload();
                        } else {
                          // 还有验证码，提示用户
                          btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⚠️</span><span>请先完成验证码</span>';
                          btn.disabled = false;
                          btn.style.opacity = '1';
                          btn.style.cursor = 'pointer';
                          window.verificationButtonClicked = false;
                        }
                      }, 1000);
                    };
                    
                    btn.onmouseover = function() {
                      if (!this.disabled) {
                        this.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.5)';
                      }
                    };
                    
                    btn.onmouseout = function() {
                      if (!this.disabled) {
                        this.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.4)';
                      }
                    };
                    
                    container.appendChild(btn);
                    document.body.appendChild(container);
                  })();
                `).catch(() => {});
              }
              // 继续等待，不自动提取
            } else if (status && status.hasResults && status.resultCount > 0) {
              // 有结果了，延迟一点后自动提取
              setTimeout(() => {
                if (!extractionTriggered && !searchWindow.isDestroyed()) {
                  performAutoExtraction();
                }
              }, 2000);
            }
          }).catch(() => {
            if (searchWindow.isDestroyed() && autoCheckInterval) {
              clearInterval(autoCheckInterval);
            }
          });
        }, 2000);
        
        // 如果10秒后还没有结果，尝试提取（可能页面结构不同）
        setTimeout(() => {
          if (!extractionTriggered && !searchWindow.isDestroyed()) {
            performAutoExtraction();
          }
        }, 10000);
        
        // 自动提取函数
        function performAutoExtraction() {
          if (extractionTriggered || searchWindow.isDestroyed()) {
            return;
          }
          
          extractionTriggered = true;
          if (autoCheckInterval) {
            clearInterval(autoCheckInterval);
            autoCheckInterval = null;
          }
          
          if (!searchWindow.isDestroyed()) {
            searchWindow.setTitle(`Google Scholar 正在提取结果: ${keyword}`);
          }
          
          // 先检查页面状态
          searchWindow.webContents.executeJavaScript(`
            (function() {
              const bodyText = document.body ? document.body.innerText : '';
              if (bodyText.includes('Sorry, we have detected unusual traffic') || 
                  bodyText.toLowerCase().includes('captcha') ||
                  document.querySelector('#captcha-form')) {
                return { error: 'captcha', hasCaptcha: true };
              }
              
              if (!document.body || document.body.children.length === 0) {
                return { error: 'empty_page', hasContent: false };
              }
              
              return {
                hasContent: true,
                resultBlocksCount: document.querySelectorAll('.gs_ri, .gs_r, .gs_scl, [data-rp]').length
              };
            })();
          `).then((debugInfo) => {
            if (debugInfo && (debugInfo.error === 'captcha' || debugInfo.hasCaptcha)) {
              // 检测到验证码，显示窗口并延长超时时间
              searchWindow.show();
              searchWindow.center();
              clearTimeout(timeout);
              // 延长超时到5分钟，给用户足够时间完成验证
              const verificationTimeout = setTimeout(() => {
                if (!searchWindow.isDestroyed()) {
                  searchWindow.close();
                }
                reject(new Error('Google Scholar verification timeout (5 minutes)'));
              }, 300000); // 5分钟
              
              if (!searchWindow.isDestroyed()) {
                searchWindow.setTitle(`Google Scholar requires CAPTCHA, please complete verification: ${keyword}`);
                // 注入验证完成按钮
                searchWindow.webContents.executeJavaScript(`
                  (function() {
                    if (document.getElementById('verification-complete-btn')) {
                      return;
                    }
                    
                    // 创建按钮容器
                    const container = document.createElement('div');
                    container.id = 'verification-complete-container';
                    container.style.cssText = \`
                      position: fixed;
                      bottom: 20px;
                      left: 20px;
                      z-index: 10000;
                      font-family: Arial, sans-serif;
                    \`;
                    
                    const btn = document.createElement('button');
                    btn.id = 'verification-complete-btn';
                    btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成验证，继续搜索</span>';
                    btn.style.cssText = \`
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      padding: 16px 32px;
                      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                      color: white;
                      border: none;
                      border-radius: 12px;
                      font-size: 15px;
                      font-weight: 600;
                      cursor: pointer;
                      box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
                      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
                      letter-spacing: 0.3px;
                      position: relative;
                      overflow: hidden;
                    \`;
                    
                    btn.onclick = function() {
                      btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⏳</span><span>重新检查中...</span>';
                      btn.disabled = true;
                      btn.style.opacity = '0.8';
                      btn.style.cursor = 'not-allowed';
                      // 标记验证完成
                      window.verificationCompleted = true;
                      // 重新执行提取
                      setTimeout(() => {
                        window.location.reload();
                      }, 500);
                    };
                    
                    btn.onmouseover = function() {
                      if (!this.disabled) {
                        this.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
                        this.style.transform = 'translateY(-2px)';
                        this.style.boxShadow = '0 12px 32px rgba(16, 185, 129, 0.5)';
                      }
                    };
                    
                    btn.onmouseout = function() {
                      if (!this.disabled) {
                        this.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                        this.style.transform = 'translateY(0)';
                        this.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.4)';
                      }
                    };
                    
                    container.appendChild(btn);
                    document.body.appendChild(container);
                  })();
                `).catch(() => {});
                
                // 监听页面重新加载，如果验证完成，继续提取（只监听一次，避免重复触发）
                let reloadHandled = false;
                const handleReload = () => {
                  if (reloadHandled || searchWindow.isDestroyed()) {
                    return;
                  }
                  reloadHandled = true;
                  
                  setTimeout(() => {
                    if (!searchWindow.isDestroyed()) {
                      searchWindow.webContents.executeJavaScript('window.verificationButtonClicked || false')
                        .then((buttonClicked) => {
                          if (buttonClicked) {
                            // 用户点击了验证完成按钮，检查页面状态
                            setTimeout(() => {
                              searchWindow.webContents.executeJavaScript(`
                                (function() {
                                  const resultBlocks = document.querySelectorAll('.gs_ri, .gs_r, .gs_scl, [data-rp]');
                                  const hasResults = resultBlocks.length > 0;
                                  const hasCaptcha = document.body.innerHTML.includes('Sorry, we have detected unusual traffic') || 
                                                     document.body.innerHTML.toLowerCase().includes('captcha') ||
                                                     document.querySelector('#captcha-form');
                                  
                                  return {
                                    hasResults: hasResults,
                                    hasCaptcha: hasCaptcha,
                                    resultCount: resultBlocks.length
                                  };
                                })();
                              `).then((status) => {
                                if (status && !status.hasCaptcha && status.hasResults) {
                                  // 验证完成，有搜索结果，执行提取
                                  clearTimeout(verificationTimeout);
                                  // 更新按钮文本，提示用户正在提取
                                  searchWindow.webContents.executeJavaScript(`
                                    (function() {
                                      const btn = document.getElementById('verification-complete-btn');
                                      if (btn) {
                                        btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">⏳</span><span>正在提取结果，请稍候...</span>';
                                        btn.disabled = true;
                                      }
                                    })();
                                  `).catch(() => {});
                                  // 执行提取，提取完成后窗口会自动关闭
                                  performAutoExtraction();
                                } else if (status && status.hasCaptcha) {
                                  // 仍有验证码，重新注入按钮
                                  reloadHandled = false; // 重置标志，允许再次处理
                                  searchWindow.webContents.executeJavaScript(`
                                    (function() {
                                      let btn = document.getElementById('verification-complete-btn');
                                      if (!btn) {
                                        const container = document.createElement('div');
                                        container.id = 'verification-complete-container';
                                        container.style.cssText = \`position: fixed; bottom: 20px; left: 20px; z-index: 10000;\`;
                                        btn = document.createElement('button');
                                        btn.id = 'verification-complete-btn';
                                        btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成验证，继续搜索</span>';
                                        btn.style.cssText = \`padding: 16px 32px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 12px; cursor: pointer;\`;
                                        container.appendChild(btn);
                                        document.body.appendChild(container);
                                      } else {
                                        btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成验证，继续搜索</span>';
                                        btn.disabled = false;
                                        btn.style.opacity = '1';
                                        btn.style.cursor = 'pointer';
                                      }
                                      btn.onclick = function() {
                                        window.verificationButtonClicked = true;
                                        window.verificationCompleted = true;
                                        window.location.reload();
                                      };
                                    })();
                                  `).catch(() => {});
                                }
                              }).catch(() => {});
                            }, 2000);
                          }
                        })
                        .catch(() => {});
                    }
                  }, 2000);
                };
                
                searchWindow.webContents.once('did-finish-load', handleReload);
              }
              return;
            }
            
            if (debugInfo && (debugInfo.error === 'empty_page' || !debugInfo.hasContent)) {
              clearTimeout(timeout);
              if (!searchWindow.isDestroyed()) {
                searchWindow.setTitle(`Google Scholar 页面加载失败: ${keyword}`);
                setTimeout(() => {
                  if (!searchWindow.isDestroyed()) {
                    searchWindow.close();
                  }
                  resolve([]); // 返回空数组，让搜索继续
                }, 1500);
              } else {
                resolve([]);
              }
              return;
            }
            
            // 执行提取
            extractResults();
          }).catch(() => {
            // 即使检查失败也尝试提取
            extractResults();
          });
        }
        
        function extractResults() {
          // 注入JavaScript提取搜索结果（改进的选择器）
          // 第一步：先点击所有展开摘要按钮
          const expandScript = `
            (function() {
              // 尝试多种选择器查找结果块
              let resultBlocks = [];
              
              // 方法1: 标准选择器
              resultBlocks = Array.from(document.querySelectorAll('.gs_ri, .gs_r'));
              
              // 方法2: 如果方法1失败，尝试其他选择器
              if (resultBlocks.length === 0) {
                resultBlocks = Array.from(document.querySelectorAll('[data-rp], .gs_scl'));
              }
              
              // 方法3: 查找包含标题的块
              if (resultBlocks.length === 0) {
                const allDivs = Array.from(document.querySelectorAll('div'));
                resultBlocks = allDivs.filter(div => {
                  return div.querySelector('h3') && div.querySelector('h3').textContent.trim().length > 0;
                });
              }
              
              console.log('Found result blocks count:', resultBlocks.length);
              
              // 不依赖展开，直接从DOM读取完整摘要
              // Google Scholar的完整摘要即使在未展开状态下也在DOM中，只是被CSS隐藏
              // textContent可以获取隐藏元素的内容，所以不需要展开
              // 注意：节点2的范围搜索结果中，摘要通常在 .gs_rs 中
              // 节点3的单篇精确搜索结果中，摘要可能在 .gs_fma_snp 或 .gs_fma_abs 中
              let abstractElementsFound = 0;
              
              for (let i = 0; i < resultBlocks.length; i++) {
                const block = resultBlocks[i];
                // 检查是否有摘要元素（即使被隐藏）
                // 优先检查 .gs_rs（节点2范围搜索结果中的摘要位置）
                const gsRs = block.querySelector('.gs_rs');
                // 也检查 .gs_fma_snp 和 .gs_fma_abs（节点3单篇精确搜索结果中的摘要位置）
                const fmaSnp = block.querySelector('.gs_fma_snp');
                const fmaAbs = block.querySelector('.gs_fma_abs');
                // 还检查 .gsh_csp（详情页中的摘要位置）
                const gshCsp = block.querySelector('.gsh_csp');
                
                if (gsRs || fmaSnp || fmaAbs || gshCsp) {
                  abstractElementsFound++;
                }
              }
              
              console.log('Found', abstractElementsFound, 'result blocks containing abstracts (no expansion needed, reading directly from DOM)');
              return { 
                expandedCount: 0,  // 不再需要展开
                verifiedExpanded: abstractElementsFound,
                blocksCount: resultBlocks.length,
                abstractElementsFound: abstractElementsFound
              };
            })();
          `;
          
          // 检查摘要元素（不需要展开，直接从DOM读取）
          searchWindow.webContents.executeJavaScript(expandScript)
            .then((expandResult) => {
              console.log('Abstract element check result:', expandResult);
              // 不需要等待展开，直接从DOM读取（即使被CSS隐藏，textContent也能获取）
              // 立即提取，不给Google Scholar关闭的机会
              setTimeout(() => {
                // 第二步：提取结果
                const extractScript = `
                  (function() {
                    const results = [];
                    const limit = ${actualLimit};
                    
                    // 查找结果块（与test-keyword-search.js保持一致）
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
                    
                    console.log('Found result blocks count:', resultBlocks.length);
                    
                    // 用于去重的Set，记录已提取的标题
                    const seenTitles = new Set();
                    
                    for (let i = 0; i < Math.min(resultBlocks.length, limit * 3); i++) {
                      const block = resultBlocks[i];
                      const result = {
                        title: '',
                        authors: '',
                        year: '',
                        source: '',
                        abstract: '',
                        cited: 0,
                        url: '',
                        pdfUrl: ''
                      };
                      
                      // 提取标题和URL（与test-keyword-search.js保持一致）
                      let titleElement = block.querySelector('.gs_rt a');
                      if (!titleElement) {
                        titleElement = block.querySelector('h3.gs_rt a');
                      }
                      if (!titleElement) {
                        titleElement = block.querySelector('h3 a');
                      }
                      if (titleElement) {
                        let titleText = titleElement.textContent.trim();
                        // 清理特殊字符（与test-keyword-search.js保持一致）
                        titleText = titleText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                        titleText = titleText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                        titleText = titleText.replace(/[\\u2028\\u2029]/g, ' ');
                        titleText = titleText.replace(/\\s+/g, ' ').trim();
                        result.title = titleText;
                        result.url = titleElement.href || '';
                        
                        // 处理相对URL（与test-keyword-search.js保持一致）
                        if (result.url && !result.url.startsWith('http')) {
                          if (result.url.startsWith('/')) {
                            result.url = 'https://scholar.google.com' + result.url;
                          } else {
                            result.url = 'https://scholar.google.com/scholar?q=' + encodeURIComponent(result.title);
                          }
                        }
                      }
                      
                      // 提取作者和来源信息（与test-keyword-search.js保持一致）
                      const authorElement = block.querySelector('.gs_a');
                      if (authorElement) {
                        let authorText = authorElement.textContent.trim();
                        
                        // 清理特殊字符（与test-keyword-search.js保持一致）
                        authorText = authorText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                        authorText = authorText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                        authorText = authorText.replace(/[\\u2028\\u2029]/g, ' ');
                        authorText = authorText.replace(/\\s+/g, ' ').trim();
                        
                        result.authors = authorText;
                        
                        // 提取年份（与test-keyword-search.js保持一致）
                        const yearMatch = authorText.match(/\\b(19|20)\\d{2}\\b/);
                        if (yearMatch) {
                          result.year = yearMatch[0];
                        }
                        
                        // 提取期刊/来源（与test-keyword-search.js保持一致）
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
                      
                      // 提取摘要（根据搜索类型使用不同逻辑）
                      // 单篇搜索（limit=1）：使用test-google-scholar的完整逻辑
                      // 范围搜索（limit>1）：使用test-keyword-search的简单逻辑
                      let abstractText = '';
                      
                      if (limit === 1) {
                        // 单篇搜索：使用多方法提取（参考test-google-scholar.js）
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
                      } else {
                        // 范围搜索：只从 .gs_rs 提取（与test-keyword-search.js保持一致）
                        const abstractElement = block.querySelector('.gs_rs');
                        if (abstractElement) {
                          abstractText = abstractElement.textContent.trim();
                        }
                      }
                      
                      // 清理摘要文本
                      if (abstractText) {
                        abstractText = abstractText.replace(/[\\u0000-\\u001F\\u007F-\\u009F]/g, '');
                        abstractText = abstractText.replace(/[\\u200B-\\u200D\\uFEFF]/g, '');
                        abstractText = abstractText.replace(/[\\u2028\\u2029]/g, ' ');
                        abstractText = abstractText.replace(/\\s+/g, ' ').trim();
                      }
                      
                      // 检查摘要是否完整（仅对单篇搜索）
                      let isComplete = false;
                      if (limit === 1 && abstractText && abstractText.length >= 150) {
                        const trimmed = abstractText.trim();
                        // 检查是否以省略号结尾
                        const endsWithTruncation = /[.][.][.]?$|…$|\\s*…\\s*$/.test(trimmed);
                        // 检查是否以句子结尾
                        const endsWithSentence = /[.!?]\\s*$/.test(trimmed);
                        // 检查是否包含至少一个句子
                        const hasSentence = /[.!?]/.test(trimmed);
                        // 检查是否正常结尾
                        const endsProperly = /[\\s.!?\\w]$/.test(trimmed);
                        
                        isComplete = !endsWithTruncation && (endsWithSentence || hasSentence) && endsProperly;
                      }
                      
                      result.abstract = abstractText;
                      result.abstractComplete = isComplete;
                      
                      // 提取被引次数（与test-keyword-search.js保持一致）
                      const citedElement = block.querySelector('a[href*="cites="]');
                      if (citedElement) {
                        const citedText = citedElement.textContent.trim();
                        const citedMatch = citedText.match(/\\d+/);
                        if (citedMatch) {
                          result.cited = parseInt(citedMatch[0]) || 0;
                        }
                      }
                      
                      // 提取PDF链接（根据Google Scholar的HTML结构：.gs_ggs.gs_fl 区域中）
                      // PDF链接通常在 .gs_ggs.gs_fl > .gs_ggsd > .gs_or_ggsm > a[href*=".pdf"] 中
                      const pdfElement = block.querySelector('.gs_ggs.gs_fl a[href*=".pdf"]');
                      if (!pdfElement) {
                        // 尝试其他可能的PDF链接选择器
                        const pdfLink = block.querySelector('.gs_ggs a[href*=".pdf"]');
                        if (pdfLink) {
                          result.pdfUrl = pdfLink.href || '';
                        }
                      } else {
                        result.pdfUrl = pdfElement.href || '';
                      }
                      
                      // 只添加有标题且未重复的结果（与test-keyword-search.js保持一致）
                      if (result.title) {
                        // 使用标题（小写）作为去重键
                        const titleKey = result.title.toLowerCase().trim();
                        if (!seenTitles.has(titleKey)) {
                          seenTitles.add(titleKey);
                          const paperData = {
                            id: 'scholar_' + i + '_' + Date.now(),
                            title: result.title,
                            authors: result.authors,
                            year: result.year,
                            source: result.source,
                            abstract: result.abstract || '',
                            abstractComplete: result.abstractComplete || false,
                            cited: result.cited,
                            url: result.url || ('https://scholar.google.com/scholar?q=' + encodeURIComponent(result.title))
                          };
                          // 如果有PDF链接，添加到结果中（保留此功能）
                          if (result.pdfUrl) {
                            paperData.pdfUrl = result.pdfUrl;
                          }
                          results.push(paperData);
                        } else {
                          console.log('Skipping duplicate paper:', result.title.substring(0, 50));
                        }
                      }
                      
                      if (results.length >= limit) break;
                    }
                    
                    console.log('Extracted results count:', results.length);
                    // 与test-keyword-search.js保持一致，直接返回results数组
                    return results;
                  })();
                `;

                searchWindow.webContents.executeJavaScript(extractScript)
              .then((results) => {
                clearTimeout(timeout);
                
                if (searchWindow.isDestroyed()) {
                  reject(new Error('Window has been closed'));
                  return;
                }
                
                // 与test-keyword-search.js保持一致，直接接收results数组
                // 兼容处理：如果返回的是对象，提取results字段
                const extractedResults = Array.isArray(results) ? results : (results?.results || results || []);
                console.log(`Keyword "${keyword}" extracted results count:`, extractedResults.length);
                
                if (extractedResults && extractedResults.length > 0) {
                  // 更新窗口标题显示成功
                  if (!searchWindow.isDestroyed()) {
                    searchWindow.setTitle(`Google Scholar 完成 - ${keyword} (${extractedResults.length}条)`);
                  }
                  // 延迟关闭，让用户看到结果
                  setTimeout(() => {
                    if (!searchWindow.isDestroyed()) {
                      searchWindow.close();
                    }
                    resolve(extractedResults);
                  }, 1500);
                } else {
                  // 如果没找到结果
                  const errorMsg = `Keyword "${keyword}" found no search results`;
                  console.warn(errorMsg);
                  if (!searchWindow.isDestroyed()) {
                    searchWindow.setTitle(`Google Scholar 无结果 - ${keyword}`);
                    setTimeout(() => {
                      if (!searchWindow.isDestroyed()) {
                        searchWindow.close();
                      }
                      // 返回空数组而不是reject，让搜索继续
                      resolve([]);
                    }, 1500);
                  } else {
                    resolve([]);
                  }
                }
              })
              .catch((error) => {
                clearTimeout(timeout);
                console.error(`Failed to extract search results (${keyword}):`, error);
                if (!searchWindow.isDestroyed()) {
                  searchWindow.setTitle(`Google Scholar 提取失败 - ${keyword}`);
                  setTimeout(() => {
                    if (!searchWindow.isDestroyed()) {
                      searchWindow.close();
                    }
                    // 返回空数组而不是reject，让其他关键词可以继续搜索
                    resolve([]);
                  }, 1500);
                } else {
                  resolve([]);
                }
              });
              }, 2000); // 等待2秒让展开动画完成
            })
            .catch((error) => {
              // 如果展开失败，仍然尝试提取（可能没有展开按钮）
              console.warn('Failed to expand abstract, extracting directly:', error);
              // 直接执行提取脚本（使用原来的逻辑，但不展开）
              const extractScript = `
                (function() {
                  const results = [];
                  const limit = ${actualLimit};
                  
                  // 尝试多种选择器查找结果块
                  let resultBlocks = [];
                  
                  // 方法1: 标准选择器
                  resultBlocks = Array.from(document.querySelectorAll('.gs_ri, .gs_r'));
                  
                  // 方法2: 如果方法1失败，尝试其他选择器
                  if (resultBlocks.length === 0) {
                    resultBlocks = Array.from(document.querySelectorAll('[data-rp], .gs_scl'));
                  }
                  
                  // 方法3: 查找包含标题的块
                  if (resultBlocks.length === 0) {
                    const allDivs = Array.from(document.querySelectorAll('div'));
                    resultBlocks = allDivs.filter(div => {
                      return div.querySelector('h3') && div.querySelector('h3').textContent.trim().length > 0;
                    });
                  }
                  
                  console.log('Found result blocks count:', resultBlocks.length);
                  
                  // 用于去重的Set，记录已提取的标题
                  const seenTitles = new Set();
                  
                  for (let i = 0; i < Math.min(resultBlocks.length, limit * 3); i++) {
                    const block = resultBlocks[i];
                    const result = {
                      title: '',
                      authors: '',
                      year: '',
                      source: '',
                      abstract: '',
                      cited: 0,
                      url: '',
                      pdfUrl: ''
                    };
                    
                    // 提取标题和链接（多种方式，优先使用 .gs_rt a）
                    let titleElement = block.querySelector('.gs_rt a');
                    if (!titleElement) {
                      titleElement = block.querySelector('h3.gs_rt a');
                    }
                    if (!titleElement) {
                      titleElement = block.querySelector('h3 a');
                    }
                    if (!titleElement) {
                      titleElement = block.querySelector('a[href*="scholar"]');
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
                    } else {
                      const titleTextElement = block.querySelector('.gs_rt');
                      if (!titleTextElement) {
                        const h3 = block.querySelector('h3.gs_rt');
                        if (h3) {
                          let titleText = h3.textContent.trim();
                          // Clean up special characters
                          titleText = titleText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                          titleText = titleText.replace(/[\u200B-\u200D\uFEFF]/g, '');
                          titleText = titleText.replace(/[\u2028\u2029]/g, ' ');
                          titleText = titleText.replace(/\s+/g, ' ').trim();
                          result.title = titleText;
                        } else {
                          const h3Element = block.querySelector('h3');
                          if (h3Element) {
                            let titleText = h3Element.textContent.trim();
                            // Clean up special characters
                            titleText = titleText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                            titleText = titleText.replace(/[\u200B-\u200D\uFEFF]/g, '');
                            titleText = titleText.replace(/[\u2028\u2029]/g, ' ');
                            titleText = titleText.replace(/\s+/g, ' ').trim();
                            result.title = titleText;
                          }
                        }
                      } else {
                        let titleText = titleTextElement.textContent.trim();
                        // Clean up special characters
                        titleText = titleText.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                        titleText = titleText.replace(/[\u200B-\u200D\uFEFF]/g, '');
                        titleText = titleText.replace(/[\u2028\u2029]/g, ' ');
                        titleText = titleText.replace(/\s+/g, ' ').trim();
                        result.title = titleText;
                      }
                    }
                    
                    // 提取摘要（尝试从 .gs_fma_snp 或 .gs_rs 中提取）
                    let abstractText = '';
                    const abstractElement = block.querySelector('.gs_fma_snp') || block.querySelector('.gs_rs');
                    if (abstractElement) {
                      abstractText = abstractElement.textContent.trim();
                    }
                      // Clean up abstract text (remove control characters and normalize)
                      if (abstractText) {
                        abstractText = abstractText.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Remove control characters
                        abstractText = abstractText.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters
                        abstractText = abstractText.replace(/[\u2028\u2029]/g, ' '); // Replace line/paragraph separators
                        abstractText = abstractText.replace(/\s+/g, ' ').trim(); // Normalize whitespace
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
                        // 使用正则表达式字面量而不是 RegExp 构造函数，避免转义问题
                        const endsWithTruncation = /[.][.][.]?$|…$|\s*…\s*$/.test(trimmed);
                        const endsWithSentence = /[.!?]\s*$/.test(trimmed);
                        const hasSentence = /[.!?]/.test(trimmed);
                        const endsProperly = /[\s.!?\w]$/.test(trimmed);
                        
                        isComplete = !endsWithTruncation && (endsWithSentence || hasSentence) && endsProperly;
                      }
                      
                      result.abstract = abstractText;
                      result.abstractComplete = isComplete;
                      
                      if (result.title && result.title.length > 0) {
                      const titleKey = result.title.toLowerCase().trim();
                      if (!seenTitles.has(titleKey)) {
                        seenTitles.add(titleKey);
                        results.push({
                          id: 'scholar_' + i + '_' + Date.now(),
                          title: result.title,
                          authors: result.authors || '',
                          year: result.year || '',
                          source: result.source || '',
                          abstract: result.abstract,
                          abstractComplete: result.abstractComplete || false,
                          cited: result.cited || 0,
                          url: result.url || ('https://scholar.google.com/scholar?q=' + encodeURIComponent(result.title))
                        });
                      }
                    }
                    
                    if (results.length >= limit) break;
                  }
                  
                  return { results: results };
                })();
              `;
              
              searchWindow.webContents.executeJavaScript(extractScript)
                .then((data) => {
                  clearTimeout(timeout);
                  if (searchWindow.isDestroyed()) {
                    reject(new Error('Window has been closed'));
                    return;
                  }
                  const results = data.results || data || [];
                  if (!searchWindow.isDestroyed()) {
                    searchWindow.setTitle(`Google Scholar 完成 - ${keyword} (${results.length}条)`);
                    setTimeout(() => {
                      if (!searchWindow.isDestroyed()) {
                        searchWindow.close();
                      }
                      resolve(results);
                    }, 1500);
                  } else {
                    resolve(results);
                  }
                })
                .catch((err) => {
                  clearTimeout(timeout);
                  console.error('Extraction failed:', err);
                  if (!searchWindow.isDestroyed()) {
                    searchWindow.close();
                  }
                  resolve([]);
                });
            });
        }
      }, 3000); // 等待3秒确保页面加载
      });

      // 处理页面加载错误
      searchWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
      clearTimeout(timeout);
      if (!searchWindow.isDestroyed()) {
        searchWindow.setTitle('Google Scholar 加载失败');
        setTimeout(() => {
          if (!searchWindow.isDestroyed()) {
            searchWindow.close();
          }
          reject(new Error(`Page load failed: ${errorDescription} (error code: ${errorCode})`));
        }, 2000);
      } else {
        reject(new Error(`页面加载失败: ${errorDescription} (错误码: ${errorCode})`));
      }
      });

      // 处理导航错误和重定向
      searchWindow.webContents.on('did-navigate', (event, url) => {
      console.log('Navigating to:', url);
      if (!searchWindow.isDestroyed()) {
        searchWindow.setTitle('Google Scholar 正在加载...');
      }
      // 检查是否被重定向到验证页面
      if (url.includes('sorry') || url.includes('captcha')) {
        clearTimeout(timeout);
        if (!searchWindow.isDestroyed()) {
          searchWindow.setTitle('Google Scholar requires CAPTCHA');
          setTimeout(() => {
            if (!searchWindow.isDestroyed()) {
              searchWindow.close();
            }
            reject(new Error('Google Scholar detected unusual traffic, CAPTCHA may be required'));
          }, 2000);
        } else {
          reject(new Error('Google Scholar检测到异常流量，可能需要验证码'));
        }
      }
      });
      
      // 页面开始加载时更新标题
      searchWindow.webContents.on('did-start-loading', () => {
        if (!searchWindow.isDestroyed()) {
          searchWindow.setTitle('Google Scholar 正在加载...');
        }
      });
      
      // 注意：did-finish-load 事件已在上面使用 once 监听，这里不再重复监听
      
      // 监听控制台消息以便调试
      searchWindow.webContents.on('console-message', (event, level, message) => {
        if (level === 1) { // error
          console.error('Page console error:', message);
        } else {
          console.log('Page console:', message);
        }
      });

      // 加载URL
      searchWindow.loadURL(url);
    }
  });
}

// 访问单个文献链接并提取完整摘要
function extractFullAbstractFromUrl(url) {
  return new Promise((resolve, reject) => {
    if (!url || !url.startsWith('http')) {
      reject(new Error('Invalid URL'));
      return;
    }
    
    console.log(`Accessing literature link to extract abstract: ${url}`);
    
    // 创建浏览器窗口访问文献详情页
    const detailWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true, // 显示窗口，让用户看到访问过程
      title: `正在提取摘要...`,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    detailWindow.center();
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!detailWindow.isDestroyed()) {
        detailWindow.close();
      }
      reject(new Error('提取摘要超时（30秒）'));
    }, 30000);
    
    // 页面加载完成后的处理
    detailWindow.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (detailWindow.isDestroyed()) {
          clearTimeout(timeout);
          reject(new Error('Window has been closed'));
          return;
        }
        
        // 提取摘要的脚本
        const extractAbstractScript = `
          (function() {
            let abstract = '';
            
            // 尝试多种方式查找摘要
            // 方法1: 优先查找 .gs_fma_snp（这是Google Scholar中摘要的容器，如图1所示）
            let scholarAbstract = document.querySelector('.gs_fma_snp');
            if (scholarAbstract) {
              abstract = scholarAbstract.textContent || scholarAbstract.innerText || '';
              // 如果文本为空或很短，尝试查找内部的div
              if (!abstract || abstract.length < 50) {
                const divElement = scholarAbstract.querySelector('div');
                if (divElement) {
                  abstract = divElement.textContent || divElement.innerText || '';
                }
              }
            }
            
            // 方法1.5: 如果方法1没找到，尝试查找 .gsh_csp
            if (!abstract || abstract.length < 50) {
              scholarAbstract = document.querySelector('.gsh_csp');
              if (scholarAbstract) {
                abstract = scholarAbstract.textContent || scholarAbstract.innerText || '';
              }
            }
            
            // 方法2: 如果还没有找到，尝试其他选择器
            if (!abstract || abstract.length < 50) {
              scholarAbstract = document.querySelector('.gs_rs, [data-clk-atid]');
              if (scholarAbstract) {
                abstract = scholarAbstract.textContent || scholarAbstract.innerText || '';
              }
            }
            
            // 如果找到了 .gsh_csp，确保提取完整的文本
            if (abstract && abstract.length < 50) {
              // 可能在 .gs_fma_abs 结构中
              const fmaAbs = document.querySelector('.gs_fma_abs');
              if (fmaAbs) {
                const snpInFma = fmaAbs.querySelector('.gs_fma_snp');
                if (snpInFma) {
                  abstract = snpInFma.textContent || snpInFma.innerText || '';
                } else {
                  const cspInFma = fmaAbs.querySelector('.gsh_csp');
                  if (cspInFma) {
                    abstract = cspInFma.textContent || cspInFma.innerText || '';
                  }
                }
              }
            }
            
            // 方法2: 查找包含"abstract"或"摘要"的元素
            if (!abstract || abstract.length < 50) {
              const abstractElements = document.querySelectorAll('*');
              for (let el of abstractElements) {
                const text = el.textContent || '';
                const className = el.className || '';
                const id = el.id || '';
                if ((className.toLowerCase().includes('abstract') || 
                     id.toLowerCase().includes('abstract') ||
                     text.toLowerCase().includes('abstract')) &&
                    text.length > 50 && text.length < 2000) {
                  // 提取摘要文本（去掉标签）
                  abstract = text.replace(/\\s+/g, ' ').trim();
                  break;
                }
              }
            }
            
            // 方法3: 查找常见的摘要区域
            if (!abstract || abstract.length < 50) {
              const selectors = [
                '.abstract',
                '#abstract',
                '[id*="abstract"]',
                '[class*="abstract"]',
                '.article-abstract',
                '.paper-abstract',
                '.summary'
              ];
              
              for (let selector of selectors) {
                const el = document.querySelector(selector);
                if (el) {
                  abstract = el.textContent || el.innerText || '';
                  if (abstract.length > 50) break;
                }
              }
            }
            
            // 方法4: 查找段落文本（作为最后手段）
            if (!abstract || abstract.length < 50) {
              const paragraphs = document.querySelectorAll('p');
              let longestText = '';
              for (let p of paragraphs) {
                const text = (p.textContent || '').trim();
                if (text.length > longestText.length && text.length > 100 && text.length < 2000) {
                  longestText = text;
                }
              }
              if (longestText.length > 50) {
                abstract = longestText;
              }
            }
            
            // 清理摘要文本
            if (abstract) {
              abstract = abstract
                .replace(/\\s+/g, ' ')
                .replace(/Abstract[:：]?/gi, '')
                .replace(/摘要[:：]?/gi, '')
                .trim();
              
              // 如果摘要太长，截取前2000字符
              if (abstract.length > 2000) {
                abstract = abstract.substring(0, 2000) + '...';
              }
            }
            
            return abstract || '';
          })();
        `;
        
        detailWindow.webContents.executeJavaScript(extractAbstractScript)
          .then((abstract) => {
            clearTimeout(timeout);
            
            if (detailWindow.isDestroyed()) {
              reject(new Error('Window has been closed'));
              return;
            }
            
            // 更新窗口标题
            detailWindow.setTitle(abstract ? '摘要提取成功' : '未找到摘要');
            
            // 延迟关闭窗口
            setTimeout(() => {
              if (!detailWindow.isDestroyed()) {
                detailWindow.close();
              }
              resolve(abstract || '');
            }, 1000);
          })
          .catch((error) => {
            clearTimeout(timeout);
            console.error('Failed to extract abstract:', error);
            if (!detailWindow.isDestroyed()) {
              detailWindow.close();
            }
            reject(error);
          });
      }, 2000); // 等待2秒让页面完全加载
    });
    
    // 错误处理
    detailWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      clearTimeout(timeout);
      if (!detailWindow.isDestroyed()) {
        detailWindow.close();
      }
      reject(new Error(`Page load failed (error code: ${errorCode}): ${errorDescription}`));
    });
    
    // 加载URL
    detailWindow.loadURL(url);
  });
}

// 解析Google Scholar HTML
function parseScholarHTML(html, limit) {
  const results = [];
  
  // 查找所有结果块 - Google Scholar结果通常在 <div class="gs_ri"> 中
  const patterns = [
    /<div[^>]*class="[^"]*gs_ri[^"]*"[^>]*>(.*?)(?=<div[^>]*class="[^"]*gs_ri|<div[^>]*id="gs_bdy|<\/body>|$)/gis,
    /<div[^>]*class="gs_r[^"]*"[^>]*>(.*?)(?=<div[^>]*class="gs_r|<div[^>]*id="gs_bdy|<\/body>|$)/gis,
  ];
  
  let blocks = [];
  for (const pattern of patterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      if (blocks.length >= limit * 3) break;
      const blockContent = match[1];
      if (blockContent && blockContent.trim().length > 50) {
        blocks.push(blockContent);
      }
    }
    if (blocks.length >= limit) break;
  }
  
  // 如果仍然没有找到结果，尝试更宽松的匹配
  if (blocks.length === 0) {
    const titlePattern = /<h3[^>]*><a[^>]*href="[^"]*"[^>]*>.*?<\/a><\/h3>/gi;
    const titleMatches = [...html.matchAll(titlePattern)];
    
    for (let i = 0; i < Math.min(titleMatches.length, limit); i++) {
      const match = titleMatches[i];
      const start = Math.max(0, match.index - 200);
      const end = Math.min(html.length, match.index + match[0].length + 300);
      blocks.push(html.substring(start, end));
    }
  }
  
  // 解析每个结果块
  const seenTitles = new Set();
  for (let i = 0; i < Math.min(blocks.length, limit * 2); i++) {
    try {
      const result = parseResultBlock(blocks[i], i);
      if (result && result.title) {
        const titleKey = result.title.toLowerCase().trim();
        if (titleKey && !seenTitles.has(titleKey)) {
          seenTitles.add(titleKey);
          results.push(result);
          if (results.length >= limit) break;
        }
      }
    } catch (error) {
      // 静默忽略解析错误
      continue;
    }
  }
  
  return results;
}

// 解析单个结果块
function parseResultBlock(block, index) {
  const result = {
    id: `scholar_${index}_${Date.now()}`,
    title: '',
    authors: '',
    year: '',
    source: '',
    abstract: '',
    cited: 0,
    url: ''
  };
  
  // 提取标题和链接
  const titlePatterns = [
    /<h3[^>]*class="gs_rt"[^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a><\/h3>/is,
    /<h3[^>]*class="gs_rt"[^>]*>(.*?)<\/h3>/is,
    /<h3[^>]*><a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a><\/h3>/is,
    /<h3[^>]*>(.*?)<\/h3>/is,
  ];
  
  let titleMatch = null;
  for (const pattern of titlePatterns) {
    titleMatch = block.match(pattern);
    if (titleMatch) break;
  }
  
  if (titleMatch) {
    if (titleMatch.length >= 3 && titleMatch[1] && titleMatch[1].startsWith('http')) {
      result.url = titleMatch[1];
      result.title = cleanHTML(titleMatch[2]);
    } else if (titleMatch.length >= 3) {
      result.url = titleMatch[1] || '';
      result.title = cleanHTML(titleMatch[2] || titleMatch[1]);
    } else {
      result.title = cleanHTML(titleMatch[1]);
      result.url = '';
    }
    
    // 处理相对URL或空URL
    if (result.url) {
      if (!result.url.startsWith('http')) {
        if (result.url.startsWith('/')) {
          result.url = 'https://scholar.google.com' + result.url;
        } else {
          result.url = `https://scholar.google.com/scholar?q=${encodeURIComponent(result.title)}`;
        }
      }
    } else {
      result.url = `https://scholar.google.com/scholar?q=${encodeURIComponent(result.title)}`;
    }
  }
  
  // 提取作者和来源信息
  const authorPatterns = [
    /<div[^>]*class="gs_a"[^>]*>(.*?)<\/div>/is,
    /<div[^>]*class="[^"]*gs_a[^"]*"[^>]*>(.*?)<\/div>/is,
  ];
  
  let authorMatch = null;
  for (const pattern of authorPatterns) {
    authorMatch = block.match(pattern);
    if (authorMatch) break;
  }
  
  if (authorMatch) {
    const authorText = cleanHTML(authorMatch[1]);
    const parts = authorText.split(/\s*[-–—]\s*/);
    if (parts.length > 0) {
      result.authors = parts[0].trim();
    }
    
    // 提取年份
    const yearMatch = authorText.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      result.year = yearMatch[0];
    } else {
      const yearMatchCN = authorText.match(/(\d{4})年/);
      if (yearMatchCN) {
        result.year = yearMatchCN[1];
      }
    }
    
    // 提取来源
    if (parts.length > 1) {
      result.source = parts.slice(1).join(' - ').trim();
    }
  }
  
  // 提取摘要
  const abstractPatterns = [
    /<div[^>]*class="gs_rs"[^>]*>(.*?)<\/div>/is,
    /<div[^>]*class="[^"]*gs_rs[^"]*"[^>]*>(.*?)<\/div>/is,
    /<span[^>]*class="gs_rs"[^>]*>(.*?)<\/span>/is,
  ];
  
  let abstractMatch = null;
  for (const pattern of abstractPatterns) {
    abstractMatch = block.match(pattern);
    if (abstractMatch) break;
  }
  
  if (abstractMatch) {
    result.abstract = cleanHTML(abstractMatch[1]);
  }
  
  // 提取引用数（优先查找 a[href*="cites="]）
  let citedElement = null;
  // 注意：parseResultBlock 函数接收的是 HTML 字符串，不是 DOM 元素
  // 所以需要使用正则表达式来匹配
  const citedPatterns = [
    /<a[^>]*href="[^"]*cites=[^"]*"[^>]*>([^<]*被引用[^<]*(\d+)[^<]*)<\/a>/i,
    /<a[^>]*href="[^"]*cites=[^"]*"[^>]*>([^<]*Cited by[^<]*(\d+)[^<]*)<\/a>/i,
    /被引用[^<]*(\d+)/i,
    /Cited by[^<]*(\d+)/i,
    /被引[^<]*(\d+)/i,
    /cite[^<]*(\d+)/i,
  ];
  
  let citedMatch = null;
  for (const pattern of citedPatterns) {
    citedMatch = block.match(pattern);
    if (citedMatch) {
      // 提取数字（可能是第二个或第一个捕获组）
      const citedNum = citedMatch[citedMatch.length - 1] || citedMatch[1];
      if (citedNum) {
        try {
          const citedStr = citedNum.replace(/,/g, '').replace(/，/g, '');
          result.cited = parseInt(citedStr, 10) || 0;
        } catch (e) {
          result.cited = 0;
        }
      }
      break;
    }
  }
  
  return result;
}

// 清理HTML标签和实体
function cleanHTML(text) {
  if (!text) return '';
  // 移除HTML标签
  let cleaned = text.replace(/<[^>]+>/g, '');
  // 解码HTML实体
  cleaned = cleaned
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // 清理空白字符
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}
// 格式化google-scholar库返回的结果
function formatScholarResults(results, limit) {
  const formatted = [];
  
  // 确保results是数组
  if (!Array.isArray(results)) {
    console.warn('Search results is not an array format:', typeof results);
    return formatted;
  }
  
  for (let i = 0; i < Math.min(results.length, limit); i++) {
    const item = results[i];
    if (!item) continue;
    
    try {
      // 灵活处理不同的字段名
      const title = item.title || item.name || item.name_title || '';
      let authors = '';
      if (Array.isArray(item.authors)) {
        authors = item.authors.join(', ');
      } else {
        authors = item.authors || item.author || item.author_list || '';
      }
      let year = '';
      const yearValue = item.year || item.pub_year || item.published_year || item.date || '';
      if (yearValue) {
        const yearStr = String(yearValue);
        // 尝试提取年份（4位数字）
        const yearMatch = yearStr.match(/\b(19|20)\d{2}\b/);
        year = yearMatch ? yearMatch[0] : yearStr.substring(0, 4);
      }
      const source = item.publication || item.journal || item.venue || item.publisher || item.source || '';
      const abstract = item.abstract || item.snippet || item.summary || item.description || '';
      const cited = parseInt(item.cited_by || item.citations || item.cited_count || item.cite_count || 0) || 0;
      const url = item.url || item.link || item.href || item.pdf || '';
      
      if (title) {
        formatted.push({
          id: `scholar_${i}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          title: title,
          authors: authors,
          year: year,
          source: source,
          abstract: abstract,
          cited: cited,
          url: url || `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`
        });
      }
    } catch (error) {
      console.error(`Failed to format result ${i+1}:`, error, item);
    }
  }
  
  return formatted;
}

// IPC处理 - Google Scholar预登录
ipcMain.handle('open-scholar-login', async (event, autoSearchKeyword = null, autoSearchLimit = 50) => {
  try {
    console.log('Opening Google Scholar login/verification window', { autoSearchKeyword, autoSearchLimit });
    await openScholarLoginWindow(autoSearchKeyword, autoSearchLimit);
    return {
      success: true
    };
  } catch (error) {
    console.error('Google Scholar login failed:', error);
    return {
      success: false,
      error: error.message || '登录失败'
    };
  }
});

// IPC处理 - Google Scholar搜索
ipcMain.handle('search-google-scholar', async (event, keyword, limit, minYear) => {
  try {
    console.log(`Searching Google Scholar: ${keyword}, limit: ${limit}, year: ${minYear || 'unlimited'}`);
    
    if (!keyword || typeof keyword !== 'string') {
      return {
        success: false,
        error: '关键词无效',
        results: []
      };
    }
    
    const results = await searchGoogleScholar(keyword, limit || 10, minYear || null);
  return {
    success: true,
      results: results || []
    };
  } catch (error) {
    console.error('Google Scholar search failed:', error);
    return {
      success: false,
      error: error.message || '搜索失败',
      results: []
    };
  }
});

// IPC处理 - 从URL提取完整摘要
ipcMain.handle('extract-abstract-from-url', async (event, url) => {
  try {
    const abstract = await extractFullAbstractFromUrl(url);
    return {
      success: true,
      abstract: abstract
    };
  } catch (error) {
    console.error('Failed to extract abstract from URL:', error);
    return {
      success: false,
      error: error.message || '提取摘要失败',
      abstract: ''
    };
  }
});

// IPC处理 - PDF解析（仅提取文本，不提取结构化信息）
ipcMain.handle('parse-pdf', async (event, buffer, filename) => {
  try {
    console.log(`Starting PDF parsing: ${filename}`);
    
    if (!pdfParse) {
      // 如果pdf-parse未安装，尝试使用其他方法或返回错误
      console.warn('pdf-parse is not installed, attempting to use basic method to extract text');
      
      // 尝试将PDF转换为Base64，然后在前端使用大模型API处理
      // 或者返回一个提示，让用户知道需要安装pdf-parse
      return {
        success: false,
        error: 'PDF解析库未安装。请运行: npm install pdf-parse\n\n或者，您可以直接使用大模型API的文档处理功能。',
        text: null,
        needsInstall: true
      };
    }
    
    // 检查pdfParse是否是函数
    if (typeof pdfParse !== 'function') {
      console.error('pdfParse is not a function:', typeof pdfParse);
      return {
        success: false,
        error: 'PDF解析库加载异常，请重新安装: npm install pdf-parse',
        text: null
      };
    }
    
    // 解析PDF
    const data = await pdfParse(buffer);
    
    // 提取文本内容
    const text = data.text || '';
    
    console.log(`PDF parsing successful: ${filename}, text length: ${text.length}`);
    
    return {
      success: true,
      text: text,
      metadata: data.info || {}
    };
  } catch (error) {
    console.error('PDF parsing failed:', error);
    return {
      success: false,
      error: error.message || 'PDF解析失败',
      text: null
    };
  }
});

// 从文本中提取标题（通常是第一行或前几行）
function extractTitleFromText(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    // 第一行通常是标题
    const firstLine = lines[0].trim();
    if (firstLine.length > 10 && firstLine.length < 200) {
      return firstLine;
    }
  }
  return null;
}

// 从文本中提取作者
function extractAuthorsFromText(text) {
  // 查找常见的作者模式
  const authorPatterns = [
    /作者[：:]\s*([^\n]+)/i,
    /Author[：:]\s*([^\n]+)/i,
    /By\s+([^\n]+)/i,
    /^([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+and\s+[A-Z][a-z]+\s+[A-Z][a-z]+)*)/m
  ];
  
  for (const pattern of authorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

// 从文本中提取年份
function extractYearFromText(text, metadata) {
  // 先检查元数据
  if (metadata.CreationDate) {
    const yearMatch = metadata.CreationDate.match(/(\d{4})/);
    if (yearMatch) {
      return yearMatch[1];
    }
  }
  
  // 从文本中查找年份（通常是4位数字，在1900-当前年份之间）
  const currentYear = new Date().getFullYear();
  const yearPattern = /\b(19\d{2}|20[0-2]\d)\b/;
  const match = text.match(yearPattern);
  if (match) {
    const year = parseInt(match[1]);
    if (year >= 1900 && year <= currentYear) {
      return year.toString();
    }
  }
  
  return null;
}

// 从文本中提取摘要
function extractAbstractFromText(text) {
  // 查找Abstract或摘要部分
  const abstractPatterns = [
    /Abstract[：:\s]*\n([\s\S]{100,1000}?)(?:\n\n|Keywords|Introduction)/i,
    /摘要[：:\s]*\n([\s\S]{100,1000}?)(?:\n\n|关键词|引言)/i,
    /Summary[：:\s]*\n([\s\S]{100,1000}?)(?:\n\n|Keywords|Introduction)/i
  ];
  
  for (const pattern of abstractPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().substring(0, 500);
    }
  }
  
  // 如果没有找到摘要部分，返回前300个字符
  return text.substring(0, 300).trim();
}

// IPC处理 - 文献整理模块
ipcMain.handle('extract-content', async (event, document) => {
  // TODO: 实现PDF或网页内容提取功能
  console.log('Extracting literature content:', document);
  
  // 模拟返回提取的内容
  return {
    success: true,
    content: {
      title: document.title,
      authors: document.authors,
      year: document.year,
      mainPoints: [
        'Key point 1 from the document',
        'Key point 2 from the document',
        'Key point 3 from the document'
      ],
      methodology: 'Research methodology description',
      findings: 'Key findings from the research',
      conclusion: 'Main conclusions of the study'
    }
  };
});

// IPC处理 - 综述撰写模块
ipcMain.handle('generate-review', async (event, organizedData) => {
  // TODO: 实现综述自动生成功能
  console.log('Generating literature review:', organizedData);
  
  // 模拟返回生成的综述
  return {
    success: true,
    review: `综合性文献综述报告
    
    根据对${organizedData.documents.length}篇相关文献的分析，本综述总结了该领域的主要研究成果和发展趋势。
    
    一、研究现状
    多数研究表明，该领域在过去十年中经历了快速发展...
    
    二、主要观点
    1. 第一类观点认为...
    2. 第二类观点强调...
    3. 第三类观点提出...
    
    三、研究方法
    文献中采用的主要研究方法包括...
    
    四、结论与展望
    综合来看，该领域仍有诸多值得深入研究的方向...`
  };
});

// IPC处理 - 窗口管理
ipcMain.handle('open-workflow-window', async () => {
  try {
    createWorkflowWindow();
    return { success: true };
  } catch (error) {
    console.error('Failed to open workflow window:', error);
    return { success: false, error: error.message };
  }
});

// 切换主窗口到工作流界面
ipcMain.handle('switch-to-workflow', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, 'pages/workflow.html'));
      return { success: true };
    }
    return { success: false, error: '主窗口不存在' };
  } catch (error) {
    console.error('Failed to switch to workflow interface:', error);
    return { success: false, error: error.message };
  }
});

// 切换主窗口到项目管理界面
ipcMain.handle('switch-to-index', async () => {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, 'pages/index.html'));
      return { success: true };
    }
    return { success: false, error: '主窗口不存在' };
  } catch (error) {
    console.error('Failed to switch to project management interface:', error);
    return { success: false, error: error.message };
  }
});

// 注意：open-search-window 已移除，搜索功能已整合到 workflow.html 中
// 注意：open-organize-window 和 open-review-window 已移除，功能已整合到workflow.html中

// IPC处理 - 项目数据管理
ipcMain.handle('save-project-data', async (event, projectName, data) => {
  try {
    await saveProjectData(projectName, data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-project-data', async (event, projectName) => {
  try {
    const data = await loadProjectData(projectName);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-projects', async () => {
  try {
    const projects = await listProjects();
    return { success: true, projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 删除项目（删除整个项目文件夹）
async function deleteProject(projectName) {
  try {
    const folderPath = getProjectFolderPath(projectName);
    // 检查文件夹是否存在
    await fs.access(folderPath);
    // 递归删除整个文件夹
    await fs.rm(folderPath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件夹不存在，也算删除成功
      return { success: true };
    }
    throw error;
  }
}

ipcMain.handle('delete-project', async (event, projectName) => {
  try {
    await deleteProject(projectName);
    // 如果删除的是当前打开的项目，清除当前项目
    if (currentProjectName === projectName) {
      currentProjectName = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC处理 - 当前项目管理
ipcMain.handle('set-current-project', async (event, projectName) => {
  currentProjectName = projectName || null;
  return { success: true, currentProject: currentProjectName };
});

ipcMain.handle('get-current-project', async () => {
  return { success: true, currentProject: currentProjectName };
});

// IPC处理 - 获取研究主题（优先当前项目）
ipcMain.handle('get-research-topic', async (event, projectName) => {
  try {
    const name = projectName || currentProjectName;
    if (!name) return "";
    const projectData = await loadProjectData(name);
    if (projectData) {
      // 兼容字段 userNeeds / researchTopic
      return projectData.userNeeds || projectData.researchTopic || "";
    }
    return "";
  } catch (error) {
    return "";
  }
});

// 目录选择对话框
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// 保存Word文件
ipcMain.handle('save-word-file', async (event, fileName, htmlContent) => {
  try {
    const result = await dialog.showSaveDialog({
      title: '保存Word文档',
      defaultPath: fileName,
      filters: [
        { name: 'Word文档', extensions: ['doc'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: '用户取消保存' };
    }

    // 将HTML内容写入文件（添加BOM以支持中文）
    const contentWithBOM = '\ufeff' + htmlContent;
    await fs.writeFile(result.filePath, contentWithBOM, 'utf8');
    
    return {
      success: true,
      filePath: result.filePath
    };
  } catch (error) {
    console.error('Failed to save Word file:', error);
    return {
      success: false,
      error: error.message || '保存失败'
    };
  }
});