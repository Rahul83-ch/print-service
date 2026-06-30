/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using Agent.Application.Interfaces;
using Agent.Application.Services;
using Agent.Infrastructure.Api;
using Agent.Infrastructure.Connectors;
using Agent.Infrastructure.Handlers;
using Agent.Infrastructure.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Agent.Worker
{
    /// <summary>
    /// Unified main host of the UniversalPrint.Agent multi-platform service.
    /// </summary>
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }

        /// <summary>
        /// Builds a cross-platform Generic Host, integrating configuration, structured logging, and Dependency Injection services.
        /// </summary>
        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                
                // Enables executing as a native background service on both Windows and Linux hosts
                .UseWindowsService()
                .UseSystemd()
                
                .ConfigureLogging((hostContext, loggingBuilder) =>
                {
                    loggingBuilder.ClearProviders();
                    loggingBuilder.AddConsole(options =>
                    {
                        // Enable structured/highly readable console output
                        options.TimestampFormat = "[HH:mm:ss] ";
                    });
                    
                    loggingBuilder.AddDebug();
                    loggingBuilder.SetMinimumLevel(LogLevel.Information);
                })
                .ConfigureServices((hostContext, services) =>
                {
                    // 1. Register Client Layer utilizing HttpSocketsHandler Pool optimization
                    services.AddHttpClient<IAgentApiClient, AgentApiClient>()
                        .ConfigurePrimaryHttpMessageHandler(() => new System.Net.Http.SocketsHttpHandler
                        {
                            PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                            KeepAlivePingDelay = TimeSpan.FromSeconds(30),
                            KeepAlivePingTimeout = TimeSpan.FromSeconds(10)
                        });

                    // 2. Hardware Registry Controller (Single Instance required to manage local ConcurrentDictionary health caches)
                    services.AddSingleton<IPrinterManager, PrinterManager>();

                    // 3. Register Strategy-Patterned Hardware Device Connectors
                    services.AddTransient<TcpPrinterConnector>();
                    services.AddTransient<IPrinterConnector, TcpPrinterConnector>();
                    services.AddTransient<IPrinterConnector, ZebraPrinterConnector>();
                    services.AddTransient<IPrinterConnector, BrotherPrinterConnector>();
                    services.AddTransient<IPrinterConnector, TscPrinterConnector>();
                    services.AddTransient<IPrinterConnector, PdfPrinterConnector>();
                    services.AddTransient<IPrinterConnector, WindowsPrinterConnector>();

                    // 4. Register Multi-Format Formatting Strategy Handlers
                    services.AddTransient<EscPosPrinterHandler>();
                    services.AddTransient<TextPrinterHandler>();
                    services.AddTransient<ZplPrinterHandler>();
                    services.AddTransient<PdfPrinterHandler>();

                    // 5. Register strategy coordinator and factory
                    services.AddTransient<IPrinterHandlerFactory, PrinterHandlerFactory>();
                    services.AddTransient<IPrinterService, PrinterService>();

                    // 6. Register Multi-Job Parsing Pipeline
                    services.AddTransient<IJobProcessor, JobProcessor>();

                    // 7. Register Central Hosted background daemon thread
                    services.AddHostedService<Worker>();
                });
    }
}
