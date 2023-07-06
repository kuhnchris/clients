import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

export class ElectronRendererMessagingService implements MessagingService {
  constructor(private broadcasterService: BroadcasterService) {
    window.ipcRenderer.on("messagingService", async (event: any, message: any) => {
      if (message.command) {
        this.sendMessage(message.command, message, false);
      }
    });
  }

  send(subscriber: string, arg: any = {}) {
    this.sendMessage(subscriber, arg, true);
  }

  private sendMessage(subscriber: string, arg: any = {}, toMain: boolean) {
    const message = Object.assign({}, { command: subscriber }, arg);
    this.broadcasterService.send(message);
    if (toMain) {
      window.ipcRenderer.send("messagingService", message);
    }
  }
}
