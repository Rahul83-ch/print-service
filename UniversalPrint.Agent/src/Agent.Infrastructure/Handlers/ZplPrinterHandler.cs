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
using PDFtoZPL;

namespace Agent.Infrastructure.Handlers
{
    /// <summary>
    /// Content strategy handler for Zebra Programming Language (ZPL) payloads.
    /// </summary>
    public class ZplPrinterHandler : IPrinterHandler
    {
        private readonly TcpPrinterConnector _connector;
        private readonly ILogger<ZplPrinterHandler> _logger;

        public ZplPrinterHandler(TcpPrinterConnector connector, ILogger<ZplPrinterHandler> logger)
        {
            _connector = connector;
            _logger = logger;
        }

        public async Task HandleAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ZplPrinterHandler: Processing print job '{JobId}' for Zebra layout...", job.JobId);

            if (string.IsNullOrEmpty(job.PrintContent))
            {
                throw new ArgumentException("ZPL print content is empty.");
            }

            // Support Base64 decoding or fall back to raw string decoding
            byte[] zplBytes;
            if (string.Equals(job.Encoding, "BASE64", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("ZplPrinterHandler: Decoding BASE64 content for Job '{JobId}'", job.JobId);
                zplBytes = Convert.FromBase64String(job.PrintContent);
            }
            else
            {
                _logger.LogInformation("ZplPrinterHandler: Processing plain text UTF-8 content for Job '{JobId}'", job.JobId);
                zplBytes = Encoding.UTF8.GetBytes(job.PrintContent);
            }

            // If we have multiple copies requested, we duplicate the structured ZPL segments
            string zpl = ConvertPdfToZpl(zplBytes, pageIndex: 0, dpi: 203);
            if (string.IsNullOrWhiteSpace(zpl))
                throw new InvalidOperationException("Failed to convert PDF to ZPL.");

            if (job.Copies > 1)
            {
                zpl = zpl.Replace("^XZ", $"^PQ{job.Copies}^XZ");
            }
            _logger.LogInformation("ZplPrinterHandler: Relaying ZPL formatted bytes to network printer via generic TCP connector...");
            await _connector.PrintZplAsync(zpl, printer, cancellationToken);
        }

        public static string ConvertPdfToZpl(byte[] pdfBytes, int pageIndex = 0, int dpi = 0)
        {
            var options = new PdfOptions
            {
                Dpi = dpi,
            };
            return PDFtoZPL.Conversion.ConvertPdfPage(pdfBytes, page: pageIndex, pdfOptions: options);
        }
    }
}
