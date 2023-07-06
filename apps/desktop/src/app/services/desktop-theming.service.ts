import { Injectable } from "@angular/core";

import { ThemingService } from "@bitwarden/angular/services/theming/theming.service";
import { ThemeType } from "@bitwarden/common/enums";

@Injectable()
export class DesktopThemingService extends ThemingService {
  protected async getSystemTheme(): Promise<ThemeType> {
    return await window.ipcRenderer.invoke("systemTheme");
  }

  protected monitorSystemThemeChanges(): void {
    window.ipcRenderer.on("systemThemeUpdated", (_event, theme: ThemeType) =>
      this.updateSystemTheme(theme)
    );
  }
}
