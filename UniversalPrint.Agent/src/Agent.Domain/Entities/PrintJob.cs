/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using Agent.Domain.Enums;

namespace Agent.Domain.Entities
{
    /// <summary>
    /// Represents an individual command sequence scheduled for physical printing.
    /// </summary>
    public class PrintJob
    {
        public string JobId { get; set; } = string.Empty;
        public string PrinterId { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public int Copies { get; set; } = 1;
        public ContentType ContentType { get; set; }
        public string Encoding { get; set; } = "NONE";
        public string PrintContent { get; set; } = string.Empty;
        public DateTime SubmittedOn { get; set; }
        public JobStatus Status { get; set; } = JobStatus.Pending;
        public string? ErrorMessage { get; set; }
        public DateTime? ProcessedAt { get; set; }
    }
}
