import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";

import { HintComponent as BaseHintComponent } from "@bitwarden/angular/auth/components/hint.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

@Component({
  selector: "app-hint",
  templateUrl: "hint.component.html",
})
export class HintComponent extends BaseHintComponent {
  constructor(
    router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    apiService: ApiService,
    logService: LogService,
    private route: ActivatedRoute,
    loginService: LoginService
  ) {
    super(router, i18nService, apiService, platformUtilsService, logService, loginService);

    super.onSuccessfulSubmit = async () => {
      this.router.navigate([this.successRoute]);
    };
  }
}
