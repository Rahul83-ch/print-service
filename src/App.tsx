/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Server,
  Cpu,
  Printer as PrinterIcon,
  Terminal,
  FileCode,
  Layers,
  Sparkles,
  Play,
  RotateCcw,
  PlusCircle,
  Copy,
  Check,
  AlertTriangle,
  Info,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Folder,
  ArrowRight,
  Code2,
  Lock,
  Network
} from "lucide-react";

// Types for the simulation state
interface Printer {
  id: string;
  name: string;
  type: "Zebra" | "Brother" | "TSC" | "PDF" | "WindowsPrinter";
  ipAddress: string;
  port: number;
  isActive: boolean;
  isOnline: boolean; // physical connection state
}

interface SimulatedJob {
  id: string;
  printerId: string;
  printerType: string;
  copies: number;
  contentType: "ZPL" | "PDF" | "RAW" | "TEXT";
  printContent: string;
  submittedOn: string;
  status: "Pending" | "Printing" | "Printed" | "Failed";
  errorMessage?: string;
  logs: string[];
}

interface LogLine {
  timestamp: string;
  level: "INFO" | "WARNING" | "ERROR" | "CRITICAL" | "DEBUG";
  message: string;
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"dashboard" | "explorer" | "architecture" | "deployment">("dashboard");

  // Local printer configurations
  const [printers, setPrinters] = useState<Printer[]>([
    { id: "AHEPS-3150", name: "Epson L3150 Series (Network RAW)ASH", type: "Zebra", ipAddress: "192.168.1.150", port: 9100, isActive: true, isOnline: true },
    { id: "EPS-3150", name: "Epson L3150 Series (Network RAW)", type: "Zebra", ipAddress: "174.156.6.177", port: 9100, isActive: true, isOnline: true },
    { id: "ZBR-001", name: "Shipping Zebra ZD420", type: "Zebra", ipAddress: "192.168.1.100", port: 9100, isActive: true, isOnline: true },
    { id: "ZBR-002", name: "Warehouse Zebra ZT410", type: "Zebra", ipAddress: "192.168.1.101", port: 9100, isActive: true, isOnline: true },
    { id: "TSC-001", name: "Assembly Line TSC TTP-247", type: "TSC", ipAddress: "192.168.1.102", port: 9100, isActive: true, isOnline: false }, // Simulated offline for retry demos!
    { id: "BTH-001", name: "Office Brother PDF Logger", type: "Brother", ipAddress: "192.168.1.103", port: 9100, isActive: true, isOnline: true },
    { id: "PDF-001", name: "Virtual Windows Spooler Writer", type: "WindowsPrinter", ipAddress: "127.0.0.1", port: 9100, isActive: false, isOnline: true }, // Inactive administrative lock
  ]);

  // Simulated queue and agent activity
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(true);
  const [pollingSeconds, setPollingSeconds] = useState<number>(3); // slightly accelerated for snappy demo
  const [apiLogs, setApiLogs] = useState<LogLine[]>([
    { timestamp: getSimulatedTime(), level: "INFO", message: "====================================================================" },
    { timestamp: getSimulatedTime(), level: "INFO", message: "UniversalPrint.Agent Service starting..." },
    { timestamp: getSimulatedTime(), level: "INFO", message: "Agent ID: AGENT-001" },
    { timestamp: getSimulatedTime(), level: "INFO", message: "System Name: IND-BLR-FACTORY-01" },
    { timestamp: getSimulatedTime(), level: "INFO", message: "OS Architecture: Linux 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC" },
    { timestamp: getSimulatedTime(), level: "INFO", message: "====================================================================" },
    { timestamp: getSimulatedTime(), level: "INFO", message: "Posting registration sequence to Central Platform..." },
    { timestamp: getSimulatedTime(), level: "INFO", message: "Agent registered successfully. Received 5 matching hardware configurations." },
    { timestamp: getSimulatedTime(), level: "INFO", message: "Successfully connected and synced with system registry. Polling: 5s | Heartbeat: 60s" },
  ]);

  const [activeJobs, setActiveJobs] = useState<SimulatedJob[]>([
    {
      id: "JOB-1024",
      printerId: "ZBR-001",
      printerType: "Zebra",
      copies: 1,
      contentType: "ZPL",
      printContent: "^XA\n^FO50,55^A0N,40,40^FDPART-819A-WMS^FS\n^FO50,110^BY3\n^BCN,100,Y,N,N\n^FD819A91882^FS\n^XZ",
      submittedOn: getSimulatedTimePast(45),
      status: "Printed",
      logs: ["Job received", "Establishing TCP socket to 192.168.1.100:9100", "ZPL stream dispatched successfully"]
    },
    {
      id: "JOB-1025",
      printerId: "BTH-001",
      printerType: "Brother",
      copies: 1,
      contentType: "TEXT",
      printContent: "INVENTORY COUNT REPORT\nZone C - Row 4\nStatus: Verified\nAuditor: Ahmed",
      submittedOn: getSimulatedTimePast(10),
      status: "Failed",
      errorMessage: "Unsupported Type: No loaded adapter discovered for connector strategy 'BrotherPrinterConnector'.",
      logs: ["Job received", "Searching strategy map for BrotherPrinterConnector", "Aborted - Future placeholder only"]
    }
  ]);

  // Form states for creating new print jobs
  const [formPrinter, setFormPrinter] = useState<string>("ZBR-001");
  const [formCopies, setFormCopies] = useState<number>(1);
  const [formContent, setFormContent] = useState<string>(
    "^XA\n^FO50,60^A0N,32,32^FDINV-ITEM-90184^FS\n^FO50,110^BY2\n^BCN,70,Y,N,N\n^FD90184^FS\n^XZ"
  );
  const [formContentType, setFormContentType] = useState<"ZPL" | "PDF" | "RAW" | "TEXT">("ZPL");

  // Console layout automatic self scroll
  const consoleBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [apiLogs]);

  // Dynamic Polling clock cycle simulation
  useEffect(() => {
    if (!isAgentRunning) return;

    const interval = setInterval(() => {
      // Look for first pending job
      const pendingIndex = activeJobs.findIndex(j => j.status === "Pending");
      if (pendingIndex !== -1) {
        processSimulatedJob(pendingIndex);
      } else {
        // Log generic polling sweep
        addAgentLog("INFO", "Checking for scheduled pending print jobs... (Zero found)");
      }
    }, pollingSeconds * 1000);

    return () => clearInterval(interval);
  }, [isAgentRunning, activeJobs, pollingSeconds]);

  // Simulated heartbeat loop (every 20s in demo for visibility)
  useEffect(() => {
    if (!isAgentRunning) return;

    const interval = setInterval(() => {
      addAgentLog("DEBUG", "Transmitting telemetry ping... status: Running, machine: IND-BLR-FACTORY-01");
      addAgentLog("DEBUG", "Telemetry heartbeat transmitted successfully.");
    }, 25000);

    return () => clearInterval(interval);
  }, [isAgentRunning]);

  function getSimulatedTime(): string {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  }

  function getSimulatedTimePast(secondsAgo: number): string {
    const d = new Date(Date.now() - secondsAgo * 1000);
    return d.toTimeString().split(' ')[0];
  }

  function addAgentLog(level: "INFO" | "WARNING" | "ERROR" | "CRITICAL" | "DEBUG", message: string) {
    setApiLogs(prev => [...prev, { timestamp: getSimulatedTime(), level, message }]);
  }

  // Handle printer state changes
  const togglePrinterOnline = (id: string) => {
    setPrinters(prev => prev.map(p => {
      if (p.id === id) {
        const nextState = !p.isOnline;
        addAgentLog("WARNING", `Hardware diagnostics state update: Printer '${p.id}' (${p.name}) connection changed to ${nextState ? "ONLINE" : "OFFLINE"}`);
        return { ...p, isOnline: nextState };
      }
      return p;
    }));
  };

  const togglePrinterActive = (id: string) => {
    setPrinters(prev => prev.map(p => {
      if (p.id === id) {
        const nextState = !p.isActive;
        addAgentLog("INFO", `Administrative configuration: Printer '${p.id}' (${p.name}) lock is now ${nextState ? "ENABLED/ACTIVE" : "DISABLED/INACTIVE"}`);
        return { ...p, isActive: nextState };
      }
      return p;
    }));
  };

  // Create simulated print job
  const handleAddNewJob = (e: React.FormEvent) => {
    e.preventDefault();
    const targeted = printers.find(p => p.id === formPrinter);
    if (!targeted) return;

    const newJob: SimulatedJob = {
      id: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
      printerId: formPrinter,
      printerType: targeted.type,
      copies: formCopies,
      contentType: formContentType,
      printContent: formContent,
      submittedOn: getSimulatedTime(),
      status: "Pending",
      logs: []
    };

    setActiveJobs(prev => [newJob, ...prev]);
    addAgentLog("INFO", `Server Central queue: Scheduled Job '${newJob.id}' directed to printer '${newJob.printerId}' (${newJob.copies} cop${newJob.copies > 1 ? 'ies' : 'y'})`);
  };

  // Simulate print executing with Polly resilience
  const processSimulatedJob = async (jobIndex: number) => {
    const jobList = [...activeJobs];
    const job = jobList[jobIndex];
    const targetPrinter = printers.find(p => p.id === job.printerId);

    // Swap status to in-progress
    job.status = "Printing";
    setActiveJobs(jobList);

    addAgentLog("INFO", `Checking for scheduled pending print jobs...`);
    addAgentLog("INFO", `Discovered 1 ticket/label tasks for execution.`);
    addAgentLog("INFO", `Starting execution scope for Job '${job.id}' (Target: Printer '${job.printerId}').`);

    if (!targetPrinter) {
      const errorMsg = `Configuration Error: Printer '${job.printerId}' is unrecognized or does not exist.`;
      job.status = "Failed";
      job.errorMessage = errorMsg;
      setActiveJobs([...jobList]);
      addAgentLog("ERROR", errorMsg);
      addAgentLog("WARNING", `Transmitting failure state for Job ID '${job.id}' to Platform API.`);
      return;
    }

    if (!targetPrinter.isActive) {
      const errorMsg = `Device Inactive: Printer '${targetPrinter.id}' (${targetPrinter.name}) is marked offline by administrative lock.`;
      job.status = "Failed";
      job.errorMessage = errorMsg;
      setActiveJobs([...jobList]);
      addAgentLog("ERROR", errorMsg);
      addAgentLog("WARNING", `Transmitting failure state for Job ID '${job.id}' to Platform API.`);
      return;
    }

    // Adapt connector strategy selector
    if (job.printerType !== "Zebra") {
      let errorMsg = "";
      if (job.printerType === "WindowsPrinter" || job.printerType === "Brother" || job.printerType === "TSC" || job.printerType === "PDF") {
        errorMsg = `Unsupported Type: No loaded adapter discovered for connector strategy '${job.printerType}PrinterConnector'.`;
      } else {
        errorMsg = `Strategy missing: Connector strategy failed to load.`;
      }
      job.status = "Failed";
      job.errorMessage = errorMsg;
      setActiveJobs([...jobList]);
      addAgentLog("ERROR", errorMsg);
      addAgentLog("WARNING", `Transmitting failure state for Job ID '${job.id}' to Platform API.`);
      return;
    }

    // Zebra execution scope
    addAgentLog("INFO", `Relaying streaming payload to device ${targetPrinter.ipAddress}:${targetPrinter.port} under ZebraPrinterConnector strategy.`);

    // If Offline: Trigger Polly retry policy simulations!
    if (!targetPrinter.isOnline) {
      addAgentLog("WARNING", `Print attempt 1 failed for hardware at ${targetPrinter.ipAddress}:${targetPrinter.port}. Retrying after 2000ms (Polly Retry)...`);
      
      await delay(1200);
      addAgentLog("WARNING", `Print attempt 2 failed for hardware at ${targetPrinter.ipAddress}:${targetPrinter.port}. Retrying after 4000ms (Polly Retry)...`);
      
      await delay(1800);
      addAgentLog("WARNING", `Print attempt 3 failed for hardware at ${targetPrinter.ipAddress}:${targetPrinter.port}. Retrying after 8000ms (Polly Retry)...`);
      
      await delay(2200);
      const breakerMsg = `Communication Error: Failed to transmit TCP packets to ${targetPrinter.ipAddress}:${targetPrinter.port}. Reason: Physical connection timeouts.`;
      job.status = "Failed";
      job.errorMessage = breakerMsg;
      setActiveJobs([...jobList]);
      addAgentLog("ERROR", breakerMsg);
      addAgentLog("WARNING", `Transmitting failure state for Job ID '${job.id}' to Platform API.`);
      return;
    }

    // Success printing flow
    await delay(1400);
    addAgentLog("INFO", `TCP socket streamed successfully. Sent ${job.printContent.length} character packet.`);
    addAgentLog("INFO", `Flash buffer transmission completed successfully for Zebra Printer '${targetPrinter.id}'.`);
    addAgentLog("INFO", `Job '${job.id}' printed successfully with ${job.copies} copy/copies. Sending confirmation...`);
    addAgentLog("INFO", `Platform successfully reconciled Job status for '${job.id}'.`);

    job.status = "Printed";
    setActiveJobs([...jobList]);
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Reset demo
  const handleClearQueueAndLogs = () => {
    setActiveJobs([]);
    setApiLogs([
      { timestamp: getSimulatedTime(), level: "INFO", message: "Simulated worker memory cleared." },
      { timestamp: getSimulatedTime(), level: "INFO", message: "Polling loop active at standard frequency." }
    ]);
  };

  // Code Explorer Workspace File Database
  const [selectedLayer, setSelectedLayer] = useState<"domain" | "application" | "infrastructure" | "worker">("application");
  const [selectedFile, setSelectedFile] = useState<string>("JobProcessor.cs");
  const [copyCodeSuccess, setCopyCodeSuccess] = useState<boolean>(false);

  interface SourceFile {
    name: string;
    description: string;
    path: string;
    code: string;
  }

  const codeFiles: Record<string, Record<string, SourceFile>> = {
    domain: {
      "Printer.cs": {
        name: "Printer.cs",
        description: "Represents physical printer models mapping local state IP configurations, ports, and activity locks.",
        path: "UniversalPrint.Agent/src/Agent.Domain/Entities/Printer.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using Agent.Domain.Enums;

namespace Agent.Domain.Entities
{
    /// <summary>
    /// Represents a physically available printer configuration mapped on the customer site.
    /// </summary>
    public class Printer
    {
        public string PrinterId { get; set; } = string.Empty;
        public string PrinterName { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public string IPAddress { get; set; } = "127.0.0.1";
        public int Port { get; set; } = 9100;
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Validates that the configuration parameters are structurally correct for connection.
        /// </summary>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(PrinterId) &&
                   !string.IsNullOrWhiteSpace(IPAddress) &&
                   Port > 0 && Port <= 65535;
        }
    }
}`
      },
      "PrintJob.cs": {
        name: "PrintJob.cs",
        description: "Main entity modeling payload packages, page parameters, and statuses dispatched to target threads.",
        path: "UniversalPrint.Agent/src/Agent.Domain/Entities/PrintJob.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using Agent.Domain.Enums;

namespace Agent.Domain.Entities
{
    /// <summary>
    /// Represents an individual command sequence scheduled for physical printing.
    /// </summary>
    public class PrintJob
    {
        public string JobId { get; set; } = string.Empty;
        public string PrinterId { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public int Copies { get; set; } = 1;
        public ContentType ContentType { get; set; }
        public string PrintContent { get; set; } = string.Empty;
        public DateTime SubmittedOn { get; set; }
        public JobStatus Status { get; set; } = JobStatus.Pending;
        public string? ErrorMessage { get; set; }
        public DateTime? ProcessedAt { get; set; }
    }
}`
      },
      "Enums.cs": {
        name: "Enums.cs",
        description: "Standard domain enum structures for Printer Hardware Type, Media Content Type, and operational execution states.",
        path: "UniversalPrint.Agent/src/Agent.Domain/Enums/Enums.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

namespace Agent.Domain.Enums
{
    /// <summary>
    /// Represents the hardware manufacturers of supported printers.
    /// </summary>
    public enum PrinterType
    {
        Zebra,
        Brother,
        TSC,
        PDF,
        WindowsPrinter
    }

    /// <summary>
    /// Represents the native format/encoding of the label layout content.
    /// </summary>
    public enum ContentType
    {
        ZPL,
        PDF,
        RAW,
        TEXT
    }

    /// <summary>
    /// Represents the current lifecycle status of an assigned Print Job.
    /// </summary>
    public enum JobStatus
    {
        Pending,
        Printing,
        Printed,
        Failed
    }
}`
      }
    },
    application: {
      "JobProcessor.cs": {
        name: "JobProcessor.cs",
        description: "Orchestration service utilizing strategy-pattern device routing and Polly retry engines to safely handle network and physical failures.",
        path: "UniversalPrint.Agent/src/Agent.Application/Services/JobProcessor.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Agent.Domain.Enums;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.CircuitBreaker;

namespace Agent.Application.Services
{
    /// <summary>
    /// Executes the core clean-architecture workflow for scanning, fetching, routing, and completing localized print jobs.
    /// </summary>
    public class JobProcessor : IJobProcessor
    {
        private readonly IAgentApiClient _apiClient;
        private readonly IPrinterManager _printerManager;
        private readonly IEnumerable<IPrinterConnector> _connectors;
        private readonly ILogger<JobProcessor> _logger;

        public JobProcessor(
            IAgentApiClient apiClient,
            IPrinterManager printerManager,
            IEnumerable<IPrinterConnector> connectors,
            ILogger<JobProcessor> logger)
        {
            _apiClient = apiClient;
            _printerManager = printerManager;
            _connectors = connectors;
            _logger = logger;
        }

        public async Task ProcessPendingJobsAsync(CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation("Checking for scheduled pending print jobs...");
                var pendingDtos = await _apiClient.GetPendingJobsAsync("AGENT-001", cancellationToken);
                var jobList = pendingDtos.ToList();

                if (!jobList.Any())
                {
                    _logger.LogInformation("No pending jobs found in active queue.");
                    return;
                }

                _logger.LogInformation("Discovered {JobCount} ticket/label tasks for execution.", jobList.Count);

                foreach (var jobDto in jobList)
                {
                    if (cancellationToken.IsCancellationRequested) break;

                    var job = new PrintJob
                    {
                        JobId = jobDto.JobId,
                        PrinterId = jobDto.PrinterId,
                        PrinterType = jobDto.PrinterType,
                        Copies = jobDto.Copies,
                        ContentType = jobDto.ContentType,
                        PrintContent = jobDto.PrintContent,
                        SubmittedOn = jobDto.SubmittedOn,
                        Status = JobStatus.Pending
                    };

                    await ProcessSingleJobWithResilienceAsync(job, cancellationToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error encountered inside top-level JobPollingLoop.");
            }
        }

        private async Task ProcessSingleJobWithResilienceAsync(PrintJob job, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Starting execution scope for Job '{JobId}' (Target: Printer '{PrinterId}').", job.JobId, job.PrinterId);

            var printer = await _printerManager.GetPrinterAsync(job.PrinterId, cancellationToken);
            if (printer == null)
            {
                var error = $"Configuration Error: Printer '{job.PrinterId}' is unrecognized.";
                _logger.LogError(error);
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
                return;
            }

            if (!printer.IsActive)
            {
                var error = $"Device Inactive: Printer '{printer.PrinterId}' is marked offline by administrative lock.";
                _logger.LogError(error);
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
                return;
            }

            var connectorName = \t$"{job.PrinterType}PrinterConnector";
            var connector = _connectors.FirstOrDefault(c => 
                c.GetType().Name.Equals(connectorName, StringComparison.OrdinalIgnoreCase) ||
                (job.PrinterType == PrinterType.Zebra && c.GetType().Name.Contains("Zebra"))
            );

            if (connector == null)
            {
                var error = \t$"Unsupported Type: No loaded adapter discovered for connector strategy '{connectorName}'.";
                _logger.LogError(error);
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
                return;
            }

            // Define Polly Resilience policies combining Retry + Timeout
            var retryPolicy = Policy
                .Handle<SocketException>()
                .Or<TimeoutException>()
                .WaitAndRetryAsync(
                    3,
                    retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    onRetry: (exception, timespan, retryCount, context) =>
                    {
                        _logger.LogWarning(exception, "Print attempt {RetryCount} failed. Retrying in {DelayMs}ms...", retryCount, timespan.TotalMilliseconds);
                    });

            var timeoutPolicy = Policy.TimeoutAsync(15);
            var combinedPolicy = Policy.WrapAsync(retryPolicy, timeoutPolicy);

            try
            {
                job.Status = JobStatus.Printing;
                await combinedPolicy.ExecuteAsync(async (ctx) => 
                {
                    await connector.PrintAsync(job, printer, cancellationToken);
                }, new Context());

                job.Status = JobStatus.Printed;
                _logger.LogInformation("Job '{JobId}' printed successfully. Sending confirmation...", job.JobId);
                await _apiClient.MarkJobCompletedAsync(job.JobId, cancellationToken);
            }
            catch (Exception ex)
            {
                var error = \t$"Communication Error: Failed to transmit TCP packets to {printer.IPAddress}:{printer.Port}. Reason: {ex.Message}";
                _logger.LogError(ex, "Physical connection error processing printer socket broadcast.");
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
            }
        }

        private async Task SafeMarkJobFailedAsync(string jobId, string errorMessage, CancellationToken cancellationToken)
        {
            try
            {
                await _apiClient.MarkJobFailedAsync(jobId, errorMessage, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to post error state to server for Job '{JobId}'", jobId);
            }
        }
    }
}`
      },
      "IPrinterConnector.cs": {
        name: "IPrinterConnector.cs",
        description: "Defines the base driver boundary for print transmissions and dynamic probe validations.",
        path: "UniversalPrint.Agent/src/Agent.Application/Interfaces/IPrinterConnector.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Threading;
using System.Threading.Tasks;
using Agent.Domain.Entities;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract defining direct driverless socket or endpoint streaming to label & ticket printers.
    /// </summary>
    public interface IPrinterConnector
    {
        Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken);
        Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken);
    }
}`
      },
      "IPrinterManager.cs": {
        name: "IPrinterManager.cs",
        description: "Declared contract managing the localized active printer in-memory concurrent caches.",
        path: "UniversalPrint.Agent/src/Agent.Application/Interfaces/IPrinterManager.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Agent.Domain.Entities;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract responsible for localized hardware device discovery and caching configuration maps.
    /// </summary>
    public interface IPrinterManager
    {
        void SyncPrinters(IEnumerable<Printer> printers);
        Task<Printer?> GetPrinterAsync(string printerId, CancellationToken cancellationToken);
        Task<IDictionary<string, bool>> VerifyAllPrintersHealthAsync(CancellationToken cancellationToken);
    }
}`
      },
      "IAgentApiClient.cs": {
        name: "IAgentApiClient.cs",
        description: "The API network interface, providing full contracts for heartbeats, registration, and queue updates.",
        path: "UniversalPrint.Agent/src/Agent.Application/Interfaces/IAgentApiClient.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.DTOs;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract defining interactions with the Central Print Management System.
    /// </summary>
    public interface IAgentApiClient
    {
        Task<AgentConfigDto> RegisterAgentAsync(AgentRegistrationDto registration, CancellationToken cancellationToken);
        Task SendHeartbeatAsync(AgentHeartbeatDto heartbeat, CancellationToken cancellationToken);
        Task<IEnumerable<PrintJobDto>> GetPendingJobsAsync(string agentId, CancellationToken cancellationToken);
        Task MarkJobCompletedAsync(string jobId, CancellationToken cancellationToken);
        Task MarkJobFailedAsync(string jobId, string errorMessage, CancellationToken cancellationToken);
    }
}`
      },
      "Dtos.cs": {
        name: "Dtos.cs",
        description: "Strongly typed data transfer objects used to exchange parameters with server endpoints securely.",
        path: "UniversalPrint.Agent/src/Agent.Application/DTOs/Dtos.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Generic;
using Agent.Domain.Enums;

namespace Agent.Application.DTOs
{
    public class AgentRegistrationDto
    {
        public string AgentId { get; set; } = string.Empty;
        public string AgentName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string MachineName { get; set; } = string.Empty;
    }

    public class AgentConfigDto
    {
        public string AgentId { get; set; } = string.Empty;
        public int PollingIntervalSeconds { get; set; } = 5;
        public int HeartbeatIntervalSeconds { get; set; } = 60;
        public List<PrinterDto> AssignedPrinters { get; set; } = new();
    }

    public class PrinterDto
    {
        public string PrinterId { get; set; } = string.Empty;
        public string PrinterName { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public string IPAddress { get; set; } = "127.0.0.1";
        public int Port { get; set; } = 9100;
        public bool IsActive { get; set; } = true;
    }

    public class AgentHeartbeatDto
    {
        public string AgentId { get; set; } = string.Empty;
        public string Status { get; set; } = "Running";
        public string MachineName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
    }

    public class PrintJobDto
    {
        public string JobId { get; set; } = string.Empty;
        public string PrinterId { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public int Copies { get; set; } = 1;
        public ContentType ContentType { get; set; }
        public string PrintContent { get; set; } = string.Empty;
        public DateTime SubmittedOn { get; set; }
    }
}`
      }
    },
    infrastructure: {
      "ZebraPrinterConnector.cs": {
        name: "ZebraPrinterConnector.cs",
        description: "Implements high speed direct TCP channel writes to Zebra printers on raw label Port 9100.",
        path: "UniversalPrint.Agent/src/Agent.Infrastructure/Connectors/ZebraPrinterConnector.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;

namespace Agent.Infrastructure.Connectors
{
    /// <summary>
    /// Implements socket stream tunneling for Zebra hardware over raw TCP Port 9100.
    /// </summary>
    public class ZebraPrinterConnector : IPrinterConnector, IDisposable
    {
        private readonly Microsoft.Extensions.Logging.ILogger<ZebraPrinterConnector> _logger;

        public ZebraPrinterConnector(Microsoft.Extensions.Logging.ILogger<ZebraPrinterConnector> logger)
        {
            _logger = logger;
        }

        public async Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Streaming ZPL instructions to Zebra hardware at {IP}:{Port}", printer.IPAddress, printer.Port);

            if (string.IsNullOrWhiteSpace(job.PrintContent))
                throw new ArgumentException("Active block content is empty.");

            string finalZplPayload = string.Empty;
            for (int i = 0; i < job.Copies; i++)
            {
                finalZplPayload += job.PrintContent + Environment.NewLine;
            }

            byte[] byteBuffer = Encoding.UTF8.GetBytes(finalZplPayload);

            using var tcpClient = new TcpClient();
            await tcpClient.ConnectAsync(printer.IPAddress, printer.Port, cancellationToken);
            
            using NetworkStream networkStream = tcpClient.GetStream();
            await networkStream.WriteAsync(byteBuffer.AsMemory(0, byteBuffer.Length), cancellationToken);
            await networkStream.FlushAsync(cancellationToken);
            
            _logger.LogInformation("Flash buffer transmission completed successfully for Zebra Printer '{PrinterId}'.", printer.PrinterId);
        }

        public async Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            try
            {
                using var tcpClient = new TcpClient();
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(3));

                await tcpClient.ConnectAsync(printer.IPAddress, printer.Port, cts.Token);
                return tcpClient.Connected;
            }
            catch
            {
                return false;
            }
        }

        public void Dispose()
        {
            GC.SuppressFinalize(this);
        }
    }
}`
      },
      "FutureConnectors.cs": {
        name: "FutureConnectors.cs",
        description: "Architecture expansion points implementing Brother, TSC, PDF, and Windows printers cleanly.",
        path: "UniversalPrint.Agent/src/Agent.Infrastructure/Connectors/FutureConnectors.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Connectors
{
    public class BrotherPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<BrotherPrinterConnector> _logger;
        public BrotherPrinterConnector(ILogger<BrotherPrinterConnector> logger) => _logger = logger;

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken token)
        {
            throw new NotImplementedException("Brother thermal stream protocol is being configured. Expected Release: Q3.");
        }
        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken token) => Task.FromResult(true);
    }

    public class TscPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<TscPrinterConnector> _logger;
        public TscPrinterConnector(ILogger<TscPrinterConnector> logger) => _logger = logger;

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken token)
        {
            throw new NotImplementedException("TSC HW interface protocol is being configured. Expected Q3.");
        }
        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken token) => Task.FromResult(true);
    }

    public class PdfPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<PdfPrinterConnector> _logger;
        public PdfPrinterConnector(ILogger<PdfPrinterConnector> logger) => _logger = logger;

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken token)
        {
            throw new NotImplementedException("PDF write-to-stream compiler configured. Release: Q4.");
        }
        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken token) => Task.FromResult(true);
    }

    public class WindowsPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<WindowsPrinterConnector> _logger;
        public WindowsPrinterConnector(ILogger<WindowsPrinterConnector> logger) => _logger = logger;

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken token)
        {
            throw new NotImplementedException("Windows spool driver wrapper requires OS integration modules.");
        }
        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken token) => Task.FromResult(true);
    }
}`
      },
      "PrinterManager.cs": {
        name: "PrinterManager.cs",
        description: "ConcurrentDictionary cached device configuration hub checking connection health properties.",
        path: "UniversalPrint.Agent/src/Agent.Infrastructure/Services/PrinterManager.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Services
{
    public class PrinterManager : IPrinterManager
    {
        private readonly ConcurrentDictionary<string, Printer> _cachedPrinters;
        private readonly IEnumerable<IPrinterConnector> _connectors;
        private readonly ILogger<PrinterManager> _logger;

        public PrinterManager(IEnumerable<IPrinterConnector> connectors, ILogger<PrinterManager> logger)
        {
            _cachedPrinters = new ConcurrentDictionary<string, Printer>(StringComparer.OrdinalIgnoreCase);
            _connectors = connectors;
            _logger = logger;
        }

        public void SyncPrinters(IEnumerable<Printer> printers)
        {
            _logger.LogInformation("Refreshing local hardware registry with updated assignments...");
            var incomingIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var printer in printers)
            {
                incomingIds.Add(printer.PrinterId);
                _cachedPrinters.AddOrUpdate(printer.PrinterId, printer, (_, existing) => printer);
            }

            foreach (var existingKey in _cachedPrinters.Keys)
            {
                if (!incomingIds.Contains(existingKey))
                    _cachedPrinters.TryRemove(existingKey, out _);
            }
        }

        public Task<Printer?> GetPrinterAsync(string printerId, CancellationToken cancellationToken)
        {
            if (_cachedPrinters.TryGetValue(printerId, out var printer))
                return Task.FromResult<Printer?>(printer);
            return Task.FromResult<Printer?>(null);
        }

        public async Task<IDictionary<string, bool>> VerifyAllPrintersHealthAsync(CancellationToken cancellationToken)
        {
            var healthMap = new Dictionary<string, bool>();
            foreach (var entry in _cachedPrinters)
            {
                var printer = entry.Value;
                bool isOnline = false;
                foreach (var conn in _connectors)
                {
                    if (conn.GetType().Name.Contains(printer.PrinterType.ToString(), StringComparison.OrdinalIgnoreCase))
                    {
                        isOnline = await conn.ValidateConnectionAsync(printer, cancellationToken);
                        break;
                    }
                }
                healthMap.Add(printer.PrinterId, isOnline);
            }
            return healthMap;
        }
    }
}`
      },
      "AgentApiClient.cs": {
        name: "AgentApiClient.cs",
        description: "Typed Client connecting with credentials matching platform REST endpoints under safety wrappers.",
        path: "UniversalPrint.Agent/src/Agent.Infrastructure/Api/AgentApiClient.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.DTOs;
using Agent.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Api
{
    public class AgentApiClient : IAgentApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<AgentApiClient> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        public AgentApiClient(HttpClient httpClient, IConfiguration configuration, ILogger<AgentApiClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            
            var baseUrl = configuration["ApiSettings:BaseUrl"] ?? "https://api.universalprint.com";
            var apiKey = configuration["ApiSettings:ApiKey"];

            _httpClient.BaseAddress = new Uri(baseUrl);
            _httpClient.DefaultRequestHeaders.Accept.Clear();
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            if (!string.IsNullOrWhiteSpace(apiKey))
                _httpClient.DefaultRequestHeaders.Add("X-API-KEY", apiKey);

            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            };
        }

        public async Task<AgentConfigDto> RegisterAgentAsync(AgentRegistrationDto registration, CancellationToken cancellationToken)
        {
            var content = new StringContent(JsonSerializer.Serialize(registration, _jsonOptions), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/agents/register", content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var jsonString = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<AgentConfigDto>(jsonString, _jsonOptions)!;
        }

        public async Task SendHeartbeatAsync(AgentHeartbeatDto heartbeat, CancellationToken cancellationToken)
        {
            var content = new StringContent(JsonSerializer.Serialize(heartbeat, _jsonOptions), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync("/api/agents/heartbeat", content, cancellationToken);
            response.EnsureSuccessStatusCode();
        }

        public async Task<IEnumerable<PrintJobDto>> GetPendingJobsAsync(string agentId, CancellationToken cancellationToken)
        {
            var response = await _httpClient.GetAsync($"/api/agents/{agentId}/jobs", cancellationToken);
            response.EnsureSuccessStatusCode();

            var jsonString = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<IEnumerable<PrintJobDto>>(jsonString, _jsonOptions)!;
        }

        public async Task MarkJobCompletedAsync(string jobId, CancellationToken cancellationToken)
        {
            var response = await _httpClient.PostAsync($"/api/jobs/{jobId}/complete", null!, cancellationToken);
            response.EnsureSuccessStatusCode();
        }

        public async Task MarkJobFailedAsync(string jobId, string errorMessage, CancellationToken cancellationToken)
        {
            var payload = new { Error = errorMessage, FailedAt = DateTime.UtcNow };
            var content = new StringContent(JsonSerializer.Serialize(payload, _jsonOptions), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync($"/api/jobs/{jobId}/failed", content, cancellationToken);
            response.EnsureSuccessStatusCode();
        }
    }
}`
      }
    },
    worker: {
      "Worker.cs": {
        name: "Worker.cs",
        description: "Dual loop worker engine coordinating rapid queue schedules, telemetry pings, and thread lifecycle.",
        path: "UniversalPrint.Agent/src/Agent.Worker/Worker.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.DTOs;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Agent.Worker
{
    public class Worker : BackgroundService
    {
        private readonly IAgentApiClient _apiClient;
        private readonly IPrinterManager _printerManager;
        private readonly IJobProcessor _jobProcessor;
        private readonly IConfiguration _configuration;
        private readonly ILogger<Worker> _logger;

        private string _agentId = "AGENT-001";
        private int _pollingSeconds = 5;
        private int _heartbeatSeconds = 60;
        private bool _isRegistered = false;

        public Worker(
            IAgentApiClient apiClient,
            IPrinterManager printerManager,
            IJobProcessor jobProcessor,
            IConfiguration configuration,
            ILogger<Worker> logger)
        {
            _apiClient = apiClient;
            _printerManager = printerManager;
            _jobProcessor = jobProcessor;
            _configuration = configuration;
            _logger = logger;
            _agentId = _configuration["AgentSettings:AgentId"] ?? "AGENT-001";
        }

        public override async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("UniversalPrint.Agent Service starting on {Machine}...", Environment.MachineName);
            try
            {
                var registration = new AgentRegistrationDto
                {
                    AgentId = _agentId,
                    AgentName = _configuration["AgentSettings:AgentName"] ?? "Ahmedabad Factory Agent",
                    Version = "1.0.0",
                    MachineName = Environment.MachineName
                };

                var config = await _apiClient.RegisterAgentAsync(registration, cancellationToken);
                _pollingSeconds = config.PollingIntervalSeconds > 0 ? config.PollingIntervalSeconds : _pollingSeconds;
                _heartbeatSeconds = config.HeartbeatIntervalSeconds > 0 ? config.HeartbeatIntervalSeconds : _heartbeatSeconds;

                var domainPrinters = config.AssignedPrinters.Select(p => new Printer
                {
                    PrinterId = p.PrinterId,
                    PrinterName = p.PrinterName,
                    PrinterType = p.PrinterType,
                    IPAddress = p.IPAddress,
                    Port = p.Port,
                    IsActive = p.IsActive
                });

                _printerManager.SyncPrinters(domainPrinters);
                _isRegistered = true;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex, "FAILED initialization enrollment. Running offline.");
            }

            await base.StartAsync(cancellationToken);
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var pollingTask = RunPollingIterationLoopAsync(stoppingToken);
            var heartbeatTask = RunHeartbeatIterationLoopAsync(stoppingToken);
            await Task.WhenAll(pollingTask, heartbeatTask);
        }

        private async Task RunPollingIterationLoopAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                if (_isRegistered)
                    await _jobProcessor.ProcessPendingJobsAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(_pollingSeconds), stoppingToken);
            }
        }

        private async Task RunHeartbeatIterationLoopAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                if (_isRegistered)
                {
                    await _apiClient.SendHeartbeatAsync(new AgentHeartbeatDto
                    {
                        AgentId = _agentId,
                        Status = "Running",
                        MachineName = Environment.MachineName,
                        Version = "1.0.0"
                    }, stoppingToken);
                }
                await Task.Delay(TimeSpan.FromSeconds(_heartbeatSeconds), stoppingToken);
            }
        }
    }
}`
      },
      "Program.cs": {
        name: "Program.cs",
        description: "Master runtime program entry coordinating Microsoft Dependency DI, client factory definitions, and native Windows/Linux services integrations.",
        path: "UniversalPrint.Agent/src/Agent.Worker/Program.cs",
        code: `/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using Agent.Application.Interfaces;
using Agent.Application.Services;
using Agent.Infrastructure.Api;
using Agent.Infrastructure.Connectors;
using Agent.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Agent.Worker
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .UseWindowsService()  // Hook Windows Service Lifecycle
                .UseSystemd()         // Hook Systemd Daemon Lifecycles
                .ConfigureLogging((hostContext, loggingBuilder) =>
                {
                    loggingBuilder.ClearProviders();
                    loggingBuilder.AddConsole(options => options.TimestampFormat = "[HH:mm:ss] ");
                })
                .ConfigureServices((hostContext, services) =>
                {
                    services.AddHttpClient<IAgentApiClient, AgentApiClient>()
                        .ConfigurePrimaryHttpMessageHandler(() => new System.Net.Http.SocketsHttpHandler
                        {
                            PooledConnectionLifetime = TimeSpan.FromMinutes(2)
                        });

                    services.AddSingleton<IPrinterManager, PrinterManager>();
                    
                    services.AddTransient<IPrinterConnector, ZebraPrinterConnector>();
                    services.AddTransient<IPrinterConnector, BrotherPrinterConnector>();
                    services.AddTransient<IPrinterConnector, TscPrinterConnector>();
                    services.AddTransient<IPrinterConnector, PdfPrinterConnector>();
                    services.AddTransient<IPrinterConnector, WindowsPrinterConnector>();

                    services.AddTransient<IJobProcessor, JobProcessor>();
                    services.AddHostedService<Worker>();
                });
    }
}`
      },
      "appsettings.json": {
        name: "appsettings.json",
        description: "Application configuration profiles, holding intervals, credentials, and endpoints safely.",
        path: "UniversalPrint.Agent/src/Agent.Worker/appsettings.json",
        code: `{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.Hosting.Lifetime": "Information",
      "System.Net.Http.HttpClient": "Warning"
    }
  },
  "AgentSettings": {
    "AgentId": "AGENT-001",
    "AgentName": "Ahmedabad Factory Agent",
    "PollingIntervalSeconds": 5,
    "HeartbeatIntervalSeconds": 60
  },
  "ApiSettings": {
    "BaseUrl": "https://api.universalprint.com",
    "ApiKey": "up_sec_live_9108a73bcde02f",
    "BearerToken": ""
  }
}`
      }
    }
  };

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col text-[#172B4D] select-none text-[14px]">
      {/* Top Professional Header */}
      <header className="bg-[#FFFFFF] border-b border-[#DFE1E6] sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3" id="branding-container">
          <div className="bg-[#0052CC] text-[#FFFFFF] p-2 rounded-lg flex items-center justify-center shadow-md">
            <Cpu size={24} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#091E42] flex items-center gap-2 m-0 leading-none">
              UniversalPrint.Agent
              <span className="text-[10px] uppercase font-bold tracking-wider bg-[#FFAB00] text-[#091E42] px-2 py-0.5 rounded-full">
                v1.0.0 Stable
              </span>
            </h1>
            <p className="text-xs text-[#5E6C84] mt-1 mb-0 font-normal">
              Enterprise .NET 8 Worker Service • Microservice Connection Portals
            </p>
          </div>
        </div>

        {/* Navigation Controls */}
        <div className="flex items-center space-x-1" id="tab-controls">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 rounded-md font-medium text-[13px] transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-[#0052CC] text-white border-[#0052CC] shadow-sm font-semibold"
                : "bg-white text-[#42526E] border-transparent hover:bg-[#EEF1F6] hover:text-[#091E42]"
            }`}
          >
            <Terminal size={15} />
            Live Simulator
          </button>
          <button
            onClick={() => {
              setActiveTab("explorer");
              setSelectedLayer("application");
              setSelectedFile("JobProcessor.cs");
            }}
            className={`px-4 py-2 rounded-md font-medium text-[13px] transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "explorer"
                ? "bg-[#0052CC] text-white border-[#0052CC] shadow-sm font-semibold"
                : "bg-white text-[#42526E] border-transparent hover:bg-[#EEF1F6] hover:text-[#091E42]"
            }`}
          >
            <Folder size={15} />
            Workspace Browser
          </button>
          <button
            onClick={() => setActiveTab("architecture")}
            className={`px-4 py-2 rounded-md font-medium text-[13px] transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "architecture"
                ? "bg-[#0052CC] text-white border-[#0052CC] shadow-sm font-semibold"
                : "bg-white text-[#42526E] border-transparent hover:bg-[#EEF1F6] hover:text-[#091E42]"
            }`}
          >
            <Layers size={15} />
            Clean Blueprint
          </button>
          <button
            onClick={() => setActiveTab("deployment")}
            className={`px-4 py-2 rounded-md font-medium text-[13px] transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === "deployment"
                ? "bg-[#0052CC] text-white border-[#0052CC] shadow-sm font-semibold"
                : "bg-white text-[#42526E] border-transparent hover:bg-[#EEF1F6] hover:text-[#091E42]"
            }`}
          >
            <Network size={15} />
            Sysadmin Operations
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-6">

        {/* Dashboard Frame */}
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
            {/* Left: Printer Registry and Action dispatching */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Controller Box */}
              <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-5 shadow-sm" id="agent-controller">
                <h3 className="text-base font-semibold text-[#091E42] mb-3 flex items-center gap-2">
                  <Cpu size={18} className="text-[#0052CC]" /> Agent Deployment States
                </h3>
                
                <div className="flex items-center justify-between py-2 border-b border-[#F4F5F7] text-[13px]">
                  <span className="text-[#5E6C84]">Local Agent ID</span>
                  <span className="font-mono font-bold text-[#091E42]">AGENT-001</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#F4F5F7] text-[13px]">
                  <span className="text-[#5E6C84]">Enrollment Registry</span>
                  <span className="font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck size={14} /> REGISTERED
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-[#F4F5F7] text-[13px]">
                  <span className="text-[#5E6C84]">Heartbeat Telemetry</span>
                  <span className="font-normal text-[#172B4D]">Every 60s (Live)</span>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#5E6C84] font-medium">DAEMON DAQ ENGINE</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAgentRunning ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {isAgentRunning ? "ACTIVE SWEEP" : "PAUSED"}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => {
                        setIsAgentRunning(!isAgentRunning);
                        addAgentLog("WARNING", isAgentRunning ? "Executing diagnostic suspend. Background poll paused." : "Resuming generic system scheduler loop.");
                      }}
                      className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold cursor-pointer transition-colors text-center ${
                        isAgentRunning 
                          ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200" 
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      }`}
                    >
                      {isAgentRunning ? "Pause Operations" : "Resume Operations"}
                    </button>
                    <button
                      disabled={!isAgentRunning}
                      onClick={() => {
                        addAgentLog("INFO", "Performing rapid user-triggered synchronization diagnostic check...");
                        addAgentLog("INFO", "RegisterAgentAsync POST dispatched.");
                        addAgentLog("INFO", "Synchronized 5 printers in-memory registry.");
                      }}
                      className="px-3 py-1.5 bg-[#F4F5F7] border border-[#DFE1E6] rounded text-xs font-semibold hover:bg-[#EAE6FF] text-[#42526E] hover:text-[#0052CC] cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw size={14} className="inline mr-1" /> Sync
                    </button>
                  </div>
                </div>

                {/* Simulation speed configuration */}
                <div className="mt-4 pt-3 border-t border-[#DFE1E6]">
                  <label className="text-xs text-[#5E6C84] font-medium block mb-1">Poll Rate: {pollingSeconds} Seconds</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={pollingSeconds}
                    onChange={(e) => setPollingSeconds(Number(e.target.value))}
                    className="w-full accent-[#0052CC]"
                  />
                  <span className="text-[11px] text-[#5E6C84] block mt-0.5">Speed up to inspect prompt job dispatching.</span>
                </div>
              </div>

              {/* Physical Devices Registry */}
              <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-[#091E42] m-0 flex items-center gap-2">
                    <PrinterIcon size={18} className="text-[#0052CC]" /> Connected Devices
                  </h3>
                  <span className="text-xs bg-[#F4F5F7] px-2 py-0.5 rounded border border-[#DFE1E6] font-mono font-bold text-[#5E6C84]">5 Total</span>
                </div>

                <p className="text-xs text-[#5E6C84] mb-3 font-normal leading-relaxed">
                  Toggle <span className="font-semibold text-[#FFAB00]">Network State</span> below to simulate offline socket drops and trigger Polly connection retries!
                </p>

                <div className="flex flex-col gap-2 division-y select-none">
                  {printers.map((prn) => (
                    <div key={prn.id} className="p-3 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6] flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-xs text-[#091E42] m-0 flex items-center gap-1.5">
                            {prn.name}
                            <span className="text-[9px] px-1.5 bg-[#0052CC]/10 text-[#0052CC] py-0.2 rounded uppercase font-bold">
                              {prn.type === "WindowsPrinter" ? "Spool" : prn.type}
                            </span>
                          </h4>
                          <span className="text-[11px] text-[#5E6C84] font-mono font-medium block mt-0.5">
                            {prn.ipAddress}:{prn.port}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            prn.isActive ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-800"
                          }`}>
                            {prn.isActive ? "Active Admin" : "Locked Admin"}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1.5 mt-1 border-t border-[#DFE1E6]/60 pt-2 bg-transparent">
                        <button
                          onClick={() => togglePrinterOnline(prn.id)}
                          className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-all border cursor-pointer text-center ${
                            prn.isOnline 
                              ? "bg-[#DFE1E6] text-[#42526E] border-transparent hover:bg-rose-50 hover:text-rose-700 hover:border-rose-100" 
                              : "bg-[#FFAB00] text-[#091E42] border-[#FFAB00] hover:bg-[#FFAB00]/80"
                          }`}
                        >
                          {prn.isOnline ? "Simulate Offline" : "Restore Online"}
                        </button>
                        <button
                          onClick={() => togglePrinterActive(prn.id)}
                          className={`px-2 py-1 rounded text-[11px] font-semibold transition-all border cursor-pointer ${
                            prn.isActive 
                              ? "bg-white text-[#42526E] border-[#DFE1E6] hover:bg-neutral-100" 
                              : "bg-[#0052CC] text-white border-[#0052CC] hover:bg-[#0747A6]"
                          }`}
                        >
                          {prn.isActive ? "Lock Lock" : "Unlock User"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Middle/Right: Interactive Console Output & Print Dispatcher */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Print Dispatch form */}
              <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[#091E42] mb-3 flex items-center gap-2">
                  <PlusCircle size={18} className="text-[#0052CC]" /> Trigger Centralized Print Command
                </h3>
                
                <form onSubmit={handleAddNewJob} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <label className="text-xs text-[#5E6C84] font-semibold uppercase block mb-1">Target Device</label>
                    <select
                      value={formPrinter}
                      onChange={(e) => setFormPrinter(e.target.value)}
                      className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0052CC] cursor-pointer"
                    >
                      {printers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.isActive ? (p.isOnline ? "Online" : "Offline") : "Locked"})</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-[#5E6C84] font-semibold uppercase block mb-1">Copies</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formCopies}
                      onChange={(e) => setFormCopies(Number(e.target.value))}
                      className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded px-3 py-2 text-xs focus:outline-none focus:border-[#0052CC]"
                    />
                  </div>

                  <div className="md:col-span-5">
                    <label className="text-xs text-[#5E6C84] font-semibold uppercase block mb-1">Transceiver Format</label>
                    <div className="flex space-x-2">
                      {(["ZPL", "TEXT", "RAW", "PDF"] as const).map(fmt => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => {
                            setFormContentType(fmt);
                            if (fmt === "ZPL") {
                              setFormContent("^XA\n^FO50,60^A0N,32,32^FDINV-ITEM-90184^FS\n^FO50,110^BY2\n^BCN,70,Y,N,N\n^FD90184^FS\n^XZ");
                            } else {
                              setFormContent("RAW TEXT STREAM PAYLOAD\n======================\nQUANTITY: 15 UNITS\nPART ID: B-918-X");
                            }
                          }}
                          className={`flex-1 py-1 cursor-pointer text-center text-xs font-semibold rounded border transition-all ${
                            formContentType === fmt
                              ? "bg-[#0052CC] text-white border-[#0052CC]"
                              : "bg-[#F4F5F7] text-[#42526E] border-[#DFE1E6] hover:bg-[#EEF1F6]"
                          }`}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-12">
                    <label className="text-xs text-[#5E6C84] font-semibold uppercase block mb-1">Buffered Script Payload</label>
                    <textarea
                      rows={3}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      className="w-full bg-[#F4F5F7] border border-[#DFE1E6] rounded font-mono p-3 text-xs focus:outline-none focus:border-[#0052CC] text-[#091E42]"
                    />
                  </div>

                  <div className="md:col-span-12 flex justify-end">
                    <button
                      type="submit"
                      className="bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-semibold px-4 py-2 rounded flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <PlusCircle size={15} /> Queue Remote Print Job
                    </button>
                  </div>
                </form>
              </div>

              {/* Dynamic Console */}
              <div className="bg-[#091E42] rounded-xl border border-[#DFE1E6] p-4 flex flex-col shadow-lg flex-1 min-h-[350px]">
                <div className="flex items-center justify-between border-b border-[#172B4D]/60 pb-3 mb-3 select-none">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></span>
                    </div>
                    <span className="font-mono text-xs font-medium text-[#DFE1E6] pl-2 flex items-center gap-1">
                      <Terminal size={14} className="text-[#0052CC]" /> Ahmedabad_Factory_Server : UniversalPrint.Agent
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-[#5E6C84]">Structured Logger [Console]</span>
                    <button
                      onClick={handleClearQueueAndLogs}
                      className="px-2 py-0.5 bg-[#42526E]/40 hover:bg-[#42526E]/80 text-[#DFE1E6] text-[10px] font-semibold rounded transition-colors cursor-pointer border border-[#172B4D]"
                    >
                      Purge Output
                    </button>
                  </div>
                </div>

                <div className="flex-1 font-mono text-xs text-[#DFE1E6] overflow-y-auto max-h-[300px] flex flex-col gap-1 pr-1 bg-[#0747A6]/5 p-2 rounded border border-[#172B4D]/40">
                  {apiLogs.map((log, i) => {
                    let levelColor = "text-[#DFE1E6]";
                    if (log.level === "WARNING") {
                      levelColor = "text-[#FFAB00]";
                    } else if (log.level === "ERROR" || log.level === "CRITICAL") {
                      levelColor = "text-rose-400 font-bold";
                    } else if (log.level === "DEBUG") {
                      levelColor = "text-sky-300";
                    } else if (log.level === "INFO" && log.message.startsWith("=")) {
                      levelColor = "text-[#42526E]";
                    }
                    return (
                      <div key={i} className="flex gap-2 leading-relaxed whitespace-pre-wrap select-text">
                        <span className="text-[#5E6C84] shrink-0 font-medium">[{log.timestamp}]</span>
                        <span className={`shrink-0 font-bold uppercase text-[11px] tracking-wide ${levelColor}`}>
                          {log.level}
                        </span>
                        <span className="text-[#DFE1E6] font-normal font-sans text-[13px]">{log.message}</span>
                      </div>
                    );
                  })}
                  <div ref={consoleBottomRef} />
                </div>
              </div>

              {/* Status and Job queue tracker */}
              <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[#091E42] mb-4 flex items-center gap-2">
                  <Layers size={18} className="text-[#0052CC]" /> Central Cloud Queue Transceiver Logs
                </h3>

                {activeJobs.length === 0 ? (
                  <div className="text-center py-6 text-[#5E6C84] bg-[#F4F5F7] rounded-lg border border-dashed border-[#DFE1E6] text-xs">
                    No historic dispatcher records loaded. Create a test job above to trigger active tracing!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#DFE1E6] text-[11px] text-[#5E6C84] uppercase tracking-wider font-semibold">
                          <th className="py-2">Job Identifier</th>
                          <th className="py-2">Selected Printer</th>
                          <th className="py-2">Payload Type</th>
                          <th className="py-2">Media Copies</th>
                          <th className="py-2">Time Triggered</th>
                          <th className="py-2 text-right">Job Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#DFE1E6]/40 text-xs">
                        {activeJobs.map((j) => (
                          <React.Fragment key={j.id}>
                            <tr className="hover:bg-[#F4F5F7]/40">
                              <td className="py-2.5 font-bold text-[#091E42]">{j.id}</td>
                              <td className="py-2.5 font-medium text-[#172B4D]">
                                {j.printerId} <span className="text-[10px] text-[#5E6C84]">({j.printerType})</span>
                              </td>
                              <td className="py-2.5 font-mono text-[#5E6C84]">{j.contentType}</td>
                              <td className="py-2.5 font-medium text-[#172B4D]">{j.copies}</td>
                              <td className="py-2.5 font-mono text-[#5E6C84]">{j.submittedOn}</td>
                              <td className="py-2.5 text-right">
                                <span className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] ${
                                  j.status === "Printed" ? "bg-emerald-100 text-emerald-800" :
                                  j.status === "Pending" ? "bg-[#FFAB00]/10 text-[#D0421B] border border-[#FFAB00]/30" :
                                  j.status === "Printing" ? "bg-sky-100 text-sky-800 animate-pulse" :
                                  "bg-rose-100 text-rose-800"
                                }`}>
                                  {j.status}
                                </span>
                              </td>
                            </tr>
                            {j.errorMessage && (
                              <tr className="bg-rose-50/50">
                                <td colSpan={6} className="py-2 px-3 text-xs text-rose-700 border-l-2 border-rose-500">
                                  <div className="flex items-center gap-1 font-sans">
                                    <AlertTriangle size={14} className="shrink-0 text-rose-500" />
                                    <span className="font-semibold select-text">Diagnostics Code Context:</span>
                                    <p className="m-0 select-text text-rose-900">{j.errorMessage}</p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Code Explorer Workspace Frame */}
        {activeTab === "explorer" && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 bg-white border border-[#DFE1E6] rounded-xl overflow-hidden p-0 shadow-sm">
            {/* Sidebar of Files */}
            <div className="md:col-span-3 border-r border-[#DFE1E6] flex flex-col bg-[#F4F5F7]/30 h-full">
              <div className="p-4 border-b border-[#DFE1E6] bg-white">
                <span className="text-xs text-[#5E6C84] uppercase font-bold tracking-wider block mb-2">Layers of Clean Architecture</span>
                <div className="flex flex-col gap-1">
                  {(["worker", "application", "infrastructure", "domain"] as const).map(lay => (
                    <button
                      key={lay}
                      onClick={() => {
                        setSelectedLayer(lay);
                        const firstFile = Object.keys(codeFiles[lay])[0];
                        setSelectedFile(firstFile);
                      }}
                      className={`w-full py-2 px-3 rounded-md text-left text-xs font-semibold flex items-center justify-between cursor-pointer transition-all ${
                        selectedLayer === lay
                          ? "bg-[#0052CC] text-white shadow-sm"
                          : "bg-white text-[#42526E] hover:bg-[#EEF1F6] border border-[#DFE1E6]/70"
                      }`}
                    >
                      <span className="capitalize">{lay} Layer</span>
                      <ChevronRight size={13} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Core sub files list */}
              <div className="p-4 flex-1">
                <span className="text-xs text-[#5E6C84] uppercase font-bold tracking-wider block mb-2">Workspace Source Files</span>
                <div className="flex flex-col gap-1.5">
                  {Object.keys(codeFiles[selectedLayer]).map(fKey => {
                    const active = selectedFile === fKey;
                    return (
                      <button
                        key={fKey}
                        onClick={() => setSelectedFile(fKey)}
                        className={`w-full text-left p-2.5 rounded text-xs transition-all border cursor-pointer ${
                          active
                            ? "bg-[#EAE6FF] text-[#0052CC] border-[#0052CC] font-semibold"
                            : "bg-white/80 hover:bg-neutral-100/60 text-[#172B4D] border-transparent"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <FileCode size={14} className={active ? "text-[#0052CC]" : "text-[#5E6C84]"} />
                          <span className="font-mono truncate">{fKey}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Code viewing panel */}
            <div className="md:col-span-9 flex flex-col h-full bg-[#FFFFFF]">
              {/* File Title Bar */}
              <div className="p-4 border-b border-[#DFE1E6] bg-[#F4F5F7]/30 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <Folder size={18} className="text-[#0052CC]" />
                  <div>
                    <h4 className="font-mono text-xs font-bold text-[#091E42] m-0">
                      {codeFiles[selectedLayer][selectedFile].path}
                    </h4>
                    <p className="text-xs text-[#5E6C84] m-0 mt-0.5 font-normal leading-normal select-text">
                      {codeFiles[selectedLayer][selectedFile].description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleCopyCode(codeFiles[selectedLayer][selectedFile].code)}
                    className="px-3 py-1.5 bg-[#0052CC] text-white hover:bg-[#0747A6] rounded text-xs font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    {copyCodeSuccess ? <Check size={14} /> : <Copy size={14} />}
                    {copyCodeSuccess ? "Copied" : "Copy Source"}
                  </button>
                </div>
              </div>

              {/* Code viewer pane */}
              <div className="flex-1 p-4 overflow-auto bg-[#091E42] text-white font-mono text-xs select-text leading-relaxed">
                <pre className="m-0 whitespace-pre text-[12px]">{codeFiles[selectedLayer][selectedFile].code}</pre>
              </div>
              <div className="p-3.5 bg-[#F4F5F7] border-t border-[#DFE1E6] text-xs text-[#5E6C84] font-normal flex items-center justify-between">
                <span>All physical files are pre-loaded inside workspace folder <code>/UniversalPrint.Agent/</code></span>
                <span className="font-semibold text-[#0052CC]">.NET 8 SDK Stack Compatible</span>
              </div>
            </div>
          </div>
        )}

        {/* Clean Blueprint Tab */}
        {activeTab === "architecture" && (
          <div className="flex flex-col gap-6">
            <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#091E42] mb-3 flex items-center gap-2">
                <Layers size={20} className="text-[#0052CC]" /> Clean Architecture & SOLID Design Principles
              </h3>
              <p className="text-xs text-[#5E6C84] mb-4 font-normal leading-relaxed select-text">
                UniversalPrint.Agent is engineered adhering strictly to <strong>Clean Architecture</strong>. 
                Business logic resides within core isolated projects (Domain and Application) that maintain 
                zero dependencies on external frameworks, databases, or drivers. Platform integrations (infrastructure clients, 
                physical sockets) reside exclusively in outer abstraction adapters (Infrastructure and Worker).
              </p>

              {/* Clean Architecture Diagram */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-4">
                <div className="bg-rose-50 hover:bg-rose-100/50 p-4 rounded-xl border border-rose-200 text-center transition-all">
                  <span className="text-[10px] bg-rose-200 text-rose-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-max mx-auto mb-2">Layer 1</span>
                  <h4 className="font-semibold text-[#091E42] m-0 text-sm">Agent.Domain</h4>
                  <p className="text-[11px] text-[#5E6C84] mt-2 font-normal leading-normal">
                    Strictly isolated models carrying zero framework code. Contains raw entities (<code>Printer</code>, <code>PrintJob</code>) and enums (<code>PrinterType</code>, <code>ContentType</code>).
                  </p>
                </div>

                <div className="bg-sky-50 hover:bg-sky-100/50 p-4 rounded-xl border border-sky-200 text-center transition-all">
                  <span className="text-[10px] bg-sky-200 text-sky-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-max mx-auto mb-2">Layer 2</span>
                  <h4 className="font-semibold text-[#091E42] m-0 text-sm">Agent.Application</h4>
                  <p className="text-[11px] text-[#5E6C84] mt-2 font-normal leading-normal">
                    Our core logic orchestrator. Declares transfer patterns (DTOs) and routes tasks to strategies via interface boundaries (<code>IPrinterConnector</code>, <code>IJobProcessor</code>).
                  </p>
                </div>

                <div className="bg-amber-50 hover:bg-amber-100/50 p-4 rounded-xl border border-amber-200 text-center transition-all">
                  <span className="text-[10px] bg-amber-200 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-max mx-auto mb-2">Layer 3</span>
                  <h4 className="font-semibold text-[#091E42] m-0 text-sm">Agent.Infrastructure</h4>
                  <p className="text-[11px] text-[#5E6C84] mt-2 font-normal leading-normal">
                    Implements outer adapters. Powers raw socket writes (<code>ZebraPrinterConnector</code>) and establishes Http pooling clients to contact central servers.
                  </p>
                </div>

                <div className="bg-purple-50 hover:bg-purple-100/50 p-4 rounded-xl border border-purple-200 text-center transition-all">
                  <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider block w-max mx-auto mb-2">Layer 4</span>
                  <h4 className="font-semibold text-[#091E42] m-0 text-sm">Agent.Worker</h4>
                  <p className="text-[11px] text-[#5E6C84] mt-2 font-normal leading-normal">
                    Application entry. Mounts background worker threads (<code>Worker : BackgroundService</code>) and hooks cross platform host runners.
                  </p>
                </div>
              </div>
            </div>

            {/* SOLID & Resilience break down */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[#091E42] mb-3 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600" /> Pattern Implementations
                </h3>
                <div className="space-y-3 text-xs leading-relaxed font-normal">
                  <div>
                    <h4 className="font-semibold text-[#091E42] block m-0">Strategy Pattern (IPrinterConnector)</h4>
                    <span className="text-[#5E6C84]">
                      Decouples label generation vendors. The application core registers <code>IEnumerable&lt;IPrinterConnector&gt;</code>. Introducing Brother or TSC hardware later is accomplished by deploying isolated classes without modifying worker loops.
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#091E42] block m-0">Dependency Inversion Principle (DIP)</h4>
                    <span className="text-[#5E6C84]">
                      High-level modules (Application) never depend on low-level modules (Infrastructure endpoints). Instead, both depend on interfaces. All physical layers are linked securely during Generic Host boot inside <code>Program.cs</code>.
                    </span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#091E42] block m-0">Single Responsibility Principle (SRP)</h4>
                    <span className="text-[#5E6C84]">
                      Our worker daemon is strictly limited to lifecycle signals (loop intervals and heartbeats). Heavy actions like TCP socket transmission and endpoint validation are dispatched into separate infrastructure adapters.
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FFFFFF] rounded-xl border border-[#DFE1E6] p-5 shadow-sm">
                <h3 className="text-base font-semibold text-[#091E42] mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-[#FFAB00]" /> Polly Resilience Architecture
                </h3>
                <p className="text-xs text-[#5E6C84] mb-3 font-normal leading-relaxed select-text">
                  Intermittent local network disruptions must never crash customer print agents. UniversalPrint.Agent leverages 
                  <strong> Polly</strong> to encapsulate communication blocks within safe executive policies:
                </p>
                <div className="space-y-3 text-xs leading-relaxed font-normal">
                  <div className="flex gap-2.5 items-start">
                    <span className="text-[10px] bg-[#FFAB00]/20 text-[#091E42] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">RETRY</span>
                    <span className="text-[#5E6C84]">
                      <strong>Exponential Backoff:</strong> Automatically retries 3 times when encounter socket drops (<code>SocketException</code>. Delay intervals double dynamically on each sequential failure (2s, 4s, 8s).
                    </span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <span className="text-[10px] bg-[#FFAB00]/20 text-[#091E42] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5">TIMEOUT</span>
                    <span className="text-[#5E6C84]">
                      <strong>Thread Safety:</strong> Implements a strict 15-second operation boundary. If a remote printer hangs during direct transmission, Polly terminates the communication thread, preserving thread availability.
                    </span>
                  </div>
                  <div className="flex gap-2.5 items-start">
                    <span className="text-[10px] bg-[#FFAB00]/20 text-[#091E42] px-2 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 mt-0.5 font-sans">BREAKER</span>
                    <span className="text-[#5E6C84]">
                      <strong>Circuit Breaker:</strong> Suspends transmission attempts to offline devices if threshold failures are breached. This isolates failing units, letting the agent process unaffected printing paths.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sysadmin Operations Tab */}
        {activeTab === "deployment" && (
          <div className="bg-white rounded-xl border border-[#DFE1E6] p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#091E42] mb-3 flex items-center gap-2">
              <Network size={20} className="text-[#0052CC]" /> Sysadmin Operations & Cross-Platform Deployment
            </h3>
            <p className="text-xs text-[#5E6C84] mb-4 font-normal leading-relaxed select-text">
              The agent compiled artifact is platform-agnostic, targeting <strong>.NET 8.0 Runtime Only</strong>. 
              It incorporates zero Windows-specific libraries allowing frictionless installs as Linux Daemons or container units.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 select-text">
              <div className="p-4 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6]">
                <h4 className="font-semibold text-[#091E42] text-xs uppercase tracking-wider block mb-2">1. Windows Service Install</h4>
                <p className="text-[11px] text-[#5E6C84] mb-3 leading-relaxed">
                  Utilizes <code>Microsoft.Extensions.Hosting.WindowsServices</code> which auto-binds to system service controllers. Set up command:
                </p>
                <div className="bg-[#091E42] p-2.5 rounded font-mono text-[11px] text-[#DFE1E6] leading-normal select-text">
                  sc.exe create UniversalPrintAgent binPath= "C:\Apps\Agent.Worker.exe" start= auto
                </div>
              </div>

              <div className="p-4 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6]">
                <h4 className="font-semibold text-[#091E42] text-xs uppercase tracking-wider block mb-2">2. Linux Systemd Unit</h4>
                <p className="text-[11px] text-[#5E6C84] mb-3 leading-relaxed">
                  Utilizes <code>Microsoft.Extensions.Hosting.Systemd</code> which handles system restart signals. Setup configurations:
                </p>
                <div className="bg-[#091E42] p-2.5 rounded font-mono text-[11px] text-[#DFE1E6] leading-normal select-text">
                  {`[Unit]
Description=UniversalPrint Agent

[Service]
Type=notify
ExecStart=/usr/bin/dotnet Agent.Worker.dll
Restart=always

[Install]
WantedBy=multi-user.target`}
                </div>
              </div>

              <div className="p-4 bg-[#F4F5F7] rounded-lg border border-[#DFE1E6]">
                <h4 className="font-semibold text-[#091E42] text-xs uppercase tracking-wider block mb-2">3. Docker Container Deployment</h4>
                <p className="text-[11px] text-[#5E6C84] mb-3 leading-relaxed">
                  Easily packaged inside lightweight alpine container pods on local branch computers:
                </p>
                <div className="bg-[#091E42] p-2.5 rounded font-mono text-[11px] text-[#DFE1E6] leading-normal select-text">
                  {`FROM mcr.microsoft.com/dotnet/runtime:8.0-alpine
WORKDIR /app
COPY publish/ .
ENTRYPOINT ["dotnet", "Agent.Worker.dll"]`}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Corporate compliant simple footer */}
      <footer className="bg-white border-t border-[#DFE1E6] p-4 text-center text-xs text-[#5E6C84] font-normal select-none">
        UniversalPrint.Agent Hub Portal • Built with strict adherence to Clean Architecture, SOLID, and Enterprise standards.
      </footer>
    </div>
  );
}
