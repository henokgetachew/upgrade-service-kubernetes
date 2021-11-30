import Environment from "../lib/env-manager";
import fs from "fs";

describe('env-manager', () => {
    it('Default upgrade service port is 5008', () => {
        expect(Environment.getUpgradeServicePort()).toBe(5008);
    });

    it('Default upgrade service port can be overridden', () => {
        process.env.UPGRADE_SERVICE_PORT = '6000';
        expect(Environment.getUpgradeServicePort()).toBe('6000');
    });

    it('Can take namespace from env var', () => {
        process.env.CHT_NAMESPACE = 'test-namespace';
        expect(Environment.getNamespace()).toBe('test-namespace');

        // please add more tests around getNamespace when:
        // - process.env has a namespace
        // - defaulting from config
        // - neither and not running in a cluster
        // - neither and running in a cluster and the namespace file exists
        // - neither and running in a cluster and the namespace file doesn't exist

        // please add assertions about which fs endpoints are being called and which what parameters
    });

    it('Determines if running within a cluster', () => {
        fs.existsSync = jest.fn(() => true);
        expect(Environment.runningWithinCluster()).toBe(true);
        // please add assertions about which fs endpoints are being called and which what parameters
        // please add a test when the file doesn't exist
    });

    it('Determines if running within test automation', () => {
        expect(Environment.runningWithinTestAutomation()).toBe(true);
    });

    it('Reads CHT Deployment name from env variable', () => {
        process.env.CHT_DEPLOYMENT_NAME = 'TheDeployment';
        expect(Environment.getDeploymentName()).toBe('TheDeployment');

        // please add a test where the name is taken from config and the config exists
        // please add a test where the name is taken from config and the config doesn't exist
    });

    // please add tests for getKubeConfigPath
    // - when running in a cluster
    // - when running in test automation
    // - when neither for all 3 cases (env variable, config and config missing)
});
