/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using Agent.Domain.Enums;

namespace Agent.Domain.Entities
{
    /// <summary>
    /// Represents a physically available printer configuration mapped on the customer site.
    /// </summary>
    public class Printer
    {
        public string PrinterId { get; set; } = string.Empty;
        public string PrinterName { get; set; } = string.Empty;
        public PrinterType PrinterType { get; set; }
        public string IPAddress { get; set; } = "127.0.0.1";
        public int Port { get; set; } = 9100;
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Validates that the configuration parameters are structurally correct for connection.
        /// </summary>
        public bool IsValid()
        {
            return !string.IsNullOrWhiteSpace(PrinterId) &&
                   !string.IsNullOrWhiteSpace(IPAddress) &&
                   Port > 0 && Port <= 65535;
        }
    }
}
