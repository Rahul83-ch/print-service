/**
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

        /// <inheritdoc />
        public async Task ProcessPendingJobsAsync(CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation("Checking for scheduled pending print jobs...");
                
                // Fetch pending actions
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

        /// <summary>
        /// Executes a single printer payload utilizing resilient retry mechanisms to isolate faults.
        /// </summary>
        private async Task ProcessSingleJobWithResilienceAsync(PrintJob job, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Starting execution scope for Job '{JobId}' (Target: Printer '{PrinterId}').", 
                job.JobId, job.PrinterId);

            // 1. Fetch & Verify Printer Profile
            var printer = await _printerManager.GetPrinterAsync(job.PrinterId, cancellationToken);
            if (printer == null)
            {
                var error = $"Configuration Error: Printer '{job.PrinterId}' is unrecognized or does not exist.";
                _logger.LogError(error);
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
                return;
            }

            if (!printer.IsActive)
            {
                var error = $"Device Inactive: Printer '{printer.PrinterId}' ({printer.PrinterName}) is marked offline by administrative lock.";
                _logger.LogError(error);
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
                return;
            }

            // 2. Select Appropriate Printer Connector Strategy
            var connectorName = $"{job.PrinterType}PrinterConnector";
            var connector = _connectors.FirstOrDefault(c => 
                c.GetType().Name.Equals(connectorName, StringComparison.OrdinalIgnoreCase) ||
                (job.PrinterType == PrinterType.Zebra && c.GetType().Name.Contains("Zebra"))
            );

            if (connector == null)
            {
                var error = $"Unsupported Type: No loaded adapter discovered for connector strategy '{connectorName}'.";
                _logger.LogError(error);
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
                return;
            }

            // 3. Define Polly Resilience Strategy
            // We combine short Retries (with exponential backoff) with a Circuit Breaker targeting socket failures.
            var retryPolicy = Policy
                .Handle<SocketException>()
                .Or<TimeoutException>()
                .WaitAndRetryAsync(
                    3,
                    retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    onRetry: (exception, timespan, retryCount, context) =>
                    {
                        _logger.LogWarning(exception, 
                            "Print attempt {RetryCount} failed for hardware at {IP}:{Port}. Retrying after {DelayMs}ms...",
                            retryCount, printer.IPAddress, printer.Port, timespan.TotalMilliseconds);
                    });

            var timeoutPolicy = Policy.TimeoutAsync(15); // Outright fail printer socket stream if hung over 15s

            var combinedPolicy = Policy.WrapAsync(retryPolicy, timeoutPolicy);

            try
            {
                job.Status = JobStatus.Printing;
                _logger.LogInformation("Relaying streaming payload to device {IP}:{Port} under {Strategy} mode.", 
                    printer.IPAddress, printer.Port, connector.GetType().Name);

                // Execute physical printer channel stream
                await combinedPolicy.ExecuteAsync(async (ctx) => 
                {
                    await connector.PrintAsync(job, printer, cancellationToken);
                }, new Context());

                // 4. Update Remote API on Success
                job.Status = JobStatus.Printed;
                job.ProcessedAt = DateTime.UtcNow;

                _logger.LogInformation("Job '{JobId}' printed successfully with {Copies} copy/copies. Sending confirmation...", 
                    job.JobId, job.Copies);

                await _apiClient.MarkJobCompletedAsync(job.JobId, cancellationToken);
                _logger.LogInformation("Platform successfully reconciled Job status for '{JobId}'.", job.JobId);
            }
            catch (BrokenCircuitException bce)
            {
                var error = $"Circuit Breaker Triggered: Active socket block prevents device routing. Details: {bce.Message}";
                _logger.LogError(bce, "Hardware device channel is actively suspended by local protection thresholds.");
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
            }
            catch (Exception ex)
            {
                var error = $"Communication Error: Failed to transmit TCP packets to {printer.IPAddress}:{printer.Port}. Reason: {ex.Message}";
                _logger.LogError(ex, "Physical connection error processing printer socket broadcast.");
                await SafeMarkJobFailedAsync(job.JobId, error, cancellationToken);
            }
        }

        private async Task SafeMarkJobFailedAsync(string jobId, string errorMessage, CancellationToken cancellationToken)
        {
            try
            {
                await _apiClient.MarkJobFailedAsync(jobId, errorMessage, cancellationToken);
                _logger.LogInformation("Notified server about processing failure on Job '{JobId}'.", jobId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Critically failed to post error state to server for Job '{JobId}'. Data context is stored locally.", jobId);
            }
        }
    }
}
