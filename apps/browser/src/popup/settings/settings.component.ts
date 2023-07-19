import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import {
  BehaviorSubject,
  concatMap,
  filter,
  map,
  Observable,
  pairwise,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";
import Swal from "sweetalert2";

import { DialogServiceAbstraction, SimpleDialogType } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { VaultTimeoutService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { DeviceType } from "@bitwarden/common/enums";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { BiometricErrors, BiometricErrorTypes } from "../../models/biometricErrors";
import { BrowserApi } from "../../platform/browser/browser-api";
import { SetPinComponent } from "../components/set-pin.component";
import { PopupUtilsService } from "../services/popup-utils.service";

import { AboutComponent } from "./about.component";

const RateUrls = {
  [DeviceType.ChromeExtension]:
    "https://chrome.google.com/webstore/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb/reviews",
  [DeviceType.FirefoxExtension]:
    "https://addons.mozilla.org/en-US/firefox/addon/bitwarden-password-manager/#reviews",
  [DeviceType.OperaExtension]:
    "https://addons.opera.com/en/extensions/details/bitwarden-free-password-manager/#feedback-container",
  [DeviceType.EdgeExtension]:
    "https://microsoftedge.microsoft.com/addons/detail/jbkfoedolllekgbhcbcoahefnbanhhlh",
  [DeviceType.VivaldiExtension]:
    "https://chrome.google.com/webstore/detail/bitwarden-free-password-m/nngceckbapebfimnlniiiahkandclblb/reviews",
  [DeviceType.SafariExtension]: "https://apps.apple.com/app/bitwarden/id1352778147",
};

@Component({
  selector: "app-settings",
  templateUrl: "settings.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class SettingsComponent implements OnInit {
  protected readonly VaultTimeoutAction = VaultTimeoutAction;

  protected availableVaultTimeoutActions$: Observable<VaultTimeoutAction[]>;

  vaultTimeoutOptions: any[];
  vaultTimeoutPolicyCallout: Observable<{
    timeout: { hours: number; minutes: number };
    action: VaultTimeoutAction;
  }>;
  supportsBiometric: boolean;
  showChangeMasterPass = true;

  form = this.formBuilder.group({
    vaultTimeout: [null as number | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
    pin: [null as boolean | null],
    biometric: false,
    enableAutoBiometricsPrompt: true,
  });

  private refresh$ = new BehaviorSubject<void>(undefined);
  private destroy$ = new Subject<void>();

  constructor(
    private policyService: PolicyService,
    private formBuilder: FormBuilder,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private vaultTimeoutService: VaultTimeoutService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    public messagingService: MessagingService,
    private router: Router,
    private environmentService: EnvironmentService,
    private cryptoService: CryptoService,
    private stateService: StateService,
    private popupUtilsService: PopupUtilsService,
    private modalService: ModalService,
    private keyConnectorService: KeyConnectorService,
    private dialogService: DialogServiceAbstraction
  ) {}

  async ngOnInit() {
    this.availableVaultTimeoutActions$ = this.refresh$.pipe(
      switchMap(() => this.vaultTimeoutSettingsService.availableVaultTimeoutActions$)
    );
    this.vaultTimeoutPolicyCallout = this.policyService.get$(PolicyType.MaximumVaultTimeout).pipe(
      filter((policy) => policy != null),
      map((policy) => {
        let timeout;
        if (policy.data?.minutes) {
          timeout = {
            hours: Math.floor(policy.data?.minutes / 60),
            minutes: policy.data?.minutes % 60,
          };
        }
        return { timeout: timeout, action: policy.data?.action };
      }),
      tap((policy) => {
        if (policy.action) {
          this.form.controls.vaultTimeoutAction.disable({ emitEvent: false });
        } else {
          this.form.controls.vaultTimeoutAction.enable({ emitEvent: false });
        }
      })
    );

    const showOnLocked =
      !this.platformUtilsService.isFirefox() && !this.platformUtilsService.isSafari();

    this.vaultTimeoutOptions = [
      { name: this.i18nService.t("immediately"), value: 0 },
      { name: this.i18nService.t("oneMinute"), value: 1 },
      { name: this.i18nService.t("fiveMinutes"), value: 5 },
      { name: this.i18nService.t("fifteenMinutes"), value: 15 },
      { name: this.i18nService.t("thirtyMinutes"), value: 30 },
      { name: this.i18nService.t("oneHour"), value: 60 },
      { name: this.i18nService.t("fourHours"), value: 240 },
      // { name: i18nService.t('onIdle'), value: -4 },
      // { name: i18nService.t('onSleep'), value: -3 },
    ];

    if (showOnLocked) {
      this.vaultTimeoutOptions.push({ name: this.i18nService.t("onLocked"), value: -2 });
    }

    this.vaultTimeoutOptions.push({ name: this.i18nService.t("onRestart"), value: -1 });
    this.vaultTimeoutOptions.push({ name: this.i18nService.t("never"), value: null });

    let timeout = await this.vaultTimeoutSettingsService.getVaultTimeout();
    if (timeout === -2 && !showOnLocked) {
      timeout = -1;
    }
    const pinStatus = await this.vaultTimeoutSettingsService.isPinLockSet();

    this.form.controls.vaultTimeout.valueChanges
      .pipe(
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveVaultTimeout(previousValue, newValue);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

    this.form.controls.vaultTimeoutAction.valueChanges
      .pipe(
        pairwise(),
        concatMap(async ([previousValue, newValue]) => {
          await this.saveVaultTimeoutAction(previousValue, newValue);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();

    const initialValues = {
      vaultTimeout: timeout,
      vaultTimeoutAction: await this.vaultTimeoutSettingsService.getVaultTimeoutAction(),
      pin: pinStatus !== "DISABLED",
      biometric: await this.vaultTimeoutSettingsService.isBiometricLockSet(),
      enableAutoBiometricsPrompt: !(await this.stateService.getDisableAutoBiometricsPrompt()),
    };
    this.form.setValue(initialValues);

    this.supportsBiometric = await this.platformUtilsService.supportsBiometric();
    this.showChangeMasterPass = !(await this.keyConnectorService.getUsesKeyConnector());

    this.form.controls.biometric.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((enabled) => {
        if (enabled) {
          this.form.controls.enableAutoBiometricsPrompt.enable();
        } else {
          this.form.controls.enableAutoBiometricsPrompt.disable();
        }
      });
  }

  async saveVaultTimeout(previousValue: number, newValue: number) {
    if (newValue == null) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "warning" },
        content: { key: "neverLockWarning" },
        type: SimpleDialogType.WARNING,
      });

      if (!confirmed) {
        this.form.controls.vaultTimeout.setValue(previousValue, { emitEvent: false });
        return;
      }
    }

    // The minTimeoutError does not apply to browser because it supports Immediately
    // So only check for the policyError
    if (this.form.controls.vaultTimeout.hasError("policyError")) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("vaultTimeoutTooLarge")
      );
      return;
    }

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      newValue,
      this.form.value.vaultTimeoutAction
    );
    if (newValue == null) {
      this.messagingService.send("bgReseedStorage");
    }
  }

  async saveVaultTimeoutAction(previousValue: VaultTimeoutAction, newValue: VaultTimeoutAction) {
    if (newValue === VaultTimeoutAction.LogOut) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "vaultTimeoutLogOutConfirmationTitle" },
        content: { key: "vaultTimeoutLogOutConfirmation" },
        type: SimpleDialogType.WARNING,
      });

      if (!confirmed) {
        this.form.controls.vaultTimeoutAction.setValue(previousValue, {
          emitEvent: false,
        });
        return;
      }
    }

    if (this.form.controls.vaultTimeout.hasError("policyError")) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("vaultTimeoutTooLarge")
      );
      return;
    }

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      this.form.value.vaultTimeout,
      newValue
    );
  }

  async updatePin() {
    if (this.form.value.pin) {
      const ref = this.modalService.open(SetPinComponent, { allowMultipleModals: true });

      if (ref == null) {
        this.form.controls.pin.setValue(false);
        return;
      }

      this.form.controls.pin.setValue(await ref.onClosedPromise());
    } else {
      await this.vaultTimeoutSettingsService.clear();
    }
  }

  async updateBiometric() {
    if (this.form.value.biometric && this.supportsBiometric) {
      let granted;
      try {
        granted = await BrowserApi.requestPermission({ permissions: ["nativeMessaging"] });
      } catch (e) {
        // eslint-disable-next-line
        console.error(e);

        if (this.platformUtilsService.isFirefox() && this.popupUtilsService.inSidebar(window)) {
          await this.dialogService.openSimpleDialog({
            title: { key: "nativeMessaginPermissionSidebarTitle" },
            content: { key: "nativeMessaginPermissionSidebarDesc" },
            acceptButtonText: { key: "ok" },
            cancelButtonText: null,
            type: SimpleDialogType.INFO,
          });

          this.form.controls.biometric.setValue(false);
          return;
        }
      }

      if (!granted) {
        await this.dialogService.openSimpleDialog({
          title: { key: "nativeMessaginPermissionErrorTitle" },
          content: { key: "nativeMessaginPermissionErrorDesc" },
          acceptButtonText: { key: "ok" },
          cancelButtonText: null,
          type: SimpleDialogType.DANGER,
        });

        this.form.controls.biometric.setValue(false);
        return;
      }

      const submitted = Swal.fire({
        heightAuto: false,
        buttonsStyling: false,
        titleText: this.i18nService.t("awaitDesktop"),
        text: this.i18nService.t("awaitDesktopDesc"),
        icon: "info",
        iconHtml: '<i class="swal-custom-icon bwi bwi-info-circle text-info"></i>',
        showCancelButton: true,
        cancelButtonText: this.i18nService.t("cancel"),
        showConfirmButton: false,
        allowOutsideClick: false,
      });

      await this.stateService.setBiometricAwaitingAcceptance(true);
      await this.cryptoService.refreshAdditionalKeys();

      await Promise.race([
        submitted.then(async (result) => {
          if (result.dismiss === Swal.DismissReason.cancel) {
            this.form.controls.biometric.setValue(false);
            await this.stateService.setBiometricAwaitingAcceptance(null);
          }
        }),
        this.platformUtilsService
          .authenticateBiometric()
          .then((result) => {
            this.form.controls.biometric.setValue(result);

            Swal.close();
            if (this.form.value.biometric === false) {
              this.platformUtilsService.showToast(
                "error",
                this.i18nService.t("errorEnableBiometricTitle"),
                this.i18nService.t("errorEnableBiometricDesc")
              );
            }
          })
          .catch((e) => {
            // Handle connection errors
            this.form.controls.biometric.setValue(false);

            const error = BiometricErrors[e as BiometricErrorTypes];

            this.dialogService.openSimpleDialog({
              title: { key: error.title },
              content: { key: error.description },
              acceptButtonText: { key: "ok" },
              cancelButtonText: null,
              type: SimpleDialogType.DANGER,
            });
          }),
      ]);
    } else {
      await this.stateService.setBiometricUnlock(null);
      await this.stateService.setBiometricFingerprintValidated(false);
    }
  }

  async updateAutoBiometricsPrompt() {
    await this.stateService.setDisableAutoBiometricsPrompt(
      !this.form.value.enableAutoBiometricsPrompt
    );
  }

  async lock() {
    await this.vaultTimeoutService.lock();
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      type: SimpleDialogType.INFO,
    });

    if (confirmed) {
      this.messagingService.send("logout");
    }
  }

  async changePassword() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "changeMasterPassword" },
      content: { key: "changeMasterPasswordConfirmation" },
      type: SimpleDialogType.INFO,
    });
    if (confirmed) {
      BrowserApi.createNewTab(
        "https://bitwarden.com/help/master-password/#change-your-master-password"
      );
    }
  }

  async twoStep() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "twoStepLogin" },
      content: { key: "twoStepLoginConfirmation" },
      type: SimpleDialogType.INFO,
    });
    if (confirmed) {
      BrowserApi.createNewTab("https://bitwarden.com/help/setup-two-step-login/");
    }
  }

  async share() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "learnOrg" },
      content: { key: "learnOrgConfirmation" },
      type: SimpleDialogType.INFO,
    });
    if (confirmed) {
      BrowserApi.createNewTab("https://bitwarden.com/help/about-organizations/");
    }
  }

  async webVault() {
    const url = this.environmentService.getWebVaultUrl();
    BrowserApi.createNewTab(url);
  }

  import() {
    BrowserApi.createNewTab("https://bitwarden.com/help/import-data/");
  }

  export() {
    this.router.navigate(["/export"]);
  }

  about() {
    this.modalService.open(AboutComponent);
  }

  async fingerprint() {
    const fingerprint = await this.cryptoService.getFingerprint(
      await this.stateService.getUserId()
    );
    const p = document.createElement("p");
    p.innerText = this.i18nService.t("yourAccountsFingerprint") + ":";
    const p2 = document.createElement("p");
    p2.innerText = fingerprint.join("-");
    const div = document.createElement("div");
    div.appendChild(p);
    div.appendChild(p2);

    const result = await Swal.fire({
      heightAuto: false,
      buttonsStyling: false,
      html: div,
      showCancelButton: true,
      cancelButtonText: this.i18nService.t("close"),
      showConfirmButton: true,
      confirmButtonText: this.i18nService.t("learnMore"),
    });

    if (result.value) {
      this.platformUtilsService.launchUri("https://bitwarden.com/help/fingerprint-phrase/");
    }
  }

  rate() {
    const deviceType = this.platformUtilsService.getDevice();
    BrowserApi.createNewTab((RateUrls as any)[deviceType]);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
