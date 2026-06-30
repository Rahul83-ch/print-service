/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.Interfaces;
using Agent.Domain.Entities;
using Agent.Infrastructure.Connectors;
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Handlers
{
    /// <summary>
    /// Content strategy handler for raw ESC/POS thermal command binary streams.
    /// </summary>
    public class EscPosPrinterHandler : IPrinterHandler
    {
        private readonly TcpPrinterConnector _connector;
        private readonly ILogger<EscPosPrinterHandler> _logger;

        public EscPosPrinterHandler(TcpPrinterConnector connector, ILogger<EscPosPrinterHandler> logger)
        {
            _connector = connector;
            _logger = logger;
        }

        public async Task HandleAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("EscPosPrinterHandler: Decoding binary payload for Job '{JobId}' (ContentType = ESC_POS)...", job.JobId);

            if (string.IsNullOrEmpty(job.PrintContent))
            {
                throw new ArgumentException("ESC/POS print content is empty.");
            }

            // Decode from Base64 or encode from plain UTF-8 string
            byte[] escPosBytes;
            if (string.Equals(job.Encoding, "BASE64", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("EscPosPrinterHandler: Decoding Base64 formatted raw byte array for Job '{JobId}'", job.JobId);
                try
                {
                    escPosBytes = Convert.FromBase64String(job.PrintContent);
                }
                catch (FormatException ex)
                {
                    _logger.LogError(ex, "EscPosPrinterHandler: Content lacks correct Base64 structure for Job '{JobId}'", job.JobId);
                    throw;
                }
            }
            else
            {
                _logger.LogInformation("EscPosPrinterHandler: Falling back to UTF-8 encoding of print string for Job '{JobId}'", job.JobId);
                escPosBytes = Encoding.UTF8.GetBytes(job.PrintContent);
            }

            // Multiply binary data for multiple printed copies
            byte[] finalBytes;
            if (job.Copies > 1)
            {
                _logger.LogInformation("EscPosPrinterHandler: Replicating raw binary payload {Copies} times.", job.Copies);
                var combined = new byte[escPosBytes.Length * job.Copies];
                for (int i = 0; i < job.Copies; i++)
                {
                    Buffer.BlockCopy(escPosBytes, 0, combined, i * escPosBytes.Length, escPosBytes.Length);
                }
                finalBytes = combined;
            }
            else
            {
                finalBytes = escPosBytes;
            }

            _logger.LogInformation("EscPosPrinterHandler: Dispatching {ByteCount} bytes directly to device {IP}:{Port} without text conversion.", 
                finalBytes.Length, printer.IPAddress, printer.Port);

            await _connector.PrintBytesAsync(finalBytes, printer, cancellationToken);
        }
    }
}
