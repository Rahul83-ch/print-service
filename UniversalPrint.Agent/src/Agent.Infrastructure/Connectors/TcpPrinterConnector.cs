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
    /// Implements generic driverless TCP socket streaming (Port 9100/etc.) sending raw byte packets directly to hardware.
    /// </summary>
    public class TcpPrinterConnector : IPrinterConnector, IDisposable
    {
        private readonly ILogger<TcpPrinterConnector> _logger;

        public TcpPrinterConnector(ILogger<TcpPrinterConnector> logger)
        {
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task PrintBytesAsync(byte[] bytes, Printer printer, CancellationToken cancellationToken)
        {
            if (bytes == null || bytes.Length == 0)
            {
                throw new ArgumentException("The raw byte array to transmit is empty or unallocated.");
            }

            _logger.LogInformation("TCP socket broadcast started: Sending {ByteLength} raw bytes to device health at {IP}:{Port}", 
                bytes.Length, printer.IPAddress, printer.Port);

            using var tcpClient = new TcpClient();
            
            // Connect with cancellation support
            _logger.LogDebug("Opening raw TCP socket with target {IP}:{Port}...", printer.IPAddress, printer.Port);
            await tcpClient.ConnectAsync(printer.IPAddress, printer.Port, cancellationToken);
            
            using NetworkStream networkStream = tcpClient.GetStream();
            _logger.LogInformation("TCP connection established successfully with printer at {IP}:{Port}.", printer.IPAddress, printer.Port);

            // Write and flush byte segments
            await networkStream.WriteAsync(bytes.AsMemory(0, bytes.Length), cancellationToken);
            await networkStream.FlushAsync(cancellationToken);

            _logger.LogInformation("Transmission of raw packet stream (Length: {ByteLength} bytes) completed successfully on generic connector.", bytes.Length);
        }

        /// <inheritdoc />
        public async Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken)
        {
            _logger.LogInformation("PrintAsync fallback called on generic TCP connector. Converting PrintContent string to bytes.");

            if (string.IsNullOrWhiteSpace(job.PrintContent))
            {
                throw new ArgumentException("Active block content is empty or structurally corrupted.");
            }

            // Simple replicate of copies for backward compatibility
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < job.Copies; i++)
            {
                sb.AppendLine(job.PrintContent);
            }

            byte[] byteBuffer = Encoding.UTF8.GetBytes(sb.ToString());
            await PrintBytesAsync(byteBuffer, printer, cancellationToken);
        }

        /// <inheritdoc />
        public async Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken)
        {
            try
            {
                using var tcpClient = new TcpClient();
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                cts.CancelAfter(TimeSpan.FromSeconds(3)); // 3-second rapid timeout for ping checks

                await tcpClient.ConnectAsync(printer.IPAddress, printer.Port, cts.Token);
                return tcpClient.Connected;
            }
            catch (Exception ex)
            {
                _logger.LogWarning("Socket validation handshake failed on Printer '{PrinterId}' at {IP}:{Port}. Message: {Msg}",
                    printer.PrinterId, printer.IPAddress, printer.Port, ex.Message);
                return false;
            }
        }

        public void Dispose()
        {
            GC.SuppressFinalize(this);
        }
    }
}
