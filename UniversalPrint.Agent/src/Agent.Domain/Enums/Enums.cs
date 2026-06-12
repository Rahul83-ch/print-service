/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

namespace Agent.Domain.Enums
{
    /// <summary>
    /// Represents the hardware manufacturers and communication formats of supported printers.
    /// </summary>
    public enum PrinterType
    {
        Zebra,
        Brother,
        TSC,
        PDF,
        WindowsPrinter
    }

    /// <summary>
    /// Represents the format/encoding of the print layout content.
    /// </summary>
    public enum ContentType
    {
        ZPL,
        PDF,
        RAW,
        TEXT
    }

    /// <summary>
    /// Represents the current life-cycle status of an assigned Print Job.
    /// </summary>
    public enum JobStatus
    {
        Pending,
        Printing,
        Printed,
        Failed
    }
}
