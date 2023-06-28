import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import * as JSZip from "jszip";
import { concat, Observable, Subject } from "rxjs";
import { map, takeUntil } from "rxjs/operators";
import Swal, { SweetAlertIcon } from "sweetalert2";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import {
  canAccessImportExport,
  OrganizationService,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  ImportOption,
  ImportResult,
  ImportServiceAbstraction,
  ImportType,
} from "@bitwarden/importer";

import { FilePasswordPromptComponent, ImportSuccessDialogComponent } from "./dialog";

@Component({
  selector: "app-import",
  templateUrl: "import.component.html",
})
export class ImportComponent implements OnInit, OnDestroy {
  featuredImportOptions: ImportOption[];
  importOptions: ImportOption[];
  format: ImportType = null;
  selectedImportTarget: string = null;
  fileContents: string;
  fileSelected: File;
  loading = false;

  folders$: Observable<FolderView[]>;
  collections$: Observable<CollectionView[]>;
  organizations$: Observable<Organization[]>;

  protected organizationId: string = null;
  protected destroy$ = new Subject<void>();

  private _importBlockedByPolicy = false;

  formGroup = this.formBuilder.group({
    vaultSelector: [
      "myVault",
      {
        nonNullable: true,
        validators: [Validators.required],
      },
    ],
    targetSelector: [null],
    format: [null as ImportType | null, [Validators.required]],
    fileContents: [],
    file: [],
  });

  constructor(
    protected i18nService: I18nService,
    protected importService: ImportServiceAbstraction,
    protected router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected policyService: PolicyService,
    private logService: LogService,
    protected modalService: ModalService,
    protected syncService: SyncService,
    protected dialogService: DialogServiceAbstraction,
    protected folderService: FolderService,
    protected collectionService: CollectionService,
    protected organizationService: OrganizationService,
    protected formBuilder: FormBuilder
  ) {}

  protected get importBlockedByPolicy(): boolean {
    return this._importBlockedByPolicy;
  }

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(): Promise<void> {
    await this.router.navigate(["vault"]);
  }

  ngOnInit() {
    this.setImportOptions();

    this.policyService
      .policyAppliesToActiveUser$(PolicyType.PersonalOwnership)
      .pipe(takeUntil(this.destroy$))
      .subscribe((policyAppliesToActiveUser) => {
        this._importBlockedByPolicy = policyAppliesToActiveUser;
        if (this._importBlockedByPolicy) {
          this.formGroup.disable();
        }
      });

    this.organizations$ = concat(
      this.organizationService.memberOrganizations$.pipe(
        canAccessImportExport(this.i18nService),
        map((orgs) => orgs.sort(Utils.getSortFunction(this.i18nService, "name")))
      )
    );

    if (this.organizationId) {
      this.formGroup.controls.vaultSelector.patchValue(this.organizationId);
      this.formGroup.controls.vaultSelector.disable();

      this.collections$ = Utils.asyncToObservable(() =>
        this.collectionService
          .getAllDecrypted()
          .then((c) => c.filter((c2) => c2.organizationId === this.organizationId))
      );
    } else {
      this.folders$ = this.folderService.folderViews$;
      this.formGroup.controls.targetSelector.disable();

      this.formGroup.controls.vaultSelector.valueChanges
        .pipe(takeUntil(this.destroy$))
        .subscribe((value) => {
          this.organizationId = value != "myVault" ? value : undefined;
          if (!this._importBlockedByPolicy) {
            this.formGroup.controls.targetSelector.enable();
          }
          if (value) {
            this.collections$ = Utils.asyncToObservable(() =>
              this.collectionService
                .getAllDecrypted()
                .then((c) => c.filter((c2) => c2.organizationId === value))
            );
          }
        });

      this.formGroup.controls.vaultSelector.setValue("myVault");
    }
    this.formGroup.controls.format.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        this.format = value;
      });
  }

  async submit() {
    if (this.importBlockedByPolicy) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("personalOwnershipPolicyInEffectImports")
      );
      return;
    }
    this.loading = true;
    const promptForPassword_callback = async () => {
      return await this.getFilePassword();
    };

    const importer = this.importService.getImporter(
      this.format,
      promptForPassword_callback,
      this.organizationId
    );

    if (importer === null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFormat")
      );
      this.loading = false;
      return;
    }

    const fileEl = document.getElementById("file") as HTMLInputElement;
    const files = fileEl.files;
    let fileContents = this.formGroup.controls.fileContents.value;
    if ((files == null || files.length === 0) && (fileContents == null || fileContents === "")) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile")
      );
      this.loading = false;
      return;
    }

    if (files != null && files.length > 0) {
      try {
        const content = await this.getFileContents(files[0]);
        if (content != null) {
          fileContents = content;
        }
      } catch (e) {
        this.logService.error(e);
      }
    }

    if (fileContents == null || fileContents === "") {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile")
      );
      this.loading = false;
      return;
    }

    try {
      const result = await this.importService.import(
        importer,
        fileContents,
        this.organizationId,
        this.formGroup.controls.targetSelector.value
      );

      //No errors, display success message
      this.dialogService.open<unknown, ImportResult>(ImportSuccessDialogComponent, {
        data: result,
      });

      this.syncService.fullSync(true);
      await this.onSuccessfulImport();
    } catch (e) {
      this.error(e);
      this.logService.error(e);
    }

    this.loading = false;
  }

  getFormatInstructionTitle() {
    if (this.format == null) {
      return null;
    }

    const results = this.featuredImportOptions
      .concat(this.importOptions)
      .filter((o) => o.id === this.format);
    if (results.length > 0) {
      return this.i18nService.t("instructionsFor", results[0].name);
    }
    return null;
  }

  protected setImportOptions() {
    this.featuredImportOptions = [
      {
        id: null,
        name: "-- " + this.i18nService.t("select") + " --",
      },
      ...this.importService.featuredImportOptions,
    ];
    this.importOptions = [...this.importService.regularImportOptions].sort((a, b) => {
      if (a.name == null && b.name != null) {
        return -1;
      }
      if (a.name != null && b.name == null) {
        return 1;
      }
      if (a.name == null && b.name == null) {
        return 0;
      }

      return this.i18nService.collator
        ? this.i18nService.collator.compare(a.name, b.name)
        : a.name.localeCompare(b.name);
    });
  }

  setSelectedFile(event: Event) {
    const fileInputEl = <HTMLInputElement>event.target;
    this.fileSelected = fileInputEl.files.length > 0 ? fileInputEl.files[0] : null;
  }

  private async error(error: Error) {
    await Swal.fire({
      heightAuto: false,
      buttonsStyling: false,
      icon: "error" as SweetAlertIcon,
      iconHtml: `<i class="swal-custom-icon bwi bwi-error text-danger"></i>`,
      input: "textarea",
      inputValue: error.message,
      inputAttributes: {
        readonly: "true",
      },
      titleText: this.i18nService.t("importError"),
      text: this.i18nService.t("importErrorDesc"),
      showConfirmButton: true,
      confirmButtonText: this.i18nService.t("ok"),
      onOpen: (popupEl) => {
        popupEl.querySelector(".swal2-textarea").scrollTo(0, 0);
      },
    });
  }

  private getFileContents(file: File): Promise<string> {
    if (this.format === "1password1pux") {
      return this.extract1PuxContent(file);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsText(file, "utf-8");
      reader.onload = (evt) => {
        if (this.format === "lastpasscsv" && file.type === "text/html") {
          const parser = new DOMParser();
          const doc = parser.parseFromString((evt.target as any).result, "text/html");
          const pre = doc.querySelector("pre");
          if (pre != null) {
            resolve(pre.textContent);
            return;
          }
          reject();
          return;
        }

        resolve((evt.target as any).result);
      };
      reader.onerror = () => {
        reject();
      };
    });
  }

  private extract1PuxContent(file: File): Promise<string> {
    return new JSZip()
      .loadAsync(file)
      .then((zip) => {
        return zip.file("export.data").async("string");
      })
      .then(
        function success(content) {
          return content;
        },
        function error(e) {
          return "";
        }
      );
  }

  async getFilePassword(): Promise<string> {
    const ref = this.modalService.open(FilePasswordPromptComponent, {
      allowMultipleModals: true,
    });

    if (ref == null) {
      return null;
    }

    return await ref.onClosedPromise();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
