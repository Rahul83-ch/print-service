/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Agent.Application.Services
{
    /// <summary>
    /// Implements standard printing orchestration by coordinating printer configuration discovery
    /// and routing jobs through the factory-mapped printer strategy.
    /// </summary>
    public class PrinterService : IPrinterService
    {
        private readonly IPrinterManager _printerManager;
        private readonly IPrinterHandlerFactory _handlerFactory;
        private readonly ILogger<PrinterService> _logger;

        public PrinterService(
            IPrinterManager printerManager,
            IPrinterHandlerFactory handlerFactory,
            ILogger<PrinterService> _loggerInstance)
        {
            _printerManager = printerManager;
            _handlerFactory = handlerFactory;
            _logger = _loggerInstance;
        }

        /// <inheritdoc />
        public async Task PrintJobAsync(PrintJob job, CancellationToken cancellationToken)
        {
            if (job == null) throw new ArgumentNullException(nameof(job));

            // 1. Fetch live mapping configuration
            var printer = await _printerManager.GetPrinterAsync(job.PrinterId, cancellationToken);
            if (printer == null)
            {
                throw new InvalidOperationException($"Configuration Error: Printer '{job.PrinterId}' is unrecognized or does not exist.");
            }

            if (!printer.IsActive)
            {
                throw new InvalidOperationException($"Device Inactive: Printer '{printer.PrinterId}' ({printer.PrinterName}) is marked offline by administrative lock.");
            }

            // 2. Select Handler Strategy
            _logger.LogInformation("Orchestrating Job '{JobId}': ContentType Selected = {ContentType}, Printer = {PrinterName} ({IP}:{Port})",
                job.JobId, job.ContentType, printer.PrinterName, printer.IPAddress, printer.Port);

            var handler = _handlerFactory.GetHandler(job.ContentType);
            if (handler == null)
            {
                throw new NotSupportedException($"Strategy missing: Content type strategy handler for '{job.ContentType}' failed to load.");
            }

            _logger.LogInformation("Dispatcher strategy selected: {HandlerName} for Job '{JobId}'", handler.GetType().Name, job.JobId);

            // 3. Delegate print execution
            await handler.HandleAsync(job, printer, cancellationToken);
        }
    }
}
