import config from '../../config.json';

export default class Environment {
    constructor() {

    }

    getDeploymentName(): string {
        return process.env.CHT_DEPLOYMENT_NAME || config.CHT_DEPLOYMENT_NAME;
    }

    getNamespace(): string {
        return process.env.CHT_NAMESPACE || config.CHT_NAMESPACE_NAME;
    }

}
