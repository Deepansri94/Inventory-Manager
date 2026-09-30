const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  onUpdateResult: (callback) => ipcRenderer.on('update-result', (_, data) => callback(data))
});
