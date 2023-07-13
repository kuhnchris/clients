import { mock, MockProxy } from "jest-mock-extended";

import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { TokenService } from "../../auth/abstractions/token.service";
import { VaultTimeoutAction } from "../../enums/vault-timeout-action.enum";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { StateService } from "../../platform/abstractions/state.service";

import { VaultTimeoutSettingsService } from "./vault-timeout-settings.service";

describe("VaultTimeoutSettingsService", () => {
  let cryptoService: MockProxy<CryptoService>;
  let tokenService: MockProxy<TokenService>;
  let policyService: MockProxy<PolicyService>;
  let stateService: MockProxy<StateService>;
  let service: VaultTimeoutSettingsService;

  beforeEach(() => {
    cryptoService = mock<CryptoService>();
    tokenService = mock<TokenService>();
    policyService = mock<PolicyService>();
    stateService = mock<StateService>();
    service = new VaultTimeoutSettingsService(
      cryptoService,
      tokenService,
      policyService,
      stateService
    );
  });

  describe("getAvailableVaultTimeoutActions", () => {
    it("should always return LogOut", async () => {
      const result = await service.getAvailableVaultTimeoutActions();

      expect(result).toContain(VaultTimeoutAction.LogOut);
    });
  });
});
