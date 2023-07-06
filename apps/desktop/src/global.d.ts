declare module "forcefocus";

interface Window {
  ipcRenderer: {
    invoke: (channel: string, data?: any) => Promise<any>;
    send: (channel: string, data?: any) => void;
    on: (channel: string, callback: (event: any, data: any) => void) => void;
  };
}
