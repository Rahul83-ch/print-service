/**
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
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Connectors
{
    /// <summary>
    /// Implements socket stream tunneling for Zebra barcoding & labeling hardware over raw TCP Port 9100.
    /// </summary>
    public class ZebraPrinterConnector : IPrinterConnector, IDisposable
    {
        private readonly Microsoft.Extensions.Logging.ILogger<ZebraPrinterConnector> _logger;

        public ZebraPrinterConnector(Microsoft.Extensions.Logging.ILogger<ZebraPrinterConnector> logger)
        {
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Streaming ZPL instructions to Zebra hardware at {IP}:{Port} (Id: {PrinterId}, Copies: {Copies})", 
                printer.IPAddress, printer.Port, printer.PrinterId, job.Copies);

            if (string.IsNullOrWhiteSpace(job.PrintContent))
            {
                throw new ArgumentException("Active block content is empty or structurally corrupted.");
            }

            // Standard ticket multiplier for loops
            string finalZplPayload = string.Empty;
            for (int i = 0; i < job.Copies; i++)
            {
                finalZplPayload += job.PrintContent + Environment.NewLine;
            }

            byte[] byteBuffer = Encoding.UTF8.GetBytes(finalZplPayload);
            await PrintBytesAsync(byteBuffer, printer, cancellationToken);
        }

        /// <inheritdoc />
        public async Task PrintBytesAsync(byte[] bytes, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("ZebraPrinterConnector sending raw bytes stream to {IP}:{Port} (Length: {ByteLength} bytes)", 
                printer.IPAddress, printer.Port, bytes.Length);

            using var tcpClient = new TcpClient();
            await tcpClient.ConnectAsync(printer.IPAddress, printer.Port, cancellationToken);
            
            using NetworkStream networkStream = tcpClient.GetStream();
            await networkStream.WriteAsync(bytes.AsMemory(0, bytes.Length), cancellationToken);
            await networkStream.FlushAsync(cancellationToken);
            
            _logger.LogInformation("Flash buffer transmission completed successfully for Zebra Printer '{PrinterId}'.", printer.PrinterId);
        }

        /// <inheritdoc />
        public async Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            try
            {
                using var tcpClient = new TcpClient();
                // Perform a quick TCP Syn socket probe to confirm socket health
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(3)); // Tight 3-second limit for diagnostic validation

                await tcpClient.ConnectAsync(printer.IPAddress, printer.Port, cts.Token);
                return tcpClient.Connected;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Diagnostic socket probe failures detected on device '{PrinterId}' at {IP}:{Port}. Reason: {Msg}",
                    printer.PrinterId, printer.IPAddress, printer.Port, ex.Message);
                return false;
            }
        }

        public void Dispose()
        {
            // Thread resource cleanup if any permanent references are retained
            GC.SuppressFinalize(this);
        }
    }
}
