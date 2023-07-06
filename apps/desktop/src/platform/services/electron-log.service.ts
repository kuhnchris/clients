import { LogLevelType } from "@bitwarden/common/enums";
import { ConsoleLogService as BaseLogService } from "@bitwarden/common/platform/services/console-log.service";

import { isDev } from "../../utils";

export class ElectronLogService extends BaseLogService {
  constructor(protected filter: (level: LogLevelType) => boolean = null, logDir: string = null) {
    super(isDev(), filter);
  }

  write(level: LogLevelType, message: string) {
    if (this.filter != null && this.filter(level)) {
      return;
    }
  }
}
