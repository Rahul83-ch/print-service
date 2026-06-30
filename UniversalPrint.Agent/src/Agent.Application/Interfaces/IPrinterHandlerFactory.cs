/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using Agent.Domain.Enums;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Factory for resolving the proper content type handler strategy.
    /// </summary>
    public interface IPrinterHandlerFactory
    {
        /// <summary>
        /// Retrieves the correct handler implementation matching the print job's ContentType.
        /// </summary>
        IPrinterHandler GetHandler(ContentType contentType);
    }
}
