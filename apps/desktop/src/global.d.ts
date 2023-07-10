declare module "forcefocus";

interface Window {
  versions: {
    node: () => string;
    chrome: () => string;
    electron: () => string;
  };
}
