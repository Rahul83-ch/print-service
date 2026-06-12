/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Services
{
    /// <summary>
    /// Threadsafe memory registry managing localized active printer routes and ping metrics.
    /// </summary>
    public class PrinterManager : IPrinterManager
    {
        private readonly ConcurrentDictionary<string, Printer> _cachedPrinters;
        private readonly IEnumerable<IPrinterConnector> _connectors;
        private readonly ILogger<PrinterManager> _logger;

        public PrinterManager(
            IEnumerable<IPrinterConnector> connectors,
            ILogger<PrinterManager> logger)
        {
            _cachedPrinters = new ConcurrentDictionary<string, Printer>(StringComparer.OrdinalIgnoreCase);
            _connectors = connectors;
            _logger = logger;
        }

        /// <inheritdoc />
        public void SyncPrinters(IEnumerable<Printer> printers)
        {
            _logger.LogInformation("Refreshing local hardware registry with updated assignments...");
            
            // Retain active tracking structures
            var incomingIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var printer in printers)
            {
                incomingIds.Add(printer.PrinterId);
                _cachedPrinters.AddOrUpdate(printer.PrinterId, printer, (_, existing) =>
                {
                    _logger.LogDebug("Modifying localized configurations dynamic states for '{PrinterId}'", printer.PrinterId);
                    return printer;
                });
            }

            // Purge unallocated nodes
            foreach (var existingKey in _cachedPrinters.Keys)
            {
                if (!incomingIds.Contains(existingKey))
                {
                    if (_cachedPrinters.TryRemove(existingKey, out var removed))
                    {
                        _logger.LogWarning("Deallocated legacy printer definition trace: {PrinterId} ({PrinterName})", 
                            removed.PrinterId, removed.PrinterName);
                    }
                }
            }

            _logger.LogInformation("Hardware synchronisation completed. Live instances: {RegistryCount}", _cachedPrinters.Count);
        }

        /// <inheritdoc />
        public Task<Printer?> GetPrinterAsync(string printerId, CancellationToken cancellationToken)
        {
            if (_cachedPrinters.TryGetValue(printerId, out var printer))
            {
                return Task.FromResult<Printer?>(printer);
            }
            return Task.FromResult<Printer?>(null);
        }

        /// <inheritdoc />
        public async Task<IDictionary<string, bool>> VerifyAllPrintersHealthAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Starting broad background diagnostics cycle over cached hardware profiles...");
            var healthMap = new Dictionary<string, bool>();

            foreach (var entry in _cachedPrinters)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var printer = entry.Value;
                if (!printer.IsActive)
                {
                    healthMap.Add(printer.PrinterId, false);
                    continue;
                }

                bool isOnline = false;
                try
                {
                    // Find matching Zebra or Generic connector to run socket handshake checks
                    foreach (var conn in _connectors)
                    {
                        if (conn.GetType().Name.Contains(printer.PrinterType.ToString(), StringComparison.OrdinalIgnoreCase))
                        {
                            isOnline = await conn.ValidateConnectionAsync(printer, cancellationToken);
                            break;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Diagnostics socket run-failure encountered on Printer '{PrinterId}'.", printer.PrinterId);
                }

                healthMap.Add(printer.PrinterId, isOnline);
                _logger.LogInformation("Diagnostics results: Printer '{Id}' ({IP}:{Port}) -> Status: {Status}", 
                    printer.PrinterId, printer.IPAddress, printer.Port, isOnline ? "ONLINE" : "OFFLINE");
            }

            return healthMap;
        }
    }
}
