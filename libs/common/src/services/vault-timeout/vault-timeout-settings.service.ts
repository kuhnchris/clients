import { VaultTimeoutSettingsService as VaultTimeoutSettingsServiceAbstraction } from "../../abstractions/vault-timeout/vault-timeout-settings.service";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../admin-console/enums";
import { TokenService } from "../../auth/abstractions/token.service";
import { KeySuffixOptions } from "../../enums/key-suffix-options.enum";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { StateService } from "../../platform/abstractions/state.service";

/**
 * - DISABLED: No Pin set
 * - PERSISTENT: Pin is set and survives client reset
 * - TRANSIENT: Pin is set and requires password unlock after client reset
 */
export type PinLockType = "DISABLED" | "PERSISTANT" | "TRANSIENT";

export class VaultTimeoutSettingsService implements VaultTimeoutSettingsServiceAbstraction {
  constructor(
    private cryptoService: CryptoService,
    private tokenService: TokenService,
    private policyService: PolicyService,
    private stateService: StateService
  ) {}

  async setVaultTimeoutOptions(timeout: number, action: VaultTimeoutAction): Promise<void> {
    await this.stateService.setVaultTimeout(timeout);

    // We swap these tokens from being on disk for lock actions, and in memory for logout actions
    // Get them here to set them to their new location after changing the timeout action and clearing if needed
    const token = await this.tokenService.getToken();
    const refreshToken = await this.tokenService.getRefreshToken();
    const clientId = await this.tokenService.getClientId();
    const clientSecret = await this.tokenService.getClientSecret();

    const currentAction = await this.stateService.getVaultTimeoutAction();
    if (
      (timeout != null || timeout === 0) &&
      action === VaultTimeoutAction.LogOut &&
      action !== currentAction
    ) {
      // if we have a vault timeout and the action is log out, reset tokens
      await this.tokenService.clearToken();
    }

    await this.stateService.setVaultTimeoutAction(action);

    await this.tokenService.setToken(token);
    await this.tokenService.setRefreshToken(refreshToken);
    await this.tokenService.setClientId(clientId);
    await this.tokenService.setClientSecret(clientSecret);

    await this.cryptoService.refreshAdditionalKeys();
  }

  async isPinLockSet(): Promise<PinLockType> {
    // we can't check the protected pin for both because old accounts only
    // used it for MP on Restart
    const pinIsEnabled = !!(await this.stateService.getProtectedPin());
    const aUserKeyPinIsSet = !!(await this.stateService.getUserKeyPin());
    const anOldUserKeyPinIsSet = !!(await this.stateService.getEncryptedPinProtected());

    if (aUserKeyPinIsSet || anOldUserKeyPinIsSet) {
      return "PERSISTANT";
    } else if (pinIsEnabled && !aUserKeyPinIsSet && !anOldUserKeyPinIsSet) {
      return "TRANSIENT";
    } else {
      return "DISABLED";
    }
  }

  async isBiometricLockSet(): Promise<boolean> {
    return await this.stateService.getBiometricUnlock();
  }

  async getVaultTimeout(userId?: string): Promise<number> {
    const vaultTimeout = await this.stateService.getVaultTimeout({ userId: userId });

    if (
      await this.policyService.policyAppliesToUser(PolicyType.MaximumVaultTimeout, null, userId)
    ) {
      const policy = await this.policyService.getAll(PolicyType.MaximumVaultTimeout, userId);
      // Remove negative values, and ensure it's smaller than maximum allowed value according to policy
      let timeout = Math.min(vaultTimeout, policy[0].data.minutes);

      if (vaultTimeout == null || timeout < 0) {
        timeout = policy[0].data.minutes;
      }

      // TODO @jlf0dev: Can we move this somwhere else? Maybe add it to the initialization process?
      // ( Apparently I'm the one that reviewed the original PR that added this :) )
      // We really shouldn't need to set the value here, but multiple services relies on this value being correct.
      if (vaultTimeout !== timeout) {
        await this.stateService.setVaultTimeout(timeout, { userId: userId });
      }

      return timeout;
    }

    return vaultTimeout;
  }

  async getVaultTimeoutAction(userId?: string): Promise<VaultTimeoutAction> {
    let vaultTimeoutAction = await this.stateService.getVaultTimeoutAction({ userId: userId });

    if (
      await this.policyService.policyAppliesToUser(PolicyType.MaximumVaultTimeout, null, userId)
    ) {
      const policy = await this.policyService.getAll(PolicyType.MaximumVaultTimeout, userId);
      const action = policy[0].data.action;

      if (action) {
        // We really shouldn't need to set the value here, but multiple services relies on this value being correct.
        if (action && vaultTimeoutAction !== action) {
          await this.stateService.setVaultTimeoutAction(action, { userId: userId });
        }
        vaultTimeoutAction = action;
      }
    }

    return vaultTimeoutAction === VaultTimeoutAction.LogOut
      ? VaultTimeoutAction.LogOut
      : VaultTimeoutAction.Lock;
  }

  async clear(userId?: string): Promise<void> {
    await this.stateService.setEverBeenUnlocked(false, { userId: userId });
    await this.cryptoService.clearPinKeys(userId);
    await this.cryptoService.clearDeprecatedKeys(KeySuffixOptions.Pin, userId);
  }
}
