const { contextBridge, shell } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  isPackaged: process.env.NODE_ENV !== 'development',
  openExternal: (url) => shell.openExternal(url),
  getMachineId: async () => {
    const user = os.userInfo().username || 'user';
    const host = os.hostname() || 'machine';
    return `${host}-${user}`;
  },
});
