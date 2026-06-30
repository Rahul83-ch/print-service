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
    /// Contract defining an individual content printing strategy.
    /// </summary>
    public interface IPrinterHandler
    {
        /// <summary>
        /// Handles formatting and printing for a specific content type.
        /// </summary>
        Task HandleAsync(PrintJob job, Printer printer, CancellationToken cancellationToken);
    }
}
