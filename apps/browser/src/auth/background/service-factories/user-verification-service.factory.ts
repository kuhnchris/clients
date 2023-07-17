import { UserVerificationService as UserVerificationServiceAbstraction } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/services/user-verification/user-verification.service";

import {
  CryptoServiceInitOptions,
  cryptoServiceFactory,
} from "../../../platform/background/service-factories/crypto-service.factory";
import {
  CachedServices,
  factory,
  FactoryOptions,
} from "../../../platform/background/service-factories/factory-options";
import {
  i18nServiceFactory,
  I18nServiceInitOptions,
} from "../../../platform/background/service-factories/i18n-service.factory";
import {
  StateServiceInitOptions,
  stateServiceFactory,
} from "../../../platform/background/service-factories/state-service.factory";

import {
  userVerificationApiServiceFactory,
  UserVerificationApiServiceInitOptions,
} from "./user-verification-api-service.factory";

type UserVerificationServiceFactoryOptions = FactoryOptions;

export type UserVerificationServiceInitOptions = UserVerificationServiceFactoryOptions &
  StateServiceInitOptions &
  CryptoServiceInitOptions &
  I18nServiceInitOptions &
  UserVerificationApiServiceInitOptions;

export function userVerificationServiceFactory(
  cache: { userVerificationService?: UserVerificationServiceAbstraction } & CachedServices,
  opts: UserVerificationServiceInitOptions
): Promise<UserVerificationServiceAbstraction> {
  return factory(
    cache,
    "userVerificationService",
    opts,
    async () =>
      new UserVerificationService(
        await stateServiceFactory(cache, opts),
        await cryptoServiceFactory(cache, opts),
        await i18nServiceFactory(cache, opts),
        await userVerificationApiServiceFactory(cache, opts)
      )
  );
}
