import { Directive, OnInit } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  GeneratedPasswordHistory,
  PasswordGenerationServiceAbstraction,
} from "@bitwarden/common/tools/generator/password";

@Directive()
export class PasswordGeneratorHistoryComponent implements OnInit {
  history: GeneratedPasswordHistory[] = [];

  constructor(
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    private win: Window
  ) {}

  async ngOnInit() {
    this.history = await this.passwordGenerationService.getHistory();
  }

  clear() {
    this.history = [];
    this.passwordGenerationService.clear();
  }

  copy(password: string) {
    const copyOptions = this.win != null ? { window: this.win } : null;
    this.platformUtilsService.copyToClipboard(password, copyOptions);
    this.platformUtilsService.showToast(
      "info",
      null,
      this.i18nService.t("valueCopied", this.i18nService.t("password"))
    );
  }
}
