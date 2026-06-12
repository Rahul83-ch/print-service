/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Agent.Domain.Entities;

namespace Agent.Application.Interfaces
{
    /// <summary>
    /// Contract responsible for localized hardware device discovery and caching configuration maps.
    /// </summary>
    public interface IPrinterManager
    {
        /// <summary>
        /// Populates localized memory caches using properties fetched from the cloud server.
        /// </summary>
        void SyncPrinters(IEnumerable<Printer> printers);

        /// <summary>
        /// Retrieves individual hardware profile mapping by primary keys.
        /// </summary>
        Task<Printer?> GetPrinterAsync(string printerId, CancellationToken cancellationToken);

        /// <summary>
        /// Cycles over all caches triggering localized socket check handshakes.
        /// </summary>
        Task<IDictionary<string, bool>> VerifyAllPrintersHealthAsync(CancellationToken cancellationToken);
    }
}
