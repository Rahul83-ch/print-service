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
    /// Decoupled printer interface responsible orchestrating printing handlers and hardware connectors.
    /// </summary>
    public interface IPrinterService
    {
        /// <summary>
        /// Resolves strategies, converts raw packets, and executes the print task.
        /// </summary>
        Task PrintJobAsync(PrintJob job, CancellationToken cancellationToken);
    }
}
