/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TESTING_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
