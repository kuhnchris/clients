import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";

export class ElectronRendererStorageService implements AbstractStorageService {
  get<T>(key: string): Promise<T> {
    return window.ipcRenderer.invoke("storageService", {
      action: "get",
      key: key,
    });
  }

  has(key: string): Promise<boolean> {
    return window.ipcRenderer.invoke("storageService", {
      action: "has",
      key: key,
    });
  }

  save(key: string, obj: any): Promise<any> {
    return window.ipcRenderer.invoke("storageService", {
      action: "save",
      key: key,
      obj: obj,
    });
  }

  remove(key: string): Promise<any> {
    return window.ipcRenderer.invoke("storageService", {
      action: "remove",
      key: key,
    });
  }
}
