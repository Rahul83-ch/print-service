/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Threading;
using System.Threading.Tasks;
using Agent.Domain.Entities;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract defining direct driverless socket or endpoint streaming to label & ticket printers.
    /// </summary>
    public interface IPrinterConnector
    {
        /// <summary>
        /// Sends raw print templates (ZPL/PDF/RAW) directly over tcp socket or specified channel.
        /// </summary>
        Task PrintAsync(PrintJob job, Printer printer, CancellationToken cancellationToken);

        /// <summary>
        /// Attempts to establish a lightweight handshake to probe hardware state.
        /// </summary>
        Task<bool> ValidateConnectionAsync(Printer printer, CancellationToken cancellationToken);
    }
}
