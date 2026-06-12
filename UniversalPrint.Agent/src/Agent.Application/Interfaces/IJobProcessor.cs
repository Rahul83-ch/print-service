/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Threading;
using System.Threading.Tasks;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract responsible for executing loop poll actions on pending queue items.
    /// </summary>
    public interface IJobProcessor
    {
        /// <summary>
        /// Orchestrates downloading, validation, printer strategy routing, error handling, and completion logs.
        /// </summary>
        Task ProcessPendingJobsAsync(CancellationToken cancellationToken);
    }
}
