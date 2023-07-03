import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Subject, takeUntil } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationSmSubscriptionUpdateRequest } from "@bitwarden/common/billing/models/request/organization-sm-subscription-update.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export interface SecretsManagerSubscriptionOptions {
  interval: "year" | "month";

  /**
   * The current number of seats the organization subscribes to.
   */
  seatCount: number;

  /**
   * Optional auto-scaling limit for the number of seats the organization can subscribe to.
   */
  seatLimit: number;

  /**
   * The price per seat for the subscription.
   */
  seatPrice: number;

  /**
   * The number of service accounts that are included in the base subscription.
   */
  baseServiceAccountCount: number;

  /**
   * The current number of additional service accounts the organization subscribes to.
   */
  serviceAccountCount: number;

  /**
   * Optional auto-scaling limit for the number of additional service accounts the organization can subscribe to.
   */
  serviceAccountLimit: number;

  /**
   * The price per additional service account for the subscription.
   */
  additionalServiceAccountPrice: number;
}

@Component({
  selector: "app-sm-adjust-subscription",
  templateUrl: "sm-adjust-subscription.component.html",
})
export class SecretsManagerAdjustSubscriptionComponent implements OnInit, OnDestroy {
  @Input() organizationId: string;
  @Input() options: SecretsManagerSubscriptionOptions;
  @Output() onAdjusted = new EventEmitter();

  private destroy$ = new Subject<void>();

  formGroup = this.formBuilder.group({
    seatCount: [0, [Validators.required, Validators.min(1)]],
    limitSeats: [false],
    seatLimit: [null as number | null],
    serviceAccountCount: [0, [Validators.required, Validators.min(0)]],
    limitServiceAccounts: [false],
    serviceAccountLimit: [null as number | null],
  });

  get monthlyServiceAccountPrice(): number {
    return this.options.interval == "month"
      ? this.options.additionalServiceAccountPrice
      : this.options.additionalServiceAccountPrice / 12;
  }

  get serviceAccountTotal(): number {
    return Math.abs(
      this.formGroup.value.serviceAccountCount * this.options.additionalServiceAccountPrice
    );
  }

  get seatTotal(): number {
    return Math.abs(this.formGroup.value.seatCount * this.options.seatPrice);
  }

  get maxServiceAccountTotal(): number {
    return Math.abs(
      (this.formGroup.value.serviceAccountLimit ?? 0) * this.options.additionalServiceAccountPrice
    );
  }

  get maxSeatTotal(): number {
    return Math.abs((this.formGroup.value.seatLimit ?? 0) * this.options.seatPrice);
  }

  constructor(
    private formBuilder: FormBuilder,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService
  ) {}

  ngOnInit() {
    this.formGroup.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      const seatLimitControl = this.formGroup.controls.seatLimit;
      const serviceAccountLimitControl = this.formGroup.controls.serviceAccountLimit;

      if (value.limitSeats) {
        seatLimitControl.setValidators([Validators.min(value.seatCount)]);
        seatLimitControl.enable({ emitEvent: false });
      } else {
        seatLimitControl.disable({ emitEvent: false });
      }

      if (value.limitServiceAccounts) {
        serviceAccountLimitControl.setValidators([Validators.min(value.serviceAccountCount)]);
        serviceAccountLimitControl.enable({ emitEvent: false });
      } else {
        serviceAccountLimitControl.disable({ emitEvent: false });
      }
    });

    this.formGroup.patchValue({
      seatCount: this.options.seatCount,
      seatLimit: this.options.seatLimit,
      serviceAccountCount: this.options.serviceAccountCount,
      serviceAccountLimit: this.options.serviceAccountLimit,
      limitSeats: this.options.seatLimit != null,
      limitServiceAccounts: this.options.serviceAccountLimit != null,
    });
  }

  submit = async () => {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      return;
    }

    const seatAdjustment = this.formGroup.value.seatCount - this.options.seatCount;
    const serviceAccountAdjustment =
      this.formGroup.value.serviceAccountCount - this.options.serviceAccountCount;

    const request = new OrganizationSmSubscriptionUpdateRequest(
      seatAdjustment,
      serviceAccountAdjustment,
      this.formGroup.value.seatLimit,
      this.formGroup.value.serviceAccountLimit
    );

    await this.organizationApiService.updateSecretsManagerSubscription(
      this.organizationId,
      request
    );

    await this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("subscriptionUpdated")
    );

    this.onAdjusted.emit();
  };

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
