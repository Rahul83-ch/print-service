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

namespace Agent.Infrastructure.Connectors
{
    /// <summary>
    /// Extension stub for high-performance Brother ticket and receipt printing mechanisms.
    /// </summary>
    public class BrotherPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<BrotherPrinterConnector> _logger;

        public BrotherPrinterConnector(ILogger<BrotherPrinterConnector> logger)
        {
            _logger = logger;
        }

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Faking Brother printer pipeline stream to {IP}:{Port}.", printer.IPAddress, printer.Port);
            throw new NotImplementedException("Brother thermal stream protocol is being configured. Expected Release: Q3.");
        }

        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }
    }

    /// <summary>
    /// Extension stub for TSC heavy-duty industrial label printers.
    /// </summary>
    public class TscPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<TscPrinterConnector> _logger;

        public TscPrinterConnector(ILogger<TscPrinterConnector> logger)
        {
            _logger = logger;
        }

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Faking TSC print pipeline stream to {IP}:{Port}.", printer.IPAddress, printer.Port);
            throw new NotImplementedException("TSC hardware interface protocol is being configured. Expected Release: Q3.");
        }

        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }
    }

    /// <summary>
    /// Extension stub for direct document printing utilizing PDF standard structures.
    /// </summary>
    public class PdfPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<PdfPrinterConnector> _logger;

        public PdfPrinterConnector(ILogger<PdfPrinterConnector> logger)
        {
            _logger = logger;
        }

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Faking local PDF compiler pipeline to document writer at {IP}:{Port}.", printer.IPAddress, printer.Port);
            throw new NotImplementedException("PDF document render-to-stream compiler is being configured. Expected Release: Q4.");
        }

        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }
    }

    /// <summary>
    /// Extension stub for local Windows printing using Spooler or PrintDocument APIs.
    /// </summary>
    public class WindowsPrinterConnector : IPrinterConnector
    {
        private readonly ILogger<WindowsPrinterConnector> _logger;

        public WindowsPrinterConnector(ILogger<WindowsPrinterConnector> logger)
        {
            _logger = logger;
        }

        public Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Targeting local Windows Spooler queue '{QueueName}'.", printer.PrinterName);
            throw new NotImplementedException("Windows spool driver wrapper requires OS integration modules. Expected Release: Q4.");
        }

        public Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            return Task.FromResult(true);
        }
    }
}
