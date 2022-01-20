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
    });

    it('Determines if running within a cluster', () => {
        fs.existsSync = jest.fn(() => true);
        expect(Environment.runningWithinCluster()).toBe(true);
    });

    it('Determines if running within test automation', () => {
        expect(Environment.runningWithinTestAutomation()).toBe(true);
    });

    it('Reads CHT Deployment name from env variable', () => {
        process.env.CHT_DEPLOYMENT_NAME = 'TheDeployment';
        expect(Environment.getDeploymentName()).toBe('TheDeployment');
    });

});
