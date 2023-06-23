import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared";

import { SecretsManagerSubscribeStandaloneComponent } from "./sm-subscribe-standalone.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";

@NgModule({
  imports: [SharedModule],
  declarations: [SecretsManagerSubscribeComponent, SecretsManagerSubscribeStandaloneComponent],
  exports: [SecretsManagerSubscribeComponent, SecretsManagerSubscribeStandaloneComponent],
})
export class SecretsManagerBillingModule {}
