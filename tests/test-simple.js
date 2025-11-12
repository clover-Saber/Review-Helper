// 简单的 Electron 启动测试
const { app, BrowserWindow } = require('electron');

console.log('========================================');
console.log('简单测试：检查 Electron 是否能启动');
console.log('========================================\n');

app.whenReady().then(() => {
  console.log('✓ Electron 应用已准备就绪');
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    title: 'Electron 测试窗口'
  });
  
  console.log('✓ 窗口已创建');
  console.log('窗口 ID:', win.id);
  
  win.loadURL('https://www.google.com');
  
  win.webContents.once('did-finish-load', () => {
    console.log('✓ 页面加载完成');
    console.log('\n如果看到这个窗口，说明 Electron 工作正常！');
    console.log('5秒后自动关闭...\n');
    
    setTimeout(() => {
      win.close();
      app.quit();
    }, 5000);
  });
  
  win.on('closed', () => {
    console.log('窗口已关闭');
    app.quit();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

