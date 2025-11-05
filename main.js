const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// 尝试加载pdf-parse，如果未安装则使用简化版本
let pdfParse = null;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse未安装，PDF解析功能将受限。可以通过 npm install pdf-parse 安装。');
}

// 存储窗口引用
let mainWindow;
let searchWindow;
let organizeWindow;
let reviewWindow;

// 项目数据存储路径（改为应用目录下的 projects 文件夹）
const projectDataPath = path.join(__dirname, 'projects');

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
const createSearchWindow = () => {
  searchWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载文献查询界面
  searchWindow.loadFile(path.join(__dirname, 'pages/search.html'));

  return searchWindow;
};

// 创建文献整理窗口
const createOrganizeWindow = () => {
  organizeWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载文献整理界面
  organizeWindow.loadFile(path.join(__dirname, 'pages/organize.html'));

  return organizeWindow;
};

// 创建综述撰写窗口
const createReviewWindow = () => {
  reviewWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载综述撰写界面
  reviewWindow.loadFile(path.join(__dirname, 'pages/review.html'));

  return reviewWindow;
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
function openScholarLoginWindow() {
  return new Promise((resolve, reject) => {
    const loginWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true,
      title: 'Google Scholar - 请先登录并完成验证',
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
    
    // 注入确认按钮（放在左下角，避免遮挡页面元素）
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
              // 初始状态：显示"已完成登录/验证，开始搜索"
              btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成登录/验证，开始搜索</span>';
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
                // 立即设置标志并触发检查
                window.loginConfirmed = true;
                window.dispatchEvent(new CustomEvent('login-confirmed'));
                // 立即触发一次检查（通过模拟页面变化）
                setTimeout(() => {
                  // 触发一个微小变化以确保主进程能立即检测到
                  document.title = document.title + ' ';
                  setTimeout(() => {
                    document.title = document.title.trim();
                  }, 10);
                }, 10);
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
                btn.innerHTML = '<span style="font-size: 18px; margin-right: 8px;">✓</span><span>已完成登录/验证，开始搜索</span>';
              }
            }
          })();
        `).catch(() => {});
      }, 1500); // 稍微延迟，确保页面元素加载完成
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
            loginWindow.setTitle('Google Scholar - 登录确认完成');
            // 立即关闭窗口，不需要延迟
            setTimeout(() => {
              if (!loginWindow.isDestroyed()) {
                loginWindow.close();
              }
              resolve(true);
            }, 200); // 缩短延迟到200ms
          }
        })
        .catch(() => {});
    };
    
    // 使用更频繁的轮询（100ms）以提高响应速度
    checkInterval = setInterval(() => {
      if (loginWindow.isDestroyed()) {
        cleanup();
        clearTimeout(timeout);
        if (!confirmed) {
          reject(new Error('窗口已关闭'));
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
    
    
    // 加载Google Scholar主页
    loginWindow.loadURL('https://scholar.google.com/');
    
    // 处理关闭事件
    loginWindow.on('closed', () => {
      cleanup();
      clearTimeout(timeout);
      if (!confirmed) {
        reject(new Error('窗口已关闭，未完成登录确认'));
      }
    });
  });
}

// Google Scholar 搜索函数（使用BrowserWindow加载页面，自动提取）
function searchGoogleScholar(keyword, limit = 10) {
  return new Promise((resolve, reject) => {
    // 编码关键词
    const encodedKeyword = encodeURIComponent(keyword);
    const actualLimit = Math.min(parseInt(limit), 19);
    
    // 构建搜索URL
    const url = `https://scholar.google.com/scholar?hl=zh-CN&as_sdt=0%2C5&q=${encodedKeyword}&num=${actualLimit}`;
    
    console.log(`搜索Google Scholar: ${keyword}, URL: ${url}`);
    
    // 创建浏览器窗口（自动提取，不需要用户确认）
    const searchWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: true, // 显示窗口，让用户看到搜索过程
      title: `Google Scholar 搜索中: ${keyword}`,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    
    // 窗口居中显示
    searchWindow.center();
    
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
            
            // 如果检测到验证码，注入验证按钮并等待用户处理
            if (status && status.hasCaptcha) {
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
              // 检测到验证码，注入验证按钮并延长超时时间
              clearTimeout(timeout);
              // 延长超时到5分钟，给用户足够时间完成验证
              const verificationTimeout = setTimeout(() => {
                if (!searchWindow.isDestroyed()) {
                  searchWindow.close();
                }
                reject(new Error('Google Scholar验证超时（5分钟）'));
              }, 300000); // 5分钟
              
              if (!searchWindow.isDestroyed()) {
                searchWindow.setTitle(`Google Scholar 需要验证码，请完成验证: ${keyword}`);
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
                
                // 监听页面重新加载，如果验证完成，继续提取
                const handleReload = () => {
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
                
                searchWindow.webContents.on('did-finish-load', handleReload);
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
              
              console.log('找到结果块数量:', resultBlocks.length);
              
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
                
                // 提取标题和链接（多种方式）
                let titleElement = block.querySelector('h3.gs_rt a');
                if (!titleElement) {
                  titleElement = block.querySelector('h3 a');
                }
                if (!titleElement) {
                  titleElement = block.querySelector('a[href*="scholar"]');
                }
                
                if (titleElement) {
                  result.title = titleElement.textContent.trim();
                  result.url = titleElement.href || '';
                } else {
                  const titleText = block.querySelector('h3.gs_rt');
                  if (!titleText) {
                    const h3 = block.querySelector('h3');
                    if (h3) {
                      result.title = h3.textContent.trim();
                    }
                  } else {
                    result.title = titleText.textContent.trim();
                  }
                }
                
                // 提取作者信息（多种方式）
                let authorElement = block.querySelector('.gs_a');
                if (!authorElement) {
                  authorElement = block.querySelector('[class*="gs_a"]');
                }
                if (!authorElement) {
                  // 查找包含作者信息的文本节点
                  const allText = block.innerText || '';
                  const authorMatch = allText.match(/([^-–—\\n]+)[-–—]/);
                  if (authorMatch) {
                    result.authors = authorMatch[1].trim();
                  }
                } else {
                  const authorText = authorElement.textContent.trim();
                  result.authors = authorText.split(/[-–—]/)[0].trim();
                  
                  // 提取年份
                  const yearMatch = authorText.match(/\\b(19|20)\\d{2}\\b/);
                  if (yearMatch) {
                    result.year = yearMatch[0];
                  } else {
                    const yearMatchCN = authorText.match(/(\\d{4})年/);
                    if (yearMatchCN) {
                      result.year = yearMatchCN[1];
                    }
                  }
                  
                  // 提取来源
                  const parts = authorText.split(/[-–—]/);
                  if (parts.length > 1) {
                    result.source = parts.slice(1).join(' - ').trim();
                  }
                }
                
                // 提取摘要（多种方式）
                let abstractElement = block.querySelector('.gs_rs');
                if (!abstractElement) {
                  abstractElement = block.querySelector('[class*="gs_rs"]');
                }
                if (abstractElement) {
                  result.abstract = abstractElement.textContent.trim();
                }
                
                // 提取引用数（多种方式）
                let citedElement = block.querySelector('a[href*="cites"]');
                if (!citedElement) {
                  citedElement = block.querySelector('a[href*="cited"]');
                }
                
                if (citedElement) {
                  const citedText = citedElement.textContent;
                  const citedMatch = citedText.match(/(\\d+)/);
                  if (citedMatch) {
                    result.cited = parseInt(citedMatch[1].replace(/,/g, ''), 10) || 0;
                  }
                } else {
                  // 检查所有链接
                  const citedLinks = block.querySelectorAll('a');
                  for (let link of citedLinks) {
                    const linkText = link.textContent || '';
                    if (linkText.includes('被引用') || linkText.includes('Cited by') || linkText.includes('被引')) {
                      const match = linkText.match(/(\\d+)/);
                      if (match) {
                        result.cited = parseInt(match[1].replace(/,/g, '').replace(/，/g, ''), 10) || 0;
                        break;
                      }
                    }
                  }
                }
                
                if (result.title && result.title.length > 0) {
                  results.push({
                    id: 'scholar_' + i + '_' + Date.now(),
                    title: result.title,
                    authors: result.authors,
                    year: result.year,
                    source: result.source,
                    abstract: result.abstract,
                    cited: result.cited,
                    url: result.url || ('https://scholar.google.com/scholar?q=' + encodeURIComponent(result.title))
                  });
                }
                
                if (results.length >= limit) break;
              }
              
              console.log('提取到的结果数量:', results.length);
              return {
                results: results,
                debug: {
                  blocksFound: resultBlocks.length,
                  resultsExtracted: results.length
                }
              };
            })();
          `;

            searchWindow.webContents.executeJavaScript(extractScript)
              .then((data) => {
                clearTimeout(timeout);
                
                if (searchWindow.isDestroyed()) {
                  reject(new Error('窗口已关闭'));
                  return;
                }
                
                const results = data.results || data || [];
                console.log(`关键词 "${keyword}" 提取结果数量:`, results.length);
                
                if (results && results.length > 0) {
                  // 更新窗口标题显示成功
                  if (!searchWindow.isDestroyed()) {
                    searchWindow.setTitle(`Google Scholar 完成 - ${keyword} (${results.length}条)`);
                  }
                  // 延迟关闭，让用户看到结果
                  setTimeout(() => {
                    if (!searchWindow.isDestroyed()) {
                      searchWindow.close();
                    }
                    resolve(results);
                  }, 1500);
                } else {
                  // 如果没找到结果
                  const errorMsg = `关键词 "${keyword}" 未找到搜索结果`;
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
                console.error(`提取搜索结果失败 (${keyword}):`, error);
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
          reject(new Error(`页面加载失败: ${errorDescription} (错误码: ${errorCode})`));
        }, 2000);
      } else {
        reject(new Error(`页面加载失败: ${errorDescription} (错误码: ${errorCode})`));
      }
    });

    // 处理导航错误和重定向
    searchWindow.webContents.on('did-navigate', (event, url) => {
      console.log('导航到:', url);
      if (!searchWindow.isDestroyed()) {
        searchWindow.setTitle('Google Scholar 正在加载...');
      }
      // 检查是否被重定向到验证页面
      if (url.includes('sorry') || url.includes('captcha')) {
        clearTimeout(timeout);
        if (!searchWindow.isDestroyed()) {
          searchWindow.setTitle('Google Scholar 需要验证码');
          setTimeout(() => {
            if (!searchWindow.isDestroyed()) {
              searchWindow.close();
            }
            reject(new Error('Google Scholar检测到异常流量，可能需要验证码'));
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
    
    // 页面加载完成时更新标题（但保持等待用户操作）
    searchWindow.webContents.on('did-finish-load', () => {
      // 标题会在注入按钮后更新
    });
    
    // 监听控制台消息以便调试
    searchWindow.webContents.on('console-message', (event, level, message) => {
      if (level === 1) { // error
        console.error('页面控制台错误:', message);
      } else {
        console.log('页面控制台:', message);
      }
    });

    // 加载URL
    searchWindow.loadURL(url);
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
  
  // 提取引用数
  const citedPatterns = [
    /被引用[^<]*(\d+)/i,
    /Cited by[^<]*(\d+)/i,
    /被引[^<]*(\d+)/i,
    /cite[^<]*(\d+)/i,
  ];
  
  let citedMatch = null;
  for (const pattern of citedPatterns) {
    citedMatch = block.match(pattern);
    if (citedMatch) break;
  }
  
  if (citedMatch) {
    try {
      const citedStr = citedMatch[1].replace(/,/g, '').replace(/，/g, '');
      result.cited = parseInt(citedStr, 10) || 0;
    } catch (e) {
      result.cited = 0;
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
    console.warn('搜索结果不是数组格式:', typeof results);
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
      console.error(`格式化第${i+1}个结果失败:`, error, item);
    }
  }
  
  return formatted;
}

// IPC处理 - Google Scholar预登录
ipcMain.handle('open-scholar-login', async (event) => {
  try {
    console.log('打开Google Scholar登录/验证窗口');
    await openScholarLoginWindow();
    return {
      success: true
    };
  } catch (error) {
    console.error('Google Scholar登录失败:', error);
    return {
      success: false,
      error: error.message || '登录失败'
    };
  }
});

// IPC处理 - Google Scholar搜索
ipcMain.handle('search-google-scholar', async (event, keyword, limit) => {
  try {
    console.log(`搜索Google Scholar: ${keyword}, 限制: ${limit}`);
    
    if (!keyword || typeof keyword !== 'string') {
      return {
        success: false,
        error: '关键词无效',
        results: []
      };
    }
    
    const results = await searchGoogleScholar(keyword, limit || 10);
  return {
    success: true,
      results: results || []
    };
  } catch (error) {
    console.error('Google Scholar搜索失败:', error);
    return {
      success: false,
      error: error.message || '搜索失败',
      results: []
    };
  }
});

// IPC处理 - PDF解析（仅提取文本，不提取结构化信息）
ipcMain.handle('parse-pdf', async (event, buffer, filename) => {
  try {
    console.log(`开始解析PDF: ${filename}`);
    
    if (!pdfParse) {
      // 如果pdf-parse未安装，尝试使用其他方法或返回错误
      console.warn('pdf-parse未安装，尝试使用基础方法提取文本');
      
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
      console.error('pdfParse不是函数:', typeof pdfParse);
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
    
    console.log(`PDF解析成功: ${filename}, 文本长度: ${text.length}`);
    
    return {
      success: true,
      text: text,
      metadata: data.info || {}
    };
  } catch (error) {
    console.error('PDF解析失败:', error);
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
  console.log('提取文献内容:', document);
  
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
  console.log('生成文献综述:', organizedData);
  
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
ipcMain.handle('open-search-window', async () => {
  if (searchWindow) {
    searchWindow.focus();
  } else {
    searchWindow = createSearchWindow();
    searchWindow.on('closed', () => {
      searchWindow = null;
    });
  }
  return true;
});

ipcMain.handle('open-organize-window', async () => {
  if (organizeWindow) {
    organizeWindow.focus();
  } else {
    organizeWindow = createOrganizeWindow();
    organizeWindow.on('closed', () => {
      organizeWindow = null;
    });
  }
  return true;
});

ipcMain.handle('open-review-window', async () => {
  if (reviewWindow) {
    reviewWindow.focus();
  } else {
    reviewWindow = createReviewWindow();
    reviewWindow.on('closed', () => {
      reviewWindow = null;
    });
  }
  return true;
});

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