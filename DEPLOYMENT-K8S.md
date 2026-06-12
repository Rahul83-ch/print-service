# Production Deployment Guide: Docker & Kubernetes (K8s)

This comprehensive guide outlines the step-by-step procedures for packaging, containerizing, testing, and deploying the **UniversalPrint Portal Visual Dashboard (React)** and the **UniversalPrint.Agent Background Worker (.NET 8)** to an enterprise Kubernetes infrastructure.

---

## 🏢 Architectural Blueprint

The application is decomposed into two decoupled, containerized services:

1. **Printer Portal Frontend (React / Vite)**:
   - **Type**: Client-side Single Page Application (SPA).
   - **Hosting**: Packaged inside a lightweight **Nginx Alpine** image optimized with custom SPA rewrite rules, static file caching, and Gzip compression.
   - **Kubernetes Component**: Deployed as a scalable `Deployment` exposed inside the cluster via a `ClusterIP Service` and made accessible externally through an `Ingress` controller.

2. **UniversalPrint.Agent (.NET 8 Worker)**:
   - **Type**: Clean Architecture .NET 8 background daemon.
   - **Behavior**: An event-driven pull-client that registers with a central server, heartbeat-reports, and polls for pending jobs.
   - **Kubernetes Component**: Deployed as an independent `Deployment` controlled by environment variables from `ConfigMaps` and `Secrets`. Since it accesses endpoints via outbound pull requests, it **requires no open ingress ports or cluster Services**.

---

## 🛠️ Step 1: Local Development with Docker Compose

To test the multi-component architecture on a single machine, we provided a `/docker-compose.yml` manifest at the workspace root folder.

### Run Local Orchestration
Execute the following commands from your terminal workspace root:

```bash
# Build custom images and boot both of the services concurrently
docker compose up --build -d

# Check that containers are active and running stably
docker compose ps
```

### Accessing the Portals
1. **Frontend Dashboard**: Open your web browser at [http://localhost:3000](http://localhost:3000) to access the interactive virtual hardware simulators and diagnostic logs.
2. **Agent Console Trace Logs**: Audit how the .NET worker syncs with the default central server:
   ```bash
   docker compose logs -f print-agent
   ```

### Stopping the Services
```bash
docker compose down
```

---

## 📦 Step 2: Bulding and Pushing Production Images

Before deploying to the Kubernetes cluster, compile the Docker images and push them to your target remote container registry (e.g., **Docker Hub**, **Google Artifact Registry (GAR)**, or **Azure Container Registry (ACR)**).

Set your registry namespace variable in your console terminal:
```bash
export REGISTRY="yourregistry"  # e.g. "docker.io/vaibhavshah68" or "asia-east1-docker.pkg.dev/project-id/repo"
```

### 1. Parent React Portal Dashboard Image
```bash
# Build the React production static package image
docker build -t $REGISTRY/printer-portal-frontend:v1.0.0 -f Dockerfile .

# Authenticate onto your registry (if not already logged in)
docker login

# Upload the frontend static server binary image
docker push $REGISTRY/printer-portal-frontend:v1.0.0
```

### 2. .NET 8 Background Worker Service Agent Image
```bash
# Build the Clean Architecture .NET container
docker build -t $REGISTRY/printer-agent-worker:v1.0.0 -f UniversalPrint.Agent/Dockerfile ./UniversalPrint.Agent

# Upload the daemon execution image
docker push $REGISTRY/printer-agent-worker:v1.0.0
```

---

## ☸️ Step 3: Deployment to Kubernetes (K8s)

We provided high-quality Kubernetes configurations inside the `/kubernetes/` directory, compatible with any CNCF-compliant cluster such as **Minikube**, **GKE**, **EKS**, **AKS**, or **K3s**.

### Project File Structure Map
- `namespace.yaml`: Clusters-level segregation of memory, cpu, and storage.
- `frontend-deployment.yaml`: Visual dashboard replica sets and liveness configurations.
- `frontend-service.yaml`: Low-latency domestic cluster routing endpoints.
- `agent-configmap.yaml`: High-visibility key-value environment settings.
- `agent-secret.yaml`: Multi-tenant client secret storage.
- `agent-deployment.yaml`: Pull worker instances pulling print tickets.
- `ingress.yaml`: Ingress layer to route external domains.
- `kustomization.yaml`: Kustomize configuration manager.

---

### Step-by-Step Kubernetes Deployment

#### 1. Setup Namespace & Configuration
```bash
# Move to kubernetes directory
cd kubernetes

# Create the primary 'universal-print' namespace
kubectl apply -f namespace.yaml
```

#### 2. Edit Image References in Deployments
Open files `/kubernetes/frontend-deployment.yaml` and `/kubernetes/agent-deployment.yaml` and update the `image` lines to match your remote repository URI (the value of `$REGISTRY` configured in Step 2):

- **Frontend Deployment**:
  ```yaml
  image: yourregistry/printer-portal-frontend:v1.0.0
  ```
- **Agent Worker Deployment**:
  ```yaml
  image: yourregistry/printer-agent-worker:v1.0.0
  ```

#### 3. Set Up Custom API Secrets
Open `/kubernetes/agent-secret.yaml` and customize the private API tokens to establish authentication security:
```yaml
stringData:
  ApiSettings__ApiKey: "up_sec_live_example_key_here"
  ApiSettings__BearerToken: "example_jwt_token_here"
```
*(Kubernetes `stringData` automatically translates plain strings to base64 encrypted structures!)*

#### 4. Deploy Resources Using Kustomize (Highly Recommended)
We provided a complete `kustomization.yaml` manifest that allows deploying all files atomically following their logical dependencies:

```bash
# Execute Kustomize to apply all resources at once
kubectl apply -k .
```

*Alternative Deployment method (Manual standard sequential load):*
```bash
kubectl apply -f namespace.yaml
kubectl apply -f agent-configmap.yaml
kubectl apply -f agent-secret.yaml
kubectl apply -f frontend-service.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f agent-deployment.yaml
kubectl apply -f ingress.yaml
```

---

## 🔍 Step 4: Verification & Troubleshooting

Once applied, verify cluster execution using standard diagnostics commands.

### 1. Monitor Cluster Resources
```bash
# Check statuses of your pods (ensure they progress to 'Running' stable states)
kubectl get pods -n universal-print -w

# Inspect exposed deployment services
kubectl get svc -n universal-print

# Check ingress binding rules and addresses
kubectl get ingress -n universal-print
```

### 2. Verify Client-Daemon Logs (Print Poll Logs)
Inspect the active polling loops from the C# service:
```bash
kubectl logs deployment/printer-agent-worker -n universal-print -f
```

### 3. Verify Frontend Portal Nginx Logs
Ensure web routing packets are serving properly:
```bash
kubectl logs deployment/printer-portal-frontend -n universal-print -f
```

### 4. Direct Node Port Forwarding (Local Validation Bypass)
If you don't have an Ingress controller set up yet (e.g. on bare Minikube), test access immediately by forwarding port `80` to browser port `8080`:
```bash
kubectl port-forward svc/printer-portal-frontend-service 8080:80 -n universal-print
```
Visit [http://localhost:8080](http://localhost:8080) in your host browser to test your deployment successfully!
