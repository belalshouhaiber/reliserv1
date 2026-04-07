import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  setupFiles: ["<rootDir>/jest.env.ts"],
  globalSetup: "<rootDir>/jest.global-setup.ts",
  clearMocks: true,
  verbose: true,
};

export default config;
