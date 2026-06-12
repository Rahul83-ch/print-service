/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';

const app = express();
const PORT = 5000;

app.use(express.json());

// In-memory job store
let pendingJobs = [];
let completedJobs = [];
let failedJobs = [];

// Helper to reset / initialize job queue
function initializeTestJob() {
  pendingJobs = [
    {
      jobId: "JOB-91024",
      printerId: "AHEPS-3150",
      printerType: "Zebra",
      copies: 1,
      contentType: "TEXT",
      printContent: "===========================================\r\n   UNIVERSAL PRINT AGENT LOCAL NETWORK TEST\r\n===========================================\r\nHello from Clean Architecture .NET 8 Service!\r\n\r\nTarget Hardware  : Samsung M2060\r\nTarget Device IP : 192.168.1.50:9100\r\nTest Status      : PASS\r\nTime Recorded    : " + new Date().toISOString() + "\r\n===========================================\r\n\r\n\r\n\r\n",
      submittedOn: new Date().toISOString()
    }
  ];
  console.log(`[Mock Server] Queued initial print job: JOB-91024`);
}

// Queue initial job on startup so it runs on first worker connection
// initializeTestJob();

// 1. Agent Registration
app.post('/api/agents/register', (req, res) => {
  console.log(`[Mock Server] POST /api/agents/register received from:`, req.body);
  
  // const response = {
  //   agentId: req.body.agentId || "AGENT-001",
  //   pollingIntervalSeconds: 5,
  //   heartbeatIntervalSeconds: 60,
  //   assignedPrinters: [
  //     {
  //       printerId: "SMSG-M2060",
  //       printerName: "Samsung M2060 Series Local Office",
  //       printerType: "Zebra",
  //       ipAddress: "192.168.1.50",
  //       port: 9100,
  //       isActive: true
  //     }
  //   ]
  // };

  const response = {
    agentId: req.body.agentId || "EPS-3150",
    pollingIntervalSeconds: 5,
    heartbeatIntervalSeconds: 60,
    assignedPrinters: [
      {
        printerId: "AHEPS-3150",
        printerName: "Epson L3150 Series (Network RAW)ASH",
        printerType: "Zebra",
        ipAddress: "192.168.1.150",
        port: 9100,
        isActive: true,
        isOnline: true 
      }
    ]
  };
  
  res.json(response);
});

// 2. Heartbeat Ping
app.post('/api/agents/heartbeat', (req, res) => {
  console.log(`[Mock Server] POST /api/agents/heartbeat received:`, req.body);
  res.sendStatus(200);
});

// 3. Poll pending jobs
app.get('/api/agents/:agentId/jobs', (req, res) => {
  console.log(`[Mock Server] GET /api/agents/${req.params.agentId}/jobs polled.`);
  
  // Return pending jobs, then clear the queue so the same job is not fetched repeatedly
  const jobsToDispatch = [...pendingJobs];
  pendingJobs = []; // Clear queue
  
  if (jobsToDispatch.length > 0) {
    console.log(`[Mock Server] Dispatching ${jobsToDispatch.length} job(s) to agent:`, jobsToDispatch.map(j => j.jobId));
  }
  
  res.json(jobsToDispatch);
});

// 4. Mark Job Completed
app.post('/api/jobs/:jobId/complete', (req, res) => {
  const jobId = req.params.jobId;
  console.log(`[Mock Server] POST /api/jobs/${jobId}/complete - Job successfully printed!`);
  completedJobs.push({ jobId, completedAt: new Date() });
  res.sendStatus(200);
});

// 5. Mark Job Failed
app.post('/api/jobs/:jobId/failed', (req, res) => {
  const jobId = req.params.jobId;
  console.log(`[Mock Server] POST /api/jobs/${jobId}/failed - Job printing failed! Details:`, req.body);
  failedJobs.push({ jobId, failedAt: new Date(), error: req.body });
  res.sendStatus(200);
});

// 6. Trigger custom job (via browser or curl)
app.get('/trigger', (req, res) => {
  initializeTestJob();
  res.send(`<h1>Job Triggered!</h1><p>Queued print job JOB-91024 targeting Samsung M2060 Series (192.168.1.50:9100).</p><p>Go to the Agent console to see it print.</p>`);
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===================================================`);
  console.log(` Mock API Server running on http://174.156.5.161:${PORT}`);
  console.log(` - Registration:  POST http://174.156.5.161:${PORT}/api/agents/register`);
  console.log(` - Heartbeat:     POST http://174.156.5.161:${PORT}/api/agents/heartbeat`);
  console.log(` - Polling Jobs:  GET  http://174.156.5.161:${PORT}/api/agents/:agentId/jobs`);
  console.log(` - Trigger Job:   GET  http://174.156.5.161:${PORT}/trigger`);
  console.log(`===================================================`);
});
