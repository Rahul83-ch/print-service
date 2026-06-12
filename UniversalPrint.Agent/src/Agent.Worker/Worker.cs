/**
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
    /// <summary>
    /// Core Background Service managing agent lifecycle orchestration, telemetry pings, and high-frequency print-queue polling.
    /// </summary>
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

            // Bind configuration properties with safe fallbacks
            _agentId = _configuration["AgentSettings:AgentId"] ?? "AGENT-001";
            _pollingSeconds = int.TryParse(_configuration["AgentSettings:PollingIntervalSeconds"], out var ps) ? ps : 5;
            _heartbeatSeconds = int.TryParse(_configuration["AgentSettings:HeartbeatIntervalSeconds"], out var hs) ? hs : 60;
        }

        /// <summary>
        /// On startup execution path context, performing machine enrollment before entering multi-task worker loops.
        /// </summary>
        public override async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("====================================================================");
            _logger.LogInformation("UniversalPrint.Agent Service starting...");
            _logger.LogInformation("Agent ID: {AgentId}", _agentId);
            _logger.LogInformation("System Name: {MachineName}", Environment.MachineName);
            _logger.LogInformation("OS Architecture: {OS}", Environment.OSVersion);
            _logger.LogInformation("====================================================================");

            try
            {
                // Register Agent with the Central Platform
                var registration = new AgentRegistrationDto
                {
                    AgentId = _agentId,
                    AgentName = _configuration["AgentSettings:AgentName"] ?? "Ahmedabad Factory Agent",
                    Version = "1.0.0",
                    MachineName = Environment.MachineName
                };

                var config = await _apiClient.RegisterAgentAsync(registration, cancellationToken);
                
                // Read configuration adjustments returned from the cloud registry
                _pollingSeconds = config.PollingIntervalSeconds > 0 ? config.PollingIntervalSeconds : _pollingSeconds;
                _heartbeatSeconds = config.HeartbeatIntervalSeconds > 0 ? config.HeartbeatIntervalSeconds : _heartbeatSeconds;

                // Bind assigned printers
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

                _logger.LogInformation("Successfully connected and synced with system registry. Polling: {Poll}s | Heartbeat: {Heart}s", 
                    _pollingSeconds, _heartbeatSeconds);
            }
            catch (Exception ex)
            {
                // We log the exception clearly, but do not crash the service.
                // The agent will attempt to operate using default background loops, retrying registration continuously.
                _logger.LogCritical(ex, "FAILED initialization enrollment. The agent will run with offline fallbacks.");
            }

            // Begin base BackgroundService thread loops
            await base.StartAsync(cancellationToken);
        }

        /// <inheritdoc />
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Spawning dual polling & telemetry daemon loops...");

            // Execute concurrent loops within the unified generic host thread
            var pollingTask = RunPollingIterationLoopAsync(stoppingToken);
            var heartbeatTask = RunHeartbeatIterationLoopAsync(stoppingToken);

            await Task.WhenAll(pollingTask, heartbeatTask);
        }

        /// <summary>
        /// Concurrent loop executing rapid queue inspections at the configured intervals.
        /// </summary>
        private async Task RunPollingIterationLoopAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Polling engine running (Scan Resolution: {Interval} seconds)", _pollingSeconds);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (!_isRegistered)
                    {
                        _logger.LogWarning("Enrollment state unresolved. Retrying Agent Registration protocol...");
                        await AttemptReRegistrationAsync(stoppingToken);
                    }
                    else
                    {
                        // Delegate processing scope entirely
                        await _jobProcessor.ProcessPendingJobsAsync(stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Polling iteration encountered unhandled background exceptions.");
                }

                // Sleep safely matching cancellation configurations
                await Task.Delay(TimeSpan.FromSeconds(_pollingSeconds), stoppingToken);
            }
        }

        /// <summary>
        /// Concurrent loop executing steady registration heartbeats at the configured intervals.
        /// </summary>
        private async Task RunHeartbeatIterationLoopAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Telemetry scheduler running (Ping Resolution: {Interval} seconds)", _heartbeatSeconds);

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (_isRegistered)
                    {
                        var heartbeat = new AgentHeartbeatDto
                        {
                            AgentId = _agentId,
                            Status = "Running",
                            MachineName = Environment.MachineName,
                            Version = "1.0.0"
                        };

                        await _apiClient.SendHeartbeatAsync(heartbeat, stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Unable to dispatch telemetry heartbeat packets.");
                }

                await Task.Delay(TimeSpan.FromSeconds(_heartbeatSeconds), stoppingToken);
            }
        }

        private async Task AttemptReRegistrationAsync(CancellationToken cancellationToken)
        {
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

                _logger.LogInformation("Re-Registration completed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Re-enrollment failure: {Message}. Retrying next cycle.", ex.Message);
            }
        }

        /// <inheritdoc />
        public override async Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogWarning("====================================================================");
            _logger.LogWarning("UniversalPrint.Agent Service stopping. Safely disposing active sockets...");
            _logger.LogWarning("====================================================================");

            await base.StopAsync(cancellationToken);
        }
    }
}
