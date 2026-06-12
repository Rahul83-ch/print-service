# Local Connection & Testing Guide: Samsung M2060 Series (192.168.1.50)

This guide outlines step-by-step instructions for configuring and testing the **UniversalPrint.Agent** in a local network environment. It covers custom network setups for your **Samsung M2060 Series** printer, simulated API structures, and explicit Postman request payloads.

---

## 1. Network & Printer Overview

Your **Samsung M2060 Series printer (192.168.1.50)** supports network printing. Like standard network printers, it listens on **TCP Port 9100** (sometimes referred to as HP JetDirect, RAW, or Socket printing).

### Dynamic Architecture Adaptation
Because the agent uses a **Strategy Pattern** via `IPrinterConnector`, it matches printer profiles received from the Central API. While Samsung office printers do not interpret thermal "ZPL" (Zebra programming language), they accept raw plain text or PCL patterns over **Port 9100** in `TEXT` or `RAW` format.

To target your Samsung printer using the implemented TCP socket stream, configure it in your database or mock API responses with:
* **PrinterType**: `Zebra` (to trigger raw TCP/IP socket stream bypass)
* **IPAddress**: `192.168.1.50`
* **Port**: `9100`
* **ContentType**: `TEXT` or `RAW`

---

## 2. Configuration Adjustments

Before starting the agent locally, update its settings file (`appsettings.json`) to register it under your specific site constraints and verify it points to your local mock API endpoints or Postman mock servers.

### Edit File: `/src/Agent.Worker/appsettings.json`

Ensure your host parameters match your target API or local testing server:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information",
      "System.Net.Http.HttpClient": "Warning"
    }
  },
  "AgentSettings": {
    "AgentId": "AGENT-001",
    "AgentName": "Samsung Network Test Agent",
    "PollingIntervalSeconds": 5,
    "HeartbeatIntervalSeconds": 60
  },
  "ApiSettings": {
    "BaseUrl": "http://localhost:5000", // Change this to your Mock API URL (or Postman Mock Server)
    "ApiKey": "up_sec_test_90184b238c9"  // Included in 'X-API-KEY' header
  }
}
```

---

## 3. Postman Mock API Setup

The agent behaves as a **client**. When it boots or loops, it sends requests *to* the Central Print Management platform (the Server). Therefore, to test the agent locally using Postman, you should configure a **Postman Mock Server** (or a local Node/ASP.NET backend) to return the appropriate JSON responses.

### 1. Mock API Endpoint Rules

Configure your mock server endpoints to return the exact payloads the Agent expects.

| Endpoint | HTTP Method | Agent's Purpose | Expected Mock Payload |
| :--- | :--- | :--- | :--- |
| `/api/agents/register` | `POST` | Agent registration & printer sync on boot | **Dynamic Registry Payload** (Registers the printer `192.168.1.50`) |
| `/api/agents/heartbeat` | `POST` | Continuous keep-alive reporting (60s) | `200 OK` (No parameters needed) |
| `/api/agents/{agentId}/jobs` | `GET` | High-frequency pending job checking (5s) | **Print Job Queue Payload** (Serves print jobs for the printer) |
| `/api/jobs/{jobId}/complete` | `POST` | Reconciles successful prints | `200 OK` (Indicates print job success) |
| `/api/jobs/{jobId}/failed` | `POST` | Reports network/hardware printer issues | `200 OK` (Accepts detailed trace info) |

---

## 4. Postman Request & Response Payloads

Import or build these exact request schemes inside Postman to act as the server backend.

### A. Endpoint `/api/agents/register` (POST)
When the worker starts, it posts its hardware and network identity. Your Mock Server should reply by handing down the allocated printer list.

* **Expected Request Content-Type**: `application/json`
* **Agent's Request Payload**:
```json
{
  "agentId": "AGENT-001",
  "agentName": "Samsung Network Test Agent",
  "version": "1.0.0",
  "machineName": "IND-BLR-DEV-M2060"
}
```

* **Your Postman Mock Response Configuration (Return `200 OK`)**:
This tells your local agent that **Samsung M2060 Series** is assigned under the ID `SMSG-M2060` at static address `192.168.1.50:9100`.
```json
{
  "agentId": "AGENT-001",
  "pollingIntervalSeconds": 5,
  "heartbeatIntervalSeconds": 60,
  "assignedPrinters": [
    {
      "printerId": "SMSG-M2060",
      "printerName": "Samsung M2060 Series Local Office",
      "printerType": "Zebra",
      "ipAddress": "192.168.1.50",
      "port": 9100,
      "isActive": true
    }
  ]
}
```

---

### B. Endpoint `/api/agents/{agentId}/jobs` (GET)
Every 5 seconds, the Agent targets this endpoint to retrieve pending prints.

* **Your Postman Mock Response Configuration (Return `200 OK`)**:
During tests, you can switch this response between an empty array `[]` (idle status) or return a live print job to send a command straight to your Samsung printer.

#### 1. Idle Response (No pending jobs):
```json
[]
```

#### 2. Active Print Response (Sends content to printer):
Configure this payload in your Mock endpoint when you want to execute a physical print test. This wraps plain text standard format content designed to execute a paper feed on your network printer over TCP Port 9100.
```json
[
  {
    "jobId": "JOB-91024",
    "printerId": "SMSG-M2060",
    "printerType": "Zebra",
    "copies": 1,
    "contentType": "TEXT",
    "printContent": "===========================================\r\n   UNIVERSAL PRINT AGENT LOCAL NETWORK TEST\r\n===========================================\r\nHello from Clean Architecture .NET 8 Service!\r\n\r\nTarget Hardware  : Samsung M2060\r\nTarget Device IP : 192.168.1.50:9100\r\nTest Status      : PASS\r\nTime Recorded    : 2026-06-09T11:45:00Z\r\n===========================================\r\n\r\n\r\n\r\n",
    "submittedOn": "2026-06-09T11:40:02Z"
  }
]
```

---

### C. Endpoint `/api/jobs/{jobId}/complete` (POST)
When the local agent finishes feeding TCP packets to the Samsung hardware, it executes a completion update.

* **Agent's Request Payload**:
No body payload is transmitted. The server matches on ID, registering status inside database traces.
* **Your Postman Mock Response Configuration**:
Return `200 OK` or `204 No Content`.

---

### D. Endpoint `/api/jobs/{jobId}/failed` (POST)
If your printer is offline, disconnected, or unpowered on the network, the agent executes comprehensive Polly retries before raising a failure sequence.

* **Agent's Request Payload**:
Contains the detailed raw string trace detailing exactly why the printing attempt failed.
```json
{
  "error": "Communication Error: Failed to transmit TCP packets to 192.168.1.50:9100. Reason: Host unreachable or timeout.",
  "failedAt": "2026-06-09T11:46:12Z"
}
```
* **Your Postman Mock Response Configuration**:
Return `200 OK` or `204 No Content`.

---

## 5. Local Execution Verification

1. **Verify Network Connectivity**: Make sure the machine executing the Agent can ping `192.168.1.50` on the network.
2. **Launch Mock Server**: Set up the endpoints listed above in Postman (using **Postman Mock Servers** with public mock URLs) or a quick Node mock script.
3. **Configure Settings**: Update the `appsettings.json` `BaseUrl` with your Postman Mock Address (e.g., `https://mock.postman.co/your-mock-id`).
4. **Compile and Run**:
```bash
# Navigate to Worker folder
cd UniversalPrint.Agent/src/Agent.Worker

# Run the .NET 8 worker service
dotnet run
```

### Expected Output Console Logs:
When the agent starts and executes his polling intervals against your Mock APIs, the console prints structured traces:

```text
[11:50:24] [INFO] UniversalPrint.Agent Service starting...
[11:50:24] [INFO] Agent ID: AGENT-001
[11:50:24] [INFO] System Name: WORKSTATION-X
[11:50:25] [INFO] Posting registration sequence to Central Platform...
[11:50:25] [INFO] Agent registered successfully. Received 1 matching hardware configurations.
[11:50:25] [INFO] Successfully connected and synced with system registry. Polling: 5s | Heartbeat: 60s
[11:50:30] [INFO] Checking for scheduled pending print jobs...
[11:50:30] [INFO] Discovered 1 ticket/label tasks for execution.
[11:50:30] [INFO] Starting execution scope for Job 'JOB-91024' (Target: Printer 'SMSG-M2060').
[11:50:30] [INFO] Relaying streaming payload to device 192.168.1.50:9100 under ZebraPrinterConnector strategy.
[11:50:31] [INFO] Flash buffer transmission completed successfully for Zebra Printer 'SMSG-M2060'.
[11:50:31] [INFO] Job 'JOB-91024' printed successfully with 1 copy/copies. Sending confirmation...
```
