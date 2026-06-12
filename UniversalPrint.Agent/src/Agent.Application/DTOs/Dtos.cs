/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Generic;
using Agent.Domain.Enums;

namespace Agent.Application.DTOs
{
    /// <summary>
    /// Payload indicating unique hardware references transmitted to register an active agent.
    /// </summary>
    public class AgentRegistrationDto
    {
        public string AgentId { get; set; } = string.Empty;
        public string AgentName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
        public string MachineName { get; set; } = string.Empty;
    }

    /// <summary>
    /// Initial startup settings retrieved from the Server.
    /// </summary>
    public class AgentConfigDto
    {
        public string AgentId { get; set; } = string.Empty;
        public int PollingIntervalSeconds { get; set; } = 5;
        public int HeartbeatIntervalSeconds { get; set; } = 60;
        public List<PrinterDto> AssignedPrinters { get; set; } = new();
    }

    /// <summary>
    /// DTO defining localized printer configurations stored in database metadata.
    /// </summary>
    public class PrinterDto
    {
        public string PrinterId { get; set; } = string.Empty;
        public string PrinterName { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public string IPAddress { get; set; } = "127.0.0.1";
        public int Port { get; set; } = 9100;
        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// Telemetry packet indicating that the local service is operating properly.
    /// </summary>
    public class AgentHeartbeatDto
    {
        public string AgentId { get; set; } = string.Empty;
        public string Status { get; set; } = "Running";
        public string MachineName { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
    }

    /// <summary>
    /// Payload downloaded from the pending job queue.
    /// </summary>
    public class PrintJobDto
    {
        public string JobId { get; set; } = string.Empty;
        public string PrinterId { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public int Copies { get; set; } = 1;
        public ContentType ContentType { get; set; }
        public string PrintContent { get; set; } = string.Empty;
        public DateTime SubmittedOn { get; set; }
    }
}
