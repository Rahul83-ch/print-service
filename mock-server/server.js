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

  // pendingJobs = [
  //   {
  //     jobId: "JOB-91024",
  //     printerId: "TVS3150",
  //     printerType: "Zebra",
  //     copies: 1,
  //     contentType: "TEXT",
  //     printContent: "===========================================\r\n   UNIVERSAL PRINT AGENT LOCAL NETWORK TEST\r\n===========================================\r\nHello from Clean Architecture .NET 8 Service!\r\n\r\nTarget Hardware  : Samsung M2060\r\nTarget Device IP : 192.168.1.50:9100\r\nTest Status      : PASS\r\nTime Recorded    : " + new Date().toISOString() + "\r\n===========================================\r\n\r\n\r\n\r\n",
  //     submittedOn: new Date().toISOString()
  //   }
  // ];
  
  // pendingJobs = [
  //   {
  //     jobId: "JOB-91024",
  //     printerId: "TVS3150",
  //     printerType: "ESC_POS",
  //     copies: 1,
  //     contentType: "ESC_POS",
  //     encoding:  "BASE64",
  //     printContent: "G0AbYQEdaDwddwMdSAAdawAxMjM0NTY3ODkwMTIAChtKUA==",
  //     submittedOn: new Date().toISOString()
  //   }
  // ];
    pendingJobs = [
    {
      jobId: "JOB-91024",
      printerId: "TVS3150",
      printerType: "WindowsPrinter",
      copies: 1,
      contentType: "PDF",
      encoding:  "BASE64",
      printContent: "JVBERi0xLjQKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCAxMDggMzYgXSAvUGFyZW50IDYgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyA2IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKNSAwIG9iago8PAovQXV0aG9yIChcKGFub255bW91c1wpKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwNjE2MTQyMDAzKzAwJzAwJykgL0NyZWF0b3IgKFwodW5zcGVjaWZpZWRcKSkgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwNjE2MTQyMDAzKzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKFwodW5zcGVjaWZpZWRcKSkgL1RpdGxlIChcKGFub255bW91c1wpKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNDIKPj4Kc3RyZWFtCkdhcHBVNFVRZywoZSI2YWBLVyoyRUNBO1dfOG5yUHIwXEswInAsUzFyZTk1XitVaCUhXVFsbldASS8rQT4yYVdQUXBWZnBVXXBCVS1oaGNdT1lxLnRDLmY+L2o2YzNPXlBDL1cqRyYmSGlJPV82YTpDSDMhcmo2SVpeTy9kb1JYLzI1JD9mPWFUcm9Afj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDM5MSAwMDAwMCBuIAowMDAwMDAwNDU5IDAwMDAwIG4gCjAwMDAwMDA3MzkgMDAwMDAgbiAKMDAwMDAwMDc5OCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzw4NTE4ZGQyZmU3OTUxNGExZDQ5YWM4MDI5NDEwMTJjYz48ODUxOGRkMmZlNzk1MTRhMWQ0OWFjODAyOTQxMDEyY2M+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDUgMCBSCi9Sb290IDQgMCBSCi9TaXplIDgKPj4Kc3RhcnR4cmVmCjEwMzAKJSVFT0YK",
      submittedOn: new Date().toISOString()
    }
  ];

  //   pendingJobs = [
  //   {
  //     jobId: "JOB-91024",
  //     printerId: "TVS3150",
  //     printerType: "ESC_POS",
  //     copies: 1,
  //     contentType: "ZPL",
  //     encoding:  "NONE",
  //     printContent: "^XA\n^FO50,60^A0N,32,32^FDORDER-ITEM-90184^FS\n^FO50,110^BY2\n^BCN,70,Y,N,N\n^FD90184^FS\n^XZ",
  //     submittedOn: new Date().toISOString()
  //   }
  // ];
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

  // const response = {
  //   agentId: req.body.agentId || "TVS3150",
  //   pollingIntervalSeconds: 5,
  //   heartbeatIntervalSeconds: 60,
  //   assignedPrinters: [
  //     {
  //       printerId: "TVS3150",
  //       printerName: "TVS Electronics RP3150 STAR",
  //       type : "ESC_POS",
  //       ipAddress: "174.156.5.161",
  //       port: 9100,
  //       isActive: true,
  //       // isOnline: true 
  //     }
  //   ]
  // };

  const response = {
    agentId: req.body.agentId || "TVS3150",
    pollingIntervalSeconds: 5,
    heartbeatIntervalSeconds: 60,
    assignedPrinters: [
      {
        printerId: "TVS3150",
        printerName: "TVS Electronics RP3150 STAR",
        type : "WindowsPrinter",
        ipAddress: "174.156.6.177",//"174.156.5.178",
        port: 9100,
        isActive: true,
        // isOnline: true 
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
