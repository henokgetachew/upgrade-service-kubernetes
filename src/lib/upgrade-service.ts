import Environment from "./env-manager";

export default class UpgradeService {

    constructor(environment: Environment) {

    }

    getCurrentVersion(container: string): string {
        throw new Error('Not yet implemented');
    }

    upgradeContainer(container: string, newVersion: string): void {
        throw new Error('Not yet implemented');
    }

    isValidUpgrade(container: string, newVersion: string): string {
        throw new Error('Not yet implemented');
    }

    restartServices(): void {
        throw new Error('Not yet implemented');
    }

    wasUpgradeSuccessful(container: string): string {
        throw new Error('Not yet implemented');
    }

    commitNewYAMLConfigToGitHub(): boolean {
        throw new Error('Not yet implemented');
    }
}
