# upgrade-service-kubernetes

## Create self upgrading deployments

[![Tests](https://github.com/medic/upgrade-service-kubernetes/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/medic/upgrade-service-kubernetes/actions/workflows/main.yml)

[![Tests](https://github.com/medic/upgrade-service-kubernetes/actions/workflows/e2e.yml/badge.svg?branch=master)](https://github.com/medic/upgrade-service-kubernetes/actions/workflows/e2e.yml)

This tool provides an image that you can use to upgrade your pods in your kubernetes cluster. 

## Endpoint
The default port for upgrade-service is `5008`. This can be overridden by setting the environment variable: `UPGRADE_SERVICE_PORT`
To upgrade pods, send a `POST` request to `/upgrade` endpoint for sending upgrade commands with the payload structure below.

## Payload Structure
This is the payload structure:

```
[
    {
        "containerName": "medic-api",
        "imageTag": "3.05"
    }
]
```

Multiple upgrade requests can be sent in the same payload by adding more elements to the array using the same format above.

## Security Considerations - RBAC (Roles, RoleBindings)
Role based access controls have been configured such that the upgrade-service can only manipulate deployments within the same namespace.

## Deployment
Deploy your favorite kubernetes cluster. As an example let's use k3d.

Create a cluster like this:

`k3d cluster create cht-upgrade-service --port 5008:30008@loadbalancer`

Deploying the upgrade-service:

1. Create a namespace if you don't already have one. You can also deploy to an existing namespace.

`kubectl create namespace k8s-cht-deployment`

2. Deploy the upgrade-service.

`kubectl -n k8s-cht-deployment apply -f kubernetes/`

3. Apply RBAC policies

`kubectl -n k8s-cht-deployment apply -f kubernetes/rbac`


## How to quickly see it in action

To see this in action, the quickest way is to deploy a simple pod in the same namespace. Let's use nginx to demonstrate this:

Let's deploy `nginx` with version tag 1.20 and we'll have the upgrade-service upgrade it to 1.21

1. Deploy `nginx` in the same namespace

`kubectl create deployment -n k8s-cht-deployment nginx --image=nginx:1.20`

2. Send the following curl command

```
curl -X POST -H "Content-Type: application/json" -d '[
  {
    "containerName": "nginx",
    "imageTag": "1.21"
  }
]' localhost:5008/upgrade
```

You should get the response from the server stating that upgrade succeeded.

`{"message":"Successfuly upgraded 1 containers"}`

Confirm that the nginx pod is now using image `1.21`.

## Environment Variables Overwrite Available

These don't need to be set - the kubernetes setup picks them up automatically. However, if you need to overwrite any of the environment variables for whatever reason, you can use the `config.json` file. It contains the following variables:
```
    "KUBECONFIG_DEFAULT_PATH": "",
    "CHT_DEPLOYMENT_NAME": "",
    "CHT_NAMESPACE": ""
```
It's a good idea to not change these settings unless you know what you're doing. Here's a short description of what each one of them are for.

`"KUBECONFIG_DEFAULT_PATH"`: This helps you specify where the kubeconfig file exists on disk. If this is specified, it will be taken as the default.
`"CHT_DEPLOYMENT_NAME"`: The name of the deployment you would like to use for the setup.
`"CHT_NAMESPACE"`: The name of the namespace you would like to use for the setup.
