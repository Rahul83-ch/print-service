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
    /// Content strategy handler for standardized PDF binary payloads.
    /// </summary>
    public class PdfPrinterHandler : IPrinterHandler
    {
        private readonly TcpPrinterConnector _connector;
        private readonly ILogger<PdfPrinterHandler> _logger;

        public PdfPrinterHandler(TcpPrinterConnector connector, ILogger<PdfPrinterHandler> logger)
        {
            _connector = connector;
            _logger = logger;
        }

        public async Task HandleAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("PdfPrinterHandler: Unpacking PDF binary streams for Job '{JobId}'...", job.JobId);

            if (string.IsNullOrEmpty(job.PrintContent))
            {
                throw new ArgumentException("PDF document content is empty.");
            }

            byte[] pdfBytes;
            if (string.Equals(job.Encoding, "BASE64", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("PdfPrinterHandler: Decoding Base64 PDF file for Job '{JobId}'", job.JobId);
                pdfBytes = Convert.FromBase64String(job.PrintContent);
            }
            else
            {
                _logger.LogInformation("PdfPrinterHandler: Reading plain UTF-8 binary string for Job '{JobId}'", job.JobId);
                pdfBytes = Encoding.UTF8.GetBytes(job.PrintContent);
            }

            // Since PDF is a structured document layout format, direct duplication of binary streams
            // is not valid PDF combining, but for raw page feeder streams, we replicate based on copies
            byte[] finalBytes;
            if (job.Copies > 1)
            {
                _logger.LogInformation("PdfPrinterHandler: Concatenating direct stream outputs {Copies} times.", job.Copies);
                var combined = new byte[pdfBytes.Length * job.Copies];
                for (int i = 0; i < job.Copies; i++)
                {
                    Buffer.BlockCopy(pdfBytes, 0, combined, i * pdfBytes.Length, pdfBytes.Length);
                }
                finalBytes = combined;
            }
            else
            {
                finalBytes = pdfBytes;
            }

            _logger.LogInformation("PdfPrinterHandler: Routing raw PDF envelope bytes ({ByteCount} bytes) to target port...", finalBytes.Length);
            await _connector.PrintBytesAsync(finalBytes, printer, cancellationToken);
        }
    }
}
