import config from '../../config.json';

export default class Environment {
    constructor() {

    }

    static getDeploymentName(): string {
        return process.env.CHT_DEPLOYMENT_NAME || config.CHT_DEPLOYMENT_NAME;
    }

    static getNamespace(): string {
        return process.env.CHT_NAMESPACE || config.CHT_NAMESPACE_NAME;
    }

    static getKubeConfigPath(): string {
        return process.env.KUBECONFIG || config.KUBECONFIG_DEFAULT_PATH;
    }
}
