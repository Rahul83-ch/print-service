/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using Agent.Application.Interfaces;
using Agent.Domain.Enums;
using Agent.Infrastructure.Handlers;

namespace Agent.Infrastructure.Services
{
    /// <summary>
    /// Factory pattern to match the incoming ContentType to its specialized formatting strategy handler.
    /// </summary>
    public class PrinterHandlerFactory : IPrinterHandlerFactory
    {
        private readonly EscPosPrinterHandler _escPosHandler;
        private readonly TextPrinterHandler _textHandler;
        private readonly ZplPrinterHandler _zplHandler;
        private readonly PdfPrinterHandler _pdfHandler;

        public PrinterHandlerFactory(
            EscPosPrinterHandler escPosHandler,
            TextPrinterHandler textHandler,
            ZplPrinterHandler zplHandler,
            PdfPrinterHandler pdfHandler)
        {
            _escPosHandler = escPosHandler;
            _textHandler = textHandler;
            _zplHandler = zplHandler;
            _pdfHandler = pdfHandler;
        }

        /// <inheritdoc />
        public IPrinterHandler GetHandler(ContentType contentType)
        {
            return contentType switch
            {
                ContentType.ESC_POS => _escPosHandler,
                ContentType.TEXT => _textHandler,
                ContentType.ZPL => _zplHandler,
                ContentType.PDF => _pdfHandler,
                ContentType.RAW => _escPosHandler, // Fallback RAW binary stream directly to ESC_POS
                _ => throw new ArgumentOutOfRangeException(nameof(contentType), $"Unsupported content printing format type: {contentType}")
            };
        }
    }
}
