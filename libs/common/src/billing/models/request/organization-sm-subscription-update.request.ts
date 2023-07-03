export class OrganizationSmSubscriptionUpdateRequest {
  /**
   * The number of seats to add or remove from the subscription.
   */
  seatAdjustment: number;

  /**
   * The maximum number of seats that can be auto-scaled for the subscription.
   */
  maxAutoscaleSeats?: number;

  /**
   * The number of additional service accounts to add or remove from the subscription.
   */
  serviceAccountAdjustment: number;

  /**
   * The maximum number of additional service accounts that can be auto-scaled for the subscription.
   */
  maxAutoscaleServiceAccounts?: number;

  /**
   * Build a subscription update request for the Secrets Manager product type.
   * @param seatAdjustment - The number of seats to add or remove from the subscription.
   * @param serviceAccountAdjustment - The number of additional service accounts to add or remove from the subscription.
   * @param maxAutoscaleSeats - The maximum number of seats that can be auto-scaled for the subscription.
   * @param maxAutoscaleServiceAccounts - The maximum number of additional service accounts that can be auto-scaled for the subscription.
   */
  constructor(
    seatAdjustment: number,
    serviceAccountAdjustment: number,
    maxAutoscaleSeats?: number,
    maxAutoscaleServiceAccounts?: number
  ) {
    this.seatAdjustment = seatAdjustment;
    this.serviceAccountAdjustment = serviceAccountAdjustment;
    this.maxAutoscaleSeats = maxAutoscaleSeats;
    this.maxAutoscaleServiceAccounts = maxAutoscaleServiceAccounts;
  }
}
