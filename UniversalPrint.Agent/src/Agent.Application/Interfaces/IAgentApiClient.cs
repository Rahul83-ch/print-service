/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.DTOs;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract defining interactions with the Central Print Management System.
    /// </summary>
    public interface IAgentApiClient
    {
        /// <summary>
        /// Registers current machine configuration in the cloud or microservice node on boot.
        /// </summary>
        Task<AgentConfigDto> RegisterAgentAsync(AgentRegistrationDto registration, CancellationToken cancellationToken);

        /// <summary>
        /// Sends regular health updates and active flag status.
        /// </summary>
        Task SendHeartbeatAsync(AgentHeartbeatDto heartbeat, CancellationToken cancellationToken);

        /// <summary>
        /// Polls for unprinted queue jobs currently routed to this agent unit.
        /// </summary>
        Task<IEnumerable<PrintJobDto>> GetPendingJobsAsync(string agentId, CancellationToken cancellationToken);

        /// <summary>
        /// Signals precise success telemetry back to the centralized platform.
        /// </summary>
        Task MarkJobCompletedAsync(string jobId, CancellationToken cancellationToken);

        /// <summary>
        /// Sends physical error descriptions or paper/connection issues back to the centralized platform.
        /// </summary>
        Task MarkJobFailedAsync(string jobId, string errorMessage, CancellationToken cancellationToken);
    }
}
