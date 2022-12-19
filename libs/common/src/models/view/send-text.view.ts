import { DeepJsonify } from "../../types/deep-jsonify";
import { SendText } from "../domain/send-text";

import { View } from "./view";

export class SendTextView implements View {
  text: string = null;
  hidden: boolean;

  constructor(t?: SendText) {
    if (!t) {
      return;
    }

    this.hidden = t.hidden;
  }

  get maskedText(): string {
    return this.text != null ? "••••••••" : null;
  }

  static fromJSON(json: DeepJsonify<SendTextView>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendTextView(), json);
  }
}
