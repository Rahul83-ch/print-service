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
    /// Content strategy handler for plain TEXT documents and reports.
    /// </summary>
    public class TextPrinterHandler : IPrinterHandler
    {
        private readonly TcpPrinterConnector _connector;
        private readonly ILogger<TextPrinterHandler> _logger;

        public TextPrinterHandler(TcpPrinterConnector connector, ILogger<TextPrinterHandler> logger)
        {
            _connector = connector;
            _logger = logger;
        }

        public async Task HandleAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("TextPrinterHandler: Parsing raw string entries for Job '{JobId}'...", job.JobId);

            if (string.IsNullOrEmpty(job.PrintContent))
            {
                throw new ArgumentException("Plain text print content is empty.");
            }

            byte[] textBytes;
            if (string.Equals(job.Encoding, "BASE64", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation("TextPrinterHandler: Base64 decoding text file for Job '{JobId}'", job.JobId);
                textBytes = Convert.FromBase64String(job.PrintContent);
            }
            else
            {
                _logger.LogInformation("TextPrinterHandler: Encoding plain text with UTF-8 for Job '{JobId}'", job.JobId);
                textBytes = Encoding.UTF8.GetBytes(job.PrintContent);
            }

            byte[] finalBytes;
            if (job.Copies > 1)
            {
                _logger.LogInformation("TextPrinterHandler: Replicating text payloads {Copies} times.", job.Copies);
                string textSegment = Encoding.UTF8.GetString(textBytes);
                var sb = new StringBuilder();
                for (int i = 0; i < job.Copies; i++)
                {
                    sb.AppendLine(textSegment);
                }
                finalBytes = Encoding.UTF8.GetBytes(sb.ToString());
            }
            else
            {
                finalBytes = textBytes;
            }

            _logger.LogInformation("TextPrinterHandler: Transmitting text bytes to generic TCP/IP channel...");
            await _connector.PrintBytesAsync(finalBytes, printer, cancellationToken);
        }
    }
}
