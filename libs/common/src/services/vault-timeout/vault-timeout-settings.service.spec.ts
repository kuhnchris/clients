import { mock, MockProxy } from "jest-mock-extended";

import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { TokenService } from "../../auth/abstractions/token.service";
import { UserVerificationService } from "../../auth/abstractions/user-verification/user-verification.service.abstraction";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { StateService } from "../../platform/abstractions/state.service";
import { EncString } from "../../platform/models/domain/enc-string";

import { VaultTimeoutSettingsService } from "./vault-timeout-settings.service";

describe("VaultTimeoutSettingsService", () => {
  let cryptoService: MockProxy<CryptoService>;
  let tokenService: MockProxy<TokenService>;
  let policyService: MockProxy<PolicyService>;
  let stateService: MockProxy<StateService>;
  let userVerificationService: MockProxy<UserVerificationService>;
  let service: VaultTimeoutSettingsService;

  beforeEach(() => {
    cryptoService = mock<CryptoService>();
    tokenService = mock<TokenService>();
    policyService = mock<PolicyService>();
    stateService = mock<StateService>();
    userVerificationService = mock<UserVerificationService>();
    service = new VaultTimeoutSettingsService(
      cryptoService,
      tokenService,
      policyService,
      stateService,
      userVerificationService
    );
  });

  describe("getAvailableVaultTimeoutActions", () => {
    it("always returns LogOut", async () => {
      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).toContain(VaultTimeoutAction.LogOut);
    });

    it("contains Lock when the user has a master password", async () => {
      userVerificationService.hasMasterPassword.mockResolvedValue(true);

      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has a persistent PIN configured", async () => {
      stateService.getUserKeyPin.mockResolvedValue(createEncString());

      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has a transient/ephemeral PIN configured", async () => {
      stateService.getProtectedPin.mockResolvedValue("some-key");

      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("contains Lock when the user has biometrics configured", async () => {
      stateService.getBiometricUnlock.mockResolvedValue(true);

      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).toContain(VaultTimeoutAction.Lock);
    });

    it("not contains Lock when the user does not have a master password, PIN, or biometrics", async () => {
      userVerificationService.hasMasterPassword.mockResolvedValue(false);
      stateService.getUserKeyPin.mockResolvedValue(null);
      stateService.getProtectedPin.mockResolvedValue(null);
      stateService.getBiometricUnlock.mockResolvedValue(false);

      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).not.toContain(VaultTimeoutAction.Lock);
    });
  });
});

function createEncString() {
  return Symbol() as unknown as EncString;
}
