import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("versions", {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  // we can also expose variables, not just functions
});

// TODO: This is BAD! Do not do this!
contextBridge.exposeInMainWorld("ipcRenderer", {
  invoke: (channel: string, data: any) => {
    return ipcRenderer.invoke(channel, data);
  },
  on: (channel: string, callback: any) => {
    return ipcRenderer.on(channel, callback);
  },
  send: (channel: string, data: any) => {
    return ipcRenderer.send(channel, data);
  },
});
