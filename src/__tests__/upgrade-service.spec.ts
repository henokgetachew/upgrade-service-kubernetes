import { IUpgradeMessage } from "../lib/upgrade-message";
import { runCommand } from "../utils/command-exec";
import UpgradeService from '../lib/upgrade-service';
import { k8s_deployment_name, tempNamespace } from "../resources/test-constants";


beforeAll(async () => {
    await runCommand(`kubectl -n ${tempNamespace} apply -f src/resources/busybox.yaml`, 'Creating a busybox deployment');
    await runCommand(`sleep 2`, 'Waiting a few seconds...');
});

describe('Upgrade Service', () => {
    it('Should upgrade deployment', async () => {
        const upgradeMessageArray: IUpgradeMessage[] = [{containerName: 'busybox', imageTag: '1.35'}];

        const upgradeService = new UpgradeService(upgradeMessageArray, tempNamespace, k8s_deployment_name );
        await upgradeService.upgradeDeployment();
        
        const result = await upgradeService.getCurrentVersion('busybox');
        
        expect(result).toContain('1.35');

    });
});
