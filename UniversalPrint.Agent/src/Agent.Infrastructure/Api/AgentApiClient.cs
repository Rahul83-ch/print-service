/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Agent.Application.DTOs;
using Agent.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Agent.Infrastructure.Api
{
    /// <summary>
    /// Resilient typed HTTP client that integrates with the Central Print Management platform APIs.
    /// </summary>
    public class AgentApiClient : IAgentApiClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<AgentApiClient> _logger;
        private readonly JsonSerializerOptions _jsonOptions;

        public AgentApiClient(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<AgentApiClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            
            // Extract Configuration Safely
            var baseUrl = configuration["ApiSettings:BaseUrl"] ?? "https://api.universalprint.com";
            var apiKey = configuration["ApiSettings:ApiKey"];
            var bearerToken = configuration["ApiSettings:BearerToken"];

            _httpClient.BaseAddress = new Uri(baseUrl);
            _httpClient.DefaultRequestHeaders.Accept.Clear();
            _httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            // Inject API Credentials
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                _httpClient.DefaultRequestHeaders.Add("X-API-KEY", apiKey);
                _logger.LogDebug("Injected Platform credential schema: X-API-KEY header.");
            }
            else if (!string.IsNullOrWhiteSpace(bearerToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
                _logger.LogDebug("Injected Platform credential schema: Bearer Authentication Header.");
            }

            _jsonOptions = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                WriteIndented = false
            };
            _jsonOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        }

        /// <inheritdoc />
        public async Task<AgentConfigDto> RegisterAgentAsync(AgentRegistrationDto registration, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Posting registration sequence to Central Platform...");
            var content = new StringContent(JsonSerializer.Serialize(registration, _jsonOptions), Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("/api/agents/register", content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var jsonString = await response.Content.ReadAsStringAsync(cancellationToken);
            var config = JsonSerializer.Deserialize<AgentConfigDto>(jsonString, _jsonOptions);

            if (config == null)
            {
                throw new InvalidOperationException("API response yielded a null configuration template.");
            }

            _logger.LogInformation("Agent registered successfully. Received {PrinterCount} matching hardware configurations.", config.AssignedPrinters.Count);
            return config;
        }

        /// <inheritdoc />
        public async Task SendHeartbeatAsync(AgentHeartbeatDto heartbeat, CancellationToken cancellationToken)
        {
            _logger.LogDebug("Transmitting telemetry ping...");
            var content = new StringContent(JsonSerializer.Serialize(heartbeat, _jsonOptions), Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("/api/agents/heartbeat", content, cancellationToken);
            response.EnsureSuccessStatusCode();
            
            _logger.LogDebug("Telemetry heartbeat transmitted successfully.");
        }

        /// <inheritdoc />
        public async Task<IEnumerable<PrintJobDto>> GetPendingJobsAsync(string agentId, CancellationToken cancellationToken)
        {
            _logger.LogDebug("Querying endpoint queue for Agent '{AgentId}'...", agentId);
            var response = await _httpClient.GetAsync($"/api/agents/{agentId}/jobs", cancellationToken);
            response.EnsureSuccessStatusCode();

            var jsonString = await response.Content.ReadAsStringAsync(cancellationToken);
            var jobs = JsonSerializer.Deserialize<IEnumerable<PrintJobDto>>(jsonString, _jsonOptions);
            
            return jobs ?? Array.Empty<PrintJobDto>();
        }

        /// <inheritdoc />
        public async Task MarkJobCompletedAsync(string jobId, CancellationToken cancellationToken)
        {
            _logger.LogInformation("Notifying completion on Job ID '{JobId}'", jobId);
            
            var response = await _httpClient.PostAsync($"/api/jobs/{jobId}/complete", null!, cancellationToken);
            response.EnsureSuccessStatusCode();
        }

        /// <inheritdoc />
        public async Task MarkJobFailedAsync(string jobId, string errorMessage, CancellationToken cancellationToken)
        {
            _logger.LogWarning("Transmitting failure state for Job ID '{JobId}': {Error}", jobId, errorMessage);
            
            var payload = new { Error = errorMessage, FailedAt = DateTime.UtcNow };
            var content = new StringContent(JsonSerializer.Serialize(payload, _jsonOptions), Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync($"/api/jobs/{jobId}/failed", content, cancellationToken);
            response.EnsureSuccessStatusCode();
        }
    }
}
