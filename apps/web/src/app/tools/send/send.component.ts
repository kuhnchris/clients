import { Component, NgZone, ViewChild, ViewContainerRef } from "@angular/core";

import { DialogServiceAbstraction } from "@bitwarden/angular/services/dialog";
import { ModalService } from "@bitwarden/angular/services/modal.service";
import { SendComponent as BaseSendComponent } from "@bitwarden/angular/tools/send/send.component";
import { SearchService } from "@bitwarden/common/abstractions/search.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { NoItemsModule, SearchModule, svgIcon } from "@bitwarden/components";

import { SharedModule } from "../../shared";

import { AddEditComponent } from "./add-edit.component";

const BroadcasterSubscriptionId = "SendComponent";

@Component({
  selector: "app-send",
  standalone: true,
  imports: [SharedModule, SearchModule, NoItemsModule],
  templateUrl: "send.component.html",
})
export class SendComponent extends BaseSendComponent {
  @ViewChild("sendAddEdit", { read: ViewContainerRef, static: true })
  sendAddEditModalRef: ViewContainerRef;
  noItemIcon = svgIcon`
  <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" fill="none">
    <path class="tw-stroke-secondary-500" stroke-width="3" d="M13.425 11.994H5.99a4.311 4.311 0 0 0-4.311 4.312v62.09a4.311 4.311 0 0 0 4.311 4.311h40.09"/>
    <path class="tw-stroke-secondary-500" stroke-width="3" d="M66.27 75.142h-49.9a3.234 3.234 0 0 1-3.233-3.234V9.818a3.234 3.234 0 0 1 3.234-3.233h35.764a3.233 3.233 0 0 1 2.293.953l14.134 14.216c.602.605.94 1.425.94 2.28v47.874a3.233 3.233 0 0 1-3.233 3.234Z"/>
    <path class="tw-stroke-secondary-500" stroke-width="2" d="M47.021 35.586c0-3.818-2.728-6.915-6.095-6.915-3.367 0-6.096 3.097-6.096 6.915"/>
    <path class="tw-stroke-secondary-500 tw-fill-secondary-100" stroke-width="2" d="M47.38 35.335H34.058a3.593 3.593 0 0 0-3.593 3.592v9.817a3.593 3.593 0 0 0 3.593 3.593H47.38a3.593 3.593 0 0 0 3.593-3.593v-9.817a3.593 3.593 0 0 0-3.593-3.592Z"/>
    <path class="tw-stroke-secondary-500" stroke-linecap="round" stroke-width="2" d="M40.72 44.34v2.618"/>
    <path class="tw-stroke-secondary-500" stroke-linecap="round" stroke-width="4" d="M40.72 42.7v-.373"/>
    <path class="tw-stroke-secondary-500 tw-fill-secondary-100" stroke-width="3" d="M89.326 64.022s1.673-.73 2.252.572c.512 1.138-.822 2.033-.822 2.033L56.757 88.133a3.886 3.886 0 0 0-1.583 2.188l-4.732 16.705a2.665 2.665 0 0 0 .059 1.611 2.596 2.596 0 0 0 1.891 1.663c.331.07.673.071 1.004.004.402-.077.78-.25 1.102-.503l10.11-7.88a3.138 3.138 0 0 1 1.92-.663 3.08 3.08 0 0 1 1.905.662l13.926 10.948a2.556 2.556 0 0 0 3.162 0c.301-.238.55-.537.727-.879l31.777-61.762c.231-.448.33-.952.284-1.455a2.606 2.606 0 0 0-1.721-2.226 2.499 2.499 0 0 0-1.457-.06l-81.18 20.418c-.465.12-.888.364-1.223.708a2.672 2.672 0 0 0-.632 2.676c.146.46.417.865.78 1.174L46.2 83.1a4.463 4.463 0 0 0 2.565 1.572 4.489 4.489 0 0 0 2.984-.413l37.578-20.237Z"/>
  </svg>
  `;

  constructor(
    sendService: SendService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    ngZone: NgZone,
    searchService: SearchService,
    policyService: PolicyService,
    private modalService: ModalService,
    private broadcasterService: BroadcasterService,
    logService: LogService,
    sendApiService: SendApiService,
    dialogService: DialogServiceAbstraction
  ) {
    super(
      sendService,
      i18nService,
      platformUtilsService,
      environmentService,
      ngZone,
      searchService,
      policyService,
      logService,
      sendApiService,
      dialogService
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    await this.load();

    // Broadcaster subscription - load if sync completes in the background
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              await this.load();
            }
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async addSend() {
    if (this.disableSend) {
      return;
    }

    const component = await this.editSend(null);
    component.type = this.type;
  }

  async editSend(send: SendView) {
    const [modal, childComponent] = await this.modalService.openViewRef(
      AddEditComponent,
      this.sendAddEditModalRef,
      (comp) => {
        comp.sendId = send == null ? null : send.id;
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onSavedSend.subscribe(async () => {
          modal.close();
          await this.load();
        });
        // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
        comp.onDeletedSend.subscribe(async () => {
          modal.close();
          await this.load();
        });
      }
    );

    return childComponent;
  }
}
