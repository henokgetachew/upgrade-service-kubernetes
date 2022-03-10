import Environment from '../lib/env-manager';
import fs from 'fs';

describe('env-manager', () => {
    it('Default upgrade service port is 5008', () => {
        expect(Environment.getUpgradeServicePort()).toBe('5008');
    });

    it('Default upgrade service port can be overridden', () => {
        process.env.UPGRADE_SERVICE_PORT = '6000';
        expect(Environment.getUpgradeServicePort()).toBe('6000');
    });

    it('Can take namespace from env var', () => {
        process.env.CHT_NAMESPACE = 'test-namespace';
        expect(Environment.getNamespace()).toBe('test-namespace');
    });

    it('Can take namespace from config', () => {
        process.env.CHT_NAMESPACE = '';

        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((): string => {
            const content = {
                KUBECONFIG_DEFAULT_PATH: '/Users/henok/.kube/config',
                CHT_DEPLOYMENT_NAME: 'test',
                CHT_NAMESPACE: 'test'
            };
            return JSON.stringify(content);
        });

        expect(Environment.getNamespace()).toBe('test');
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Can take namespace from cluster', () => {
        process.env.CHT_NAMESPACE = '';

        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return true;
        });

        const spyLocalConfig = jest.spyOn(Environment, 'localConfig').mockImplementation(() => {
            return {
                'KUBECONFIG_DEFAULT_PATH': '',
                'CHT_DEPLOYMENT_NAME': '',
                'CHT_NAMESPACE': ''
            };
        });

        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((): string => {
            return 'test-cluster-namespace';
        });

        expect(Environment.getNamespace()).toBe('test-cluster-namespace');
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('/var/run/secrets/kubernetes.io/serviceaccount/namespace');
    });

    it('Throws error when namespace not found', () => {
        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return false;
        });
        process.env.CHT_NAMESPACE = '';

        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((): string => {
            const content = {
                KUBECONFIG_DEFAULT_PATH: '/Users/henok/.kube/config',
                CHT_DEPLOYMENT_NAME: '',
                CHT_NAMESPACE: ''
            };
            return JSON.stringify(content);
        });

        let errMsg = undefined;
        try {
            Environment.getNamespace();
        } catch (err) {
            errMsg = err;
        }

        expect(errMsg).toBeDefined();
    });

    it('Throws error when namespace file missing in cluster', () => {
        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return true;
        });
        process.env.CHT_NAMESPACE = '';

        const spyLocalConfig = jest.spyOn(Environment, 'localConfig').mockImplementation(() => {
            return {
                'KUBECONFIG_DEFAULT_PATH': '',
                'CHT_DEPLOYMENT_NAME': '',
                'CHT_NAMESPACE': ''
            };
        });


        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spy = jest.spyOn(fs, 'readFileSync').mockImplementation((): any => {
            throw new Error('File not found!');
        });

        let errMsg = undefined;
        let namespace = undefined;
        try {
            namespace = Environment.getNamespace();
        } catch (err) {
            errMsg = err;
        }

        expect(namespace).toBeUndefined();
        expect(errMsg).toBeDefined();
    });

    it('Determines if running within a cluster', () => {
        const spyFS = jest.spyOn(fs, 'existsSync').mockImplementation((thePath): boolean => (true));
        expect(Environment.runningWithinCluster()).toBe(true);
        expect(spyFS).toHaveBeenCalledTimes(1);
        expect(spyFS).toHaveBeenCalledWith('/var/run/secrets/kubernetes.io/serviceaccount/token');
    });

    it('Determines if running within test automation', () => {
        expect(Environment.runningWithinTestAutomation()).toBe(true);
    });

    it('Reads CHT Deployment name from env variable', () => {
        process.env.CHT_DEPLOYMENT_NAME = 'TheDeployment';
        expect(Environment.getDeploymentName()).toBe('TheDeployment');
    });

    it('Takes CHT Deployment name from config', () => {
        process.env.CHT_DEPLOYMENT_NAME = '';
        const spyLocalConfig = jest.spyOn(Environment, 'localConfig').mockImplementation(() => {
            return {
                'KUBECONFIG_DEFAULT_PATH': '',
                'CHT_DEPLOYMENT_NAME': 'On-hey-there',
                'CHT_NAMESPACE': ''
            };
        });

        expect(Environment.getDeploymentName()).toBe('On-hey-there');
    });

    it('Throws an error when deployment name not found', () => {
        process.env.CHT_DEPLOYMENT_NAME = '';
        const spyLocalConfig = jest.spyOn(Environment, 'localConfig').mockImplementation(() => {
            return {
                'KUBECONFIG_DEFAULT_PATH': '',
                'CHT_DEPLOYMENT_NAME': '',
                'CHT_NAMESPACE': ''
            };
        });

        let errMsg = undefined;
        let deploymentName = undefined;
        try {
            deploymentName = Environment.getDeploymentName();
        } catch (err) {
            errMsg = err;
        }

        expect(deploymentName).toBeUndefined();
        expect(errMsg).toBeDefined();
    });

    it('Throws an error when looking for path when running within cluster', () => {
        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return true;
        });

        let errMsg = undefined;
        try {
            Environment.getKubeConfigPath();
        } catch (err) {
            errMsg = err;
        }

        expect(errMsg).toBeDefined();
    });

    it('Correctly returns kubeconfig in test automation', () => {
        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return false;
        });

        expect(Environment.getKubeConfigPath()).toContain('.kube/config');
    });

    it('Correctly obtains kubeconfig from env var', () => {
        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return false;
        });

        const spyTestAutomation = jest.spyOn(Environment, 'runningWithinTestAutomation').mockImplementation(() => {
            return false;
        });

        process.env.KUBECONFIG = 'a-test-config-path';

        expect(Environment.getKubeConfigPath()).toBe('a-test-config-path');
    });

    it('Throws error when kubeconfig path not found', () => {
        const spyRunningWithinCluster = jest.spyOn(Environment, 'runningWithinCluster').mockImplementation(() => {
            return false;
        });

        const spyTestAutomation = jest.spyOn(Environment, 'runningWithinTestAutomation').mockImplementation(() => {
            return false;
        });

        process.env.KUBECONFIG = '';

        const spyLocalConfig = jest.spyOn(Environment, 'localConfig').mockImplementation(() => {
            return {
                'KUBECONFIG_DEFAULT_PATH': '',
                'CHT_DEPLOYMENT_NAME': '',
                'CHT_NAMESPACE': ''
            };
        });

        let errMsg = undefined;
        try {
            Environment.getKubeConfigPath();
        } catch (err) {
            errMsg = err;
        }

        expect(errMsg).toBeDefined();
    });

    it('LocalConfig returns null when there is a JSON parsing issue', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const spy = jest.spyOn(JSON, 'parse').mockImplementation((): any => {
            throw new Error('JSON Parsing Error');
        });

        expect(Environment.localConfig()).toBeNull;
    });
});
